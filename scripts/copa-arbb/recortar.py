"""
La copa de "Nuestra historia" (public/historia.html) es una foto, no un modelo 3D. Este script
prepara esa foto: le saca el fondo negro con bordes suaves y tapa con la madera del propio tambor
las chapitas que trae pintadas, porque las 15 placas de verdad las monta la página encima (CSS 3D,
src/ui/copa.js) y tienen que poder girar y encenderse.

Uso (desde la raíz del repo):  python scripts/copa-arbb/recortar.py
Lee   scripts/copa-arbb/copa-arbb-original.jpg (896×1200, fondo negro)
Deja  public/img/historia/copa-arbb.webp        (recortada, con alfa)
e imprime la geometría del tambor en porcentajes, para copiarla a historia.css si cambia la foto.

Sólo Pillow y numpy. Las coordenadas fijas (tambor, huecos de las asas) son de esta foto: con otra
foto hay que volver a medirlas.
"""
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / 'scripts/copa-arbb/copa-arbb-original.jpg'
DESTINO = RAIZ / 'public/img/historia/copa-arbb.webp'

FONDO = np.array([10.0, 9.0, 14.0])  # el negro de la foto (con el ruido del JPEG llega a ~18)
OSCURO = 24                           # hasta acá un píxel puede ser fondo
RAMPA = 64                            # de OSCURO a RAMPA, el borde se vuelve opaco de a poco
# Los huecos entre las asas y el cuenco son fondo encerrado: no se tocan con el borde de la imagen.
HUECOS = [(170, 300), (720, 300)]
# El tambor de madera donde van las chapitas (x0, y0, x1, y1), en píxeles de la foto original.
TAMBOR = (276, 849, 621, 1004)
# Más abajo de esta fila la base de madera ya es más ancha que el tambor: el costado no se toca.
CANTO_Y = 958


def vecinos(m):
    """El borde de 1 px alrededor de una máscara (4-vecinos)."""
    d = m.copy()
    d[1:] |= m[:-1]
    d[:-1] |= m[1:]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def dilatar(m, n):
    for _ in range(n):
        m = vecinos(m)
    return m


def erosionar(m, n):
    return ~dilatar(~m, n)


def inundar(permitido, semillas):
    """Relleno por inundación con numpy: crece desde las semillas sólo por los píxeles permitidos."""
    r = semillas & permitido
    while True:
        n = vecinos(r) & permitido
        if (n == r).all():
            return r
        r = n


def sacar_fondo(a):
    maximo = a.max(2)
    oscuro = maximo <= OSCURO
    semillas = np.zeros_like(oscuro)
    semillas[0, :] = semillas[-1, :] = semillas[:, 0] = semillas[:, -1] = True
    for x, y in HUECOS:
        semillas[y, x] = True
    fondo = inundar(oscuro, semillas)
    # Alfa: 0 en el fondo; en la franja de 3 px pegada a él, una rampa según qué tan claro es el píxel
    # (el antialias de la foto es una mezcla con negro); adentro, 1.
    alfa = np.ones(maximo.shape)
    alfa[fondo] = 0
    franja = dilatar(fondo, 3) & ~fondo
    alfa[franja] = np.clip((maximo[franja] - OSCURO) / (RAMPA - OSCURO), 0, 1)
    # Se le quita al color el negro con el que estaba mezclado, para que el borde no quede sucio.
    color = a.copy()
    con = (alfa > 0) & (alfa < 1)
    k = alfa[con][:, None]
    color[con] = np.clip((a[con] - FONDO * (1 - k)) / np.maximum(k, 0.05), 0, 255)
    return color, alfa


