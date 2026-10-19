// Cartel con el QR del portal: un PNG del código y un PDF A4 listo para imprimir.
//
//   npm run cartel-qr                    → la dirección fija /consultas del portal
//   npm run cartel-qr -- <url> <salida>  → otra dirección u otra carpeta
//   npm run cartel-qr -- --final         → sin la franja de BORRADOR
//
// Por defecto el cartel sale como BORRADOR (franja roja arriba: "no imprimir
// hasta definir el dominio"). Con --final se la saca; sólo se usa cuando el
// dominio del portal ya es el definitivo.
//
// Sin dependencias: el QR sale de scripts/qr.mjs y el PDF se escribe a mano
// (vectorial, con la fuente Helvetica que todo lector de PDF trae). No es parte
// de la app: es una herramienta que se corre cuando hace falta imprimir.
//
// EL QR CODIFICA EL DOMINIO. Un cartel ya impreso apunta al dominio con que se
// generó: si más adelante el portal pasa a otro dominio, hay que volver a
// generarlo e imprimirlo. Conviene decidir el dominio definitivo antes.
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crearQr } from './qr.mjs';

export const URL_POR_DEFECTO = 'https://app-semillero.vercel.app/consultas';
export const FRASE = ['Escaneá y venite', 'a jugar al básquet'];
export const INSTRUCCION = 'Apuntá la cámara del celular al código';
export const AVISO_BORRADOR = 'BORRADOR · NO IMPRIMIR HASTA DEFINIR EL DOMINIO';
const PIE = 'Inferiores · Newell\'s Old Boys';
const MODULO_PNG = 24; // píxeles por módulo en el PNG
const MARGEN = 4; // módulos de zona de silencio, el mínimo que pide la norma

// Anchos (milésimas de em) de Helvetica y Helvetica-Bold, de PyMuPDF; sirven para centrar el texto.
const ANCHO_REG = {"0":556,"1":556,"2":556,"3":556,"4":556,"5":556,"6":556,"7":556,"8":556,"9":556," ":278,"!":278,"\"":355,"#":556,"$":556,"%":889,"&":667,"'":191,"(":333,")":333,"*":389,"+":584,",":278,"-":333,".":278,"/":278,":":278,";":278,"<":584,"=":584,">":584,"?":556,"@":1015,"A":667,"B":667,"C":722,"D":722,"E":667,"F":611,"G":778,"H":722,"I":278,"J":500,"K":667,"L":556,"M":833,"N":722,"O":778,"P":667,"Q":778,"R":722,"S":667,"T":611,"U":722,"V":667,"W":944,"X":667,"Y":667,"Z":611,"[":278,"\\":278,"]":278,"^":469,"_":556,"`":333,"a":556,"b":556,"c":500,"d":556,"e":556,"f":278,"g":556,"h":556,"i":222,"j":222,"k":500,"l":222,"m":833,"n":556,"o":556,"p":556,"q":556,"r":333,"s":500,"t":278,"u":556,"v":500,"w":722,"x":500,"y":500,"z":500,"{":334,"|":260,"}":334,"~":584,"á":556,"é":556,"í":278,"ó":556,"ú":556,"ñ":556,"Á":667,"É":667,"Í":278,"Ó":778,"Ú":722,"Ñ":722,"·":278};
const ANCHO_NEG = {"0":556,"1":556,"2":556,"3":556,"4":556,"5":556,"6":556,"7":556,"8":556,"9":556," ":278,"!":333,"\"":474,"#":556,"$":556,"%":889,"&":722,"'":238,"(":333,")":333,"*":389,"+":584,",":278,"-":333,".":278,"/":278,":":333,";":333,"<":584,"=":584,">":584,"?":611,"@":975,"A":722,"B":722,"C":722,"D":722,"E":667,"F":611,"G":778,"H":722,"I":278,"J":556,"K":722,"L":611,"M":833,"N":722,"O":778,"P":667,"Q":778,"R":722,"S":667,"T":611,"U":722,"V":667,"W":944,"X":667,"Y":667,"Z":611,"[":333,"\\":278,"]":333,"^":584,"_":556,"`":333,"a":556,"b":611,"c":556,"d":611,"e":556,"f":333,"g":611,"h":611,"i":278,"j":278,"k":556,"l":278,"m":889,"n":611,"o":611,"p":611,"q":611,"r":389,"s":556,"t":333,"u":611,"v":556,"w":778,"x":556,"y":556,"z":500,"{":389,"|":280,"}":389,"~":584,"á":556,"é":556,"í":278,"ó":611,"ú":611,"ñ":611,"Á":722,"É":667,"Í":278,"Ó":778,"Ú":722,"Ñ":722,"·":278};

/* ---------- PNG ---------- */

