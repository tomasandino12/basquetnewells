import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// La app vieja se sirve sin armado desde /public y /src. Esto se arma aparte
// y sale a `web/dist`, que nada despliega todavía: mudar una pantalla a React
// es una decisión de un paso posterior, no un efecto de esta carpeta.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Que /src/data de la app vieja (lógica pura) se pueda importar tal cual.
  // fileURLToPath y no .pathname: en Windows .pathname da «/C:/…» y el atajo no anda.
  resolve: {
    alias: {
      '@datos': fileURLToPath(new URL('../src/data', import.meta.url)),
      // Los textos de error de la app vieja (sin DOM al importarlos), para no redactarlos dos veces.
      '@ui': fileURLToPath(new URL('../src/ui', import.meta.url)),
      // La app vieja resuelve esto con el importmap de index.html; acá, con la copia vendorizada.
      '@supabase/supabase-js': fileURLToPath(new URL('../public/vendor/supabase-js.mjs', import.meta.url)),
    },
  },
  // Las fuentes se reusan de /public de la app vieja, que queda fuera de web/.
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
