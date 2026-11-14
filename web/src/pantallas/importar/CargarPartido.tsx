import { ArrowLeft, Check, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { hoyLocal } from '@datos/antropometria.js';
import { calcularHashArchivo, mapearImportacion } from '@datos/mapearImportacion.js';
import { prepararPayloadImportacion } from '@datos/prepararPayloadImportacion.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton, claseBoton } from '../../components/ui/button';
import { CardBoton, Panel } from '../../components/ui/card';
import { Chip } from '../../components/ui/chip';
import { mensajeDeError, mensajeDeGuardado } from '../../datos/errores';
import type { JugadorDelClub, PlantelDelClub } from '../../datos/repositorio';
import { useAccion, useRepositorio } from '../../familias/consultas';
import {
  REGLAS_PARTIDO, esChoqueConOtroProfe, textoDeAdvertencias, textoDeJugadoresNuevos, textoPartidoGuardado,
} from '../../importar/textos';
import { cn } from '../../lib/cn';
import { ConCategoria, MarcoDelPlantel } from '../PlantelDelClub';
import { CampoDeArchivo } from './piezas';

// Cargar un partido de la CABB, en pasos: archivo → equipo, fecha y plantel → jugadores → resultado.
// Nada se guarda hasta «Guardar», y se guarda todo o nada (importar_partido es una sola transacción).

interface EquipoLeido {
  nombre: string | null;
  condicion: 'local' | 'visitante';
  totales: { pts: number | null } | null;
}

interface Leido {
  equipos: [EquipoLeido, EquipoLeido];
  partido: { categoria: string | null };
  origen: { idPartidoCabb: string | null };
  advertencias: { mensaje: string }[];
  errores: { mensaje: string }[];
}

interface Mapeo {
  error: string | null;
  jugadoresNuevos: { nombreClave: string; nombreLimpio: string }[];
  jugadoresCoincidentes: { nombreClave: string; requierePertenenciaNueva: boolean }[];
  sugerencias: { nombreClave: string; nombreLimpio: string; candidato: { nombreLimpio: string } }[];
}

type Decision = 'mismo' | 'otro';

type Paso =
  | { tipo: 'archivo'; leyendo: boolean; fallo: ReactNode | null }
  | { tipo: 'equipo' }
  | { tipo: 'jugadores' }
  | { tipo: 'resultado'; resumen: string };

interface Datos {
  nombreArchivo: string;
  hash: string;
  leido: Leido;
  planteles: PlantelDelClub[];
}

/** El partido de la CABB, desde el plantel elegido arriba. */
export function CargarPartido() {
  return (
    <MarcoDelPlantel>
      <ConCategoria>{(a) => <PasosDelPartido clubId={a.clubId} />}</ConCategoria>
    </MarcoDelPlantel>
  );
}

const enlaceVolver = 'mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta';

export function PasosDelPartido({ clubId }: { clubId: string }) {
  const cargar = useRepositorio();
  const consultas = useQueryClient();
  const guardar = useAccion((repo, payload: unknown) => repo.importarPartido(payload));
  const [paso, setPaso] = useState<Paso>({ tipo: 'archivo', leyendo: false, fallo: null });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [condicion, setCondicion] = useState<'local' | 'visitante' | null>(null);
  const [fecha, setFecha] = useState(() => hoyLocal() as string);
  const [elegido, setElegido] = useState<string | null>(null);
  const [existentes, setExistentes] = useState<JugadorDelClub[]>([]);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [cargandoJugadores, setCargandoJugadores] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const lectura = useRef(0);

  const fallo = (nodo: ReactNode) => setPaso({ tipo: 'archivo', leyendo: false, fallo: nodo });

  function reiniciar() {
    setDatos(null);
    setCondicion(null);
    setElegido(null);
    setMapeo(null);
    setDecisiones({});
    setExcluidos(new Set());
    setError(null);
    setBloqueado(false);
    setPaso({ tipo: 'archivo', leyendo: false, fallo: null });
  }

  async function leer(archivo: File | undefined) {
    const esta = ++lectura.current;
    if (!archivo) return;
    setPaso({ tipo: 'archivo', leyendo: true, fallo: null });
    let buffer: ArrayBuffer;
    try {
      buffer = await archivo.arrayBuffer();
    } catch {
      return fallo(<Aviso tono="error" titulo="No se pudo leer el archivo. Probá de nuevo." />);
    }
    try {
      const { parsearPartidoCabb } = await import('@parser/parserCabb.js');
      const leido = parsearPartidoCabb(buffer, archivo.name) as unknown as Leido;
      if (esta !== lectura.current) return;
      if (leido.errores.length > 0) {
        return fallo(
          <>
            <p className="font-mono text-xs tracking-wide text-gris uppercase">No se pudo leer el partido</p>
            {leido.errores.map((e, i) => <Aviso key={i} tono="error" titulo={e.mensaje} />)}
          </>,
        );
      }
      const hash = (await calcularHashArchivo(buffer)) as string;
      const repo = await cargar();
      const planteles = await repo.obtenerPlantelesDelClub(clubId);
      const yaImportado = await repo.buscarImportacionPorHash(clubId, hash);
      if (esta !== lectura.current) return;
      if (yaImportado) {
        return fallo(<Aviso tono="ok" titulo={`Este partido ya fue importado (${yaImportado.nombre_archivo ?? ''}).`} />);
      }
      setDatos({ nombreArchivo: archivo.name, hash, leido, planteles });
      setElegido(planteles.find((p) => p.codigoCabb === leido.partido.categoria)?.id ?? null);
      setPaso({ tipo: 'equipo' });
    } catch (e) {
      if (esta !== lectura.current) return;
      fallo(<Aviso tono="error" titulo={mensajeDeError(e, 'Ocurrió un error inesperado.')} />);
    }
  }

  const plantelElegido = datos?.planteles.find((p) => p.id === elegido) ?? null;

  /** Clasifica a los jugadores del archivo contra lo que ya hay en el club. */
  function mapear(jugadores: JugadorDelClub[], cond: 'local' | 'visitante', plantel: PlantelDelClub): Mapeo {
    return mapearImportacion(
      datos!.leido,
      { condicionPropia: cond, clubId, plantelId: plantel.id, temporadaId: plantel.temporadaId, fecha },
      jugadores,
    ) as Mapeo;
  }

  async function verJugadores() {
    if (!datos || !condicion || !plantelElegido) return;
    setCargandoJugadores(true);
    setError(null);
    try {
      const jugadores = await (await cargar()).obtenerJugadoresDelClub(clubId);
      const r = mapear(jugadores, condicion, plantelElegido);
      if (r.error) {
        setError(`Ocurrió un error inesperado: ${r.error}`);
        return;
      }
      setExistentes(jugadores);
      setMapeo(r);
      setPaso({ tipo: 'jugadores' });
    } catch (e) {
      setError(mensajeDeError(e, 'Ocurrió un error inesperado.'));
    } finally {
      setCargandoJugadores(false);
    }
  }

  /**
   * Vuelve a leer el club y remapea con lo mismo que se leyó del archivo, para que el próximo guardado no
   * choque contra el jugador o la pertenencia que otro profe acaba de cargar. Si ni esto se puede, queda
   * «Guardar» apagado: forzar un reintento con datos viejos repetiría el mismo choque.
   */
  async function refrescarYRemapear() {
    if (!datos || !condicion || !plantelElegido) return;
    try {
      const jugadores = await (await cargar()).obtenerJugadoresDelClub(clubId);
      const r = mapear(jugadores, condicion, plantelElegido);
      if (r.error) return setBloqueado(true);
      setExistentes(jugadores);
      setMapeo(r);
      setDecisiones({});
      setExcluidos(new Set());
    } catch {
      setBloqueado(true);
    }
  }

  const aCrear = !mapeo ? 0
    : mapeo.jugadoresNuevos.filter((j) => !excluidos.has(j.nombreClave)).length
      + mapeo.sugerencias.filter((s) => decisiones[s.nombreClave] === 'otro' && !excluidos.has(s.nombreClave)).length;

  async function guardarPartido() {
    if (!datos || !mapeo || !plantelElegido || !condicion || guardar.isPending) return;
    setError(null);
    const { payload, error: errorPayload } = prepararPayloadImportacion(
      mapeo,
      existentes,
      { sugerencias: decisiones, nuevosExcluidos: [...excluidos] },
      {
        temporadaId: plantelElegido.temporadaId,
        hashArchivo: datos.hash,
        idPartidoCabb: datos.leido.origen.idPartidoCabb,
        nombreArchivo: datos.nombreArchivo,
        advertencias: datos.leido.advertencias,
      },
    ) as { payload: unknown; error: string | null };
    if (errorPayload) {
      setError(`Ocurrió un error inesperado: ${errorPayload}`);
      return;
    }
    try {
      await guardar.mutateAsync(payload);
    } catch (e) {
      setError(mensajeDeGuardado(e, 'No se pudo guardar. Intentá de nuevo.', REGLAS_PARTIDO));
      if (esChoqueConOtroProfe(e)) await refrescarYRemapear();
      return;
    }
    // Lo que ya se pidió de Datos queda viejo: el partido nuevo tiene que aparecer sin recargar.
    await consultas.invalidateQueries({ queryKey: ['datos'] });
    const rival = datos.leido.equipos.find((e) => e.condicion !== condicion)?.nombre ?? 'el rival';
    setPaso({ tipo: 'resultado', resumen: textoPartidoGuardado(rival, aCrear) });
  }

  return (
    <>
      <Link to="/datos" className={enlaceVolver}>
        <ArrowLeft aria-hidden className="size-4" />
        Volver a Datos
      </Link>
      <header className="mb-5">
        <p className="font-mono text-xs tracking-wide text-gris uppercase">Datos</p>
        <h1 className="font-titulo text-4xl leading-none font-bold tracking-tight lg:text-5xl">Cargar partido</h1>
      </header>

      {paso.tipo === 'archivo' && (
        <Panel titulo="Planilla del partido">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gris">
              Elegí la planilla <b>.xlsx</b> que exporta la app de la CABB. Se lee en tu dispositivo y recién se guarda al final, cuando confirmes.
            </p>
            <CampoDeArchivo etiqueta="Planilla del partido (.xlsx)" alElegir={(a) => void leer(a)} disabled={paso.leyendo} />
            <div aria-live="polite" className="flex flex-col gap-3">
              {paso.leyendo && <p role="status" className="text-sm text-gris">Leyendo archivo…</p>}
              {paso.fallo}
            </div>
            {paso.fallo && <Link to="/datos" className={cn(claseBoton({ variante: 'contorno' }), 'self-start')}>Volver</Link>}
          </div>
        </Panel>
      )}

      {paso.tipo === 'equipo' && datos && (
        <PasoEquipoYPlantel
          datos={datos}
          condicion={condicion}
          alElegirEquipo={setCondicion}
          fecha={fecha}
          alCambiarFecha={setFecha}
          elegido={elegido}
          alElegirPlantel={setElegido}
          sugeridoId={datos.planteles.find((p) => p.codigoCabb === datos.leido.partido.categoria)?.id ?? null}
          cargando={cargandoJugadores}
          error={error}
          alAvanzar={() => void verJugadores()}
        />
      )}

      {paso.tipo === 'jugadores' && mapeo && plantelElegido && (
        <PasoJugadores
          mapeo={mapeo}
          categoria={plantelElegido.categoria}
          decisiones={decisiones}
          alDecidir={(clave, d) => setDecisiones((x) => ({ ...x, [clave]: d }))}
          excluidos={excluidos}
          alAlternar={(clave) => setExcluidos((s) => {
            const otro = new Set(s);
            if (otro.has(clave)) otro.delete(clave);
            else otro.add(clave);
            return otro;
          })}
          aCrear={aCrear}
          guardando={guardar.isPending}
          bloqueado={bloqueado}
          error={error}
          alGuardar={() => void guardarPartido()}
        />
      )}

      {paso.tipo === 'resultado' && datos && (
        <div className="flex flex-col gap-4">
          <Aviso tono="ok" titulo={paso.resumen} />
          {datos.leido.advertencias.length > 0 && (
            <details className="rounded-tarjeta bg-sup-2 px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{textoDeAdvertencias(datos.leido.advertencias.length)}</summary>
              <ul aria-label="Advertencias del archivo" className="flex flex-col gap-2 pb-2">
                {datos.leido.advertencias.map((a, i) => <li key={i}><Aviso titulo={a.mensaje} /></li>)}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Boton onClick={reiniciar}>Cargar otro partido</Boton>
            <Link to="/datos" className={claseBoton({ variante: 'contorno' })}>Ver los datos</Link>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Paso 2: equipo, fecha y plantel ---------- */

function PasoEquipoYPlantel({
  datos, condicion, alElegirEquipo, fecha, alCambiarFecha, elegido, alElegirPlantel, sugeridoId, cargando, error, alAvanzar,
}: {
  datos: Datos;
  condicion: 'local' | 'visitante' | null;
  alElegirEquipo: (c: 'local' | 'visitante') => void;
  fecha: string;
  alCambiarFecha: (f: string) => void;
  elegido: string | null;
  alElegirPlantel: (id: string) => void;
  sugeridoId: string | null;
  cargando: boolean;
  error: string | null;
  alAvanzar: () => void;
}) {
  const [equipoA, equipoB] = datos.leido.equipos;
  const propio = condicion ? datos.leido.equipos.find((e) => e.condicion === condicion) : null;
  const rival = condicion ? datos.leido.equipos.find((e) => e.condicion !== condicion) : null;
  const listo = !!condicion && !!elegido && !!fecha;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titulo="¿Cuál es tu equipo?">
          <div role="group" aria-label="Tu equipo" className="grid gap-2 sm:grid-cols-2">
            {[equipoA, equipoB].map((e) => (
              <CardBoton
                key={e.condicion}
                aria-pressed={condicion === e.condicion}
                onClick={() => alElegirEquipo(e.condicion)}
                className="flex min-h-14 items-center justify-between gap-2 px-4 py-3 font-semibold"
              >
                <span className="min-w-0 truncate">{e.nombre ?? '(sin nombre)'}</span>
                {condicion === e.condicion && <Check aria-hidden className="size-5 shrink-0 text-club-texto" />}
              </CardBoton>
            ))}
          </div>
          {propio && rival && (
            <p className="mt-3 flex items-baseline justify-center gap-4 text-center" aria-label="Marcador">
              <span><span className="cifra block font-titulo text-5xl leading-none font-bold">{propio.totales?.pts ?? '-'}</span><span className="text-sm text-gris">Nosotros</span></span>
              <span className="font-mono text-xs text-gris">VS</span>
              <span><span className="cifra block font-titulo text-5xl leading-none font-bold">{rival.totales?.pts ?? '-'}</span><span className="text-sm text-gris">{rival.nombre ?? 'Rival'}</span></span>
            </p>
          )}
        </Panel>

        <Panel titulo="Fecha del partido">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Día en que se jugó</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => alCambiarFecha(e.target.value)}
              className="h-11 w-full rounded-campo border border-borde-control bg-sup px-3 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta sm:max-w-xs"
            />
          </label>
        </Panel>
      </div>

      <Panel titulo="Plantel">
        {datos.planteles.length === 0 ? (
          <p className="text-sm text-gris">Todavía no hay planteles en el club.</p>
        ) : (
          <div role="group" aria-label="Plantel del partido" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {datos.planteles.map((p) => (
              <CardBoton key={p.id} aria-pressed={elegido === p.id} onClick={() => alElegirPlantel(p.id)} className="flex min-h-14 items-center justify-between gap-2 px-4 py-3">
                <span className="font-semibold">{p.categoria}</span>
                {p.id === sugeridoId && <Chip>Sugerido</Chip>}
              </CardBoton>
            ))}
          </div>
        )}
      </Panel>

      {error && <Aviso tono="error" titulo={error} />}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={alAvanzar} disabled={!listo || cargando} flecha={listo}>
          {cargando ? 'Cargando plantel…' : listo ? 'Ver jugadores' : 'Elegí tu equipo y el plantel'}
        </Boton>
        <Link to="/datos" className={claseBoton({ variante: 'contorno' })}>Volver</Link>
      </div>
    </div>
  );
}

/* ---------- Paso 3: los jugadores ---------- */

function Grupo({ titulo, cantidad, abierto, children }: { titulo: string; cantidad: number; abierto: boolean; children: ReactNode }) {
  return (
    <details open={abierto && cantidad > 0} className="group rounded-[0.6875rem] border border-linea bg-sup shadow-tarjeta">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-tinta">
        <h2 className="font-titulo text-lg leading-none font-semibold tracking-[.12em] text-gris uppercase">{titulo}</h2>
        <span className="flex items-center gap-2">
          <span className="cifra font-mono text-sm">{cantidad}</span>
          <ChevronDown aria-hidden className="size-4 text-gris transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="px-4 pb-4">
        {cantidad > 0 ? children : <p className="text-sm text-gris">Ninguno.</p>}
      </div>
    </details>
  );
}

const FILA = 'flex min-h-12 items-center justify-between gap-3 rounded-tarjeta bg-sup-2 px-4 py-2';

function PasoJugadores({
  mapeo, categoria, decisiones, alDecidir, excluidos, alAlternar, aCrear, guardando, bloqueado, error, alGuardar,
}: {
  mapeo: Mapeo;
  categoria: string;
  decisiones: Record<string, Decision>;
  alDecidir: (clave: string, d: Decision) => void;
  excluidos: Set<string>;
  alAlternar: (clave: string) => void;
  aCrear: number;
  guardando: boolean;
  bloqueado: boolean;
  error: string | null;
  alGuardar: () => void;
}) {
  const yaCargados = mapeo.jugadoresCoincidentes.filter((c) => !c.requierePertenenciaNueva);
  const otraCategoria = mapeo.jugadoresCoincidentes.filter((c) => c.requierePertenenciaNueva);
  const faltaDecidir = mapeo.sugerencias.some((s) => !decisiones[s.nombreClave]);
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm text-gris"><FileSpreadsheet aria-hidden className="size-4" />Revisá a los jugadores del archivo antes de guardar.</p>

      <Grupo titulo="Ya cargados" cantidad={yaCargados.length} abierto={false}>
        <ul aria-label="Ya cargados" className="flex flex-col gap-2">
          {yaCargados.map((c) => <li key={c.nombreClave} className={FILA}><span className="font-semibold">{c.nombreClave}</span></li>)}
        </ul>
      </Grupo>

      <Grupo titulo="Ya está en otra categoría" cantidad={otraCategoria.length} abierto>
        <ul aria-label="Ya está en otra categoría" className="flex flex-col gap-2">
          {otraCategoria.map((c) => (
            <li key={c.nombreClave} className={FILA}>
              <span>
                <span className="block font-semibold">{c.nombreClave}</span>
                <span className="block text-sm text-gris">Ya está cargado en otra categoría, se lo suma también a {categoria}</span>
              </span>
            </li>
          ))}
        </ul>
      </Grupo>

      <Grupo titulo="Posible coincidencia" cantidad={mapeo.sugerencias.length} abierto>
        <ul aria-label="Posible coincidencia" className="flex flex-col gap-2">
          {mapeo.sugerencias.map((s) => (
            <li key={s.nombreClave} className="flex flex-col gap-2 rounded-tarjeta bg-sup-2 px-4 py-3">
              <span>
                <span className="block font-semibold">{s.nombreLimpio}</span>
                <span className="block text-sm text-gris">¿Es {s.candidato.nombreLimpio}, ya cargado?</span>
              </span>
              <span role="group" aria-label={`¿Es el mismo que ${s.candidato.nombreLimpio}?`} className="flex flex-wrap gap-2">
                {([['mismo', 'Es el mismo'], ['otro', 'Es otro']] as const).map(([valor, texto]) => (
                  <CardBoton
                    key={valor}
                    aria-pressed={decisiones[s.nombreClave] === valor}
                    onClick={() => alDecidir(s.nombreClave, valor)}
                    className="min-h-11 px-4 text-sm font-semibold"
                  >
                    {texto}
                  </CardBoton>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Grupo>

      <Grupo titulo="Nuevos" cantidad={mapeo.jugadoresNuevos.length} abierto>
        <ul aria-label="Nuevos" className="flex flex-col gap-2">
          {mapeo.jugadoresNuevos.map((n) => (
            <li key={n.nombreClave}>
              <label className={cn(FILA, 'cursor-pointer', excluidos.has(n.nombreClave) && 'opacity-70')}>
                <span className="font-semibold">{n.nombreLimpio}</span>
                <input
                  type="checkbox"
                  checked={!excluidos.has(n.nombreClave)}
                  onChange={() => alAlternar(n.nombreClave)}
                  aria-label={n.nombreLimpio}
                  className="size-6 shrink-0 accent-[var(--club)]"
                />
              </label>
            </li>
          ))}
        </ul>
      </Grupo>

      {error && <Aviso tono="error" titulo={error} />}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={alGuardar} disabled={faltaDecidir || guardando || bloqueado}>
          {guardando ? 'Guardando…' : faltaDecidir ? 'Confirmá las coincidencias' : `Guardar (${textoDeJugadoresNuevos(aCrear)})`}
        </Boton>
        <Link to="/datos" className={claseBoton({ variante: 'contorno' })}>Volver</Link>
      </div>
    </div>
  );
}
