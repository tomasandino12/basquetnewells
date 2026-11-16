import { ChevronRight, Dumbbell } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { usePlantelId } from '../plantel/activo';
import { elegirPlanVisible, fechaLocal } from '@datos/escalones.js';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { usePlanesFisicos, usePlanFisico } from '../datos/consultas';
import type { SesionFisico } from '../datos/repositorio';
import {
  avanceDelPlan, diaDeSesion, proximaSesion, rangoDePlan, resumenDeSesion, textoDeEstado, type PlanConRango,
} from '../fisico/plan';
import { enlaceBoton } from '../fisico/estilos';
import { ConPlantel } from './ConPlantel';
import { APP_DE_SIEMPRE } from '../clasica';

const APP_ANTERIOR = APP_DE_SIEMPRE;

/**
 * El plan de fuerza de una categoría. Cuál se muestra lo decide elegirPlanVisible (el que contiene hoy,
 * si no el próximo, si no el último); los demás quedan en «Otros planes». El plan que se abre desde ahí
 * vive en la dirección (?plan=): cambiar de categoría lo olvida.
 */
export function Fisico() {
  const plantelId = usePlantelId();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: `/plantel`, texto: 'Plantel' }}
      soloCuerpoTecnico="La coordinación ve el plan de fuerza en la app anterior."
    >
      {(p) => <PlanDeLaCategoria {...p} />}
    </ConPlantel>
  );
}

function PlanDeLaCategoria({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const planes = usePlanesFisicos(clubId, plantelId);
  const [busqueda] = useSearchParams();
  const hoy = fechaLocal() as string;

  return (
    <>
      <header className="pt-2">
        <p className="text-sm text-gris">Plan de fuerza · {categoria}</p>
      </header>
      <Consulta consulta={planes} errorGenerico="No se pudo cargar el plan">
        {(lista) => {
          const eleccion = elegirPlanVisible(lista, hoy) as { visible: PlanConRango | null; otros: PlanConRango[] };
          if (!eleccion.visible) {
            return (
              <>
                <Vacio icono={Dumbbell} titulo="Plan de fuerza">
                  Cargá el plan de fuerza en .xlsx y queda guardado en la categoría elegida, con sus sesiones y sus ejercicios.
                </Vacio>
                <Pie />
              </>
            );
          }
          const todos = [eleccion.visible, ...eleccion.otros];
          const visible = todos.find((p) => p.id === busqueda.get('plan')) ?? eleccion.visible;
          const otros = todos.filter((p) => p.id !== visible.id);
          return <ConPlan key={visible.id} plantelId={plantelId} plan={visible} otros={otros} hoy={hoy} />;
        }}
      </Consulta>
    </>
  );
}

function ConPlan({ plantelId, plan, otros, hoy }: { plantelId: string; plan: PlanConRango; otros: PlanConRango[]; hoy: string }) {
  const sesiones = usePlanFisico(plan.id);
  return (
    <Consulta consulta={sesiones} errorGenerico="No se pudo cargar el plan">
      {(lista) => {
        const proxima = proximaSesion(lista, hoy);
        const { hechas, total } = avanceDelPlan(lista, hoy);
        return (
          <>
            <section aria-label="Plan elegido" className="mt-2">
              <h1 className="font-titulo text-4xl leading-none font-semibold break-words">{plan.nombreArchivo}</h1>
              <p className="mt-2 text-sm text-gris">
                {rangoDePlan(plan)} · {total} {total === 1 ? 'sesión' : 'sesiones'}
              </p>
              <p className="text-sm font-semibold">{textoDeEstado(plan, hoy)}</p>
              {total > 0 && (
                <div
                  role="progressbar"
                  aria-label="Sesiones que ya pasaron"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={hechas}
                  aria-valuetext={`${hechas} de ${total} sesiones`}
                  className="mt-3 h-1 overflow-hidden rounded-full bg-sup-2"
                >
                  <div className="h-full bg-club" style={{ width: `${(hechas / total) * 100}%` }} />
                </div>
              )}
            </section>

            {proxima && (
              <section aria-label="Próxima sesión" className="mt-6">
                <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">Próxima sesión</h2>
                <ul className="flex flex-col gap-2">
                  <FilaDeSesion plantelId={plantelId} planId={plan.id} sesion={proxima} hoy={hoy} />
                </ul>
              </section>
            )}

            <section aria-label="Sesiones" className="mt-6">
              <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">Sesiones</h2>
              {lista.length === 0 ? (
                <p className="text-sm text-gris">Este plan todavía no tiene sesiones.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lista.map((s) => (
                    <FilaDeSesion key={s.id} plantelId={plantelId} planId={plan.id} sesion={s} hoy={hoy} />
                  ))}
                </ul>
              )}
            </section>

            {otros.length > 0 && (
              <section aria-label="Otros planes" className="mt-6">
                <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">Otros planes</h2>
                <ul className="flex flex-col gap-2">
                  {otros.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/fisico?plan=${p.id}`}
                        className="flex min-h-14 items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.nombreArchivo}</span>
                          <span className="block text-sm text-gris">{rangoDePlan(p)} · {textoDeEstado(p, hoy)}</span>
                        </span>
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-gris" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Pie />
          </>
        );
      }}
    </Consulta>
  );
}

function FilaDeSesion({ plantelId, planId, sesion, hoy }: { plantelId: string; planId: string; sesion: SesionFisico; hoy: string }) {
  const esHoy = sesion.fecha === hoy;
  return (
    <li>
      <Link
        to={`/fisico/plan/${planId}/sesion/${sesion.id}`}
        className={`flex min-h-14 items-center justify-between gap-3 rounded-tarjeta border px-4 py-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta ${esHoy ? 'border-tinta bg-sup' : 'border-linea bg-sup'}`}
      >
        <span className="min-w-0">
          <span className="block font-titulo text-xl leading-tight font-semibold">{diaDeSesion(sesion.fecha, hoy)}</span>
          <span className="block text-sm text-gris">{resumenDeSesion(sesion)}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-gris" />
      </Link>
    </li>
  );
}

/**
 * Cargar el plan (lee un .xlsx) y el inventario todavía viven en la app anterior: el lector de planillas
 * no entra en el peso de la app nueva. Los enlaces están siempre, aunque no haya plan.
 */
function Pie() {
  return (
    <section aria-label="Más acciones de Físico" className="mt-8 flex flex-wrap gap-2 border-t border-linea pt-4">
      <p className="w-full text-sm text-gris">Todavía en la app anterior:</p>
      <a href={APP_ANTERIOR} className={enlaceBoton}>Cargar plan de fuerza</a>
      <Link to="/fisico/inventario" className={enlaceBoton}>Inventario del club</Link>
    </section>
  );
}
