import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { DatosDePizarra, EjercicioDeLista, JugadaDelClub, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.restoreAllMocks();
});

// Todo inventado: títulos, jugadas y notas. Nunca datos de chicos reales.
const ej = (id: string, extra: Partial<EjercicioDeLista> = {}): EjercicioDeLista => ({
  id, titulo: id, tema: 'pase', descripcion: null, enlace: null, material: null, jugadores: null, categorias: null,
  creadoPor: null, creadoEn: '2026-10-01T10:00:00Z', tieneNotas: false, cantidadVariaciones: 0, ...extra,
});

const PIZARRA: DatosDePizarra = {
  cancha: 'media',
  fichas: [
    { id: 'a1', tipo: 'ataque', numero: 1, x: 0.5, y: 0.7 },
    { id: 'a2', tipo: 'ataque', numero: 2, x: 0.3, y: 0.5 },
    { id: 'd1', tipo: 'defensa', numero: 1, x: 0.4, y: 0.4 },
  ],
  pelota: 'a1',
  pasos: [
    { acciones: [{ tipo: 'corte', ficha: 'a2', hasta: { x: 0.7, y: 0.3 }, control: null }], nota: 'Corta al lado fuerte' },
    { acciones: [{ tipo: 'pase', ficha: 'a1', a: 'a2' }] },
  ],
};

const EJERCICIOS = [
  ej('Pase de pecho', { tema: 'pase', descripcion: 'Dos filas enfrentadas', material: '2 pelotas', jugadores: 8, tieneNotas: true, cantidadVariaciones: 2 }),
  ej('Cierre de línea de pase', { tema: 'defensa' }),
  ej('Sentadilla con salto', { tema: 'fisico', enlace: 'https://ejemplo.test/video' }),
];

const jugada = (id: string, nombre: string, tipo: string, esMia = false): JugadaDelClub => ({
  id, nombre, tipo, datos: PIZARRA, creadoPor: 'u-x', esMia, actualizadoEn: '2026-10-01T10:00:00Z',
});

const JUGADAS = [jugada('ju-1', 'Salida de lateral 1', 'lateral', true), jugada('ju-2', 'Zona 2-3', 'defensa'), jugada('ju-3', 'Pick and roll', 'ataque')];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1', 'p-2']),
    obtenerEjercicios: async () => EJERCICIOS,
    obtenerEjercicio: async (_c, id) => {
      const e = EJERCICIOS.find((x) => x.id === id)!;
      return { ...e, pizarra: id === 'Pase de pecho' ? PIZARRA : null };
    },
    obtenerNotas: async () => [{ id: 'n-1', texto: 'Con chicos de 12 funciona mejor a media velocidad', creadoPor: null, creadoEn: '2026-10-02T10:00:00Z' }],
    obtenerVariaciones: async () => [
      { id: 'v-2', nivel: 3, eje: 'oposicion', titulo: 'Con defensor pasivo', descripcion: null, creadoEn: '2026-10-02T10:00:00Z' },
      { id: 'v-1', nivel: 1, eje: 'espacio', titulo: 'Más cerca', descripcion: 'Un paso menos de distancia', creadoEn: '2026-10-01T10:00:00Z' },
    ],
    listarJugadas: async () => JUGADAS,
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/recursos' });
const lista = () => screen.getByRole('region', { name: 'Lista' });

