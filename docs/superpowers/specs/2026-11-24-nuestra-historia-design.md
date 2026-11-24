# Nuestra Historia: vitrina del básquet de Newell's (spec)

24/11/2026. Página pública nueva, del lado "público" (negro, rojo, títulos condensados en mayúscula; ver memoria de las dos estéticas y `public/css/publico.css`). Muestra los 15 títulos de Primera de la Asociación Rosarina y una vitrina 3D con la copa.

## Qué es y para quién
Un padre o un hincha entra desde el portal y en un minuto entiende por qué el básquet de Newell's importa en Rosario. No hay login, no se usa Supabase y no hay datos de menores.

## Regla de oro: sólo datos con fuente
Cada dato que se muestra lleva su fuente en `src/data/historia.js` (campo `fuente`). Lo que no tiene fuente no se publica: queda en el módulo como `pendiente` y no se renderiza. Si Tomás consigue la fuente, se carga y aparece.

**Verificado (24/11/2026):**
- 12 títulos seguidos, 1943 a 1954. La nota lo llama un registro "sin precedentes" en las grandes ligas del mundo. Fuente: La Capital, "Los campeones de todos los años en los torneos de la Asociación Rosarina de Básquet" (31/12/2025).
- 1977 y 1978: "el regreso a los primeros planos". Fuente: la misma nota.
- 1983: campeón del Clausura. Ese año hubo por primera vez dos campeones; el Apertura lo ganó Sportivo Constitución. Fuente: la misma nota.
- La ARBB cumple 100 años el 12/07/2026; su primer campeón fue Provincial, en 1926. Fuente: la misma nota.
- Hugo "Balazo" Del Vecchio, nacido en Rosario y jugador de Newell's, integró el plantel argentino campeón del primer Mundial (1950, Luna Park, final 64-50 contra Estados Unidos). Fuentes: Olympedia (atleta 5986) y FIBA.
- El Estadio Cubierto Claudio Newell fue sede del Grupo B del Mundial 1990. Fuente: Wikipedia (Estadio Cubierto Newell's Old Boys / 1990 FIBA World Championship). La fecha de inauguración no está confirmada: no se muestra.

**Agregado el 24/11, con fuente en las notas del Centenario de la ARBB (rosariobasquetbol.com.ar):** la Copa José Guido y el 32 de 33 de 1943 (con su plantel); las Copas Nicolás Galdiz de 1946, 1947 y 1948; el 30-0 de 1948 con Héctor Carrozo como técnico; el duodécimo título de 1954; el 21-0 y el promedio de 99,70 de 1977; el 96-70 con Buffarini y la final del 26/12/1978; y 1983 como "torneo regular" (La Capital lo llama Clausura): 2-1 a Central en semifinales y 2-0 a Náutico en la final, con el plantel de Pablo D'Angelo. Hay una época nueva, "1948, el invicto".

**Pendiente de fuente (no se publica):** la fecha de inauguración del Cubierto, el resultado del clásico de 1943 y los planteles del resto de los años.

## Página
`/historia` (rewrite a `public/historia.html`). Mobile first, a 375 px y en escritorio.
1. **Encabezado:** "15 veces campeón rosarino", con un contador animado (sólo si no hay `prefers-reduced-motion`) y una bajada sobre el Parque de la Independencia.
   A la derecha en escritorio (abajo en celular), un **panel de cifras** (títulos, racha más larga con sus años, primer y último título) calculado desde los datos con `resumenDeTitulos()`.
2. **Vitrina + línea histórica (rediseño del 24/11, a pedido de Tomás):** en escritorio, la vitrina queda fija a la izquierda y la línea a la derecha; en celular, la vitrina va arriba y la línea debajo. La línea reemplaza al acordeón "Archivo histórico": un bloque por época (barra roja, sobretítulo "1943 – 1954 · 12 títulos" y título grande) con las tarjetas de sus títulos en una tira unida por una línea roja. Los años con dato propio llevan tarjeta grande (texto, "Ver plantel" desplegable, fuente); los demás, una fila compacta, y el texto de la época se dice una sola vez. Los hitos que no son un título (Del Vecchio 1950, el Cubierto 1990 y los 100 años de la Rosarina, marcados `momento: true` en los datos) van como tarjetas "momento": anchas, con borde rojo a la izquierda y sin estrella. Épocas: *1943–1954 Los 12 seguidos* (con Del Vecchio y el invicto de 1948 adentro), *1977–1978 La vuelta*, *1983 La 15ª*, *1990 El Cubierto, sede del Mundial*. Al tocar una tarjeta, al llegar con el scroll a otra época o al tocar una placa de la copa, se actualiza la selección y se marcan en la copa las placas de esos años.
   **Color:** el dorado es sólo de las estrellas (un título ganado) y de algún filete de la vitrina; el texto va en blanco, gris o rojo del club (lo vigila `tests/historiaPagina.test.js`).
3. **Grilla de las 15 estrellas:** cada año muestra un micro-dato verificado al tocarlo o al pasar el mouse. Si un año no tiene dato propio, muestra el de su época.
4. **Foto de archivo:** "El plantel que triunfó" (`public/img/historia/plantel-que-triunfo.png`), sin año porque no lo sabemos.

## Vitrina 3D
- **Una sola copa:** la copa challenger de Primera de la ARBB, modelada con las fotos de referencia de `docs/privado/historia-referencias/` (fuera de git). Tiene cuenco de plata ancho, dos asas altas doradas, escudo azul con la "R" roja al frente, un tallo plateado con anillos y una base redonda escalonada de madera oscura. Lleva **15 placas plateadas** en la base, una por título. La copa no se inventa en tres versiones: no hay fotos de las de época.
- **Leyenda obligatoria:** "Recreación inspirada en la copa actual de la Asociación Rosarina".
- Three.js vendorizado en `public/vendor/` (versión exacta, con al menos dos semanas de publicada), más OrbitControls y una entrada `three` en el importmap. Geometría procedural: torno para el cuenco y el tallo, tubos para las asas, cilindros para la base. Materiales metálicos PBR (plata con metalness ~0.85 y roughness ~0.2; dorado #C5A059), luz de vitrina cálida y sombra de contacto suave.
- **Controles:** rotación 360° con inercia, zoom acotado y giro automático lento que se pausa al tocar. Botones "Ver de frente" y "Luz de vitrina", y la indicación "Arrastrá para girar · Tocá una placa". Tocar una placa acerca la cámara y abre la ficha del año.
- **Celular:** el gesto vertical sigue haciendo scroll en la página: sólo se gira en horizontal y se usa `touch-action: pan-y` en el canvas.
- **Rendimiento:** Three.js se carga con `import()` recién cuando la vitrina se acerca al viewport. Si no hay WebGL, se muestra una imagen estática con la misma leyenda. Con `prefers-reduced-motion` no hay giro automático.
- `crearVitrina(contenedor, { glbUrl })`: si se le pasa `glbUrl`, carga ese modelo en vez de la copa procedural (para un escaneo futuro).

## Revisión 2 (24/11 noche, pedido de Tomás): manda sobre lo de arriba si choca
Referencias fuera de git, en `docs/privado/historia-referencias/`: `v0-hero.png` y `v0-epocas.png` (fuerza tipográfica y limpieza editorial; el fondo sigue siendo `#0A0A0C`) y `medallas-arbb.png` (la medalla).
1. **Hero de apertura**, antes del split: el sobretítulo "Archivo histórico · Básquet", **NUESTRA** (blanco) / **HISTORIA** (rojo `#E30613`) gigante en Barlow Condensed y un indicador animado para bajar, que empalma con el comienzo del eje rojo. El "15 veces campeón" y las cifras pasan a abrir la línea.
2. **Línea viva:** un **único eje vertical continuo** en la columna derecha (base `rgba(255,255,255,.12)` de 2 px) con una línea de progreso roja encima que crece con el scroll (`requestAnimationFrame`, sin librerías). Se eliminan los `border-left` sueltos. Cada título y cada hito tiene un nodo centrado sobre el eje: cuando la línea lo alcanza, se llena de rojo con un halo suave, su tarjeta entra (opacidad + `translateY`) y su número de fondo toma presencia. Va con 40–56 px de aire entre el eje y el contenido y 96–120 px entre hitos. El año se muestra una sola vez por bloque: los momentos llevan una etiqueta de categoría ("Hito institucional", "Orgullo mundial"). Las fuentes son badges chicos de archivo con el nombre del medio como link, sin URL a la vista y sin fecha de consulta. Con `prefers-reduced-motion` la línea se muestra completa y nada entra animado.
3. **Columna de la vitrina:** `position: sticky; top: 0; height: 100vh`, sin caja ni borde ni trapecio de luz 2D. Si hace falta un haz visible, es un gradiente difuminado con opacidad menor a 0,08. En el celular la vitrina va arriba y no es sticky.
4. **Copa 3D:** la luz es real en Three.js: un SpotLight cenital cálido, un rim light lateral sutil (rojizo o frío) y una sombra suave en la base. En reposo levita y oscila apenas, gira un poco al avanzar el scroll y se puede arrastrar en cualquier momento (OrbitControls con damping, sin zoom brusco). El escudo de la "R" es una insignia con relieve integrada al metal.
5. **Medalla ARBB 3D:** disco plateado envejecido con borde granulado, ojal rectangular arriba y cinta textil roja y azul. La textura frontal sale de un canvas (`map` + `bumpMap`/`roughnessMap`) con el anillo "Asociación Rosarina de Basquetbol", los gajos de pelota de fondo y el escudo con "ARBB" y la "R". Un selector sutil (`Trofeo ARBB` / `Medalla oficial`) la cambia por la copa, y también cambia sola al llegar a "Las 15 estrellas". Baja colgando como un péndulo suave que reacciona al mouse y al arrastre. Leyenda: "Recreación inspirada en la medalla actual de la Asociación Rosarina".
7. **El Cubierto, versión con foto (manda sobre el punto 6):** la pieza central es la foto `public/img/historia/cubierto-interior.webp` (y la de 800 px): parquet clásico y butacas rojinegras. Es una imagen hecha con IA a partir de fotos reales; Tomás le borró las letras inventadas de la tribuna y decidió no ponerle rótulo. **No se muestra el piso azul actual en ningún lado.** La foto va con borde `1px solid rgba(255,255,255,.08)`, viñeteado oscuro abajo para que el texto se lea encima, tilt 3D sutil con el cursor y `scale(1.03)` en hover (sin tilt en táctil ni con `prefers-reduced-motion`). Lleva la etiqueta roja "El templo rojinegro", el título "Estadio Cubierto Dr. Claudio L. Newell" (sin año) y una bajada breve: uno de los estadios cubiertos emblemáticos del básquet argentino, en el Parque de la Independencia, sede mundialista. En una esquina va un sello técnico en SVG, de trazo fino blanco o gris al 20% con un detalle en `#E30613`, con la silueta del techo tomada de `docs/privado/historia-referencias/cubierto-aerea-referencia.webp` (doble bóveda curva escalonada y tambor cilíndrico de ingreso) y sólo datos con fuente: "Sede Mundial FIBA 1990 · Grupo B" y "Mundial FIBA U17 2018". **No van** la inauguración en 1978, los 7.800 m² ni que ahí se jugaron los títulos de los 70 y 80: lo primero no tiene fuente, y las finales de 1978 y 1983 fueron en Sportivo América.
6. **El Cubierto (primera versión, reemplazada por el punto 7):** tarjeta destacada con parallax/tilt por capas al pasar el mouse: un plano estilizado de la cancha cubierta y sus tribunas, en SVG o CSS, sin cubos 3D, más el badge "Sede Mundial FIBA 1990 · Grupo B". **No se le pone año de inauguración** (no hay fuente; "1978" no está confirmado). En táctil, sin tilt.

## Técnica y reglas del repo
- Archivos: `src/data/historia.js` (datos y funciones puras, sin DOM), `src/ui/historia.js` (página), `src/ui/vitrina3d.js` (Three.js) y estilos en `public/css/historia.css` sobre los tokens. Fuentes: Barlow Condensed e Inter, que ya están vendorizadas; no se agregan otras.
- Se respeta la CSP de `vercel.json` (sin scripts en línea) y se le suma un bloque de headers para `/historia` si hace falta.
- HTML con `html\`` de `ui/html.js`. Todo el texto en español rioplatense, con tono institucional.
- Tests: `tests/historia.test.js` controla que haya 15 títulos con estos años exactos, que cada dato publicado tenga fuente y que ningún dato pendiente se renderice.
- `sitemap.xml` suma `/historia`. El portal enlaza a la página recién en la última tarea, después de que Tomás la vea.

## Fuera de alcance
Las tres copas de época, modelos `.glb`, datos sin fuente, video y sonido.
