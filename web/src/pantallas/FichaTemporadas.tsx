import type { ReactNode } from 'react';
import {
  agruparHistoria, bateriasDeTiro, cargasPorEjercicio, comoLlega, comoTermino, resumenDeTemporada, totalesDePartidos,
} from '@datos/historiaJugador.js';
import { TESTS_SALTO } from '@datos/salto.js';
import { DISTANCIAS_SPRINT, formatearTiempoSprint } from '@datos/sprint.js';
import { metrosDe, nivelYIda } from '@datos/yoyo.js';
import { Consulta } from '../components/ui/consulta';
import { useHistoriaDelJugador } from '../datos/consultasFicha';

// Sólo se muestran datos: nada de flechas, tendencias ni comparaciones. Lo que falta dice «sin datos», no 0.
// El recorrido llega de la base como listas crudas; `@datos/historiaJugador.js` (lógica pura, con sus pruebas) las agrupa.

// Las listas vienen de la base con la forma de `FUENTES` (src/data/historiaJugador.js): se leen sin tipar campo por campo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cualquiera = any;

const TITULO = 'mb-2 font-mono text-xs tracking-wide text-gris uppercase';
const NOMBRE_TEST_SALTO: Record<string, string> = { cmj: 'CMJ', abalakov: 'Abalakov' };
const coma = (n: number, dec = 1) => n.toFixed(dec).replace('.', ',');
const miles = new Intl.NumberFormat('es-AR');
const SIN = <span className="text-gris">sin datos</span>;

