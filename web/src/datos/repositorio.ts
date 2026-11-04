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
}

export type CargarRepositorio = () => Promise<Repositorio>;

/** El repositorio de verdad, cargado recién cuando una pantalla lo pide (el armado lo parte en su propio archivo). */
export const cargarRepositorioReal: CargarRepositorio = () =>
  import('@datos/repositorio.js') as unknown as Promise<Repositorio>;
