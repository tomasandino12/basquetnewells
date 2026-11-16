import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { bateria } from '../hoy/datosDePrueba';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

// Nombres inventados: nunca datos de chicos reales.
const JUGADORES = [
  { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
  { id: 'j-2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
  { id: 'j-3', nombreClave: 'cabrera luis', nombreLimpio: 'Cabrera, Luis', fechaNacimiento: null },
];
const S1 = { id: 's-1', fecha: '2026-10-06', tipo: 'tiro' };
const S2 = { id: 's-2', fecha: '2026-10-20', tipo: 'tiro' };

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    obtenerSesionesDeMedicion: async () => [S1],
    obtenerMedicionesTiroDelPlantel: async () => bateria('s-1', { frontal: 1, esq_izq: 8 }),
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/hoy' });
const esperar = () => screen.findByRole('region', { name: 'Tiro de campo' });
const fila = (nombre: string) => within(screen.getByRole('list', { name: 'Zonas del arco' })).getByText(nombre).closest('li')!;

describe('Hoy: encabezado y accesos', () => {
  it('muestra la carga y después el saludo, la categoría y el acceso a la asistencia', async () => {
    abrir();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 1, name: /Buen día|Buenas tardes|Buenas noches/ })).toBeTruthy();
    expect(await screen.findByText('Entrenamiento de hoy')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tomar asistencia' }).getAttribute('href')).toBe('/plantel/asistencia');
  });

  it('«Tomar asistencia» lleva a la toma del día', async () => {
    const u = userEvent.setup();
    const { router } = abrir();
    await u.click(await screen.findByRole('link', { name: 'Tomar asistencia' }));
    expect(router.state.location.pathname).toBe('/plantel/asistencia');
  });

  it('desde el plantel se llega al resumen de hoy', async () => {
    const u = userEvent.setup();
    const { router } = renderConDatos(rutas, { repo: repo(), ruta: '/plantel' });
    await u.click(await screen.findByRole('link', { name: 'Resumen de hoy' }));
    expect(router.state.location.pathname).toBe('/hoy');
  });
});

