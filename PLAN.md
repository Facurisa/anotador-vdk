# Anotador VDK — Plan de la app

App para anotar puntajes de **Truco** y **Podrida**, pensada para usar en el celular durante la partida. Se llama **"Anotador VDK"** (grupo de amigos) y usa como logo el fantasma del escudo VDK (`Desktop\boludeces\VDK\logo- escudo\VDK\vectores\Escudo VDK.pdf`), reutilizado en toda la app: es el logo de inicio, reemplaza los trofeos del truco y los círculos de color de la podrida. El trazo del fantasma en `js/ui.js` (`svgFantasma()`) **no es un dibujo aproximado**: se extrajo el path vectorial exacto del PDF original con `pdfjs-dist` (`getOperatorList()`), separando cuerpo y los dos ojos, para que sea una réplica fiel del logo real. Dentro de la app (tiza sobre pizarra) el fantasma va en blanco solo contorno, sin relleno. Los **íconos de instalación** (`iconos/`) usan, en cambio, un estilo de logo/marca: fondo sólido bordó `#431321` (el mismo color exacto que los ojos del escudo VDK original, verificado con cuentagotas sobre `Escudo VDK.png`), fantasma relleno de blanco con contorno negro y ojos huecos del mismo bordó de fondo. `theme_color` de la PWA también es ese bordó. Facundo no es programador: mantener todo simple, sin herramientas de build, y explicarle los pasos en lenguaje llano.

## Plataforma y tecnología

- **App web (PWA)** en vanilla HTML + CSS + JavaScript. Sin frameworks, sin npm, sin build.
- Archivos: `index.html`, `css/estilos.css`, `js/app.js`, `js/truco.js`, `js/podrida.js`, `js/personas.js`, `js/selector-personas.js`, `js/historial.js`, `js/ui.js`, `js/storage.js`, `js/grupo.js`, `js/nube.js`, `manifest.json`, `sw.js` (service worker para que funcione offline), íconos en `iconos/`.
- **Publicada en GitHub Pages**: `https://facurisa.github.io/anotador-vdk/` (repo público `Facurisa/anotador-vdk`). Cada `git push` a `main` republica sola en un minuto o dos.
- **Scroll interno**: todas las pantallas con scroll usan un wrapper `.pizarra-interior-scroll` separado del marco redondeado de afuera — así la barra nativa del navegador nunca "corta" las esquinas redondeadas (los navegadores no redondean su propia scrollbar).
- **Persistencia con `localStorage`**: la partida en curso se guarda en cada acción. Si se cierra el navegador o se apaga la pantalla, al volver a abrir sigue todo igual.
- Se instala con "Agregar a pantalla de inicio" del navegador. Debe verse bien en pantalla de celular vertical (probar ~390×844).
- **Wake Lock API**: toggle "mantener pantalla encendida" durante la partida (con fallback silencioso si el navegador no lo soporta).
- **Alto de pantalla en celular**: `#app` usa `height: 100dvh` (con `100vh` como respaldo) además de `position:fixed; inset:0`, para que la barra de direcciones del navegador móvil no deje contenido tapado abajo — es el fix estándar para el bug clásico de "100vh mal calculado" en navegadores de celular.
- Para probarla en la PC: abrir con un servidor local simple (ej. `npx serve` o `python -m http.server`) porque el service worker no anda con `file://`. Para el celular: misma wifi + IP local, o subirla gratis a GitHub Pages / Netlify (decidir con Facundo al final).
- **Importante al editar código**: el service worker (`sw.js`) cachea todo para que ande offline. Cada vez que se cambia `index.html`, algún `.css` o `.js`, hay que **subir el número de `VERSION` en `sw.js`** (ej. `anotador-v5` → `anotador-v6`) — si no, el navegador (y el celular) puede seguir mostrando la versión vieja cacheada durante las pruebas, aunque el archivo ya se haya editado. Si al probar un cambio no se ve, sospechar primero de esto antes de asumir que el cambio no funcionó.
- **Auto-actualización**: `app.js` escucha el evento `controllerchange` del service worker y recarga la página sola apenas se activa una versión nueva — no hace falta que Facundo cierre y reabra la pestaña a mano para ver los cambios (probado y confirmado que funciona).

## Estética general

Estilo **pizarrón** en toda la app (ver `referencia-truco.jpeg` en esta carpeta):