const TABLA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozoPng(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** PNG en escala de grises de 8 bits: negro sobre blanco, con la zona de silencio. */
export function pngDelQr(qr, modulo = MODULO_PNG, margen = MARGEN) {
  const lado = (qr.tamano + 2 * margen) * modulo;
  const filas = Buffer.alloc((lado + 1) * lado, 0xff);
  for (let y = 0; y < lado; y++) {
    filas[y * (lado + 1)] = 0; // sin filtro
    const my = Math.floor(y / modulo) - margen;
    for (let x = 0; x < lado; x++) {
      const mx = Math.floor(x / modulo) - margen;
      if (my >= 0 && my < qr.tamano && mx >= 0 && mx < qr.tamano && qr.modulos[my][mx]) filas[y * (lado + 1) + 1 + x] = 0;
    }
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0); cabecera.writeUInt32BE(lado, 4);
  cabecera[8] = 8; cabecera[9] = 0; // 8 bits, escala de grises
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozoPng('IHDR', cabecera), trozoPng('IDAT', deflateSync(filas, { level: 9 })), trozoPng('IEND', Buffer.alloc(0)),
  ]);
}

/** Lee un PNG RGBA de 8 bits sin entrelazar (el escudo) → { ancho, alto, rgb, alfa }. */
export function leerPngRgba(buf) {
  if (buf.toString('latin1', 1, 4) !== 'PNG') throw new Error('No es un PNG.');
  const ancho = buf.readUInt32BE(16); const alto = buf.readUInt32BE(20);
  if (buf[24] !== 8 || buf[25] !== 6 || buf[28] !== 0) throw new Error('Sólo se lee PNG RGBA de 8 bits sin entrelazar.');
  const partes = [];
  for (let i = 8; i < buf.length;) {
    const largo = buf.readUInt32BE(i);
    if (buf.toString('latin1', i + 4, i + 8) === 'IDAT') partes.push(buf.subarray(i + 8, i + 8 + largo));
    i += 12 + largo;
  }
  const crudo = inflateSync(Buffer.concat(partes));
  const paso = ancho * 4;
  const px = Buffer.alloc(alto * paso);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (paso + 1)];
    for (let x = 0; x < paso; x++) {
      const actual = crudo[y * (paso + 1) + 1 + x];
      const a = x >= 4 ? px[y * paso + x - 4] : 0; // izquierda
      const b = y > 0 ? px[(y - 1) * paso + x] : 0; // arriba
      const c = x >= 4 && y > 0 ? px[(y - 1) * paso + x - 4] : 0; // arriba a la izquierda
      let previo = 0;
      if (filtro === 1) previo = a;
      else if (filtro === 2) previo = b;
      else if (filtro === 3) previo = (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        previo = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * paso + x] = (actual + previo) & 0xff;
    }
  }
  const rgb = Buffer.alloc(ancho * alto * 3); const alfa = Buffer.alloc(ancho * alto);
  for (let i = 0; i < ancho * alto; i++) {
    rgb[i * 3] = px[i * 4]; rgb[i * 3 + 1] = px[i * 4 + 1]; rgb[i * 3 + 2] = px[i * 4 + 2];
    alfa[i] = px[i * 4 + 3];
  }
  return { ancho, alto, rgb, alfa };
}

/* ---------- PDF ---------- */

const A4 = [595, 842];
const NEGRO_CLUB = '0.0745 0.0745 0.0863'; // #131316
const ROJO_CLUB = '0.851 0.0706 0.1804'; // #D9122E
const GRIS_SOBRE_OSCURO = '0.663 0.647 0.627'; // #A9A5A0
const GRIS_TEXTO = '0.35 0.35 0.37';

const anchoDe = (texto, tabla, tamano) => [...texto].reduce((s, ch) => s + (tabla[ch] ?? 556), 0) * tamano / 1000;
const escapar = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
const num = (n) => (Math.round(n * 100) / 100).toString();

/** Una línea de texto centrada (Helvetica o Helvetica-Bold, WinAnsi). El tamaño baja si no entra en `maximo`. */
function lineaCentrada(texto, { fuente, y, tamano, color, maximo = 520 }) {
  const tabla = fuente === 'F1' ? ANCHO_NEG : ANCHO_REG;
  const real = Math.min(tamano, tamano * maximo / anchoDe(texto, tabla, tamano));
  const x = (A4[0] - anchoDe(texto, tabla, real)) / 2;
  return `BT /${fuente} ${num(real)} Tf ${color} rg ${num(x)} ${num(y)} Td (${escapar(texto)}) Tj ET\n`;
}

