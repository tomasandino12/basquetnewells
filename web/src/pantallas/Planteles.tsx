import { useMemo } from 'react';
import { Link } from 'react-router';
import { Card } from '../components/ui/card';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Boton } from '../components/ui/button';
import { Users } from 'lucide-react';
import { useMisClubes, useMisPlantelesAsignados, useMisRoles, usePlanteles, useSalir } from '../datos/consultas';
import { plantelesVisibles } from '../plantel/visibles';

/** Primera pantalla conectada: los planteles de quien entró, por el repositorio y con RLS decidiendo qué ve. */
export function Planteles() {
  const clubes = useMisClubes();
  const club = clubes.data?.[0];
  const planteles = usePlanteles(club?.id);
  const roles = useMisRoles(club?.id);
  const asignados = useMisPlantelesAsignados(club?.id);
  const salir = useSalir();

  // Las tres consultas del club se cuentan como una: si falla una, se reintentan juntas.
  const listo = planteles.data && roles.data && asignados.data;
  const consulta = useMemo(() => {
    const falla = [planteles, roles, asignados].find((c) => c.isError);
    return {
      isPending: !falla && !listo && clubes.data !== undefined && clubes.data.length > 0,
      isError: !!falla,
      error: falla?.error,
      data: listo ? plantelesVisibles(planteles.data!, roles.data!, asignados.data!) : undefined,
      refetch: () => Promise.all([planteles.refetch(), roles.refetch(), asignados.refetch()]),
    };
  }, [planteles, roles, asignados, clubes.data, listo]);

  return (
    <main className="mx-auto w-full max-w-[52rem] px-4 py-5 sm:px-6">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gris">{club?.nombre ?? ' '}</p>
          <h1 className="font-titulo text-4xl leading-none font-semibold">Planteles</h1>
        </div>
        <Boton variante="contorno" tamano="chico" disabled={salir.isPending} onClick={() => salir.mutate()}>Salir</Boton>
      </header>
      <Consulta consulta={clubes} errorGenerico="No pudimos cargar tu club">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={Users} titulo="Sin club todavía">Pedile a la coordinación que te sume al club.</Vacio>
          ) : (
            <Consulta consulta={consulta} errorGenerico="No pudimos cargar los planteles">
              {(visibles) =>
                visibles.length === 0 ? (
                  <Vacio icono={Users} titulo="Sin planteles">Todavía no tenés planteles asignados.</Vacio>
                ) : (
                  <ul aria-label="Planteles" className="grid gap-3 sm:grid-cols-2">
                    {visibles.map((p) => (
                      <li key={p.id}>
                        <Link to={`/plantel/${p.id}`} className="block rounded-tarjeta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
                          <Card className="p-4 font-titulo text-2xl font-semibold uppercase">{p.categoria}</Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              }
            </Consulta>
          )
        }
      </Consulta>
    </main>
  );
}