- Fondo negro/carbón con textura sutil de pizarra, marco de madera alrededor.
- Tipografía manuscrita tipo tiza (ej. Google Font "Patrick Hand" o similar — **descargar el .woff2 y servirlo local**, la app debe andar offline).
- Elementos dibujados como con tiza: líneas divisorias irregulares, botón "Menú" con borde tiza como en la referencia.
- Los colores de los jugadores de la podrida son tizas de colores (pasteles vivos que contrasten sobre negro), mostrados con el ícono de fantasma en vez de un círculo.

## Registro compartido por grupo (nube)

El historial y las personas guardadas **ya no viven solo en el dispositivo**: se sincronizan por Firestore (Firebase) entre todos los que se unan al mismo grupo, para que cualquiera del grupo VDK vea el registro general en vez de solo lo que jugó en su propio celular.

- **Pantalla de grupo** (`js/grupo.js`, `pantalla-grupo`): es la primera pantalla que ve alguien que abre la app sin un grupo guardado todavía. Dos opciones:
  - **Crear un grupo nuevo**: genera un código corto de 6 caracteres (`generarCodigoGrupo()` en `js/nube.js`, sin caracteres confundibles como 0/O/1/I/L), lo guarda en `localStorage` (`anotador.codigoGrupo`) y muestra un overlay con el código para copiar y pasarles a los amigos. Si el dispositivo ya tenía personas/historial cargado de antes (pruebas locales), se migra automáticamente a la nube (`migrarDatosLocales()`) para no perderlo.
  - **Unirme a un grupo**: se escribe el código que pasó otro; valida que tenga al menos 4 caracteres y arranca a escuchar los datos de ese grupo.
  - Una vez que hay grupo guardado, la app arranca directo en el inicio (`grupo.iniciarSiYaHayGrupo()` + listeners de Firestore) sin volver a pedir el código.
  - El código del grupo actual se ve siempre en la pantalla "Personas" (con botón para copiarlo) por si hay que pasárselo a alguien más.
- **Acceso**: solo con el código de grupo (sin login/contraseña) — decisión explícita de Facundo, simple para el grupo de amigos. Las reglas de seguridad de Firestore permiten leer/escribir `grupos/{codigo}/historial` y `grupos/{codigo}/personas` a cualquiera que tenga el código, pero **niegan leer la lista de grupos en sí** (no se puede "adivinar" códigos ajenos por fuerza bruta enumerando la colección).
- **Offline-first nativo**: Firestore se inicializa con `initializeFirestore(app, { localCache: persistentLocalCache() })`, que guarda todo en IndexedDB y encola los cambios hechos sin señal — se suben solos apenas vuelve la conexión, sin código de cola manual. Confirmado por decisión explícita de Facundo ("se guarda igual y se sincroniza cuando vuelva la señal").
- **Fecha y hora exactas por partida**: cada entrada del historial guarda su timestamp real (`fecha`) al momento de terminar la partida, y se muestra formateado (ej. "13/07/2026, 12:39 p. m.") en la lista de partidas — pedido explícito de Facundo para poder verificar que nadie anotó partidos inventados. La fecha es un `serverTimestamp()` de Firestore (la pone el servidor de Google al escribir), **no** `Date.now()` del celular — así nadie puede mandar una fecha inventada ni siquiera llamando al SDK directo desde la consola del navegador, porque además la regla de seguridad exige `request.resource.data.fecha == request.time` (ver más abajo). Al leer, se pide `serverTimestamps: 'estimate'` en el listener para que la partida recién guardada no desaparezca un instante de la lista mientras el servidor confirma; `historial.js` → `formatearFecha()` acepta tanto un `Timestamp` (`.toDate()`) como un número viejo (compatibilidad con entradas de antes de este cambio) o `null` (mientras se confirma, muestra "Guardando…").
- **Dureza contra trampas de amigos técnicos**: como el código de grupo (y la config de Firebase) están en el JS público, cualquiera con conocimientos podría intentar llamar al SDK de Firestore directo desde la consola del navegador, saltándose la interfaz. Por eso la protección real no puede depender solo de "no mostrar el botón" — tiene que estar en las **reglas de seguridad de Firestore** (Console → Firestore → Reglas), que son la única barrera que Firestore respeta pase lo que pase en el cliente:
  - `historial`: permite `create`, pero **niega `update` y `delete`** (inmutable de verdad, a nivel de base de datos) y exige que `fecha` sea literalmente el `request.time` del servidor (bloquea fechas inventadas).
  - `personas`: sigue con `create`/`update`/`delete` abiertos (es solo el roster de nombres, no hay nada que "hacer trampa" ahí).
  - El documento padre `grupos/{codigo}` se sigue negando para no poder enumerar/adivinar grupos ajenos.
  - **Techo de esto**: no impide que alguien muy decidido *invente* una partida nueva desde cero (un `create` con nombres y puntajes falsos sigue siendo técnicamente posible sin autenticación real) — eso ya requeriría login de verdad + validación del resultado en un Cloud Function, mucho más complejo. Lo que sí queda cerrado del todo es editar o borrar un resultado ya guardado, y falsificar la fecha.
  - **Reglas verificadas a mano** contra el proyecto real (`anotador-vdk`), llamando al SDK de Firestore directo desde la consola del navegador (saltándose la app por completo, como haría un amigo técnico): intentar `deleteDoc`/`updateDoc` sobre una entrada de historial existente da `permission-denied`; intentar `addDoc` con una `fecha` inventada (no `serverTimestamp()`) también da `permission-denied`; una escritura legítima vía `agregarAlHistorialNube()` sigue funcionando normal.
  - **Archivo de referencia**: `firestore.rules` en la raíz del repo tiene el texto exacto publicado en el Console (no se aplica solo con tenerlo en el repo — hay que pegarlo a mano en Firebase Console → Firestore → Reglas si se necesita reconstruir desde cero).
  - **Easter egg**: si alguien intenta un `delete`/`update` bloqueado desde la consola del navegador sin atrapar el error (`.catch`), `app.js` escucha `unhandledrejection` y, si el código es `permission-denied`, tira un toast + un log de consola grande: "Damian, no hagas trampa 😏" (chiste interno del grupo, apuntado a un amigo ingeniero en particular). Si el que lo intenta SÍ atrapa el error con `.catch()`/`try` (como cualquier ingeniero cuidadoso haría), este aviso no se dispara — solo es un guiño extra, la protección real son las reglas de Firestore.
