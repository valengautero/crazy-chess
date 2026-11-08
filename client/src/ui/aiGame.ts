import type { Square } from 'chess.js';
import { buildVerdict, formatEval, type Verdict } from '../ai/coachLogic';
import { getEngine, parseUci, type SearchResult } from '../ai/engine';
import { ANALYSIS, LEVELS } from '../ai/levels';
import { Game } from '../core/game';
import { t } from '../core/i18n';
import { loadSettings, saveSettings } from '../core/settings';
import { BoardView } from '../render/boardView';
import { cardButton, el } from './dom';
import { createMoveInfo } from './moveInfo';
import { showMenu } from './menu';
import { applyFx } from '../fx/background';
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
  let coachGen = 0; // invalida veredictos pendientes (deshacer, nueva partida)
  let lastVerdict: Verdict | null = null;
  // Análisis a máxima fuerza de la posición actual; lo comparten pista, flecha y Coach.
  let cache: { fen: string; p: Promise<SearchResult> } | null = null;
  const analyze = (fen: string): Promise<SearchResult> => {
    if (cache?.fen !== fen) cache = { fen, p: engine.search(fen, ANALYSIS) };
    return cache.p;
  };

  const screen = el('main', 'game-screen');
  const status = el('div', 'status');
  const moveInfo = createMoveInfo(game);
  const stage = el('div', 'board-stage');
  const canvas = el('canvas', 'board');
  const promo = el('div', 'promo hidden');
  stage.append(canvas, promo);
  const controls = el('div', 'controls');

  // ---- panel del Coach ----
  const coach = el('div', 'coach k-good');
  const coachText = el('div', 'coach-text', t('coach.idle'));
  const coachEval = el('div', 'coach-eval');
  const coachActions = el('div', 'coach-actions');
  coach.append(el('div', 'coach-title', t('coach.title')), coachText, coachEval, coachActions);
  const paintCoachVisibility = () => coach.classList.toggle('hidden', !settings.coach);

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
  const coachBtn = cardButton('', () => {
    settings.coach = !settings.coach;
    saveSettings(settings);
    labels();
    paintCoachVisibility();
    if (settings.coach) updateArrow();
  });
  const labels = () => {
    coachBtn.textContent = `${t('btn.coach')}: ${onOff(settings.coach)}`;
    legalBtn.textContent = `${t('btn.legal')}: ${onOff(settings.showLegal)}`;
    arrowBtn.textContent = `${t('ai.arrow')}: ${onOff(settings.showBestArrow)}`;
  };

  controls.append(
    cardButton(t('ai.hint'), () => void showHint(true)),
    arrowBtn,
    coachBtn,
    cardButton(t('btn.undo'), undo),
    legalBtn,
    cardButton(t('btn.view3d'), () => {
      const s = loadSettings();
      s.view3d = !s.view3d;
      saveSettings(s);
      applyFx();
    }),
    cardButton(t('btn.new'), () => { gen++; coachGen++; engine.cancel(); navigate(root, () => showAiSetup(root)); }),
    cardButton(t('btn.menu'), () => { gen++; coachGen++; engine.cancel(); navigate(root, () => showMenu(root)); }),
  );
  screen.append(
    el('div', 'subtitle', `${level.name} ${level.approxElo}`),
    status,
    moveInfo.node,
    stage,
    coach,
    controls,
  );
  root.append(screen);

  const view = new BoardView(canvas, game, {
    showLegal: settings.showLegal,
    reserve: 300,
    flipped: human === 'b',
    canInteract: () =>
      !thinking && !game.status().over && game.turn === human && promo.classList.contains('hidden'),
    onMoveAttempt: (from, to) => {
      if (game.needsPromotion(from, to)) {
        showPromotion(promo, (p) => {
          const before = game.chess.fen();
          if (game.tryMove(from, to, p)) afterMove(before);
          view.clearSelection();
        });
        return false;
      }
      const before = game.chess.fen();
      const ok = game.tryMove(from, to) !== null;
      if (ok) afterMove(before);
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
    moveInfo.update();
  }

  function afterMove(fenBefore: string): void {
    view.setArrow(null);
    const fenAfter = game.chess.fen();
    const played = game.lastMove!.lan;
    refresh();
    if (game.chess.isCheckmate()) showVerdictText('k-best', t('coach.mate'));
    else if (settings.coach && !game.status().over) void coachEvaluate(fenBefore, fenAfter, played);
    void aiTurn();
  }

  function showVerdictText(cls: string, text: string, evalText = '', actions: HTMLElement[] = []): void {
    coach.className = `coach ${cls}${settings.coach ? '' : ' hidden'}`;
    coachText.textContent = text;
    coachEval.textContent = evalText;
    coachActions.replaceChildren(...actions);
  }

  async function coachEvaluate(before: string, after: string, played: string): Promise<void> {
    const my = ++coachGen;
    showVerdictText('k-good', t('coach.analyzing'));
    // la búsqueda de `after` se encola antes que la respuesta de la IA
    const [b, a] = await Promise.all([analyze(before), engine.search(after, ANALYSIS)]);
    if (my !== coachGen) return;
    const v = buildVerdict({ color: human, played, fenBefore: before, fenAfter: after, before: b, after: a });
    if (!v) return showVerdictText('k-good', t('coach.idle'));
    lastVerdict = v;
    const actions: HTMLElement[] = [];
    if ((v.kind === 'mistake' || v.kind === 'blunder') && v.bestUci) {
      actions.push(cardButton(t('coach.undo'), () => undoAndSuggest(v)));
    }
    showVerdictText(`k-${v.kind}`, v.text, formatEval(v), actions);
  }

  /** Deshace hasta el turno anterior del humano y marca la jugada sugerida. */
  function undoAndSuggest(v: Verdict): void {
    undo();
    if (v.bestUci) {
      const m = parseUci(v.bestUci);
      view.setArrow({ from: m.from as Square, to: m.to as Square });
    }
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
    coachGen++;
    cache = null;
    lastVerdict = null;
    showVerdictText('k-good', t('coach.idle'));
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
    const res = await analyze(fen);
    if (game.chess.fen() !== fen) return; // la posición cambió mientras tanto
    if (!res.best) {
      if (force) status.textContent = t('ai.hint.none');
      return;
    }
    const m = parseUci(res.best);
    view.setArrow({ from: m.from as Square, to: m.to as Square });
  }

  function updateArrow(): void {
    // precalienta el análisis de esta posición: el Coach lo necesita cuando muevas
    if (settings.coach && game.turn === human && !game.status().over) void analyze(game.chess.fen());
    if (settings.showBestArrow) void showHint(false);
    else view.setArrow(null);
  }

  labels();
  paintCoachVisibility();
  void aiTurn(); // si el humano juega negras, mueve la IA primero
  refresh();
}
