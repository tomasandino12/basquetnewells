import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const CARPETA = new URL('../google/apps-script-tablero/', import.meta.url);
const leer = (url) => readFileSync(url, 'utf8');

const g = vm.createContext({});
vm.runInContext(leer(new URL('fila2026.gs', CARPETA)), g);
vm.runInContext(leer(new URL('config.gs', CARPETA)), g);

const gNombres = vm.createContext({});
vm.runInContext(leer(new URL('../google/apps-script/nombres.gs', import.meta.url)), gNombres);

const cruda = (momento, dni, extra = {}) => ({
  momento,
  respuestas: {
    'apellido y nombre del deportista': 'Perez Juan',
    'dni / pasaporte': dni,
    'fecha de nacimiento': '2012-03-05',
    'categoria 2026': 'U15 - MASCULINO (2012 y 2011)',
    'telefono de familiar a cargo': '341 5551234',
    'obra social / prepaga / seguro medico': 'OSDE',
    '¿ha sufrido alguna de estas afecciones?': ['Asma'],
    '¿es alergico a algun medicamento, alimento o sustancia?': 'Penicilina',
    '¿es propenso a alguna enfermedad o tiene una indicacion medica especial?': '',
    '¿actualmente ingiere algun medicamento de forma regular?': '',
    'en caso de urgencia llamar a': 'Ana 341 5559999',
    'consentimiento de datos': ['Declaro...'],
    ...extra
  }
});
const registro = (c) => g.registroDeRespuesta(c, g.TITULOS_2026);

test('normaliza el DNI con puntos y espacios, igual que el script de carpetas', () => {
  for (const t of ['11.111.111', ' 1 234 567 ', '22-222-222', 'ABC', '']) {
    assert.equal(g.normalizarDni(t), gNombres.normalizarDni(t));
  }
  assert.equal(g.dniValido('1234567'), gNombres.dniValido('1234567'));
});

test('encuentra las preguntas aunque cambie lo que va entre paréntesis o la tilde', () => {
  assert.equal(g.claveTitulo('EN CASO DE URGENCIA LLAMAR A (Nombre y Teléfono)'), 'en caso de urgencia llamar a');
  assert.equal(g.claveTitulo('Categoría 2026'), 'categoria 2026');
});

test('los títulos configurados no se repiten', () => {
  const claves = Object.values(g.TITULOS_2026).map(g.claveTitulo);
  assert.equal(new Set(claves).size, claves.length);
});

test('separa apellido y nombre y marca los dudosos para revisar', () => {
  const ok = g.separarApellidoNombre('Perez Juan');
  assert.equal(ok.apellido, 'Perez');
  assert.equal(ok.nombre, 'Juan');
  assert.equal(ok.revisar, false);
  assert.equal(g.separarApellidoNombre('Perez Juan Pablo').revisar, true);
  assert.equal(g.separarApellidoNombre('De la Fuente Ana').revisar, true);
  assert.equal(g.separarApellidoNombre('Perez').revisar, true);
});

test('saltea pasaportes y DNIs inválidos', () => {
  assert.equal(registro(cruda(1, 'AB123456')), null);
  assert.equal(registro(cruda(1, '1234')), null);
  assert.equal(registro(cruda(1, '')), null);
  assert.equal(registro(cruda(1, '11.111.111')).dni, '11111111');
});

test('se queda con la última respuesta de cada DNI', () => {
  const viejo = registro(cruda(1, '11111111', { 'apellido y nombre del deportista': 'Viejo Dato' }));
  const nuevo = registro(cruda(2, '11.111.111', { 'apellido y nombre del deportista': 'Nuevo Dato' }));
  const otro = registro(cruda(1, '22222222'));
  const r = g.ultimaPorDni([nuevo, viejo, otro]);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.dni === '11111111').apellido, 'Nuevo');
});

test('Para Semillero: 6 columnas exactas, mail vacío, rama de la categoría y sin DNI', () => {
  assert.deepEqual([...g.ENCABEZADOS_SEMILLERO], ['Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Mail del responsable', 'Rama']);
  const fila = g.filaSemillero(registro(cruda(1, '11111111')));
  assert.equal(fila.length, 6);
  assert.equal(fila[4], '');
  assert.equal(fila[5], 'Masculino');
  assert.equal(fila[2].anio, 2012);
  assert.equal(fila[2].mes, 3);
  assert.equal(fila[2].dia, 5);
  assert.ok(!fila.includes('11111111'));
  assert.equal(g.ramaDeCategoria('U13 - MIXTO (2014 y 2013)'), '');
  assert.equal(g.ramaDeCategoria('MAYORES FEMENINO'), 'Femenino');
});

test('Emergencias: 9 columnas exactas, sólo con consentimiento y sin datos de más', () => {
  assert.deepEqual([...g.ENCABEZADOS_EMERGENCIAS], ['Apellido y nombre', 'Fecha de nacimiento', 'Teléfono del adulto', 'Contacto de urgencia', 'Afecciones', 'Alergias', 'Medicación', 'Indicación médica', 'Obra social']);
  const fila = g.filaEmergencias(registro(cruda(1, '11111111')));
  assert.equal(fila.length, 9);
  assert.equal(fila[4], 'Asma');
  assert.ok(!fila.includes('11111111'));
  assert.equal(g.filaEmergencias(registro(cruda(1, '11111111', { 'consentimiento de datos': [] }))), null);
  assert.equal(g.filaEmergencias(registro(cruda(1, '11111111', { 'consentimiento de datos': undefined }))), null);
});

test('las correcciones a mano pisan apellido y nombre y sacan la marca de revisar', () => {
  const dudoso = registro(cruda(1, '11111111', { 'apellido y nombre del deportista': 'De la Fuente Ana' }));
  assert.equal(dudoso.revisar, true);
  const [ok] = g.aplicarCorrecciones([dudoso], [['11.111.111', 'De la Fuente', 'Ana']]);
  assert.equal(ok.apellido, 'De la Fuente');
  assert.equal(ok.nombre, 'Ana');
  assert.equal(ok.revisar, false);
  assert.equal(dudoso.revisar, true, 'no muta el original');
});

test('appsscript.json: forms, sólo esta planilla y, para el envío a Semillero (tests/appsScriptEnvio.test.js), llamadas externas y disparador', () => {
  const m = JSON.parse(leer(new URL('appsscript.json', CARPETA)));
  assert.deepEqual([...m.oauthScopes].sort(), [
    'https://www.googleapis.com/auth/forms',
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/spreadsheets.currentonly'
  ]);
});

test('el código no modifica el formulario, no sale de la planilla y no registra datos personales', () => {
  // La llamada de red del envío a Semillero (semillero.gs) la cubre tests/appsScriptEnvio.test.js: acá, el resto no sale.
  const codigo = readdirSync(CARPETA).filter((f) => f.endsWith('.gs') && f !== 'semillero.gs')
    .map((f) => leer(new URL(f, CARPETA))).join('\n');
  for (const prohibido of ['DriveApp', 'MailApp', 'GmailApp', 'UrlFetchApp', 'openByUrl', 'SpreadsheetApp.openById', 'setTrashed', 'deleteAllResponses', 'deleteResponse', 'createResponse', 'setTitle', 'addTextItem']) {
    assert.ok(!codigo.includes(prohibido), `no debería usar ${prohibido}`);
  }
  const logs = codigo.match(/Logger\.log\([^;]*;/g) || [];
  for (const l of logs) assert.ok(!/(apellido|nombre|dni|telefono)\s*\+/i.test(l), `Logger con datos personales: ${l}`);
});
