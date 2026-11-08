/** Variantes visuales de las piezas (misma silueta 16x16, distinta paleta/formato). Se usan en la tabla `pieces.html`. */
import type { Color, PieceSymbol } from 'chess.js';
import { BARE_INK, expand, paintPiece32, type Style } from './sprites';
import { SIZE32 } from './sprites32';

export interface PieceStylePreset {
  id: string;
  name: string;
  description: string;
  /** Tamaño nativo del dibujo, en píxeles. */
  native: string;
  kind: 'card' | 'bare' | 'glyph';
  /** Resolución del dibujo (por defecto 16). */
  art?: 16 | 32;
  w?: Style;
  b?: Style;
}

const ink = (o: string, f: string, h: string, s: string) => ({ o, f, h, s });

const CLASICO: [Style, Style] = [
  { ink: ink('#0d0817', '#2f6fe0', '#8fb8ff', '#1a3f94'), face: '#fff4d6', ring: '#ffd24a', border: '#0d0817' },
  { ink: ink('#3b1d05', '#ffd24a', '#fff0a0', '#b8861b'), face: '#1a1028', ring: '#e63946', border: '#fff4d6' },
];
const PALOS: [Style, Style] = [
  { ink: ink('#2a0a10', '#d62839', '#ff8a94', '#8f1d2c'), face: '#fff4d6', ring: '#d62839', border: '#0d0817' },
  { ink: ink('#000000', '#fff4d6', '#ffffff', '#b9a98a'), face: '#17102b', ring: '#fff4d6', border: '#fff4d6' },
];
const DORADO: [Style, Style] = [
  { ink: ink('#1c0b3a', '#6b3fa0', '#b48be0', '#3d1f6e'), face: '#ffd24a', ring: '#fff4d6', border: '#0d0817' },
  { ink: ink('#2a1a00', '#ffd24a', '#fff0a0', '#b8861b'), face: '#3b1d6e', ring: '#ffd24a', border: '#ffd24a' },
];

const NEW_32: PieceStylePreset[] = [
  {
    id: 'n-clasico', art: 32, kind: 'card', native: '40×44 (pieza 32×32)',
    name: '1 · Carta clásica 32×32',
    description: 'Siluetas nuevas y más detalladas, con la paleta crema/azul y oscuro/dorado de siempre.',
    w: CLASICO[0], b: CLASICO[1],
  },
  {
    id: 'n-palos', art: 32, kind: 'card', native: '40×44 (pieza 32×32)',
    name: '2 · Palos rojo y negro 32×32',
    description: 'Blancas en rojo sobre crema, negras en crema sobre carta oscura. Aire de naipe.',
    w: PALOS[0], b: PALOS[1],
  },
  {
    id: 'n-dorado', art: 32, kind: 'card', native: '40×44 (pieza 32×32)',
    name: '3 · Dorado y violeta 32×32',
    description: 'Cartas doradas con pieza violeta contra cartas violetas con pieza dorada.',
    w: DORADO[0], b: DORADO[1],
  },
  {
    id: 'n-sola', art: 32, kind: 'bare', native: '32×32',
    name: '4 · Pieza sola 32×32',
    description: 'Solo la silueta con contorno, sin carta: crema contra violeta oscuro. La más limpia y grande.',
    w: { ink: BARE_INK.w, face: '', ring: '', border: '' }, b: { ink: BARE_INK.b, face: '', ring: '', border: '' },
  },
];

