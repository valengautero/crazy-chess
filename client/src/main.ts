import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import { playSfx, unlockAudio } from './audio/audio';
import { initFx } from './fx/background';
import { showMenu } from './ui/menu';
import { mountMuteButton } from './ui/options';

initFx();
mountMuteButton();
showMenu(document.getElementById('app')!);

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
