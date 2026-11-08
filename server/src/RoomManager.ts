import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type ClockConfig, type Color } from '@chess-pixel/shared';
import { Room } from './Room';

const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const IDLE_ROOM_TTL_MS = 3 * 60 * 60_000;
const MAX_ROOMS = 2000;

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(
    private now: () => number = Date.now,
    private rng: () => number = Math.random,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  private newCode(): string | null {
    for (let i = 0; i < 50; i++) {
      let code = '';
      for (let j = 0; j < ROOM_CODE_LENGTH; j++)
        code += ROOM_CODE_ALPHABET[Math.floor(this.rng() * ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  create(opts: { clock: ClockConfig | null; color: Color | 'random' }): Room | null {
    if (this.rooms.size >= MAX_ROOMS) return null;
    const code = this.newCode();
    if (!code) return null;
    const color: Color = opts.color === 'random' ? (this.rng() < 0.5 ? 'w' : 'b') : opts.color;
    const room = new Room(code, { clock: opts.clock, color }, this.now);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  tick(): void {
    for (const room of this.rooms.values()) room.tick();
  }

  /** Borra salas vacías hace mucho o sin actividad. */
  sweep(): number {
    const t = this.now();
    let removed = 0;
    for (const [code, room] of this.rooms) {
      const idle = t - room.lastActivity;
      if ((room.isEmpty && idle > EMPTY_ROOM_TTL_MS) || idle > IDLE_ROOM_TTL_MS) {
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }
}
