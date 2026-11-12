import { Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { textoDeAsistenciaDeCategoria } from '@datos/asistencia.js';
import { armarPanorama, hayAlgoParaMostrar, textoSinDatos } from '@datos/coordinacion.js';
import { conceptosDe, envioViejo, resumenPanorama } from '@datos/estadoInscripcion.js';
import { ejeComun } from '@datos/estadisticas.js';
import { logrosDelEquipo, textoDeMision } from '@datos/misiones.js';
import { Chip } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { useResumenDePapeles, usePanoramaDelClub } from '../../coord/consultas';
import { GraficoEvolucion } from '../../coord/GraficoEvolucion';
import { TITULO_DE_PANTALLA } from '../../coord/piezas';
import { cn } from '../../lib/cn';
import { useClubCoord } from './MarcoCoord';

interface Valor {
  pct: number;
  anotados: number;
  intentos: number;
  muestraChica: boolean;
}
interface Punto {
  fecha: string;
  valor: Valor;
  jugadoresQueMidieron?: number;
  rival?: string | null;
}
interface Fuente {
  serie: Punto[];
  variacion: { pp: number; margen: number; concluyente: boolean } | null;
}
interface Tarjeta {
  plantelId: string;
  categoria: string;
  nombreCategoria: string;
  jugadores: number;
  partidos: number;
  ultimaMedicion: string | null;
  aCargo: string[];
  triples: { bateria: Fuente; partido: Fuente };
  libres: { bateria: Fuente; partido: Fuente };
}

const TIPOS = [
  { clave: 'triples', titulo: 'Triples' },
  { clave: 'libres', titulo: 'Libres' },
] as const;

// Siempre en este orden en el resumen y en las tablas: el ojo aprende dónde está cada cosa.
const FUENTES = [
  { clave: 'bateria', etiqueta: 'Batería', unPunto: 'Una sola batería: todavía no hay con qué comparar' },
  { clave: 'partido', etiqueta: 'Partidos', unPunto: 'Un solo partido: todavía no hay con qué comparar' },
] as const;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const textoPct = (v: Valor) => `${v.pct}% · ${v.anotados}/${v.intentos}${v.muestraChica ? ' (pocos datos)' : ''}`;

/**
 * El panorama del club para coordinación: una tarjeta por categoría, cada una contra sí misma a lo largo
 * de la temporada. Por tipo de tiro (triples y libres) dos fuentes lado a lado, batería y partidos, nunca
 * mezcladas ni restadas.
 *
 * Lo que esta pantalla NO hace, a propósito: ordenar por ningún valor, poner una categoría contra otra,
 * promediar el club, etiquetar con juicios ni pintar una categoría distinta de otra. Comparar U13 con U17
 * compara edades, no trabajo; y un ranking de categorías es un ranking de entrenadores.
 */
export function CoordPanorama() {
  const clubId = useClubCoord();
  const datos = usePanoramaDelClub(clubId);
  return (
    <div>
      <h1 className={TITULO_DE_PANTALLA}>Panorama</h1>
      <Consulta consulta={datos} errorGenerico="No se pudo cargar el panorama.">
        {(d) => <Cuerpo datos={d} clubId={clubId} />}
      </Consulta>
    </div>
  );
}

type Datos = NonNullable<ReturnType<typeof usePanoramaDelClub>['data']>;

function Cuerpo({ datos, clubId }: { datos: Datos; clubId: string }) {
  const vista = useMemo(
    () => armarPanorama(datos) as { temporada: { nombre: string } | null; tarjetas: Tarjeta[] },
    [datos],
  );
  const logros = useMemo(() => {
    if (!datos.equipo) return null;
    const porPlantel = new Map<string, { id: string; fecha: string; rival: string | null }[]>();
    for (const l of logrosDelEquipo(datos.equipo.previas, datos.equipo.misiones) as { id: string; plantelId: string; fecha: string; rival: string | null }[]) {
      porPlantel.set(l.plantelId, [...(porPlantel.get(l.plantelId) ?? []), l]);
    }
    return porPlantel;
  }, [datos.equipo]);
  const asistencia = useMemo(() => (datos.asistencia ? new Map(datos.asistencia.map((f) => [f.plantelId, f])) : null), [datos.asistencia]);

  if (!vista.tarjetas.length) {
    return (
      <Vacio icono={Trophy} titulo="Todavía no hay categorías">
        Cuando se carguen las categorías de este club, cada una aparece acá contra sí misma a lo largo de la temporada.
      </Vacio>
    );
  }
  return (
    <>
      <p className="mt-2 mb-1 font-mono text-xs tracking-wide text-gris uppercase">Temporada {vista.temporada?.nombre}</p>
      <p className="mb-5 max-w-3xl text-sm text-gris">
        Cada categoría contra sí misma a lo largo de la temporada. No se comparan entre sí: son chicos distintos en momentos distintos.
      </p>
      <TarjetaDePapeles clubId={clubId} />
      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {vista.tarjetas.map((t) => (
          <TarjetaDeCategoria
            key={t.plantelId}
            t={t}
            logros={logros ? (logros.get(t.plantelId) ?? []) : null}
            asistencia={asistencia ? (asistencia.get(t.plantelId) ?? null) : undefined}
          />
        ))}
      </div>
    </>
  );
}

/** Una línea que lleva a Papeles y pagos. Se pide aparte: si no hay conexión con Google o algo falla, no aparece. */
function TarjetaDePapeles({ clubId }: { clubId: string }) {
  const q = useResumenDePapeles(clubId);
  if (!q.data) return null;
  const { chicos, conexion } = q.data;
  if (!conexion.conectado || !conexion.ultimoEnvioEn || !chicos.length) return null;
  const r = resumenPanorama(chicos, conceptosDe(chicos, conexion.conceptosOrden)) as { debenAlgo: number; sinPapeles: number };
  const viejo = envioViejo(conexion.ultimoEnvioEn) as boolean;
  return (
    <Link
      to="/coordinacion/familias"
      className="mb-5 block rounded-tarjeta border border-linea bg-sup p-4 shadow-tarjeta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
    >
      <p className="font-mono text-xs tracking-wide text-gris uppercase">Papeles y pagos</p>
      <p className="mt-1">
        <b className="font-mono">{r.debenAlgo}</b> deben algo · <b className="font-mono">{r.sinPapeles}</b> sin los papeles completos
        {viejo && <> · <b>sin novedades de Google hace horas</b></>}
      </p>
    </Link>
  );
}

function Variacion({ variacion }: { variacion: Fuente['variacion'] }) {
  if (!variacion) return null;
  const signo = variacion.pp > 0 ? '+' : '';
  if (!variacion.concluyente) {
    return <span className="text-xs text-gris" title="La diferencia no supera el margen de error">{signo}{variacion.pp} pp · sin diferencia clara</span>;
  }
  // La flecha es la señal, no el color: quien no distinga los tonos igual ve para qué lado se movió.
  return <span className={cn('text-sm font-semibold', variacion.pp > 0 ? 'text-sube' : 'text-baja')}>{variacion.pp > 0 ? '▲' : '▼'} {signo}{variacion.pp} pp</span>;
}

function Cifra({ t, tipo, fuente }: { t: Tarjeta; tipo: (typeof TIPOS)[number]; fuente: (typeof FUENTES)[number] }) {
  const { serie, variacion } = t[tipo.clave][fuente.clave];
  if (!serie.length) {
    return (
      <div>
        <p className="font-mono text-xs tracking-wide text-gris uppercase">{fuente.etiqueta}</p>
        <p className="mt-1 text-sm text-gris">{textoSinDatos({ fuente: fuente.clave, tipo: tipo.clave, partidosImportados: t.partidos }) as string}</p>
      </div>
    );
  }
  const ultimo = serie[serie.length - 1];
  const anterior = serie.length >= 2 ? serie[serie.length - 2] : null;
  return (
    <div>
      <p className="font-mono text-xs tracking-wide text-gris uppercase">{fuente.etiqueta} · {fecha(ultimo.fecha)}</p>
      <p className="flex items-baseline gap-2">
        <span className="font-titulo text-6xl leading-none font-bold tracking-tight">{ultimo.valor.pct}<span className="text-3xl">%</span></span>
        <span className="font-mono text-sm text-gris">{ultimo.valor.anotados}/{ultimo.valor.intentos}</span>
      </p>
      {ultimo.valor.muestraChica && <Chip className="mt-1">pocos datos</Chip>}
      <p className="mt-1">
        {anterior ? (
          <>
            <Variacion variacion={variacion} /> <span className="text-xs text-gris">vs {fecha(anterior.fecha)}</span>
          </>
        ) : (
          <span className="text-xs text-gris">{fuente.unPunto}</span>
        )}
      </p>
    </div>
  );
}

function BloqueDeTipo({ t, tipo }: { t: Tarjeta; tipo: (typeof TIPOS)[number] }) {
  const bateria = t[tipo.clave].bateria.serie;
  const partido = t[tipo.clave].partido.serie;
  const eje = useMemo(() => ejeComun(bateria, partido) as { fechas: string[]; a: (Valor | null)[]; b: (Valor | null)[] }, [bateria, partido]);
  const puntos = (v: (Valor | null)[]) => v.map((x) => ({ pct: x?.pct ?? null, muestraChica: x?.muestraChica === true }));
  return (
    <section aria-label={`${tipo.titulo} de ${t.categoria}`} className="border-t border-linea pt-4">
      <h3 className="mb-2 font-titulo text-2xl leading-none font-semibold uppercase">{tipo.titulo}</h3>
      <div className="grid grid-cols-2 gap-4">
        {FUENTES.map((f) => <Cifra key={f.clave} t={t} tipo={tipo} fuente={f} />)}
      </div>
      {(bateria.length > 0 || partido.length > 0) && (
        <div className="mt-3">
          <GraficoEvolucion
            fechas={eje.fechas}
            descripcion={`Evolución de ${tipo.titulo.toLowerCase()} en ${t.categoria}, de 0 a 100 por ciento: ${plural(bateria.length, 'batería', 'baterías')} y ${plural(partido.length, 'partido', 'partidos')}.`}
            series={[
              { nombre: 'Batería', puntos: puntos(eje.a), clase: 'text-tinta' },
              { nombre: 'Partidos', puntos: puntos(eje.b), clase: 'text-club-texto', punteada: true },
            ].filter((s) => (s.nombre === 'Batería' ? bateria.length : partido.length) > 0)}
          />
        </div>
      )}
    </section>
  );
}

function Tablas({ t }: { t: Tarjeta }) {
  const tablas = TIPOS.flatMap((tipo) => [
    ...(t[tipo.clave].bateria.serie.length ? [{ nombre: `${tipo.titulo} · Batería`, serie: t[tipo.clave].bateria.serie, esBateria: true }] : []),
    ...(t[tipo.clave].partido.serie.length ? [{ nombre: `${tipo.titulo} · Partidos`, serie: t[tipo.clave].partido.serie, esBateria: false }] : []),
  ]);
  return (
    <details className="mt-4 rounded-tarjeta border border-linea px-4 py-2">
      <summary className="min-h-11 cursor-pointer py-2.5 font-semibold">Ver detalles · Historial de {t.categoria}</summary>
      <div className="flex flex-col gap-4 pb-2">
        {tablas.map((tabla) => (
          <div key={tabla.nombre}>
            <h4 className="mb-1 font-mono text-xs tracking-wide text-gris uppercase">{tabla.nombre}</h4>
            <ul className="divide-y divide-linea text-sm">
              {[...tabla.serie].reverse().map((p) => (
                <li key={p.fecha} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                  <span className="font-mono text-gris">{fecha(p.fecha)}</span>
                  <span>{textoPct(p.valor)}</span>
                  <span className="text-gris">
                    {tabla.esBateria ? plural(p.jugadoresQueMidieron ?? 0, 'jugador', 'jugadores') : p.rival ? `vs ${p.rival}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function TarjetaDeCategoria({ t, logros, asistencia }: {
  t: Tarjeta;
  logros: { id: string; fecha: string; rival: string | null }[] | null;
  /** undefined = no se pudo cargar (la línea no aparece); null = sin fila para esta categoría. */
  asistencia: { pct: number | null; entrenamientos: number } | null | undefined;
}) {
  const medicion = t.ultimaMedicion ? `última medición ${fecha(t.ultimaMedicion)}` : 'sin mediciones';
  return (
    <article className="rounded-tarjeta border border-linea bg-sup p-5 shadow-tarjeta">
      <h2 className="flex flex-wrap items-baseline gap-x-3 font-titulo text-4xl leading-none font-bold uppercase">
        {t.categoria}
        <span className="font-sans text-sm font-normal tracking-normal text-gris normal-case">{t.nombreCategoria}</span>
      </h2>
      <p className="mt-2 text-sm text-gris">
        {plural(t.jugadores, 'jugador', 'jugadores')} · {plural(t.partidos, 'partido importado', 'partidos importados')} · {medicion}
      </p>
      {t.aCargo.length ? <p className="mt-1 text-sm text-gris">A cargo: {t.aCargo.join(', ')}</p> : <Chip className="mt-2">Sin profe asignado</Chip>}
      {asistencia !== undefined && (
        // Sin color ni semáforo: igual que el resto de la pantalla, una categoría no se pinta distinto de otra.
        <p className="mt-1 text-sm text-gris">Asistencia: <span className="font-mono text-tinta">{textoDeAsistenciaDeCategoria(asistencia) as string}</span></p>
      )}
      {hayAlgoParaMostrar(t) ? (
        <div className="mt-4 flex flex-col gap-4">
          {TIPOS.map((tipo) => <BloqueDeTipo key={tipo.clave} t={t} tipo={tipo} />)}
          <Tablas t={t} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-gris">Todavía no hay baterías ni partidos con tiros en {t.categoria}.</p>
      )}
      {logros && (
        <section aria-label="Logros del equipo" className="mt-4 border-t border-linea pt-4">
          <h3 className="font-mono text-xs tracking-wide text-gris uppercase">Logros del equipo</h3>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-titulo text-5xl leading-none font-bold">{logros.length}</span>
            <span className="text-sm text-gris">{logros.length === 1 ? 'logro en la temporada' : 'logros en la temporada'}</span>
          </p>
          {logros.length > 0 ? (
            <ul className="mt-2 divide-y divide-linea text-sm">
              {logros.map((l) => (
                <li key={l.id} className="flex gap-3 py-1.5">
                  <span className="font-mono text-gris">{fecha(l.fecha)}</span>
                  <span>{textoDeMision(l) as string}{l.rival ? <span className="text-gris"> · {l.rival}</span> : null}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-gris">Las misiones del equipo se arman antes del partido, desde Plantel → Misiones del partido. Cuando evalúes una como Logrado, aparece acá.</p>
          )}
        </section>
      )}
    </article>
  );
}
