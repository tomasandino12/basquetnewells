/**
 * La historia de un jugador, temporada por temporada (spec
 * docs/superpowers/specs/2026-10-16-historia-jugador-design.md).
 *
 * Recibe lo que devuelve `historia_del_jugador` ya en camelCase y lo reparte
 * por temporada. No sabe qué hay adentro de cada fuente: sólo cómo ubicarla.
 * Así, sumar misiones o asistencia es una línea en FUENTES y no toca lo que
 * ya está.
 */

/**
 * `plantel`: el item trae `plantelId` y cae en la temporada de ese plantel.
 * `fecha`: el dato es del chico y no de una categoría (no tiene plantel), así
 * que se ubica por su fecha contra los rangos de sus pertenencias.
 */
export const FUENTES = Object.freeze([
  { clave: 'planFisico', ubicar: 'plantel' },
  { clave: 'cargas', ubicar: 'fecha' },
  { clave: 'recursos', ubicar: 'fecha' },
  { clave: 'saltos', ubicar: 'plantel' },
  { clave: 'sprints', ubicar: 'plantel' },
  { clave: 'yoyos', ubicar: 'plantel' },
  { clave: 'corporales', ubicar: 'fecha' },
  { clave: 'tiro', ubicar: 'plantel' },
  { clave: 'partidos', ubicar: 'plantel' },
]);

// Las fechas llegan como 'YYYY-MM-DD' o como timestamp ISO: comparar los
// primeros diez caracteres alcanza y evita las zonas horarias.
const dia = (f) => (f ? String(f).slice(0, 10) : null);

const porNombre = (a, b) => a.localeCompare(b, 'es', { numeric: true });

/**
 * La temporada de la pertenencia cuyo rango [desde, hasta] contiene la fecha
 * (`hasta` nulo = sigue hoy). Si cae en más de una, la de nombre más alto.
 * `null` si no cae en ninguna: se muestra aparte, no se adivina.
 */
export function temporadaDeFecha(fecha, pertenencias, temporadas) {
  const d = dia(fecha);
  if (!d) return null;
  const nombre = new Map((temporadas ?? []).map((t) => [t.id, t.nombre]));
  const candidatas = (pertenencias ?? [])
    .filter((p) => dia(p.desde) <= d && (p.hasta == null || d <= dia(p.hasta)))
    .map((p) => p.temporadaId);
  if (!candidatas.length) return null;
  return candidatas.sort((a, b) => porNombre(nombre.get(b) ?? '', nombre.get(a) ?? ''))[0];
}

const fuentesVacias = (fuentes) => Object.fromEntries(fuentes.map((f) => [f.clave, []]));

/**
 * [{ temporada, categorias, profes, fuentes }] de la temporada más reciente a
 * la más vieja. Aparece toda temporada con una pertenencia o con algún dato
 * (un partido jugado de citado cuenta aunque no haya pertenencia). Lo que no
 * se pudo ubicar va al final con `temporada: null`.
 */
export function agruparHistoria(datos, fuentes = FUENTES) {
  const temporadas = datos.temporadas ?? [];
  const pertenencias = datos.pertenencias ?? [];
  const plantelPorId = new Map((datos.planteles ?? []).map((p) => [p.id, p]));

  const grupos = new Map();
  const sinTemporada = { temporada: null, categorias: [], profes: [], fuentes: fuentesVacias(fuentes) };
  const grupoDe = (temporadaId) => {
    const temporada = temporadas.find((t) => t.id === temporadaId);
    if (!temporada) return null;
    if (!grupos.has(temporadaId)) {
      grupos.set(temporadaId, { temporada, planteles: new Set(), fuentes: fuentesVacias(fuentes) });
    }
    return grupos.get(temporadaId);
  };

  for (const p of pertenencias) grupoDe(p.temporadaId)?.planteles.add(p.plantelId);

  for (const { clave, ubicar } of fuentes) {
    for (const item of datos[clave] ?? []) {
      let destino = null;
      if (ubicar === 'plantel') {
        const plantel = plantelPorId.get(item.plantelId);
        destino = plantel ? grupoDe(plantel.temporadaId) : null;
        destino?.planteles.add(item.plantelId);
      } else {
        destino = grupoDe(temporadaDeFecha(item.fecha, pertenencias, temporadas));
      }
      (destino ?? sinTemporada).fuentes[clave].push(item);
    }
  }

  const resultado = [...grupos.values()]
    .sort((a, b) => porNombre(b.temporada.nombre, a.temporada.nombre))
    .map(({ temporada, planteles, fuentes: f }) => {
      const suyos = [...planteles].map((id) => plantelPorId.get(id)).filter(Boolean);
      return {
        temporada,
        categorias: [...new Set(suyos.map((p) => p.categoria))].sort(porNombre),
        profes: [...new Set(suyos.flatMap((p) => p.profes ?? []))].sort(porNombre),
        fuentes: f,
      };
    });

  const haySueltos = Object.values(sinTemporada.fuentes).some((l) => l.length);
  return haySueltos ? [...resultado, sinTemporada] : resultado;
}
