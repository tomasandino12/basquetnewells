/**
 * Script (proyecto propio, no atado a la planilla: el Tablero ya tiene otro
 * script atado y una planilla admite uno solo) que le manda a Semillero el ESTADO de cada
 * chico (documentos ✅/❌, pagos por concepto, fecha de actualización). Nunca
 * DNIs, archivos ni datos médicos.
 *
 * El token NO va acá: lo genera el coordinador en Semillero (Coordinación →
 * Familias → Papeles y pagos → Conectar con Google) y se pega en
 * Configuración del proyecto → Propiedades del script → SEMILLERO_TOKEN.
 */

// Estos dos datos son públicos por diseño (están en la web de la app). Sin el
// token del club no sirven para nada: la función de la base lo exige.
var SEMILLERO_URL = 'https://lseqvbtdzebomxwtqhwu.supabase.co';
var SEMILLERO_CLAVE_PUBLICA = 'sb_publishable_nuPVo5yqsAFzY1uf6qcWBA_quRRgUFF';

// ID del Tablero: está en la URL, docs.google.com/spreadsheets/d/<ESTE_ID>/edit
var TABLERO_ID = 'PEGAR_ID_DEL_TABLERO';

// Hojas del Tablero que el script LEE (no escribe nada, en ninguna).
var HOJA_TABLERO = 'Tablero';
var HOJA_PAGOS = 'Pagos';
var HOJA_SALIDA = 'Salida Semillero';

// Cada cuántos minutos se manda (Apps Script sólo admite 1, 5, 10, 15 o 30).
var MINUTOS_ENTRE_ENVIOS = 15;

// Hasta qué columna se mira en Tablero y Pagos (Z = 26): documentos y pagos de formularios propios.
var ULTIMA_COLUMNA = 26;
