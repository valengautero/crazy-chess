export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function cardButton(label: string, onClick: () => void, opts: { disabled?: boolean; hint?: string } = {}) {
  const b = el('button', 'card-btn', label);
  if (opts.hint) {
    const h = el('small', '', opts.hint);
    b.append(h);
  }
  b.disabled = !!opts.disabled;
  b.addEventListener('click', onClick);
  return b;
}
