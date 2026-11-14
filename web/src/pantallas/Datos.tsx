import { Dumbbell, Gauge, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import { evolucionDeTiroDelEquipo, repartoPorJugador, serieDeZonas } from '@datos/estadisticas.js';
import { cargasPorBloque } from '@datos/cargas.js';
import { formatearKg } from '@datos/escalones.js';
import { POSICIONES_BATERIA } from '@datos/posiciones.js';
import { nombreCorto } from '@ui/nav.js';
import { Barras } from '../components/ui/barras';
import { claseBoton, Flecha } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Panel } from '../components/ui/card';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { GraficoDeSerie } from '../components/ui/grafico-serie';
import { GraficoEvolucion, type PuntoDeSerie } from '../coord/GraficoEvolucion';
import { cn } from '../lib/cn';
import type { PartidoDelPlantel } from '../datos/repositorio';
import {
  useBateriasDeTiro, useCargasDelPlantel, useEquipoEnPartidos, usePartidosDelPlantel, usePruebasDelPlantel,
} from '../estadisticas/consultas';
import {
  chicos, fechaConAnio, fechaDiaMes, lecturaDeReparto, minutosLegibles, signoDePorcentaje, type BloqueDePrueba,
} from '../estadisticas/formatos';
import { RUTA_CARGAR_PARTIDO } from '../importar/rutas';
import { ConCategoria, MarcoDelPlantel } from './PlantelDelClub';

const SECCION = 'mb-3 font-titulo text-3xl leading-none font-semibold uppercase';
const NOTA = 'mb-3 text-sm text-gris';
const GRILLA = 'grid gap-4 lg:grid-cols-2';

/** Estadísticas del plantel: partidos y reparto, tiro (partidos y baterías) y físico (cargas y pruebas). */
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

const punto = (p: Porcentaje | null): PuntoDeSerie => ({ pct: p?.pct ?? null, muestraChica: p?.muestraChica ?? false });

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
        return (
          <Panel titulo={titulo}>
            <GraficoEvolucion
              fechas={evolucion.map((e) => e.fecha)}
              descripcion={`Porcentaje de tiro del equipo en ${evolucion.length} partidos: dobles, triples y libres`}
              series={[
                { nombre: '2P', clase: 'text-club-texto', puntos: evolucion.map((e) => punto(e.dos)) },
                { nombre: '3P', clase: 'text-tinta', puntos: evolucion.map((e) => punto(e.tres)) },
                { nombre: 'TL', clase: 'text-gris', punteada: true, puntos: evolucion.map((e) => punto(e.libres)) },
              ]}
            />
            <details className="mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4">
                Ver los números
              </summary>
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

/**
 * Una curva por zona del arco más libres. Como toda curva del proyecto: une los puntos observados y
 * nada más. Sin tendencia, sin proyección y sin decir que algo mejora: eso lo lee el profe. Un punto
 * con pocos intentos va hueco.
 */
function TiroPorZona({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const baterias = useBateriasDeTiro(clubId, plantelId);
  return (
    <Consulta consulta={baterias} errorGenerico="No se pudieron cargar las mediciones de tiro">
      {({ sesiones, mediciones }) => {
        const series = (POSICIONES_BATERIA as { id: string; nombre: string }[])
          .map((z) => ({ zona: z, puntos: serieDeZonas(sesiones, mediciones, [z.id]) as { fecha: string; valor: Porcentaje }[] }))
          .filter((s) => s.puntos.length > 0);
        if (series.length === 0) {
          return (
            <Panel titulo="Tiro por zona">
              <p className="text-sm text-gris">
                Todavía no hay ninguna batería cargada. Con la primera vas a ver el punto de partida de cada zona; con la segunda empieza a haber serie.
              </p>
            </Panel>
          );
        }
        return (
          <Panel titulo="Tiro por zona">
            <p className={NOTA}>Un punto por batería. Los puntos con pocos intentos se dibujan huecos.</p>
            <ul aria-label="Curvas de tiro por zona" className="flex flex-col gap-4">
              {series.map((s) => (
                <li key={s.zona.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{s.zona.nombre}</h3>
                    <span className="text-sm text-gris">{s.puntos.length} {s.puntos.length === 1 ? 'batería' : 'baterías'}</span>
                  </div>
                  <GraficoEvolucion
                    fechas={s.puntos.map((p) => p.fecha)}
                    descripcion={`${s.zona.nombre}: ${s.puntos.map((p) => `${fechaDiaMes(p.fecha)} ${p.valor.pct}%`).join(', ')}`}
                    series={[{ nombre: '', clase: 'text-club-texto', puntos: s.puntos.map((p) => punto(p.valor)) }]}
                  />
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4">
                      Por batería
                    </summary>
                    <ul aria-label={`${s.zona.nombre}, por batería`} className="flex flex-col gap-1.5">
                      {[...s.puntos].reverse().map((p) => (
                        <li key={p.fecha} className="flex justify-between gap-3 rounded-tarjeta bg-sup-2 px-3 py-2 text-sm">
                          <span className="font-mono text-gris">{fechaDiaMes(p.fecha)}</span>
                          <TextoDePorcentaje p={p.valor} />
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
        return (
          <Panel titulo="Cargas de los ejercicios">
            <p className={NOTA}>Cuánto subió cada chico desde su primer peso en cada ejercicio, promediado por bloque.</p>
            <ul aria-label="Cargas por bloque" className="flex flex-col gap-4">
              {bloques.map((b) => (
                <li key={b.bloque}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="flex items-center gap-1.5 font-semibold"><Dumbbell aria-hidden className="size-4 text-gris" />{b.bloque}</h3>
                    <span className="text-sm text-gris">{signoDePorcentaje(b.pct)} · {chicos(b.chicos)}</span>
                  </div>
                  <GraficoDeSerie
                    fechas={b.serie.map((p) => p.fecha)}
                    valores={b.serie.map((p) => p.pct)}
                    formato={signoDePorcentaje}
                    descripcion={`${b.bloque}: ${signoDePorcentaje(b.pct)} desde el primer peso, ${chicos(b.chicos)}`}
                  />
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4">
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

function BloqueDePruebaVista({ b }: { b: BloqueDePrueba }) {
  const ultimo = b.serie[b.serie.length - 1];
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-1.5 font-semibold"><Gauge aria-hidden className="size-4 text-gris" />{b.titulo}</h3>
        <span className="text-sm text-gris">{b.texto(ultimo.valor)} · {chicos(ultimo.chicos)}</span>
      </div>
      <p className="text-sm text-gris">{b.nota}</p>
      <GraficoDeSerie
        fechas={b.serie.map((p) => p.fecha)}
        valores={b.serie.map((p) => p.valor)}
        formato={b.texto}
        descripcion={`${b.titulo}: último valor ${b.texto(ultimo.valor)}, ${chicos(ultimo.chicos)}`}
      />
      <details>
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4">
          Por medición
        </summary>
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
            <ul aria-label="Pruebas físicas" className="flex flex-col gap-4">
              {bloques.map((b) => <BloqueDePruebaVista key={b.id} b={b} />)}
            </ul>
          </Panel>
        )
      }
    </Consulta>
  );
}
