import { describe, expect, it } from 'vitest';
import { buildVerdict, classify, evalToCp, formatEval } from './coachLogic';
import type { SearchResult } from './engine';

const res = (o: Partial<SearchResult>): SearchResult => ({ best: null, cp: null, mate: null, pv: [], depth: 12, ...o });

describe('coach: evaluación', () => {
  it('convierte mates a valores enormes con el signo correcto', () => {
    expect(evalToCp(res({ mate: 1 }))).toBe(9950);
    expect(evalToCp(res({ mate: -3 }))).toBe(-9850);
    expect(evalToCp(res({ cp: 35 }))).toBe(35);
    expect(evalToCp(res({}))).toBeNull();
  });

  it('clasifica por centipeones perdidos', () => {
    expect(classify(0)).toBe('great');
    expect(classify(30)).toBe('good');
    expect(classify(80)).toBe('inaccuracy');
    expect(classify(200)).toBe('mistake');
    expect(classify(400)).toBe('blunder');
  });
});

describe('coach: veredictos', () => {
  it('jugar la mejor jugada es "best"', () => {
    const v = buildVerdict({
      color: 'w', played: 'e2e4',
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      before: res({ best: 'e2e4', cp: 30 }), after: res({ cp: 30, pv: ['e7e5'] }),
    })!;
    expect(v.kind).toBe('best');
    expect(v.lossCp).toBe(0);
  });

  it('dejar la dama colgada es error grave y lo explica', () => {
    const v = buildVerdict({
      color: 'w', played: 'd1d5',
      fenBefore: '4k3/8/2p5/8/8/8/8/3QK3 w - - 0 1',
      fenAfter: '4k3/8/2p5/3Q4/8/8/8/4K3 b - - 0 1',
      before: res({ best: 'd1d2', cp: 900 }),
      after: res({ cp: 0, pv: ['c6d5'] }),
    })!;
    expect(v.kind).toBe('blunder');
    expect(v.text).toContain('dama');
    expect(v.text).toContain('cxd5');
    expect(v.text).toContain('Era mejor Qd2');
  });

  it('avisa cuando se pierde un jaque mate', () => {
    const v = buildVerdict({
      color: 'w', played: 'e1e2',
      fenBefore: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
      fenAfter: '6k1/5ppp/8/8/8/8/4K3/R7 b - - 0 1',
      before: res({ best: 'a1a8', mate: 1 }),
      after: res({ cp: 500, pv: ['g8h8'] }),
    })!;
    expect(v.kind).toBe('blunder');
    expect(v.text).toContain('Ra8#');
    expect(v.text).toContain('jaque mate');
  });

  it('desde las negras el signo se invierte', () => {
    const v = buildVerdict({
      color: 'b', played: 'e7e5',
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      before: res({ best: 'c7c5', cp: 30 }),
      after: res({ cp: 30, pv: ['g1f3'] }),
    })!;
    expect(v.kind).toBe('great');
    expect(v.evalCp).toBe(-30); // ventaja de las blancas = -0.3 para quien jugó con negras
  });

  it('formatea la evaluación', () => {
    const base = { kind: 'good', lossCp: 0, bestSan: null, bestUci: null, text: '', mateIn: null } as const;
    expect(formatEval({ ...base, evalCp: 85 })).toContain('+0.8');
    expect(formatEval({ ...base, evalCp: -150 })).toContain('-1.5');
    expect(formatEval({ ...base, evalCp: 0, mateIn: 3 })).toContain('Mate a tu favor en 3');
  });
});
