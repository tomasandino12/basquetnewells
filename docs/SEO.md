# Visibilidad en buscadores

**Dominio canónico único: `https://basquetnewells.com.ar`.** La página que tiene
que aparecer en las búsquedas es el portal del básquet, en `/`. `/app`
(Semillero) es la puerta de una app con login: lleva `noindex` y no está en el
sitemap. No hay más rutas públicas que un buscador pueda pedir (dentro de la app
no hay ruteo) y todo lo que está detrás de la sesión son datos de menores.

## Qué hay en el repo

| Archivo | Para qué |
|---|---|
| `public/portal.html` | Título, descripción, `robots`, canonical, `og:*`, Twitter cards, JSON-LD (SportsClub + WebSite) y el bloque estático de categorías, sede, "Cómo sumarte" y preguntas |
| `public/index.html` | `/app`: canonical, `og:*` y `<meta name="robots" content="noindex">` |
| `public/og-basquet-newells.png` | Imagen social de 1200x630 (escudo y texto; sin fotos de chicos) |
| `public/robots.txt` | Deja rastrear todo y declara el sitemap |
| `public/sitemap.xml` | `/`, `/privacidad` y `/terminos` |
| `vercel.json` | Los rewrites que sirven robots y sitemap **desde la raíz** |
| `tests/metadatos.test.js` | Dominio, canonical, `og:*`, robots y sitemap coherentes |
| `tests/portalInfoEstatica.test.js` | El bloque estático y el JSON-LD contra `PORTAL` (`src/data/portal.js`) |

Si el dominio vuelve a cambiar hay que tocar todos esos archivos: los tests
dicen cuáles.

## Qué hay que mantener a mano

Las categorías, los horarios y la sede se cargan con JS desde
`src/data/portal.js`, y Google no los ve. Por eso `portal.html` tiene una copia
estática (secciones `#info-categorias`, `#info-donde`, `#info-sumarte`,
`#info-faq`). **Al cambiar horarios, categorías, sede o temporada en
`portal.js`, hay que cambiarlos también ahí**: `tests/portalInfoEstatica.test.js`
falla si no coinciden. No hay paso de build; si algún día lo hay, ese bloque es
lo primero para generar desde los mismos datos.

## Por qué `/app` no se bloquea con `Disallow`

Un `Disallow` le impide a Google leer el `noindex`, y entonces la URL puede
quedar indexada igual, sin contenido. Tampoco se bloquea `/public/`: ahí viven el
CSS, el JS y el escudo, y sin ellos Google ve una página rota. El duplicado
`/public/portal.html` se resuelve con el `canonical` del head.

## Pasos manuales

Dar de alta el sitio en **Google Search Console**
(https://search.google.com/search-console), propiedad **Prefijo de URL**
`https://basquetnewells.com.ar`:

1. Verificación por **etiqueta HTML**: Google da un
   `<meta name="google-site-verification" content="...">`; pegarlo en el `<head>`
   de `public/portal.html` y desplegar. No hace falta tocar la CSP.
2. En **Sitemaps**, enviar `sitemap.xml`.
3. En **Inspección de URL**, pedir la indexación de `/` y mirar el render.

Y, por el cambio de dominio, en otras consolas (no se hace desde el repo):

- **Google Cloud**: la API key del calendario está restringida por sitio; agregar
  `https://basquetnewells.com.ar/*` (ver `docs/COORDINACION.md`). Sin eso el
  calendario del portal da 403 en el dominio nuevo.
- **Supabase → Authentication → URL Configuration**: Site URL y Redirect URLs con
  el dominio nuevo (ver `docs/CONFIGURAR-AUTH.md`), para que el login de Semillero
  vuelva a `basquetnewells.com.ar/app`.
