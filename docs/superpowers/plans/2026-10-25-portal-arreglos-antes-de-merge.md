# Portal: arreglos antes de mergear `feat/rediseno-portal`

Rama: `feat/rediseno-portal`. Ejecutar con Sonnet, una task por commit, `npm run test:q` antes de cada uno.
Capturas para Tomás a 390 px y 1440 px con Edge sin ventana (ver memoria del portal). En localhost el
calendario da 403: para ver la cinta y "Lo que viene" con datos, probar con eventos de ejemplo
inyectados en los tests y mirar el preview de Vercel de la rama.

## Decisiones (25/10, Tomás)
- "Lo que viene" en grande, como en v0, pero sin depender de tener una foto de cada evento: **foto por
  tipo** (partido, evento, charla, entrenamiento) tomada de `FOTOS`, en duotono como las categorías.
  Si algún día un evento trae foto propia, se agrega después; ahora no.
- La cinta deja de estar girada y deja de llevar "Sumá tu empresa": sólo próximas fechas, con su ícono y
  color por tipo. Sin fechas, la cinta no se muestra.
- Sponsor: un **sticker chico que gira** en una esquina del hero, texto "¿Tenés una empresa? Sumate", que
  baja a `#colaborar`. Con `prefers-reduced-motion`, quieto.
- Íconos en la **barra fija de abajo** y en **Agendar en Google / iPhone**.
- Semillero: el "Soy profe o jugador" pasa a ser un **botón visible con borde e ícono** ("Semillero"),
  que sigue abriendo el panelcito (Entrar + cómo instalarla).
- Pie: escudo, links legales y "Hecho por <nombre>" con link a LinkedIn. Nombre y URL en `PORTAL`
  (`src/data/portal.js`); sin URL válida, sólo el nombre.
- Fotos de cada categoría: quedan las actuales. Cambiarlas después es soltar un `.webp` en
  `public/img/fotos/` y tocar la línea `foto:` de la categoría en `src/data/portal.js`.

## Tasks

### 1. Cinta horizontal, sólo fechas
- Archivos: `src/ui/portal.js` (`htmlCinta`, `iniciarPortal`, `mostrarProximo`), `public/css/publico.css`
  (bloque "cinta"), `tests/portalPagina.test.js`.
- Aceptación: la banda sin `rotate`; sin ítems `cinta-sumate`; con 0 fechas `#cinta` queda `hidden`; con
  1–2 fechas, quieta; con 3+ corre y tiene pausa (como hoy).
- Tests: `la cinta no ofrece sponsors`, `sin fechas la cinta no se muestra`.

### 2. "Lo que viene" como sección propia
- Archivos: `public/portal.html` (sección `#lo-que-viene` entre la cinta y Categorías, oculta por
  defecto; sacar `#portal-proximo` de Calendario), `src/data/portal.js` (foto por tipo, reusando `FOTOS`),
  `src/ui/portal.js` (`htmlProximo` con foto, fecha grande, chip de tipo, día · hora, lugar, descripción
  si hay, y los dos botones de agendar), `public/css/publico.css`, `tests/portal.test.js`,
  `tests/portalPagina.test.js`.
- Aceptación: tarjeta foto a la izquierda / datos a la derecha en compu, apilada en el celu; un tipo sin
  foto usa la foto general del hero; sin evento próximo la sección no aparece; atajo "Agenda" en la fila
  de atajos si la sección está.
- Tests: `cada tipo de evento tiene foto válida`, `lo que viene sin eventos no se muestra`,
  `lo que viene muestra fecha, tipo y botones de agendar`.

### 3. Íconos en la barra de abajo y en Agendar
- Archivos: `src/ui/portal.js` (`htmlDock`, botones de agendar en `htmlEvento` y `htmlProximo`; ícono de
  calendario y de celular nuevos en `ICONO`), `public/css/publico.css`, `tests/portalPagina.test.js`.
- Aceptación: cada botón del dock y de agendar tiene un `<svg aria-hidden="true">` y su texto sigue
  visible; área táctil ≥ `--tap`.
- Tests: `el dock lleva íconos`, `agendar lleva íconos`.

### 4. Sticker de sponsor en el hero
- Archivos: `public/portal.html` (el enlace dentro de `#heroe`), `public/css/publico.css`,
  `tests/portalPagina.test.js`, `DESIGN.md` (una línea: el sticker es el único elemento que gira).
- Aceptación: círculo chico con texto en anillo que gira lento y "Sumate" fijo al centro; abajo a la
  derecha de la foto en compu, sin tapar título ni botones en el celu (390 px); `href="#colaborar"` y
  `aria-label` claro; quieto con `prefers-reduced-motion`.
- Tests: `el sticker de sponsor lleva a colaborar`, `el sticker respeta reduced-motion`.

### 5. Botón de Semillero en el encabezado
- Archivos: `public/portal.html` (`summary` del `details#semillero`), `public/css/publico.css`,
  `tests/portalPagina.test.js`.
- Aceptación: se ve como botón (borde, ícono, texto "Semillero"), no como link subrayado; el panel y su
  contenido no cambian; entra en 390 px junto al escudo.
- Tests: `el acceso a Semillero es un botón visible`.

### 6. Pie con escudo y firma
- Archivos: `public/portal.html` (`footer.portal-pie`), `src/data/portal.js` (`PORTAL.creador`:
  `{ nombre, linkedin }`), `src/ui/portal.js` (pinta la firma; valida que el link sea
  `https://www.linkedin.com/...`), `public/css/publico.css`, `tests/portal.test.js`,
  `tests/portalPagina.test.js`.
- Aceptación: escudo + "Básquet Newell's", los links legales y Entrar a Semillero, y "Hecho por <nombre>"
  con link externo (`rel="noopener"`); un link que no es de LinkedIn no se pinta.
- Tests: `la firma sólo enlaza a LinkedIn`, `el pie lleva escudo y links legales`.

### 7. Revisión final y capturas
- `npm run test:q`, `graphify update .`, capturas 390/1440 para Tomás; después, merge a `main` si da el OK.
