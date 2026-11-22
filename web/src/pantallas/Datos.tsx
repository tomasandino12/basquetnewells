import { Dumbbell, Gauge, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { evolucionDeTiroDelEquipo, repartoPorJugador, serieDeZonas } from '@datos/estadisticas.js';
import { cargasPorBloque } from '@datos/cargas.js';
import { formatearKg } from '@datos/escalones.js';
import { hoyLocal } from '@datos/antropometria.js';
import { POSICIONES_BATERIA } from '@datos/posiciones.js';
import { nombreCorto } from '@ui/nav.js';
import { Barras } from '../components/ui/barras';
import { claseBoton, Flecha } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Panel } from '../components/ui/card';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { GraficoComparado } from '../components/ui/grafico-comparado';
import { Radar } from '../components/ui/radar';
import { cn } from '../lib/cn';
import type { EstadoAsistencia, PartidoDelPlantel } from '../datos/repositorio';
import { asistenciaPorChico, asistenciaPorDia, grillaDeAsistencia } from '../estadisticas/asistencia';
import {
  useAsistenciaDelPlantel, useBateriasDeTiro, useCargasDelPlantel, useEquipoEnPartidos, usePartidosDelPlantel, usePruebasDelPlantel,
} from '../estadisticas/consultas';
import {
  chicos, fechaConAnio, fechaDiaMes, lecturaDeReparto, minutosLegibles, signoDePorcentaje, type BloqueDePrueba,
} from '../estadisticas/formatos';
import { alinear } from '../estadisticas/series';
import { RUTA_CARGAR_PARTIDO } from '../importar/rutas';
import { ConCategoria, MarcoDelPlantel } from './PlantelDelClub';

const SECCION = 'mb-3 font-titulo text-3xl leading-none font-semibold uppercase';
const NOTA = 'mb-3 text-sm text-gris';
// grid-cols-1 es minmax(0, 1fr): sin columnas declaradas la pista es «auto» y la estira lo más ancho de adentro
// (la tabla de 12 entrenamientos), y en el celular la pantalla entera se corría para el costado.
const GRILLA = 'grid grid-cols-1 gap-4 lg:grid-cols-2';
const DESPLEGABLE = 'inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4';

/**
 * Colores de las líneas: de la paleta del club y legibles en claro y en oscuro. Siempre en el mismo
 * orden, así una zona tiene el mismo color en el gráfico de líneas y en el polígono.
 */
const COLORES = ['var(--club-texto)', 'var(--test-salto-t)', 'var(--tinta)', 'var(--test-yoyo-t)', 'var(--sube)', 'var(--test-sprint-t)'];

/** Estadísticas del plantel: partidos y reparto, tiro (partidos y baterías), asistencia y físico (cargas y pruebas). */
export function Datos() {
  return (
    <MarcoDelPlantel>
      <ConCategoria>{(a) => <ContenidoDeDatos key={a.plantelId} clubId={a.clubId} plantelId={a.plantelId} categoria={a.categoria} />}</ConCategoria>
    </MarcoDelPlantel>
  );
}

interface Props {
  clubId: string;
  plantelId: string;
  categoria: string;
}

export function ContenidoDeDatos({ clubId, plantelId, categoria }: Props) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide text-gris uppercase">Datos</p>
          <h1 className="font-titulo text-5xl leading-none font-bold tracking-tight lg:text-6xl">{categoria}</h1>
        </div>
        <Link to={RUTA_CARGAR_PARTIDO} className={claseBoton()}>
          Cargar partido
          <Flecha />
        </Link>
      </header>

      <section aria-labelledby="datos-partidos" className="mb-8">
        <h2 id="datos-partidos" className={SECCION}>Partidos</h2>
        <Partidos clubId={clubId} plantelId={plantelId} categoria={categoria} />
      </section>

      <section aria-labelledby="datos-tiro" className="mb-8">
        <h2 id="datos-tiro" className={SECCION}>Tiro</h2>
        <div className={GRILLA}>
          <TiroDelEquipo clubId={clubId} plantelId={plantelId} />
          <TiroPorZona clubId={clubId} plantelId={plantelId} />
        </div>
      </section>

      <section aria-labelledby="datos-asistencia" className="mb-8">
        <h2 id="datos-asistencia" className={SECCION}>Asistencia</h2>
        <Asistencia clubId={clubId} plantelId={plantelId} />
      </section>

      <section aria-labelledby="datos-fisico" className="mb-8">
        <h2 id="datos-fisico" className={SECCION}>Físico</h2>
        <div className={GRILLA}>
          <Cargas clubId={clubId} plantelId={plantelId} />
          <Pruebas clubId={clubId} plantelId={plantelId} />
        </div>
      </section>
    </>
  );
}

