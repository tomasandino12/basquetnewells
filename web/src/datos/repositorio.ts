// La puerta de datos de React: sólo lo que las pantallas de web/ usan del repositorio.js de la app.
// Las pantallas piden el repositorio por el contexto, así las pruebas le dan uno inventado
// y nunca se carga el real (ni se toca la red).

export interface Sesion {
  user: { id: string; email?: string };
}

export interface Club {
  id: string;
  nombre: string;
  apodos: string[];
}

export interface PlantelDelClub {
  id: string;
  categoria: string;
  categoriaCodigo: string | null;
  codigoCabb: string | null;
  temporadaId: string | null;
}

export interface Roles {
  esEntrenador: boolean;
  esCoordinador: boolean;
}

export interface JugadorDelPlantel {
  id: string;
  nombreClave: string;
  /** «Apellido, Nombre», como lo deja la importación. */
  nombreLimpio: string;
  fechaNacimiento: string | null;
}

/** Una fila por fecha; lo que no se midió ese día es null (no se sabe), nunca 0. */
export interface MedicionCorporal {
  jugadorId: string;
  fechaMedicion: string;
  alturaCm: number | null;
  pesoKg: number | null;
  piernaCm: number | null;
  piernaFlexionadaCm: number | null;
}

export type EstadoAsistencia = 'presente' | 'ausente' | 'justificada';

export interface Entrenamiento {
  id: string;
  fecha: string;
  hubo: boolean;
  filas: { jugadorId: string; estado: EstadoAsistencia }[];
}

export interface Lesion {
  id: string;
  jugadorId: string;
  desde: string;
  /** El día del alta; null mientras sigue lesionado. */
  hasta: string | null;
  zona: string | null;
  lado: string | null;
  tipo: string | null;
}

export interface SesionMedicion {
  id: string;
  fecha: string;
  tipo: string;
}

export interface MedicionTiro {
  sesionId: string;
  jugadorId: string;
  posicion: string;
  anotados: number | null;
  intentos: number | null;
}

/** Meta del cuerpo técnico por zona (porcentaje). Una zona que no está en el mapa no tiene meta: no es 0 %. */
export type MetasDeZona = Record<string, number>;

export interface PreviaDelPlantel {
  id: string;
  fecha: string;
  rival: string | null;
  plantelId: string;
  partidoId: string | null;
  evaluada: boolean;
}

export interface PartidoDelPlantel {
  id: string;
  fecha: string;
  rivalNombre: string | null;
}

export interface Repositorio {
  obtenerSesionActual(): Promise<Sesion | null>;
  iniciarSesion(email: string, password: string): Promise<Sesion>;
  cerrarSesion(): Promise<void>;
  /** Devuelve lo que devuelve el servicio de sesión: `data.subscription.unsubscribe()` corta el aviso. */
  alCambiarAuth(fn: (evento: string, sesion: Sesion | null) => void): { data: { subscription: { unsubscribe(): void } } };
  fueSalidaVoluntaria(): boolean;
  obtenerClubesDelEntrenador(): Promise<Club[]>;
  obtenerPlantelesDelClub(clubId: string): Promise<PlantelDelClub[]>;
  obtenerMisRoles(clubId: string): Promise<Roles>;
  obtenerMisPlantelesAsignados(clubId: string): Promise<Set<string>>;
  obtenerJugadoresDelPlantel(clubId: string, plantelId: string): Promise<JugadorDelPlantel[]>;
  obtenerMedicionesCorporalesDelClub(clubId: string): Promise<MedicionCorporal[]>;
  obtenerSolicitudesDelPlantel(plantelId: string): Promise<unknown[]>;
  obtenerEntrenamientos(plantelId: string, desde: string, hasta: string): Promise<Entrenamiento[]>;
  obtenerLesionesDelPlantel(plantelId: string): Promise<Lesion[]>;
  obtenerSesionesDeMedicion(clubId: string, plantelId: string): Promise<SesionMedicion[]>;
  obtenerMedicionesTiroDelPlantel(clubId: string, plantelId: string): Promise<MedicionTiro[]>;
  obtenerMetasDelPlantel(clubId: string, plantelId: string): Promise<MetasDeZona>;
  obtenerPreviasDelPlantel(clubId: string, plantelId: string): Promise<PreviaDelPlantel[]>;
  obtenerPartidosDelPlantel(clubId: string, plantelId: string): Promise<PartidoDelPlantel[]>;
  /** `estado: null` desmarca a ese chico; los que no vienen quedan como estaban. */
  guardarAsistencia(datos: {
    plantelId: string;
    fecha: string;
    hubo: boolean;
    filas: { jugadorId: string; estado: EstadoAsistencia | null }[];
  }): Promise<string>;
  /** zona, lado y tipo son opcionales: null es «no se sabe». */
  abrirLesion(datos: {
    clubId: string;
    jugadorId: string;
    desde: string;
    zona?: string | null;
    lado?: string | null;
    tipo?: string | null;
  }): Promise<void>;
  darAlta(lesionId: string, hasta: string): Promise<void>;
  sacarDelPlantel(clubId: string, jugadorId: string, plantelId: string): Promise<void>;
}

export type CargarRepositorio = () => Promise<Repositorio>;

/** El repositorio de verdad, cargado recién cuando una pantalla lo pide (el armado lo parte en su propio archivo). */
export const cargarRepositorioReal: CargarRepositorio = () =>
  import('@datos/repositorio.js') as unknown as Promise<Repositorio>;
