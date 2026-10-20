/*
 * Datos de emergencia del chico: lógica pura, sin red ni DOM.
 * Spec: docs/superpowers/specs/2026-10-19-datos-conectados-design.md §3.
 */
import { clavearNombre } from '../parser/parserCabb.js';
import { LIMITE } from './limites.js';

// Las casillas de "¿Ha sufrido alguna de estas afecciones?" del formulario
// del club, con el código que guarda la base. El mismo orden y los mismos
// códigos que el check de 0059: tests/contratoEmergencia.test.js los compara.
export const AFECCIONES = [
  ['desmayos', 'Desmayos'],
  ['taquicardia', 'Taquicardia'],
  ['convulsiones', 'Convulsiones'],
  ['epilepsia', 'Epilepsia'],
  ['meningitis', 'Meningitis'],
  ['diabetes', 'Diabetes'],
  ['perdida_conocimiento', 'Pérdida de conocimiento traumática'],
  ['asma', 'Asma'],
];


const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '').replace(/\s+/g, ' ').trim();
const CODIGO_POR_ETIQUETA = new Map([
  ...AFECCIONES.map(([codigo, etiqueta]) => [sinAcentos(etiqueta), codigo]),
  // Forms puede cortar la etiqueta larga al exportar.
  ['perdida de conocimiento', 'perdida_conocimiento'],
]);

/**
 * Lo que exporta Forms en una pregunta de casillas ("Desmayos, Asma") → los
 * códigos de la lista cerrada, sin repetidos. Lo que no está en la lista no
 * se guarda: se devuelve en `desconocidas` para avisar.
 */
export function leerAfecciones(texto) {
  const alertas = [];
  const desconocidas = [];
  for (const parte of String(texto ?? '').split(/[,;]/).map(sinAcentos).filter(Boolean)) {
    const codigo = CODIGO_POR_ETIQUETA.get(parte);
    if (!codigo) desconocidas.push(parte);
    else if (!alertas.includes(codigo)) alertas.push(codigo);
  }
  return { alertas, desconocidas };
}

/** Recorta al límite de la base. Devuelve { texto, recortado }; '' → null. */
export function recortar(texto, limite) {
  const t = String(texto ?? '').trim();
  if (!t) return { texto: null, recortado: false };
  return t.length <= limite ? { texto: t, recortado: false } : { texto: t.slice(0, limite).trim(), recortado: true };
}

// Las palabras del nombre sin importar el orden: la familia escribe
// "Pérez Juan" o "Juan Pérez" y la CABB "PEREZ, JUAN".
const palabras = (nombre) => clavearNombre(String(nombre ?? '')).split(' ').filter(Boolean).sort().join(' ');

/**
 * Filas del parser + los chicos del plantel ([{ id, nombreLimpio, fechaNacimiento }])
 * → lo que se manda a importar_emergencias. Cruza por las palabras del nombre
 * y la fecha de nacimiento (si el chico no tiene fecha cargada, alcanza el
 * nombre). Nunca crea chicos: lo que no cruza va a `sinCruzar` con el motivo.
 */
export function cruzarEmergencias(filas, jugadores) {
  const porNombre = new Map();
  for (const j of jugadores) {
    const k = palabras(j.nombreLimpio);
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(j);
  }
  const cruzadas = [];
  const sinCruzar = [];
  const advertencias = [];
  for (const f of filas) {
    const candidatos = (porNombre.get(palabras(f.nombre)) ?? [])
      .filter((j) => !j.fechaNacimiento || j.fechaNacimiento === f.fechaNacimiento);
    if (candidatos.length !== 1) {
      sinCruzar.push({
        fila: f.fila,
        nombre: f.nombre,
        motivo: candidatos.length ? 'hay dos chicos que coinciden' : 'no hay nadie con ese nombre y esa fecha en este plantel',
      });
      continue;
    }
    const { alertas, desconocidas } = leerAfecciones(f.afecciones);
    if (desconocidas.length) advertencias.push(`fila ${f.fila}: afección que no está en la lista, no se guarda (${desconocidas.join(', ')}). Revisala en la planilla.`);
    const campos = {
      telefonoAdulto: recortar(f.telefonoAdulto, LIMITE.telefono),
      contactoUrgencia: recortar(f.contactoUrgencia, LIMITE.contactoUrgencia),
      alergias: recortar(f.alergias, LIMITE.textoSalud),
      medicacion: recortar(f.medicacion, LIMITE.textoSalud),
      indicacion: recortar(f.indicacion, LIMITE.textoSalud),
      obraSocial: recortar(f.obraSocial, LIMITE.obraSocial),
    };
    const largos = Object.entries(campos).filter(([, c]) => c.recortado).map(([nombre]) => nombre);
    if (largos.length) advertencias.push(`fila ${f.fila}: texto demasiado largo, se recortó (${largos.join(', ')}). Revisalo en la planilla.`);
    cruzadas.push({
      fila: f.fila,
      jugadorId: candidatos[0].id,
      nombreLimpio: candidatos[0].nombreLimpio,
      alertas,
      ...Object.fromEntries(Object.entries(campos).map(([k, c]) => [k, c.texto])),
    });
  }
  return { cruzadas, sinCruzar, advertencias };
}

/** Las filas que se mandan a importar_emergencias. */
export function filasParaImportarEmergencias(cruzadas) {
  return cruzadas.map(({ jugadorId, telefonoAdulto, contactoUrgencia, alertas, alergias, medicacion, indicacion, obraSocial }) => (
    { jugadorId, telefonoAdulto, contactoUrgencia, alertas, alergias, medicacion, indicacion, obraSocial }));
}
