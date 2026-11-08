# Ajedrez Pixel

Juego de ajedrez web para aprender, con estética pixel art de "cartas" y multijugador online.

- **Local**: dos jugadores en el mismo dispositivo.
- **Practicar vs IA**: Stockfish (WASM) en 6 niveles, con pistas, flecha de mejor jugada y deshacer.
- **Multijugador online**: salas por código de 4 letras, reloj opcional, tablas, rendirse, revancha y chat con emotes.
- **Aprender**: 9 lecciones interactivas con ejercicios y feedback inmediato, progreso guardado en localStorage.
- **Coach** (en partidas vs IA): explica en lenguaje simple por qué tu jugada fue buena o mala y marca errores graves.

## Requisitos
- Node.js 20 o superior (`brew install node` en macOS).

## Instalación y ejecución local
```bash
npm install
npm run dev
```
`npm run dev` levanta el cliente (Vite, http://localhost:5173) y el servidor de salas (puerto 8787) a la vez.
Vite reenvía `/ws` al servidor, así que el cliente siempre usa el mismo origen.

Otros comandos: `npm test` (tests del servidor), `npm run typecheck`, `npm run build` y `npm start`
(sirve el cliente compilado + WebSocket desde un solo proceso en `PORT`, por defecto 8787).

## Jugar en red local (con tu novia, por Wi-Fi)
1. En tu computadora: `npm run dev`. La consola muestra algo como `Network: http://192.168.0.107:5173/`.
2. **Abrí esa URL de red en tu navegador** (no `localhost`), porque el link de invitación se arma con la dirección con la que entraste.
3. Multijugador → elegí reloj y color → **Crear sala**. Aparece el código (p. ej. `EGKD`) y un link.
4. En el celular de ella (misma Wi-Fi), abrí el link, o escribí la URL de red y usá **Unirse con código**.
5. Si macOS pregunta si permitís conexiones entrantes para Node, aceptá.

Si la conexión se corta (cambio de pestaña, bloqueo del celular), el cliente reintenta solo y recupera la partida.
Si cerrás la pestaña, entrá a Multijugador → **Volver a la sala**. Quien no vuelve en 60 s pierde por abandono.

## Cómo funciona el multijugador
- El **servidor es la fuente de verdad**: valida cada jugada con chess.js (turno, legalidad, jugada desfasada), maneja el reloj y la
  reconexión. Tras cada cambio manda el estado completo a ambos jugadores (`RoomSnapshot` en `shared/src/protocol.ts`).
- Cada jugador tiene un **token secreto** guardado en su navegador; con él recupera su asiento al reconectar.
- El cliente mueve de forma optimista; si el servidor rechaza o difiere, el cliente se reconcilia con el estado del servidor.
- El reloj arranca cuando entran los dos jugadores. Las salas viven **en memoria** (se pierden si el servidor se reinicia) y se
  borran solas tras 10 min vacías.
- Límites: mensajes de 2 KB, chat de 120 caracteres y 5 mensajes cada 5 s.

## Modo Aprender y Coach
Las lecciones, en orden: tablero y coordenadas, cómo se mueve cada pieza, captura, jaque/mate/tablas, reglas especiales,
valor de las piezas, aperturas básicas, táctica (clavada, horquilla, descubierta, mate del pastor y su defensa) y finales
(rey+dama, rey+torre, oposición y rey+peón). Cada lección empieza con una explicación corta y sigue con ejercicios donde movés
las piezas; los finales se juegan contra Stockfish. Cada lección se desbloquea al completar la anterior
(Opciones → "Desbloquear todas las lecciones" lo evita).

- Los datos viven en `client/src/learn/lessons/es.ts`. Para agregar un idioma: crear `lessons/en.ts` con la misma forma y
  registrarlo en `lessons/index.ts`; los textos de la interfaz están en `core/i18n.ts`.
- **Coach**: después de cada jugada tuya compara la evaluación de Stockfish (a máxima fuerza) antes y después. Según los
  centipeones perdidos la clasifica (mejor, muy buena, buena, imprecisión, error, error grave) y explica el motivo (te
  capturan una pieza, te dan mate, te perdiste un mate o una captura). En errores y errores graves aparece
  "Deshacer y reintentar", que además marca con una flecha la jugada recomendada. Se apaga con el botón Coach.

## Tests
```bash
npm test
```
Corre los tests del servidor y del cliente. Los del cliente validan que **todas** las lecciones sean correctas (FEN legales,
jugadas legales en cada rama, objetivos alcanzables) y la lógica del Coach.
Cubren la lógica de salas (colores, jugadas legales/ilegales, mate, promoción, reloj, tablas, rendición, revancha, chat, abandono),
el gestor de salas (códigos únicos, limpieza) y la sincronización real por WebSocket (dos clientes, reconexión, mensajes inválidos).

## Desplegar online (gratis)
Todo corre en **un solo servicio Node** que sirve el cliente compilado y el WebSocket en el mismo puerto (usa `Dockerfile`).
Importante: el servidor guarda las salas en memoria, así que necesita **una sola instancia** siempre encendida.

### Render (lo más simple)
1. Subí el proyecto a un repositorio de GitHub.
2. En render.com: **New + → Blueprint** y elegí el repositorio (usa `render.yaml`), o **New + → Web Service** con runtime *Docker*.
3. Cuando termine, tu juego queda en `https://ajedrez-pixel.onrender.com`. En el plan gratis el servicio se duerme tras 15 min sin tráfico
   (la primera visita tarda ~30 s) y se pierden las salas al dormirse.

### Fly.io
```bash
fly launch --no-deploy --copy-config   # cambiá `app` en fly.toml por un nombre único
fly deploy
```
`fly.toml` mantiene 1 máquina siempre encendida y usa `/healthz` como chequeo. Fly pide una tarjeta aunque el uso sea mínimo.

### Railway
**New Project → Deploy from GitHub repo**; detecta el `Dockerfile`. Definí la variable `PORT` solo si Railway no la inyecta.

> El Dockerfile y los archivos de despliegue no pudieron probarse en este entorno (sin Docker instalado). El build de producción
> (`npm run build && npm start`) sí se verificó en local.

## Estado del proyecto
- [x] a: tablero, reglas (chess.js) y juego local
- [x] b: IA con Stockfish (6 niveles, pistas, flecha, deshacer)
- [x] c: estética pixel art, sprites de cartas, juice, shader de fondo, CRT, audio y opción de tablero 3D
- [x] d: servidor multijugador (salas, reloj, tablas, revancha, chat, reconexión, tests, despliegue)
- [x] e: modo Aprender (9 lecciones) y Coach con Stockfish
- [ ] f: pulido final

## Estética y opciones
Menú → Opciones: efecto CRT, fondo animado (shader WebGL), sacudida de pantalla, efectos de sonido, música, casillas legales y
tablero en perspectiva 3D. El botón ♪ silencia todo. Los ajustes se guardan en localStorage.
Todo el audio se sintetiza con WebAudio y los sprites 16x16 están definidos en código (`client/src/render/sprites.ts`).

## Licencias
Stockfish (WASM lite, `client/public/stockfish/`) es GPL-3.0; ver `LICENSE-GPL3.txt` en esa carpeta. Fuente: Pixelify Sans (OFL).
