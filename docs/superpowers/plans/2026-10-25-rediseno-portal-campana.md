# Rediseño del portal de familias ("Campaña" + detalles de "Póster")

Estado: **aprobado 25/10; fase 0 hecha** (rama `feat/rediseno-portal`). Se ejecuta por fases, una por vez, con commit por fase verificada.

**Decisiones de Tomás (25/10):** las fotos son públicas del Instagram del básquet: se pueden usar por ahora (§2.3 resuelto). El sello es "De U9 a U21" (hay U9–U21 y Primera). **El botón principal depende de la inscripción:** abierta → "Inscribirme" al formulario de inscripción; cerrada → "Quiero que juegue" al formulario para probarse (consultas); es la lógica que ya tiene `htmlHeroe`. **"Pagar" es genérico, no "la cuota":** se paga más que cuotas, así que el botón dice "PAGAR" (línea "Alias y comprobante"), la hoja "Pagar" y los textos de Ayuda dejan de decir "cuota".

## 1. Mapa de lo que existe hoy

| Pieza | Dónde | Notas |
|---|---|---|
| Página | `public/portal.html` (se sirve en `/`, rewrite de `vercel.json`) | Marcado estático; secciones con datos arrancan `hidden`. Sin SW, sin manifest. |
| Lógica | `src/ui/portal.js` (624 líneas) + `portalArranque.js` + `portalEntrada.js` | Funciones `html*` puras y exportadas + `iniciar*`. Todo con `html\`\`` (escapa). |
| Datos fijos | `src/data/portal.js` (`PORTAL`) | temporada 2027, categorías con horario, sede, alias `pagosbasquetnob`, contacto, calendario. |
| Datos de la base | `formulariosPublicos` (RPC anónima 0058) → `separarFormularios` | Da inscripción, consultas ("Quiero jugar"), comprobante, colaboradores, recaudación. |
| Eventos | Google Calendar API (`eventosDelMes`) → `data/agenda.js` | Un calendario; el tipo sale del color en Google. Clave restringida al dominio de Vercel. |
| Estilos | `public/css/publico.css` (`.portal-*`, ~líneas 195–693) y `layout.css` (≥ desktop) | Tokens en `tokens.css`. `--ease-salida` ya es `cubic-bezier(.16,1,.3,1)`. |
| Ayuda | `<dialog id="ayuda">` + `iniciarAyuda()` | Patrón de hoja ya resuelto (bottom sheet en mobile, modal en desktop): **se reutiliza para "Pagar la cuota"**. |

Lo que anda y hay que conservar tal cual: copiar alias, `data-ics` (iPhone) + `enlaceAgregarGoogle`, suscripción Android/iPhone (`htmlSuscripcion`), navegación de mes con caché, buscador de año, "Ver mapa" que carga el iframe sólo al tocar, hoja de Ayuda, banda de `destinoDeAuth` (links de login que van a `/app`), pie legal.

`landingAnimada.js` es de la landing de `/app`, **no** del portal. No se toca.

## 2. Hallazgos que condicionan el plan

1. **`_referencias/` y `public/img/fotos/` no existen.** Los tres `.zip` están en la raíz sin descomprimir (los abrí en una carpeta temporal para leerlos). Las fotos están en `rediseno-semillero.zip`: sólo 5 tomas (bandeja, dribbling, entrenamiento, primera-lanzamiento, primera-penetracion). El hero usa `formativas-bandeja` (1080×720 horizontal, 576×720 vertical).
2. **Los nombres de los zips están cruzados:** `newell-s-youth-basketball-landing-page.zip` es la **Campaña** (A: hero, ticker, dock) y `landing-page-newell-s-basquet.zip` es el **Póster** (B: ticket, sello, borde rasgado).
3. **Privacidad (menores).** La foto del hero muestra a un jugador identificable, sacada de Instagram. `PORTAL.foto` y el CLAUDE.md piden autorización de imagen firmada por las familias. Decisión tuya antes de publicar (ver §6). El plan deja el mapeo de fotos en `src/data/portal.js` para cambiarlas en una línea.
4. **CSP** (`vercel.json`): `script-src` sólo `'self'` + un hash (el import map). **No puede haber `<script>` inline**, así que la clase `.js-anim` en `<html>` la pone un script externo síncrono en el `<head>` (`/public/js/anim.js`, ~5 líneas), no un módulo (evita parpadeo). `img-src 'self'`: las fotos van locales. No cambia el hash.
5. **Contratos de tests que el rediseño toca a propósito:**
   - `tests/estilosTokens.test.js`: keyframes sólo `from`, sólo `transform`/`opacity`; **sólo una animación `infinite`** (la cinta sería la segunda → se actualiza el test); **no hay colores fuera de `tokens.css`** (el dorado del sello y los velos van como tokens nuevos); tap ≥ 44px; fuente ≥ 12px.
   - `tests/portalPagina.test.js`: orden de secciones, "Ayuda" en el header, `apagada`/"Pronto" en las tarjetas, textos del hero, `portal-banda-btn`, sin `<iframe>` ni script inline. Se reescriben las aserciones que cambian de intención; se conservan las de seguridad (CSP, sin iframe hasta el clic, coordinador una sola vez, sin "Próximamente").
