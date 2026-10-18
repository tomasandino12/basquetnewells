# Plan — Cuentas de familia (v2)

Spec: `docs/superpowers/specs/2026-10-18-cuentas-familia-design.md`.
Rama `claude/cuentas-familia-c6c955`, tag `pre-cuentas-familia`, migración
0057 reservada. Una task por commit, `npm run test:q` en verde antes de cada
commit. Sin merge ni push: lo hace la coordinadora con el ok de Tomás.

## Estado

| # | Task | Estado |
|---|---|---|
| 0 | Columnas de "Para Semillero" (b0f510a + eacf568) | hecha |
| 1 | Lógica pura `inscriptos.js` + `parserInscriptos.js` | hecha (3d20aae) |
| 2 | Migración 0057 + contratos | hecha |
| 3 | Verificación y rollback SQL | hecha (12/12 en local, ida y vuelta) |
| 4 | db push (con backup) | pendiente |
| 5 | Repo `familia.js` | pendiente |
| 6 | Plantel → Importar inscriptos | pendiente |
| 7 | Arranque + shell familia: Mis chicos | pendiente |
| 8 | Coordinación → Familias y mails en la ficha | pendiente |
| 9 | Docs y cierre | pendiente |

## 0. Columnas de "Para Semillero"
- Por la coordinadora: inscripción armó la planilla aparte (b0f510a) con apellido,
  nombre, fecha de nacimiento, categoría y mail del responsable. Sin DNI.
- Hecho: 11 categorías y columna "Rama" (eacf568); mapeo en spec §3.

## 1. Lógica pura `inscriptos.js`
- Archivos: `src/data/inscriptos.js`, `src/data/limites.js`,
  `tests/inscriptos.test.js`, `tests/fixtures/sintetico/para-semillero.xlsx`.
- Leer filas de la pestaña, filtrar por categoría, normalizar mail
  (minúsculas, recorte), validar fecha con `validarFechaNacimiento`, armar el
  payload de la RPC. Reusar sólo la normalización de nombre del import CABB,
  sin mezclar lógica de `parserCabb.js`. Es el **tercer formato de
  planilla** (CABB, físico, inscriptos): antes de escribirlo, parar y
  decidir con Tomás si toca armar el registro de parsers de CLAUDE.md, como
  refactor en su propio commit.
- Tests: "lee las columnas del fixture", "falta una columna → error claro",
  "filtra por categoría", "descarta mail inválido sin perder la fila",
  "junta filas repetidas del mismo chico con dos mails".

## 2. Migración 0057 + contratos
- Antes: confirmar en `main` que 0057 sigue libre.
- Archivos: `supabase/migrations/0057_cuentas_familia.sql`,
  `tests/contratoAccesoFamilia.test.js`, ampliar `tests/contratoLimites.test.js`.
- Tablas `responsable_jugador` y `vinculo_familia` (patrón 0026) y las
  funciones de spec §4. `vincular_por_mail` exige `email_confirmed_at` y
  no reabre vínculos cerrados. `importar_inscriptos` es `security invoker`.
- Si hace falta tocar una policy existente: **parar**.
- Acepta: contratos en verde; las únicas policies del archivo son nuevas.
- Tests: "la familia sólo recibe los grants declarados", "largos iguales en
  SQL y en JS".

## 3. Verificación y rollback SQL
- Archivos: `tests/verificarCuentasFamilia.sql`, `tests/rollback0057.sql`.
- Los casos de spec §7, con usuarios sintéticos y `rollback` (modelo:
  `verificarCuentaJugador.sql`).
- Acepta: corre limpio en la base local, y el rollback deja el esquema como
  en 0056.

## 4. db push
- Parar: preguntarle a Tomás si corrió `npm run backup` y avisar a la
  coordinadora. Después `npx supabase db push` y la verificación de la task 3
  contra producción.
- Acepta: 0057 aplicada sin fallas; memoria de migraciones actualizada.

## 5. Repo `familia.js`
- Archivos: `src/data/repos/familia.js`, una línea en `src/data/repositorio.js`,
  mensajes en `src/ui/errores.js`.
- `importarInscriptos`, `vincularPorMail`, `misChicos`,
  `vinculosFamiliaDelClub`, `cerrarVinculoFamilia`, `responsablesDeJugador`,
  `guardarResponsable`, con mappers en camelCase.
- Acepta: `tests/arquitectura.test.js` en verde.

## 6. Plantel → Importar inscriptos
- Archivos: `src/ui/pantallas/importarInscriptos.js`, entrada desde Plantel.
- Elegir `.xlsx` → vista previa por fila ("es este jugador" / "ficha nueva",
  y el aviso cuando un chico existente llega con un mail nuevo) → confirmar.
  Con `html\`\``.
- Acepta: en local, el fixture sintético crea las fichas y anota los mails;
  importarlo dos veces no duplica.

## 7. Arranque + shell familia
- Textos para familias de la spec §5: pasos numerados, voseo, qué hacer si no ven a su hijo.
- Archivos: `src/ui/main.js`, `src/ui/sesion.js` (`modo = 'familia'`),
  `src/ui/chrome.js` (`TABS_FAMILIA`), `src/ui/pantallas/misChicos.js`.
- Sin club y sin ficha de jugador → `vincular_por_mail()` + `mis_chicos()`.
  Con chicos, shell familia; sin chicos, "todavía no tenés club" con el aviso.
- Acepta: un usuario local con el mail del fixture entra y ve sólo a su
  chico; profe, coordinador y jugador arrancan igual que antes (probado con
  las tres cuentas locales).

## 8. Coordinación → Familias y mails en la ficha
- Archivos: `src/ui/pantallas/familiasDelClub.js`, entrada en coordinación,
  bloque de responsables en `fichaJugador.js`.
- Acepta: dar de baja hace que esa familia deje de ver al chico al recargar;
  corregir el mail en la ficha vincula al padre en su próximo ingreso.

## 9. Docs y cierre
- `supabase/ESQUEMA.md`, `docs/COORDINACION.md` (rol familia, límite "profe
  que es padre"), `docs/SEGURIDAD-LANZAMIENTO.md` (riesgo aceptado del
  formulario sin login y el disparador del resguardo 3).
- `grep -rn service_role .` y sobre `public/ src/`: cero.
- `npm run test:q`, `graphify update .`, nota en la carpeta compartida y aviso
  a la coordinadora para el merge.
