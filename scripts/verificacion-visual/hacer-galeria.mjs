// Genera la galería de verificación: el index.html real con la app "logueada" y datos
// falsos, servida por el mismo preview (los CSS se leen en vivo, así que cada cambio se
// ve al recargar). Sin sesión de Supabase no hay otra forma de ver HOY o PLANTEL.
// Uso, desde la raíz del repo:  node scripts/verificacion-visual/hacer-galeria.mjs
// Escribe en .claude/worktrees/_galeria/ (ignorado por git).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = process.cwd();
const SALIDA = `${RAIZ}/.claude/worktrees/_galeria`;
const ORIGEN = '';
let html = readFileSync(`${RAIZ}/public/index.html`, 'utf8');

html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace(/<script src="\/public\/config.js"><\/script>/, '');
html = html.replace(/<script type="module" src="\/src\/ui\/main.js"><\/script>/, '');
html = html.replace(/(href|src)="\/public\//g, `$1="${ORIGEN}/public/`);
html = html.replace(/<div class="app" id="app" hidden>/, '<div class="app" id="app">');
html = html.replace(/<div class="publico"([^>]*)>/, '<div class="publico"$1 hidden>');

const zonas = [
  ['Esquina derecha', 27, 30, '38/140'], ['Frontal', 29, 30, '41/140'],
  ['45° izquierda', 31, 30, '43/140'], ['45° derecha', 32, 30, '45/140'], ['Esquina izquierda', 34, 30, '48/140'],
];
const zona = ([nom, pct, meta, frac]) => `
  <div class="zona">
    <div class="zona-cab"><span class="nom">${nom}</span><span class="frac">${frac}</span></div>
    <div class="zona-barra"><div class="pista">
      <div class="relleno ${pct >= meta ? 'llego' : ''}" style="width:${pct}%"></div>
      <div class="meta" style="left:${meta}%" title="Meta del cuerpo técnico: ${meta}%"></div></div>
      <span class="pct">${pct}%</span></div>
    <div class="zona-pie"><button class="btn-zona-recurso">Mandar un recurso</button>
      <span class="marca-meta ${pct >= meta ? 'si' : 'no'}">${pct >= meta ? '✓ llegó a la meta' : `meta ${meta}%`}</span>
      <span class="var sube">▲ +3 pp</span></div>
  </div>`;

const hoy = `
<div class="pad">
  <div class="contexto">U17M · batería del 10/09 · 14 jugadores midieron</div>
  <div class="cabecera-tiro">
    <div class="k">Tiro de campo · todo el arco</div>
    <div class="cifra">30<span class="u">%</span></div>
    <div class="frac">213/700 tiros</div>
    <div class="sub"><span class="var sube">▲ +8 pp</span><span class="metas-resumen">3 de 5 zonas llegó a su meta</span></div>
  </div>
  <div class="eyebrow">Por zona <span class="der">vs 04/08</span></div>
  <div class="zonas">${zonas.map(zona).join('')}</div>
  <div class="foco-linea">Zona más floja: <b>Esquina derecha</b>, 27%.</div>
  <div class="sep"></div>
  <div class="eyebrow">Tiros libres</div>
  <div class="zonas">${zona(['Libres', 71, 70, '99/140'])}</div>
  <div class="pie-hoy"><div class="k">Altura y peso</div><div class="d">Última medición del plantel: 12/08.</div><button class="btn sec chico">Ver el plantel</button></div>
  <div class="acciones-hoy"><button class="btn sec">Cargar otra medición</button><button class="btn sec">Editar las metas</button></div>
</div>`;

const apellidos = ['Morales', 'Gómez', 'Bianchi', 'Vázquez', 'Ríos', 'Paz', 'Luna', 'Sosa', 'Vera', 'Díaz', 'Ferro', 'Ruiz', 'Toledo', 'Acosta', 'Bravo', 'Cruz', 'Ibarra', 'Molina', 'Nuñez', 'Ortiz', 'Peralta', 'Quiroga', 'Rey', 'Suárez'];
const jug = (a, i) => `
  <button class="jug"><div class="av">${a[0]}J</div>
    <div><div class="nom">${a}, Juan</div><div class="det">${i % 4 === 0 ? 'Sin medir' : `${170 + i} cm · ${60 + i} kg`}</div></div>
    <div class="der">${i % 4 === 0 ? '<span class="chip sin">sin medir</span>' : ''}<span class="flecha">›</span></div></button>`;
const plantel = `<div class="pad"><h2 class="h2">Plantel</h2>${apellidos.map(jug).join('')}</div>`;

const barras = `
<div class="pad"><h2 class="h2">Reparto de minutos</h2><div class="barras">${apellidos.slice(0, 8).map((a, i) => `
  <div class="barra"><div class="et">${a}</div><div class="pista"><div class="relleno" style="width:${100 - i * 11}%"></div></div><div class="val">${240 - i * 25} min</div></div>`).join('')}</div>
  <div class="tarj tocable" role="button" tabindex="0"><div class="tarj-h"><span class="t">Una tarjeta tocable</span><span class="n">12</span></div><div class="p">Texto de apoyo de la tarjeta.</div></div>
  <div class="al"><span class="ico">!</span><div class="tx">Un aviso<div class="mt">con detalle</div></div></div>
  <div class="chips"><span class="chip">neutro</span> <span class="chip sube">sube</span> <span class="chip baja">baja</span> <span class="chip sin">sin medir</span></div>
  <button class="btn" style="margin-top:1rem">Botón primario</button>
  <button class="btn" disabled style="margin-top:.5rem">Deshabilitado</button>
  <div class="campo" style="margin-top:1rem"><label>Campo</label><input value="Texto"></div></div>`;

// Casos especiales para el repaso de temas (task 5 del plan del tema oscuro): lo que no sale en
// HOY / PLANTEL / DATOS y se pinta con colores propios. Los gráficos y la pizarra se dibujan con
// los módulos reales (un <script type="module"> al final), con datos inventados.
const casos = `
<section class="pant" id="p-casos"><div id="g-casos"><div class="pad">
  <h2 class="h2">Gráficos</h2>
  <div class="tarj"><svg class="g" id="svg-evolucion-c"></svg></div>
  <div class="tarj"><svg class="g" id="svg-cancha-c"></svg></div>
  <h2 class="h2">Pizarra</h2>
  <div class="tarj"><svg class="pz" id="svg-pizarra-c"></svg></div>
  <h2 class="h2">Asistencia</h2>
  <ul style="list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem">
    <li class="asis-item"><button class="asis-tarj" data-estado="presente"><span class="nom">Morales, Juan</span><span class="asis-estado">Presente</span></button></li>
    <li class="asis-item"><button class="asis-tarj" data-estado="ausente"><span class="nom">Gómez, Juan</span><span class="asis-estado">Ausente</span></button></li>
    <li class="asis-item"><button class="asis-tarj" data-estado="sin-tomar"><span class="nom">Bianchi, Juan</span><span class="asis-estado">Sin tomar</span><span class="chip baja">Lesionado</span></button></li>
    <li class="asis-item"><button class="asis-tarj" data-estado="justificada"><span class="nom">Vázquez, Juan</span><span class="asis-estado">Justificada</span></button></li>
  </ul>
  <h2 class="h2">Chips y etiquetas</h2>
  <div class="chips"><span class="chip">neutro</span> <span class="chip sube">sube</span> <span class="chip baja">baja</span> <span class="chip sin">sin medir</span> <span class="tag">tag</span> <span class="tag rojo">tag rojo</span></div>
  <div class="yoyo-jug aviso" style="margin-top:.75rem"><div class="etq">Aviso del jugador</div><div class="nom">Ríos, Juan</div></div>
  <div class="tira" style="margin-top:.75rem"><button class="num on">1</button> <button class="num">2</button></div>
  <div class="segmentado" style="margin-top:.75rem"><button class="segmento" aria-pressed="true">Uno</button><button class="segmento" aria-pressed="false">Dos</button></div>
  <div style="display:flex;gap:.5rem;margin-top:.75rem"><button class="chip-tema on">Filtro activo</button><button class="chip-tema">Filtro</button></div>
  <div class="jug-sugerencia" style="margin-top:.75rem"><div class="decision"><button class="on">Sí</button><button>No</button></div></div>
  <h2 class="h2">Campos</h2>
  <div class="campo"><label for="c1">Con placeholder</label><input id="c1" placeholder="Escribí acá" type="text"></div>
  <div class="campo"><label for="c2">Lista</label><select id="c2"><option>Una opción</option></select></div>
  <div class="campo"><label for="c3">Nota</label><textarea id="c3" placeholder="Una nota"></textarea><div class="ayuda">Texto de ayuda del campo.</div></div>
  <div class="campo"><label for="c4">Con error</label><input id="c4" value="Dato" aria-invalid="true"></div>
  <h2 class="h2">Avisos</h2>
  <div class="al error"><span class="ico">!</span><div class="tx">Aviso de error<div class="mt">con detalle</div></div></div>
  <div class="al ok"><span class="ico">✓</span><div class="tx">Aviso de listo<div class="mt">con detalle</div></div></div>
  <div class="crono-aviso">Aviso amarillo del cronómetro</div>
  <div class="aviso-corporal"><span>Aviso corporal</span><button class="btn sec chico">Acción</button></div>
  <h2 class="h2">Números y botones</h2>
  <div class="fin-fila"><span class="fin-ingreso">+ $ 12.000</span> <span class="fin-egreso">- $ 3.000</span></div>
  <div class="test-fila hecho"><div class="ic">✓</div><div><div class="nom">Prueba hecha</div><div class="d">12,4 s</div></div></div>
  <button class="btn sec" style="margin-top:.75rem">Botón secundario</button>
  <button class="btn contorno" style="margin-top:.75rem">Botón contorno</button>
  <div class="eyebrow">Eyebrow <span class="der">der</span></div>
  <div class="rec-dato"><div class="v">Dato hundido</div></div>
  <div class="pestanas" role="tablist"><button class="pest on" role="tab">Una</button><button class="pest" role="tab">Otra</button></div>
</div></div></section>`;
html = html.replace('<section class="pant" id="p-hoy">', casos + '<section class="pant" id="p-hoy">');

const pantallas = { hoy, plantel, datos: barras };
for (const [id, cont] of Object.entries({ 'p-hoy': hoy, 'p-plantel': plantel, 'p-datos': barras })) {
  html = html.replace(new RegExp(`(<section class="pant" id="${id}"><div id="[^"]+">)`), `$1${cont}`);
}

