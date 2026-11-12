import { Check, CircleDashed, Target, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ESTADOS, textoDeMision, textoDelValor, totalesDelEquipo, valorReal, vincularPrevias } from '@datos/misiones.js';
import { LIMITE } from '@datos/limites.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { useDatosDeMisiones, useEstadisticasDeMisiones, useEvaluarMisiones } from '../datos/consultasJugador';
import { mensajeDeGuardado } from '../datos/errores';
import type { JugadorDelPlantel, MisionDePrevia, PartidoDelPlantel, PreviaCompleta, PreviaDelPlantel } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { usePlantelId } from '../plantel/activo';
import { ConPlantel } from './ConPlantel';

type Estado = 'logrado' | 'en_proceso' | 'no_logrado';
type Evaluacion = { estado: Estado | null; comentario: string };
type Fuente = Record<string, unknown> | null | undefined;

// La señal de cada estado no es sólo el color: lleva palabra y un ícono.
const ICONO = { logrado: Check, en_proceso: CircleDashed, no_logrado: X } as const;

const fechaLarga = (iso: string) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};

/**
 * Evaluar las misiones de un partido (las de equipo y las de cada jugador). El profe decide cómo salió cada una:
 * el número real del partido es una ayuda, la app no marca nada sola. Es una pantalla del cuerpo técnico, no del jugador.
 */
export function MisionesPartido() {
  const { previaId } = useParams();
  const plantelId = usePlantelId();
  return (
    <ConPlantel plantelId={plantelId} volver={{ a: '/hoy', texto: 'Hoy' }} soloCuerpoTecnico="Las misiones las evalúa el cuerpo técnico.">
      {(p) => <Evaluar clubId={p.clubId} plantelId={p.plantelId} previaId={previaId!} />}
    </ConPlantel>
  );
}

function Evaluar({ clubId, plantelId, previaId }: { clubId: string; plantelId: string; previaId: string }) {
  const datos = useDatosDeMisiones(clubId, plantelId, previaId);
  return (
    <div className="pt-2 pb-8">
      <Consulta consulta={datos} errorGenerico="No se pudieron cargar las misiones">
        {({ previa, previas, partidos, jugadores }) =>
          previa ? (
            <Formulario key={previa.id} previa={previa} previas={previas} partidos={partidos} jugadores={jugadores} plantelId={plantelId} />
          ) : (
            <Vacio icono={Target} titulo="No hay misiones para evaluar">Esa previa no existe o ya no es de tu categoría.</Vacio>
          )
        }
      </Consulta>
    </div>
  );
}

interface FormularioProps {
  previa: PreviaCompleta;
  previas: PreviaDelPlantel[];
  partidos: PartidoDelPlantel[];
  jugadores: JugadorDelPlantel[];
  plantelId: string;
}

