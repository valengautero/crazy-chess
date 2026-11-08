import type { Color, PieceSymbol } from 'chess.js';
import { build32, SIZE32 } from './sprites32';

/**
 * Sprites 16x16 dibujados a mano. Las piezas simétricas se escriben solo con la mitad izquierda (8 columnas)
 * y se espejan (la luz queda a la izquierda: h↔s al espejar).
 *   o = contorno, f = relleno, h = luz, s = sombra, . = transparente
 */
const HALF: Partial<Record<PieceSymbol, string[]>> = {
  p: [
    '........', '........', '......oo', '.....ohf', '....ohff', '.....ohf', '......of', '.....ohf',
    '....ohff', '....ohff', '.....ohf', '.....ohf', '....ohff', '...ohfff', '...ooooo', '........',
  ],
  r: [
    '........', '..ooo.oo', '..oho.oh', '..ohoooo', '...ohfff', '....ohff', '....ohff', '....ohff',
    '....ohff', '...ohfff', '..ohffff', '..ohffff', '..oooooo', '........', '........', '........',
  ],
  b: [
    '........', '.......o', '......oh', '.....ohf', '....ohff', '....ohfo', '....ohff', '....ohff',
    '.....ohf', '......of', '.....ohf', '....ohff', '...ohfff', '...ooooo', '........', '........',
  ],
  q: [
    '........', '..o..o.o', '..oh.ohf', '..ohffff', '..ohffff', '...ohfff', '....ohff', '.....ohf',
    '.....ohf', '....ohff', '....ohff', '...ohfff', '..ohffff', '..oooooo', '........', '........',
  ],
  k: [
    '......oo', '....oooh', '....oooh', '......oo', '...ohfff', '..ohffff', '..ohffff', '...ohfff',
    '....ohff', '.....ohf', '.....ohf', '....ohff', '...ohfff', '..oooooo', '........', '........',
  ],
};

/** El caballo no es simétrico: 16 columnas completas. */
const KNIGHT = [
  '................',
  '......oo........',
  '.....ohfo.......',
  '....ohhffo......',
  '...ohhhfffoo....',
  '..ohhoohffffo...',
  '..ohhhhhfffffo..',
  '.ooohhhhffffffo.',
  '.oooohhfffffffso',
  '...ohhffffffffso',
  '....ohffffffffso',
  '....ohfffffffsso',
  '.....ohffffffsso',
  '....ohffffffffso',
  '...ooooooooooooo',
  '................',
];

const SWAP: Record<string, string> = { h: 's', s: 'h' };

export function expand(type: PieceSymbol): string[] {
  if (type === 'n') return KNIGHT;
  const half = HALF[type]!;
  return half.map((r) => r + [...r].reverse().map((c) => SWAP[c] ?? c).join(''));
}

export interface Style {
  ink: Record<string, string>;
  face: string;
  ring: string;
  border: string;
}
const STYLES: Record<Color, Style> = {
  w: { ink: { o: '#0d0817', f: '#2f6fe0', h: '#8fb8ff', s: '#1a3f94' }, face: '#fff4d6', ring: '#ffd24a', border: '#0d0817' },
  b: { ink: { o: '#3b1d05', f: '#ffd24a', h: '#fff0a0', s: '#b8861b' }, face: '#1a1028', ring: '#e63946', border: '#fff4d6' },
};

/** Carta que contiene la pieza de 32×32 (con 2 px de margen dentro del aro). */
export const CARD_W = 40;
export const CARD_H = 44;

const atlas = new Map<string, HTMLCanvasElement>();

/** Pinta una pieza 32×32 en `g` desplazada (ox, oy) usando la paleta `ink`. */
export function paintPiece32(g: CanvasRenderingContext2D, type: PieceSymbol, ink: Record<string, string>, ox = 0, oy = 0): void {
  build32(type).forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = ink[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x + ox, y + oy, 1, 1);
    }),
  );
}

/** Carta 40×44 con la pieza 32×32 adentro. Se cachea. */
export function getCard(type: PieceSymbol, color: Color): HTMLCanvasElement {
  const key = color + type;
  const hit = atlas.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  const st = STYLES[color];
  for (let y = 0; y < CARD_H; y++) {
    for (let x = 0; x < CARD_W; x++) {
      if ((x === 0 || x === CARD_W - 1) && (y === 0 || y === CARD_H - 1)) continue; // esquinas cortadas
      const edge = x === 0 || y === 0 || x === CARD_W - 1 || y === CARD_H - 1;
      const ring = x === 1 || y === 1 || x === CARD_W - 2 || y === CARD_H - 2;
      g.fillStyle = edge ? st.border : ring ? st.ring : st.face;
      g.fillRect(x, y, 1, 1);
    }
  }
  paintPiece32(g, type, st.ink, (CARD_W - SIZE32) / 2, (CARD_H - SIZE32) / 2 + 1);
  atlas.set(key, c);
  return c;
}

const bareAtlas = new Map<string, HTMLCanvasElement>();

/** Pieza sola (sin carta): la silueta 32×32 con su contorno, en colores propios para ser legible sobre el tablero. */
export function getBare(type: PieceSymbol, color: Color): HTMLCanvasElement {
  const key = color + type;
  const hit = bareAtlas.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = SIZE32;
  c.height = SIZE32;
  paintPiece32(c.getContext('2d')!, type, BARE_INK[color]);
  bareAtlas.set(key, c);
  return c;
}

export const BARE_INK: Record<Color, Record<string, string>> = {
  w: { o: '#0d0817', f: '#fff4d6', h: '#ffffff', s: '#c9b58a' },
  b: { o: '#fff4d6', f: '#2b1b4d', h: '#5a3f94', s: '#140a29' },
};
