// Apellidos y nombres que escribe una familia: se normalizan al leerlos. Misma regla que
// nombrePropio() de google/apps-script/nombres.gs (el script de Google no puede importar esto).
// Lo cubre tests/nombresPropios.test.js, que compara los dos.
const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'da', 'di', 'van', 'von'];

export function nombrePropio(texto) {
  const palabras = String(texto ?? '').replace(/\s+/g, ' ').trim().toLowerCase().split(' ');
  return palabras
    .map((p, i) => {
      if (!p) return p;
      if (i > 0 && PARTICULAS.includes(p)) return p;
      return p.replace(/(^|[-'])(\S)/g, (_, pre, letra) => pre + letra.toUpperCase());
    })
    .join(' ');
}
