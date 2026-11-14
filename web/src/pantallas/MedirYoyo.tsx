import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { prepararPayloadYoyo } from '@datos/prepararPayloadMedicion.js';
import { cronograma, metrosDe, nivelYIda, posicionEn, segundosAlPitido, TABLA_YYET1, validarIdas } from '@datos/yoyo.js';
import { crearPitidosYoyo, CUENTA_S } from '@ui/componentes/pitidosYoyo.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Hoja } from '../components/ui/sheet';
import type { JugadorDelPlantel, PayloadDeMedicion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { CampoFecha, Encabezado, PantallaDeTest, PieDeGuardado, type Categoria } from '../medir/MarcoDeTest';
import { useTest } from '../medir/useTest';

type ValorYoyo = { ausente: true } | { idas: number };
type EstadoCorredor = { estado: 'activo' | 'aviso' | 'out'; idas: number | null };
type Pitidos = { empezar: () => boolean; detener: () => void; tiempoActual: () => number | null };

const TIEMPO_TOTAL_S = ((c) => c[c.length - 1].t)(cronograma() as { t: number }[]);
const miles = new Intl.NumberFormat('es-AR');
const posicion = (t: number) => posicionEn(t) as { nivel: number; ida: number; idasCompletas: number };
const nivel = (idas: number) => nivelYIda(idas) as string;

/** Yo-Yo: quién corre, los pitidos con los toques de aviso y eliminación, y el resumen para corregir y guardar. */
export function MedirYoyo() {
  return <PantallaDeTest>{(c) => <Yoyo {...c} />}</PantallaDeTest>;
}

function Yoyo({ clubId, plantelId, categoria, jugadores }: Categoria & { jugadores: JugadorDelPlantel[] }) {
  const t = useTest<ValorYoyo, Record<string, never>>({
    clubId, plantelId, tipo: 'yoyo',
    extraInicial: () => ({}),
    payload: (e) => prepararPayloadYoyo({ sesionId: e.sesionId, clubId, plantelId, fecha: e.fecha, valores: e.valores }) as PayloadDeMedicion,
    vacio: 'Todavía no hay ningún resultado.',
  });
  // Un borrador es siempre una prueba terminada y sin guardar: se sigue en el resumen.
  const [fase, setFase] = useState<'preparar' | 'curso' | 'resumen'>(() => (Object.keys(t.estado.valores).length ? 'resumen' : 'preparar'));
  const [corren, setCorren] = useState<Set<string>>(() => new Set(jugadores.filter((j) => {
    const v = t.estado.valores[j.id];
    return !(v && 'ausente' in v);
  }).map((j) => j.id)));
  const [avisoPrueba, setAvisoPrueba] = useState<string | null>(null);
  const pitidos = useRef<Pitidos | null>(null);

  const empezar = () => {
    setAvisoPrueba(null);
    const p = crearPitidosYoyo({ alAviso: (texto: string) => setAvisoPrueba(texto) }) as Pitidos;
    // El toque de Empezar es el gesto que habilita el audio.
    if (!p.empezar()) {
      setAvisoPrueba('Este celular no puede reproducir los pitidos. Probá con otro navegador.');
      return;
    }
    pitidos.current = p;
    setFase('curso');
  };

  /** Fin de la prueba: con `t` null (cancelada en la cuenta) vuelve a preparar. */
  const terminar = useCallback((t0: number | null, estados: Record<string, EstadoCorredor>) => {
    pitidos.current?.detener();
    pitidos.current = null;
    if (t0 == null || t0 < 0) {
      setFase('preparar');
      return;
    }
    const idasAlFinal = posicion(t0).idasCompletas;
    const valores: Record<string, ValorYoyo> = {};
    for (const j of jugadores) {
      if (!corren.has(j.id)) valores[j.id] = { ausente: true };
      else valores[j.id] = { idas: estados[j.id]?.estado === 'out' ? (estados[j.id].idas ?? 0) : idasAlFinal };
    }
    t.cambiar((s) => ({ ...s, valores }));
    setFase('resumen');
  }, [corren, jugadores, t]);

  // Salir de la pantalla corta los pitidos: no pueden seguir sonando solos.
  useEffect(() => () => pitidos.current?.detener(), []);

  if (fase === 'curso') {
    return <EnCurso jugadores={jugadores.filter((j) => corren.has(j.id))} pitidos={pitidos} aviso={avisoPrueba} alTerminar={terminar} />;
  }

  if (fase === 'resumen') {
    return (
      <Resumen
        categoria={categoria}
        fecha={t.estado.fecha}
        jugadores={jugadores}
        valores={t.estado.valores}
        alCorregir={(id, v) => t.ponerValor(id, v)}
        alRepetir={() => {
          t.reiniciar();
          setFase('preparar');
        }}
        guardar={<PieDeGuardado guardando={t.guardando} aviso={t.aviso} alGuardar={t.guardar} />}
      />
    );
  }

  return (
    <>
      <Encabezado tipo="yoyo" categoria={categoria} fecha={t.estado.fecha}>
        <CampoFecha fecha={t.estado.fecha} alCambiar={(f) => t.cambiar((s) => ({ ...s, fecha: f }))} />
      </Encabezado>
      <div className="mt-5 flex items-baseline justify-between">
        <h2 className="font-titulo text-2xl leading-none font-bold uppercase">Quién corre</h2>
        <span className="cifra font-mono text-sm">{corren.size} de {jugadores.length}</span>
      </div>
      <p className="mt-1 text-sm text-gris">Los que no marques quedan como ausentes. Mejor de 8 a 10 por tanda, para poder mirarlos a todos.</p>
      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
        {jugadores.map((j) => {
          const corre = corren.has(j.id);
          return (
            <li key={j.id}>
              <button
                type="button"
                aria-pressed={corre}
                onClick={() => setCorren((c) => {
                  const n = new Set(c);
                  if (n.has(j.id)) n.delete(j.id);
                  else n.add(j.id);
                  return n;
                })}
                className={cn(
                  'flex min-h-14 w-full items-center justify-between gap-3 rounded-tarjeta border px-4 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                  corre ? 'border-test-yoyo bg-sup' : 'border-linea bg-sup text-gris',
                )}
              >
                <span className="font-semibold">{j.nombreLimpio}</span>
                <span className={cn('rounded-chip px-2 py-0.5 font-mono text-xs uppercase', corre ? 'bg-test-yoyo text-sobre-test-yoyo' : 'bg-sup-2')}>
                  {corre ? 'Corre' : 'No corre'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {avisoPrueba && <Aviso tono="error" titulo={avisoPrueba} className="mt-4" />}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 border-t border-linea bg-fondo/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8">
        <Boton className="w-full sm:w-auto" disabled={!corren.size} onClick={empezar}>Empezar</Boton>
      </div>
    </>
  );
}

function EnCurso({ jugadores, pitidos, aviso, alTerminar }: {
  jugadores: JugadorDelPlantel[];
  pitidos: React.RefObject<Pitidos | null>;
  aviso: string | null;
  alTerminar: (t: number | null, estados: Record<string, EstadoCorredor>) => void;
}) {
  const [estados, setEstados] = useState<Record<string, EstadoCorredor>>(() => Object.fromEntries(jugadores.map((j) => [j.id, { estado: 'activo', idas: null }])));
  const [pila, setPila] = useState<{ id: string; antes: EstadoCorredor }[]>([]);
  const [t, setT] = useState<number | null>(() => pitidos.current?.tiempoActual() ?? null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const estadosRef = useRef(estados);
  estadosRef.current = estados;
  const terminado = useRef(false);

  const fin = useCallback((t0: number | null) => {
    if (terminado.current) return;
    terminado.current = true;
    alTerminar(t0, estadosRef.current);
  }, [alTerminar]);

  // El reloj en pantalla sale del reloj del audio, el mismo de los pitidos.
  useEffect(() => {
    let cuadro = 0;
    const animar = () => {
      const ahora = pitidos.current?.tiempoActual() ?? null;
      setT(ahora);
      if (ahora != null && ahora > TIEMPO_TOTAL_S) {
        fin(ahora);
        return;
      }
      cuadro = requestAnimationFrame(animar);
    };
    cuadro = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(cuadro);
  }, [fin, pitidos]);

  // Irse con la prueba corriendo la corta y pierde lo marcado: se confirma antes.
  const bloqueo = useBlocker(() => !terminado.current && (pitidos.current?.tiempoActual() ?? -1) >= 0);

  const tocar = (id: string) => {
    const ahora = pitidos.current?.tiempoActual();
    // Durante la cuenta todavía no hay idas: no hay nada que anotar.
    if (ahora == null || ahora < 0) return;
    const antes = estados[id];
    let nuevo: EstadoCorredor;
    if (antes.estado === 'activo') nuevo = { estado: 'aviso', idas: null };
    else if (antes.estado === 'aviso') nuevo = { estado: 'out', idas: posicion(ahora).idasCompletas };
    else return;
    const siguientes = { ...estados, [id]: nuevo };
    setEstados(siguientes);
    estadosRef.current = siguientes;
    setPila((p) => [...p, { id, antes }]);
    if (Object.values(siguientes).every((e) => e.estado === 'out')) fin(ahora);
  };

  const llego = (id: string) => {
    setPila((p) => [...p, { id, antes: estados[id] }]);
    setEstados((e) => ({ ...e, [id]: { estado: 'activo', idas: null } }));
  };

  const deshacer = () => {
    const ultimo = pila[pila.length - 1];
    if (!ultimo) return;
    setPila((p) => p.slice(0, -1));
    setEstados((e) => ({ ...e, [ultimo.id]: ultimo.antes }));
  };

  const pedirTerminar = () => {
    const ahora = pitidos.current?.tiempoActual() ?? null;
    // Durante la cuenta no hay nada que perder: es cancelar la prueba.
    if (ahora == null || ahora < 0) fin(null);
    // El momento que cuenta es el del toque, no el de confirmar.
    else setConfirmando(ahora);
  };

  const quedan = Object.values(estados).filter((e) => e.estado !== 'out').length;
  const p = t != null && t >= 0 ? posicion(t) : null;
  const al = t != null && t >= 0 ? (segundosAlPitido(t) as number | null) : null;

  return (
    <>
      <header className="sticky top-0 z-20 -mx-4 border-b border-linea bg-fondo/95 px-4 pt-2 pb-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p role="timer" className="cifra font-titulo text-6xl leading-none font-bold uppercase">
          {t == null || t < 0 ? `Empieza en ${t == null ? CUENTA_S : Math.ceil(-t)}` : `Nivel ${p!.nivel} · Ida ${p!.ida}`}
        </p>
        <p className="mt-1 flex gap-4 font-mono text-sm">
          {p && <span>{String(TABLA_YYET1[p.nivel - 1].kmh).replace('.', ',')} km/h</span>}
          {al != null && <span>Pitido en {al.toFixed(1).replace('.', ',')} s</span>}
          <span className="ml-auto">{quedan} {quedan === 1 ? 'activo' : 'activos'}</span>
        </p>
      </header>
      <p className="mt-3 text-sm text-gris">Tocá a un jugador cuando no llegue a la línea con el pitido: la primera vez es un aviso, la segunda lo saca.</p>
      {aviso && <Aviso tono="error" titulo={aviso} className="mt-3" />}
      <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {jugadores.map((j) => {
          const e = estados[j.id];
          return (
            <li key={j.id} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={e.estado === 'out'}
                onClick={() => tocar(j.id)}
                className={cn(
                  'flex min-h-24 flex-col justify-between rounded-tarjeta border p-3 text-left outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-tinta touch-manipulation active:scale-[.98]',
                  e.estado === 'activo' && 'border-linea bg-sup',
                  e.estado === 'aviso' && 'border-transparent bg-test-yoyo text-sobre-test-yoyo',
                  e.estado === 'out' && 'border-linea bg-sup-2 text-gris line-through',
                )}
              >
                <span className="font-semibold">{j.nombreLimpio}</span>
                <span className="font-mono text-xs uppercase">
                  {e.estado === 'aviso' ? '1º aviso' : e.estado === 'out' ? `Afuera · ${nivel(e.idas ?? 0)}` : 'Corriendo'}
                </span>
              </button>
              {e.estado === 'aviso' && <Boton variante="contorno" tamano="chico" onClick={() => llego(j.id)}>Llegó</Boton>}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 flex gap-2 border-t border-linea bg-fondo/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8">
        <Boton variante="contorno" disabled={!pila.length} onClick={deshacer}>Deshacer</Boton>
        <Boton variante="club" onClick={pedirTerminar}>Terminar test</Boton>
      </div>

      <Hoja abierta={confirmando !== null} alCambiar={(a) => !a && setConfirmando(null)} titulo="Terminar el test" descripcion="Confirmá si querés cortar la prueba." etiquetaCerrar="Cerrar">
        {confirmando !== null && (
          <div className="flex flex-col gap-3 p-5 pt-12">
            <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">Terminar el test</h2>
            <p className="text-sm text-gris">
              Quedan {quedan} {quedan === 1 ? 'jugador' : 'jugadores'} en carrera: se les anota el nivel en que está la prueba ahora ({nivel(posicion(confirmando).idasCompletas)}). No se puede retomar.
            </p>
            <div className="flex gap-2">
              <Boton variante="club" onClick={() => fin(confirmando)}>Terminar</Boton>
              <Boton variante="contorno" onClick={() => setConfirmando(null)}>Cancelar</Boton>
            </div>
          </div>
        )}
      </Hoja>

      <Hoja abierta={bloqueo.state === 'blocked'} alCambiar={(a) => !a && bloqueo.reset?.()} titulo="Salir de la prueba" descripcion="Confirmá si querés salir con la prueba corriendo." etiquetaCerrar="Cerrar">
        <div className="flex flex-col gap-3 p-5 pt-12">
          <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">Salir de la prueba</h2>
          <p className="text-sm text-gris">La prueba está corriendo. Si salís se corta y se pierde lo marcado: no se puede retomar.</p>
          <div className="flex gap-2">
            <Boton variante="club" onClick={() => { terminado.current = true; pitidos.current?.detener(); bloqueo.proceed?.(); }}>Salir</Boton>
            <Boton variante="contorno" onClick={() => bloqueo.reset?.()}>Seguir</Boton>
          </div>
        </div>
      </Hoja>
    </>
  );
}

function Resumen({ categoria, fecha, jugadores, valores, alCorregir, alRepetir, guardar }: {
  categoria: string;
  fecha: string;
  jugadores: JugadorDelPlantel[];
  valores: Record<string, ValorYoyo | undefined>;
  alCorregir: (id: string, v: ValorYoyo) => void;
  alRepetir: () => void;
  guardar: React.ReactNode;
}) {
  const [corrigiendo, setCorrigiendo] = useState<JugadorDelPlantel | null>(null);
  const [repetir, setRepetir] = useState(false);
  const idas = (id: string) => {
    const v = valores[id];
    return v && 'idas' in v ? v.idas : -1;
  };
  const ordenados = [...jugadores].sort((a, b) => idas(b.id) - idas(a.id) || a.nombreLimpio.localeCompare(b.nombreLimpio));

  return (
    <>
      <Encabezado tipo="yoyo" categoria={categoria} fecha={fecha} />
      <h2 className="mt-5 font-titulo text-2xl leading-none font-bold uppercase">Resumen</h2>
      <p className="mt-1 text-sm text-gris">Revisá los resultados y corregí lo que haga falta antes de guardar.</p>
      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
        {ordenados.map((j) => {
          const v = valores[j.id];
          const corrio = !!v && 'idas' in v;
          return (
            <li key={j.id} className={cn('flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup p-4', !corrio && 'opacity-70')}>
              <div className="min-w-0">
                <p className="font-semibold">{j.nombreLimpio}</p>
                {corrio ? (
                  <p className="mt-1 flex gap-4">
                    <span><span className="block font-mono text-xs text-gris uppercase">Nivel</span><span className="cifra font-titulo text-3xl leading-none font-bold">{nivel(v.idas)}</span></span>
                    <span><span className="block font-mono text-xs text-gris uppercase">Distancia total</span><span className="cifra font-titulo text-3xl leading-none font-bold">{miles.format(metrosDe(v.idas) as number)}<span className="text-base"> m</span></span></span>
                  </p>
                ) : (
                  <p className="mt-1 font-mono text-xs text-gris uppercase">No corrió</p>
                )}
              </div>
              <Boton variante="contorno" tamano="chico" aria-label={`Corregir ${j.nombreLimpio}`} onClick={() => setCorrigiendo(j)}>Corregir</Boton>
            </li>
          );
        })}
      </ul>
      <Boton variante="contorno" tamano="chico" className="mt-4" onClick={() => setRepetir(true)}>Repetir la prueba</Boton>
      {guardar}

      <Hoja abierta={corrigiendo !== null} alCambiar={(a) => !a && setCorrigiendo(null)} titulo="Corregir" descripcion="Las idas completas del jugador, o que no corrió." etiquetaCerrar="Cerrar">
        {corrigiendo && (
          <Corregir
            key={corrigiendo.id}
            nombre={corrigiendo.nombreLimpio}
            actual={idas(corrigiendo.id) >= 0 ? idas(corrigiendo.id) : null}
            alListo={(v) => {
              alCorregir(corrigiendo.id, v);
              setCorrigiendo(null);
            }}
          />
        )}
      </Hoja>

      <Hoja abierta={repetir} alCambiar={setRepetir} titulo="Repetir la prueba" descripcion="Confirmá si querés descartar los resultados." etiquetaCerrar="Cerrar">
        <div className="flex flex-col gap-3 p-5 pt-12">
          <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">Repetir la prueba</h2>
          <p className="text-sm text-gris">Se descartan estos resultados y se vuelve a empezar. No se puede deshacer.</p>
          <div className="flex gap-2">
            <Boton variante="club" onClick={() => { setRepetir(false); alRepetir(); }}>Repetir</Boton>
            <Boton variante="contorno" onClick={() => setRepetir(false)}>Cancelar</Boton>
          </div>
        </div>
      </Hoja>
    </>
  );
}

function Corregir({ nombre, actual, alListo }: { nombre: string; actual: number | null; alListo: (v: ValorYoyo) => void }) {
  const [texto, setTexto] = useState(actual == null ? '' : String(actual));
  const [error, setError] = useState<string | null>(null);
  const aceptar = () => {
    const r = validarIdas(texto) as { ok: true; idas: number } | { ok: false; error: string };
    if (!r.ok) setError(r.error);
    else alListo({ idas: r.idas });
  };
  return (
    <form className="flex flex-col gap-4 p-5 pt-12" onSubmit={(e) => { e.preventDefault(); aceptar(); }}>
      <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">{nombre}</h2>
      <Campo etiqueta="Idas completas" ayuda="Cada ida son 20 m. De 0 a 223." inputMode="numeric" autoComplete="off" maxLength={3} value={texto} error={error ?? undefined} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex gap-2">
        <Boton variante="contorno" onClick={() => alListo({ ausente: true })}>No corrió</Boton>
        <Boton type="submit">Guardar</Boton>
      </div>
    </form>
  );
}
