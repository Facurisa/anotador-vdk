// Pantalla "Personas": directorio de gente guardada (compartido entre truco y
// podrida) con sus estadísticas combinadas.
import { nuevoId } from './storage.js';
import * as ui from './ui.js';
import * as nube from './nube.js';
import { COLORES } from './selector-personas.js';
import { calcularStatsPersonas } from './historial.js';

let colorSeleccionado = null;
let editandoId = null;

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

function renderPaleta() {
  const cont = document.getElementById('personas-paleta');
  if (!colorSeleccionado) colorSeleccionado = COLORES[0].valor;
  cont.innerHTML = COLORES.map((c) => `
    <button type="button" class="color-opcion ${c.valor === colorSeleccionado ? 'seleccionado' : ''}" data-color="${c.valor}" style="background:${c.valor}" aria-label="${c.n}"></button>
  `).join('');
}

function agregarPersona() {
  const input = document.getElementById('personas-nuevo-nombre');
  const nombre = input.value.trim().slice(0, 16);
  if (!nombre) { ui.toast('Escribí un nombre'); return; }
  const lista = nube.obtenerPersonas();
  if (lista.some((p) => nube.claveNombre(p.nombre) === nube.claveNombre(nombre) && p.id !== editandoId)) { ui.toast('Ya existe una persona con ese nombre'); return; }
  if (editandoId) {
    nube.guardarPersonaNube({ id: editandoId, nombre, color: colorSeleccionado || COLORES[0].valor });
    ui.toast('Nombre actualizado');
    cancelarEdicion();
    return;
  }
  nube.guardarPersonaNube({ id: nuevoId(), nombre, color: colorSeleccionado || COLORES[0].valor });
  input.value = '';
  colorSeleccionado = null;
  renderPaleta();
}

function iniciarEdicion(id) {
  const p = nube.obtenerPersonas().find((x) => x.id === id);
  if (!p) return;
  editandoId = id;
  colorSeleccionado = p.color;
  const input = document.getElementById('personas-nuevo-nombre');
  input.value = p.nombre;
  input.focus();
  document.getElementById('personas-btn-agregar').textContent = 'Guardar cambios';
  document.getElementById('personas-btn-cancelar-edicion').classList.remove('oculta');
  renderPaleta();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  editandoId = null;
  colorSeleccionado = null;
  document.getElementById('personas-nuevo-nombre').value = '';
  document.getElementById('personas-btn-agregar').textContent = 'Agregar';
  document.getElementById('personas-btn-cancelar-edicion').classList.add('oculta');
  renderPaleta();
}

async function borrarPersona(id) {
  if (await ui.confirmar('¿Borrar esta persona? Sus estadísticas ya jugadas quedan en el historial, pero no vas a poder elegirla para partidas nuevas.')) {
    if (editandoId === id) cancelarEdicion();
    await nube.borrarPersonaNube(id);
  }
}

function tarjetaPersona(p, filasStatsHtml) {
  return `
    <div class="tarjeta-persona">
      <div class="tarjeta-persona-cabecera">
        ${ui.svgFantasma(p.color, 30)}
        <span class="nombre-jugador" style="flex:1;font-size:1.1rem">${escapeHtml(p.nombre)}</span>
        <button class="btn-link" data-editar-persona="${p.id}" style="margin:0 8px 0 0">Editar</button>
        <button class="btn-link btn-peligro" data-borrar-persona="${p.id}" style="margin:0">Borrar</button>
      </div>
      <div class="tarjeta-persona-stats">
        ${filasStatsHtml}
      </div>
      <button class="btn-link btn-detalle-persona" data-detalle-persona="${escapeHtml(p.clave)}">Ver contra todos &rsaquo;</button>
    </div>`;
}

function formatoDiferencia(n) {
  if (n > 0) return `+${n}`;
  return String(n); // el signo "-" ya viene incluido en el número negativo
}

function porcentajeVictorias(ganadas, jugadas) {
  return `${Math.round((ganadas / jugadas) * 100)}%`;
}

