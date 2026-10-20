import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const CARPETA = new URL('../google/apps-script-semillero/', import.meta.url);
const leer = (nombre) => readFileSync(new URL(nombre, CARPETA), 'utf8');

/** Un contexto con los tres .gs y un Apps Script de mentira que anota lo que se le pide. */
function entorno({ hojas, token = 'T'.repeat(43), respuesta = { codigo: 200, cuerpo: '{"guardadas": 1, "repetidas": 0}' } }) {
  const rangos = [];
  const pedidos = [];
  const registro = [];
  const hoja = (nombre) => {
    const h = hojas[nombre];
    if (!h) return null;
    return {
      getLastRow: () => h.valores.length,
      getSheetId: () => h.gid,
      getRange: (fila, col, filas, cols) => {
        rangos.push({ hoja: nombre, fila, col, filas, cols });
        const pedazo = h.valores.slice(fila - 1, fila - 1 + filas).map((f) => Array.from({ length: cols }, (_, k) => f[col - 1 + k] ?? ''));
        return { getValues: () => pedazo };
      },
    };
  };
  const g = vm.createContext({
    Logger: { log: (t) => registro.push(String(t)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => token }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: hoja, getUrl: () => 'https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345/edit?gid=0' }) },
    UrlFetchApp: {
      fetch: (url, opciones) => {
        pedidos.push({ url, opciones });
        return { getResponseCode: () => respuesta.codigo, getContentText: () => respuesta.cuerpo };
      },
    },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
  });
  for (const nombre of ['config.gs', 'estado.gs', 'semillero.gs']) vm.runInContext(leer(nombre), g);
  return { g, rangos, pedidos, registro };
}

const OK = '✅';
const NO = '❌';
const CLIP = '📎';

// Un Tablero de mentira con las columnas de TABLERO.md: A DNI … G-L documentos, M Completo, N Carpeta, O un documento de temporada.
const tablero = () => ({
  gid: 0,
  valores: [
    ['DNI', 'Apellido', 'Nombre', 'Categoría', 'Mail', 'Alta', 'DNI jugador - frente', 'DNI jugador - dorso', 'DNI adulto - frente', 'DNI adulto - dorso', 'Foto del jugador', 'Foto del adulto', 'Completo', 'Carpeta', 'Pase 2026'],
    ['40111222', 'PÉREZ', 'Juan', 'U13 - MIXTO (2014 y 2013)', 'mama@x.com', 'Nueva', OK, OK, OK, OK, OK, OK, OK, 'Abrir', OK],
    ['41222333', 'Gómez', 'Ana', 'U15 - MASCULINO (2012 y 2011)', 'papa@x.com', 'Nueva', OK, NO, NO, NO, NO, NO, NO, 'Abrir', NO],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ],
});
const pagos = () => ({
  gid: 777,
  valores: [
    ['DNI', 'Chico', 'Arancel octubre 2026', 'Rifa', '', ''],
    ['40111222', 'PÉREZ, Juan', OK, CLIP, '', ''],
    ['41222333', 'Gómez, Ana', NO, NO, '', ''],
    ['', '', '', '', '', ''],
  ],
});
const salida = () => ({
  gid: 5,
  valores: [
    ['Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Mail del responsable', 'Rama'],
    ['PÉREZ', 'Juan', new Date(2013, 4, 1), 'U13 - MIXTO (2014 y 2013)', 'mama@x.com', 'Masculino'],
    ['Gómez', 'Ana', '09/09/2012', 'U15 - MASCULINO (2012 y 2011)', 'papa@x.com', 'Masculino'],
    ['Chico', 'Sólo2026', new Date(2012, 0, 1), 'U15', '', ''],
  ],
});

test('appsscript.json pide sólo leer planillas, llamadas externas y disparador, y limita a qué URL llama', () => {
  const m = JSON.parse(leer('appsscript.json'));
  assert.deepEqual([...m.oauthScopes].sort(), [
    'https://www.googleapis.com/auth/script.external_request',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ]);
  assert.deepEqual(m.urlFetchWhitelist, ['https://lseqvbtdzebomxwtqhwu.supabase.co/rest/v1/rpc/empujar_estado_google']);
});

test('la URL del código está dentro de la lista blanca del manifiesto', () => {
  const { g } = entorno({ hojas: {} });
  const m = JSON.parse(leer('appsscript.json'));
  assert.ok(m.urlFetchWhitelist.some((u) => `${g.SEMILLERO_URL}/rest/v1/rpc/empujar_estado_google` === u));
});