/** El contenido de la página: franja oscura con el escudo, la frase, el QR vectorial y la dirección. */
export function contenidoDelCartel(qr, url, { borrador = true } = {}) {
  const lado = 330;
  const modulo = lado / (qr.tamano + 2 * MARGEN);
  const x0 = (A4[0] - lado) / 2; const y0 = 118;
  let c = '';
  // Franja superior y filete rojo.
  c += `${NEGRO_CLUB} rg 0 592 ${A4[0]} 250 re f\n${ROJO_CLUB} rg 0 584 ${A4[0]} 8 re f\n`;
  c += `q 120 0 0 120 ${num((A4[0] - 120) / 2)} 692 cm /Escudo Do Q\n`;
  c += lineaCentrada('BÁSQUET · NEWELL\'S OLD BOYS', { fuente: 'F1', y: 650, tamano: 14, color: GRIS_SOBRE_OSCURO });
  // Franja de borrador: se ve al toque en una prueba impresa y en la pantalla.
  if (borrador) {
    c += `${ROJO_CLUB} rg 0 818 ${A4[0]} 24 re f\n`;
    c += lineaCentrada(AVISO_BORRADOR, { fuente: 'F1', y: 826, tamano: 12, color: '1 1 1' });
  }
  // La frase.
  c += lineaCentrada(FRASE[0], { fuente: 'F1', y: 520, tamano: 46, color: NEGRO_CLUB });
  c += lineaCentrada(FRASE[1], { fuente: 'F1', y: 468, tamano: 46, color: ROJO_CLUB });
  // El QR: un solo trazo con todos los módulos oscuros, en negro puro para que lea bien.
  c += `0 0 0 rg\n`;
  for (let y = 0; y < qr.tamano; y++) {
    for (let x = 0; x < qr.tamano; x++) {
      if (qr.modulos[y][x]) c += `${num(x0 + (x + MARGEN) * modulo)} ${num(y0 + (qr.tamano - 1 - y + MARGEN) * modulo)} ${num(modulo)} ${num(modulo)} re\n`;
    }
  }
  c += 'f\n';
  c += lineaCentrada(INSTRUCCION, { fuente: 'F2', y: 96, tamano: 15, color: GRIS_TEXTO });
  c += lineaCentrada(url, { fuente: 'F1', y: 66, tamano: 22, color: NEGRO_CLUB });
  c += lineaCentrada(PIE, { fuente: 'F2', y: 28, tamano: 10, color: GRIS_TEXTO });
  return c;
}

/** Arma el PDF: catálogo, página, contenido, dos fuentes estándar y el escudo con su transparencia. */
export function pdfDelCartel(qr, url, escudo, opciones = {}) {
  const objetos = [];
  const agregar = (cuerpo) => { objetos.push(cuerpo); return objetos.length; };
  const flujo = (diccionario, datos) => Buffer.concat([
    Buffer.from(`<< ${diccionario} /Length ${datos.length} >>\nstream\n`, 'latin1'), datos, Buffer.from('\nendstream', 'latin1')]);

  const contenido = Buffer.from(contenidoDelCartel(qr, url, opciones), 'latin1');
  agregar(Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'));
  agregar(Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'latin1'));
  agregar(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Escudo 7 0 R >> >> >>`, 'latin1'));
  agregar(flujo('', contenido));
  agregar(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', 'latin1'));
  agregar(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1'));
  agregar(flujo(`/Type /XObject /Subtype /Image /Width ${escudo.ancho} /Height ${escudo.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask 8 0 R /Filter /FlateDecode`, deflateSync(escudo.rgb)));
  agregar(flujo(`/Type /XObject /Subtype /Image /Width ${escudo.ancho} /Height ${escudo.alto} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, deflateSync(escudo.alfa)));

  const partes = [Buffer.from('%PDF-1.4\n%âãÏÓ\n', 'latin1')];
  const posiciones = [];
  let largo = partes[0].length;
  objetos.forEach((cuerpo, i) => {
    posiciones.push(largo);
    const bloque = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), cuerpo, Buffer.from('\nendobj\n', 'latin1')]);
    partes.push(bloque);
    largo += bloque.length;
  });
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posiciones) xref += `${String(p).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`;
  partes.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(partes);
}

/* ---------- Programa ---------- */

export function generarCartel(url, carpeta, raiz, opciones = {}) {
  if (!/^https:\/\/[^\s"<>]+$/.test(url)) throw new Error(`La dirección tiene que empezar con https:// y no llevar espacios: ${url}`);
  const qr = crearQr(url);
  const escudo = leerPngRgba(readFileSync(path.join(raiz, 'public', 'escudo.png')));
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(path.join(carpeta, 'qr-consultas.png'), pngDelQr(qr));
  writeFileSync(path.join(carpeta, 'cartel-consultas-A4.pdf'), pdfDelCartel(qr, url, escudo, opciones));
  return { qr, carpeta };
}

/** Argumentos de la línea de comandos: [url] [carpeta] [--final]. Sin --final, el cartel es un borrador. */
export function leerArgumentos(argv, raiz) {
  const posicionales = argv.filter((a) => !a.startsWith('--'));
  return {
    url: posicionales[0] ?? URL_POR_DEFECTO,
    carpeta: path.resolve(posicionales[1] ?? path.join(raiz, 'docs', 'cartel-qr')),
    borrador: !argv.includes('--final'),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { url, carpeta, borrador } = leerArgumentos(process.argv.slice(2), raiz);
  const { qr } = generarCartel(url, carpeta, raiz, { borrador });
  console.log(`QR de ${url}: versión ${qr.version} (${qr.tamano}x${qr.tamano} módulos).`);
  console.log(`Escribí qr-consultas.png y cartel-consultas-A4.pdf en ${carpeta}`);
  if (borrador) console.log('El cartel salió como BORRADOR (no imprimir hasta definir el dominio); con --final se saca la franja.');
}
