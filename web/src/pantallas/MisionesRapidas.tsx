import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cargando } from '../components/ui/estados';
import { Link } from 'react-router';
import { textoDeMision } from '@datos/misiones.js';
import { claseBoton } from '../components/ui/button';
import { Panel } from '../components/ui/card';
import { useDatosDeMisiones, useEvaluarMisiones } from '../datos/consultasJugador';
import { mensajeDeGuardado } from '../datos/errores';
import type { JugadorDelPlantel, MisionDePrevia, PreviaCompleta, PreviaDelPlantel } from '../datos/repositorio';
import { cn } from '../lib/cn';

type Estado = 'logrado' | 'en_proceso' | 'no_logrado';

interface Fila {
  id: string;
  tipo: 'equipo' | 'jugador';
  quien: string;
  texto: string;
  estado: Estado | null;
  comentario: string | null;
}

/** Cuántas misiones se ven de una vez: pocas, para marcarlas rápido sin perderse. */
export const POR_PAGINA = 3;

const ENLACE = claseBoton({ variante: 'contorno', tamano: 'chico' });
const ENLACE_LINEA = claseBoton({ variante: 'linea', tamano: 'chico' });

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const diaMes = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

/**
 * Las misiones del partido en la pantalla Hoy: las del último partido armado, de a 3, con un toque para
 * marcar «cumplida» (o «no la logró»). El detalle completo —con los números del partido— sigue en su pantalla.
 * La marca la pone el profe; la app no decide nada. Es un agregado: si no carga, Hoy sigue sin ella.
 */
export function MisionesDeHoy({ clubId, plantelId, previas }: { clubId: string; plantelId: string; previas: PreviaDelPlantel[] }) {
  const ultima = [...previas].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))[0];
  if (!ultima) return <Armar />;
  return <DeLaPrevia clubId={clubId} plantelId={plantelId} previa={ultima} />;
}

function Armar({ nota }: { nota?: string }) {
  return (
    <Panel titulo="Misiones del partido">
      <Link to="/misiones/armar" className="group block min-w-0 rounded-campo outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
        <span className="flex items-baseline gap-2 font-titulo text-2xl leading-tight font-semibold">
          <span>Armá las misiones del próximo partido</span>
          <span aria-hidden className="text-club-texto transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] [@media(hover:hover)]:group-hover:translate-x-1">
            ›
          </span>
        </span>
        <span className="block text-sm text-gris">{nota ?? 'Un aporte concreto para cada chico y un objetivo para el equipo.'}</span>
      </Link>
    </Panel>
  );
}

function DeLaPrevia({ clubId, plantelId, previa }: { clubId: string; plantelId: string; previa: PreviaDelPlantel }) {
  const q = useDatosDeMisiones(clubId, plantelId, previa.id);
  if (q.isError) {
    // Sin el detalle, igual se puede ir a evaluar a su pantalla.
    return (
      <Panel titulo="Misiones del partido">
        <Link to={`/misiones/${previa.id}`} className={ENLACE}>Evaluá cómo salió</Link>
      </Panel>
    );
  }
  const datos = q.data as { previa: PreviaCompleta | null; jugadores: JugadorDelPlantel[] } | undefined;
  if (!datos) {
    return (
      <Panel titulo="Misiones del partido">
        <Cargando filas={2} />
      </Panel>
    );
  }
  if (!datos.previa) return <Armar />;
  return <Lista key={datos.previa.id} previa={datos.previa} jugadores={datos.jugadores} />;
}

