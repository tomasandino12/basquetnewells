/**
 * Lo único que se completa a mano al instalar. Todo lo demás se configura
 * con carpetas de Drive, sin tocar código (ver google/GUIA.md).
 */

// ID de la carpeta "Formularios con archivos". Está en la URL al abrirla en Drive:
// drive.google.com/drive/folders/<ESTE_ID>
// Todo formulario que esté adentro se procesa; el que se saca, deja de procesarse.
var CARPETA_FORMULARIOS_ID = 'PEGAR_ID_DE_LA_CARPETA_FORMULARIOS_CON_ARCHIVOS';

// ID de la carpeta "Jugadores": adentro se crea una carpeta por chico.
var CARPETA_JUGADORES_ID = 'PEGAR_ID_DE_LA_CARPETA_JUGADORES';

// Títulos de las 3 preguntas estándar. Tienen que ser idénticos en cada formulario
// (la plantilla ya los trae). Mayúsculas y espacios de más no importan.
var TITULO_DNI = 'DNI del jugador (sin puntos)';
var TITULO_APELLIDO = 'Apellido del jugador';
var TITULO_NOMBRE = 'Nombre del jugador';

// Pregunta opcional: si un formulario la tiene, su respuesta va en el nombre del archivo.
var TITULO_CONCEPTO = 'Concepto';

// Cada cuántos minutos se revisan los formularios (Apps Script sólo admite 1, 5, 10, 15 o 30).
var MINUTOS_ENTRE_BARRIDOS = 10;

// Apps Script corta cada ejecución a los 6 minutos: se corta antes y sigue en el próximo barrido.
var MILISEGUNDOS_MAXIMOS_POR_BARRIDO = 4.5 * 60 * 1000;
