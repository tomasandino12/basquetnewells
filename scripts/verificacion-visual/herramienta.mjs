// Herramienta de verificación visual. Necesita el preview `app` corriendo (puerto 5173),
// la galería generada (hacer-galeria.mjs) y puppeteer-core: `npm i --no-save puppeteer-core`.
// Variables opcionales: CHROME (ruta a chrome.exe), SALIDA (carpeta de bases y capturas) y
// TEMA=oscuro (pone data-tema="oscuro" en <html> antes de medir o capturar).
// Se corre desde la raíz del repo:
//   node scripts/verificacion-visual/herramienta.mjs recorrido            -> frames largos con CPU 4x, 375px (CORRIDAS=n)
//   node scripts/verificacion-visual/herramienta.mjs base                 -> guarda los estilos computados actuales como base
//   node scripts/verificacion-visual/herramienta.mjs comparar             -> compara contra la base
//   node scripts/verificacion-visual/herramienta.mjs capturas <carpeta>   -> PNGs de cada vista a 375 y 1280
//   node scripts/verificacion-visual/herramienta.mjs contraste           -> contraste de cada texto, desbordes y toques < 44 px en las vistas de la galería a 375 y 1280; sale con código 1 si hay fallas (VER_SIN_MEDIR=1 lista lo que no pudo medir)
//   node scripts/verificacion-visual/herramienta.mjs js <vista> <ancho> "<expr>"  -> evalúa una expresión (REDUCIDO=1 emula prefers-reduced-motion; CAPTURA=ruta.png saca un PNG al final)
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { medirVista } from './contraste.mjs';

const ORIGEN = 'http://localhost:5173';
const RAIZ = process.env.SALIDA ?? `${process.cwd()}/.claude/worktrees/_galeria/salida`;
const GAL = `${ORIGEN}/.claude/worktrees/_galeria/galeria.html`;
const VISTAS = {
  landing: `${ORIGEN}/public/`,
  hoy: `${GAL}#hoy`, plantel: `${GAL}#plantel`, datos: `${GAL}#datos`, hoja: `${GAL}#hoja`, casos: `${GAL}#casos`,
};
const ANCHOS = [375, 1280];

const navegador = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-sandbox'],
});