describe('Recursos: ejercicios', () => {
  it('lista los ejercicios con su tema, «probado» y cuántas variaciones tiene', async () => {
    abrir();
    expect(await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ })).toBeTruthy();
    const item = within(lista()).getByRole('button', { name: /Pase de pecho/ });
    expect(item.textContent).toContain('Pase');
    expect(item.textContent).toContain('✓ probado');
    expect(item.textContent).toContain('2 variaciones');
    // Sin variaciones no dice «0 variaciones».
    expect(within(lista()).getByRole('button', { name: /Cierre de línea/ }).textContent).not.toMatch(/variaci/);
  });

  it('filtra por tema (sólo los que tienen ejercicios) y por texto, sin importar tildes', async () => {
    const u = userEvent.setup();
    abrir();
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
    const filtros = within(lista()).getByRole('group', { name: 'Filtrar' });
    expect(within(filtros).queryByRole('button', { name: 'Rebote' })).toBeNull();
    await u.click(within(filtros).getByRole('button', { name: 'Defensa' }));
    expect(within(lista()).queryByRole('button', { name: /Pase de pecho/ })).toBeNull();
    expect(within(lista()).getByRole('button', { name: /Cierre de línea/ })).toBeTruthy();
    await u.click(within(filtros).getByRole('button', { name: 'Todos' }));
    await u.type(within(lista()).getByRole('searchbox'), 'SENTADILLA');
    expect(within(lista()).getAllByRole('button', { name: /Sentadilla/ })).toHaveLength(1);
    expect(within(lista()).queryByRole('button', { name: /Pase de pecho/ })).toBeNull();
  });

  it('elegir uno muestra su pizarra, la descripción, el material, las variaciones de fácil a difícil y las notas', async () => {
    const u = userEvent.setup();
    abrir();
    // El primero queda elegido solo: la pizarra nunca está vacía habiendo ejercicios.
    expect(await screen.findByRole('img', { name: 'Pizarra del ejercicio: Pase de pecho' })).toBeTruthy();
    const detalle = screen.getByRole('complementary', { name: 'Detalle' });
    expect(detalle.textContent).toContain('Dos filas enfrentadas');
    expect(detalle.textContent).toContain('2 pelotas');
    const variaciones = await within(detalle).findByRole('region', { name: 'Variaciones' });
    const textos = within(variaciones).getAllByRole('listitem').map((l) => l.textContent);
    expect(textos[0]).toContain('Nivel 1');
    expect(textos[0]).toContain('Espacio');
    expect(textos[1]).toContain('Nivel 3');
    expect(within(detalle).getByRole('region', { name: 'Notas de uso' }).textContent).toContain('media velocidad');
    // Otro sin pizarra lo dice, y pasa al otro en rojo suave.
    await u.click(within(lista()).getByRole('button', { name: /Cierre de línea/ }));
    expect(await screen.findByText('Este ejercicio no tiene pizarra dibujada.')).toBeTruthy();
    expect(within(lista()).getByRole('button', { name: /Cierre de línea/ }).getAttribute('aria-current')).toBe('true');
  });

  it('un ejercicio con enlace ofrece «Ver video»', async () => {
    const u = userEvent.setup();
    abrir();
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Sentadilla/ });
    await u.click(within(lista()).getByRole('button', { name: /Sentadilla/ }));
    expect(await screen.findByRole('link', { name: /Ver video/ })).toBeTruthy();
  });

  it('un ejercicio con video de YouTube muestra su miniatura en la lista; sin video, no', async () => {
    abrir(repo({ obtenerEjercicios: async () => [
      ej('Con video', { enlace: 'https://youtu.be/dQw4w9WgXcQ' }),
      ej('Sin video'),
    ] }));
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Con video/ });
    expect(within(lista()).getByRole('button', { name: /Con video/ }).querySelector('img')).not.toBeNull();
    expect(within(lista()).getByRole('button', { name: /Sin video/ }).querySelector('img')).toBeNull();
  });

  it('la biblioteca vacía explica qué es y dónde se carga', async () => {
    abrir(repo({ obtenerEjercicios: async () => [] }));
    expect(await screen.findByText('La biblioteca está vacía')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'la app de siempre' }).length).toBeGreaterThan(0);
  });

  it('si no se pueden cargar, lo dice con una salida para reintentar', async () => {
    const u = userEvent.setup();
    let falla = true;
    abrir(repo({ obtenerEjercicios: async () => { if (falla) throw new Error('boom'); return EJERCICIOS; } }));
    expect(await screen.findByText('No pudimos cargar los ejercicios')).toBeTruthy();
    falla = false;
    await u.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ })).toBeTruthy();
  });
});

