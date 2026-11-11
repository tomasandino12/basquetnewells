import { ArrowLeft, Users } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { useMisClubes, useMisPlantelesAsignados, useMisRoles, usePlanteles } from '../datos/consultas';
import { plantelesVisibles } from '../plantel/visibles';

interface Props {
  plantelId: string | undefined;
  /** Adónde lleva el enlace de arriba y cómo se llama. */
  volver: { a: string; texto: string };
  /** Qué dice el cuerpo técnico-only a la coordinación: los chicos no se muestran uno por uno (0018). */
  soloCuerpoTecnico: string;
  children: (plantel: { clubId: string; plantelId: string; categoria: string }) => ReactNode;
  /** «amplio»: en compu usa dos columnas y más ancho (Medir). En celular no cambia nada. */
  ancho?: 'amplio';
}

/**
 * Lo que comparten las pantallas de una categoría con datos de chicos: elegir el club, ver que la
 * categoría sea de quien mira y no mostrar nada individual a la coordinación sola.
 */
export function ConPlantel({ plantelId, volver, soloCuerpoTecnico, children, ancho }: Props) {
  const clubes = useMisClubes();
  const club = clubes.data?.[0];
  const planteles = usePlanteles(club?.id);
  const roles = useMisRoles(club?.id);
  const asignados = useMisPlantelesAsignados(club?.id);

  const listo = planteles.data && roles.data && asignados.data;
  const consulta = useMemo(() => {
    const falla = [planteles, roles, asignados].find((c) => c.isError);
    return {
      isPending: !falla && !listo && clubes.data !== undefined && clubes.data.length > 0,
      isError: !!falla,
      error: falla?.error,
      data: listo ? { roles: roles.data!, visibles: plantelesVisibles(planteles.data!, roles.data!, asignados.data!) } : undefined,
      refetch: () => Promise.all([planteles.refetch(), roles.refetch(), asignados.refetch()]),
    };
  }, [planteles, roles, asignados, clubes.data, listo]);

  return (
    <main className={`mx-auto w-full max-w-[24.375rem] px-4 pt-5 pb-0 sm:max-w-[40rem] sm:px-6${ancho === 'amplio' ? ' lg:max-w-[68rem]' : ''}`}>
      <Link to={volver.a} className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
        <ArrowLeft aria-hidden className="size-4" />
        {volver.texto}
      </Link>
      <Consulta consulta={clubes} errorGenerico="No pudimos cargar tu club">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={Users} titulo="Sin club todavía">Pedile a la coordinación que te sume al club.</Vacio>
          ) : (
            <Consulta consulta={consulta} errorGenerico="No pudimos cargar la categoría">
              {({ roles: r, visibles }) => {
                const plantel = visibles.find((p) => p.id === plantelId);
                if (!plantel) {
                  return (
                    <Vacio icono={Users} titulo="No hay una categoría seleccionada">
                      Esa categoría no está entre las tuyas. Volvé a la lista de planteles y elegí otra.
                    </Vacio>
                  );
                }
                if (r.esCoordinador && !r.esEntrenador) {
                  return <Vacio icono={Users} titulo="Esto lo ve el cuerpo técnico">{soloCuerpoTecnico}</Vacio>;
                }
                return <>{children({ clubId: club!.id, plantelId: plantel.id, categoria: plantel.categoria })}</>;
              }}
            </Consulta>
          )
        }
      </Consulta>
    </main>
  );
}
