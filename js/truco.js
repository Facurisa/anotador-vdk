import { storage } from './storage.js';
import * as ui from './ui.js';
import { agregarAlHistorial, compartirImagen } from './historial.js';
import { crearSelectorPersonas } from './selector-personas.js';

const UMBRAL_SWIPE = 30; // px para distinguir toque de deslizar

let estado = null;
let undoStack = [];
let ignorarToques = false; // se pone true justo cuando se gana un chico, hasta "otro chico"
let selectorTrucoA = null;
let selectorTrucoB = null;

function estadoInicial(objetivo = 40) {
  return {
    objetivo,
    equipos: [
      { nombre: 'Nosotros', puntos: 0, chicos: 0, personas: [] },
      { nombre: 'Ellos', puntos: 0, chicos: 0, personas: [] },
    ],
  };
}

function persistir() {
  storage.setTruco(estado);
}

function corte(objetivo) {
  return objetivo === 51 ? 26 : 20;
}

function etapaDe(equipo) {
  return equipo.puntos < corte(estado.objetivo) ? 'malas' : 'buenas';
}

/* ---------------- Configuración de partida nueva ---------------- */

function inicializarSelectoresPersonas() {
  if (selectorTrucoA) return;
  // Ojo: crearSelectorPersonas() se suscribe a nube.onPersonasCambia(), que
  // llama al callback de una sola vez (síncrono) apenas se suscribe. Por eso,
  // mientras se está creando el selector A, el selector B todavía no existe
  // (se crea en la línea siguiente) — hay que cubrir ese caso con "?." o el
  // primer render de A explota.
  selectorTrucoA = crearSelectorPersonas({
    lista: 'truco-a-lista-personas',
    input: 'truco-a-nuevo-nombre',
    paleta: 'truco-a-paleta',
    guardadosWrap: 'truco-a-guardados-wrap',
    guardadosLista: 'truco-a-lista-guardados',
  }, { excluidos: () => selectorTrucoB ? selectorTrucoB.obtener().map((p) => p.id) : [] });
  selectorTrucoB = crearSelectorPersonas({
    lista: 'truco-b-lista-personas',
    input: 'truco-b-nuevo-nombre',
    paleta: 'truco-b-paleta',
    guardadosWrap: 'truco-b-guardados-wrap',
    guardadosLista: 'truco-b-lista-guardados',
  }, { excluidos: () => selectorTrucoA ? selectorTrucoA.obtener().map((p) => p.id) : [] });
}

export function prepararConfig() {
  inicializarSelectoresPersonas();
  const guardado = storage.getTruco();
  const base = guardado || estadoInicial();
  document.getElementById('truco-nombre-a').value = base.equipos[0].nombre;
  document.getElementById('truco-nombre-b').value = base.equipos[1].nombre;
  selectorTrucoA.reiniciar([]);
  selectorTrucoB.reiniciar([]);
  const selector = document.getElementById('truco-objetivo-selector');
  selector.querySelectorAll('.opcion-tiza').forEach((btn) => {
    btn.classList.toggle('activa', Number(btn.dataset.valor) === base.objetivo);
  });
}

function initSelectorObjetivo() {
  const selector = document.getElementById('truco-objetivo-selector');
  selector.addEventListener('click', (e) => {
    const btn = e.target.closest('.opcion-tiza');
    if (!btn) return;
    selector.querySelectorAll('.opcion-tiza').forEach((b) => b.classList.remove('activa'));
    btn.classList.add('activa');
  });
}

function empezarTruco() {
  const nombreA = document.getElementById('truco-nombre-a').value.trim() || 'Nosotros';
  const nombreB = document.getElementById('truco-nombre-b').value.trim() || 'Ellos';
  const objetivo = Number(document.querySelector('#truco-objetivo-selector .opcion-tiza.activa').dataset.valor);
  estado = estadoInicial(objetivo);
  estado.equipos[0].nombre = nombreA;
  estado.equipos[1].nombre = nombreB;
  estado.equipos[0].personas = selectorTrucoA.obtener();
  estado.equipos[1].personas = selectorTrucoB.obtener();
  undoStack = [];
  ignorarToques = false;
  persistir();
  ui.mostrarPantalla('pantalla-truco-juego');
  renderTodo();
}

export function continuarOIniciar(accion) {
  if (accion === 'continuar') {
    estado = storage.getTruco();
    ui.mostrarPantalla('pantalla-truco-juego');
    renderTodo();
  } else {
    ui.mostrarPantalla('pantalla-truco-config');
    prepararConfig();
  }
}

/* ---------------- Anotar puntos ---------------- */

function pushUndo() {
  undoStack.push(JSON.parse(JSON.stringify(estado.equipos)));
  if (undoStack.length > 20) undoStack.shift();
}

function aplicarDelta(equipoIdx, delta) {
  if (ignorarToques || !estado) return;
  const eq = estado.equipos[equipoIdx];
  const nuevo = Math.max(0, Math.min(estado.objetivo, eq.puntos + delta));
  if (nuevo === eq.puntos) return;
  pushUndo();
  eq.puntos = nuevo;
  persistir();
  renderPuntajes();
  animarPuntaje(equipoIdx);
  ui.vibrar(30);
  if (nuevo >= estado.objetivo) {
    ignorarToques = true;
    celebrarFinDeChico(equipoIdx);
    setTimeout(() => ganarChico(equipoIdx), 1300);
  }
}

