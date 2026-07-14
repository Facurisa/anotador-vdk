import { storage, nuevoId } from './storage.js';
import * as ui from './ui.js';
import { agregarAlHistorial, compartirImagen } from './historial.js';
import { crearSelectorPersonas, guardarPersona, COLORES } from './selector-personas.js';

let estado = null;
let edicionTemporal = null;
let selectorPodrida = null;

// Estado transitorio de la pantalla de configuración (antes de empezar la partida)
let configMaxCartas = 7;
let configMaxCartasManual = false; // true en cuanto el usuario toca +/- a mano; deja de autosugerir

// Mazo español de 52 cartas (incluye 8 y 9): se sacan los 2 comodines y siempre
// se separa 1 carta de muestra, así que quedan 49 repartibles entre los jugadores.
const CARTAS_MAZO_UTILES = 49;

function sugerirMax(cantidadJugadores) {
  if (cantidadJugadores < 1) return 7;
  return Math.max(1, Math.floor(CARTAS_MAZO_UTILES / cantidadJugadores));
}

function actualizarSugerenciaMax() {
  const n = selectorPodrida.obtener().length;
  const el = document.getElementById('podrida-max-cartas-sugerencia');
  if (n < 1) {
    el.textContent = 'Con mazo español de 52 cartas (sin los 2 comodines y 1 de muestra quedan 49 para repartir) el máximo depende de cuántos jueguen.';
  } else {
    const sugerido = sugerirMax(n);
    const sobran = CARTAS_MAZO_UTILES - sugerido * n;
    const textoSobran = sobran > 0 ? ` (quedan ${sobran} carta${sobran === 1 ? '' : 's'} sin repartir)` : '';
    el.textContent = `Con ${n} jugador${n === 1 ? '' : 'es'} y mazo de 52 cartas, el máximo teórico es ${sugerido} por jugador${textoSobran}.`;
  }
  if (!configMaxCartasManual) {
    configMaxCartas = sugerirMax(n);
    document.getElementById('podrida-max-cartas').textContent = configMaxCartas;
  }
}

