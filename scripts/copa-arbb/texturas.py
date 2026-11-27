"""
Saca de la foto de referencia de la copa (scripts/copa-arbb/referencia-sin-chapitas.webp) las dos texturas que
usa src/ui/copa3d.js sobre la malla de la copa:
  - public/img/historia/escudo-arbb-hd.webp  el escudo "R" recortado con alfa, ampliado: se estampa como decal.
  - public/img/historia/caoba-real.webp      una caoba oscura que se repite en horizontal, sacada de los píxeles del
                                              tambor de la foto (sin el escudo ni los brillos quemados).

El escudo se recorta por color: azul, rojo y el marco dorado son saturados, el cromo de alrededor no; lo que
queda adentro (el contorno blanco de la R) se rellena. La caoba se saca del tambor: se le quita el sombreado del
cilindro y los reflejos (se divide por la versión muy desenfocada) y se la vuelve a pintar con el color medio de
la madera, así queda sólo la veta; después se hace repetible cruzando la costura.

Uso (desde la raíz del repo):  python scripts/copa-arbb/texturas.py
Sólo Pillow y numpy. Lo fijo (las cajas del escudo y del tambor) es de esta foto.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parents[2]
FOTO = RAIZ / 'scripts/copa-arbb/referencia-sin-chapitas.webp'
IMG = RAIZ / 'public/img/historia'

CAJA_ESCUDO = (335, 140, 565, 420)    # x0, y0, x1, y1: de sobra alrededor del escudo
CAJA_TAMBOR = (300, 860, 600, 1010)   # la cara del tambor, sin la tapa ni el vuelo de la base
AMPLIAR = 3


def saturacion(im):
    a = np.asarray(im.convert('RGB'), dtype=np.float32) / 255
    mx, mn = a.max(axis=2), a.min(axis=2)
    return (mx - mn) / np.maximum(mx, 1e-4), mx


def tono(im):
    """Matiz en grados (0-360) de cada píxel."""
    a = np.asarray(im.convert('RGB'), dtype=np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    d = np.maximum(mx - mn, 1e-4)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h


def escudo():
    foto = Image.open(FOTO).convert('RGB')
    caja = foto.crop(CAJA_ESCUDO)
    s, v = saturacion(caja)
    h = tono(caja)
    # Azul, rojo y el marco dorado/arena (tono 20-60°, menos saturado que el resto); el cromo es gris: no entra.
    azul_rojo = (s > 0.4) & (v > 0.18)
    marco = (h > 15) & (h < 65) & (s > 0.2) & (v > 0.3)
    mascara = Image.fromarray((azul_rojo | marco).astype(np.uint8) * 255)
    # Se cierran los huecos chicos y se rellena lo que el fondo no alcanza (el contorno blanco de la R).
    mascara = mascara.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    w, hh = mascara.size
    relleno = mascara.copy()
    ImageDraw.floodfill(relleno, (0, 0), 128)  # el fondo de afuera
    adentro = (np.asarray(relleno) != 128).astype(np.uint8) * 255  # el escudo con los huecos tapados
    # Lo suelto (reflejos tostados del cromo) se va con una apertura: sólo queda la mancha grande.
    solo_img = Image.fromarray(adentro).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(3))
    # El marco tiene el canto de arriba recto: lo que sube más allá es cromo tostado que se coló.
    m = np.asarray(solo_img) > 0
    ancho_fila = m.sum(axis=1)
    arriba = int(np.argmax(ancho_fila > 0.85 * ancho_fila.max()))
    m[:max(0, arriba - 1)] = False
    solo_img = Image.fromarray(m.astype(np.uint8) * 255)
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    print(f'escudo: {x1 - x0} × {y1 - y0} px en la foto (caja {CAJA_ESCUDO[0] + x0},{CAJA_ESCUDO[1] + y0})')
    pad = 3
    box = (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(hh, y1 + pad))
    color = caja.crop(box).resize(((box[2] - box[0]) * AMPLIAR, (box[3] - box[1]) * AMPLIAR), Image.LANCZOS)
    alfa = solo_img.crop(box).resize(color.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(AMPLIAR * 0.6))
    # Un borde más firme: el desenfoque da el antialias, el umbral lo afila.
    a = np.asarray(alfa, dtype=np.float32)
    a = np.clip((a - 100) * (255 / 55), 0, 255).astype(np.uint8)
    out = color.convert('RGBA')
    out.putalpha(Image.fromarray(a))
    out.save(IMG / 'escudo-arbb-hd.webp', quality=92, method=6)
    print(f"escudo-arbb-hd.webp: {out.size}, {(IMG / 'escudo-arbb-hd.webp').stat().st_size / 1024:.0f} KB")
    return out.size


def caoba():
    foto = Image.open(FOTO).convert('RGB')
    tira = np.asarray(foto.crop(CAJA_TAMBOR), dtype=np.float32) / 255
    h, w, _ = tira.shape
    lum = tira @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    # El cilindro sombrea por columnas (los reflejos son franjas verticales) y la luz por filas: se estiman los dos
    # perfiles con medianas y se dividen. Lo que queda es la veta.
    col = np.median(lum, axis=0)
    fila = np.median(lum / np.maximum(col[None, :], 0.02), axis=1)
    detalle = lum / np.maximum(col[None, :] * fila[:, None], 0.02)
    # Y un pasaaltos que se estira a lo ancho (la veta corre en horizontal): lo lento no es veta.
    d_img = Image.fromarray((np.clip(detalle, 0, 2) * 127).astype(np.uint8))
    lento = np.asarray(d_img.resize((w // 8, h // 2), Image.BILINEAR).filter(ImageFilter.GaussianBlur(3)).resize((w, h), Image.BILINEAR), dtype=np.float32) / 127
    detalle = np.clip(detalle / np.maximum(lento, 0.3), 0.5, 1.7)
    # El color de la madera: la mediana de lo que no es reflejo.
    suave = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)), dtype=np.float32) / 255
    sano = suave < 0.5
    color_medio = np.median(tira[sano], axis=0) * 1.12
    print('color medio de la caoba:', (color_medio * 255).astype(int))
    tex = np.clip(color_medio[None, None, :] * detalle[:, :, None], 0, 1)
    # A 2:1 y repetible en los dos sentidos: se agranda a 512 × 256 y se cruzan las mitades (los bordes se
    # reemplazan por lo del medio, que no tiene costura).
    img = Image.fromarray((tex * 255).astype(np.uint8)).resize((512, 256), Image.LANCZOS)
    t = np.asarray(img, dtype=np.float32)
    for eje, n in ((1, 512), (0, 256)):
        peso = np.clip(np.abs(np.arange(n) - n // 2) / (n // 2), 0, 1)
        peso = peso[None, :, None] if eje == 1 else peso[:, None, None]
        t = t * (1 - peso) + np.roll(t, n // 2, axis=eje) * peso
    Image.fromarray(np.clip(t, 0, 255).astype(np.uint8)).save(IMG / 'caoba-real.webp', quality=88, method=6)
    print(f"caoba-real.webp: 512 × 256, {(IMG / 'caoba-real.webp').stat().st_size / 1024:.0f} KB")


if __name__ == '__main__':
    escudo()
    caoba()
