/*
 * Asistente de cambio de temporada: a qué plantel nuevo pasa cada chico.
 * Lógica pura, sin red ni DOM. La regla de categorías está en categorias.js.
 * Spec: docs/superpowers/specs/2026-10-19-datos-conectados-design.md §1.
 */
import { categoriaPorNacimiento, ramaDeCodigos } from './categorias.js';

export const NO_SIGUE = 'no_sigue';
export const DESPUES = 'despues';

/**
 * chicos: [{ jugadorId, nombreLimpio, anioNacimiento, codigos }] (lo que
 * devuelve pases_de_temporada); plantelesNuevos: [{ id, categoriaCodigo }] de
 * la temporada `anio`. Devuelve cada chico con `propuesto` (id de plantel o
 * null) y, si es null, `motivo` para que el coordinador sepa por qué decide él.
 * Sólo se usa el año: la regla no mira el día de cumpleaños.
 */
export function proponerPases(chicos, plantelesNuevos, anio) {
  const porCodigo = new Map(plantelesNuevos.map((p) => [p.categoriaCodigo, p.id]));
  return chicos.map((c) => {
    const base = { ...c, propuesto: null };
    if (c.anioNacimiento == null) return { ...base, motivo: 'Sin fecha de nacimiento' };
    const rama = ramaDeCodigos(c.codigos);
    const r = categoriaPorNacimiento(`${c.anioNacimiento}-01-01`, anio, rama, [...porCodigo.keys()]);
    if (!r.codigo) {
      const motivo = !rama ? 'No se sabe si es masculino o femenino' : `Le toca ${nombreGrupo(r.grupo)}: ${r.motivo}`;
      return { ...base, grupo: r.grupo, motivo };
    }
    return { ...base, grupo: r.grupo, propuesto: porCodigo.get(r.codigo), sube: !c.codigos.includes(r.codigo) };
  });
}

function nombreGrupo(grupo) {
  if (grupo === 'ESCUELITA') return 'Escuelita';
  if (grupo === 'MAYORES') return 'Mayores';
  return grupo ?? 'otra categoría';
}

/**
 * Agrupa los pases para mostrarlos: primero los que decide el coordinador
 * ("Para decidir"), después un grupo por plantel en el orden de `planteles`.
 */
export function agruparPases(pases, planteles) {
  const grupos = [{ plantelId: null, filas: pases.filter((p) => !p.propuesto) }];
  for (const pl of planteles) grupos.push({ plantelId: pl.id, filas: pases.filter((p) => p.propuesto === pl.id) });
  return grupos.filter((g) => g.filas.length);
}

/**
 * elecciones: [{ jugadorId, eleccion }] con eleccion = id de plantel,
 * NO_SIGUE o DESPUES → las filas de confirmar_pases. "Después" no se manda:
 * el chico queda en su plantel viejo y vuelve a aparecer la próxima vez.
 */
export function filasParaConfirmar(elecciones) {
  return elecciones
    .filter((e) => e.eleccion && e.eleccion !== DESPUES)
    .map((e) => ({ jugadorId: e.jugadorId, plantelId: e.eleccion === NO_SIGUE ? null : e.eleccion }));
}
