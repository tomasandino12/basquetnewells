/* Relieve de curvas de nivel dorado para la banda «Recaudación» de la portada.
   Es un adorno: va en los costados vacíos y se apaga hacia el texto (en el celular,
   en la esquina de arriba a la derecha). Canvas 2D sin librerías. Se frena fuera de
   pantalla y con la pestaña oculta, queda quieto con «reducir movimiento» o ahorro
   de datos, y baja la resolución solo si el equipo no da. Archivo externo: la CSP no
   admite scripts en línea. */
(() => {
  const host = document.getElementById('recaudacion');
  if (!host) return;

  // ---------- Ruido simplex 3D (Stefan Gustavson, dominio público) ----------
  const G = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  (function semilla(s) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    let a = s >>> 0;
    const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  })(1903);
  const F3 = 1 / 3, G3 = 1 / 6;
  function noise3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0*x0 - y0*y0 - z0*z0; if (tt > 0) { g = G[pm12[ii + perm[jj + perm[kk]]]]; tt *= tt; n += tt * tt * (g[0]*x0 + g[1]*y0 + g[2]*z0); }
    tt = 0.6 - x1*x1 - y1*y1 - z1*z1; if (tt > 0) { g = G[pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; tt *= tt; n += tt * tt * (g[0]*x1 + g[1]*y1 + g[2]*z1); }
    tt = 0.6 - x2*x2 - y2*y2 - z2*z2; if (tt > 0) { g = G[pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; tt *= tt; n += tt * tt * (g[0]*x2 + g[1]*y2 + g[2]*z2); }
    tt = 0.6 - x3*x3 - y3*y3 - z3*z3; if (tt > 0) { g = G[pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; tt *= tt; n += tt * tt * (g[0]*x3 + g[1]*y3 + g[2]*z3); }
    return 32 * n;
  }

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tactil = window.matchMedia('(pointer: coarse)');
  const ahorroDatos = !!(navigator.connection && navigator.connection.saveData);
  const CONTENIDO = 1024; // ancho máximo del contenido de la portada (64rem)

  function aRgba(hex, a) {
    const h = hex.trim().replace('#', '');
    if (h.length !== 6) return `rgba(242,179,61,${a})`;
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
  }

  class Topo {
    constructor(el) {
      this.host = el;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'topo';
      this.canvas.setAttribute('aria-hidden', 'true');
      el.prepend(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.on = false; this.visible = false; this.running = false;
      this.t = 3.7; this.last = 0;
      this.px = 0; this.py = 0; this.tx = 0; this.ty = 0; this.s = 0; this.target = 0; this.hasPointer = false;
      this.scale = 0.0034; this.step = 0.1; this.radius = 110;
      // celular: menos resolución, menos cuadros y menos píxeles por punto
      this.mobile = tactil.matches || window.innerWidth < 760;
      this.baseCell = this.mobile ? 14 : 10;
      this.cell = this.baseCell;
      this.interval = this.mobile ? 42 : 33; // 24 o 30 cuadros por segundo
      this.dprCap = this.mobile ? 1.5 : 2;
      this.times = [];

      new ResizeObserver(() => this.resize()).observe(el);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }).observe(el);

      const mover = (e) => {
        if (reducido.matches) return;
        const r = el.getBoundingClientRect();
        this.tx = e.clientX - r.left; this.ty = e.clientY - r.top;
        if (!this.hasPointer || this.s < 0.02) { this.px = this.tx; this.py = this.ty; }
        this.hasPointer = true; this.target = 1;
        clearTimeout(this.touchTimer);
      };
      el.addEventListener('pointermove', mover);
      el.addEventListener('pointerdown', mover);
      el.addEventListener('pointerleave', () => { this.target = 0; });
      const soltar = (e) => { if (e.pointerType !== 'mouse') this.touchTimer = setTimeout(() => { this.target = 0; }, 900); };
      el.addEventListener('pointerup', soltar);
      el.addEventListener('pointercancel', soltar);
    }
    leerColores() {
      const cs = getComputedStyle(this.host);
      this.cBase = cs.getPropertyValue('--oro-base').trim() || 'rgba(242,179,61,.15)';
      this.cIndex = cs.getPropertyValue('--oro-index').trim() || 'rgba(242,179,61,.32)';
      this.cHot = cs.getPropertyValue('--oro-hot').trim() || '#FFCF6E';
    }
    disposicion() {
      // ¿Hay costados de verdad? Si el contenido ocupa casi todo el ancho, va a la esquina.
      const lado = (this.w - CONTENIDO) / 2;
      const modo = lado < 110 ? 'esquina' : 'costados';
      this.efectivo = modo;
      this.host.classList.toggle('m-costados', modo === 'costados');
      this.host.classList.toggle('m-esquina', modo === 'esquina');
      const fade = Math.max(0, lado + 40);
      this.host.style.setProperty('--fade', fade + 'px');
      // lo que la máscara tapa no se calcula
      if (modo === 'costados') { this.skipA = fade + this.cell; this.skipB = this.w - fade - this.cell; }
      else { this.skipA = -1; this.skipB = -1; this.cornerR = Math.hypot(this.w, this.h) * 0.72; }
      this.on = true;
    }
    resize() {
      const r = this.host.getBoundingClientRect();
      this.w = Math.max(1, Math.round(r.width)); this.h = Math.max(1, Math.round(r.height));
      const mobile = tactil.matches || this.w < 760;
      if (mobile !== this.mobile) {
        this.mobile = mobile; this.baseCell = mobile ? 14 : 10; this.cell = this.baseCell;
        this.interval = mobile ? 42 : 33; this.dprCap = mobile ? 1.5 : 2; this.times = [];
      }
      this.dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
      this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
      this.grilla();
      this.leerColores();
      this.disposicion();
      this.dibujar();
      this.sync();
    }
    grilla() {
      this.cols = Math.ceil(this.w / this.cell) + 1; this.rows = Math.ceil(this.h / this.cell) + 1;
      this.v = new Float32Array(this.cols * this.rows);
      this.need = new Uint8Array(this.cols * this.rows);
    }
    get animado() { return !reducido.matches && !ahorroDatos; }
    sync() {
      const debe = this.on && this.visible && !document.hidden && this.animado;
      if (debe && !this.running) {
        this.running = true; this.last = performance.now();
        const tick = (now) => {
          if (!this.running) return;
          this.raf = requestAnimationFrame(tick);
          if (now - this.last < this.interval) return;
          const dt = Math.min(now - this.last, 100); this.last = now;
          this.t += dt * 0.000045;
          this.px += (this.tx - this.px) * 0.14; this.py += (this.ty - this.py) * 0.14;
          this.s += (this.target - this.s) * 0.07;
          const t0 = performance.now();
          this.dibujar();
          this.medir(performance.now() - t0);
        };
        this.raf = requestAnimationFrame(tick);
      } else if (!debe && this.running) {
        this.running = false; cancelAnimationFrame(this.raf);
      }
    }
    medir(ms) {
      this.times.push(ms);
      if (this.times.length < 20) return;
      const prom = this.times.reduce((a, b) => a + b, 0) / this.times.length;
      this.times = [];
      // si el equipo no da, baja la resolución sola; si sobra, la sube hasta la base
      if (prom > 7 && this.cell < 22) { this.cell += 4; this.grilla(); this.disposicion(); }
      else if (prom < 2 && this.cell > this.baseCell) { this.cell = Math.max(this.baseCell, this.cell - 2); this.grilla(); this.disposicion(); }
    }
    campo() {
      const { cols, rows, cell, scale, v, need, t, s, px, py, radius, skipA, skipB } = this;
      const k2 = 1 / (2 * radius * radius), lift = 0.9 * s;
      const esquina = this.efectivo === 'esquina', cr2 = esquina ? this.cornerR * this.cornerR : 0, W = this.w;
      for (let j = 0; j < rows; j++) {
        const y = j * cell;
        for (let i = 0; i < cols; i++) {
          const x = i * cell, idx = j * cols + i;
          let usa = !(skipA >= 0 && x > skipA && x < skipB);
          if (usa && esquina) { const dx = W - x; usa = dx * dx + y * y < cr2; }
          need[idx] = usa ? 1 : 0;
          if (!usa) continue;
          let n = noise3(x * scale, y * scale, t) * 0.8 + noise3(x * scale * 2.3 + 31, y * scale * 2.3 - 17, t * 1.4) * 0.22;
          if (lift > 0.002) { const dx = x - px, dy = y - py; n += lift * Math.exp(-(dx * dx + dy * dy) * k2); }
          v[idx] = n;
        }
      }
    }
    dibujar() {
      if (!this.v || !this.on) return;
      this.campo();
      const { ctx, cols, rows, cell, v, need, step } = this;
      const base = new Path2D(), index = new Path2D();
      for (let j = 0; j < rows - 1; j++) {
        const y0 = j * cell, y1 = y0 + cell;
        for (let i = 0; i < cols - 1; i++) {
          const ia = j * cols + i, ib = ia + 1, id = ia + cols, ic = id + 1;
          if (!(need[ia] && need[ib] && need[ic] && need[id])) continue;
          const a = v[ia], b = v[ib], c = v[ic], d = v[id];
          const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
          const k0 = Math.ceil(lo / step), k1 = Math.floor(hi / step);
          if (k1 < k0) continue;
          const x0 = i * cell, x1 = x0 + cell;
          for (let k = k0; k <= k1; k++) {
            const l = k * step;
            const code = (a > l ? 8 : 0) | (b > l ? 4 : 0) | (c > l ? 2 : 0) | (d > l ? 1 : 0);
            if (code === 0 || code === 15) continue;
            const p = (k % 5 === 0) ? index : base;
            const T = () => [x0 + cell * (l - a) / (b - a), y0];
            const R = () => [x1, y0 + cell * (l - b) / (c - b)];
            const B = () => [x0 + cell * (l - d) / (c - d), y1];
            const L = () => [x0, y0 + cell * (l - a) / (d - a)];
            const seg = (P, Q) => { const p1 = P(), p2 = Q(); p.moveTo(p1[0], p1[1]); p.lineTo(p2[0], p2[1]); };
            switch (code) {
              case 1: case 14: seg(L, B); break;
              case 2: case 13: seg(B, R); break;
              case 3: case 12: seg(L, R); break;
              case 4: case 11: seg(T, R); break;
              case 6: case 9: seg(T, B); break;
              case 7: case 8: seg(L, T); break;
              case 5: seg(T, R); seg(L, B); break;
              case 10: seg(L, T); seg(B, R); break;
            }
          }
        }
      }
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = 1;
      ctx.lineWidth = 1; ctx.strokeStyle = this.cBase; ctx.stroke(base);
      ctx.lineWidth = 1.5; ctx.strokeStyle = this.cIndex; ctx.stroke(index);
      if (this.s > 0.01) {
        const g = ctx.createRadialGradient(this.px, this.py, 0, this.px, this.py, this.radius * 2.4);
        g.addColorStop(0, aRgba(this.cHot, 0.9));
        g.addColorStop(1, aRgba(this.cHot, 0));
        ctx.globalAlpha = this.s; ctx.strokeStyle = g;
        ctx.lineWidth = 1.1; ctx.stroke(base);
        ctx.lineWidth = 1.6; ctx.stroke(index);
        ctx.globalAlpha = 1;
      }
    }
  }

  const relieve = new Topo(host);
  document.addEventListener('visibilitychange', () => relieve.sync());
  if (reducido.addEventListener) reducido.addEventListener('change', () => { relieve.sync(); relieve.dibujar(); });
})();
