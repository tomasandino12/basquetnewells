import { html, crudo } from '../html.js';
import { formatearFechaCorta } from '../nav.js';
import { verDetallesHtml } from './verDetalles.js';
import { TESTS_SALTO } from '../../data/salto.js';
import { DISTANCIAS_SPRINT, formatearTiempoSprint } from '../../data/sprint.js';
import { nivelYIda, metrosDe } from '../../data/yoyo.js';
import {
  agruparHistoria, comoLlega, comoTermino, totalesDePartidos, resumenDeTemporada,
  bateriasDeTiro, cargasPorEjercicio,
} from '../../data/historiaJugador.js';

/**
 * "Historia por temporada" de la ficha: qué se trabajó con el chico y cómo
 * llega a la categoría en la que está hoy (spec
 * docs/superpowers/specs/2026-10-16-historia-jugador-design.md).
 *
 * Arriba "Cómo llega": lo último que se le midió antes de esta temporada.
 * Debajo, una tarjeta por temporada con su resumen siempre a la vista y los
 * detalles en la hoja ("Ver detalles", como DATOS y el panorama).
 *
 * Sólo se muestran los datos. Nada de flechas, tendencias, normas ni
 * comparaciones con otros: la lectura la hace el profe. Lo que falta dice
 * "sin datos" y no se muestra como 0.
 *
 * Cada bloque de la hoja está en BLOQUES: sumar misiones o asistencia es una
 * entrada nueva, sin tocar las que ya están.
 */

const NOMBRE_TEST_SALTO = { cmj: 'CMJ', abalakov: 'Abalakov' };
const coma = (n, dec = 1) => n.toFixed(dec).replace('.', ',');
const miles = new Intl.NumberFormat('es-AR');

const SIN = html`<span class="sin">sin datos</span>`;

const fila = (etiqueta, valor, fecha) => html`
  <div class="fila-ev dos">
    <div>${etiqueta}</div>
    <div>${valor}${fecha && html` <span class="f">${formatearFechaCorta(fecha)}</span>`}</div>
  </div>`;

/** Lo último de cada tipo: sirve para "Cómo llega" y para "Cómo terminó". */
function filasDeUltimas(u) {
  const salto = (test) => u.saltos.find((s) => s.test === test);
  const sprint = (d) => u.sprints.find((s) => s.distanciaM === d);
  return html`<div class="tabla-ev">
    ${TESTS_SALTO.map((test) => {
      const s = salto(test);
      return fila(`Salto ${NOMBRE_TEST_SALTO[test]}`, s ? html`<span class="mono">${coma(s.alturaCm)} cm</span>` : SIN, s?.fecha);
    })}
    ${DISTANCIAS_SPRINT.map((d) => {
      const s = sprint(d);
      return fila(`Sprint de ${d} m`, s ? html`<span class="mono">${formatearTiempoSprint(s.tiempoMs)}</span> ida y vuelta` : SIN, s?.fecha);
    })}
    ${fila('Resistencia (Yo-Yo)', u.yoyo ? html`<span class="mono">${nivelYIda(u.yoyo.idas)}</span> · ${miles.format(metrosDe(u.yoyo.idas))} m` : SIN, u.yoyo?.fecha)}
    ${fila('Altura', u.altura ? html`<span class="mono">${u.altura.valor} cm</span>` : SIN, u.altura?.fecha)}
    ${fila('Peso', u.peso ? html`<span class="mono">${coma(u.peso.valor)} kg</span>` : SIN, u.peso?.fecha)}
    ${fila('Última batería de tiro', u.tiro ? html`<span class="mono">${u.tiro.anotados} de ${u.tiro.intentos}</span>` : SIN, u.tiro?.fecha)}
    ${u.cargas.length
      ? u.cargas.map((c) => fila(`Carga: ${c.nombre}`, html`<span class="mono">${coma(c.kg)} kg</span>`, c.fecha))
      : fila('Cargas de fuerza', SIN)}
  </div>`;
}

const rango = (a, b) => (a && b ? `del ${formatearFechaCorta(a)} al ${formatearFechaCorta(b)}` : '');

/* ---------- los bloques de la hoja de cada temporada ---------- */

