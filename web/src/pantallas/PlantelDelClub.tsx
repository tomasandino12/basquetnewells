import { ArrowLeft, Search, ShieldCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { Aviso } from '../components/ui/aviso';
import { Consulta } from '../components/ui/consulta';
import { Hoja } from '../components/ui/sheet';
import { Vacio } from '../components/ui/estados';
import {
  useDatosDelPlantel,
  useMarcarAsistencia,
  useMisClubes,
  useMisPlantelesAsignados,
  useMisRoles,
  usePlanteles,
} from '../datos/consultas';
import { useEscritorio } from '../lib/useEscritorio';
import { armarFilas, buscarEnFilas, type FilaPlantel } from '../plantel/filas';
import { plantelesVisibles } from '../plantel/visibles';
import { FichaDelJugador } from './FichaDelJugador';
import { FilaDeLista } from './FilaDeLista';

const APP_ANTERIOR = '/app/';

/**
 * El plantel de una categoría con datos reales: lista a la izquierda, ficha al costado (en el
 * celular, en una hoja). La asistencia se toma dentro de la lista. Lo que la pantalla ve lo decide
 * la base (RLS); acá sólo se ordena.
 */
export function PlantelDelClub() {
  const { plantelId } = useParams();
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
    <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5 sm:max-w-none sm:px-6 lg:px-8">
      <Link to="/" className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
        <ArrowLeft aria-hidden className="size-4" />
        Planteles
      </Link>
      <Consulta consulta={clubes} errorGenerico="No pudimos cargar tu club">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={Users} titulo="Sin club todavía">Pedile a la coordinación que te sume al club.</Vacio>
          ) : (
            <Consulta consulta={consulta} errorGenerico="No pudimos cargar el plantel">
              {({ roles: r, visibles }) => {
                const plantel = visibles.find((p) => p.id === plantelId);
                if (!plantel) {
                  return (
                    <Vacio icono={Users} titulo="No encontramos esa categoría">
                      No está entre tus categorías. Volvé a la lista de planteles y elegí otra.
                    </Vacio>
                  );
                }
                // La base no le da filas de chicos a la coordinación sola (0018): se lo decimos
                // en vez de mostrar un plantel vacío que parezca roto.
                if (r.esCoordinador && !r.esEntrenador) {
                  return (
                    <Vacio icono={ShieldCheck} titulo="Los chicos los ve el cuerpo técnico">
                      La coordinación ve la categoría en conjunto, no los datos de cada chico. Los datos de emergencia se miran en la{' '}
                      <a href={APP_ANTERIOR} className="font-semibold underline">app anterior</a>.
                    </Vacio>
                  );
                }
                return <ContenidoDelPlantel clubId={club!.id} plantelId={plantel.id} categoria={plantel.categoria} />;
              }}
            </Consulta>
          )
        }
      </Consulta>
    </main>
  );
}

