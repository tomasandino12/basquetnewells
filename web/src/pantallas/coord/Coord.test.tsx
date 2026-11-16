import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

// Cuando un buscador falla, Testing Library vuelca todo el DOM: acá alcanza con un pedazo.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.DEBUG_PRINT_LIMIT = '500';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
});

// Todo inventado: nombres de ejemplo, nunca datos de chicos ni de gente real.
const COORD = { esEntrenador: false, esCoordinador: true };
const repo = (piso: Partial<Repositorio> = {}) => repositorioInventado({ obtenerMisRoles: async () => COORD, ...piso });
const abrir = (ruta: string, piso: Partial<Repositorio> = {}) => renderConDatos(rutas, { repo: repo(piso), ruta });

const MIEMBROS = [
  { userId: 'u-1', email: 'yo@ejemplo.test', nombre: 'Yo Coordinador', esEntrenador: false, esCoordinador: true, habilitadoEn: '2026-01-01', bajaEn: null },
  { userId: 'u-2', email: 'ana@ejemplo.test', nombre: 'Ana Profe', esEntrenador: true, esCoordinador: false, habilitadoEn: '2026-01-01', bajaEn: null },
  { userId: 'u-3', email: 'luis@ejemplo.test', nombre: 'Luis Ex', esEntrenador: true, esCoordinador: false, habilitadoEn: '2025-01-01', bajaEn: '2026-06-01T10:00:00Z' },
];
const ASIGNACIONES = [{ id: 'a-1', userId: 'u-2', plantelId: 'p-1', desde: '2026-02-01', hasta: null, origen: null }];

