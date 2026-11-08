import type { SearchOptions } from './engine';

export interface Level {
  id: number;
  name: string;
  approxElo: string;
  search: SearchOptions;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Principiante', approxElo: '~800', search: { skill: 0, depth: 1 } },
  { id: 2, name: 'Fácil', approxElo: '~1000', search: { skill: 3, depth: 4 } },
  { id: 3, name: 'Medio', approxElo: '~1300', search: { skill: 7, depth: 8 } },
  { id: 4, name: 'Difícil', approxElo: '~1700', search: { skill: 12, depth: 12 } },
  { id: 5, name: 'Experto', approxElo: '~2100', search: { skill: 17, depth: 16 } },
  { id: 6, name: 'Maestro', approxElo: '2500+', search: { skill: 20, movetime: 1000 } },
];

/** Búsqueda a máxima fuerza para pistas y análisis. */
export const ANALYSIS: SearchOptions = { skill: 20, depth: 14 };
