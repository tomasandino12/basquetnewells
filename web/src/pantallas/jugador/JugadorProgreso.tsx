import { LineChart } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import {
  compararPorcentajes, ejeComun, historialDePartidosDelJugador, serieDeTiroDelJugador, ultimaBateriaConDatosDeJugador,
} from '@datos/estadisticas.js';
import { formatearKg } from '@datos/escalones.js';
import { acumuladosDePartidos, bloquePorClaveDePlanes, insumosDeEstadisticas, pesosPorBloque, progresionDePesos } from '@datos/progresoDelJugador.js';
import { TESTS_SALTO, sesionesDeSalto } from '@datos/salto.js';
import { formatearTiempoSprint, DISTANCIAS_SPRINT, sesionesDeSprint, ultimaYAnterioresSprint, variacionSprint, velocidadMedia, vueltaSprint } from '@datos/sprint.js';
import { metrosDe, nivelYIda, sesionesDeYoyo, ultimaYAnterioresYoyo } from '@datos/yoyo.js';
import { Chip } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { useMiFicha, useMiProgreso } from '../../datos/consultasJugador';
import type { MiPlan, MiProgreso } from '../../datos/repositorio';
import { fechaCorta } from '../../fisico/plan';
import { ManoCaliente, rachaDeTiro } from '../../interacciones/ManoCaliente';
import { coma, Porcentaje, type Porc } from '../../jugador/porcentaje';

type Punto = { fecha: string; valor: Porc };
type Serie = { practica: Punto[]; partido: Punto[] };
type Bateria = { fecha: string; porPosicion: Record<string, Porc | null> };
type Partido = { partidoId: string; fecha: string; rivalNombre: string | null; minSegundos: number | null; pts: number | null; dos: Porc | null; tres: Porc | null; libres: Porc | null };
type Ejercicio = { clave: string; nombre: string; movimientos: { kg: number; fecha: string }[]; inicialKg: number; actualKg: number; variacionKg: number | null };
type GrupoDePesos = { bloque: string; ejercicios: Ejercicio[]; subieron: number };

const NOMBRE_POSICION: Record<string, string> = {
  libres: 'Tiros libres', esq_izq: 'Esquina izquierda', c45_izq: '45° izquierda', frontal: 'Frontal', c45_der: '45° derecha', esq_der: 'Esquina derecha',
};
const ORDEN_POSICIONES = ['esq_izq', 'c45_izq', 'frontal', 'c45_der', 'esq_der', 'libres'];
const NOMBRE_TEST_SALTO: Record<string, string> = { cmj: 'CMJ', abalakov: 'Abalakov' };

const Seccion = ({ titulo, derecha, children }: { titulo: string; derecha?: string; children: ReactNode }) => (
  <section aria-label={titulo} className="flex flex-col gap-3">
    <h2 className="flex items-baseline justify-between gap-3 font-titulo text-2xl leading-none font-semibold">
      {titulo}
      {derecha && <span className="font-mono text-xs font-normal text-gris">{derecha}</span>}
    </h2>
    {children}
  </section>
);

const Vacia = ({ children }: { children: ReactNode }) => <p className="text-sm text-gris">{children}</p>;

/**
 * Mi progreso: el jugador contra sí mismo. Sin ranking, sin promedio del plantel y sin nadie más en pantalla
 * (mi_progreso sólo le entrega lo suyo). Todo porcentaje lleva sus intentos y el aviso de «pocos datos»
 * cuando la muestra es chica.
 */
export function JugadorProgreso() {
  const progreso = useMiProgreso();
  const ficha = useMiFicha();
  return (
    <>
      <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Tu progreso</h1>
      <div className="mt-4">
        <Consulta consulta={progreso} errorGenerico="No se pudo cargar tu progreso">
          {({ progreso: p, plan }) => <Contenido progreso={p} plan={plan} jugadorId={ficha.data?.jugadorId ?? ''} />}
        </Consulta>
      </div>
    </>
  );
}

