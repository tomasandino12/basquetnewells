import { edadEnAnios, vigentePorJugador } from '@datos/antropometria.js';
import { asistenciaDelJugador } from '@datos/asistencia.js';
import { ultimaBateriaConDatosDeJugador } from '@datos/estadisticas.js';
import { LIBRES, POSICIONES } from '@datos/posiciones.js';
import type {
  Entrenamiento,
  EstadoAsistencia,
  JugadorDelPlantel,
  Lesion,
  MedicionCorporal,
  MedicionTiro,
  SesionMedicion,
} from '../datos/repositorio';

export interface ZonaDeTiro {
  id: string;
  corto: string;
  pct: number | null;
  anotados: number | null;
  intentos: number | null;
}

export interface FilaPlantel {
  id: string;
  apellido: string;
  nombre: string;
  iniciales: string;
  edad: number | null;
  nacimiento: string | null;
  alturaCm: number | null;
  pesoKg: number | null;
  /** Porcentaje de la última batería de arco (sin libres); null si nunca tiró. */
  tiroPct: number | null;
  /** Zonas de la última batería con datos, y la fecha de esa sesión. */
  bateria: { fecha: string; zonas: ZonaDeTiro[]; libres: ZonaDeTiro | null } | null;
  asistenciaPct: number | null;
  nivel: 'excelente' | 'regular' | 'alerta' | null;
  entrenados: number;
  asistidos: number;
  justificadas: number;
  lesion: Lesion | null;
  /** Lo que se marcó hoy; null = todavía no se tomó. */
  hoy: EstadoAsistencia | null;
}

export interface EntradaFilas {
  jugadores: JugadorDelPlantel[];
  mediciones: MedicionCorporal[];
  entrenamientos: Entrenamiento[];
  lesiones: Lesion[];
  sesiones: SesionMedicion[];
  tiro: MedicionTiro[];
  hoy: string;
}

type Porcentaje = { pct: number; anotados: number; intentos: number } | null | undefined;

// Sin tildes y en minúscula, para que «ramirez» encuentre «Ramírez».
export const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «Pérez, Ana» → apellido y nombre; sin coma, todo es apellido. */
export function partirNombre(nombreLimpio: string): { apellido: string; nombre: string } {
  const [apellido = '', ...resto] = nombreLimpio.split(',');
  return { apellido: apellido.trim(), nombre: resto.join(',').trim() };
}

function zona(m: Porcentaje, id: string, corto: string): ZonaDeTiro {
  return { id, corto, pct: m?.pct ?? null, anotados: m?.anotados ?? null, intentos: m?.intentos ?? null };
}

/** Todo lo que la lista y la ficha muestran de cada chico, armado con la lógica pura de la app. */
export function armarFilas(e: EntradaFilas): FilaPlantel[] {
  const corporales = vigentePorJugador(e.mediciones);
  const diaDeHoy = e.entrenamientos.find((t) => t.fecha === e.hoy);

  return e.jugadores
    .map((j): FilaPlantel => {
      const { apellido, nombre } = partirNombre(j.nombreLimpio);
      const asistencia = asistenciaDelJugador(e.entrenamientos, e.lesiones, j.id);
      const pct = asistencia.resumen.pctAsistencia as number | null;
      const bat = ultimaBateriaConDatosDeJugador(e.sesiones, e.tiro, j.id);
      const porPosicion = (bat?.porPosicion ?? {}) as Record<string, Porcentaje>;
      const zonas: ZonaDeTiro[] = bat
        ? (POSICIONES as { id: string; corto: string }[]).map((p) => zona(porPosicion[p.id], p.id, p.corto))
        : [];
      const anotados = zonas.reduce((s, z) => s + (z.anotados ?? 0), 0);
      const intentos = zonas.reduce((s, z) => s + (z.intentos ?? 0), 0);
      const medidas = corporales.get(j.id) as Record<'alturaCm' | 'pesoKg', { valor: number } | null> | undefined;
      return {
        id: j.id,
        apellido,
        nombre,
        iniciales: ((apellido[0] ?? '') + (nombre[0] ?? '')).toUpperCase() || '?',
        edad: edadEnAnios(j.fechaNacimiento) as number | null,
        nacimiento: j.fechaNacimiento,
        alturaCm: medidas?.alturaCm?.valor ?? null,
        pesoKg: medidas?.pesoKg?.valor ?? null,
        tiroPct: intentos > 0 ? Math.round((anotados / intentos) * 100) : null,
        bateria: bat
          ? {
              fecha: bat.fecha as string,
              zonas,
              libres: porPosicion[LIBRES.id] ? zona(porPosicion[LIBRES.id], LIBRES.id, LIBRES.corto) : null,
            }
          : null,
        asistenciaPct: pct === null ? null : Math.round(pct),
        nivel: pct === null ? null : (asistencia.nivel as FilaPlantel['nivel']),
        entrenados: asistencia.resumen.total,
        asistidos: asistencia.resumen.asistidos,
        justificadas: asistencia.resumen.justificadas,
        lesion: asistencia.lesionAbierta as Lesion | null,
        hoy: diaDeHoy?.filas.find((f) => f.jugadorId === j.id)?.estado ?? null,
      };
    })
    .sort((a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Busca por nombre o apellido, sin tildes ni mayúsculas. */
export function buscarEnFilas(filas: FilaPlantel[], texto: string): FilaPlantel[] {
  const q = plano(texto.trim());
  return q ? filas.filter((f) => plano(`${f.apellido} ${f.nombre}`).includes(q)) : filas;
}

/** Los tres botones de la ficha y el estado que guardan: Avisó es la falta justificada. */
export const ESTADO_DE_BOTON = { presente: 'presente', avisó: 'justificada', faltó: 'ausente' } as const;
