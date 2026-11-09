# Rediseño, base visual (pasos 0 a 2) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `web/` con la paleta cálida, DM Sans, las piezas con sus detalles y el marco con menú, a la vista en `/piezas`, para que Tomás lo corrija antes de rediseñar pantalla por pantalla.

**Architecture:** Las pantallas ya usan nombres de rol (`bg-sup`, `text-tinta`, `bg-club`), así que cambiar los valores de los tokens en `web/src/estilos.css` cambia el aspecto de todo a la vez. Se suman tokens nuevos (lima, bordó, ámbar…) y una prueba de contraste que mide cada par texto/fondo en los dos temas. El tema pasa de cada pantalla al marco, con la misma clave que la app vieja.

**Tech Stack:** React 19, Tailwind 4 (`@theme inline`), Vitest + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-08-rediseno-y-mudanza-design.md`

## Global Constraints

- Directo en `main`, un commit por tarea. Nunca push: subir y publicar lo hace Tomás.
- No se toca `src/data/`, `src/parser/`, `supabase/` ni sus pruebas.
- Colores literales solo en los bloques de tokens de `web/src/estilos.css`.
- `transition` y `@keyframes` solo con `transform` u `opacity`; `@keyframes` solo con `from`; nada infinito; quieto con `prefers-reduced-motion`.
- Texto ≥ 4,5:1 contra su fondo; borde de lo que se toca ≥ 3:1; en claro y oscuro.
- Lima `#CDF73D` solo como fondo de la acción principal, con letra bordó `#250104`.
- Criterio de Tomás: un solo momento destacado por pantalla; detalles chicos (un botón, cómo aparecen las cosas, los textos, una textura), nada que sature.
- Antes de cada commit: `npm run test:q`, `npm --prefix web test`, `npm --prefix web run check`, `npm --prefix web run build`.
- Después de las tareas 3 y 4: capturas de `/piezas` en claro y oscuro, a 1440 y 390 px, para Tomás.

---

### Task 0: Físico (DEV-020) en `main` y dependencias de `web/`

**Files:**
- Modify: `.gitignore` (si `web/node_modules` aparece como sin seguimiento)
- Merge: rama `oficina/DEV-020`

- [ ] **Step 1:** Enlazar las dependencias ya instaladas (las mismas que usan las ramas de la oficina):
  `cmd /c mklink /J "web\node_modules" "C:\Tomas\oficina-worktrees\_deps\newells\web\node_modules"`
- [ ] **Step 2:** `git status --short web/` no debe listar `web/node_modules`. Si lo lista, sumar `web/node_modules` a `.gitignore`.
- [ ] **Step 3:** `git merge --no-ff oficina/DEV-020 -m "Integra DEV-020: Mudanza, etapa 3: Físico y plan físico en React"`
- [ ] **Step 4:** Correr las cuatro verificaciones. Esperado: todo en verde.
- [ ] **Step 5:** Marcar DEV-020 como entregada en el tablero de la oficina (`tablero.json`, columna `entregada`), para que la oficina no la ofrezca de nuevo.

### Task 1: Paleta cálida con prueba de contraste

**Files:**
- Modify: `web/src/estilos.css` (bloques `:root`, `[data-tema='oscuro']`, `@theme inline`)
- Create: `web/src/contraste.ts`, `web/src/contraste.test.ts`
- Modify: `web/src/estilos.test.ts` (compara con la sección nueva de DESIGN.md)
- Modify: `DESIGN.md` (sección nueva «Sistema de la app nueva (web/)»)

**Interfaces:**
- Produces: `contraste(a: string, b: string): number` (hex `#RRGGBB`, devuelve la razón WCAG); tokens `--lima`, `--sobre-lima`, `--bordo`, `--cereza`, `--ambar`, `--sol`, `--caramelo`, `--cuero`, `--tomate` y sus clases Tailwind `bg-lima`, `text-sobre-lima`, `bg-bordo`, etc.

- [ ] **Step 1: prueba que falla**

```ts
// web/src/contraste.test.ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contraste } from './contraste';

const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');
function token(bloque: 'claro' | 'oscuro', nombre: string): string {
  const inicio = css.indexOf(bloque === 'claro' ? ':root {' : "[data-tema='oscuro'] {");
  const texto = css.slice(inicio, css.indexOf('}', inicio));
  const v = new RegExp(`${nombre}:\\s*(#[0-9A-Fa-f]{6});`).exec(texto)?.[1];
  if (!v) throw new Error(`${nombre} no está en ${bloque}`);
  return v;
}
const valor = (t: 'claro' | 'oscuro', n: string) => {
  try { return token(t, n); } catch { return token('claro', n); } // los que no cambian en oscuro
};