/** 'YYYY-MM-DD' → 'DD/MM', a mano: new Date('2026-05-01') es UTC y se corre un día. */
const fechaCorta = (iso: string) => {
  const [, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${dia}/${mes}`;
};
const rango = (a?: string, b?: string) => (a && b ? `del ${fechaCorta(a)} al ${fechaCorta(b)}` : '');

function Fila({ etiqueta, children, fecha }: { etiqueta: string; children?: ReactNode; fecha?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linea py-1.5 text-sm last:border-b-0">
      <span>{etiqueta}</span>
      <span className="cifra text-right">
        {children}
        {fecha && <span className="ml-2 font-mono text-xs text-gris">{fechaCorta(fecha)}</span>}
      </span>
    </div>
  );
}

/** Lo último de cada tipo: sirve para «Cómo llega» y para «Cómo terminó». */
function Ultimas({ u }: { u: Cualquiera }) {
  const salto = (test: string) => u.saltos.find((s: Cualquiera) => s.test === test);
  const sprint = (d: number) => u.sprints.find((s: Cualquiera) => s.distanciaM === d);
  return (
    <div>
      {(TESTS_SALTO as string[]).map((test) => {
        const s = salto(test);
        return <Fila key={test} etiqueta={`Salto ${NOMBRE_TEST_SALTO[test]}`} fecha={s?.fecha}>{s ? `${coma(s.alturaCm)} cm` : SIN}</Fila>;
      })}
      {(DISTANCIAS_SPRINT as number[]).map((d) => {
        const s = sprint(d);
        return <Fila key={d} etiqueta={`Sprint de ${d} m`} fecha={s?.fecha}>{s ? `${formatearTiempoSprint(s.tiempoMs)} ida y vuelta` : SIN}</Fila>;
      })}
      <Fila etiqueta="Resistencia (Yo-Yo)" fecha={u.yoyo?.fecha}>
        {u.yoyo ? `${nivelYIda(u.yoyo.idas)} · ${miles.format(metrosDe(u.yoyo.idas))} m` : SIN}
      </Fila>
      <Fila etiqueta="Altura" fecha={u.altura?.fecha}>{u.altura ? `${u.altura.valor} cm` : SIN}</Fila>
      <Fila etiqueta="Peso" fecha={u.peso?.fecha}>{u.peso ? `${coma(u.peso.valor)} kg` : SIN}</Fila>
      <Fila etiqueta="Última batería de tiro" fecha={u.tiro?.fecha}>{u.tiro ? `${u.tiro.anotados} de ${u.tiro.intentos}` : SIN}</Fila>
      {u.cargas.length > 0
        ? u.cargas.map((c: Cualquiera) => <Fila key={c.nombre} etiqueta={`Carga: ${c.nombre}`} fecha={c.fecha}>{coma(c.kg)} kg</Fila>)
        : <Fila etiqueta="Cargas de fuerza">{SIN}</Fila>}
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <h5 className="mb-1 text-xs font-semibold text-gris">{titulo}</h5>
      {children}
    </div>
  );
}

function Detalles({ g }: { g: Cualquiera }) {
  const { planFisico = [], cargas = [], recursos = [], tiro = [], partidos = [] } = g.fuentes;
  const termino: Cualquiera = comoTermino(g);
  const baterias = bateriasDeTiro(tiro);
  const t = totalesDePartidos(partidos);
  const de = (x: Cualquiera) => (x ? `${x.anotados} de ${x.intentos}` : SIN);
  const nada = !planFisico.length && !cargas.length && !recursos.length;
  return (
    <div>
      <Bloque titulo="Qué se trabajó">
        {nada ? <p className="text-sm">{SIN}</p> : (
          <>
            {planFisico.map((p: Cualquiera, i: number) => (
              <div key={i} className="mb-2">
                <p className="text-sm">
                  Plan de la categoría: {p.sesiones} {p.sesiones === 1 ? 'sesión' : 'sesiones'} {rango(p.primera, p.ultima)}.
                </p>
                {(p.bloques ?? []).map((b: Cualquiera) => (
                  <Fila key={b.bloque ?? 'sin'} etiqueta={b.bloque ?? 'Sin bloque'}>{(b.ejercicios ?? []).join(', ')}</Fila>
                ))}
              </div>
            ))}
            {cargas.length > 0 && (
              <div className="mb-2">
                <p className="text-sm">Sus cargas de fuerza</p>
                {cargasPorEjercicio(cargas).map((c: Cualquiera) => (
                  <Fila key={c.nombre} etiqueta={c.nombre}>
                    {c.movimientos.map((m: Cualquiera) => `${coma(m.kg)} kg (${fechaCorta(m.fecha)})`).join(' · ')}
                  </Fila>
                ))}
              </div>
            )}
            {recursos.length > 0 && (
              <div>
                <p className="text-sm">Material que recibió</p>
                {recursos.map((r: Cualquiera, i: number) => <Fila key={i} etiqueta={r.titulo ?? 'Recurso sin título'} fecha={r.fecha} />)}
              </div>
            )}
          </>
        )}
      </Bloque>
      <Bloque titulo="Cómo terminó">{termino.vacio ? <p className="text-sm">{SIN}</p> : <Ultimas u={termino} />}</Bloque>
      <Bloque titulo="Tiro">
        {baterias.length === 0 ? <p className="text-sm">{SIN}</p> : baterias.map((x: Cualquiera, i: number) => (
          <Fila key={i} etiqueta="Batería" fecha={x.fecha}>{x.anotados} de {x.intentos}</Fila>
        ))}
      </Bloque>
      <Bloque titulo="Partidos">
        {!t.jugados ? <p className="text-sm">{SIN}</p> : (
          <>
            <Fila etiqueta="Partidos jugados">{t.jugados}</Fila>
            <Fila etiqueta="Minutos">{t.minutos ?? SIN}</Fila>
            <Fila etiqueta="Puntos">{t.puntos ?? SIN}</Fila>
            <Fila etiqueta="Dobles">{de(t.dos)}</Fila>
            <Fila etiqueta="Triples">{de(t.tres)}</Fila>
            <Fila etiqueta="Libres">{de(t.libres)}</Fila>
          </>
        )}
      </Bloque>
    </div>
  );
}

function Temporada({ g }: { g: Cualquiera }) {
  const titulo = `${g.temporada?.nombre ?? 'Sin temporada'}${g.categorias.length ? ` · ${g.categorias.join(' · ')}` : ''}`;
  return (
    <article className="rounded-tarjeta border border-linea p-3">
      <h4 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{titulo}</span>
        {g.actual && <span className="font-mono text-xs font-normal text-gris">Temporada actual</span>}
      </h4>
      {g.profes.length > 0 && <p className="mt-1 text-sm text-gris">Profes: {g.profes.join(', ')}</p>}
      {!g.temporada && <p className="mt-1 text-sm text-gris">Datos de fechas que no caen en ninguna categoría del chico.</p>}
      <p className="mt-1 text-sm">{resumenDeTemporada(g)}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-semibold underline underline-offset-2">Ver detalles</summary>
        <Detalles g={g} />
      </details>
    </article>
  );
}

/** El recorrido por todas las temporadas: qué se trabajó con el chico y cómo llega a la categoría de hoy. */
export function HistoriaPorTemporada({ jugadorId }: { jugadorId: string }) {
  const consulta = useHistoriaDelJugador(jugadorId);
  return (
    <Consulta consulta={consulta} errorGenerico="No pudimos cargar la historia por temporada">
      {(datos) => {
        const grupos = agruparHistoria(datos) as Cualquiera[];
        const llega = comoLlega(datos) as Cualquiera;
        const vigentes = (datos.planteles as Cualquiera[]).filter((p) =>
          (datos.pertenencias as Cualquiera[]).some((x) => x.plantelId === p.id && x.hasta == null));
        const hoy = [...new Set(vigentes.map((p) => p.categoria))].join(' · ');
        return (
          <section aria-label="Historia por temporada" className="flex flex-col gap-3">
            <h3 className={TITULO}>Historia por temporada</h3>
            {llega && (
              <article className="rounded-tarjeta border border-linea p-3">
                <h4 className="text-sm font-semibold">Cómo llega{hoy && ` a ${hoy}`}</h4>
                <p className="mb-1 text-sm text-gris">Lo último que se le midió antes de esta temporada.</p>
                {llega.vacio ? <p className="text-sm">{SIN}</p> : <Ultimas u={llega} />}
              </article>
            )}
            {grupos.length === 0
              ? <p className="text-sm text-gris">Todavía no hay temporadas anteriores cargadas.</p>
              : grupos.map((g, i) => <Temporada key={g.temporada?.id ?? `s-${i}`} g={g} />)}
          </section>
        );
      }}
    </Consulta>
  );
}