// Festejo breve antes de abrir el cartel de "¡Ganó...!": champán del lado
// ganador, mamadera derramando leche del lado perdedor (chiste clásico del truco).
function celebrarFinDeChico(equipoIdx) {
  const perdedorIdx = equipoIdx === 0 ? 1 : 0;
  const ladoGanador = document.querySelector(`[data-lado="${equipoIdx}"]`);
  const ladoPerdedor = document.querySelector(`[data-lado="${perdedorIdx}"]`);
  ladoGanador.classList.add('celebracion-ganador');
  ladoPerdedor.classList.add('celebracion-perdedor');
  setTimeout(() => {
    ladoGanador.classList.remove('celebracion-ganador');
    ladoPerdedor.classList.remove('celebracion-perdedor');
  }, 1300);
}

function ganarChico(equipoIdx) {
  const eq = estado.equipos[equipoIdx];
  eq.chicos += 1;
  persistir();
  renderTrofeos();
  agregarAlHistorial({
    tipo: 'truco',
    fecha: Date.now(),
    equipoA: estado.equipos[0].nombre,
    equipoB: estado.equipos[1].nombre,
    puntosA: estado.equipos[0].puntos,
    puntosB: estado.equipos[1].puntos,
    ganador: eq.nombre,
    objetivo: estado.objetivo,
    personasA: estado.equipos[0].personas || [],
    personasB: estado.equipos[1].personas || [],
    equipoGanadorIdx: equipoIdx,
  });
  document.getElementById('ganador-nombre').textContent = eq.nombre;
  ui.abrirOverlay('overlay-ganador-truco');
}

function deshacer() {
  if (!undoStack.length) { ui.toast('No hay nada para deshacer'); return; }
  estado.equipos = undoStack.pop();
  persistir();
  renderTodo();
}

function otroChico() {
  estado.equipos.forEach((eq) => { eq.puntos = 0; });
  undoStack = [];
  ignorarToques = false;
  persistir();
  ui.cerrarOverlay('overlay-ganador-truco');
  renderTodo();
}

/* ---------------- Render ---------------- */

function renderTodo() {
  if (!estado) return;
  renderNombres();
  renderPuntajes();
  renderTrofeos();
}

function renderNombres() {
  estado.equipos.forEach((eq, i) => {
    const el = document.querySelector(`[data-nombre-equipo="${i}"]`);
    if (document.activeElement !== el) el.textContent = eq.nombre;
  });
}

function renderPuntajes() {
  estado.equipos.forEach((eq, i) => {
    document.querySelector(`[data-puntaje="${i}"]`).textContent = eq.puntos;
    document.querySelector(`[data-etapa="${i}"]`).textContent = etapaDe(eq);
  });
}

function renderTrofeos() {
  estado.equipos.forEach((eq, i) => {
    const cont = document.querySelector(`[data-trofeos="${i}"]`);
    cont.innerHTML = ui.svgFantasma('#f5f3ef', 26).repeat(eq.chicos);
  });
}

function animarPuntaje(equipoIdx) {
  const el = document.querySelector(`[data-puntaje="${equipoIdx}"]`);
  el.classList.remove('animar');
  // fuerza reflow para poder re-disparar la animación
  void el.offsetWidth;
  el.classList.add('animar');
}

/* ---------------- Edición de nombres ---------------- */

function initEdicionNombres() {
  [0, 1].forEach((i) => {
    const el = document.querySelector(`[data-nombre-equipo="${i}"]`);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      el.setAttribute('contenteditable', 'true');
      el.classList.add('editando');
      el.focus();
      document.execCommand('selectAll', false, null);
    });
    el.addEventListener('blur', () => {
      el.setAttribute('contenteditable', 'false');
      el.classList.remove('editando');
      const nuevoNombre = el.textContent.trim().slice(0, 18) || (i === 0 ? 'Nosotros' : 'Ellos');
      estado.equipos[i].nombre = nuevoNombre;
      el.textContent = nuevoNombre;
      persistir();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  });
}

/* ---------------- Gestos táctiles ---------------- */

function initGestos() {
  [0, 1].forEach((i) => {
    const zona = document.querySelector(`[data-zona-truco="${i}"]`);
    let pointerId = null;
    let startY = 0;
    let startX = 0;

    zona.addEventListener('pointerdown', (e) => {
      if (pointerId !== null) return; // ya hay un toque activo, ignorar multitouch
      pointerId = e.pointerId;
      startY = e.clientY;
      startX = e.clientX;
    });

    zona.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointerId) return;
      const deltaY = e.clientY - startY;
      const deltaX = e.clientX - startX;
      pointerId = null;
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.3) return; // gesto más horizontal que vertical, ignorar
      if (Math.abs(deltaY) < UMBRAL_SWIPE) {
        aplicarDelta(i, 1);
      } else if (deltaY < 0) {
        aplicarDelta(i, 3);
      } else {
        aplicarDelta(i, -1);
      }
    });

    zona.addEventListener('pointercancel', () => { pointerId = null; });
  });
}

