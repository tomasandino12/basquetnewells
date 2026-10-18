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
test('appsscript.json pide sólo forms, drive y script.scriptapp', () => {
  const manifiesto = JSON.parse(readFileSync(new URL('appsscript.json', CARPETA), 'utf8'));
  assert.deepEqual([...manifiesto.oauthScopes].sort(), [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/forms',
    'https://www.googleapis.com/auth/script.scriptapp',
  ]);
});

test('el script no borra nada ni usa Sheets ni mail', () => {
  const prohibidos = /setTrashed|removeFile|removeFolder|deleteResponse|deleteAllResponses|SpreadsheetApp|MailApp|GmailApp|UrlFetchApp/;
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))) {
    const sinComentarios = readFileSync(new URL(nombre, CARPETA), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(sinComentarios, prohibidos, nombre);
  }
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