/* ---------- Partidos y reparto ---------- */

function FilaDePartido({ p }: { p: PartidoDelPlantel }) {
  const ganado = p.puntosPropios != null && p.puntosRival != null && p.puntosPropios > p.puntosRival;
  return (
    <li className="flex items-center gap-3 rounded-tarjeta bg-sup-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.rivalNombre ?? 'Rival sin nombre'}</p>
        <p className="text-sm text-gris">
          {fechaConAnio(p.fecha)} · {p.condicionPropia === 'local' ? 'Local' : 'Visitante'}
        </p>
      </div>
      <Chip tono={ganado ? 'activo' : 'suave'} className="cifra font-mono text-sm">
        {p.puntosPropios ?? '-'}–{p.puntosRival ?? '-'}
        {ganado && <span className="sr-only"> (ganado)</span>}
      </Chip>
    </li>
  );
}

function Partidos({ clubId, plantelId, categoria }: Props) {
  const partidos = usePartidosDelPlantel(clubId, plantelId);
  return (
    <Consulta consulta={partidos} errorGenerico="No se pudieron cargar los partidos">
      {(lista) =>
        lista.length === 0 ? (
          <Vacio
            icono={Trophy}
            titulo="Todavía no cargaste partidos"
            accion={<Link to={RUTA_CARGAR_PARTIDO} className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Cargar partido</Link>}
          >
            Cargá la planilla .xlsx que exporta la app de la CABB y los datos del partido quedan guardados, con las estadísticas de cada jugador.
          </Vacio>
        ) : (
          <div className={GRILLA}>
            <Panel titulo={`Partidos de ${categoria}`}>
              <ul aria-label="Partidos cargados" className="flex flex-col gap-2">
                {lista.map((p) => <FilaDePartido key={p.id} p={p} />)}
              </ul>
            </Panel>
            <Reparto clubId={clubId} plantelId={plantelId} />
          </div>
        )
      }
    </Consulta>
  );
}

