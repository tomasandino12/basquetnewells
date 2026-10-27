// npm run publicar: arma la copia pública del repo. Es la historia de main
// entera, menos los archivos que muestran debilidades o compromisos sin cerrar
// (los que hoy viven en docs/privado/). El repo de trabajo puede quedar privado
// y éste es el que se muestra.
//
//   npm run publicar                  → la arma en una carpeta temporal y la verifica
//   npm run publicar -- --push <url>  → además la sube a ese repo
//
// git filter-repo es determinista: los mismos commits dan los mismos hashes,
// así que cada publicación nueva es un push común, sin forzar.

import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Rutas que no salen nunca, ni en la historia. Una carpeta termina en "/".
export const PRIVADOS = [
  'docs/privado/',
  'docs/SEGURIDAD-LANZAMIENTO.md',
  'docs/LEGAL-EMERGENCIAS.md',
  'docs/revision-ux-2026-10-04.md',
  'docs/legal/',
  '.claude/scheduled_tasks.lock',
];

export const esPrivado = (ruta) => PRIVADOS.some((p) => (p.endsWith('/') ? ruta.startsWith(p) : ruta === p));

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(`\ngit ${args.join(' ')} falló:\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const i = process.argv.indexOf('--push');
  const destino = i === -1 ? null : process.argv[i + 1];
  if (i !== -1 && !destino) {
    console.error('\nFalta la dirección: npm run publicar -- --push https://github.com/<usuario>/<repo>.git\n');
    process.exit(1);
  }
  if (spawnSync('git', ['filter-repo', '--version'], { stdio: 'ignore' }).status !== 0) {
    console.error('\nFalta git filter-repo: pip install git-filter-repo\n');
    process.exit(1);
  }

  // Un clon nuevo y sólo de main: filter-repo reescribe el repo donde corre y
  // el de trabajo, con sus ramas y worktrees, no se toca.
  const copia = path.join(mkdtempSync(path.join(tmpdir(), 'semillero-publico-')), 'repo');
  git(['clone', '--quiet', '--no-local', '--single-branch', '--branch', 'main', raiz, copia]);
  git(['filter-repo', '--quiet', '--force', '--invert-paths', ...PRIVADOS.flatMap((p) => ['--path', p])], copia);

  const enLaHistoria = [...new Set(git(['log', '--all', '--name-only', '--format='], copia).split('\n'))].filter(esPrivado);
  if (enLaHistoria.length) {
    console.error(`\nQuedaron en la historia:\n  ${enLaHistoria.join('\n  ')}\n`);
    process.exit(1);
  }
  const commits = git(['rev-list', '--count', 'main'], copia).trim();
  console.log(`\nCopia pública lista: ${commits} commits, sin ningún archivo privado en la historia.\n  ${copia}`);

  if (destino) {
    git(['push', destino, 'main'], copia);
    console.log(`Subida a ${destino}`);
  }
}