function iconoJugador(color, tamano = 18) {
  return ui.svgFantasma(color, tamano);
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

function persistir() {
  storage.setPodrida(estado);
}

function cartasParaRonda(n, max) {
  if (n <= max) return n;
  return Math.max(1, 2 * max - n);
}

function totalRondas() {
  return 2 * estado.maxCartas - 1;
}

function cartasDeRonda() {
  if (estado.cartasRondaActual !== null && estado.cartasRondaActual !== undefined) return estado.cartasRondaActual;
  return cartasParaRonda(estado.rondaActual, estado.maxCartas);
}

function jugadoresActivos() {
  return estado.jugadores.filter((j) => j.activo);
}

function puntajeDe(jugador) {
  const base = estado.rondas.reduce((acc, r) => acc + (r.puntos[jugador.id] || 0), 0);
  const ajuste = (estado.ajustes && estado.ajustes[jugador.id]) || 0;
  return base + ajuste;
}

function calcularPuntos(apostado, ganadas) {
  if (apostado === ganadas) return 10 + 5 * ganadas;
  return 1 * ganadas;
}

/* ================= Configuración de partida nueva ================= */

export function prepararConfig() {
  if (!selectorPodrida) {
    selectorPodrida = crearSelectorPersonas({
      lista: 'podrida-lista-jugadores',
      input: 'podrida-nuevo-nombre',
      paleta: 'podrida-paleta',
      guardadosWrap: 'podrida-guardados-wrap',
      guardadosLista: 'podrida-lista-guardados',
    }, { onCambio: actualizarSugerenciaMax, reordenable: true });
  }
  configMaxCartas = 7;
  configMaxCartasManual = false;
  document.getElementById('podrida-max-cartas').textContent = configMaxCartas;
  document.getElementById('podrida-toggle-repartidor').checked = true;
  document.getElementById('podrida-toggle-aviso').checked = true;
  document.getElementById('podrida-practica').checked = false;
  selectorPodrida.reiniciar([]);
}

function maxCartasMenos() {
  configMaxCartasManual = true;
  configMaxCartas = Math.max(1, configMaxCartas - 1);
  document.getElementById('podrida-max-cartas').textContent = configMaxCartas;
}
function maxCartasMas() {
  configMaxCartasManual = true;
  configMaxCartas = Math.min(20, configMaxCartas + 1);
  document.getElementById('podrida-max-cartas').textContent = configMaxCartas;
}

function empezarPodrida() {
  const personas = selectorPodrida.obtener();
  if (personas.length < 2) { ui.toast('Agregá al menos 2 jugadores'); return; }
  const repartidorActivo = document.getElementById('podrida-toggle-repartidor').checked;
  const avisoApuestasActivo = document.getElementById('podrida-toggle-aviso').checked;
  const practica = document.getElementById('podrida-practica').checked;
  estado = {
    jugadores: personas.map((j) => ({ ...j, activo: true })),
    maxCartas: configMaxCartas,
    repartidorActivo,
    avisoApuestasActivo,
    practica,
    repartidorId: repartidorActivo ? personas[0].id : null,
    rondaActual: 1,
    cartasRondaActual: null,
    ordenRondaIds: [],
    fase: 'apuestas',
    apuestas: {},
    resultados: {},
    rondas: [],
    ajustes: {},
    terminado: false,
  };
  persistir();
  ui.mostrarPantalla('pantalla-podrida-juego');
  renderTabla();
  iniciarFaseApuestas();
}

export function continuarOIniciar(accion) {
  if (accion === 'continuar') {
    estado = storage.getPodrida();
    ui.mostrarPantalla('pantalla-podrida-juego');
    renderTabla();
    renderCabecera();
    if (estado.fase === 'apuestas') {
      renderFaseApuestas();
      document.getElementById('podrida-fase-apuestas').classList.remove('oculta');
      document.getElementById('podrida-fase-resultado').classList.add('oculta');
    } else {
      renderFaseResultado();
      document.getElementById('podrida-fase-resultado').classList.remove('oculta');
      document.getElementById('podrida-fase-apuestas').classList.add('oculta');
    }
  } else {
    ui.mostrarPantalla('pantalla-podrida-config');
    prepararConfig();
  }
}

/* ================= Orden de turno / repartidor ================= */

function ordenTurno(activos) {
  if (!estado.repartidorActivo || !estado.repartidorId) return activos;
  const idx = activos.findIndex((j) => j.id === estado.repartidorId);
  if (idx === -1) return activos;
  return [...activos.slice(idx + 1), ...activos.slice(0, idx + 1)];
}

function rotarRepartidor() {
  if (!estado.repartidorActivo) return;
  const activos = jugadoresActivos();
  if (!activos.length) return;
  const idx = activos.findIndex((j) => j.id === estado.repartidorId);
  const siguiente = activos[(idx + 1) % activos.length];
  estado.repartidorId = siguiente.id;
}

/* ================= Tabla de posiciones ================= */

function renderTabla(animar = false) {
  const cont = document.getElementById('podrida-tabla');
  const previos = {};
  if (animar) {
    cont.querySelectorAll('.fila-jugador').forEach((el) => { previos[el.dataset.jugadorId] = el.getBoundingClientRect().top; });
  }
  const filas = estado.jugadores
    .map((j) => ({ j, pts: puntajeDe(j) }))
    .sort((a, b) => b.pts - a.pts);

  cont.innerHTML = filas.map(({ j, pts }) => {
    const esRepartidor = estado.repartidorActivo && j.activo && estado.repartidorId === j.id;
    return `
    <div class="fila-jugador" data-jugador-id="${j.id}">
      ${iconoJugador(j.color, 22)}
      <span class="nombre-jugador">${escapeHtml(j.nombre)}${j.activo ? '' : ' (retirado)'}</span>
      ${esRepartidor ? '<span class="icono-mazo" title="Reparte">🃏</span>' : ''}
      <span class="puntaje-jugador">${pts}</span>
      <span class="diferencia-puntos" data-dif="${j.id}"></span>
    </div>`;
  }).join('');

  if (animar) {
    cont.querySelectorAll('.fila-jugador').forEach((el) => {
      const antes = previos[el.dataset.jugadorId];
      if (antes === undefined) return;
      const despues = el.getBoundingClientRect().top;
      const delta = antes - despues;
      if (delta) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
          el.style.transition = 'transform .35s ease';
          el.style.transform = '';
        });
      }
    });
  }
}

function mostrarDiferencias(puntosRonda) {
  Object.entries(puntosRonda).forEach(([id, pts]) => {
    const el = document.querySelector(`[data-dif="${id}"]`);
    if (!el) return;
    el.textContent = `+${pts}`;
    el.classList.remove('mostrar');
    void el.offsetWidth;
    el.classList.add('mostrar');
  });
}

/* ================= Fase de apuestas ================= */

function renderCabecera() {
  document.getElementById('podrida-info-ronda').textContent = `Ronda ${estado.rondaActual} — ${cartasDeRonda()} ${cartasDeRonda() === 1 ? 'carta' : 'cartas'}`;
  document.getElementById('podrida-cartas-ronda-valor').textContent = cartasDeRonda();
  document.getElementById('podrida-insignia-practica').classList.toggle('oculta', !estado.practica);
}

