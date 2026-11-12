import type { Entrenamiento, EstadoAsistencia, Lesion, MedicionTiro, MisionDePrevia, MotivoFalta, Repositorio } from '../datos/repositorio';

// Nombres inventados para las maquetas: ninguno es de un chico real.
const JUGADORES = [
  { id: 'd1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: '2013-03-14' },
  { id: 'd2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: '2013-07-02' },
  { id: 'd3', nombreClave: 'cabrera lautaro', nombreLimpio: 'Cabrera, Lautaro', fechaNacimiento: '2013-11-21' },
  { id: 'd4', nombreClave: 'dominguez santino', nombreLimpio: 'Domínguez, Santino', fechaNacimiento: '2013-01-09' },
  { id: 'd5', nombreClave: 'gimenez franco', nombreLimpio: 'Giménez, Franco', fechaNacimiento: '2014-02-27' },
  { id: 'd6', nombreClave: 'ibarra joaquin', nombreLimpio: 'Ibarra, Joaquín', fechaNacimiento: null },
  { id: 'd7', nombreClave: 'luna mateo', nombreLimpio: 'Luna, Mateo', fechaNacimiento: '2013-05-30' },
  { id: 'd8', nombreClave: 'paz valentino', nombreLimpio: 'Paz, Valentino', fechaNacimiento: '2013-09-12' },
];
const TIRAN = JUGADORES.slice(0, 5);

const SESIONES = [
  { id: 's1', fecha: '2026-09-08', tipo: 'tiro' },
  { id: 's2', fecha: '2026-09-29', tipo: 'tiro' },
  { id: 's3', fecha: '2026-10-20', tipo: 'tiro' },
];

// Lo que mete cada chico de 10 por zona en cada batería: mejora de a poco, el frontal se queda.
const ANOTADOS: Record<string, number[]> = {
  esq_izq: [4, 5, 6],
  c45_izq: [3, 4, 5],
  frontal: [3, 3, 2],
  c45_der: [4, 5, 6],
  esq_der: [5, 5, 7],
  libres: [5, 6, 6],
};

const MEDICIONES: MedicionTiro[] = SESIONES.flatMap((s, i) =>
  Object.entries(ANOTADOS).flatMap(([posicion, porBateria]) =>
    TIRAN.map((j, k) => ({
      sesionId: s.id,
      jugadorId: j.id,
      posicion,
      anotados: Math.max(0, Math.min(10, porBateria[i] + ((k % 3) - 1))),
      intentos: 10,
    })),
  ),
);

// Seis entrenamientos pasados; cada chico falta o avisa de vez en cuando.
const PASADOS = ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29'];
const ESTADOS: EstadoAsistencia[] = ['presente', 'presente', 'presente', 'ausente', 'justificada'];
const MOTIVOS_DEMO: MotivoFalta[] = ['estudio', 'familia', 'enfermo', 'viaje'];
let entrenamientos: Entrenamiento[] = PASADOS.map((fecha, i) => ({
  id: `e${i}`,
  fecha,
  hubo: true,
  filas: JUGADORES.map((j, k) => {
    const estado = ESTADOS[(i * 2 + k * 3) % 5];
    // Los que avisaron, con un motivo inventado: así la ficha muestra la tira completa.
    return { jugadorId: j.id, estado, motivo: estado === 'justificada' ? MOTIVOS_DEMO[(i + k) % MOTIVOS_DEMO.length] : null };
  }),
}));
let lesiones: Lesion[] = [
  { id: 'l1', jugadorId: 'd4', desde: '2026-10-28', hasta: null, zona: 'tobillo', lado: 'derecho', tipo: 'torcedura' },
  { id: 'l0', jugadorId: 'd2', desde: '2026-09-15', hasta: '2026-09-29', zona: 'rodilla', lado: 'izquierdo', tipo: 'golpe' },
];
let fuera = new Set<string>();

// Misiones de ejemplo (una previa ya jugada): lo que se marca queda en memoria, nunca va a la base.
const mision = (id: string, texto: string, jugadorId: string | null = null): MisionDePrevia => ({ id, metrica: null, valor: null, texto, estado: null, comentario: null, jugadorId });
let misionesEquipo: MisionDePrevia[] = [mision('me1', 'Menos de 5 pérdidas'), mision('me2', 'Defender sin hacer faltas tontas')];
let misionesJugador: MisionDePrevia[] = [
  mision('mj1', 'Defender y que no le metan más de 6 puntos', 'd1'),
  mision('mj2', 'Bajar 5 rebotes', 'd2'),
  mision('mj3', 'Dar 3 pases para que otro tire', 'd3'),
  mision('mj4', 'Hablar en la defensa todo el partido', 'd4'),
  mision('mj5', 'Correr la cancha en cada contraataque', 'd5'),
];

const PROPIO: Partial<Repositorio> = {
  obtenerSesionActual: async () => null,
  alCambiarAuth: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  fueSalidaVoluntaria: () => true,
  obtenerSesionesDeMedicion: async () => SESIONES,
  obtenerMedicionesTiroDelPlantel: async () => MEDICIONES,
  obtenerJugadoresDelPlantel: async () => JUGADORES.filter((j) => !fuera.has(j.id)),
  obtenerMedicionesCorporalesDelClub: async () => [
    { jugadorId: 'd1', fechaMedicion: '2026-10-14', alturaCm: 158, pesoKg: 47, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'd2', fechaMedicion: '2026-10-14', alturaCm: 162, pesoKg: 51, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'd3', fechaMedicion: '2026-10-14', alturaCm: 155, pesoKg: 44, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'd5', fechaMedicion: '2026-10-14', alturaCm: 149, pesoKg: 40, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'd7', fechaMedicion: '2026-10-14', alturaCm: 166, pesoKg: 55, piernaCm: null, piernaFlexionadaCm: null },
  ],
  obtenerMetasDelPlantel: async () => ({ frontal: 40, esq_izq: 50, c45_der: 50 }),
  obtenerPreviasDelPlantel: async () => [
    { id: 'pr1', fecha: '2026-11-08', rival: 'Rival de Ejemplo', plantelId: 'demo', partidoId: null, evaluada: [...misionesEquipo, ...misionesJugador].some((m) => m.estado !== null) },
  ],
  obtenerPrevia: async () => ({ id: 'pr1', fecha: '2026-11-08', rival: 'Rival de Ejemplo', partidoId: null, misionesEquipo, misionesJugador }),
  evaluarMisiones: async ({ evaluaciones }) => {
    const aplicar = (lista: MisionDePrevia[]) =>
      lista.map((m) => {
        const e = evaluaciones.find((x) => x.id === m.id);
        return e ? { ...m, estado: e.estado as MisionDePrevia['estado'], comentario: e.comentario } : m;
      });
    misionesEquipo = aplicar(misionesEquipo);
    misionesJugador = aplicar(misionesJugador);
    return {};
  },
  obtenerPartidosDelPlantel: async () => [],
  obtenerEntrenamientos: async () => entrenamientos,
  obtenerLesionesDelPlantel: async () => lesiones,
  obtenerSolicitudesDelPlantel: async () => [],
  // Lo que se toca en la maqueta queda en memoria mientras la pestaña esté abierta: nunca va a la base.
  guardarAsistencia: async ({ fecha, filas }) => {
    const viejo = entrenamientos.find((e) => e.fecha === fecha);
    // Copias nuevas y no cambios en el lugar: si no, la pantalla recibe el mismo objeto y no se redibuja.
    const dia: Entrenamiento = { ...(viejo ?? { id: `e-${fecha}`, fecha, hubo: true }), filas: [...(viejo?.filas ?? [])] };
    for (const f of filas) {
      const antes = dia.filas.find((x) => x.jugadorId === f.jugadorId);
      dia.filas = dia.filas.filter((x) => x.jugadorId !== f.jugadorId);
      // Como la base (0066): sin la clave motivo queda el que había; fuera de «avisó», no hay motivo.
      const motivo = f.estado !== 'justificada' ? null : 'motivo' in f ? f.motivo ?? null : antes?.motivo ?? null;
      if (f.estado) dia.filas.push({ jugadorId: f.jugadorId, estado: f.estado, motivo });
    }
    entrenamientos = viejo ? entrenamientos.map((e) => (e === viejo ? dia : e)) : [...entrenamientos, dia];
    return dia.id;
  },
  abrirLesion: async ({ jugadorId, desde, zona = null, lado = null, tipo = null }) => {
    lesiones = [{ id: `l-${jugadorId}-${desde}`, jugadorId, desde, hasta: null, zona, lado, tipo }, ...lesiones];
  },
  darAlta: async (lesionId, hasta) => {
    lesiones = lesiones.map((l) => (l.id === lesionId ? { ...l, hasta } : l));
  },
  sacarDelPlantel: async (_club, jugadorId) => {
    fuera = new Set([...fuera, jugadorId]);
  },
};

/** El repositorio de las maquetas: lo que no está arriba devuelve vacío. Nunca toca la base. */
export const repositorioDemo = new Proxy(PROPIO, {
  // 'then' no: si no, al esperar el repositorio JavaScript lo toma por una promesa y se queda colgado.
  get: (destino, clave: string) => (clave === 'then' ? undefined : (destino[clave as keyof Repositorio] ?? (async () => []))),
}) as Repositorio;

export const repositorioDeHoyDemo = repositorioDemo;
