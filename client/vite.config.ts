import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // El cliente siempre habla con `/ws` del mismo origen; en desarrollo Vite lo reenvía al servidor de salas.
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
});
