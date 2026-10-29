# Tema oscuro elegible y fondo con patrón: plan

> Ejecutar en la sesión, sin subagentes (CLAUDE.md). Una task es un commit. Al terminar cada task, correr `npm run test:q` y commitear sin preguntar.

**Spec:** `docs/superpowers/specs/2026-10-29-tema-oscuro-design.md`. Leerlo entero antes de la task 1.
**Prototipo:** `docs/prototipos/semillero-patron.html` (se abre servido en `localhost:5173`, no como archivo). Los valores de los tokens salen de su bloque `:root` / `[data-tema="oscuro"]` (líneas 12–41): no inventar colores nuevos.
**Rama:** `feat/tema-oscuro`, desde `main` (asistencia ya está mergeada en 1e5a286). Sin migración: la preferencia vive en el teléfono.
**Modelo:** Sonnet. No toca SQL ni RLS.

## Decisiones que no se vuelven a discutir

- Claro por defecto; "Tema oscuro" es un interruptor en Mi perfil. **Sin** opción "como el celular".
- Preferencia en `localStorage` (`semillero.tema`), con try/catch como `src/ui/borradorMedicion.js`.
- Patrón A (escudo tonal + pelota Tabler + "1903", girado −12°) en los dos temas, sólo detrás de las tarjetas.
- El portal público (`.publico`) sigue negro siempre: el atributo de tema no lo cambia.
- La pizarra de jugadas y el PNG exportado quedan claros en los dos temas (son un "papel").

## Estado

| Task | Qué | Estado |
|---|---|---|
| 1 | Tokens de rol, sin cambio visual | hecha (8b8d79a) |
| 2 | Chequeo de contraste y tema en la herramienta visual | hecha |
| 3 | Tema oscuro: tokens, `tema.js`, interruptor, DESIGN.md | pendiente |
| 4 | Patrón de fondo y ajuste del claro | pendiente |
| 5 | Repaso de casos especiales en los dos temas | pendiente |

**Hallazgos del `contraste` en claro (task 2), a arreglar en la task 5:** (a) `.flecha` del chevron de PLANTEL da 2.45:1 porque `publico.css:133` define `.flecha` suelto y le pisa el color a la app; (b) los botones `.cat` de la cabecera miden 41×44 px (< 44 de ancho).
**Nota de la task 1:** roles extra que hicieron falta: `--sup-hundida` (no `--sup-2`: ya existe como superficie oscura), `--pista` y los de gráficos `--graf-*`. Exentos a propósito: pizarra `.pz*`, impresión, `.nav`, `.test-fila.hecho .ic`, `.rec-filo-sello`, `.crono-aviso`.

---

## Task 1 — Tokens de rol, sin cambio visual (refactor)

**Archivos:** `public/css/tokens.css`, `public/css/{base,componentes,layout}.css`, `src/ui/componentes/graficos.js`, `src/ui/pantallas/datos.js`, `src/ui/componentes/exportarJugada.js`, `tests/contratoTokens.test.js` (nuevo).

**Qué:**
- Antes de tocar nada: generar la galería y correr `herramienta.mjs base` (estilos computados de referencia).
- En `tokens.css`, tokens de rol que apuntan a los de paleta actuales: `--fondo-app` (→ `--papel`), `--sup` (→ `--blanco`), `--texto` (→ `--tinta`), `--texto-2` (→ `--gris`), `--borde` (→ `--linea`), `--fondo-chip-t` (→ `--fondo-chip`). Comentario corto del porqué: el tema oscuro redefine sólo éstos.
- Reemplazar los usos de `--papel`, `--blanco`, `--tinta`, `--gris`, `--linea` dentro de `.pant` y sus componentes (hoy ~31/37/67/67/40). **No** tocar la cabecera, el toast, `.publico`, ni lo que ya va sobre `--negro`/`--sup-*`.
- Colores sueltos a tokens: `layout.css:176` (`#817D77`), `graficos.js` (`#726E65`, `#C9C5BE`, `#FBFAF8`, `#fff`, `#6E6B66`, `#EAE6DF`), `datos.js:127`. Los SVG de `graficos.js` usan `var(--…)` en `fill`/`stroke`. `exportarJugada.js` (canvas → PNG) **no** puede leer variables con `var()`: deja sus literales pero con un comentario de que el PNG es siempre claro, o lee el valor con `getComputedStyle` de `:root` con fallback literal. Lo que sea más simple.
- Los `#10005`/`#9998` de `cronometroSalida`, `ejercicio`, `fichaJugador`, `marcadorCuadros` son entidades HTML, no colores: no se tocan.

