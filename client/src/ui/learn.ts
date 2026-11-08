import { Chess, type Move, type Square } from 'chess.js';
import { playSfx } from '../audio/audio';
import { getEngine, parseUci } from '../ai/engine';
import { ANALYSIS } from '../ai/levels';
import { Game } from '../core/game';
import { t, tf } from '../core/i18n';
import { loadSettings } from '../core/settings';
import { getLessons } from '../learn/lessons';
import { isCompleted, markSolved, solvedCount } from '../learn/progress';
import type { Exercise, Lesson } from '../learn/types';
import { BoardView } from '../render/boardView';
import { cardButton, el } from './dom';
import { showMenu } from './menu';
import { showPromotion } from './promotion';
import { navigate } from './transition';

// ---------- lista de lecciones ----------
export function showLearnMenu(root: HTMLElement, notice?: string): void {
  root.replaceChildren();
  const lessons = getLessons();
  const unlockAll = loadSettings().unlockAll;
  const wrap = el('main', 'menu');
  wrap.append(el('h1', 'title small', t('learn.title')));
  if (notice) wrap.append(el('div', 'notice', notice));
  const list = el('div', 'menu-list lessons');
  lessons.forEach((lesson, i) => {
    const prevDone = i === 0 || isCompleted(lessons[i - 1]!.id, lessons[i - 1]!.exercises.length);
    const locked = !unlockAll && !prevDone;
    const done = isCompleted(lesson.id, lesson.exercises.length);
    const hint = locked
      ? `🔒 ${t('learn.locked')}`
      : done
        ? `✔ ${t('learn.done')}`
        : tf('learn.progress', { n: solvedCount(lesson.id), total: lesson.exercises.length });
    const b = cardButton(`${i + 1}. ${lesson.title}`, () => navigate(root, () => showLessonIntro(root, lesson)), { disabled: locked, hint });
    if (done) b.classList.add('done');
    list.append(b);
  });
  wrap.append(list, cardButton(t('btn.menu'), () => navigate(root, () => showMenu(root))));
  root.append(wrap);
}

function showLessonIntro(root: HTMLElement, lesson: Lesson): void {
  root.replaceChildren();
  const wrap = el('main', 'menu intro');
  wrap.append(el('h1', 'title small', lesson.title));
  const box = el('div', 'intro-box');
  for (const p of lesson.intro) box.append(el('p', '', p));
  wrap.append(box, cardButton(t('learn.start'), () => navigate(root, () => runLesson(root, lesson))), cardButton(t('learn.back'), () => navigate(root, () => showLearnMenu(root))));
  root.append(wrap);
}

// ---------- ejercicios ----------
function findGoalMove(fen: string, goal: 'check' | 'mate'): { from: Square; to: Square } | null {
  const c = new Chess(fen);
  for (const m of c.moves({ verbose: true })) {
    const n = new Chess(fen);
    n.move(m);
    if (goal === 'mate' ? n.isCheckmate() : n.isCheck()) return { from: m.from, to: m.to };
  }
  return null;
}

