import type { PieceSymbol } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { build32, SIZE32 } from './sprites32';

const TYPES: PieceSymbol[] = ['p', 'r', 'n', 'b', 'q', 'k'];

describe('piezas 32×32', () => {
  for (const t of TYPES) {
    it(`${t}: grilla completa, con contorno, relleno y base`, () => {
      const g = build32(t);
      expect(g).toHaveLength(SIZE32);
      for (const row of g) expect(row).toHaveLength(SIZE32);
      const flat = g.join('');
      expect(flat).toMatch(/o/);
      expect(flat).toMatch(/f/);
      expect(flat).toMatch(/h/);
      expect(flat).toMatch(/s/);
      expect(flat).toMatch(/^[.ofhs]+$/);
      // la base ocupa las últimas filas y nada se sale por abajo
      expect(g[31]).toBe('.'.repeat(SIZE32));
      expect(g[29]!.replace(/\./g, '').length).toBeGreaterThanOrEqual(20);
    });
  }

  it('las piezas simétricas lo son (ignorando sombreado y detalles)', () => {
    for (const t of ['p', 'r', 'b', 'q', 'k'] as PieceSymbol[]) {
      for (const row of build32(t)) {
        const present = [...row].map((c) => (c === '.' ? 0 : 1));
        expect(present).toEqual([...present].reverse());
      }
    }
  });
});
