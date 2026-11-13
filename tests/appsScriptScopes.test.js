import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const CARPETA = new URL('../google/apps-script/', import.meta.url);

/**
 * El script maneja DNIs de menores: los permisos están fijados en
 * appsscript.json y este test hace que un permiso nuevo no entre sin que
 * alguien lo vea y actualice la lista de la guía.
 */
test('appsscript.json pide sólo forms, drive, script.scriptapp y script.send_mail', () => {
  const manifiesto = JSON.parse(readFileSync(new URL('appsscript.json', CARPETA), 'utf8'));
  assert.deepEqual([...manifiesto.oauthScopes].sort(), [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/forms',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/script.send_mail',
  ]);
});

const sinComentarios = (nombre) => readFileSync(new URL(nombre, CARPETA), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

test('el script no borra nada ni usa Sheets ni Gmail', () => {
  const prohibidos = /setTrashed|removeFile|removeFolder|deleteResponse|deleteAllResponses|SpreadsheetApp|GmailApp|UrlFetchApp/;
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))) {
    assert.doesNotMatch(sinComentarios(nombre), prohibidos, nombre);
  }
});

test('el mail sale sólo de avisos.gs y el aviso no lleva nombres ni DNI', () => {
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))) {
    const usaMail = /MailApp/.test(sinComentarios(nombre));
    assert.equal(usaMail, nombre === 'avisos.gs', nombre);
  }
  const g = vm.createContext({});
  vm.runInContext(readFileSync(new URL('avisos.gs', CARPETA), 'utf8'), g);
  const texto = g.textoAviso('Comprobante', 'R123', 'tiene 6 dígitos y tienen que ser 7 u 8', 'https://forms/edit');
  assert.match(texto, /R123/);
  assert.match(texto, /Comprobante/);
  assert.doesNotMatch(texto, /\d{7,}/);
});

test('un DNI inválido va a la cola de revisión en vez de perderse', () => {
  const organizar = sinComentarios('organizar.gs');
  assert.match(organizar, /avisarDniInvalido\(/);
});

test('todos los .gs compilan', () => {
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))) {
    assert.doesNotThrow(() => new vm.Script(readFileSync(new URL(nombre, CARPETA), 'utf8'), { filename: nombre }), nombre);
  }
});

test('el intervalo del barrido es uno de los que admite Apps Script', () => {
  const g = vm.createContext({});
  vm.runInContext(readFileSync(new URL('config.gs', CARPETA), 'utf8'), g);
  assert.ok([1, 5, 10, 15, 30].includes(g.MINUTOS_ENTRE_BARRIDOS));
});
