# Plan: Nuestra Historia

Spec: `docs/superpowers/specs/2026-11-24-nuestra-historia-design.md`. Se trabaja **directo en `main`**: la página es nueva y no se enlaza hasta la task 4, así que no rompe nada publicado. Cada task es una sesión nueva con Sonnet y termina en un commit. Antes de commitear hay que pasar `npm run test:q` y después correr `graphify update .`.

## Estado
| Task | Estado | Commit |
|---|---|---|
| 1. Datos puros | hecha | 3002f92 + 54c63a9 |
| 2. Página sin 3D | hecha | `git log -1 -- public/historia.html` |
| 3. Vitrina 3D | reemplazada por la 6 y la 7 | |
| Rediseño de la línea (fuera de plan) | hecha | a51898d + ecb62a9 |
| 5. Hero, línea viva y el Cubierto | hecha (falta que Tomás la mire) | `git log -1 -- public/css/historia.css` |
| 5b. El Cubierto con foto | pendiente | |
| 6. Copa 3D | pendiente | |
| 7. Medalla 3D y selector | pendiente | |
| 4. Enlace desde el portal (va última) | pendiente | |

## Revisión 2: tasks 5–7 (spec, sección "Revisión 2")
Van en orden y de a una, porque tocan los mismos archivos. Three.js ya tiene el OK de Tomás.
- **Task 5: hero, línea viva y el Cubierto.** Archivos: `public/historia.html`, `src/ui/historia.js`, `public/css/historia.css` y `tests/historiaPagina.test.js`. Puntos 1, 2, 3 (la columna sticky sin caja, con el SVG de respaldo todavía) y 6 de la revisión. Acepta: un solo eje continuo sin cortes de punta a punta; el progreso rojo sigue al scroll; los nodos se encienden al alcanzarlos; el año no se repite en ningún bloque; las fuentes como badges; ni desborde ni errores a 375 y 1440 px; respeta `prefers-reduced-motion`. Tests: `un solo eje en la línea`, `ningún bloque repite el año`, `las fuentes no muestran la URL`, `el Cubierto no lleva año de inauguración`.
- **Task 6: copa 3D.** Archivos: `public/vendor/` (Three.js y OrbitControls, con su licencia), el importmap, `src/ui/vitrina3d.js`, `src/ui/historia.js` y `vercel.json` (sólo si la CSP lo pide). Puntos 4 de la revisión y "Vitrina 3D" de la spec (15 placas, el contrato `historia:seleccion`/`historia:elegir`, la carga diferida, el respaldo sin WebGL y `touch-action: pan-y`). Acepta: la luz es real (sin trapecio), la copa levita, gira con el scroll y se arrastra, el escudo tiene relieve y en el celular el scroll no se traba. Capturas de frente y girada.
- **Task 7: medalla 3D y selector.** Archivos: `src/ui/vitrina3d.js` (o un `src/ui/medalla3d.js` hermano), `src/ui/historia.js` y `public/css/historia.css`. Punto 5 de la revisión. Usa un solo renderer y alterna escenas, sin dos contextos WebGL. Acepta: el selector cambia de pieza, al llegar a las estrellas pasa sola a la medalla, el péndulo reacciona al mouse y se queda quieto con `prefers-reduced-motion`. Captura de la medalla al lado de la foto de referencia.

## Task 1: datos puros
- **Archivos:** `src/data/historia.js` y `tests/historia.test.js`.
- **Qué:** cargar los títulos (año, época, `torneo` para el Clausura 1983), las épocas de la línea de tiempo y los hitos, cada uno con `fuente` (medio, título, fecha, URL). Los datos pendientes de la spec van marcados `pendiente: true`. Funciones puras: `titulos()`, `epocas()`, `datosPublicables()` (filtra los pendientes), `epocaDeAnio(anio)` y `microDato(anio)` (si el año no tiene dato propio, devuelve el de su época).
- **Acepta:** 15 títulos con los años exactos 1943–1954, 1977, 1978 y 1983; ningún dato publicable sin fuente; el módulo es puro, así que pasa `tests/arquitectura.test.js`.
- **Tests:** `quince títulos con los años exactos`, `todo dato publicable tiene fuente`, `los pendientes no se publican`, `epocaDeAnio ubica cada título`, `microDato cae al de la época`.

## Task 2: página sin 3D
- **Archivos:** `public/historia.html`, `src/ui/historia.js`, `public/css/historia.css`, `vercel.json` (rewrite de `/historia` y headers con la misma CSP y `no-store` que `/`) y `public/sitemap.xml`. Foto: `public/img/historia/plantel-que-triunfo.png` (ya está; si hay cómo, pasarla a `.webp`).
- **Qué:** encabezado con contador, línea de tiempo con tarjeta "Archivo histórico", grilla de las 15 estrellas y foto de archivo. Para la vitrina queda un contenedor vacío con la imagen estática de respaldo (un SVG simple de copa, hecho a mano). Mismo encabezado y pie que el portal, cada uno con un link para volver.
- **Acepta:** se ve bien a 375 px y en escritorio, sin errores en la consola. Con `prefers-reduced-motion` no hay animaciones. Todo el texto sale de `src/data/historia.js`.
- **Verificación:** capturas a 375 px (navegador integrado con `resize_window`) y en escritorio (`msedge --headless --screenshot`). Se las muestra a Tomás.

## Task 3: vitrina 3D
- **Archivos:** `public/vendor/three.module.min.js` y `public/vendor/OrbitControls.js` (u otro nombre equivalente), el importmap de `public/historia.html`, `src/ui/vitrina3d.js` y `src/ui/historia.js` (que los conecta).
- **Antes de empezar:** bajar Three.js requiere permiso. Pedírselo a Tomás indicando el archivo, la versión exacta (con al menos dos semanas de publicada), la fuente (registro de npm, vía `npm pack`) y el tamaño. Sin su sí, no se descarga nada.
- **Qué:** la copa procedural según la spec, con las fotos de `docs/privado/historia-referencias/` como modelo (no copiarlas al repo). Tiene 15 placas que responden a toques y quedan sincronizadas con la línea de tiempo y la grilla. Incluye los botones "Ver de frente" y "Luz de vitrina", la carga diferida con `import()`, el respaldo si no hay WebGL, el giro sólo horizontal con `touch-action: pan-y` en el celular y la opción `glbUrl`.
- **Acepta:** en el celular la página hace scroll con el dedo encima del canvas. Al tocar una placa se abre la ficha del año. Con `prefers-reduced-motion` no hay giro automático. Sin WebGL se ve la imagen estática. Muestra la leyenda "Recreación inspirada en la copa actual de la Asociación Rosarina".
- **Tests:** `tests/historia.test.js` suma `cada título tiene su placa` (si la posición de las placas sale de una función pura en `src/data/historia.js`). Capturas de la copa de frente y girada, a 375 px y en escritorio.

## Task 4: enlace desde el portal
- **Archivos:** `public/portal.html` (la línea del palmarés en `#info-club` lleva a `/historia`, y un atajo si encaja) y las metas OG/Twitter de `public/historia.html`.
- **Acepta:** desde el portal se llega a la historia y se vuelve. `npm run test:q` en verde.
- **Al terminar:** sugerir con un botón subir a los dos repos (`git push` y después `npm run publicar -- --push https://github.com/tomasandino12/basquetnewells.git`). No pushear sin el sí de Tomás.