function participantesRonda() {
  return estado.ordenRondaIds.map((id) => estado.jugadores.find((j) => j.id === id)).filter(Boolean);
}

function iniciarFaseApuestas() {
  if (estado.rondaActual > totalRondas()) { mostrarPodio(guardarResultadoPodrida()); return; }
  const activos = jugadoresActivos();
  const orden = ordenTurno(activos);
  estado.ordenRondaIds = orden.map((j) => j.id);
  estado.fase = 'apuestas';
  estado.apuestas = {};
  orden.forEach((j) => { estado.apuestas[j.id] = 0; });
  persistir();
  renderCabecera();
  renderFaseApuestas();
  document.getElementById('podrida-fase-apuestas').classList.remove('oculta');
  document.getElementById('podrida-fase-resultado').classList.add('oculta');
}

function renderFaseApuestas() {
  const participantes = participantesRonda();
  const cont = document.getElementById('podrida-filas-apuestas');
  cont.innerHTML = participantes.map((j) => `
    <div class="fila-apuesta-jugador">
      ${iconoJugador(j.color)}
      <span class="nombre-jugador">${escapeHtml(j.nombre)}${estado.repartidorActivo && j.id === estado.repartidorId ? ' 🃏' : ''}</span>
      <div class="stepper">
        <button class="btn-icono" data-apuesta-menos="${j.id}">−</button>
        <span data-apuesta-valor="${j.id}">${estado.apuestas[j.id] || 0}</span>
        <button class="btn-icono" data-apuesta-mas="${j.id}">+</button>
      </div>
    </div>`).join('');
  actualizarAvisoApuestas();
}

// En la podrida nunca puede pasar que todos acierten su apuesta: en cada mano gana
// una sola persona, así que la suma de apuestas jamás puede dar igual a las cartas
// repartidas. Por eso al último que apuesta (el repartidor, si está esa opción activada)
// se le prohíbe directamente el número que dejaría esa suma exacta.
function ultimoParticipanteId() {
  return estado.ordenRondaIds[estado.ordenRondaIds.length - 1];
}

function valorProhibidoParaUltimo() {
  const ultimoId = ultimoParticipanteId();
  let sumaOtros = 0;
  estado.ordenRondaIds.forEach((id) => { if (id !== ultimoId) sumaOtros += (estado.apuestas[id] || 0); });
  return cartasDeRonda() - sumaOtros;
}

function restriccionActiva() {
  return estado.avisoApuestasActivo && estado.ordenRondaIds.length > 1;
}

// Si el valor guardado del último jugador quedó "atrapado" en el número prohibido
// (por ejemplo porque otro jugador cambió su apuesta después), lo corrige solo.
function reforzarRestriccionUltimo() {
  if (!restriccionActiva()) return;
  const max = cartasDeRonda();
  const ultimoId = ultimoParticipanteId();
  const prohibido = valorProhibidoParaUltimo();
  const actual = estado.apuestas[ultimoId] || 0;
  if (actual !== prohibido || prohibido < 0 || prohibido > max) return;
  let nuevo = actual + 1;
  if (nuevo > max || nuevo === prohibido) nuevo = actual - 1;
  if (nuevo < 0) return; // no debería pasar (implicaría max=0)
  estado.apuestas[ultimoId] = nuevo;
  const span = document.querySelector(`[data-apuesta-valor="${ultimoId}"]`);
  if (span) span.textContent = nuevo;
}

function cambiarApuesta(id, delta) {
  const max = cartasDeRonda();
  const actual = estado.apuestas[id] || 0;
  const esUltimo = restriccionActiva() && id === ultimoParticipanteId();
  const prohibido = esUltimo ? valorProhibidoParaUltimo() : null;

  let nuevo = actual + delta;
  if (prohibido !== null && nuevo === prohibido) nuevo += delta; // saltear el número prohibido
  nuevo = Math.max(0, Math.min(max, nuevo));
  if (prohibido !== null && nuevo === prohibido) {
    ui.toast(`No podés apostar ${prohibido}: alguien tiene que perder esta mano`);
    return; // no hay ningún valor válido en esa dirección
  }
  if (nuevo === actual) return;
  estado.apuestas[id] = nuevo;
  const span = document.querySelector(`[data-apuesta-valor="${id}"]`);
  if (span) span.textContent = nuevo;
  reforzarRestriccionUltimo();
  persistir();
  actualizarAvisoApuestas();
  ui.vibrar(15);
}