def tapar_placas(a, alfa):
    """
    Cambia las chapitas pintadas por madera. En la foto el tambor está casi todo tapado por placas
    (la caoba se ve sólo en juntas de 2 o 3 px), así que no alcanza con clonar parches: se pinta la
    cara entera del tambor como un cilindro de caoba, con el color medio de la madera que sí se ve en
    la foto, la luz de estudio de la foto (frente iluminado, contraluz en los cantos) y una veta
    vertical. Arriba y abajo se funde con la foto, así el borde de la copa y la base quedan tal cual.
    """
    x0, y0, x1, y1 = TAMBOR
    z = a[y0:y1, x0:x1]
    alto, ancho = z.shape[:2]
    madera = (z[..., 0] - z[..., 1] > 25) & (z.max(2) > 60)
    tono = np.median(z[madera], axis=0)
    tono = tono / tono.mean()  # sólo el matiz: la luz la pone el cilindro

    x = np.arange(ancho)
    u = (x - (ancho - 1) / 2) / ((ancho - 1) / 2)  # -1 canto izquierdo, 0 frente, 1 canto derecho
    frente = np.sqrt(np.clip(1 - u ** 2, 0, 1))
    luz = 20 + 50 * frente ** 1.6 * (1 - 0.3 * u)  # la luz viene un poco de la izquierda, como en la foto
    luz += 18 * np.clip((np.abs(u) - 0.9) / 0.1, 0, 1) ** 2  # un filo de contraluz en los cantos
    # Los reflejos de la laca: no llevan el rojo de la madera, son la luz del estudio.
    brillo = (75 * np.exp(-((u + 0.42) / 0.03) ** 2) + 22 * np.exp(-((u + 0.42) / 0.14) ** 2)
              + 24 * np.exp(-((u - 0.52) / 0.045) ** 2))

    rng = np.random.default_rng(1943)
    y = np.arange(alto)[:, None]
    # Veta vertical: ruido en x suavizado a tres escalas, que se tuerce apenas en y.
    veta1 = np.zeros(ancho * 2)
    for ancho_k, amp in [(1, 0.025), (3, 0.04), (9, 0.05), (25, 0.05)]:
        r = rng.normal(0, 1, ancho * 2 + ancho_k)
        veta1 += amp * np.convolve(r, np.ones(ancho_k) / np.sqrt(ancho_k), mode='valid')[: ancho * 2]
    xv = np.clip(np.round(x[None, :] * 2 + 2.2 * np.sin(y / 31 + x[None, :] / 57)), 0, ancho * 2 - 1).astype(int)
    veta = veta1[xv]
    sombra = 1 - 0.65 * np.exp(-y / 6) - 0.4 * np.exp(-(alto - 1 - y) / 4)  # bajo el borde y contra la base
    lum = luz[None, :] * (1 + veta) * sombra + rng.normal(0, 1.2, (alto, ancho))
    relleno = lum[..., None] * tono + (brillo[None, :] * sombra)[..., None] * np.array([1.0, 0.78, 0.72])
    relleno = np.clip(relleno, 0, 255)

    # Fundido de 4 px con la foto arriba y abajo; a los costados el tambor es recto y se corta limpio.
    peso = np.ones(alto)
    peso[:4] = peso[-4:][::-1] = (np.arange(4) + 1) / 5
    peso = peso[:, None, None]
    a[y0:y1, x0:x1] = z * (1 - peso) + relleno * peso
    # La silueta: opaco adentro; afuera, hasta donde empieza la base, fondo (ahí asomaban los cantos
    # de las placas laterales). Medio píxel de antialias en cada canto.
    alfa[y0:y1, x0:x1] = 1
    alfa[y0:CANTO_Y, :x0] = 0
    alfa[y0:CANTO_Y, x1:] = 0
    alfa[y0:y1, x0] = alfa[y0:y1, x1 - 1] = 0.6
    return a


def principal():
    a = np.asarray(Image.open(ORIGEN).convert('RGB')).astype(float)
    color, alfa = sacar_fondo(a)
    color = tapar_placas(color, alfa)  # también corrige el alfa de la silueta del tambor

    filas = np.flatnonzero(alfa.max(1) > 0)
    cols = np.flatnonzero(alfa.max(0) > 0)
    m = 4
    cx0, cy0 = max(cols[0] - m, 0), max(filas[0] - m, 0)
    cx1, cy1 = min(cols[-1] + m + 1, a.shape[1]), min(filas[-1] + m + 1, a.shape[0])
    rgba = np.dstack([color, alfa * 255]).round().astype(np.uint8)[cy0:cy1, cx0:cx1]
    Image.fromarray(rgba, 'RGBA').save(DESTINO, 'WEBP', quality=88, method=6, alpha_quality=90)

    w, h = cx1 - cx0, cy1 - cy0
    # El tambor, medido en la foto: dónde empieza y termina la madera de cada lado y en altura.
    tx0, ty0, tx1, ty1 = TAMBOR[0] - cx0, TAMBOR[1] - cy0, TAMBOR[2] - cx0, TAMBOR[3] - cy0
    print(f'{DESTINO.relative_to(RAIZ)}: {w}×{h}, {DESTINO.stat().st_size // 1024} KB')
    print(f'tambor: left {100 * tx0 / w:.2f}%  ancho {100 * (tx1 - tx0) / w:.2f}%  '
          f'top {100 * ty0 / h:.2f}%  alto {100 * (ty1 - ty0) / h:.2f}%')


if __name__ == '__main__':
    principal()
