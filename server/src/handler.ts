import { ROOM_CODE_LENGTH, type ClientMsg, type ClockConfig, type ErrorCode } from '@chess-pixel/shared';
import type { Conn, Outcome, Room } from './Room';
import type { RoomManager } from './RoomManager';

/** Estado de una conexión WebSocket. */
export interface Session {
  conn: Conn;
  room: Room | null;
  token: string | null;
}

const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

function parseClock(x: unknown): ClockConfig | null | undefined {
  if (x === null) return null;
  if (!isObj(x)) return undefined;
  const { minutes, incrementSec } = x;
  if (!Number.isInteger(minutes) || !Number.isInteger(incrementSec)) return undefined;
  if ((minutes as number) < 1 || (minutes as number) > 180 || (incrementSec as number) < 0 || (incrementSec as number) > 60)
    return undefined;
  return { minutes: minutes as number, incrementSec: incrementSec as number };
}

/** Interpreta un mensaje crudo del cliente. Nunca lanza: los errores se devuelven por `conn.send`. */
export function handleMessage(manager: RoomManager, s: Session, raw: string): void {
  const err = (code: ErrorCode) => s.conn.send({ t: 'error', code });
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return err('bad-request');
  }
  if (!isObj(msg) || typeof msg.t !== 'string') return err('bad-request');
  const m = msg as unknown as ClientMsg & Record<string, unknown>;

  if (m.t === 'create') {
    if (s.room) return err('already-in-room');
    const clock = parseClock(m.clock);
    if (clock === undefined || typeof m.token !== 'string' || !TOKEN.test(m.token)) return err('bad-request');
    if (m.color !== 'w' && m.color !== 'b' && m.color !== 'random') return err('bad-request');
    const room = manager.create({ clock, color: m.color });
    if (!room) return err('bad-request');
    const r = room.join(m.token, s.conn);
    if (r.ok) {
      s.room = room;
      s.token = m.token;
    }
    return;
  }

  if (m.t === 'join') {
    if (s.room) return err('already-in-room');
    if (typeof m.token !== 'string' || !TOKEN.test(m.token)) return err('bad-request');
    if (typeof m.code !== 'string' || m.code.length !== ROOM_CODE_LENGTH) return err('bad-request');
    const room = manager.get(m.code);
    if (!room) return err('no-room');
    const r = room.join(m.token, s.conn);
    if (!r.ok) return err(r.error);
    s.room = room;
    s.token = m.token;
    return;
  }

  const room = s.room;
  if (!room) return err('not-in-room');
  // el color puede haber cambiado por una revancha: se consulta siempre al asiento por token
  const color = room.colorOf(s.token!);
  if (!color) return err('not-in-room');
  const done = (o: Outcome) => {
    if (!o.ok) {
      err(o.error);
      room.sendState(color); // re-sincroniza al cliente que se desvió
    }
  };

  switch (m.t) {
    case 'move':
      return done(room.move(color, { from: m.from, to: m.to, promotion: m.promotion, ply: m.ply }));
    case 'resign':
      return done(room.resign(color));
    case 'draw-offer':
      return done(room.offerDraw(color));
    case 'draw-accept':
      return done(room.acceptDraw(color));
    case 'draw-decline':
      return done(room.declineDraw(color));
    case 'rematch': {
      const r = room.rematch(color);
      if (!r.ok) return err(r.error);
      return;
    }
    case 'chat': {
      const r = room.chat(color, 'text', m.text);
      if (!r.ok) err(r.error);
      return;
    }
    case 'emote': {
      const r = room.chat(color, 'emote', m.id);
      if (!r.ok) err(r.error);
      return;
    }
    case 'sync':
      return room.sendState(color);
    default:
      return err('bad-request');
  }
}
