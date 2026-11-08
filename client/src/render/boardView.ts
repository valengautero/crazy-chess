import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import { playSfx } from '../audio/audio';
import type { Game } from '../core/game';
import { loadSettings } from '../core/settings';
import { Effects } from './effects';
import { CARD_H, CARD_W, getBare, getCard } from './sprites';

const FILES = 'abcdefgh';
const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const PALETTE = {
  light: '#8f6bc2',
  dark: '#43306e',
  lastMove: 'rgba(255, 210, 74, 0.45)',
  selected: 'rgba(255, 210, 74, 0.7)',
  legal: 'rgba(255, 210, 74, 0.85)',
  check: 'rgba(230, 57, 70, 0.75)',
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
  /** Modo "tocá una casilla" (lecciones de coordenadas): si está definido, los clics van acá en vez de seleccionar piezas. */
  onSquareClick?: (sq: Square) => void;
  /** Alto (px) que otros elementos de la pantalla ocupan fuera del tablero; limita su tamaño. Por defecto 200. */
  reserve?: number;
}

interface Anim {
  from: Square;
  to: Square;
  start: number;
  dur: number;
  kind: 'hop' | 'land';
  ghost?: { type: PieceSymbol; color: Color; sq: Square };
  impact?: () => void;
  impacted: boolean;
}

const FLIGHT = 0.72; // fracción de la animación que dura el vuelo; el resto es el "aplastón"