- **Partido amistoso**: toggle "Partido amistoso (no queda en el historial del grupo)" en la config de truco y de podrida (por defecto apagado). Si está prendido, la partida se juega normal en el dispositivo (puntos, fantasmas, tabla) pero al terminar **no** se llama a `agregarAlHistorial()`, así no ensucia el registro compartido — pensado para probar la app o jugar contra alguien que no es del grupo fijo, sin que quede contabilizado. Mientras está activo se ve una insignia chica ("PARTIDO AMISTOSO · no se guarda") arriba de la pantalla de juego para no confundirse. Internamente el campo se sigue llamando `practica` en el estado guardado (se respeta también al hacer "Otro chico"/revancha/reiniciar, hasta que se vuelve a armar la partida desde cero).
- **SDK de Firebase por CDN** (`gstatic.com`, no local): es un paquete pensado para usarse así sin bundler; el service worker lo cachea igual para que la app siga arrancando offline una vez que se usó al menos una vez con internet. El `fetch` del service worker está limitado a recursos propios + ese CDN, para no interferir con las llamadas en tiempo real de Firestore.
- Módulo central: `js/nube.js` (listeners `onSnapshot`, caché en memoria, funciones `agregarAlHistorialNube`/`guardarPersonaNube`/`borrarPersonaNube`). `historial.js` y `personas.js` ya no leen/escriben `localStorage` directo para estos datos: todo pasa por `nube.js`, con los módulos de UI suscritos vía `onHistorialCambia`/`onPersonasCambia` para re-renderizar solos cuando cambia algo (local o de otro dispositivo).
- **El historial de partidas contadas es inmutable**: no existe ningún botón para borrar ni corregir una partida ya guardada (a propósito no hay `borrarHistorialNube()` ni nada parecido) — pedido explícito de Facundo para que el registro sea confiable y nadie pueda "borrar" una derrota. Como las partidas amistosas ni siquiera se guardan (ver "Partido amistoso" más abajo), todo lo que aparece en el historial del grupo es, por definición, una partida real. La restricción está reforzada en dos capas: la interfaz no ofrece la opción, **y** las reglas de Firestore niegan `update`/`delete` sobre `historial` a nivel de base de datos (ver "Dureza contra trampas de amigos técnicos" más arriba) — así que ni editando el código ni llamando al SDK a mano se puede sortear.
- **Personas sin duplicar entre dispositivos**: al guardar una persona nueva, `selector-personas.js` busca primero si ya existe alguien con ese nombre en la caché del grupo (sin importar mayúsculas) y reutiliza su `id` en vez de crear un registro repetido.

