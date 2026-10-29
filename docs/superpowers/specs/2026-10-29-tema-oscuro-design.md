# Tema oscuro elegible y fondo con patrón — diseño

29/10. Sale del prototipo `docs/prototipos/semillero-patron.html` (commit 1c2c4dd), donde Tomás eligió el **patrón A** y le gustaron los dos temas.

## 1. Qué se decide

- La app sigue **clara por defecto**. En **Mi perfil**, un interruptor "Tema oscuro" la pasa a oscuro. No hay opción "como el celular": se elige a mano.
- La preferencia es del teléfono, no de la cuenta: se guarda en `localStorage` (`semillero.tema`), con try/catch como `borradorMedicion.js`. Sin base ni migración.
- En los dos temas, el fondo de las pantallas lleva el **patrón A**: el escudo en un tono, la pelota de Tabler y "1903", girado −12°. Va sólo detrás de las tarjetas, nunca sobre texto.
- `DESIGN.md` cambia la regla "No hay tema oscuro": la app es clara por defecto y oscura a elección; el portal público sigue negro siempre.

## 2. Cómo se arma

**Commit 1, refactor sin cambio visual.** Hoy las pantallas usan tokens de paleta directamente (`--papel` 28 veces, `--blanco` 33, `--tinta` 64, `--gris` 65, `--linea` 38). Se agregan tokens con nombre de rol en `tokens.css`: `--fondo-app`, `--sup`, `--texto`, `--texto-2`, `--borde`, `--fondo-chip-t`, y se reemplazan los usos dentro de `.pant` y sus componentes. La cabecera, el toast y lo que ya es oscuro (`--negro`, `--sup-1`) no se tocan. Los 11 colores sueltos en CSS y JS (`graficos.js`, `datos.js`, `exportarJugada.js`) pasan a tokens. La galería de `scripts/verificacion-visual/` tiene que salir igual antes y después (comparación de capturas).

**Commit 2, el tema.**
- `[data-tema="oscuro"]` en `<html>` redefine sólo los tokens de rol, con los valores del prototipo: fondo `--pub-fondo`, tarjeta `--pub-tarjeta`, texto `--sobre-oscuro`, texto secundario `--gris-osc`, borde `--pub-borde`, y rojo chico `--club-texto`, porque `--club` sobre oscuro da 3.8:1.
- `public/tema.js`, chico y cargado sin `defer` en el `<head>` como `config.js`, pone el atributo antes de pintar para que no haya un parpadeo blanco. Tiene que ser un archivo y no un script dentro del HTML, porque la CSP sólo acepta scripts de `'self'`.
- `meta theme-color` acompaña el tema.
- El interruptor va en Mi perfil, con `html\`...\``.

**Commit 3, el patrón.**
- `patron-a.png` pasa a `public/img/patron.png`.
- Se agrega una capa `body::before` fija, enmascarada con el PNG y teñida con `--patron-color` (negro al 8 % en claro, blanco al 4 % en oscuro). Una sola baldosa sirve para los dos temas.
- `prefers-reduced-transparency` o sin soporte de `mask` → sin patrón.
- El generador queda en `docs/prototipos/patron/generar.html` por si hay que rehacer la baldosa.

## 3. Riesgos

- **Gráficos y la pizarra de jugadas:** dibujan en canvas o SVG con colores propios y se revisan uno por uno. La pizarra puede quedar clara en los dos temas (es un "papel").
- **Contraste:** el script de Playwright del prototipo (contraste por nodo con el patrón debajo, desborde, toques de 44 px) se pasa a `scripts/verificacion-visual/` y se corre sobre la galería en los dos temas.
- **Imágenes con fondo blanco** (escudos de rivales, si hay): van sobre una placa clara.

## 4. Pruebas

- `tests/tema.test.js`: la lógica pura de leer o guardar la preferencia (`src/data/tema.js`: valor válido, valor raro → claro).
- `tests/contratoTokens.test.js`: cada token de rol que se redefine en `[data-tema="oscuro"]` existe en `:root`.
- La galería, en claro y en oscuro: 0 fallas de contraste, 0 desbordes.

## 5. Orden

Va **después de la asistencia** y en otra rama. El commit 1 toca muchas pantallas: mejor que no conviva con la rama de asistencia, que también las toca.
