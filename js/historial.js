import * as ui from './ui.js';
import * as nube from './nube.js';

export function agregarAlHistorial(entrada) {
  return nube.agregarAlHistorialNube(entrada);
}

function statsVacias(p) {
  return {
    id: p.id, nombre: p.nombre, color: p.color,
    trucoJugados: 0, trucoGanados: 0, trucoDiferencia: 0,
    podridaJugadas: 0, podridaGanadas: 0,
    podridaSumaPuntaje: 0, podridaCumplidas: 0, podridaTotales: 0,
  };
}

// Combina las personas guardadas con lo que surge del historial de truco y
// podrida, para mostrar en la pantalla "Personas". Incluye a quienes todavía
// no jugaron ninguna partida (con todo en 0).
export function calcularStatsPersonas() {
  const mapa = {};
  nube.obtenerPersonas().forEach((p) => { mapa[p.id] = statsVacias(p); });
  const obtener = (p) => { if (!mapa[p.id]) mapa[p.id] = statsVacias(p); return mapa[p.id]; };

  nube.obtenerHistorial().forEach((it) => {
    if (it.tipo === 'truco') {
      const diferenciaA = it.puntosA - it.puntosB;
      (it.personasA || []).forEach((p) => {
        const s = obtener(p);
        s.trucoJugados += 1;
        s.trucoDiferencia += diferenciaA;
        if (it.equipoGanadorIdx === 0) s.trucoGanados += 1;
      });
      (it.personasB || []).forEach((p) => {
        const s = obtener(p);
        s.trucoJugados += 1;
        s.trucoDiferencia -= diferenciaA;
        if (it.equipoGanadorIdx === 1) s.trucoGanados += 1;
      });
    } else if (it.tipo === 'podrida') {
      (it.jugadores || []).forEach((j) => {
        const s = obtener(j);
        s.podridaJugadas += 1;
        if (j.nombre === it.ganador) s.podridaGanadas += 1;
        s.podridaSumaPuntaje += j.puntaje;
        s.podridaCumplidas += j.apuestasCumplidas;
        s.podridaTotales += j.apuestasTotales;
      });
    }
  });

  return Object.values(mapa);
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

// "ts" puede ser un Timestamp de Firestore (tiene .toDate()), un número viejo
// de antes de este cambio (localStorage/Date.now()), o todavía null: la fecha
// la pone el servidor (serverTimestamp) y hasta que confirma, el dispositivo
// que acaba de guardar la ve un instante en null.
function formatearFecha(ts) {
  if (!ts) return 'Guardando…';
  const fecha = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return fecha.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ---------------- Pantalla de historial ---------------- */

function renderTabTruco(items) {
  const cont = document.getElementById('historial-truco');
  if (!items.length) {
    cont.innerHTML = '<p style="opacity:.6;text-align:center">Todavía no hay chicos jugados.</p>';
    return;
  }
  const conteo = {};
  items.forEach((it) => { conteo[it.ganador] = (conteo[it.ganador] || 0) + 1; });
  const statsHtml = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, n]) => `<div class="stats-jugador-fila"><span>${escapeHtml(nombre)}</span><span>${n} 👻</span></div>`)
    .join('');
  const listaHtml = items.slice(0, 60).map((it) => `
    <div class="item-historial">
      <div class="fecha-historial">${formatearFecha(it.fecha)}</div>
      <div class="resultado-historial">${escapeHtml(it.equipoA)} ${it.puntosA} — ${it.puntosB} ${escapeHtml(it.equipoB)}<br><strong>Ganó ${escapeHtml(it.ganador)}</strong></div>
    </div>`).join('');
  cont.innerHTML = `<p class="stats-titulo etiqueta-tiza">Chicos ganados</p>${statsHtml}<p class="stats-titulo etiqueta-tiza">Últimos chicos</p>${listaHtml}`;
}

