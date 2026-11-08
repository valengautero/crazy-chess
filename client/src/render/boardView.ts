import type { Move, PieceSymbol, Square } from 'chess.js';
import type { Game } from '../core/game';

const FILES = 'abcdefgh';
const GLYPH: Record<PieceSymbol, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

export const PALETTE = {
  light: '#8f6bc2',
  dark: '#43306e',
  lastMove: 'rgba(255, 210, 74, 0.45)',
  selected: 'rgba(255, 210, 74, 0.7)',
  legal: 'rgba(255, 210, 74, 0.85)',
  check: 'rgba(230, 57, 70, 0.75)',
  white: '#fff4d6',
  black: '#1a1028',
  outline: '#0d0817',
  coordLight: '#43306e',
  coordDark: '#8f6bc2',
};

export interface BoardOptions {
  showLegal: boolean;
  flipped: boolean;
  /** Se llama al intentar mover; devuelve true si el movimiento se hizo. */
  onMoveAttempt: (from: Square, to: Square) => boolean;
  /** Si devuelve false, el tablero no deja seleccionar piezas (partida terminada, turno ajeno…). */
  canInteract: () => boolean;
}

export class BoardView {
  private ctx: CanvasRenderingContext2D;
  private size = 0;
  private selected: Square | null = null;
  private legalTargets: Move[] = [];
  private drag: { from: Square; x: number; y: number; moved: boolean } | null = null;
  private dirty = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    public opts: BoardOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', () => this.cancelDrag());
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    const loop = () => {
      if (this.dirty) {
        this.draw();
        this.dirty = false;
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  invalidate(): void {
    this.dirty = true;
  }

  clearSelection(): void {
    this.selected = null;
    this.legalTargets = [];
    this.drag = null;
    this.invalidate();
  }

  private resize(): void {
    const parent = this.canvas.parentElement!;
    const avail = Math.min(parent.clientWidth, window.innerHeight - 200);
    const px = Math.max(240, Math.floor(avail / 8) * 8);
    const dpr = window.devicePixelRatio || 1;
    this.size = px;
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.canvas.width = px * dpr;
    this.canvas.height = px * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.invalidate();
  }

  // --- coordenadas ---
  private squareAt(px: number, py: number): Square | null {
    const s = this.size / 8;
    let col = Math.floor(px / s);
    let row = Math.floor(py / s);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    if (this.opts.flipped) {
      col = 7 - col;
      row = 7 - row;
    }
    return `${FILES[col]}${8 - row}` as Square;
  }

  private originOf(sq: Square): { x: number; y: number } {
    const s = this.size / 8;
    let col = FILES.indexOf(sq[0]!);
    let row = 8 - Number(sq[1]);
    if (this.opts.flipped) {
      col = 7 - col;
      row = 7 - row;
    }
    return { x: col * s, y: row * s };
  }

  private pointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // --- input ---
  private onDown = (e: PointerEvent): void => {
    if (!this.opts.canInteract()) return;
    const { x, y } = this.pointer(e);
    const sq = this.squareAt(x, y);
    if (!sq) return;
    this.canvas.setPointerCapture(e.pointerId);

    // Click sobre un destino legal de la pieza ya seleccionada.
    if (this.selected && this.legalTargets.some((m) => m.to === sq)) {
      this.finishMove(this.selected, sq);
      return;
    }
    const piece = this.game.chess.get(sq);
    if (piece && piece.color === this.game.turn) {
      this.selected = sq;
      this.legalTargets = this.game.legalMovesFrom(sq);
      this.drag = { from: sq, x, y, moved: false };
    } else {
      this.clearSelection();
    }
    this.invalidate();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const { x, y } = this.pointer(e);
    this.drag.x = x;
    this.drag.y = y;
    this.drag.moved = true;
    this.invalidate();
  };

  private onUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const { x, y } = this.pointer(e);
    const sq = this.squareAt(x, y);
    if (d.moved && sq && sq !== d.from && this.legalTargets.some((m) => m.to === sq)) {
      this.finishMove(d.from, sq);
    } else {
      this.invalidate(); // la pieza vuelve a su casilla; sigue seleccionada
    }
  };

  private cancelDrag(): void {
    this.drag = null;
    this.invalidate();
  }

  private finishMove(from: Square, to: Square): void {
    const done = this.opts.onMoveAttempt(from, to);
    if (done) this.clearSelection();
    else this.invalidate();
  }

  // --- dibujo ---
  private draw(): void {
    const { ctx } = this;
    const s = this.size / 8;
    const last = this.game.lastMove;
    const kingSq = this.game.checkedKing();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const light = (r + c) % 2 === 0;
        ctx.fillStyle = light ? PALETTE.light : PALETTE.dark;
        ctx.fillRect(c * s, r * s, s, s);
      }
    }