## Personas (roster compartido)

- Lista compartida de gente guardada (`{id, nombre, color}`) en Firestore (ver sección de arriba), usada tanto por el truco como por la podrida — una persona agregada en un juego aparece como sugerencia rápida en el otro, y en cualquier dispositivo del grupo.
- Componente reutilizable `js/selector-personas.js` (`crearSelectorPersonas`): agregar/quitar personas de una lista, paleta de colores sin repetidos dentro de esa lista, accesos rápidos a personas guardadas. Se usa 3 veces: podrida (una lista) y truco (una lista por equipo, con exclusión mutua para que la misma persona no quede en los dos equipos a la vez).
- **Pantalla "Personas"** (`js/personas.js`, accesible desde el inicio): directorio con tarjeta por persona, con pestañas **Truco** / **Podrida** para ver las estadísticas de cada juego por separado (no mezcladas). Truco: chicos ganados de X jugados, y **diferencia de puntos acumulada** (+/− sumando `puntos propios − puntos rivales` de cada chico, en verde si es positiva y en rojo si es negativa) — ordenado por ganados y después por diferencia. Podrida: partidas ganadas de X jugadas, % de apuestas cumplidas, puntaje promedio — ordenado por ganadas. Permite agregar o borrar personas directamente. Las estadísticas se recalculan siempre desde el historial (`calcularStatsPersonas()` en `historial.js`), nunca se guardan aparte.
- **Truco con personas (opcional)**: en la configuración, cada equipo tiene su nombre editable de siempre **más** una sección "¿Quién juega?" para asignar 0 o más personas guardadas a ese equipo (no es obligatorio, es solo para llevar estadísticas). Al ganar un chico, se guarda en el historial qué personas estaban en cada equipo y cuál ganó, para poder calcular sus stats.

## Pantalla de inicio

- Logo fantasma + título "Anotador VDK" y dos botones grandes: **Truco** y **Podrida**, más accesos chicos a **Personas** e **Historial**.
- Si hay una partida guardada de alguno de los dos juegos, ofrecer "Continuar partida" además de "Nueva partida".

---

## Truco

### Configuración (al crear partida)

- Puntaje objetivo: **40** (20 malas + 20 buenas) o **51** (26 malas + 25 buenas).
- Nombres de equipos, editables (por defecto "Nosotros" y "Ellos"). También editables durante la partida tocando el nombre.
- Debajo de cada nombre, selector opcional "¿Quién juega?" (ver sección Personas) para asignar gente guardada a ese equipo y llevar sus estadísticas.

### Pantalla de juego

- Layout igual a la referencia: pantalla dividida en dos mitades verticales por una línea de tiza, nombre arriba, número grande al centro, fantasmas ganados abajo.
- Botón chico "&larr;" flotante en la esquina superior izquierda para volver directo al inicio sin pasar por el menú (no hace falta confirmar: la partida queda guardada igual y se puede retomar con "Continuar"). En la podrida el mismo botón está en la barra de abajo, a la izquierda del Menú.
- Debajo del número, etiqueta chica **"malas"** o **"buenas"** según la etapa del equipo (en 40: buenas desde 20; en 51: buenas desde 26).
- **Gestos, cada uno en su mitad de pantalla:**
  - Toque: **+1**
  - Deslizar hacia arriba: **+3**
  - Deslizar hacia abajo: **−1** (no bajar de 0)
  - Umbral de swipe ~30px de movimiento vertical para distinguirlo del tap; ignorar swipes horizontales.
  - Vibración corta (`navigator.vibrate(30)`) al anotar, si el dispositivo lo soporta.
  - Feedback visual: el número hace una animación breve al cambiar.
