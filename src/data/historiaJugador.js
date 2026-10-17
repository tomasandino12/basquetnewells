import { sesionesDeSalto, TESTS_SALTO } from './salto.js';
import { sesionesDeSprint, velocidadMedia } from './sprint.js';
import { vigentePorCampo } from './antropometria.js';
import { acumuladosDePartidos, progresionDePesos } from './progresoDelJugador.js';

/**
 * La historia de un jugador, temporada por temporada (spec
 * docs/superpowers/specs/2026-10-16-historia-jugador-design.md).
 *
 * Recibe lo que devuelve `historia_del_jugador` ya en camelCase y lo reparte
 * por temporada. No sabe qué hay adentro de cada fuente: sólo cómo ubicarla.
 * Así, sumar misiones o asistencia es una línea en FUENTES y no toca lo que
 * ya está.
 *
 * Forma de cada fuente (la arma el repo desde el jsonb de la RPC):
 * - saltos, sprints, tiro: una fila por intento o posición, como las que
 *   reciben sesionesDeSalto, sesionesDeSprint y estadisticas.js, más plantelId.
 * - yoyos: una fila por sesión ({ sesionId, fecha, idas, origen, plantelId }).
 * - corporales: como medicion_corporal en camelCase (fechaMedicion, pesoKg...).
 * - cargas: como los escalones de mi_progreso ({ clave, nombre, kg, fecha }).
 * - partidos: como mi_progreso, más plantelId.
 * - planFisico: uno por plantel ({ plantelId, sesiones, primera, ultima, bloques }).
 * - recursos: { fecha, titulo }.
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
  { clave: 'corporales', ubicar: 'fecha', campoFecha: 'fechaMedicion' },
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

  for (const { clave, ubicar, campoFecha } of fuentes) {
    for (const item of datos[clave] ?? []) {
      let destino = null;
      if (ubicar === 'plantel') {
        const plantel = plantelPorId.get(item.plantelId);
        destino = plantel ? grupoDe(plantel.temporadaId) : null;
        destino?.planteles.add(item.plantelId);
      } else {
        destino = grupoDe(temporadaDeFecha(item[campoFecha ?? 'fecha'], pertenencias, temporadas));
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

/* ---------- Cómo llega, cómo terminó, totales y resumen ---------- */

const fechaDe = (clave, item) => dia(item[FUENTES.find((f) => f.clave === clave)?.campoFecha ?? 'fecha']);

/** Lo último con dato de cada tipo, sin comparar con nada ni decir si mejoró. */
function ultimas(fuentes) {
  const saltos = sesionesDeSalto(fuentes.saltos ?? [], null);
  const sprints = sesionesDeSprint(fuentes.sprints ?? []);
  const yoyo = [...(fuentes.yoyos ?? [])]
    .filter((y) => y.idas != null)
    .sort((a, b) => dia(b.fecha).localeCompare(dia(a.fecha)))[0];
  const corporal = vigentePorCampo(fuentes.corporales ?? []);
  const medida = (c) => (c ? { valor: c.valor, fecha: c.fechaMedicion } : null);
  const cargas = progresionDePesos(fuentes.cargas ?? []).map((e) => ({
    nombre: e.nombre, kg: e.actualKg, fecha: e.movimientos.at(-1).fecha,
  }));

  const r = {
    // Las sesiones ya vienen de la más reciente a la más vieja: la primera
    // con un intento válido de cada test (o distancia) es la última medición.
    saltos: TESTS_SALTO
      .map((test) => saltos.find((s) => s.testSalto === test && s.mejor))
      .filter(Boolean)
      .map((s) => ({ test: s.testSalto, fecha: s.fecha, alturaCm: s.mejor.alturaCm })),
    sprints: [...new Set(sprints.map((s) => s.distanciaM))]
      .sort((a, b) => a - b)
      .map((d) => sprints.find((s) => s.distanciaM === d && s.mejor))
      .filter(Boolean)
      .map((s) => ({
        distanciaM: s.distanciaM, fecha: s.fecha, tiempoMs: s.mejor.tiempoMs,
        velocidad: velocidadMedia(s.mejor.tiempoMs, s.distanciaM),
      })),
    yoyo: yoyo ? { fecha: yoyo.fecha, idas: yoyo.idas } : null,
    altura: medida(corporal.alturaCm),
    peso: medida(corporal.pesoKg),
    cargas,
    tiro: ultimaBateria(fuentes.tiro ?? []),
  };
  r.vacio = !r.saltos.length && !r.sprints.length && !r.yoyo && !r.altura && !r.peso && !r.cargas.length && !r.tiro;
  return r;
}

