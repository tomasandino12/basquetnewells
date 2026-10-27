# Semillero

App para clubes formadores de básquet (piloto: Newell's) y portal público del
básquet del club. JS con módulos ES, sin build ni framework; la base es
Supabase (Postgres + RLS) y se despliega estático en Vercel.

## Cómo se corre

```bash
npm ci
npm run test:q
```

Para verla en el navegador alcanza con servir la carpeta del proyecto
(`.claude/launch.json` tiene la configuración del preview).

## Dónde está cada cosa

| Carpeta | Qué hay | Corre en |
|---|---|---|
| `public/` | HTML, CSS, fuentes, íconos y librerías vendorizadas | navegador |
| `src/ui/` | pantallas (`pantallas/`), piezas reutilizables (`componentes/`) y la base de la interfaz | navegador |
| `src/data/` | lógica pura de la app (`*.js`) y acceso a Supabase (`repos/`, por `repositorio.js`) | navegador |
| `src/parser/` | lectura de las planillas `.xlsx` (contrato en `PARSER.md`) | navegador |
| `supabase/` | migraciones de la base, reglas de acceso (RLS) y `ESQUEMA.md` | servidor |
| `google/` | Apps Script y guías de los formularios de Google | Google |
| `scripts/` | herramientas de Node: backup, cartel QR, verificación visual | tu PC |
| `tests/` | una prueba por módulo (`<módulo>.test.js`), contratos SQL↔JS y verificaciones SQL | tu PC |
| `docs/` | `guias/` (cómo se opera), `decisiones/` (por qué), `historico/`, `superpowers/` (planes) | — |

`DESIGN.md` es el sistema de diseño y `CLAUDE.md`, las reglas del proyecto
(arquitectura, migraciones, privacidad).

Hay datos de menores: las planillas reales y los backups no van a git, y la
seguridad la impone la base, no la interfaz.
