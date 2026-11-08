/** Lógica pura del Coach (sin motor ni DOM): convierte evaluaciones de Stockfish en explicaciones simples. */
import { Chess, type PieceSymbol } from 'chess.js';
import { t, tf, type TKey } from '../core/i18n';
import type { SearchResult } from './engine';

export type VerdictKind = 'best' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface Verdict {
  kind: VerdictKind;
  /** Centipeones perdidos respecto de la mejor jugada (≥ 0). */
  lossCp: number;
  /** Evaluación tras la jugada, desde el punto de vista del jugador que movió (en centipeones, mate = ±10000). */
  evalCp: number;
  mateIn: number | null;
  bestSan: string | null;
  bestUci: string | null;
  text: string;
}

/** Evaluación en centipeones desde las BLANCAS; los mates se convierten a valores enormes. */
export function evalToCp(r: Pick<SearchResult, 'cp' | 'mate'>): number | null {
  if (r.mate !== null && r.mate !== 0) return Math.sign(r.mate) * (10000 - 50 * Math.min(100, Math.abs(r.mate)));
  if (r.cp !== null) return r.cp;
  return null;
}

export function classify(lossCp: number): VerdictKind {
  if (lossCp <= 10) return 'great';
  if (lossCp <= 40) return 'good';
  if (lossCp <= 100) return 'inaccuracy';
  if (lossCp <= 250) return 'mistake';
  return 'blunder';
}

function uciToMove(c: Chess, uci: string) {
  try {
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as PieceSymbol | undefined });
  } catch {
    return null;
  }
}

const pieceName = (p: PieceSymbol) => t(`piece.name.${p}` as TKey);

/**
 * `before`: análisis de la posición antes de la jugada (mejor jugada y evaluación).
 * `after`: análisis de la posición resultante. Ambos con evaluación desde las blancas.
 */
export function buildVerdict(args: {
  color: 'w' | 'b';
  played: string;
  fenBefore: string;
  fenAfter: string;
  before: SearchResult;
  after: SearchResult;
}): Verdict | null {
  const { color, played, fenBefore, fenAfter, before, after } = args;
  const cpBefore = evalToCp(before);
  const cpAfter = evalToCp(after);
  if (cpBefore === null || cpAfter === null) return null;
  const sign = color === 'w' ? 1 : -1;
  const loss = played === before.best ? 0 : Math.max(0, sign * (cpBefore - cpAfter));
  const kind: VerdictKind = played === before.best ? 'best' : classify(loss);

  let bestSan: string | null = null;
  let bestMove: ReturnType<typeof uciToMove> = null;
  if (before.best) {
    bestMove = uciToMove(new Chess(fenBefore), before.best);
    bestSan = bestMove?.san ?? null;
  }

  // Detalles que explican el error, en orden de importancia.
  let detail = '';
  if (kind === 'mistake' || kind === 'blunder') {
    if (after.mate !== null && sign * after.mate < 0) {
      detail += tf('coach.d.mate-against', { n: Math.abs(after.mate) });
    } else if (after.pv[0]) {
      const c = new Chess(fenAfter);
      const reply = uciToMove(c, after.pv[0]);
      if (reply?.captured) {
        const lastTo = played.slice(2, 4);
        detail += reply.to === lastTo
          ? tf('coach.d.hang', { piece: pieceName(reply.captured), san: reply.san })
          : tf('coach.d.capture', { piece: pieceName(reply.captured), san: reply.san });
      }
    }
    if (bestMove && bestSan) {
      if (bestSan.endsWith('#')) detail += tf('coach.d.missmate', { san: bestSan });
      else if (bestMove.captured && !detail) detail += tf('coach.d.misscapture', { san: bestSan });
      else if (bestSan.endsWith('+') && !detail) detail += tf('coach.d.misscheck', { san: bestSan });
    }
  }

  const san = bestSan ?? '';
  const text =
    kind === 'best' ? t('coach.best')
    : kind === 'great' ? t('coach.great')
    : kind === 'good' ? t('coach.good')
    : kind === 'inaccuracy' ? tf('coach.inaccuracy', { san })
    : kind === 'mistake' ? tf('coach.mistake', { detail, san })
    : tf('coach.blunder', { detail, san });

  const mateIn = after.mate !== null && after.mate !== 0 ? sign * after.mate : null;
  return { kind, lossCp: loss, evalCp: sign * cpAfter, mateIn, bestSan, bestUci: before.best, text };
}

/** "+0.8" / "-1.5" / "Mate a tu favor en 3". */
export function formatEval(v: Verdict): string {
  if (v.mateIn !== null)
    return tf(v.mateIn > 0 ? 'coach.eval.mate.you' : 'coach.eval.mate.rival', { n: Math.abs(v.mateIn) });
  const pawns = v.evalCp / 100;
  return tf('coach.eval', { v: `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}` });
}
