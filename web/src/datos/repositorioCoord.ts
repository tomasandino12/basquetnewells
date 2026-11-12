// Lo que las pantallas de coordinación piden al repositorio. Aparte de repositorio.ts para que ése no
// crezca: coordinación ve agregados del club (y nombres sólo en Temporada y en Papeles y pagos).
import type { PlantelDelClub } from './repositorio';

export interface CategoriaDelCatalogo {
  codigo: string;
  nombre: string;
  orden: number;
}

export interface Temporada {
  id: string;
  nombre: string;
}

export interface Miembro {
  userId: string;
  email: string;
  nombre: string | null;
  esEntrenador: boolean;
  esCoordinador: boolean;
  habilitadoEn: string | null;
  bajaEn: string | null;
}

export interface Asignacion {
  id: string;
  userId: string;
  plantelId: string;
  desde: string;
  hasta: string | null;
  origen: string | null;
}

export interface UsuarioPendiente {
  userId: string;
  email: string;
  nombre: string | null;
  registradoEn: string;
  esJugador: boolean;
}

/** Lo que devuelve panorama_del_club: conteos y sumas por plantel, nunca filas de un chico. */
export interface PanoramaDelClub {
  planteles: { plantelId: string; jugadores: number; partidos: number; ultimaMedicion: string | null }[];
  tiro: unknown[];
  partidos: unknown[];
}

export interface AsistenciaDeCategoria {
  plantelId: string;
  pct: number | null;
  entrenamientos: number;
}

export interface MisionesDeEquipo {
  previas: { id: string; fecha: string; rival: string | null; plantelId: string }[];
  misiones: { id: string; previaId: string; estado: string | null; [campo: string]: unknown }[];
}

export interface EmergenciaDeJugador {
  jugadorId: string;
  nombreLimpio: string;
  cargado: boolean;
  alertas: string[];
  telefonoAdulto: string | null;
  contactoUrgencia: string | null;
  alergias: string | null;
  medicacion: string | null;
  indicacion: string | null;
  obraSocial: string | null;
}

export interface PaseDeTemporada {
  jugadorId: string;
  nombreLimpio: string;
  anioNacimiento: number | null;
  codigos: string[];
}

export interface Rubro {
  id: string;
  nombre: string;
  tipo: 'ingreso' | 'egreso';
  activo: boolean;
}

export interface Movimiento {
  id: string;
  fecha: string;
  rubroId: string;
  centavos: number;
  descripcion: string;
  comprobanteUrl: string | null;
  borradoEn?: string | null;
}

export interface FilaDeMovimiento {
  fecha: string;
  rubroId: string;
  centavos: number;
  descripcion: string;
  comprobanteUrl: string | null;
}

export interface ChicoDeInscripcion {
  id: string;
  nombre: string;
  nombreGoogle: string | null;
  categoriaCodigo: string | null;
  categoriaTexto: string | null;
  rama: string | null;
  emparejamiento: 'ok' | 'homonimo' | 'sin_ficha' | 'sin_tablero';
  fila: number | null;
  documentos: Record<string, boolean | null>;
  completo: boolean | null;
  pagos: Record<string, 'falta' | 'subido' | 'verificado'>;
  cambioEn: string | null;
}

export interface ConexionGoogle {
  conectado: boolean;
  rotadoEn: string | null;
  ultimoEnvioEn: string | null;
  tableroUrl: string | null;
  gidTablero: number | null;
  gidPagos: number | null;
  documentosOrden: string[];
  conceptosOrden: string[];
}

export interface FormularioDelPortal {
  id: string;
  titulo: string;
  texto: string;
  enlace: string;
  orden: number;
  activo: boolean;
  destino: string | null;
}

export interface DatosDeFormulario {
  titulo: string;
  texto: string;
  enlace: string;
  destino: string | null;
}

export interface VinculoDeFamilia {
  id: string;
  jugador: string;
  categorias: string | null;
  nombre: string | null;
  emailEnmascarado: string;
  desde: string;
}

export interface RepositorioCoord {
  obtenerCatalogoDeCategorias(): Promise<CategoriaDelCatalogo[]>;
  obtenerTemporadasDelClub(clubId: string): Promise<Temporada[]>;
  obtenerPanoramaDelClub(clubId: string): Promise<PanoramaDelClub>;
  obtenerMiembrosDelClub(clubId: string): Promise<Miembro[]>;
  obtenerAsignacionesDelClub(clubId: string): Promise<Asignacion[]>;
  obtenerMisionesDeEquipo(clubId: string): Promise<MisionesDeEquipo>;
  obtenerAsistenciaDelClub(clubId: string, desde: string, hasta: string): Promise<AsistenciaDeCategoria[]>;
  obtenerUsuariosPendientes(): Promise<UsuarioPendiente[]>;
  obtenerUsuarioActual(): Promise<string | null>;
  asignarPlanteles(datos: { userId: string; clubId: string; plantelIds: string[] }): Promise<{ asignadas: number }>;
  cerrarAsignacion(asignacionId: string): Promise<void>;
  descartarCuenta(datos: { userId: string; clubId: string }): Promise<void>;
  buscarJugadorParaHabilitar(datos: { clubId: string; email: string }): Promise<UsuarioPendiente | null>;
  darDeBajaProfe(datos: { userId: string; clubId: string }): Promise<{ asignacionesCerradas: number }>;
  obtenerEmergenciasDelPlantel(plantelId: string): Promise<EmergenciaDeJugador[]>;
  obtenerPasesDeTemporada(clubId: string): Promise<PaseDeTemporada[]>;
  abrirTemporada(datos: { clubId: string; nombre: string }): Promise<unknown>;
  confirmarPases(datos: { clubId: string; filas: { jugadorId: string; plantelId: string | null }[] }): Promise<{ pasados: number }>;
  obtenerRubros(clubId: string): Promise<Rubro[]>;
  agregarRubro(datos: { clubId: string; nombre: string; tipo: string }): Promise<unknown>;
  editarRubro(id: string, cambios: { nombre?: string; activo?: boolean }): Promise<unknown>;
  obtenerMovimientosDelPeriodo(clubId: string, rango: { desde: string; hasta: string }): Promise<Movimiento[]>;
  agregarMovimiento(datos: { clubId: string } & FilaDeMovimiento): Promise<unknown>;
  editarMovimiento(id: string, movimiento: FilaDeMovimiento): Promise<unknown>;
  borrarMovimiento(id: string): Promise<void>;
  obtenerEstadoInscripcion(clubId: string): Promise<ChicoDeInscripcion[]>;
  obtenerConexionGoogle(clubId: string): Promise<ConexionGoogle>;
  rotarConexionGoogle(clubId: string): Promise<string>;
  desconectarGoogle(clubId: string): Promise<void>;
  obtenerVinculosFamiliaDelClub(clubId: string): Promise<VinculoDeFamilia[]>;
  cerrarVinculoFamilia(vinculoId: string): Promise<void>;
  listarFormularios(clubId: string): Promise<FormularioDelPortal[]>;
  crearFormulario(datos: { clubId: string; orden: number } & DatosDeFormulario): Promise<unknown>;
  actualizarFormulario(id: string, datos: Partial<DatosDeFormulario> & { activo: boolean }): Promise<unknown>;
  reordenarFormularios(cambios: unknown[]): Promise<unknown>;
  asignarDestinoFormulario(id: string, destino: string | null): Promise<unknown>;
}

export type { PlantelDelClub };
