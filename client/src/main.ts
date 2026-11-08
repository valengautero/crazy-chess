import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import { playSfx, unlockAudio } from './audio/audio';
import { initFx } from './fx/background';
import { showMenu } from './ui/menu';
import { showOnlineRoom } from './ui/online';
import { mountMuteButton } from './ui/options';

initFx();
mountMuteButton();
const app = document.getElementById('app')!;
// Link de invitación: /?room=ABCD entra directo a la sala.
const invited = new URLSearchParams(location.search).get('room')?.toUpperCase();
if (invited && /^[A-Z]{4}$/.test(invited)) {
  history.replaceState(null, '', location.pathname);
  showOnlineRoom(app, { kind: 'join', code: invited });
} else {
  showMenu(app);
}

// El audio solo puede arrancar tras un gesto del usuario.
document.addEventListener('pointerdown', unlockAudio);

// Sonidos de botones-carta por delegación de eventos.
let lastBtn: Element | null = null;
document.addEventListener('pointerover', (e) => {
  const b = (e.target as HTMLElement).closest('.card-btn:not(:disabled)');
  if (b && b !== lastBtn) playSfx('hover');
  lastBtn = b;
});
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('.card-btn:not(:disabled), .mute-btn')) playSfx('click');
});