function actualizarAvisoApuestas() {
  const el = document.getElementById('podrida-aviso-apuestas');
  if (!restriccionActiva()) { el.classList.add('oculta'); return; }
  const max = cartasDeRonda();
  const prohibido = valorProhibidoParaUltimo();
  if (prohibido < 0 || prohibido > max) { el.classList.add('oculta'); return; }
  const ultimo = estado.jugadores.find((j) => j.id === ultimoParticipanteId());
  const nombre = ultimo ? ultimo.nombre : 'El último en apostar';
  el.textContent = `${nombre} no puede apostar ${prohibido}: alguien tiene que perder esta mano.`;
  el.classList.remove('oculta');
}

function cartasRondaMenos() { cambiarCartasRonda(-1); }
function cartasRondaMas() { cambiarCartasRonda(1); }
function cambiarCartasRonda(delta) {
  const nuevo = Math.max(1, cartasDeRonda() + delta);
  estado.cartasRondaActual = nuevo;
  Object.keys(estado.apuestas).forEach((id) => { estado.apuestas[id] = Math.min(estado.apuestas[id], nuevo); });
  reforzarRestriccionUltimo();
  persistir();
  renderCabecera();
  renderFaseApuestas();
}

function confirmarApuestas() {
  iniciarFaseResultado();
}

/* ================= Fase de resultado ================= */

function iniciarFaseResultado() {
  estado.fase = 'resultado';
  estado.resultados = {};
  estado.ordenRondaIds.forEach((id) => { estado.resultados[id] = 0; });
  persistir();
  renderFaseResultado();
  document.getElementById('podrida-fase-apuestas').classList.add('oculta');
  document.getElementById('podrida-fase-resultado').classList.remove('oculta');
}

function renderFaseResultado() {
  const participantes = participantesRonda();
  const cont = document.getElementById('podrida-filas-resultado');
  cont.innerHTML = participantes.map((j) => `
    <div class="fila-resultado-jugador">
      ${iconoJugador(j.color)}
      <span class="nombre-jugador">${escapeHtml(j.nombre)} <small style="opacity:.6">(apostó ${estado.apuestas[j.id] || 0})</small></span>
      <div class="stepper">
        <button class="btn-icono" data-resultado-menos="${j.id}">−</button>
        <span data-resultado-valor="${j.id}">${estado.resultados[j.id] || 0}</span>
        <button class="btn-icono" data-resultado-mas="${j.id}">+</button>
      </div>
    </div>`).join('');
  actualizarAvisoResultado();
}

function cambiarResultado(id, delta) {
  const actual = estado.resultados[id] || 0;
  const nuevo = Math.max(0, Math.min(cartasDeRonda(), actual + delta));
  if (nuevo === actual) return;
  estado.resultados[id] = nuevo;
  const span = document.querySelector(`[data-resultado-valor="${id}"]`);
  if (span) span.textContent = nuevo;
  persistir();
  actualizarAvisoResultado();
  ui.vibrar(15);
}

function actualizarAvisoResultado() {
  const el = document.getElementById('podrida-aviso-resultado');
  const suma = Object.values(estado.resultados).reduce((a, b) => a + b, 0);
  const cartas = cartasDeRonda();
  if (suma !== cartas) {
    el.textContent = `La suma de manos ganadas (${suma}) no coincide con las cartas repartidas (${cartas}).`;
    el.classList.remove('oculta');
  } else {
    el.classList.add('oculta');
  }
}

function terminarRonda() {
  const cartas = cartasDeRonda();
  const puntosRonda = {};
  estado.ordenRondaIds.forEach((id) => {
    puntosRonda[id] = calcularPuntos(estado.apuestas[id] || 0, estado.resultados[id] || 0);
  });
  estado.rondas.push({
    numero: estado.rondaActual,
    cartas,
    repartidorId: estado.repartidorActivo ? estado.repartidorId : null,
    apuestas: { ...estado.apuestas },
    ganadas: { ...estado.resultados },
    puntos: puntosRonda,
  });
  // Si esta era la última ronda, guardar el resultado YA (antes de la
  // animación de reordenar la tabla): si alguien cierra la app en ese
  // momento, el resultado ya tiene que haber quedado guardado igual.
  const esUltimaRonda = estado.rondaActual >= totalRondas();
  const ordenados = esUltimaRonda ? guardarResultadoPodrida() : null;

  mostrarDiferencias(puntosRonda);
  rotarRepartidor();
  estado.rondaActual += 1;
  estado.cartasRondaActual = null;
  persistir();
  ui.vibrar(20);
  setTimeout(() => {
    renderTabla(true);
    setTimeout(() => {
      if (esUltimaRonda) mostrarPodio(ordenados);
      else iniciarFaseApuestas();
    }, 500);
  }, 700);
}

