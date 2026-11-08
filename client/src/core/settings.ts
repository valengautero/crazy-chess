export interface Settings {
  showLegal: boolean;
  showBestArrow: boolean;
  aiLevel: number;
  aiColor: 'w' | 'b';
}
const KEY = 'chess-pixel:settings';
const defaults: Settings = { showLegal: true, showBestArrow: false, aiLevel: 2, aiColor: 'w' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}
