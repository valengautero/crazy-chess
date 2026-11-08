import { Chess } from 'chess.js';
import {
  EMOTES, MAX_CHAT_LENGTH,
  type ClockConfig, type Color, type EmoteId, type ErrorCode, type GameResult,
  type ResultReason, type RoomSnapshot, type ServerMsg,
} from '@chess-pixel/shared';

export interface Conn {
  send(msg: ServerMsg): void;
  close(): void;
}

interface Seat {
  token: string;
  conn: Conn | null;
  disconnectedAt: number | null;
  chatTimes: number[];
}

export type Outcome<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

const SQUARE = /^[a-h][1-8]$/;
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export const DISCONNECT_GRACE_MS = 60_000;
const CHAT_WINDOW_MS = 5_000;
const CHAT_MAX_IN_WINDOW = 5;

/**
 * Una sala = una partida entre dos jugadores. No conoce WebSockets (solo `Conn`) ni usa timers propios:
 * el tiempo entra por `now()` y `tick()`, así que todo es testeable de forma determinista.
 * El servidor valida cada jugada con chess.js y es la fuente de verdad.
 */
export class Room {
  readonly code: string;
  private chess = new Chess();
  private seats: Record<Color, Seat | null> = { w: null, b: null };
  private firstColor: Color;
  phase: 'waiting' | 'playing' | 'over' = 'waiting';
  private result: GameResult | null = null;
  private moves: string[] = [];
  private drawOffer: Color | null = null;
  private rematchVotes: Record<Color, boolean> = { w: false, b: false };
  private clockCfg: ClockConfig | null;
  private clockMs: Record<Color, number> = { w: 0, b: 0 };
  private clockRunning: Color | null = null;
  private clockAt = 0;
  lastActivity: number;

  constructor(
    code: string,
    opts: { clock: ClockConfig | null; color: Color },
    private now: () => number,
  ) {
    this.code = code;
    this.clockCfg = opts.clock;
    this.firstColor = opts.color;
    this.lastActivity = now();
    this.resetClock();
  }

  // ---------- conexión ----------
  join(token: string, conn: Conn): Outcome<{ color: Color }> {
    this.lastActivity = this.now();
    for (const c of ['w', 'b'] as Color[]) {
      const seat = this.seats[c];
      if (seat && seat.token === token) {
        // reconexión: la conexión nueva reemplaza a la vieja
        if (seat.conn && seat.conn !== conn) seat.conn.close();
        seat.conn = conn;
        seat.disconnectedAt = null;
        this.broadcast();
        return { ok: true, color: c };
      }
    }
    const color = !this.seats[this.firstColor] ? this.firstColor : !this.seats[other(this.firstColor)] ? other(this.firstColor) : null;
    if (!color) return { ok: false, error: 'room-full' };
    this.seats[color] = { token, conn, disconnectedAt: null, chatTimes: [] };
    if (this.seats.w && this.seats.b && this.phase === 'waiting') this.startGame();
    this.broadcast();
    return { ok: true, color };
  }

  /** La conexión se cayó. El asiento se conserva para poder reconectar. */
  detach(conn: Conn): void {
    for (const c of ['w', 'b'] as Color[]) {
      const seat = this.seats[c];
      if (seat && seat.conn === conn) {
        seat.conn = null;
        seat.disconnectedAt = this.now();
        this.broadcast();
      }
    }
  }

  get isEmpty(): boolean {
    return !this.seats.w?.conn && !this.seats.b?.conn;
  }

  colorOf(token: string): Color | null {
    for (const c of ['w', 'b'] as Color[]) if (this.seats[c]?.token === token) return c;
    return null;
  }

  // ---------- partida ----------
  private startGame(): void {
    this.phase = 'playing';
    this.result = null;
    this.chess = new Chess();
    this.moves = [];
    this.drawOffer = null;
    this.rematchVotes = { w: false, b: false };
    this.resetClock();
    if (this.clockCfg) {
      this.clockRunning = 'w';
      this.clockAt = this.now();
    }
  }

