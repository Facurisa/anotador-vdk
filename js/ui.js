// Helpers de interfaz compartidos: navegación entre pantallas, overlays, toast,
// confirmaciones, candado anti-toques y "mantener pantalla encendida".

// Ícono de fantasma reutilizable (logo del escudo VDK, trazo calcado del PDF
// original — no es un dibujo aproximado). El grosor del trazo está definido en
// unidades del viewBox, así que escala solo con el tamaño pedido.
const VIEWBOX_FANTASMA = '0 0 241.4 284.2';
const PATH_CUERPO_FANTASMA = 'M218.62,103.35 C221.88,102.85 224.90,102.55 227.81,101.82 C228.89,101.55 230.29,100.37 230.51,99.38 C230.85,97.87 230.91,95.88 228.48,95.38 C227.42,95.17 221.08,91.06 218.81,90.89 C212.43,90.40 196.00,90.65 194.61,91.39 C188.25,94.78 181.62,97.40 174.74,99.50 C172.60,100.16 171.79,99.38 171.90,97.50 C172.05,95.04 172.46,92.60 172.86,90.16 C173.82,84.40 175.34,78.68 175.70,72.89 C176.06,66.97 176.22,60.76 174.82,55.09 C173.33,49.02 170.22,43.26 167.21,37.69 C165.42,34.39 162.51,31.69 160.01,28.79 C154.31,22.20 146.73,18.20 138.86,15.29 C133.18,13.20 127.06,11.58 120.65,12.16 C111.95,12.95 102.91,10.53 94.57,14.71 C90.68,16.66 86.72,18.66 83.27,21.28 C78.75,24.70 75.14,29.04 71.90,33.82 C67.31,40.57 64.23,47.82 62.52,55.70 C61.86,58.70 60.67,80.73 62.57,88.54 C63.11,90.75 63.88,92.91 64.74,95.75 C58.14,92.89 30.44,88.74 23.14,93.09 C19.78,95.08 16.07,96.50 13.02,99.10 C10.96,100.85 10.53,103.24 11.29,105.38 C11.58,106.22 14.17,106.46 15.74,106.58 C18.32,106.77 20.93,106.63 23.48,106.63 C20.81,112.01 19.04,117.29 20.16,123.02 C20.97,127.20 24.77,128.07 28.02,125.08 C30.28,123.01 33.56,123.44 35.61,126.06 C35.78,126.28 36.03,126.43 36.24,126.62 C38.60,128.80 41.31,130.71 43.21,133.23 C45.55,136.35 47.40,139.88 49.11,143.41 C50.82,146.93 52.92,150.56 53.41,154.33 C54.41,162.12 54.53,170.03 54.88,177.90 C55.14,183.65 55.18,189.42 55.37,195.19 C55.59,202.19 61.08,210.35 63.53,212.73 C65.97,215.11 75.14,220.91 75.14,220.91 S77.70,199.19 79.28,197.21 C80.24,196.01 83.41,195.41 83.41,195.41 S87.46,196.27 88.09,197.91 C90.02,202.91 92.04,207.89 93.53,213.03 C95.87,221.11 98.57,228.87 102.74,236.35 C105.47,241.26 117.56,252.27 119.90,254.42 C122.33,256.65 128.48,259.36 128.48,259.36 S127.82,253.02 127.75,252.43 C127.47,250.02 127.23,247.60 127.22,245.17 C127.21,243.44 128.53,239.71 128.53,239.71 S138.40,267.46 139.31,268.85 C140.19,270.84 147.42,273.71 147.42,273.71 S147.75,270.23 147.08,268.88 C144.21,263.14 146.63,257.70 148.40,252.65 C150.72,246.04 155.21,240.17 157.32,233.52 C159.48,226.70 164.05,220.54 163.75,212.97 C163.73,212.58 163.77,211.94 163.86,211.56 C164.47,208.95 166.70,198.58 166.70,198.58 S167.44,208.65 167.32,212.28 C167.25,214.60 168.60,215.02 170.20,214.37 C171.61,213.81 173.08,212.82 173.93,211.60 C175.28,209.65 176.04,207.29 177.23,205.20 C179.31,201.53 182.03,198.13 183.57,194.26 C185.23,190.08 186.24,185.53 186.83,181.05 C187.93,172.78 188.52,164.44 189.32,156.12 C189.51,154.22 191.85,145.60 192.29,143.06 C193.78,134.43 197.88,127.51 205.38,122.88 C207.26,121.73 209.71,121.52 211.62,120.40 C213.45,119.33 214.72,118.93 216.43,120.61 C218.84,122.99 223.34,121.80 223.88,118.67 C224.14,117.13 224.14,115.33 223.58,113.91 C222.24,110.51 220.50,107.27 218.62,103.35 Z';
const PATH_OJO_A_FANTASMA = 'M110.79,57.75 C110.41,67.89 107.08,76.60 98.80,83.01 C95.48,85.58 89.42,84.81 86.61,81.66 C81.29,75.72 80.62,68.73 82.23,61.52 C83.22,57.08 85.11,52.75 87.18,48.67 C89.49,44.09 96.43,40.80 100.38,41.78 C106.61,43.32 110.48,48.23 110.79,55.01 C110.83,55.92 110.79,56.84 110.79,57.75 Z';
const PATH_OJO_B_FANTASMA = 'M138.59,44.49 C129.52,39.51 121.88,42.90 120.84,51.75 C119.51,63.02 124.36,72.54 132.66,80.00 C136.06,83.05 140.51,83.74 144.78,81.09 C149.86,77.94 151.35,72.96 151.56,68.52 C151.54,59.31 145.79,48.44 138.59,44.49 Z';

