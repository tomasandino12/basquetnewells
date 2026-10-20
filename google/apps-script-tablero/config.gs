/**
 * Script atado a la planilla Tablero (Extensiones → Apps Script desde la planilla).
 * Lee las respuestas del formulario 2026 y arma las hojas de salida. No modifica el formulario.
 */

// ID del formulario "Base de Datos Básquet NOB 2026": está en la URL del editor,
// docs.google.com/forms/d/<ESTE_ID>/edit
var FORM_2026_ID = 'PEGAR_ID_DEL_FORMULARIO_2026';

// Hojas que el script escribe (se borran y se rearman en cada corrida).
var HOJA_INSCRIPCION_2026 = 'Inscripción 2026';
var HOJA_SEMILLERO_2026 = 'Semillero 2026';
var HOJA_EMERGENCIAS_2026 = 'Emergencias 2026';
var HOJA_REVISAR_2026 = 'Revisar 2026';

// Hoja que el script sólo lee: correcciones a mano de apellido y nombre (DNI | Apellido | Nombre).
// Sobreviven a las corridas siguientes.
var HOJA_CORRECCIONES_2026 = 'Correcciones 2026';

// Títulos de las preguntas del formulario 2026. Se comparan sin tildes ni mayúsculas
// y sólo hasta el primer paréntesis, así que un "(Nombre y Teléfono)" de más no molesta.
var TITULOS_2026 = {
  nombreCompleto: 'Apellido y Nombre del Deportista',
  dni: 'DNI / Pasaporte',
  fechaNacimiento: 'Fecha de Nacimiento',
  categoria: 'Categoría 2026',
  telefonoAdulto: 'Teléfono de Familiar a Cargo',
  obraSocial: 'Obra Social / Prepaga / Seguro Médico',
  afecciones: '¿Ha sufrido alguna de estas afecciones?',
  alergias: '¿Es alérgico a algún medicamento, alimento o sustancia?',
  indicacion: '¿Es propenso a alguna enfermedad o tiene una indicación médica especial?',
  medicacion: '¿Actualmente ingiere algún medicamento de forma regular?',
  urgencia: 'EN CASO DE URGENCIA LLAMAR A',
  consentimiento: 'Consentimiento de Datos'
};

// ---- Envío del estado a Semillero (semillero.gs) ----
// No manda DNIs, archivos ni datos médicos: sólo estado (documento ✅/❌, pago por concepto, fecha de cambio).
// El token NO va acá: lo genera el coordinador en Semillero (Coordinación → Familias → Papeles y pagos →
// Conectar con Google) y se pega en Configuración del proyecto → Propiedades del script → SEMILLERO_TOKEN.

// Estos dos datos son públicos por diseño (están en la web de la app). Sin el token del club no sirven para nada.
var SEMILLERO_URL = 'https://lseqvbtdzebomxwtqhwu.supabase.co';
var SEMILLERO_CLAVE_PUBLICA = 'sb_publishable_nuPVo5yqsAFzY1uf6qcWBA_quRRgUFF';

// Hojas de este Tablero que el envío LEE (no escribe nada, en ninguna).
var HOJA_TABLERO = 'Tablero';
var HOJA_PAGOS = 'Pagos';
var HOJA_SALIDA = 'Salida Semillero';

// Cada cuántos minutos se manda (Apps Script sólo admite 1, 5, 10, 15 o 30).
var MINUTOS_ENTRE_ENVIOS = 15;

// Hasta qué columna se mira en Tablero y Pagos (Z = 26): documentos y pagos de formularios propios.
var ULTIMA_COLUMNA = 26;