describe('la puerta de coordinación', () => {
  it('a un profe sin rol de coordinación le dice de quién es la sección, sin pedir ningún dato', async () => {
    const pedido = vi.fn(async () => ({ planteles: [], tiro: [], partidos: [] }));
    abrir('/coordinacion', { obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }), obtenerPanoramaDelClub: pedido });
    expect(await screen.findByRole('heading', { name: 'Esto es de la coordinación' })).toBeTruthy();
    expect(pedido).not.toHaveBeenCalled();
  });

  it('quien sólo coordina entra (no lo manda a la app de siempre) y ve la barra de secciones', async () => {
    abrir('/coordinacion');
    expect(await screen.findByRole('heading', { level: 1, name: 'Panorama' })).toBeTruthy();
    const barra = screen.getByRole('navigation', { name: 'Secciones de coordinación' });
    expect(within(barra).getAllByRole('link').map((l) => l.textContent)).toEqual(['Panorama', 'Profes', 'Finanzas', 'Familias', 'Inventario']);
  });

  it('sin sesión va a Entrar', async () => {
    const { router } = abrir('/coordinacion/profes', { obtenerSesionActual: async () => null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('un error de carga se cuenta con una salida para reintentar', async () => {
    abrir('/coordinacion', { obtenerPanoramaDelClub: async () => { throw new Error('boom'); } });
    expect(await screen.findByText('No se pudo cargar el panorama.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeTruthy();
  });
});

describe('Panorama', () => {
  it('sin categorías, lo dice', async () => {
    abrir('/coordinacion', { obtenerPlantelesDelClub: async () => [] });
    expect(await screen.findByRole('heading', { name: 'Todavía no hay categorías' })).toBeTruthy();
  });

  it('una tarjeta por categoría en el orden del catálogo, con profe a cargo o «Sin profe asignado»', async () => {
    abrir('/coordinacion', {
      obtenerPanoramaDelClub: async () => ({ planteles: [{ plantelId: 'p-1', jugadores: 14, partidos: 1, ultimaMedicion: '2026-10-20' }], tiro: [], partidos: [] }),
      obtenerMiembrosDelClub: async () => MIEMBROS,
      obtenerAsignacionesDelClub: async () => ASIGNACIONES,
    });
    const titulos = await screen.findAllByRole('heading', { level: 2, name: /Sub 1[35]/ });
    expect(titulos.map((t) => t.textContent)).toEqual(['Sub 13Sub 13', 'Sub 15Sub 15']);
    expect(screen.getByText('A cargo: Ana Profe')).toBeTruthy();
    expect(screen.getByText('Sin profe asignado')).toBeTruthy();
    expect(screen.getByText(/14 jugadores · 1 partido importado · última medición 20\/10/)).toBeTruthy();
    expect(screen.getAllByText(/Todavía no hay baterías ni partidos con tiros/)).toHaveLength(2);
  });

  it('triples: batería y partidos lado a lado, último valor con su fracción y la variación contra la anterior; los libres sin datos no son 0%', async () => {
    const fila = (sesionId: string, fecha: string, anotados: number) => ({ plantelId: 'p-1', sesionId, fecha, posicion: 'frontal', anotados, intentos: 100, jugadoresQueMidieron: 12 });
    abrir('/coordinacion', {
      obtenerPanoramaDelClub: async () => ({
        planteles: [{ plantelId: 'p-1', jugadores: 14, partidos: 0, ultimaMedicion: '2026-10-20' }],
        tiro: [fila('s-1', '2026-09-01', 30), fila('s-2', '2026-10-01', 40)],
        partidos: [],
      }),
    });
    const triples = await screen.findByRole('region', { name: 'Triples de Sub 13' });
    expect(within(triples).getByText('40')).toBeTruthy();
    expect(within(triples).getByText('40/100')).toBeTruthy();
    expect(within(triples).getByText(/vs 01\/09/)).toBeTruthy();
    expect(within(triples).getByText('Sin partidos importados')).toBeTruthy();
    const libres = screen.getByRole('region', { name: 'Libres de Sub 13' });
    expect(within(libres).getAllByText('Sin baterías')).toHaveLength(1);
    expect(within(libres).queryByText(/0%/)).toBeNull();
    // El gráfico lleva el nombre al final de cada línea y su descripción para lectores.
    expect(within(triples).getByRole('img', { name: /0 a 100 por ciento: 2 baterías y 0 partidos/ })).toBeTruthy();
  });

  it('un solo punto no se compara con nada', async () => {
    abrir('/coordinacion', {
      obtenerPanoramaDelClub: async () => ({
        planteles: [], tiro: [{ plantelId: 'p-1', sesionId: 's-1', fecha: '2026-09-01', posicion: 'frontal', anotados: 5, intentos: 8, jugadoresQueMidieron: 5 }], partidos: [],
      }),
    });
    expect(await screen.findByText('Una sola batería: todavía no hay con qué comparar')).toBeTruthy();
    expect(screen.getByText('pocos datos')).toBeTruthy();
  });

  it('«Ver detalles» abre las tablas fecha por fecha', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion', {
      obtenerPanoramaDelClub: async () => ({
        planteles: [], tiro: [{ plantelId: 'p-1', sesionId: 's-1', fecha: '2026-09-01', posicion: 'frontal', anotados: 30, intentos: 100, jugadoresQueMidieron: 9 }],
        partidos: [{ plantelId: 'p-1', partidoId: 'x-1', fecha: '2026-09-10', rival: 'Rival de Ejemplo', tresAnotados: 5, tresIntentados: 20, libresAnotados: 0, libresIntentados: 0 }],
      }),
    });
    await u.click(await screen.findByText(/Ver detalles · Historial de Sub 13/));
    expect(screen.getByText('Triples · Batería')).toBeTruthy();
    expect(screen.getByText('Triples · Partidos')).toBeTruthy();
    expect(screen.getByText('9 jugadores')).toBeTruthy();
    expect(screen.getByText('vs Rival de Ejemplo')).toBeTruthy();
  });

  it('asistencia y logros del equipo salen sólo si se pudieron cargar', async () => {
    abrir('/coordinacion', {
      obtenerAsistenciaDelClub: async () => [{ plantelId: 'p-1', pct: 82.4, entrenamientos: 10 }],
      obtenerMisionesDeEquipo: async () => ({
        previas: [{ id: 'pr-1', fecha: '2026-10-05', rival: 'Rival de Ejemplo', plantelId: 'p-1' }],
        misiones: [{ id: 'm-1', previaId: 'pr-1', estado: 'logrado', metrica: 'rebotes', valor: 30, jugadorId: null }],
      }),
    });
    expect(await screen.findByText('82 % · 10 entrenamientos')).toBeTruthy();
    expect(screen.getAllByRole('region', { name: 'Logros del equipo' })).toHaveLength(2);
    cleanup();
    abrir('/coordinacion', {
      obtenerAsistenciaDelClub: async () => { throw new Error('no'); },
      obtenerMisionesDeEquipo: async () => { throw new Error('no'); },
    });
    await screen.findAllByRole('heading', { level: 2, name: /Sub 13/ });
    expect(screen.queryByText(/Asistencia:/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Logros del equipo' })).toBeNull();
  });

  it('la tarjeta de papeles dice cuántos deben y abre Familias; con Google viejo lo avisa; sin conexión no aparece', async () => {
    const conexion = (ultimoEnvioEn: string | null, conectado = true) => async () => ({
      conectado, rotadoEn: null, ultimoEnvioEn, tableroUrl: null, gidTablero: null, gidPagos: null, documentosOrden: ['DNI'], conceptosOrden: ['Cuota'],
    });
    const chicos = async () => [
      { id: 'c-1', nombre: 'Chico Uno', nombreGoogle: null, categoriaCodigo: 'U13', categoriaTexto: null, rama: 'M', emparejamiento: 'ok' as const, fila: 2, documentos: { DNI: true }, completo: true, pagos: { Cuota: 'verificado' as const }, cambioEn: null },
      { id: 'c-2', nombre: 'Chico Dos', nombreGoogle: null, categoriaCodigo: 'U13', categoriaTexto: null, rama: 'M', emparejamiento: 'ok' as const, fila: 3, documentos: { DNI: false }, completo: false, pagos: { Cuota: 'falta' as const }, cambioEn: null },
    ];
    const u = userEvent.setup();
    const { router } = abrir('/coordinacion', { obtenerEstadoInscripcion: chicos, obtenerConexionGoogle: conexion('2020-01-01T00:00:00Z') });
    const tarjeta = await screen.findByRole('link', { name: /Papeles y pagos/ });
    expect(tarjeta.textContent).toMatch(/1\s*deben algo · 1\s*sin los papeles completos · sin novedades de Google hace horas/);
    await u.click(tarjeta);
    expect(router.state.location.pathname).toBe('/coordinacion/familias');
    cleanup();
    abrir('/coordinacion', { obtenerEstadoInscripcion: chicos, obtenerConexionGoogle: conexion(null, false) });
    await screen.findAllByRole('heading', { level: 2, name: /Sub 13/ });
    expect(screen.queryByRole('link', { name: /Papeles y pagos/ })).toBeNull();
  });
});

describe('Profes', () => {
  const PENDIENTE = { userId: 'u-9', email: 'nuevo@ejemplo.test', nombre: 'Nuevo Profe', registradoEn: '2026-11-01T10:00:00Z', esJugador: false };
  const JUGADOR = { userId: 'u-8', email: 'jugador@ejemplo.test', nombre: null, registradoEn: '2026-11-02T10:00:00Z', esJugador: true };
  const piso = (extra: Partial<Repositorio> = {}): Partial<Repositorio> => ({
    obtenerMiembrosDelClub: async () => MIEMBROS,
    obtenerAsignacionesDelClub: async () => ASIGNACIONES,
    obtenerUsuariosPendientes: async () => [PENDIENTE, JUGADOR],
    ...extra,
  });

  it('muestra lo que esperan, las categorías sin profe, los profes con sus categorías y los ex miembros', async () => {
    abrir('/coordinacion/profes', piso());
    expect(await screen.findByText('Nuevo Profe')).toBeTruthy();
    expect(screen.getByText(/Es jugador del club · Se registró el 02\/11/)).toBeTruthy();
    const sinProfe = screen.getByRole('region', { name: 'Categorías sin profe' });
    expect(within(sinProfe).getByText('Sub 15')).toBeTruthy();
    expect(within(sinProfe).queryByText('Sub 13')).toBeNull();
    const profes = screen.getByRole('region', { name: 'Profes del club' });
    expect(within(profes).getByText('Ana Profe')).toBeTruthy();
    expect(within(profes).queryByText('Luis Ex')).toBeNull();
    expect(screen.getByText('Ex miembros del club (1)')).toBeTruthy();
  });

  it('a un jugador con cuenta no se lo puede rechazar (sólo habilitar)', async () => {
    abrir('/coordinacion/profes', piso());
    await screen.findByText('Nuevo Profe');
    expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Habilitar' })).toHaveLength(2);
  });

  it('rechazar pide confirmación y no rechaza hasta que se confirma', async () => {
    const u = userEvent.setup();
    const descartar = vi.fn(async () => {});
    abrir('/coordinacion/profes', piso({ descartarCuenta: descartar }));
    await u.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(descartar).not.toHaveBeenCalled();
    const hoja = await screen.findByRole('dialog');
    // La hoja repite su texto para lectores de pantalla (descripción oculta): alcanza con que esté.
    expect(within(hoja).getAllByText(/sale de la lista y no entra a la app/).length).toBeGreaterThan(0);
    await u.click(within(hoja).getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(descartar).toHaveBeenCalledWith({ userId: 'u-9', clubId: 'c-1' }));
    expect(await screen.findByText('Listo: Nuevo Profe ya no figura en la lista.')).toBeTruthy();
  });

  it('habilitar exige marcar al menos una categoría y asigna las marcadas', async () => {
    const u = userEvent.setup();
    const asignar = vi.fn(async ({ plantelIds }: { plantelIds: string[] }) => ({ asignadas: plantelIds.length }));
    abrir('/coordinacion/profes', piso({ asignarPlanteles: asignar }));
    await u.click((await screen.findAllByRole('button', { name: 'Habilitar' }))[0]);
    const hoja = await screen.findByRole('dialog');
    const confirmar = within(hoja).getByRole('button', { name: 'Habilitar y asignar' }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await u.click(within(hoja).getByRole('button', { name: 'Sub 15' }));
    await u.click(confirmar);
    await waitFor(() => expect(asignar).toHaveBeenCalledWith({ userId: 'u-9', clubId: 'c-1', plantelIds: ['p-2'] }));
    expect(await screen.findByText('Listo: Nuevo Profe ya puede entrar, con 1 categoría.')).toBeTruthy();
  });

  it('habilitar a un jugador avisa que se le cierra su acceso de jugador', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/profes', piso());
    await u.click((await screen.findAllByRole('button', { name: 'Habilitar' }))[1]);
    expect((await screen.findAllByText(/su acceso de jugador se cierra/)).length).toBeGreaterThan(0);
  });

  it('buscar un jugador por mail: lo encuentra y abre la habilitación, o dice que no está', async () => {
    const u = userEvent.setup();
    const buscar = vi.fn(async ({ email }: { email: string }) => (email === 'esta@ejemplo.test' ? JUGADOR : null));
    abrir('/coordinacion/profes', piso({ buscarJugadorParaHabilitar: buscar }));
    const campo = await screen.findByLabelText(/Buscalo por mail/);
    await u.type(campo, 'nada@ejemplo.test');
    await u.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No encontramos ningún jugador con ese mail en el club.')).toBeTruthy();
    await u.clear(campo);
    await u.type(campo, 'esta@ejemplo.test');
    await u.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('quitar una categoría confirma antes; dar de baja confirma y no se ofrece a uno mismo ni a coordinación', async () => {
    const u = userEvent.setup();
    const quitar = vi.fn(async () => {});
    const baja = vi.fn(async () => ({ asignacionesCerradas: 1 }));
    abrir('/coordinacion/profes', piso({ cerrarAsignacion: quitar, darDeBajaProfe: baja }));
    const profes = await screen.findByRole('region', { name: 'Profes del club' });
    // Yo (coordinación): sin Asignar ni Dar de baja.
    expect(within(profes).queryByRole('button', { name: 'Dar de baja a Yo Coordinador' })).toBeNull();
    expect(within(profes).queryByRole('button', { name: 'Asignar categorías a Yo Coordinador' })).toBeNull();
    await u.click(within(profes).getByRole('button', { name: 'Quitar Sub 13 a Ana Profe' }));
    expect(quitar).not.toHaveBeenCalled();
    let hoja = await screen.findByRole('dialog');
    await u.click(within(hoja).getByRole('button', { name: 'Quitar Sub 13' }));
    await waitFor(() => expect(quitar).toHaveBeenCalledWith('a-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await u.click(within(profes).getByRole('button', { name: 'Dar de baja a Ana Profe' }));
    expect(baja).not.toHaveBeenCalled();
    hoja = await screen.findByRole('dialog');
    await u.click(within(hoja).getByRole('button', { name: 'Dar de baja' }));
    await waitFor(() => expect(baja).toHaveBeenCalledWith({ userId: 'u-2', clubId: 'c-1' }));
  });

  it('un error de la base se cuenta en palabras, con la hoja abierta', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/profes', piso({ darDeBajaProfe: async () => { throw new Error('NO_ES_UNO_MISMO'); } }));
    await u.click(await screen.findByRole('button', { name: 'Dar de baja a Ana Profe' }));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Dar de baja' }));
    expect(await screen.findByText('No podés darte de baja a vos mismo.')).toBeTruthy();
  });

  it('asignar una categoría sin profe: elige entre los entrenadores', async () => {
    const u = userEvent.setup();
    const asignar = vi.fn(async () => ({ asignadas: 1 }));
    abrir('/coordinacion/profes', piso({ asignarPlanteles: asignar }));
    const sinProfe = await screen.findByRole('region', { name: 'Categorías sin profe' });
    await u.click(within(sinProfe).getByRole('button', { name: 'Asignar' }));
    const hoja = await screen.findByRole('dialog');
    await u.click(within(hoja).getByRole('button', { name: 'Ana Profe' }));
    await waitFor(() => expect(asignar).toHaveBeenCalledWith({ userId: 'u-2', clubId: 'c-1', plantelIds: ['p-2'] }));
  });

  it('emergencias por categoría: sólo lectura, con las alertas primero, y se vuelven a pedir cada vez', async () => {
    const u = userEvent.setup();
    const pedir = vi.fn(async () => [
      { jugadorId: 'j-1', nombreLimpio: 'Sin Alertas, Uno', cargado: true, alertas: [], telefonoAdulto: '341 555 0001', contactoUrgencia: null, alergias: null, medicacion: null, indicacion: null, obraSocial: null },
      { jugadorId: 'j-2', nombreLimpio: 'Con Alerta, Dos', cargado: true, alertas: ['asma'], telefonoAdulto: null, contactoUrgencia: '341 555 0002', alergias: 'Polen', medicacion: null, indicacion: null, obraSocial: null },
      { jugadorId: 'j-3', nombreLimpio: 'Sin Datos, Tres', cargado: false, alertas: [], telefonoAdulto: null, contactoUrgencia: null, alergias: null, medicacion: null, indicacion: null, obraSocial: null },
    ]);
    abrir('/coordinacion/profes', piso({ obtenerEmergenciasDelPlantel: pedir }));
    const seccion = await screen.findByRole('region', { name: 'Datos de emergencia' });
    await u.click(within(seccion).getByRole('button', { name: 'Sub 13' }));
    const hoja = await screen.findByRole('dialog');
    const nombres = (await within(hoja).findAllByRole('listitem')).map((l) => l.querySelector('p')?.textContent);
    expect(nombres[0]).toBe('Con Alerta, Dos');
    expect(within(hoja).getByText('sin datos cargados')).toBeTruthy();
    expect(within(hoja).queryByRole('button', { name: /Guardar|Editar/ })).toBeNull();
    await u.click(within(hoja).getAllByRole('button', { name: 'Cerrar' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await u.click(within(seccion).getByRole('button', { name: 'Sub 13' }));
    await within(await screen.findByRole('dialog')).findAllByRole('listitem');
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('aclara de una vez los códigos de Mayores', async () => {
    abrir('/coordinacion/profes', piso({
      obtenerPlantelesDelClub: async () => [{ id: 'p-7', categoria: 'MAY_M', categoriaCodigo: 'MAY_M', codigoCabb: null, temporadaId: 't-1' }],
      obtenerCatalogoDeCategorias: async () => [{ codigo: 'MAY_M', nombre: 'Mayores masculino', orden: 1 }],
    }));
    expect(await screen.findByText('MAY_M es Mayores masculino.')).toBeTruthy();
  });

  it('«Cambio de temporada» lleva a su pantalla', async () => {
    const u = userEvent.setup();
    const { router } = abrir('/coordinacion/profes', piso());
    await u.click(await screen.findByRole('link', { name: 'Cambio de temporada' }));
    expect(router.state.location.pathname).toBe('/coordinacion/temporada');
  });
});

describe('Temporada', () => {
  const PASES = [
    { jugadorId: 'j-1', nombreLimpio: 'Ejemplo, Ana', anioNacimiento: 2013, codigos: ['U13M'] },
    { jugadorId: 'j-2', nombreLimpio: 'Ejemplo, Beto', anioNacimiento: null, codigos: ['U13M'] },
  ];
  const planteles = async () => [
    { id: 'p-1', categoria: 'Sub 13', categoriaCodigo: 'U13M', codigoCabb: null, temporadaId: 't-1' },
    { id: 'p-2', categoria: 'Sub 15', categoriaCodigo: 'U15M', codigoCabb: null, temporadaId: 't-1' },
  ];
  const catalogo = async () => [{ codigo: 'U13M', nombre: 'Sub 13', orden: 1 }, { codigo: 'U15M', nombre: 'Sub 15', orden: 2 }];

  it('paso 1: sin pases, ofrece abrir la temporada nueva y pide confirmación', async () => {
    const u = userEvent.setup();
    const abrirT = vi.fn(async () => ({}));
    abrir('/coordinacion/temporada', { obtenerPlantelesDelClub: planteles, obtenerCatalogoDeCategorias: catalogo, abrirTemporada: abrirT });
    await u.click(await screen.findByRole('button', { name: 'Abrir la temporada 2027' }));
    expect(abrirT).not.toHaveBeenCalled();
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abrir la 2027' }));
    await waitFor(() => expect(abrirT).toHaveBeenCalledWith({ clubId: 'c-1', nombre: '2027' }));
    expect(await screen.findByText('Listo: la temporada 2027 está abierta.')).toBeTruthy();
  });

  it('una temporada que no es un año no se puede armar sola', async () => {
    abrir('/coordinacion/temporada', { obtenerTemporadasDelClub: async () => [{ id: 't-1', nombre: 'Verano' }] });
    expect(await screen.findByText(/no es un año/)).toBeTruthy();
  });

  it('paso 2: avisa de los planteles sin profe; paso 3: pases por año de nacimiento, agrupados', async () => {
    abrir('/coordinacion/temporada', { obtenerPlantelesDelClub: planteles, obtenerCatalogoDeCategorias: catalogo, obtenerPasesDeTemporada: async () => PASES, obtenerMiembrosDelClub: async () => MIEMBROS, obtenerAsignacionesDelClub: async () => ASIGNACIONES });
    expect(await screen.findByText(/Paso 2 · Falta profe en Sub 15/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Asignar profes' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Para decidir vos' })).toBeTruthy();
    // El chico sin fecha de nacimiento queda para decidir; la propuesta de los otros sale del año.
    const decidir = screen.getByRole('region', { name: 'Para decidir vos' });
    expect(within(decidir).getByLabelText('Ejemplo, Beto')).toBeTruthy();
    expect(within(decidir).getByText(/Sin fecha de nacimiento/)).toBeTruthy();
  });

  it('confirmar sin elegir a nadie lo dice; confirmar manda sólo a los elegidos (los de «decidir después» no)', async () => {
    const u = userEvent.setup();
    const confirmar = vi.fn(async ({ filas }: { filas: unknown[] }) => ({ pasados: filas.length }));
    abrir('/coordinacion/temporada', { obtenerPlantelesDelClub: planteles, obtenerCatalogoDeCategorias: catalogo, obtenerPasesDeTemporada: async () => [PASES[1]], confirmarPases: confirmar });
    await u.click(await screen.findByRole('button', { name: 'Confirmar los pases' }));
    expect(screen.getByText('No elegiste a nadie todavía.')).toBeTruthy();
    expect(confirmar).not.toHaveBeenCalled();
    await u.selectOptions(screen.getByLabelText('Ejemplo, Beto'), 'no_sigue');
    await u.click(screen.getByRole('button', { name: 'Confirmar los pases' }));
    const hoja = await screen.findByRole('dialog');
    expect(within(hoja).getAllByText(/1 dejan de estar en el club \(se borran sus datos de emergencia; su historia queda\)/).length).toBeGreaterThan(0);
    await u.click(within(hoja).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith({ clubId: 'c-1', filas: [{ jugadorId: 'j-2', plantelId: null }] }));
  });
});

describe('Rubros', () => {
  const RUBROS = [
    { id: 'r-1', nombre: 'Patrocinios', tipo: 'ingreso' as const, activo: true },
    { id: 'r-2', nombre: 'Arbitrajes', tipo: 'egreso' as const, activo: true },
    { id: 'r-3', nombre: 'Viejo', tipo: 'egreso' as const, activo: false },
  ];

  it('separa ingresos y egresos y marca el desactivado; recuerda no usar nombres de personas', async () => {
    abrir('/coordinacion/rubros', { obtenerRubros: async () => RUBROS });
    expect(await screen.findByRole('region', { name: 'Ingresos' })).toBeTruthy();
    const egresos = screen.getByRole('region', { name: 'Egresos' });
    expect(within(egresos).getByText('Desactivado')).toBeTruthy();
    expect(screen.getByText(/nunca de personas/)).toBeTruthy();
  });

  it('sin rubros, explica cómo empezar', async () => {
    abrir('/coordinacion/rubros');
    expect(await screen.findByRole('heading', { name: 'Todavía no hay rubros' })).toBeTruthy();
  });

  it('alta: pide nombre y tipo, rechaza un nombre repetido (aunque cambie la mayúscula) y guarda con el tipo elegido', async () => {
    const u = userEvent.setup();
    const agregar = vi.fn(async () => ({}));
    abrir('/coordinacion/rubros', { obtenerRubros: async () => RUBROS, agregarRubro: agregar });
    await u.click(await screen.findByRole('button', { name: 'Agregar rubro' }));
    const hoja = await screen.findByRole('dialog');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja).getByText('Poné un nombre para el rubro.')).toBeTruthy();
    await u.type(within(hoja).getByLabelText('Nombre'), 'arbitrajes');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja).getByText('Elegí si es de ingreso o egreso.')).toBeTruthy();
    await u.click(within(hoja).getByRole('button', { name: 'Egreso (−)' }));
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja).getByText('Ya hay un rubro con ese nombre.')).toBeTruthy();
    expect(agregar).not.toHaveBeenCalled();
    await u.clear(within(hoja).getByLabelText('Nombre'));
    await u.type(within(hoja).getByLabelText('Nombre'), 'Alquiler de cancha');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(agregar).toHaveBeenCalledWith({ clubId: 'c-1', nombre: 'Alquiler de cancha', tipo: 'egreso' }));
  });

  it('editar: cambia el nombre (el tipo no se toca) y activa o desactiva', async () => {
    const u = userEvent.setup();
    const editar = vi.fn(async () => ({}));
    abrir('/coordinacion/rubros', { obtenerRubros: async () => RUBROS, editarRubro: editar });
    await u.click(await screen.findByRole('button', { name: /^Viejo/ }));
    const hoja = await screen.findByRole('dialog');
    expect(within(hoja).getAllByText(/Está desactivado: no se ofrece al cargar/).length).toBeGreaterThan(0);
    expect(within(hoja).queryByRole('button', { name: 'Ingreso (+)' })).toBeNull();
    await u.click(within(hoja).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('r-3', { activo: true }));
  });

  it('un nombre repetido que sólo detecta la base también se cuenta bien', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/rubros', { obtenerRubros: async () => RUBROS, agregarRubro: async () => { throw Object.assign(new Error('dup'), { code: '23505' }); } });
    await u.click(await screen.findByRole('button', { name: 'Agregar rubro' }));
    const hoja = await screen.findByRole('dialog');
    await u.type(within(hoja).getByLabelText('Nombre'), 'Otro');
    await u.click(within(hoja).getByRole('button', { name: 'Ingreso (+)' }));
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(await within(hoja).findByText('Ya hay un rubro con ese nombre.')).toBeTruthy();
  });
});

describe('Finanzas', () => {
  const RUBROS = [
    { id: 'r-1', nombre: 'Patrocinios', tipo: 'ingreso' as const, activo: true },
    { id: 'r-2', nombre: 'Arbitrajes', tipo: 'egreso' as const, activo: true },
  ];
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const MOVS = [
    { id: 'm-1', fecha: `${mesActual}-05`, rubroId: 'r-1', centavos: 150000, descripcion: 'Aporte de ejemplo', comprobanteUrl: 'https://drive.google.com/x' },
    { id: 'm-2', fecha: `${mesActual}-06`, rubroId: 'r-2', centavos: 50050, descripcion: '', comprobanteUrl: null },
  ];

  it('sin rubros, manda a crearlos', async () => {
    abrir('/coordinacion/finanzas');
    expect(await screen.findByRole('link', { name: 'Crear rubros' })).toBeTruthy();
  });

  it('muestra ingresos, egresos y resultado a favor, por rubro y los movimientos con su signo en texto', async () => {
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: async () => MOVS });
    // El total de ingresos y su línea por rubro dicen lo mismo: hay más de uno.
    expect((await screen.findAllByText('+ $ 1.500,00')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('− $ 500,50').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('+ $ 999,50')).toBeTruthy();
    expect(screen.getByText('a favor')).toBeTruthy();
    const porRubro = screen.getByRole('region', { name: 'Por rubro' });
    expect(within(porRubro).getByText('Ingreso (+) · 1 movimiento')).toBeTruthy();
    const movs = screen.getByRole('region', { name: 'Movimientos' });
    expect(within(movs).getByText('Aporte de ejemplo · con comprobante')).toBeTruthy();
  });

  it('resultado en contra y en cero se dicen en palabras', async () => {
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: async () => [MOVS[1]] });
    expect(await screen.findByText('en contra')).toBeTruthy();
    cleanup();
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: async () => [] });
    expect(await screen.findByText('en cero')).toBeTruthy();
    expect(screen.getByText(/Todavía no hay movimientos en/)).toBeTruthy();
  });

  it('mes anterior y siguiente piden el período vecino', async () => {
    const u = userEvent.setup();
    const pedir = vi.fn(async () => [] as typeof MOVS);
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: pedir });
    await u.click(await screen.findByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(pedir).toHaveBeenCalledTimes(2));
    const [, rango] = pedir.mock.calls[1] as unknown as [string, { desde: string; hasta: string }];
    expect(rango.hasta).toBe(`${mesActual}-01`);
    await u.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await waitFor(() => expect(pedir).toHaveBeenCalledTimes(2));
  });

  it('cargar: valida el monto con la regla de siempre y guarda centavos enteros', async () => {
    const u = userEvent.setup();
    const agregar = vi.fn(async () => ({}));
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: async () => [], agregarMovimiento: agregar });
    await u.click(await screen.findByRole('button', { name: 'Cargar movimiento' }));
    const hoja = await screen.findByRole('dialog');
    await u.selectOptions(within(hoja).getByLabelText('Rubro'), 'r-2');
    await u.type(within(hoja).getByLabelText('Monto en pesos'), '1e2');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja).getByText(/Escribí sólo números/)).toBeTruthy();
    expect(agregar).not.toHaveBeenCalled();
    await u.clear(within(hoja).getByLabelText('Monto en pesos'));
    await u.type(within(hoja).getByLabelText('Monto en pesos'), '1.234,50');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(agregar).toHaveBeenCalledWith(expect.objectContaining({ clubId: 'c-1', rubroId: 'r-2', centavos: 123450, descripcion: '', comprobanteUrl: null })));
  });

  it('un comprobante que no es https se rechaza antes de guardar', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: async () => [] });
    await u.click(await screen.findByRole('button', { name: 'Cargar movimiento' }));
    const hoja = await screen.findByRole('dialog');
    await u.selectOptions(within(hoja).getByLabelText('Rubro'), 'r-1');
    await u.type(within(hoja).getByLabelText('Monto en pesos'), '100');
    await u.type(within(hoja).getByLabelText('Link al comprobante (opcional)'), 'http://x.com');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja).getByText(/tiene que empezar con https:\/\//)).toBeTruthy();
  });

  it('editar trae el monto escrito como se tipea, y borrar pide confirmación', async () => {
    const u = userEvent.setup();
    const borrar = vi.fn(async () => {});
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => RUBROS, obtenerMovimientosDelPeriodo: async () => MOVS, borrarMovimiento: borrar });
    await u.click(await screen.findByRole('button', { name: /Arbitrajes/ }));
    const hoja = await screen.findByRole('dialog');
    expect((within(hoja).getByLabelText('Monto en pesos') as HTMLInputElement).value).toBe('500,50');
    await u.click(within(hoja).getByRole('button', { name: 'Borrar movimiento' }));
    expect(borrar).not.toHaveBeenCalled();
    const confirmar = (await screen.findAllByText(/deja de contar en los totales/))[0];
    await u.click(within(confirmar.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(borrar).toHaveBeenCalledWith('m-2'));
    expect(await screen.findByText('Listo: movimiento borrado.')).toBeTruthy();
  });

  it('un rubro desactivado no se ofrece al cargar', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/finanzas', { obtenerRubros: async () => [...RUBROS, { id: 'r-9', nombre: 'Apagado', tipo: 'egreso', activo: false }], obtenerMovimientosDelPeriodo: async () => [] });
    await u.click(await screen.findByRole('button', { name: 'Cargar movimiento' }));
    const hoja = await screen.findByRole('dialog');
    expect(within(hoja).queryByRole('option', { name: /Apagado/ })).toBeNull();
    expect(within(hoja).getByRole('option', { name: /Arbitrajes/ })).toBeTruthy();
  });
});

