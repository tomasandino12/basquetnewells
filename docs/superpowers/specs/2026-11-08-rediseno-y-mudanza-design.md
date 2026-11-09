# Rediseño y mudanza a React, directo en `main`

Decidido con Tomás el 08/11/2026. Reemplaza el ritmo de «la oficina muda sola una pantalla por vez» mientras dure el
rediseño. Lo que diga Tomás en el camino tiene prioridad sobre este documento.

## Por qué

- La mudanza avanzaba sola, una pantalla por vez y sin un diseño general decidido: `/nueva` quedó como un índice de
  pantallas sueltas, `/app` se ve igual que siempre y Tomás no podía ver ni entender qué estaba cambiando.
- Con solo rojo, negro y blanco la app se ve plana y genérica. La meta es que se vea y se sienta profesional, con
  calidad de color, tipografía, pequeñas animaciones y botones.
- Nadie usa la app todavía: se puede trabajar directo en `main` y corregir sobre la marcha.

## Punto de partida (08/11)

| Dónde | Qué hay |
|---|---|
| `/app` (app vieja, `src/ui/`) | 55 pantallas, todas andando. Abre las nuevas solo si se prende el interruptor de *Mi perfil* (apagado por defecto). |
| `/nueva` (`web/`, React) en `main` | Planteles, Plantel y ficha del jugador, Hoy, Asistencia e historial. Más `/piezas` y `/maqueta/plantel` con datos de ejemplo. |
| Rama `oficina/DEV-020` | Físico y plan físico en React, terminada y con pruebas en verde, sin integrar. |
| Rama `feat/rediseno-hoy-plantel` | Rediseño de Hoy y Plantel en la app vieja y arreglo del favicon. No se une tal cual. |
| Falta mudar | Mediciones, Ejercicios y jugadas (con su editor), la parte del jugador, Coordinación (7 pantallas), Familias, Importar planillas, Cuenta y altas. |
| Oficina | «Avanza sola» (`settings.mudanza_auto`) **apagado** desde el 08/11. |

## Cómo se trabaja

1. **Directo en `main`**, en pasos chicos. Cada paso es un commit con un nombre claro («Paleta y letras nuevas»,
   «Menú de la app», «Hoy con el diseño nuevo»).
2. **Después de cada paso, capturas** en claro y oscuro, en compu (1440 px) y celular (390 px), con dos líneas de qué
   cambió. Tomás corrige y se sigue.
3. **Subir a GitHub y publicar lo hace Tomás.** Vercel publica `web/` en `/nueva` en cada deploy.
4. **La oficina no muda sola** mientras dure el rediseño. Se vuelve a prender «Avanza sola» cuando las pantallas
   que ya están en React tengan el diseño nuevo, así lo que falta nace con él.
5. **DEV-020** entra a `main` como primer paso (si Tomás no la integró antes desde la oficina).

## Fuentes del diseño

- **Prototipo de Manus** (React con estilos propios, descargado el 08/11): se toman colores y decisiones estéticas,
  no el código ni sus pantallas exactas. Sí: regla «2 tranquilos + 1 fuerte», bordó casi negro, lima solo para la
  acción principal, Barlow Condensed + DM Sans, menú al costado en compu y barra abajo en celular, entradas suaves.
- **Las tres paletas de referencia** (reels de pierredelcourr): Crimson `#E13A26` / Deep Red `#831613` / Baby Yellow
  `#FEED65`; Deep Maroon `#250104` / Tomato `#D71A06` / Neon Yellow `#CDF73D`; Saffron Cherry `#6D0317` / Rose Red
  `#E52150` / Sunshine Yellow `#F4EB06`.
- **De `feat/rediseno-hoy-plantel`**: el panel para los datos, el cromo de jugador tipo figurita, una sola acción
  maciza por bloque con las demás de línea, el patrón del escudo muy tenue y el favicon. Se pasan a React; sus
  estilos de la app vieja no se unen.

**Quedan afuera** (trabajo aparte, más adelante): las funciones nuevas que inventó Manus (asignar un ejercicio desde
el mapa de tiro, marcar lesionado desde la lista, metas editables).

## Diseño base

### Colores

Paleta cálida amplia, cada familia con un rol. Son valores de partida: cada par texto/fondo se mide (4,5:1 para
texto, 3:1 para bordes de lo que se toca) en claro y oscuro, y se ajusta con Tomás al verlo.

