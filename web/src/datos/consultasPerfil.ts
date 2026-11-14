import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriasDelEntrenador } from '../perfil/categorias';
import { CLAVE_SESION, useCargarRepositorio } from './contexto';
import { useMisClubes, useMisRoles } from './consultas';
import { useMiFicha } from './consultasJugador';
import type { ChicoDeFamilia, Sesion } from './repositorio';

// Mi perfil: quién sos para la app. Todo lo que no es la cuenta misma es un agregado: si no carga,
// la pantalla se dibuja igual con lo que sí (la cuenta siempre está, viene de la sesión).

/** Los chicos vinculados a quien mira; si no se pueden leer, es como no tener: no frena a nadie. */
function useChicosDelPerfil() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['familia', 'perfil-chicos'],
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<ChicoDeFamilia[]> => (await cargar()).obtenerMisChicos().catch(() => []),
  });
}

export interface DatosDelPerfil {
  /** Ya se sabe qué roles tiene (sino las pastillas de rol aparecerían de a una). */
  rolesListos: boolean;
  esEntrenador: boolean;
  esCoordinador: boolean;
  esJugador: boolean;
  esFamilia: boolean;
  clubId: string | undefined;
  clubNombre: string | null;
  /** Las categorías del jugador, de su ficha (la base no le da el plantel ni las asignaciones). */
  categoriasDeJugador: string[];
  chicos: ChicoDeFamilia[];
}

export function useDatosDelPerfil(): DatosDelPerfil {
  const clubes = useMisClubes();
  const club = clubes.data?.[0];
  const roles = useMisRoles(club?.id);
  const ficha = useMiFicha();
  const chicos = useChicosDelPerfil();

  const sinClub = clubes.isSuccess && !club;
  const rolesListos = !clubes.isPending && (sinClub || !club || !roles.isPending) && !ficha.isPending && !chicos.isPending;
  const lista = chicos.data ?? [];
  return {
    rolesListos,
    esEntrenador: !!roles.data?.esEntrenador,
    esCoordinador: !!roles.data?.esCoordinador,
    esJugador: !!ficha.data,
    esFamilia: lista.length > 0,
    clubId: club?.id,
    clubNombre: club?.nombre ?? ficha.data?.clubNombre ?? lista[0]?.clubNombre ?? null,
    categoriasDeJugador: ficha.data?.planteles.map((p) => p.categoria) ?? [],
    chicos: lista,
  };
}

/** Las categorías a cargo de un entrenador. Sólo se pide si es entrenador (los demás no las leen). */
export function useCategoriasDelEntrenador(clubId: string | undefined, habilitada: boolean) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['perfil', 'categorias', clubId],
    enabled: habilitada && clubId !== undefined,
    staleTime: 0,
    queryFn: async () => {
      const repo = await cargar();
      const [planteles, asignados, catalogo, temporadas] = await Promise.all([
        repo.obtenerPlantelesDelClub(clubId!),
        repo.obtenerMisPlantelesAsignados(clubId!),
        repo.obtenerCatalogoDeCategorias(),
        repo.obtenerTemporadasDelClub(clubId!),
      ]);
      return categoriasDelEntrenador({ planteles, asignados, catalogo, temporadas });
    },
  });
}

/** Guarda el nombre y lo deja en la sesión: la cabecera y el perfil lo muestran sin volver a pedirlo. */
export function useGuardarNombre() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) => {
      await (await cargar()).guardarMiNombre(nombre);
      return nombre;
    },
    onSuccess: (nombre) =>
      consultas.setQueryData<Sesion | null>(CLAVE_SESION, (s) =>
        s ? { ...s, user: { ...s.user, user_metadata: { ...s.user.user_metadata, nombre } } } : s,
      ),
  });
}
