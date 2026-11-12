import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rangoDelMes } from '@datos/finanzas.js';
import { hoyLocal } from '@datos/antropometria.js';
import { useCargarRepositorio, useSesion } from '../datos/contexto';
import type { Repositorio } from '../datos/repositorio';

// Todo lo de coordinación cuelga de la clave 'coord': una escritura vuelve a pedir lo que quedó guardado.
const DESDE_SIEMPRE = '2000-01-01';

/**
 * ¿Quien está mirando coordina su club? Sólo decide si el menú ofrece el enlace: sin sesión (o si algo
 * falla) la respuesta es «no», y la base sigue siendo la que manda sobre lo que se puede leer.
 */
export function useEsCoordinador(): boolean {
  const cargar = useCargarRepositorio();
  const { estado } = useSesion();
  const q = useQuery({
    queryKey: ['coord', 'soy-coordinador'],
    enabled: estado === 'con-sesion',
    retry: false,
    queryFn: async () => {
      const repo = await cargar();
      const club = (await repo.obtenerClubesDelEntrenador())[0];
      return club ? (await repo.obtenerMisRoles(club.id)).esCoordinador : false;
    },
  });
  return estado === 'con-sesion' && q.data === true;
}

export function usePanoramaDelClub(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'panorama', clubId],
    queryFn: async () => {
      const repo = await cargar();
      const [planteles, catalogo, temporadas, panorama, miembros, asignaciones, equipo, asistencia] = await Promise.all([
        repo.obtenerPlantelesDelClub(clubId),
        repo.obtenerCatalogoDeCategorias(),
        repo.obtenerTemporadasDelClub(clubId),
        repo.obtenerPanoramaDelClub(clubId),
        repo.obtenerMiembrosDelClub(clubId),
        repo.obtenerAsignacionesDelClub(clubId),
        // Agregados: si fallan, el panorama se dibuja igual sin los logros ni la asistencia.
        repo.obtenerMisionesDeEquipo(clubId).catch(() => null),
        repo.obtenerAsistenciaDelClub(clubId, DESDE_SIEMPRE, hoyLocal()).catch(() => null),
      ]);
      return { planteles, catalogo, temporadas, panorama, miembros, asignaciones, equipo, asistencia };
    },
  });
}

/** Una línea de «Papeles y pagos» para el panorama: sin esperarla y sin romper nada si falla. */
export function useResumenDePapeles(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'papeles-resumen', clubId],
    retry: false,
    queryFn: async () => {
      const repo = await cargar();
      const [chicos, conexion] = await Promise.all([repo.obtenerEstadoInscripcion(clubId), repo.obtenerConexionGoogle(clubId)]);
      return { chicos, conexion };
    },
  });
}

export function useDatosDeProfes(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'profes', clubId],
    queryFn: async () => {
      const repo = await cargar();
      const [planteles, catalogo, temporadas, miembros, asignaciones, pendientes, usuarioActualId] = await Promise.all([
        repo.obtenerPlantelesDelClub(clubId),
        repo.obtenerCatalogoDeCategorias(),
        repo.obtenerTemporadasDelClub(clubId),
        repo.obtenerMiembrosDelClub(clubId),
        repo.obtenerAsignacionesDelClub(clubId),
        repo.obtenerUsuariosPendientes(),
        repo.obtenerUsuarioActual(),
      ]);
      return { planteles, catalogo, temporadas, miembros, asignaciones, pendientes, usuarioActualId };
    },
  });
}

export function useDatosDeTemporada(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'temporada', clubId],
    queryFn: async () => {
      const repo = await cargar();
      const [planteles, catalogo, temporadas, miembros, asignaciones, pases] = await Promise.all([
        repo.obtenerPlantelesDelClub(clubId),
        repo.obtenerCatalogoDeCategorias(),
        repo.obtenerTemporadasDelClub(clubId),
        repo.obtenerMiembrosDelClub(clubId),
        repo.obtenerAsignacionesDelClub(clubId),
        repo.obtenerPasesDeTemporada(clubId),
      ]);
      return { planteles, catalogo, temporadas, miembros, asignaciones, pases };
    },
  });
}

/** Salud de menores: no se guarda nada (gcTime 0): se vuelve a pedir cada vez que se abre. */
export function useEmergencias(plantelId: string | null) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'emergencias', plantelId],
    enabled: plantelId !== null,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async () => (await cargar()).obtenerEmergenciasDelPlantel(plantelId!),
  });
}

export function useRubros(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'rubros', clubId],
    queryFn: async () => (await cargar()).obtenerRubros(clubId),
  });
}

export function useFinanzasDelMes(clubId: string, anio: number, mes: number) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'finanzas', clubId, anio, mes],
    queryFn: async () => {
      const repo = await cargar();
      const [rubros, movimientos] = await Promise.all([
        repo.obtenerRubros(clubId),
        repo.obtenerMovimientosDelPeriodo(clubId, rangoDelMes(anio, mes)),
      ]);
      return { rubros, movimientos };
    },
  });
}

export function useEstadoDePapeles(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'papeles', clubId],
    queryFn: async () => {
      const repo = await cargar();
      const [chicos, conexion, catalogo] = await Promise.all([
        repo.obtenerEstadoInscripcion(clubId),
        repo.obtenerConexionGoogle(clubId),
        // Los nombres de categoría son un adorno: si falla, se muestran los códigos.
        repo.obtenerCatalogoDeCategorias().catch(() => []),
      ]);
      return { chicos, conexion, catalogo };
    },
  });
}

export function useVinculosDeFamilia(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'vinculos', clubId],
    queryFn: async () => (await cargar()).obtenerVinculosFamiliaDelClub(clubId),
  });
}

export function useFormularios(clubId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['coord', 'formularios', clubId],
    queryFn: async () => (await cargar()).listarFormularios(clubId),
  });
}

/**
 * Una escritura de coordinación. Al terminar bien vuelve a pedir todo lo de coordinación: la
 * pantalla muestra lo que quedó guardado, no lo que se tocó.
 */
export function useAccionCoord<V, R = unknown>(escribir: (repo: Repositorio, v: V) => Promise<R>) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => escribir(await cargar(), v),
    onSuccess: () => consultas.invalidateQueries({ queryKey: ['coord'] }),
  });
}
