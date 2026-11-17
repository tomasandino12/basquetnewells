/*
 * Las funciones puras de src/data/jugadas.js con tipos, para el editor. Cada una
 * recibe los datos y devuelve datos nuevos (o lanza con el motivo si la regla no
 * se cumple): el editor las encadena en el historial sin tocar nada en el lugar.
 */
import * as J from '@datos/jugadas.js';
import { FORMACIONES as FORMACIONES_JS } from '@datos/formaciones.js';
import type { AccionDePizarra, DatosDePizarra, FichaDePizarra } from '../datos/repositorio';

type D = DatosDePizarra;
type Punto = { x: number; y: number };

interface Operaciones {
  aplicarAccion(d: D, k: number, accion: AccionDePizarra): D;
  agregarFicha(d: D, ficha: FichaDePizarra): D;
  quitarFicha(d: D, id: string): D;
  moverFicha(d: D, id: string, x: number, y: number): D;
  ajustarFicha(d: D, k: number, id: string, x: number, y: number): D;
  quitarAccion(d: D, k: number, indice: number): D;
  fijarControlDeAccion(d: D, k: number, indice: number, control: Punto | null): D;
  fijarDestinoDeAccion(d: D, k: number, indice: number, hasta: Punto): D;
  tieneDestinoLibre(a: AccionDePizarra | undefined): boolean;
  agregarPaso(d: D): D;
  quitarPaso(d: D, k: number): D;
  fijarNotaDePaso(d: D, k: number, nota: string): D;
  darPelotaInicial(d: D, id: string | null): D;
  proximoNumeroLibre(d: D, tipo: string): number | null;
  resumenDePaso(paso: D['pasos'][number] | undefined, indice: number): { numero: number; titulo: string };
  pantallaAptaParaEditar(ancho: number, alto: number): boolean;
  etiquetaDeTipo(tipo: string): string;
  nosotrosDefiende(tipo: string): boolean;
}

export const ops = J as unknown as Operaciones;
export const TIPOS_JUGADA = J.TIPOS_JUGADA as { clave: string; etiqueta: string }[];
export const TIPOS_ACCION = J.TIPOS_ACCION as string[];
export const FORMACIONES = FORMACIONES_JS as { clave: string; etiqueta: string; datos: DatosDePizarra }[];