// Dos filas independientes: "papá de" (mayor diferencia victorias − derrotas
// contra un rival) y "Más le ganó a" (el rival al que más veces le ganó, sea o
// no del que es papá).
function filasRivales(p, papaDe, masGanado) {
  let html = '';
  if (papaDe) {
    html += `<div class="stat-persona-fila fila-papa-de"><span>👑 ${escapeHtml(p.nombre)} pap&aacute; de ${escapeHtml(papaDe.nombre)}</span><span>${papaDe.victorias}&ndash;${papaDe.derrotas} (${formatoDiferencia(papaDe.neto)})</span></div>`;
  }
  if (masGanado) {
    const veces = `${masGanado.victorias} ${masGanado.victorias === 1 ? 'vez' : 'veces'}`;
    html += `<div class="stat-persona-fila"><span class="etiqueta-stat">M&aacute;s le gan&oacute; a</span><span>${escapeHtml(masGanado.nombre)} &middot; ${veces}</span></div>`;
  }
  return html;
}

function renderTabTruco(personas) {
  const cont = document.getElementById('personas-lista-truco');
  const ordenadas = [...personas].sort((a, b) => (b.trucoGanados - a.trucoGanados) || (b.trucoDiferencia - a.trucoDiferencia));
  cont.innerHTML = ordenadas.map((p) => {
    const filas = p.trucoJugados
      ? `<div class="stat-persona-fila"><span class="etiqueta-stat">Ganados</span><span>${p.trucoGanados} de ${p.trucoJugados} &middot; ${porcentajeVictorias(p.trucoGanados, p.trucoJugados)}</span></div>
         <div class="stat-persona-fila"><span class="etiqueta-stat">Diferencia</span><span class="${p.trucoDiferencia > 0 ? 'diferencia-positiva' : p.trucoDiferencia < 0 ? 'diferencia-negativa' : ''}">${formatoDiferencia(p.trucoDiferencia)}</span></div>
         ${filasRivales(p, p.trucoPapaDe, p.trucoMasGanado)}`
      : `<div class="stat-persona-fila"><span style="opacity:.5">Todavía no jugó al truco</span></div>`;
    return tarjetaPersona(p, filas);
  }).join('');
}

function renderTabPodrida(personas) {
  const cont = document.getElementById('personas-lista-podrida');
  const ordenadas = [...personas].sort((a, b) => b.podridaGanadas - a.podridaGanadas);
  cont.innerHTML = ordenadas.map((p) => {
    const filas = p.podridaJugadas
      ? `<div class="stat-persona-fila"><span class="etiqueta-stat">Ganadas</span><span>${p.podridaGanadas} de ${p.podridaJugadas} &middot; ${porcentajeVictorias(p.podridaGanadas, p.podridaJugadas)}</span></div>
         <div class="stat-persona-fila"><span class="etiqueta-stat">Acierto</span><span>${p.podridaTotales ? Math.round((p.podridaCumplidas / p.podridaTotales) * 100) : 0}% de apuestas</span></div>
         <div class="stat-persona-fila"><span class="etiqueta-stat">Promedio</span><span>${Math.round(p.podridaSumaPuntaje / p.podridaJugadas)} puntos</span></div>
         ${filasRivales(p, p.podridaPapaDe, p.podridaMasGanado)}`
      : `<div class="stat-persona-fila"><span style="opacity:.5">Todavía no jugó a la podrida</span></div>`;
    return tarjetaPersona(p, filas);
  }).join('');
}

/* ---------------- Detalle: resultado contra cada rival ---------------- */

let detalleClave = null;
let detalleJuego = 'truco';

