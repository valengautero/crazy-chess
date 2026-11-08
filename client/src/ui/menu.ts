import { t } from '../core/i18n';
import { cardButton, el } from './dom';
import { showAiSetup } from './aiGame';
import { showLocalGame } from './localGame';
import { showOnlineLobby } from './online';
import { showOptions } from './options';
import { navigate } from './transition';

export function showMenu(root: HTMLElement): void {
  root.replaceChildren();
  const wrap = el('main', 'menu');
  wrap.append(el('h1', 'title', t('app.title')));
  const list = el('div', 'menu-list');
  list.append(
    cardButton(t('menu.learn'), () => {}, { disabled: true, hint: t('menu.soon') }),
    cardButton(t('menu.ai'), () => navigate(root, () => showAiSetup(root))),
    cardButton(t('menu.online'), () => navigate(root, () => showOnlineLobby(root))),
    cardButton(t('menu.local'), () => navigate(root, () => showLocalGame(root))),
    cardButton(t('menu.options'), () => navigate(root, () => showOptions(root))),
  );
  wrap.append(list);
  root.append(wrap);
}
