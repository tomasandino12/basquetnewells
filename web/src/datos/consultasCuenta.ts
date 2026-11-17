import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VERSION_LEGAL } from '@datos/legal.js';
import { useMisClubes, useMisRoles } from './consultas';
import { useCargarRepositorio } from './contexto';
import { useMiFicha } from './consultasJugador';
import type { Sesion } from './repositorio';

// Lo que hay que resolver entre «abrí sesión» y «entrá a la app»: el nombre, los Términos y, si la
// cuenta no es de nadie todavía, el acceso. Una consulta por dato; las claves empiezan con «cuenta».

export const CLAVE_USUARIO = ['cuenta', 'usuario'] as const;
export const CLAVE_LEGAL = ['cuenta', 'legal', VERSION_LEGAL] as const;

/** El usuario tal como lo guarda el servidor (no el de la sesión guardada en el teléfono, que puede venir viejo). */
export function useMiUsuario(habilitada = true) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: CLAVE_USUARIO,
    enabled: habilitada,
    staleTime: Infinity,
    queryFn: async () => (await cargar()).obtenerMiUsuario(),
  });
}

/** Si ya aceptó la versión vigente. Cambiar VERSION_LEGAL lo vuelve a pedir a todos. */
export function useAceptoLegal(habilitada = true) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: CLAVE_LEGAL,
    enabled: habilitada,
    staleTime: Infinity,
    queryFn: async () => (await cargar()).yaAceptoLegal(VERSION_LEGAL),
  });
}

export function useAceptarLegal() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async () => (await cargar()).aceptarLegal(VERSION_LEGAL),
    onSuccess: () => consultas.setQueryData(CLAVE_LEGAL, true),
  });
}

/** Guarda el nombre de una cuenta que no lo tenía y lo deja en el usuario y en la sesión. */
export function useGuardarNombreInicial() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) => (await cargar()).guardarMiNombre(nombre),
    onSuccess: (usuario) => {
      consultas.setQueryData<Sesion['user'] | null>(CLAVE_USUARIO, usuario);
      consultas.setQueryData<Sesion | null>(['sesion'], (s) => (s ? { ...s, user: usuario } : s));
    },
  });
}

/** Los chicos de una familia. Un error es «no hay»: no frena a nadie (la base contesta vacío o 42501 a una cuenta sin nada). */
function useChicosDeLaFamilia(habilitada: boolean) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['cuenta', 'chicos'],
    enabled: habilitada,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const repo = await cargar();
      try {
        await repo.vincularPorMail();
        return await repo.obtenerMisChicos();
      } catch {
        return [];
      }
    },
  });
}

export type Acceso =
  | { estado: 'cargando' }
  | { estado: 'error'; error: unknown; reintentar: () => void }
  | { estado: 'listo' }
  | { estado: 'sin-club' };

/**
 * Si la cuenta es de alguien: cuerpo técnico de un club, jugador con ficha o familia de un chico.
 * Una cuenta recién creada no es de nadie, y eso no es un error: es esperar a que la habiliten.
 * Un profe dado de baja conserva su club sin ningún rol (0039): no cuenta como cuerpo técnico.
 * La ficha y los chicos se preguntan sólo si no es del cuerpo técnico, para no sumar llamadas a quien sí.
 */
export function useAcceso(): Acceso {
  const clubes = useMisClubes();
  const club = clubes.data?.[0];
  const roles = useMisRoles(club?.id);
  const esCuerpoTecnico = !!roles.data && (roles.data.esEntrenador || roles.data.esCoordinador);
  const hayQueMirarMas = clubes.isSuccess && (!club || (roles.isSuccess && !esCuerpoTecnico));
  const ficha = useMiFicha(hayQueMirarMas);
  const chicos = useChicosDeLaFamilia(hayQueMirarMas && ficha.isSuccess && !ficha.data);

  const reintentar = () => {
    void clubes.refetch();
    void roles.refetch();
  };
  if (clubes.isError || roles.isError) return { estado: 'error', error: clubes.error ?? roles.error, reintentar };
  if (clubes.isPending || (!!club && roles.isPending)) return { estado: 'cargando' };
  if (esCuerpoTecnico) return { estado: 'listo' };
  if (ficha.isPending) return { estado: 'cargando' };
  if (ficha.data) return { estado: 'listo' };
  if (chicos.isPending) return { estado: 'cargando' };
  if ((chicos.data?.length ?? 0) > 0) return { estado: 'listo' };
  return { estado: 'sin-club' };
}
