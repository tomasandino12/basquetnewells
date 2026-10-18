import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombresBackup, fechaLocal } from '../scripts/nombresBackup.mjs';

const lineas = (ruta) => readFileSync(ruta, 'utf8').split(/\r?\n/).map((l) => l.trim());

test('arma los tres nombres con la fecha local', () => {
  assert.deepEqual(nombresBackup(new Date(2026, 9, 16, 10, 0), []), {
    roles: 'backups/2026-10-16_roles.sql',
    esquema: 'backups/2026-10-16_esquema.sql',
    datos: 'backups/2026-10-16_datos.sql',
  });
});

test('no pisa un backup del mismo día: suma -2 y después -3', () => {
  const dia = new Date(2026, 9, 16, 10, 0);
  // Alcanza con que exista uno de los tres: un backup a medias de ese día tampoco se pisa.
  assert.equal(nombresBackup(dia, ['2026-10-16_datos.sql']).datos, 'backups/2026-10-16-2_datos.sql');
  const conDos = ['2026-10-16_roles.sql', '2026-10-16-2_esquema.sql'];
  assert.equal(nombresBackup(dia, conDos).esquema, 'backups/2026-10-16-3_esquema.sql');
  // Los de otro día no cuentan.
  assert.equal(nombresBackup(dia, ['2026-10-15_datos.sql']).roles, 'backups/2026-10-16_roles.sql');
});

test('la fecha usa la zona local, no UTC', () => {
  // A las 23:30 en Argentina en UTC ya es el día siguiente: el backup es del día que ve el usuario.
  assert.equal(fechaLocal(new Date(2026, 9, 15, 23, 30)), '2026-10-15');
  assert.equal(fechaLocal(new Date(2026, 0, 5, 0, 10)), '2026-01-05');
});

test('backups/ está en .gitignore y en .vercelignore', () => {
  // Los backups tienen nombres de menores y hashes de contraseñas: ni al repo ni al deploy
  // (un `vercel deploy` local sube lo que no está en git).
  assert.ok(lineas('.gitignore').includes('backups/'), 'falta backups/ en .gitignore');
  assert.ok(lineas('.vercelignore').includes('backups/'), 'falta backups/ en .vercelignore');
});
