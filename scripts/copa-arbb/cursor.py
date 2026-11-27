"""
Recorta la copa fotorrealista (copa-arbb-final.webp, con las chapitas grabadas) para la vista previa que sigue al
puntero en el portal: le saca el fondo (gris casi negro, también el que se ve entre las asas y el cáliz) y la deja
con canal alfa, a 220 px de alto (se ve nítida a ~105 px de CSS en pantallas retina), en
public/img/historia/copa-cursor-preview.webp (< 25 KB).

El fondo no es negro puro (~16 de 255) y el halo oscuro de los bordes sale de promediar esos píxeles con los del
metal al achicar. Por eso: (1) se marca como fondo lo que es así de oscuro Y forma una región grande (las manchas
chicas son sombras del cromo y se quedan), (2) se come 2 px del borde antes de achicar, y (3) se achica con el
color premultiplicado, así el borde nunca arrastra gris.

Uso (desde la raíz del repo): python scripts/copa-arbb/cursor.py
Sólo numpy y Pillow.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAIZ = Path(__file__).resolve().parents[2]
FUENTE = RAIZ / 'scripts/copa-arbb/copa-arbb-final.webp'
SALIDA = RAIZ / 'public/img/historia/copa-cursor-preview.webp'
ALTO = 220
FONDO_MAX = 20          # canal más alto que todavía cuenta como fondo (el fondo real ronda 16)
REGION_MIN = 2500       # px: un pozo de fondo más chico que esto es sombra del cromo, no fondo
BORDE = 2               # px de borde que se comen antes de achicar


def regiones_de_fondo(oscuro):
    """Marca como fondo las regiones oscuras grandes (el exterior y los huecos entre asas y cáliz)."""
    alto, ancho = oscuro.shape
    visto = np.zeros_like(oscuro, dtype=bool)
    fondo = np.zeros_like(oscuro, dtype=bool)
    for y0 in range(alto):
        for x0 in range(ancho):
            if not oscuro[y0, x0] or visto[y0, x0]:
                continue
            pila = [(y0, x0)]
            visto[y0, x0] = True
            region = []
            while pila:
                y, x = pila.pop()
                region.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < alto and 0 <= xx < ancho and oscuro[yy, xx] and not visto[yy, xx]:
                        visto[yy, xx] = True
                        pila.append((yy, xx))
            if len(region) >= REGION_MIN:
                ys, xs = zip(*region)
                fondo[list(ys), list(xs)] = True
    return fondo


def main():
    rgb = Image.open(FUENTE).convert('RGB')
    a = np.asarray(rgb)
    fondo = regiones_de_fondo(a.max(axis=2) <= FONDO_MAX)
    # El fondo "pelado" se ensancha 2 px sobre el borde de la copa (con un filtro de máximo sobre la máscara).
    mascara = Image.fromarray((fondo * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * BORDE + 1))
    alfa = 1.0 - np.asarray(mascara).astype(np.float64) / 255.0
    # Premultiplicado: el color de los píxeles transparentes no entra al promedio.
    pre = a.astype(np.float64) * alfa[..., None]
    h, w = alfa.shape
    nw = round(w * ALTO / h)
    canales = [Image.fromarray(pre[..., c].astype(np.float32), mode='F').resize((nw, ALTO), Image.LANCZOS) for c in range(3)]
    al = Image.fromarray(alfa.astype(np.float32), mode='F').resize((nw, ALTO), Image.LANCZOS)
    alfa_chica = np.clip(np.asarray(al), 0, 1)
    color = np.stack([np.asarray(c) for c in canales], axis=-1) / np.maximum(alfa_chica[..., None], 1e-3)
    salida = np.zeros((ALTO, nw, 4), dtype=np.uint8)
    salida[..., :3] = np.clip(color, 0, 255).astype(np.uint8)
    salida[..., 3] = np.clip(alfa_chica * 255 + 0.5, 0, 255).astype(np.uint8)
    # Lo que quedó casi transparente se limpia del todo (ni un pelo de gris).
    salida[salida[..., 3] < 6] = 0
    Image.fromarray(salida, 'RGBA').save(SALIDA, 'WEBP', quality=86, method=6, alpha_quality=90)
    print(f'{SALIDA.relative_to(RAIZ)}: {nw} × {ALTO}, {SALIDA.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
