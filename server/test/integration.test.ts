import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ClientMsg, RoomSnapshot, ServerMsg } from '@chess-pixel/shared';
import { createServer } from '../src/server';

let srv: Awaited<ReturnType<typeof createServer>>;
beforeEach(async () => { srv = await createServer({ port: 0 }); });
afterEach(async () => { await srv.close(); });

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  constructor() {
    this.ws = new WebSocket(`ws://localhost:${srv.port}/ws`);
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(d.toString())));
  }
  open() { return new Promise<void>((r) => this.ws.once('open', () => r())); }
  send(m: ClientMsg | string) { this.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }
  async waitFor<T extends ServerMsg>(pred: (m: ServerMsg) => m is T, from = 0): Promise<T> {
    for (let i = 0; i < 100; i++) {
      const hit = this.msgs.slice(from).find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('timeout esperando mensaje: ' + JSON.stringify(this.msgs));
  }
  state(from = 0) { return this.waitFor((m): m is Extract<ServerMsg, { t: 'state' }> => m.t === 'state', from).then((m) => m.s); }
  async stateWhere(f: (s: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
    for (let i = 0; i < 100; i++) {
      const hit = [...this.msgs].reverse().find((m) => m.t === 'state' && f(m.s));
      if (hit && hit.t === 'state') return hit.s;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('estado esperado no llegó');
  }
}

async function connect() { const c = new Client(); await c.open(); return c; }

describe('multijugador por WebSocket', () => {
  it('dos clientes: crear, unirse con el código, jugar y sincronizar', async () => {
    const a = await connect();
    a.send({ t: 'create', token: 'token-aaaaaaaa', clock: null, color: 'w' });
    const first = await a.state();
    expect(first.phase).toBe('waiting');
    expect(first.you).toBe('w');

    const b = await connect();
    b.send({ t: 'join', token: 'token-bbbbbbbb', code: first.code.toLowerCase() });
    const bs = await b.state();
    expect(bs.you).toBe('b');
    expect(bs.phase).toBe('playing');

    a.send({ t: 'move', from: 'e2', to: 'e4', ply: 0 });
    const sb = await b.stateWhere((s) => s.moves.length === 1);
    expect(sb.moves).toEqual(['e2e4']);
    expect(sb.turn).toBe('b');

    // el que no tiene el turno no puede mover, y recibe error + estado correcto
    a.send({ t: 'move', from: 'd2', to: 'd4', ply: 1 });
    await a.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'not-your-turn');

    b.send({ t: 'chat', text: 'hola' });
    const chat = await a.waitFor((m): m is Extract<ServerMsg, { t: 'chat' }> => m.t === 'chat');
    expect(chat).toMatchObject({ from: 'b', text: 'hola' });
  });

  it('reconexión: el jugador vuelve con su token y recupera la partida', async () => {
    const a = await connect();
    a.send({ t: 'create', token: 'token-aaaaaaaa', clock: null, color: 'w' });
    const { code } = await a.state();
    const b = await connect();
    b.send({ t: 'join', token: 'token-bbbbbbbb', code });
    await b.state();
    a.send({ t: 'move', from: 'e2', to: 'e4', ply: 0 });
    await b.stateWhere((s) => s.moves.length === 1);

    b.ws.terminate(); // se cae la conexión de b
    await a.stateWhere((s) => !s.connected.b);

    const b2 = await connect();
    b2.send({ t: 'join', token: 'token-bbbbbbbb', code });
    const back = await b2.state();
    expect(back.you).toBe('b');
    expect(back.moves).toEqual(['e2e4']);
    await a.stateWhere((s) => s.connected.b);

    b2.send({ t: 'move', from: 'e7', to: 'e5', ply: 1 });
    await a.stateWhere((s) => s.moves.length === 2);
  });

  it('rechaza mensajes inválidos, salas inexistentes y salas llenas', async () => {
    const x = await connect();
    x.send('esto no es json');
    await x.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'bad-request');
    x.send({ t: 'move', from: 'e2', to: 'e4', ply: 0 });
    await x.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'not-in-room');
    x.send({ t: 'join', token: 'token-xxxxxxxx', code: 'ZZZZ' });
    await x.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'no-room');
    x.send({ t: 'create', token: 'corto', clock: null, color: 'w' });
    await x.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'bad-request' && x.msgs.length > 3);

    const a = await connect();
    a.send({ t: 'create', token: 'token-aaaaaaaa', clock: { minutes: 5, incrementSec: 0 }, color: 'random' });
    const { code } = await a.state();
    const b = await connect();
    b.send({ t: 'join', token: 'token-bbbbbbbb', code });
    await b.state();
    const c = await connect();
    c.send({ t: 'join', token: 'token-cccccccc', code });
    await c.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'room-full');
  });

  it('valida el reloj pedido al crear la sala', async () => {
    const a = await connect();
    a.send({ t: 'create', token: 'token-aaaaaaaa', clock: { minutes: 9999, incrementSec: 0 }, color: 'w' });
    await a.waitFor((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error' && m.code === 'bad-request');
    expect(srv.manager.size).toBe(0);
  });
});
