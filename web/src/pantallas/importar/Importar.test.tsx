import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

// El lector de planillas no se prueba acá (tiene sus pruebas en node --test): se le inventa lo que devuelve.
const lector = vi.hoisted(() => ({ inscriptos: vi.fn(), emergencias: vi.fn() }));
vi.mock('@parser/parserInscriptos.js', () => ({ parsearInscriptos: lector.inscriptos }));
vi.mock('@parser/parserEmergencias.js', () => ({ parsearEmergencias: lector.emergencias }));

function simular() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }));
}

beforeEach(simular);
afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.unstubAllGlobals();
  lector.inscriptos.mockReset();
  lector.emergencias.mockReset();
});

// Nombres inventados: nunca datos de chicos reales.
const PLANTEL = [
  { id: 'j-1', nombreClave: 'ACOSTA BRUNO', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: '2013-03-02' },
  { id: 'j-2', nombreClave: 'BENITEZ LUCAS', nombreLimpio: 'Benitez, Lucas', fechaNacimiento: '2013-07-10' },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerPlantelesDelClub: async () => [{ id: 'p-1', categoria: 'Sub 13', categoriaCodigo: 'U13M', codigoCabb: 'U13', temporadaId: 't-1' }],
    obtenerJugadoresDelPlantel: async () => PLANTEL,
    obtenerJugadoresDelClub: async () => PLANTEL.map((j) => ({ id: j.id, nombreClave: j.nombreClave, nombreLimpio: j.nombreLimpio, plantelesActuales: ['p-1'] })),
    ...piso,
  });
}

/** Un .xlsx de mentira: el lector está reemplazado, sólo importa que tenga nombre y que se pueda leer. */
function archivo(nombre = 'planilla.xlsx') {
  const f = new File(['x'], nombre);
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new ArrayBuffer(8) });
  return f;
}

async function abrirHoja(r: Repositorio, boton: string) {
  const u = userEvent.setup();
  renderConDatos(rutas, { repo: r, ruta: '/plantel' });
  const zona = await screen.findByRole('region', { name: 'Importar planillas' });
  await u.click(within(zona).getByRole('button', { name: boton }));
  return u;
}

const fila = (campos: Record<string, unknown>) => ({
  fila: 2, apellido: 'Gomez', nombre: 'Tito', fechaNacimiento: '2013-05-05', categoriaTexto: 'U13 - MIXTO', rama: 'MASCULINO', mail: 'familia@ejemplo.test', ...campos,
});

