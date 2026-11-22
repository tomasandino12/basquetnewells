import { CalendarCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { agruparPorBloque, detalleDeLinea, fechaLocal, formatearKg } from '@datos/escalones.js';
import { pesoDeLinea, proximaSesion } from '@datos/planDelJugador.js';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { useMiPlan } from '../../datos/consultasJugador';
import type { LineaDeMiPlan, MiPlan } from '../../datos/repositorio';
import { VideoDeEjercicio } from '../../fisico/VideoDeEjercicio';
import { tituloDeSesion } from '../../fisico/plan';
import { sesionesDelJugador, type SesionDelJugador } from './JugadorFisico';

/**
 * Una sesión del plan del jugador: los ejercicios por bloque, en el orden del archivo, con series, reps, pausa y
 * notas, su peso actual donde lo hay y el video si lo tiene. Ni escalones ni botones de + y −: eso lo maneja el
 * profe. Sin `:sesionId` es la de hoy o, si no hay, la próxima (Inicio enlaza siempre a una con su id: la ruta sin id queda por si alguien la tiene guardada).
 */
export function JugadorSesion() {
  const { sesionId } = useParams();
  const plan = useMiPlan();
  return (
    <Consulta consulta={plan} errorGenerico="No se pudo cargar tu sesión">
      {(p) => <Sesion plan={p} sesionId={sesionId} />}
    </Consulta>
  );
}

function Sesion({ plan, sesionId }: { plan: MiPlan; sesionId: string | undefined }) {
  const sesiones = sesionesDelJugador(plan);
  const sesion = sesionId
    ? sesiones.find((s) => s.id === sesionId)
    : (proximaSesion(sesiones, fechaLocal() as string) as SesionDelJugador | null) ?? undefined;

  if (!sesion) {
    return (
      <Vacio
        icono={CalendarCheck}
        titulo={sesionId ? 'No encontramos esa sesión' : 'No hay sesión para mostrar'}
        accion={<Link to="/jugador/fisico" className="text-sm font-semibold underline">Ver todas las sesiones</Link>}
      >
        {sesionId ? 'Puede que tu profe haya cambiado el plan. Volvé a Físico y elegí la sesión de nuevo.' : 'Cuando tu profe cargue un plan nuevo, la próxima sesión aparece acá.'}
      </Vacio>
    );
  }
  const conCategoria = plan.planes.length > 1;
  return (
    <>
      <Link to="/jugador/fisico" className="mb-1 inline-flex min-h-11 items-center text-sm text-gris underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
        Todas las sesiones
      </Link>
      <header>
        <h1 className="font-titulo text-5xl leading-none font-semibold">{tituloDeSesion(sesion.fecha)}</h1>
        {conCategoria && <p className="mt-1 text-sm text-gris">{sesion.categoria}</p>}
      </header>
      {sesion.lineas.length === 0 ? (
        <p className="mt-6 text-sm text-gris">Esta sesión no tiene ejercicios.</p>
      ) : (
        (agruparPorBloque(sesion.lineas) as { bloque: string | null; lineas: LineaDeMiPlan[] }[]).map((g, i) => (
          <section key={`${g.bloque ?? ''}-${i}`} aria-label={g.bloque ?? 'Ejercicios'} className="mt-6">
            {g.bloque && <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">{g.bloque}</h2>}
            <ul className="grid gap-2 md:grid-cols-2">
              {g.lineas.map((l) => (
                <Ejercicio key={l.id} linea={l} kg={pesoDeLinea(l, plan.pesos) as number | null} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function Ejercicio({ linea, kg }: { linea: LineaDeMiPlan; kg: number | null }) {
  const detalle = detalleDeLinea(linea) as string;
  return (
    <li className="flex flex-col gap-1 rounded-tarjeta border border-linea bg-sup px-4 py-3">
      <span className="font-semibold break-words">
        {linea.orden != null && <span className="text-gris">{linea.orden} · </span>}
        {linea.nombreOriginal}
      </span>
      {detalle && <span className="text-sm text-gris">{detalle}</span>}
      {linea.notas && <span className="text-sm text-gris">{linea.notas}</span>}
      {(linea.video || kg != null) && (
        <span className="mt-1 flex flex-wrap items-center gap-3">
          {linea.video && <VideoDeEjercicio link={linea.video.link} titulo={linea.nombreOriginal} />}
          {kg != null && <span className="font-titulo text-xl leading-none font-semibold tabular-nums">Tu peso: {formatearKg(kg)} kg</span>}
        </span>
      )}
    </li>
  );
}