// Cabecera, categorías y navegación como las dibuja chrome.js.
const cab = `
  <button class="inicio"><img class="escudo" src="${ORIGEN}/public/escudo.png" alt=""></button>
  <div class="pantalla-actual"><span class="lugar-volver"></span><div class="titulo"><h1 id="g-titulo">HOY</h1><div class="sub">Newell's Old Boys</div></div></div>
  <button class="perfil">TA</button>`;
const cats = ['U13', 'U15', 'U17M', 'U21'].map((c) => `<button class="cat ${c === 'U17M' ? 'on' : ''}"><div><div class="sig">${c}</div></div></button>`).join('');
const nav = `<button class="marca-nav"><img class="escudo" src="${ORIGEN}/public/escudo.png" alt=""><span class="club">Newell's Old Boys</span></button>` +
  [['hoy', 'HOY'], ['plantel', 'PLANTEL'], ['datos', 'DATOS']].map(([id, t]) => `<button data-g="${id}" class="${id === 'hoy' ? 'on' : ''}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg><span>${t}</span></button>`).join('');
html = html.replace('<header class="cabecera" id="cabecera"></header>', `<header class="cabecera" id="cabecera">${cab}</header>`);
html = html.replace('<div class="cats" id="cats"></div>', `<div class="cats" id="cats">${cats}</div>`);
html = html.replace('<nav class="nav" id="nav" aria-label="Navegación principal"></nav>', `<nav class="nav" id="nav">${nav}</nav>`);

