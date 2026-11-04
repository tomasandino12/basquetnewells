import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// La app vieja se sirve sin armado desde /public y /src. Esto se arma aparte
// y sale a `web/dist`, que nada despliega todavía: mudar una pantalla a React
// es una decisión de un paso posterior, no un efecto de esta carpeta.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Que /src de la app vieja (lógica pura) se pueda importar tal cual.
  resolve: { alias: { '@datos': new URL('../src/data', import.meta.url).pathname } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
