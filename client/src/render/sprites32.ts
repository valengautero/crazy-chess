import type { PieceSymbol } from 'chess.js';

/**
 * Piezas 32×32 dibujadas "a mano" con perfiles de ancho por fila (simétricas) y un polígono para el caballo.
 * El resultado es una grilla de caracteres: o = contorno, f = relleno, h = luz (izquierda), s = sombra (derecha), . = vacío.
 */
export const SIZE32 = 32;

type Rect = [x0: number, x1: number, y0: number, y1: number]; // inclusivo

interface Spec {
  /** Semiancho (en píxeles) de cada fila, centrado entre las columnas 15 y 16. */
  n?: number[];
  /** Polígono (vértices en la grilla 32×32), para siluetas asimétricas. */
  poly?: [number, number][];
  extras?: Rect[];
  cuts?: Rect[];
  /** Filas que se dibujan enteras con el color de contorno (separan cabeza/cuello/base). */
  lines?: number[];
  /** Píxeles sueltos de detalle en color de contorno. */
  marks?: [number, number][];
}

const z = (len: number) => Array<number>(len).fill(0);
const rows = (...parts: [count: number, n: number][]): number[] => parts.flatMap(([c, n]) => Array<number>(c).fill(n));

const SPECS: Record<PieceSymbol, Spec> = {
  // Peón: cabeza redonda, cuello fino, cuerpo que se ensancha y base.
  p: {
    n: [...z(4), 2, 4, 5, 5, 6, 6, 6, 5, 5, 4, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 11, 11, 12, 12, 0],
    lines: [14, 26],
  },
  // Torre: almenas arriba, torre recta, base ancha.
  r: {
    n: [...z(3), ...rows([6, 9], [12, 7], [2, 8], [2, 9], [2, 10], [2, 11], [2, 12]), 0],
    cuts: [[11, 13, 3, 5], [18, 20, 3, 5]],
    lines: [8, 27],
    marks: [[15, 15], [16, 15], [15, 16], [16, 16]],
  },
  // Alfil: bola, mitra con tajo diagonal, collar y base.
  b: {
    n: [0, 1, 2, 2, 2, 3, 4, 5, 6, 6, 7, 7, 7, 7, 6, 5, 4, 4, 6, 6, 5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 12, 0],
    lines: [17, 27],
    marks: [[19, 7], [18, 8], [17, 9], [16, 10], [15, 11], [14, 12]],
  },
  // Dama: corona de cinco puntas, cintura y falda.
  q: {
    n: [...z(3), ...rows([10, 10]), 6, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11, 11, 12, 12, 0],
    extras: [[14, 17, 1, 2]],
    cuts: [[8, 9, 3, 8], [12, 13, 3, 8], [18, 19, 3, 8], [22, 23, 3, 8]],
    lines: [12, 26],
    marks: [[15, 9], [16, 9]],
  },
  // Rey: cruz arriba, corona maciza.
  k: {
    n: [0, 2, 2, 5, 5, 5, 2, 2, 2, 5, 7, 8, 9, 9, 9, 8, 6, 5, 5, 5, 6, 6, 7, 7, 8, 9, 10, 11, 11, 12, 12, 0],
    lines: [15, 26],
  },
  // Caballo: cabeza y cuello de perfil mirando a la izquierda, sobre una base.
  n: {
    n: [...z(27), 10, 10, 11, 11, 0],
    poly: [[8, 27], [10, 22], [13, 19], [10, 19], [6, 20], [3, 18], [3, 15], [5, 12], [8, 8], [10, 4], [12, 2], [14, 6], [18, 5], [22, 8], [25, 14], [26, 21], [25, 27]],
    marks: [[8, 11], [9, 11], [4, 16], [16, 9], [17, 10], [18, 11], [19, 12], [20, 14], [21, 16], [22, 18], [14, 8], [15, 9]],
  },
};

function fillPolygon(m: boolean[][], poly: [number, number][]): void {
  for (let y = 0; y < SIZE32; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i]!;
      const [x2, y2] = poly[(i + 1) % poly.length]!;
      if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = 0; x < SIZE32; x++) if (x + 0.5 >= xs[i]! && x + 0.5 <= xs[i + 1]!) m[y]![x] = true;
  }
}

function buildMask(spec: Spec): boolean[][] {
  const m = Array.from({ length: SIZE32 }, () => Array<boolean>(SIZE32).fill(false));
  spec.n?.forEach((n, y) => {
    for (let x = 16 - n; x <= 15 + n; x++) if (n > 0) m[y]![x] = true;
  });
  if (spec.poly) fillPolygon(m, spec.poly);
  for (const [x0, x1, y0, y1] of spec.extras ?? [])
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y]![x] = true;
  for (const [x0, x1, y0, y1] of spec.cuts ?? [])
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y]![x] = false;
  return m;
}

const cache = new Map<PieceSymbol, string[]>();

export function build32(type: PieceSymbol): string[] {
  const hit = cache.get(type);
  if (hit) return hit;
  const spec = SPECS[type];
  const m = buildMask(spec);
  const at = (x: number, y: number) => !!m[y]?.[x];
  const grid = Array.from({ length: SIZE32 }, () => Array<string>(SIZE32).fill('.'));

  for (let y = 0; y < SIZE32; y++) {
    for (let x = 0; x < SIZE32; x++) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      if (edge) {
        grid[y]![x] = 'o';
        continue;
      }
      let xl = x;
      while (at(xl - 1, y)) xl--;
      let xr = x;
      while (at(xr + 1, y)) xr++;
      const dl = x - xl;
      const dr = xr - x;
      grid[y]![x] = dl <= 2 ? 'h' : dr <= 3 ? 's' : 'f';
    }
  }
  for (const y of spec.lines ?? []) for (let x = 0; x < SIZE32; x++) if (at(x, y)) grid[y]![x] = 'o';
  for (const [x, y] of spec.marks ?? []) if (at(x, y)) grid[y]![x] = 'o';

  const out = grid.map((r) => r.join(''));
  cache.set(type, out);
  return out;
}