test('el script sólo lee: no escribe hojas, no toca Drive, Forms ni mail, y nunca guarda el token', () => {
  const prohibidos = /setValue|setValues|clear\(|insertSheet|appendRow|deleteRow|deleteSheet|DriveApp|FormApp|MailApp|GmailApp|openByUrl|setProperty|setProperties/;
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))) {
    const sinComentarios = leer(nombre).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(sinComentarios, prohibidos, nombre);
  }
});

test('abre una sola planilla, la del Tablero, por su ID', () => {
  const usos = readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))
    .flatMap((n) => [...leer(n).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').matchAll(/(openById|getActiveSpreadsheet)\(([^)]*)\)/g)]);
  assert.deepEqual(usos.map((m) => m[0]), ['openById(TABLERO_ID)']);
});

test('todos los .gs compilan', () => {
  for (const nombre of readdirSync(CARPETA).filter((n) => n.endsWith('.gs'))) {
    assert.doesNotThrow(() => new vm.Script(leer(nombre), { filename: nombre }), nombre);
  }
});

test('el token no se escribe en ningún archivo y el intervalo es uno de los que admite Apps Script', () => {
  for (const nombre of readdirSync(CARPETA)) assert.doesNotMatch(leer(nombre), /SEMILLERO_TOKEN\s*=\s*['"]/, nombre);
  const { g } = entorno({ hojas: {} });
  assert.ok([1, 5, 10, 15, 30].includes(g.MINUTOS_ENTRE_ENVIOS));
});

test('arma una fila por chico con su número de fila, documentos, completo y pagos', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  assert.equal(e.pedidos.length, 1);
  const { p_token: token, p_envio: envio } = JSON.parse(e.pedidos[0].opciones.payload);
  assert.equal(token, 'T'.repeat(43));
  assert.equal(envio.tableroUrl, 'https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345');
  assert.equal(envio.gidTablero, 0);
  assert.equal(envio.gidPagos, 777);
  assert.deepEqual(envio.conceptosOrden, ['Arancel octubre 2026', 'Rifa']);
  assert.equal(envio.filas.length, 2);
  const [perez, gomez] = envio.filas;
  assert.equal(perez.fila, 2);
  assert.equal(perez.fechaNacimiento, '2013-05-01');
  assert.equal(perez.rama, 'Masculino');
  assert.equal(perez.completo, true);
  assert.deepEqual(perez.pagos, { 'Arancel octubre 2026': 'verificado', Rifa: 'subido' });
  assert.equal(perez.documentos['DNI jugador - frente'], true);
  assert.equal(gomez.fila, 3);
  assert.equal(gomez.fechaNacimiento, '2012-09-09');
  assert.equal(gomez.completo, false);
  assert.deepEqual(gomez.pagos, { 'Arancel octubre 2026': 'falta', Rifa: 'falta' });
});

test('un documento de temporada (a la derecha de Carpeta) viaja; Carpeta y Completo no son documentos', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  const { p_envio: envio } = JSON.parse(e.pedidos[0].opciones.payload);
  assert.deepEqual(envio.documentosOrden, ['DNI jugador - frente', 'DNI jugador - dorso', 'DNI adulto - frente', 'DNI adulto - dorso', 'Foto del jugador', 'Foto del adulto', 'Pase 2026']);
});

test('el DNI, el mail y los links del Tablero no salen en ningún lado del envío', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  const payload = e.pedidos[0].opciones.payload;
  for (const prohibido of ['40111222', '41222333', 'mama@x.com', 'papa@x.com', 'Abrir', 'drive.google.com']) {
    assert.ok(!payload.includes(prohibido), prohibido);
  }
  assert.doesNotMatch(payload.replace(/"tableroUrl":"[^"]*"/, ''), /[0-9]{7}/);
});

test('no lee la columna DNI ni la de links: el Tablero arranca en B y G, Pagos en C', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  for (const r of e.rangos.filter((x) => x.hoja === 'Tablero')) assert.ok(r.col >= 2, `Tablero col ${r.col}`);
  for (const r of e.rangos.filter((x) => x.hoja === 'Tablero' && x.col === 2)) assert.equal(r.cols, 3); // B a D, no llega a E (mail)
  for (const r of e.rangos.filter((x) => x.hoja === 'Pagos')) assert.ok(r.col >= 3, `Pagos col ${r.col}`);
});

test('la fecha y la rama se descartan si "Salida Semillero" no está alineada con el Tablero', () => {
  const s = salida();
  s.valores[1][0] = 'OTRO';
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': s } });
  e.g.enviarEstadoAhora();
  const { p_envio: envio } = JSON.parse(e.pedidos[0].opciones.payload);
  assert.equal(envio.filas[0].fechaNacimiento, null);
  assert.equal(envio.filas[0].rama, null);
  assert.equal(envio.filas[1].fechaNacimiento, '2012-09-09');
});

