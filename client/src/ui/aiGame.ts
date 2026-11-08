import type { Square } from 'chess.js';
import { getEngine, parseUci } from '../ai/engine';
import { ANALYSIS, LEVELS } from '../ai/levels';
import { Game } from '../core/game';
import { t } from '../core/i18n';
import { loadSettings, saveSettings } from '../core/settings';
import { BoardView } from '../render/boardView';
import { cardButton, el } from './dom';
import { showMenu } from './menu';
import { navigate } from './transition';
import { showPromotion } from './promotion';

export function showAiSetup(root: HTMLElement): void {
  root.replaceChildren();
  const settings = loadSettings();
  const wrap = el('main', 'menu');
  wrap.append(el('h1', 'title small', t('ai.setup.title')));

  const levelBox = el('div', 'menu-list');
  levelBox.append(el('h2', 'section', t('ai.setup.level')));
  const levelBtns = LEVELS.map((lv) => {
    const b = cardButton(`${lv.name}  ${lv.approxElo}`, () => {
      settings.aiLevel = lv.id;
      saveSettings(settings);
      sync();
    });
    levelBox.append(b);
    return b;
  });

  const colorBox = el('div', 'menu-list row');
  const wBtn = cardButton(t('ai.setup.white'), () => pick('w'));
  const bBtn = cardButton(t('ai.setup.black'), () => pick('b'));
  colorBox.append(wBtn, bBtn);
  const pick = (c: 'w' | 'b') => {
    settings.aiColor = c;
    saveSettings(settings);
    sync();
  };

  const sync = () => {
    levelBtns.forEach((b, i) => b.classList.toggle('selected', LEVELS[i]!.id === settings.aiLevel));
    wBtn.classList.toggle('selected', settings.aiColor === 'w');
    bBtn.classList.toggle('selected', settings.aiColor === 'b');
  };
  sync();

  wrap.append(
    levelBox,
    el('h2', 'section', t('ai.setup.color')),
    colorBox,
    cardButton(t('ai.setup.start'), () => navigate(root, () => showAiGame(root))),
    cardButton(t('btn.menu'), () => navigate(root, () => showMenu(root))),
  );
  root.append(wrap);
}

export function showAiGame(root: HTMLElement): void {
  root.replaceChildren();
  const settings = loadSettings();
  const level = LEVELS.find((l) => l.id === settings.aiLevel) ?? LEVELS[1]!;
  const human = settings.aiColor;
  const engine = getEngine();
  const game = new Game();
  let gen = 0; // se incrementa para descartar respuestas viejas del motor
  let thinking = false;

  const screen = el('main', 'game-screen');
  const status = el('div', 'status');
  const stage = el('div', 'board-stage');
  const canvas = el('canvas', 'board');
  const promo = el('div', 'promo hidden');
  stage.append(canvas, promo);
  const controls = el('div', 'controls');

  const onOff = (v: boolean) => (v ? t('ai.on') : t('ai.off'));
  const legalBtn = cardButton('', () => {
    settings.showLegal = !settings.showLegal;
    saveSettings(settings);
    view.opts.showLegal = settings.showLegal;
    view.invalidate();
    labels();
  });
  const arrowBtn = cardButton('', () => {
    settings.showBestArrow = !settings.showBestArrow;
    saveSettings(settings);
    labels();
    updateArrow();
  });
  const labels = () => {
    legalBtn.textContent = `${t('btn.legal')}: ${onOff(settings.showLegal)}`;
    arrowBtn.textContent = `${t('ai.arrow')}: ${onOff(settings.showBestArrow)}`;
  };

  controls.append(
    cardButton(t('ai.hint'), () => void showHint(true)),
    arrowBtn,
    cardButton(t('btn.undo'), undo),
    legalBtn,
    cardButton(t('btn.new'), () => { gen++; engine.cancel(); navigate(root, () => showAiSetup(root)); }),
    cardButton(t('btn.menu'), () => { gen++; engine.cancel(); navigate(root, () => showMenu(root)); }),
  );
  screen.append(
    el('div', 'subtitle', `${level.name} ${level.approxElo}`),
    status,
    stage,
    controls,
  );
  root.append(screen);

  const view = new BoardView(canvas, game, {
    showLegal: settings.showLegal,
    flipped: human === 'b',
    canInteract: () =>
      !thinking && !game.status().over && game.turn === human && promo.classList.contains('hidden'),
    onMoveAttempt: (from, to) => {
      if (game.needsPromotion(from, to)) {
        showPromotion(promo, (p) => {
          game.tryMove(from, to, p);
          view.clearSelection();
          afterMove();
        });
        return false;
      }
      const ok = game.tryMove(from, to) !== null;
      if (ok) afterMove();
      return ok;
    },
  });

  function refresh(): void {
    const s = game.status();
    let text = t(s.messageKey);
    if (!s.over) text = thinking ? t('ai.thinking') : `${t('ai.you')}. ${s.check ? t('game.check') : ''}`;
    status.textContent = text;
    status.classList.toggle('alert', s.check);
    view.sync();
  }

  function afterMove(): void {
    view.setArrow(null);
    refresh();
    void aiTurn();
  }

  async function aiTurn(): Promise<void> {
    if (game.status().over || game.turn === human) {
      refresh();
      updateArrow();
      return;
    }
    const my = ++gen;
    thinking = true;
    refresh();
    const started = performance.now();
    const res = await engine.search(game.chess.fen(), level.search);
    // pequeña pausa para que la IA no responda instantáneamente
    const wait = 350 - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (my !== gen) return;
    thinking = false;
    if (res.best) {
      const m = parseUci(res.best);
      game.tryMove(m.from as Square, m.to as Square, m.promotion as never);
    }
    refresh();
    updateArrow();
  }

  function undo(): void {
    gen++;
    engine.cancel();
    thinking = false;
    // deshacer hasta que vuelva a ser el turno del humano
    do {
      if (!game.undo()) break;
    } while (game.turn !== human);
    view.clearSelection();
    view.setArrow(null);
    refresh();
    if (game.turn !== human) void aiTurn();
    else updateArrow();
  }

  async function showHint(force: boolean): Promise<void> {
    if (game.status().over || game.turn !== human || thinking) return;
    const fen = game.chess.fen();
    const res = await engine.search(fen, ANALYSIS);
    if (game.chess.fen() !== fen) return; // la posición cambió mientras tanto
    if (!res.best) {
      if (force) status.textContent = t('ai.hint.none');
      return;
    }
    const m = parseUci(res.best);
    view.setArrow({ from: m.from as Square, to: m.to as Square });
  }

  function updateArrow(): void {
    if (settings.showBestArrow) void showHint(false);
    else view.setArrow(null);
  }

  labels();
  void aiTurn(); // si el humano juega negras, mueve la IA primero
  refresh();
}
