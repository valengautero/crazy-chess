import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { handleMessage, type Session } from './handler';
import { RoomManager } from './RoomManager';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

export interface ServerOptions {
  port: number;
  /** Carpeta con el cliente compilado (client/dist). Si no existe, solo se atiende el WebSocket. */
  staticDir?: string;
  manager?: RoomManager;
}

function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://x');
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = resolve(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html'); // fallback tipo SPA
  try {
    const body = readFileSync(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

export function createServer(opts: ServerOptions) {
  const manager = opts.manager ?? new RoomManager();
  const root = opts.staticDir ? resolve(opts.staticDir) : null;

  const http = createHttpServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    if (root && existsSync(root)) return serveStatic(root, req, res);
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Chess Pixel server: cliente no compilado (npm run build)');
  });

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 2048 });
  const alive = new WeakSet<WebSocket>();

  wss.on('connection', (ws) => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    const session: Session = {
      conn: {
        send: (msg) => {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
        },
        close: () => ws.close(4000, 'replaced'),
      },
      room: null,
      token: null,
    };
    ws.on('message', (data) => handleMessage(manager, session, data.toString()));
    ws.on('close', () => session.room?.detach(session.conn));
    ws.on('error', () => ws.terminate());
  });

  // reloj / abandono cada segundo, latido cada 20 s, limpieza cada minuto
  let n = 0;
  const timer = setInterval(() => {
    n++;
    manager.tick();
    if (n % 20 === 0) {
      for (const ws of wss.clients) {
        if (!alive.has(ws)) ws.terminate();
        else {
          alive.delete(ws);
          ws.ping();
        }
      }
    }
    if (n % 60 === 0) manager.sweep();
  }, 1000);

  return new Promise<{ port: number; manager: RoomManager; close: () => Promise<void> }>((resolveP) => {
    http.listen(opts.port, () => {
      const addr = http.address();
      resolveP({
        port: typeof addr === 'object' && addr ? addr.port : opts.port,
        manager,
        close: () =>
          new Promise<void>((r) => {
            clearInterval(timer);
            for (const ws of wss.clients) ws.terminate();
            wss.close(() => http.close(() => r()));
          }),
      });
    });
  });
}