function renderDetalle() {
  const s = calcularStatsPersonas().find((x) => x.clave === detalleClave);
  if (!s) return;
  const vs = detalleJuego === 'truco' ? s.trucoVs : s.podridaVs;
  const juego = detalleJuego === 'truco' ? 'al truco' : 'a la podrida';
  document.getElementById('detalle-nombre').innerHTML = `${ui.svgFantasma(s.color, 26)} ${escapeHtml(s.nombre)}`;
  document.querySelectorAll('#detalle-tabs .opcion-tiza').forEach((b) => b.classList.toggle('activa', b.dataset.tab === detalleJuego));

  const lista = document.getElementById('detalle-lista');
  if (!vs.length) {
    lista.innerHTML = `<p style="opacity:.6">Todavía no le ganó ni perdió contra nadie ${juego}.</p>`;
    return;
  }
  const victorias = vs.reduce((n, r) => n + r.victorias, 0);
  const derrotas = vs.reduce((n, r) => n + r.derrotas, 0);
  const filas = vs.map((r) => `
    <div class="detalle-fila">
      <span class="detalle-rival">${ui.svgFantasma(r.color, 18)}<span>${escapeHtml(r.nombre)}</span></span>
      <span class="detalle-resultado"><span class="diferencia-positiva">${r.victorias} ganó</span> &middot; <span class="diferencia-negativa">${r.derrotas} perdió</span></span>
    </div>`).join('');
  lista.innerHTML = `
    <div class="detalle-fila detalle-total">
      <span>Contra todos</span>
      <span class="detalle-resultado"><span class="diferencia-positiva">${victorias} ganó</span> &middot; <span class="diferencia-negativa">${derrotas} perdió</span></span>
    </div>
    ${filas}
    ${detalleJuego === 'podrida' ? '<p class="detalle-nota">En la podrida cuenta como ganar o perder contra alguien cuando uno de los dos ganó la partida y el otro jugaba.</p>' : ''}`;
}

function abrirDetalle(clave) {
  detalleClave = clave;
  const tabActiva = document.querySelector('#personas-tabs .opcion-tiza.activa');
  detalleJuego = tabActiva ? tabActiva.dataset.tab : 'truco';
  renderDetalle();
  ui.abrirOverlay('overlay-persona-detalle');
}

export function renderPantalla() {
  if (detalleClave) renderDetalle();
  const personas = calcularStatsPersonas();
  const truco = document.getElementById('personas-lista-truco');
  const podrida = document.getElementById('personas-lista-podrida');
  if (!personas.length) {
    const vacio = '<p style="opacity:.6;text-align:center;margin-top:16px">Todavía no guardaste a nadie. Agregalos acá arriba o al armar una partida.</p>';
    truco.innerHTML = vacio;
    podrida.innerHTML = vacio;
    return;
  }
  renderTabTruco(personas);
  renderTabPodrida(personas);
}

function initTabs() {
  const tabs = document.getElementById('personas-tabs');
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.opcion-tiza');
    if (!btn) return;
    tabs.querySelectorAll('.opcion-tiza').forEach((b) => b.classList.remove('activa'));
    btn.classList.add('activa');
    document.getElementById('personas-lista-truco').classList.toggle('oculta', btn.dataset.tab !== 'truco');
    document.getElementById('personas-lista-podrida').classList.toggle('oculta', btn.dataset.tab !== 'podrida');
  });
}

function initBorrar() {
  ['personas-lista-truco', 'personas-lista-podrida'].forEach((id) => {
    document.getElementById(id).addEventListener('click', (e) => {
      const btnDetalle = e.target.closest('[data-detalle-persona]');
      if (btnDetalle) { abrirDetalle(btnDetalle.dataset.detallePersona); return; }
      const btnEditar = e.target.closest('[data-editar-persona]');
      if (btnEditar) { iniciarEdicion(btnEditar.dataset.editarPersona); return; }
      const btn = e.target.closest('[data-borrar-persona]');
      if (!btn) return;
      borrarPersona(btn.dataset.borrarPersona);
    });
  });
}

export function init() {
  document.getElementById('personas-paleta').addEventListener('click', (e) => {
    const btn = e.target.closest('.color-opcion');
    if (!btn) return;
    colorSeleccionado = btn.dataset.color;
    renderPaleta();
  });
  renderPaleta();
  initTabs();
  initBorrar();
  document.getElementById('detalle-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.opcion-tiza');
    if (!btn) return;
    detalleJuego = btn.dataset.tab;
    renderDetalle();
  });
  nube.onPersonasCambia(() => renderPantalla());
  nube.onHistorialCambia(() => renderPantalla());
}

export const acciones = {
  'agregar-persona': agregarPersona,
  'cancelar-edicion-persona': cancelarEdicion,
};
