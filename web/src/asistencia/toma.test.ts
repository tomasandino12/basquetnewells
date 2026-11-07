import { describe, expect, it } from 'vitest';
import type { Entrenamiento, JugadorDelPlantel, Lesion } from '../datos/repositorio';
import {
  accionesDelMenu,
  contar,
  detalleDelDia,
  esFechaTomable,
  filasAGuardar,
  hayCambios,
  ordenarPorNombre,
  ponerEstado,
  tarjetasIniciales,
  textoDeFecha,
  tocarTarjeta,
} from './toma';

// Nombres inventados.
const j = (id: string, nombreLimpio: string): JugadorDelPlantel => ({ id, nombreClave: id, nombreLimpio, fechaNacimiento: null });
const JUGADORES = [j('j-2', 'Benítez, Tomás'), j('j-1', 'Acosta, Bruno'), j('j-3', 'Álvarez, Luis')];
const lesion = (o: Partial<Lesion> = {}): Lesion => ({ id: 'l-1', jugadorId: 'j-1', desde: '2026-10-10', hasta: null, zona: null, lado: null, tipo: null, ...o });
const dia = (o: Partial<Entrenamiento> = {}): Entrenamiento => ({ id: 'e-1', fecha: '2026-10-29', hubo: true, filas: [], ...o });

describe('toma: orden y arranque', () => {
  it('ordena por apellido como se lee en castellano, con tildes, sin tocar la lista original', () => {
    const orden = ordenarPorNombre(JUGADORES).map((x) => x.id);
    expect(orden).toEqual(['j-1', 'j-3', 'j-2']);
    expect(JUGADORES.map((x) => x.id)).toEqual(['j-2', 'j-1', 'j-3']);
  });

  it('un chico sin fila arranca sin tomar (null), nunca como ausente', () => {
    const t = tarjetasIniciales(JUGADORES, dia({ filas: [{ jugadorId: 'j-1', estado: 'presente' }] }));
    expect(t.find((x) => x.jugadorId === 'j-1')?.estado).toBe('presente');
    expect(t.find((x) => x.jugadorId === 'j-2')?.estado).toBeNull();
  });

  it('un día que no se tomó todavía deja a todos sin tomar', () => {
    expect(tarjetasIniciales(JUGADORES, null).every((x) => x.estado === null)).toBe(true);
  });
});

describe('toma: un toque', () => {
  const base = tarjetasIniciales(JUGADORES, dia({ filas: [{ jugadorId: 'j-1', estado: 'justificada' }] }));

  it('sin tomar pasa a presente y presente a ausente', () => {
    const uno = tocarTarjeta(base, 'j-2');
    expect(uno.find((x) => x.jugadorId === 'j-2')?.estado).toBe('presente');
    expect(tocarTarjeta(uno, 'j-2').find((x) => x.jugadorId === 'j-2')?.estado).toBe('ausente');
  });

  it('una falta justificada, al tocarla, pasa a presente', () => {
    expect(tocarTarjeta(base, 'j-1').find((x) => x.jugadorId === 'j-1')?.estado).toBe('presente');
  });

  it('tocar uno no cambia a los demás', () => {
    const t = tocarTarjeta(base, 'j-2');
    expect(t.find((x) => x.jugadorId === 'j-3')?.estado).toBeNull();
  });

  it('el menú puede poner justificada', () => {
    expect(ponerEstado(base, 'j-2', 'justificada').find((x) => x.jugadorId === 'j-2')?.estado).toBe('justificada');
  });
});