function Lista({ previa, jugadores }: { previa: PreviaCompleta; jugadores: JugadorDelPlantel[] }) {
  const guardar = useEvaluarMisiones();
  // Lo recién tocado se ve al instante; el guardado y la lectura de la base lo confirman enseguida.
  const [tocadas, setTocadas] = useState<Record<string, Estado | null>>({});
  const [error, setError] = useState<string | null>(null);

  const filas = useMemo<Fila[]>(() => {
    const nombreDe = (id: string | null | undefined) => jugadores.find((j) => j.id === id)?.nombreLimpio ?? 'Jugador';
    const de = (m: MisionDePrevia, tipo: Fila['tipo'], quien: string): Fila => ({
      id: m.id,
      tipo,
      quien,
      texto: textoDeMision(m) as string,
      estado: m.estado,
      comentario: m.comentario,
    });
    return [
      ...previa.misionesEquipo.map((m) => de(m, 'equipo', 'Equipo')),
      ...previa.misionesJugador
        .map((m) => de(m, 'jugador', nombreDe(m.jugadorId)))
        .sort((a, b) => a.quien.localeCompare(b.quien, 'es')),
    ];
  }, [previa, jugadores]);

  const estadoDe = (f: Fila): Estado | null => (f.id in tocadas ? tocadas[f.id] : f.estado);

  // Al abrir: si ya estaba todo evaluado no se muestra la lista (el ciclo cerró); si no, arranca donde falta.
  const [conPendientes] = useState(() => filas.some((f) => f.estado === null));
  const [pagina, setPagina] = useState(() => {
    const i = filas.findIndex((f) => f.estado === null);
    return i < 0 ? 0 : Math.floor(i / POR_PAGINA);
  });

  if (filas.length === 0) return <Armar />;
  if (!conPendientes) return <Armar nota={`Ya evaluaste las ${filas.length} del ${previa.rival ?? 'último partido'}.`} />;

  const total = filas.length;
  const hechas = filas.filter((f) => estadoDe(f) !== null).length;
  const visibles = filas.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);
  const puedeMarcar = previa.fecha <= hoy();

  const marcar = (f: Fila, estado: Estado) => {
    const nuevo = estadoDe(f) === estado ? null : estado;
    setError(null);
    setTocadas((t) => ({ ...t, [f.id]: nuevo }));
    guardar.mutate(
      { previaId: previa.id, partidoId: null, evaluaciones: [{ tipo: f.tipo, id: f.id, estado: nuevo, comentario: nuevo ? f.comentario : null }] },
      {
        onError: (e) => {
          setTocadas((t) => {
            const { [f.id]: _perdida, ...resto } = t;
            return resto;
          });
          setError(mensajeDeGuardado(e, 'No se pudo guardar esa marca. Probá de nuevo.', [[/SIN_PERMISO/, 'No tenés permiso para evaluar misiones en esta categoría.']]));
        },
      },
    );
  };

  return (
    <Panel titulo="Misiones del partido" accion={<span className="font-mono text-xs text-gris">{hechas} de {total}</span>}>
      <p className="font-mono text-xs text-gris">
        {previa.rival ?? 'Rival sin nombre'} · {diaMes(previa.fecha)}
      </p>
      <ul aria-label="Misiones" className="mt-1 flex flex-col divide-y divide-linea">
        {visibles.map((f) => {
          const estado = estadoDe(f);
          return (
            <li key={f.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs tracking-wide text-gris uppercase">{f.quien}</p>
                <p className="leading-snug font-semibold break-words">{f.texto}</p>
                {estado === 'en_proceso' && <p className="text-xs text-gris">En proceso</p>}
              </div>
              {puedeMarcar && (
                <div role="group" aria-label={`Cómo salió: ${f.texto}`} className="flex shrink-0 gap-2">
                  <BotonDeMarca
                    activo={estado === 'logrado'}
                    tono="logrado"
                    etiqueta={`Cumplida: ${f.texto}`}
                    alTocar={() => marcar(f, 'logrado')}
                  >
                    <Check aria-hidden className="size-5" strokeWidth={2.5} />
                  </BotonDeMarca>
                  <BotonDeMarca
                    activo={estado === 'no_logrado'}
                    tono="no_logrado"
                    etiqueta={`No la logró: ${f.texto}`}
                    alTocar={() => marcar(f, 'no_logrado')}
                  >
                    <X aria-hidden className="size-5" strokeWidth={2.5} />
                  </BotonDeMarca>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p role="alert" className="mt-2 text-sm font-semibold text-baja">{error}</p>}
      {hechas === total && <p role="status" className="mt-2 text-sm font-semibold text-sube">Listo: evaluaste las {total}.</p>}
      {!puedeMarcar && <p className="mt-2 text-sm text-gris">Para repasarlas antes de jugar. Se marcan desde el día del partido.</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-linea pt-3">
        <Link to={`/misiones/${previa.id}`} className={ENLACE}>
          {total > POR_PAGINA ? `Ver las ${total}` : 'Ver el detalle'}
        </Link>
        {total > POR_PAGINA && (
          <button type="button" className={ENLACE_LINEA} onClick={() => setPagina((p) => ((p + 1) * POR_PAGINA >= total ? 0 : p + 1))}>
            Siguientes
          </button>
        )}
        {!puedeMarcar && (
          <>
            <Link to={`/misiones/${previa.id}/armar`} className={ENLACE}>
              Cambiar las misiones
            </Link>
            <Link to="/misiones/armar" className={ENLACE}>
              Armar otras misiones
            </Link>
          </>
        )}
      </div>
    </Panel>
  );
}

/** Un toque marca, otro toque desmarca: se pudo errar el botón. La señal no es solo el color: lleva ícono. */
function BotonDeMarca({ activo, tono, etiqueta, alTocar, children }: { activo: boolean; tono: 'logrado' | 'no_logrado'; etiqueta: string; alTocar: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={alTocar}
      className={cn(
        'grid size-11 place-items-center rounded-btn border outline-offset-2 transition-transform duration-[var(--dur-1)] focus-visible:outline-2 focus-visible:outline-tinta active:scale-[.94]',
        activo
          ? tono === 'logrado'
            ? 'border-sube bg-sube text-sup'
            : 'border-baja bg-baja text-sup'
          : 'border-borde-control text-gris [@media(hover:hover)]:hover:border-tinta [@media(hover:hover)]:hover:text-tinta',
      )}
    >
      {children}
    </button>
  );
}
