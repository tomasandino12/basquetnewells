import { Link } from 'react-router';
import { siguientePasoDeMisiones, vincularPrevias } from '@datos/misiones.js';
import { claseBoton } from '../components/ui/button';
import { Panel } from '../components/ui/card';
import { Chip } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { useMisionesDeHoy } from '../datos/consultas';
import type { PartidoDelPlantel, PreviaDelPlantel } from '../datos/repositorio';

type Vinculos = Map<string, { partidoId: string | null; motivo: string }>;
type Paso = { paso: 'armar' | 'esperar' | 'evaluar'; previa: PreviaDelPlantel | null };

const fecha = (iso: string) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};
const nombre = (p: PreviaDelPlantel) => `${p.rival ?? 'Rival sin nombre'} · ${fecha(p.fecha)}`;

const TARJETA =
  'group block min-w-0 rounded-campo bg-sup-2 px-4 py-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:bg-linea';

/**
 * Las misiones del partido en Plantel: la tarjeta de lo que toca ahora (armar, esperar el partido o
 * evaluar) y las previas anteriores de la categoría. En Hoy van sólo las de marcar, en otra pieza.
 * Es un agregado: si no carga, lo dice acá y el resto del plantel se dibuja igual.
 */
export function MisionesDelPlantel({ clubId, plantelId }: { clubId: string; plantelId: string }) {
  const q = useMisionesDeHoy(clubId, plantelId);
  return (
    <Panel titulo="Misiones del partido" className="mt-6">
      <Consulta consulta={q} errorGenerico="No se pudieron cargar las misiones">
        {({ previas, partidos }) => <Contenido previas={previas} partidos={partidos} plantelId={plantelId} />}
      </Consulta>
    </Panel>
  );
}

function Contenido({ previas, partidos, plantelId }: { previas: PreviaDelPlantel[]; partidos: PartidoDelPlantel[]; plantelId: string }) {
  const vinculos = vincularPrevias(
    previas.map((p) => ({ ...p })),
    partidos.map((p) => ({ id: p.id, fecha: p.fecha, rivalNombre: p.rivalNombre, plantelId })),
  ) as Vinculos;
  const { paso, previa } = siguientePasoDeMisiones(previas, vinculos) as Paso;
  const sorted = [...previas].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return (
    <div className="flex flex-col gap-4">
      {paso === 'evaluar' && previa && (
        <Link to={`/misiones/${previa.id}`} className={TARJETA}>
          <span className="block font-titulo text-xl leading-tight font-semibold">Evaluá cómo salió</span>
          <span className="block text-sm text-gris">{nombre(previa)}</span>
        </Link>
      )}
      {paso === 'esperar' && previa && (
        <Link to={`/misiones/${previa.id}/armar`} className={TARJETA}>
          <span className="block font-titulo text-xl leading-tight font-semibold">Misiones armadas</span>
          <span className="block text-sm text-gris">{nombre(previa)}</span>
          <span className="block text-sm">Cuando cargues el partido, las evaluás desde acá.</span>
        </Link>
      )}
      {paso === 'armar' && (
        <Link to="/misiones/armar" className={TARJETA}>
          <span className="block font-titulo text-xl leading-tight font-semibold">Armá las misiones del próximo partido</span>
          <span className="block text-sm text-gris">Un aporte concreto para cada chico y un objetivo para el equipo.</span>
        </Link>
      )}
      {paso !== 'armar' && (
        <Link to="/misiones/armar" className={claseBoton({ variante: 'contorno', tamano: 'chico' }) + ' self-start'}>
          Armar otras misiones
        </Link>
      )}

      {sorted.length > 0 && (
        <section aria-label="Misiones anteriores">
          <h3 className="mb-2 font-mono text-xs tracking-wide text-gris uppercase">Anteriores</h3>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((p) => {
              // Con el partido cargado lo que falta es evaluar; si no, se abre la previa (que también lleva a evaluar desde su pie).
              const evaluable = vinculos.get(p.id)?.partidoId != null;
              return (
                <li key={p.id}>
                  <Link to={evaluable ? `/misiones/${p.id}` : `/misiones/${p.id}/armar`} className={TARJETA}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold break-words">{p.rival ?? 'Rival sin nombre'}</span>
                      <span className="font-mono text-xs text-gris">{fecha(p.fecha)}</span>
                    </span>
                    <Chip className="mt-1">{p.evaluada ? 'Evaluadas' : evaluable ? 'Falta evaluar' : 'Esperando el partido'}</Chip>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