describe('toma: cuenta y guardado', () => {
  it('cuenta presentes, total y sin tomar', () => {
    let t = tarjetasIniciales(JUGADORES, null);
    t = tocarTarjeta(t, 'j-1');
    t = ponerEstado(t, 'j-2', 'ausente');
    expect(contar(t)).toEqual({ total: 3, presentes: 1, sinTomar: 1 });
  });

  it('a guardar van sólo los tomados: el que quedó sin tomar no lleva fila', () => {
    let t = tarjetasIniciales(JUGADORES, null);
    t = tocarTarjeta(t, 'j-1');
    t = ponerEstado(t, 'j-2', 'justificada');
    expect(filasAGuardar(t)).toEqual([
      { jugadorId: 'j-2', estado: 'justificada' },
      { jugadorId: 'j-1', estado: 'presente' },
    ]);
  });

  it('hay cambios si cambió una marca o si cambió «hubo entrenamiento»', () => {
    const inicial = tarjetasIniciales(JUGADORES, null);
    expect(hayCambios({ inicial, actual: inicial, hubo: true, huboInicial: true })).toBe(false);
    expect(hayCambios({ inicial, actual: tocarTarjeta(inicial, 'j-1'), hubo: true, huboInicial: true })).toBe(true);
    expect(hayCambios({ inicial, actual: inicial, hubo: false, huboInicial: true })).toBe(true);
  });

  it('marcar y desmarcar en el mismo día no cuenta como cambio', () => {
    const inicial = tarjetasIniciales(JUGADORES, dia({ filas: [{ jugadorId: 'j-1', estado: 'presente' }] }));
    const vuelta = tocarTarjeta(tocarTarjeta(inicial, 'j-1'), 'j-1'); // presente → ausente → presente
    expect(hayCambios({ inicial, actual: vuelta, hubo: true, huboInicial: true })).toBe(false);
  });

  it('sin entrenamiento, lo marcado no cuenta: no se guarda', () => {
    const inicial = tarjetasIniciales(JUGADORES, dia({ hubo: false }));
    expect(hayCambios({ inicial, actual: tocarTarjeta(inicial, 'j-1'), hubo: false, huboInicial: false })).toBe(false);
  });
});

describe('toma: menú de un chico', () => {
  it('ofrece justificada si no lo está, y lesión si no tiene ninguna', () => {
    expect(accionesDelMenu('ausente', [], '2026-10-29')).toEqual({ justificada: true, lesionar: true, altaDe: null });
    expect(accionesDelMenu('justificada', [], '2026-10-29').justificada).toBe(false);
  });

  it('con una lesión abierta ofrece el alta y no otra lesión', () => {
    expect(accionesDelMenu('presente', [lesion()], '2026-10-29')).toEqual({ justificada: true, lesionar: false, altaDe: 'l-1' });
  });

  it('en un día anterior al comienzo de la lesión no se puede dar el alta', () => {
    expect(accionesDelMenu('presente', [lesion({ desde: '2026-10-20' })], '2026-10-15').altaDe).toBeNull();
  });
});

describe('toma: fechas', () => {
  it('sólo se toma hasta hoy y con formato de fecha', () => {
    expect(esFechaTomable('2026-11-07', '2026-11-07')).toBe(true);
    expect(esFechaTomable('2026-11-08', '2026-11-07')).toBe(false);
    expect(esFechaTomable('', '2026-11-07')).toBe(false);
    expect(esFechaTomable('7/11', '2026-11-07')).toBe(false);
  });

  it('escribe el día con su día de la semana', () => {
    expect(textoDeFecha('2026-10-29')).toMatch(/29\/10/);
    expect(textoDeFecha('2026-10-29')).toMatch(/jue/i);
  });
});

describe('historial: detalle de un día', () => {
  it('distingue sin entrenamiento, sin tomar y tomado', () => {
    expect(detalleDelDia(dia({ hubo: false }))).toEqual({ tipo: 'sin-entrenamiento' });
    expect(detalleDelDia(dia())).toEqual({ tipo: 'sin-tomar' });
    expect(
      detalleDelDia(dia({ filas: [{ jugadorId: 'j-1', estado: 'presente' }, { jugadorId: 'j-2', estado: 'justificada' }] })),
    ).toEqual({ tipo: 'tomado', presentes: 1, tomados: 2 });
  });
});