6. **El CSS del portal dice "Sin animaciones de entrada: el título puede ser el LCP".** Lo revierto a sabiendas: el LCP pasa a ser la foto del hero (`fetchpriority="high"`, ~35–49 KB), y el título arranca a los 150 ms. Se mide en la fase 1.
7. **Verificación local:** la clave de Calendar está restringida al dominio de Vercel, así que en `localhost` el calendario no trae eventos reales. Para cinta, ticket y calendario se verifica llamando a las funciones `html*` con eventos de muestra (están exportadas) y, en la fase final, sobre el preview/deploy real.

## 3. Cambios por sección

**Header** — `portal.html` + `publico.css`. Escudo + "NEWELL'S BÁSQUET" (Barlow). "Soy profe o jugador" pasa a link de texto discreto, **conservando el `<details>` con el panel** (lleva el "Entrar a Semillero" y cómo instalar la app; el destino es el mismo de hoy). Se saca el "Ayuda" del header; la hoja sigue abriéndose desde la fila de atajos, el pie y los "¿Dudas?".

**Hero** — el título, el sello y las fotos pasan a **HTML estático** en `portal.html` (comentado para que sea fácil de cambiar y para que pinte sin esperar a la base); `portal.js` sólo completa temporada y estado de los botones. `<picture>` (vertical en mobile), `fetchpriority="high"`, width/height. Dos variantes de foto con una clase (`tratamiento-color` / `tratamiento-duotono`), las capturo en 390×844 y 1366×768, te las muestro y borro la que pierda. Corte diagonal con `clip-path`. Título con `clamp()` que usa **vw y svh** (para que los botones entren en 360×640, 390×844 y 1366×768; lo mido en el navegador con `getBoundingClientRect`, no a ojo). Sello dorado: texto **derivado de `PORTAL.categorias`** ("De U9 a U21"), no escrito a mano.

**Botones del hero** — `htmlHeroe` se parte en `htmlAcciones` (sólo los dos botones). "Quiero que juegue" mantiene la lógica actual (si la inscripción está abierta, el mismo botón dice "Inscribirme" y va a ese formulario; si no, al de consultas). "Pagar la cuota" **nunca apagado**: abre la hoja de pago.

**Hoja de pago** — reutiliza el patrón `<dialog>` de Ayuda: alias grande + **Copiar** (`¡Copiado!`, ya existe) + "Enviar comprobante" si el formulario está activo; si no, "Por ahora no hay nada para pagar", pero el alias se ve igual.

**Barra fija** — `IntersectionObserver` sobre los botones del hero; oculta mientras haya una hoja abierta; el `body` reserva su alto (que no tape el pie legal); `env(safe-area-inset-bottom)`; fondo translúcido con `backdrop-filter` y **respaldo sólido** si no hay soporte. Mobile: ancho completo. Desktop: flotante centrada.

**Cinta de fechas** — nueva, `src/ui/portal.js` (`htmlCinta`) + CSS. Sale de los mismos eventos ya traídos (`proximosEventos`, hasta 6; hoy `mostrarProximo` pide 1, se generaliza). Fila duplicada con `aria-hidden`, rotación −1.5°, pausa con mouse/foco, **botón de pausa de 44px** (el hover no existe en el celular), y **sin animación con 0–2 eventos** (queda una fila estática). Sólo `transform`.

**Lo que viene (ticket)** — `htmlProximo` conserva su marcado (los tests y el botón iPhone dependen de él); se rediseña casi todo por CSS: talón `SÁB / 24 / OCT`, muescas y línea punteada, botones de 48px.

**Calendario** — `htmlCalendario` y todo `iniciarCalendario` quedan igual. El layout lado a lado en desktop ya existe (`layout.css`); se reestiliza. Celdas ≥ 44px. Tipo de evento **no sólo por color**: los puntos del mes toman forma por tipo (círculo / rombo / cuadrado) y el detalle suma un ícono + el texto del tipo.

**¿En qué categoría juega?** — buscador y resultado intactos. Debajo, carrusel `scroll-snap` sin librería, generado de `categoriasDelPortal`. Duotono + degradé, nombre grande en Barlow. **Hay 8 categorías y 5 fotos:** las formativas rotan las 3 tomas con distinto recorte y las dos Primeras usan las dos tomas de Primera. Lo declaro en `PORTAL` para cambiarlo cuando llegue el fotógrafo.

**Recaudación / Sumate / Sede** — mismo contenido y mismos formularios, tarjetas oscuras con foto (`primera-lanzamiento`, `primera-penetracion`); un solo bloque rojo dominante por pantalla. "Dónde se entrena": la foto reemplaza el recuadro vacío, **el mapa de Google sigue sin cargarse hasta tocar** ("Ver mapa") y "Cómo llegar" queda. Borde rasgado como máximo 2 veces (entre el hero y la cinta, y antes del pie).