/** La última batería con algún par leído, sumando sólo esos pares. */
function ultimaBateria(filas) {
  const porSesion = new Map();
  for (const f of filas) {
    if (f.anotados == null || f.intentos == null) continue;
    const s = porSesion.get(f.sesionId) ?? { fecha: dia(f.fecha), anotados: 0, intentos: 0 };
    s.anotados += f.anotados;
    s.intentos += f.intentos;
    porSesion.set(f.sesionId, s);
  }
  return [...porSesion.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
}

/**
 * Cómo llega a su categoría de hoy: lo último que se le midió antes del
 * `desde` más viejo de sus pertenencias vigentes. Sin pertenencia vigente no
 * hay "hoy" al que llegar: null.
 */
export function comoLlega(datos) {
  const vigentes = (datos.pertenencias ?? []).filter((p) => p.hasta == null).map((p) => dia(p.desde));
  if (!vigentes.length) return null;
  const corte = vigentes.sort()[0];
  const anteriores = Object.fromEntries(FUENTES.map(({ clave }) => [
    clave, (datos[clave] ?? []).filter((item) => (fechaDe(clave, item) ?? corte) < corte),
  ]));
  return ultimas(anteriores);
}

/** Lo último de cada tipo dentro de una temporada de agruparHistoria. */
export function comoTermino(grupo) {
  return ultimas(grupo.fuentes);
}

/**
 * Totales de los partidos de una temporada. Lo que no se pudo leer no suma
 * ni cuenta como cero: si nadie tiene el dato, el total es null. Los tiros
 * llevan anotados e intentos (porcentaje() de estadisticas.js).
 */
export function totalesDePartidos(items) {
  const a = acumuladosDePartidos(items ?? []);
  return {
    jugados: a.partidos,
    puntos: a.puntos.partidos ? a.puntos.total : null,
    minutos: a.minutos.partidos ? a.minutos.total : null,
    dos: a.dos,
    tres: a.tres,
    libres: a.libres,
  };
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * La línea de la tarjeta. Lo trabajado va primero y los partidos al final: a
 * los profes les importa más qué se hizo con el chico que cuánto anotó.
 * Una medición física es una sesión con algún dato (un ausente no cuenta) o
 * una medición corporal.
 */
export function resumenDeTemporada(grupo) {
  const f = grupo.fuentes;
  const sesionesPlan = (f.planFisico ?? []).reduce((s, p) => s + (p.sesiones ?? 0), 0);
  const conDato = (filas, campo) => new Set(filas.filter((x) => x[campo] != null).map((x) => x.sesionId)).size;
  const mediciones = conDato(f.saltos ?? [], 'tiempoVueloMs') + conDato(f.sprints ?? [], 'tiempoMs')
    + conDato(f.yoyos ?? [], 'idas') + (f.corporales ?? []).length;
  const partes = [
    sesionesPlan ? `Plan físico: ${plural(sesionesPlan, 'sesión', 'sesiones')}` : 'Sin plan físico',
    (f.recursos ?? []).length ? plural(f.recursos.length, 'material', 'materiales') : null,
    mediciones ? plural(mediciones, 'medición física', 'mediciones físicas') : 'Sin mediciones físicas',
    (f.partidos ?? []).length ? plural(f.partidos.length, 'partido', 'partidos') : null,
  ];
  return partes.filter(Boolean).join(' · ');
}
