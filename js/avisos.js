// Avisos push: cuando termina una partida, el resto del grupo recibe una
// notificación en el celular aunque tenga la app cerrada (Android y iPhone).
//
// Cómo funciona:
//  1. Cada celular que activa los avisos se suscribe al servicio de push de su
//     sistema (Google / Apple) y guarda esa suscripción en Firestore
//     (grupos/{codigo}/dispositivos/{id}).
//  2. Al terminar una partida, este celular lee las suscripciones del grupo y
//     se las pasa al Worker de Cloudflare (ver carpeta anotador-push), que cifra
//     el mensaje y lo entrega. El celular que anotó no se avisa a sí mismo.
//  3. El service worker (sw.js) recibe el push y muestra la notificación.
import * as nube from './nube.js';
import * as ui from './ui.js';
import { storage } from './storage.js';

// Dirección del Worker de Cloudflare. Vacía = avisos todavía sin configurar.
const URL_WORKER = 'https://anotador-vdk-push.anotador-vdk-push.workers.dev/';
// Clave pública VAPID (la privada vive solo en Cloudflare, nunca en este repo).
const VAPID_PUBLICA = 'BN8Vv2_GHlJy3kRhFKx9Aa0AcOVuivVRs0MYPEgyy97VRnlue3bp5Cne4i1xbqQ3DbxAq2qon_WKVFYDkdvVGIw';

const URL_APP = './';

function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function esAppInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function soportado() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Motivo por el que no se pueden activar (o null si se puede).
function motivoNoDisponible() {
  if (!URL_WORKER) return 'Los avisos todavía no están configurados.';
  if (!soportado()) {
    return esIOS() && !esAppInstalada()
      ? 'En iPhone primero tocá Compartir → "Agregar a pantalla de inicio" y abrí la app desde ese ícono.'
      : 'Este navegador no permite avisos.';
  }
  if (Notification.permission === 'denied') return 'Bloqueaste los avisos. Habilitalos en los ajustes del navegador o del celular.';
  return null;
}

function base64UrlABytes(texto) {
  const relleno = '='.repeat((4 - (texto.length % 4)) % 4);
  const binario = atob((texto + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

// El id del dispositivo se deriva de la dirección de su suscripción, así
// volver a activar no genera duplicados.
async function idDe(endpoint) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function suscripcionActual() {
  if (!soportado()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function registrarEnGrupo(sub) {
  if (!storage.getCodigoGrupo()) return;
  const id = await idDe(sub.endpoint);
  storage.setDispositivoAvisosId(id);
  await nube.guardarDispositivoNube({ id, subscription: sub.toJSON() });
}

export async function activar() {
  const motivo = motivoNoDisponible();
  if (motivo) { ui.toast(motivo, 5000); return; }
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { ui.toast('No diste permiso para los avisos', 4000); renderEstado(); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(VAPID_PUBLICA) });
    await registrarEnGrupo(sub);
    ui.toast('¡Listo! Te van a llegar los avisos de partidas');
  } catch (err) {
    console.error('No se pudieron activar los avisos', err);
    ui.toast('No se pudieron activar los avisos', 4000);
  }
  renderEstado();
}

export async function desactivar() {
  try {
    const sub = await suscripcionActual();
    const id = storage.getDispositivoAvisosId();
    if (id) nube.borrarDispositivoNube(id).catch(() => {});
    if (sub) await sub.unsubscribe();
    storage.setDispositivoAvisosId(null);
    ui.toast('Avisos desactivados');
  } catch (err) {
    console.error('No se pudieron desactivar los avisos', err);
  }
  renderEstado();
}

// Si los avisos ya estaban activos, vuelve a anotar este celular en el grupo
// actual (por si se unió a otro grupo, o la suscripción se renovó).
export async function sincronizar() {
  try {
    if (!URL_WORKER || !soportado() || Notification.permission !== 'granted') return;
    const sub = await suscripcionActual();
    if (sub) await registrarEnGrupo(sub);
  } catch (err) {
    console.warn('No se pudo sincronizar el aviso de este dispositivo', err);
  }
}

// Al salir de un grupo, este celular deja de recibir los avisos de ese grupo.
export function quitarDelGrupo() {
  const id = storage.getDispositivoAvisosId();
  const codigo = storage.getCodigoGrupo();
  if (id && codigo) nube.borrarDispositivoNube(id, codigo).catch(() => {});
}

/* ---------------- Enviar el aviso de una partida terminada ---------------- */

function nombresEquipo(personas, nombreEquipo) {
  const nombres = (personas || []).map((p) => p.nombre).filter(Boolean);
  return { texto: nombres.length ? nombres.join(' y ') : nombreEquipo, plural: nombres.length > 1 };
}

export function armarMensaje(entrada) {
  if (entrada.tipo === 'truco') {
    const gana = entrada.equipoGanadorIdx === 1 ? 'B' : 'A';
    const pierde = gana === 'A' ? 'B' : 'A';
    const g = nombresEquipo(entrada[`personas${gana}`], entrada[`equipo${gana}`]);
    const p = nombresEquipo(entrada[`personas${pierde}`], entrada[`equipo${pierde}`]);
    return {
      titulo: '🏆 Se jugó un truco',
      cuerpo: `${g.texto} ${g.plural ? 'ganaron' : 'ganó'} ${entrada[`puntos${gana}`]}–${entrada[`puntos${pierde}`]} contra ${p.texto}`,
    };
  }
  if (entrada.tipo === 'podrida') {
    const orden = [...(entrada.jugadores || [])].sort((a, b) => b.puntaje - a.puntaje);
    if (!orden.length) return null;
    const resto = orden.slice(1, 3).map((j, i) => `${i + 2}º ${j.nombre}`).join(', ');
    return {
      titulo: '🃏 Se jugó una podrida',
      cuerpo: `Ganó ${orden[0].nombre} con ${orden[0].puntaje} puntos${resto ? ` · ${resto}` : ''}`,
    };
  }
  return null;
}

async function enviar(mensaje) {
  const propio = storage.getDispositivoAvisosId();
  const destinos = (await nube.obtenerDispositivosNube()).filter((d) => d.id !== propio && d.subscription);
  if (!destinos.length) return;
  const respuesta = await fetch(URL_WORKER, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      dispositivos: destinos.map((d) => ({ id: d.id, subscription: d.subscription })),
      titulo: mensaje.titulo,
      cuerpo: mensaje.cuerpo,
      url: URL_APP,
    }),
  });
  if (!respuesta.ok) throw new Error(`El Worker respondió ${respuesta.status}`);
  const { muertos = [] } = await respuesta.json();
  // Suscripciones vencidas (celulares que desinstalaron la app, etc.): se limpian.
  muertos.forEach((id) => nube.borrarDispositivoNube(id).catch(() => {}));
}

