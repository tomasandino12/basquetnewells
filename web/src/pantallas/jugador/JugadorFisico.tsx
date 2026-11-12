import { CalendarCheck, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { fechaLocal } from '@datos/escalones.js';
import { sesionesDeLosPlanes, proximaSesion } from '@datos/planDelJugador.js';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { useMiPlan } from '../../datos/consultasJugador';
import type { LineaDeMiPlan, MiPlan } from '../../datos/repositorio';
import { diaDeSesion, resumenDeSesion } from '../../fisico/plan';

export type SesionDelJugador = { id: string; fecha: string; lineas: LineaDeMiPlan[]; plantelId: string; categoria: string };

/** Todas las sesiones de los planes del jugador, por fecha, cada una con la categoría de su plan. */
export const sesionesDelJugador = (plan: MiPlan): SesionDelJugador[] => sesionesDeLosPlanes(plan.planes) as SesionDelJugador[];

/**
 * Físico del jugador: la sesión de hoy (o la próxima) arriba y todas las del plan por fecha. El plan ya
 * viene elegido por la base (mi_plan): uno por cada categoría en la que está. Sólo lectura.
 */
export function JugadorFisico() {
  const plan = useMiPlan();
  return (
    <>
      <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Físico</h1>
      <div className="mt-4">
        <Consulta consulta={plan} errorGenerico="No se pudo cargar tu plan">
          {(p) => <Sesiones plan={p} />}
        </Consulta>
      </div>
    </>
  );
}

function Sesiones({ plan }: { plan: MiPlan }) {
  const sesiones = useMemo(() => sesionesDelJugador(plan), [plan]);
  const hoy = fechaLocal() as string;
  const proxima = proximaSesion(sesiones, hoy) as SesionDelJugador | null;
  const conCategoria = plan.planes.length > 1;

  if (sesiones.length === 0) {
    return (
      <Vacio icono={CalendarCheck} titulo="Todavía no hay nada cargado">
        Cuando tu profe cargue el plan de fuerza de tu categoría, vas a ver acá tus sesiones.
      </Vacio>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Lo que sigue">
        <h2 className="mb-2 font-mono text-xs tracking-wide text-gris uppercase">{proxima?.fecha === hoy ? 'Hoy' : 'Próxima sesión'}</h2>
        {proxima ? (
          <FilaDeSesion sesion={proxima} hoy={hoy} conCategoria={conCategoria} destacada />
        ) : (
          <p className="text-sm text-gris">Ya pasaron todas las sesiones de tu plan. Cuando tu profe cargue uno nuevo, aparece acá.</p>
        )}
      </section>
      <section aria-label="Todas las sesiones">
        <h2 className="mb-2 font-mono text-xs tracking-wide text-gris uppercase">Todas las sesiones</h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {sesiones.map((s) => (
            <li key={s.id}>
              <FilaDeSesion sesion={s} hoy={hoy} conCategoria={conCategoria} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FilaDeSesion({ sesion, hoy, conCategoria, destacada }: { sesion: SesionDelJugador; hoy: string; conCategoria: boolean; destacada?: boolean }) {
  return (
    <Link
      to={`/jugador/sesion/${sesion.id}`}
      className={`flex min-h-14 items-center justify-between gap-3 rounded-tarjeta border bg-sup px-4 py-3 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:bg-sup-2 ${destacada ? 'border-club' : 'border-linea'}`}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{diaDeSesion(sesion.fecha, hoy)}</span>
        <span className="block text-sm text-gris">{resumenDeSesion(sesion)}</span>
        {conCategoria && <span className="block text-sm text-gris">{sesion.categoria}</span>}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-gris" />
    </Link>
  );
}
