import { ultimaMedicion, ultimaMedicionPorJugador } from '@datos/antropometria.js';
import {
  compararPorcentajes,
  contarPorDebajo,
  jugadoresDeZona,
  serieDeZonas,
  totalDeZonas,
  zonasDelFoco,
  zonasDeSesion,
} from '@datos/estadisticas.js';
import { alcanzaMeta, metaDeZona, resumenDeMetas } from '@datos/objetivosClub.js';
import { LIBRES, POSICIONES } from '@datos/posiciones.js';
import type { JugadorDelPlantel, MedicionCorporal, MedicionTiro, MetasDeZona, SesionMedicion } from '../datos/repositorio';

/** Un porcentaje con su denominador: ningún número se muestra sin cuántos tiros hay detrás. */
export interface Valor {
  pct: number;
  anotados: number;
  intentos: number;
  muestraChica: boolean;
}

export interface Variacion {
  pp: number;
  margen: number | null;
  concluyente: boolean;
}

export interface Zona {
  id: string;
  nombre: string;
  /** Nombre corto para la cancha. */
  corto: string;
  valor: Valor | null;
  meta: number | null;
  /** null si llegó o no hay meta o dato: sin meta no se juzga. */
  llegoALaMeta: boolean | null;
  /** Contra la batería anterior; null si no hay con qué comparar (nunca un cero con flecha). */
  variacion: Variacion | null;
  /** 0 (crema, va bien) a 4 (naranja intenso, la más floja). null si no se midió. */
  calor: number | null;
}

export interface PuntoDeCurva {
  fecha: string;
  valor: Valor;
}

export type Resumen =
  | { tipo: 'sin-baterias' }
  | { tipo: 'sin-mediciones'; fecha: string }
  | {
      tipo: 'completo';
      fecha: string;
      fechaAnterior: string | null;
      jugadoresQueMidieron: number;
      total: Valor | null;
      totalVariacion: Variacion | null;
      metas: { alcanzadas: number; conMeta: number } | null;
      /** De peor a mejor porcentaje, no por posición en cancha; las sin medir van al final. */
      zonas: Zona[];
      libres: Zona;
      foco: { zonas: Zona[]; concluyente: boolean } | null;
      /** Sólo con foco concluyente y meta fijada: quiénes están por debajo, como puerta a la lista. */
      porDebajo: { cantidad: number; total: number; jugadores: { id: string; nombre: string; valor: Valor }[]; zona: Zona } | null;
      serie: PuntoDeCurva[];
      corporal: { ultimaFecha: string | null; sinMedir: number; total: number } | null;
    };

/**
 * La escala de calor es relativa a lo medido en la batería: la zona con peor porcentaje es la más
 * intensa y la mejor, la más clara. Si todas dan igual no hay una que resaltar: todas quedan claras.
 */
export function calorDeZonas(pcts: (number | null)[]): (number | null)[] {
  const medidos = pcts.filter((p): p is number => p !== null);
  if (!medidos.length) return pcts.map(() => null);
  const mejor = Math.max(...medidos);
  const peor = Math.min(...medidos);
  return pcts.map((p) => (p === null ? null : mejor === peor ? 0 : Math.round(((mejor - p) / (mejor - peor)) * 4)));
}