**Animaciones** — `.js-anim` en `<html>` activa los estados ocultos; con `prefers-reduced-motion` se fuerza el estado final (no basta `base.css`, porque un `.rise` oculto no tiene animación que apagar). Entrada del hero escalonada (150 ms + 90 ms/elemento, 0.7 s texto / 0.9 s líneas con `overflow:hidden`); parallax de la foto con `animation-timeline: scroll()` y respaldo en `requestAnimationFrame`; "rise" de secciones con un solo `IntersectionObserver` (una vez); sticker (scale .9, rotate −4° → 1, −2°) en ticket y sello; `:active` a `scale(.97)`. Sin librerías (no hace falta anime.js).

## 4. Riesgos y cómo se evitan

| Riesgo | Mitigación |
|---|---|
| Romper una promesa de `portalPagina.test.js` sin darme cuenta | Cada fase corre `npm run test:q` y toco sólo las aserciones cuya intención cambió, anotando cuáles. |
| Contenido invisible si falla el JS o hay reduced-motion | Estados ocultos sólo bajo `.js-anim`; regla explícita de reduced-motion; verifico con JS bloqueado y con la preferencia emulada. |
| Hero que desborda en pantallas chicas | Medición automática de los dos botones en los 3 viewports + a 320 px; `svh` en vez de `vh`. |
| Textos rojos chicos ilegibles sobre negro (`--club` sobre `--pub-fondo` = 3.8:1) | El rojo sólo en texto grande (≥ 24 px) y fondos de botón (blanco sobre rojo = 5.1:1); los textos chicos siguen en `--sobre-oscuro`/`--gris-osc`. |
| Foto 1080 px estirada en notebook/retina (queda blanda) | El degradé/duotono la tapan; si no alcanza, pido el original. |
| Cinta que marea o que no se puede parar | Botón de pausa, pausa por foco, estática con pocos eventos, apagada en reduced-motion. |
| Barra fija que tapa el pie o el teclado | Padding inferior reservado, se oculta con hoja abierta. |
| Dependencia de la API de Google en local | Verificación con datos de muestra + chequeo final en el deploy. |
| Fotos de menores | Decisión explícita (§6) antes de publicar. |
| Zips de 14 MB en la raíz | Agregar `*.zip` a `.gitignore` y `.vercelignore`. |

## 5. Fases (una por vez; commit por fase; refactor y feature separados)

| Fase | Contenido | Verificación |
|---|---|---|
| **0 · Preparación** ✅ | Fotos en `public/img/fotos/`; `*.zip` fuera de git/Vercel; tokens (`--dorado`, tiempos de entrada); `public/js/anim.js` + `src/ui/animaciones.js` + `.rise`; test nuevo. Sin cambios visibles. (El test de `infinite` se ajusta en la fase 3, cuando entra la cinta.) | `test:q`; el portal se ve igual. |
| **1 · Header + hero** | Header, hero estático, `<picture>`, dos variantes de foto, diagonal, título, sello, botones, entrada, parallax. | Capturas A/B en 390×844 y 1366×768 (te las muestro); medición de botones en 360×640 / 390×844 / 1366×768; LCP; consola sin errores. |
| **2 · Pagar + barra fija** | Hoja de pago, `htmlAcciones`, barra inferior. | Abrir/cerrar hoja (Esc, afuera, foco), Copiar, estado con y sin formulario de comprobante, barra al scrollear. |
| **3 · Cinta + ticket + calendario** | Cinta, ticket, calendario restyle, formas por tipo. | Funciones con eventos de muestra; iPhone `.ics` y Google; navegación de mes; 0/1/6 eventos. |
| **4 · Categorías** | Carrusel con fotos duotono. | Buscador intacto; snap en táctil; 8 tarjetas. |
| **5 · Recaudación, Sumate, Sede, bordes** | Tarjetas con foto, sede con foto, bordes rasgados, "rise" y sticker. | "Ver mapa" no carga hasta tocar; un solo rojo dominante por pantalla. |
| **6 · Cierre** | Textos de Ayuda (nombres nuevos de botones), tests, DESIGN.md (sección portal), auditoría con ui-ux-pro-max (contraste, tap, foco), reduced-motion, JS bloqueado, 320 px. | `test:q` verde; revisión final; sugerir deploy de preview. |

## 6. Decisiones que necesito de vos

1. **Fotos de menores:** ¿hay autorización de imagen para usar estas fotos en la página pública, o las uso sólo en desarrollo y la fase 6 queda bloqueada hasta tener las del fotógrafo?
2. **Sello:** el pedido decía "U9 a U17", pero los datos tienen hasta U21 (y Primera). Propongo "De U9 a U21", derivado de los datos.
3. **Etiqueta de la barra fija:** con la inscripción cerrada, "Inscribirme" confunde. Propongo que copie el texto del botón del hero ("Quiero que juegue" / "Inscribirme").
4. **"Quiero que juegue" mientras carga la base o sin formulario:** hoy queda apagado con "Pronto". Propongo mantenerlo así (el único botón que puede estarlo); "Pagar" nunca.
