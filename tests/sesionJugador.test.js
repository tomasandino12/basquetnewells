import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setRoles, obtenerRoles, setModo, obtenerModo, limpiarSesion, setFichaJugador, obtenerFichaJugador,
} from '../src/ui/sesion.js';
import { TABS, TABS_COORDINACION, TABS_JUGADOR, TABS_FAMILIA, tabsDelModo, pantallaInicialDelModo, pantallaDeInicio } from '../src/ui/chrome.js';

beforeEach(() => limpiarSesion());

test('un jugador entra en modo "jugar"', () => {
  setRoles({ esJugador: true });
  assert.equal(obtenerModo(), 'jugar');
  assert.deepEqual(obtenerRoles(), { esEntrenador: false, esCoordinador: false, esJugador: true, esFamilia: false });
});

test('a un jugador no se le puede cambiar de modo: ni coordinar ni entrenar', () => {
  setRoles({ esJugador: true });
  setModo('coordinar');
  assert.equal(obtenerModo(), 'jugar');
  setModo('entrenar');
  assert.equal(obtenerModo(), 'jugar');
});

test('quien es del cuerpo técnico no puede pasar a "jugar"', () => {
  setRoles({ esEntrenador: true, esCoordinador: true });
  setModo('jugar');
  assert.equal(obtenerModo(), 'entrenar');
  setRoles({ esCoordinador: true });
  setModo('jugar');
  assert.equal(obtenerModo(), 'coordinar');
});

test('los modos del cuerpo técnico no cambian con el rol nuevo', () => {
  setRoles({ esEntrenador: true });
  assert.equal(obtenerModo(), 'entrenar');
  setRoles({ esEntrenador: true, esCoordinador: true });
  assert.equal(obtenerModo(), 'entrenar');
  setModo('coordinar');
  assert.equal(obtenerModo(), 'coordinar');
  setRoles({ esCoordinador: true });
  assert.equal(obtenerModo(), 'coordinar');
  assert.equal(obtenerRoles().esJugador, false);
});

test('limpiarSesion olvida al jugador y su ficha', () => {
  setRoles({ esJugador: true });
  setFichaJugador({ jugadorId: 'j1' });
  assert.equal(obtenerFichaJugador().jugadorId, 'j1');
  limpiarSesion();
  assert.equal(obtenerFichaJugador(), null);
  assert.equal(obtenerRoles().esJugador, false);
  assert.equal(obtenerModo(), 'entrenar');
});

test('cada modo tiene sus pestañas, y el jugador tiene cuatro', () => {
  setRoles({ esJugador: true });
  assert.equal(tabsDelModo(), TABS_JUGADOR);
  assert.deepEqual(TABS_JUGADOR.map((t) => t.texto), ['Recursos', 'Físico', 'Mi progreso', 'Jugadas']);
  setRoles({ esEntrenador: true });
  assert.equal(tabsDelModo(), TABS);
  setRoles({ esCoordinador: true });
  assert.equal(tabsDelModo(), TABS_COORDINACION);
});

test('el jugador arranca y vuelve al inicio en su primera pestaña', () => {
  setRoles({ esJugador: true });
  assert.equal(pantallaInicialDelModo(), 'p-jug-recursos');
  assert.equal(pantallaDeInicio(), 'p-jug-recursos');
});

test('cada pestaña del jugador tiene su pantalla en index.html y su registro', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const registro = readFileSync('src/ui/pantallas/registro.js', 'utf8');
  for (const { id } of TABS_JUGADOR) {
    assert.ok(html.includes(`id="${id}"`), `falta <section id="${id}"> en index.html`);
    assert.ok(registro.includes(`'${id}'`), `${id} no está registrada en registro.js`);
  }
});

