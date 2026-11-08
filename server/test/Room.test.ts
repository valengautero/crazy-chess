import { describe, expect, it } from 'vitest';
import { DISCONNECT_GRACE_MS, Room } from '../src/Room';
import { FakeConn, clock } from './helpers';

function setup(opts: { clock?: { minutes: number; incrementSec: number } | null; color?: 'w' | 'b' } = {}) {
  const c = clock();
  const room = new Room('ABCD', { clock: opts.clock ?? null, color: opts.color ?? 'w' }, c.now);
  const a = new FakeConn();
  const b = new FakeConn();
  const ra = room.join('token-aaaaaaaa', a);
  const rb = room.join('token-bbbbbbbb', b);
  return { c, room, a, b, ra, rb };
}
const mv = (room: Room, color: 'w' | 'b', from: string, to: string, ply: number, promotion?: string) =>
  room.move(color, { from, to, ply, promotion });

describe('Room: unirse', () => {
  it('asigna colores: el creador elige el suyo y el segundo recibe el otro', () => {
    const { ra, rb, room } = setup({ color: 'b' });
    expect(ra).toEqual({ ok: true, color: 'b' });
    expect(rb).toEqual({ ok: true, color: 'w' });
    expect(room.phase).toBe('playing');
  });

  it('con un solo jugador la sala espera', () => {
    const room = new Room('ABCD', { clock: null, color: 'w' }, clock().now);
    const a = new FakeConn();
    room.join('token-aaaaaaaa', a);
    expect(room.phase).toBe('waiting');
    expect(a.lastState.phase).toBe('waiting');
  });

  it('rechaza un tercer jugador pero deja reconectar a los existentes', () => {
    const { room, a } = setup();
    expect(room.join('token-cccccccc', new FakeConn())).toEqual({ ok: false, error: 'room-full' });
    const a2 = new FakeConn();
    expect(room.join('token-aaaaaaaa', a2)).toEqual({ ok: true, color: 'w' });
    expect(a.closed).toBe(true); // la conexión vieja se cierra
  });
});

describe('Room: validación de jugadas (el servidor es la fuente de verdad)', () => {
  it('acepta jugadas legales y alterna turnos', () => {
    const { room, a, b } = setup();
    expect(mv(room, 'w', 'e2', 'e4', 0)).toEqual({ ok: true });
    expect(mv(room, 'b', 'e7', 'e5', 1)).toEqual({ ok: true });
    expect(a.lastState.moves).toEqual(['e2e4', 'e7e5']);
    expect(b.lastState.turn).toBe('w');
  });

  it('rechaza jugadas ilegales, fuera de turno, viejas y mal formadas', () => {
    const { room } = setup();
    expect(mv(room, 'w', 'e2', 'e5', 0)).toEqual({ ok: false, error: 'illegal' });
    expect(mv(room, 'b', 'e7', 'e5', 0)).toEqual({ ok: false, error: 'not-your-turn' });
    expect(mv(room, 'w', 'e2', 'e4', 3)).toEqual({ ok: false, error: 'stale' });
    expect(mv(room, 'w', 'z9', 'e4', 0)).toEqual({ ok: false, error: 'bad-request' });
    expect(mv(room, 'w', 'e2', 'e4', 0, 'x')).toEqual({ ok: false, error: 'bad-request' });
    expect(room.snapshotFor('w').moves).toEqual([]);
  });

  it('no deja mover antes de que haya dos jugadores', () => {
    const room = new Room('ABCD', { clock: null, color: 'w' }, clock().now);
    room.join('token-aaaaaaaa', new FakeConn());
    expect(mv(room, 'w', 'e2', 'e4', 0)).toEqual({ ok: false, error: 'not-started' });
  });

  it('detecta jaque mate (mate del loco) y bloquea más jugadas', () => {
    const { room, a } = setup();
    mv(room, 'w', 'f2', 'f3', 0); mv(room, 'b', 'e7', 'e5', 1);
    mv(room, 'w', 'g2', 'g4', 2); mv(room, 'b', 'd8', 'h4', 3);
    expect(a.lastState.phase).toBe('over');
    expect(a.lastState.result).toEqual({ winner: 'b', reason: 'checkmate' });
    expect(mv(room, 'w', 'a2', 'a3', 4)).toEqual({ ok: false, error: 'game-over' });
  });

  it('maneja promoción', () => {
    const { room } = setup();
    // peón blanco llega a la 7ª y promociona capturando en b8
    for (const [c, f, t] of [
      ['w', 'a2', 'a4'], ['b', 'b7', 'b5'], ['w', 'a4', 'b5'], ['b', 'a7', 'a6'],
      ['w', 'b5', 'a6'], ['b', 'g8', 'f6'], ['w', 'a6', 'a7'], ['b', 'f6', 'g8'],
    ] as const) mv(room, c, f, t, room.snapshotFor('w').moves.length);
    expect(mv(room, 'w', 'a7', 'b8', 8)).toEqual({ ok: false, error: 'illegal' }); // sin pieza de promoción
    expect(mv(room, 'w', 'a7', 'b8', 8, 'q')).toEqual({ ok: true });
    expect(room.snapshotFor('w').moves.at(-1)).toBe('a7b8q');
  });
});