  private resetClock(): void {
    const ms = this.clockCfg ? this.clockCfg.minutes * 60_000 : 0;
    this.clockMs = { w: ms, b: ms };
    this.clockRunning = null;
  }

  private remaining(c: Color): number {
    if (!this.clockCfg) return Infinity;
    if (this.clockRunning === c) return this.clockMs[c] - (this.now() - this.clockAt);
    return this.clockMs[c];
  }

  move(color: Color, m: { from: unknown; to: unknown; promotion?: unknown; ply: unknown }): Outcome {
    if (this.phase === 'waiting') return { ok: false, error: 'not-started' };
    if (this.phase === 'over') return { ok: false, error: 'game-over' };
    if (typeof m.from !== 'string' || typeof m.to !== 'string' || !SQUARE.test(m.from) || !SQUARE.test(m.to))
      return { ok: false, error: 'bad-request' };
    if (m.promotion !== undefined && (typeof m.promotion !== 'string' || !/^[qrbn]$/.test(m.promotion)))
      return { ok: false, error: 'bad-request' };
    if (this.chess.turn() !== color) return { ok: false, error: 'not-your-turn' };
    if (m.ply !== this.moves.length) return { ok: false, error: 'stale' };

    // ¿se le acabó el tiempo antes de mover?
    if (this.clockCfg && this.remaining(color) <= 0) {
      this.finish(other(color), 'timeout');
      this.broadcast();
      return { ok: false, error: 'game-over' };
    }

    let made;
    try {
      made = this.chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      return { ok: false, error: 'illegal' };
    }
    this.lastActivity = this.now();
    this.moves.push(made.lan);
    this.drawOffer = null; // mover equivale a rechazar la oferta pendiente

    if (this.clockCfg) {
      const t = this.now();
      this.clockMs[color] = this.clockMs[color] - (t - this.clockAt) + this.clockCfg.incrementSec * 1000;
      this.clockAt = t;
      this.clockRunning = other(color);
    }

    if (this.chess.isCheckmate()) this.finish(color, 'checkmate');
    else if (this.chess.isStalemate()) this.finish(null, 'stalemate');
    else if (this.chess.isThreefoldRepetition()) this.finish(null, 'threefold');
    else if (this.chess.isInsufficientMaterial()) this.finish(null, 'insufficient');
    else if (this.chess.isDrawByFiftyMoves()) this.finish(null, 'fifty');
    this.broadcast();
    return { ok: true };
  }

  private finish(winner: Color | null, reason: ResultReason): void {
    this.phase = 'over';
    this.result = { winner, reason };
    this.drawOffer = null;
    if (this.clockCfg && this.clockRunning) {
      this.clockMs[this.clockRunning] = Math.max(0, this.remaining(this.clockRunning));
    }
    this.clockRunning = null;
  }

  resign(color: Color): Outcome {
    if (this.phase !== 'playing') return { ok: false, error: this.phase === 'over' ? 'game-over' : 'not-started' };
    this.finish(other(color), 'resign');
    this.broadcast();
    return { ok: true };
  }

  offerDraw(color: Color): Outcome {
    if (this.phase !== 'playing') return { ok: false, error: this.phase === 'over' ? 'game-over' : 'not-started' };
    if (this.drawOffer === null) this.drawOffer = color;
    else if (this.drawOffer !== color) return this.acceptDraw(color); // ofertas cruzadas = acuerdo
    this.broadcast();
    return { ok: true };
  }

  acceptDraw(color: Color): Outcome {
    if (this.phase !== 'playing') return { ok: false, error: this.phase === 'over' ? 'game-over' : 'not-started' };
    if (this.drawOffer === null || this.drawOffer === color) return { ok: false, error: 'no-draw-offer' };
    this.finish(null, 'agreement');
    this.broadcast();
    return { ok: true };
  }