const estaVacio = (p: MiProgreso) => [p.partidos, p.tiro, p.saltos, p.sprints, p.yoyos, p.escalones].every((l) => l.length === 0);

function Contenido({ progreso, plan, jugadorId }: { progreso: MiProgreso; plan: MiPlan | null; jugadorId: string }) {
  const datos = useMemo(() => {
    const insumos = insumosDeEstadisticas(progreso, jugadorId);
    const bloques = bloquePorClaveDePlanes(plan?.planes);
    return {
      bateria: ultimaBateriaConDatosDeJugador(insumos.sesiones, insumos.medicionesTiro, jugadorId) as Bateria | null,
      series: serieDeTiroDelJugador(insumos) as { triples: Serie; libres: Serie },
      historial: historialDePartidosDelJugador(insumos.partidos, insumos.estadisticas, jugadorId) as Partido[],
      acumulados: acumuladosDePartidos(progreso.partidos) as ReturnType<typeof acumuladosDePartidos>,
      pesos: pesosPorBloque(progresionDePesos(progreso.escalones, bloques), bloques) as GrupoDePesos[],
    };
  }, [progreso, plan, jugadorId]);

  if (estaVacio(progreso)) {
    return (
      <Vacio icono={LineChart} titulo="Todavía no hay nada para mostrar">
        Cuando haya partidos, baterías de tiro, saltos, sprints, resistencia o pesos tuyos cargados, tu progreso aparece acá.
      </Vacio>
    );
  }
  return (
    <div className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
      <div className="flex flex-col gap-8">
        <TiroPorPosicion bateria={datos.bateria} />
        <SerieDeTiro titulo="Tiro de tres" serie={datos.series.triples} vacio="Todavía no hay datos de triples, ni de práctica ni de partido." />
        <SerieDeTiro titulo="Tiro libre" serie={datos.series.libres} vacio="Todavía no hay datos de libres, ni de práctica ni de partido." />
        <Partidos historial={datos.historial} acumulados={datos.acumulados} />
      </div>
      <div className="flex flex-col gap-8">
        <Salto saltos={progreso.saltos} />
        <Sprint sprints={progreso.sprints} />
        <Yoyo yoyos={progreso.yoyos} />
        <p className="text-xs text-gris">Valores estimados para orientar el entrenamiento; no reemplazan una evaluación médica.</p>
        <Pesos grupos={datos.pesos} />
      </div>
    </div>
  );
}

