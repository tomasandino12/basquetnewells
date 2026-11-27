# Copa 3D de "Nuestra historia": de dónde sale cada archivo

Los tres scripts usan sólo `numpy` y `Pillow`, y se corren desde la raíz del repo.

| Script | Lee | Deja |
|---|---|---|
| `malla.py` | `malla-fuente.glb` (malla generada por IA, sólo geometría) | `public/img/historia/copa-arbb.glb` y `src/data/copaMalla.js` |
| `texturas.py` | `referencia-sin-chapitas.webp` (la foto del trofeo) | `escudo-arbb-hd.webp` (decal del escudo) y `caoba-real.webp` (veta de la base) |
| `hdri.py` | el `.hdr` de Poly Haven | `estudio.hdr` (1024 × 512, con luz de relleno sumada) |
| `preparar.py` | `copa-arbb-original.jpg` | la foto de respaldo sin WebGL y `src/data/copaMedidas.js` (la cámara) |

- **La malla** se alisa (el escudo esculpido y la chapita del dorso del tambor se aplanan), se decima a ~27.000
  triángulos y se parte por geometría en tres piezas: cromo (cáliz, tallo y pie), bronce (asas) y madera (la base).
  El color de la textura horneada del muestrario (`sample.glb`, en la raíz del repo, sin versionar) no se usa: no sirve
  de guía.
- **El HDRI** es `studio_small_03` de [Poly Haven](https://polyhaven.com/a/studio_small_03), licencia CC0 (no exige
  atribución). Para regenerarlo, bajar la versión 1k `.hdr` a una carpeta aparte y pasarle la ruta a `hdri.py`.
- Los materiales (cromo, bronce, caoba con laca) y la luz están en `src/ui/copa3d.js`; los lectores de `.glb` y `.hdr`
  y el decal, en `src/ui/copa/`. Los contratos de todo esto, en `tests/copaMalla.test.js`.
