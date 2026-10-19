import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE } from '../src/data/limites.js';
import { readFileSync } from 'node:fs';
import { validarFormulario, moverFormulario, ordenarFormularios, formularioDesdeFila, formularioPublicoDesdeFila } from '../src/data/formulariosPortal.js';

/**
 * Lo que la coordinación escribe en el panel termina en una tarjeta de la
 * página pública, así que se valida acá y otra vez en la base (el check de
 * 0058). Estas pruebas no tocan red ni DOM.
 */

const valido = { titulo: 'Comprobante de rifas', texto: 'Tené a mano la foto del comprobante de pago.', enlace: 'https://forms.gle/AbC123' };

test('un formulario válido pasa y queda recortado de espacios', () => {
  const r = validarFormulario({ titulo: '  Comprobante de rifas ', texto: '  Tené a mano la foto.  ', enlace: '  https://forms.gle/AbC123  ' });
  assert.equal(r.error, null);
  assert.deepEqual(r.formulario, { titulo: 'Comprobante de rifas', texto: 'Tené a mano la foto.', enlace: 'https://forms.gle/AbC123' });
});

test('rechaza título o texto vacío o sólo de espacios', () => {
  assert.match(validarFormulario({ ...valido, titulo: '' }).error, /título/i);
  assert.match(validarFormulario({ ...valido, titulo: '   ' }).error, /título/i);
  assert.match(validarFormulario({ ...valido, texto: '' }).error, /para qué es/i);
  assert.match(validarFormulario({ ...valido, texto: '  ' }).error, /para qué es/i);
  assert.match(validarFormulario({}).error, /título/i);
});

test('rechaza título o texto más largos que el límite de la base', () => {
  assert.match(validarFormulario({ ...valido, titulo: 'x'.repeat(LIMITE.titulo + 1) }).error, /título/i);
  assert.equal(validarFormulario({ ...valido, titulo: 'x'.repeat(LIMITE.titulo) }).error, null);
  assert.match(validarFormulario({ ...valido, texto: 'x'.repeat(LIMITE.textoFormulario + 1) }).error, /texto|largo|corto/i);
  assert.equal(validarFormulario({ ...valido, texto: 'x'.repeat(LIMITE.textoFormulario) }).error, null);
});

test('rechaza enlaces fuera de Google Forms', () => {
  for (const malo of ['', 'forms.gle/AbC123', 'http://forms.gle/AbC123', 'javascript:alert(1)', 'https://evil.com/forms/x',
    'https://docs.google.com/document/d/1', 'https://forms.gle.evil.com/x', null]) {
    const r = validarFormulario({ ...valido, enlace: malo });
    assert.match(r.error ?? '', /Google Forms/, String(malo));
    assert.equal(r.formulario, null);
  }
});

test('acepta el enlace corto y el largo de Google Forms', () => {
  assert.equal(validarFormulario({ ...valido, enlace: 'https://docs.google.com/forms/d/e/1FAIpQ/viewform' }).error, null);
  assert.equal(validarFormulario({ ...valido, enlace: 'https://forms.gle/AbC123' }).error, null);
});

const lista = () => [
  { id: 'a', titulo: 'Inscripción', orden: 1 },
  { id: 'b', titulo: 'Pase', orden: 2 },
  { id: 'c', titulo: 'Aranceles', orden: 3 },
];

test('ordenarFormularios ordena por orden y desempata por título, sin tocar la lista original', () => {
  const desordenada = [{ id: 'z', titulo: 'B', orden: 2 }, { id: 'y', titulo: 'A', orden: 2 }, { id: 'x', titulo: 'C', orden: 1 }];
  assert.deepEqual(ordenarFormularios(desordenada).map((f) => f.id), ['x', 'y', 'z']);
  assert.deepEqual(desordenada.map((f) => f.id), ['z', 'y', 'x']);
});

test('subir y bajar renumera sin huecos ni repetidos', () => {
  const r = moverFormulario(lista(), 'c', 'subir');
  assert.deepEqual(r.lista.map((f) => [f.id, f.orden]), [['a', 1], ['c', 2], ['b', 3]]);
  const r2 = moverFormulario(r.lista, 'a', 'bajar');
  assert.deepEqual(r2.lista.map((f) => [f.id, f.orden]), [['c', 1], ['a', 2], ['b', 3]]);
});

test('devuelve sólo los que cambiaron de lugar, para guardar lo mínimo', () => {
  const r = moverFormulario(lista(), 'b', 'bajar');
  assert.deepEqual(r.cambios, [{ id: 'b', orden: 3 }, { id: 'c', orden: 2 }]);
});

test('el primero no sube y el último no baja: no cambia nada', () => {
  for (const [id, dir] of [['a', 'subir'], ['c', 'bajar']]) {
    const r = moverFormulario(lista(), id, dir);
    assert.deepEqual(r.cambios, []);
    assert.deepEqual(r.lista.map((f) => f.id), ['a', 'b', 'c']);
  }
});

test('con huecos o repetidos en orden, igual deja 1..n y cuenta el arreglo como cambio', () => {
  const rota = [{ id: 'a', orden: 5 }, { id: 'b', orden: 5 }, { id: 'c', orden: 9 }];
  const r = moverFormulario(rota, 'b', 'subir');
  assert.deepEqual(r.lista.map((f) => f.orden), [1, 2, 3]);
  assert.ok(r.cambios.length >= 1);
});

test('un id que no existe no cambia nada', () => {
  const r = moverFormulario(lista(), 'nope', 'subir');
  assert.deepEqual(r.cambios, []);
});

test('formularioDesdeFila pasa de la fila de la base al objeto de dominio, sin columnas de más', () => {
  const fila = {
    id: 'f1', club_id: 'c1', titulo: 'Inscripción', texto: 'Tené a mano el DNI.', enlace: 'https://forms.gle/AbC', orden: 2, activo: false,
    creado_por: 'u1', creado_en: '2026-10-18T10:00:00Z', actualizado_por: 'u2', actualizado_en: '2026-10-19T10:00:00Z',
  };
  assert.deepEqual(formularioDesdeFila(fila), {
    id: 'f1', titulo: 'Inscripción', texto: 'Tené a mano el DNI.', enlace: 'https://forms.gle/AbC', orden: 2, activo: false,
    actualizadoPor: 'u2', actualizadoEn: '2026-10-19T10:00:00Z',
  });
});

test('formularioPublicoDesdeFila sólo trae título, texto y enlace', () => {
  assert.deepEqual(formularioPublicoDesdeFila({ titulo: 'T', texto: 'x', enlace: 'https://forms.gle/a', orden: 3, id: 'z' }),
    { titulo: 'T', texto: 'x', enlace: 'https://forms.gle/a' });
});

test('el repo del portal usa la función pública y sólo las columnas con grant de update', () => {
  const repo = readFileSync('src/data/repos/portal.js', 'utf8');
  assert.match(repo, /rpc\('formularios_publicos', \{ p_club: clubId \}\)/);
  const update = repo.match(/\.update\(\{([^}]*)\}\)/)?.[1] ?? '';
  assert.match(update, /titulo/);
  assert.doesNotMatch(update, /club_id|creado_por|actualizado_por/);
  assert.doesNotMatch(repo, /\.delete\(\)/);
  assert.match(readFileSync('src/data/repositorio.js', 'utf8'), /export \* from '\.\/repos\/portal\.js';/);
});
