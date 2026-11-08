const KEY = 'chess-pixel:progress';

/** lessonId → cantidad de ejercicios resueltos. */
type Progress = Record<string, number>;

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function save(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

export function solvedCount(lessonId: string): number {
  return Number(load()[lessonId] ?? 0);
}

export function markSolved(lessonId: string, exerciseIndex: number): void {
  const p = load();
  p[lessonId] = Math.max(Number(p[lessonId] ?? 0), exerciseIndex + 1);
  save(p);
}

export function isCompleted(lessonId: string, total: number): boolean {
  return solvedCount(lessonId) >= total;
}

export function resetProgress(): void {
  save({});
}
