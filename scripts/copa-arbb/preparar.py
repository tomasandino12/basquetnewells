"""
La copa 3D de "Nuestra historia" (src/ui/copa3d.js) se arma con medidas sacadas de la foto del trofeo, no a ojo.
Este script lee la foto y deja:
  - public/img/historia/copa-arbb.webp   la foto recortada con alfa: es lo que se ve si no hay WebGL.
  - public/img/historia/escudo-arbb.webp el escudo de la R tal cual, con alfa: la textura del escudo.
  - public/img/historia/asa-arbb.webp    el asa izquierda tal cual, con alfa: la textura del bronce.
  - src/data/copaMedidas.js              el perfil del torno (metal y madera), el contorno del asa y dónde
                                          van el escudo y el tambor, en unidades de escena (100 px = 1).

Uso (desde la raíz del repo):  python scripts/copa-arbb/preparar.py
Sólo Pillow y numpy. Lo fijo (el eje, la semilla del asa, el rango del escudo) es de esta foto.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / 'scripts/copa-arbb/copa-arbb-original.jpg'
IMG = RAIZ / 'public/img/historia'
MEDIDAS = RAIZ / 'src/data/copaMedidas.js'

FONDO = np.array([10.0, 9.0, 14.0])  # el negro de la foto (con el ruido del JPEG llega a ~18)
OSCURO = 24
RAMPA = 64
HUECOS = [(170, 300), (720, 300)]  # los huecos entre asa y cuenco: fondo encerrado
EJE = 448.5                          # x del eje de la copa (la foto es simétrica: tambor de 276 a 621)
ESCALA = 100.0                       # px de la foto por unidad de escena
SEMILLA_ASA = (60, 190)              # un punto del asa izquierda
ESCUDO_X = 110                       # el escudo ocupa |x - eje| < esto
BOCA = 136                           # fila de la boca (más arriba la foto ve la elipse de atrás del borde)
ASA_ARRIBA = (136, 240)              # filas donde el brazo de arriba del asa toca el cuenco
ASA_ABAJO = (472, 544)               # filas donde el pie del asa tapa el fondo del cuenco
FIN_METAL = 790                      # fila donde el pie de metal se apoya en la madera
FIN_MADERA = 1062                    # fila del canto más ancho de la base: altura 0 de la escena
FIN_BASE = 1085                      # el fondo de la base (más abajo, la foto ya ve la elipse del piso)
FIN_SILUETA = 1152                   # la última fila con copa: la elipse de abajo de la base
# La cámara de la foto, en unidades de escena: a la altura de la boca y a 30 de distancia. Se la estimó con las
# elipses de la foto (la boca casi de canto, la base de 2,62 de radio llega hasta la fila 1150) y la usa también
# la escena 3D, para que la copa se vea desde el mismo lugar.
CAMARA = {'y': 10.6, 'z': 30.0, 'miraY': 4.6}


# ---------------------------------------------------------------------------
# Máscaras
# ---------------------------------------------------------------------------

def vecinos(m):
    d = m.copy()
    d[1:] |= m[:-1]
    d[:-1] |= m[1:]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def erosionar(m, n):
    return ~dilatar(~m, n)


def dilatar(m, n):
    for _ in range(n):
        m = vecinos(m)
    return m


def inundar(permitido, semillas):
    r = semillas & permitido
    while True:
        n = vecinos(r) & permitido
        if (n == r).all():
            return r
        r = n


def sacar_fondo(a):
    """Alfa 0 en el fondo negro, rampa de 3 px en el borde, y el color sin el negro mezclado."""
    maximo = a.max(2)
    oscuro = maximo <= OSCURO
    semillas = np.zeros_like(oscuro)
    semillas[0, :] = semillas[-1, :] = semillas[:, 0] = semillas[:, -1] = True
    for x, y in HUECOS:
        semillas[y, x] = True
    fondo = inundar(oscuro, semillas)
    alfa = np.ones(maximo.shape)
    alfa[fondo] = 0
    franja = dilatar(fondo, 3) & ~fondo
    alfa[franja] = np.clip((maximo[franja] - OSCURO) / (RAMPA - OSCURO), 0, 1)
    color = a.copy()
    con = (alfa > 0) & (alfa < 1)
    k = alfa[con][:, None]
    color[con] = np.clip((a[con] - FONDO * (1 - k)) / np.maximum(k, 0.05), 0, 255)
    return color, alfa


def guardar_webp(color, alfa, caja, ruta, calidad=88):
    x0, y0, x1, y1 = caja
    rgba = np.dstack([color, alfa * 255]).round().clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    Image.fromarray(rgba, 'RGBA').save(ruta, 'WEBP', quality=calidad, method=6, alpha_quality=90)


# ---------------------------------------------------------------------------
# Perfil del torno
# ---------------------------------------------------------------------------

def semiancho(alfa, y):
    """Cuánto mide la pieza a cada lado del eje en la fila y: lo opaco seguido desde el eje (promedio de los lados)."""
    op = alfa[y] > 0.5
    x0 = x1 = int(round(EJE))
    while x0 > 0 and op[x0 - 1]:
        x0 -= 1
    while x1 < len(op) - 1 and op[x1 + 1]:
        x1 += 1
    return ((EJE - x0) + (x1 - EJE)) / 2


def perfil(alfa):
    """
    El perfil de torno desde la boca hasta el canto de la base. Donde un asa se pega al cuenco, lo opaco seguido
    incluye el asa y el borde real del metal queda tapado: arriba (el brazo del asa contra la boca) se une la boca
    con la pared en línea recta, que ahí es casi vertical; abajo (el pie del asa contra el fondo) se cierra el
    fondo con un cuarto de elipse hasta el cuello, que es como redondea el cuenco en la foto.
    """
    ys = np.arange(BOCA, FIN_MADERA + 1)
    semi = np.array([semiancho(alfa, y) for y in ys])
    i = lambda y: y - BOCA  # noqa: E731
    a, b = ASA_ARRIBA
    semi[i(a):i(b) + 1] = np.interp(np.arange(a, b + 1), [a, b], [semi[i(a)], semi[i(b)]])
    a, b = ASA_ABAJO
    t = (np.arange(a, b + 1) - a) / (b - a)
    semi[i(a):i(b) + 1] = semi[i(b)] + (semi[i(a)] - semi[i(b)]) * np.sqrt(np.clip(1 - t ** 2, 0, 1))
    # Mediana de 5 filas: el ruido del JPEG en el borde no tiene que volverse una moldura.
    suave = np.array([np.median(semi[max(0, k - 2): k + 3]) for k in range(len(semi))])
    return ys, suave


def elevacion(fila):
    """Desde qué ángulo ve la cámara de la foto el círculo cuyo centro cae en `fila` (más abajo, más desde arriba)."""
    h = (FIN_MADERA - fila) / ESCALA
    return np.arctan2(CAMARA['y'] - h, CAMARA['z'])


def deshacer_elipses(ys, silueta, filas_perfil):
    """
    La foto mira la copa desde arriba: cada círculo del torno se ve como una elipse, y la silueta es la envolvente
    de todas. Donde hay una cara horizontal (los escalones de la base, el pie) la elipse de esa cara se asoma por
    encima de su altura real y la silueta parece más ancha de lo que es el torno ahí. Esto busca el radio de cada
    altura (`filas_perfil`) cuya envolvente reproduce la silueta medida (`ys`, `silueta`): se empieza por la silueta
    misma y, fila por fila, se achica el círculo que se pasa y se agranda el propio donde falta.
    """
    radio = np.interp(filas_perfil, ys, silueta)
    seno = np.sin(elevacion(filas_perfil))
    for _ in range(400):
        b = np.maximum(radio * seno, 0.5)
        d = (ys[:, None] - filas_perfil[None, :]) / b[None, :]
        aporte = np.where(np.abs(d) < 1, radio[None, :] * np.sqrt(np.clip(1 - d ** 2, 0, 1)), 0)
        dueno = aporte.argmax(1)
        envolvente = aporte.max(1)
        error = envolvente - silueta
        ajuste = np.zeros_like(radio)
        cuenta = np.zeros_like(radio)
        sobra = error > 0.3
        np.add.at(ajuste, dueno[sobra], -error[sobra])
        np.add.at(cuenta, dueno[sobra], 1)
        propio = np.clip(np.searchsorted(filas_perfil, ys), 0, len(filas_perfil) - 1)
        falta = error < -0.3
        np.add.at(ajuste, propio[falta], -error[falta])
        np.add.at(cuenta, propio[falta], 1)
        radio = np.maximum(radio + 0.5 * ajuste / np.maximum(cuenta, 1), 0)
    return radio


def simplificar(puntos, tol):
    """Ramer-Douglas-Peucker: deja sólo los puntos que cambian la forma más que `tol`."""
    puntos = np.asarray(puntos, float)
    if len(puntos) < 3:
        return puntos
    a, b = puntos[0], puntos[-1]
    ab = b - a
    largo = np.hypot(*ab) or 1e-9
    v = puntos - a
    d = np.abs(ab[0] * v[:, 1] - ab[1] * v[:, 0]) / largo
    i = int(np.argmax(d))
    if d[i] <= tol:
        return np.array([a, b])
    izq = simplificar(puntos[: i + 1], tol)
    der = simplificar(puntos[i:], tol)
    return np.vstack([izq[:-1], der])


# ---------------------------------------------------------------------------
# Contorno (Moore) de una máscara de un solo componente
# ---------------------------------------------------------------------------

def contorno(m):
    alto, ancho = m.shape
    ys, xs = np.nonzero(m)
    inicio = (ys.min(), xs[ys == ys.min()].min())
    vec = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
    borde = [inicio]
    actual, entra = inicio, 6  # llegamos desde la izquierda
    for _ in range(200000):
        for k in range(8):
            d = (entra + 1 + k) % 8
            y, x = actual[0] + vec[d][0], actual[1] + vec[d][1]
            if 0 <= y < alto and 0 <= x < ancho and m[y, x]:
                actual = (y, x)
                entra = (d + 4) % 8
                break
        if actual == inicio:
            break
        borde.append(actual)
    return np.array([(x, y) for y, x in borde], float)


def principal():
    a = np.asarray(Image.open(ORIGEN).convert('RGB')).astype(float)
    color, alfa = sacar_fondo(a)

    # 1. La foto recortada, de respaldo sin WebGL (con sus placas originales).
    filas = np.flatnonzero(alfa.max(1) > 0)
    cols = np.flatnonzero(alfa.max(0) > 0)
    caja = (max(cols[0] - 4, 0), max(filas[0] - 4, 0), min(cols[-1] + 5, a.shape[1]), min(filas[-1] + 5, a.shape[0]))
    guardar_webp(color, alfa, caja, IMG / 'copa-arbb.webp')

    # 2. El perfil.
    ys, semi = perfil(alfa)
    # La silueta medida sigue más abajo del canto (la elipse de la base); con ella se deshacen las elipses.
    abajo = np.arange(FIN_MADERA + 1, FIN_SILUETA + 1)
    ys_sil = np.concatenate([ys, abajo])
    sil = np.concatenate([semi, [semiancho(alfa, y) for y in abajo]])
    ys = np.arange(BOCA, FIN_BASE + 1)
    semi = deshacer_elipses(ys_sil, sil, ys)
    semi = np.array([np.median(semi[max(0, k - 2): k + 3]) for k in range(len(semi))])
    a_escena = lambda y: (FIN_MADERA - y) / ESCALA  # noqa: E731
    fin_m = FIN_METAL - BOCA
    metal = simplificar(np.column_stack([semi[:fin_m + 1], ys[:fin_m + 1]]), 0.7)
    madera = simplificar(np.column_stack([semi[fin_m - 6:], ys[fin_m - 6:]]), 0.7)

    # 3. El asa izquierda: lo opaco a la izquierda del cuenco que no es cuenco, unido a la semilla.
    cuerpo = np.zeros_like(alfa, bool)
    for i, y in enumerate(ys[:fin_m]):
        cuerpo[y, int(EJE - semi[i]): int(EJE + semi[i]) + 1] = True
    zona = (alfa > 0.5) & ~cuerpo
    zona[:, int(EJE):] = False
    zona[FIN_METAL - 200:, :] = False
    semilla = np.zeros_like(zona)
    semilla[SEMILLA_ASA[1], SEMILLA_ASA[0]] = True
    asa = inundar(zona, semilla)
    # Hacia el cuenco se estira 6 px, para que el asa entre en el metal y no quede una rendija al girar.
    asa = asa | (dilatar(asa, 6) & cuerpo)
    ay, ax = np.nonzero(asa)
    caja_asa = (ax.min(), ay.min(), ax.max() + 1, ay.max() + 1)
    alfa_asa = np.where(dilatar(asa, 1), alfa, 0)
    guardar_webp(color, alfa_asa, caja_asa, IMG / 'asa-arbb.webp', 90)
    c = contorno(asa)
    lejos = int(np.argmax(np.hypot(*(c - c[0]).T)))  # un contorno cerrado se simplifica en dos mitades
    borde = np.vstack([simplificar(c[: lejos + 1], 0.8)[:-1], simplificar(np.vstack([c[lejos:], c[:1]]), 0.8)[:-1]])

    # 4. El escudo: lo que no es cromo alrededor de la R, cerrado por dentro.
    x0e, x1e = int(EJE - ESCUDO_X), int(EJE + ESCUDO_X)
    y0e, y1e = 140, 420
    zona_e = a[y0e:y1e, x0e:x1e]
    croma = zona_e.max(2) - zona_e.min(2)
    cromo = croma < 28  # gris claro u oscuro: el cromo y sus reflejos; el escudo es de color hasta el borde
    afuera = np.zeros_like(cromo)
    afuera[0, :] = afuera[-1, :] = afuera[:, 0] = afuera[:, -1] = True
    afuera = inundar(cromo | ~(alfa[y0e:y1e, x0e:x1e] > 0.5), afuera)
    # Sólo la mancha del escudo (un reflejo oscuro del cromo al costado también sale "no cromo").
    # Una apertura de 3 px corta las tiras finas pegadas (el borde dorado del escudo es más grueso).
    abierto = dilatar(erosionar(~afuera, 3), 3) & ~afuera
    escudo = inundar(abierto, np.pad(np.ones((1, 1), bool), ((260 - y0e, y1e - 261), (int(EJE) - x0e, x1e - int(EJE) - 1))))
    ey, ex = np.nonzero(escudo)
    caja_esc = (x0e + ex.min(), y0e + ey.min(), x0e + ex.max() + 1, y0e + ey.max() + 1)
    alfa_esc = np.zeros_like(alfa)
    alfa_esc[y0e:y1e, x0e:x1e] = escudo
    # Un píxel de borde suave para que no se vea serruchado.
    alfa_esc = np.maximum(alfa_esc, 0.5 * (dilatar(alfa_esc > 0, 1) & ~(alfa_esc > 0)))
    guardar_webp(color, alfa_esc, caja_esc, IMG / 'escudo-arbb.webp', 92)

    # 5. Las medidas, en unidades de escena: x = distancia al eje, y = altura sobre el canto de la base.
    redondear = lambda v: round(float(v), 4)  # noqa: E731
    datos = {
        'escala': ESCALA,
        'metal': [[redondear(r / ESCALA), redondear(a_escena(y))] for r, y in metal],
        'madera': [[redondear(r / ESCALA), redondear(a_escena(y))] for r, y in madera],
        'asa': {
            'puntos': [[redondear((x - EJE) / ESCALA), redondear(a_escena(y))] for x, y in borde],
            # Para la textura: dónde está el recorte, en las mismas unidades.
            'textura': {'x0': redondear((caja_asa[0] - EJE) / ESCALA), 'y1': redondear(a_escena(caja_asa[1])),
                        'ancho': redondear((caja_asa[2] - caja_asa[0]) / ESCALA), 'alto': redondear((caja_asa[3] - caja_asa[1]) / ESCALA)},
        },
        'escudo': {'ancho': redondear((caja_esc[2] - caja_esc[0]) / ESCALA), 'alto': redondear((caja_esc[3] - caja_esc[1]) / ESCALA),
                   'centroX': redondear(((caja_esc[0] + caja_esc[2]) / 2 - EJE) / ESCALA),
                   'arriba': redondear(a_escena(caja_esc[1])), 'abajo': redondear(a_escena(caja_esc[3]))},
        'camara': CAMARA,
        # El tambor recto (radio 172 px) en alturas reales, ya sin la elipse: de la fila 838 a la 960 del perfil.
        # (En la foto las placas de frente se ven unos 50 px más abajo: es la vista desde arriba.)
        'tambor': {'radio': redondear(172 / ESCALA), 'arriba': redondear(a_escena(838)), 'abajo': redondear(a_escena(960))},
    }
    texto = ('/**\n * Medidas de la copa sacadas de la foto por scripts/copa-arbb/preparar.py: NO editar a mano, volver a\n'
             ' * correr el script. Unidades de escena (100 px de la foto = 1); y = altura sobre el canto más ancho de\n'
             ' * la base. `metal` y `madera` son perfiles de torno [radio, altura]; `asa.puntos` es el contorno del asa\n'
             ' * izquierda [x, y] con x negativa (a la izquierda del eje).\n */\n'
             f'export const COPA = {json.dumps(datos, ensure_ascii=False)};\n')
    MEDIDAS.write_text(texto, encoding='utf8')
    print(f'metal {len(metal)} pts, madera {len(madera)} pts, asa {len(borde)} pts')
    print('escudo', caja_esc, 'asa', caja_asa)
    for nombre in ('copa-arbb', 'escudo-arbb', 'asa-arbb'):
        print(nombre, (IMG / f'{nombre}.webp').stat().st_size // 1024, 'KB')
    return semi, ys, asa, escudo, (x0e, y0e)


if __name__ == '__main__':
    principal()