/* ---------------- Menú ---------------- */

function abrirMenu() {
  const wakeLockChecked = storage.getConfig().pantallaEncendida ? 'checked' : '';
  const cont = document.getElementById('menu-contenido');
  cont.innerHTML = `
    <div class="menu-fila">
      <span>Objetivo</span>
      <div class="selector-opciones" style="max-width:150px">
        <button class="opcion-tiza ${estado.objetivo === 40 ? 'activa' : ''}" data-menu-objetivo="40">40</button>
        <button class="opcion-tiza ${estado.objetivo === 51 ? 'activa' : ''}" data-menu-objetivo="51">51</button>
      </div>
    </div>
    <label class="fila-toggle">
      <span>Mantener pantalla encendida</span>
      <input type="checkbox" id="menu-wakelock" ${wakeLockChecked}>
    </label>
    <button class="btn btn-tiza-outline btn-grande" id="menu-reiniciar-puntos">Reiniciar puntos (0-0)</button>
    <button class="btn btn-tiza-outline btn-grande" id="menu-reiniciar-todo">Reiniciar partida completa</button>
    <button class="btn btn-tiza-outline btn-grande" data-accion="volver-inicio">Volver al inicio</button>
  `;

  cont.querySelectorAll('[data-menu-objetivo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nuevoObjetivo = Number(btn.dataset.menuObjetivo);
      estado.objetivo = nuevoObjetivo;
      estado.equipos.forEach((eq) => { eq.puntos = Math.min(eq.puntos, nuevoObjetivo); });
      persistir();
      renderTodo();
      cont.querySelectorAll('[data-menu-objetivo]').forEach((b) => b.classList.toggle('activa', b === btn));
    });
  });

  document.getElementById('menu-wakelock').addEventListener('change', async (e) => {
    const config = storage.getConfig();
    if (e.target.checked) {
      const ok = await ui.wakeLock.activar();
      ui.wakeLock._deberiaEstarActivo = ok;
      if (!ok) { ui.toast('El navegador no permite mantener la pantalla encendida'); e.target.checked = false; }
    } else {
      ui.wakeLock._deberiaEstarActivo = false;
      await ui.wakeLock.liberar();
    }
    config.pantallaEncendida = e.target.checked;
    storage.setConfig(config);
  });

  document.getElementById('menu-reiniciar-puntos').addEventListener('click', async () => {
    if (await ui.confirmar('¿Reiniciar los puntos de este chico a 0-0?')) {
      estado.equipos.forEach((eq) => { eq.puntos = 0; });
      undoStack = [];
      persistir();
      renderTodo();
      ui.cerrarTodosLosOverlays();
    }
  });

  document.getElementById('menu-reiniciar-todo').addEventListener('click', async () => {
    if (await ui.confirmar('¿Reiniciar toda la partida? Se pierden los fantasmas ganados.')) {
      const nombres = [estado.equipos[0].nombre, estado.equipos[1].nombre];
      const personas = [estado.equipos[0].personas, estado.equipos[1].personas];
      estado = estadoInicial(estado.objetivo);
      estado.equipos[0].nombre = nombres[0];
      estado.equipos[1].nombre = nombres[1];
      estado.equipos[0].personas = personas[0];
      estado.equipos[1].personas = personas[1];
      undoStack = [];
      persistir();
      renderTodo();
      ui.cerrarTodosLosOverlays();
    }
  });

  ui.abrirOverlay('overlay-menu');
}

/* ---------------- Compartir ---------------- */

async function compartir() {
  compartirImagen({
    tipo: 'truco',
    titulo: `¡Ganó ${estado.equipos[estado.equipos[0].puntos > estado.equipos[1].puntos ? 0 : 1].nombre}!`,
    lineas: [
      `${estado.equipos[0].nombre}: ${estado.equipos[0].puntos} (👻 ${estado.equipos[0].chicos})`,
      `${estado.equipos[1].nombre}: ${estado.equipos[1].puntos} (👻 ${estado.equipos[1].chicos})`,
    ],
  });
}

/* ---------------- Utilidades para pantalla de inicio ---------------- */

export function resumenGuardado() {
  const g = storage.getTruco();
  if (!g) return null;
  return `${g.equipos[0].nombre} ${g.equipos[0].puntos} — ${g.equipos[1].puntos} ${g.equipos[1].nombre}`;
}

/* ---------------- Inicialización ---------------- */

export function init() {
  initSelectorObjetivo();
  initGestos();
  initEdicionNombres();
}

export const acciones = {
  'empezar-truco': empezarTruco,
  'deshacer-truco': deshacer,
  'otro-chico': otroChico,
  'compartir-truco': compartir,
  'truco-a-agregar': () => selectorTrucoA.agregar(),
  'truco-b-agregar': () => selectorTrucoB.agregar(),
};

export function abrirMenuActivo() { abrirMenu(); }
