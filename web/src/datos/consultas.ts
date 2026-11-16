import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAVE_SESION, useCargarRepositorio } from './contexto';
import type { DatosDePizarra, EscalonActual, EstadoAsistencia, MotivoFalta, PasoFuerza, Repositorio } from './repositorio';

// Una consulta por dato, con la clave armada con lo que la hace distinta (el club, el plantel).
// Los datos de un club nunca comparten clave con los de otro.

export function useMisClubes() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['clubes'],
    queryFn: async () => (await cargar()).obtenerClubesDelEntrenador(),
  });
}

export function usePlanteles(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['planteles', clubId],
    queryFn: async () => (await cargar()).obtenerPlantelesDelClub(clubId!),
    enabled: clubId !== undefined,
  });
}

export function useMisRoles(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['roles', clubId],
    queryFn: async () => (await cargar()).obtenerMisRoles(clubId!),
    enabled: clubId !== undefined,
  });
}

export function useMisPlantelesAsignados(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['asignados', clubId],
    queryFn: async () => (await cargar()).obtenerMisPlantelesAsignados(clubId!),
    enabled: clubId !== undefined,
  });
}

// Un plantel es de una temporada: todo lo que tiene entrenamientos es de ésta.
const DESDE_SIEMPRE = '2000-01-01';

const claveDelPlantel = (clubId: string | undefined, plantelId: string | undefined) => ['plantel', clubId, plantelId];

/**
 * Todo lo que el plantel necesita junto. Los agregados (mediciones, asistencia, lesiones, tiro,
 * solicitudes) degradan solos: si fallan, la lista se dibuja igual sin ese dato, que es preferible
 * a ningún plantel. Sólo la lista de chicos puede dar error.
 */
export function useDatosDelPlantel(clubId: string | undefined, plantelId: string | undefined, hoy: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: claveDelPlantel(clubId, plantelId),
    enabled: clubId !== undefined && plantelId !== undefined,
    queryFn: async () => {
      const repo = await cargar();
      const [jugadores, mediciones, entrenamientos, lesiones, sesiones, tiro, solicitudes] = await Promise.all([
        repo.obtenerJugadoresDelPlantel(clubId!, plantelId!),
        repo.obtenerMedicionesCorporalesDelClub(clubId!).catch(() => []),
        repo.obtenerEntrenamientos(plantelId!, DESDE_SIEMPRE, hoy).catch(() => []),
        repo.obtenerLesionesDelPlantel(plantelId!).catch(() => []),
        repo.obtenerSesionesDeMedicion(clubId!, plantelId!).catch(() => []),
        repo.obtenerMedicionesTiroDelPlantel(clubId!, plantelId!).catch(() => []),
        repo.obtenerSolicitudesDelPlantel(plantelId!).catch(() => []),
      ]);
      return { jugadores, mediciones, entrenamientos, lesiones, sesiones, tiro, solicitudes: solicitudes.length };
    },
  });
}

/**
 * Lo que necesita la pantalla Hoy. Las sesiones y el tiro son de lo que trata la pantalla y pueden
 * dar error; los chicos, las mediciones corporales y las metas degradan solos (sin ellos la pantalla
 * se dibuja igual, sin esa parte).
 */
export function useDatosDeHoy(clubId: string | undefined, plantelId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['hoy', clubId, plantelId],
    enabled: clubId !== undefined && plantelId !== undefined,
    queryFn: async () => {
      const repo = await cargar();
      const [sesiones, mediciones, jugadores, corporales, metas] = await Promise.all([
        repo.obtenerSesionesDeMedicion(clubId!, plantelId!),
        repo.obtenerMedicionesTiroDelPlantel(clubId!, plantelId!),
        repo.obtenerJugadoresDelPlantel(clubId!, plantelId!).catch(() => null),
        repo.obtenerMedicionesCorporalesDelClub(clubId!).catch(() => null),
        repo.obtenerMetasDelPlantel(clubId!, plantelId!).catch(() => ({})),
      ]);
      return { sesiones, mediciones, jugadores, corporales, metas };
    },
  });
}

/** Las previas y los partidos para la tarjeta de misiones; es un agregado: si falla, Hoy no la dibuja. */
export function useMisionesDeHoy(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['misiones', clubId, plantelId],
    retry: false,
    queryFn: async () => {
      const repo = await cargar();
      const [previas, partidos] = await Promise.all([
        repo.obtenerPreviasDelPlantel(clubId, plantelId),
        repo.obtenerPartidosDelPlantel(clubId, plantelId),
      ]);
      return { previas, partidos };
    },
  });
}

