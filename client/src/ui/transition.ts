/** Transición entre pantallas: un panel pixelado barre la pantalla (swipe) y la nueva pantalla aparece con dissolve. */
let busy = false;

export function navigate(root: HTMLElement, build: () => void): void {
  if (busy) return;
  busy = true;
  const wipe = document.createElement('div');
  wipe.className = 'wipe';
  document.body.append(wipe);
  wipe.style.animation = 'wipe-in 260ms steps(8) forwards';
  window.setTimeout(() => {
    build();
    root.classList.remove('dissolve');
    void root.offsetWidth; // reinicia la animación
    root.classList.add('dissolve');
    wipe.style.animation = 'wipe-out 260ms steps(8) forwards';
    window.setTimeout(() => {
      wipe.remove();
      busy = false;
    }, 270);
  }, 270);
}
