// Pantalla de código de grupo: crear uno nuevo o unirse a uno existente. Es el
// paso obligatorio antes de usar el resto de la app, porque el historial y las
// personas ahora se comparten por grupo (Firestore) en vez de vivir solo en
// este dispositivo.
import * as ui from './ui.js';
import * as nube from './nube.js';
import { storage } from './storage.js';

function renderLogo() {
  const cont = document.getElementById('grupo-logo');
  if (!cont) return;
  cont.innerHTML = `${ui.svgFantasma('#f5f3ef', 80)}<h1 class="titulo-app">Anotador <span class="titulo-vdk">VDK</span></h1>`;
}

export function tieneGrupo() {
  return !!storage.getCodigoGrupo();
}

// Arranca los listeners de Firestore si ya hay un grupo guardado de una sesión
// anterior. Se llama una sola vez, al abrir la app.
export function iniciarSiYaHayGrupo() {
  if (tieneGrupo()) nube.iniciarListeners();
}

async function crearGrupo() {
  const codigo = nube.generarCodigoGrupo();
  storage.setCodigoGrupo(codigo);
  nube.iniciarListeners();
  document.getElementById('codigo-grupo-mostrado').textContent = codigo;
  ui.abrirOverlay('overlay-codigo-grupo');
  try {
    await nube.migrarDatosLocales();
  } catch (e) {
    console.warn('No se pudieron migrar los datos locales al grupo nuevo', e);
  }
}

function unirseGrupo() {
  const input = document.getElementById('grupo-codigo-input');
  const codigo = input.value.trim().toUpperCase();
  if (codigo.length < 4) { ui.toast('Ingresá un código válido'); return; }
  storage.setCodigoGrupo(codigo);
  nube.iniciarListeners();
  ui.mostrarPantalla('pantalla-inicio');
  ui.toast(`¡Listo! Te uniste al grupo ${codigo}`);
}

function copiarCodigo() {
  const codigo = storage.getCodigoGrupo();
  if (!codigo) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(codigo)
      .then(() => ui.toast('Código copiado'))
      .catch(() => ui.toast(`Anotalo a mano: ${codigo}`));
  } else {
    ui.toast(`Anotalo a mano: ${codigo}`);
  }
}

function continuarLuegoDeCrear() {
  ui.cerrarTodosLosOverlays();
  ui.mostrarPantalla('pantalla-inicio');
}

export function actualizarCodigoVisible() {
  const el = document.getElementById('codigo-grupo-actual');
  if (el) el.textContent = storage.getCodigoGrupo() || '—';
}

export function init() {
  renderLogo();
}

export const acciones = {
  'crear-grupo': crearGrupo,
  'unirse-grupo': unirseGrupo,
  'copiar-codigo-grupo': copiarCodigo,
  'continuar-grupo-creado': continuarLuegoDeCrear,
};
