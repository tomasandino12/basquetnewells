/**
 * Estado de papeles y pagos de cada chico, tal como lo manda el script de
 * Google del club (0060, spec 2026-10-19-panel-docs-pagos). Sin red ni DOM.
 *
 * Las reglas de límites viven también en la migración, que es la que las hace
 * cumplir: tests/contratoEstadoInscripcion.test.js compara las dos.
 */
import { mapearCategoria } from './inscriptos.js';

export const LIMITES_ESTADO = Object.freeze({
  nombre: 80,
  categoria: 80,
  encabezado: 60,
  encabezados: 25,
  filas: 1500,
  fila: 5000,
  bytes: 1048576,
});

export const ESTADOS_PAGO = Object.freeze(['falta', 'subido', 'verificado']);

export const EMPAREJAMIENTOS = Object.freeze(['ok', 'homonimo', 'sin_ficha', 'sin_tablero']);

// Tiene plantel en Semillero y no figura en el tablero: no se sabe nada de él.
const sinTablero = (c) => c.emparejamiento === 'sin_tablero';

/** Fila de `estado_inscripcion_del_club` → chico de dominio (camelCase). */
export function chicoDesdeFila(f) {
  return {
    id: f.id,
    nombre: f.nombre,
    nombreGoogle: f.nombre_google ?? null,
    categoriaCodigo: f.categoria_codigo ?? null,
    categoriaTexto: f.categoria_texto ?? null,
    rama: f.rama ?? null,
    emparejamiento: f.emparejamiento,
    fila: f.fila ?? null,
    documentos: f.documentos ?? {},
    completo: f.completo ?? null,
    pagos: f.pagos ?? {},
    cambioEn: f.cambio_en ?? null,
  };
}

/** Fila de `conexion_google_del_club` → conexión de dominio. */
export function conexionDesdeFila(f) {
  return {
    conectado: f?.conectado === true,
    rotadoEn: f?.rotado_en ?? null,
    ultimoEnvioEn: f?.ultimo_envio_en ?? null,
    tableroUrl: f?.tablero_url ?? null,
    gidTablero: f?.gid_tablero ?? null,
    gidPagos: f?.gid_pagos ?? null,
    documentosOrden: f?.documentos_orden ?? [],
    conceptosOrden: f?.conceptos_orden ?? [],
  };
}

/** 'falta' | 'subido' | 'verificado' de un concepto. Lo que no vino es 'falta'. */
export function estadoDePago(chico, concepto) {
  if (sinTablero(chico)) return 'falta';
  return chico.pagos[concepto] ?? 'falta';
}

/**
 * Los conceptos en el orden del tablero y, al final, los que aparecen en
 * algún chico y no figuran en el orden: un concepto nuevo aparece solo.
 */
export function conceptosDe(chicos, conceptosOrden = []) {
  const extra = new Set();
  for (const c of chicos) for (const k of Object.keys(c.pagos)) extra.add(k);
  for (const k of conceptosOrden) extra.delete(k);
  return [...conceptosOrden, ...[...extra].sort()];
}

/** Algún concepto sin comprobante, o un chico que no figura en el tablero. */
export const debeAlgo = (chico, conceptos) =>
  sinTablero(chico) || conceptos.some((k) => estadoDePago(chico, k) === 'falta');

/** Documentación incompleta o que no se sabe (null): se muestra para revisar. */
export const faltaDocumentacion = (chico) => chico.completo !== true;

export const porVerificar = (chico, conceptos) =>
  !sinTablero(chico) && conceptos.some((k) => estadoDePago(chico, k) === 'subido');

/** Código de Semillero si tiene ficha; si no, el que sale del texto del tablero. */
export function categoriaDeChico(chico) {
  if (chico.categoriaCodigo) return chico.categoriaCodigo;
  return mapearCategoria(chico.categoriaTexto, chico.rama ?? '').codigo;
}

/** Los filtros se combinan (y). `categoria` null = todas. */
export function filtrar(chicos, { categoria = null, debe = false, faltaDoc = false, verificar = false, conceptos = [] } = {}) {
  return chicos.filter((c) =>
    (!categoria || categoriaDeChico(c) === categoria)
    && (!debe || debeAlgo(c, conceptos))
    && (!faltaDoc || faltaDocumentacion(c))
    && (!verificar || porVerificar(c, conceptos)));
}

/** Por concepto, cuántos chicos hay en cada estado; y la documentación completa. */
export function contadores(chicos, conceptos) {
  const porConcepto = conceptos.map((concepto) => {
    const n = { concepto, verificado: 0, subido: 0, falta: 0 };
    for (const c of chicos) n[estadoDePago(c, concepto)] += 1;
    return n;
  });
  const documentacion = {
    completos: chicos.filter((c) => c.completo === true).length,
    total: chicos.length,
  };
  return { porConcepto, documentacion };
}

/** Lo que se ve en la tarjeta de Panorama. */
export function resumenPanorama(chicos, conceptos) {
  return {
    debenAlgo: chicos.filter((c) => debeAlgo(c, conceptos)).length,
    sinPapeles: chicos.filter(faltaDocumentacion).length,
  };
}

/**
 * Link a la fila del chico en la hoja `tablero` o `pagos`: abre la planilla
 * con la fila seleccionada. null si no hay conexión o el chico no está en el tablero.
 */
export function linkFila(conexion, hoja, fila) {
  const gid = hoja === 'pagos' ? conexion?.gidPagos : conexion?.gidTablero;
  if (!conexion?.tableroUrl || gid == null || !Number.isInteger(fila)) return null;
  return `${conexion.tableroUrl}/edit#gid=${gid}&range=A${fila}:Z${fila}`;
}
