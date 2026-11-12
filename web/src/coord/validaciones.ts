// Las funciones puras de src/data que validan lo que escribe coordinación, con los tipos que el JS no declara.
import {
  nombreRepetido as nombreRepetidoJs, validarMovimiento as validarMovimientoJs, validarRubro as validarRubroJs,
} from '@datos/finanzas.js';
import { quienTieneElDestino as quienTieneElDestinoJs } from '@datos/formulariosPortal.js';
import type { FilaDeMovimiento, FormularioDelPortal, Rubro } from '../datos/repositorioCoord';

interface Resultado<F> {
  error?: string;
  campo?: string;
  fila?: F;
}

export const validarRubro = (datos: { nombre: string; tipo: string | null }) =>
  validarRubroJs(datos) as Resultado<{ nombre: string; tipo: string }>;

export const nombreRepetido = (rubros: Rubro[], nombre: string, idPropio: string | null = null) =>
  (nombreRepetidoJs as (r: Rubro[], n: string, id: string | null) => boolean)(rubros, nombre, idPropio);

export const validarMovimiento = (
  datos: { fecha: string; rubroId: string; monto: string; descripcion: string; comprobanteUrl: string },
  rubros: Rubro[],
  opciones: { rubroOriginal: string | null },
) =>
  (validarMovimientoJs as (d: typeof datos, r: Rubro[], o: typeof opciones) => Resultado<FilaDeMovimiento>)(datos, rubros, opciones);

export const quienTieneElDestino = (lista: FormularioDelPortal[], destino: string | null, exceptoId: string | null = null) =>
  (quienTieneElDestinoJs as (l: FormularioDelPortal[], d: string | null, e: string | null) => FormularioDelPortal | null)(lista, destino, exceptoId);