**Aceptación:** `herramienta.mjs comparar` da 0 diferencias contra la base. `test:q` verde.
**Tests:** `contratoTokens.test.js` › "cada token de rol está definido en :root"; › "las pantallas no usan --papel/--blanco/--tinta/--gris/--linea fuera de las excepciones" (lista corta de selectores permitidos: cabecera, toast, `.publico`).

## Task 2 — Contraste y tema en la herramienta visual (scripts)

**Archivos:** `scripts/verificacion-visual/herramienta.mjs`, `scripts/verificacion-visual/hacer-galeria.mjs`.

**Qué:**
- Variable `TEMA=oscuro` en la herramienta: pone `data-tema="oscuro"` en `<html>` antes de medir o capturar.
- Modo nuevo `contraste`: por cada vista de la galería a 375 y 1280, recorre los nodos con texto y calcula el contraste contra el fondo efectivo (subiendo por los ancestros hasta un fondo opaco; si el fondo es `body`, usar el peor caso del patrón: `--fondo-app` con `--patron-color` encima). Informa también desbordes horizontales y toques < 44 px. Sale con código ≠ 0 si hay fallas. El script del prototipo no quedó guardado: se reescribe con ese criterio.
- `hacer-galeria.mjs`: que no saque `tema.js` cuando exista (task 3), así la galería prueba el arranque real.

**Aceptación:** `contraste` corre sobre la galería actual en claro y da 0 fallas (si hoy hay alguna, anotarla en la tabla y arreglarla en la task 5, no acá).
**Tests:** ninguno de `node --test` (es herramienta de verificación); se prueba corriéndola.

## Task 3 — Tema oscuro (feature)

**Archivos:** `public/css/tokens.css`, `public/tema.js` (nuevo), `public/index.html`, `src/data/tema.js` (nuevo), `src/ui/pantallas/miPerfil.js`, `DESIGN.md`, `tests/tema.test.js` (nuevo), `tests/contratoTokens.test.js`.

**Qué:**
- `[data-tema="oscuro"]` en `tokens.css` redefine sólo tokens de rol, con los valores del prototipo: fondo `--pub-fondo`, tarjeta `--pub-tarjeta`, texto `--sobre-oscuro`, texto-2 `--gris-osc`, borde `--pub-borde`, chip `#24242C`, rojo chico `--club-texto`, y `color-scheme:dark`. Si hace falta un rol más (p. ej. la pista de las barras, `--sup-2` del prototipo), se agrega en `:root` también.
- `src/data/tema.js` (puro): normalizar el valor guardado (`'oscuro'` → oscuro; cualquier otra cosa, ausente o roto → claro) y la clave `semillero.tema`.
- `public/tema.js`: script clásico, sin `defer`, en el `<head>` junto a `config.js`. Lee la preferencia (try/catch), pone `data-tema` en `<html>` y ajusta `meta theme-color`. No importa módulos (corre antes del importmap): repite la regla mínima con un comentario que apunte a `src/data/tema.js`. Archivo y no inline: la CSP sólo acepta scripts de `'self'`.
- Mi perfil: bloque "Apariencia" con el interruptor "Tema oscuro" (`role="switch"`, 44 px) con `html\`...\``, en un template propio (no mezclar con los `escaparHtml` del resto; migrarlos sólo si es chico). Al tocarlo: guarda, cambia el atributo al instante y avisa con `toast`.
- `DESIGN.md`: reemplazar "No hay tema oscuro…" por la regla nueva (clara por defecto, oscura a elección; portal siempre negro), documentar los tokens de rol y que las pantallas nuevas usan roles, no paleta. Sumarlo al checklist de pantalla nueva.

