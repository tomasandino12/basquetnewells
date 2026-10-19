import { LIMITE } from './limites.js';
import { enlaceFormulario } from './portal.js';

/*
 * Lógica pura de los formularios del portal que carga la coordinación (spec
 * 2026-10-18-portal-v2-design.md §3): validar lo que escribe, y subir o bajar
 * un formulario en la lista. Sin red, sin DOM.
 *
 * Lo que sale de acá termina en una tarjeta de la página pública, que ve
 * cualquiera. Por eso el enlace sólo pasa si es de Google Forms (la base lo
 * vuelve a exigir con un check), y el texto no es un campo libre sin límite.
 */

export const MENSAJE_ENLACE_FORMULARIO = 'El enlace tiene que ser de Google Forms (empieza con https://docs.google.com/forms o https://forms.gle).';

const recortar = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Lo que escribió la coordinación → el formulario a guardar, o el primer
 * error. El texto es obligatorio a propósito: es la línea que le dice a la
 * familia para qué es y qué tiene que tener a mano antes de abrirlo.
 */
export function validarFormulario({ titulo, texto, enlace } = {}) {
  const t = recortar(titulo);
  if (!t) return { error: 'Escribí el título del formulario.', formulario: null };
  if (t.length > LIMITE.titulo) return { error: `El título es muy largo: hasta ${LIMITE.titulo} letras.`, formulario: null };

  const x = recortar(texto);
  if (!x) return { error: 'Contá para qué es y qué tienen que tener a mano las familias.', formulario: null };
  if (x.length > LIMITE.textoFormulario) {
    return { error: `El texto es muy largo: hasta ${LIMITE.textoFormulario} letras.`, formulario: null };
  }

  const e = recortar(enlace);
  if (e.length > LIMITE.enlace || !enlaceFormulario(e)) return { error: MENSAJE_ENLACE_FORMULARIO, formulario: null };

  return { error: null, formulario: { titulo: t, texto: x, enlace: e } };
}

/** Una copia ordenada por `orden`; a igual orden, por título, así el resultado no depende de cómo llegó la lista. */
export function ordenarFormularios(lista) {
  return [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.titulo ?? '').localeCompare(String(b.titulo ?? ''), 'es'));
}

/**
 * Sube o baja un formulario un lugar y deja los órdenes en 1..n sin huecos ni
 * repetidos (también arregla una lista que ya venía rota). Devuelve la lista
 * nueva y sólo los { id, orden } que cambiaron: es lo único que hay que
 * guardar en la base.
 *
 * Primero sube y último baja no cambian nada; un id que no existe tampoco.
 */
export function moverFormulario(lista, id, direccion) {
  const antes = ordenarFormularios(lista);
  const nueva = [...antes];
  const i = nueva.findIndex((f) => f.id === id);
  const j = direccion === 'subir' ? i - 1 : i + 1;
  if (i !== -1 && j >= 0 && j < nueva.length) [nueva[i], nueva[j]] = [nueva[j], nueva[i]];

  const resultado = nueva.map((f, k) => ({ ...f, orden: k + 1 }));
  const ordenNuevo = new Map(resultado.map((f) => [f.id, f.orden]));
  const cambios = antes.filter((f) => f.orden !== ordenNuevo.get(f.id)).map((f) => ({ id: f.id, orden: ordenNuevo.get(f.id) }));
  return { lista: resultado, cambios };
}

/** Fila de formulario_portal → objeto de dominio, para el panel de coordinación. */
export function formularioDesdeFila(f) {
  return {
    id: f.id,
    titulo: f.titulo,
    texto: f.texto,
    enlace: f.enlace,
    orden: f.orden,
    activo: f.activo,
    actualizadoPor: f.actualizado_por,
    actualizadoEn: f.actualizado_en,
  };
}

/** Lo único que devuelve formularios_publicos(): lo que ve cualquiera. */
export function formularioPublicoDesdeFila(f) {
  return { titulo: f.titulo, texto: f.texto, enlace: f.enlace };
}