function TiroPorPosicion({ bateria }: { bateria: Bateria | null }) {
  if (!bateria) {
    return <Seccion titulo="Tiro por posición"><Vacia>Todavía no hiciste ninguna batería de tiro.</Vacia></Seccion>;
  }
  const claves = [...ORDEN_POSICIONES.filter((c) => c in bateria.porPosicion), ...Object.keys(bateria.porPosicion).filter((c) => !ORDEN_POSICIONES.includes(c))];
  return (
    <Seccion titulo="Tiro por posición" derecha={fechaCorta(bateria.fecha)}>
      <ul className="divide-y divide-linea rounded-tarjeta border border-linea bg-sup">
        {claves.map((c) => (
          <li key={c} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
            <span className="font-semibold">{NOMBRE_POSICION[c] ?? c}</span>
            <Porcentaje valor={bateria.porPosicion[c]} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-gris">Práctica: 10 tiros por posición. El partido no dice desde dónde se tiró, así que no se superpone acá.</p>
    </Seccion>
  );
}

/** El último punto de una fuente y la variación contra el anterior de la MISMA fuente. */
function ResumenDeFuente({ nombre, serie }: { nombre: string; serie: Punto[] }) {
  if (!serie.length) return null;
  const ultimo = serie[serie.length - 1];
  const anterior = serie.length >= 2 ? serie[serie.length - 2] : null;
  const cmp = anterior ? (compararPorcentajes(ultimo.valor, anterior.valor) as { pp: number; concluyente: boolean } | null) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-mono text-xs text-gris uppercase">{nombre} · {fechaCorta(ultimo.fecha)}</span>
      <Porcentaje valor={ultimo.valor} />
      {anterior && cmp ? (
        <span className="text-gris">
          {cmp.pp === 0 ? 'igual' : `${cmp.pp > 0 ? '+' : '−'}${Math.abs(cmp.pp)} pp`}
          {cmp.concluyente ? '' : ' (dentro del margen de error)'} vs {fechaCorta(anterior.fecha)}
        </span>
      ) : (
        <span className="text-gris">Una sola medición: todavía no hay con qué comparar</span>
      )}
    </li>
  );
}

function SerieDeTiro({ titulo, serie, vacio }: { titulo: string; serie: Serie; vacio: string }) {
  if (!serie.practica.length && !serie.partido.length) {
    return <Seccion titulo={titulo}><Vacia>{vacio}</Vacia></Seccion>;
  }
  const { fechas, a, b } = ejeComun(serie.practica, serie.partido) as { fechas: string[]; a: (Porc | null)[]; b: (Porc | null)[] };
  return (
    <Seccion titulo={titulo}>
      <ManoCaliente racha={rachaDeTiro(serie.practica)} que={titulo.toLowerCase()} />
      <Grafico fechas={fechas} practica={a.map((v) => v?.pct ?? null)} partido={b.map((v) => v?.pct ?? null)} etiqueta={`${titulo}: porcentaje por fecha, práctica y partido`} />
      <ul className="flex flex-col gap-1">
        <ResumenDeFuente nombre="Práctica" serie={serie.practica} />
        <ResumenDeFuente nombre="Partido" serie={serie.partido} />
      </ul>
    </Seccion>
  );
}

const ANCHO = 320;
const ALTO = 140;
const PAD = { i: 30, d: 10, a: 10, b: 22 };

/** Dos líneas (práctica en tinta, partido punteada en el rojo del club) de 0 a 100 %. Una fecha sin dato corta la línea, no cae a 0. */
function Grafico({ fechas, practica, partido, etiqueta }: { fechas: string[]; practica: (number | null)[]; partido: (number | null)[]; etiqueta: string }) {
  const x = (i: number) => PAD.i + (fechas.length === 1 ? (ANCHO - PAD.i - PAD.d) / 2 : (i * (ANCHO - PAD.i - PAD.d)) / (fechas.length - 1));
  const y = (v: number) => PAD.a + ((100 - v) / 100) * (ALTO - PAD.a - PAD.b);
  const trazos = (vals: (number | null)[]) => {
    const tramos: string[] = [];
    let actual: string[] = [];
    vals.forEach((v, i) => {
      if (v == null) {
        if (actual.length) tramos.push(actual.join(' '));
        actual = [];
      } else actual.push(`${actual.length ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    });
    if (actual.length) tramos.push(actual.join(' '));
    return tramos;
  };
  const serie = (vals: (number | null)[], color: string, punteado?: string) => (
    <>
      {trazos(vals).map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeDasharray={punteado} strokeLinejoin="round" />)}
      {vals.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} />))}
    </>
  );
  return (
    <div className="rounded-tarjeta border border-linea bg-sup p-2">
      <svg role="img" aria-label={etiqueta} viewBox={`0 0 ${ANCHO} ${ALTO}`} className="block h-auto w-full">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.i} x2={ANCHO - PAD.d} y1={y(v)} y2={y(v)} stroke="var(--linea)" strokeWidth={1} />
            <text x={PAD.i - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="var(--gris)">{v}%</text>
          </g>
        ))}
        {fechas.map((f, i) => (
          <text key={f} x={x(i)} y={ALTO - 6} textAnchor="middle" fontSize={9} fill="var(--gris)">{fechaCorta(f)}</text>
        ))}
        {serie(practica, 'var(--tinta)')}
        {serie(partido, 'var(--club-texto)', '5 4')}
      </svg>
      <p className="flex gap-4 px-2 pt-1 text-xs text-gris">
        <span>— Práctica</span>
        <span>- - Partido</span>
      </p>
    </div>
  );
}

function SinDato() {
  return <span className="text-gris">sin dato</span>;
}

function Partidos({ historial, acumulados: a }: { historial: Partido[]; acumulados: ReturnType<typeof acumuladosDePartidos> }) {
  if (!historial.length) {
    return <Seccion titulo="Partido a partido"><Vacia>Todavía no tenés ningún partido cargado.</Vacia></Seccion>;
  }
  const puntos = a.sinDato.puntos ? `${a.puntos.total} pts (${a.sinDato.puntos} sin dato)` : `${a.puntos.total} pts`;
  return (
    <Seccion titulo="Partido a partido">
      <div className="rounded-tarjeta border border-linea bg-sup px-4 py-3">
        <p className="font-semibold">Lo que llevás en la temporada</p>
        <p className="text-sm text-gris">
          {a.partidos} {a.partidos === 1 ? 'partido' : 'partidos'} · {puntos} · {a.minutos.total}′
        </p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          <dt className="text-gris">2P</dt><dd><Porcentaje valor={a.dos} /></dd>
          <dt className="text-gris">3P</dt><dd><Porcentaje valor={a.tres} /></dd>
          <dt className="text-gris">TL</dt><dd><Porcentaje valor={a.libres} /></dd>
        </dl>
      </div>
      <ul className="flex flex-col gap-2">
        {historial.map((h) => (
          <li key={h.partidoId} className="rounded-tarjeta border border-linea bg-sup px-4 py-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-semibold break-words">{h.rivalNombre ?? 'Rival sin nombre'}</span>
              <span className="font-mono text-xs text-gris">{fechaCorta(h.fecha)}</span>
            </p>
            <p className="text-sm text-gris">
              {h.minSegundos == null ? <SinDato /> : `${Math.round(h.minSegundos / 60)}′`} · {h.pts == null ? <SinDato /> : `${h.pts} pts`}
            </p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
              <dt className="text-gris">2P</dt><dd><Porcentaje valor={h.dos} /></dd>
              <dt className="text-gris">3P</dt><dd><Porcentaje valor={h.tres} /></dd>
              <dt className="text-gris">TL</dt><dd><Porcentaje valor={h.libres} /></dd>
            </dl>
          </li>
        ))}
      </ul>
    </Seccion>
  );
}

/** Altura del mejor intento de cada sesión, por test. Sin potencia (es un número para el cuerpo técnico) y sin gráfico: ±2 cm de error por cuadro. */
function Salto({ saltos }: { saltos: MiProgreso['saltos'] }) {
  const intentos = saltos.flatMap((s) => s.intentos.map((i) => ({ sesionId: s.sesionId, fecha: s.fecha, testSalto: s.test, intento: i.intento, tiempoVueloMs: i.tiempoVueloMs })));
  const sesiones = (sesionesDeSalto(intentos, null) as { fecha: string; testSalto: string; mejor: { alturaCm: number } | null }[]).filter((s) => s.mejor);
  if (!sesiones.length) return <Seccion titulo="Salto"><Vacia>Todavía no te midieron el salto.</Vacia></Seccion>;
  return (
    <Seccion titulo="Salto">
      {(TESTS_SALTO as string[]).map((test) => {
        const delTest = sesiones.filter((s) => s.testSalto === test);
        if (!delTest.length) return null;
        return (
          <div key={test}>
            <h3 className="mb-1 text-sm font-semibold">{NOMBRE_TEST_SALTO[test]}</h3>
            <ul className="divide-y divide-linea rounded-tarjeta border border-linea bg-sup">
              {delTest.map((s) => (
                <li key={s.fecha} className="flex justify-between px-4 py-2 text-sm">
                  <span className="font-mono text-xs text-gris">{fechaCorta(s.fecha)}</span>
                  <span className="font-semibold tabular-nums">{coma(s.mejor!.alturaCm.toFixed(1))} cm</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Seccion>
  );
}

type IntentoSprint = { tiempoMs: number; parcialMs: number | null };
type SesionSprint = { fecha: string; mejor: IntentoSprint; origen: string };

/** Una tarjeta por distancia con el mejor intento de la última sesión; bajar el tiempo es mejorar. Nunca se compara con otros. */
function Sprint({ sprints }: { sprints: MiProgreso['sprints'] }) {
  const intentos = sprints.flatMap((s) => s.intentos.map((i) => ({ sesionId: s.sesionId, fecha: s.fecha, distanciaM: s.distanciaM, intento: i.intento, tiempoMs: i.tiempoMs, parcialMs: i.parcialMs, origen: i.origen })));
  const sesiones = sesionesDeSprint(intentos) as unknown[];
  const bloques = [...(DISTANCIAS_SPRINT as number[])].reverse().map((d) => {
    const r = ultimaYAnterioresSprint(sesiones, d) as { ultima: SesionSprint; anteriores: SesionSprint[]; variacionMs: number | null } | null;
    return r ? { d, ...r } : null;
  }).filter((b): b is NonNullable<typeof b> => b !== null);
  if (!bloques.length) return <Seccion titulo="Sprint"><Vacia>Todavía no te midieron el sprint.</Vacia></Seccion>;
  return (
    <Seccion titulo="Sprint">
      {bloques.map(({ d, ultima, anteriores, variacionMs }) => {
        const v = variacionSprint(variacionMs) as { texto: string; mejora: boolean | null };
        return (
          <div key={d}>
            <h3 className="mb-1 text-sm font-semibold">{d} + {d} metros</h3>
            <div className="rounded-tarjeta border border-linea bg-sup px-4 py-3">
              <p className="font-mono text-xs text-gris">{fechaCorta(ultima.fecha)}</p>
              <p className="font-titulo text-4xl leading-none font-semibold tabular-nums">{coma((ultima.mejor.tiempoMs / 1000).toFixed(1))}<span className="text-xl"> s</span></p>
              <p className="text-xs text-gris">Mejor marca · ida y vuelta</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {ultima.mejor.parcialMs != null && (
                  <>
                    <span>Ida {formatearTiempoSprint(ultima.mejor.parcialMs)} · {coma(velocidadMedia(ultima.mejor.parcialMs, d) as number)} m/s</span>
                    <span>Vuelta {formatearTiempoSprint(vueltaSprint(ultima.mejor))}</span>
                  </>
                )}
                {v.texto && anteriores[0] && <Chip>{v.texto} vs {fechaCorta(anteriores[0].fecha)}</Chip>}
                {ultima.origen === 'crear' && <Chip>CReAR · más exacto</Chip>}
              </p>
            </div>
            {anteriores.length > 0 && (
              <ul className="mt-2 divide-y divide-linea rounded-tarjeta border border-linea bg-sup">
                {anteriores.map((s) => (
                  <li key={s.fecha} className="flex flex-wrap justify-between gap-x-3 px-4 py-2 text-sm">
                    <span className="font-mono text-xs text-gris">{fechaCorta(s.fecha)}</span>
                    <span>{formatearTiempoSprint(s.mejor.tiempoMs)}{s.origen === 'crear' && ' · CReAR'}</span>
                    <span className="text-gris">{s.mejor.parcialMs != null ? `ida ${formatearTiempoSprint(s.mejor.parcialMs)}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </Seccion>
  );
}

const miles = new Intl.NumberFormat('es-AR');
type SesionYoyo = { fecha: string; idas: number; origen: string };

/** Nivel.ida y metros de la última sesión; más metros es mejorar. Nunca se compara con otros. */
function Yoyo({ yoyos }: { yoyos: unknown[] }) {
  const r = ultimaYAnterioresYoyo(sesionesDeYoyo(yoyos)) as { ultima: SesionYoyo; anteriores: SesionYoyo[]; variacionM: number | null } | null;
  if (!r) return <Seccion titulo="Resistencia (Yo-Yo)"><Vacia>Todavía no te midieron la resistencia.</Vacia></Seccion>;
  const { ultima, anteriores, variacionM } = r;
  return (
    <Seccion titulo="Resistencia (Yo-Yo)">
      <div className="rounded-tarjeta border border-linea bg-sup px-4 py-3">
        <p className="font-mono text-xs text-gris">{fechaCorta(ultima.fecha)}</p>
        <p className="font-titulo text-4xl leading-none font-semibold tabular-nums">{nivelYIda(ultima.idas) as string}</p>
        <p className="text-xs text-gris">Nivel · ida</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{miles.format(metrosDe(ultima.idas) as number)} m en total</span>
          {variacionM != null && anteriores[0] && (
            <Chip>{variacionM === 0 ? 'igual' : `${variacionM > 0 ? '+' : '−'}${miles.format(Math.abs(variacionM))} m`} vs {fechaCorta(anteriores[0].fecha)}</Chip>
          )}
          {ultima.origen === 'crear' && <Chip>CReAR · más exacto</Chip>}
        </p>
      </div>
      {anteriores.length > 0 && (
        <ul className="divide-y divide-linea rounded-tarjeta border border-linea bg-sup">
          {anteriores.map((s) => (
            <li key={s.fecha} className="flex flex-wrap justify-between gap-x-3 px-4 py-2 text-sm">
              <span className="font-mono text-xs text-gris">{fechaCorta(s.fecha)}</span>
              <span>{nivelYIda(s.idas) as string}{s.origen === 'crear' && ' · CReAR'}</span>
              <span>{miles.format(metrosDe(s.idas) as number)} m</span>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

/** Los pesos por bloque, cada ejercicio con su recorrido del primer movimiento al último. */
function Pesos({ grupos }: { grupos: GrupoDePesos[] }) {
  if (!grupos.length) return <Seccion titulo="Tus pesos"><Vacia>Todavía no tenés pesos anotados.</Vacia></Seccion>;
  return (
    <Seccion titulo="Tus pesos">
      {grupos.map((g) => (
        <details key={g.bloque} className="rounded-tarjeta border border-linea bg-sup">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-semibold">
            <span>{g.bloque}</span>
            <span className="text-sm font-normal text-gris">
              {g.ejercicios.length} {g.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}
              {g.subieron > 0 && ` · ${g.subieron} ${g.subieron === 1 ? 'subió' : 'subieron'}`}
            </span>
          </summary>
          <ul className="divide-y divide-linea border-t border-linea">
            {g.ejercicios.map((e) => (
              <li key={e.clave} className="px-4 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold break-words">{e.nombre}</span>
                  <span className="font-titulo text-2xl leading-none font-semibold tabular-nums">{formatearKg(e.actualKg) as string} kg</span>
                </p>
                <p className="text-sm text-gris">
                  {e.variacionKg == null
                    ? 'Una sola marca: todavía no hay con qué comparar'
                    : e.variacionKg === 0
                      ? `Igual que al empezar (${formatearKg(e.inicialKg)} kg)`
                      : `${e.variacionKg > 0 ? '+' : '−'}${formatearKg(Math.abs(e.variacionKg))} kg desde los ${formatearKg(e.inicialKg)} kg del principio`}
                </p>
                {e.movimientos.length > 1 && (
                  <p className="mt-1 font-mono text-xs text-gris">
                    {e.movimientos.map((m) => `${fechaCorta(m.fecha)} ${formatearKg(m.kg)}`).join(' → ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </Seccion>
  );
}