describe('Formularios', () => {
  const F = (id: string, titulo: string, orden: number, extra: Record<string, unknown> = {}) => ({ id, titulo, texto: `Texto de ${titulo}`, enlace: 'https://forms.gle/abc', orden, activo: true, destino: null, ...extra });

  it('sin formularios, explica y ofrece agregar', async () => {
    abrir('/coordinacion/formularios');
    expect(await screen.findByRole('heading', { name: 'Todavía no hay formularios' })).toBeTruthy();
    expect(screen.getByText(/no pongas nombres de chicos/)).toBeTruthy();
  });

  it('lista en orden, con el destino y el «Oculto» como texto; subir y bajar guardan sólo lo que cambió', async () => {
    const u = userEvent.setup();
    const reordenar = vi.fn(async () => ({}));
    abrir('/coordinacion/formularios', {
      listarFormularios: async () => [F('f-2', 'Segundo', 2, { activo: false }), F('f-1', 'Primero', 1, { destino: 'inscripcion' })],
      reordenarFormularios: reordenar,
    });
    await screen.findByText('Primero');
    expect(screen.getByText('Inscripción')).toBeTruthy();
    expect(screen.getByText('Oculto')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Subir Primero' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Bajar Segundo' }) as HTMLButtonElement).disabled).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Bajar Primero' }));
    await waitFor(() => expect(reordenar).toHaveBeenCalledWith([{ id: 'f-1', orden: 2 }, { id: 'f-2', orden: 1 }]));
  });

  it('agregar valida el enlace de Google Forms y avisa qué formulario pierde el lugar especial', async () => {
    const u = userEvent.setup();
    const crear = vi.fn(async () => ({}));
    const sacar = vi.fn(async () => ({}));
    abrir('/coordinacion/formularios', {
      listarFormularios: async () => [F('f-1', 'Quiero jugar', 1, { destino: 'consultas' })],
      crearFormulario: crear,
      asignarDestinoFormulario: sacar,
    });
    await u.click(await screen.findByRole('button', { name: 'Agregar formulario' }));
    const hoja = await screen.findByRole('dialog');
    await u.type(within(hoja).getByLabelText('Título'), 'Nuevo');
    await u.type(within(hoja).getByLabelText(/Para qué es/), 'Para probar');
    await u.type(within(hoja).getByLabelText('Enlace del formulario'), 'https://ejemplo.com/x');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja).getByText(/tiene que ser de Google Forms/)).toBeTruthy();
    expect(crear).not.toHaveBeenCalled();
    await u.clear(within(hoja).getByLabelText('Enlace del formulario'));
    await u.type(within(hoja).getByLabelText('Enlace del formulario'), 'https://forms.gle/nuevo');
    await u.selectOptions(within(hoja).getByLabelText('Cómo se muestra en la página'), 'consultas');
    expect(within(hoja).getByText(/Hoy lo tiene «Quiero jugar»: al guardar, ese formulario pasa a ser común/)).toBeTruthy();
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(sacar).toHaveBeenCalledWith('f-1', null));
    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ clubId: 'c-1', titulo: 'Nuevo', destino: 'consultas', orden: 2 })));
  });

  it('si el guardado falla, el formulario que tenía el lugar lo recupera', async () => {
    const u = userEvent.setup();
    const asignar = vi.fn(async () => ({}));
    abrir('/coordinacion/formularios', {
      listarFormularios: async () => [F('f-1', 'Quiero jugar', 1, { destino: 'consultas' })],
      crearFormulario: async () => { throw new Error('boom'); },
      asignarDestinoFormulario: asignar,
    });
    await u.click(await screen.findByRole('button', { name: 'Agregar formulario' }));
    const hoja = await screen.findByRole('dialog');
    await u.type(within(hoja).getByLabelText('Título'), 'Nuevo');
    await u.type(within(hoja).getByLabelText(/Para qué es/), 'Para probar');
    await u.type(within(hoja).getByLabelText('Enlace del formulario'), 'https://forms.gle/nuevo');
    await u.selectOptions(within(hoja).getByLabelText('Cómo se muestra en la página'), 'consultas');
    await u.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(asignar).toHaveBeenLastCalledWith('f-1', 'consultas'));
  });

  it('ocultar un formulario lo deja guardado sin tocar el resto', async () => {
    const u = userEvent.setup();
    const actualizar = vi.fn(async () => ({}));
    abrir('/coordinacion/formularios', { listarFormularios: async () => [F('f-1', 'Primero', 1)], actualizarFormulario: actualizar });
    await u.click(await screen.findByText('Primero'));
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ocultar de la página' }));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('f-1', expect.objectContaining({ activo: false, titulo: 'Primero' })));
  });
});

