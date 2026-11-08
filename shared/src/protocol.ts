import type { Color } from './types';

export const ROOM_CODE_LENGTH = 4;
/** Sin letras ambiguas (I, L, O). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const MAX_CHAT_LENGTH = 120;
export const EMOTES = ['gg', 'nice', 'oops', 'think', 'wow', 'hi'] as const;
export type EmoteId = (typeof EMOTES)[number];

export interface ClockConfig {
  /** Tiempo inicial por jugador, en minutos. */
  minutes: number;
  /** Incremento por jugada, en segundos. */
  incrementSec: number;
}

export type ResultReason =
  | 'checkmate' | 'stalemate' | 'threefold' | 'insufficient' | 'fifty'
  | 'timeout' | 'resign' | 'agreement' | 'abandoned';

export interface GameResult {
  /** null = tablas */
  winner: Color | null;
  reason: ResultReason;
}

/** Estado completo de la sala, desde el punto de vista de `you`. El servidor es la fuente de verdad. */
export interface RoomSnapshot {
  code: string;
  you: Color;
  phase: 'waiting' | 'playing' | 'over';
  /** Jugadas en notación UCI ("e2e4", "e7e8q"). El cliente las reproduce desde la posición inicial. */
  moves: string[];
  fen: string;
  turn: Color;
  result: GameResult | null;
  /** Milisegundos restantes de cada jugador en el momento del snapshot. null = sin reloj. */
  clock: { w: number; b: number; running: Color | null; incrementMs: number } | null;
  connected: { w: boolean; b: boolean };
  drawOffer: Color | null;
  rematch: { w: boolean; b: boolean };
}

export type ClientMsg =
  | { t: 'create'; token: string; clock: ClockConfig | null; color: Color | 'random' }
  | { t: 'join'; token: string; code: string }
  | { t: 'move'; from: string; to: string; promotion?: string; ply: number }
  | { t: 'resign' }
  | { t: 'draw-offer' }
  | { t: 'draw-accept' }
  | { t: 'draw-decline' }
  | { t: 'rematch' }
  | { t: 'chat'; text: string }
  | { t: 'emote'; id: EmoteId }
  | { t: 'sync' };

export type ErrorCode =
  | 'bad-request' | 'no-room' | 'room-full' | 'already-in-room' | 'not-in-room'
  | 'illegal' | 'not-your-turn' | 'stale' | 'game-over' | 'not-started'
  | 'rate-limited' | 'no-draw-offer';

export type ServerMsg =
  | { t: 'state'; s: RoomSnapshot }
  | { t: 'chat'; from: Color; kind: 'text' | 'emote'; text: string }
  | { t: 'error'; code: ErrorCode };
