/*
 * Datos de emergencia del chico: lógica pura, sin red ni DOM.
 * Spec: docs/superpowers/specs/2026-10-19-datos-conectados-design.md §3.
 */

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