**Aceptación:** en el navegador, prender el interruptor cambia toda la app sin recargar; al recargar arranca oscura sin parpadeo blanco; el portal sigue igual. `herramienta.mjs contraste` con `TEMA=oscuro`: anotar las fallas que queden para la task 5. `test:q` verde.
**Tests:** `tema.test.js` › "'oscuro' se respeta"; › "valor raro o vacío da claro"; `contratoTokens.test.js` › "cada token redefinido en [data-tema=oscuro] existe en :root"; › "public/tema.js usa la misma clave que src/data/tema.js".

## Task 4 — Patrón de fondo y ajuste del claro (feature)

**Archivos:** `public/img/patron.png` (copia de `docs/prototipos/patron/patron-a.png`), `public/css/tokens.css`, `public/css/base.css` (o `layout.css`, donde viva el fondo de la app), `DESIGN.md`.

**Qué:**
- Capa fija detrás de la app (`::before` del contenedor de la app o de `body` sólo cuando se ve la app, para no tocar el portal), enmascarada con la baldosa a 480 px, girada −12°, más grande que la pantalla para que el giro no deje esquinas. Color `--patron-color`: `rgba(19,19,22,.08)` en claro, `rgba(255,255,255,.04)` en oscuro.
- Ajuste del claro que pide el patrón (prototipo): `--fondo-app` pasa a `#E9E7E2` y `--texto-2` a `#58554F`, porque `--gris` sobre el fondo con patrón no llega a 4.5:1. Sólo cambian los tokens de rol, no los de paleta.
- Sin patrón con `@supports not (mask-image: …)` y con `prefers-reduced-transparency: reduce`.
- `DESIGN.md`: sección corta del patrón (qué es, dónde no va, que la baldosa se rehace con `docs/prototipos/patron/generar.html`).

**Aceptación:** `contraste` en claro y en oscuro con el patrón debajo: 0 fallas de las pantallas que ya pasaban. Scroll fluido en la galería a 375 con `herramienta.mjs recorrido` (sin frames largos nuevos). `test:q` verde.
**Tests:** `contratoTokens.test.js` › "--patron-color está definido en los dos temas"; › "el portal (.publico) no lleva el patrón".

## Task 5 — Repaso de casos especiales (fix)

**Archivos:** los que hagan falta según lo anotado en las tasks 2–4.

**Qué:** recorrer en los dos temas, con la galería y en el navegador logueado contra la base local: gráficos de DATOS y de la ficha, la pizarra y el visor de jugadas (fondo claro siempre, sobre una placa si queda suelta en oscuro), escudos de rivales u otras imágenes con fondo blanco (sobre placa clara), la toma de asistencia (verde "presente" en oscuro: `--sube-osc`), chips de estado/semáforo, campos y placeholders, avisos `--aviso-fondo`. Arreglar con tokens de rol.

**Aceptación:** `contraste` da 0 fallas y 0 desbordes en claro y oscuro, a 375 y 1280. Capturas de HOY, PLANTEL, DATOS, ficha y Mi perfil en los dos temas en `.claude/worktrees/_galeria/salida/` (no van a git). `test:q` verde. Actualizar la tabla de Estado.

---

## Fuera de este plan

- **Cromos de jugadores en PLANTEL** (la grilla de tarjetas del prototipo, commit 177be49): el spec no los incluye. Si se quieren, van en un spec y una rama aparte, después de esto.
- Tema "como el celular": descartado.
- Que la preferencia siga a la cuenta entre dispositivos: no, es del teléfono.
