"""
Prepara la malla 3D de la copa de "Nuestra historia" (src/ui/copa3d.js) a partir de la malla generada
(scripts/copa-arbb/malla-fuente.glb: sólo geometría, sin textura) y deja:
  - public/img/historia/copa-arbb.glb  la copa limpia: un solo mallado con tres primitivas (cromo, bronce,
                                        madera), en unidades de escena (100 px de la foto = 1, y = 0 en el canto
                                        más ancho de la base) y con normales suaves ya calculadas.
  - src/data/copaMalla.js               lo que midió del modelo: el tambor (radio y alto), dónde está el escudo
                                        y la altura total. copa3d.js no adivina nada: lo lee de ahí.

Qué le hace a la malla (en este orden):
  1. Centra el eje en (x, z) = (0, 0): la malla viene corrida un par de milésimas.
  2. Alisa el cuerpo: el escudo "R" que esculpió el generador (con relieve deformado) y la chapita del dorso del
     tambor se aplanan al radio del cáliz / del tambor, y el ruido de la superficie del cáliz se lleva al perfil
     liso. El escudo de verdad se estampa después como decal con el recorte de la foto.
  3. Decima con colapso de aristas por error cuadrático (QEM) hasta ~27.000 triángulos: lo aplanado se funde
     primero, el resto queda igual.
  4. Separa por geometría (no por el color de la textura horneada del muestrario, que no sirve de guía): asas =
     fuera del radio del cáliz en el plano de las asas; madera = por debajo del pie de metal; cromo = el resto.
  5. Mapeo UV: cilíndrico para la madera (con la costura duplicada), plano para el bronce.

Uso (desde la raíz del repo):  python scripts/copa-arbb/malla.py
Sólo numpy. Lo fijo (los rangos de y, los ángulos) es de esta malla.
"""
import heapq
import json
import struct
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[2]
FUENTE = RAIZ / 'scripts/copa-arbb/malla-fuente.glb'
SALIDA = RAIZ / 'public/img/historia/copa-arbb.glb'
MEDIDAS = RAIZ / 'src/data/copaMalla.js'

OBJETIVO = 27000          # triángulos
ALTO_ESCENA = 9.49        # del fondo de la base a la boca, igual que la foto (boca 9,26 y fondo -0,23)
Y_FONDO = -0.23
PASO_Y = 0.01             # el ancho de las franjas del perfil


