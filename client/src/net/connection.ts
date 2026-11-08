import type { ClientMsg, ServerMsg } from '@chess-pixel/shared';

export type ConnStatus = 'connecting' | 'open' | 'down';

/** WebSocket con reconexión automática (backoff exponencial) y reintento inmediato al volver a la pestaña. */
export class Connection {
  status: ConnStatus = 'connecting';
  onMessage: (m: ServerMsg) => void = () => {};
  onStatus: (s: ConnStatus) => void = () => {};
  private ws: WebSocket | null = null;
  private tries = 0;
  private closed = false;
  private timer: number | undefined;

  constructor() {
    this.open();
    document.addEventListener('visibilitychange', this.onVisible);
  }

  private onVisible = (): void => {
    if (document.visibilityState === 'visible' && this.status === 'down' && !this.closed) {
      clearTimeout(this.timer);
      this.open();
    }
  };

  private setStatus(s: ConnStatus): void {
    this.status = s;
    this.onStatus(s);
  }

  private open(): void {
    this.setStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.setStatus('open');
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        /* mensaje inválido: se ignora */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.setStatus('down');
      if (!this.closed) {
        const delay = Math.min(5000, 500 * 2 ** this.tries++);
        this.timer = window.setTimeout(() => this.open(), delay);
      }
    };
  }

  send(m: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.ws?.close();
  }
}

const TOKEN_KEY = 'chess-pixel:token';
const ROOM_KEY = 'chess-pixel:room';

/** Identificador secreto del jugador; permite reconectar a la misma silla. */
export function getToken(): string {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t && /^[A-Za-z0-9_-]{8,64}$/.test(t)) return t;
  } catch { /* sin almacenamiento */ }
  // crypto.randomUUID no existe en contextos no seguros (http://192.168…), getRandomValues sí
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const t = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignorado */ }
  return t;
}

export function savedRoom(): string | null {
  try { return localStorage.getItem(ROOM_KEY); } catch { return null; }
}
export function saveRoom(code: string | null): void {
  try {
    if (code) localStorage.setItem(ROOM_KEY, code);
    else localStorage.removeItem(ROOM_KEY);
  } catch { /* ignorado */ }
}
