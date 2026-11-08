import type { PieceSymbol } from 'chess.js';
import { t } from '../core/i18n';
import { cardButton, el } from './dom';

/** Muestra el selector de promoción dentro de `promo` y llama a `onPick` con la pieza elegida. */
export function showPromotion(promo: HTMLElement, onPick: (p: PieceSymbol) => void): void {
  promo.replaceChildren(el('p', '', t('promo.title')));
  const row = el('div', 'promo-row');
  for (const p of ['q', 'r', 'b', 'n'] as PieceSymbol[]) {
    row.append(
      cardButton(t(`piece.${p}` as 'piece.q'), () => {
        promo.classList.add('hidden');
        onPick(p);
      }),
    );
  }
  promo.append(row);
  promo.classList.remove('hidden');
}
