import type { Color, PieceSymbol } from 'chess.js';

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

function expand(type: PieceSymbol): string[] {
  if (type === 'n') return KNIGHT;
  const half = HALF[type]!;
  return half.map((r) => r + [...r].reverse().map((c) => SWAP[c] ?? c).join(''));
}

interface Style {
  ink: Record<string, string>;
  face: string;
  ring: string;
  border: string;
}
const STYLES: Record<Color, Style> = {
  w: { ink: { o: '#0d0817', f: '#2f6fe0', h: '#8fb8ff', s: '#1a3f94' }, face: '#fff4d6', ring: '#ffd24a', border: '#0d0817' },
  b: { ink: { o: '#3b1d05', f: '#ffd24a', h: '#fff0a0', s: '#b8861b' }, face: '#1a1028', ring: '#e63946', border: '#fff4d6' },
};

export const CARD_W = 20;
export const CARD_H = 22;

const atlas = new Map<string, HTMLCanvasElement>();

/** Carta 20x22 con la pieza 16x16 adentro. Se cachea. */
export function getCard(type: PieceSymbol, color: Color): HTMLCanvasElement {
  const key = color + type;
  const hit = atlas.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  const st = STYLES[color];
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const inCorner = (x: number, y: number) =>
    (x === 0 || x === CARD_W - 1) && (y === 0 || y === CARD_H - 1);
  for (let y = 0; y < CARD_H; y++) {
    for (let x = 0; x < CARD_W; x++) {
      if (inCorner(x, y)) continue;
      const edge = x === 0 || y === 0 || x === CARD_W - 1 || y === CARD_H - 1;
      const ring = x === 1 || y === 1 || x === CARD_W - 2 || y === CARD_H - 2;
      px(x, y, edge ? st.border : ring ? st.ring : st.face);
    }
  }
  const rows = expand(type);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = st.ink[ch];
      if (col) px(x + 2, y + 3, col);
    });
  });
  atlas.set(key, c);
  return c;
}
