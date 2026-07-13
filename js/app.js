import { storage } from './storage.js';
import * as ui from './ui.js';
import * as truco from './truco.js';
import * as podrida from './podrida.js';
import * as historial from './historial.js';
import * as personas from './personas.js';
import * as grupo from './grupo.js';

// Las reglas de Firestore bloquean editar/borrar el historial y falsificar la
// fecha (ver PLAN.md). Si alguien lo intenta llamando al SDK directo desde la
// consola del navegador (sin manejar el error con .catch), el rechazo llega
// acá como promesa no atrapada — un guiño para el que se cree gracioso.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.code === 'permission-denied') {
    console.log('%cDamian, no hagas trampa 😏', 'font-size:20px;color:#ffd873;font-weight:bold;');
    ui.toast('Damian, no hagas trampa 😏');
    event.preventDefault();
  }
});

function refrescarInicio() {
  const resumenTruco = truco.resumenGuardado();
  document.querySelector('[data-estado-truco]').hidden = !resumenTruco;
  if (resumenTruco) document.querySelector('[data-estado-truco]').textContent = resumenTruco;
  document.querySelector('[data-accion="continuar-truco"]').hidden = !resumenTruco;

  const resumenPodrida = podrida.resumenGuardado();
  document.querySelector('[data-estado-podrida]').hidden = !resumenPodrida;
  if (resumenPodrida) document.querySelector('[data-estado-podrida]').textContent = resumenPodrida;
  document.querySelector('[data-accion="continuar-podrida"]').hidden = !resumenPodrida;
}

function abrirMenuSegunPantalla() {
  if (!document.getElementById('pantalla-truco-juego').classList.contains('oculta')) {
    truco.abrirMenuActivo();
  } else if (!document.getElementById('pantalla-podrida-juego').classList.contains('oculta')) {
    podrida.abrirMenuActivo();
  }
}

function manejarClicks(e) {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;

  switch (accion) {
    case 'nueva-truco': truco.continuarOIniciar('nueva'); break;
    case 'continuar-truco': truco.continuarOIniciar('continuar'); break;
    case 'nueva-podrida': podrida.continuarOIniciar('nueva'); break;
    case 'continuar-podrida': podrida.continuarOIniciar('continuar'); break;
    case 'ir-historial': ui.mostrarPantalla('pantalla-historial'); historial.renderPantalla(); break;
    case 'ir-personas': ui.mostrarPantalla('pantalla-personas'); grupo.actualizarCodigoVisible(); personas.renderPantalla(); break;
    case 'volver-inicio': ui.mostrarPantalla('pantalla-inicio'); refrescarInicio(); break;
    case 'candado': ui.candado.activar(); break;
    case 'abrir-menu': abrirMenuSegunPantalla(); break;
    case 'cerrar-overlay': {
      const overlayEl = btn.closest('.overlay');
      if (overlayEl) ui.cerrarOverlay(overlayEl.id);
      else ui.cerrarTodosLosOverlays();
      break;
    }
    default: {
      const fn = truco.acciones[accion] || podrida.acciones[accion] || historial.acciones[accion]
        || personas.acciones[accion] || grupo.acciones[accion];
      if (fn) fn();
    }
  }
}

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Cuando hay una versión nueva de la app, se activa sola y recargamos la
  // página una vez para mostrarla — así no hace falta cerrar y volver a abrir
  // la pestaña a mano cada vez que se actualiza algo.
  let yaRecargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (yaRecargando) return;
    yaRecargando = true;
    location.reload();
  });
  try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('No se pudo registrar el service worker', e); }
}

async function aplicarConfigInicial() {
  const config = storage.getConfig();
  if (config.pantallaEncendida) {
    ui.wakeLock._deberiaEstarActivo = true;
    await ui.wakeLock.activar();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  grupo.iniciarSiYaHayGrupo();
  if (grupo.tieneGrupo()) ui.mostrarPantalla('pantalla-inicio');

  ui.candado.init();
  grupo.init();
  truco.init();
  podrida.init();
  historial.init();
  personas.init();
  document.addEventListener('click', manejarClicks);
  refrescarInicio();
  registrarServiceWorker();
  aplicarConfigInicial();
});