describe('Recursos: jugadas', () => {
  const irAJugadas = async () => {
    const u = userEvent.setup();
    abrir();
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
    await u.click(screen.getByRole('tab', { name: 'Jugadas' }));
    await within(lista()).findByRole('button', { name: /Zona 2-3/ });
    return u;
  };

  it('lista las jugadas con su tipo y filtra por tipo', async () => {
    const u = await irAJugadas();
    expect(within(lista()).getByRole('button', { name: /Salida de lateral 1/ }).textContent).toContain('Tuya');
    await u.click(within(within(lista()).getByRole('group', { name: 'Filtrar' })).getByRole('button', { name: 'Defensa' }));
    expect(within(lista()).queryByRole('button', { name: /Pick and roll/ })).toBeNull();
    expect(within(lista()).getByRole('button', { name: /Zona 2-3/ })).toBeTruthy();
  });

  it('la pizarra muestra las fichas, pasa de paso en paso con su nota y tiene «Animar»', async () => {
    const u = await irAJugadas();
    await u.click(within(lista()).getByRole('button', { name: /Zona 2-3/ }));
    const pizarra = await screen.findByRole('img', { name: 'Jugada: Zona 2-3' });
    expect(pizarra.querySelectorAll('[data-ficha]')).toHaveLength(3);
    expect(pizarra.querySelectorAll('[data-pelota]')).toHaveLength(1);
    expect(screen.getByText('Paso 1 de 2')).toBeTruthy();
    expect(screen.getByText('Corta al lado fuerte')).toBeTruthy();
    expect(pizarra.querySelector('[data-trazo="corte"]')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Paso siguiente' }));
    expect(screen.getByText('Paso 2 de 2')).toBeTruthy();
    expect(pizarra.querySelector('[data-trazo="pase"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Paso siguiente' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Animar' })).toBeTruthy();
  });

  it('«Animar» corre la animación y se puede detener', async () => {
    const u = await irAJugadas();
    await u.click(screen.getByRole('button', { name: 'Animar' }));
    expect(await screen.findByRole('button', { name: 'Detener' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Detener' }));
    expect(screen.getByRole('button', { name: 'Animar' })).toBeTruthy();
  });

  it('asigna a planteles: parte de lo ya asignado y guarda exactamente lo tildado', async () => {
    const asignarJugada = vi.fn(async () => {});
    const u = await (async () => {
      const usuario = userEvent.setup();
      abrir(repo({ plantelesDeJugada: async () => ['p-1'], asignarJugada }));
      await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
      await usuario.click(screen.getByRole('tab', { name: 'Jugadas' }));
      await within(lista()).findByRole('button', { name: /Zona 2-3/ });
      return usuario;
    })();
    await u.click(screen.getByRole('button', { name: /Asignar a planteles/ }));
    const sub13 = await screen.findByRole('checkbox', { name: 'Sub 13' });
    await waitFor(() => expect((sub13 as HTMLInputElement).checked).toBe(true));
    const sub15 = screen.getByRole('checkbox', { name: 'Sub 15' }) as HTMLInputElement;
    expect(sub15.checked).toBe(false);
    await u.click(sub15);
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(asignarJugada).toHaveBeenCalledWith('c-1', 'ju-1', ['p-1', 'p-2']));
  });

  it('duplica: la copia lleva el mismo tipo y contenido, y avisa', async () => {
    const crearJugada = vi.fn(async () => ({}));
    const u = userEvent.setup();
    abrir(repo({ crearJugada }));
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
    await u.click(screen.getByRole('tab', { name: 'Jugadas' }));
    await within(lista()).findByRole('button', { name: /Zona 2-3/ });
    await u.click(screen.getByRole('button', { name: /Duplicar/ }));
    await waitFor(() => expect(crearJugada).toHaveBeenCalledTimes(1));
    const pedido = crearJugada.mock.calls[0] as unknown as [{ clubId: string; nombre: string; tipo: string; datos: DatosDePizarra }];
    expect(pedido[0]).toMatchObject({ clubId: 'c-1', nombre: 'Copia de Salida de lateral 1', tipo: 'lateral' });
    expect(pedido[0].datos.fichas).toHaveLength(3);
    expect(await screen.findByText('Jugada duplicada')).toBeTruthy();
  });

  it('imprime la jugada', async () => {
    const imprimir = vi.fn();
    vi.stubGlobal('print', imprimir);
    const u = await irAJugadas();
    await u.click(screen.getByRole('button', { name: /Imprimir/ }));
    expect(imprimir).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('en una pantalla chica no ofrece editar y lo explica; en una grande lleva al editor de siempre', async () => {
    const u = await irAJugadas();
    expect(screen.getByRole('link', { name: /Editar en la app de siempre/ })).toBeTruthy();
    cleanup();
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 800);
    abrir();
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
    await u.click(screen.getByRole('tab', { name: 'Jugadas' }));
    await within(lista()).findByRole('button', { name: /Zona 2-3/ });
    expect(screen.queryByRole('link', { name: /Editar en la app de siempre/ })).toBeNull();
    expect(screen.getByText(/es para compu o tablet/)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('con movimiento reducido, «Animar» pasa de paso sin interpolar', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const u = await irAJugadas();
    await u.click(screen.getByRole('button', { name: 'Animar' }));
    expect(screen.getByText('Paso 2 de 2')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe('Recursos: botones táctiles', () => {
  it('cada botón y cada pestaña mide al menos 44 px (clases de alto mínimo)', async () => {
    const u = userEvent.setup();
    abrir();
    await within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
    await u.click(screen.getByRole('tab', { name: 'Jugadas' }));
    await within(lista()).findByRole('button', { name: /Zona 2-3/ });
    const chicos = [...document.querySelectorAll('main button')].filter((b) => !/(^|\s)(min-h-11|min-h-14|size-11|h-11)(\s|$)/.test(b.className));
    expect(chicos.map((b) => b.textContent)).toEqual([]);
  });
});
