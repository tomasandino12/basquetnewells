import { ArrowLeft, Search, ShieldCheck, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { Aviso } from '../components/ui/aviso';
import { claseBoton, Flecha } from '../components/ui/button';
import { Vacio } from '../components/ui/estados';
import { Consulta } from '../components/ui/consulta';
import { useDatosDelPlantel, useMarcarAsistencia } from '../datos/consultas';
import { cn } from '../lib/cn';
import { useCargaDeCategoria, usePlantelActivo } from '../plantel/activo';
import { armarFilas, buscarEnFilas, type FilaPlantel } from '../plantel/filas';
import { FilaDeLista } from './FilaDeLista';
import { APP_DE_SIEMPRE } from '../clasica';

const APP_ANTERIOR = APP_DE_SIEMPRE;
const ENLACE_TEXTO =
  'inline-flex min-h-11 items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:decoration-club';

/** Mientras se sabe qué categoría y si es del cuerpo técnico. Sin categoría, lo dice. */
export function SinCategoria() {
  return (
    <Vacio icono={Users} titulo="Todavía no tenés categorías">
      Pedile a la coordinación que te asigne una categoría.
    </Vacio>
  );
}

/** La base no le da filas de chicos a la coordinación sola (0018): se lo decimos en vez de mostrar un plantel vacío. */
export function SoloCuerpoTecnico() {
  return (
    <Vacio icono={ShieldCheck} titulo="Los chicos los ve el cuerpo técnico">
      La coordinación ve la categoría en conjunto, no los datos de cada chico. Los datos de emergencia se miran en la{' '}
      <a href={APP_ANTERIOR} className="font-semibold underline">app anterior</a>.
    </Vacio>
  );
}

/**
 * El plantel de la categoría elegida arriba. La asistencia de hoy se marca en la lista (el círculo
 * es «vino»); tocar a un chico abre su ficha en una pantalla propia, /plantel/su-nombre.
 */
export function PlantelDelClub() {
  return (
    <MarcoDelPlantel>
      <ConCategoria>
        {(activo) => <ContenidoDelPlantel key={activo.plantelId} clubId={activo.clubId} plantelId={activo.plantelId} categoria={activo.categoria} />}
      </ConCategoria>
    </MarcoDelPlantel>
  );
}

/** La categoría elegida arriba, con su carga, su error, «sin categoría» y la coordinación sola resueltos. */
export function ConCategoria({ children }: { children: (activo: NonNullable<ReturnType<typeof usePlantelActivo>>) => ReactNode }) {
  const activo = usePlantelActivo();
  const carga = useCargaDeCategoria();
  return (
    <Consulta consulta={{ ...carga, data: carga.isPending || carga.isError ? undefined : { activo } }} errorGenerico="No pudimos cargar tu categoría">
      {({ activo: a }) => (!a ? <SinCategoria /> : a.soloCoordina ? <SoloCuerpoTecnico /> : children(a))}
    </Consulta>
  );
}

/** El ancho de la pantalla; la maqueta usa el mismo. */
export function MarcoDelPlantel({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5 sm:max-w-none sm:px-6 lg:max-w-[72rem] lg:px-8 lg:py-8">{children}</main>;
}

interface Props {
  clubId: string;
  plantelId: string;
  categoria: string;
  /** Dónde viven las fichas: /plantel en la app, /maqueta/plantel en la maqueta. */
  base?: string;
  /** Dónde se toma la asistencia; la maqueta no tiene toma propia. */
  tomar?: string;
}

export function ContenidoDelPlantel({ clubId, plantelId, categoria, base = '/plantel', tomar = '/asistencia' }: Props) {
  const hoy = hoyLocal() as string;
  const datos = useDatosDelPlantel(clubId, plantelId, hoy);
  const asistencia = useMarcarAsistencia(plantelId, hoy);
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  // La app de siempre abre la ficha de un jugador con ?jugador=<id>: se cambia por su nombre.
  const [pedido] = useSearchParams();
  const avisoDeToma = (useLocation().state as { aviso?: string } | null)?.aviso;

  const filas = useMemo(() => (datos.data ? armarFilas({ ...datos.data, hoy }) : undefined), [datos.data, hoy]);
  const visibles = useMemo(() => (filas ? buscarEnFilas(filas, texto) : []), [filas, texto]);

  const pedida = pedido.get('jugador') && filas?.find((f) => f.id === pedido.get('jugador'));
  if (pedida) return <Navigate to={`${base}/${pedida.slug}`} replace />;

  const marcarPresente = (f: FilaPlantel) => asistencia.mutate({ jugadorId: f.id, estado: f.hoy === 'presente' ? null : 'presente' });

  return (
    <Consulta consulta={datos} errorGenerico="No pudimos cargar el plantel">
      {(d) => {
        const todos = filas ?? [];
        const presentes = todos.filter((f) => f.hoy === 'presente').length;
        const cuenta = {
          faltaron: todos.filter((f) => f.hoy === 'ausente').length,
          avisaron: todos.filter((f) => f.hoy === 'justificada').length,
          lesionados: todos.filter((f) => f.lesion).length,
          sinMarcar: todos.filter((f) => f.hoy === null).length,
        };
        return (
          <>
            <header className="mb-6 flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs tracking-wide text-gris uppercase">Plantel</p>
                  <h1 className="font-titulo text-5xl leading-none font-bold tracking-tight lg:text-6xl">{categoria}</h1>
                  <p className="mt-2 text-sm text-gris">
                    {todos.length} {todos.length === 1 ? 'jugador' : 'jugadores'}
                    {todos.length > 0 && ` · hoy ${presentes} ${presentes === 1 ? 'presente' : 'presentes'}`}
                  </p>
                </div>
                <div className="flex items-end gap-6">
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
                  <Link to={tomar} className={claseBoton()}>
                    Tomar asistencia
                    <Flecha />
                  </Link>
                </div>
              </div>
              {todos.length > 0 && (
                <dl aria-label="Asistencia de hoy" className="grid grid-cols-2 gap-px overflow-hidden rounded-tarjeta border border-linea bg-linea sm:grid-cols-4">
                  {[
                    ['Faltaron sin avisar', cuenta.faltaron, 'text-baja'],
                    ['Avisaron', cuenta.avisaron, 'text-tinta'],
                    ['Lesionados', cuenta.lesionados, 'text-baja'],
                    ['Sin marcar', cuenta.sinMarcar, 'text-gris'],
                  ].map(([t, n, tono]) => (
                    <div key={t as string} className="bg-sup px-4 py-3">
                      <dt className="text-xs text-gris">{t}</dt>
                      <dd className={cn('cifra font-titulo text-3xl leading-none font-bold', n === 0 ? 'text-gris' : (tono as string))}>{n}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <nav aria-label="Acciones del plantel" className="flex flex-wrap gap-x-5">
                {[
                  ['/hoy', 'Resumen de hoy'],
                  ['/asistencia/historial', 'Historial de asistencia'],
                  ['/fisico', 'Plan de fuerza'],
                ].map(([a, t]) => (
                  <Link key={a} to={a} className={ENLACE_TEXTO}>
                    {t}
                  </Link>
                ))}
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
                {visibles.length === 0 ? (
                  <p className="py-10 text-center text-gris">Ningún jugador coincide con la búsqueda.</p>
                ) : (
                  <ul aria-label="Jugadores del plantel" className="flex flex-col gap-2">
                    {visibles.map((f) => (
                      <FilaDeLista
                        key={f.id}
                        fila={f}
                        elegida={false}
                        guardando={asistencia.isPending}
                        alElegir={() => navegar(`${base}/${f.slug}`)}
                        alPresente={marcarPresente}
                      />
                    ))}
                  </ul>
                )}
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
          </>
        );
      }}
    </Consulta>
  );
}

/** La vuelta de la ficha al plantel. */
export function VolverAlPlantel({ a }: { a: string }) {
  return (
    <Link to={a} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
      <ArrowLeft aria-hidden className="size-4" />
      Volver al plantel
    </Link>
  );
}
