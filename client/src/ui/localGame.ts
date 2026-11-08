import type { PieceSymbol, Square } from 'chess.js';
import { Game } from '../core/game';
import { t } from '../core/i18n';
import { loadSettings, saveSettings } from '../core/settings';
import { BoardView } from '../render/boardView';
import { cardButton, el } from './dom';
import { showMenu } from './menu';

export function showLocalGame(root: HTMLElement): void {
  root.replaceChildren();
  const settings = loadSettings();
  const game = new Game();

  const screen = el('main', 'game-screen');
  const status = el('div', 'status');
  const stage = el('div', 'board-stage');
  const canvas = el('canvas', 'board');
  const promo = el('div', 'promo hidden');
  stage.append(canvas, promo);

  const controls = el('div', 'controls');
  const legalBtn = cardButton('', () => {
    settings.showLegal = !settings.showLegal;
    saveSettings(settings);
    view.opts.showLegal = settings.showLegal;
    view.invalidate();
    refreshLegalLabel();
  });
  const refreshLegalLabel = () => {
    legalBtn.textContent = `${t('btn.legal')}: ${settings.showLegal ? 'ON' : 'OFF'}`;
  };

  controls.append(
    cardButton(t('btn.undo'), () => {
      game.undo();
      view.clearSelection();
      refresh();
    }),
    cardButton(t('btn.flip'), () => {
      view.opts.flipped = !view.opts.flipped;
      view.invalidate();
    }),
    legalBtn,
    cardButton(t('btn.new'), () => {
      game.reset();
      view.clearSelection();
      refresh();
    }),
    cardButton(t('btn.menu'), () => showMenu(root)),
  );
  screen.append(status, stage, controls);
  root.append(screen);

  const view = new BoardView(canvas, game, {
    showLegal: settings.showLegal,
    flipped: false,
    canInteract: () => !game.status().over && promo.classList.contains('hidden'),
    onMoveAttempt: (from, to) => {
      if (game.needsPromotion(from, to)) {
        askPromotion(from, to);
        return false;
      }
      const ok = game.tryMove(from, to) !== null;
      if (ok) refresh();
      return ok;
    },
  });

  function askPromotion(from: Square, to: Square): void {
    promo.replaceChildren(el('p', '', t('promo.title')));
    const row = el('div', 'promo-row');
    for (const p of ['q', 'r', 'b', 'n'] as PieceSymbol[]) {
      row.append(
        cardButton(t(`piece.${p}` as 'piece.q'), () => {
          promo.classList.add('hidden');
          game.tryMove(from, to, p);
          view.clearSelection();
          refresh();
        }),
      );
    }
    promo.append(row);
    promo.classList.remove('hidden');
  }

  function refresh(): void {
    const s = game.status();
    status.textContent = t(s.messageKey) + (s.check && !s.over ? ' ' + t('game.check') : '');
    status.classList.toggle('alert', s.check);
    view.invalidate();
  }

  refreshLegalLabel();
  refresh();
}
