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
  if (lista.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== editandoId)) { ui.toast('Ya existe una persona con ese nombre'); return; }
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
    </div>`;
}

function formatoDiferencia(n) {
  if (n > 0) return `+${n}`;
  return String(n); // el signo "-" ya viene incluido en el número negativo
}

function renderTabTruco(personas) {
  const cont = document.getElementById('personas-lista-truco');
  const ordenadas = [...personas].sort((a, b) => (b.trucoGanados - a.trucoGanados) || (b.trucoDiferencia - a.trucoDiferencia));
  cont.innerHTML = ordenadas.map((p) => {
    const filas = p.trucoJugados
      ? `<div class="stat-persona-fila"><span class="etiqueta-stat">Ganados</span><span>${p.trucoGanados} de ${p.trucoJugados}</span></div>
         <div class="stat-persona-fila"><span class="etiqueta-stat">Diferencia</span><span class="${p.trucoDiferencia > 0 ? 'diferencia-positiva' : p.trucoDiferencia < 0 ? 'diferencia-negativa' : ''}">${formatoDiferencia(p.trucoDiferencia)}</span></div>`
      : `<div class="stat-persona-fila"><span style="opacity:.5">Todavía no jugó al truco</span></div>`;
    return tarjetaPersona(p, filas);
  }).join('');
}

function renderTabPodrida(personas) {
  const cont = document.getElementById('personas-lista-podrida');
  const ordenadas = [...personas].sort((a, b) => b.podridaGanadas - a.podridaGanadas);
  cont.innerHTML = ordenadas.map((p) => {
    const filas = p.podridaJugadas
      ? `<div class="stat-persona-fila"><span class="etiqueta-stat">Ganadas</span><span>${p.podridaGanadas} de ${p.podridaJugadas}</span></div>
         <div class="stat-persona-fila"><span class="etiqueta-stat">Acierto</span><span>${p.podridaTotales ? Math.round((p.podridaCumplidas / p.podridaTotales) * 100) : 0}% de apuestas</span></div>
         <div class="stat-persona-fila"><span class="etiqueta-stat">Promedio</span><span>${Math.round(p.podridaSumaPuntaje / p.podridaJugadas)} puntos</span></div>`
      : `<div class="stat-persona-fila"><span style="opacity:.5">Todavía no jugó a la podrida</span></div>`;
    return tarjetaPersona(p, filas);
  }).join('');
}

export function renderPantalla() {
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
  nube.onPersonasCambia(() => renderPantalla());
  nube.onHistorialCambia(() => renderPantalla());
}

export const acciones = {
  'agregar-persona': agregarPersona,
  'cancelar-edicion-persona': cancelarEdicion,
};