export class BoardView {
  private ctx: CanvasRenderingContext2D;
  private size = 0;
  private selected: Square | null = null;
  private legalTargets: Move[] = [];
  private drag: { from: Square; x: number; y: number; moved: boolean } | null = null;
  private hover: Square | null = null;
  private dirty = true;
  private arrow: { from: Square; to: Square } | null = null;
  private anims: Anim[] = [];
  private fx = new Effects();
  private seenPlies = 0;
  private lastWasDrag = false;
  private shaking = false;
  private marks = new Map<Square, string>();
  private raf = 0;
  private kbSq: Square = 'e2';
  private focused = false;
  private ro: ResizeObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    public opts: BoardOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.seenPlies = game.chess.history().length;
    // acceso por teclado y lectores de pantalla
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Tablero de ajedrez. Con las flechas te movés por las casillas; Enter o espacio selecciona una pieza y luego su destino; Escape cancela.');
    canvas.addEventListener('keydown', this.onKey);
    canvas.addEventListener('focus', () => { this.focused = true; this.invalidate(); });
    canvas.addEventListener('blur', () => { this.focused = false; this.invalidate(); });
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', () => this.cancelDrag());
    canvas.addEventListener('pointerleave', () => {
      this.hover = null;
      this.invalidate();
    });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement!);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  invalidate(): void {
    this.dirty = true;
  }

  setArrow(a: { from: Square; to: Square } | null): void {
    this.arrow = a;
    this.invalidate();
  }

  /** Pinta casillas con un color (p. ej. acierto/error en las lecciones). `{}` las limpia. */
  setMarks(marks: Record<string, string>): void {
    this.marks = new Map(Object.entries(marks) as [Square, string][]);
    this.invalidate();
  }

  /** Festejo: partículas y texto flotante en el centro del tablero. */
  celebrate(text = '¡BIEN!'): void {
    const now = performance.now();
    const s = this.size / 8;
    const colors = ['#ffd24a', '#fff4d6', '#3a86ff', '#e63946'];
    this.fx.burst(this.size / 2, this.size / 2, 60, colors, s * 6, Math.max(2, Math.round(s * 0.07)), now);
    this.fx.floatText(this.size / 2, this.size / 2, text, '#ffd24a', Math.round(s * 0.6), now, 1400);
    this.invalidate();
  }

  clearSelection(): void {
    this.selected = null;
    this.legalTargets = [];
    this.drag = null;
    this.invalidate();
  }

  /**
   * Llamar después de cualquier cambio en la partida. Detecta si se agregó UNA jugada
   * (y la anima con sonido/efectos) o si hubo deshacer / reinicio (sin animación).
   */
  sync(): void {
    const hist = this.game.chess.history({ verbose: true });
    if (hist.length === this.seenPlies + 1) {
      this.onNewMove(hist[hist.length - 1]!, this.lastWasDrag);
    } else if (hist.length !== this.seenPlies) {
      this.anims = [];
    }
    this.seenPlies = hist.length;
    this.lastWasDrag = false;
    this.invalidate();
  }

  // ---------- tamaño y coordenadas ----------
  private resize(): void {
    const parent = this.canvas.parentElement!;
    const avail = Math.min(parent.clientWidth, window.innerHeight - (this.opts.reserve ?? 240));
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

  private centerOf(sq: Square): { x: number; y: number } {
    const o = this.originOf(sq);
    const s = this.size / 8;
    return { x: o.x + s / 2, y: o.y + s / 2 };
  }

  private pointer(e: PointerEvent) {
    // offsetX/Y están en coordenadas locales del canvas: sirven también con la perspectiva 3D (CSS)
    return { x: e.offsetX, y: e.offsetY };
  }

  // ---------- input ----------
  private onDown = (e: PointerEvent): void => {
    if (this.opts.onSquareClick) {
      const p = this.pointer(e);
      const clicked = this.squareAt(p.x, p.y);
      if (clicked) this.opts.onSquareClick(clicked);
      return;
    }
    if (!this.opts.canInteract()) return;
    const { x, y } = this.pointer(e);
    const sq = this.squareAt(x, y);
    if (!sq) return;
    this.canvas.setPointerCapture(e.pointerId);

    if (this.selected && this.legalTargets.some((m) => m.to === sq)) {
      this.finishMove(this.selected, sq, false);
      return;
    }
    const piece = this.game.chess.get(sq);
    if (piece && piece.color === this.game.turn) {
      this.selected = sq;
      this.legalTargets = this.game.legalMovesFrom(sq);
      this.drag = { from: sq, x, y, moved: false };
      playSfx('hover');
    } else {
      this.clearSelection();
    }
    this.invalidate();
  };

  private onKey = (e: KeyboardEvent): void => {
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dir[e.key];
    if (d) {
      e.preventDefault();
      const flip = this.opts.flipped ? -1 : 1;
      const f = Math.min(7, Math.max(0, FILES.indexOf(this.kbSq[0]!) + d[0] * flip));
      const r = Math.min(8, Math.max(1, Number(this.kbSq[1]) + d[1] * flip));
      this.kbSq = `${FILES[f]}${r}` as Square;
      this.invalidate();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activate(this.kbSq);
    } else if (e.key === 'Escape') {
      this.clearSelection();
    }
  };

  /** Equivale a un clic en la casilla (teclado). */
  private activate(sq: Square): void {
    if (this.opts.onSquareClick) {
      this.opts.onSquareClick(sq);
      return;
    }
    if (!this.opts.canInteract()) return;
    if (this.selected && this.legalTargets.some((m) => m.to === sq)) {
      this.finishMove(this.selected, sq, false);
      return;
    }
    const piece = this.game.chess.get(sq);
    if (piece && piece.color === this.game.turn) {
      this.selected = sq;
      this.legalTargets = this.game.legalMovesFrom(sq);
      playSfx('hover');
    } else {
      this.clearSelection();
    }
    this.invalidate();
  }

  private onMove = (e: PointerEvent): void => {
    const { x, y } = this.pointer(e);
    if (this.drag) {
      this.drag.x = x;
      this.drag.y = y;
      this.drag.moved = true;
    } else if (e.pointerType === 'mouse') {
      const sq = this.squareAt(x, y);
      const has = sq && this.game.chess.get(sq);
      const next = has ? sq : null;
      if (next !== this.hover) {
        this.hover = next;
        if (next) playSfx('hover');
      }
    }
    this.invalidate();
  };

  private onUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const { x, y } = this.pointer(e);
    const sq = this.squareAt(x, y);
    if (d.moved && sq && sq !== d.from && this.legalTargets.some((m) => m.to === sq)) {
      this.finishMove(d.from, sq, true);
    } else {
      this.invalidate();
    }
  };

  private cancelDrag(): void {
    this.drag = null;
    this.invalidate();
  }

  private finishMove(from: Square, to: Square, viaDrag: boolean): void {
    this.lastWasDrag = viaDrag;
    const done = this.opts.onMoveAttempt(from, to);
    if (done) this.clearSelection();
    else this.invalidate();
  }

  // ---------- animación de jugadas ----------
  private onNewMove(m: Move, viaDrag: boolean): void {
    const now = performance.now();
    // si llega otra jugada antes de terminar la animación anterior, se cierra la anterior (con sus efectos)
    for (const a of this.anims) if (!a.impacted) a.impact?.();
    this.anims = [];
    const opponent: Color = m.color === 'w' ? 'b' : 'w';
    let ghost: Anim['ghost'];
    if (m.captured) {
      const capSq = m.flags.includes('e') ? (`${m.to[0]}${m.from[1]}` as Square) : m.to;
      ghost = { type: m.captured, color: opponent, sq: capSq };
    }
    const impact = () => this.impactEffects(m, ghost);
    this.anims.push({
      from: m.from,
      to: m.to,
      start: now,
      dur: viaDrag ? 220 : 340,
      kind: viaDrag ? 'land' : 'hop',
      ghost,
      impact,
      impacted: false,
    });
    // el enroque también mueve la torre
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rank = m.color === 'w' ? '1' : '8';
      const king = m.flags.includes('k');
      this.anims.push({
        from: `${king ? 'h' : 'a'}${rank}` as Square,
        to: `${king ? 'f' : 'd'}${rank}` as Square,
        start: now,
        dur: 300,
        kind: 'hop',
        impacted: true,
      });
    }
  }

  private impactEffects(m: Move, ghost: Anim['ghost']): void {
    const now = performance.now();
    const s = this.size / 8;
    const ps = Math.max(2, Math.round(s * 0.07));
    const c = this.centerOf(m.to);
    const mate = m.san.endsWith('#');
    const check = m.san.endsWith('+') || mate;
    const settings = loadSettings();

    if (ghost) {
      this.fx.burst(c.x, c.y, 22, ['#fff4d6', '#ffd24a', '#e63946'], s * 5, ps, now);
      const v = VALUE[ghost.type];
      if (v) this.fx.floatText(c.x, c.y - s * 0.4, `+${v}`, '#ffd24a', Math.round(s * 0.45), now);
      if (settings.shake) this.fx.shake(s * 0.15, now);
    }
    // al caer: polvo del color de la pieza + temblor del tablero, en TODA jugada
    const white = m.color === 'w';
    this.fx.dust(c.x, c.y + s * 0.32, ghost ? 18 : 16, white ? ['#fff4d6', '#8fb8ff', '#d8c8ff'] : ['#ffd24a', '#e63946', '#d8c8ff'], s * 3.2, ps, now);
    if (!ghost && settings.shake) this.fx.shake(s * 0.07, now);
    if (m.promotion) {
      this.fx.burst(c.x, c.y, 28, ['#ffd24a', '#fff4d6', '#3a86ff'], s * 4, ps, now);
      this.fx.floatText(c.x, c.y - s * 0.5, '¡CORONA!', '#ffd24a', Math.round(s * 0.34), now);
    }
    if (check) {
      const k = this.findKing(m.color === 'w' ? 'b' : 'w');
      if (k) {
        const kc = this.centerOf(k);
        this.fx.burst(kc.x, kc.y, mate ? 70 : 30, ['#e63946', '#ffd24a', '#fff4d6'], s * (mate ? 7 : 5), ps, now);
        this.fx.floatText(kc.x, kc.y - s * 0.6, mate ? '¡MATE!' : '¡JAQUE!', mate ? '#ffd24a' : '#e63946', Math.round(s * (mate ? 0.6 : 0.42)), now, mate ? 1800 : 1100);
        if (settings.shake) this.fx.shake(s * (mate ? 0.2 : 0.1), now);
      }
    }
    playSfx(mate ? 'mate' : check ? 'check' : m.promotion ? 'promote' : m.flags.includes('k') || m.flags.includes('q') ? 'castle' : ghost ? 'capture' : 'move');
  }

  private findKing(color: Color): Square | null {
    for (const row of this.game.chess.board())
      for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
    return null;
  }

  /** Avanza animaciones; devuelve true si hace falta seguir dibujando cuadros. */
  private updateFx(now: number): boolean {
    for (const a of this.anims) {
      const p = (now - a.start) / a.dur;
      const impactAt = a.kind === 'land' ? 0 : FLIGHT;
      if (!a.impacted && p >= impactAt) {
        a.impacted = true;
        a.impact?.();
      }
    }
    this.anims = this.anims.filter((a) => now - a.start < a.dur);

    const off = this.fx.shakeOffset(now);
    if (off.x !== 0 || off.y !== 0) {
      this.canvas.style.translate = `${off.x}px ${off.y}px`;
      this.shaking = true;
    } else if (this.shaking) {
      this.canvas.style.translate = '';
      this.shaking = false;
    }
    return this.anims.length > 0 || this.fx.active;
  }

  private frame = (now: number): void => {
    if (!this.canvas.isConnected) {
      this.dispose(); // la pantalla fue reemplazada: se libera el bucle
      return;
    }
    const animating = this.updateFx(now);
    if (this.dirty || animating || this.hover || this.selected || this.drag || this.focused) {
      this.draw(now);
      this.dirty = false;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }

  // ---------- dibujo ----------
  private draw(now: number): void {
    const { ctx } = this;
    const s = this.size / 8;
    const last = this.game.lastMove;
    const kingSq = this.game.checkedKing();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? PALETTE.light : PALETTE.dark;
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
    for (const [sq, color] of this.marks) fill(sq, color);
    if (this.selected) fill(this.selected, PALETTE.selected);
    const animatedTo = new Set(this.anims.map((a) => a.to));
    const draggedFrom = this.drag?.moved ? this.drag.from : null;

    // piezas quietas
    for (const row of this.game.chess.board()) {
      for (const p of row) {
        if (!p || animatedTo.has(p.square) || p.square === draggedFrom) continue;
        const c = this.centerOf(p.square);
        let rot = 0;
        let lift = 0;
        if (p.square === this.hover && !this.drag) {
          rot = Math.sin(now / 170) * 0.08;
          lift = s * 0.08;
        }
        if (p.square === this.selected) {
          rot = Math.sin(now / 210) * 0.05;
          lift = s * 0.06;
        }
        this.drawCard(p.type, p.color, c.x, c.y, s, { rot, lift });
      }
    }

    this.drawCoordinates(s);

    // piezas capturadas desvaneciéndose y piezas en vuelo
    for (const a of this.anims) {
      const p = (now - a.start) / a.dur;
      if (a.ghost && p < FLIGHT) {
        const f = p / FLIGHT;
        const c = this.centerOf(a.ghost.sq);
        ctx.globalAlpha = 1 - f;
        this.drawCard(a.ghost.type, a.ghost.color, c.x, c.y, s, { rot: f * 1.4, scale: 1 + f * 0.3 });
        ctx.globalAlpha = 1;
      }
    }
    for (const a of this.anims) this.drawAnimated(a, now, s);

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

    if (this.arrow) this.drawArrow(this.arrow.from, this.arrow.to, s);

    if (this.focused) {
      const o = this.originOf(this.kbSq);
      ctx.save();
      ctx.setLineDash([8, 5]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(o.x + 3, o.y + 3, s - 6, s - 6);
      ctx.restore();
    }

    if (this.drag?.moved) {
      const p = this.game.chess.get(this.drag.from);
      if (p) this.drawCard(p.type, p.color, this.drag.x, this.drag.y - s * 0.15, s, { scale: 1.12, rot: 0.05, lift: s * 0.1 });
    }

    this.fx.draw(ctx, now);
  }

  private drawAnimated(a: Anim, now: number, s: number): void {
    const piece = this.game.chess.get(a.to);
    if (!piece) return;
    const p = Math.min(1, (now - a.start) / a.dur);
    const from = this.centerOf(a.from);
    const to = this.centerOf(a.to);
    let x = to.x, y = to.y, lift = 0, sx = 1, sy = 1, rot = 0;
    let q: number; // progreso del aplastón al aterrizar
    if (a.kind === 'hop' && p < FLIGHT) {
      const f = p / FLIGHT;
      const at = (t: number) => {
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, arc: Math.sin(Math.PI * t) };
      };
      // estela: copias translúcidas que quedan atrás
      for (let i = 3; i >= 1; i--) {
        const t = f - i * 0.07;
        if (t <= 0) continue;
        const g = at(t);
        this.ctx.globalAlpha = 0.28 - i * 0.07;
        this.drawCard(piece.type, piece.color, g.x, g.y, s, { lift: g.arc * s * 0.45, sx: 0.95, sy: 1.1 });
      }
      this.ctx.globalAlpha = 1;
      const cur = at(f);
      x = cur.x;
      y = cur.y;
      lift = cur.arc * s * 0.45;
      sx = 1 - 0.14 * cur.arc;
      sy = 1 + 0.24 * cur.arc;
      rot = (to.x - from.x >= 0 ? 1 : -1) * cur.arc * 0.18;
    } else {
      q = a.kind === 'hop' ? (p - FLIGHT) / (1 - FLIGHT) : p;
      const k = Math.exp(-4 * q) * Math.cos(q * Math.PI * 2.5);
      const amp = a.kind === 'hop' ? 1 : 0.7;
      sy = 1 - 0.28 * k * amp;
      sx = 1 + 0.22 * k * amp;
    }
    this.drawCard(piece.type, piece.color, x, y, s, { lift, sx, sy, rot });
  }

  private drawCard(
    type: PieceSymbol,
    color: Color,
    cx: number,
    cy: number,
    s: number,
    o: { rot?: number; lift?: number; scale?: number; sx?: number; sy?: number } = {},
  ): void {
    const { ctx } = this;
    const bare = !loadSettings().pieceCards;
    const h = s * (bare ? 0.94 : 0.84);
    const w = bare ? h : (h * CARD_W) / CARD_H;
    const lift = o.lift ?? 0;
    const k = o.scale ?? 1;
    const sx = (o.sx ?? 1) * k;
    const sy = (o.sy ?? 1) * k;
    ctx.imageSmoothingEnabled = false;
    if (bare) {
      // sombra elíptica en el suelo; se achica y separa al levantar la pieza
      ctx.save();
      ctx.translate(cx + lift * 0.3, cy + h * 0.4);
      ctx.scale(sx, 1);
      ctx.fillStyle = 'rgba(7, 3, 13, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.36 * (1 - lift / (s * 3)), h * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy - lift);
      ctx.rotate(o.rot ?? 0);
      ctx.scale(sx, sy);
      ctx.drawImage(getBare(type, color), -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    const card = getCard(type, color);
    // sombra (queda en el suelo; se separa a medida que la carta se levanta)
    ctx.save();
    ctx.translate(cx + s * 0.03 + lift * 0.4, cy + s * 0.05 + lift * 0.4);
    ctx.scale(sx, sy);
    ctx.fillStyle = 'rgba(7, 3, 13, 0.38)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    // carta
    ctx.save();
    ctx.translate(cx, cy - lift);
    ctx.rotate(o.rot ?? 0);
    ctx.scale(sx, sy);
    ctx.drawImage(card, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private drawArrow(from: Square, to: Square, s: number): void {
    const { ctx } = this;
    const a = this.centerOf(from);
    const b = this.centerOf(to);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = s * 0.34;
    const ex = b.x - Math.cos(ang) * head * 0.6;
    const ey = b.y - Math.sin(ang) * head * 0.6;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#3a86ff';
    ctx.fillStyle = '#3a86ff';
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang - 0.5) * head, b.y - Math.sin(ang - 0.5) * head);
    ctx.lineTo(b.x - Math.cos(ang + 0.5) * head, b.y - Math.sin(ang + 0.5) * head);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCoordinates(s: number): void {
    const { ctx } = this;
    ctx.font = `bold ${Math.floor(s * 0.2)}px "Pixelify Sans", monospace`;
    ctx.textBaseline = 'top';
    for (let i = 0; i < 8; i++) {
      const fileIdx = this.opts.flipped ? 7 - i : i;
      const rank = this.opts.flipped ? i + 1 : 8 - i;
      ctx.fillStyle = (7 + i) % 2 === 0 ? PALETTE.coordLight : PALETTE.coordDark;
      ctx.textAlign = 'right';
      ctx.fillText(FILES[fileIdx]!, (i + 1) * s - 3, 7 * s + s - s * 0.24);
      ctx.fillStyle = i % 2 === 0 ? PALETTE.coordLight : PALETTE.coordDark;
      ctx.textAlign = 'left';
      ctx.fillText(String(rank), 3, i * s + 2);
    }
  }
}
