import { ChevronRight, ClipboardCheck, Download } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { detalleDelDia, textoDeFecha } from '../asistencia/toma';
import { Aviso } from '../components/ui/aviso';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { useHistorialDeAsistencia } from '../datos/consultas';
import { ConPlantel } from './ConPlantel';
import { APP_DE_SIEMPRE } from '../clasica';

// La planilla del área (un .xlsx con una hoja por categoría) se arma todavía en la app anterior.
const APP_ANTERIOR = APP_DE_SIEMPRE;

const PLURAL = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Los entrenamientos de la categoría, el más reciente primero: tocar uno lo abre para verlo o corregirlo. */
export function AsistenciaHistorial() {
  const { plantelId } = useParams();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: `/plantel/${plantelId}`, texto: 'Plantel' }}
      soloCuerpoTecnico="La coordinación ve la asistencia de cada categoría en conjunto, no la de cada chico."
    >
      {(p) => <Dias plantelId={p.plantelId} categoria={p.categoria} />}
    </ConPlantel>
  );
}

function Dias({ plantelId, categoria }: { plantelId: string; categoria: string }) {
  const hoy = hoyLocal() as string;
  const dias = useHistorialDeAsistencia(plantelId, hoy);
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const historial = `/asistencia/${plantelId}/historial`;

  return (
    <>
      <p className="font-mono text-xs tracking-wide text-gris uppercase">Asistencia · {categoria}</p>
      <h1 className="font-titulo text-4xl leading-none font-semibold">Historial</h1>
      {aviso && <Aviso tono="ok" titulo={aviso} className="mt-3" />}
      <Consulta consulta={dias} errorGenerico="No se pudo cargar el historial de asistencia">
        {(lista) => (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gris">{lista.length} {PLURAL(lista.length, 'día', 'días')}</p>
              <a
                href={APP_ANTERIOR}
                className="inline-flex min-h-11 items-center gap-2 rounded-btn border border-borde-control px-3 font-titulo text-base font-semibold tracking-[.14em] uppercase outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
              >
                <Download aria-hidden className="size-4" />
                Bajar planilla
              </a>
            </div>
            {lista.length === 0 ? (
              <Vacio
                icono={ClipboardCheck}
                titulo="Todavía no hay asistencia"
                accion={<Link to={`/asistencia/${plantelId}`} className="inline-flex min-h-11 items-center rounded-btn bg-club px-5 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-club uppercase">Tomar asistencia</Link>}
              >
                Cuando tomes asistencia, cada entrenamiento aparece acá y podés bajar la planilla para el área.
              </Vacio>
            ) : (
              <>
                <p className="mt-3 text-sm text-gris">Tocá un día para verlo o corregirlo.</p>
                <ul aria-label="Entrenamientos" className="mt-2 flex flex-col gap-2 pb-6">
                  {lista.map((d) => {
                    const det = detalleDelDia(d);
                    return (
                      <li key={d.id}>
                        <Link
                          to={`/asistencia/${plantelId}?fecha=${d.fecha}`}
                          state={{ volverA: historial }}
                          className="flex min-h-14 items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 shadow-tarjeta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                        >
                          <span>
                            <span className="block font-titulo text-2xl leading-none font-semibold">{textoDeFecha(d.fecha)}</span>
                            <span className="block text-sm text-gris">
                              {det.tipo === 'sin-entrenamiento' && 'No hubo entrenamiento'}
                              {det.tipo === 'sin-tomar' && 'Sin tomar'}
                              {det.tipo === 'tomado' && (
                                <>
                                  <span className="font-mono">{det.presentes} de {det.tomados}</span> presentes
                                </>
                              )}
                            </span>
                          </span>
                          <ChevronRight aria-hidden className="size-5 shrink-0 text-gris" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </Consulta>
    </>
  );
}
