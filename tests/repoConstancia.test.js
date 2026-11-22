// Los repos de constancia (0068) devuelven objetos de dominio y conservan los null.
// No hay red: se le pone un `rpc` falso al cliente compartido (que se crea sin conectar).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_PUBLISHABLE_KEY = 'clave-de-prueba';

const { obtenerCliente } = await import('../src/data/cliente.js');
const { misPracticas, marcarPractica, miAsistencia } = await import('../src/data/repos/miCuenta.js');
const { practicasDelPlantel } = await import('../src/data/repos/recursos.js');

const cliente = obtenerCliente();
let llamadas;

function responder(data, error = null) {
  cliente.rpc = async (nombre, args) => {
    llamadas.push({ nombre, args });
    return { data, error };
  };
}

beforeEach(() => {
  llamadas = [];
});

test('misPracticas mapea fecha y recursoId, y conserva el recurso borrado como null', async () => {
  responder([
    { fecha: '2026-11-22', recursoId: 'r-1' },
    { fecha: '2026-11-21', recursoId: null },
  ]);
  assert.deepEqual(await misPracticas(), [
    { fecha: '2026-11-22', recursoId: 'r-1' },
    { fecha: '2026-11-21', recursoId: null },
  ]);
  assert.equal(llamadas[0].nombre, 'mis_practicas');
});

test('misPracticas: quien no es jugador recibe null, no una lista vacía', async () => {
  responder(null);
  assert.equal(await misPracticas(), null);
});

test('marcarPractica manda el recurso y el hecho (nunca una fecha) y devuelve las marcas', async () => {
  responder([{ fecha: '2026-11-22', recursoId: 'r-1' }]);
  assert.deepEqual(await marcarPractica('r-1', true), [{ fecha: '2026-11-22', recursoId: 'r-1' }]);
  assert.deepEqual(llamadas[0], { nombre: 'marcar_practica', args: { p_recurso_id: 'r-1', p_hecho: true } });
});

test('marcarPractica: desmarcar manda p_hecho false', async () => {
  responder([]);
  assert.deepEqual(await marcarPractica('r-1', false), []);
  assert.equal(llamadas[0].args.p_hecho, false);
});

test('un error de la base se lanza, para que la pantalla lo cuente con sus helpers', async () => {
  const falla = new Error('sin conexión');
  responder(null, falla);
  await assert.rejects(misPracticas(), falla);
  await assert.rejects(marcarPractica('r-1', true), falla);
  await assert.rejects(miAsistencia(), falla);
  await assert.rejects(practicasDelPlantel('p-1'), falla);
});

test('miAsistencia mapea fecha y vino, y un día sin tomar sigue siendo null (no false)', async () => {
  responder([
    { fecha: '2026-11-18', vino: true },
    { fecha: '2026-11-19', vino: false },
    { fecha: '2026-11-20', vino: null },
  ]);
  assert.deepEqual(await miAsistencia(), [
    { fecha: '2026-11-18', vino: true },
    { fecha: '2026-11-19', vino: false },
    { fecha: '2026-11-20', vino: null },
  ]);
  assert.equal(llamadas[0].nombre, 'mi_asistencia');
});

test('miAsistencia: quien no es jugador recibe null', async () => {
  responder(null);
  assert.equal(await miAsistencia(), null);
});

test('practicasDelPlantel mapea los conteos de cada recurso', async () => {
  responder({
    conCuenta: 5,
    marcaronEstaSemana: 3,
    recursos: [{ recursoId: 'r-1', estaSemana: 2, algunaVez: 4 }],
  });
  assert.deepEqual(await practicasDelPlantel('p-1'), {
    conCuenta: 5,
    marcaronEstaSemana: 3,
    recursos: [{ recursoId: 'r-1', estaSemana: 2, algunaVez: 4 }],
  });
  assert.deepEqual(llamadas[0], { nombre: 'practicas_del_plantel', args: { p_plantel_id: 'p-1' } });
});

test('practicasDelPlantel con null conserva el null (menos de 3 cuentas no es 0)', async () => {
  responder({
    conCuenta: 2,
    marcaronEstaSemana: null,
    recursos: [{ recursoId: 'r-1', estaSemana: null, algunaVez: null }],
  });
  const r = await practicasDelPlantel('p-1');
  assert.equal(r.conCuenta, 2);
  assert.equal(r.marcaronEstaSemana, null);
  assert.equal(r.recursos[0].estaSemana, null);
  assert.equal(r.recursos[0].algunaVez, null);
});

test('practicasDelPlantel: quien no es entrenador del plantel recibe null', async () => {
  responder(null);
  assert.equal(await practicasDelPlantel('p-1'), null);
});

test('practicasDelPlantel no expone ningún id de jugador', async () => {
  responder({
    conCuenta: 4,
    marcaronEstaSemana: 1,
    jugadorId: 'j-1',
    recursos: [{ recursoId: 'r-1', estaSemana: 1, algunaVez: 1, jugadorId: 'j-1' }],
  });
  const r = await practicasDelPlantel('p-1');
  assert.ok(!JSON.stringify(r).includes('j-1'));
});
