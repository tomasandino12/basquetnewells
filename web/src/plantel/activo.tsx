import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CLAVE_PLANTEL } from '@datos/interruptorNueva.js';
import { useMisClubes, useMisPlantelesAsignados, useMisRoles, usePlanteles } from '../datos/consultas';
import type { PlantelDelClub } from '../datos/repositorio';
import { plantelesVisibles } from './visibles';

/**
 * La categoría con la que se está trabajando, como los chips de arriba de la app de siempre. No va
 * en la dirección (Tomás no quiere ver ids en /app): se guarda en el teléfono, y la app de siempre
 * escribe la misma clave antes de pasar a esta, así las dos abren la misma categoría.
 */
interface PlantelActivo {
  clubId: string;
  plantelId: string;
  categoria: string;
  visibles: PlantelDelClub[];
  /** Sólo coordina: la base no le da los chicos uno por uno (0018). */
  soloCoordina: boolean;
  elegir: (plantelId: string) => void;
}

interface Carga {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

const Contexto = createContext<PlantelActivo | null>(null);
const ContextoCarga = createContext<Carga>({ isPending: false, isError: false, error: undefined, refetch: () => {} });

export function usePlantelActivo(): PlantelActivo | null {
  return useContext(Contexto);
}

export function usePlantelId(): string | undefined {
  return useContext(Contexto)?.plantelId;
}

/** Si la categoría todavía se está averiguando o no se pudo, para mostrar la carga o el error. */
export function useCargaDeCategoria(): Carga {
  return useContext(ContextoCarga);
}

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE_PLANTEL);
  } catch {
    return null;
  }
}

function guardar(id: string) {
  try {
    localStorage.setItem(CLAVE_PLANTEL, id);
  } catch {
    // Sin localStorage se queda en la primera categoría: no es un error para mostrar.
  }
}

export function ProveedorPlantelActivo({ children }: { children: ReactNode }) {
  const clubes = useMisClubes();
  const club = clubes.data?.[0];
  const planteles = usePlanteles(club?.id);
  const roles = useMisRoles(club?.id);
  const asignados = useMisPlantelesAsignados(club?.id);
  const [guardado, setGuardado] = useState<string | null>(leer);

  const visibles = useMemo(
    () => (planteles.data && roles.data && asignados.data ? plantelesVisibles(planteles.data, roles.data, asignados.data) : undefined),
    [planteles.data, roles.data, asignados.data],
  );

  const valor = useMemo<PlantelActivo | null>(() => {
    if (!club || !visibles || visibles.length === 0) return null;
    const elegido = visibles.find((p) => p.id === guardado) ?? visibles[0];
    return {
      clubId: club.id,
      plantelId: elegido.id,
      categoria: elegido.categoria,
      visibles,
      soloCoordina: !!roles.data?.esCoordinador && !roles.data?.esEntrenador,
      elegir: (id) => {
        guardar(id);
        setGuardado(id);
      },
    };
  }, [club, visibles, guardado, roles.data]);

  const consultas = [clubes, planteles, roles, asignados];
  const falla = consultas.find((c) => c.isError);
  const carga: Carga = {
    isPending: !falla && (clubes.isPending || (!!club && !visibles)),
    isError: !!falla,
    error: falla?.error,
    refetch: () => Promise.all(consultas.map((c) => c.refetch())),
  };

  return (
    <ContextoCarga.Provider value={carga}>
      <Contexto.Provider value={valor}>{children}</Contexto.Provider>
    </ContextoCarga.Provider>
  );
}
