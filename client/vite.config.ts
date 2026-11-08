import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // pieces.html es una página aparte con la tabla de estilos de piezas
      input: { main: resolve(__dirname, 'index.html'), pieces: resolve(__dirname, 'pieces.html') },
    },
  },
  server: {
    port: 5173,
    // El cliente siempre habla con `/ws` del mismo origen; en desarrollo Vite lo reenvía al servidor de salas.
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
});
