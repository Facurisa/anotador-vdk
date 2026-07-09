# Anotador VDK — Plan de la app

App para anotar puntajes de **Truco** y **Podrida**, pensada para usar en el celular durante la partida. Se llama **"Anotador VDK"** (grupo de amigos) y usa como logo el fantasma del escudo VDK (`Desktop\boludeces\VDK\logo- escudo\VDK\vectores\Escudo VDK.pdf`), reutilizado en toda la app: es el logo de inicio, reemplaza los trofeos del truco y los círculos de color de la podrida. El trazo del fantasma en `js/ui.js` (`svgFantasma()`) **no es un dibujo aproximado**: se extrajo el path vectorial exacto del PDF original con `pdfjs-dist` (`getOperatorList()`), separando cuerpo y los dos ojos, para que sea una réplica fiel del logo real. Dentro de la app (tiza sobre pizarra) el fantasma va en blanco solo contorno, sin relleno. Los **íconos de instalación** (`iconos/`) usan, en cambio, un estilo de logo/marca: fondo sólido bordó `#431321` (el mismo color exacto que los ojos del escudo VDK original, verificado con cuentagotas sobre `Escudo VDK.png`), fantasma relleno de blanco con contorno negro y ojos huecos del mismo bordó de fondo. `theme_color` de la PWA también es ese bordó. Facundo no es programador: mantener todo simple, sin herramientas de build, y explicarle los pasos en lenguaje llano.

## Plataforma y tecnología

- **App web (PWA)** en vanilla HTML + CSS + JavaScript. Sin frameworks, sin npm, sin build.
- Archivos: `index.html`, `css/estilos.css`, `js/app.js`, `js/truco.js`, `js/podrida.js`, `js/personas.js`, `js/selector-personas.js`, `js/historial.js`, `js/ui.js`, `js/storage.js`, `manifest.json`, `sw.js` (service worker para que funcione offline), íconos en `iconos/`.
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

## Personas (roster compartido)

- `anotador.personas` en localStorage: lista compartida de gente guardada (`{id, nombre, color}`), usada tanto por el truco como por la podrida — una persona agregada en un juego aparece como sugerencia rápida en el otro.
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
- **Al llegar al objetivo**: overlay de ganador ("¡Ganaron Nosotros!"), se suma un **fantasma** al equipo (chicos ganados, ícono de fantasma en vez de trofeo) y botón "Otro chico" que pone 0–0 manteniendo fantasmas y nombres.
- Botón **deshacer** (flecha curva de tiza, discreta cerca del menú): revierte el último cambio de puntaje. Guardar un historial de acciones para poder deshacer varias veces.
- Botón **Menú** abajo al centro (como la referencia): reiniciar puntos, reiniciar todo (incluye trofeos), cambiar objetivo 40/51, mantener pantalla encendida, volver al inicio. Confirmar antes de reiniciar.

---

## Podrida

Juego individual, 2+ jugadores. Se reparten cartas (arranca en 1 y sube de a 1 por ronda), cada jugador **apuesta** cuántas manos va a ganar y al final de la ronda se anota cuántas ganó:

- **Cumplió la apuesta** (ganadas == apostadas): suma `10 + 5 × manos ganadas`.
- **No cumplió**: suma `1 × manos ganadas`.

La app calcula los puntos sola; nunca se anotan puntos a mano (pero ver "corregir" abajo).

### Configuración (al crear partida)

- Agregar jugadores: nombre + color (paleta de ~8 tizas de colores, sin repetir). Se pueden agregar, renombrar o quitar jugadores también con la partida empezada (si se quita uno, conservar su historial pero sacarlo de rondas futuras).
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
- **Historial de partidas terminadas** (`anotador.historial` en localStorage): cada partida que termina se guarda con fecha, jugadores/equipos y resultado. Pantalla "Historial" accesible desde el inicio con:
  - Lista de partidas pasadas de cada juego.
  - **Estadísticas de truco**: chicos ganados por equipo/nombres, últimas partidas.
  - **Estadísticas de podrida**: partidas ganadas por jugador, puntaje promedio y **% de apuestas cumplidas** de cada uno (histórico, para el ranking del grupo).
  - Botón para borrar historial (con confirmación).
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
