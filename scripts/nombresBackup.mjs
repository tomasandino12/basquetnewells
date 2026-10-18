// Lógica pura de los nombres de backup: la usa scripts/backup.mjs y la prueba
// tests/backup.test.js. Sin fs ni procesos, para poder testearla sola.

export const CARPETA = 'backups';
const PARTES = ['roles', 'esquema', 'datos'];

/** AAAA-MM-DD en la zona de la máquina: el día que ve el usuario, no el de UTC. */
export function fechaLocal(fecha) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/**
 * Las tres rutas del backup de `fecha`. `existentes` son los nombres que ya hay
 * en la carpeta: si ese día ya tiene backup, se suma -2, -3… en vez de pisarlo
 * (pasa con el semanal y otro antes de un db push el mismo día).
 */
export function nombresBackup(fecha, existentes) {
  const dia = fechaLocal(fecha);
  const ocupado = (prefijo) => existentes.some((n) => PARTES.some((p) => n === `${prefijo}_${p}.sql`));
  let prefijo = dia;
  for (let n = 2; ocupado(prefijo); n++) prefijo = `${dia}-${n}`;
  return Object.fromEntries(PARTES.map((p) => [p, `${CARPETA}/${prefijo}_${p}.sql`]));
}
