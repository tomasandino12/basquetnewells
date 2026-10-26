// La clave con la que se compara el nombre de un jugador entre planillas (CABB, físico, inscriptos).
// Vive acá y no en parser/parserCabb.js porque ese archivo importa `xlsx` (~1 MB sin comprimir) y el
// portal público, que sólo necesita estas dos funciones, lo bajaba entero para nada.
export function limpiarNombre(nombreCrudo) {
  if (typeof nombreCrudo !== 'string') return '';
  let limpio = nombreCrudo.trim();
  limpio = limpio.replace(/\s+/g, ' ');
  limpio = limpio.replace(/\s+,/g, ',');
  limpio = limpio.replace(/,+/g, ',');
  limpio = limpio.replace(/,\s*/g, ', ');
  return limpio.trim();
}

export function clavearNombre(nombreLimpio) {
  if (typeof nombreLimpio !== 'string') return '';
  return nombreLimpio
    .toUpperCase()
    .normalize('NFD')
    .replace(new RegExp('[\u0300-\u036f]', 'g'), '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
