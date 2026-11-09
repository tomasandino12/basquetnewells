import { ChevronLeft, ChevronRight, Dumbbell, Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePlantelId } from '../plantel/activo';
import {
  claveDeEjercicio, fechaLocal, formatearKg, nuevoPeso, parsearPeso, pasoDeLinea, pesoSugeridoDeCarga,
} from '@datos/escalones.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import {
  useEntrenamientoDelDia,
  useEscalonesActuales,
  useGuardarPaso,
  useJugadoresDeAsistencia,
  useMoverEscalon,
  usePasos,
  usePlanFisico,
} from '../datos/consultas';
import { mensajeDeError } from '../datos/errores';
import type { EscalonActual, JugadorDelPlantel, LineaFisico, PasoFuerza } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { detalleChico, fechaCorta, nombreCorto, tituloDeSesion, vecinos } from '../fisico/plan';
import { ConPlantel } from './ConPlantel';

/**
 * Un ejercicio por vez: cuánto sube o baja por vez (el escalón, uno para todo el club) y con cuánto peso
 * trabaja hoy cada chico. El profe escribe el peso, sube y baja; la app nunca propone un peso ni mueve a
 * nadie sola. Cada toque es un movimiento guardado en el momento. En el código el dato se llama `paso`;
 * en pantalla dice «escalón», que es la palabra del profe.
 */
export function FisicoEscalones() {
  const { planId, sesionId, lineaId } = useParams();
  const plantelId = usePlantelId();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: `/fisico/plan/${planId}/sesion/${sesionId}`, texto: 'Sesión' }}
      soloCuerpoTecnico="La coordinación ve el plan de fuerza en la app anterior."
    >
      {(p) => <Ejercicio {...p} planId={planId!} sesionId={sesionId!} lineaId={lineaId!} />}
    </ConPlantel>
  );
}

interface Props {
  clubId: string;
  plantelId: string;
  categoria: string;
  planId: string;
  sesionId: string;
  lineaId: string;
}

function Ejercicio({ clubId, plantelId, categoria, planId, sesionId, lineaId }: Props) {
  const sesiones = usePlanFisico(planId);
  const base = `/fisico/plan/${planId}/sesion/${sesionId}`;
  return (
    <Consulta consulta={sesiones} errorGenerico="No se pudo cargar el ejercicio">
      {(lista) => {
        const sesion = lista.find((s) => s.id === sesionId);
        const linea = sesion?.lineas.find((l) => l.id === lineaId);
        if (!sesion || !linea) {
          return (
            <Vacio icono={Dumbbell} titulo="No encontramos ese ejercicio" accion={<Link to={base} className="text-sm font-semibold underline">Volver a la sesión</Link>}>
              Puede que el plan se haya cambiado. Volvé a la sesión y elegí el ejercicio de nuevo.
            </Vacio>
          );
        }
        return (
          <Cuerpo
            key={linea.id}
            clubId={clubId}
            plantelId={plantelId}
            categoria={categoria}
            linea={linea}
            lineas={sesion.lineas}
            fecha={sesion.fecha}
            base={base}
          />
        );
      }}
    </Consulta>
  );
}

type Edicion = { tipo: 'peso'; jugador: JugadorDelPlantel; actual: EscalonActual | null } | { tipo: 'paso' } | null;

