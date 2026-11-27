/**
 * Lector de HDRI en formato Radiance (.hdr, RGBE), con o sin compresión por tandas. Es el RGBELoader de
 * three/examples en lo que la copa usa (una imagen equirectangular en float), sin traer ese archivo.
 * scripts/copa-arbb/hdri.py deja el estudio de Poly Haven (CC0) achicado a 512 × 256.
 */

/** @returns {{ ancho: number, alto: number, datos: Float32Array }} datos en RGBA float, con la fila de abajo primero (lo que espera una DataTexture sin flipY). */
export function leerRgbe(buffer) {
  const bytes = new Uint8Array(buffer);
  let i = 0;
  const linea = () => {
    let s = '';
    while (i < bytes.length && bytes[i] !== 10) s += String.fromCharCode(bytes[i++]);
    i++;
    return s;
  };
  if (!linea().startsWith('#?')) throw new Error('No es un HDR');
  while (linea() !== '') { /* el resto de la cabecera */ }
  const m = linea().match(/^-Y (\d+) \+X (\d+)$/);
  if (!m) throw new Error('HDR con otra orientación');
  const alto = Number(m[1]);
  const ancho = Number(m[2]);
  const datos = new Float32Array(ancho * alto * 4);
  const fila = new Uint8Array(ancho * 4);
  for (let y = 0; y < alto; y++) {
    if (bytes[i] === 2 && bytes[i + 1] === 2 && ((bytes[i + 2] << 8) | bytes[i + 3]) === ancho) {
      i += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < ancho) {
          let n = bytes[i++];
          if (n > 128) {
            n -= 128;
            const valor = bytes[i++];
            for (let k = 0; k < n; k++) fila[(x + k) * 4 + c] = valor;
          } else {
            for (let k = 0; k < n; k++) fila[(x + k) * 4 + c] = bytes[i++];
          }
          x += n;
        }
      }
    } else {
      fila.set(bytes.subarray(i, i + ancho * 4));
      i += ancho * 4;
    }
    for (let x = 0; x < ancho; x++) {
      const e = fila[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      const o = ((alto - 1 - y) * ancho + x) * 4;
      datos[o] = fila[x * 4] * f;
      datos[o + 1] = fila[x * 4 + 1] * f;
      datos[o + 2] = fila[x * 4 + 2] * f;
      datos[o + 3] = 1;
    }
  }
  return { ancho, alto, datos };
}