  declineDraw(color: Color): Outcome {
    if (this.drawOffer === null || this.drawOffer === color) return { ok: false, error: 'no-draw-offer' };
    this.drawOffer = null;
    this.broadcast();
    return { ok: true };
  }

  /** Revancha: cuando votan los dos, se intercambian los colores y arranca otra partida. */
  rematch(color: Color): Outcome {
    if (this.phase !== 'over') return { ok: false, error: this.phase === 'playing' ? 'bad-request' : 'not-started' };
    this.rematchVotes[color] = true;
    if (this.rematchVotes.w && this.rematchVotes.b) {
      const { w, b } = this.seats;
      this.seats = { w: b, b: w };
      this.startGame();
    }
    this.broadcast();
    return { ok: true };
  }

  chat(color: Color, kind: 'text' | 'emote', payload: unknown): Outcome {
    const seat = this.seats[color];
    if (!seat) return { ok: false, error: 'not-in-room' };
    let text: string;
    if (kind === 'emote') {
      if (typeof payload !== 'string' || !(EMOTES as readonly string[]).includes(payload as EmoteId))
        return { ok: false, error: 'bad-request' };
      text = payload;
    } else {
      if (typeof payload !== 'string') return { ok: false, error: 'bad-request' };
      text = payload.trim().slice(0, MAX_CHAT_LENGTH);
      if (!text) return { ok: false, error: 'bad-request' };
    }
    const t = this.now();
    seat.chatTimes = seat.chatTimes.filter((x) => t - x < CHAT_WINDOW_MS);
    if (seat.chatTimes.length >= CHAT_MAX_IN_WINDOW) return { ok: false, error: 'rate-limited' };
    seat.chatTimes.push(t);
    this.lastActivity = t;
    this.sendAll({ t: 'chat', from: color, kind, text });
    return { ok: true };
  }

  /** Se llama una vez por segundo: caída de bandera y abandono por desconexión. */
  tick(): void {
    if (this.phase !== 'playing') return;
    const t = this.now();
    if (this.clockCfg && this.clockRunning && this.remaining(this.clockRunning) <= 0) {
      this.finish(other(this.clockRunning), 'timeout');
      this.broadcast();
      return;
    }
    for (const c of ['w', 'b'] as Color[]) {
      const seat = this.seats[c];
      if (seat && seat.disconnectedAt !== null && t - seat.disconnectedAt >= DISCONNECT_GRACE_MS) {
        this.finish(other(c), 'abandoned');
        this.broadcast();
        return;
      }
    }
  }

  // ---------- sincronización ----------
  snapshotFor(color: Color): RoomSnapshot {
    const clock = this.clockCfg
      ? {
          w: Math.max(0, Math.round(this.remaining('w'))),
          b: Math.max(0, Math.round(this.remaining('b'))),
          running: this.clockRunning,
          incrementMs: this.clockCfg.incrementSec * 1000,
        }
      : null;
    return {
      code: this.code,
      you: color,
      phase: this.phase,
      moves: [...this.moves],
      fen: this.chess.fen(),
      turn: this.chess.turn(),
      result: this.result,
      clock,
      connected: { w: !!this.seats.w?.conn, b: !!this.seats.b?.conn },
      drawOffer: this.drawOffer,
      rematch: { ...this.rematchVotes },
    };
  }

  broadcast(): void {
    for (const c of ['w', 'b'] as Color[]) {
      this.seats[c]?.conn?.send({ t: 'state', s: this.snapshotFor(c) });
    }
  }

  sendState(color: Color): void {
    this.seats[color]?.conn?.send({ t: 'state', s: this.snapshotFor(color) });
  }

  private sendAll(msg: ServerMsg): void {
    for (const c of ['w', 'b'] as Color[]) this.seats[c]?.conn?.send(msg);
  }
}
