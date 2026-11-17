import { fileURLToPath } from 'node:url';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Los pesos de letra que se ven en la primera pantalla. Sin precarga, el navegador los pide recién cuando
// el CSS ya se aplicó y el JavaScript armó la pantalla; con ella, se bajan en paralelo con el código y el
// texto sale ya en su letra (con la de respaldo de estilos.css como red, que mide casi lo mismo).
const FUENTES_PRECARGADAS = [/barlow-condensed-latin-700-normal/, /barlow-condensed-latin-600-normal/, /dm-sans-latin-400-normal/, /dm-sans-latin-600-normal/];

/**
 * Agrega al index.html armado un <link rel="preload"> por cada fuente de FUENTES_PRECARGADAS, con la
 * dirección con hash que les pone Vite al armar (no se pueden escribir a mano en el HTML). En desarrollo
 * no hay armado y no hace nada.
 */
function precargarFuentes(): Plugin {
  return {
    name: 'oficina-precargar-fuentes',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const tags: HtmlTagDescriptor[] = [];
        for (const patron of FUENTES_PRECARGADAS) {
          const archivo = Object.keys(ctx.bundle).find((nombre) => nombre.endsWith('.woff2') && patron.test(nombre));
          if (archivo) {
            tags.push({ tag: 'link', injectTo: 'head', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/nueva/${archivo}` } });
          }
        }
        return tags;
      },
    },
  };
}

// La app vieja se sirve sin armado desde /public y /src. Esto se arma en el deploy
// de Vercel y se publica aparte, en /nueva, para que Tomás vaya viendo la mudanza
// (vercel.json). Mudar una pantalla de la app vieja a React sigue siendo un paso aparte.
export default defineConfig({
  base: '/nueva/',
  plugins: [react(), tailwindcss(), precargarFuentes()],
  // Que /src/data de la app vieja (lógica pura) se pueda importar tal cual.
  // fileURLToPath y no .pathname: en Windows .pathname da «/C:/…» y el atajo no anda.
  resolve: {
    alias: {
      '@datos': fileURLToPath(new URL('../src/data', import.meta.url)),
      // Los textos de error de la app vieja (sin DOM al importarlos), para no redactarlos dos veces.
      '@ui': fileURLToPath(new URL('../src/ui', import.meta.url)),
      // El lector de planillas (src/parser) no se toca: se importa tal cual, y sólo cuando se sube un archivo.
      '@parser': fileURLToPath(new URL('../src/parser', import.meta.url)),
      xlsx: fileURLToPath(new URL('../public/vendor/xlsx.mjs', import.meta.url)),
      // La app vieja resuelve esto con el importmap de index.html; acá, con la copia vendorizada.
      '@supabase/supabase-js': fileURLToPath(new URL('../public/vendor/supabase-js.mjs', import.meta.url)),
    },
  },
  // Las fuentes se reusan de /public de la app vieja, que queda fuera de web/.
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/configurarPruebas.ts'],
    testTimeout: 15000,
  },
});
