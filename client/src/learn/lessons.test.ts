import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { getLessons } from './lessons';
import type { Exercise } from './types';

const lessons = getLessons('es');
const SQUARE = /^[a-h][1-8]$/;

function loadFen(fen: string): Chess {
  const c = new Chess(fen); // lanza si el FEN es inválido
  // el bando que NO mueve no puede estar en jaque (posición imposible)
  const flipped = new Chess(fen.replace(/ ([wb]) /, (_, s: string) => (s === 'w' ? ' b ' : ' w ')).replace(/ [a-h][36] /, ' - '));
  expect(flipped.isCheck(), `posición ilegal: ${fen}`).toBe(false);
  return c;
}

function play(c: Chess, uci: string): Chess {
  const next = new Chess(c.fen());
  const m = next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  expect(m, `jugada ilegal ${uci} en ${c.fen()}`).toBeTruthy();
  return next;
}

/** Recorre TODAS las combinaciones de jugadas aceptadas y verifica que cada una sea legal. */
function walk(c: Chess, line: (string | string[])[], i: number): void {
  if (i >= line.length) return;
  const entry = line[i]!;
  const alts = Array.isArray(entry) ? entry : [entry];
  if (i % 2 === 1) expect(Array.isArray(entry), 'las respuestas del rival son una sola jugada').toBe(false);
  for (const alt of alts) walk(play(c, alt), line, i + 1);
}

describe('lecciones', () => {
  it('tienen ids únicos y el orden pedido', () => {
    const ids = lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['board', 'pieces', 'capture', 'check', 'special', 'values', 'openings', 'tactics', 'endgames']);
  });

  for (const lesson of lessons) {
    describe(lesson.title, () => {
      it('tiene introducción y ejercicios', () => {
        expect(lesson.intro.length).toBeGreaterThan(0);
        expect(lesson.exercises.length).toBeGreaterThan(0);
      });
      lesson.exercises.forEach((ex: Exercise, i) => {
        it(`ejercicio ${i + 1} (${ex.kind}) es válido`, () => {
          expect(ex.prompt.length).toBeGreaterThan(5);
          if (ex.kind === 'quiz') {
            expect(ex.options.length).toBeGreaterThanOrEqual(2);
            expect(ex.answer).toBeGreaterThanOrEqual(0);
            expect(ex.answer).toBeLessThan(ex.options.length);
            return;
          }
          const c = loadFen(ex.fen);
          if (ex.kind === 'square') {
            for (const s of ex.targets) expect(s).toMatch(SQUARE);
          } else if (ex.kind === 'line') {
            expect(ex.line.length % 2, 'la secuencia debe terminar con jugada del alumno').toBe(1);
            walk(c, ex.line, 0);
            for (const uci of Object.keys(ex.feedback ?? {})) {
              expect(c.moves({ verbose: true }).some((m) => m.lan === uci), `feedback sobre jugada inexistente ${uci}`).toBe(true);
            }
          } else if (ex.kind === 'goal') {
            const ok = c.moves({ verbose: true }).filter((m) => {
              const n = new Chess(c.fen());
              n.move(m);
              return ex.goal === 'mate' ? n.isCheckmate() : n.isCheck();
            });
            expect(ok.length, 'debe existir al menos una jugada que cumpla el objetivo').toBeGreaterThan(0);
          } else if (ex.kind === 'playout') {
            expect(ex.maxMoves).toBeGreaterThan(5);
            expect(c.isGameOver()).toBe(false);
          }
        });
      });
    });
  }

  it('el mate del pastor termina en jaque mate y la defensa con Cf6 pierde', () => {
    const tactics = lessons.find((l) => l.id === 'tactics')!;
    const scholar = tactics.exercises.find((e) => e.kind === 'line' && e.line.length === 7)!;
    if (scholar.kind !== 'line') throw new Error();
    let c = loadFen(scholar.fen);
    for (const m of scholar.line) c = play(c, m as string);
    expect(c.isCheckmate()).toBe(true);

    const defend = tactics.exercises.find((e) => e.kind === 'line' && e.feedback?.g8f6)!;
    if (defend.kind !== 'line') throw new Error();
    const after = play(play(loadFen(defend.fen), 'g8f6'), 'h5f7');
    expect(after.isCheckmate()).toBe(true);
  });

  it('el ejercicio de evitar el rey ahogado: la única jugada correcta da mate y las demás ahogan o no matan', () => {
    const check = lessons.find((l) => l.id === 'check')!;
    const ex = check.exercises.find((e) => e.kind === 'goal' && e.prompt.includes('ahogado'))!;
    if (ex.kind !== 'goal') throw new Error();
    const c = loadFen(ex.fen);
    const results = c.moves({ verbose: true }).map((m) => {
      const n = new Chess(c.fen());
      n.move(m);
      return { lan: m.lan, mate: n.isCheckmate(), stale: n.isStalemate() };
    });
    expect(results.some((r) => r.mate)).toBe(true);
    expect(results.some((r) => r.stale)).toBe(true); // existe la trampa del ahogado
  });
});