describe('Room: rendirse, tablas y revancha', () => {
  it('rendirse da la victoria al rival', () => {
    const { room, a } = setup();
    room.resign('w');
    expect(a.lastState.result).toEqual({ winner: 'b', reason: 'resign' });
  });

  it('oferta de tablas: aceptar termina, rechazar la limpia, mover la cancela', () => {
    const { room, a, b } = setup();
    room.offerDraw('w');
    expect(b.lastState.drawOffer).toBe('w');
    expect(room.acceptDraw('w')).toEqual({ ok: false, error: 'no-draw-offer' }); // no puede aceptar la propia
    room.declineDraw('b');
    expect(a.lastState.drawOffer).toBeNull();

    room.offerDraw('w');
    mv(room, 'w', 'e2', 'e4', 0);
    expect(a.lastState.drawOffer).toBeNull();

    room.offerDraw('b');
    room.acceptDraw('w');
    expect(a.lastState.result).toEqual({ winner: null, reason: 'agreement' });
  });

  it('ofertas cruzadas equivalen a un acuerdo', () => {
    const { room, a } = setup();
    room.offerDraw('w');
    room.offerDraw('b');
    expect(a.lastState.result?.reason).toBe('agreement');
  });

  it('revancha: necesita a los dos, intercambia colores y reinicia', () => {
    const { room, a, b } = setup();
    mv(room, 'w', 'e2', 'e4', 0);
    expect(room.rematch('w')).toMatchObject({ ok: false }); // no se puede en plena partida
    room.resign('w');
    room.rematch('w');
    expect(a.lastState.rematch).toEqual({ w: true, b: false });
    expect(a.lastState.phase).toBe('over');
    room.rematch('b');
    expect(a.lastState.phase).toBe('playing');
    expect(a.lastState.moves).toEqual([]);
    expect(a.lastState.you).toBe('b'); // colores intercambiados
    expect(b.lastState.you).toBe('w');
    expect(room.colorOf('token-aaaaaaaa')).toBe('b');
  });
});

