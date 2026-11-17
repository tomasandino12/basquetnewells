// Registro local de las guías y pistas ya vistas. Va en el celular y no en la base: no es un dato sensible
// y no justifica una tabla con RLS. La clave lleva el usuario: en un celular compartido, cada cuenta ve la suya.
// Es la misma clave y el mismo formato que usaba la app de siempre: quien ya la vio no la vuelve a ver.
const PREFIJO = 'guia.v1';

/** Sólo para las pruebas: la intro es una hoja modal y taparía cualquier pantalla que se pruebe. Las pruebas de la guía la prenden. */
export const ajustesDePrueba = { sinGuias: false };

export const claveGuia = (usuarioId: string | undefined, id: string) => `${PREFIJO}.${usuarioId ?? 'sin-cuenta'}.${id}`;

const almacen = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Verdadero si ya se vio esta versión o una posterior. Sin almacenamiento (modo privado) siempre sale de nuevo: molesta, no rompe. */
export function yaVista(clave: string, version: number): boolean {
  try {
    const crudo = almacen()?.getItem(clave);
    if (!crudo) return false;
    const vista = JSON.parse(crudo)?.version;
    return Number.isInteger(vista) && vista >= version;
  } catch {
    return false;
  }
}

export function marcarVista(clave: string, version: number): boolean {
  try {
    almacen()?.setItem(clave, JSON.stringify({ version }));
    return true;
  } catch {
    return false;
  }
}
