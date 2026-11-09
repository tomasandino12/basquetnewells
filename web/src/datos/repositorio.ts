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
/** Por qué faltó un chico que avisó (0066); null = avisó sin decir por qué. */
export type MotivoFalta = 'estudio' | 'familia' | 'enfermo' | 'viaje' | 'otro';

export interface Entrenamiento {
  id: string;
  fecha: string;
  hubo: boolean;
  filas: { jugadorId: string; estado: EstadoAsistencia; motivo?: MotivoFalta | null }[];
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

/** Un plan de fuerza importado de una planilla: las fechas son las de sus sesiones. */
export interface PlanFisico {
  id: string;
  nombreArchivo: string;
  creadoEn: string;
  fechas: string[];
}

export interface LineaFisico {
  id: string;
  orden: number | null;
  bloque: string | null;
  nombreOriginal: string;
  series: number | null;
  reps: string | null;
  cargaSugerida: string | null;
  pausa: string | null;
  notas: string | null;
  /** Una línea sin video es el caso normal. */
  video: { nombre: string; link: string } | null;
}

export interface SesionFisico {
  id: string;
  fecha: string;
  lineas: LineaFisico[];
}

/** El escalón de un ejercicio (cuánto suma + y resta −), uno para todo el club. `paso: null` es «todavía sin definir». */
export interface PasoFuerza {
  id: string;
  clave: string;
  nombre: string;
  paso: number | null;
}

/** El último peso de un chico en un ejercicio y desde cuándo. */
export interface EscalonActual {
  jugadorId: string;
  kg: number;
  desde: string;
}

export interface Repositorio {
  obtenerPlanesFisicos(clubId: string, plantelId: string): Promise<PlanFisico[]>;
  obtenerPlanFisico(planId: string): Promise<SesionFisico[]>;
  obtenerPasos(clubId: string): Promise<PasoFuerza[]>;
  crearPaso(datos: { clubId: string; clave: string; nombre: string; paso: number | null }): Promise<PasoFuerza>;
  editarPaso(pasoId: string, paso: number): Promise<PasoFuerza>;
  obtenerEscalonesActuales(pasoId: string, jugadorIds: string[]): Promise<EscalonActual[]>;
  /** `kg` es el peso de destino, no «+1». */
  moverEscalon(datos: { clubId: string; jugadorId: string; pasoId: string; kg: number }): Promise<EscalonActual>;
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
    /** Sin `motivo`, la base deja el que había; con motivo null lo borra. */
    filas: { jugadorId: string; estado: EstadoAsistencia | null; motivo?: MotivoFalta | null }[];
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