    const fill = (sq: Square, color: string) => {
      const o = this.originOf(sq);
      ctx.fillStyle = color;
      ctx.fillRect(o.x, o.y, s, s);
    };
    if (last) {
      fill(last.from, PALETTE.lastMove);
      fill(last.to, PALETTE.lastMove);
    }
    if (kingSq) fill(kingSq, PALETTE.check);
    if (this.selected) fill(this.selected, PALETTE.selected);

    this.drawCoordinates(s);

    // piezas
    for (const row of this.game.chess.board()) {
      for (const p of row) {
        if (!p) continue;
        if (this.drag?.moved && this.drag.from === p.square) continue;
        const o = this.originOf(p.square);
        this.drawPiece(p.type, p.color, o.x + s / 2, o.y + s / 2, s);
      }
    }

    // marcas de movimientos legales
    if (this.opts.showLegal && this.selected) {
      for (const m of this.legalTargets) {
        const o = this.originOf(m.to);
        ctx.fillStyle = PALETTE.legal;
        if (m.captured || m.flags.includes('e')) {
          ctx.lineWidth = Math.max(3, s * 0.08);
          ctx.strokeStyle = PALETTE.legal;
          ctx.strokeRect(o.x + ctx.lineWidth / 2, o.y + ctx.lineWidth / 2, s - ctx.lineWidth, s - ctx.lineWidth);
        } else {
          const d = s * 0.18;
          ctx.fillRect(o.x + s / 2 - d / 2, o.y + s / 2 - d / 2, d, d);
        }
      }
    }

    // pieza arrastrada, encima de todo
    if (this.drag?.moved) {
      const p = this.game.chess.get(this.drag.from);
      if (p) this.drawPiece(p.type, p.color, this.drag.x, this.drag.y - s * 0.15, s * 1.1);
    }
  }

  private drawCoordinates(s: number): void {
    const { ctx } = this;
    ctx.font = `bold ${Math.floor(s * 0.2)}px "Pixelify Sans", monospace`;
    ctx.textBaseline = 'top';
    for (let i = 0; i < 8; i++) {
      const fileIdx = this.opts.flipped ? 7 - i : i;
      const rank = this.opts.flipped ? i + 1 : 8 - i;
      // letras en la fila inferior
      const lightBottom = (7 + i) % 2 === 0;
      ctx.fillStyle = lightBottom ? PALETTE.coordLight : PALETTE.coordDark;
      ctx.textAlign = 'right';
      ctx.fillText(FILES[fileIdx]!, (i + 1) * s - 3, 7 * s + s - s * 0.24);
      // números en la columna izquierda
      const lightLeft = i % 2 === 0;
      ctx.fillStyle = lightLeft ? PALETTE.coordLight : PALETTE.coordDark;
      ctx.textAlign = 'left';
      ctx.fillText(String(rank), 3, i * s + 2);
    }
  }

  /** Piezas provisorias (glifos). En la etapa (c) se reemplazan por sprites pixel art. */
  private drawPiece(type: PieceSymbol, color: 'w' | 'b', cx: number, cy: number, s: number): void {
    const { ctx } = this;
    ctx.font = `${Math.floor(s * 0.78)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PALETTE.outline;
    ctx.fillStyle = color === 'w' ? PALETTE.white : PALETTE.black;
    const g = GLYPH[type];
    ctx.strokeText(g, cx, cy + s * 0.04);
    ctx.fillText(g, cx, cy + s * 0.04);
  }
}
