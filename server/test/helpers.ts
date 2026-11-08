import type { ServerMsg, RoomSnapshot } from '@chess-pixel/shared';
import type { Conn } from '../src/Room';

export class FakeConn implements Conn {
  msgs: ServerMsg[] = [];
  closed = false;
  send(m: ServerMsg) { this.msgs.push(m); }
  close() { this.closed = true; }
  get lastState(): RoomSnapshot {
    const s = [...this.msgs].reverse().find((m) => m.t === 'state');
    if (!s || s.t !== 'state') throw new Error('sin estado');
    return s.s;
  }
  get chats() { return this.msgs.filter((m) => m.t === 'chat'); }
}

export function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}