describe('Familias: papeles y pagos', () => {
  const chico = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
    id, nombre, nombreGoogle: null, categoriaCodigo: 'U13M', categoriaTexto: null, rama: 'M', emparejamiento: 'ok' as const, fila: 4,
    documentos: { DNI: true }, completo: true, pagos: { Cuota: 'verificado' as const }, cambioEn: null, ...extra,
  });
  const CHICOS = [
    chico('c-1', 'Ejemplo, Al Día'),
    chico('c-2', 'Ejemplo, Debe', { documentos: { DNI: false }, completo: false, pagos: { Cuota: 'falta' } }),
    chico('c-3', 'Ejemplo, Por Verificar', { pagos: { Cuota: 'subido' } }),
    chico('c-4', 'Ejemplo, Sin Tablero', { emparejamiento: 'sin_tablero', fila: null, completo: null, pagos: {} }),
  ];
  const conexion = (extra: Record<string, unknown> = {}) => async () => ({
    conectado: true, rotadoEn: '2026-11-01T00:00:00Z', ultimoEnvioEn: new Date().toISOString(), tableroUrl: 'https://docs.google.com/spreadsheets/d/x',
    gidTablero: 1, gidPagos: 2, documentosOrden: ['DNI'], conceptosOrden: ['Cuota'], ...extra,
  });
  const piso = (extra: Partial<Repositorio> = {}): Partial<Repositorio> => ({
    obtenerEstadoInscripcion: async () => CHICOS,
    obtenerConexionGoogle: conexion(),
    obtenerCatalogoDeCategorias: async () => [{ codigo: 'U13M', nombre: 'Sub 13', orden: 1 }],
    ...extra,
  });

  it('sin conexión, ofrece conectar con Google', async () => {
    abrir('/coordinacion/familias', piso({ obtenerEstadoInscripcion: async () => [], obtenerConexionGoogle: conexion({ conectado: false, ultimoEnvioEn: null }) }));
    expect(await screen.findByRole('button', { name: 'Conectar con Google' })).toBeTruthy();
  });

  it('agrupa a los chicos por emparejamiento y cuenta documentación y pagos', async () => {
    abrir('/coordinacion/familias', piso());
    const sin = await screen.findByRole('region', { name: 'No figuran en el tablero' });
    expect(within(sin).getByText('Ejemplo, Sin Tablero')).toBeTruthy();
    expect(screen.getByText('2/4')).toBeTruthy();
    expect(screen.getByText('1 verif.')).toBeTruthy();
    expect(screen.getByText('1 por verif.')).toBeTruthy();
  });

  it('filtra por estado y por categoría, y dice cuando nadie cumple', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/familias', piso());
    await screen.findByText('Ejemplo, Debe');
    await u.click(screen.getByRole('button', { name: 'Debe algo' }));
    expect(screen.getByText('Ejemplo, Debe')).toBeTruthy();
    expect(screen.queryByText('Ejemplo, Al Día')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Debe algo' }));
    await u.click(screen.getByRole('button', { name: 'Por verificar' }));
    expect(screen.queryByText('Ejemplo, Debe')).toBeNull();
    expect(screen.getByText('Ejemplo, Por Verificar')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Por verificar' }));
    await u.click(screen.getByRole('button', { name: 'Le falta documentación' }));
    expect(screen.getByText('Ejemplo, Debe')).toBeTruthy();
    expect(screen.queryByText('Ejemplo, Al Día')).toBeNull();
  });

  it('abrir un chico muestra sus documentos, pagos y los enlaces al tablero y a Drive (nunca el archivo)', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/familias', piso());
    await u.click(await screen.findByRole('button', { name: /Ejemplo, Debe/ }));
    expect(screen.getByText('Documentos')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver en el tablero' }).getAttribute('href')).toBe('https://docs.google.com/spreadsheets/d/x/edit#gid=1&range=A4:Z4');
    expect(screen.getByRole('link', { name: 'Ver pagos' }).getAttribute('href')).toContain('gid=2');
    expect(screen.getByRole('link', { name: 'Carpeta en Drive' })).toBeTruthy();
    cleanup();
    abrir('/coordinacion/familias', piso());
    await u.click(await screen.findByRole('button', { name: /Ejemplo, Sin Tablero/ }));
    expect(screen.getByText(/No figura en el tablero: no hay datos de papeles ni de pagos/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Carpeta en Drive' })).toBeNull();
  });

  it('avisa si Google no manda nada hace más de 2 horas', async () => {
    abrir('/coordinacion/familias', piso({ obtenerConexionGoogle: conexion({ ultimoEnvioEn: '2020-01-01T00:00:00Z' }) }));
    expect(await screen.findByText('Hace más de 2 horas que Google no manda nada.')).toBeTruthy();
  });

  it('el token se ve una sola vez y se borra al cerrar la hoja', async () => {
    const u = userEvent.setup();
    const rotar = vi.fn(async () => 'token-de-ejemplo-123');
    abrir('/coordinacion/familias', piso({ obtenerConexionGoogle: conexion({ conectado: false, ultimoEnvioEn: null }), obtenerEstadoInscripcion: async () => [], rotarConexionGoogle: rotar }));
    await u.click(await screen.findByRole('button', { name: 'Conectar con Google' }));
    const hoja = await screen.findByRole('dialog');
    expect((within(hoja).getByLabelText('Token del script') as HTMLInputElement).value).toBe('token-de-ejemplo-123');
    await u.click(within(hoja).getByRole('button', { name: 'Ya lo pegué' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.textContent).not.toContain('token-de-ejemplo-123');
  });

  it('cambiar el token y desconectar piden confirmación', async () => {
    const u = userEvent.setup();
    const desconectar = vi.fn(async () => {});
    const rotar = vi.fn(async () => 'otro-token');
    abrir('/coordinacion/familias', piso({ desconectarGoogle: desconectar, rotarConexionGoogle: rotar }));
    await u.click(await screen.findByRole('button', { name: 'Desconectar' }));
    expect(desconectar).not.toHaveBeenCalled();
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desconectar' }));
    await waitFor(() => expect(desconectar).toHaveBeenCalledWith('c-1'));
    expect(rotar).not.toHaveBeenCalled();
  });

  it('un error de permiso al conectar se cuenta en palabras', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/familias', piso({ obtenerConexionGoogle: conexion({ conectado: false, ultimoEnvioEn: null }), obtenerEstadoInscripcion: async () => [], rotarConexionGoogle: async () => { throw new Error('42501'); } }));
    await u.click(await screen.findByRole('button', { name: 'Conectar con Google' }));
    expect(await screen.findByText('Sólo coordinación puede conectar con Google.')).toBeTruthy();
  });
});

describe('Familias: cuentas', () => {
  const V = { id: 'v-1', jugador: 'Ejemplo, Chico', categorias: 'Sub 13', nombre: 'Madre de Ejemplo', emailEnmascarado: 'm***@ejemplo.test', desde: '2026-10-02T10:00:00Z' };

  it('sin vínculos, explica cuándo aparecen; con vínculos, los lista y la baja pide confirmación', async () => {
    const u = userEvent.setup();
    const cerrar = vi.fn(async () => {});
    abrir('/coordinacion/familias', { obtenerVinculosFamiliaDelClub: async () => [V], cerrarVinculoFamilia: cerrar });
    await u.click(await screen.findByRole('tab', { name: 'Cuentas' }));
    expect(await screen.findByText(/Cuenta: Madre de Ejemplo · m\*\*\*@ejemplo.test · desde el 02\/10/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Dar de baja' }));
    expect(cerrar).not.toHaveBeenCalled();
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Dar de baja' }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith('v-1'));
    expect(await screen.findByText('Listo: el vínculo se dio de baja.')).toBeTruthy();
  });

  it('sin familias vinculadas lo dice', async () => {
    const u = userEvent.setup();
    abrir('/coordinacion/familias');
    await u.click(await screen.findByRole('tab', { name: 'Cuentas' }));
    expect(await screen.findByRole('heading', { name: 'Todavía no hay familias vinculadas' })).toBeTruthy();
  });

  it('desde Familias se llega a los formularios de la página', async () => {
    const u = userEvent.setup();
    const { router } = abrir('/coordinacion/familias');
    await u.click(await screen.findByRole('link', { name: 'Formularios de la página del básquet' }));
    expect(router.state.location.pathname).toBe('/coordinacion/formularios');
  });
});