function ContenidoDelPlantel({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const hoy = hoyLocal() as string;
  const datos = useDatosDelPlantel(clubId, plantelId, hoy);
  const escritorio = useEscritorio();
  const asistencia = useMarcarAsistencia(plantelId, hoy);
  const [texto, setTexto] = useState('');
  // La app de siempre abre la ficha de un jugador con ?jugador=: arranca ya elegido.
  const [pedido] = useSearchParams();
  // Al guardar la toma de asistencia se vuelve acá con el aviso de que quedó guardada.
  const avisoDeToma = (useLocation().state as { aviso?: string } | null)?.aviso;
  const [elegido, setElegido] = useState<string | null>(pedido.get('jugador'));

  const filas = useMemo(() => (datos.data ? armarFilas({ ...datos.data, hoy }) : undefined), [datos.data, hoy]);
  const visibles = useMemo(() => (filas ? buscarEnFilas(filas, texto) : []), [filas, texto]);
  // En compu siempre hay alguien en el panel; en celular la hoja se abre sólo al tocar una fila.
  const enFicha = visibles.find((f) => f.id === elegido) ?? (escritorio ? visibles[0] : undefined);

  const marcarPresente = (f: FilaPlantel) =>
    asistencia.mutate({ jugadorId: f.id, estado: f.hoy === 'presente' ? null : 'presente' });

  const ficha = enFicha && (
    <FichaDelJugador key={enFicha.id} fila={enFicha} clubId={clubId} plantelId={plantelId} hoy={hoy} alSacar={() => setElegido(null)} />
  );

  return (
    <Consulta consulta={datos} errorGenerico="No pudimos cargar el plantel">
      {(d) => {
        const todos = filas ?? [];
        const presentes = todos.filter((f) => f.hoy === 'presente').length;
        return (
          <>
            <header className="mb-4">
              <div className="float-right flex flex-col items-end">
                <Link to={`/hoy/${plantelId}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
                  Resumen de hoy
                </Link>
                <Link to={`/fisico/${plantelId}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
                  Plan de fuerza
                </Link>
                <Link to={`/asistencia/${plantelId}`} className="inline-flex min-h-11 items-center text-sm font-semibold underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
                  Tomar asistencia
                </Link>
                <Link to={`/asistencia/${plantelId}/historial`} className="inline-flex min-h-11 items-center text-sm font-semibold underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
                  Historial de asistencia
                </Link>
              </div>
              <h1 className="font-titulo text-4xl leading-none font-semibold">{categoria}</h1>
              <p className="mt-1 text-sm text-gris">
                {todos.length} {todos.length === 1 ? 'jugador' : 'jugadores'}
                {todos.length > 0 && ` · hoy ${presentes} ${presentes === 1 ? 'presente' : 'presentes'}`}
              </p>
            </header>

            {avisoDeToma && <Aviso tono="ok" titulo={avisoDeToma} className="mb-4" />}

            {d.solicitudes > 0 && (
              <Aviso titulo={d.solicitudes === 1 ? '1 chico pidió entrar a esta categoría' : `${d.solicitudes} chicos pidieron entrar a esta categoría`} className="mb-4">
                <a href={APP_ANTERIOR} className="font-semibold underline">Revisar en la app anterior</a>
              </Aviso>
            )}

            {todos.length === 0 ? (
              <Vacio
                icono={Users}
                titulo={`${categoria} todavía no tiene jugadores`}
                accion={
                  <div className="flex flex-col gap-2">
                    <a href={APP_ANTERIOR} className="text-sm font-semibold underline">Cargar un partido de la CABB</a>
                    <a href={APP_ANTERIOR} className="text-sm font-semibold underline">Agregar jugador a mano</a>
                    <a href={APP_ANTERIOR} className="text-sm font-semibold underline">Importar inscriptos</a>
                  </div>
                }
              >
                La forma más rápida de armar el plantel es cargar una planilla de la CABB; los que no trae, se agregan a mano.
              </Vacio>
            ) : (
              <>
                <label className="relative mb-4 block sm:max-w-sm">
                  <span className="sr-only">Buscar jugador por nombre</span>
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gris" />
                  <input
                    type="search"
                    value={texto}
                    maxLength={40}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Buscar por nombre"
                    className="h-11 w-full rounded-campo border border-borde-control bg-sup pr-3 pl-9 text-base outline-offset-2 placeholder:text-gris focus-visible:outline-2 focus-visible:outline-tinta"
                  />
                </label>
                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start lg:gap-6">
                  {visibles.length === 0 ? (
                    <p className="py-10 text-center text-gris">Ningún jugador coincide con la búsqueda.</p>
                  ) : (
                    <ul aria-label="Jugadores del plantel" className="flex flex-col gap-2">
                      {visibles.map((f) => (
                        <FilaDeLista
                          key={f.id}
                          fila={f}
                          elegida={enFicha?.id === f.id}
                          guardando={asistencia.isPending}
                          alElegir={setElegido}
                          alPresente={marcarPresente}
                        />
                      ))}
                    </ul>
                  )}
                  {escritorio && ficha && (
                    <div className="sticky top-4 max-h-[calc(100svh-2rem)] overflow-y-auto rounded-tarjeta">{ficha}</div>
                  )}
                </div>
                {asistencia.isError && (
                  <Aviso tono="error" titulo="No se pudo guardar la asistencia" className="mt-4">
                    Revisá la conexión y volvé a tocar al jugador.
                  </Aviso>
                )}
              </>
            )}

            {todos.length > 0 && (
              <section aria-label="Más acciones del plantel" className="mt-8 flex flex-wrap gap-2 border-t border-linea pt-4">
                <p className="w-full text-sm text-gris">Todavía en la app anterior:</p>
                {['Datos de emergencia', 'Agregar a mano', 'Importar inscriptos', 'Importar emergencias'].map((t) => (
                  <a
                    key={t}
                    href={APP_ANTERIOR}
                    className="inline-flex min-h-11 items-center rounded-btn border border-borde-control px-3 font-titulo text-base font-semibold tracking-[.14em] uppercase outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                  >
                    {t}
                  </a>
                ))}
              </section>
            )}

            {!escritorio && (
              <Hoja
                rojo
                abierta={enFicha !== undefined}
                alCambiar={(abierta) => !abierta && setElegido(null)}
                titulo={enFicha ? `Ficha de ${enFicha.nombre} ${enFicha.apellido}` : 'Ficha'}
                descripcion="Asistencia de hoy, lesión, físico y tiro del jugador."
              >
                {ficha}
              </Hoja>
            )}
          </>
        );
      }}
    </Consulta>
  );
}
