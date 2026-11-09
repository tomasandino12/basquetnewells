import type { MedicionTiro, Repositorio } from '../datos/repositorio';

// Nombres inventados para la maqueta: ninguno es de un chico real.
const JUGADORES = [
  { id: 'd1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
  { id: 'd2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
  { id: 'd3', nombreClave: 'cabrera lautaro', nombreLimpio: 'Cabrera, Lautaro', fechaNacimiento: null },
  { id: 'd4', nombreClave: 'dominguez santino', nombreLimpio: 'Domínguez, Santino', fechaNacimiento: null },
  { id: 'd5', nombreClave: 'gimenez franco', nombreLimpio: 'Giménez, Franco', fechaNacimiento: null },
];

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
    JUGADORES.map((j, k) => ({
      sesionId: s.id,
      jugadorId: j.id,
      posicion,
      anotados: Math.max(0, Math.min(10, porBateria[i] + ((k % 3) - 1))),
      intentos: 10,
    })),
  ),
);

const PROPIO: Partial<Repositorio> = {
  obtenerSesionActual: async () => null,
  alCambiarAuth: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  fueSalidaVoluntaria: () => true,
  obtenerSesionesDeMedicion: async () => SESIONES,
  obtenerMedicionesTiroDelPlantel: async () => MEDICIONES,
  obtenerJugadoresDelPlantel: async () => JUGADORES,
  obtenerMedicionesCorporalesDelClub: async () => [
    { jugadorId: 'd1', fechaMedicion: '2026-10-14', alturaCm: 158, pesoKg: 47, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'd2', fechaMedicion: '2026-10-14', alturaCm: 162, pesoKg: 51, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'd3', fechaMedicion: '2026-10-14', alturaCm: 155, pesoKg: 44, piernaCm: null, piernaFlexionadaCm: null },
  ],
  obtenerMetasDelPlantel: async () => ({ frontal: 40, esq_izq: 50, c45_der: 50 }),
  obtenerPreviasDelPlantel: async () => [
    { id: 'pr1', fecha: '2026-11-15', rival: 'Rival de Ejemplo', plantelId: 'demo', partidoId: null, evaluada: false },
  ],
  obtenerPartidosDelPlantel: async () => [],
};

/** Un repositorio sólo de lectura para la maqueta: lo que no está arriba devuelve vacío. Nunca toca la base. */
export const repositorioDeHoyDemo = new Proxy(PROPIO, {
  // 'then' no: si no, al esperar el repositorio JavaScript lo toma por una promesa y se queda colgado.
  get: (destino, clave: string) => (clave === 'then' ? undefined : (destino[clave as keyof Repositorio] ?? (async () => []))),
}) as Repositorio;
