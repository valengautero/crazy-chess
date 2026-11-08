/** Cliente UCI para Stockfish (WASM lite, un solo hilo) corriendo en un Web Worker. */

export interface SearchOptions {
  /** Skill Level de Stockfish, 0–20. */
  skill: number;
  depth?: number;
  movetime?: number;
}

export interface SearchResult {
  /** Mejor jugada en notación UCI, p. ej. "e2e4" o "e7e8q". null si no hay jugadas legales. */
  best: string | null;
  /** Evaluación en centipeones desde el punto de vista de las BLANCAS (null si hay mate). */
  cp: number | null;
  /** Mates en N desde el punto de vista de las blancas (positivo: mate blanco). */
  mate: number | null;
  pv: string[];
  depth: number;
}

export class Engine {
  private worker: Worker;
  private listeners = new Set<(line: string) => void>();
  private chain: Promise<unknown>;
  private busy = false;

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = String(e.data);
      for (const l of [...this.listeners]) l(line);
    };
    this.chain = this.init();
  }

  private waitFor(cmd: string, token: string): Promise<void> {
    return new Promise((resolve) => {
      const l = (line: string) => {
        if (line.startsWith(token)) {
          this.listeners.delete(l);
          resolve();
        }
      };
      this.listeners.add(l);
      this.worker.postMessage(cmd);
    });
  }

  private async init(): Promise<void> {
    await this.waitFor('uci', 'uciok');
    await this.waitFor('isready', 'readyok');
  }

  /** Pide parar la búsqueda actual (su promesa se resuelve con lo que tenga). */
  cancel(): void {
    if (this.busy) this.worker.postMessage('stop');
  }

  search(fen: string, opts: SearchOptions): Promise<SearchResult> {
    const job = this.chain.then(() => this.run(fen, opts));
    this.chain = job.catch(() => undefined);
    return job;
  }

  private run(fen: string, opts: SearchOptions): Promise<SearchResult> {
    const whiteToMove = fen.split(' ')[1] !== 'b';
    return new Promise((resolve) => {
      let cp: number | null = null;
      let mate: number | null = null;
      let pv: string[] = [];
      let depth = 0;
      this.busy = true;

      const l = (line: string) => {
        if (line.startsWith('info') && line.includes(' pv ') && !line.includes('lowerbound') && !line.includes('upperbound')) {
          const m = line.match(/score (cp|mate) (-?\d+)/);
          const d = line.match(/ depth (\d+)/);
          if (m) {
            const v = Number(m[2]) * (whiteToMove ? 1 : -1);
            if (m[1] === 'cp') {
              cp = v;
              mate = null;
            } else {
              mate = v;
              cp = null;
            }
          }
          if (d) depth = Number(d[1]);
          pv = line.split(' pv ')[1]!.trim().split(' ');
        } else if (line.startsWith('bestmove')) {
          this.listeners.delete(l);
          this.busy = false;
          const best = line.split(' ')[1];
          resolve({ best: !best || best === '(none)' ? null : best, cp, mate, pv, depth });
        }
      };
      this.listeners.add(l);

      this.worker.postMessage(`setoption name Skill Level value ${opts.skill}`);
      this.worker.postMessage(`position fen ${fen}`);
      const limit = opts.movetime ? `movetime ${opts.movetime}` : `depth ${opts.depth ?? 12}`;
      this.worker.postMessage(`go ${limit}`);
    });
  }
}

let shared: Engine | null = null;
/** Una única instancia compartida (el WASM pesa ~2 MB y se carga una sola vez). */
export function getEngine(): Engine {
  return (shared ??= new Engine());
}

/** "e7e8q" → { from, to, promotion } */
export function parseUci(uci: string) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}
