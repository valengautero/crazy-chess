import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { describeMove } from './moveText';

const play = (fen: string, from: string, to: string, promotion?: string) =>
  new Chess(fen).move({ from, to, promotion });

describe('texto de la jugada', () => {
  it('pieza y movimiento', () => {
    expect(describeMove(play('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g1', 'f3'))).toBe('Blancas: Caballo g1 → f3');
  });
  it('captura, enroque, promoción y jaque', () => {
    expect(describeMove(play('7k/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5'))).toContain('captura peón');
    expect(describeMove(play('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1'))).toContain('enroque corto');
    expect(describeMove(play('7k/4P3/8/8/8/8/8/4K3 w - - 0 1', 'e7', 'e8', 'q'))).toContain('corona a dama');
    expect(describeMove(play('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a8'))).toContain('¡Jaque!');
    expect(describeMove(play('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a8'))).toContain('¡Jaque mate!');
  });
});