function renderTabPodrida(items) {
  const cont = document.getElementById('historial-podrida');
  if (!items.length) {
    cont.innerHTML = '<p style="opacity:.6;text-align:center">Todavía no hay partidas de podrida jugadas.</p>';
    return;
  }
  const agg = {};
  items.forEach((it) => {
    it.jugadores.forEach((j) => {
      if (!agg[j.nombre]) agg[j.nombre] = { partidas: 0, victorias: 0, sumaPuntaje: 0, cumplidas: 0, totales: 0 };
      const a = agg[j.nombre];
      a.partidas += 1;
      if (j.nombre === it.ganador) a.victorias += 1;
      a.sumaPuntaje += j.puntaje;
      a.cumplidas += j.apuestasCumplidas;
      a.totales += j.apuestasTotales;
    });
  });
  const statsHtml = Object.entries(agg)
    .sort((a, b) => b[1].victorias - a[1].victorias)
    .map(([nombre, a]) => {
      const pct = a.totales ? Math.round((a.cumplidas / a.totales) * 100) : 0;
      const promedio = Math.round(a.sumaPuntaje / a.partidas);
      return `<div class="stats-jugador-fila"><span>${escapeHtml(nombre)} — ${a.victorias}👻 (${a.partidas} jug.)</span><span>${pct}% acierto · prom. ${promedio}</span></div>`;
    }).join('');
  const listaHtml = items.slice(0, 40).map((it) => {
    const orden = [...it.jugadores].sort((a, b) => b.puntaje - a.puntaje);
    const resumen = orden.map((j) => `${escapeHtml(j.nombre)} ${j.puntaje}`).join(' · ');
    return `<div class="item-historial">
      <div class="fecha-historial">${formatearFecha(it.fecha)}</div>
      <div class="resultado-historial">${resumen}<br><strong>Ganó ${escapeHtml(it.ganador)}</strong></div>
    </div>`;
  }).join('');
  cont.innerHTML = `<p class="stats-titulo etiqueta-tiza">Estadísticas</p>${statsHtml}<p class="stats-titulo etiqueta-tiza">Últimas partidas</p>${listaHtml}`;
}

export function renderPantalla() {
  const historial = nube.obtenerHistorial();
  renderTabTruco(historial.filter((h) => h.tipo === 'truco'));
  renderTabPodrida(historial.filter((h) => h.tipo === 'podrida'));
}

function initTabs() {
  const tabs = document.getElementById('historial-tabs');
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.opcion-tiza');
    if (!btn) return;
    tabs.querySelectorAll('.opcion-tiza').forEach((b) => b.classList.remove('activa'));
    btn.classList.add('activa');
    document.getElementById('historial-truco').classList.toggle('oculta', btn.dataset.tab !== 'truco');
    document.getElementById('historial-podrida').classList.toggle('oculta', btn.dataset.tab !== 'podrida');
  });
}

export function init() {
  initTabs();
  nube.onHistorialCambia(() => renderPantalla());
}

// Las partidas contadas (no amistosas) quedan fijas: no hay forma de borrar ni
// corregir el historial del grupo una vez guardado, para que sea un registro
// confiable de verdad (nadie puede "hacer desaparecer" una derrota).
export const acciones = {};

/* ---------------- Compartir resultado como imagen ---------------- */

function envolverTexto(ctx, texto, maxAncho) {
  const palabras = texto.split(' ');
  const lineas = [];
  let actual = '';
  palabras.forEach((palabra) => {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > maxAncho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  });
  if (actual) lineas.push(actual);
  return lineas;
}

export async function compartirImagen({ titulo, lineas }) {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch (e) { /* seguimos igual aunque la fuente no cargue a tiempo */ }

  const ancho = 900;
  const alto = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');

  // Marco de madera
  ctx.fillStyle = '#7c4f2c';
  ctx.fillRect(0, 0, ancho, alto);
  const m = 34;
  // Pizarra
  const grad = ctx.createRadialGradient(ancho / 2, 0, 40, ancho / 2, alto * 0.4, alto);
  grad.addColorStop(0, '#242424');
  grad.addColorStop(1, '#141414');
  ctx.fillStyle = grad;
  ctx.fillRect(m, m, ancho - m * 2, alto - m * 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fdfdfb';
  ctx.font = '58px "Tiza", cursive, sans-serif';
  const lineasTitulo = envolverTexto(ctx, titulo, ancho - m * 4);
  let y = 190;
  lineasTitulo.forEach((l) => { ctx.fillText(l, ancho / 2, y); y += 66; });

  y += 40;
  ctx.font = '44px "Tiza", cursive, sans-serif';
  lineas.forEach((linea) => {
    ctx.fillText(linea, ancho / 2, y);
    y += 64;
  });

  ctx.font = '28px "Tiza", cursive, sans-serif';
  ctx.fillStyle = 'rgba(253,253,251,.55)';
  ctx.fillText('Anotador — ' + new Date().toLocaleDateString('es-UY'), ancho / 2, alto - m - 30);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const archivo = new File([blob], 'anotador.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: 'Anotador' });
        return;
      } catch (e) {
        // el usuario canceló el share o falló; probamos con la descarga como respaldo
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anotador.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    ui.toast('Imagen descargada');
  }, 'image/png');
}