function Formulario({ previa, previas, partidos, jugadores, plantelId }: FormularioProps) {
  const irA = useNavigate();
  const guardar = useEvaluarMisiones();

  const vinculo = useMemo(
    () => (vincularPrevias(previas.map((p) => ({ ...p })), partidos.map((p) => ({ id: p.id, fecha: p.fecha, rivalNombre: p.rivalNombre, plantelId }))) as Map<string, { partidoId: string | null; motivo: string }>).get(previa.id),
    [previas, partidos, previa.id, plantelId],
  );
  // Partidos que ya son de otras misiones: no se ofrecen.
  const ocupados = useMemo(() => new Set(previas.filter((p) => p.id !== previa.id && p.partidoId).map((p) => p.partidoId)), [previas, previa.id]);

  const [partidoId, setPartidoId] = useState<string | null>(vinculo?.partidoId ?? null);
  const [motivo, setMotivo] = useState(vinculo?.motivo ?? 'sin_partido');
  const [eligiendo, setEligiendo] = useState((vinculo?.partidoId ?? null) === null);
  const [evaluaciones, setEvaluaciones] = useState<Map<string, Evaluacion>>(
    () => new Map([...previa.misionesJugador, ...previa.misionesEquipo].map((m) => [m.id, { estado: m.estado, comentario: m.comentario ?? '' }])),
  );
  const [error, setError] = useState<string | null>(null);

  const estadisticas = useEstadisticasDeMisiones(partidoId);
  // Si los datos de ese partido no se pueden leer, se vuelve a elegir (no se evalúa contra un partido que no se vio).
  useEffect(() => {
    if (estadisticas.isError) {
      setPartidoId(null);
      setEligiendo(true);
      setError(mensajeDeGuardado(estadisticas.error, 'No se pudieron cargar los datos de ese partido.'));
    }
  }, [estadisticas.isError, estadisticas.error]);

  const filas = (estadisticas.data ?? []) as { jugadorId: string }[];
  const totales = useMemo(() => totalesDelEquipo(filas), [filas]);
  const partido = partidos.find((p) => p.id === partidoId) ?? null;
  const nombreDe = (id: string | null | undefined) => jugadores.find((j) => j.id === id)?.nombreLimpio ?? '';

  const porJugador = new Map<string, MisionDePrevia[]>();
  for (const m of previa.misionesJugador) porJugador.set(m.jugadorId ?? '', [...(porJugador.get(m.jugadorId ?? '') ?? []), m]);
  const sinMisiones = previa.misionesJugador.length === 0 && previa.misionesEquipo.length === 0;

  const cambiar = (id: string, cambio: Partial<Evaluacion>) =>
    setEvaluaciones((prev) => new Map(prev).set(id, { ...prev.get(id)!, ...cambio }));

  const alGuardar = () => {
    setError(null);
    const tipos = [...previa.misionesJugador.map((m) => [m.id, 'jugador'] as const), ...previa.misionesEquipo.map((m) => [m.id, 'equipo'] as const)];
    guardar.mutate(
      {
        previaId: previa.id,
        partidoId,
        evaluaciones: tipos.map(([id, tipo]) => {
          const ev = evaluaciones.get(id)!;
          return { tipo, id, estado: ev.estado, comentario: ev.estado ? ev.comentario.trim() || null : null };
        }),
      },
      {
        onSuccess: () => irA(-1),
        onError: (e) =>
          setError(
            mensajeDeGuardado(e, 'No se pudo guardar la evaluación.', [
              [/PARTIDO_YA_VINCULADO/, 'Ese partido ya es de otras misiones. Elegí otro.'],
              [/PARTIDO_DE_OTRO_PLANTEL/, 'Ese partido es de otra categoría.'],
              [/SIN_PERMISO/, 'No tenés permiso para evaluar misiones en esta categoría.'],
            ]),
          ),
      },
    );
  };

  const tarjeta = (m: MisionDePrevia, titulo: string, fuente: Fuente) => {
    const real = valorReal(m, fuente, partido) as number | null;
    const valor = textoDelValor(m, real) as string | null;
    return (
      <MisionTarjeta
        key={m.id}
        mision={m}
        titulo={titulo}
        valor={valor}
        sinDato={real == null}
        evaluacion={evaluaciones.get(m.id)!}
        alCambiar={(c) => cambiar(m.id, c)}
      />
    );
  };

  return (
    <>
      <header>
        <p className="font-mono text-xs tracking-wide text-gris uppercase">
          Misiones · {fechaLarga(previa.fecha)}{previa.rival ? ` · ${previa.rival}` : ''}
        </p>
        <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Evaluar misiones</h1>
        <p className="mt-2 text-sm text-gris">Vos decidís cómo salió cada misión: el número es una ayuda, la app no marca nada sola.</p>
      </header>

      <div className="mt-4">
        {partido && !eligiendo ? (
          <div className="rounded-tarjeta border border-linea bg-sup px-4 py-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-semibold break-words">{partido.rivalNombre ?? 'Rival sin nombre'}</span>
              <span className="font-mono text-xs text-gris">{fechaLarga(partido.fecha)}</span>
            </p>
            <p className="text-sm text-gris">
              {partido.puntosPropios != null && partido.puntosRival != null ? `${partido.puntosPropios}–${partido.puntosRival}` : 'Sin marcador'}
            </p>
            {motivo !== 'fijado' && (
              <p className="mt-1 text-sm text-gris">Lo encontramos por la fecha{motivo === 'rival' ? ' y el rival' : ''}. Si no es este, cambialo.</p>
            )}
            <Boton variante="contorno" tamano="chico" className="mt-2" onClick={() => setEligiendo(true)}>Cambiar partido</Boton>
          </div>
        ) : (
          <ElegirPartido
            partidos={partidos.filter((x) => !ocupados.has(x.id))}
            ambiguo={motivo === 'ambiguo'}
            alElegir={(id) => {
              setPartidoId(id);
              setMotivo('manual');
              setEligiendo(false);
              setError(null);
            }}
          />
        )}
      </div>

      {partidoId && estadisticas.isPending && <p role="status" className="mt-3 text-sm text-gris">Cargando los números del partido…</p>}

      {sinMisiones ? (
        <Vacio icono={Target} titulo="Esta previa no tiene misiones">Cuando se carguen las misiones del partido, las evaluás acá.</Vacio>
      ) : (
        <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
          {previa.misionesEquipo.length > 0 && (
            <section aria-label="Equipo" className="flex flex-col gap-3">
              <h2 className="font-titulo text-2xl leading-none font-semibold">Equipo</h2>
              {previa.misionesEquipo.map((m) => tarjeta(m, 'Objetivo de equipo', totales as Fuente))}
            </section>
          )}
          {porJugador.size > 0 && (
            <section aria-label="Jugadores" className="flex flex-col gap-3">
              <h2 className="font-titulo text-2xl leading-none font-semibold">Jugadores</h2>
              {[...porJugador.entries()]
                .sort((a, b) => nombreDe(a[0]).localeCompare(nombreDe(b[0]), 'es'))
                .flatMap(([jugadorId, lista]) => lista.map((m) => tarjeta(m, nombreDe(jugadorId), filas.find((e) => e.jugadorId === jugadorId))))}
            </section>
          )}
        </div>
      )}

      {error && <Aviso tono="error" titulo={error} className="mt-4" />}
      {!sinMisiones && (
        <div className="mt-6">
          <Boton onClick={alGuardar} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar evaluación'}</Boton>
        </div>
      )}
    </>
  );
}

