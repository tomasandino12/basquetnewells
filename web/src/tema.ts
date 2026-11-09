import { CLAVE_TEMA, normalizarTema } from '@datos/tema.js';

export type Tema = 'claro' | 'oscuro';

/**
 * El tema es del teléfono y es el mismo que el de la app vieja (misma clave): quien lo prendió en
 * /app lo ve igual en /nueva. Todo en try/catch: en modo privado localStorage tira, y no poder
 * leerlo nunca rompe la pantalla (queda claro).
 */
export function leerTema(): Tema {
  try {
    return normalizarTema(localStorage.getItem(CLAVE_TEMA)) as Tema;
  } catch {
    return 'claro';
  }
}

export function guardarTema(tema: Tema): void {
  try {
    if (tema === 'oscuro') localStorage.setItem(CLAVE_TEMA, 'oscuro');
    else localStorage.removeItem(CLAVE_TEMA);
  } catch {
    // Sin permiso para guardar: el cambio vale mientras la pestaña esté abierta.
  }
}

/** En <html> y no en un contenedor: las hojas del celular se dibujan en <body> y lo heredan. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
}
