import { describe, expect, it } from 'vitest';
import { ANCHO_DE_PAGINA, REJILLA, REJILLA_CHICA, TOPE_DE_PAGINA } from './pagina';

// Se leen los archivos como texto: la prueba falla si una pantalla vuelve a inventarse su propio ancho.
const todos = import.meta.glob<string>('../../**/*.tsx', { query: '?raw', import: 'default', eager: true });
/** Las claves del glob son relativas a este archivo (src/components/ui/): se pasan a rutas desde src/. */
function rel(clave: string): string {
  const partes = ['components', 'ui'];
  for (const p of clave.split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.') partes.push(p);
  }
  return partes.join('/');
}
const fuentes = Object.fromEntries(Object.entries(todos).map(([k, v]) => [rel(k), v]));
const sinPruebas = Object.entries(fuentes).filter(([ruta]) => !/\.test\.tsx$/.test(ruta));

describe('un solo ancho para todas las pantallas', () => {
  it('el contenedor ocupa todo el ancho y sólo se topa en pantallas muy anchas', () => {
    expect(ANCHO_DE_PAGINA).toContain('w-full');
    expect(ANCHO_DE_PAGINA).toContain('mx-auto');
    // Un único tope, igual en celular y compu: ningún `max-w` angosto ni un `sm:max-w-none` que lo desarme.
    expect(ANCHO_DE_PAGINA.match(/max-w-/g)).toHaveLength(1);
    expect(TOPE_DE_PAGINA).toMatch(/^max-w-\[(9[6-9]|1\d\d)rem\]$/);
    expect(ANCHO_DE_PAGINA).not.toMatch(/\b(sm|md|lg|xl):max-w/);
  });

  it('ningún archivo arma su propio <main>: todos usan <Pagina>', () => {
    const propios = sinPruebas.filter(([ruta, texto]) => ruta !== 'components/ui/pagina.tsx' && /<main[\s>]/.test(texto)).map(([ruta]) => ruta);
    expect(propios).toEqual([]);
  });

  it('cada pantalla de rutas.tsx llega a <Pagina> (directo o por un marco que la usa)', () => {
    const rutas = fuentes['rutas.tsx'];
    const archivoDe = new Map<string, string>();
    for (const m of rutas.matchAll(/import \{([^}]+)\} from '\.\/(pantallas\/[^']+)'/g)) {
      for (const nombre of m[1].split(',').map((n) => n.trim())) archivoDe.set(nombre, `${m[2]}.tsx`);
    }
    const pantallas = [...rutas.matchAll(/element: <(\w+) \/>/g)].map((m) => m[1]).filter((n) => archivoDe.has(n));
    expect(pantallas.length).toBeGreaterThanOrEqual(8);
    // PantallaDeTest (medir/MarcoDeTest.tsx) es ConPlantel con los chicos cargados.
    const marcos = ['<Pagina', '<ConPlantel', '<MarcoDeHoy', '<MarcoDelPlantel', '<PantallaDeTest'];
    // RequiereCoordinacion pone <Pagina> en todos sus estados (cargando, sin permiso y con la pantalla).
    for (const nombre of pantallas) {
      // Las de pantallas/jugador/ se dibujan dentro de MarcoJugador (por <Outlet />): se comprueba abajo.
      if (archivoDe.get(nombre)!.startsWith('pantallas/jugador/') && nombre !== 'MarcoJugador') continue;
      // Las de pantallas/coord/ se dibujan dentro de RequiereCoordinacion (por <Outlet />): se comprueba abajo.
      if (archivoDe.get(nombre)!.startsWith('pantallas/coord/') && nombre !== 'RequiereCoordinacion') continue;
      const texto = fuentes[archivoDe.get(nombre)!];
      expect(texto, `${nombre}: no se encontró ${archivoDe.get(nombre)}`).toBeDefined();
      expect(marcos.some((m) => texto.includes(m)), `${nombre} no usa <Pagina>`).toBe(true);
    }
  });

  it('los marcos compartidos usan <Pagina> y no definen un ancho propio', () => {
    for (const [archivo, marco] of [
      ['pantallas/ConPlantel.tsx', 'ConPlantel'],
      ['pantallas/Hoy.tsx', 'MarcoDeHoy'],
      ['pantallas/PlantelDelClub.tsx', 'MarcoDelPlantel'],
      ['pantallas/jugador/MarcoJugador.tsx', 'MarcoJugador'],
      ['pantallas/coord/MarcoCoord.tsx', 'ConSesion'],
    ] as const) {
      const texto = fuentes[archivo];
      expect(texto.slice(texto.indexOf(`function ${marco}`)), marco).toContain('<Pagina');
    }
  });

  it('las listas de tarjetas usan REJILLA (1 y 2 columnas) o REJILLA_CHICA (hasta 3), no columnas propias', () => {
    expect(REJILLA).toContain('md:grid-cols-2');
    expect(REJILLA).not.toMatch(/grid-cols-[3-9]/);
    expect(REJILLA_CHICA).toContain('xl:grid-cols-3');
    // Pantallas ya migradas: una lista nueva con `<ul className="… grid-cols-…">` propio las rompe.
    const migradas = ['Medir', 'MedirSalto','MedirSprint', 'MedirYoyo', 'MedirBateria', 'MisionesDelPlantel', 'ArmarMisiones', 'RecursosVideos'];
    for (const nombre of migradas) {
      const texto = fuentes[`pantallas/${nombre}.tsx`];
      expect(texto, nombre).toBeDefined();
      const propias = [...texto.matchAll(/<ul[^>]*className="[^"]*grid-cols-[^"]*"/g)].map((m) => m[0]);
      expect(propias, `${nombre} define columnas propias en una lista`).toEqual([]);
    }
  });

  it('ninguna pantalla ni menú de página fija un max-w en rem que la encoja', () => {
    // Las piezas (hojas, textos, formularios) pueden tener su tope; las páginas no.
    const paginas = sinPruebas.filter(([ruta]) => ruta.startsWith('pantallas/') || ruta === 'rutas.tsx' || ruta === 'laboratorio.tsx');
    const flojas = paginas.filter(([, texto]) => /<(main|nav)[^>]*max-w-\[\d+(\.\d+)?rem\]/.test(texto)).map(([ruta]) => ruta);
    expect(flojas).toEqual([]);
  });
});