- No pasarse del objetivo: si el equipo está a 2 del final, un +3 lo deja clavado en el puntaje objetivo.
- **Al llegar al objetivo**: primero un festejo de 10s directo sobre la pizarra — del lado ganador un champán descorchando (🍾, emoji) con tandas repetidas de confeti (🎉✨), del lado perdedor una **mamadera dibujada en CSS** (no con el emoji 🍼) tirada de costado goteando gotitas blancas/crema en loop — se evitan los emojis 🍼/💧 a propósito porque en varios sistemas (Windows incluido) salen con tinte celeste en vez de blanco. Recién después se abre el overlay de ganador ("¡Ganó Nosotros!"), se suma un **fantasma** al equipo (chicos ganados, ícono de fantasma en vez de trofeo) y aparece el botón "Otro chico" que pone 0–0 manteniendo fantasmas y nombres. Duración configurable en un solo lugar: `DURACION_FESTEJO` en `js/truco.js`.
- Botón **deshacer** (flecha curva de tiza, discreta cerca del menú): revierte el último cambio de puntaje. Guardar un historial de acciones para poder deshacer varias veces.
- Botón **Menú** abajo al centro (como la referencia): reiniciar puntos, reiniciar todo (incluye trofeos), cambiar objetivo 40/51, mantener pantalla encendida, volver al inicio. Confirmar antes de reiniciar.

---

## Podrida

Juego individual, 2+ jugadores. Se reparten cartas (arranca en 1 y sube de a 1 por ronda), cada jugador **apuesta** cuántas manos va a ganar y al final de la ronda se anota cuántas ganó:

- **Cumplió la apuesta** (ganadas == apostadas): suma `10 + 5 × manos ganadas`.
- **No cumplió**: suma `1 × manos ganadas`.

La app calcula los puntos sola; nunca se anotan puntos a mano (pero ver "corregir" abajo).

### Configuración (al crear partida)

- Agregar jugadores: nombre + color (paleta de ~8 tizas de colores, sin repetir). Se pueden agregar, renombrar o quitar jugadores también con la partida empezada (si se quita uno, conservar su historial pero sacarlo de rondas futuras). **Al agregar uno a mitad de partida**, arranca empatado con quien va último en ese momento (no en 0), para no ponerlo en desventaja por las rondas que ya se jugaron sin él — se guarda como un "ajuste" de puntaje aparte (`estado.ajustes`), sin tocar el historial de rondas jugadas.
- **Orden de reparto editable**: la lista de jugadores en la config se muestra en vertical, numerada, con flechas ↑/↓ por fila para reordenarlos como estén sentados en la mesa — así el "pasar el mazo al de al lado" de la app coincide con la mesa real y nadie se tiene que mover de lugar. Ese orden es el que se usa tal cual para armar `estado.jugadores` y para la rotación del repartidor.
- **Jugadores guardados** (ahora "Personas", ver más abajo): la app recuerda nombres y colores usados antes. Al armar la partida se muestran como fichas para tocar y sumar directo, sin volver a escribir. Se pueden borrar de la lista con una cruz.
- **Repartidor (opcional, prendido por defecto, se puede apagar en la config y en el menú)**: se elige quién reparte primero y la app rota el repartidor automáticamente cada ronda. En pantalla se marca quién reparte (icono de mazo de tiza junto a su nombre) y quién apuesta último — que es a quien le aplica la regla de la suma de apuestas. Si está apagado, no se muestra nada de esto.
- **Cantidad máxima de cartas (por jugador)**: número editable. Las rondas van 1, 2, 3… hasta el máximo **y después bajan** …3, 2, 1. Al terminar la última ronda de 1, la partida termina y se muestra el podio. Se juega con mazo español de 52 cartas (incluye 8 y 9), sacando los 2 comodines y separando siempre 1 carta de muestra → quedan 49 repartibles — la app sugiere el máximo automáticamente como `49 ÷ cantidad de jugadores` (redondeado hacia abajo, pueden sobrar cartas sin repartir) a medida que se agregan jugadores en la configuración, pero el número sigue siendo editable a mano si en la mesa prefieren jugar con menos.
- El número de cartas de la ronda siempre es **editable a mano** por si en la mesa deciden otra cosa.

### Pantalla de juego

- Arriba: ronda actual y cartas que se reparten (ej. "Ronda 4 — 4 cartas", y en la bajada "Ronda 9 — 3 cartas").
- **Tabla de posiciones ordenada de mayor a menor puntaje**, cada jugador con su color (barra o borde de su color, nombre y puntaje total). Se reordena con animación al cerrar cada ronda.
- **Flujo de cada ronda, en dos pasos:**
  1. **Apuestas**: fila por jugador con stepper (− / número / +) para su apuesta. Regla dura: en cada mano gana una sola persona, así que la suma de apuestas **nunca** puede dar igual a las cartas repartidas — al último que apuesta (el repartidor, si esa opción está activa) directamente **no se le deja elegir** el número que completaría esa suma; el stepper salta ese valor y un aviso explica por qué. Toggle en el menú para desactivar esta restricción, por si juegan con otra variante.
  2. **Resultado**: al tocar "Terminar ronda", misma lista para cargar manos ganadas por jugador. Validación: la suma de manos ganadas debe ser igual a la cantidad de cartas de la ronda (avisar si no da, permitir igual por si juegan alguna variante).
  - Al confirmar, la app calcula, muestra qué sumó cada uno (ej. "+25" o "+2" con animación) y reordena la tabla.
