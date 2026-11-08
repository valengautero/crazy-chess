export interface Settings {
  showLegal: boolean;
  showBestArrow: boolean;
  aiLevel: number;
  aiColor: 'w' | 'b';
  crt: boolean;
  bgAnim: boolean;
  shake: boolean;
  sfx: boolean;
  music: boolean;
  view3d: boolean;
  unlockAll: boolean;
  coach: boolean;
  /** true: piezas dentro de una carta; false: pieza sola. */
  pieceCards: boolean;
}
const KEY = 'chess-pixel:settings';
const defaults: Settings = {
  showLegal: true,
  showBestArrow: false,
  aiLevel: 2,
  aiColor: 'w',
  crt: true,
  bgAnim: true,
  shake: true,
  sfx: true,
  music: true,
  view3d: false,
  unlockAll: false,
  coach: true,
  pieceCards: true,
};

let cache: Settings | null = null;

/** Si el sistema pide menos movimiento, los efectos fuertes arrancan apagados (se pueden encender en Opciones). */
function reducedMotionDefaults(): Partial<Settings> {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? { shake: false, bgAnim: false, crt: false } : {};
  } catch {
    return {};
  }
}

/** Devuelve siempre el MISMO objeto: quien lo modifique y llame a saveSettings() lo propaga a todos. */
export function loadSettings(): Settings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults, ...reducedMotionDefaults() };
  } catch {
    cache = { ...defaults, ...reducedMotionDefaults() };
  }
  return cache!;
}

export function saveSettings(s: Settings = loadSettings()): void {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}
