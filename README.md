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
- [ ] c: estética y juice · d: multijugador · e: Aprender y Coach · f: pulido y deploy

## Licencias
Stockfish (WASM lite, `client/public/stockfish/`) es GPL-3.0; ver `LICENSE-GPL3.txt` en esa carpeta.
Fuente: Pixelify Sans (OFL).