- **Historial**: vista de rondas pasadas (apuesta, ganadas y puntos de cada jugador por ronda). Se puede **corregir** cualquier ronda pasada y los totales se recalculan solos.
- **Fin de partida**: podio con los 3 primeros y tabla completa. Botón revancha (mismos jugadores, puntajes a 0).
- Menú: editar jugadores, editar máximo de cartas, repartidor on/off, aviso de apuestas on/off, reiniciar, pantalla encendida, volver al inicio.

---

## Funciones comunes a los dos juegos

- **Candado anti-toques**: botón discreto (candado de tiza) en la pantalla de juego que bloquea toda anotación, para cuando el celular queda en la mesa o pasa de mano. Tocarlo de nuevo (con toque largo o doble toque, para que no se destrabe solo) desbloquea.
- **Historial de partidas terminadas** (compartido por grupo en Firestore, ver sección "Registro compartido por grupo"): cada partida que termina se guarda con fecha y hora exactas, jugadores/equipos y resultado. Pantalla "Historial" accesible desde el inicio con:
  - Lista de partidas pasadas de cada juego.
  - **Estadísticas de truco**: chicos ganados por equipo/nombres, últimas partidas.
  - **Estadísticas de podrida**: partidas ganadas por jugador, puntaje promedio y **% de apuestas cumplidas** de cada uno (histórico, para el ranking del grupo).
  - **No hay forma de borrar ni corregir el historial** desde la app — ver nota de inmutabilidad en la sección "Registro compartido por grupo".
- **Compartir resultado como imagen**: al terminar una partida (y desde el historial), botón "Compartir" que dibuja el resultado en un `<canvas>` con la estética de pizarrón (podio o marcador final, fecha, trofeos) y lo comparte con la Web Share API (`navigator.share` con archivo) — cae en WhatsApp directo. Fallback: descargar la imagen si el navegador no soporta compartir archivos.

---

## Detalles de implementación

- Estado en un objeto por juego serializado a `localStorage` en cada mutación (`anotador.truco`, `anotador.podrida`).
- Gestos con Pointer Events (`pointerdown`/`pointerup`, medir delta Y y tiempo). Evitar zoom/scroll accidental: `touch-action: none` en las zonas de anotar, `user-select: none`, meta viewport sin zoom.
- Nada de librerías externas en runtime; todo local para que funcione offline.
- Probar con Playwright (está configurado como MCP) simulando viewport de celular: flujo completo de un chico de truco y una partida corta de podrida con 3 jugadores, incluyendo deshacer y corregir ronda.

## Criterios de listo

1. Truco: anotar con los 3 gestos en ambos lados, etapas malas/buenas correctas en 40 y 51, fantasmas y revancha funcionando, deshacer funcionando.
2. Podrida: partida de 3+ jugadores, rondas suben y bajan, cálculo automático correcto (cumplió / no cumplió), tabla ordenada de mayor a menor con fantasmas de color, historial con corrección. La suma de apuestas nunca puede quedar igual a las cartas repartidas (se impide, no solo se avisa).
3. Personas: roster compartido entre truco y podrida; agregar gente a un equipo de truco o a la podrida la deja disponible como sugerencia rápida en el otro juego. La pantalla "Personas" muestra stats combinadas correctas (jugados/ganados de truco, jugadas/ganadas/% acierto/promedio de podrida).
4. Candado anti-toques bloquea la anotación en ambos juegos.
5. Al terminar partidas quedan en el historial con estadísticas correctas, y el botón compartir genera la imagen del resultado.
6. Cerrar y reabrir el navegador conserva la partida de ambos juegos, las personas guardadas y el historial.
7. Instalable como PWA y usable offline. Todas las pantallas con scroll mantienen las esquinas de la pizarra redondeadas y prolijas, sin que la scrollbar las corte.