export const PRESETS: PieceStylePreset[] = [
  ...NEW_32,
  {
    id: 'clasico',
    name: 'A · Carta clásica 16×16 (anterior)',
    description: 'Carta crema con pieza azul contra carta oscura con pieza dorada. La que usaba el juego antes.',
    native: '20×22 (pieza 16×16)',
    kind: 'card',
    w: { ink: ink('#0d0817', '#2f6fe0', '#8fb8ff', '#1a3f94'), face: '#fff4d6', ring: '#ffd24a', border: '#0d0817' },
    b: { ink: ink('#3b1d05', '#ffd24a', '#fff0a0', '#b8861b'), face: '#1a1028', ring: '#e63946', border: '#fff4d6' },
  },
  {
    id: 'palos',
    name: 'B · Palos rojo y negro 16×16',
    description: 'Más cerca de un naipe: blancas en rojo sobre crema, negras en crema sobre carta oscura.',
    native: '20×22 (pieza 16×16)',
    kind: 'card',
    w: { ink: ink('#2a0a10', '#d62839', '#ff8a94', '#8f1d2c'), face: '#fff4d6', ring: '#d62839', border: '#0d0817' },
    b: { ink: ink('#000000', '#fff4d6', '#ffffff', '#b9a98a'), face: '#17102b', ring: '#fff4d6', border: '#fff4d6' },
  },
  {
    id: 'dorado',
    name: 'C · Dorado y violeta 16×16',
    description: 'Cartas doradas con pieza violeta contra cartas violetas con pieza dorada. Muy "joker".',
    native: '20×22 (pieza 16×16)',
    kind: 'card',
    w: { ink: ink('#1c0b3a', '#6b3fa0', '#b48be0', '#3d1f6e'), face: '#ffd24a', ring: '#fff4d6', border: '#0d0817' },
    b: { ink: ink('#2a1a00', '#ffd24a', '#fff0a0', '#b8861b'), face: '#3b1d6e', ring: '#ffd24a', border: '#ffd24a' },
  },
  {
    id: 'fosforo',
    name: 'D · Fósforo verde 16×16',
    description: 'Monocromo estilo terminal CRT: verde brillante sobre oscuro y verde oscuro sobre claro.',
    native: '20×22 (pieza 16×16)',
    kind: 'card',
    w: { ink: ink('#02140a', '#39ff88', '#b6ffd3', '#1c9c52'), face: '#0b2a14', ring: '#39ff88', border: '#39ff88' },
    b: { ink: ink('#02140a', '#0b3d1c', '#146b32', '#052410'), face: '#8affb8', ring: '#0b3d1c', border: '#02140a' },
  },
  {
    id: 'sinCarta',
    name: 'E · Pieza sola 16×16',
    description: 'Solo la silueta con contorno grueso, sin fondo de carta. Más limpio y más grande dentro de la casilla.',
    native: '16×16',
    kind: 'bare',
    w: { ink: ink('#0d0817', '#fff4d6', '#ffffff', '#c9b58a'), face: '', ring: '', border: '' },
    b: { ink: ink('#fff4d6', '#2b1b4d', '#5a3f94', '#140a29'), face: '', ring: '', border: '' },
  },
  {
    id: 'glifo',
    name: 'F · Glifos de texto',
    description: 'Símbolos de ajedrez Unicode con contorno. La más simple, pero no es pixel art y cambia según el sistema.',
    native: 'vectorial',
    kind: 'glyph',
  },
];

const GLYPH: Record<PieceSymbol, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

/** Dibuja una pieza con el estilo pedido; el canvas devuelto es de tamaño nativo (se escala por CSS). */
export function renderPiece(type: PieceSymbol, color: Color, preset: PieceStylePreset): HTMLCanvasElement {
  const c = document.createElement('canvas');

  if (preset.kind === 'glyph') {
    c.width = 48;
    c.height = 48;
    const g = c.getContext('2d')!;
    g.font = '40px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.strokeStyle = '#0d0817';
    g.fillStyle = color === 'w' ? '#fff4d6' : '#1a1028';
    g.strokeText(GLYPH[type], 24, 26);
    g.fillText(GLYPH[type], 24, 26);
    return c;
  }

  const st = (color === 'w' ? preset.w : preset.b)!;

  if (preset.art === 32) {
    if (preset.kind === 'bare') {
      c.width = SIZE32;
      c.height = SIZE32;
      paintPiece32(c.getContext('2d')!, type, st.ink);
      return c;
    }
    c.width = 40;
    c.height = 44;
    const g32 = c.getContext('2d')!;
    for (let y = 0; y < 44; y++) {
      for (let x = 0; x < 40; x++) {
        if ((x === 0 || x === 39) && (y === 0 || y === 43)) continue;
        const edge = x === 0 || y === 0 || x === 39 || y === 43;
        const ring = x === 1 || y === 1 || x === 38 || y === 42;
        g32.fillStyle = edge ? st.border : ring ? st.ring : st.face;
        g32.fillRect(x, y, 1, 1);
      }
    }
    paintPiece32(g32, type, st.ink, 4, 7);
    return c;
  }

  const rows = expand(type);
  const px = (g: CanvasRenderingContext2D, x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };

  if (preset.kind === 'bare') {
    c.width = 16;
    c.height = 16;
    const g = c.getContext('2d')!;
    // contorno grueso de 1 px alrededor de la silueta
    const filled = (x: number, y: number) => rows[y]?.[x] !== undefined && rows[y]![x] !== '.';
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)))
          px(g, x, y, st.ink.o!);
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const col = ch === 'o' ? st.ink.o : st.ink[ch];
        if (ch !== '.' && col) px(g, x, y, col);
      }),
    );
    return c;
  }

  // tarjeta 16×16 anterior: 20×22
  const CW = 20, CH = 22;
  c.width = CW;
  c.height = CH;
  const g = c.getContext('2d')!;
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      if ((x === 0 || x === CW - 1) && (y === 0 || y === CH - 1)) continue;
      const edge = x === 0 || y === 0 || x === CW - 1 || y === CH - 1;
      const ring = x === 1 || y === 1 || x === CW - 2 || y === CH - 2;
      px(g, x, y, edge ? st.border : ring ? st.ring : st.face);
    }
  }
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = st.ink[ch];
      if (col) px(g, x + 2, y + 3, col);
    }),
  );
  return c;
}
