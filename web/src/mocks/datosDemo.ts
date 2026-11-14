import { repositorioDemo } from './hoyDemo';
import type { EstadisticaDePartido, PartidoDelPlantel, Repositorio } from '../datos/repositorio';

// Rivales y números inventados para la maqueta de Datos: los chicos son los mismos de la maqueta de Hoy.
const PARTIDOS: PartidoDelPlantel[] = [
  { id: 'dp6', fecha: '2026-10-25', rivalNombre: 'Rival Seis', puntosPropios: 58, puntosRival: 52, condicionPropia: 'local' },
  { id: 'dp5', fecha: '2026-10-11', rivalNombre: 'Rival Cinco', puntosPropios: 44, puntosRival: 61, condicionPropia: 'visitante' },
  { id: 'dp4', fecha: '2026-09-27', rivalNombre: 'Rival Cuatro', puntosPropios: 49, puntosRival: 47, condicionPropia: 'local' },
  { id: 'dp3', fecha: '2026-09-13', rivalNombre: 'Rival Tres', puntosPropios: 38, puntosRival: 55, condicionPropia: 'visitante' },
  { id: 'dp2', fecha: '2026-08-30', rivalNombre: 'Rival Dos', puntosPropios: 51, puntosRival: 50, condicionPropia: 'local' },
  { id: 'dp1', fecha: '2026-08-16', rivalNombre: 'Rival Uno', puntosPropios: 40, puntosRival: 46, condicionPropia: 'visitante' },
];

// Por partido (del más viejo al más nuevo): dobles, triples y libres metidos de 10 intentos por chico.
const TIRO = [[4, 2, 5], [4, 2, 6], [3, 2, 5], [5, 3, 7], [4, 2, 4], [6, 3, 6]];

const ESTADISTICAS: EstadisticaDePartido[] = [...PARTIDOS].reverse().flatMap((p, i) =>
  ['d1', 'd2', 'd3', 'd4', 'd5', 'd7'].map((jugadorId, k) => {
    const [dos, tres, libres] = TIRO[i].map((v) => Math.max(0, v + ((k % 3) - 1)));
    return {
      partidoId: p.id, jugadorId, minSegundos: (22 - k * 3) * 60, pts: dos * 2 + tres * 3 + libres,
      dosAnotados: dos, dosIntentados: 10, tresAnotados: tres, tresIntentados: 8, libresAnotados: libres, libresIntentados: 8,
    };
  }),
);

const FECHAS_SPRINT = ['2026-08-20', '2026-09-17', '2026-10-15'];
const SPRINT = FECHAS_SPRINT.flatMap((fecha, i) =>
  ['d1', 'd2', 'd3', 'd4', 'd5'].map((jugadorId, k) => ({ sesionId: `sp${i}`, fecha, jugadorId, distanciaM: 20, tiempoMs: 9400 - i * 180 + k * 120 })),
);

const PROPIO: Partial<Repositorio> = {
  obtenerPartidosDelPlantel: async () => PARTIDOS,
  obtenerEstadisticasDelPlantel: async () => ESTADISTICAS,
  obtenerCargasDelPlantel: async () => ({ movimientos: [], ejercicios: [] }),
  obtenerMedicionesSprintDelPlantel: async () => SPRINT,
  obtenerMedicionesYoyoDelPlantel: async () => [],
  obtenerMedicionesSaltoDelPlantel: async () => [],
};

/** La maqueta de Hoy más partidos y sprints inventados: alcanza para ver todos los gráficos de Datos. */
export const repositorioDeDatosDemo = new Proxy(PROPIO, {
  get: (destino, clave: string) => (clave in destino ? destino[clave as keyof Repositorio] : (repositorioDemo as unknown as Record<string, unknown>)[clave]),
}) as Repositorio;
