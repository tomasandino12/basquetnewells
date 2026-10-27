// npm run backup: guarda roles, esquema y datos de la base de producción en
// backups/ (ver docs/guias/BACKUP.md). Sólo LEE de producción. No sube nada a ningún
// lado ni guarda la contraseña: si la CLI la pide, se escribe en la terminal.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { CARPETA, nombresBackup } from './nombresBackup.mjs';

// En Windows npx es un .cmd y sin shell no arranca.
const enWindows = process.platform === 'win32';

function salir(mensaje) {
  console.error(`\n${mensaje}\n`);
  process.exit(1);
}

// db dump corre pg_dump adentro de un contenedor: sin Docker falla con un error confuso.
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  salir('Docker no responde. Abrí Docker Desktop, esperá a que diga "Engine running" y volvé a correr npm run backup.');
}
if (!existsSync('supabase/.temp/project-ref')) {
  salir('El proyecto no está vinculado. Corré npx supabase link --project-ref <ref> (el ref está en la URL del panel).');
}

mkdirSync(CARPETA, { recursive: true });
const rutas = nombresBackup(new Date(), readdirSync(CARPETA));

// --use-copy y los -x de las tablas de vectores de storage salen tal cual de la
// guía oficial de backup con la CLI (la app no usa Storage).
const dumps = [
  ['roles', ['--role-only']],
  ['esquema', []],
  ['datos', ['--data-only', '--use-copy', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes']],
];

for (const [parte, extra] of dumps) {
  console.log(`\n→ ${parte}: ${rutas[parte]}`);
  const r = spawnSync('npx', ['supabase', 'db', 'dump', '--linked', '-f', rutas[parte], ...extra], {
    stdio: 'inherit',
    shell: enWindows,
  });
  if (r.status !== 0) {
    // Un backup a medias no tiene que parecer bueno: se borra lo de esta corrida.
    for (const ruta of Object.values(rutas)) rmSync(ruta, { force: true });
    salir(`Falló el dump de ${parte}. Se borraron los archivos de esta corrida; no quedó backup.`);
  }
}

// Sin los usuarios de Auth, miembro_club y asignacion_plantel apuntan a nadie y la restauración no sirve.
if (!readFileSync(rutas.datos, 'utf8').includes('COPY "auth"."users"')) {
  salir(`${rutas.datos} no trae los usuarios de Auth: este backup no alcanza para restaurar. Avisá antes de seguir.`);
}

console.log('\nBackup listo:');
for (const ruta of Object.values(rutas)) {
  console.log(`  ${ruta}  (${Math.ceil(statSync(ruta).size / 1024)} KB)`);
}
console.log(`
Ahora:
  1. Subí los tres archivos a la carpeta de backups del Drive del básquet.
  2. Borrá de backups/ las copias viejas: tienen nombres de menores y hashes de contraseñas.`);