def leer_glb(ruta):
    b = ruta.read_bytes()
    _, _, largo = struct.unpack('<III', b[:12])
    off, js, binario = 12, None, None
    while off < largo:
        n, tipo = struct.unpack('<II', b[off:off + 8])
        trozo = b[off + 8:off + 8 + n]
        off += 8 + n
        if tipo == 0x4E4F534A:
            js = json.loads(trozo)
        elif tipo == 0x004E4942:
            binario = trozo

    def acc(i):
        a = js['accessors'][i]
        bv = js['bufferViews'][a['bufferView']]
        dt = {5123: np.uint16, 5125: np.uint32, 5126: np.float32}[a['componentType']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        ini = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(binario, dtype=dt, count=a['count'] * n, offset=ini).reshape(a['count'], n).copy()

    p = js['meshes'][0]['primitives'][0]
    return acc(p['attributes']['POSITION']).astype(np.float64), acc(p['indices']).reshape(-1, 3).astype(np.int64)


# ---------------------------------------------------------------------------
# Perfiles de torno
# ---------------------------------------------------------------------------

def perfil(pos, r, seleccion, f, ymin=-1.0, ymax=1.0):
    """Radio por franjas de y: f(radios de la franja). Devuelve (ys, radios) con los huecos rellenados y suavizado."""
    ys = np.arange(ymin, ymax, PASO_Y) + PASO_Y / 2
    out = np.full(len(ys), np.nan)
    for i, y in enumerate(ys):
        m = seleccion & (np.abs(pos[:, 1] - y) < PASO_Y / 2)
        if m.sum() >= 6:
            out[i] = f(r[m])
    ok = ~np.isnan(out)
    out = np.interp(ys, ys[ok], out[ok])
    # mediana de 5 y media de 5: quita los picos sueltos sin comerse las curvas (las franjas son finas)
    pad = np.pad(out, 2, mode='edge')
    med = np.median(np.stack([pad[k:k + len(out)] for k in range(5)]), axis=0)
    pad = np.pad(med, 2, mode='edge')
    return ys, np.mean(np.stack([pad[k:k + len(out)] for k in range(5)]), axis=0)


# ---------------------------------------------------------------------------
# Decimación por error cuadrático
# ---------------------------------------------------------------------------

def decimar(pos, tris, objetivo):
    pos = pos.copy()
    nv = len(pos)
    caras = [tuple(int(x) for x in t) for t in tris]
    viva = [True] * len(caras)
    vf = [set() for _ in range(nv)]
    vec = [set() for _ in range(nv)]
    for i, t in enumerate(caras):
        for k in range(3):
            vf[t[k]].add(i)
            vec[t[k]].update((t[(k + 1) % 3], t[(k + 2) % 3]))
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    n = np.cross(b - a, c - a)
    area = np.linalg.norm(n, axis=1) / 2
    n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-30)
    plano = np.concatenate([n, -np.sum(n * a, axis=1, keepdims=True)], axis=1)
    K = plano[:, :, None] * plano[:, None, :] * area[:, None, None]
    Q = np.zeros((nv, 4, 4))
    for k in range(3):
        np.add.at(Q, tris[:, k], K)
    vivo = [True] * nv
    sello = [0] * nv
    cola = []
    cuenta = 0

    def mejor(u, v):
        Qs = Q[u] + Q[v]
        elegido = None
        for p in (0.5 * (pos[u] + pos[v]), pos[u], pos[v]):
            h = np.append(p, 1.0)
            e = float(h @ Qs @ h)
            if elegido is None or e < elegido[0]:
                elegido = (e, p)
        return elegido

    def empujar(u, v):
        nonlocal cuenta
        e, _ = mejor(u, v)
        cuenta += 1
        heapq.heappush(cola, (e, cuenta, u, v, sello[u], sello[v]))

    for u in range(nv):
        for v in vec[u]:
            if u < v:
                empujar(u, v)

    def se_puede(u, v, p, entre):
        if len(entre) != 2 or len(vec[u] & vec[v]) != 2:
            return False
        for w in (u, v):
            for f in vf[w]:
                if f in entre:
                    continue
                t = caras[f]
                viejo = [pos[x] for x in t]
                nuevo = [p if x in (u, v) else pos[x] for x in t]
                n0 = np.cross(viejo[1] - viejo[0], viejo[2] - viejo[0])
                n1 = np.cross(nuevo[1] - nuevo[0], nuevo[2] - nuevo[0])
                l0, l1 = np.linalg.norm(n0), np.linalg.norm(n1)
                if l0 > 1e-12 and (l1 < 1e-14 or float(n0 @ n1) < 0.25 * l0 * l1):
                    return False
        return True

    quedan = len(caras)
    while quedan > objetivo and cola:
        e, _, u, v, su, sv = heapq.heappop(cola)
        if not (vivo[u] and vivo[v]) or su != sello[u] or sv != sello[v]:
            continue
        _, p = mejor(u, v)
        entre = vf[u] & vf[v]
        if not se_puede(u, v, p, entre):
            continue
        for f in entre:
            viva[f] = False
            for x in caras[f]:
                vf[x].discard(f)
            quedan -= 1
        for f in list(vf[v]):
            caras[f] = tuple(u if x == v else x for x in caras[f])
            vf[u].add(f)
        vf[v] = set()
        for w in vec[v]:
            vec[w].discard(v)
            if w != u:
                vec[w].add(u)
                vec[u].add(w)
        vec[u].discard(v)
        vec[v] = set()
        vivo[v] = False
        pos[u] = p
        Q[u] += Q[v]
        sello[u] += 1
        for w in vec[u]:
            empujar(u, w)

    quedan_f = np.array([caras[i] for i in range(len(caras)) if viva[i]], dtype=np.int64)
    usados = np.unique(quedan_f)
    remap = np.full(nv, -1, dtype=np.int64)
    remap[usados] = np.arange(len(usados))
    return pos[usados], remap[quedan_f]


# ---------------------------------------------------------------------------
# Normales, UV y GLB
# ---------------------------------------------------------------------------

