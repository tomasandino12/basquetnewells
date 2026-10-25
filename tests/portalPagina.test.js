import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  htmlFormularios, htmlAvisoRespaldo, htmlLogos, htmlAcciones, htmlDock, htmlPago, htmlCinta, htmlCarrusel, htmlAlias, htmlBuscador, htmlCategoriaDelAnio, htmlProximo,
  htmlRecaudacion, htmlColaborar, htmlFirma, htmlAyuda, htmlAtajos, htmlCalendario, htmlFoto, htmlSede, diaInicial, htmlSuscripcion,
} from '../src/ui/portal.js';
import { eventoDesdeGoogle, eventosPorDia, proximosEventos } from '../src/data/agenda.js';
import { PORTAL } from '../src/data/portal.js';

/**
 * portal.html es HTML escrito a mano y no hay navegador en los tests: se lee
 * como texto, como en landing.test.js. Se atan las promesas del diseño "D"
 * (plan 2026-10-20-portal-rediseno) que se rompen sin que nada avise.
 */
const pagina = readFileSync('public/portal.html', 'utf8');
const portal = readFileSync('src/ui/portal.js', 'utf8');
const seccion = (id) => pagina.match(new RegExp(`<section [^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';

test('arriba de todo, la banda con las dos acciones; después el resto, en orden', () => {
  const orden = ['heroe', 'lo-que-viene', 'categorias', 'calendario', 'recaudacion', 'colaborar', 'sede', 'formularios', 'club', 'sponsors'];
  const posiciones = orden.map((id) => pagina.search(new RegExp(`<section [^>]*id="${id}"`)));
  assert.ok(posiciones.every((p) => p > 0), `faltan secciones: ${posiciones}`);
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones, 'las secciones están desordenadas');
  assert.match(seccion('heroe'), /<h1[ >]/, 'el h1 de la página está en el hero');
});

test('las secciones que dependen de datos arrancan ocultas; la banda, recaudación y colaborar se ven siempre', () => {
  for (const id of ['lo-que-viene', 'calendario', 'categorias', 'sede', 'formularios', 'club', 'sponsors']) {
    assert.match(seccion(id).split('>')[0], /\bhidden\b/, `#${id} tiene que arrancar oculta`);
  }
  for (const id of ['heroe', 'recaudacion', 'colaborar']) {
    assert.doesNotMatch(seccion(id).split('>')[0], /\bhidden\b/, `#${id} se ve siempre`);
  }
});

test('ni la página ni su código dicen "Próximamente"', () => {
  assert.doesNotMatch(pagina, /Próximamente/i);
  assert.doesNotMatch(portal, /Próximamente/i);
});

