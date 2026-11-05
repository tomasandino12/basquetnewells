import { describe, expect, it } from 'vitest';
import { bateria } from './datosDePrueba';
import { armarResumen, calorDeZonas, fechaCorta } from './resumen';

const S1 = { id: 's-1', fecha: '2026-10-06', tipo: 'tiro' };
const S2 = { id: 's-2', fecha: '2026-10-20', tipo: 'tiro' };
const base = { jugadores: null, corporales: null, metas: {} };

describe('calorDeZonas', () => {
  it('la peor es 4, la mejor es 0 y lo que no se midió queda sin calor', () => {
    expect(calorDeZonas([20, 60, null, 40])).toEqual([4, 0, null, 2]);
  });
  it('si todas dan igual no hay una que resaltar', () => {
    expect(calorDeZonas([50, 50, null])).toEqual([0, 0, null]);
  });
  it('sin ninguna medición no hay calor', () => {
    expect(calorDeZonas([null, null])).toEqual([null, null]);
  });
});

describe('armarResumen', () => {
  it('sin baterías de tiro no hay resumen', () => {
    expect(armarResumen({ ...base, sesiones: [], mediciones: [] }).tipo).toBe('sin-baterias');
    expect(armarResumen({ ...base, sesiones: [{ id: 'x', fecha: '2026-10-01', tipo: 'salto' }], mediciones: [] }).tipo).toBe('sin-baterias');
  });

  it('una batería sin ninguna medición lo dice con su fecha', () => {
    expect(armarResumen({ ...base, sesiones: [S1], mediciones: [] })).toEqual({ tipo: 'sin-mediciones', fecha: '2026-10-06' });
  });

  it('ordena las zonas de peor a mejor y pinta más fuerte la más floja', () => {
    const r = armarResumen({ ...base, sesiones: [S1], mediciones: bateria('s-1', { frontal: 2, esq_izq: 8 }) });
    if (r.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(r.zonas.map((z) => z.id)).toEqual(['frontal', 'c45_izq', 'c45_der', 'esq_der', 'esq_izq']);
    expect(r.zonas[0].calor).toBe(4);
    expect(r.zonas[4].calor).toBe(0);
    expect(r.zonas[0].valor).toMatchObject({ pct: 20, anotados: 6, intentos: 30 });
    expect(r.libres.id).toBe('libres');
    expect(r.jugadoresQueMidieron).toBe(3);
  });

  it('las zonas sin medir van al final y sin calor', () => {
    const sinFrontal = bateria('s-1', {}).filter((m) => m.posicion !== 'frontal');
    const r = armarResumen({ ...base, sesiones: [S1], mediciones: sinFrontal });
    if (r.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(r.zonas[4]).toMatchObject({ id: 'frontal', valor: null, calor: null });
  });

  it('la primera batería no tiene con qué comparar: variación null, nunca un cero', () => {
    const r = armarResumen({ ...base, sesiones: [S1], mediciones: bateria('s-1', {}) });
    if (r.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(r.totalVariacion).toBeNull();
    expect(r.zonas.every((z) => z.variacion === null)).toBe(true);
    expect(r.fechaAnterior).toBeNull();
  });

  it('con dos baterías compara contra la anterior y arma la serie', () => {
    const r = armarResumen({
      ...base,
      sesiones: [S1, S2],
      mediciones: [...bateria('s-1', {}), ...bateria('s-2', { frontal: 2 })],
    });
    if (r.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(r.fecha).toBe('2026-10-20');
    expect(r.fechaAnterior).toBe('2026-10-06');
    expect(r.zonas[0].variacion).toMatchObject({ pp: -40, concluyente: true });
    expect(r.serie.map((p) => p.fecha)).toEqual(['2026-10-06', '2026-10-20']);
  });

  it('señala una sola zona como la más floja sólo si se separa del resto', () => {
    const marcada = armarResumen({ ...base, sesiones: [S1], mediciones: bateria('s-1', { frontal: 1 }) });
    if (marcada.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(marcada.foco).toMatchObject({ concluyente: true });
    expect(marcada.foco?.zonas.map((z) => z.id)).toEqual(['frontal']);

    const empatadas = armarResumen({ ...base, sesiones: [S1], mediciones: bateria('s-1', { frontal: 5 }) });
    if (empatadas.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(empatadas.foco?.concluyente).toBe(false);
  });

  it('cuenta quiénes están por debajo de la meta sólo si hay foco claro y meta fijada', () => {
    const mediciones = bateria('s-1', { frontal: 1 });
    const conMeta = armarResumen({ ...base, metas: { frontal: 40 }, sesiones: [S1], mediciones });
    if (conMeta.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(conMeta.porDebajo).toMatchObject({ cantidad: 3, total: 3 });
    expect(conMeta.porDebajo?.jugadores[0].nombre).toBe('Jugador');
    expect(conMeta.zonas[0]).toMatchObject({ meta: 40, llegoALaMeta: false });
    expect(conMeta.metas).toEqual({ alcanzadas: 0, conMeta: 1 });

    const sinMeta = armarResumen({ ...base, sesiones: [S1], mediciones });
    if (sinMeta.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(sinMeta.porDebajo).toBeNull();
    expect(sinMeta.metas).toBeNull();
  });

  it('el pie de altura y peso sólo existe si cargaron los chicos y las mediciones', () => {
    const mediciones = bateria('s-1', {});
    const jugadores = [
      { id: 'j-1', nombreClave: 'a', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
      { id: 'j-2', nombreClave: 'b', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
    ];
    const corporales = [{ jugadorId: 'j-1', fechaMedicion: '2026-10-01', alturaCm: 158, pesoKg: 47, piernaCm: null, piernaFlexionadaCm: null }];
    const r = armarResumen({ ...base, sesiones: [S1], mediciones, jugadores, corporales });
    if (r.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(r.corporal).toEqual({ ultimaFecha: '2026-10-01', sinMedir: 1, total: 2 });
    const degradado = armarResumen({ ...base, sesiones: [S1], mediciones, jugadores, corporales: null });
    if (degradado.tipo !== 'completo') throw new Error('tenía que ser completo');
    expect(degradado.corporal).toBeNull();
  });
});

describe('fechaCorta', () => {
  it('da día y mes sin pasar por Date', () => {
    expect(fechaCorta('2026-05-01')).toBe('01/05');
  });
});
