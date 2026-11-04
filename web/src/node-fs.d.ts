// Sólo lo que usan las pruebas que leen archivos del repo (no hay @types/node en web/).
declare module 'node:fs' {
  export function readFileSync(ruta: URL, codificacion: 'utf8'): string;
}
