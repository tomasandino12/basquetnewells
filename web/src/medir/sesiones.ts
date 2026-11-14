import type { SesionMedicion } from '../datos/repositorio';

export type TipoDeTest = 'tiro' | 'salto' | 'sprint' | 'yoyo';

export interface TestDeMedir {
  tipo: TipoDeTest;
  nombre: string;
  detalle: string;
}

/** Los cuatro tests, en el orden de la pantalla vieja. */
export const TESTS: TestDeMedir[] = [
  { tipo: 'tiro', nombre: 'Batería de tiro', detalle: '6 posiciones, 10 tiros cada una' },
  { tipo: 'salto', nombre: 'Salto', detalle: 'CMJ o Abalakov, por video' },
  { tipo: 'sprint', nombre: 'Sprint', detalle: '20 o 30 m, cronómetro con pitido' },
  { tipo: 'yoyo', nombre: 'Yo-Yo', detalle: 'Resistencia, idas de 20 m con pitidos' },
];

export const NOMBRE_DE_TEST: Record<string, string> = Object.fromEntries(TESTS.map((t) => [t.tipo, t.nombre]));

/** 'YYYY-MM-DD' → 'DD/MM/YY', a mano para no depender de la zona horaria. */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
}

/** La última sesión de cada test (las fechas ISO se ordenan como texto). */
export function ultimaPorTipo(sesiones: SesionMedicion[]): Partial<Record<string, SesionMedicion>> {
  const ultimas: Partial<Record<string, SesionMedicion>> = {};
  for (const s of sesiones) {
    const actual = ultimas[s.tipo];
    if (!actual || s.fecha > actual.fecha) ultimas[s.tipo] = s;
  }
  return ultimas;
}

/** De la más nueva a la más vieja. */
export const masNuevasPrimero = (sesiones: SesionMedicion[]) =>
  [...sesiones].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

// --- Borradores: el mismo formato y las mismas claves que src/ui/borradorMedicion.js. ---
// Una medición lleva media hora y el celular se bloquea: la app de siempre la guarda en cada toque y
// esta pantalla sólo la lee y la descarta. Si cambia el formato allá, tests/contratoBorradorMedicion
// (y la prueba de este archivo) avisan.

const PREFIJO = 'medicion.borrador.v2';
const VERSION = 1;

export interface Borrador {
  fecha: string;
  valores?: Record<string, Record<string, unknown> | undefined>;
  /** Se genera con el borrador y se reusa en cada reintento: la base no duplica la sesión (0038). */
  sesionId?: string;
  /** Lo propio de cada test (testSalto, distanciaM). */
  [extra: string]: unknown;
}

export const claveBorrador = (usuarioId: string | undefined, clubId: string, plantelId: string, tipo: TipoDeTest) =>
  `${PREFIJO}.${usuarioId ?? 'sin-cuenta'}.${clubId}.${plantelId}.${tipo}`;

export function leerBorrador(clave: string): Borrador | null {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return null;
    const estado = JSON.parse(crudo) as (Borrador & { version?: number }) | null;
    // Un borrador de otra versión se descarta: mejor perder una sesión a medias que dibujar una forma que no se entiende.
    return estado?.version === VERSION && typeof estado.fecha === 'string' ? estado : null;
  } catch {
    return null;
  }
}

/** Se llama en cada toque: la sesión en curso no puede depender de que el celular no se bloquee. */
export function guardarBorrador(clave: string, estado: Omit<Borrador, 'version'>): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify({ ...estado, version: VERSION }));
    return true;
  } catch {
    // En modo privado localStorage tira al escribir: perder el borrador nunca rompe la pantalla.
    return false;
  }
}

/** Fecha local, no UTC: después de las 21:00 en Argentina toISOString() ya da mañana. */
export function hoyLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function borrarBorrador(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Si no se puede borrar, reaparece como «sesión sin terminar»: molesta, no vale un error.
  }
}

/** Jugadores con algo cargado: un valor o una ausencia. Los que se tocaron y quedaron vacíos no cuentan. */
export function cuantosCargados(borrador: Borrador | null): number {
  return Object.values(borrador?.valores ?? {}).filter(
    (v) => v?.ausente || Object.keys(v ?? {}).some((k) => k !== 'ausente' && v?.[k] != null),
  ).length;
}