async function abrir(vista, ancho, { cpu = 1, reducido = false } = {}) {
  const p = await navegador.newPage();
  await p.setViewport({ width: ancho, height: ancho < 600 ? 812 : 800, deviceScaleFactor: 1, isMobile: ancho < 600, hasTouch: ancho < 600 });
  if (cpu > 1) await (await p.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (reducido) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(VISTAS[vista], { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  if (process.env.TEMA === 'oscuro') await p.evaluate(() => document.documentElement.setAttribute('data-tema', 'oscuro'));
  await p.addScriptTag({ url: `${ORIGEN}/.claude/worktrees/_galeria/dump.js` });
  // Que termine cualquier animación de entrada antes de leer estilos o sacar la captura.
  await new Promise((r) => setTimeout(r, 900));
  return p;
}

// Sólo la primera familia: la lista de respaldo (ui-monospace, sans-serif...) puede cambiar a propósito.
const IDX_FUENTE = 7;
const norm = (v) => v && v.split('|').map((x, i) => (i === IDX_FUENTE ? x.split(',')[0] : x)).join('|');

const cmd = process.argv[2];
try {
  mkdirSync(RAIZ, { recursive: true });
  if (cmd === 'recorrido') {
    const p = await abrir('hoy', 375, { cpu: 4 });
    const res = [];
    for (let i = 0; i < Number(process.env.CORRIDAS ?? 3); i++) res.push(await p.evaluate(() => window.recorrido()));
    // bloqueo = lo que cada frame largo pasa de 50 ms, sumado: mide cuánto, no sólo cuántos.
    console.log(JSON.stringify(res.map((r) => ({ largos: r.largos, peor: r.peor, bloqueo: r.frames.reduce((a, d) => a + Math.max(0, d - 50), 0), raf25: r.raf25, rafPeor: r.rafPeor }))));
  } else if (cmd === 'base' || cmd === 'comparar') {
    mkdirSync(`${RAIZ}/base`, { recursive: true });
    let total = 0;
    for (const vista of Object.keys(VISTAS)) {
      for (const ancho of ANCHOS) {
        const p = await abrir(vista, ancho);
        const dump = await p.evaluate(() => window.dumpEstilos());
        const nombres = await p.evaluate(() => window.PROPS_ESTILOS);
        const f = `${RAIZ}/base/${vista}-${ancho}.json`;
        if (cmd === 'base') { writeFileSync(f, JSON.stringify(dump)); total += Object.keys(dump).length; continue; }
        if (!existsSync(f)) { console.log(`${vista}@${ancho}: sin base (corré el modo base primero)`); await p.close(); continue; }
        const base = JSON.parse(readFileSync(f, 'utf8'));
        const dif = [];
        for (const k of new Set([...Object.keys(base), ...Object.keys(dump)])) {
          const a = norm(base[k]), b = norm(dump[k]);
          if (a === b) continue;
          const [va, vb] = [a?.split('|') ?? [], b?.split('|') ?? []];
          dif.push(`${k}: ` + (nombres.map((n, i) => (va[i] !== vb[i] ? `${n} ${va[i]} -> ${vb[i]}` : null)).filter(Boolean).join(' ; ') || 'elemento distinto'));
        }
        console.log(`${vista}@${ancho}: ${Object.keys(dump).length} elementos, ${dif.length} con diferencias`);
        dif.slice(0, 8).forEach((d) => console.log('  ' + d.slice(0, 260)));
        await p.close();
      }
    }
    if (cmd === 'base') console.log('base guardada,', total, 'entradas');
  } else if (cmd === 'capturas') {
    const dir = `${RAIZ}/cap/${process.argv[3]}`;
    mkdirSync(dir, { recursive: true });
    for (const vista of Object.keys(VISTAS)) for (const ancho of ANCHOS) {
      const p = await abrir(vista, ancho);
      // La vista casos es larga y el scroll vive en .cuerpo (la app mide 100dvh): se estira la ventana para verla entera.
      if (vista === 'casos') { await p.setViewport({ width: ancho, height: ancho < 600 ? 3600 : 2600, deviceScaleFactor: 1, isMobile: ancho < 600, hasTouch: ancho < 600 }); await new Promise((r) => setTimeout(r, 300)); }
      await p.screenshot({ path: `${dir}/${vista}-${ancho}.png` });
      await p.close();
    }
    console.log('capturas en', dir);
  } else if (cmd === 'contraste') {
    // El portal (landing) no entra: es negro siempre y no usa los roles de las pantallas.
    let hayFallas = false;
    const mostrar = (titulo, lista, n = 12) => {
      if (!lista.length) return;
      const linea = (x) => (typeof x === 'string' ? x : `${x.nodo} "${x.texto}" ${x.contraste}:1 (mín. ${x.minimo})`);
      console.log(`  ${titulo}:`);
      lista.slice(0, n).forEach((x) => console.log('    ' + linea(x)));
      if (lista.length > n) console.log(`    ... y ${lista.length - n} más`);
    };
    for (const vista of Object.keys(VISTAS).filter((v) => v !== 'landing')) {
      for (const ancho of ANCHOS) {
        const p = await abrir(vista, ancho);
        const r = await p.evaluate(medirVista, {});
        hayFallas ||= r.fallas.length + r.desbordes.length + r.toques.length > 0;
        console.log(`${vista}@${ancho}: ${r.medidos} textos medidos, ${r.fallas.length} de contraste, ${r.desbordes.length} desbordes, ${r.toques.length} toques < 44 px, ${r.sinMedir.length} sin medir`);
        mostrar('contraste', r.fallas); mostrar('desbordes', r.desbordes); mostrar('toques', r.toques);
        if (process.env.VER_SIN_MEDIR) mostrar('sin medir', r.sinMedir);
        await p.close();
      }
    }
    if (hayFallas) process.exitCode = 1;
  } else if (cmd === 'js') {
    const p = await abrir(process.argv[3], Number(process.argv[4]), { reducido: process.env.REDUCIDO === '1', cpu: Number(process.env.CPU ?? 1) });
    console.log(JSON.stringify(await p.evaluate(process.argv[5]), null, 1));
    if (process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA });
  }
} finally {
  await navegador.close();
}