function Cuerpo({ clubId, plantelId, categoria, linea, lineas, fecha, base }: {
  clubId: string; plantelId: string; categoria: string; linea: LineaFisico; lineas: LineaFisico[]; fecha: string; base: string;
}) {
  const hoy = fechaLocal() as string;
  const jugadores = useJugadoresDeAsistencia(clubId, plantelId);
  const pasos = usePasos(clubId);
  const ordenados = useMemo(
    () => jugadores.data && [...jugadores.data].sort((a, b) => a.nombreLimpio.localeCompare(b.nombreLimpio, 'es')),
    [jugadores.data],
  );
  const paso = pasos.data ? (pasoDeLinea(linea.nombreOriginal, pasos.data) as PasoFuerza | null) : undefined;
  const ids = useMemo(() => ordenados?.map((j) => j.id), [ordenados]);
  const escalones = useEscalonesActuales(pasos.data ? (paso?.id ?? undefined) : undefined, pasos.data ? ids : undefined);
  // «Ausente» sólo cuenta si la sesión es de hoy y el profe ya tomó asistencia; si no se puede leer, no se muestra.
  const asistencia = useEntrenamientoDelDia(plantelId, hoy);

  const clave = claveDeEjercicio(linea.nombreOriginal) as string;
  const mover = useMoverEscalon(clubId, clave, linea.nombreOriginal);
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion>(null);

  const { indice, anterior, siguiente } = vecinos(lineas, linea.id);
  const ausentes = new Set(
    fecha === hoy ? (asistencia.data?.filas ?? []).filter((f) => f.estado !== 'presente').map((f) => f.jugadorId) : [],
  );

  // Guarda en el momento. Mientras escribe, la fila no responde; si falla queda lo que estaba.
  const moverA = async (jugadorId: string, kg: number) => {
    setAviso(null);
    setOcupados((o) => new Set(o).add(jugadorId));
    try {
      await mover.mutateAsync({ jugadorId, kg, paso: paso ?? null });
    } catch (e) {
      setAviso(mensajeDeError(e, 'No se pudo guardar el peso. Intentá de nuevo.'));
    } finally {
      setOcupados((o) => {
        const resto = new Set(o);
        resto.delete(jugadorId);
        return resto;
      });
    }
  };

  const consulta = {
    isPending: jugadores.isPending || pasos.isPending || (escalones.isPending && escalones.fetchStatus !== 'idle'),
    isError: jugadores.isError || pasos.isError || escalones.isError,
    error: jugadores.error ?? pasos.error ?? escalones.error,
    data: ordenados && pasos.data && escalones.data ? { jugadores: ordenados, escalones: escalones.data } : undefined,
    refetch: () => Promise.all([jugadores.refetch(), pasos.refetch(), escalones.refetch()]),
  };

  const detalle = detalleChico(linea);
  const valor = paso?.paso ?? null;

  return (
    <>
      <header className="pt-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gris">Ejercicio {indice + 1} de {lineas.length} · {tituloDeSesion(fecha)}</p>
          <span className="flex">
            {anterior ? (
              <Link to={`${base}/ejercicio/${anterior.id}`} aria-label="Ejercicio anterior" className={navegar}>
                <ChevronLeft aria-hidden className="size-5" />
              </Link>
            ) : (
              <span aria-hidden className={cn(navegar, 'opacity-30')}><ChevronLeft className="size-5" /></span>
            )}
            {siguiente ? (
              <Link to={`${base}/ejercicio/${siguiente.id}`} aria-label="Ejercicio siguiente" className={navegar}>
                <ChevronRight aria-hidden className="size-5" />
              </Link>
            ) : (
              <span aria-hidden className={cn(navegar, 'opacity-30')}><ChevronRight className="size-5" /></span>
            )}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Avance por los ejercicios de la sesión"
          aria-valuemin={1}
          aria-valuemax={lineas.length}
          aria-valuenow={indice + 1}
          aria-valuetext={`Ejercicio ${indice + 1} de ${lineas.length}`}
          className="mt-1 h-1 overflow-hidden rounded-full bg-sup-2"
        >
          <div className="h-full bg-club" style={{ width: `${((indice + 1) / lineas.length) * 100}%` }} />
        </div>
        <h1 className="mt-4 font-titulo text-5xl leading-[.95] font-semibold break-words">{linea.nombreOriginal}</h1>
        {detalle && <p className="mt-2 text-sm text-gris">En esta sesión: {detalle}</p>}
      </header>

      <Consulta consulta={consulta} errorGenerico="No se pudieron cargar los escalones" filas={5}>
        {({ jugadores: lista, escalones: pesos }) => {
          const pesoDe = new Map(pesos.map((e) => [e.jugadorId, e]));
          return (
            <>
              <section aria-label="Escalón" className="mt-5 rounded-tarjeta border border-linea bg-sup p-4">
                <p className="text-sm">
                  {valor != null
                    ? `${formatearKg(valor)} kg cada vez que subís o bajás. Es el mismo para todo el club.`
                    : 'Todavía no tiene escalón. Podés anotar el peso de cada chico igual.'}
                </p>
                <Boton variante="contorno" tamano="chico" className="mt-3" onClick={() => setEdicion({ tipo: 'paso' })}>
                  {valor != null ? 'Editar escalón' : 'Definir escalón'}
                </Boton>
              </section>

              {aviso && <Aviso tono="error" titulo={aviso} className="mt-4" />}

              <h2 className="mt-6 mb-1 text-sm text-gris">
                {categoria} · {lista.length} {lista.length === 1 ? 'jugador' : 'jugadores'}
              </h2>
              {lista.length === 0 ? (
                <p className="py-4 text-sm text-gris">Esta categoría todavía no tiene jugadores.</p>
              ) : (
                <ul aria-label="Pesos de los jugadores" className="divide-y divide-linea pb-6">
                  {lista.map((j) => (
                    <FilaDePeso
                      key={j.id}
                      jugador={j}
                      escalon={pesoDe.get(j.id) ?? null}
                      paso={valor}
                      ausente={ausentes.has(j.id)}
                      ocupado={ocupados.has(j.id)}
                      alMover={(kg) => void moverA(j.id, kg)}
                      alEscribir={() => setEdicion({ tipo: 'peso', jugador: j, actual: pesoDe.get(j.id) ?? null })}
                    />
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </Consulta>

      {edicion?.tipo === 'peso' && (
        <HojaDePeso
          key={edicion.jugador.id}
          jugador={edicion.jugador}
          inicial={edicion.actual ? (formatearKg(edicion.actual.kg) as string) : sugerido(linea)}
          alGuardar={(kg) => {
            setEdicion(null);
            void moverA(edicion.jugador.id, kg);
          }}
          alCerrar={() => setEdicion(null)}
        />
      )}
      {edicion?.tipo === 'paso' && (
        <HojaDeEscalon
          clubId={clubId}
          clave={clave}
          nombre={linea.nombreOriginal}
          existente={paso ?? null}
          alCerrar={() => setEdicion(null)}
        />
      )}
    </>
  );
}

const navegar = 'grid size-11 place-items-center rounded-full text-tinta outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta';

/** El primer peso arranca con el de la carga de la línea (ya escrita en kg en el archivo); el profe lo confirma o lo cambia. */
function sugerido(linea: LineaFisico): string {
  const kg = pesoSugeridoDeCarga(linea.cargaSugerida) as number | null;
  return kg != null ? (formatearKg(kg) as string) : '';
}

const boton = 'grid size-12 shrink-0 place-items-center rounded-btn border border-borde-control bg-sup text-tinta outline-offset-2 transition-transform duration-[var(--dur-1)] active:scale-[.95] focus-visible:outline-2 focus-visible:outline-tinta disabled:cursor-not-allowed disabled:bg-sup-2 disabled:text-gris disabled:active:scale-100 [@media(hover:hover)]:enabled:hover:border-tinta';

interface FilaProps {
  jugador: JugadorDelPlantel;
  escalon: EscalonActual | null;
  paso: number | null;
  ausente: boolean;
  ocupado: boolean;
  alMover: (kg: number) => void;
  alEscribir: () => void;
}

function FilaDePeso({ jugador, escalon, paso, ausente, ocupado, alMover, alEscribir }: FilaProps) {
  const nombre = nombreCorto(jugador.nombreLimpio);
  const completo = jugador.nombreLimpio;
  const desde = escalon ? `desde el ${fechaCorta(fechaLocal(new Date(escalon.desde)) as string)}` : 'sin peso';
  // − se apaga sólo cuando restar dejaría un peso que no existe (cero o menos); sin escalón no hay + ni −.
  const bajar = escalon ? (nuevoPeso(escalon.kg, paso, 'bajar') as number | null) : null;
  const subir = escalon ? (nuevoPeso(escalon.kg, paso, 'subir') as number | null) : null;

  return (
    <li className="flex items-center gap-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{nombre}</p>
        <p className="text-sm text-gris">
          {desde}
          {ausente && <span className="ml-2 font-semibold text-club-texto">ausente</span>}
        </p>
      </div>
      {!escalon ? (
        <Boton variante="contorno" tamano="chico" disabled={ocupado} onClick={alEscribir} aria-label={`Poner peso a ${completo}`}>
          Poner peso
        </Boton>
      ) : (
        <div className="flex items-center gap-1.5">
          {paso != null && (
            <button type="button" className={boton} disabled={ocupado || bajar == null} onClick={() => bajar != null && alMover(bajar)} aria-label={`Bajar un escalón a ${completo}`}>
              <Minus aria-hidden className="size-6" />
            </button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={alEscribir}
            aria-label={`Cambiar el peso de ${completo}`}
            className="min-h-12 w-[5.5rem] shrink-0 rounded-btn text-center font-titulo text-4xl leading-none font-semibold tabular-nums outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:text-gris"
          >
            {formatearKg(escalon.kg)}
            <span className="ml-1 text-base text-gris">kg</span>
          </button>
          {paso != null && (
            <button type="button" className={boton} disabled={ocupado || subir == null} onClick={() => subir != null && alMover(subir)} aria-label={`Subir un escalón a ${completo}`}>
              <Plus aria-hidden className="size-6" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function HojaDePeso({ jugador, inicial, alGuardar, alCerrar }: {
  jugador: JugadorDelPlantel; inicial: string; alGuardar: (kg: number) => void; alCerrar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const [error, setError] = useState<string | undefined>();
  const nombre = nombreCorto(jugador.nombreLimpio);
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={`Peso de ${nombre}`} descripcion="El peso con el que trabaja hoy en este ejercicio." etiquetaCerrar="Cerrar sin cambiar el peso">
      <form
        className="flex flex-col gap-3 p-5 pt-12"
        onSubmit={(e) => {
          e.preventDefault();
          const r = parsearPeso(texto) as { error: string | null; kg: number | null };
          if (r.error || r.kg == null) setError(r.error ?? 'Escribí un número.');
          else alGuardar(r.kg);
        }}
      >
        <h2 className="font-titulo text-2xl font-semibold">Peso de {nombre}</h2>
        <p className="text-sm text-gris">El peso con el que trabaja hoy en este ejercicio.</p>
        <Campo
          etiqueta="Peso (kg)"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={texto}
          error={error}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Boton type="submit">Guardar peso</Boton>
        <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
      </form>
    </Hoja>
  );
}

function HojaDeEscalon({ clubId, clave, nombre, existente, alCerrar }: {
  clubId: string; clave: string; nombre: string; existente: PasoFuerza | null; alCerrar: () => void;
}) {
  const [texto, setTexto] = useState(existente?.paso != null ? (formatearKg(existente.paso) as string) : '');
  const [error, setError] = useState<string | undefined>();
  const guardar = useGuardarPaso(clubId, clave, nombre);
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={`Escalón de ${nombre}`} descripcion="Cuánto suma + y cuánto resta −. Es el mismo para todo el club." etiquetaCerrar="Cerrar sin cambiar el escalón">
      <form
        className="flex flex-col gap-3 p-5 pt-12"
        onSubmit={async (e) => {
          e.preventDefault();
          if (guardar.isPending) return;
          const r = parsearPeso(texto) as { error: string | null; kg: number | null };
          if (r.error || r.kg == null) {
            setError(r.error ?? 'Escribí un número.');
            return;
          }
          setError(undefined);
          try {
            await guardar.mutateAsync({ existente, kg: r.kg });
            alCerrar();
          } catch (err) {
            setError(
              (err as { code?: string } | null)?.code === '23505'
                ? 'Alguien definió este escalón recién. Cerrá y volvé a abrir el ejercicio.'
                : mensajeDeError(err, 'No se pudo guardar el escalón.'),
            );
          }
        }}
      >
        <h2 className="font-titulo text-2xl font-semibold break-words">Escalón de {nombre}</h2>
        <p className="text-sm text-gris">Cuánto suma + y cuánto resta −. Es el mismo para todo el club.</p>
        {/* Sin ejemplo en el campo: un «ej. 2,5» también sería proponer un escalón. */}
        <Campo
          etiqueta="Escalón (kg)"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={texto}
          error={error}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar escalón'}</Boton>
        <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
      </form>
    </Hoja>
  );
}
