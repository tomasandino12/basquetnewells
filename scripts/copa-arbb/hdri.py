"""
Prepara el HDRI de estudio de Poly Haven (studio_small_03, CC0: https://polyhaven.com/a/studio_small_03) y lo
deja como RGBE con compresión por tandas en public/img/historia/estudio.hdr (1024 × 512). Es lo que
src/ui/copa3d.js carga (con su lector de RGBE) y pasa por PMREMGenerator para el reflejo del cromo y de la laca.

El estudio original tiene cortinas casi negras en tres cuartos del contorno: el cromo, que es un espejo, se
llenaba de manchones negros al girar. Por eso se le suma luz de relleno (como las tarjetas blancas de un estudio
de producto): un piso de luminancia que nunca baja de gris oscuro, dos paneles verticales suaves a 120° y 240°, un
rebote suave desde abajo y unas vetas finas oscuras entre los paneles, para que el reflejo tenga contraste sin
pozos negros.

Uso (desde la raíz del repo; el original va en una carpeta aparte, no se versiona):
  python scripts/copa-arbb/hdri.py RUTA/studio_small_03_1k.hdr
Sólo numpy.
"""
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / 'public/img/historia/estudio.hdr'


def leer_rgbe(ruta):
    b = Path(ruta).read_bytes()
    i = 0
    cabecera = []
    while True:
        j = b.index(b'\n', i)
        linea = b[i:j].decode('latin1')
        i = j + 1
        if linea == '':
            break
        cabecera.append(linea)
    j = b.index(b'\n', i)
    _, h, _, w = b[i:j].decode().split()
    h, w = int(h), int(w)
    i = j + 1
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        if not (b[i] == 2 and b[i + 1] == 2 and (b[i + 2] << 8 | b[i + 3]) == w):
            raise SystemExit('sólo leo RGBE con compresión por tandas')
        i += 4
        for c in range(4):
            x = 0
            while x < w:
                n = b[i]
                i += 1
                if n > 128:
                    n -= 128
                    out[y, x:x + n, c] = b[i]
                    i += 1
                else:
                    out[y, x:x + n, c] = np.frombuffer(b, dtype=np.uint8, count=n, offset=i)
                    i += n
                x += n
    return out


def a_float(rgbe):
    e = rgbe[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return rgbe[..., :3].astype(np.float64) * f[..., None]


def a_rgbe(rgb):
    mx = rgb.max(axis=2)
    m, e = np.frexp(np.maximum(mx, 1e-32))
    esc = np.where(mx < 1e-32, 0.0, m * 256.0 / np.maximum(mx, 1e-32))
    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    out[..., :3] = np.clip(rgb * esc[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(mx < 1e-32, 0, e + 128)
    return out


def tandas(fila):
    """Una fila de un canal en el formato de tandas de Radiance."""
    out = bytearray()
    n = len(fila)
    i = 0
    while i < n:
        corrida = 1
        while i + corrida < n and fila[i + corrida] == fila[i] and corrida < 127:
            corrida += 1
        if corrida >= 4:
            out += bytes([128 + corrida, fila[i]])
            i += corrida
        else:
            j = i
            while j < n and j - i < 128:
                k = 1
                while j + k < n and fila[j + k] == fila[j] and k < 4:
                    k += 1
                if k >= 4:
                    break
                j += 1
            j = max(j, i + 1)
            out += bytes([j - i]) + bytes(fila[i:j])
            i = j
    return bytes(out)


def escribir_rgbe(ruta, rgbe):
    h, w, _ = rgbe.shape
    datos = bytearray(f'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n'.encode())
    for y in range(h):
        datos += bytes([2, 2, w >> 8, w & 255])
        for c in range(4):
            datos += tandas(rgbe[y, :, c].tolist())
    Path(ruta).write_bytes(bytes(datos))


def suave(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def con_relleno(rgb):
    """Suma luz de relleno al estudio. u va de 0 a 1 por el contorno (360°), v de 0 arriba a 1 abajo."""
    h, w, _ = rgb.shape
    u, v = np.meshgrid((np.arange(w) + 0.5) / w, (np.arange(h) + 0.5) / h)

    def banda(centro, sigma):
        d = ((u - centro + 0.5) % 1) - 0.5
        return np.exp(-d * d / (2 * sigma * sigma))

    # Piso: nunca negro. Sube hacia abajo (el rebote de la mesa) y baja en las vetas oscuras entre los paneles.
    vetas = 1 - 0.8 * (banda(0.0, 0.006) + banda(0.5, 0.006) + banda(1 / 6, 0.004) + banda(5 / 6, 0.004)).clip(0, 1)
    piso = (0.2 + 0.25 * suave(v, 0.45, 1.0)) * vetas
    # Paneles verticales suaves a 120° y 240°: altos, con los bordes que se apagan.
    alto = suave(v, 0.12, 0.3) * (1 - suave(v, 0.68, 0.88))
    paneles = 2.2 * alto * (banda(1 / 3, 0.035) + banda(2 / 3, 0.035))
    return rgb + (piso + paneles)[..., None]


if __name__ == '__main__':
    rgb = con_relleno(a_float(leer_rgbe(sys.argv[1])))
    h, w, _ = rgb.shape
    escribir_rgbe(SALIDA, a_rgbe(rgb))
    # Una vuelta de prueba: se lee lo escrito y se compara con lo que se quería escribir.
    vuelta = a_float(leer_rgbe(SALIDA))
    err = np.abs(vuelta - rgb).max() / rgb.max()
    print(f'{SALIDA.relative_to(RAIZ)}: {w} × {h}, {SALIDA.stat().st_size / 1024:.0f} KB, error máximo {err:.4f} del pico ({rgb.max():.1f})')