| Familia | Valores | Rol |
|---|---|---|
| Base clara | crema `#F5F0E6`, hueso `#FCFAF5`, arena `#EDE5D6`, tinta `#241A17` | Fondo, tarjeta, nivel hundido, texto |
| Base oscura | `#160708`, `#221012`, `#2E1A1B`, texto `#F3EAE0` | Lo mismo en oscuro, con toque bordó |
| Rojos | vivo `#D9122E`, profundo `#A80519`, cereza `#6D0317`, bordó `#250104` | Vivo: escudo y acentos grandes. Profundo: texto y bordes rojos chicos. Cereza y bordó: piezas fuertes (cabecera, entrenamiento de hoy) |
| Naranjas y marrones | tomate `#E13A26`, quemado `#C2410C`, caramelo `#B5713A`, cuero `#7A4B32` | Mapa de calor, gráficos, etiquetas, texto secundario cálido |
| Amarillos | ámbar `#F2B33D`, sol `#FEED65` | Dato destacado: récord, mejor marca, objetivo cumplido |
| Fuerte | lima `#CDF73D` | Solo la acción principal de la pantalla, con letra bordó. Nunca como texto suelto ni en el mapa de calor |

Los valores viven solo en los tokens de `web/src/estilos.css` (las piezas usan nombres de rol). Verde y naranja
siguen para «mejoró» y «a reforzar».

### Letras

Barlow Condensed para títulos y cifras grandes; **DM Sans reemplaza a Inter** en el texto (no suma una fuente);
IBM Plex Mono queda para tablas de números. Todas guardadas en la app (`woff2`), nunca desde Google Fonts.

### Marco

Menú al costado en compu y barra abajo en celular, solo con las pantallas reales y con sesión. Las maquetas salen del
menú (siguen accesibles por dirección). Cabecera con el plantel elegido y el cambio de tema.

### Piezas

Botón principal (lima), botón de línea, panel de datos, cromo de jugador, chip de estado, fila de acciones (una sola
principal), cifra héroe en Barlow, cartel encima de la pantalla y panel lateral para la ficha. Se ven todas en
`/piezas`, en claro y oscuro.

### Movimiento

Fundido al entrar a una pantalla; la ficha entra deslizando desde el costado; el cartel sube un poco al aparecer; los
botones se hunden apenas al tocarlos. Solo `transform` y `opacity`, con las duraciones de los tokens, y quieto con
«reducir movimiento». Nada de lo que `DESIGN.md` ya midió como lento (subir la pantalla entera, desenfoques, animar
sombras o anchos).

## Pasos

| Paso | Qué | Listo cuando |
|---|---|---|
| 0 | Integrar DEV-020 (Físico) en `main` | Pruebas de `web/` y `test:q` en verde |
| 1 | Paleta, letras y piezas nuevas en `web/`, a la vista en `/piezas` | Tomás aprueba las capturas claro/oscuro |
| 2 | Marco con menú y cabecera | Se llega a cada pantalla real desde el menú, en compu y celular |
| 3 | Planteles, Plantel y ficha, Hoy, Asistencia y Físico con el diseño nuevo, una por commit | Cada una hace todo lo que hace la vieja (H-175), con su prueba |
| 4 | `DESIGN.md` actualizado con el sistema nuevo de `web/` | El documento coincide con los tokens |
| 5 | Volver a prender «Avanza sola» para lo que falta, con el diseño nuevo como base | Lo decide Tomás |

Pasar `/app` a las pantallas nuevas por defecto (prender el interruptor para todos) se decide cuando estén las que usa
el profe en el día a día.

## Reglas que no cambian

- No se pierde ninguna función de la pantalla vieja (H-175); cada pantalla funciona en claro y oscuro (H-170).
- No se toca la base de datos, `src/data/`, `src/parser/` ni sus pruebas.
- Reglas duras de `DESIGN.md` (velocidad y movimiento) y las del plan de mudanza para paquetes: versiones exactas con
  dos semanas o más, sin scripts de instalación, `npm audit` limpio.
- Datos de menores: nada real en maquetas ni pruebas.
- Antes de cada commit corren `npm run test:q`, `npm --prefix web test`, `npm --prefix web run check` y
  `npm --prefix web run build`.
