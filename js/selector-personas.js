// Selector de personas reutilizable: agregar/quitar personas a una lista (equipo,
// jugadores de una partida, etc.), con paleta de colores y accesos rápidos a
// personas ya guardadas. Se usa en la config de truco (una vez por equipo) y en
// la de podrida.
import { storage, nuevoId } from './storage.js';
import * as ui from './ui.js';

export const COLORES = [
  { n: 'amarillo', valor: '#ffd873' },
  { n: 'rosa', valor: '#ff9ecf' },
  { n: 'celeste', valor: '#7ec8ff' },
  { n: 'verde', valor: '#8ee08e' },
  { n: 'naranja', valor: '#ffab66' },
  { n: 'violeta', valor: '#c39bff' },
  { n: 'rojo', valor: '#ff8a8a' },
  { n: 'turquesa', valor: '#6de0d0' },
  { n: 'blanco', valor: '#f5f3ef' },
];

export function guardarPersona(p) {
  const lista = storage.getPersonas();
  const idx = lista.findIndex((g) => g.nombre.toLowerCase() === p.nombre.toLowerCase());
  if (idx >= 0) lista[idx].color = p.color;
  else lista.push({ id: p.id, nombre: p.nombre, color: p.color });
  storage.setPersonas(lista);
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

/**
 * ids: { lista, input, paleta, guardadosWrap, guardadosLista }
 * opciones: { excluidos: () => string[] } — ids de personas a no ofrecer como
 * "guardadas" (por ejemplo, las que ya están en el otro equipo del truco).
 */
export function crearSelectorPersonas(ids, opciones = {}) {
  let seleccionadas = [];
  let colorSeleccionado = null;
  const excluidosFn = opciones.excluidos || (() => []);

  const el = (id) => document.getElementById(id);

  function renderPaleta() {
    const cont = el(ids.paleta);
    if (!cont) return;
    const usados = new Set(seleccionadas.map((p) => p.color));
    const hayLibres = COLORES.some((c) => !usados.has(c.valor));
    if (!colorSeleccionado || (usados.has(colorSeleccionado) && hayLibres)) {
      const libre = COLORES.find((c) => !usados.has(c.valor));
      colorSeleccionado = libre ? libre.valor : COLORES[0].valor;
    }
    cont.innerHTML = COLORES.map((c) => {
      const usado = usados.has(c.valor) && hayLibres && c.valor !== colorSeleccionado;
      const sel = c.valor === colorSeleccionado;
      return `<button type="button" class="color-opcion ${sel ? 'seleccionado' : ''} ${usado ? 'usado' : ''}" data-color="${c.valor}" style="background:${c.valor}" aria-label="${c.n}"></button>`;
    }).join('');
  }

  function renderLista() {
    const cont = el(ids.lista);
    if (!seleccionadas.length) {
      cont.innerHTML = '<p style="opacity:.5;font-size:.9rem">Todavía no hay nadie acá.</p>';
      return;
    }
    if (opciones.reordenable) {
      cont.innerHTML = seleccionadas.map((p, i) => `
        <div class="fila-orden-persona">
          <span class="numero-orden">${i + 1}</span>
          ${ui.svgFantasma(p.color, 18)}
          <span class="nombre-jugador" style="flex:1">${escapeHtml(p.nombre)}</span>
          <button type="button" class="btn-icono btn-orden" data-subir="${p.id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir en el orden">&#8593;</button>
          <button type="button" class="btn-icono btn-orden" data-bajar="${p.id}" ${i === seleccionadas.length - 1 ? 'disabled' : ''} aria-label="Bajar en el orden">&#8595;</button>
          <span class="quitar-chip" data-quitar="${p.id}">✕</span>
        </div>
      `).join('');
    } else {
      cont.innerHTML = seleccionadas.map((p) => `
        <span class="chip">${ui.svgFantasma(p.color, 16)}${escapeHtml(p.nombre)}<span class="quitar-chip" data-quitar="${p.id}">✕</span></span>
      `).join('');
    }
  }

  function renderGuardados() {
    if (!ids.guardadosWrap) return;
    const excluidos = new Set([...seleccionadas.map((p) => p.id), ...excluidosFn()]);
    const guardadas = storage.getPersonas().filter((g) => !excluidos.has(g.id));
    el(ids.guardadosWrap).hidden = guardadas.length === 0;
    el(ids.guardadosLista).innerHTML = guardadas.map((g) => `
      <span class="chip" data-agregar="${g.id}">${ui.svgFantasma(g.color, 16)}${escapeHtml(g.nombre)}<span class="quitar-chip" data-borrar="${g.id}">✕</span></span>
    `).join('');
  }

  function renderTodo() {
    renderPaleta();
    renderLista();
    renderGuardados();
    if (opciones.onCambio) opciones.onCambio(seleccionadas);
  }

  function agregarNueva() {
    const input = el(ids.input);
    const nombre = input.value.trim().slice(0, 16);
    if (!nombre) { ui.toast('Escribí un nombre'); return; }
    if (seleccionadas.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) { ui.toast('Ese nombre ya está agregado'); return; }
    const nueva = { id: nuevoId(), nombre, color: colorSeleccionado || COLORES[0].valor };
    seleccionadas.push(nueva);
    guardarPersona(nueva);
    input.value = '';
    colorSeleccionado = null;
    renderTodo();
  }

  if (ids.paleta) {
    el(ids.paleta).addEventListener('click', (e) => {
      const btn = e.target.closest('.color-opcion');
      if (!btn || btn.classList.contains('usado')) return;
      colorSeleccionado = btn.dataset.color;
      renderPaleta();
    });
  }

  el(ids.lista).addEventListener('click', (e) => {
    const subir = e.target.closest('[data-subir]');
    if (subir) {
      const idx = seleccionadas.findIndex((p) => p.id === subir.dataset.subir);
      if (idx > 0) {
        [seleccionadas[idx - 1], seleccionadas[idx]] = [seleccionadas[idx], seleccionadas[idx - 1]];
        renderTodo();
      }
      return;
    }
    const bajar = e.target.closest('[data-bajar]');
    if (bajar) {
      const idx = seleccionadas.findIndex((p) => p.id === bajar.dataset.bajar);
      if (idx !== -1 && idx < seleccionadas.length - 1) {
        [seleccionadas[idx], seleccionadas[idx + 1]] = [seleccionadas[idx + 1], seleccionadas[idx]];
        renderTodo();
      }
      return;
    }
    const btn = e.target.closest('[data-quitar]');
    if (!btn) return;
    seleccionadas = seleccionadas.filter((p) => p.id !== btn.dataset.quitar);
    renderTodo();
  });

  if (ids.guardadosLista) {
    el(ids.guardadosLista).addEventListener('click', (e) => {
      const btnBorrar = e.target.closest('[data-borrar]');
      if (btnBorrar) {
        const lista = storage.getPersonas().filter((g) => g.id !== btnBorrar.dataset.borrar);
        storage.setPersonas(lista);
        renderGuardados();
        return;
      }
      const chip = e.target.closest('[data-agregar]');
      if (chip) {
        const g = storage.getPersonas().find((x) => x.id === chip.dataset.agregar);
        if (!g || seleccionadas.some((p) => p.id === g.id)) return;
        const usados = new Set(seleccionadas.map((p) => p.color));
        let color = g.color;
        if (usados.has(color)) {
          const libre = COLORES.find((c) => !usados.has(c.valor));
          if (libre) color = libre.valor;
        }
        seleccionadas.push({ id: g.id, nombre: g.nombre, color });
        renderTodo();
      }
    });
  }

  return {
    reiniciar(iniciales = []) {
      seleccionadas = iniciales.map((p) => ({ ...p }));
      colorSeleccionado = null;
      renderTodo();
    },
    obtener: () => seleccionadas.map((p) => ({ ...p })),
    render: renderTodo,
    agregar: agregarNueva,
  };
}
