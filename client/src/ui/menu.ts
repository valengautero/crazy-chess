import { t } from '../core/i18n';
import { cardButton, el } from './dom';
import { showAiSetup } from './aiGame';
import { showLocalGame } from './localGame';

export function showMenu(root: HTMLElement): void {
  root.replaceChildren();
  const wrap = el('main', 'menu');
  wrap.append(el('h1', 'title', t('app.title')));
  const list = el('div', 'menu-list');
  list.append(
    cardButton(t('menu.learn'), () => {}, { disabled: true, hint: t('menu.soon') }),
    cardButton(t('menu.ai'), () => showAiSetup(root)),
    cardButton(t('menu.online'), () => {}, { disabled: true, hint: t('menu.soon') }),
    cardButton(t('menu.local'), () => showLocalGame(root)),
  );
  wrap.append(list);
  root.append(wrap);
}