/** Cada cambio vuelve a pedir el plantel: la pantalla muestra lo que quedó guardado, no lo que se tocó. */
function useEscritura<V>(escribir: (repo: Repositorio, v: V) => Promise<unknown>) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => escribir(await cargar(), v),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['plantel'] }),
  });
}

export function useMarcarAsistencia(plantelId: string, fecha: string) {
  return useEscritura<{ jugadorId: string; estado: EstadoAsistencia | null; motivo?: MotivoFalta | null }>((repo, f) =>
    repo.guardarAsistencia({ plantelId, fecha, hubo: true, filas: [f] }),
  );
}

// La toma de asistencia. Las claves empiezan con «plantel»: lo que se guarda en la ficha o en la lista
// (una lesión, un alta) las vuelve a pedir. Cada consulta es una cosa, así un cambio de lesiones no pisa lo marcado.

/** Los chicos del plantel, ordenados por nombre por quien los usa. Si falla, no hay toma de asistencia. */
export function useJugadoresDeAsistencia(clubId: string | undefined, plantelId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'asistencia', 'jugadores', clubId, plantelId],
    enabled: clubId !== undefined && plantelId !== undefined,
    queryFn: async () => (await cargar()).obtenerJugadoresDelPlantel(clubId!, plantelId!),
  });
}

/** La marca de lesionado es un agregado: si no se puede leer, se toma asistencia igual, sin esa marca. */
export function useLesionesDeAsistencia(plantelId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'asistencia', 'lesiones', plantelId],
    enabled: plantelId !== undefined,
    queryFn: async () => (await cargar()).obtenerLesionesDelPlantel(plantelId!).catch(() => []),
  });
}

/** Lo ya guardado de un día. Siempre fresco: lo marcado se mide contra esto, no contra una copia vieja. */
export function useEntrenamientoDelDia(plantelId: string | undefined, fecha: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'asistencia', 'dia', plantelId, fecha],
    enabled: plantelId !== undefined,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => (await (await cargar()).obtenerEntrenamientos(plantelId!, fecha, fecha))[0] ?? null,
  });
}

export function useHistorialDeAsistencia(plantelId: string | undefined, hoy: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'asistencia', 'historial', plantelId],
    enabled: plantelId !== undefined,
    staleTime: 0,
    queryFn: async () => (await cargar()).obtenerEntrenamientos(plantelId!, DESDE_SIEMPRE, hoy),
  });
}

export interface DiaAGuardar {
  hubo: boolean;
  filas: { jugadorId: string; estado: EstadoAsistencia }[];
}

/** Todo el día junto (una sola escritura): si falla, lo marcado queda en la pantalla para reintentar. */
export function useGuardarDia(plantelId: string, fecha: string) {
  return useEscritura<DiaAGuardar>((repo, d) => repo.guardarAsistencia({ plantelId, fecha, ...d }));
}

export interface LesionNueva {
  jugadorId: string;
  zona: string | null;
  lado: string | null;
  tipo: string | null;
}

/** La lesión se guarda al instante: es del jugador, no de este entrenamiento. */
export function useRegistrarLesion(clubId: string, desde: string) {
  return useEscritura<LesionNueva>((repo, l) => repo.abrirLesion({ clubId, desde, ...l }));
}

export function useAbrirLesion(clubId: string, desde: string) {
  return useEscritura<string>((repo, jugadorId) => repo.abrirLesion({ clubId, jugadorId, desde }));
}

export function useDarAlta(hasta: string) {
  return useEscritura<string>((repo, lesionId) => repo.darAlta(lesionId, hasta));
}

export function useSacarDelPlantel(clubId: string, plantelId: string) {
  return useEscritura<string>((repo, jugadorId) => repo.sacarDelPlantel(clubId, jugadorId, plantelId));
}

// Físico: el plan de fuerza, los escalones por ejercicio y el peso de cada chico. Las claves empiezan con «fisico».

export function usePlanesFisicos(clubId: string | undefined, plantelId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['fisico', 'planes', clubId, plantelId],
    enabled: clubId !== undefined && plantelId !== undefined,
    staleTime: 0,
    queryFn: async () => (await cargar()).obtenerPlanesFisicos(clubId!, plantelId!),
  });
}

/** Las sesiones de un plan con sus ejercicios. */
export function usePlanFisico(planId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['fisico', 'plan', planId],
    enabled: planId !== undefined,
    queryFn: async () => (await cargar()).obtenerPlanFisico(planId!),
  });
}

/** Siempre fresco: al volver de definir un escalón, la sesión lo muestra. */
export function usePasos(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['fisico', 'pasos', clubId],
    enabled: clubId !== undefined,
    staleTime: 0,
    queryFn: async () => (await cargar()).obtenerPasos(clubId!),
  });
}