function ElegirPartido({ partidos, ambiguo, alElegir }: { partidos: PartidoDelPlantel[]; ambiguo: boolean; alElegir: (id: string) => void }) {
  return (
    <div className="rounded-tarjeta border border-linea bg-sup px-4 py-3">
      <h2 className="font-semibold">¿De qué partido son estas misiones?</h2>
      {partidos.length > 0 ? (
        <>
          <p className="mb-2 text-sm text-gris">
            {ambiguo ? 'Hay más de un partido posible. ' : ''}Elegí el partido para ver cuánto hizo cada uno. Podés evaluar igual sin elegirlo.
          </p>
          <ul className="flex flex-col gap-2">
            {partidos.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => alElegir(x.id)}
                  className="flex min-h-11 w-full items-baseline justify-between gap-3 rounded-tarjeta border border-linea px-3 py-2 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                >
                  <span className="font-semibold break-words">{x.rivalNombre ?? 'Rival sin nombre'}</span>
                  <span className="font-mono text-xs text-gris">{fechaLarga(x.fecha)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gris">Todavía no cargaste el partido. Podés evaluar igual: va a decir «sin dato» donde falte el número.</p>
      )}
    </div>
  );
}

function MisionTarjeta({ mision, titulo, valor, sinDato, evaluacion, alCambiar }: {
  mision: MisionDePrevia;
  titulo: string;
  valor: string | null;
  sinDato: boolean;
  evaluacion: Evaluacion;
  alCambiar: (c: Partial<Evaluacion>) => void;
}) {
  const texto = textoDeMision(mision) as string;
  return (
    <div className="flex flex-col gap-2 rounded-tarjeta border border-linea bg-sup px-4 py-3">
      <p className="font-mono text-xs tracking-wide text-gris uppercase">{titulo}</p>
      <p className="font-semibold break-words">{texto}</p>
      {valor && <p className={cn('font-mono text-sm', sinDato && 'text-gris')}>{valor}</p>}
      <div role="group" aria-label={`Cómo salió: ${texto}`} className="flex flex-wrap gap-2">
        {(ESTADOS as { id: Estado; nombre: string }[]).map((e) => {
          const Icono = ICONO[e.id];
          const activo = evaluacion.estado === e.id;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={activo}
              // Tocar el estado elegido lo desmarca: se pudo errar el botón.
              onClick={() => alCambiar({ estado: activo ? null : e.id })}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-btn border px-3 text-sm font-semibold outline-offset-2 transition-colors duration-[var(--dur-1)] focus-visible:outline-2 focus-visible:outline-tinta',
                activo ? 'border-tinta bg-tinta text-sup' : 'border-borde-control [@media(hover:hover)]:hover:border-tinta',
              )}
            >
              <Icono aria-hidden className="size-4" />
              {e.nombre}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gris">Comentario (opcional)</span>
        <input
          type="text"
          autoComplete="off"
          maxLength={LIMITE.comentarioMision}
          value={evaluacion.comentario}
          onChange={(e) => alCambiar({ comentario: e.target.value })}
          className="min-h-11 rounded-campo border border-borde-control bg-fondo px-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
        />
      </label>
    </div>
  );
}
