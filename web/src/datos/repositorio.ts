// La puerta de datos de React: sólo lo que las pantallas de web/ usan del repositorio.js de la app.
// Las pantallas piden el repositorio por el contexto, así las pruebas le dan uno inventado
// y nunca se carga el real (ni se toca la red).

import type { RepositorioCoord } from './repositorioCoord';

export interface Sesion {
  /** `user_metadata` lo edita la propia persona: sirve para mostrar su nombre, nunca para autorizar nada. */
  user: { id: string; email?: string; user_metadata?: { nombre?: unknown; [campo: string]: unknown } };
}

/** Lo que se manda a guardar_previa (lo arma `prepararPayloadPrevia`, que ya validó el borrador). */
export interface PayloadDePrevia {
  previaId: string;
  clubId: string;
  plantelId: string;
  fecha: string;
  rival: string | null;
  misionesJugador: unknown[];
  misionesEquipo: unknown[];
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

/** Lo que manda cada test a guardar_sesion_medicion (lo arma src/data/prepararPayloadMedicion.js). */
export interface PayloadDeMedicion {
  clubId: string;
  plantelId: string;
  fecha: string;
  tipo: 'tiro' | 'salto' | 'sprint' | 'yoyo';
  sesionId: string;
  mediciones: Record<string, unknown>[];
  [extra: string]: unknown;
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

/** Una fila del inventario de material del club. `pesoKg` null = sin peso (no es 0). */
export interface MaterialDelClub {
  id: string;
  tipo: string;
  pesoKg: number | null;
  detalle: string;
  cantidad: number;
  actualizadoPor: string | null;
  actualizadoEn: string;
}

/** Lo que valida `validarMaterial` (src/data/inventario.js) y se manda a guardar. */
export interface FilaDeMaterial {
  tipo: string;
  pesoKg: number | null;
  detalle: string;
  cantidad: number;
}

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
  puntosPropios?: number | null;
  puntosRival?: number | null;
  condicionPropia?: 'local' | 'visitante' | null;
}

/** Lo que un jugador hizo en un partido; null = no se pudo leer (no es 0). */
export interface EstadisticaDePartido {
  partidoId: string;
  jugadorId: string;
  minSegundos: number | null;
  pts: number | null;
  dosAnotados: number | null;
  dosIntentados: number | null;
  tresAnotados: number | null;
  tresIntentados: number | null;
  libresAnotados: number | null;
  libresIntentados: number | null;
}

/** Cada peso anotado de un chico en un ejercicio, y el ejercicio con su bloque del plan. */
export interface CargasDelPlantel {
  movimientos: { jugadorId: string; pasoId: string; kg: number; fecha: string; orden: number }[];
  ejercicios: { pasoId: string; nombre: string; bloque: string | null }[];
}

/** Un plan de fuerza importado de una planilla: las fechas son las de sus sesiones. */
export interface EjercicioDeFuerza {
  id: string;
  clave: string;
  nombre: string;
  bloque: string | null;
  link: string | null;
}

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

/** Un ejercicio de la biblioteca del club. */
export interface EjercicioDeLista {
  id: string;
  titulo: string;
  tema: string;
  descripcion: string | null;
  enlace: string | null;
  material: string | null;
  /** Texto libre: «6 a 12» es la respuesta real de un profe. */
  jugadores: string | null;
  categorias: string | null;
  creadoPor: string | null;
  creadoEn: string;
  /** Señal de presencia (no un contador): hay alguna nota de uso. */
  tieneNotas: boolean;
  cantidadVariaciones: number;
}

/** Un ejercicio pedido solo: trae la pizarra, que la lista no trae. */
export interface EjercicioCompleto extends Omit<EjercicioDeLista, 'tieneNotas' | 'cantidadVariaciones'> {
  pizarra: DatosDePizarra | null;
}

/** Los campos de texto de un ejercicio, tal cual los escribió el profe (vacío = no se cargó). */
export interface CamposDeEjercicio {
  titulo: string;
  tema: string;
  descripcion: string;
  enlace: string;
  material: string;
  jugadores: string;
  categorias: string;
}

export interface CamposDeVariacion {
  titulo: string;
  nivel: number;
  eje: string | null;
  descripcion: string;
}

export interface NotaDeEjercicio {
  id: string;
  texto: string;
  creadoPor: string | null;
  creadoEn: string;
}

export interface VariacionDeEjercicio {
  id: string;
  nivel: number;
  eje: string | null;
  titulo: string;
  descripcion: string | null;
  creadoPor?: string | null;
  creadoEn: string;
}

/** Una ficha de la pizarra: x e y van de 0 a 1 sobre la cancha. */
export interface FichaDePizarra {
  id: string;
  tipo: 'ataque' | 'defensa' | 'cono' | 'fila' | 'entrenador';
  numero?: number | null;
  x: number;
  y: number;
  cantidad?: number;
}

export interface AccionDePizarra {
  tipo: string;
  ficha: string;
  a?: string;
  hasta?: { x: number; y: number };
  control?: { x: number; y: number } | null;
}

/** El JSON de una jugada o de la pizarra de un ejercicio (modo 'ejercicio'). */
export interface DatosDePizarra {
  modo?: 'ejercicio';
  cancha: 'media' | 'entera';
  fichas: FichaDePizarra[];
  pelota?: string | null;
  pelotas?: (string | null)[];
  pasos: { acciones: AccionDePizarra[]; nota?: string | null }[];
}

export interface JugadaDelClub {
  id: string;
  nombre: string;
  tipo: string;
  datos: DatosDePizarra;
  creadoPor: string | null;
  esMia: boolean;
  actualizadoEn: string;
}

/** Quien tiene cuenta de jugador: lo único que la base le da sobre sí mismo (mi_ficha). */
export interface FichaDeJugador {
  jugadorId: string;
  clubId: string;
  clubNombre: string;
  nombre: string;
  planteles: { plantelId: string; categoriaCodigo: string | null; categoria: string }[];
}

/** Una línea del plan tal como la entrega mi_plan: igual que la del profe, con el nombre original del ejercicio. */
export interface LineaDeMiPlan {
  id: string;
  orden: number | null;
  bloque: string | null;
  nombreOriginal: string;
  series: number | null;
  reps: string | null;
  cargaSugerida: string | null;
  pausa: string | null;
  notas: string | null;
  video: { nombre: string; link: string } | null;
}

export interface SesionDeMiPlan {
  id: string;
  fecha: string;
  lineas: LineaDeMiPlan[];
}

export interface MiPlan {
  planes: { planId: string; plantelId: string; categoria: string; nombreArchivo: string; sesiones: SesionDeMiPlan[] }[];
  /** El último peso del jugador en cada ejercicio, unido a la línea por la clave del nombre. */
  pesos: { clave: string; nombre: string; kg: number }[];
}

/** Lo que mi_progreso entrega: sólo lo del propio jugador. La forma fina la consumen las funciones puras de src/data. */
export interface MiProgreso {
  partidos: unknown[];
  tiro: unknown[];
  saltos: { sesionId: string; fecha: string; test: string; intentos: { intento: number; tiempoVueloMs: number | null }[] }[];
  sprints: {
    sesionId: string;
    fecha: string;
    distanciaM: number;
    intentos: { intento: number; tiempoMs: number | null; parcialMs: number | null; origen: string }[];
  }[];
  yoyos: unknown[];
  escalones: unknown[];
}

export interface RecursoDelJugador {
  id: string;
  titulo: string;
  descripcion: string | null;
  enlace: string | null;
  fecha: string;
}

/** Un recurso que el profe ofrece a sus jugadores (video, PDF o link), con a quién se le mandó. */
export interface RecursoDelClub {
  id: string;
  titulo: string;
  descripcion: string;
  enlace: string | null;
  tipo: string | null;
  frecuenciaSemanal: number | null;
  minutos: number | null;
  creadoPor: string | null;
  creadoEn: string;
  envios: { jugadorId: string; fecha: string }[];
}

/** Conteos del plantel sin nombres; `abrieron` viene null si hay tan pocas cuentas que delataría a alguien. */
export interface ResumenDeRecursos {
  conCuenta: number;
  abrieronAlguno: number | null;
  recursos: {
    recursoId: string;
    enviados: number;
    conCuenta: number;
    abrieron: number | null;
    primerasEsteMes: number | null;
    primerasMesAnterior: number | null;
  }[];
}

export interface JugadaDelJugador {
  id: string;
  nombre: string;
  tipo: string;
  datos: DatosDePizarra;
}

/** Una misión de una previa de partido (de un jugador o del equipo). `estado: null` = sin evaluar. */
export interface MisionDePrevia {
  id: string;
  jugadorId?: string | null;
  /** Null en una misión escrita a mano (con texto, sin número). */
  metrica: string | null;
  comparador?: string | null;
  meta?: number | null;
  estado: 'logrado' | 'en_proceso' | 'no_logrado' | null;
  comentario: string | null;
  [campo: string]: unknown;
}

/** Una misión de un chico con la fecha y el rival de su previa (la forma que arma `misionesConPrevia`). */
export interface MisionDelJugador {
  id: string;
  previaId: string;
  metrica: string | null;
  valor?: number | null;
  texto?: string | null;
  estado: 'logrado' | 'en_proceso' | 'no_logrado' | null;
  comentario: string | null;
  fecha: string;
  rival: string | null;
  partidoId: string | null;
}

/** Un recurso que se le mandó a un chico. */
export interface EnvioDeRecurso {
  fecha: string;
  recursoId: string | null;
  titulo: string | null;
  enlace: string | null;
}

/** Lo que devuelve la historia por temporada de un chico (listas crudas; las agrupa `@datos/historiaJugador.js`). */
export type HistoriaDelJugadorCruda = Record<string, unknown[]>;

export interface PreviaCompleta {
  id: string;
  fecha: string;
  rival: string | null;
  partidoId: string | null;
  misionesJugador: MisionDePrevia[];
  misionesEquipo: MisionDePrevia[];
}

export interface PartidoConMarcador extends PartidoDelPlantel {
  puntosPropios: number | null;
  puntosRival: number | null;
}

export interface EvaluacionAGuardar {
  previaId: string;
  partidoId: string | null;
  evaluaciones: { tipo: 'jugador' | 'equipo'; id: string; estado: string | null; comentario: string | null }[];
}

/** Un pedido de un chico para entrar a una categoría. El código de aprobación no viaja acá: el chico lo muestra en persona. */
export interface SolicitudDelPlantel {
  id: string;
  userId: string;
  nombre: string | null;
  creadoEn: string;
  emailEnmascarado: string | null;
  fechaNacimiento: string | null;
}

/** Lo que la base deja ver de cada ficha del club para no duplicar: `plantelesActuales` sólo trae los planteles propios. */
export interface JugadorDelClub {
  id: string;
  nombreClave: string;
  nombreLimpio: string;
  plantelesActuales: string[];
}

export interface ChicoDeFamilia {
  vinculoId: string;
  nombre: string;
  clubNombre: string;
  categorias: string | null;
}

export interface ResponsableDeJugador {
  id: string;
  email: string;
}

/** Una fila del catálogo de «soy jugador de un club»: una por categoría de cada club. */
export interface CategoriaParaSolicitar {
  clubId: string;
  clubNombre: string;
  plantelId: string;
  categoriaCodigo: string | null;
  categoriaNombre: string;
}

export interface MiSolicitud {
  id: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada' | string;
  clubNombre: string;
  categoriaNombre: string;
  creadoEn: string;
  /** El que el chico le muestra en persona al profe. */
  codigo: string | null;
}

/** Lo que se manda a aprobar_solicitud_jugador: vincula a una ficha que existe o crea una nueva. */
export type AprobacionDeSolicitud =
  | { solicitudId: string; jugadorId: string; codigo: string }
  | { solicitudId: string; nombreClave: string; nombreLimpio: string; fechaNacimiento: string; codigo: string; desambiguador?: string };

export interface Repositorio extends RepositorioCoord {
  // Familias y altas (los pedidos de entrada, el alta a mano, los mails de la familia).
  obtenerJugadoresDelClub(clubId: string): Promise<JugadorDelClub[]>;
  altaJugadorManual(datos: {
    clubId: string;
    nombreClave: string;
    nombreLimpio: string;
    plantelId: string;
    temporadaId: string | null;
    desde: string;
  }): Promise<unknown>;
  crearPertenencia(datos: { clubId: string; jugadorId: string; plantelId: string; temporadaId: string | null; desde: string }): Promise<void>;
  aprobarSolicitud(datos: AprobacionDeSolicitud): Promise<unknown>;
  rechazarSolicitud(solicitudId: string): Promise<void>;
  revocarCuentaJugador(jugadorId: string): Promise<void>;
  jugadorTieneCuenta(jugadorId: string): Promise<boolean>;
  obtenerResponsablesDeJugador(jugadorId: string): Promise<ResponsableDeJugador[]>;
  agregarResponsable(clubId: string, jugadorId: string, email: string): Promise<void>;
  quitarResponsable(responsableId: string): Promise<void>;
  vincularPorMail(): Promise<number>;
  obtenerMisChicos(): Promise<ChicoDeFamilia[]>;
  obtenerClubesParaSolicitar(): Promise<CategoriaParaSolicitar[]>;
  crearSolicitudJugador(datos: { clubId: string; plantelId: string; fechaNacimiento: string }): Promise<void>;
  obtenerMiSolicitud(): Promise<MiSolicitud | null>;
  // Vista del jugador (cuenta de jugador: la base sólo le da lo suyo).
  obtenerMiFicha(): Promise<FichaDeJugador | null>;
  obtenerMiPlan(): Promise<MiPlan>;
  obtenerMiProgreso(): Promise<MiProgreso>;
  misJugadas(): Promise<JugadaDelJugador[]>;
  obtenerMisRecursos(): Promise<RecursoDelJugador[]>;
  obtenerRecursos(clubId: string): Promise<RecursoDelClub[]>;
  /** Null si quien llama no es entrenador del plantel. */
  obtenerResumenRecursos(plantelId: string): Promise<ResumenDeRecursos | null>;
  /** No lanza: abrir un recurso no depende de que se anote. */
  registrarAperturaDeRecurso(recursoId: string): Promise<void>;
  // Misiones de un partido (las evalúa el profe).
  obtenerPrevia(previaId: string): Promise<PreviaCompleta | null>;
  obtenerMisionesDelJugador(jugadorId: string): Promise<{ misiones: { previaId: string; [campo: string]: unknown }[]; previas: { id: string; [campo: string]: unknown }[] }>;
  obtenerHistoriaDelJugador(jugadorId: string): Promise<HistoriaDelJugadorCruda>;
  obtenerEnviosDeJugador(clubId: string, jugadorId: string): Promise<EnvioDeRecurso[]>;
  obtenerEstadisticasParaMisiones(partidoId: string): Promise<{ jugadorId: string; [columna: string]: unknown }[]>;
  evaluarMisiones(datos: EvaluacionAGuardar): Promise<unknown>;
  /** Todo o nada: guarda la previa con sus misiones. Un reintento con los mismos ids no duplica. */
  guardarPrevia(payload: PayloadDePrevia): Promise<unknown>;
  /** Guarda el nombre propio en los metadatos de la cuenta y devuelve el usuario ya actualizado. */
  guardarMiNombre(nombre: string): Promise<Sesion['user']>;
  /** El usuario tal como lo guarda el servidor (el nombre y las marcas de la cuenta), o null sin sesión. */
  obtenerMiUsuario(): Promise<Sesion['user'] | null>;
  /** Si esta cuenta ya aceptó esa versión de los Términos y la Política de privacidad. */
  yaAceptoLegal(version: string): Promise<boolean>;
  /** Deja constancia de la aceptación (autor y fecha los sella el servidor). */
  aceptarLegal(version: string): Promise<void>;
  /** ¿Coordinación rechazó el pedido de esta cuenta? Sólo el hecho. */
  miPedidoDescartado(): Promise<boolean>;
  /** «Fue un error»: la cuenta rechazada vuelve a la lista de pendientes. */
  volverAPedirAcceso(): Promise<void>;
  obtenerPlanesFisicos(clubId: string, plantelId: string): Promise<PlanFisico[]>;
  obtenerPlanFisico(planId: string): Promise<SesionFisico[]>;
  /** La biblioteca de ejercicios de fuerza del club: contra ella se reconoce qué ejercicio del plan ya tiene video. */
  obtenerEjerciciosFuerza(clubId: string): Promise<EjercicioDeFuerza[]>;
  /** importar_plan_fisico: el plan, sus sesiones y sus ejercicios entran juntos o no entra nada. El payload lo arma prepararPayloadPlanFisico.js. */
  importarPlanFisico(payload: unknown): Promise<{ sesiones: number; ejercicios: number; pendientes: number }>;
  obtenerPasos(clubId: string): Promise<PasoFuerza[]>;
  crearPaso(datos: { clubId: string; clave: string; nombre: string; paso: number | null }): Promise<PasoFuerza>;
  editarPaso(pasoId: string, paso: number): Promise<PasoFuerza>;
  obtenerEscalonesActuales(pasoId: string, jugadorIds: string[]): Promise<EscalonActual[]>;
  /** `kg` es el peso de destino, no «+1». */
  moverEscalon(datos: { clubId: string; jugadorId: string; pasoId: string; kg: number }): Promise<EscalonActual>;
  obtenerEjercicios(clubId: string): Promise<EjercicioDeLista[]>;
  obtenerEjercicio(clubId: string, ejercicioId: string): Promise<EjercicioCompleto | null>;
  obtenerNotas(clubId: string, ejercicioId: string): Promise<NotaDeEjercicio[]>;
  obtenerVariaciones(clubId: string, ejercicioId: string): Promise<VariacionDeEjercicio[]>;
  /** Devuelve el id nuevo. */
  crearEjercicio(datos: CamposDeEjercicio & { clubId: string }): Promise<string>;
  /** Lanza 'NO_ES_TUYO' si el ejercicio es de otro: la base no devuelve ninguna fila. */
  actualizarEjercicio(clubId: string, ejercicioId: string, campos: CamposDeEjercicio): Promise<void>;
  /** Se lleva las notas y variaciones. Lanza 'NO_ES_TUYO' si es de otro. */
  borrarEjercicio(clubId: string, ejercicioId: string): Promise<void>;
  crearNota(datos: { clubId: string; ejercicioId: string; texto: string }): Promise<string>;
  borrarNota(clubId: string, notaId: string): Promise<void>;
  crearVariacion(datos: CamposDeVariacion & { clubId: string; ejercicioId: string }): Promise<string>;
  actualizarVariacion(clubId: string, variacionId: string, campos: CamposDeVariacion): Promise<void>;
  borrarVariacion(clubId: string, variacionId: string): Promise<void>;
  listarJugadas(clubId: string): Promise<JugadaDelClub[]>;
  plantelesDeJugada(clubId: string, jugadaId: string): Promise<string[]>;
  /** Deja la jugada asignada exactamente a estos planteles. */
  asignarJugada(clubId: string, jugadaId: string, plantelIds: string[]): Promise<void>;
  crearJugada(datos: { clubId: string; nombre: string; tipo: string; datos: DatosDePizarra }): Promise<unknown>;
  obtenerSesionActual(): Promise<Sesion | null>;
  iniciarSesion(email: string, password: string): Promise<Sesion>;
  cerrarSesion(): Promise<void>;
  /** `sesion` viene null si el proyecto exige confirmar el mail: hay que esperar el link. */
  crearCuenta(email: string, password: string, nombre: string, opciones?: { esJugador?: boolean }): Promise<{ sesion: Sesion | null; usuario: unknown }>;
  enviarRecuperacionDeClave(email: string): Promise<void>;
  /** Cambia la clave de quien volvió desde el mail de recuperación (ya tiene sesión abierta). */
  cambiarClave(password: string): Promise<void>;
  /** Si sale bien navega a Google y la página se descarta. */
  entrarConGoogle(): Promise<void>;
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
  // Importar planillas y la pantalla Datos. Cada importación guarda todo o nada.
  importarInscriptos(datos: { plantelId: string; filas: unknown[] }): Promise<{ creados: number; existentes: number }>;
  importarEmergencias(datos: { plantelId: string; filas: unknown[] }): Promise<{ guardados: number }>;
  /** Devuelve la fila cruda de la base (nombre_archivo, no nombreArchivo), o null si el archivo es nuevo. */
  buscarImportacionPorHash(clubId: string, hashArchivo: string): Promise<{ id: string; nombre_archivo: string | null; id_partido_cabb: string | null } | null>;
  importarPartido(payload: unknown): Promise<unknown>;
  obtenerEstadisticasDelPlantel(clubId: string, plantelId: string): Promise<EstadisticaDePartido[]>;
  obtenerCargasDelPlantel(clubId: string, plantelId: string, jugadorIds: string[]): Promise<CargasDelPlantel>;
  obtenerMedicionesSprintDelPlantel(clubId: string, plantelId: string): Promise<unknown[]>;
  obtenerMedicionesYoyoDelPlantel(clubId: string, plantelId: string): Promise<unknown[]>;
  obtenerMedicionesSaltoDelPlantel(clubId: string, plantelId: string): Promise<unknown[]>;
  obtenerEntrenamientos(plantelId: string, desde: string, hasta: string): Promise<Entrenamiento[]>;
  obtenerLesionesDelPlantel(plantelId: string): Promise<Lesion[]>;
  obtenerSesionesDeMedicion(clubId: string, plantelId: string): Promise<SesionMedicion[]>;
  /** guardar_sesion_medicion: el payload lo arma prepararPayloadMedicion.js. Con el mismo sesionId no duplica. */
  guardarSesionMedicion(payload: PayloadDeMedicion): Promise<unknown>;
  obtenerMedicionesTiroDelPlantel(clubId: string, plantelId: string): Promise<MedicionTiro[]>;
  obtenerMetasDelPlantel(clubId: string, plantelId: string): Promise<MetasDeZona>;
  /** Todo o nada (hasta 6 zonas). Una zona con `objetivoPct: null` borra su meta. */
  guardarMetasPlantel(datos: { clubId: string; plantelId: string; metas: { zona: string; objetivoPct: number | null }[] }): Promise<unknown>;
  // Inventario de material: lo lee cualquier miembro del club; sólo coordinación escribe (lo impone la base).
  obtenerMaterial(clubId: string): Promise<MaterialDelClub[]>;
  /** Insert simple: si la variante ya existe la base responde 23505 y la pantalla ofrece editar esa. */
  agregarMaterial(datos: FilaDeMaterial & { clubId: string }): Promise<MaterialDelClub>;
  /** El tipo y el club no cambian. */
  editarMaterial(id: string, datos: Omit<FilaDeMaterial, 'tipo'>): Promise<MaterialDelClub>;
  quitarMaterial(id: string): Promise<void>;
  /** Nombre por usuario de quienes cargaron uno; quien no lo cargó no figura. */
  obtenerPerfilesDelClub(clubId: string): Promise<Record<string, string>>;
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
  /** `null` es «no se sabe». */
  actualizarFechaNacimiento(clubId: string, jugadorId: string, fechaNacimiento: string | null): Promise<void>;
}

export type CargarRepositorio = () => Promise<Repositorio>;

/** El repositorio de verdad, cargado recién cuando una pantalla lo pide (el armado lo parte en su propio archivo). */
export const cargarRepositorioReal: CargarRepositorio = () =>
  import('@datos/repositorio.js') as unknown as Promise<Repositorio>;
