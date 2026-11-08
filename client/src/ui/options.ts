import { applyAudioSettings } from '../audio/audio';
import { t, type TKey } from '../core/i18n';
import { loadSettings, saveSettings, type Settings } from '../core/settings';
import { applyFx } from '../fx/background';
import { cardButton, el } from './dom';
import { showMenu } from './menu';
import { navigate } from './transition';

type BoolKey = 'view3d' | 'crt' | 'bgAnim' | 'shake' | 'sfx' | 'music' | 'showLegal';
const TOGGLES: [BoolKey, TKey][] = [
  ['crt', 'opt.crt'],
  ['bgAnim', 'opt.bg'],
  ['shake', 'opt.shake'],
  ['sfx', 'opt.sfx'],
  ['music', 'opt.music'],
  ['view3d', 'opt.view3d'],
  ['showLegal', 'btn.legal'],
];

export function showOptions(root: HTMLElement): void {
  root.replaceChildren();
  const s = loadSettings();
  const wrap = el('main', 'menu');
  wrap.append(el('h1', 'title small', t('menu.options')));
  const list = el('div', 'menu-list');
  for (const [key, label] of TOGGLES) {
    const b = cardButton('', () => {
      (s as Settings)[key] = !s[key];
      saveSettings(s);
      applyFx();
      applyAudioSettings();
      paint();
    });
    const paint = () => (b.textContent = `${t(label)}: ${s[key] ? t('ai.on') : t('ai.off')}`);
    paint();
    list.append(b);
  }
  list.append(cardButton(t('btn.menu'), () => navigate(root, () => showMenu(root))));
  wrap.append(list);
  root.append(wrap);
}

/** Botón fijo de silencio (arriba a la derecha). */
export function mountMuteButton(): void {
  const s = loadSettings();
  const b = el('button', 'mute-btn');
  const paint = () => {
    b.textContent = s.sfx || s.music ? '♪' : '✕';
    b.title = t('opt.mute');
    b.classList.toggle('off', !(s.sfx || s.music));
  };
  b.addEventListener('click', () => {
    const on = s.sfx || s.music;
    s.sfx = !on;
    s.music = !on;
    saveSettings(s);
    applyAudioSettings();
    paint();
  });
  paint();
  document.body.append(b);
}
