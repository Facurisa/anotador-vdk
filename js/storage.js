// Acceso centralizado a localStorage. Todas las claves usan el prefijo "anotador.".

const PREFIJO = 'anotador.';

function leer(clave, porDefecto) {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    if (crudo === null) return porDefecto;
    return JSON.parse(crudo);
  } catch (err) {
    console.warn('No se pudo leer', clave, err);
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    if (valor === undefined || valor === null) {
      localStorage.removeItem(PREFIJO + clave);
    } else {
      localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    }
  } catch (err) {
    console.warn('No se pudo guardar', clave, err);
  }
}

export const storage = {
  // Partida de truco en curso (o null si no hay ninguna)
  getTruco: () => leer('truco', null),
  setTruco: (estado) => escribir('truco', estado),

  // Partida de podrida en curso (o null si no hay ninguna)
  getPodrida: () => leer('podrida', null),
  setPodrida: (estado) => escribir('podrida', estado),

  // Personas guardadas, compartidas entre truco y podrida: [{id, nombre, color}]
  getPersonas: () => leer('personas', []),
  setPersonas: (lista) => escribir('personas', lista),

  // Historial de partidas terminadas (truco y podrida mezclados, más nuevas primero)
  getHistorial: () => leer('historial', []),
  setHistorial: (lista) => escribir('historial', lista),

  // Configuración global: { pantallaEncendida }
  getConfig: () => leer('config', { pantallaEncendida: false }),
  setConfig: (config) => escribir('config', config),

  // Código del grupo compartido (null si todavía no se creó/unió a ninguno)
  getCodigoGrupo: () => leer('codigoGrupo', null),
  setCodigoGrupo: (codigo) => escribir('codigoGrupo', codigo),
};

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
