# Peso de la pantalla nueva frente a la vieja (04/11)

Lo que baja el celular, comprimido (gzip), sin fuentes ni imágenes.

| | JS | CSS | HTML | Total |
|---|---|---|---|---|
| App vieja (`/app`, entera: 191 módulos + supabase-js) | 442 + 59 kB | 51 kB | 8 kB | **~560 kB** |
| App nueva (`/nueva`: Plantel + ficha) | 198 + 71 kB | 6 kB | 0,4 kB | **~275 kB** |

- La vieja carga **todas** las pantallas al arrancar (no hay armado ni minificado) y pide ~190 archivos; la nueva, 3 archivos armados y minificados.
- Al pasar de `/app` a `/nueva` el celular baja los ~275 kB nuevos encima de lo que ya bajó la vieja: el primer salto cuesta, los siguientes no.
- La nueva va a crecer a medida que se mude cada pantalla. El tope (330 kB) está en `tests/pesoMudanzaReact.test.js`; conviene partir el JS por pantalla cuando se acerque.
- Fuentes: la nueva reusa las mismas de la vieja (Inter, Barlow Condensed, IBM Plex Mono); el navegador baja sólo las que usa.
