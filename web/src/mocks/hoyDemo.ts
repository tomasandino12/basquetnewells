import type { Entrenamiento, EstadoAsistencia, Lesion, MedicionTiro, Repositorio } from '../datos/repositorio';

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
let entrenamientos: Entrenamiento[] = PASADOS.map((fecha, i) => ({
  id: `e${i}`,
  fecha,
  hubo: true,
  filas: JUGADORES.map((j, k) => ({ jugadorId: j.id, estado: ESTADOS[(i * 2 + k * 3) % 5] })),
}));
let lesiones: Lesion[] = [{ id: 'l1', jugadorId: 'd4', desde: '2026-10-28', hasta: null, zona: 'tobillo', lado: 'derecho', tipo: 'esguince' }];
let fuera = new Set<string>();

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
    { id: 'pr1', fecha: '2026-11-15', rival: 'Rival de Ejemplo', plantelId: 'demo', partidoId: null, evaluada: false },
  ],
  obtenerPartidosDelPlantel: async () => [],
  obtenerEntrenamientos: async () => entrenamientos,
  obtenerLesionesDelPlantel: async () => lesiones,
  obtenerSolicitudesDelPlantel: async () => [],
  // Lo que se toca en la maqueta queda en memoria mientras la pestaña esté abierta: nunca va a la base.
  guardarAsistencia: async ({ fecha, filas }) => {
    let dia = entrenamientos.find((e) => e.fecha === fecha);
    if (!dia) {
      dia = { id: `e-${fecha}`, fecha, hubo: true, filas: [] };
      entrenamientos = [...entrenamientos, dia];
    }
    for (const f of filas) {
      dia.filas = dia.filas.filter((x) => x.jugadorId !== f.jugadorId);
      if (f.estado) dia.filas.push({ jugadorId: f.jugadorId, estado: f.estado });
    }
    return dia.id;
  },
  abrirLesion: async ({ jugadorId, desde }) => {
    lesiones = [...lesiones, { id: `l-${jugadorId}-${desde}`, jugadorId, desde, hasta: null, zona: null, lado: null, tipo: null }];
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
