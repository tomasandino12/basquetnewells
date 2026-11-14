import { useState } from 'react';
import { prepararPayloadSprint } from '@datos/prepararPayloadMedicion.js';
import {
  DISTANCIA_SPRINT_PREDETERMINADA, DISTANCIAS_SPRINT, formatearTiempoSprint, INTENTOS_SPRINT,
  mejorIntentoSprint, validarIntentoSprint, vueltaSprint,
} from '@datos/sprint.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Hoja } from '../components/ui/sheet';
import type { JugadorDelPlantel, PayloadDeMedicion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { CronometroDeSalida } from '../medir/CronometroDeSalida';
import { BotonAusente, CampoFecha, Encabezado, PantallaDeTest, PieDeGuardado, type Categoria } from '../medir/MarcoDeTest';
import { useTest, type Valores } from '../medir/useTest';

/** Por intento, la ida (`parcialMs`) y el total (`tiempoMs`), los dos desde el pitido. */
type IntentoSprint = { parcialMs: number | null; tiempoMs: number } | null;
type ValorSprint = { ausente: true } | { intentos: IntentoSprint[] };

const CLAVE_DISTANCIA = 'sprint.distancia.predeterminada';
const DISTANCIAS = DISTANCIAS_SPRINT as number[];
const INTENTOS = INTENTOS_SPRINT as number;
const tiempo = (ms: number | null) => (formatearTiempoSprint(ms) as string | null) ?? '—';

function distanciaRecordada(): number {
  try {
    const n = Number(localStorage.getItem(CLAVE_DISTANCIA));
    return DISTANCIAS.includes(n) ? n : (DISTANCIA_SPRINT_PREDETERMINADA as number);
  } catch {
    return DISTANCIA_SPRINT_PREDETERMINADA as number;
  }
}

function recordarDistancia(n: number) {
  try {
    localStorage.setItem(CLAVE_DISTANCIA, String(n));
  } catch {
    // Sin localStorage vuelve a 30 m la próxima vez: no es grave.
  }
}

/** Un borrador de antes del ida y vuelta guardaba sólo el total (un número). */
export function normalizarSprint(valores: Valores<ValorSprint>): Valores<ValorSprint> {
  const salida: Valores<ValorSprint> = {};
  for (const [id, v] of Object.entries(valores)) {
    salida[id] = v && 'intentos' in v
      ? { intentos: v.intentos.map((i) => (typeof i === 'number' ? { parcialMs: null, tiempoMs: i } : i)) }
      : v;
  }
  return salida;
}

/** Sprint de ida y vuelta, 2 intentos por chico, con el cronómetro de pitido o tecleado. */
export function MedirSprint() {
  return <PantallaDeTest>{(c) => <Sprint {...c} />}</PantallaDeTest>;
}

function Sprint({ clubId, plantelId, categoria, jugadores }: Categoria & { jugadores: JugadorDelPlantel[] }) {
  const t = useTest<ValorSprint, { distanciaM: number }>({
    clubId, plantelId, tipo: 'sprint',
    extraInicial: (b) => ({ distanciaM: DISTANCIAS.includes(b?.distanciaM as number) ? (b!.distanciaM as number) : distanciaRecordada() }),
    normalizar: normalizarSprint,
    payload: (e) => prepararPayloadSprint({
      sesionId: e.sesionId, clubId, plantelId, fecha: e.fecha, distanciaSprintM: e.extra.distanciaM, valores: e.valores,
    }) as PayloadDeMedicion,
    vacio: 'Todavía no cargaste ningún tiempo.',
  });
  const [corriendo, setCorriendo] = useState<{ jugador: JugadorDelPlantel; indice: number } | null>(null);
  const [tecleando, setTecleando] = useState<{ jugador: JugadorDelPlantel; indice: number } | null>(null);
  const distanciaM = t.estado.extra.distanciaM;

  const intentosDe = (id: string): IntentoSprint[] => {
    const v = t.estado.valores[id];
    return v && 'intentos' in v ? v.intentos : [];
  };

  /** Guarda un intento (o lo borra con null) y saca al chico si le quedan todos vacíos. */
  const ponerIntento = (id: string, indice: number, intento: IntentoSprint) => {
    const intentos = Array.from({ length: INTENTOS }, (_, i) => intentosDe(id)[i] ?? null);
    intentos[indice] = intento;
    t.ponerValor(id, intentos.every((x) => x == null) ? undefined : { intentos });
  };

  return (
    <>
      <Encabezado tipo="sprint" categoria={categoria} fecha={t.estado.fecha}>
        <div role="group" aria-label="Distancia" className="flex rounded-campo border border-borde-control p-0.5">
          {[...DISTANCIAS].reverse().map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === distanciaM}
              onClick={() => {
                recordarDistancia(d);
                t.cambiar((s) => ({ ...s, extra: { distanciaM: d } }));
              }}
              className={cn('min-h-10 rounded-[calc(var(--radius-campo)-2px)] px-4 font-titulo text-lg font-semibold', d === distanciaM ? 'bg-negro text-sobre-negro' : 'text-gris')}
            >
              {d} m
            </button>
          ))}
        </div>
        <CampoFecha fecha={t.estado.fecha} alCambiar={(f) => t.cambiar((s) => ({ ...s, fecha: f }))} />
      </Encabezado>

      <ul className="mt-5 grid gap-2 lg:grid-cols-2">
        {jugadores.map((j) => {
          const v = t.estado.valores[j.id];
          const ausente = !!v && 'ausente' in v;
          const intentos = intentosDe(j.id);
          const mejor = mejorIntentoSprint(intentos.map((x, i) => ({ tiempoMs: x?.tiempoMs ?? null, i }))) as { i: number } | null;
          const mejorIdx = intentos.filter((x) => x != null).length > 1 ? mejor?.i : null;
          return (
            <li key={j.id} className={cn('flex flex-col gap-3 rounded-tarjeta border border-linea bg-sup p-4', ausente && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{j.nombreLimpio}</span>
                {ausente && <span className="font-mono text-xs text-gris uppercase">Ausente</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: INTENTOS }, (_, i) => {
                  const cargado = intentos[i] ?? null;
                  const etiqueta = `Intento ${i + 1}`;
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 font-mono text-xs tracking-wide text-gris uppercase">
                        {etiqueta}
                        {mejorIdx === i && <span className="rounded-chip bg-sube-fondo px-1.5 text-sube">Mejor</span>}
                      </span>
                      {ausente ? (
                        <span className="text-gris">—</span>
                      ) : cargado == null ? (
                        <Boton tamano="chico" variante="secundario" onClick={() => setCorriendo({ jugador: j, indice: i })}>Correr</Boton>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setTecleando({ jugador: j, indice: i })}
                          aria-label={`${etiqueta}: ${tiempo(cargado.tiempoMs)}. Tocá para corregir`}
                          className="cifra text-left font-titulo text-4xl leading-none font-bold text-test-sprint-t outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
                        >
                          {tiempo(cargado.tiempoMs).replace(' s', '')}<span className="text-lg">s</span>
                          {cargado.parcialMs != null && (
                            <span className="mt-1 block font-sans text-xs font-normal text-gris">
                              Ida {tiempo(cargado.parcialMs)} · Vuelta {tiempo(vueltaSprint(cargado) as number)}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Boton
                  tamano="chico"
                  variante="contorno"
                  disabled={ausente}
                  onClick={() => {
                    const vacio = Array.from({ length: INTENTOS }, (_, i) => i).find((i) => intentos[i] == null);
                    setTecleando({ jugador: j, indice: vacio ?? 0 });
                  }}
                >
                  Teclear tiempo
                </Boton>
                <BotonAusente nombre={j.nombreLimpio} ausente={ausente} alTocar={() => t.ponerValor(j.id, ausente ? undefined : { ausente: true })} />
              </div>
            </li>
          );
        })}
      </ul>

      {corriendo && (
        <CronometroDeSalida
          jugador={corriendo.jugador.nombreLimpio}
          intento={corriendo.indice + 1}
          distanciaM={distanciaM}
          alTerminar={(r) => {
            const c = corriendo;
            setCorriendo(null);
            if (r) ponerIntento(c.jugador.id, c.indice, { parcialMs: r.parcialMs, tiempoMs: r.tiempoMs });
          }}
        />
      )}

      <Hoja
        abierta={tecleando !== null}
        alCambiar={(a) => !a && setTecleando(null)}
        titulo="Teclear el tiempo"
        descripcion="La ida y el total del intento, en segundos."
        etiquetaCerrar="Cerrar"
      >
        {tecleando && (
          <Teclear
            key={`${tecleando.jugador.id}-${tecleando.indice}`}
            titulo={`${tecleando.jugador.nombreLimpio} · intento ${tecleando.indice + 1}`}
            actual={intentosDe(tecleando.jugador.id)[tecleando.indice] ?? null}
            alGuardar={(r) => {
              ponerIntento(tecleando.jugador.id, tecleando.indice, r);
              setTecleando(null);
            }}
          />
        )}
      </Hoja>

      <PieDeGuardado guardando={t.guardando} aviso={t.aviso} alGuardar={t.guardar} />
    </>
  );
}

const tecleable = (ms: number | null | undefined) => (ms == null ? '' : (ms / 1000).toFixed(2).replace('.', ','));

/** Teclear (o corregir o borrar) los dos tiempos de un intento. */
function Teclear({ titulo, actual, alGuardar }: { titulo: string; actual: IntentoSprint; alGuardar: (r: IntentoSprint) => void }) {
  const [parcial, setParcial] = useState(tecleable(actual?.parcialMs));
  const [total, setTotal] = useState(tecleable(actual?.tiempoMs));
  const [error, setError] = useState<string | null>(null);
  const aceptar = () => {
    const r = validarIntentoSprint(parcial, total) as { ok: true; parcialMs: number; tiempoMs: number } | { ok: false; error: string };
    if (!r.ok) {
      setError(r.error);
      return;
    }
    alGuardar({ parcialMs: r.parcialMs, tiempoMs: r.tiempoMs });
  };
  return (
    <form className="flex flex-col gap-4 p-5 pt-12" onSubmit={(e) => { e.preventDefault(); aceptar(); }}>
      <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">{titulo}</h2>
      <Campo etiqueta="Ida (cuando frena para girar), en segundos" inputMode="decimal" autoComplete="off" maxLength={6} placeholder="4,6" value={parcial} onChange={(e) => setParcial(e.target.value)} />
      <Campo
        etiqueta="Total (cuando vuelve a la línea), en segundos"
        ayuda="Los dos tiempos se cuentan desde el pitido. Con coma o con punto."
        inputMode="decimal" autoComplete="off" maxLength={6} placeholder="10,2" value={total} onChange={(e) => setTotal(e.target.value)}
      />
      {error && <Aviso tono="error" titulo={error} />}
      <div className="flex gap-2">
        <Boton variante="contorno" disabled={actual == null} onClick={() => alGuardar(null)}>Borrar</Boton>
        <Boton type="submit">Guardar</Boton>
      </div>
    </form>
  );
}
