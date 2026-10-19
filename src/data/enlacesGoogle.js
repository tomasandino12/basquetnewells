/*
 * Links hacia el Drive del club, armados con datos que Semillero ya tiene.
 * No traen nada de Google ni mandan nada: abrir la carpeta depende de los
 * permisos de la cuenta de Google de quien toca el link.
 */

const BUSQUEDA_DRIVE = 'https://drive.google.com/drive/search?q=';

/**
 * "Apellido, Nombre" → búsqueda en Drive de la carpeta del chico (que se
 * llama `APELLIDO, Nombre — DNI`). Saca la coma y todo dígito: el link nunca
 * lleva un DNI, aunque alguien lo haya escrito en el nombre. Sin nombre → null.
 */
export function linkCarpetaEnDrive(nombreLimpio) {
  const q = String(nombreLimpio ?? '')
    .replace(/[0-9,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return q ? BUSQUEDA_DRIVE + encodeURIComponent(q) : null;
}