/** La pantalla Hoy se arma sola con lo que haya: el piloto arranca sin una sola medición. */
export function armarResumen(datos: {
  sesiones: SesionMedicion[];
  mediciones: MedicionTiro[];
  jugadores: JugadorDelPlantel[] | null;
  corporales: MedicionCorporal[] | null;
  metas: MetasDeZona;
}): Resumen {
  const { sesiones, mediciones, jugadores, corporales, metas } = datos;
  const sesionesTiro = sesiones.filter((s) => s.tipo === 'tiro').sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!sesionesTiro.length) return { tipo: 'sin-baterias' };

  const actual = sesionesTiro[0];
  const anterior = sesionesTiro[1] ?? null;
  const { porZona, jugadoresQueMidieron }: { porZona: Record<string, Valor>; jugadoresQueMidieron: number } = zonasDeSesion(mediciones, actual.id);
  const zonasAnterior: Record<string, Valor> = anterior ? zonasDeSesion(mediciones, anterior.id).porZona : {};

  const armar = (def: { id: string; nombre: string; corto: string }): Zona => {
    const valor: Valor | null = porZona[def.id] ?? null;
    const meta: number | null = metaDeZona(def.id, metas);
    return {
      id: def.id,
      nombre: def.nombre,
      corto: def.corto,
      valor,
      meta,
      llegoALaMeta: alcanzaMeta(valor, meta),
      variacion: compararPorcentajes(valor, zonasAnterior[def.id] ?? null),
      calor: null,
    };
  };

  const libres = armar(LIBRES);
  const delArco = POSICIONES.map(armar);
  if (!delArco.some((z) => z.valor) && !libres.valor) return { tipo: 'sin-mediciones', fecha: actual.fecha };

  // Los libres entran en la misma escala de color que el arco (lo pidió Tomás el 08/11): así se
  // comparan de un vistazo en la cancha. El porcentaje sigue aparte, nunca sumado al del arco.
  const calores = calorDeZonas([...delArco, libres].map((z) => z.valor?.pct ?? null));
  libres.calor = calores[delArco.length];
  const zonas = delArco
    .map((z, i) => ({ ...z, calor: calores[i] }))
    .sort((a, b) => {
      if (!a.valor) return 1;
      if (!b.valor) return -1;
      return a.valor.pct - b.valor.pct;
    });

  const idsArco = POSICIONES.map((z: { id: string }) => z.id);
  const total: Valor | null = totalDeZonas(porZona, idsArco);

  // Se señala una sola zona como «la más floja» sólo si se separa del resto más que el margen de
  // error; con las muestras reales varias suelen ser indistinguibles y elegir una es inventar.
  const focoBruto: { zonas: string[]; concluyente: boolean } | null = zonasDelFoco(zonas);
  const foco = focoBruto && {
    concluyente: focoBruto.concluyente,
    zonas: focoBruto.zonas.map((id) => zonas.find((z) => z.id === id)!),
  };

  const zonaDelFoco = foco?.concluyente ? foco.zonas[0] : null;
  const delFoco: { jugadorId: string; valor: Valor }[] = zonaDelFoco ? jugadoresDeZona(mediciones, actual.id, zonaDelFoco.id) : [];
  const cantidad: number | null = zonaDelFoco ? contarPorDebajo(delFoco, zonaDelFoco.meta) : null;

  let corporal: { ultimaFecha: string | null; sinMedir: number; total: number } | null = null;
  if (jugadores && corporales) {
    const porJugador: Map<string, MedicionCorporal> = ultimaMedicionPorJugador(corporales);
    const delPlantel = jugadores.map((j) => porJugador.get(j.id)).filter(Boolean);
    corporal = {
      ultimaFecha: ultimaMedicion(delPlantel)?.fechaMedicion ?? null,
      sinMedir: jugadores.filter((j) => !porJugador.has(j.id)).length,
      total: jugadores.length,
    };
  }

  return {
    tipo: 'completo',
    fecha: actual.fecha,
    fechaAnterior: anterior?.fecha ?? null,
    jugadoresQueMidieron,
    total,
    totalVariacion: compararPorcentajes(total, totalDeZonas(zonasAnterior, idsArco)),
    metas: resumenDeMetas(zonas),
    zonas,
    libres,
    foco,
    porDebajo:
      zonaDelFoco && cantidad !== null
        ? {
            cantidad,
            total: delFoco.length,
            zona: zonaDelFoco,
            // Los nombres vienen de la lista del plantel; si no cargó, cada uno figura como «Jugador».
            jugadores: delFoco.map((j) => ({
              id: j.jugadorId,
              nombre: jugadores?.find((x) => x.id === j.jugadorId)?.nombreLimpio ?? 'Jugador',
              valor: j.valor,
            })),
          }
        : null,
    // Una batería anterior da una comparación; seis dan una serie. El margen invalida el salto
    // entre dos puntos, no mirar todos los puntos.
    serie: serieDeZonas(sesiones, mediciones, idsArco),
    corporal,
  };
}

/** 'YYYY-MM-DD' → 'DD/MM'. A mano: new Date('2026-05-01') es UTC y se corre un día. */
export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}
