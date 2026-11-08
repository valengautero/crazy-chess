import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from './server';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);
// src/ o dist/ → ../../client/dist
const staticDir = process.env.STATIC_DIR ?? resolve(here, '../../client/dist');

const s = await createServer({ port, staticDir });
console.log(`Chess Pixel server escuchando en http://localhost:${s.port} (WebSocket en /ws)`);