/* ================= Fin de partida ================= */

// Solo la parte de datos: calcula las estadísticas finales y las guarda en el
// historial compartido (si no es partido amistoso). No toca nada visual.
function guardarResultadoPodrida() {
  estado.terminado = true;
  persistir();

  const statsJugadores = estado.jugadores.map((j) => {
    let cumplidas = 0;
    let totales = 0;
    estado.rondas.forEach((r) => {
      if (r.apuestas[j.id] !== undefined) {
        totales += 1;
        if (r.apuestas[j.id] === r.ganadas[j.id]) cumplidas += 1;
      }
    });
    return { id: j.id, nombre: j.nombre, color: j.color, puntaje: puntajeDe(j), apuestasCumplidas: cumplidas, apuestasTotales: totales };
  });
  const ordenados = [...statsJugadores].sort((a, b) => b.puntaje - a.puntaje);

  if (!estado.practica) {
    agregarAlHistorial({
      tipo: 'podrida',
      jugadores: statsJugadores,
      ganador: ordenados[0].nombre,
    });
  }
  return ordenados;
}

// Solo la parte visual: podio, tabla y overlay. Se llama después de que el
// resultado ya está guardado (ver guardarResultadoPodrida).
function mostrarPodio(ordenados) {
  renderPodio(ordenados);
  ui.abrirOverlay('overlay-fin-podrida');
}

function renderPodio(ordenados) {
  const medallas = ['🥇', '🥈', '🥉'];
  const podioEl = document.getElementById('podio-podrida');
  podioEl.innerHTML = ordenados.slice(0, 3).map((j, i) => `
    <div class="podio-fila">
      <span class="podio-medalla">${medallas[i]}</span>
      ${iconoJugador(j.color, 22)}
      <span class="nombre-jugador" style="flex:1">${escapeHtml(j.nombre)}</span>
      <span class="puntaje-jugador">${j.puntaje}</span>
    </div>`).join('');
  const tablaEl = document.getElementById('tabla-final-podrida');
  tablaEl.innerHTML = '<p class="stats-titulo etiqueta-tiza">Tabla completa</p>' + ordenados.map((j) => `
    <div class="stats-jugador-fila"><span>${escapeHtml(j.nombre)}</span><span>${j.puntaje}</span></div>`).join('');
}

function revancha() {
  const jugadores = estado.jugadores.filter((j) => j.activo).map((j) => ({ ...j }));
  estado = {
    jugadores,
    maxCartas: estado.maxCartas,
    repartidorActivo: estado.repartidorActivo,
    avisoApuestasActivo: estado.avisoApuestasActivo,
    practica: estado.practica,
    repartidorId: estado.repartidorActivo && jugadores.length ? jugadores[0].id : null,
    rondaActual: 1,
    cartasRondaActual: null,
    ordenRondaIds: [],
    fase: 'apuestas',
    apuestas: {},
    resultados: {},
    rondas: [],
    ajustes: {},
    terminado: false,
  };
  persistir();
  ui.cerrarTodosLosOverlays();
  renderTabla();
  iniciarFaseApuestas();
}

async function compartir() {
  const ordenados = estado.jugadores
    .map((j) => ({ nombre: j.nombre, puntaje: puntajeDe(j) }))
    .sort((a, b) => b.puntaje - a.puntaje);
  compartirImagen({
    titulo: `¡Ganó ${ordenados[0].nombre}!`,
    lineas: ordenados.map((j, i) => `${i + 1}. ${j.nombre}: ${j.puntaje}`),
  });
}

/* ================= Historial de rondas / corrección ================= */

function abrirHistorialRondas() {
  const cont = document.getElementById('lista-rondas-podrida');
  if (!estado.rondas.length) {
    cont.innerHTML = '<p style="opacity:.6;text-align:center">Todavía no se jugó ninguna ronda.</p>';
  } else {
    cont.innerHTML = estado.rondas.map((r, idx) => {
      const detalle = Object.keys(r.puntos).map((id) => {
        const j = estado.jugadores.find((x) => x.id === id);
        const nombre = j ? j.nombre : '(jugador borrado)';
        return `${escapeHtml(nombre)}: apostó ${r.apuestas[id]}, ganó ${r.ganadas[id]} → +${r.puntos[id]}`;
      }).join('<br>');
      return `<div class="item-historial" data-ronda-idx="${idx}" style="cursor:pointer">
        <div class="fecha-historial">Ronda ${r.numero} — ${r.cartas} cartas (tocá para corregir)</div>
        <div class="resultado-historial">${detalle}</div>
      </div>`;
    }).join('');
    cont.querySelectorAll('[data-ronda-idx]').forEach((el) => {
      el.addEventListener('click', () => abrirEdicionRonda(Number(el.dataset.rondaIdx)));
    });
  }
  ui.abrirOverlay('overlay-rondas-podrida');
}