// Si no había señal al terminar la partida, el aviso queda pendiente y se
// reintenta cuando vuelve la conexión (o al abrir la app).
async function reintentarPendientes() {
  const pendientes = storage.getAvisosPendientes();
  if (!pendientes.length || !navigator.onLine) return;
  storage.setAvisosPendientes([]);
  for (const mensaje of pendientes) {
    try { await enviar(mensaje); } catch (e) { guardarPendiente(mensaje); }
  }
}

function guardarPendiente(mensaje) {
  const frescos = storage.getAvisosPendientes().filter((m) => Date.now() - m.cuando < 6 * 3600 * 1000);
  frescos.push({ ...mensaje, cuando: Date.now() });
  storage.setAvisosPendientes(frescos.slice(-5));
}

// Se llama al guardar cada partida terminada (no amistosa). Nunca lanza error:
// avisar es un extra y no puede romper el guardado.
export function notificarPartida(entrada) {
  if (!URL_WORKER) return;
  const mensaje = armarMensaje(entrada);
  if (!mensaje) return;
  enviar(mensaje).catch((err) => {
    console.warn('No se pudo avisar al grupo, queda pendiente', err);
    guardarPendiente(mensaje);
  });
}

/* ---------------- Pantalla Personas: botón de avisos ---------------- */

export async function renderEstado() {
  const fila = document.getElementById('fila-avisos');
  if (!fila) return;
  const texto = fila.querySelector('[data-avisos-texto]');
  const accion = fila.querySelector('[data-avisos-accion]');
  const boton = fila.querySelector('[data-accion="alternar-avisos"]');
  const motivo = motivoNoDisponible();
  let activos = false;
  try { activos = !motivo && Notification.permission === 'granted' && !!(await suscripcionActual()); } catch (e) { /* sin soporte */ }

  fila.hidden = !URL_WORKER;
  if (activos) {
    texto.textContent = '🔔 Avisos de partidas activados';
    boton.textContent = 'Desactivar';
    accion.hidden = false;
  } else if (motivo) {
    // No se pueden activar (iPhone sin instalar, permiso bloqueado, etc.): solo se explica por qué.
    texto.textContent = `🔕 ${motivo}`;
    accion.hidden = true;
  } else {
    texto.textContent = '🔕 Avisos de partidas desactivados';
    boton.textContent = 'Activar';
    accion.hidden = false;
  }
}

export const acciones = {
  'alternar-avisos': async () => {
    const sub = await suscripcionActual().catch(() => null);
    if (sub && Notification.permission === 'granted') await desactivar();
    else await activar();
  },
};

export function init() {
  window.addEventListener('online', reintentarPendientes);
  reintentarPendientes();
  sincronizar();
  renderEstado();
}
