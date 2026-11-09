import { ArrowLeft, Target, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { saludoSegunHora } from '@datos/saludo.js';
import { siguientePasoDeMisiones, vincularPrevias } from '@datos/misiones.js';
import escudo from '../../../public/escudo.png';
import { claseBoton, Flecha } from '../components/ui/button';
import { CanchaCalor } from '../components/ui/cancha-calor';
import { Panel } from '../components/ui/card';
import { Consulta } from '../components/ui/consulta';
import { CurvaArco } from '../components/ui/curva-arco';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import { useDatosDeHoy, useMisClubes, useMisPlantelesAsignados, useMisRoles, useMisionesDeHoy, usePlanteles } from '../datos/consultas';
import type { PartidoDelPlantel, PreviaDelPlantel } from '../datos/repositorio';
import { armarResumen, fechaCorta, type Valor, type Variacion, type Zona } from '../hoy/resumen';
import { cn } from '../lib/cn';
import { plantelesVisibles } from '../plantel/visibles';

// Lo que todavía se hace en la app anterior (cargar mediciones y partidos, fijar metas, recursos, misiones).
const APP_ANTERIOR = '/app/';

// Una sola acción lima por pantalla (Tomar asistencia); el resto, de contorno o de línea.
const ENLACE_BOTON = claseBoton({ variante: 'contorno', tamano: 'chico' });
const ENLACE_LINEA = claseBoton({ variante: 'linea', tamano: 'chico' });
const ENLACE_FUERTE = claseBoton({ variante: 'secundario', tamano: 'chico' });
const ETIQUETA = 'font-mono text-xs tracking-wide text-gris uppercase';

const PLURAL = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * La pantalla Hoy de una categoría: cómo viene el tiro en la última batería, qué zona está floja y
 * a dónde ir a seguir. La seguridad la impone la base; acá sólo se ordena lo que llega.
 */
export function Hoy() {
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
    <MarcoDeHoy>
      <Consulta consulta={clubes} errorGenerico="No pudimos cargar tu club">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={Users} titulo="Sin club todavía">Pedile a la coordinación que te sume al club.</Vacio>
          ) : (
            <Consulta consulta={consulta} errorGenerico="No pudimos cargar el resumen">
              {({ roles: r, visibles }) => {
                const plantel = visibles.find((p) => p.id === plantelId);
                if (!plantel) {
                  return (
                    <Vacio icono={Users} titulo="No hay una categoría seleccionada">
                      Esa categoría no está entre las tuyas. Volvé a la lista de planteles y elegí otra.
                    </Vacio>
                  );
                }
                // La base no le da mediciones de cada chico a la coordinación sola (0018).
                if (r.esCoordinador && !r.esEntrenador) {
                  return (
                    <Vacio icono={Users} titulo="El tiro lo ve el cuerpo técnico">
                      La coordinación ve la categoría en conjunto, no las mediciones de cada chico. El panorama del club está en la{' '}
                      <a href={APP_ANTERIOR} className="font-semibold underline">app anterior</a>.
                    </Vacio>
                  );
                }
                return <ContenidoDeHoy clubId={club!.id} plantelId={plantel.id} categoria={plantel.categoria} />;
              }}
            </Consulta>
          )
        }
      </Consulta>
    </MarcoDeHoy>
  );
}

/** El ancho y la vuelta a Planteles; la maqueta de Hoy usa el mismo. En compu la vuelta ya está en el menú. */
export function MarcoDeHoy({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5 sm:max-w-none sm:px-6 lg:max-w-[64rem] lg:px-8 lg:py-8">
      <Link to="/" className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta lg:hidden">
        <ArrowLeft aria-hidden className="size-4" />
        Planteles
      </Link>
      {children}
    </main>
  );
}