function abrirEdicionRonda(idx) {
  const r = estado.rondas[idx];
  document.getElementById('editar-ronda-titulo').textContent = `Ronda ${r.numero} — ${r.cartas} cartas`;
  edicionTemporal = { idx, apuestas: { ...r.apuestas }, ganadas: { ...r.ganadas } };

  const cont = document.getElementById('editar-ronda-filas');
  cont.innerHTML = Object.keys(r.puntos).map((id) => {
    const j = estado.jugadores.find((x) => x.id === id);
    const nombre = j ? j.nombre : '(jugador borrado)';
    return `
    <div class="menu-fila" style="flex-direction:column;align-items:stretch;gap:6px">
      <strong>${escapeHtml(nombre)}</strong>
      <div class="fila-toggle">
        <span>Apostó</span>
        <div class="stepper">
          <button class="btn-icono" data-edit-apuesta-menos="${id}">−</button>
          <span data-edit-apuesta-valor="${id}">${r.apuestas[id]}</span>
          <button class="btn-icono" data-edit-apuesta-mas="${id}">+</button>
        </div>
      </div>
      <div class="fila-toggle">
        <span>Ganó</span>
        <div class="stepper">
          <button class="btn-icono" data-edit-ganadas-menos="${id}">−</button>
          <span data-edit-ganadas-valor="${id}">${r.ganadas[id]}</span>
          <button class="btn-icono" data-edit-ganadas-mas="${id}">+</button>
        </div>
      </div>
    </div>`;
  }).join('');

  cont.querySelectorAll('[data-edit-apuesta-menos]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.editApuestaMenos;
    edicionTemporal.apuestas[id] = Math.max(0, edicionTemporal.apuestas[id] - 1);
    cont.querySelector(`[data-edit-apuesta-valor="${id}"]`).textContent = edicionTemporal.apuestas[id];
  }));
  cont.querySelectorAll('[data-edit-apuesta-mas]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.editApuestaMas;
    edicionTemporal.apuestas[id] = Math.min(r.cartas, edicionTemporal.apuestas[id] + 1);
    cont.querySelector(`[data-edit-apuesta-valor="${id}"]`).textContent = edicionTemporal.apuestas[id];
  }));
  cont.querySelectorAll('[data-edit-ganadas-menos]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.editGanadasMenos;
    edicionTemporal.ganadas[id] = Math.max(0, edicionTemporal.ganadas[id] - 1);
    cont.querySelector(`[data-edit-ganadas-valor="${id}"]`).textContent = edicionTemporal.ganadas[id];
  }));
  cont.querySelectorAll('[data-edit-ganadas-mas]').forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.editGanadasMas;
    edicionTemporal.ganadas[id] = Math.min(r.cartas, edicionTemporal.ganadas[id] + 1);
    cont.querySelector(`[data-edit-ganadas-valor="${id}"]`).textContent = edicionTemporal.ganadas[id];
  }));

  ui.abrirOverlay('overlay-editar-ronda');
}

function guardarEdicionRonda() {
  if (!edicionTemporal) return;
  const r = estado.rondas[edicionTemporal.idx];
  Object.keys(r.puntos).forEach((id) => {
    r.apuestas[id] = edicionTemporal.apuestas[id];
    r.ganadas[id] = edicionTemporal.ganadas[id];
    r.puntos[id] = calcularPuntos(edicionTemporal.apuestas[id], edicionTemporal.ganadas[id]);
  });
  edicionTemporal = null;
  persistir();
  ui.cerrarOverlay('overlay-editar-ronda');
  renderTabla();
  abrirHistorialRondas();
  ui.toast('Ronda actualizada');
}

/* ================= Menú ================= */

function renderMenuJugadores() {
  const cont = document.getElementById('menu-podrida-jugadores');
  cont.innerHTML = estado.jugadores.map((j) => `
    <div class="menu-fila">
      <span style="display:flex;align-items:center;gap:6px">${iconoJugador(j.color, 16)}${escapeHtml(j.nombre)}${j.activo ? '' : ' (retirado)'}</span>
      ${j.activo ? `<button class="btn-link" data-quitar-jugador="${j.id}" style="margin:0">Quitar</button>` : ''}
    </div>`).join('');
  cont.querySelectorAll('[data-quitar-jugador]').forEach((btn) => {
    btn.addEventListener('click', () => quitarJugador(btn.dataset.quitarJugador));
  });
}

