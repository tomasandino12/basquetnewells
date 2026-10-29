// Medición de contraste, desborde y toques para herramienta.mjs (modo `contraste`).
// `medirVista` se serializa y corre DENTRO de la página: no puede cerrar sobre nada de acá.
// Contraste: por cada nodo con texto, color del texto (con su opacidad) contra el fondo
// efectivo, que se arma subiendo por los ancestros hasta una capa opaca. Si lo que queda
// debajo es el fondo de la app, se mide contra el peor caso del patrón: tanto sobre el
// fondo liso como sobre el fondo con --patron-color encima (se queda con el más bajo).
export function medirVista({ minToque = 44 } = {}) {
  const lienzo = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  lienzo.canvas.width = lienzo.canvas.height = 1;
  const cache = new Map();
  // Los colores que devuelve el navegador pueden venir como rgb(), rgba() o color(srgb ...)
  // (color-mix): el canvas los normaliza a sRGB en 8 bits.
  function rgba(texto) {
    if (cache.has(texto)) return cache.get(texto);
    let r = null;
    const m = texto.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const n = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      r = { r: n[0], g: n[1], b: n[2], a: n[3] ?? 1 };
    } else {
      lienzo.clearRect(0, 0, 1, 1);
      lienzo.fillStyle = '#000';
      lienzo.fillStyle = texto;
      lienzo.fillRect(0, 0, 1, 1);
      const [rr, gg, bb, aa] = lienzo.getImageData(0, 0, 1, 1).data;
      r = { r: rr, g: gg, b: bb, a: aa / 255 };
    }
    cache.set(texto, r);
    return r;
  }
  const sobre = (arriba, abajo) => {
    const a = arriba.a + abajo.a * (1 - arriba.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const c = (k) => (arriba[k] * arriba.a + abajo[k] * abajo.a * (1 - arriba.a)) / a;
    return { r: c('r'), g: c('g'), b: c('b'), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  const raiz = getComputedStyle(document.documentElement);
  const patronTexto = raiz.getPropertyValue('--patron-color').trim();
  const patron = patronTexto && patronTexto !== 'transparent' ? rgba(patronTexto) : null;
  const fondoPagina = rgba(getComputedStyle(document.body).backgroundColor);
  const base = fondoPagina.a > 0 ? fondoPagina : rgba(getComputedStyle(document.documentElement).backgroundColor);

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || n.hidden) return false;
    }
    return true;
  };
  // Las capas de fondo de un elemento hacia arriba, hasta una opaca o hasta la página.
  function fondosDe(el) {
    const capas = [];
    let n = el instanceof SVGElement ? (el.closest('svg')?.parentElement ?? el.parentElement) : el;
    for (; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== 'none' && !/^none$/.test(cs.backgroundImage) && n !== document.body && n !== document.documentElement) {
        return { sinMedir: `fondo con imagen o degradé en ${n.tagName.toLowerCase()}.${String(n.className).split(' ')[0]}` };
      }
      const c = rgba(cs.backgroundColor);
      if (c.a > 0) capas.push(c);
      if (c.a >= 1) return { capas, opaco: true };
    }
    return { capas, opaco: false };
  }
  const opacidadEfectiva = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;

  const fallas = [];
  const sinMedir = [];
  let medidos = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
    const texto = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim();
    if (!texto || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const esSvg = el instanceof SVGElement;
    const colorTexto = rgba(esSvg ? cs.fill : cs.color);
    if (colorTexto.a === 0) continue;
    const f = fondosDe(el);
    if (f.sinMedir) { sinMedir.push(`${nombre(el)}: ${f.sinMedir}`); continue; }
    const o = opacidadEfectiva(el);
    const casos = [];
    // Fondo liso y, si hay patrón, fondo con patrón encima: el peor de los dos manda.
    const armar = (debajo) => f.capas.reduceRight((acc, c) => sobre(c, acc), debajo);
    casos.push(f.opaco ? armar({ r: 0, g: 0, b: 0, a: 0 }) : armar(base));
    if (!f.opaco && patron) casos.push(armar(sobre(patron, base)));
    let peor = Infinity;
    for (const fondo of casos) {
      const t = sobre({ ...colorTexto, a: colorTexto.a * o }, fondo);
      peor = Math.min(peor, contraste(t, fondo));
    }
    const px = parseFloat(cs.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    medidos++;
    if (peor < minimo) fallas.push({ nodo: nombre(el), texto: texto.slice(0, 30), contraste: Math.round(peor * 100) / 100, minimo });
  }

  // Desborde horizontal: la página en sí y cualquier elemento que se pase del borde sin un
  // contenedor que lo recorte o lo deslice.
  const desbordes = [];
  const ancho = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > ancho + 1) desbordes.push(`documento: scrollWidth ${document.documentElement.scrollWidth} > ${ancho}`);
  const recortado = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || el instanceof SVGElement) continue;
    const r = el.getBoundingClientRect();
    if (r.right > ancho + 1 && !recortado(el)) desbordes.push(`${nombre(el)}: right ${Math.round(r.right)} > ${ancho}`);
  }

  // Toques: lo que se aprieta con el dedo y mide menos de 44 px en algún lado. Un enlace
  // dentro de un párrafo queda exento (WCAG 2.5.8): el texto de corrido no es un blanco aparte.
  const toques = [];
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio]';
  for (const el of document.body.querySelectorAll(sel)) {
    if (!visible(el) || el.disabled) continue;
    if (el.tagName === 'A' && el.closest('p, li, .p, .ayuda, .nota')) continue;
    const r = el.getBoundingClientRect();
    // Un campo de 1×1 es el "sólo lector de pantalla" (.sr) de un input de archivo: el toque va en su etiqueta.
    if (r.width <= 1 && r.height <= 1) continue;
    if (r.width < minToque - 0.5 || r.height < minToque - 0.5) toques.push(`${nombre(el)}: ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { medidos, fallas, sinMedir, desbordes, toques };
}
