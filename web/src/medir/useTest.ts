import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSesion, useCargarRepositorio } from '../datos/contexto';
import { useJugadoresDeAsistencia } from '../datos/consultas';
import { mensajeDeGuardado } from '../datos/errores';
import type { JugadorDelPlantel, PayloadDeMedicion } from '../datos/repositorio';
import { borrarBorrador, claveBorrador, guardarBorrador, hoyLocal, leerBorrador, NOMBRE_DE_TEST, type TipoDeTest } from './sesiones';

export type Valores<V> = Record<string, V | undefined>;

export interface EstadoDeTest<V, E extends Record<string, unknown>> {
  fecha: string;
  valores: Valores<V>;
  sesionId: string;
  extra: E;
}

interface Opciones<V, E extends Record<string, unknown>> {
  clubId: string;
  plantelId: string;
  tipo: TipoDeTest;
  /** Lo propio del test (testSalto, distanciaM) a partir del borrador; valida lo que viene del celular. */
  extraInicial: (borrador: Record<string, unknown> | null) => E;
  /** Arreglos de borradores de antes (el sprint guardaba sólo el total). */
  normalizar?: (valores: Valores<V>) => Valores<V>;
  /** El payload de prepararPayloadMedicion.js. */
  payload: (estado: EstadoDeTest<V, E>) => PayloadDeMedicion;
  /** Qué dice el aviso si no hay nada que guardar. */
  vacio: string;
}

const nuevoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/**
 * Lo que comparten los cuatro tests: el borrador del celular (el mismo formato y la misma clave que la
 * app de siempre, escrito en cada toque y borrado sólo cuando la base confirma) y el guardado, que
 * reusa el sesionId en cada reintento para que una respuesta perdida sin señal no duplique la sesión.
 */
export function useTest<V, E extends Record<string, unknown>>({ clubId, plantelId, tipo, extraInicial, normalizar, payload, vacio }: Opciones<V, E>) {
  const { sesion } = useSesion();
  const usuarioId = sesion?.user.id;
  // La clave se fija al abrir: si el profe cambia de categoría con el guardado en vuelo, no se borra otro borrador.
  const clave = useMemo(() => claveBorrador(usuarioId, clubId, plantelId, tipo), [usuarioId, clubId, plantelId, tipo]);

  const [estado, setEstado] = useState<EstadoDeTest<V, E>>(() => {
    const b = leerBorrador(clave);
    const valores = (b?.valores ?? {}) as Valores<V>;
    return {
      fecha: b?.fecha ?? hoyLocal(),
      valores: normalizar ? normalizar(valores) : valores,
      sesionId: typeof b?.sesionId === 'string' ? b.sesionId : nuevoId(),
      extra: extraInicial(b as Record<string, unknown> | null),
    };
  });
  const actual = useRef(estado);
  actual.current = estado;

  const cambiar = useCallback((cambio: (e: EstadoDeTest<V, E>) => EstadoDeTest<V, E>) => {
    const nuevo = cambio(actual.current);
    actual.current = nuevo;
    guardarBorrador(clave, { fecha: nuevo.fecha, valores: nuevo.valores as Record<string, Record<string, unknown>>, sesionId: nuevo.sesionId, ...nuevo.extra });
    setEstado(nuevo);
  }, [clave]);

  const ponerValor = useCallback((jugadorId: string, valor: V | undefined) => cambiar((e) => {
    const valores = { ...e.valores };
    if (valor === undefined) delete valores[jugadorId];
    else valores[jugadorId] = valor;
    return { ...e, valores };
  }), [cambiar]);

  /** Empezar de cero (Repetir del Yo-Yo): el borrador se borra y la sesión es otra. */
  const reiniciar = useCallback(() => {
    borrarBorrador(clave);
    const nuevo = { ...actual.current, valores: {}, sesionId: nuevoId() };
    actual.current = nuevo;
    setEstado(nuevo);
  }, [clave]);

  const [aviso, setAviso] = useState<string | null>(null);
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  const navegar = useNavigate();
  const guardado = useMutation({
    mutationFn: async (p: PayloadDeMedicion) => (await cargar()).guardarSesionMedicion(p),
    onSuccess: async () => {
      borrarBorrador(clave);
      await Promise.all([
        consultas.invalidateQueries({ queryKey: ['medir'] }),
        consultas.invalidateQueries({ queryKey: ['hoy'] }),
        consultas.invalidateQueries({ queryKey: ['datos'] }),
        consultas.invalidateQueries({ queryKey: ['plantel'] }),
      ]);
      navegar('/medir', { state: { guardada: NOMBRE_DE_TEST[tipo] } });
    },
    // El borrador NO se toca: es lo único que tiene el profe si esto falló con el gimnasio sin señal.
    onError: (e) => setAviso(mensajeDeGuardado(e, 'No se pudo guardar la sesión. Quedó en el celular para reintentar.')),
  });

  const guardar = useCallback(() => {
    if (guardado.isPending) return;
    const p = payload(actual.current);
    if (!p.mediciones.length) {
      setAviso(vacio);
      return;
    }
    setAviso(null);
    guardado.mutate(p);
  }, [guardado, payload, vacio]);

  return { estado, cambiar, ponerValor, reiniciar, guardar, guardando: guardado.isPending, aviso, setAviso };
}

/** Los chicos de la categoría por nombre, como en la app de siempre. */
export function useJugadoresParaMedir(clubId: string, plantelId: string) {
  const q = useJugadoresDeAsistencia(clubId, plantelId);
  const ordenados = useMemo(
    () => (q.data ? [...q.data].sort((a: JugadorDelPlantel, b: JugadorDelPlantel) => a.nombreLimpio.localeCompare(b.nombreLimpio)) : undefined),
    [q.data],
  );
  return { ...q, data: ordenados } as typeof q;
}
