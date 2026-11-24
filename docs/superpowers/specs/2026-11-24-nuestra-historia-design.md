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

**Pendiente de fuente (no se publica):** las copas "José Guido" y "Nicolás Galdiz", el 32 de 33 de 1943, el 30-0 de 1948 y su técnico, el 21-0 y el 99,7 de promedio de 1977, el 96-70 y la fecha 26/12/1978, la final de 1983 contra Náutico y los nombres de los planteles.

## Página
`/historia` (rewrite a `public/historia.html`). Mobile first, a 375 px y en escritorio.
1. **Encabezado:** "15 veces campeón rosarino", con un contador animado (sólo si no hay `prefers-reduced-motion`) y una bajada sobre el Parque de la Independencia.
2. **Vitrina + línea de tiempo:** en escritorio, la vitrina queda fija a la izquierda y la línea de tiempo a la derecha; en celular, la vitrina va arriba y las fichas debajo. Épocas: *1943–1954 Los 12 seguidos*, *1950 Del Vecchio campeón del mundo*, *1977–1978 La vuelta*, *1983 La 15ª*, *1990 El Cubierto, sede del Mundial*. Al elegir una época se actualiza la tarjeta "Archivo histórico" y se marcan en la copa las placas de esos años.
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

## Técnica y reglas del repo
- Archivos: `src/data/historia.js` (datos y funciones puras, sin DOM), `src/ui/historia.js` (página), `src/ui/vitrina3d.js` (Three.js) y estilos en `public/css/historia.css` sobre los tokens. Fuentes: Barlow Condensed e Inter, que ya están vendorizadas; no se agregan otras.
- Se respeta la CSP de `vercel.json` (sin scripts en línea) y se le suma un bloque de headers para `/historia` si hace falta.
- HTML con `html\`` de `ui/html.js`. Todo el texto en español rioplatense, con tono institucional.
- Tests: `tests/historia.test.js` controla que haya 15 títulos con estos años exactos, que cada dato publicado tenga fuente y que ningún dato pendiente se renderice.
- `sitemap.xml` suma `/historia`. El portal enlaza a la página recién en la última tarea, después de que Tomás la vea.

## Fuera de alcance
Las tres copas de época, modelos `.glb`, datos sin fuente, video y sonido.
