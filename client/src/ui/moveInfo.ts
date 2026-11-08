import type { Game } from '../core/game';
import { describeMove } from '../core/moveText';
import { t } from '../core/i18n';
import { el } from './dom';

/** Línea con la última jugada ("Blancas: Caballo g1 → f3"). `update()` se llama desde refresh(). */
export function createMoveInfo(game: Game) {
  const node = el('div', 'move-info', t('move.none'));
  node.setAttribute('role', 'status'); // anuncia cada jugada a lectores de pantalla
  let last = '';
  return {
    node,
    update(): void {
      const m = game.lastMove;
      const text = m ? describeMove(m) : t('move.none');
      node.textContent = text;
      if (text !== last) {
        node.classList.remove('pop');
        void node.offsetWidth;
        node.classList.add('pop');
        last = text;
      }
    },
  };
}
