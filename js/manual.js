// Manual de truco: al tocar una página se abre a pantalla completa con zoom
// (pellizco con dos dedos, doble toque, rueda del mouse) y arrastre para moverse.
// La app tiene el zoom del navegador desactivado (viewport), por eso hace falta
// este visor propio.
import * as ui from './ui.js';

const ESCALA_MAX = 5;
const ESCALA_DOBLE_TOQUE = 2.6;
const TIEMPO_DOBLE_TOQUE = 300;
const MOVIMIENTO_MAX_TOQUE = 8;

export function init() {
  const visor = document.getElementById('visor-manual');
  const img = visor.querySelector('img');
  const punteros = new Map();
  let escala = 1, x = 0, y = 0;
  let distanciaInicial = 0, escalaInicial = 1;
  let inicioToque = null, ultimoToque = 0;

  function limitar() {
    escala = Math.min(ESCALA_MAX, Math.max(1, escala));
    const maxX = Math.max(0, (img.offsetWidth * escala - visor.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * escala - visor.clientHeight) / 2);
    x = Math.min(maxX, Math.max(-maxX, x));
    y = Math.min(maxY, Math.max(-maxY, y));
  }

  function aplicar() {
    limitar();
    img.style.transform = `translate(${x}px, ${y}px) scale(${escala})`;
  }

  // Cambia la escala manteniendo quieto el punto (px, py) de la pantalla.
  function zoomEn(nuevaEscala, px, py) {
    const caja = visor.getBoundingClientRect();
    const cx = px - caja.left - caja.width / 2;
    const cy = py - caja.top - caja.height / 2;
    const nueva = Math.min(ESCALA_MAX, Math.max(1, nuevaEscala));
    const razon = nueva / escala;
    x = cx - (cx - x) * razon;
    y = cy - (cy - y) * razon;
    escala = nueva;
    aplicar();
  }

  function abrir(src, alt) {
    img.src = src;
    img.alt = alt || '';
    escala = 1; x = 0; y = 0;
    aplicar();
    ui.abrirOverlay('visor-manual');
  }

  document.querySelector('.manual-paginas').addEventListener('click', (e) => {
    const pagina = e.target.closest('img');
    if (pagina) abrir(pagina.currentSrc || pagina.src, pagina.alt);
  });

  const distancia = () => {
    const [a, b] = [...punteros.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const centro = () => {
    const [a, b] = [...punteros.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  visor.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-accion]')) return; // botón de cerrar
    try { visor.setPointerCapture(e.pointerId); } catch (err) { /* sin captura igual funciona */ }
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) {
      inicioToque = { x: e.clientX, y: e.clientY, t: Date.now(), movio: false };
    } else if (punteros.size === 2) {
      inicioToque = null;
      distanciaInicial = distancia();
      escalaInicial = escala;
    }
  });

  visor.addEventListener('pointermove', (e) => {
    const anterior = punteros.get(e.pointerId);
    if (!anterior) return;
    const actual = { x: e.clientX, y: e.clientY };
    punteros.set(e.pointerId, actual);

    if (punteros.size === 2) {
      const c = centro();
      zoomEn(escalaInicial * distancia() / distanciaInicial, c.x, c.y);
    } else if (punteros.size === 1) {
      if (inicioToque && Math.hypot(actual.x - inicioToque.x, actual.y - inicioToque.y) > MOVIMIENTO_MAX_TOQUE) {
        inicioToque.movio = true;
      }
      x += actual.x - anterior.x;
      y += actual.y - anterior.y;
      aplicar();
    }
  });

  function soltar(e) {
    if (!punteros.delete(e.pointerId)) return;
    // Doble toque: acerca (o vuelve al tamaño original si ya estaba acercado).
    if (e.type === 'pointerup' && inicioToque && !inicioToque.movio && Date.now() - inicioToque.t < TIEMPO_DOBLE_TOQUE) {
      if (Date.now() - ultimoToque < TIEMPO_DOBLE_TOQUE) {
        zoomEn(escala > 1.05 ? 1 : ESCALA_DOBLE_TOQUE, e.clientX, e.clientY);
        ultimoToque = 0;
      } else {
        ultimoToque = Date.now();
      }
    }
    inicioToque = null;
    // Si quedó un dedo después de pellizcar, que siga arrastrando sin saltos.
    if (punteros.size === 1) inicioToque = { x: 0, y: 0, t: 0, movio: true };
  }
  visor.addEventListener('pointerup', soltar);
  visor.addEventListener('pointercancel', soltar);

  visor.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomEn(escala * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ui.cerrarOverlay('visor-manual');
  });
}
