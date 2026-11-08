import { ChevronRight, Dumbbell } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { agruparPorBloque, pasoDeLinea } from '@datos/escalones.js';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { usePasos, usePlanesFisicos, usePlanFisico } from '../datos/consultas';
import type { LineaFisico, PasoFuerza } from '../datos/repositorio';
import { cargaCorta, detalleChico, textoDeEscalon, tituloDeSesion } from '../fisico/plan';
import { VideoDeEjercicio } from '../fisico/VideoDeEjercicio';
import { ConPlantel } from './ConPlantel';

/** Una sesión del plan: sus ejercicios por bloque, en el orden del archivo. Tocar uno abre los escalones de ese ejercicio. */
export function FisicoSesion() {
  const { plantelId, planId, sesionId } = useParams();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: `/fisico/${plantelId}`, texto: 'Plan de fuerza' }}
      soloCuerpoTecnico="La coordinación ve el plan de fuerza en la app anterior."
    >
      {(p) => <Sesion {...p} planId={planId!} sesionId={sesionId!} />}
    </ConPlantel>
  );
}

function Sesion({ clubId, plantelId, planId, sesionId }: { clubId: string; plantelId: string; planId: string; sesionId: string }) {
  const sesiones = usePlanFisico(planId);
  const planes = usePlanesFisicos(clubId, plantelId);
  const pasos = usePasos(clubId);
  const nombreDelPlan = planes.data?.find((p) => p.id === planId)?.nombreArchivo;

  return (
    <Consulta consulta={sesiones} errorGenerico="No se pudo cargar la sesión">
      {(lista) => {
        const sesion = lista.find((s) => s.id === sesionId);
        if (!sesion) {
          return (
            <Vacio icono={Dumbbell} titulo="No encontramos esa sesión" accion={<Link to={`/fisico/${plantelId}`} className="text-sm font-semibold underline">Ir al plan</Link>}>
              Puede que el plan se haya cambiado. Volvé al plan y elegí la sesión de nuevo.
            </Vacio>
          );
        }
        return (
          <>
            <header className="pt-2">
              <h1 className="font-titulo text-5xl leading-none font-semibold">{tituloDeSesion(sesion.fecha)}</h1>
              {nombreDelPlan && <p className="mt-1 text-sm text-gris">{nombreDelPlan}</p>}
            </header>
            {/* Los escalones son un agregado de la sesión: si fallan, los ejercicios se ven igual, sin escalón. */}
            {pasos.isError && (
              <p role="status" className="mt-3 text-sm text-gris">No se pudieron leer los escalones. Los ejercicios se ven igual.</p>
            )}
            {sesion.lineas.length === 0 ? (
              <p className="mt-6 text-sm text-gris">Esta sesión no tiene ejercicios.</p>
            ) : (
              (agruparPorBloque(sesion.lineas) as { bloque: string | null; lineas: LineaFisico[] }[]).map((g, i) => (
                <section key={`${g.bloque ?? ''}-${i}`} aria-label={g.bloque ?? 'Ejercicios'} className="mt-6">
                  {g.bloque && <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">{g.bloque}</h2>}
                  <ul className="flex flex-col gap-2">
                    {g.lineas.map((l) => (
                      <TarjetaDeEjercicio
                        key={l.id}
                        linea={l}
                        a={`/fisico/${plantelId}/plan/${planId}/sesion/${sesionId}/ejercicio/${l.id}`}
                        paso={(pasoDeLinea(l.nombreOriginal, pasos.data ?? []) as PasoFuerza | null)?.paso ?? null}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        );
      }}
    </Consulta>
  );
}

function TarjetaDeEjercicio({ linea, a, paso }: { linea: LineaFisico; a: string; paso: number | null }) {
  const carga = cargaCorta(linea.cargaSugerida);
  const detalle = detalleChico(linea);
  return (
    <li className="rounded-tarjeta border border-linea bg-sup">
      <Link
        to={a}
        className="flex items-center justify-between gap-3 rounded-tarjeta px-4 py-3 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:bg-sup-2"
      >
        <span className="min-w-0">
          <span className="block font-semibold break-words">
            {linea.orden != null && <span className="text-gris">{linea.orden} · </span>}
            {linea.nombreOriginal}
          </span>
          {detalle && <span className="block text-sm text-gris">{detalle}</span>}
          {linea.notas && <span className="block text-sm text-gris">{linea.notas}</span>}
          <span className="mt-1 block text-sm text-gris">{textoDeEscalon(linea, paso)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {carga && <span className="font-titulo text-3xl leading-none font-semibold tabular-nums">{carga}</span>}
          <ChevronRight aria-hidden className="size-5 text-gris" />
        </span>
      </Link>
      {linea.video && (
        <div className="px-4 pb-3">
          <VideoDeEjercicio link={linea.video.link} titulo={linea.nombreOriginal} />
        </div>
      )}
    </li>
  );
}
