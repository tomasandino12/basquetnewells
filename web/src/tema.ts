import { useSyncExternalStore } from 'react';
import { CLAVE_TEMA, normalizarTema } from '@datos/tema.js';

export type Tema = 'claro' | 'oscuro';

/** Si el teléfono no dejó guardar, el cambio vale mientras la pestaña esté abierta: se recuerda acá. */
let sinGuardar: Tema | null = null;
const oyentes = new Set<() => void>();

/**
 * El tema es del teléfono y es el mismo que el de la app vieja (misma clave): quien lo prendió en
 * /app lo ve igual en /nueva. Todo en try/catch: en modo privado localStorage tira, y no poder
 * leerlo nunca rompe la pantalla (queda claro).
 */
export function leerTema(): Tema {
  if (sinGuardar) return sinGuardar;
  try {
    return normalizarTema(localStorage.getItem(CLAVE_TEMA)) as Tema;
  } catch {
    return 'claro';
  }
}

/** Devuelve si se pudo recordar en este teléfono; el cambio se avisa a quien mira el tema igual. */
export function guardarTema(tema: Tema): boolean {
  let guardado = true;
  try {
    if (tema === 'oscuro') localStorage.setItem(CLAVE_TEMA, 'oscuro');
    else localStorage.removeItem(CLAVE_TEMA);
    sinGuardar = null;
  } catch {
    guardado = false;
    sinGuardar = tema;
  }
  oyentes.forEach((o) => o());
  return guardado;
}

/** En <html> y no en un contenedor: las hojas del celular se dibujan en <body> y lo heredan. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
}

/** El tema de ahora, siempre al día: el botón del marco y el interruptor de Mi perfil leen lo mismo. */
export function useTema(): Tema {
  return useSyncExternalStore(
    (aviso) => {
      oyentes.add(aviso);
      return () => oyentes.delete(aviso);
    },
    leerTema,
    () => 'claro',
  );
}