async function quitarJugador(id) {
  if (jugadoresActivos().length <= 2) { ui.toast('Necesitás al menos 2 jugadores activos'); return; }
  if (!(await ui.confirmar('¿Quitar a este jugador? Se conserva su puntaje en el historial pero no juega más rondas.'))) return;
  const j = estado.jugadores.find((x) => x.id === id);
  if (!j) return;
  j.activo = false;
  if (estado.repartidorActivo && estado.repartidorId === id) {
    const activos = jugadoresActivos();
    estado.repartidorId = activos.length ? activos[0].id : null;
  }
  estado.ordenRondaIds = estado.ordenRondaIds.filter((x) => x !== id);
  delete estado.apuestas[id];
  delete estado.resultados[id];
  if (estado.fase === 'apuestas') reforzarRestriccionUltimo();
  persistir();
  renderMenuJugadores();
  renderTabla();
  if (estado.fase === 'apuestas') renderFaseApuestas(); else renderFaseResultado();
}

function agregarJugadorDesdeMenu() {
  const input = document.getElementById('menu-podrida-nuevo-nombre');
  const nombre = input.value.trim().slice(0, 16);
  if (!nombre) return;
  const usados = new Set(estado.jugadores.map((j) => j.color));
  const libre = COLORES.find((c) => !usados.has(c.valor));
  const color = libre ? libre.valor : COLORES[estado.jugadores.length % COLORES.length].valor;
  const guardada = guardarPersona({ id: nuevoId(), nombre, color });
  const nuevo = { ...guardada, activo: true };
  estado.jugadores.push(nuevo);

  // Se suma a mitad de partida: en vez de arrancar en 0 (quedando en desventaja
  // frente a rondas que ya se jugaron), arranca empatado con quien va último.
  const activosPrevios = jugadoresActivos().filter((j) => j.id !== nuevo.id);
  if (activosPrevios.length) {
    const minimo = Math.min(...activosPrevios.map((j) => puntajeDe(j)));
    if (!estado.ajustes) estado.ajustes = {};
    estado.ajustes[nuevo.id] = minimo;
    ui.toast(`${nombre} arranca con ${minimo} puntos, empatado con el último`);
  }

  if (estado.fase === 'apuestas') {
    estado.apuestas[nuevo.id] = 0;
    estado.ordenRondaIds.push(nuevo.id);
    reforzarRestriccionUltimo();
  }
  if (!estado.repartidorId && estado.repartidorActivo) estado.repartidorId = nuevo.id;
  persistir();
  input.value = '';
  renderMenuJugadores();
  renderTabla();
  if (estado.fase === 'apuestas') renderFaseApuestas();
}

async function reiniciarPartidaPodrida() {
  if (!(await ui.confirmar('¿Reiniciar toda la partida de podrida? Se pierden las rondas jugadas.'))) return;
  const jugadores = estado.jugadores.filter((j) => j.activo).map((j) => ({ ...j }));
  estado = {
    jugadores,
    maxCartas: estado.maxCartas,
    repartidorActivo: estado.repartidorActivo,
    avisoApuestasActivo: estado.avisoApuestasActivo,
    practica: estado.practica,
    repartidorId: estado.repartidorActivo && jugadores.length ? jugadores[0].id : null,
    rondaActual: 1,
    cartasRondaActual: null,
    ordenRondaIds: [],
    fase: 'apuestas',
    apuestas: {},
    resultados: {},
    rondas: [],
    ajustes: {},
    terminado: false,
  };
  persistir();
  ui.cerrarTodosLosOverlays();
  renderTabla();
  iniciarFaseApuestas();
}