function runLesson(root: HTMLElement, lesson: Lesson, startAt = 0): void {
  root.replaceChildren();
  const game = new Game();
  const total = lesson.exercises.length;
  let idx = Math.min(startAt, total - 1);
  let solved = false;
  let busy = false;
  let step = 0; // posición dentro de `line`
  let movesUsed = 0; // jugadas del alumno en un playout
  let token = 0; // invalida callbacks pendientes al cambiar de ejercicio

  const screen = el('main', 'game-screen learn');
  const header = el('div', 'learn-head');
  const title = el('div', 'learn-title', lesson.title);
  const progress = el('div', 'learn-progress');
  header.append(title, progress);
  const prompt = el('div', 'prompt');
  const stage = el('div', 'board-stage');
  const canvas = el('canvas', 'board');
  const promo = el('div', 'promo hidden');
  stage.append(canvas, promo);
  const quiz = el('div', 'quiz hidden');
  const feedback = el('div', 'feedback');
  const controls = el('div', 'controls');
  const hintBtn = cardButton(t('learn.hint'), () => hint());
  const retryBtn = cardButton(t('learn.retry'), () => load(idx));
  const nextBtn = cardButton(t('learn.next'), () => next());
  nextBtn.classList.add('hidden');
  controls.append(hintBtn, retryBtn, nextBtn, cardButton(t('learn.back'), () => navigate(root, () => showLearnMenu(root))));
  screen.append(header, prompt, stage, quiz, feedback, controls);
  root.append(screen);

  const view = new BoardView(canvas, game, {
    showLegal: loadSettings().showLegal,
    reserve: 330,
    flipped: false,
    canInteract: () => !solved && !busy && promo.classList.contains('hidden'),
    onMoveAttempt: (from, to) => {
      if (game.needsPromotion(from, to)) {
        showPromotion(promo, (p) => {
          const m = game.tryMove(from, to, p);
          view.clearSelection();
          if (m) afterUserMove(m);
        });
        return false;
      }
      const m = game.tryMove(from, to);
      if (!m) return false;
      afterUserMove(m);
      return true;
    },
  });

  function say(text: string, kind: 'ok' | 'bad' | 'info' = 'info'): void {
    feedback.textContent = text;
    feedback.className = `feedback ${kind}`;
  }

  function load(i: number): void {
    idx = i;
    token++;
    solved = false;
    busy = false;
    step = 0;
    movesUsed = 0;
    const ex = lesson.exercises[i]!;
    progress.textContent = tf('learn.exercise', { n: i + 1, total });
    prompt.textContent = ex.prompt;
    nextBtn.classList.add('hidden');
    quiz.replaceChildren();
    say('');
    view.setMarks({});
    view.setArrow(null);
    view.opts.onSquareClick = undefined;

    if (ex.kind === 'quiz') {
      stage.classList.add('hidden');
      quiz.classList.remove('hidden');
      hintBtn.classList.add('hidden');
      retryBtn.classList.add('hidden');
      ex.options.forEach((opt, k) => {
        const b = cardButton(opt, () => {
          if (solved) return;
          if (k === ex.answer) {
            b.classList.add('selected');
            solve(ex);
          } else {
            b.disabled = true;
            say(t('learn.wrong.quiz'), 'bad');
            playSfx('error');
          }
        });
        quiz.append(b);
      });
      return;
    }

    stage.classList.remove('hidden');
    quiz.classList.add('hidden');
    hintBtn.classList.remove('hidden');
    retryBtn.classList.remove('hidden');
    game.reset(ex.fen);
    view.opts.flipped = game.turn === 'b';
    view.clearSelection();
    view.sync();

    if (ex.kind === 'square') {
      view.opts.onSquareClick = (sq) => {
        if (solved) return;
        if (ex.targets.includes(sq)) {
          view.setMarks({ [sq]: 'rgba(74, 222, 128, 0.7)' });
          solve(ex);
        } else {
          view.setMarks({ [sq]: 'rgba(230, 57, 70, 0.6)' });
          say(tf('learn.wrong.square', { sq }), 'bad');
          playSfx('error');
        }
      };
    }
    if (ex.kind === 'playout') say(tf('learn.playout.left', { n: 0, max: ex.maxMoves }), 'info');
  }

  function solve(ex: Exercise): void {
    solved = true;
    busy = false;
    markSolved(lesson.id, idx);
    say(`${t('learn.correct')}${ex.explain ? ' ' + ex.explain : ''}`, 'ok');
    view.celebrate();
    playSfx('promote');
    const last = idx === total - 1;
    nextBtn.textContent = last ? t('learn.finish') : t('learn.next');
    nextBtn.classList.remove('hidden');
    hintBtn.classList.add('hidden');
  }

  function next(): void {
    if (idx >= total - 1) navigate(root, () => showLearnMenu(root, `${t('learn.completed')} ${lesson.title}`));
    else load(idx + 1);
  }

  /** Mensaje de error y retroceso de la jugada mala. */
  function wrong(text: string): void {
    say(text, 'bad');
    playSfx('error');
    busy = true;
    const my = token;
    setTimeout(() => {
      if (my !== token) return;
      game.undo();
      view.clearSelection();
      view.sync();
      busy = false;
    }, 900);
  }

  function afterUserMove(m: Move): void {
    view.setArrow(null);
    view.sync();
    const ex = lesson.exercises[idx]!;
    const my = token;
    if (ex.kind === 'line') {
      const expected = ex.line[step]!;
      const alts = Array.isArray(expected) ? expected : [expected];
      if (!alts.includes(m.lan)) return wrong(ex.feedback?.[m.lan] ?? t('learn.wrong'));
      step++;
      if (step >= ex.line.length) return solve(ex);
      busy = true;
      say('');
      setTimeout(() => {
        if (my !== token) return;
        game.applyUci(ex.line[step] as string);
        view.sync();
        step++;
        busy = false;
        if (step >= ex.line.length) solve(ex);
      }, 550);
    } else if (ex.kind === 'goal') {
      const ok = ex.goal === 'mate' ? game.chess.isCheckmate() : game.chess.isCheck();
      if (ok) solve(ex);
      else wrong(game.chess.isStalemate() ? t('learn.wrong.stalemate') : t('learn.wrong'));
    } else if (ex.kind === 'playout') {
      movesUsed++;
      const reached = ex.goal === 'mate' ? game.chess.isCheckmate() : !!m.promotion;
      if (reached) return solve(ex);
      if (game.chess.isGameOver()) return failPlayout(t('learn.playout.draw'));
      if (movesUsed >= ex.maxMoves) return failPlayout(t('learn.playout.out'));
      busy = true;
      say(t('learn.thinking'), 'info');
      void getEngine()
        .search(game.chess.fen(), { skill: 20, depth: 8 })
        .then((res) => {
          if (my !== token) return;
          if (res.best) game.applyUci(res.best);
          view.sync();
          busy = false;
          if (game.chess.isGameOver()) return failPlayout(game.chess.isCheckmate() ? t('learn.playout.fail') : t('learn.playout.draw'));
          say(tf('learn.playout.left', { n: movesUsed, max: ex.maxMoves }), 'info');
        });
    }
  }

  function failPlayout(text: string): void {
    busy = true; // el tablero queda bloqueado hasta "Reintentar"
    say(text, 'bad');
    playSfx('error');
  }

  function hint(): void {
    const ex = lesson.exercises[idx]!;
    if (solved || busy) return;
    if (ex.kind === 'square') {
      view.setMarks(Object.fromEntries(ex.targets.map((s) => [s, 'rgba(58, 134, 255, 0.55)'])));
    } else if (ex.kind === 'line') {
      const e = ex.line[step]!;
      const uci = Array.isArray(e) ? e[0]! : e;
      view.setArrow({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
    } else if (ex.kind === 'goal') {
      const m = findGoalMove(game.chess.fen(), ex.goal);
      if (m) view.setArrow(m);
    } else if (ex.kind === 'playout') {
      busy = true;
      say(t('learn.thinking'), 'info');
      const my = token;
      void getEngine()
        .search(game.chess.fen(), ANALYSIS)
        .then((res) => {
          if (my !== token) return;
          busy = false;
          say(tf('learn.playout.left', { n: movesUsed, max: ex.maxMoves }), 'info');
          if (res.best) {
            const p = parseUci(res.best);
            view.setArrow({ from: p.from as Square, to: p.to as Square });
          }
        });
    }
  }

  load(idx);
}
