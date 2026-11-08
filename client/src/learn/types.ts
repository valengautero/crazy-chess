/**
 * Modelo de lecciones. El texto vive junto a los datos en `lessons/<idioma>.ts`:
 * para agregar un idioma se crea `lessons/en.ts` con la misma forma y se registra en `lessons/index.ts`.
 * Todas las jugadas están en notación UCI ("e2e4", "e7e8q"). Quien mueve en la posición inicial es el alumno.
 */
export type Exercise =
  /** Tocar una casilla del tablero (coordenadas). */
  | { kind: 'square'; fen: string; prompt: string; targets: string[]; explain?: string }
  /**
   * Secuencia de jugadas: las posiciones pares de `line` son del alumno (una jugada o varias aceptadas) y las impares
   * son respuestas del rival que se juegan solas. Las alternativas aceptadas deben admitir la misma respuesta.
   */
  | { kind: 'line'; fen: string; prompt: string; line: (string | string[])[]; feedback?: Record<string, string>; explain?: string }
  /** Cualquier jugada que cumpla un objetivo (dar jaque, dar mate). */
  | { kind: 'goal'; fen: string; prompt: string; goal: 'check' | 'mate'; explain?: string }
  /** Pregunta de opción múltiple. */
  | { kind: 'quiz'; prompt: string; options: string[]; answer: number; explain?: string }
  /** Jugar un final contra Stockfish hasta cumplir el objetivo. */
  | { kind: 'playout'; fen: string; prompt: string; goal: 'mate' | 'promote'; maxMoves: number; explain?: string };

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  intro: string[];
  exercises: Exercise[];
}