function abrirMenu() {
  const wakeLockChecked = storage.getConfig().pantallaEncendida ? 'checked' : '';
  const cont = document.getElementById('menu-contenido');
  cont.innerHTML = `
    <div class="menu-seccion-titulo">Jugadores</div>
    <div id="menu-podrida-jugadores"></div>
    <div class="fila-agregar-jugador" style="margin-top:8px">
      <input class="input-tiza" type="text" id="menu-podrida-nuevo-nombre" maxlength="16" placeholder="Agregar jugador">
      <button class="btn btn-tiza" id="menu-podrida-agregar">Agregar</button>
    </div>

    <div class="menu-seccion-titulo">Configuración</div>
    <div class="fila-toggle">
      <span>Cantidad máxima de cartas</span>
      <div class="stepper">
        <button class="btn-icono" id="menu-max-menos">−</button>
        <span id="menu-max-valor">${estado.maxCartas}</span>
        <button class="btn-icono" id="menu-max-mas">+</button>
      </div>
    </div>
    <label class="fila-toggle"><span>Marcar y rotar repartidor</span><input type="checkbox" id="menu-toggle-repartidor" ${estado.repartidorActivo ? 'checked' : ''}></label>
    <label class="fila-toggle"><span>No permitir que todos acierten</span><input type="checkbox" id="menu-toggle-aviso" ${estado.avisoApuestasActivo ? 'checked' : ''}></label>
    <label class="fila-toggle"><span>Mantener pantalla encendida</span><input type="checkbox" id="menu-wakelock" ${wakeLockChecked}></label>

    <button class="btn btn-tiza-outline btn-grande" id="menu-reiniciar-partida">Reiniciar partida</button>
    <button class="btn btn-tiza-outline btn-grande" data-accion="volver-inicio">Volver al inicio</button>
  `;

  renderMenuJugadores();

  document.getElementById('menu-podrida-agregar').addEventListener('click', agregarJugadorDesdeMenu);
  document.getElementById('menu-max-menos').addEventListener('click', () => {
    estado.maxCartas = Math.max(1, estado.maxCartas - 1);
    document.getElementById('menu-max-valor').textContent = estado.maxCartas;
    persistir();
    renderCabecera();
  });
  document.getElementById('menu-max-mas').addEventListener('click', () => {
    estado.maxCartas = Math.min(20, estado.maxCartas + 1);
    document.getElementById('menu-max-valor').textContent = estado.maxCartas;
    persistir();
    renderCabecera();
  });
  document.getElementById('menu-toggle-repartidor').addEventListener('change', (e) => {
    estado.repartidorActivo = e.target.checked;
    if (estado.repartidorActivo && !estado.repartidorId) {
      const activos = jugadoresActivos();
      estado.repartidorId = activos.length ? activos[0].id : null;
    }
    persistir();
    renderTabla();
    if (estado.fase === 'apuestas') renderFaseApuestas();
  });
  document.getElementById('menu-toggle-aviso').addEventListener('change', (e) => {
    estado.avisoApuestasActivo = e.target.checked;
    if (estado.fase === 'apuestas') reforzarRestriccionUltimo();
    persistir();
    actualizarAvisoApuestas();
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
  document.getElementById('menu-reiniciar-partida').addEventListener('click', reiniciarPartidaPodrida);

  ui.abrirOverlay('overlay-menu');
}

/* ================= Resumen para pantalla de inicio ================= */

export function resumenGuardado() {
  const g = storage.getPodrida();
  if (!g || g.terminado) return null;
  const activos = g.jugadores.filter((j) => j.activo);
  if (!activos.length) return null;
  const puntajeGuardado = (j) => g.rondas.reduce((acc, r) => acc + (r.puntos[j.id] || 0), 0) + ((g.ajustes && g.ajustes[j.id]) || 0);
  const lider = [...activos].sort((a, b) => puntajeGuardado(b) - puntajeGuardado(a))[0];
  return `Ronda ${g.rondaActual} de ${2 * g.maxCartas - 1} — va ganando ${lider.nombre}`;
}

/* ================= Inicialización ================= */

export function init() {
  document.getElementById('podrida-filas-apuestas').addEventListener('click', (e) => {
    const menos = e.target.closest('[data-apuesta-menos]');
    const mas = e.target.closest('[data-apuesta-mas]');
    if (menos) cambiarApuesta(menos.dataset.apuestaMenos, -1);
    else if (mas) cambiarApuesta(mas.dataset.apuestaMas, 1);
  });

  document.getElementById('podrida-filas-resultado').addEventListener('click', (e) => {
    const menos = e.target.closest('[data-resultado-menos]');
    const mas = e.target.closest('[data-resultado-mas]');
    if (menos) cambiarResultado(menos.dataset.resultadoMenos, -1);
    else if (mas) cambiarResultado(mas.dataset.resultadoMas, 1);
  });
}

export const acciones = {
  'agregar-jugador': () => selectorPodrida.agregar(),
  'max-cartas-menos': maxCartasMenos,
  'max-cartas-mas': maxCartasMas,
  'empezar-podrida': empezarPodrida,
  'cartas-ronda-menos': cartasRondaMenos,
  'cartas-ronda-mas': cartasRondaMas,
  'confirmar-apuestas': confirmarApuestas,
  'terminar-ronda': terminarRonda,
  'ver-historial-rondas': abrirHistorialRondas,
  'guardar-edicion-ronda': guardarEdicionRonda,
  'revancha-podrida': revancha,
  'compartir-podrida': compartir,
};

export function abrirMenuActivo() { abrirMenu(); }
