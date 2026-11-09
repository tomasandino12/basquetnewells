import { ArrowLeft, Search, ShieldCheck, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { Aviso } from '../components/ui/aviso';
import { claseBoton, Flecha } from '../components/ui/button';
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
import { cn } from '../lib/cn';
import { useEscritorio } from '../lib/useEscritorio';
import { armarFilas, buscarEnFilas, type FilaPlantel } from '../plantel/filas';
import { plantelesVisibles } from '../plantel/visibles';
import { FichaDelJugador } from './FichaDelJugador';
import { FilaDeLista } from './FilaDeLista';
import { APP_DE_SIEMPRE } from '../clasica';

const APP_ANTERIOR = APP_DE_SIEMPRE;
const ENLACE_TEXTO =
  'inline-flex min-h-11 items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:decoration-club';

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
    <MarcoDelPlantel>
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
    </MarcoDelPlantel>
  );
}

/** El ancho y la vuelta a Planteles; la maqueta usa el mismo. En compu la vuelta ya está en el menú. */
export function MarcoDelPlantel({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5 sm:max-w-none sm:px-6 lg:max-w-[72rem] lg:px-8 lg:py-8">
      <Link to="/" className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta lg:hidden">
        <ArrowLeft aria-hidden className="size-4" />
        Planteles
      </Link>
      {children}
    </main>
  );
}

export function ContenidoDelPlantel({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
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
            <header className="mb-6 flex flex-col gap-5">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs tracking-wide text-gris uppercase">Plantel</p>
                  <h1 className="font-titulo text-5xl leading-none font-bold tracking-tight lg:text-6xl">{categoria}</h1>
                  <p className="mt-2 text-sm text-gris">
                    {todos.length} {todos.length === 1 ? 'jugador' : 'jugadores'}
                    {todos.length > 0 && ` · hoy ${presentes} ${presentes === 1 ? 'presente' : 'presentes'}`}
                  </p>
                </div>
                {todos.length > 0 && (
                  // El contador cambia a medida que se tilda: es lo primero que mira el profe al llegar.
                  <p aria-hidden className="shrink-0 text-right">
                    <span className="cifra block font-titulo text-6xl leading-[.85] font-bold">
                      {presentes}
                      <span className="text-3xl text-gris">/{todos.length}</span>
                    </span>
                    <span className="font-mono text-xs tracking-wide text-gris uppercase">presentes hoy</span>
                  </p>
                )}
              </div>
              {/* Una sola acción fuerte; el resto, enlaces de texto en una fila, para no llenar la pantalla de cajas. */}
              <nav aria-label="Acciones del plantel" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
                <Link to={`/asistencia/${plantelId}`} className={cn(claseBoton(), 'self-start')}>
                  Tomar asistencia
                  <Flecha />
                </Link>
                <div className="flex flex-wrap gap-x-5">
                  {[
                    [`/hoy/${plantelId}`, 'Resumen de hoy'],
                    [`/fisico/${plantelId}`, 'Plan de fuerza'],
                    [`/asistencia/${plantelId}/historial`, 'Historial de asistencia'],
                  ].map(([a, t]) => (
                    <Link key={a} to={a} className={ENLACE_TEXTO}>
                      {t}
                    </Link>
                  ))}
                </div>
              </nav>
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
                    <a href={APP_ANTERIOR} className={claseBoton({ variante: 'secundario', tamano: 'chico' })}>Cargar un partido de la CABB</a>
                    <a href={APP_ANTERIOR} className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Agregar jugador a mano</a>
                    <a href={APP_ANTERIOR} className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Importar inscriptos</a>
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
                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-start lg:gap-6">
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
                    <div className="sticky top-6 max-h-[calc(100svh-3rem)] overflow-y-auto rounded-tarjeta shadow-tarjeta">{ficha}</div>
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
                <p className="w-full font-mono text-xs tracking-wide text-gris uppercase">Todavía en la app anterior</p>
                {['Datos de emergencia', 'Agregar a mano', 'Importar inscriptos', 'Importar emergencias'].map((t) => (
                  <a key={t} href={APP_ANTERIOR} className={claseBoton({ variante: 'linea', tamano: 'chico' })}>
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