test('el arranque del cuerpo técnico no suma ninguna llamada: la ficha se pide sólo sin club', () => {
  const main = readFileSync('src/ui/main.js', 'utf8');
  const llamadas = [...main.matchAll(/await fichaDelJugador\(\)/g)];
  assert.equal(llamadas.length, 1, 'fichaDelJugador() se llama en un solo lugar');
  const sinClub = main.indexOf('if (!clubes.length || !(roles.esEntrenador || roles.esCoordinador)) {');
  const sigueConClub = main.indexOf('setClubActual(clubes[0])');
  assert.ok(sinClub >= 0 && sigueConClub > sinClub, 'no encontré la rama sin club');
  assert.ok(main.indexOf('await fichaDelJugador()') > sinClub && main.indexOf('await fichaDelJugador()') < sigueConClub,
    'la consulta de mi_ficha() tiene que estar adentro de la rama "sin club"');
});

test('sin ningún rol no queda coordinando: un profe dado de baja no es coordinador', () => {
  setRoles({ esEntrenador: false, esCoordinador: false });
  assert.notEqual(obtenerModo(), 'coordinar');
});

test('una fila de miembro_club sin roles entra por la rama sin club, no como cuerpo técnico', () => {
  const main = readFileSync('src/ui/main.js', 'utf8');
  const sinRoles = main.indexOf('if (!clubes.length || !(roles.esEntrenador || roles.esCoordinador)) {');
  assert.ok(sinRoles >= 0, 'la rama sin club tiene que cubrir también a quien no tiene ningún rol');
  assert.ok(main.indexOf('obtenerMisRoles(') < sinRoles, 'los roles se piden antes de decidir la rama');
});

/* ---------- familia (0057) ---------- */

test('una familia entra en modo "familia", con una sola pestaña, y no cambia de modo', () => {
  setRoles({ esFamilia: true });
  assert.equal(obtenerModo(), 'familia');
  assert.equal(tabsDelModo(), TABS_FAMILIA);
  assert.deepEqual(TABS_FAMILIA.map((t) => t.texto), ['Mis chicos']);
  assert.equal(pantallaInicialDelModo(), 'p-fam-chicos');
  assert.equal(pantallaDeInicio(), 'p-fam-chicos');
  for (const otro of ['coordinar', 'entrenar', 'jugar']) {
    setModo(otro);
    assert.equal(obtenerModo(), 'familia', otro);
  }
});

test('el cuerpo técnico y el jugador no pueden pasar a "familia"', () => {
  setRoles({ esEntrenador: true });
  setModo('familia');
  assert.equal(obtenerModo(), 'entrenar');
  setRoles({ esJugador: true });
  setModo('familia');
  assert.equal(obtenerModo(), 'jugar');
});

test('la pestaña de la familia tiene su pantalla en index.html y su registro', () => {
  const html = readFileSync('public/index.html', 'utf8');
  const registro = readFileSync('src/ui/pantallas/registro.js', 'utf8');
  for (const { id } of TABS_FAMILIA) {
    assert.ok(html.includes(`id="${id}"`), `falta <section id="${id}"> en index.html`);
    assert.ok(registro.includes(`'${id}'`), `${id} no está registrada en registro.js`);
  }
});

test('el arranque del cuerpo técnico no suma llamadas: la familia se consulta sólo en la rama sin club', () => {
  const main = readFileSync('src/ui/main.js', 'utf8');
  const llamadas = [...main.matchAll(/await chicosDeLaFamilia()/g)];
  assert.equal(llamadas.length, 1, 'chicosDeLaFamilia() se llama en un solo lugar');
  const sinClub = main.indexOf('if (!clubes.length || !(roles.esEntrenador || roles.esCoordinador)) {');
  const sigueConClub = main.indexOf('setClubActual(clubes[0])');
  const donde = main.indexOf('await chicosDeLaFamilia()');
  assert.ok(donde > sinClub && donde < sigueConClub, 'tiene que estar adentro de la rama "sin club"');
  assert.ok(donde > main.indexOf('await fichaDelJugador()'), 'después de preguntar por la ficha del jugador');
});
