// Sincronización con Firestore: historial y personas compartidos por todo el
// grupo (con código simple), con soporte offline nativo del SDK de Firebase
// (encola los cambios hechos sin internet y los sube solo cuando vuelve la señal).
import {
  initializeApp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, collection, doc, addDoc, setDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { storage } from './storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDBuH3-ZBlSke_3mu859rcj2bpR-xgBohY',
  authDomain: 'anotador-vdk.firebaseapp.com',
  projectId: 'anotador-vdk',
  storageBucket: 'anotador-vdk.firebasestorage.app',
  messagingSenderId: '865563537064',
  appId: '1:865563537064:web:6a1f588cd9903ead179c9d',
};

const app = initializeApp(firebaseConfig);
// persistentLocalCache = guarda todo en IndexedDB y encola los cambios hechos
// sin internet, subiéndolos solos apenas vuelve la señal (offline-first nativo
// del SDK, no hay que armar nada a mano para esto).
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

let quitarListenerHistorial = null;
let quitarListenerPersonas = null;
let cacheHistorial = [];
let cachePersonas = [];
const callbacksHistorial = [];
const callbacksPersonas = [];

const CARACTERES_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L, se prestan a confusión

export function generarCodigoGrupo() {
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += CARACTERES_CODIGO[Math.floor(Math.random() * CARACTERES_CODIGO.length)];
  return codigo;
}

export function grupoActivo() {
  return storage.getCodigoGrupo();
}

function refHistorial(codigo) {
  return collection(db, 'grupos', codigo, 'historial');
}

function refPersonas(codigo) {
  return collection(db, 'grupos', codigo, 'personas');
}

// Arranca (o reinicia) los listeners en tiempo real del grupo activo. Hay que
// llamarlo una vez que se sabe el código de grupo (al iniciar la app, o justo
// después de crear/unirse a uno).
export function iniciarListeners() {
  const codigo = grupoActivo();
  if (!codigo) return;

  if (quitarListenerHistorial) quitarListenerHistorial();
  if (quitarListenerPersonas) quitarListenerPersonas();

  const qHistorial = query(refHistorial(codigo), orderBy('fecha', 'desc'));
  quitarListenerHistorial = onSnapshot(qHistorial, (snap) => {
    // "estimate" = mientras el servidor todavía no confirmó el serverTimestamp
    // de una escritura recién hecha en este mismo dispositivo, usar la hora
    // local como estimación en vez de null — si no, el partido que se acaba
    // de guardar puede desaparecer un instante de la lista (Firestore no sabe
    // dónde ordenar un valor todavía nulo) hasta que el servidor confirma.
    cacheHistorial = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    callbacksHistorial.forEach((cb) => cb(cacheHistorial));
  }, (err) => console.warn('Error escuchando el historial del grupo', err));

  quitarListenerPersonas = onSnapshot(refPersonas(codigo), (snap) => {
    cachePersonas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callbacksPersonas.forEach((cb) => cb(cachePersonas));
  }, (err) => console.warn('Error escuchando las personas del grupo', err));
}

// Los callbacks se llaman cada vez que cambian los datos (localmente al toque,
// o cuando llega algo nuevo de otro dispositivo). Si ya hay datos en caché al
// suscribirse, se llama una vez enseguida con lo que haya.
export function onHistorialCambia(cb) {
  callbacksHistorial.push(cb);
  cb(cacheHistorial);
}

export function onPersonasCambia(cb) {
  callbacksPersonas.push(cb);
  cb(cachePersonas);
}

export function obtenerHistorial() { return cacheHistorial; }
export function obtenerPersonas() { return cachePersonas; }

// La fecha SIEMPRE la pone el servidor de Firestore (serverTimestamp), nunca
// el reloj del celular: así nadie puede escribir una partida con una fecha
// inventada, ni siquiera llamando al SDK directo desde la consola del
// navegador (las reglas de seguridad exigen que "fecha" sea la hora real del
// servidor). Se descarta cualquier "fecha" que venga de quien llama.
//
// OJO: esta función es a propósito NO async y devuelve el id de una, sin
// esperar a que el servidor confirme nada. El id de un documento nuevo lo
// genera el propio SDK en el momento (doc(...)), sin red de por medio, así
// que se puede devolver ya mismo. El guardado real (setDoc) se dispara en
// paralelo y el SDK offline-first se encarga de encolarlo si no hay señal.
// Esto es clave para que, si alguien cierra la app un instante después de
// terminar una partida, el resultado ya haya quedado guardado igual — no
// puede depender de esperar ninguna animación ni ninguna confirmación de red.
export function agregarAlHistorialNube(entrada) {
  const codigo = grupoActivo();
  if (!codigo) return null;
  const { fecha, ...resto } = entrada;
  const ref = doc(refHistorial(codigo));
  setDoc(ref, { ...resto, fecha: serverTimestamp() });
  return ref.id;
}

export async function guardarPersonaNube(persona) {
  const codigo = grupoActivo();
  if (!codigo) return;
  await setDoc(doc(db, 'grupos', codigo, 'personas', persona.id), persona, { merge: true });
}

export async function borrarPersonaNube(id) {
  const codigo = grupoActivo();
  if (!codigo) return;
  await deleteDoc(doc(db, 'grupos', codigo, 'personas', id));
}

// Al crear un grupo nuevo, sube de una sola vez lo que ya hubiera guardado
// localmente en este dispositivo (partidas de prueba, personas cargadas antes
// de que existiera el grupo), para no perder ese historial.
export async function migrarDatosLocales() {
  const codigo = grupoActivo();
  if (!codigo) return;
  const personasLocales = storage.getPersonas();
  const historialLocal = storage.getHistorial();
  for (const p of personasLocales) {
    await setDoc(doc(db, 'grupos', codigo, 'personas', p.id), p, { merge: true });
  }
  for (const entrada of historialLocal) {
    const { id, fecha, ...datos } = entrada;
    await addDoc(refHistorial(codigo), { ...datos, fecha: serverTimestamp() });
  }
}