def normales(pos, tris):
    """Normales suaves ponderadas por el ángulo de cada cara en el vértice (lo que three llama computeVertexNormals,
    pero con la malla soldada: las costuras de UV no parten el sombreado)."""
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    nc = np.cross(b - a, c - a)
    nc /= np.maximum(np.linalg.norm(nc, axis=1, keepdims=True), 1e-30)
    out = np.zeros_like(pos)
    for k in range(3):
        e1 = pos[tris[:, (k + 1) % 3]] - pos[tris[:, k]]
        e2 = pos[tris[:, (k + 2) % 3]] - pos[tris[:, k]]
        cos = np.sum(e1 * e2, axis=1) / np.maximum(np.linalg.norm(e1, axis=1) * np.linalg.norm(e2, axis=1), 1e-30)
        ang = np.arccos(np.clip(cos, -1, 1))
        np.add.at(out, tris[:, k], nc * ang[:, None])
    return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-30)


def escribir_glb(ruta, primitivas):
    """primitivas: lista de dicts {nombre, pos, nor, uv|None, idx}. Un mallado, un material por primitiva."""
    binario = bytearray()
    vistas, accesores, prims, materiales = [], [], [], []

    def agregar(arr, tipo, comp, destino, extra=None):
        while len(binario) % 4:
            binario.append(0)
        vistas.append({'buffer': 0, 'byteOffset': len(binario), 'byteLength': arr.nbytes, 'target': destino})
        binario.extend(arr.tobytes())
        a = {'bufferView': len(vistas) - 1, 'componentType': comp, 'count': len(arr), 'type': tipo}
        if extra:
            a.update(extra)
        accesores.append(a)
        return len(accesores) - 1

    for k, p in enumerate(primitivas):
        pos = p['pos'].astype(np.float32)
        atrs = {
            'POSITION': agregar(pos, 'VEC3', 5126, 34962, {'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()}),
            'NORMAL': agregar(p['nor'].astype(np.float32), 'VEC3', 5126, 34962),
        }
        if p['uv'] is not None:
            atrs['TEXCOORD_0'] = agregar(p['uv'].astype(np.float32), 'VEC2', 5126, 34962)
        tipo = np.uint16 if len(pos) < 65535 else np.uint32
        idx = agregar(p['idx'].astype(tipo).ravel(), 'SCALAR', 5123 if tipo is np.uint16 else 5125, 34963)
        prims.append({'attributes': atrs, 'indices': idx, 'material': k, 'mode': 4})
        materiales.append({'name': p['nombre']})
    js = {
        'asset': {'version': '2.0', 'generator': 'scripts/copa-arbb/malla.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'copa', 'mesh': 0}],
        'meshes': [{'name': 'copa', 'primitives': prims}], 'materials': materiales,
        'buffers': [{'byteLength': len(binario)}], 'bufferViews': vistas, 'accessors': accesores,
    }
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * (-len(j) % 4)
    binario += b'\0' * (-len(binario) % 4)
    total = 12 + 8 + len(j) + 8 + len(binario)
    ruta.write_bytes(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(j), 0x4E4F534A) + j
                     + struct.pack('<II', len(binario), 0x004E4942) + bytes(binario))


# ---------------------------------------------------------------------------

def con_costura(p, n, t):
    """Mapeo cilíndrico de la madera: u por el ángulo, v por la altura. Los triángulos que cruzan el corte
    (u cerca de 0 y de 1) usan copias de los vértices con u + 1 (la textura se repite, no hay salto)."""
    u = np.arctan2(p[:, 0], p[:, 2]) / (2 * np.pi) + 0.5
    v = p[:, 1] / 2.6
    copias, extra_p, extra_n, extra_uv, nt = {}, [], [], [], []
    for tri in t:
        us = u[tri]
        cruza = us.max() - us.min() > 0.5
        fila = []
        for vtx in tri:
            if cruza and u[vtx] < 0.5:
                if vtx not in copias:
                    copias[vtx] = len(p) + len(extra_p)
                    extra_p.append(p[vtx])
                    extra_n.append(n[vtx])
                    extra_uv.append((u[vtx] + 1, v[vtx]))
                fila.append(copias[vtx])
            else:
                fila.append(int(vtx))
        nt.append(fila)
    uv = np.concatenate([np.stack([u, v], axis=1), np.array(extra_uv).reshape(-1, 2)])
    return (np.concatenate([p, np.array(extra_p).reshape(-1, 3)]),
            np.concatenate([n, np.array(extra_n).reshape(-1, 3)]), uv, np.array(nt))


def main():
    pos, tris = leer_glb(FUENTE)
    print(f'fuente: {len(pos)} vértices, {len(tris)} triángulos')

    # 1. El eje: el tambor es un cilindro, su caja da el centro.
    banda = (pos[:, 1] > -0.74) & (pos[:, 1] < -0.56)
    pos[:, 0] -= (pos[banda, 0].min() + pos[banda, 0].max()) / 2
    pos[:, 2] -= (pos[banda, 2].min() + pos[banda, 2].max()) / 2
    y = pos[:, 1]
    r = np.hypot(pos[:, 0], pos[:, 2])
    fi = np.degrees(np.arctan2(pos[:, 0], pos[:, 2]))  # 0° = el frente (+z), ±90° = las asas

    # 2. Perfiles: el cáliz por el dorso (sin escudo ni asas), el tambor por todo el contorno (no tiene hueco).
    ys, r_caliz = perfil(pos, r, np.abs(fi) > 130, lambda v: np.percentile(v, 90))
    ys_t, r_tambor = perfil(pos, r, r > 0.3, np.median, -0.82, -0.46)

    def Rc(yy):
        return np.interp(yy, ys, r_caliz)

    def Rt(yy):
        return np.interp(yy, ys_t, r_tambor)

    # El escudo esculpido: lo que sobresale bien (más de 0,025) del cáliz por el frente; con menos, la diferencia es
    # que el cáliz es un poco más ancho hacia el frente que hacia el dorso. Se mide antes de aplanarlo.
    relieve = (np.abs(fi) < 60) & (y > 0.05) & (y < 0.95) & (r > Rc(y) + 0.025) & (r < Rc(y) + 0.15)
    y0, y1 = np.percentile(y[relieve], [1, 99])
    mitad = np.radians(np.percentile(np.abs(fi[relieve]), 99))
    ancho = float(2 * Rc((y0 + y1) / 2) * np.sin(mitad))
    print(f'relieve del escudo esculpido: {relieve.sum()} vértices, y {y0:.3f}..{y1:.3f}, ancho {ancho:.3f}')
    escudo = {'y0': float(y0), 'y1': float(y1), 'ancho': ancho}

    # El cáliz (y de 0,12 a 0,86, fuera de las asas): todo lo que está cerca de la superficie exterior va al perfil.
    lejos_de_asas = (np.abs(fi) < 75) | (np.abs(fi) > 105)
    cuerpo = lejos_de_asas & (y > 0.12) & (y < 0.86) & (r > Rc(y) - 0.012) & (r < Rc(y) + 0.15)
    # El tambor (de -0,78 a -0,50): lo que sobresale (la chapita del dorso) y el ruido van al perfil.
    tambor = (y > -0.78) & (y < -0.50) & (r > 0.3) & (np.abs(r - Rt(y)) < 0.04)
    for sel, f in ((cuerpo, Rc), (tambor, Rt)):
        k = f(y[sel]) / r[sel]
        pos[sel, 0] *= k
        pos[sel, 2] *= k
    print(f'aplanados: cáliz {cuerpo.sum()} vértices, tambor {tambor.sum()}')

    # 3. Decimación.
    pos, tris = decimar(pos, tris, OBJETIVO)
    # Triángulos sin área (lo aplanado deja unos pocos): no dibujan nada, sólo estorban a las normales.
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    tris = tris[np.linalg.norm(np.cross(b - a, c - a), axis=1) > 1e-12]
    print(f'decimada: {len(pos)} vértices, {len(tris)} triángulos')

    # 4. Las tres piezas, por geometría.
    y = pos[:, 1]
    cen = pos[tris].mean(axis=1)
    rr = np.hypot(pos[:, 0], pos[:, 2])
    # Dónde se apoya el pie de metal en la madera: la tapa plana de la madera (anillo entre r 0,345 y 0,43).
    plano = (rr > 0.345) & (rr < 0.43) & (y > -0.45) & (y < -0.38)
    y_tapa = float(np.median(y[plano]))
    print(f'la tapa de la madera está en y = {y_tapa:.4f} ({plano.sum()} vértices)')
    madera = cen[:, 1] < y_tapa + 0.004
    asa = (~madera) & (np.abs(cen[:, 2]) < 0.10) & (np.abs(cen[:, 0]) > Rc(cen[:, 1]) + 0.004) & (cen[:, 1] > 0.05)
    cromo = ~(madera | asa)
    print(f'cromo {cromo.sum()}, bronce {asa.sum()}, madera {madera.sum()} triángulos')

    # 5. A escena: la altura de la foto y el fondo de la base en -0,23.
    y_min = float(pos[:, 1].min())
    k = ALTO_ESCENA / float(pos[:, 1].max() - y_min)
    pos = pos * k
    pos[:, 1] = pos[:, 1] - y_min * k + Y_FONDO

    def esc(v):
        return float((v - y_min) * k + Y_FONDO)

    nor = normales(pos, tris)

    prims = []
    for nombre, mask in (('cromo', cromo), ('bronce', asa), ('madera', madera)):
        t = tris[mask]
        usados = np.unique(t)
        remap = np.full(len(pos), -1)
        remap[usados] = np.arange(len(usados))
        p, n, t = pos[usados], nor[usados], remap[t]
        uv = None
        if nombre == 'bronce':
            uv = np.stack([p[:, 0] / 3.0, p[:, 1] / 3.0], axis=1)
        elif nombre == 'madera':
            p, n, uv, t = con_costura(p, n, t)
        prims.append({'nombre': nombre, 'pos': p, 'nor': n, 'uv': uv, 'idx': t})
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    escribir_glb(SALIDA, prims)
    print(f'{SALIDA.relative_to(RAIZ)}: {SALIDA.stat().st_size / 1024:.0f} KB')

    # 6. Lo medido, sobre la malla ya hecha: el tambor es el tramo de la base donde el radio no cambia (sin los
    # bordes: ahí empiezan la tapa y el vuelo de la base, y las placas no pueden pisarlos).
    rr = np.hypot(pos[:, 0], pos[:, 2])
    base = (rr > 1.4) & (pos[:, 1] < 3.3)
    radio_t = float(np.median(rr[base & (pos[:, 1] > 1.2) & (pos[:, 1] < 1.8)]))
    franjas = np.arange(0.5, 3.0, 0.02)

    def recta(y0):
        en = base & (pos[:, 1] >= y0) & (pos[:, 1] < y0 + 0.02)
        return en.sum() >= 2 and abs(np.median(rr[en]) - radio_t) < 0.035

    # El tramo continuo que contiene el medio del tambor (el torno panzea unos 0,03: no es un cilindro perfecto), con
    # un margen de dos franjas en cada punta.
    i = int(np.argmin(np.abs(franjas - 1.5)))
    i0 = i1 = i
    while i0 > 0 and recta(franjas[i0 - 1]):
        i0 -= 1
    while i1 < len(franjas) - 1 and recta(franjas[i1 + 1]):
        i1 += 1
    abajo, arriba = franjas[i0] + 0.04, franjas[i1] + 0.02 - 0.04
    en_tambor = base & (pos[:, 1] > abajo) & (pos[:, 1] < arriba)
    radio_t = float(np.percentile(rr[en_tambor], 98))  # las placas van afuera de lo más ancho, no de lo mediano
    print(f'tambor: radio {radio_t:.3f}, de {abajo:.2f} a {arriba:.2f}')
    medidas = {
        'tambor': {'radio': round(radio_t, 4), 'arriba': round(arriba, 3), 'abajo': round(abajo, 3)},
        'escudo': {'arriba': round(esc(escudo['y1']), 3), 'abajo': round(esc(escudo['y0']), 3), 'ancho': round(escudo['ancho'] * k, 3)},
        'alto': ALTO_ESCENA,
        'triangulos': int(len(tris)),
        'anchoAsas': round(float(pos[:, 0].max() - pos[:, 0].min()), 3),
    }
    MEDIDAS.write_text(
        '/**\n * Medidas de la malla de la copa, sacadas por scripts/copa-arbb/malla.py: NO editar a mano, volver a correr\n'
        ' * el script. Mismas unidades de escena que copaMedidas.js (y = 0 en el canto más ancho de la base).\n'
        ' * `tambor` es el cilindro de la base donde van las placas; `escudo` es dónde estaba el escudo esculpido,\n'
        ' * que es donde se estampa el decal.\n */\n'
        f'export const MALLA = {json.dumps(medidas)};\n', encoding='utf8')
    print(json.dumps(medidas))


if __name__ == '__main__':
    main()
