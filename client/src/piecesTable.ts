import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import type { Color, PieceSymbol } from 'chess.js';
import { PRESETS, renderPiece } from './render/pieceStyles';

const ORDER: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];
const table = document.getElementById('t')!;

const head = document.createElement('tr');
for (const h of ['Estilo', 'Blancas', 'Negras', 'Tamaño']) {
  const th = document.createElement('th');
  th.textContent = h;
  head.append(th);
}
table.append(head);

function strip(preset: (typeof PRESETS)[number], color: Color): HTMLElement {
  const row = document.createElement('div');
  row.className = 'strip';
  ORDER.forEach((p, i) => {
    const sq = document.createElement('div');
    // las blancas se ven sobre el fondo opuesto al de las negras, para comparar contraste en ambos
    sq.className = `sq ${(i + (color === 'w' ? 0 : 1)) % 2 === 0 ? 'l' : 'd'}`;
    const c = renderPiece(p, color, preset);
    if (preset.kind === 'glyph') c.classList.add('glyph');
    sq.append(c);
    row.append(sq);
  });
  return row;
}

for (const preset of PRESETS) {
  const tr = document.createElement('tr');
  const name = document.createElement('td');
  name.className = 'name';
  name.textContent = preset.name;
  const small = document.createElement('small');
  small.textContent = preset.description;
  name.append(small);
  const w = document.createElement('td');
  w.append(strip(preset, 'w'));
  const b = document.createElement('td');
  b.append(strip(preset, 'b'));
  const n = document.createElement('td');
  n.className = 'native';
  n.textContent = preset.native;
  tr.append(name, w, b, n);
  table.append(tr);
}