describe('Room: reloj', () => {
  it('descuenta el tiempo del que mueve y suma el incremento', () => {
    const { c, room, a } = setup({ clock: { minutes: 5, incrementSec: 3 } });
    expect(a.lastState.clock).toMatchObject({ w: 300_000, b: 300_000, running: 'w' });
    c.advance(10_000);
    mv(room, 'w', 'e2', 'e4', 0);
    const s = a.lastState;
    expect(s.clock).toMatchObject({ w: 293_000, b: 300_000, running: 'b' }); // -10s +3s
    c.advance(4_000);
    expect(room.snapshotFor('b').clock!.b).toBe(296_000); // el reloj del que piensa sigue corriendo
  });

  it('cae la bandera por tick()', () => {
    const { c, room, a } = setup({ clock: { minutes: 1, incrementSec: 0 } });
    c.advance(59_000);
    room.tick();
    expect(a.lastState.phase).toBe('playing');
    c.advance(1_500);
    room.tick();
    expect(a.lastState.result).toEqual({ winner: 'b', reason: 'timeout' });
    expect(a.lastState.clock!.running).toBeNull();
  });

  it('una jugada tardía con la bandera caída pierde por tiempo', () => {
    const { c, room, a } = setup({ clock: { minutes: 1, incrementSec: 0 } });
    c.advance(61_000);
    expect(mv(room, 'w', 'e2', 'e4', 0)).toEqual({ ok: false, error: 'game-over' });
    expect(a.lastState.result?.reason).toBe('timeout');
  });
});

describe('Room: desconexión y reconexión', () => {
  it('conserva el asiento y entrega el estado actual al reconectar', () => {
    const { room, a, b } = setup();
    mv(room, 'w', 'e2', 'e4', 0);
    room.detach(b);
    expect(a.lastState.connected).toEqual({ w: true, b: false });
    mv(room, 'w', 'd2', 'd4', 1) // el turno es de negras, debe fallar
    ;
    const b2 = new FakeConn();
    expect(room.join('token-bbbbbbbb', b2)).toEqual({ ok: true, color: 'b' });
    expect(b2.lastState.moves).toEqual(['e2e4']);
    expect(b2.lastState.fen).toBe(room.snapshotFor('b').fen);
    expect(a.lastState.connected.b).toBe(true);
  });

  it('abandona si no vuelve dentro del período de gracia', () => {
    const { c, room, a, b } = setup();
    room.detach(b);
    c.advance(DISCONNECT_GRACE_MS - 1000);
    room.tick();
    expect(a.lastState.phase).toBe('playing');
    c.advance(1000);
    room.tick();
    expect(a.lastState.result).toEqual({ winner: 'w', reason: 'abandoned' });
  });

  it('volver a tiempo cancela el abandono', () => {
    const { c, room, a, b } = setup();
    room.detach(b);
    c.advance(DISCONNECT_GRACE_MS - 1000);
    room.join('token-bbbbbbbb', new FakeConn());
    c.advance(5000);
    room.tick();
    expect(a.lastState.phase).toBe('playing');
  });

  it('una conexión vieja que se cierra después de reconectar no desconecta al jugador', () => {
    const { room, a, b } = setup();
    const b2 = new FakeConn();
    room.join('token-bbbbbbbb', b2);
    room.detach(b); // llega el "close" tardío del socket viejo
    expect(a.lastState.connected.b).toBe(true);
  });
});

describe('Room: chat', () => {
  it('envía texto y emotes a los dos, valida y limita la frecuencia', () => {
    const { room, a, b } = setup();
    expect(room.chat('w', 'text', '  hola  ')).toEqual({ ok: true });
    expect(room.chat('b', 'emote', 'gg')).toEqual({ ok: true });
    expect(room.chat('b', 'emote', 'hack')).toEqual({ ok: false, error: 'bad-request' });
    expect(room.chat('w', 'text', '   ')).toEqual({ ok: false, error: 'bad-request' });
    expect(a.chats[0]).toEqual({ t: 'chat', from: 'w', kind: 'text', text: 'hola' });
    expect(b.chats).toHaveLength(2);
    for (let i = 0; i < 4; i++) room.chat('w', 'text', 'x');
    expect(room.chat('w', 'text', 'spam')).toEqual({ ok: false, error: 'rate-limited' });
  });

  it('recorta mensajes largos', () => {
    const { room, a } = setup();
    room.chat('w', 'text', 'a'.repeat(500));
    expect((a.chats[0] as { text: string }).text).toHaveLength(120);
  });
});