function Reparto({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const equipo = useEquipoEnPartidos(clubId, plantelId);
  return (
    <Consulta consulta={equipo} errorGenerico="No se pudieron cargar las estadísticas del equipo">
      {({ estadisticas, jugadores }) => {
        if (estadisticas.length === 0) {
          return (
            <Panel titulo="Reparto del equipo">
              <p className="text-sm text-gris">Cuando cargues un partido va a aparecer acá cuánto juega y cuánto anota cada uno.</p>
            </Panel>
          );
        }
        const nombre = new Map(jugadores.map((j) => [j.id, j.nombreLimpio]));
        const etiqueta = (id: string) => (nombre.has(id) ? (nombreCorto(nombre.get(id)) as string) : 'Otra categoría');
        const minutos = repartoPorJugador(estadisticas, 'minSegundos');
        const puntos = repartoPorJugador(estadisticas, 'pts');
        return (
          <div className="flex flex-col gap-4">
            <Panel titulo="Reparto de minutos">
              <p className={NOTA}>{lecturaDeReparto(minutos.jugadoresQueConcentranLaMitad, 'los minutos')}</p>
              <Barras
                etiquetaDeLista="Minutos por jugador"
                filas={minutos.filas.map((f: { jugadorId: string; valor: number }) => ({ etiqueta: etiqueta(f.jugadorId), valor: f.valor }))}
                formato={minutosLegibles}
              />
            </Panel>
            <Panel titulo="Reparto de puntos">
              <p className={NOTA}>{lecturaDeReparto(puntos.jugadoresQueConcentranLaMitad, 'los puntos')}</p>
              <Barras
                etiquetaDeLista="Puntos por jugador"
                filas={puntos.filas.map((f: { jugadorId: string; valor: number }) => ({ etiqueta: etiqueta(f.jugadorId), valor: f.valor }))}
                formato={String}
              />
            </Panel>
          </div>
        );
      }}
    </Consulta>
  );
}

/* ---------- Tiro ---------- */

interface Porcentaje {
  pct: number;
  anotados: number;
  intentos: number;
  muestraChica: boolean;
}

/** Un porcentaje siempre con sus intentos al lado: ninguno va sin su denominador. */
function TextoDePorcentaje({ p }: { p: Porcentaje | null }) {
  if (p == null) return <span className="text-gris">sin datos</span>;
  return (
    <span className={cn(p.muestraChica && 'text-gris')}>
      {p.pct}% · {p.anotados}/{p.intentos}
      {p.muestraChica && <span className="ml-1 text-xs">(pocos datos)</span>}
    </span>
  );
}

function TiroDelEquipo({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const equipo = useEquipoEnPartidos(clubId, plantelId);
  return (
    <Consulta consulta={equipo} errorGenerico="No se pudo cargar el tiro del equipo">
      {({ estadisticas, partidos }) => {
        const titulo = 'Tiro del equipo, partido a partido';
        if (partidos.length === 0) {
          return (
            <Panel titulo={titulo}>
              <p className="text-sm text-gris">Cuando cargues un partido va a aparecer acá cómo tiró el equipo en cada uno.</p>
            </Panel>
          );
        }
        const evolucion = evolucionDeTiroDelEquipo(partidos, estadisticas) as {
          fecha: string; dos: Porcentaje | null; tres: Porcentaje | null; libres: Porcentaje | null;
        }[];
        const serie = (id: string, nombre: string, color: string, de: (e: (typeof evolucion)[number]) => Porcentaje | null, punteada = false) => ({
          id, nombre, color, punteada,
          valores: evolucion.map((e) => de(e)?.pct ?? null),
          huecos: evolucion.map((e) => de(e)?.muestraChica ?? false),
        });
        return (
          <Panel titulo={titulo}>
            <p className={NOTA}>Prendé o apagá cada tiro para compararlos. Tocá un partido para ver sus números.</p>
            <GraficoComparado
              porcentaje
              etiquetaDeBotones="Qué tiros se ven"
              fechas={evolucion.map((e) => e.fecha)}
              descripcion={`Porcentaje de tiro del equipo en ${evolucion.length} partidos: dobles, triples y libres`}
              series={[
                serie('dos', 'Dobles', COLORES[0], (e) => e.dos),
                serie('tres', 'Triples', COLORES[2], (e) => e.tres),
                serie('libres', 'Libres', COLORES[1], (e) => e.libres, true),
              ]}
            />
            <details className="mt-3">
              <summary className={DESPLEGABLE}>Ver los números</summary>
              <ul aria-label="Tiro por partido" className="mt-2 flex flex-col gap-1.5">
                {[...evolucion].reverse().map((e) => (
                  <li key={e.fecha} className="grid grid-cols-[3rem_1fr] gap-x-3 rounded-tarjeta bg-sup-2 px-3 py-2 text-sm sm:grid-cols-[3rem_repeat(3,1fr)]">
                    <span className="font-mono text-gris">{fechaDiaMes(e.fecha)}</span>
                    <span>2P <TextoDePorcentaje p={e.dos} /></span>
                    <span className="col-start-2 sm:col-start-auto">3P <TextoDePorcentaje p={e.tres} /></span>
                    <span className="col-start-2 sm:col-start-auto">TL <TextoDePorcentaje p={e.libres} /></span>
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        );
      }}
    </Consulta>
  );
}

type Zona = { id: string; nombre: string; corto: string };

/**
 * Todas las zonas del arco y los libres en un mismo gráfico, cada una con su botón, y el polígono de la
 * primera batería contra la última: dónde se agrandó la figura. Une los puntos observados y nada más;
 * un punto con pocos intentos va hueco.
 */
function TiroPorZona({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const baterias = useBateriasDeTiro(clubId, plantelId);
  return (
    <Consulta consulta={baterias} errorGenerico="No se pudieron cargar las mediciones de tiro">
      {({ sesiones, mediciones }) => {
        const todas = (POSICIONES_BATERIA as Zona[]).map((z, i) => ({
          zona: z,
          color: COLORES[i % COLORES.length],
          puntos: serieDeZonas(sesiones, mediciones, [z.id]) as { fecha: string; valor: Porcentaje }[],
        }));
        const series = todas.filter((s) => s.puntos.length > 0);
        if (series.length === 0) {
          return (
            <Panel titulo="Tiro por zona">
              <p className="text-sm text-gris">
                Todavía no hay ninguna batería cargada. Con la primera vas a ver el punto de partida de cada zona; con la segunda empieza a haber serie.
              </p>
            </Panel>
          );
        }
        const { fechas, valores } = alinear(series);
        // Las puntas del polígono como en la cancha: frontal arriba, los 45° a los costados, las esquinas abajo y los libres al pie.
        const EN_LA_CANCHA = ['frontal', 'c45_der', 'esq_der', 'libres', 'esq_izq', 'c45_izq'];
        const puntas = [...todas].sort((a, b) => EN_LA_CANCHA.indexOf(a.zona.id) - EN_LA_CANCHA.indexOf(b.zona.id));
        const primera = fechas[0];
        const ultima = fechas[fechas.length - 1];
        const valorEn = (s: (typeof todas)[number], fecha: string) => s.puntos.find((p) => p.fecha === fecha)?.valor.pct ?? null;
        return (
          <>
            <Panel titulo="Perfil de tiro">
              <p className={NOTA}>
                {fechas.length > 1
                  ? `Cada punta es una zona. La figura de la primera batería (${fechaDiaMes(primera)}) contra la última (${fechaDiaMes(ultima)}): donde crece, mejoró el acierto.`
                  : `Cada punta es una zona: el punto de partida de la batería del ${fechaDiaMes(primera)}. Con la próxima se ve cuánto cambió.`}
              </p>
              <Radar
                ejes={puntas.map((s) => ({ id: s.zona.id, corto: s.zona.corto }))}
                etiquetaDeBotones="Qué baterías se ven"
                descripcion={`Acierto por zona en la última batería. ${puntas.map((s) => `${s.zona.nombre}: ${valorEn(s, ultima) === null ? 'sin dato' : `${valorEn(s, ultima)}%`}`).join(', ')}`}
                capas={[
                  ...(fechas.length > 1
                    ? [{ id: 'primera', nombre: `Primera · ${fechaDiaMes(primera)}`, color: 'var(--gris)', punteada: true, valores: puntas.map((s) => valorEn(s, primera)) }]
                    : []),
                  { id: 'ultima', nombre: `Última · ${fechaDiaMes(ultima)}`, color: 'var(--club-texto)', valores: puntas.map((s) => valorEn(s, ultima)) },
                ]}
              />
            </Panel>

            <Panel titulo="Tiro por zona" className="lg:col-span-2">
              <p className={NOTA}>Un punto por batería; los que tienen pocos intentos van huecos. Apagá zonas para comparar de a dos.</p>
              <GraficoComparado
                porcentaje
                etiquetaDeBotones="Qué zonas se ven"
                fechas={fechas}
                inicial={series.length > 3 ? series.slice(0, 2).map((s) => s.zona.id).concat(series[series.length - 1].zona.id) : undefined}
                descripcion={series.map((s) => `${s.zona.nombre}: ${s.puntos.map((p) => `${fechaDiaMes(p.fecha)} ${p.valor.pct}%`).join(', ')}`).join('. ')}
                series={series.map((s, i) => ({
                  id: s.zona.id,
                  nombre: s.zona.nombre,
                  color: s.color,
                  punteada: s.zona.id === 'libres',
                  valores: valores[i].map((v) => v?.pct ?? null),
                  huecos: valores[i].map((v) => v?.muestraChica ?? false),
                }))}
              />
              <details className="mt-3">
                <summary className={DESPLEGABLE}>Los números de cada zona</summary>
                <ul aria-label="Curvas de tiro por zona" className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {series.map((s) => (
                    <li key={s.zona.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="flex items-center gap-1.5 font-semibold">
                          <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
                          {s.zona.nombre}
                        </h3>
                        <span className="text-sm text-gris">{s.puntos.length} {s.puntos.length === 1 ? 'batería' : 'baterías'}</span>
                      </div>
                      <ul aria-label={`${s.zona.nombre}, por batería`} className="mt-1 flex flex-col gap-1.5">
                        {[...s.puntos].reverse().map((p) => (
                          <li key={p.fecha} className="flex justify-between gap-3 rounded-tarjeta bg-sup-2 px-3 py-2 text-sm">
                            <span className="font-mono text-gris">{fechaDiaMes(p.fecha)}</span>
                            <TextoDePorcentaje p={p.valor} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            </Panel>
          </>
        );
      }}
    </Consulta>
  );
}

/* ---------- Asistencia ---------- */

const CUANTOS_DIAS = 12;

const CELDA: Record<EstadoAsistencia, { clase: string; texto: string }> = {
  presente: { clase: 'bg-club', texto: 'vino' },
  justificada: { clase: 'bg-ambar', texto: 'avisó' },
  ausente: { clase: 'border border-borde-control bg-transparent', texto: 'faltó' },
};

function Asistencia({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const consulta = useAsistenciaDelPlantel(clubId, plantelId, hoyLocal() as string);
  return (
    <Consulta consulta={consulta} errorGenerico="No se pudo cargar la asistencia">
      {({ entrenamientos, jugadores }) => {
        const porDia = asistenciaPorDia(entrenamientos);
        if (porDia.length === 0) {
          return (
            <Panel titulo="Asistencia">
              <p className="text-sm text-gris">Todavía no hay asistencia tomada. Se toma desde Plantel, y acá aparece cómo viene el grupo y cada chico.</p>
            </Panel>
          );
        }
        const nombre = new Map(jugadores.map((j) => [j.id, nombreCorto(j.nombreLimpio) as string]));
        const porChico = asistenciaPorChico(entrenamientos, jugadores.map((j) => j.id));
        const grilla = grillaDeAsistencia(entrenamientos, porChico.map((c) => c.jugadorId), CUANTOS_DIAS);
        const promedio = Math.round(porDia.reduce((t, d) => t + d.pct, 0) / porDia.length);
        const recientes = porDia.slice(-24);
        const ultimo = porDia[porDia.length - 1];
        return (
          <div className={GRILLA}>
            <Panel titulo="Cuántos vinieron">
              <dl className="mb-3 grid grid-cols-3 gap-2">
                <Cifra etiqueta="Promedio" valor={`${promedio}%`} />
                <Cifra etiqueta="Entrenamientos" valor={String(porDia.length)} />
                <Cifra etiqueta="Último" valor={`${ultimo.presentes}/${ultimo.marcados}`} />
              </dl>
              <GraficoComparado
                porcentaje
                fechas={recientes.map((d) => d.fecha)}
                descripcion={`Asistencia por entrenamiento: ${recientes.map((d) => `${fechaDiaMes(d.fecha)} ${d.presentes} de ${d.marcados}`).join(', ')}`}
                series={[{ id: 'vinieron', nombre: 'Vinieron', color: 'var(--club-texto)', valores: recientes.map((d) => d.pct) }]}
              />
            </Panel>

            <Panel titulo={`Últimos ${grilla.fechas.length} entrenamientos`}>
              <p className={NOTA}>Una fila por chico, del que más viene al que menos. La racha es cuántos seguidos vino hasta el último.</p>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-1 text-sm">
                  <caption className="sr-only">Asistencia de cada chico en los últimos entrenamientos</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left font-normal text-gris"><span className="sr-only">Chico</span></th>
                      {grilla.fechas.map((f) => (
                        <th key={f} scope="col" className="px-0.5 font-mono text-[10px] font-normal text-gris">
                          <span aria-hidden>{f.slice(8, 10)}</span>
                          <span className="sr-only">{fechaDiaMes(f)}</span>
                        </th>
                      ))}
                      <th scope="col" className="pl-2 text-right font-mono text-[10px] font-normal text-gris uppercase">Total</th>
                      <th scope="col" className="pl-2 text-right font-mono text-[10px] font-normal text-gris uppercase">Racha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grilla.filas.map((fila) => {
                      const c = porChico.find((x) => x.jugadorId === fila.jugadorId)!;
                      return (
                        <tr key={fila.jugadorId}>
                          <th scope="row" className="max-w-[9rem] truncate pr-2 text-left font-normal">{nombre.get(fila.jugadorId)}</th>
                          {fila.estados.map((e, i) => (
                            <td key={i} className="px-0.5">
                              <span
                                className={cn('mx-auto block size-4 rounded-[4px]', e ? CELDA[e].clase : 'bg-sup-2')}
                                title={`${fechaDiaMes(grilla.fechas[i])}: ${e ? CELDA[e].texto : 'sin marcar'}`}
                              >
                                <span className="sr-only">{e ? CELDA[e].texto : 'sin marcar'}</span>
                              </span>
                            </td>
                          ))}
                          <td className="cifra pl-2 text-right font-mono">{c.pct}%</td>
                          <td className={cn('cifra pl-2 text-right font-mono', c.racha >= 4 && 'font-bold text-club-texto')}>{c.racha}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p aria-hidden className="mt-3 flex flex-wrap gap-4 text-xs text-gris">
                {(Object.keys(CELDA) as EstadoAsistencia[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span className={cn('inline-block size-3 rounded-[3px]', CELDA[k].clase)} />
                    {CELDA[k].texto}
                  </span>
                ))}
              </p>
            </Panel>
          </div>
        );
      }}
    </Consulta>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-tarjeta bg-sup-2 px-3 py-2">
      <dt className="font-mono text-[10px] tracking-wide text-gris uppercase">{etiqueta}</dt>
      <dd className="cifra font-titulo text-3xl leading-none font-bold">{valor}</dd>
    </div>
  );
}

/* ---------- Físico ---------- */

/** Cuánto subió cada chico desde su primer peso en cada ejercicio, promediado por bloque del plan. */
function Cargas({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const cargas = useCargasDelPlantel(clubId, plantelId);
  return (
    <Consulta consulta={cargas} errorGenerico="No se pudieron cargar las cargas de los ejercicios">
      {({ movimientos, ejercicios }) => {
        const bloques = cargasPorBloque(movimientos, ejercicios) as {
          bloque: string;
          pct: number;
          chicos: number;
          serie: { fecha: string; pct: number }[];
          ejercicios: { nombre: string; chicos: number; arranqueKg: number; actualKg: number }[];
        }[];
        if (bloques.length === 0) {
          return (
            <Panel titulo="Cargas de los ejercicios">
              <p className="text-sm text-gris">Todavía no hay pesos anotados. Aparecen cuando cargás un plan de fuerza o le ponés el peso a un chico en Físico.</p>
            </Panel>
          );
        }
        const { fechas, valores } = alinear(bloques.map((b) => ({ puntos: b.serie.map((p) => ({ fecha: p.fecha, valor: p.pct })) })));
        return (
          <Panel titulo="Cargas de los ejercicios">
            <p className={NOTA}>Cuánto subió cada chico desde su primer peso en cada ejercicio, promediado por bloque.</p>
            <GraficoComparado
              fechas={fechas}
              formato={signoDePorcentaje}
              etiquetaDeBotones="Qué bloques se ven"
              descripcion={bloques.map((b) => `${b.bloque}: ${signoDePorcentaje(b.pct)} desde el primer peso, ${chicos(b.chicos)}`).join('. ')}
              series={bloques.map((b, i) => ({ id: b.bloque, nombre: b.bloque, color: COLORES[i % COLORES.length], valores: valores[i] }))}
            />
            <ul aria-label="Cargas por bloque" className="mt-3 flex flex-col gap-3">
              {bloques.map((b) => (
                <li key={b.bloque}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="flex items-center gap-1.5 font-semibold"><Dumbbell aria-hidden className="size-4 text-gris" />{b.bloque}</h3>
                    <span className="text-sm text-gris">{signoDePorcentaje(b.pct)} · {chicos(b.chicos)}</span>
                  </div>
                  <details>
                    <summary className={DESPLEGABLE}>
                      {b.ejercicios.length} {b.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'} · kg promedio, del arranque a hoy
                    </summary>
                    <ul aria-label={`Ejercicios de ${b.bloque}`} className="flex flex-col gap-1.5">
                      {b.ejercicios.map((e) => (
                        <li key={e.nombre} className="rounded-tarjeta bg-sup-2 px-3 py-2 text-sm">
                          <p>{e.nombre}</p>
                          <p className="text-gris">{formatearKg(e.arranqueKg)} → {formatearKg(e.actualKg)} kg · {chicos(e.chicos)}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </Panel>
        );
      }}
    </Consulta>
  );
}

function BloqueDePruebaVista({ b, color }: { b: BloqueDePrueba; color: string }) {
  const ultimo = b.serie[b.serie.length - 1];
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-1.5 font-semibold"><Gauge aria-hidden className="size-4 text-gris" />{b.titulo}</h3>
        <span className="text-sm text-gris">{b.texto(ultimo.valor)} · {chicos(ultimo.chicos)}</span>
      </div>
      <p className="text-sm text-gris">{b.nota}</p>
      <GraficoComparado
        fechas={b.serie.map((p) => p.fecha)}
        formato={b.texto}
        descripcion={`${b.titulo}: último valor ${b.texto(ultimo.valor)}, ${chicos(ultimo.chicos)}`}
        series={[{ id: b.id, nombre: 'Promedio', color, valores: b.serie.map((p) => p.valor) }]}
      />
      <details>
        <summary className={DESPLEGABLE}>Por medición</summary>
        <ul aria-label={`${b.titulo}, por medición`} className="flex flex-col gap-1.5">
          {[...b.serie].reverse().map((p) => (
            <li key={p.fecha} className="grid grid-cols-[3rem_1fr_auto] gap-3 rounded-tarjeta bg-sup-2 px-3 py-2 text-sm">
              <span className="font-mono text-gris">{fechaDiaMes(p.fecha)}</span>
              <span>{b.texto(p.valor)}</span>
              <span className="text-gris">{chicos(p.chicos)}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

/** Cada prueba con el color de su test en Medir. */
const colorDePrueba = (id: string) => (id.startsWith('sprint') ? 'var(--test-sprint-t)' : id === 'yoyo' ? 'var(--test-yoyo-t)' : 'var(--test-salto-t)');

/** Velocidad, resistencia y salto: el promedio de los chicos que midieron cada día. Sólo aparecen las pruebas que el club ya cargó. */
function Pruebas({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const pruebas = usePruebasDelPlantel(clubId, plantelId);
  return (
    <Consulta consulta={pruebas} errorGenerico="No se pudieron cargar las mediciones de velocidad, resistencia y salto">
      {(bloques) =>
        bloques.length === 0 ? (
          <Panel titulo="Velocidad, resistencia y salto">
            <p className="text-sm text-gris">Todavía no hay nada medido. Las pruebas se cargan desde Medir y acá aparece cómo viene el grupo.</p>
          </Panel>
        ) : (
          <Panel titulo="Velocidad, resistencia y salto">
            <p className={NOTA}>Promedio de los chicos que midieron cada día. Cada punto dice cuántos fueron, porque no siempre son los mismos.</p>
            <ul aria-label="Pruebas físicas" className="flex flex-col gap-5">
              {bloques.map((b) => <BloqueDePruebaVista key={b.id} b={b} color={colorDePrueba(b.id)} />)}
            </ul>
          </Panel>
        )
      }
    </Consulta>
  );
}