describe('Importar inscriptos', () => {
  it('explica cómo bajar la planilla y pide un .xlsx', async () => {
    await abrirHoja(repo(), 'Importar inscriptos');
    expect(await screen.findByText(/Archivo → Descargar → Microsoft Excel/)).toBeTruthy();
    const campo = screen.getByLabelText('Planilla de inscriptos (.xlsx)') as HTMLInputElement;
    expect(campo.accept).toBe('.xlsx');
  });

  it('una planilla inválida lo dice sin el código técnico', async () => {
    lector.inscriptos.mockReturnValue({ exito: false, errores: ['[FORMATO_INVALIDO] No es la planilla Para Semillero'], filas: [], advertencias: [] });
    const u = await abrirHoja(repo(), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    expect(await screen.findByText('No es la planilla Para Semillero')).toBeTruthy();
  });

  it('si el lector se rompe, cuenta que no se pudo leer y qué planilla va', async () => {
    lector.inscriptos.mockImplementation(() => { throw new Error('x'); });
    const u = await abrirHoja(repo(), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    expect(await screen.findByText(/No se pudo leer la planilla\. Revisá que sea la de «Para Semillero»/)).toBeTruthy();
  });

  it('una planilla sin chicos de la categoría lo dice, y cuenta las filas que no se muestran', async () => {
    lector.inscriptos.mockReturnValue({
      exito: true, errores: [], advertencias: [],
      filas: [fila({ categoriaTexto: 'U17 - MASCULINO' }), fila({ fila: 3, categoriaTexto: 'U9 - MIXTO' })],
    });
    const u = await abrirHoja(repo(), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    expect(await screen.findByText('No hay chicos de Sub 13 en esta planilla.')).toBeTruthy();
    expect(screen.getByText(/2 filas no se muestran/)).toBeTruthy();
  });

  it('cada chico dice si ya está, es nuevo o es un conflicto; el conflicto y el «sin rama» vienen destildados', async () => {
    lector.inscriptos.mockReturnValue({
      exito: true, errores: [], advertencias: ['fila 9: el mail "x" no es válido.'],
      filas: [
        fila({ apellido: 'Acosta', nombre: 'Bruno', fechaNacimiento: '2013-03-02', mail: 'a@ejemplo.test' }),
        fila({ fila: 3, apellido: 'Gomez', nombre: 'Tito' }),
        fila({ fila: 4, apellido: 'Benitez', nombre: 'Lucas', fechaNacimiento: '2012-01-01' }),
        fila({ fila: 5, apellido: 'Ruiz', nombre: 'Leo', rama: '' }),
      ],
    });
    const u = await abrirHoja(repo(), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    const lista = await screen.findByRole('list', { name: 'Chicos de la planilla' });
    expect(within(lista).getByText('Acosta, Bruno').closest('li')!.textContent).toContain('Ya está en el club · 1 mail');
    expect(within(lista).getByText('Gomez, Tito').closest('li')!.textContent).toContain('Chico nuevo');
    expect(within(lista).getByText('Benitez, Lucas').closest('li')!.textContent).toContain('Mismo nombre, otra fecha');
    expect(within(lista).getByText(/Tildalo sólo si son dos chicos distintos/)).toBeTruthy();
    expect(within(lista).getByText(/Tildalo sólo si juega en U13 masculino/)).toBeTruthy();
    expect((within(lista).getByRole('checkbox', { name: 'Acosta, Bruno' }) as HTMLInputElement).checked).toBe(true);
    expect((within(lista).getByRole('checkbox', { name: 'Gomez, Tito' }) as HTMLInputElement).checked).toBe(true);
    expect((within(lista).getByRole('checkbox', { name: 'Benitez, Lucas' }) as HTMLInputElement).checked).toBe(false);
    expect((within(lista).getByRole('checkbox', { name: 'Ruiz, Leo' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('fila 9: el mail "x" no es válido.')).toBeTruthy();
  });

  it('sin tildar a nadie no guarda y lo dice', async () => {
    const importarInscriptos = vi.fn(async () => ({ creados: 0, existentes: 0 }));
    lector.inscriptos.mockReturnValue({ exito: true, errores: [], advertencias: [], filas: [fila({})] });
    const u = await abrirHoja(repo({ importarInscriptos }), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    await u.click(await screen.findByRole('checkbox', { name: 'Gomez, Tito' }));
    await u.click(screen.getByRole('button', { name: 'Sumar a Sub 13' }));
    expect(await screen.findByText('No tildaste a nadie.')).toBeTruthy();
    expect(importarInscriptos).not.toHaveBeenCalled();
  });

  it('confirma: manda sólo lo tildado, cierra la hoja y cuenta cuántos entraron', async () => {
    const importarInscriptos = vi.fn(async () => ({ creados: 1, existentes: 1 }));
    lector.inscriptos.mockReturnValue({
      exito: true, errores: [], advertencias: [],
      filas: [fila({ apellido: 'Acosta', nombre: 'Bruno', fechaNacimiento: '2013-03-02' }), fila({ fila: 3 })],
    });
    const u = await abrirHoja(repo({ importarInscriptos }), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    await u.click(await screen.findByRole('button', { name: 'Sumar a Sub 13' }));
    await waitFor(() => expect(importarInscriptos).toHaveBeenCalledTimes(1));
    const [pedido] = importarInscriptos.mock.calls[0] as unknown as [{ plantelId: string; filas: { jugadorId?: string; nombreLimpio?: string }[] }];
    expect(pedido.plantelId).toBe('p-1');
    expect(pedido.filas.map((f) => f.jugadorId ?? f.nombreLimpio)).toEqual(['j-1', 'Gomez, Tito']);
    expect(await screen.findByText('Listo: 1 nuevo, 1 que ya estaba.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cuando la base rechaza algo, lo cuenta con palabras de todos los días y deja reintentar', async () => {
    const importarInscriptos = vi.fn(async () => { throw new Error('JUGADOR_YA_EXISTE: gomez tito'); });
    lector.inscriptos.mockReturnValue({ exito: true, errores: [], advertencias: [], filas: [fila({})] });
    const u = await abrirHoja(repo({ importarInscriptos }), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    await u.click(await screen.findByRole('button', { name: 'Sumar a Sub 13' }));
    expect(await screen.findByText('Ya hay un chico con ese nombre y esa fecha. Volvé a subir la planilla.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Sumar a Sub 13' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sin conexión al guardar, lo dice', async () => {
    const importarInscriptos = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    lector.inscriptos.mockReturnValue({ exito: true, errores: [], advertencias: [], filas: [fila({})] });
    const u = await abrirHoja(repo({ importarInscriptos }), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    await u.click(await screen.findByRole('button', { name: 'Sumar a Sub 13' }));
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
  });

  it('un error cualquiera al guardar usa el mensaje de siempre', async () => {
    const importarInscriptos = vi.fn(async () => { throw new Error('FECHA_NACIMIENTO_REQUERIDA'); });
    lector.inscriptos.mockReturnValue({ exito: true, errores: [], advertencias: [], filas: [fila({})] });
    const u = await abrirHoja(repo({ importarInscriptos }), 'Importar inscriptos');
    await u.upload(await screen.findByLabelText('Planilla de inscriptos (.xlsx)'), archivo());
    await u.click(await screen.findByRole('button', { name: 'Sumar a Sub 13' }));
    expect(await screen.findByText('A uno de los chicos le falta la fecha de nacimiento.')).toBeTruthy();
  });
});

describe('Importar emergencias', () => {
  const cruza = (campos: Record<string, unknown> = {}) => ({
    fila: 2, nombre: 'Acosta, Bruno', fechaNacimiento: '2013-03-02', telefonoAdulto: '341 555-0000', contactoUrgencia: 'Tía (341) 555-0001',
    afecciones: '', alergias: '', medicacion: '', indicacion: '', obraSocial: '', ...campos,
  });

  it('avisa que son datos de salud de menores y que el archivo no se guarda, antes de elegir nada', async () => {
    await abrirHoja(repo(), 'Importar emergencias');
    expect(await screen.findByText('Son datos de salud de menores')).toBeTruthy();
    expect(screen.getByText(/nunca la de respuestas completas/)).toBeTruthy();
    expect(screen.getByText(/El archivo no se guarda/)).toBeTruthy();
    expect((screen.getByLabelText('Planilla de emergencias (.xlsx)') as HTMLInputElement).accept).toBe('.xlsx');
  });

  it('una planilla inválida lo dice', async () => {
    lector.emergencias.mockReturnValue({ exito: false, errores: ['[HOJA] Falta la hoja de emergencias'], filas: [], advertencias: [] });
    const u = await abrirHoja(repo(), 'Importar emergencias');
    await u.upload(await screen.findByLabelText('Planilla de emergencias (.xlsx)'), archivo());
    expect(await screen.findByText('Falta la hoja de emergencias')).toBeTruthy();
  });

  it('los que no cruzan con el plantel se cuentan aparte y nunca se crea a nadie', async () => {
    lector.emergencias.mockReturnValue({
      exito: true, errores: [], advertencias: [],
      filas: [cruza(), cruza({ fila: 3, nombre: 'Nadie, Ninguno' })],
    });
    const u = await abrirHoja(repo(), 'Importar emergencias');
    await u.upload(await screen.findByLabelText('Planilla de emergencias (.xlsx)'), archivo());
    const lista = await screen.findByRole('list', { name: 'Chicos de la planilla' });
    expect(within(lista).getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByText(/fila 3: Nadie, Ninguno no se carga \(no hay nadie con ese nombre y esa fecha en este plantel\)/)).toBeTruthy();
    expect(screen.getByText('Si ya tenían datos, se reemplazan por los de la planilla.')).toBeTruthy();
  });

  it('cuenta las alertas médicas de cada chico, o dice que no hay', async () => {
    lector.emergencias.mockReturnValue({
      exito: true, errores: [], advertencias: [],
      filas: [cruza({ afecciones: 'Asma' }), cruza({ fila: 3, nombre: 'Benitez, Lucas', fechaNacimiento: '2013-07-10' })],
    });
    const u = await abrirHoja(repo(), 'Importar emergencias');
    await u.upload(await screen.findByLabelText('Planilla de emergencias (.xlsx)'), archivo());
    const lista = await screen.findByRole('list', { name: 'Chicos de la planilla' });
    expect(within(lista).getByText('Benitez, Lucas').closest('li')!.textContent).toContain('Sin alertas marcadas');
    expect(within(lista).getByText('Acosta, Bruno').closest('li')!.textContent).toMatch(/\d+ alerta/);
  });

  it('con todos tildados por defecto, confirma, cierra y cuenta cuántos quedaron', async () => {
    const importarEmergencias = vi.fn(async () => ({ guardados: 2 }));
    lector.emergencias.mockReturnValue({
      exito: true, errores: [], advertencias: [],
      filas: [cruza(), cruza({ fila: 3, nombre: 'Benitez, Lucas', fechaNacimiento: '2013-07-10' })],
    });
    const u = await abrirHoja(repo({ importarEmergencias }), 'Importar emergencias');
    await u.upload(await screen.findByLabelText('Planilla de emergencias (.xlsx)'), archivo());
    for (const c of await screen.findAllByRole('checkbox')) expect((c as HTMLInputElement).checked).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Cargar los datos' }));
    await waitFor(() => expect(importarEmergencias).toHaveBeenCalledTimes(1));
    const [pedido] = importarEmergencias.mock.calls[0] as unknown as [{ plantelId: string; filas: { jugadorId: string }[] }];
    expect(pedido.plantelId).toBe('p-1');
    expect(pedido.filas.map((f) => f.jugadorId)).toEqual(['j-1', 'j-2']);
    expect(await screen.findByText('Listo: 2 chicos con datos de emergencia.')).toBeTruthy();
  });

  it('sin tildar a nadie no manda nada', async () => {
    const importarEmergencias = vi.fn(async () => ({ guardados: 0 }));
    lector.emergencias.mockReturnValue({ exito: true, errores: [], advertencias: [], filas: [cruza()] });
    const u = await abrirHoja(repo({ importarEmergencias }), 'Importar emergencias');
    await u.upload(await screen.findByLabelText('Planilla de emergencias (.xlsx)'), archivo());
    await u.click(await screen.findByRole('checkbox', { name: 'Acosta, Bruno' }));
    await u.click(screen.getByRole('button', { name: 'Cargar los datos' }));
    expect(await screen.findByText('No tildaste a nadie.')).toBeTruthy();
    expect(importarEmergencias).not.toHaveBeenCalled();
  });

  it('dos errores de la base se cuentan con palabras de todos los días', async () => {
    const importarEmergencias = vi.fn()
      .mockRejectedValueOnce(new Error('JUGADOR_FUERA_DEL_PLANTEL'))
      .mockRejectedValueOnce(new Error('new row violates check constraint "x"'));
    lector.emergencias.mockReturnValue({ exito: true, errores: [], advertencias: [], filas: [cruza()] });
    const u = await abrirHoja(repo({ importarEmergencias } as Partial<Repositorio>), 'Importar emergencias');
    await u.upload(await screen.findByLabelText('Planilla de emergencias (.xlsx)'), archivo());
    await u.click(await screen.findByRole('button', { name: 'Cargar los datos' }));
    expect(await screen.findByText('Alguno de los chicos ya no está en este plantel. Volvé a subir la planilla.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Cargar los datos' }));
    expect(await screen.findByText('Alguno de los datos no cumple la regla de la base. Revisá la planilla.')).toBeTruthy();
  });
});