describe('contraste', () => {
  it('mide como WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
  const textos: Array<[string, string]> = [
    ['--tinta', '--fondo'], ['--tinta', '--sup'], ['--tinta', '--sup-2'],
    ['--gris', '--fondo'], ['--gris', '--sup'],
    ['--club-texto', '--fondo'], ['--club-texto', '--sup'],
    ['--sobre-lima', '--lima'], ['--sobre-club', '--club'],
    ['--sube', '--sube-fondo'], ['--baja', '--baja-fondo'],
  ];
  for (const tema of ['claro', 'oscuro'] as const) {
    it.each(textos)(`${tema}: %s sobre %s se lee (4,5:1)`, (t, f) => {
      expect(contraste(valor(tema, t), valor(tema, f))).toBeGreaterThanOrEqual(4.5);
    });
    it(`${tema}: el borde de lo que se toca se ve (3:1)`, () => {
      expect(contraste(valor(tema, '--borde-control'), valor(tema, '--sup'))).toBeGreaterThanOrEqual(3);
    });
  }
});
```

- [ ] **Step 2:** `npm --prefix web test -- contraste` → FAIL (no existe `./contraste`).
- [ ] **Step 3: implementación**

```ts
// web/src/contraste.ts
/** Razón de contraste WCAG 2 entre dos colores #RRGGBB. */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
```

- [ ] **Step 4: tokens nuevos.** En `:root`: `--club:#D9122E; --sobre-club:#fff; --club-texto:#A80519; --club-osc:#A80519; --club-cl:#F8E1DC; --fondo:#F5F0E6; --sup:#FCFAF5; --sup-2:#EDE5D6; --linea:#E2D8C6; --tinta:#241A17; --gris:#6B5D52; --borde-control:#8C7B6B; --sube:#15794F; --sube-fondo:#E3EDDF; --baja:#985E0C; --baja-fondo:#F6E7CF; --lima:#CDF73D; --sobre-lima:#250104; --bordo:#250104; --cereza:#6D0317; --tomate:#E13A26; --caramelo:#B5713A; --cuero:#7A4B32; --ambar:#F2B33D; --sol:#FEED65;`. En oscuro: `--club-texto:#EE7C80; --club-cl:#3F1418; --fondo:#160708; --sup:#221012; --sup-2:#2E1A1B; --linea:#3D2627; --tinta:#F3EAE0; --gris:#B8A79C; --borde-control:#7A6360; --sube:#7BCB98; --sube-fondo:#1C2B21; --baja:#E0A94F; --baja-fondo:#33230F;`. Las escalas `--calor-*` no cambian. En `@theme inline`, una línea `--color-<nombre>: var(--<nombre>);` por cada token nuevo.
- [ ] **Step 5:** `npm --prefix web test -- contraste` → PASS. Si un par no llega, se ajusta **el valor** (no la prueba) y se anota en DESIGN.md.
- [ ] **Step 6: DESIGN.md.** Sección «Sistema de la app nueva (web/)» con la tabla de familias del spec (valor y rol de cada token, claro y oscuro) y el criterio de Tomás. `estilos.test.ts` pasa a comparar los tokens de `web/` con esa sección (mismo patrón de hoy: `` `--token` `` y su valor en la misma línea), y la prueba de las «superficies públicas» del tema oscuro se reemplaza por la de los valores nuevos.
- [ ] **Step 7:** cuatro verificaciones en verde y commit «Rediseño: paleta cálida con prueba de contraste».

### Task 2: DM Sans en lugar de Inter

**Files:**
- Create: `public/fonts/dm-sans-latin-{400,500,600,700}-normal.woff2`, sumar su licencia a `public/fonts/LICENCIAS.txt`
- Modify: `web/src/estilos.css` (`@font-face` y `--font-cuerpo`)

- [ ] **Step 1:** Bajar `@fontsource/dm-sans` con versión exacta de dos semanas o más, sin instalar: `npm pack @fontsource/dm-sans@<versión> --pack-destination <carpeta temporal vacía>`; copiar solo los cuatro `latin-*-normal.woff2` y el texto de la licencia OFL.
- [ ] **Step 2:** Reemplazar los tres `@font-face` de Inter por cuatro de DM Sans (`font-display:swap`, `url(../../public/fonts/...)`) y `--font-cuerpo: 'DM Sans', system-ui, sans-serif;`. La app vieja sigue con Inter: sus archivos quedan.
- [ ] **Step 3:** Números que se comparan en cifras: `.cifra { font-variant-numeric: tabular-nums; }` en `estilos.css` (lección de Vercel: no bailan al cambiar).
- [ ] **Step 4:** verificaciones y commit «Rediseño: DM Sans para el texto de la app nueva».

### Task 3: Piezas con sus detalles

**Files:**
- Modify: `web/src/components/ui/button.tsx`, `card.tsx`, `chip.tsx`
- Modify: `web/src/estilos.css` (textura, entrada, detalle del botón)
- Modify: `web/src/pantallas/Piezas.tsx` (muestra la paleta y las piezas)
- Test: `web/src/components/ui/piezas.test.tsx`

**Interfaces:**
- Produces: `<Boton variante="principal" | "linea" | "secundario" | "contorno">`; `principal` es lima con flecha; `<Panel>` (bloque de datos); clase `.entra` (fundido de entrada); textura en `body::before`.

- [ ] **Step 1: prueba que falla** (en `piezas.test.tsx`): el botón principal lleva `bg-lima` y `text-sobre-lima`; con `flecha` muestra un ícono `aria-hidden`; existe la variante `linea` con borde y fondo transparente.

```tsx
it('el principal es lima con letra bordó y su flecha no se lee', () => {
  render(<Boton flecha>Tomar asistencia</Boton>);
  const b = screen.getByRole('button', { name: 'Tomar asistencia' });
  expect(b.className).toContain('bg-lima');
  expect(b.className).toContain('text-sobre-lima');
  expect(b.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
});
it('el de línea no tiene relleno', () => {
  render(<Boton variante="linea">Ver historial</Boton>);
  expect(screen.getByRole('button').className).toContain('bg-transparent');
});
```

- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: el botón.** `principal: 'bg-lima text-sobre-lima'`; `linea: 'border border-club-texto bg-transparent text-club-texto'`; prop `flecha?: boolean` que agrega `<ArrowRight aria-hidden className="size-5 transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] group-hover:translate-x-1" />` (el botón suma `group`). Ese es el detalle de la acción principal: la flecha avanza con el mouse y el botón se hunde al tocar (`active:scale-[.97]`, ya existe). El resto de variantes sigue igual.
- [ ] **Step 4: textura.** `body::before` fijo, `pointer-events:none`, `z-index:-1`, con un ruido SVG (`feTurbulence`, `baseFrequency .9`, en `data:` URI) a `opacity:.035` en claro y `.05` en oscuro. Es estática: no se anima.
- [ ] **Step 5: entrada.** `@keyframes entra { from { opacity: 0; } }` y `.entra { animation: entra var(--dur-3) var(--ease-salida); }`. Solo fundido (DESIGN.md: nada de subir la pantalla entera).
- [ ] **Step 6: Panel.** En `card.tsx`, `Panel` = `Card` con `p-4` y un `h2` opcional en Barlow 700 con `tracking-wide uppercase` y una línea `--linea` debajo. `Card` pierde la sombra en claro (se separa por el tono de fondo, lección de Refactoring UI).
- [ ] **Step 7: Piezas.** Arriba, la paleta: una fila de muestras por familia con nombre y valor. Debajo, cada pieza en uso. El botón de tema de esta página se va (pasa al marco en la tarea 4).
- [ ] **Step 8:** verificaciones; capturas de `/piezas` (claro y oscuro, 1440 y 390 px) para Tomás; commit «Rediseño: piezas con flecha, textura y entrada».

### Task 4: Marco con menú y tema global

**Files:**
- Modify: `web/src/laboratorio.tsx` (marco nuevo), `web/src/laboratorio.test.tsx`
- Create: `web/src/tema.ts`, `web/src/tema.test.ts`
- Modify: `web/src/pantallas/Plantel.tsx` y `Piezas.tsx` (sacan su propio cambio de tema)

**Interfaces:**
- Produces: `leerTema(): 'claro' | 'oscuro'`, `guardarTema(t)`, `aplicarTema(t)` en `tema.ts`, con la clave `semillero.tema` de la app vieja (`src/data/tema.js`: `CLAVE_TEMA`, `normalizarTema`); todo en try/catch.
- `PANTALLAS` pasa a ser solo las reales; `EJEMPLOS` lista `/piezas` y `/maqueta/plantel`.

- [ ] **Step 1: pruebas que fallan.** `tema.test.ts`: sin nada guardado es claro; `guardarTema('oscuro')` y `leerTema()` da oscuro; si `localStorage` tira, `leerTema()` da claro y `guardarTema` no rompe. `laboratorio.test.tsx`: cada ruta directa está en `PANTALLAS` o `EJEMPLOS`; el menú principal se llama «Menú de la app» y no muestra los ejemplos; con un plantel en la dirección (`/hoy/:plantelId`) el menú lleva a Hoy, Plantel, Asistencia y Físico de ese plantel; el botón de tema cambia `document.documentElement.dataset.tema` y lo guarda.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3: implementación.** Compu (≥ 64rem): columna izquierda fija de 15rem en `bg-bordo` con el escudo (`/escudo.png`), los enlaces en texto claro (el activo con una barra lima de 3 px a la izquierda que entra con `scaleY`), y abajo el cambio de tema. Celular: cabecera chica con el nombre de la pantalla y una barra inferior de 4 enlaces de 44 px o más (Planteles, Hoy, Plantel, Asistencia; Físico entra en la cabecera como enlace). Sin plantel elegido, solo Planteles. Los ejemplos quedan en una línea chica al pie del menú. `<Outlet>` va dentro de un `div` con `key={location.pathname}` y la clase `.entra`.
- [ ] **Step 4:** pruebas en verde, verificaciones, capturas para Tomás y commit «Rediseño: menú de la app y tema para todas las pantallas».

---

**Después de este plan:** con las correcciones de Tomás sobre `/piezas` y el menú se escribe el plan de las pantallas (Planteles, Plantel y ficha, Hoy, Asistencia, Físico), una por commit, cada una con su lista de lo que hace la vieja (H-175).