test('el encabezado sólo lleva a Semillero (con cómo instalarla); la Ayuda se abre desde los atajos', () => {
  const barra = pagina.match(/<header class="portal-barra">[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(barra, /#ayuda/, 'la Ayuda ya no está en el encabezado');
  const sem = barra.match(/<details class="portal-sem" id="semillero">[\s\S]*?<\/details>/)[0];
  assert.match(sem, /<summary[^>]*>[\s\S]*Semillero<\/summary>/);
  assert.match(sem, /<a class="btn" href="\/app">Entrar a Semillero<\/a>/);
  assert.match(sem, /Instalar app/);
  assert.match(sem, /Agregar a inicio/);
  assert.match(portal, /\{ clave: 'ayuda', texto: 'Ayuda', href: '#ayuda' \}/, 'sigue habiendo un atajo a la Ayuda');
});

test('el acceso a Semillero es un botón visible: con borde, ícono y el nombre, no un link subrayado; el panel no cambia', () => {
  const sem = pagina.match(/<details class="portal-sem" id="semillero">[\s\S]*?<\/details>/)[0];
  const resumen = sem.match(/<summary class="portal-barra-btn portal-sem-btn">([\s\S]*?)<\/summary>/)?.[1] ?? '';
  assert.match(resumen, /^<svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*<\/svg>Semillero$/);
  assert.doesNotMatch(sem, /Soy profe o jugador/);
  const css = readFileSync('public/css/publico.css', 'utf8');
  const boton = css.match(/\.portal-sem-btn\{[^}]*\}/)[0];
  assert.match(boton, /border:1px solid var\(--gris-osc\)/);
  assert.doesNotMatch(boton, /underline/);
  assert.match(css, /\.portal-barra-btn\{[^}]*min-height:var\(--tap\)/);
  // El panel de siempre: Entrar y cómo instalarla.
  assert.match(sem, /<a class="btn" href="\/app">Entrar a Semillero<\/a>/);
  assert.match(sem, /Instalar app[\s\S]*Agregar a inicio/);
});

test('Ayuda no ocupa lugar en la página: es una hoja (<dialog>) con la X, que abre todo link a #ayuda', () => {
  assert.doesNotMatch(pagina, /<section [^>]*id="ayuda"/);
  const hoja = pagina.match(/<dialog class="portal-hoja" id="ayuda" aria-labelledby="t-ayuda">[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(hoja, 'falta la hoja de Ayuda');
  assert.match(hoja, /<h2 id="t-ayuda">Preguntas frecuentes<\/h2>/);
  assert.match(hoja, /<button type="button" class="portal-hoja-x" data-cerrar-ayuda aria-label="Cerrar la ayuda">/);
  assert.match(hoja, /id="portal-ayuda-lista"/);
  const desde = portal.indexOf('function iniciarAyuda()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n}\n', desde));
  assert.match(cuerpo, /closest\('a\[href="#ayuda"\]'\)/);
  assert.match(cuerpo, /hoja\.showModal\(\)/, 'showModal: foco atrapado y Escape');
  assert.match(cuerpo, /ev\.target === hoja/, 'tocar afuera la cierra');
  assert.match(cuerpo, /\[data-cerrar-ayuda\]/);
  assert.match(portal, /iniciarAyuda\(\);/);
});

test('el coordinador aparece una sola vez: al final de las preguntas frecuentes', () => {
  assert.doesNotMatch(pagina.replace(/<!--[\s\S]*?-->/g, ''), /wa\.me|coordinador/i, 'el HTML no lo nombra: sale de htmlAyuda');
  assert.equal((portal.match(/enlaceContacto\(/g) ?? []).length, 1, 'sólo htmlAyuda arma el enlace al coordinador');
  const desde = portal.indexOf('export function htmlAyuda(');
  assert.ok(portal.indexOf('enlaceContacto(') > desde, 'y es el de htmlAyuda');
});

const importMapDe = (html) => html.replace(/\r\n/g, '\n').match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];

test('portal.html no tiene más script inline que el import map ni enlaza el manifest', () => {
  const inline = [...pagina.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((m) => !/type="importmap"/.test(m[1]));
  assert.deepEqual(inline.map((m) => m[0]), []);
  assert.doesNotMatch(pagina, /rel="manifest"/);
  assert.doesNotMatch(pagina, /serviceWorker/);
  assert.doesNotMatch(pagina, /<iframe/);
});

test('el import map del portal es idéntico, letra por letra, al de la app: el mismo hash de la CSP', () => {
  const app = readFileSync('public/index.html', 'utf8');
  assert.ok(importMapDe(pagina), 'el portal no tiene import map');
  assert.equal(importMapDe(pagina), importMapDe(app));
  assert.match(pagina, /<script src="\/public\/config\.js"><\/script>/);
  assert.ok(pagina.indexOf('importmap') < pagina.indexOf('type="module"'), 'el import map tiene que ir antes de los módulos');
});

test('el portal es mobile', () => {
  assert.match(pagina, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
});

test('portal.js sólo pide datos por el repositorio: ni repos/, ni cliente, ni Supabase, ni fetch', () => {
  for (const archivo of ['src/ui/portal.js', 'src/ui/portalArranque.js', 'src/ui/portalEntrada.js']) {
    const codigo = readFileSync(archivo, 'utf8');
    const imports = [...codigo.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(imports.filter((i) => /repos\/|cliente|supabase/.test(i)), [], archivo);
    assert.doesNotMatch(codigo, /\bfetch\s*\(/, archivo);
  }
  assert.match(portal, /from '\.\.\/data\/repositorio\.js'/);
  assert.doesNotMatch(readFileSync('src/ui/portalEntrada.js', 'utf8'), /repositorio/);
});

test('el portal no consulta nada si la URL es la vuelta de un login: esos links van a /app', () => {
  // El cliente de Supabase canjearía el ?code= o el #access_token en esta página.
  assert.match(portal, /destinoDeAuth\(window\.location\.search, window\.location\.hash\)/);
  const guarda = portal.indexOf('destinoDeAuth(');
  assert.ok(guarda > 0 && guarda < portal.indexOf('resolverFormularios('), 'la guarda tiene que ir antes de leer la base');
  assert.ok(guarda < portal.lastIndexOf('iniciarCalendario(calendarios, pintarAtajos)'), 'y antes de pedir el calendario');
});

// ---- El hero: foto, título y los dos botones ----

const FORM = (texto, enlace = 'https://forms.gle/Abc1') => ({ titulo: 'x', texto, enlace });
const MALO = FORM('x', 'https://evil.com/forms/x');
const acciones = (out) => out.match(/class="portal-accion [^"]*"/g) ?? [];

test('el hero está escrito a mano en el HTML: foto en <picture>, título en tres líneas, sin esperar a la base', () => {
  const heroe = seccion('heroe');
  assert.match(heroe, /<picture class="portal-heroe-foto">[\s\S]*<source media="\(max-width:47\.99rem\)" srcset="\/public\/img\/fotos\/formativas-bandeja-vertical\.webp" width="576" height="720">/);
  const img = heroe.match(/<img [^>]*formativas-bandeja\.webp[^>]*>/)?.[0] ?? '';
  assert.match(img, /fetchpriority="high"/, 'la foto del hero es el LCP');
  assert.match(img, /width="1080" height="720"/);
  assert.match(img, /alt="[^"]{20,}"/, 'con un texto alternativo que cuenta qué se ve');
  assert.doesNotMatch(img, /loading="lazy"/);
  const lineas = [...heroe.matchAll(/<span class="linea[^"]*"><span[^>]*>([^<]+)<\/span><\/span>/g)].map((m) => m[1]);
  assert.deepEqual(lineas, ['Acá se', 'forma', 'la Lepra']);
  assert.match(heroe, /class="linea rojo"><span[^>]*>la Lepra/, 'la última línea va en rojo');
  assert.match(heroe, /id="portal-heroe"/, 'acá se pintan los dos botones');
  assert.match(pagina, /<dialog class="portal-hoja" id="pago" aria-labelledby="t-pago">/);
});

test('inscripción abierta: "Inscribirme" como botón principal, y "Pagar", que no es un enlace', () => {
  const out = htmlAcciones({ inscripcion: FORM('x'), consultas: FORM('y', 'https://forms.gle/Jug1'), temporada: 2027 }).toString();
  assert.match(out, /<a class="portal-accion principal" href="https:\/\/forms\.gle\/Abc1" target="_blank" rel="noopener">[\s\S]*Inscribirme[\s\S]*Inscripción 2027 abierta/);
  assert.doesNotMatch(out, /Jug1/, 'con la inscripción abierta, "Quiero que juegue" no va');
  assert.equal(acciones(out).length, 2, 'dos botones, ni uno más');
  assert.match(out, /<button type="button" class="portal-accion pago" data-abrir-pago[^>]*>[\s\S]*<b>Pagar<\/b><small>Alias y comprobante<\/small>/);
});

test('inscripción cerrada: el principal es "Quiero que juegue" y lleva al formulario para probarse', () => {
  for (const inscripcion of [null, MALO]) {
    const out = htmlAcciones({ inscripcion, consultas: FORM('Para chicos <x>', 'https://forms.gle/Jug1') }).toString();
    assert.match(out, /<a class="portal-accion principal" href="https:\/\/forms\.gle\/Jug1"[\s\S]*Quiero que juegue/);
    assert.match(out, /Dejá tus datos y te avisamos/);
    assert.doesNotMatch(out, /Para chicos/, 'la línea del panel no va en el botón');
  }
});

test('sin formularios: el principal se ve macizo con "Pronto"; "Pagar" nunca se apaga', () => {
  const out = htmlAcciones({ consultas: MALO }).toString();
  assert.match(out, /<div class="portal-accion principal apagada" aria-disabled="true">[\s\S]*Se habilita cuando abra el formulario[\s\S]*<em>Pronto<\/em>/);
  assert.doesNotMatch(out, /<a |evil/);
  assert.match(out, /<button type="button" class="portal-accion pago" data-abrir-pago/);
  assert.doesNotMatch(out, /pago apagada|pago[^>]*disabled/);
});

test('mientras la base no responde: el principal está ocupado, no dice "Pronto"; "Pagar" ya funciona', () => {
  const out = htmlAcciones({ cargando: true }).toString();
  assert.match(out, /<div class="portal-accion principal apagada" aria-disabled="true" aria-busy="true">/);
  assert.doesNotMatch(out, /Pronto/);
  assert.match(out, /data-abrir-pago/);
  assert.match(portal, /pintarFormularios\(\{\}, true\)/, 'se pinta cargando antes de pedir la lista');
});

test('la barra fija repite el principal del hero (mismo texto y destino) y "Pagar"; sin formulario, sólo "Pagar"', () => {
  const abierta = htmlDock({ inscripcion: FORM('x'), consultas: FORM('y', 'https://forms.gle/Jug1') }).toString();
  assert.match(abierta, /<a class="portal-dock-btn principal" href="https:\/\/forms\.gle\/Abc1" target="_blank" rel="noopener"><svg[\s\S]*?<\/svg>Inscribirme<\/a>/);
  assert.doesNotMatch(abierta, /Jug1/);
  const cerrada = htmlDock({ inscripcion: MALO, consultas: FORM('y', 'https://forms.gle/Jug1') }).toString();
  assert.match(cerrada, /href="https:\/\/forms\.gle\/Jug1"[^>]*><svg[\s\S]*?<\/svg>Quiero que juegue<\/a>/);
  for (const sin of [htmlDock({}), htmlDock({ consultas: MALO })]) {
    assert.doesNotMatch(sin.toString(), /<a |evil/);
    assert.match(sin.toString(), /<button type="button" class="portal-dock-btn pago" data-abrir-pago/);
  }
  assert.match(pagina, /<div class="portal-dock" id="portal-dock" role="region" aria-label="[^"]+" inert>/, 'oculta es inert: el teclado no llega');
  assert.match(portal, /htmlDock\(\{ inscripcion, consultas \}\)/);
});

test('el dock lleva íconos: cada botón con su svg decorativo y el texto a la vista', () => {
  const out = htmlDock({ inscripcion: FORM('x') }).toString();
  const botones = out.match(/<(?:a|button)\b[^>]*class="portal-dock-btn[^>]*>[\s\S]*?<\/(?:a|button)>/g);
  assert.equal(botones.length, 2);
  for (const b of botones) {
    assert.match(b, /^<(?:a|button)[^>]*><svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg>[A-Za-zÁ-ú ]+<\/(?:a|button)>$/, b);
  }
  // Y el área táctil sigue siendo de 48 px.
  assert.match(readFileSync('public/css/publico.css', 'utf8'), /\.portal-dock-btn\{[^}]*min-height:3rem/);
});

test('agendar lleva íconos: Google (calendario) e iPhone (celular), en cada evento y en "Lo que viene", con área de toque de 44 px', () => {
  const [prox] = proximosEventos(porDia, '2026-10-24', 1);
  const arreglos = [htmlProximo(prox, '2026-10-24'), htmlCalendario(estado(), CALS)].map(String);
  for (const out of arreglos) {
    assert.match(out, /rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg>Google<\/a>/);
    assert.match(out, /<button type="button" data-ics="[^"]+"><svg viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg>iPhone<\/button>/);
  }
  const css = readFileSync('public/css/publico.css', 'utf8');
  assert.match(css, /\.portal-ev-agregar a,\.portal-ev-agregar button\{[^}]*min-height:var\(--tap\)/);
});

test('la hoja de pago: el alias y el comprobante; sin formulario lo dice y deja el alias; escapado', () => {
  const con = htmlPago({ alias: { alias: 'NOB.BASQUET', titular: 'Club <x>' }, comprobante: FORM('z', 'https://forms.gle/Com1') }).toString();
  assert.match(con, /<b>NOB\.BASQUET<\/b>/);
  assert.match(con, /data-copiar="NOB\.BASQUET"/);
  assert.match(con, /Club &lt;x&gt;/);
  assert.match(con, /<a class="btn" href="https:\/\/forms\.gle\/Com1" target="_blank" rel="noopener">Enviar comprobante/);
  assert.doesNotMatch(con, /cuota/i, 'se paga más que cuotas');
  for (const comprobante of [null, MALO]) {
    const sin = htmlPago({ alias: { alias: 'NOB.BASQUET' }, comprobante }).toString();
    assert.match(sin, /Por ahora no hay nada para pagar\./);
    assert.match(sin, /data-copiar="NOB\.BASQUET"/, 'el alias se ve igual');
    assert.doesNotMatch(sin, /<a |evil/);
  }
  assert.doesNotMatch(htmlPago({ alias: { alias: 'mal alias' }, comprobante: null }).toString(), /data-copiar/);
});

test('"Pagar" abre su hoja con showModal y se cierra con la X o tocando afuera', () => {
  const desde = portal.indexOf('function iniciarPago()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n}\n', desde));
  assert.match(cuerpo, /closest\('\[data-abrir-pago\]'\)/);
  assert.match(cuerpo, /hoja\.showModal\(\)/);
  assert.match(cuerpo, /ev\.target === hoja/);
  assert.match(cuerpo, /\[data-cerrar-pago\]/);
  assert.match(portal, /iniciarPago\(\);/);
});

test('alias: escapado y con botón para copiarlo; uno inválido no se muestra', () => {
  const out = htmlAlias({ alias: 'NOB.BASQUET', titular: 'Club <x>' }).toString();
  assert.match(out, /<b>NOB\.BASQUET<\/b>/);
  assert.match(out, /data-copiar="NOB\.BASQUET"/);
  assert.equal(htmlAlias({ alias: 'mal alias' }).toString(), '');
});

test('atajos: con menos de dos no hay fila; el de ayuda abre afuera', () => {
  assert.equal(htmlAtajos([{ clave: 'jugar', texto: 'Quiero jugar', href: '#jugar' }]).toString(), '');
  const out = htmlAtajos([
    { clave: 'jugar', texto: 'Quiero jugar', href: '#jugar' },
    { clave: 'ayuda', texto: 'Ayuda', href: 'https://wa.me/5493410000000', externo: true },
  ]).toString();
  assert.match(out, /<a href="#jugar"><i><svg/);
  assert.match(out, /<a href="https:\/\/wa\.me\/5493410000000" target="_blank" rel="noopener">/);
});

// ---- Calendario propio ----

const CALS = [{ tipo: 'partido', titulo: 'Partidos', id: 'p@x.y' }, { tipo: 'evento', titulo: 'Eventos', id: 'e@x.y' }];
const ev = (id, tipo, extra) => eventoDesdeGoogle({ id, ...extra }, tipo);
const porDia = eventosPorDia([
  ev('1', 'partido', { summary: 'U15 vs. <Náutico>', location: 'Microestadio', start: { dateTime: '2026-10-24T10:30:00-03:00' } }),
  ev('2', 'evento', { summary: 'Hamburgueseada', start: { date: '2026-10-24' } }),
  ev('3', 'partido', { summary: 'U17 visitante', start: { dateTime: '2026-10-31T16:00:00-03:00' } }),
]);
const estado = (extra) => ({ anio: 2026, mes: 10, elegido: '2026-10-24', hoy: '2026-10-20', porDia, fallidos: 0, cargando: false, ...extra });

test('calendario: grilla del mes con un puntito por evento y el día elegido marcado', () => {
  const out = htmlCalendario(estado(), CALS).toString();
  assert.match(out, /Octubre 2026/);
  assert.equal((out.match(/data-dia="/g) ?? []).length, 35);
  const dia24 = out.match(/<button [^>]*data-dia="2026-10-24"[\s\S]*?<\/button>/)[0];
  assert.match(dia24, /aria-pressed="true"/);
  assert.match(dia24, /aria-label="Sábado 24 de octubre, 2 eventos"/);
  assert.equal((dia24.match(/<i class="tipo-/g) ?? []).length, 2);
  assert.match(out, /class="portal-dia hoy" data-dia="2026-10-20"/);
  assert.match(out, /<li class="tipo-partido">Partidos<\/li><li class="tipo-evento">Eventos<\/li>/);
});

test('calendario: lo del día elegido, escapado, los de todo el día primero', () => {
  const out = htmlCalendario(estado(), CALS).toString();
  const dia = out.slice(out.indexOf('portal-cal-dia'));
  assert.ok(dia.indexOf('Hamburgueseada') < dia.indexOf('U15'), 'todo el día va primero');
  assert.match(dia, /Partidos · 10:30/);
  assert.match(dia, /Eventos · Todo el día/);
  assert.match(dia, /U15 vs\. &lt;Náutico&gt;/);
  assert.doesNotMatch(out, /<Náutico>/);
});

test('calendario: un día sin nada muestra lo que viene; si falló un calendario, lo avisa', () => {
  const out = htmlCalendario(estado({ elegido: '2026-10-21', fallidos: 1 }), CALS).toString();
  assert.match(out, /No hay nada cargado para este día/);
  assert.match(out, /Lo que viene/);
  assert.match(out, /U17 visitante/);
  assert.match(out, /No pudimos traer una parte del calendario/);
});

test('"Lo que viene": fecha grande, tipo, título escapado, hora y lugar, y para agendarlo', () => {
  const [prox] = proximosEventos(porDia, '2026-10-23', 1);
  const out = htmlProximo(prox, '2026-10-23').toString();
  assert.match(out, /<article class="portal-prox tipo-evento">/, 'el de todo el día va primero');
  assert.match(out, /<small>sáb<\/small><b>24<\/b><small>oct<\/small>/);
  assert.match(out, /<b>Mañana<\/b>/);
  assert.match(out, /Hamburgueseada/);
  assert.match(out, /Todo el día/);
  assert.match(out, /data-ics="2\|2026-10-24"/);
  const partido = htmlProximo(proximosEventos(porDia, '2026-10-25', 1)[0], '2026-10-25').toString();
  assert.match(partido, /<span class="portal-prox-tipo">Partido<\/span>/);
  assert.match(partido, /16:00 a /);
  assert.doesNotMatch(partido, /Mañana|Hoy/);
  assert.match(htmlProximo({ fecha: '2026-10-24', evento: porDia.get('2026-10-24')[1] }, '2026-10-24').toString(), /U15 vs\. &lt;Náutico&gt;[\s\S]*Microestadio/);
  assert.equal(htmlProximo(undefined, '2026-10-20').toString(), '');
});

test('lo que viene sin eventos no se muestra: no devuelve nada y la sección queda oculta hasta que haya uno', () => {
  assert.equal(htmlProximo(undefined, '2026-10-20').toString(), '');
  assert.match(seccion('lo-que-viene').split('>')[0], /\bhidden\b/);
  assert.doesNotMatch(pagina, /portal-proximo/, 'ya no cuelga del calendario');
  assert.doesNotMatch(seccion('calendario'), /portal-prox/);
  const desde = portal.indexOf('async function mostrarProximo()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n  }\n', desde));
  assert.match(cuerpo, /\$\('lo-que-viene'\)\.hidden = !proximos\.length/);
  assert.match(cuerpo, /alMostrarProximo\(\)/, 'y el atajo "Agenda" se suma recién entonces');
  assert.match(portal, /!\$\('lo-que-viene'\)\.hidden && \{ clave: 'agenda', texto: 'Agenda', href: '#lo-que-viene' \}/);
});

test('lo que viene muestra fecha, tipo y botones de agendar, con la foto de su tipo', () => {
  for (const [dia, tipo, foto] of [['2026-10-24', 'evento', 'escuelita-grupo'], ['2026-10-31', 'partido', 'juego-ataque']]) {
    const [prox] = proximosEventos(porDia, dia, 1);
    const out = htmlProximo(prox, dia).toString();
    assert.match(out, new RegExp(`<article class="portal-prox tipo-${tipo}">`));
    assert.match(out, new RegExp(`<img src="/public/img/fotos/${foto}-640\\.webp"[^>]*alt="[^"]{20,}"[^>]*loading="lazy"`));
    assert.match(out, /<div class="portal-prox-fecha" aria-label="[^"]+"><small>[^<]+<\/small><b>\d+<\/b><small>[^<]+<\/small><\/div>/);
    assert.match(out, /<h3 class="portal-prox-t">/);
    assert.match(out, /<a href="https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE[^"]*" target="_blank" rel="noopener"><svg[\s\S]*?<\/svg>Google<\/a>/);
    assert.match(out, /<button type="button" data-ics="[^"]+"><svg[\s\S]*?<\/svg>iPhone<\/button>/);
  }
  // El lugar sólo si hay, y nada de la descripción de Google (puede traer nombres).
  assert.doesNotMatch(htmlProximo(proximosEventos(porDia, '2026-10-24', 1)[0], '2026-10-24').toString(), /portal-prox-lugar/);
  assert.match(htmlProximo({ fecha: '2026-10-24', evento: porDia.get('2026-10-24')[1] }, '2026-10-24').toString(), /portal-prox-lugar[^>]*><i><svg[\s\S]*?<\/i>Microestadio/);
  assert.doesNotMatch(portal.slice(portal.indexOf('export function htmlProximo')), /descripcion|description/);
});

test('"Lo que viene" busca en el mes siguiente si en lo que queda del mes no hay nada', () => {
  const desde = portal.indexOf('async function mostrarProximo()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n  }\n', desde));
  assert.match(cuerpo, /mesVecino\(anio, mes, 1\)/);
  assert.match(cuerpo, /Number\(hoy\.slice/, 'sale del mes de hoy, no del que muestra la grilla');
  assert.match(portal, /cargar\(estado\.anio, estado\.mes\)\.then\(mostrarProximo\)/);
});

test('día inicial: hoy si es del mes; si no, el primero con algo, o el 1', () => {
  assert.equal(diaInicial(2026, 10, '2026-10-20', porDia), '2026-10-20');
  assert.equal(diaInicial(2026, 10, '2026-09-30', porDia), '2026-10-24');
  assert.equal(diaInicial(2026, 11, '2026-10-20', porDia), '2026-11-01');
});

// ---- El pie: escudo, links legales y firma ----

test('el pie lleva escudo y links legales; la firma arranca oculta y sale de PORTAL.creador', () => {
  const pie = pagina.match(/<footer class="portal-pie">[\s\S]*?<\/footer>/)[0];
  assert.match(pie, /<div class="pie-marca"><img src="\/public\/escudo\.png" alt="" width="40" height="40">/, 'el escudo es decorativo: el nombre va al lado');
  assert.match(pie, /Básquet Newell&#39;s/);
  assert.match(pie, /<a href="\/app">Entrar a Semillero<\/a>/);
  assert.match(pie, /<a href="\/public\/legal\/privacidad\.html">Política de privacidad<\/a>/);
  assert.match(pie, /<a href="\/public\/legal\/terminos\.html">Términos y condiciones<\/a>/);
  assert.match(pie, /<p class="pie-firma" id="portal-firma" hidden><\/p>/, 'sin nombre, no se ve');
  assert.doesNotMatch(pie, /linkedin|Hecho por/i, 'ni nombre ni link escritos a mano en el HTML');
  assert.match(portal, /mostrar\('portal-firma', htmlFirma\(PORTAL\.creador\), 'portal-firma'\)/);
  for (const a of ['/public/legal/privacidad.html', '/public/legal/terminos.html']) assert.ok(readFileSync(a.slice(1), 'utf8').length > 0, a);
});

test('la firma del pie: "Hecho por" con link externo a LinkedIn (noopener), sólo el nombre sin link válido, nada sin nombre; escapada', () => {
  const con = htmlFirma({ nombre: 'Ana <b>', linkedin: 'https://www.linkedin.com/in/ana/' }).toString();
  assert.match(con, /^Hecho por <a class="pie-firma-link" href="https:\/\/www\.linkedin\.com\/in\/ana\/" target="_blank" rel="noopener">Ana &lt;b&gt; /);
  const sinLink = htmlFirma({ nombre: 'Ana', linkedin: 'https://evil.com/in/ana' }).toString();
  assert.equal(sinLink, 'Hecho por <b>Ana</b>');
  assert.doesNotMatch(sinLink, /<a /);
  assert.equal(htmlFirma({ nombre: null, linkedin: 'https://www.linkedin.com/in/ana/' }).toString(), '');
  assert.equal(htmlFirma(PORTAL.creador).toString(), '', 'hoy el pie no firma');
});

// ---- El sticker de sponsor del hero ----

test('el sticker de sponsor lleva a colaborar: dentro del hero, con nombre accesible y el anillo decorativo', () => {
  const heroe = seccion('heroe');
  const sticker = heroe.match(/<a class="portal-sponsor"[\s\S]*?<\/a>/)?.[0];
  assert.ok(sticker, 'falta el sticker en el hero');
  assert.match(sticker, /href="#colaborar"/);
  assert.match(sticker, /aria-label="¿Tenés una empresa\? Sumate[^"]*"/);
  assert.match(sticker, /<svg class="portal-sponsor-anillo" id="anillo-sponsor"[^>]*aria-hidden="true"/);
  assert.match(sticker, /<textPath[^>]*>¿TENÉS UNA EMPRESA\?/);
  assert.match(sticker, /<span class="portal-sponsor-centro" aria-hidden="true">Sumate<\/span>/);
  assert.ok(pagina.indexOf('id="colaborar"') > 0, 'y existe a dónde ir');
  assert.ok(heroe.indexOf('portal-sponsor"') < heroe.indexOf('portal-heroe-cuerpo'), 'antes del cuerpo: no tapa el título al tabular');
  assert.match(portal, /^$|/); // el HTML es estático: no depende de la base
  assert.match(readFileSync('src/ui/portalArranque.js', 'utf8'), /iniciarGiroSponsor\(\);/);
});

test('el sticker respeta reduced-motion: gira sólo con el keyframe del escudo, se pausa fuera de pantalla y base.css lo apaga', () => {
  const css = readFileSync('public/css/publico.css', 'utf8');
  const base = readFileSync('public/css/base.css', 'utf8');
  assert.match(css, /\.portal-sponsor-anillo\{[^}]*animation:giro var\(--dur-giro\) linear infinite\}/);
  assert.match(css, /@keyframes giro\{from\{transform:rotate\(-360deg\)\}\}/);
  assert.match(css, /\.portal-sponsor-anillo\.quieto\{animation-play-state:paused\}/);
  assert.match(base, /@media \(prefers-reduced-motion:reduce\)\{\*\{transition:none!important;animation:none!important\}\}/);
  const modulo = readFileSync('src/ui/animaciones.js', 'utf8');
  assert.match(modulo, /export function iniciarGiroSponsor\(\)/);
  assert.match(modulo, /classList\.toggle\('quieto', !entrada\.isIntersecting\)/);
  // En el celu, arriba a la izquierda (el título y los botones están abajo); en compu, abajo a la derecha.
  assert.match(css, /\.portal-sponsor\{[^}]*top:5rem;left:var\(--sp-4\)/);
  assert.match(readFileSync('public/css/layout.css', 'utf8'), /\.publico \.portal-sponsor\{top:auto;left:auto;bottom:6rem;right:var\(--sp-6\)/);
});

// ---- La cinta de las próximas fechas ----

test('cinta: fecha con ícono y color de su tipo, título escapado; corre y se repite aria-hidden con botón de pausa', () => {
  const proximos = proximosEventos(porDia, '2026-10-20', 6);
  const mas = [...proximos, ...proximos].slice(0, 3);
  const out = htmlCinta(mas).toString();
  assert.match(out, /<div class="portal-cinta-pista anda" style="--dur-cinta:21s">/);
  assert.equal((out.match(/<ul class="portal-cinta-fila"/g) ?? []).length, 2, 'la fila se repite para el loop');
  assert.equal((out.match(/<ul class="portal-cinta-fila" aria-hidden="true">/g) ?? []).length, 1, 'sólo la copia es aria-hidden');
  assert.match(out, /<li class="tipo-evento"><i><svg[\s\S]*?<\/i><b>sáb 24 oct<\/b><span>Hamburgueseada<\/span>/);
  assert.match(out, /U15 vs\. &lt;Náutico&gt;/);
  assert.doesNotMatch(out, /<Náutico>/);
  assert.match(out, /<button type="button" class="portal-cinta-pausa" data-cinta-pausa aria-pressed="false" aria-label="Pausar la cinta">/);
});

test('la cinta no ofrece sponsors: eso es del sticker del hero, y la banda ya no va girada', () => {
  for (const proximos of [proximosEventos(porDia, '2026-10-20', 1), proximosEventos(porDia, '2026-10-20', 6), []]) {
    assert.doesNotMatch(htmlCinta(proximos).toString(), /cinta-sumate|href="#colaborar"|sponsor|empresa/i);
  }
  assert.doesNotMatch(portal, /cinta-sumate/);
  const css = readFileSync('public/css/publico.css', 'utf8');
  const banda = css.match(/\.portal-cinta-banda\{[^}]*\}/)[0];
  assert.doesNotMatch(banda, /rotate/);
});

test('cinta: con uno o dos eventos queda quieta', () => {
  const uno = htmlCinta(proximosEventos(porDia, '2026-10-20', 1)).toString();
  assert.doesNotMatch(uno, /pista anda|<ul class="portal-cinta-fila" aria-hidden|portal-cinta-pausa|--dur-cinta/);
  assert.equal((uno.match(/<ul class="portal-cinta-fila"/g) ?? []).length, 1);
  const dos = htmlCinta(proximosEventos(porDia, '2026-10-20', 2)).toString();
  assert.doesNotMatch(dos, /pista anda|portal-cinta-pausa/);
});

test('sin fechas la cinta no se muestra: no devuelve nada y la sección queda oculta', () => {
  assert.equal(htmlCinta([]).toString(), '');
  assert.match(pagina, /<section class="portal-cinta" id="cinta" aria-label="Próximas fechas" hidden>/);
  const desde = portal.indexOf('async function mostrarProximo()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n  }\n', desde));
  assert.match(cuerpo, /\$\('cinta'\)\.hidden = !proximos\.length/);
  const arranque = portal.slice(portal.indexOf('export async function iniciarPortal()'));
  assert.doesNotMatch(arranque, /\$\('cinta'\)\.hidden = false/, 'no se prende antes de saber si hay fechas');
});

test('la cinta y "Lo que viene" salen de los mismos eventos: este mes y el siguiente, y se revelan al armarse', () => {
  const desde = portal.indexOf('async function mostrarProximo()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n  }\n', desde));
  assert.match(cuerpo, /proximosEventos\(new Map\(\[\.\.\.actual\.porDia, \.\.\.siguiente\.porDia\]\), hoy, 6\)/);
  assert.match(cuerpo, /htmlCinta\(proximos\)/);
  assert.match(cuerpo, /revelar\(\$\('lo-que-viene'\)\)/);
  assert.ok(pagina.indexOf('id="cinta"') > pagina.indexOf('id="heroe"') && pagina.indexOf('id="cinta"') < pagina.indexOf('id="calendario"'), 'la cinta va entre el hero y el calendario');
});

test('cada tipo tiene su ícono en el detalle del día y en "Lo que viene"', () => {
  const out = htmlCalendario(estado(), CALS).toString();
  assert.match(out, /<small><i class="portal-tipo-ico"><svg[\s\S]*?<\/i>Eventos · Todo el día<\/small>/);
  const [prox] = proximosEventos(porDia, '2026-10-25', 1);
  assert.match(htmlProximo(prox, '2026-10-25').toString(), /<i class="portal-tipo-ico"><svg[\s\S]*?<\/i><span class="portal-prox-tipo">Partido<\/span>/);
});

// ---- Carrusel de categorías ----

test('carrusel: una tarjeta-botón por categoría que salta a su año, con su foto lazy y escapada y el "Su categoría" listo; sin foto, con pelota; sin categorías, nada', () => {
  const foto = { src: '/public/img/fotos/a.webp', src640: '/public/img/fotos/a-640.webp', alt: 'Un <jugador>', posicion: '50% 40%' };
  const out = htmlCarrusel([
    { nombre: 'U13', rama: 'Mixto', anios: '2014 y 2015', foto, anio: 2014 },
    { nombre: 'Primera', rama: 'Femenino', anios: '2009 y antes', foto: null, anio: 2009 },
  ]).toString();
  assert.match(out, /<ul class="portal-carrusel-pista">/);
  assert.equal((out.match(/<li class="portal-card/g) ?? []).length, 2);
  assert.match(out, /<button type="button" data-anio-cat="2014" aria-pressed="false">/);
  assert.match(out, /<img src="\/public\/img\/fotos\/a-640\.webp" srcset="\/public\/img\/fotos\/a-640\.webp 640w, \/public\/img\/fotos\/a\.webp 1080w"[^>]*width="640" height="427" alt="Un &lt;jugador&gt;" loading="lazy" style="object-position:50% 40%">/);
  assert.match(out, /<span class="portal-card-su"><i><svg[\s\S]*?<\/i>Su categoría<\/span>/);
  assert.match(out, /<b>U13<\/b><span>Mixto<\/span><small>Nacidos 2014 y 2015<\/small>/);
  assert.match(out, /<li class="portal-card sin-foto">\s*<button type="button" data-anio-cat="2009" aria-pressed="false">\s*<i aria-hidden="true"><svg/);
  assert.equal((out.match(/<img /g) ?? []).length, 1, 'la que no tiene foto no lleva imagen');
  assert.match(out, /data-carrusel="-1" aria-label="Ver las categorías anteriores"/);
  assert.equal(htmlCarrusel([]).toString(), '');
  assert.match(pagina, /<div class="portal-carrusel" id="portal-carrusel">/);
  assert.ok(pagina.indexOf('id="portal-buscador"') < pagina.indexOf('id="portal-carrusel"'), 'va debajo del buscador');
  assert.doesNotMatch(pagina, /portal-todas/, 'sin la lista plegada: las tarjetas ya muestran todas');
  assert.match(portal, /htmlCarrusel\(tarjetas\)/);
  // Tocar una tarjeta mueve el buscador; el año marca la tarjeta (aria-pressed) con la misma regla que el resultado.
  const desde = portal.indexOf('function iniciarBuscador(');
  const cuerpo = portal.slice(desde, portal.indexOf('\n}\n', desde));
  assert.match(cuerpo, /elegir\(Number\(b\.dataset\.anioCat\)\)/);
  assert.match(cuerpo, /setAttribute\('aria-pressed', String\(tarjetaDelAnio\(tarjetas\[i\], anio\)\)\)/);
  assert.match(cuerpo, /prefers-reduced-motion: reduce/);
});

test('categorías va primero después del hero (como en v0) y el atajo también', () => {
  assert.ok(pagina.indexOf('id="categorias"') > pagina.indexOf('id="cinta"') && pagina.indexOf('id="categorias"') < pagina.indexOf('id="calendario"'));
  assert.ok(portal.indexOf("clave: 'categorias'") < portal.indexOf("clave: 'calendario'"));
});

// ---- Categorías, sede, foto, contacto: sin datos, nada ----

test('sin datos, cada parte no devuelve nada (la sección queda oculta)', () => {
  assert.equal(htmlFoto(null).toString(), '');
  assert.equal(htmlFormularios([]).toString(), '');
});

test('buscador: − y + alrededor del año, apagados en los topes, y el resultado se anuncia', () => {
  const out = htmlBuscador(2014, { min: 1997, max: 2023 }).toString();
  assert.match(out, /<button type="button" data-anio="-1" aria-label="Un año antes">−<\/button>/);
  assert.match(out, /<output id="portal-anio">2014<\/output>/);
  assert.match(out, /<div class="portal-cat-resultado" id="portal-cat-res" aria-live="polite">/);
  assert.match(htmlBuscador(1997, { min: 1997, max: 2023 }).toString(), /data-anio="-1" aria-label="Un año antes" disabled/);
  assert.match(htmlBuscador(2023, { min: 1997, max: 2023 }).toString(), /data-anio="1" aria-label="Un año después" disabled/);
});

test('categoría del año: el nombre, sus años y un renglón por turno (cuándo y dónde); sin horario, lo dice; escapado', () => {
  const out = htmlCategoriaDelAnio(2014, [{ nombre: 'U13', rama: 'Mixto', anios: '2014 y 2015', horario: 'Lun <18 h> (Estadio Cubierto) · Mié 18 h' }]).toString();
  assert.match(out, /<b>U13<\/b><span><em>Mixto<\/em><small>Nacidos 2014 y 2015<\/small><\/span>/);
  assert.match(out, /<li><span><i><svg[\s\S]*?<\/i>Lun &lt;18 h&gt;<\/span><span class="lugar"><i><svg[\s\S]*?<\/i>Estadio Cubierto<\/span><\/li>/);
  assert.match(out, /<li><span><i><svg[\s\S]*?<\/i>Mié 18 h<\/span><\/li>/, 'sin lugar, sin el renglón del lugar');
  const primeras = htmlCategoriaDelAnio(1990, [
    { nombre: 'Primera', rama: 'Masculino', anios: '2005 y antes', horario: null },
    { nombre: 'Primera', rama: 'Femenino', anios: '2005 y antes', horario: null },
  ]).toString();
  assert.equal((primeras.match(/class="portal-cat-res"/g) ?? []).length, 2);
  assert.match(primeras, /Horario a confirmar\./);
  assert.doesNotMatch(primeras, /coordinador/);
});

test('categoría del año: sin ninguna, lo dice y manda a las preguntas frecuentes, no al coordinador', () => {
  const out = htmlCategoriaDelAnio(2021, []).toString();
  assert.match(out, /Para chicos nacidos en 2021 todavía no hay categoría\./);
  assert.match(out, /<a href="#ayuda">/);
  assert.doesNotMatch(out, /wa\.me|coordinador/);
});

test('dónde se entrena: los tres lugares, "Cómo llegar" y el mapa SIN cargar hasta tocar "Ver mapa"', () => {
  const out = htmlSede({
    nombre: 'Estadio <x>', direccion: 'Parque de la Independencia, Rosario', lugares: ['Estadio Cubierto "Claudio Newell"', 'Microestadio', 'Playón Deportivo'],
    mapa: 'https://maps.app.goo.gl/abc', buscar: 'Estadio Cubierto Claudio Newell, Rosario',
  }).toString();
  assert.match(out, /<li>Estadio Cubierto &quot;Claudio Newell&quot;<\/li><li>Microestadio<\/li><li>Playón Deportivo<\/li>/);
  assert.match(out, /href="https:\/\/maps\.app\.goo\.gl\/abc"[^>]*>Cómo llegar/);
  assert.match(out, /<div class="portal-mapa" data-embed="https:\/\/www\.google\.com\/maps\?q=[^"]+&amp;output=embed" data-titulo="Mapa: Estadio &lt;x&gt;">/);
  assert.match(out, /<button type="button" class="portal-mapa-ver">[\s\S]*Ver mapa/);
  assert.doesNotMatch(out, /<iframe/, 'el iframe no está hasta que se toca');
  assert.match(out, /<img class="portal-mapa-foto" src="\/public\/img\/fotos\/[\w-]+-640\.webp"[^>]*alt="[^"]+" loading="lazy"/, 'una foto en vez del recuadro vacío');
  assert.equal(htmlSede(null).toString(), '');
  // El iframe lo arma el clic, y sólo con la dirección que armó sedeValida.
  const desde = portal.indexOf('function iniciarMapa()');
  const cuerpo = portal.slice(desde, portal.indexOf('\n}\n', desde));
  assert.match(cuerpo, /closest\('\.portal-mapa-ver'\)/);
  assert.match(cuerpo, /createElement\('iframe'\)/);
  assert.match(cuerpo, /iframe\.src = caja\.dataset\.embed/);
});

test('foto con su alt', () => {
  assert.match(htmlFoto({ src: '/public/portal/club.jpg', alt: 'La cancha' }).toString(), /<img src="\/public\/portal\/club\.jpg" alt="La cancha" loading="lazy">/);
});

// ---- Otros formularios ----

test('cada formulario muestra su línea de ayuda y abre en otra pestaña; uno con enlace inválido no aparece', () => {
  const out = htmlFormularios([
    { titulo: 'Rifa <b>', texto: 'Subí el comprobante <i>acá</i>', enlace: 'https://forms.gle/AbC123' },
    { titulo: 'Malo', texto: 'y', enlace: 'https://evil.com/forms/x' },
  ]).toString();
  assert.match(out, /Subí el comprobante &lt;i&gt;acá&lt;\/i&gt;/);
  assert.match(out, /<a [^>]*href="https:\/\/forms\.gle\/AbC123" target="_blank" rel="noopener"/);
  assert.doesNotMatch(out, /<b>|<i>|Malo|evil/);
  assert.match(htmlAvisoRespaldo().toString(), /no pudimos actualizar/i);
});

test('el portal aparta los formularios con lugar propio: no aparecen dos veces', () => {
  assert.match(portal, /const \{ inscripcion, comprobante, consultas, colaboradores, recaudacion, comunes \} = separarFormularios\(formularios\);/);
  assert.match(portal, /htmlAcciones\(\{ inscripcion, consultas,/);
  assert.match(portal, /htmlPago\(\{ alias: PORTAL\.alias, comprobante \}\)/);
  assert.match(portal, /htmlColaborar\(colaboradores\)/);
  assert.match(portal, /htmlRecaudacion\(recaudacion\)/);
  assert.match(portal, /htmlFormularios\(comunes\)/);
});

// ---- Recaudación: franja dorada con su propio formulario (destino recaudacion, 0063) ----

test('htmlRecaudacion: grande "Enterate…", los ejemplos con ícono, el botón dorado, y sin formulario el botón apagado', () => {
  const abierta = htmlRecaudacion(FORM('x', 'https://forms.gle/Rec1')).toString();
  assert.match(abierta, /<h2 id="t-recaudacion">Enterate de los eventos de recaudación<\/h2>/);
  assert.match(abierta, /<ul class="portal-rec-ej" aria-label="Por ejemplo">\s*<li><i><svg[\s\S]*?<\/i>Noches de pizza<\/li><li><i><svg[\s\S]*?<\/i>Rifas<\/li><li><i><svg[\s\S]*?<\/i>Comidas<\/li>/);
  assert.match(abierta, /<a class="portal-rec-btn" href="https:\/\/forms\.gle\/Rec1" target="_blank" rel="noopener">Quiero que me avisen/);
  assert.doesNotMatch(abierta, /<img /, 'sin foto');
  for (const f of [null, MALO]) {
    const cerrada = htmlRecaudacion(f).toString();
    assert.match(cerrada, /<button type="button" class="portal-rec-btn" disabled aria-disabled="true">Se habilita cuando abra el formulario<\/button>/);
    assert.doesNotMatch(cerrada, /<a |evil/);
  }
});

// ---- Colaborar: empresas que se asocian o quien da una mano (destino colaboradores) ----

test('htmlColaborar: las dos formas (empresa, dar una mano) y el botón; no promete avisos de eventos', () => {
  const out = htmlColaborar(FORM('x', 'https://forms.gle/Col1')).toString();
  assert.match(out, /Tengo una empresa o un comercio/);
  assert.match(out, /Quiero dar una mano/);
  assert.match(out, /hacer el pollo/);
  // Botón con borde, no rojo: el rojo es del hero (como los de Sumate en v0).
  assert.match(out, /<a class="btn sec" href="https:\/\/forms\.gle\/Col1" target="_blank" rel="noopener">Quiero colaborar/);
  assert.doesNotMatch(out, /te avisamos/i);
  assert.match(htmlColaborar(null).toString(), /<button type="button" class="btn" disabled aria-disabled="true">Se habilita cuando abra el formulario<\/button>/);
  // El afiche de sponsors del club: su texto (con el teléfono) va en el alt.
  assert.match(out, /<img class="portal-afiche" src="\/public\/img\/fotos\/sponsor-camisetas-640\.webp"[^>]*width="640" height="853" alt="Afiche del club: [^"]*Sumá tu empresa como sponsor: 341 370-9161" loading="lazy">/);
});

// ---- Preguntas frecuentes ----

test('ayuda: seis preguntas en acordeón y, al final, el único botón al coordinador', () => {
  const out = htmlAyuda({ temporada: 2027, alias: { alias: 'NOB.BASQUET' }, sede: { nombre: 'Microestadio', mapa: 'https://maps.app.goo.gl/abc' }, contacto: 'https://wa.me/5493410000000' }).toString();
  assert.equal((out.match(/<details class="portal-faq"><summary>/g) ?? []).length, 6);
  const preguntas = [...out.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1]);
  assert.deepEqual(preguntas, [
    '¿Cómo inscribo a mi hijo o hija?',
    '¿Cómo pago o mando el comprobante?',
    'Me pide iniciar sesión con Google, ¿qué hago?',
    '¿En qué categoría juega mi hijo o hija?',
    'Me equivoqué en un dato del formulario, ¿qué hago?',
    '¿Dónde y cuándo entrena mi hijo o hija?',
  ]);
  assert.match(out, /<b>NOB\.BASQUET<\/b>/);
  assert.match(out, /Microestadio/);
  assert.match(out, /href="https:\/\/maps\.app\.goo\.gl\/abc"/);
  assert.match(out, /¿No encontraste tu respuesta\?[\s\S]*<a class="btn" href="https:\/\/wa\.me\/5493410000000" target="_blank" rel="noopener">Escribirle por WhatsApp/);
  assert.equal((out.match(/wa\.me/g) ?? []).length, 1);
});

test('ayuda: el login de Google, desde donde se traba el padre: por qué lo pide, cuenta con su mail en 3 pasos, y si no, el coordinador', () => {
  const out = htmlAyuda({ contacto: 'https://wa.me/5493410000000' }).toString();
  const r = out.match(/Me pide iniciar sesión con Google[\s\S]*?<\/details>/)[0];
  assert.match(r, /La inscripción y el comprobante la piden porque se suben fotos/);
  assert.match(r, /sin abrir uno nuevo/);
  assert.equal((r.match(/<li>/g) ?? []).length, 3);
  assert.match(r, /<a href="https:\/\/accounts\.google\.com\/signup" target="_blank" rel="noopener">/);
  assert.match(r, /Usar mi dirección de correo electrónico actual/);
  assert.match(r, /Si no podés, escribile al coordinador \(el botón de acá abajo\)/);
});

test('ayuda: "me equivoqué en un dato" es volver a mandarlo (el Tablero toma la última respuesta por DNI); el DNI, al coordinador', () => {
  const r = htmlAyuda({ contacto: 'https://wa.me/5493410000000' }).toString().match(/Me equivoqué en un dato[\s\S]*?<\/details>/)[0];
  assert.match(r, /Volvé a mandar el formulario con el dato bien: tomamos siempre el último que mandaste\./);
  assert.match(r, /Si te equivocaste en el DNI, avisale al coordinador \(el botón de acá abajo\)\./);
  assert.match(htmlAyuda({}).toString(), /Si te equivocaste en el DNI, avisale al coordinador\./, 'sin contacto, no promete un botón');
});

test('ayuda: "¿cómo inscribo?" no manda a un botón apagado', () => {
  assert.match(htmlAyuda({ inscripcionAbierta: true }).toString(), /Tocá <b>Inscribirme<\/b>/);
  assert.match(htmlAyuda({ consultasAbierto: true, temporada: 2027 }).toString(), /La inscripción 2027 todavía no abrió\. Mientras tanto, tocá <b>Quiero que juegue<\/b>/);
  assert.match(htmlAyuda({}).toString(), /Cuando abra, el botón se habilita arriba de todo/);
  assert.doesNotMatch(htmlAyuda({ contacto: 'javascript:alert(1)' }).toString(), /javascript|No encontraste/);
});

test('htmlLogos: sin sponsors no muestra nada; con sponsors, una imagen con su nombre, escapado', () => {
  assert.equal(htmlLogos([]).toString(), '');
  const out = htmlLogos([
    { nombre: 'Ferretería <Sur>', logo: '/public/sponsors/ferreteria-sur.png', enlace: 'https://ferreteriasur.example/' },
    { nombre: 'Panadería', logo: '/public/sponsors/panaderia.svg' },
    { nombre: 'Ajeno', logo: 'https://cdn.evil.com/x.png' },
  ]).toString();
  assert.match(out, /<img src="\/public\/sponsors\/ferreteria-sur\.png" alt="Ferretería &lt;Sur&gt;" loading="lazy">/);
  assert.match(out, /<a href="https:\/\/ferreteriasur\.example\/" target="_blank" rel="noopener"><img /);
  assert.match(out, /<li><img src="\/public\/sponsors\/panaderia\.svg" alt="Panadería" loading="lazy"><\/li>/);
  assert.equal((out.match(/<img /g) ?? []).length, 2);
});

// ---- Un solo calendario con colores, y "Agregar a mi calendario" ----

test('cada evento ofrece agregarlo: link a Google y botón que baja el .ics', () => {
  const out = htmlCalendario(estado(), CALS).toString();
  const evento = out.match(/<li class="portal-ev tipo-partido">[\s\S]*?<\/li>/)[0];
  assert.match(evento, /<a href="https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE[^"]*" target="_blank" rel="noopener"><svg[\s\S]*?<\/svg>Google<\/a>/);
  assert.match(evento, /<button type="button" data-ics="1\|2026-10-24"><svg[\s\S]*?<\/svg>iPhone<\/button>/);
  assert.match(evento, /Partidos · 10:30 a 11:30/);
});

test('la leyenda muestra sólo los tipos que hay en el mes', () => {
  const soloPartidos = eventosPorDia([ev('9', 'partido', { summary: 'x', start: { date: '2026-10-02' } }), ev('8', 'charla', { summary: 'y', colorId: '7', start: { date: '2026-10-03' } })]);
  const out = htmlCalendario(estado({ porDia: soloPartidos }), CALS).toString();
  assert.match(out, /<li class="tipo-partido">Partidos<\/li><li class="tipo-charla">Charlas<\/li><\/ul>/);
  assert.doesNotMatch(out, /tipo-evento">Eventos/);
});

test('seguir el calendario: Android/compu e iPhone; sin ID válido, nada', () => {
  const out = htmlSuscripcion([{ tipo: 'evento', id: 'abc@group.calendar.google.com' }]).toString();
  assert.match(out, /href="https:\/\/calendar\.google\.com\/calendar\/render\?cid=abc%40group\.calendar\.google\.com"/);
  assert.match(out, /href="webcal:\/\/calendar\.google\.com\/calendar\/ical\/abc%40group\.calendar\.google\.com\/public\/basic\.ics"/);
  assert.equal(htmlSuscripcion([{ tipo: 'evento', id: 'roto' }]).toString(), '');
  assert.match(htmlCalendario(estado(), CALS).toString(), /Querés tener todo el calendario en tu celular/);
});
