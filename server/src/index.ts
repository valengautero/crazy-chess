import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './server';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);
// src/ o dist/ → ../../client/dist
const staticDir = process.env.STATIC_DIR ?? resolve(here, '../../client/dist');

const s = await createServer({ port, staticDir });
console.log(`Crazy Chess! server escuchando en http://localhost:${s.port} (WebSocket en /ws)`);

// Cierre ordenado cuando la plataforma reinicia o detiene el servicio.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`${sig}: cerrando…`);
    void s.close().then(() => process.exit(0));
  });
}