const BLOQUES = [
  {
    clave: 'trabajado',
    titulo: 'Qué se trabajó',
    html(g) {
      const { planFisico = [], cargas = [], recursos = [] } = g.fuentes;
      if (!planFisico.length && !cargas.length && !recursos.length) return html`<div class="p">${SIN}</div>`;
      return html`
        ${planFisico.map((p) => html`
          <div class="p">Plan de la categoría: ${p.sesiones} ${p.sesiones === 1 ? 'sesión' : 'sesiones'} ${rango(p.primera, p.ultima)}.</div>
          <div class="tabla-ev">${(p.bloques ?? []).map((b) => fila(b.bloque ?? 'Sin bloque', (b.ejercicios ?? []).join(', ')))}</div>`)}
        ${cargas.length > 0 && html`
          <div class="p">Sus cargas de fuerza</div>
          <div class="tabla-ev">${cargasPorEjercicio(cargas).map((c) => fila(c.nombre,
    html`<span class="mono">${c.movimientos.map((m) => `${coma(m.kg)} kg (${formatearFechaCorta(m.fecha)})`).join(' · ')}</span>`))}</div>`}
        ${recursos.length > 0 && html`
          <div class="p">Material que recibió</div>
          <div class="tabla-ev">${recursos.map((r) => fila(r.titulo, '', r.fecha))}</div>`}`;
    },
  },
  {
    clave: 'termino',
    titulo: 'Cómo terminó',
    html(g) {
      const u = comoTermino(g);
      return u.vacio ? html`<div class="p">${SIN}</div>` : filasDeUltimas(u);
    },
  },
  {
    clave: 'tiro',
    titulo: 'Tiro',
    html(g) {
      const b = bateriasDeTiro(g.fuentes.tiro ?? []);
      return b.length
        ? html`<div class="tabla-ev">${b.map((x) => fila(`Batería`, html`<span class="mono">${x.anotados} de ${x.intentos}</span>`, x.fecha))}</div>`
        : html`<div class="p">${SIN}</div>`;
    },
  },
  {
    clave: 'partidos',
    titulo: 'Partidos',
    html(g) {
      const t = totalesDePartidos(g.fuentes.partidos ?? []);
      if (!t.jugados) return html`<div class="p">${SIN}</div>`;
      const de = (x) => (x ? html`<span class="mono">${x.anotados} de ${x.intentos}</span>` : SIN);
      return html`<div class="tabla-ev">
        ${fila('Partidos jugados', html`<span class="mono">${t.jugados}</span>`)}
        ${fila('Minutos', t.minutos == null ? SIN : html`<span class="mono">${t.minutos}</span>`)}
        ${fila('Puntos', t.puntos == null ? SIN : html`<span class="mono">${t.puntos}</span>`)}
        ${fila('Dobles', de(t.dos))}
        ${fila('Triples', de(t.tres))}
        ${fila('Libres', de(t.libres))}
      </div>`;
    },
  },
];

function tarjetaDeTemporada(g) {
  const titulo = `${g.temporada?.nombre ?? 'Sin temporada'}${g.categorias.length ? ` · ${g.categorias.join(' · ')}` : ''}`;
  const tablas = BLOQUES.map((b) => ({ nombre: b.titulo, html: b.html(g).toString() }));
  return html`
    <div class="tarj">
      <div class="eyebrow">${titulo}${g.actual && html`<span class="der">Temporada actual</span>`}</div>
      ${g.profes.length > 0 && html`<div class="p">Profes: ${g.profes.join(', ')}</div>`}
      ${!g.temporada && html`<div class="p">Datos de fechas que no caen en ninguna categoría del chico.</div>`}
      <div class="p">${resumenDeTemporada(g)}</div>
      ${crudo(verDetallesHtml(titulo, tablas))}
    </div>`;
}

/**
 * `datos` es lo que devuelve obtenerHistoriaDelJugador. Una temporada de la
 * lista no se saltea aunque no tenga datos: el recorrido del chico incluye las
 * temporadas en las que estuvo sin nada medido.
 */
export function seccionTemporadas(datos) {
  const grupos = agruparHistoria(datos);
  const llega = comoLlega(datos);
  const vigentes = (datos.planteles ?? []).filter((p) =>
    (datos.pertenencias ?? []).some((x) => x.plantelId === p.id && x.hasta == null));
  const hoy = [...new Set(vigentes.map((p) => p.categoria))].join(' · ');
  return html`
    <div class="eyebrow">Historia por temporada</div>
    ${llega && html`
      <div class="tarj">
        <div class="eyebrow">Cómo llega${hoy && ` a ${hoy}`}</div>
        <div class="p">Lo último que se le midió antes de esta temporada.</div>
        ${llega.vacio ? html`<div class="p">${SIN}</div>` : filasDeUltimas(llega)}
      </div>`}
    ${grupos.length
    ? grupos.map(tarjetaDeTemporada)
    : html`<div class="p">Todavía no hay temporadas anteriores cargadas.</div>`}
  `;
}