const script = `
<script>
const ids = { hoy: 'p-hoy', plantel: 'p-plantel', datos: 'p-datos', casos: 'p-casos' };
function ir(v) {
  document.querySelectorAll('.pant').forEach((p) => p.classList.toggle('on', p.id === ids[v]));
  document.querySelectorAll('.nav button[data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === v));
  document.getElementById('g-titulo').textContent = v.toUpperCase();
  document.getElementById('cuerpo').scrollTop = 0;
}
function abrirHoja() {
  document.getElementById('hoja').innerHTML = '<div class="asa"></div><h2>Esquina derecha</h2><div class="pad"><div class="p">Meta del cuerpo técnico para esta zona: 30%.</div><div class="lista-chk">' +
    Array.from({ length: 12 }, (_, i) => '<div class="chk-fila"><span>Jugador ' + (i + 1) + '</span><span class="der">2/10</span></div>').join('') + '</div></div>';
  document.getElementById('velo').classList.add('on'); document.getElementById('hoja').classList.add('on');
}
function cerrarHoja() { document.getElementById('velo').classList.remove('on'); document.getElementById('hoja').classList.remove('on'); }
document.querySelectorAll('.nav button[data-g]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.g)));
document.getElementById('velo').addEventListener('click', cerrarHoja);
document.querySelectorAll('.btn-zona-recurso,.btn.sec').forEach((b) => b.addEventListener('click', abrirHoja));
const vista = location.hash.slice(1); ir(ids[vista] ? vista : 'hoy');
if (vista === 'hoja') { ir('hoy'); abrirHoja(); }

// Recorrido para medir: cuántos frames largos (>50 ms) hay durante uso típico.
window.recorrido = async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = [];
  const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => frames.push(Math.round(e.duration))));
  po.observe({ type: 'long-animation-frame', buffered: false });
  const deltas = []; let previo = performance.now(); let vivo = true;
  (function tic(t) { deltas.push(t - previo); previo = t; if (vivo) requestAnimationFrame(tic); })(previo);
  const cuerpo = document.getElementById('cuerpo');
  const orden = ['hoy', 'plantel', 'datos'];
  for (let i = 0; i < 10; i++) { ir(orden[i % 3]); await espera(450); }
  for (let i = 0; i < 5; i++) { ir('hoy'); abrirHoja(); await espera(500); cerrarHoja(); await espera(500); }
  ir('plantel'); await espera(300);
  for (let y = 0; y <= 1200; y += 60) { cuerpo.scrollTop = y; await espera(16); }
  await espera(300);
  po.disconnect(); vivo = false;
  const d = deltas.slice(2);
  return { largos: frames.length, peor: Math.max(0, ...frames), frames, rafTotal: d.length, raf25: d.filter((x) => x > 25).length, rafPeor: Math.round(Math.max(...d)) };
};
</script>`;
const modulos = `
<script type="module">
import { grafico, cancha } from '/src/ui/componentes/graficos.js';
import { dibujarPizarra } from '/src/ui/componentes/pizarra.js';
import { jugadaVacia, estadoAlInicioDelPaso } from '/src/data/jugadas.js';
grafico(document.getElementById('svg-evolucion-c'), { etiquetas: ['01/09', '08/09', '15/09', '22/09', '29/09'], series: [
  { nombre: '2P', c: 'primario', d: [40, 44, 41, 48, 52] }, { nombre: '3P', c: 'tinta', d: [22, 26, null, 30, 33] }, { nombre: 'TL', c: 'apagado', dash: true, d: [60, 64, 66, 70, 71] }] });
cancha(document.getElementById('svg-cancha-c'), { frontal: { pct: 41, anotados: 41, intentos: 100 }, esquinaDerecha: { pct: 27, anotados: 8, intentos: 30 }, esquinaIzquierda: { pct: 55, anotados: 11, intentos: 20 } }, { alto: 240 });
const datos = { ...jugadaVacia(), fichas: [
  { id: 'a1', tipo: 'ataque', numero: 1, x: 0.5, y: 0.8 }, { id: 'a2', tipo: 'ataque', numero: 2, x: 0.25, y: 0.55 }, { id: 'd1', tipo: 'defensa', numero: 1, x: 0.5, y: 0.65 }] };
dibujarPizarra(document.getElementById('svg-pizarra-c'), datos, estadoAlInicioDelPaso(datos, 0), { paso: 0 });
</script>`;
html = html.replace("</body>", `<script src="/.claude/worktrees/_galeria/dump.js"></script>${script}${modulos}</body>`);
mkdirSync(SALIDA, { recursive: true });
writeFileSync(`${SALIDA}/galeria.html`, html);
copyFileSync(`${dirname(fileURLToPath(import.meta.url))}/dump.js`, `${SALIDA}/dump.js`);
console.log('ok', html.length);
