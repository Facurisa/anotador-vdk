// Pantalla de código de grupo: crear uno nuevo o unirse a uno existente. Es el
// paso obligatorio antes de usar el resto de la app, porque el historial y las
// personas ahora se comparten por grupo (Firestore) en vez de vivir solo en
// este dispositivo.
import * as ui from './ui.js';
import * as nube from './nube.js';
import * as personas from './personas.js';
import { storage, nuevoId } from './storage.js';
import { COLORES } from './selector-personas.js';

let colorGrupoSeleccionado = null;

function renderLogo() {
  const cont = document.getElementById('grupo-logo');
  if (!cont) return;
  cont.innerHTML = `${ui.svgFantasma('#f5f3ef', 80)}<h1 class="titulo-app">Anotador <span class="titulo-vdk">VDK</span></h1>`;
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

// Widget para cargar de una los nombres del grupo apenas se crea, así cuando
// los amigos se unen ya encuentran su nombre en la lista (y lo pueden editar
// si hace falta desde la pantalla Personas).
function renderPaletaGrupo() {
  const cont = document.getElementById('grupo-paleta');
  if (!cont) return;
  const usados = new Set(nube.obtenerPersonas().map((p) => p.color));
  const hayLibres = COLORES.some((c) => !usados.has(c.valor));
  if (!colorGrupoSeleccionado || (usados.has(colorGrupoSeleccionado) && hayLibres)) {
    const libre = COLORES.find((c) => !usados.has(c.valor));
    colorGrupoSeleccionado = libre ? libre.valor : COLORES[0].valor;
  }
  cont.innerHTML = COLORES.map((c) => {
    const usado = usados.has(c.valor) && hayLibres && c.valor !== colorGrupoSeleccionado;
    const sel = c.valor === colorGrupoSeleccionado;
    return `<button type="button" class="color-opcion ${sel ? 'seleccionado' : ''} ${usado ? 'usado' : ''}" data-color="${c.valor}" style="background:${c.valor}" aria-label="${c.n}"></button>`;
  }).join('');
}

function renderListaAgregadosGrupo() {
  const cont = document.getElementById('grupo-lista-agregados');
  if (!cont) return;
  cont.innerHTML = nube.obtenerPersonas().map((p) => `
    <span class="chip">${ui.svgFantasma(p.color, 16)}${escapeHtml(p.nombre)}<span class="quitar-chip" data-quitar-grupo="${p.id}">✕</span></span>
  `).join('');
}

function agregarPersonaGrupo() {
  const input = document.getElementById('grupo-nuevo-nombre');
  const nombre = input.value.trim().slice(0, 16);
  if (!nombre) { ui.toast('Escribí un nombre'); return; }
  if (nube.obtenerPersonas().some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) { ui.toast('Ya agregaste a alguien con ese nombre'); return; }
  nube.guardarPersonaNube({ id: nuevoId(), nombre, color: colorGrupoSeleccionado || COLORES[0].valor });
  input.value = '';
  colorGrupoSeleccionado = null;
  renderPaletaGrupo();
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
  colorGrupoSeleccionado = null;
  renderPaletaGrupo();
  renderListaAgregadosGrupo();
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
  ui.mostrarPantalla('pantalla-personas');
  actualizarCodigoVisible();
  personas.renderPantalla();
  ui.toast('¡Listo! Fijate si tu nombre ya está en la lista, o agregalo/editalo');
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

  document.getElementById('grupo-paleta').addEventListener('click', (e) => {
    const btn = e.target.closest('.color-opcion');
    if (!btn || btn.classList.contains('usado')) return;
    colorGrupoSeleccionado = btn.dataset.color;
    renderPaletaGrupo();
  });

  document.getElementById('grupo-lista-agregados').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quitar-grupo]');
    if (!btn) return;
    nube.borrarPersonaNube(btn.dataset.quitarGrupo);
  });

  nube.onPersonasCambia(() => { renderListaAgregadosGrupo(); renderPaletaGrupo(); });
}

export const acciones = {
  'crear-grupo': crearGrupo,
  'unirse-grupo': unirseGrupo,
  'copiar-codigo-grupo': copiarCodigo,
  'continuar-grupo-creado': continuarLuegoDeCrear,
  'grupo-agregar-persona': agregarPersonaGrupo,
};