export function ContenidoDeHoy({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const datos = useDatosDeHoy(clubId, plantelId);
  const resumen = useMemo(() => (datos.data ? armarResumen(datos.data) : undefined), [datos.data]);
  const saludo = saludoSegunHora(new Date().getHours());

  return (
    <>
      <h1 className="mb-5 font-titulo text-5xl leading-none font-bold tracking-tight lg:text-6xl">{saludo}</h1>
      <Consulta consulta={datos} errorGenerico="No se pudo cargar el resumen">
        {() => {
          if (!resumen) return null;
          return (
            <div className="flex flex-col gap-5">
              <Entrenamiento categoria={categoria} plantelId={plantelId} />

              <Misiones clubId={clubId} plantelId={plantelId} />

              {resumen.tipo === 'sin-baterias' && (
                <Vacio
                  icono={Target}
                  titulo={`Todavía no hay nada cargado en ${categoria}`}
                  accion={
                    <div className="flex flex-col gap-2">
                      <Link to={`/plantel/${plantelId}`} className={ENLACE_FUERTE}>Cargar el plantel</Link>
                      <a href={APP_ANTERIOR} className={ENLACE_BOTON}>Cargar un partido</a>
                      <a href={APP_ANTERIOR} className={ENLACE_BOTON}>Hacer la primera medición</a>
                    </div>
                  }
                >
                  El resumen del día se arma solo apenas haya datos. Así se empieza:
                </Vacio>
              )}

              {resumen.tipo === 'sin-mediciones' && (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm">
                    Hubo una batería el {fechaCorta(resumen.fecha)} en {categoria}, pero quedó sin ninguna medición: todos los jugadores figuran como ausentes.
                  </p>
                  <a href={APP_ANTERIOR} className={ENLACE_FUERTE}>Hacer una medición</a>
                </div>
              )}

              {resumen.tipo === 'completo' && <Tiro resumen={resumen} categoria={categoria} plantelId={plantelId} />}
            </div>
          );
        }}
      </Consulta>
    </>
  );
}

/**
 * El momento de la pantalla: la tarjeta bordó del día con la única acción lima. El escudo va de
 * marca de agua, grande y cortado por el borde, casi invisible: se nota de cerca y no pesa.
 */
function Entrenamiento({ categoria, plantelId }: { categoria: string; plantelId: string }) {
  return (
    <section aria-label="Entrenamiento de hoy" className="relative overflow-hidden rounded-tarjeta border border-linea bg-bordo p-5 text-sobre-bordo shadow-tarjeta sm:p-6">
      <img src={escudo} alt="" aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 size-56 opacity-[.08] select-none" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide uppercase opacity-75">Entrenamiento de hoy</p>
          <p className="mt-1 truncate font-titulo text-4xl leading-none font-bold tracking-tight">{categoria}</p>
        </div>
        <Link to={`/asistencia/${plantelId}`} className={cn(claseBoton(), 'self-start sm:self-auto')}>
          Tomar asistencia
          <Flecha />
        </Link>
      </div>
    </section>
  );
}

type Completo = Extract<ReturnType<typeof armarResumen>, { tipo: 'completo' }>;

function Tiro({ resumen, categoria, plantelId }: { resumen: Completo; categoria: string; plantelId: string }) {
  const [verQuienes, setVerQuienes] = useState(false);
  const { total, totalVariacion, metas, zonas, libres, foco, porDebajo, serie, corporal, jugadoresQueMidieron } = resumen;
  const midieron = jugadoresQueMidieron;
  const hayMetas = metas !== null;

  return (
    <>
      <p className="text-sm text-gris">
        {categoria} · batería del {fechaCorta(resumen.fecha)} · {midieron} {PLURAL(midieron, 'jugador midió', 'jugadores midieron')}
      </p>

      {total && (
        <section aria-label="Tiro de campo" className="rounded-tarjeta border border-linea bg-sup p-4 shadow-tarjeta sm:p-5">
          <p className={ETIQUETA}>Tiro de campo · todo el arco</p>
          <div className="mt-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end lg:gap-12">
            <div>
              <p className="cifra font-titulo text-8xl leading-[.85] font-bold tracking-tight">
                {total.pct}
                <span className="text-5xl text-gris">%</span>
              </p>
              <p className="mt-2 font-mono text-sm text-gris">{total.anotados}/{total.intentos} tiros</p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <VariacionTexto variacion={totalVariacion} vacio="Primera batería: todavía no hay con qué comparar" grande />
                {metas && <span className="text-gris">{metas.alcanzadas} de {metas.conMeta} {PLURAL(metas.conMeta, 'zona llegó', 'zonas llegó')} a su meta</span>}
              </p>
            </div>
            {serie.length > 0 && (
              <a
                href={APP_ANTERIOR}
                aria-label="Ver la evolución completa en Datos"
                className="group mt-4 block rounded-campo outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta lg:mt-0"
              >
                <CurvaArco serie={serie} />
                <span className="flex items-center justify-between gap-2 font-mono text-xs text-gris">
                  <span>
                    {serie.length === 1
                      ? `Una sola batería: ${fechaCorta(serie[0].fecha)} · ${serie[0].valor.anotados}/${serie[0].valor.intentos}`
                      : `${serie.length} baterías · primera ${serie[0].valor.pct}% (${serie[0].valor.anotados}/${serie[0].valor.intentos}) · última ${serie[serie.length - 1].valor.pct}% (${serie[serie.length - 1].valor.anotados}/${serie[serie.length - 1].valor.intentos})`}
                  </span>
                  <span className="shrink-0 font-semibold text-tinta underline decoration-linea underline-offset-4 [@media(hover:hover)]:group-hover:decoration-tinta">
                    Ver todo ›
                  </span>
                </span>
              </a>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <Panel
          titulo="Por zona"
          accion={resumen.fechaAnterior ? <span className="font-mono text-xs text-gris">vs {fechaCorta(resumen.fechaAnterior)}</span> : undefined}
        >
          <CanchaCalor zonas={zonas} />
          <Leyenda />
          <div className="mt-4 border-t border-linea pt-3 text-sm">
            {foco === null ? (
              <p>Todavía no hay suficientes zonas medidas como para señalar una más floja.</p>
            ) : foco.concluyente ? (
              <p>
                Zona más floja: <b>{foco.zonas[0].nombre}</b>, <Porcentaje valor={foco.zonas[0].valor} />.
              </p>
            ) : (
              <p>
                Zonas más flojas: <b>{foco.zonas.map((z) => z.nombre).join(' · ')}</b> — empatadas dentro del margen de error, el dato no alcanza para elegir una.
              </p>
            )}
            {porDebajo && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span>
                  {porDebajo.cantidad} de {porDebajo.total} {PLURAL(porDebajo.cantidad, 'está', 'están')} por debajo de la meta del cuerpo técnico.
                </span>
                <button type="button" className={ENLACE_BOTON} onClick={() => setVerQuienes(true)}>Ver quiénes</button>
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel titulo="Cada zona">
            <ul aria-label="Zonas del arco" className="flex flex-col divide-y divide-linea">
              {zonas.map((z) => (
                <li key={z.id} className="py-3 first:pt-0 last:pb-0">
                  <FilaDeZona zona={z} />
                </li>
              ))}
            </ul>
          </Panel>

          {/* Los tiros libres son otro tiro con otro porcentaje: van aparte, nunca mezclados con el arco. */}
          <Panel titulo="Tiros libres">
            <FilaDeZona zona={libres} />
          </Panel>
        </div>
      </div>

      {corporal && (
        <Panel titulo="Altura y peso">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gris">
              {corporal.ultimaFecha ? `Última medición del plantel: ${fechaCorta(corporal.ultimaFecha)}.` : 'Todavía no hay ninguna medición cargada.'}
              {corporal.sinMedir > 0 &&
                ` ${corporal.sinMedir} de ${corporal.total} ${PLURAL(corporal.total, 'jugador no tiene', 'jugadores no tienen')} ninguna.`}
            </p>
            <Link to={`/plantel/${plantelId}`} className={cn(ENLACE_BOTON, 'self-start sm:self-auto')}>Ver el plantel</Link>
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={APP_ANTERIOR} className={ENLACE_LINEA}>Cargar otra medición</a>
        <a href={APP_ANTERIOR} className={ENLACE_LINEA}>{hayMetas ? 'Editar las metas' : 'Fijar las metas'}</a>
      </div>

      {porDebajo && (
        <QuienesPorDebajo abierta={verQuienes} alCambiar={setVerQuienes} zona={porDebajo.zona} jugadores={porDebajo.jugadores} />
      )}
    </>
  );
}

function Leyenda() {
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[0.6875rem] text-gris">
      <span>Más floja</span>
      <span aria-hidden className="flex overflow-hidden rounded-chip border border-linea">
        {[4, 3, 2, 1, 0].map((n) => (
          <span key={n} className="h-3 w-6" style={{ background: `var(--calor-${n})` }} />
        ))}
      </span>
      <span>Mejor</span>
    </div>
  );
}

function Porcentaje({ valor }: { valor: Valor | null }) {
  if (!valor) return <span className="text-gris">sin datos</span>;
  return (
    <>
      <span className={valor.muestraChica ? 'text-gris' : undefined}>{valor.pct}% · {valor.anotados}/{valor.intentos}</span>
      {valor.muestraChica && <PocosDatos />}
    </>
  );
}

const PocosDatos = () => <span className="ml-1.5 rounded-chip bg-sup-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-gris">pocos datos</span>;

/** Solo lleva flecha y color cuando supera el margen de error: la flecha es la señal, no el color. */
function VariacionTexto({ variacion, vacio, grande }: { variacion: Variacion | null; vacio?: string; grande?: boolean }) {
  if (variacion === null) return vacio ? <span className="text-gris">{vacio}</span> : null;
  const texto = `${variacion.pp > 0 ? '+' : ''}${variacion.pp}`;
  if (!variacion.concluyente) {
    return <span className="text-gris" title="La diferencia no supera el margen de error">{texto} pp · sin diferencia clara</span>;
  }
  const sube = variacion.pp > 0;
  return (
    <span className={cn('font-semibold', sube ? 'text-sube' : 'text-baja', grande && ['rounded-[0.3125rem] px-2 py-0.5', sube ? 'bg-sube-fondo' : 'bg-baja-fondo'])}>
      {sube ? '▲' : '▼'} {texto} pp
    </span>
  );
}

/** La barra va siempre en escala 0-100: una escala que cambia entre filas hace parecer iguales dos números distintos. */
function FilaDeZona({ zona }: { zona: Zona }) {
  const pct = zona.valor?.pct ?? null;
  const llego = zona.llegoALaMeta === true;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-titulo text-lg font-semibold">{zona.nombre}</span>
        <span className="font-mono text-sm text-gris">{zona.valor ? `${zona.valor.anotados}/${zona.valor.intentos}` : 'sin medir'}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-2.5 flex-1 rounded-chip bg-sup-2">
          {pct !== null && (
            // Un solo color para todas (el calor ya está en la cancha): con el del calor, la mejor zona quedaba casi invisible.
            <div className={cn('h-full rounded-chip', llego ? 'bg-sube' : 'bg-caramelo')} style={{ width: `${pct}%` }} />
          )}
          {zona.meta !== null && (
            <div className="absolute -top-1 h-[1.125rem] w-0.5 bg-tinta" style={{ left: `${zona.meta}%` }} title={`Meta del cuerpo técnico: ${zona.meta}%`} />
          )}
        </div>
        <span className="cifra w-12 text-right font-titulo text-xl leading-none font-bold">{pct === null ? '—' : `${pct}%`}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <a
          href={APP_ANTERIOR}
          aria-label={`Mandar un recurso para ${zona.nombre}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-club-texto underline decoration-1 underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
        >
          Mandar un recurso
        </a>
        {zona.meta !== null && (
          <span className={llego ? 'font-semibold text-sube' : 'text-gris'}>{llego ? '✓ llegó a la meta' : `meta ${zona.meta}%`}</span>
        )}
        {zona.valor?.muestraChica && <PocosDatos />}
        <VariacionTexto variacion={zona.variacion} />
      </div>
    </div>
  );
}

function QuienesPorDebajo({
  abierta,
  alCambiar,
  zona,
  jugadores,
}: {
  abierta: boolean;
  alCambiar: (a: boolean) => void;
  zona: Zona;
  jugadores: { id: string; nombre: string; valor: Valor }[];
}) {
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo={zona.nombre} descripcion="Jugadores por debajo de la meta del cuerpo técnico en esta zona.">
      <div className="flex flex-col gap-3 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold">{zona.nombre}</h2>
        <p className="text-sm text-gris">
          Meta del cuerpo técnico para esta zona: {zona.meta}%. Cada uno con sus intentos: la diferencia entre 2 de 10 y 4 de 10 no significa nada.
        </p>
        <ul className="flex flex-col divide-y divide-linea">
          {jugadores.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>{j.nombre}</span>
              <span className="font-mono text-sm">{j.valor.pct}% · {j.valor.anotados}/{j.valor.intentos}</span>
            </li>
          ))}
        </ul>
      </div>
    </Hoja>
  );
}

/** Las misiones del partido: la tarjeta de lo que toca hacer ahora. Es un agregado: si no carga, no se dibuja. */
function Misiones({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const q = useMisionesDeHoy(clubId, plantelId);
  if (!q.data) return null;
  const { previas, partidos } = q.data as { previas: PreviaDelPlantel[]; partidos: PartidoDelPlantel[] };
  const vinculos = vincularPrevias(
    previas,
    partidos.map((p) => ({ id: p.id, fecha: p.fecha, rivalNombre: p.rivalNombre, plantelId })),
  );
  const { paso, previa } = siguientePasoDeMisiones(previas, vinculos) as { paso: 'armar' | 'esperar' | 'evaluar'; previa: PreviaDelPlantel | null };
  const nombre = previa ? `${previa.rival ?? 'Rival sin nombre'} · ${previa.fecha.split('-').reverse().slice(0, 2).join('/')}/${previa.fecha.slice(2, 4)}` : '';
  const textos: Record<typeof paso, { titulo: string; detalle: ReactNode }> = {
    evaluar: { titulo: 'Evaluá cómo salió', detalle: nombre },
    esperar: { titulo: 'Misiones armadas', detalle: `${nombre}. Cuando cargues el partido, las evaluás desde acá.` },
    armar: { titulo: 'Armá las misiones del próximo partido', detalle: 'Un aporte concreto para cada chico y un objetivo para el equipo.' },
  };
  return (
    <Panel titulo="Misiones del partido">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href={APP_ANTERIOR} className="group block min-w-0 rounded-campo outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
          <span className="flex items-baseline gap-2 font-titulo text-2xl leading-tight font-semibold">
            <span>{textos[paso].titulo}</span>
            <span aria-hidden className="text-club-texto transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] [@media(hover:hover)]:group-hover:translate-x-1">
              ›
            </span>
          </span>
          <span className="block text-sm text-gris">{textos[paso].detalle}</span>
        </a>
        {paso !== 'armar' && <a href={APP_ANTERIOR} className={cn(ENLACE_BOTON, 'self-start sm:self-auto')}>Armar otras misiones</a>}
      </div>
    </Panel>
  );
}
