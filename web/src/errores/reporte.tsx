import { Component, useEffect, useState, type ReactNode } from 'react';
import { registroDeError } from '@datos/errorDeCliente.js';
import { alReportarError } from '@ui/errores.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { cargarRepositorioReal, type Repositorio } from '../datos/repositorio';

/*
 * Los errores que nadie atrapó. Una excepción adentro de un render o una promesa rechazada sin catch no se veían
 * en ningún lado: la pantalla quedaba a medio dibujar y el profe pensaba que la app «se tildó». Dos cosas:
 * avisarle a quien la usa y dejar el registro (depurado: sin nombres, mails ni números largos) para mirarlo después.
 */

/** Tope de reportes por carga de página: un error en un bucle de render dispara cientos en un segundo. */
const TOPE = 10;
/** Un aviso cada tanto, por el mismo motivo. */
const ESPERA_ENTRE_AVISOS = 5000;
export const AVISO_DE_FALLA = 'Algo falló. Si se repite, contale al coordinador.';
const EVENTO = 'falla-de-la-app';

type Guardar = (registro: ReturnType<typeof registroDeError>) => void;

/** La pantalla donde pasó: sólo el primer tramo de la dirección (nunca ids ni nombres). */
const pantallaActual = () => window.location.pathname.replace(/^\/(app|nueva)/, '').split('/').filter(Boolean)[0] ?? 'inicio';

const guardarEnLaBase: Guardar = (registro) => {
  // No tira nunca: si se cayó la red, el registro se pierde y se sigue.
  void cargarRepositorioReal()
    .then((repo: Repositorio) => repo.guardarErrorDeCliente(registro, null))
    .catch(() => {});
};

export function iniciarReporteDeErrores(guardar: Guardar = guardarEnLaBase): void {
  let reportados = 0;
  let ultimoAviso = 0;

  const manejar = (error: unknown) => {
    if (reportados >= TOPE) return;
    reportados += 1;
    const ahora = Date.now();
    if (ahora - ultimoAviso > ESPERA_ENTRE_AVISOS) {
      ultimoAviso = ahora;
      window.dispatchEvent(new Event(EVENTO));
    }
    // Todo esto corre adentro del manejador de errores: si algo tira, el navegador vuelve a entrar por la misma puerta.
    try {
      console.error('[error no atrapado]', error);
      guardar(registroDeError(error, { pantalla: pantallaActual(), agente: navigator.userAgent }));
    } catch {
      // Ni siquiera se pudo armar el registro: se pierde y se sigue (el aviso ya salió).
    }
  };

  window.addEventListener('error', (e) => manejar(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => manejar(e.reason));
  // Los errores que sí se le mostraron a la persona (mensajeAlGuardar): el código va adentro del mensaje.
  alReportarError(({ codigo, mensaje }: { codigo: string | null; mensaje: string }) => {
    try {
      guardar(registroDeError({ message: codigo ? `[${codigo}] ${mensaje}` : mensaje }, { pantalla: pantallaActual(), agente: navigator.userAgent }));
    } catch {
      // idem
    }
  });
}

/** El aviso arriba de todo cuando algo falló sin que nadie lo atrape. Se va solo. */
export function AvisoDeFalla() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let t = 0;
    const mostrar = () => {
      setVisible(true);
      clearTimeout(t);
      t = window.setTimeout(() => setVisible(false), 6000);
    };
    window.addEventListener(EVENTO, mostrar);
    return () => {
      window.removeEventListener(EVENTO, mostrar);
      clearTimeout(t);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-md p-3">
      <Aviso tono="error" titulo="Algo falló">{AVISO_DE_FALLA}</Aviso>
    </div>
  );
}

/** Si una pantalla se rompe al dibujarse, no queda en blanco: se dice y se puede recargar. */
export class PantallaRota extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-3 p-6">
        <Aviso tono="error" titulo="Algo falló">{AVISO_DE_FALLA}</Aviso>
        <Boton variante="contorno" onClick={() => window.location.reload()}>Recargar</Boton>
      </div>
    );
  }
}