export function svgFantasma(color = 'currentColor', tamano = 24) {
  const alto = Math.round(tamano * 284.2 / 241.4);
  const brillo = color === 'currentColor' ? '' : ` style="filter:drop-shadow(0 0 3px ${color})"`;
  return `<svg class="icono-fantasma" width="${tamano}" height="${alto}" viewBox="${VIEWBOX_FANTASMA}" fill="none" stroke="${color}" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"${brillo}><path d="${PATH_CUERPO_FANTASMA}"/><path d="${PATH_OJO_A_FANTASMA}"/><path d="${PATH_OJO_B_FANTASMA}"/></svg>`;
}

export function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach((el) => el.classList.add('oculta'));
  document.getElementById(id).classList.remove('oculta');
  cerrarTodosLosOverlays();
}

export function abrirOverlay(id) {
  document.getElementById(id).classList.remove('oculta');
}

export function cerrarOverlay(id) {
  document.getElementById(id).classList.add('oculta');
}

export function cerrarTodosLosOverlays() {
  document.querySelectorAll('.overlay').forEach((el) => el.classList.add('oculta'));
}

let toastTimer = null;
export function toast(mensaje, duracion = 2200) {
  const el = document.getElementById('toast');
  el.textContent = mensaje;
  el.classList.remove('oculta');
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('oculta'), 300);
  }, duracion);
}

export function confirmar(mensaje) {
  return new Promise((resolve) => {
    document.getElementById('confirmar-texto').textContent = mensaje;
    abrirOverlay('overlay-confirmar');
    const btnSi = document.getElementById('confirmar-si');
    const btnNo = document.getElementById('confirmar-no');
    btnSi.onclick = () => { cerrarOverlay('overlay-confirmar'); resolve(true); };
    btnNo.onclick = () => { cerrarOverlay('overlay-confirmar'); resolve(false); };
  });
}

export function vibrar(ms = 30) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) { /* algunos navegadores lo bloquean, no pasa nada */ }
  }
}

/* ---------------- Candado anti-toques ---------------- */
const TIEMPO_DESBLOQUEO = 650;

export const candado = {
  activo: false,
  activar() {
    this.activo = true;
    document.getElementById('overlay-candado').classList.remove('oculta');
  },
  desactivar() {
    this.activo = false;
    document.getElementById('overlay-candado').classList.add('oculta');
  },
  init() {
    const el = document.getElementById('overlay-candado');
    let timer = null;
    const cancelar = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', () => {
      cancelar();
      timer = setTimeout(() => { candado.desactivar(); }, TIEMPO_DESBLOQUEO);
    });
    el.addEventListener('pointerup', cancelar);
    el.addEventListener('pointercancel', cancelar);
    el.addEventListener('pointerleave', cancelar);
  },
};

/* ---------------- Mantener pantalla encendida (Wake Lock) ---------------- */
export const wakeLock = {
  centinela: null,
  soportado: 'wakeLock' in navigator,
  async activar() {
    if (!this.soportado) return false;
    try {
      this.centinela = await navigator.wakeLock.request('screen');
      this.centinela.addEventListener('release', () => { this.centinela = null; });
      return true;
    } catch (e) {
      return false;
    }
  },
  async liberar() {
    if (this.centinela) {
      try { await this.centinela.release(); } catch (e) { /* no-op */ }
      this.centinela = null;
    }
  },
  activo() { return this.centinela !== null; },
};

// Si el navegador vuelve a estar visible y el wake lock estaba pedido, algunos
// navegadores lo liberan solos al cambiar de pestaña/pantalla; lo reactivamos.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock.soportado && wakeLock._deberiaEstarActivo) {
    wakeLock.activar();
  }
});
