import { describe, expect, it } from 'vitest';
import { armarFilas, buscarEnFilas, partirNombre, type EntradaFilas } from './filas';

const base: EntradaFilas = {
  hoy: '2026-11-04',
  jugadores: [
    { id: 'j1', nombreClave: 'perez ana', nombreLimpio: 'Pérez, Ana', fechaNacimiento: '2013-05-10' },
    { id: 'j2', nombreClave: 'acosta beto', nombreLimpio: 'Acosta, Beto', fechaNacimiento: null },
  ],
  mediciones: [
    { jugadorId: 'j1', fechaMedicion: '2026-09-01', alturaCm: 150, pesoKg: 40, piernaCm: null, piernaFlexionadaCm: null },
    { jugadorId: 'j1', fechaMedicion: '2026-10-01', alturaCm: 152, pesoKg: null, piernaCm: null, piernaFlexionadaCm: null },
  ],
  entrenamientos: [
    { id: 'e2', fecha: '2026-11-04', hubo: true, filas: [{ jugadorId: 'j1', estado: 'presente' }] },
    { id: 'e1', fecha: '2026-10-28', hubo: true, filas: [{ jugadorId: 'j1', estado: 'ausente' }] },
  ],
  lesiones: [{ id: 'l1', jugadorId: 'j1', desde: '2026-11-01', hasta: null, zona: 'tobillo', lado: 'derecho', tipo: null }],
  sesiones: [{ id: 's1', fecha: '2026-10-20', tipo: 'tiro' }],
  tiro: [
    { sesionId: 's1', jugadorId: 'j1', posicion: 'frontal', anotados: 6, intentos: 10 },
    { sesionId: 's1', jugadorId: 'j1', posicion: 'esq_izq', anotados: 2, intentos: 10 },
    { sesionId: 's1', jugadorId: 'j1', posicion: 'libres', anotados: 8, intentos: 10 },
  ],
};

describe('partirNombre', () => {
  it('separa apellido y nombre; sin coma todo es apellido', () => {
    expect(partirNombre('Pérez, Ana María')).toEqual({ apellido: 'Pérez', nombre: 'Ana María' });
    expect(partirNombre('Messi')).toEqual({ apellido: 'Messi', nombre: '' });
  });
});

describe('armarFilas', () => {
  const [acosta, perez] = armarFilas(base);

  it('ordena por apellido', () => {
    expect([acosta.apellido, perez.apellido]).toEqual(['Acosta', 'Pérez']);
  });

  it('toma el último valor de cada medida, aunque la última medición no lo traiga', () => {
    expect(perez.alturaCm).toBe(152);
    expect(perez.pesoKg).toBe(40);
  });

  it('lo que no se sabe es null, nunca cero', () => {
    expect(acosta.alturaCm).toBeNull();
    expect(acosta.pesoKg).toBeNull();
    expect(acosta.tiroPct).toBeNull();
    expect(acosta.asistenciaPct).toBeNull();
    expect(acosta.edad).toBeNull();
    expect(acosta.bateria).toBeNull();
    expect(acosta.hoy).toBeNull();
  });

  it('el tiro de la lista es el de arco: no mezcla los libres', () => {
    expect(perez.tiroPct).toBe(40);
    expect(perez.bateria?.libres?.pct).toBe(80);
    expect(perez.bateria?.zonas).toHaveLength(5);
    expect(perez.bateria?.zonas.find((z) => z.id === 'esq_der')?.pct).toBeNull();
  });

  it('cuenta la asistencia, lo marcado hoy y la lesión abierta', () => {
    expect(perez.asistenciaPct).toBe(50);
    expect(perez.hoy).toBe('presente');
    expect(perez.lesion?.id).toBe('l1');
    expect(acosta.lesion).toBeNull();
  });
});

describe('buscarEnFilas', () => {
  it('encuentra sin importar tildes ni mayúsculas', () => {
    const filas = armarFilas(base);
    expect(buscarEnFilas(filas, 'PEREZ').map((f) => f.id)).toEqual(['j1']);
    expect(buscarEnFilas(filas, '  ').length).toBe(2);
    expect(buscarEnFilas(filas, 'zzz')).toEqual([]);
  });
});