test('una fila con un DNI en el nombre no se manda, y se cuenta', () => {
  const t = tablero();
  t.valores[2][1] = 'Gómez 41222333';
  const e = entorno({ hojas: { Tablero: t, Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  const { p_envio: envio } = JSON.parse(e.pedidos[0].opciones.payload);
  assert.equal(envio.filas.length, 1);
  assert.match(e.registro.join('\n'), /parecer un DNI: 1/);
});

test('una columna de Pagos con texto libre no sale como concepto', () => {
  const p = pagos();
  p.valores[0][5] = 'Notas';
  p.valores[1][5] = 'llamó la madre';
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: p, 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  const { p_envio: envio } = JSON.parse(e.pedidos[0].opciones.payload);
  assert.deepEqual(envio.conceptosOrden, ['Arancel octubre 2026', 'Rifa']);
  assert.ok(!e.pedidos[0].opciones.payload.includes('llamó la madre'));
});

test('un Tablero con fórmulas rotas no se manda (no borra el estado de Semillero)', () => {
  const t = tablero();
  t.valores = [t.valores[0], ['#REF!', '#REF!', '#REF!', '', '', '', '', '', '', '', '', '', '', '', '']];
  const e = entorno({ hojas: { Tablero: t, Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  assert.equal(e.pedidos.length, 0);
  assert.match(e.registro.join('\n'), /no se manda nada/);
});

test('sin token no se manda nada y el registro lo dice', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() }, token: null });
  e.g.enviarEstadoAhora();
  assert.equal(e.pedidos.length, 0);
  assert.match(e.registro.join('\n'), /Falta el token/);
});

test('si falta una hoja se anota y no se manda nada', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos() } });
  e.g.enviarEstadoAhora();
  assert.equal(e.pedidos.length, 0);
  assert.match(e.registro.join('\n'), /Faltan hojas/);
});

test('el registro cuenta lo que pasó sin nombres, sin DNIs y sin el token', () => {
  const e = entorno({ hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() } });
  e.g.enviarEstadoAhora();
  const log = e.registro.join('\n');
  assert.match(log, /Enviado\. filas: 2/);
  for (const prohibido of ['PÉREZ', 'Gómez', '40111222', 'T'.repeat(43)]) assert.ok(!log.includes(prohibido), prohibido);
});

test('un rechazo de la base se anota con su código, sin datos, y el token inválido da la pista', () => {
  const e = entorno({
    hojas: { Tablero: tablero(), Pagos: pagos(), 'Salida Semillero': salida() },
    respuesta: { codigo: 403, cuerpo: '{"code":"28000","message":"TOKEN_INVALIDO"}' },
  });
  e.g.enviarEstadoAhora();
  const log = e.registro.join('\n');
  assert.match(log, /rechazó el envío \(403\): TOKEN_INVALIDO/);
  assert.match(log, /generá uno nuevo/);
  assert.ok(!log.includes('T'.repeat(43)));
});

test('estadoDePago y estadoDeDocumento: lo que no es ✅/📎/❌ es "no se sabe"', () => {
  const { g } = entorno({ hojas: {} });
  assert.equal(g.estadoDePago(OK), 'verificado');
  assert.equal(g.estadoDePago(CLIP), 'subido');
  assert.equal(g.estadoDePago(NO), 'falta');
  assert.equal(g.estadoDePago(''), null);
  assert.equal(g.estadoDePago('Abrir'), null);
  assert.equal(g.estadoDeDocumento(OK), true);
  assert.equal(g.estadoDeDocumento(NO), false);
  assert.equal(g.estadoDeDocumento(CLIP), null);
});

test('fechaIso entiende fechas de Sheets y dd/mm/aaaa, y no adivina el resto', () => {
  const { g } = entorno({ hojas: {} });
  assert.equal(g.fechaIso(new Date(2013, 4, 1)), '2013-05-01');
  assert.equal(g.fechaIso('5/3/2012'), '2012-03-05');
  assert.equal(g.fechaIso('31/02/2012'), null);
  assert.equal(g.fechaIso(''), null);
  assert.equal(g.fechaIso('mayo de 2012'), null);
});

test('instalarEnvio no duplica el disparador', () => {
  const e = entorno({ hojas: {} });
  e.g.instalarEnvio();
  assert.match(e.registro.join('\n'), /Disparador instalado/);
});
