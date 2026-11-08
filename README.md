# Ajedrez Pixel

Juego de ajedrez web para aprender, con estética pixel art. (En construcción por etapas.)

## Requisitos
- Node.js 20+ (`brew install node` en macOS)

## Instalación y ejecución local
```bash
npm install
npm run dev
```
Abrí http://localhost:5173. Vite también muestra una URL de red (`Network: http://192.168.x.x:5173`)
para abrirlo desde otro dispositivo en tu misma Wi-Fi.

## Estado
- [x] Etapa a: tablero, reglas (chess.js) y juego local
- [x] Etapa b: IA con Stockfish (6 niveles, pistas, flecha, deshacer)
- [x] Etapa c: estética pixel art, sprites de cartas, juice, shader de fondo, CRT, audio chiptune/lo-fi, transiciones y opciones
- [ ] estética y juice · d: multijugador · e: Aprender y Coach · f: pulido y deploy

## Estética y opciones
Menú → Opciones: efecto CRT (scanlines, viñeta, bordes redondeados), fondo animado (shader WebGL), sacudida de pantalla,
efectos de sonido y música. El botón ♪ (arriba a la derecha) silencia todo. Los ajustes se guardan en localStorage.
Todo el audio se sintetiza con WebAudio y los sprites 16x16 están definidos en código (`client/src/render/sprites.ts`).

## Licencias
Stockfish (WASM lite, `client/public/stockfish/`) es GPL-3.0; ver `LICENSE-GPL3.txt` en esa carpeta.
Fuente: Pixelify Sans (OFL).
