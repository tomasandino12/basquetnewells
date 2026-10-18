# Plan — Cuentas de familia

Spec: `docs/superpowers/specs/2026-10-18-cuentas-familia-design.md`.
Rama `claude/cuentas-familia-c6c955`, tag `pre-cuentas-familia`.
Una task por commit. `npm run test:q` en verde antes de cada commit. Sin merge
ni push: lo hace la coordinadora con el ok de Tomás.

## Estado

| # | Task | Estado |
|---|---|---|
| 1 | Lógica pura del formulario | pendiente |
| 2 | Migración 0057 + contratos | pendiente |
| 3 | Verificación y rollback SQL | pendiente |
| 4 | db push (con backup) | pendiente |
| 5 | Repo `familia.js` | pendiente |
| 6 | Alta: "Soy familiar de un jugador" | pendiente |
| 7 | Shell familia: Mis chicos | pendiente |
| 8 | Coordinación: Familias | pendiente |
| 9 | Docs y cierre | pendiente |

## 1. Lógica pura del formulario
- Archivos: `src/data/familia.js`, `src/data/limites.js`, `tests/familia.test.js`.
- `validarVinculo({ plantelId, nombre, fechaNacimiento })` y
  `tokensDeNombre(nombre)`: reusa la normalización que genera `nombre_clave`
  (verificar si es `normalizarNombre` de `cuenta.js` o la del parser); al
  menos dos palabras de 2+ letras. Fecha con `validarFechaNacimiento`.
- Acepta: tests nuevos en verde.
- Tests: "exige nombre y apellido", "ignora tildes y mayúsculas", "descarta
  palabras de una letra", "rechaza fecha futura", "límite de largo".

## 2. Migración 0057 + contratos
- Antes: confirmar en `main` que 0057 sigue libre y pedirle el número a la
  coordinadora.
- Archivos: `supabase/migrations/0057_cuentas_familia.sql`,
  `tests/contratoAccesoFamilia.test.js`, ampliar `tests/contratoLimites.test.js`.
- Tablas `vinculo_familia` e `intento_vinculo_familia` con el patrón 0026
  (revoke all, grant por columna, RLS, trigger de sellado del cierre).
- Funciones de la spec §3, `security definer` + `set search_path = ''`, revoke
  a `public, anon`, grant a `authenticated` sólo de las declaradas.
  `vincular_familia` recibe tokens normalizados y compara por `position` en
  `nombre_clave`; vuelve a exigir 2+ tokens de 2+ letras del lado SQL.
- `clubes_para_solicitar()` no se toca: ya sirve a cuentas sin club.
- Ninguna policy existente se modifica (si hiciera falta: **parar**).
- Acepta: contratos en verde; `grep -n "policy" 0057` sólo muestra policies
  nuevas.
- Tests: "la familia sólo recibe los grants declarados", "largo del nombre
  igual en SQL y en JS".

## 3. Verificación y rollback SQL
- Archivos: `tests/verificarCuentasFamilia.sql`, `tests/rollback0057.sql`.
- Casos de la spec §6, con usuarios sintéticos y `rollback` al final (modelo:
  `verificarCuentaJugador.sql`).
- Acepta: corre limpio en la base local (`supabase start`) y el rollback deja
  el esquema como en 0056.

## 4. db push
- Parar: preguntarle a Tomás si corrió `npm run backup` y avisarle a la
  coordinadora. Después `npx supabase db push` y correr la verificación de la
  task 3 contra producción.
- Acepta: 0057 aplicada; verificación sin fallas; actualizar la memoria del
  estado de migraciones.

## 5. Repo `familia.js`
- Archivos: `src/data/repos/familia.js`, una línea en `src/data/repositorio.js`.
- `vincularFamilia`, `misChicos`, `desvincularme`, `vinculosFamiliaDelClub`,
  `cerrarVinculoFamilia`, con mappers `xDesdeFila` en camelCase. Errores de
  la base mapeados a mensajes en `ui/errores.js` (el genérico "no
  encontramos", el de límite de intentos, el de staff/jugador).
- Acepta: `tests/arquitectura.test.js` en verde.

## 6. Alta: "Soy familiar de un jugador"
- Archivos: pantalla nueva `src/ui/pantallas/vincularFamilia.js`, botón en la
  pantalla de "todavía no tenés club", `main.js`.
- Con `html\`\``; `maxlength` desde `limites.js`; áreas táctiles ≥44px.
- Acepta: en local, un usuario nuevo se vincula con un chico sembrado; datos
  equivocados dan el mensaje genérico; el sexto intento se frena.

## 7. Shell familia: Mis chicos
- Archivos: `src/ui/sesion.js` (`modo = 'familia'`), `src/ui/chrome.js`
  (`TABS_FAMILIA`), `src/ui/pantallas/misChicos.js`, `main.js`.
- Arranque: sin club y sin ficha de jugador → `mis_chicos()`; con vínculos,
  shell familia; sin vínculos, la pantalla de siempre.
- Acepta: la familia ve sólo sus chicos; "Sumar otro chico" y "Desvincular"
  andan; profe, coordinador y jugador arrancan igual que antes (probado con
  las tres cuentas locales).

## 8. Coordinación: Familias
- Archivos: `src/ui/pantallas/familiasDelClub.js`, entrada en coordinación.
- Lista con chico, categoría, quién (nombre + mail enmascarado) y fecha;
  "Dar de baja" con confirmación.
- Acepta: la baja hace que esa familia deje de ver al chico al recargar.

## 9. Docs y cierre
- `supabase/ESQUEMA.md` (tablas nuevas), `docs/COORDINACION.md` (rol familia
  y límite "profe que es padre"), `docs/SEGURIDAD-LANZAMIENTO.md` (riesgo
  aceptado de la opción C y el disparador del resguardo 3).
- `grep -rn service_role .` y sobre `public/ src/`: cero.
- `npm run test:q`, `graphify update .`, nota en la carpeta compartida y aviso
  a la coordinadora para el merge.
