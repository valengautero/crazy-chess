import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@chess-pixel/shared';
import { RoomManager } from '../src/RoomManager';
import { FakeConn, clock } from './helpers';

describe('RoomManager', () => {
  it('genera códigos únicos con el alfabeto sin ambigüedades', () => {
    const m = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const r = m.create({ clock: null, color: 'random' })!;
      expect(r.code).toHaveLength(ROOM_CODE_LENGTH);
      for (const ch of r.code) expect(ROOM_CODE_ALPHABET).toContain(ch);
      codes.add(r.code);
    }
    expect(codes.size).toBe(300);
    expect(m.size).toBe(300);
  });

  it('reintenta si el código aleatorio ya existe', () => {
    const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    const m = new RoomManager(Date.now, () => seq[i++ % seq.length]!);
    const a = m.create({ clock: null, color: 'w' })!;
    const b = m.create({ clock: null, color: 'w' })!;
    expect(a.code).not.toBe(b.code);
  });

  it('busca sin distinguir mayúsculas', () => {
    const m = new RoomManager();
    const r = m.create({ clock: null, color: 'w' })!;
    expect(m.get(r.code.toLowerCase())).toBe(r);
    expect(m.get('ZZZZ')).toBeUndefined();
  });

  it('sweep borra salas vacías viejas pero no las que tienen gente', () => {
    const c = clock();
    const m = new RoomManager(c.now);
    const empty = m.create({ clock: null, color: 'w' })!;
    const busy = m.create({ clock: null, color: 'w' })!;
    const conn = new FakeConn();
    busy.join('token-aaaaaaaa', conn);
    c.advance(5 * 60_000);
    expect(m.sweep()).toBe(0);
    c.advance(6 * 60_000);
    expect(m.sweep()).toBe(1);
    expect(m.get(empty.code)).toBeUndefined();
    expect(m.get(busy.code)).toBe(busy);
  });

  it('tick() hace caer banderas en todas las salas', () => {
    const c = clock();
    const m = new RoomManager(c.now);
    const r = m.create({ clock: { minutes: 1, incrementSec: 0 }, color: 'w' })!;
    const a = new FakeConn();
    r.join('token-aaaaaaaa', a);
    r.join('token-bbbbbbbb', new FakeConn());
    c.advance(61_000);
    m.tick();
    expect(a.lastState.result?.reason).toBe('timeout');
  });
});
