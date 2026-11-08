import type { Move } from 'chess.js';
import { t, type TKey } from './i18n';

/** "Blancas: Caballo g1 → f3 (captura peón) ¡Jaque!" para mostrar arriba del tablero. */
export function describeMove(m: Move): string {
  const side = t(m.color === 'w' ? 'ai.setup.white' : 'ai.setup.black');
  const piece = cap(t(`piece.name.${m.piece}` as TKey));
  let text = `${side}: ${piece} ${m.from} → ${m.to}`;
  const notes: string[] = [];
  if (m.flags.includes('k')) notes.push(t('move.castle.short'));
  else if (m.flags.includes('q')) notes.push(t('move.castle.long'));
  if (m.flags.includes('e')) notes.push(t('move.enpassant'));
  if (m.captured) notes.push(`${t('move.captures')} ${t(`piece.name.${m.captured}` as TKey)}`);
  if (m.promotion) notes.push(`${t('move.promotes')} ${t(`piece.name.${m.promotion}` as TKey)}`);
  if (notes.length) text += ` (${notes.join(', ')})`;
  if (m.san.endsWith('#')) text += ` ${t('move.mate')}`;
  else if (m.san.endsWith('+')) text += ` ${t('game.check')}`;
  return text;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
