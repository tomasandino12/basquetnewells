import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Coordinación → Formularios (spec portal v2 §3): la coordinación suma, edita,
 * ordena y oculta los formularios que el portal público le muestra a las
 * familias. Es una pantalla secundaria, como Rubros: se llega desde la pestaña
 * Familias y no suma pestaña a la barra. Como no hay navegador en los tests,
 * se atan por el texto las promesas que se rompen sin avisar.
 */

const fuente = (ruta) => readFileSync(ruta, 'utf8');
const pantalla = fuente('src/ui/pantallas/coordFormularios.js');

test('es una pantalla secundaria: tiene su sección, está registrada y no suma pestaña', async () => {
  assert.match(fuente('public/index.html'), /<section class="pant" id="p-coord-formularios"><div id="coord-formularios-contenido"><\/div><\/section>/);
  assert.match(fuente('src/ui/pantallas/registro.js'), /registrarPantalla\('p-coord-formularios', \{ titulo: 'Formularios', render: renderFormularios \}\)/);
  const { TABS_COORDINACION } = await import('../src/ui/chrome.js');
  assert.ok(!TABS_COORDINACION.some((t) => t.id === 'p-coord-formularios'));
});

test('se llega desde Familias, también cuando todavía no hay vínculos', () => {
  const familias = fuente('src/ui/pantallas/coordFamilias.js');
  assert.equal((familias.match(/id="fam-ir-formularios"/g) ?? []).length, 1, 'un solo fragmento del botón');
  assert.equal((familias.match(/\$\{accesoFormularios\}/g) ?? []).length, 2, 'el botón tiene que estar en la lista y en el estado vacío');
  assert.equal((familias.match(/cablearFormularios\(\);/g) ?? []).length, 2, 'y cablearse en los dos');
  assert.match(familias, /ir\('p-coord-formularios', \{ push: true \}\)/);
});

test('avisa que lo que se escribe lo ve cualquiera y que no van nombres de chicos', () => {
  assert.match(pantalla, /lo ve cualquiera/i);
  assert.match(pantalla, /nombres de chicos/i);
});

test('los campos usan los límites de la base y el título y el texto son obligatorios', () => {
  assert.match(pantalla, /maxlength="\$\{LIMITE\.titulo\}"/);
  assert.match(pantalla, /maxlength="\$\{LIMITE\.textoFormulario\}"/);
  assert.match(pantalla, /maxlength="\$\{LIMITE\.enlace\}"/);
  assert.match(pantalla, /validarFormulario\(/);
});

test('ordena con moverFormulario y guarda sólo lo que cambió', () => {
  assert.match(pantalla, /moverFormulario\(/);
  assert.match(pantalla, /reordenarFormularios\(cambios\)/);
  assert.match(pantalla, /flechaArriba/);
  assert.match(pantalla, /flechaAbajo/);
});

test('nadie borra: se oculta con activo, y no hay llamada a un borrado', () => {
  assert.match(pantalla, /actualizarFormulario\(/);
  assert.match(pantalla, /Ocultar/);
  assert.doesNotMatch(pantalla, /borrar|quitar|eliminar|\.delete\(/i);
});

test('con la lista vacía ofrece cargar el de Inscripción de portal.js, sin guardarlo solo', () => {
  assert.match(pantalla, /PORTAL\.formularios/);
  assert.match(pantalla, /Agregar el de Inscripción/);
});

test('el error de guardado se muestra en la hoja y sin conexión usa el texto compartido', () => {
  assert.match(pantalla, /mensajeAlGuardar\(/);
  assert.match(pantalla, /mostrarAviso\(/);
  assert.doesNotMatch(pantalla, /Sin conexi[oó]n/i);
});

test('lo que se muestra va escapado: html`` y sin escaparHtml a mano ni innerHTML con texto crudo', () => {
  assert.match(pantalla, /from '\.\.\/html\.js'/);
  assert.doesNotMatch(pantalla, /escaparHtml/);
});

test('los íconos nuevos son SVG de 24x24', async () => {
  const { ICONO } = await import('../src/ui/componentes/iconos.js');
  for (const n of ['flechaArriba', 'flechaAbajo']) {
    assert.ok(ICONO[n].startsWith('<svg ') && ICONO[n].includes('viewBox="0 0 24 24"') && ICONO[n].endsWith('</svg>'), n);
  }
});