describe('Hoy: estados sin datos', () => {
  it('sin baterías ofrece tres formas de empezar', async () => {
    abrir(repo({ obtenerSesionesDeMedicion: async () => [], obtenerMedicionesTiroDelPlantel: async () => [] }));
    expect(await screen.findByText('Todavía no hay nada cargado en Sub 13')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cargar el plantel' }).getAttribute('href')).toBe('/plantel');
    expect(screen.getByRole('link', { name: 'Cargar un partido' }).getAttribute('href')).toBe('/app/clasica?desde=nueva');
    expect(screen.getByRole('link', { name: 'Hacer la primera medición' }).getAttribute('href')).toBe('/app/clasica?desde=nueva');
  });

  it('una batería sin ninguna medición lo cuenta y deja hacer una', async () => {
    abrir(repo({ obtenerMedicionesTiroDelPlantel: async () => [] }));
    expect(await screen.findByText(/Hubo una batería el 06\/10 en Sub 13, pero quedó sin ninguna medición/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hacer una medición' }).getAttribute('href')).toBe('/app/clasica?desde=nueva');
  });
});

describe('Hoy: el tiro', () => {
  it('dice el contexto y el total del arco con su denominador', async () => {
    abrir();
    const total = within(await esperar());
    expect(screen.getByText('Sub 13 · batería del 06/10 · 3 jugadores midieron')).toBeTruthy();
    expect(total.getByText('Tiro de campo · todo el arco')).toBeTruthy();
    expect(total.getByText('Primera batería: todavía no hay con qué comparar')).toBeTruthy();
    expect(total.getByText('81/150 tiros')).toBeTruthy();
  });

  it('con un solo jugador dice «1 jugador midió»', async () => {
    abrir(repo({ obtenerMedicionesTiroDelPlantel: async () => bateria('s-1').filter((m) => m.jugadorId === 'j-1') }));
    expect(await screen.findByText('Sub 13 · batería del 06/10 · 1 jugador midió')).toBeTruthy();
  });

  it('las zonas van de la más floja a la mejor y cada una trae su fracción y su porcentaje', async () => {
    abrir();
    await esperar();
    const nombres = within(screen.getByRole('list', { name: 'Zonas del arco' })).getAllByRole('listitem').map((li) => li.querySelector('span')!.textContent);
    expect(nombres[0]).toBe('Frontal');
    expect(nombres[4]).toBe('Esquina izquierda');
    expect(fila('Frontal').textContent).toContain('3/30');
    expect(fila('Frontal').textContent).toContain('10%');
  });

  it('dibuja la cancha con su descripción para quien no ve el dibujo', async () => {
    abrir();
    await esperar();
    const cancha = screen.getByRole('img', { name: /^Cancha con el tiro por zona/ });
    expect(cancha.getAttribute('aria-label')).toContain('Frontal: 10%');
  });

  it('señala la zona más floja sólo cuando se separa del resto', async () => {
    abrir();
    expect(await screen.findByText(/Zona más floja:/)).toBeTruthy();
    cleanup();
    abrir(repo({ obtenerMedicionesTiroDelPlantel: async () => bateria('s-1', { frontal: 5 }) }));
    expect(await screen.findByText(/empatadas dentro del margen de error/)).toBeTruthy();
  });

  it('una zona sin medir dice «sin medir» y no inventa un cero', async () => {
    abrir(repo({ obtenerMedicionesTiroDelPlantel: async () => bateria('s-1').filter((m) => m.posicion !== 'frontal') }));
    await esperar();
    expect(fila('Frontal').textContent).toContain('sin medir');
    expect(fila('Frontal').textContent).toContain('—');
    expect(fila('Frontal').textContent).not.toContain('0%');
  });

  it('con pocos intentos lo marca', async () => {
    abrir(repo({ obtenerMedicionesTiroDelPlantel: async () => bateria('s-1').map((m) => ({ ...m, intentos: 2, anotados: 1 })).filter((m) => m.jugadorId === 'j-1') }));
    await esperar();
    expect(within(fila('Frontal')).getByText('pocos datos')).toBeTruthy();
  });

  it('los tiros libres van aparte del arco', async () => {
    abrir();
    await esperar();
    const libres = screen.getByRole('region', { name: 'Tiros libres' });
    expect(within(libres).getByText('18/30')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Zonas del arco' })).queryByText('Tiros libres')).toBeNull();
  });
});

describe('Hoy: comparación con la batería anterior', () => {
  const dos = () => repo({
    obtenerSesionesDeMedicion: async () => [S1, S2],
    obtenerMedicionesTiroDelPlantel: async () => [...bateria('s-1'), ...bateria('s-2', { frontal: 2 })],
  });

  it('muestra contra qué fecha se compara y la flecha de lo que cambió de verdad', async () => {
    abrir(dos());
    await esperar();
    expect(screen.getByText('vs 06/10')).toBeTruthy();
    expect(within(fila('Frontal')).getByText('▼ -40 pp')).toBeTruthy();
  });

  it('una diferencia dentro del margen de error no lleva flecha', async () => {
    abrir(repo({
      obtenerSesionesDeMedicion: async () => [S1, S2],
      obtenerMedicionesTiroDelPlantel: async () => [...bateria('s-1'), ...bateria('s-2', { frontal: 7 })],
    }));
    await esperar();
    expect(within(fila('Frontal')).getByText('+10 pp · sin diferencia clara')).toBeTruthy();
    expect(within(fila('Frontal')).queryByText(/▲|▼/)).toBeNull();
  });

  it('la curva dice cuántas baterías hay con primera y última', async () => {
    abrir(dos());
    const total = within(await esperar());
    expect(total.getByRole('img', { name: /Evolución del tiro de campo/ })).toBeTruthy();
    expect(total.getByText(/2 baterías · primera 60% \(90\/150\) · última 5\d% \(/)).toBeTruthy();
    expect(total.getByRole('link', { name: 'Ver la evolución completa en Datos' }).getAttribute('href')).toBe('/app/clasica?desde=nueva');
  });

  it('con una sola batería la curva es un punto', async () => {
    abrir();
    const total = within(await esperar());
    expect(total.getByText(/Una sola batería: 06\/10 · \d+\/150/)).toBeTruthy();
  });
});

describe('Hoy: metas del cuerpo técnico', () => {
  it('sin metas ofrece fijarlas y no habla del tema', async () => {
    abrir();
    await esperar();
    expect(screen.getByRole('link', { name: 'Fijar las metas' }).getAttribute('href')).toBe('/metas');
    expect(screen.queryByText(/llegó a su meta|llegó a la meta|por debajo de la meta/)).toBeNull();
  });

  it('con metas marca las que llegaron y cuenta las zonas, y deja editarlas', async () => {
    abrir(repo({ obtenerMetasDelPlantel: async () => ({ frontal: 40, esq_izq: 50 }) }));
    const total = within(await esperar());
    expect(total.getByText('1 de 2 zonas llegó a su meta')).toBeTruthy();
    expect(within(fila('Frontal')).getByText('meta 40%')).toBeTruthy();
    expect(within(fila('Esquina izquierda')).getByText('✓ llegó a la meta')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Editar las metas' })).toBeTruthy();
  });

  it('«Ver quiénes» abre la lista de los que están por debajo, con sus intentos', async () => {
    const u = userEvent.setup();
    abrir(repo({ obtenerMetasDelPlantel: async () => ({ frontal: 40 }) }));
    await esperar();
    expect(screen.getByText(/3 de 3 están por debajo de la meta del cuerpo técnico/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Ver quiénes' }));
    const hoja = within(screen.getByRole('dialog'));
    expect(hoja.getByText('Acosta, Bruno')).toBeTruthy();
    expect(hoja.getAllByText('10% · 1/10')).toHaveLength(3);
    expect(hoja.getByText(/Meta del cuerpo técnico para esta zona: 40%/)).toBeTruthy();
  });

  it('si la lista de chicos no carga, la lista dice «Jugador» y la pantalla sigue', async () => {
    const u = userEvent.setup();
    abrir(repo({
      obtenerMetasDelPlantel: async () => ({ frontal: 40 }),
      obtenerJugadoresDelPlantel: async () => { throw new Error('x'); },
    }));
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Ver quiénes' }));
    expect(within(screen.getByRole('dialog')).getAllByText('Jugador')).toHaveLength(3);
  });

  it('si las metas fallan, la pantalla se dibuja igual sin metas', async () => {
    abrir(repo({ obtenerMetasDelPlantel: async () => { throw new Error('x'); } }));
    await esperar();
    expect(screen.getByRole('link', { name: 'Fijar las metas' })).toBeTruthy();
  });
});

describe('Hoy: altura y peso', () => {
  it('dice la última medición del plantel y cuántos no tienen ninguna', async () => {
    abrir(repo({
      obtenerMedicionesCorporalesDelClub: async () => [
        { jugadorId: 'j-1', fechaMedicion: '2026-10-01', alturaCm: 158, pesoKg: 47, piernaCm: null, piernaFlexionadaCm: null },
      ],
    }));
    await esperar();
    const pie = within(screen.getByRole('region', { name: 'Altura y peso' }));
    expect(pie.getByText(/Última medición del plantel: 01\/10\. 2 de 3 jugadores no tienen ninguna\./)).toBeTruthy();
    expect(pie.getByRole('link', { name: 'Ver el plantel' }).getAttribute('href')).toBe('/plantel');
  });

  it('sin ninguna medición lo dice', async () => {
    abrir();
    await esperar();
    expect(screen.getByText(/Todavía no hay ninguna medición cargada\./)).toBeTruthy();
  });

  it('si fallan las mediciones corporales el pie no se dibuja pero el resto sí', async () => {
    abrir(repo({ obtenerMedicionesCorporalesDelClub: async () => { throw new Error('x'); } }));
    await esperar();
    expect(screen.queryByRole('region', { name: 'Altura y peso' })).toBeNull();
  });
});

describe('Hoy: misiones del partido', () => {
  const previa = { id: 'pr-1', fecha: '2026-10-18', rival: 'Rival de Ejemplo', plantelId: 'p-1', partidoId: null, evaluada: false };
  const mision = (id: string, texto: string, extra: Record<string, unknown> = {}) => ({ id, metrica: null, valor: null, texto, estado: null, comentario: null, jugadorId: null, ...extra });
  const completa = (fecha = '2026-10-18') => ({
    id: 'pr-1',
    fecha,
    rival: 'Rival de Ejemplo',
    partidoId: null,
    misionesEquipo: [mision('me-1', 'Jugar como equipo')],
    misionesJugador: [
      mision('mj-1', 'Defender fuerte', { jugadorId: 'j-1' }),
      mision('mj-2', 'Bajar los rebotes', { jugadorId: 'j-2' }),
      mision('mj-3', 'Pasarla rápido', { jugadorId: 'j-3' }),
    ],
  });
  const conMisiones = (extra: Partial<Repositorio> = {}, fecha?: string) =>
    repo({ obtenerPreviasDelPlantel: async () => [previa], obtenerPrevia: async () => completa(fecha), ...extra });
  // La tarjeta pasa de «cargando» a la lista: se espera a que termine para no agarrar el recuadro viejo.
  const tarjeta = async () => {
    await screen.findByRole('region', { name: 'Misiones del partido' });
    await waitFor(() => expect(screen.queryByText('Cargando las misiones…')).toBeNull());
    return within(screen.getByRole('region', { name: 'Misiones del partido' }));
  };

  it('sin previas invita a armar las misiones', async () => {
    abrir();
    const misiones = await tarjeta();
    expect(misiones.getByText('Armá las misiones del próximo partido')).toBeTruthy();
    expect(misiones.queryByText('Armar otras misiones')).toBeNull();
  });

  it('muestra las 3 primeras (el equipo primero) con un toque para marcar cada una', async () => {
    abrir(conMisiones());
    const misiones = await tarjeta();
    expect(await misiones.findByText('Jugar como equipo')).toBeTruthy();
    expect(misiones.getByText('Defender fuerte')).toBeTruthy();
    expect(misiones.getByText('Bajar los rebotes')).toBeTruthy();
    expect(misiones.queryByText('Pasarla rápido')).toBeNull();
    expect(misiones.getByText('0 de 4')).toBeTruthy();
    expect(misiones.getAllByRole('button', { name: /^Cumplida:/ })).toHaveLength(3);
    expect(misiones.getByRole('link', { name: 'Ver las 4' }).getAttribute('href')).toBe('/misiones/pr-1');
  });

  it('un toque en «cumplida» la marca y guarda solo esa misión, sin tocar el partido', async () => {
    const u = userEvent.setup();
    const guardadas: unknown[] = [];
    abrir(conMisiones({ evaluarMisiones: async (d) => { guardadas.push(d); return {}; } }));
    const misiones = await tarjeta();
    const boton = await misiones.findByRole('button', { name: 'Cumplida: Defender fuerte' });
    await u.click(boton);
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    expect(misiones.getByText('1 de 4')).toBeTruthy();
    await waitFor(() => expect(guardadas).toHaveLength(1));
    expect(guardadas[0]).toEqual({ previaId: 'pr-1', partidoId: null, evaluaciones: [{ tipo: 'jugador', id: 'mj-1', estado: 'logrado', comentario: null }] });
  });

  it('otro toque la desmarca', async () => {
    const u = userEvent.setup();
    const guardadas: { evaluaciones: { estado: string | null }[] }[] = [];
    abrir(conMisiones({ evaluarMisiones: async (d) => { guardadas.push(d as never); return {}; } }));
    const boton = await (await tarjeta()).findByRole('button', { name: 'Cumplida: Defender fuerte' });
    await u.click(boton);
    await u.click(boton);
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(guardadas).toHaveLength(2));
    expect(guardadas[1].evaluaciones[0].estado).toBeNull();
  });

  it('«Siguientes» muestra las que faltan y vuelve al principio', async () => {
    const u = userEvent.setup();
    abrir(conMisiones());
    const misiones = await tarjeta();
    await misiones.findByText('Jugar como equipo');
    await u.click(misiones.getByRole('button', { name: 'Siguientes' }));
    expect(misiones.getByText('Pasarla rápido')).toBeTruthy();
    expect(misiones.queryByText('Jugar como equipo')).toBeNull();
    await u.click(misiones.getByRole('button', { name: 'Siguientes' }));
    expect(misiones.getByText('Jugar como equipo')).toBeTruthy();
  });

  it('si no se pudo guardar, deshace la marca y avisa', async () => {
    const u = userEvent.setup();
    abrir(conMisiones({ evaluarMisiones: async () => { throw new Error('SIN_PERMISO'); } }));
    const misiones = await tarjeta();
    const boton = await misiones.findByRole('button', { name: 'Cumplida: Defender fuerte' });
    await u.click(boton);
    expect(await misiones.findByRole('alert')).toBeTruthy();
    expect(boton.getAttribute('aria-pressed')).toBe('false');
  });

  it('antes del día del partido se repasan, sin botones para marcar', async () => {
    abrir(conMisiones({}, '2099-01-01'));
    const misiones = await tarjeta();
    expect(await misiones.findByText('Defender fuerte')).toBeTruthy();
    expect(misiones.queryByRole('button', { name: /^Cumplida:/ })).toBeNull();
    expect(misiones.getByRole('link', { name: 'Armar otras misiones' })).toBeTruthy();
  });

  it('si ya estaban todas evaluadas al abrir, vuelve a invitar a armar las próximas', async () => {
    const evaluada = completa();
    evaluada.misionesEquipo[0].estado = 'logrado' as never;
    evaluada.misionesJugador.forEach((m) => { m.estado = 'no_logrado' as never; });
    abrir(conMisiones({ obtenerPrevia: async () => evaluada }));
    const misiones = await tarjeta();
    expect(await misiones.findByText('Armá las misiones del próximo partido')).toBeTruthy();
    expect(misiones.getByText(/Ya evaluaste las 4 del Rival de Ejemplo/)).toBeTruthy();
  });

  it('si las misiones no cargan no se dibuja nada y el resto sigue', async () => {
    abrir(repo({ obtenerPreviasDelPlantel: async () => { throw new Error('x'); } }));
    await esperar();
    expect(screen.queryByRole('region', { name: 'Misiones del partido' })).toBeNull();
  });
});
