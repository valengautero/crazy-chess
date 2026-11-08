import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { TKey } from './i18n';

export type GameStatus = { over: boolean; check: boolean; messageKey: TKey };

/** Envoltorio fino sobre chess.js: todas las reglas las resuelve la librería. */
export class Game {
  chess = new Chess();

  reset(fen?: string): void {
    this.chess = fen ? new Chess(fen) : new Chess();
  }

  get turn() {
    return this.chess.turn();
  }

  legalMovesFrom(sq: Square): Move[] {
    return this.chess.moves({ square: sq, verbose: true });
  }

  needsPromotion(from: Square, to: Square): boolean {
    return this.legalMovesFrom(from).some((m) => m.to === to && m.promotion);
  }

  /** Devuelve el movimiento hecho, o null si es ilegal. */
  tryMove(from: Square, to: Square, promotion?: PieceSymbol): Move | null {
    try {
      return this.chess.move({ from, to, promotion });
    } catch {
      return null;
    }
  }

  undo(): Move | null {
    return this.chess.undo();
  }

  get lastMove(): Move | undefined {
    return this.chess.history({ verbose: true }).at(-1);
  }

  /** Casilla del rey en jaque, si lo hay. */
  checkedKing(): Square | null {
    if (!this.chess.isCheck()) return null;
    const turn = this.chess.turn();
    for (const row of this.chess.board())
      for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square;
    return null;
  }

  status(): GameStatus {
    const c = this.chess;
    if (c.isCheckmate())
      return { over: true, check: true, messageKey: c.turn() === 'w' ? 'game.mate.b' : 'game.mate.w' };
    if (c.isStalemate()) return { over: true, check: false, messageKey: 'game.draw.stalemate' };
    if (c.isThreefoldRepetition()) return { over: true, check: false, messageKey: 'game.draw.threefold' };
    if (c.isInsufficientMaterial()) return { over: true, check: false, messageKey: 'game.draw.material' };
    if (c.isDrawByFiftyMoves()) return { over: true, check: false, messageKey: 'game.draw.fifty' };
    if (c.isDraw()) return { over: true, check: false, messageKey: 'game.draw' };
    return {
      over: false,
      check: c.isCheck(),
      messageKey: c.turn() === 'w' ? 'game.turn.w' : 'game.turn.b',
    };
  }
}