/** El peso actual de cada chico en un ejercicio; sin escalón creado todavía, no hay pesos que pedir. */
export function useEscalonesActuales(pasoId: string | undefined, jugadorIds: string[] | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['fisico', 'escalones', pasoId ?? null, jugadorIds],
    enabled: jugadorIds !== undefined,
    staleTime: 0,
    // Al crearse la fila del ejercicio la clave cambia: sin esto la lista parpadearía a «Cargando».
    placeholderData: keepPreviousData,
    queryFn: async () => (pasoId ? (await cargar()).obtenerEscalonesActuales(pasoId, jugadorIds!) : []),
  });
}

function useEscrituraFisica<V, R>(escribir: (repo: Repositorio, v: V) => Promise<R>) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => escribir(await cargar(), v),
    // Sólo lo que cambia con un peso o un escalón; el plan en sí no se vuelve a pedir.
    onSettled: () => Promise.all([
      consultas.invalidateQueries({ queryKey: ['fisico', 'pasos'] }),
      consultas.invalidateQueries({ queryKey: ['fisico', 'escalones'] }),
    ]),
  });
}

/**
 * Guarda el peso de un chico en el momento. Si el ejercicio todavía no tiene fila propia la crea sin
 * escalón: el peso no espera a que el profe decida de a cuánto sube. Si otra pestaña la creó en el
 * medio (23505) es la misma fila del mismo ejercicio: se usa esa.
 */
export function useMoverEscalon(clubId: string, clave: string, nombre: string) {
  return useEscrituraFisica<{ jugadorId: string; kg: number; paso: PasoFuerza | null }, EscalonActual>(async (repo, v) => {
    let paso = v.paso;
    if (!paso) {
      try {
        paso = await repo.crearPaso({ clubId, clave, nombre: nombre.trim(), paso: null });
      } catch (e) {
        if ((e as { code?: string } | null)?.code !== '23505') throw e;
        paso = (await repo.obtenerPasos(clubId)).find((p) => p.clave === clave) ?? null;
        if (!paso) throw e;
      }
    }
    return repo.moverEscalon({ clubId, jugadorId: v.jugadorId, pasoId: paso.id, kg: v.kg });
  });
}

/** Define o cambia el escalón del ejercicio (uno para todo el club). */
export function useGuardarPaso(clubId: string, clave: string, nombre: string) {
  return useEscrituraFisica<{ existente: PasoFuerza | null; kg: number }, PasoFuerza>((repo, v) =>
    v.existente
      ? repo.editarPaso(v.existente.id, v.kg)
      : repo.crearPaso({ clubId, clave, nombre: nombre.trim(), paso: v.kg }),
  );
}

/** Las sesiones ya cargadas de un plantel. Siempre fresco: al volver de medir tiene que estar la nueva. */
export function useSesionesDeMedicion(clubId: string | undefined, plantelId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['medir', 'sesiones', clubId, plantelId],
    enabled: clubId !== undefined && plantelId !== undefined,
    staleTime: 0,
    queryFn: async () => (await cargar()).obtenerSesionesDeMedicion(clubId!, plantelId!),
  });
}

export function useEntrar() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, clave }: { email: string; clave: string }) =>
      (await cargar()).iniciarSesion(email, clave),
    onSuccess: (sesion) => consultas.setQueryData(CLAVE_SESION, sesion),
  });
}

export function useCrearCuenta() {
  const cargar = useCargarRepositorio();
  return useMutation({
    // Sin onSuccess que guarde sesión: si el proyecto no exige confirmar el mail, el aviso de
    // cambio de sesión ya la marca; si lo exige, `sesion` viene null y se muestra el aviso del mail.
    mutationFn: async (d: { email: string; clave: string; nombre: string; esJugador: boolean }) =>
      (await cargar()).crearCuenta(d.email, d.clave, d.nombre, { esJugador: d.esJugador }),
  });
}

export function useRecuperarClave() {
  const cargar = useCargarRepositorio();
  return useMutation({ mutationFn: async (email: string) => (await cargar()).enviarRecuperacionDeClave(email) });
}

export function useCambiarClave() {
  const cargar = useCargarRepositorio();
  return useMutation({ mutationFn: async (clave: string) => (await cargar()).cambiarClave(clave) });
}

export function useEntrarConGoogle() {
  const cargar = useCargarRepositorio();
  return useMutation({ mutationFn: async () => (await cargar()).entrarConGoogle() });
}

export function useSalir() {
  const cargar = useCargarRepositorio();
  return useMutation({
    // El resto (vaciar datos, marcar sin sesión) lo hace el aviso de cambio de sesión.
    mutationFn: async () => (await cargar()).cerrarSesion(),
  });
}
