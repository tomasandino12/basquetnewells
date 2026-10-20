# Portal: rediseño "D" y datos conectados — plan

Rama `feat/portal-rediseno`. Maquetas en `maquetas/` (no se commitean). Tomás eligió la **D** el 20/10:
fondo negro, **Inscribir** y **Enviar comprobante** arriba de todo, atajos, calendario propio del mes
con colores por tipo, bloque del club con foto. Tiene que verse bien en celular (375 px) y en compu.

Decisiones:
- **Nada vacío.** Una sección sin datos se oculta. Inscripción y Comprobante siempre se ven (es lo que
  busca el padre); sin formulario activo muestran "abre con la temporada" y mandan a Quiero jugar si existe.
- **Qué formulario es cuál** lo dice el panel: destinos nuevos `inscripcion` y `comprobante` (0062), igual
  que `consultas` y `colaboradores` de 0061. Sin 0062 aplicada, el portal muestra el estado cerrado.
- **Calendario propio**: Google Calendar API v3 (`events.list`) con una API key pública restringida por
  referrer y a la Calendar API. Un calendario por tipo (Partidos, Eventos, Charlas…): el tipo y el color
  salen del calendario. Sólo título, hora y lugar (nunca la descripción: podría tener nombres).
- **Categorías**: los años salen de `TRAMOS` de `src/data/categorias.js` y del año de temporada; en
  `portal.js` sólo va qué categorías y ramas ofrece el club.
- Foto, alias, sede, horarios, contacto, calendarios y temporada: config en `src/data/portal.js`, cada uno
  `null` = oculto. Pasarlos al panel queda para otro spec.

## Tasks (una por commit)

1. **Lógica pura del calendario y de las categorías.**
   `src/data/agenda.js` (nuevo): `urlEventos`, `eventoDesdeGoogle`, `semanasDelMes`, `eventosPorDia`,
   `proximosEventos`; `src/data/categorias.js`: `aniosDeCategoria`. Hora de Rosario siempre.
   Tests: `tests/agenda.test.js` (mes que empieza en domingo, evento de todo el día, evento sin título,
   descripción descartada, orden por hora), `tests/categorias.test.js` (+ Escuelita "y después", U21 de 4 años).
   Acepta: `npm run test:q` verde.

2. **Repo y CSP.** `repos/portal.js`: `eventosDelMes(calendarios, clave, desde, hasta)` con `fetch` a
   `https://www.googleapis.com/calendar/v3/...`; un calendario que falla no tira los demás.
   `vercel.json`: `connect-src` + `https://www.googleapis.com`. Tests: `csp.test.js` (googleapis en
   connect-src y nada más nuevo).

3. **Migración 0062: destinos inscripción y comprobante.** Rehace el check
   `formulario_portal_destino_valido`; `DESTINOS` suma los dos (el panel los ofrece solo).
   Test: `tests/contratoDestinoFormulario.test.js` compara `DESTINOS` con 0062 (0061 queda fija).
   **Parar y preguntar antes del `db push`** (y por el backup).

4. **Portal D: HTML + CSS + UI.** `public/portal.html`, `public/css/publico.css`, `layout.css` (compu:
   tarjetas lado a lado, calendario + lista del día en dos columnas), `src/ui/portal.js`: tarjetas de
   acción (abierta/cerrada), atajos que sólo listan lo que existe, calendario con navegación de mes y
   lista del día (o "próximos"), categorías con años, club con foto opcional, colaborar, contacto, pie
   con "Entrar a Semillero". Todo con `html```. Tests: `portal.test.js` (tarjeta cerrada sin enlace,
   atajo oculto sin datos, calendario oculto sin calendarios), `portalPagina.test.js`.

5. **Config y guía.** `src/data/portal.js`: saca el respaldo viejo de Inscripción 2026, suma `temporada`,
   `categorias`, `entrenamientos`, `sede`, `alias`, `foto`, `claveCalendario`, calendarios por tipo.
   `docs/COORDINACION.md`: dónde va cada dato y la API key paso a paso.

6. **Verificación.** Preview a 375 px y a 1280 px, con y sin datos; capturas para Tomás.
