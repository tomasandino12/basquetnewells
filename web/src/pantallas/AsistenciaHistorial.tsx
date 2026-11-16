import { ChevronRight, ClipboardCheck, Download } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { usePlantelActivo, usePlantelId } from '../plantel/activo';
import { bajarLibro, hojasDeAsistencia } from '../asistencia/planilla';
import { mensajeDeError } from '../datos/errores';
import { useRepositorio } from '../familias/consultas';
import { hoyLocal } from '@datos/antropometria.js';
import { detalleDelDia, textoDeFecha } from '../asistencia/toma';
import { Aviso } from '../components/ui/aviso';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { useHistorialDeAsistencia } from '../datos/consultas';
import { ConPlantel } from './ConPlantel';

const BOTON_PLANILLA =
  'inline-flex min-h-11 items-center gap-2 rounded-btn border border-borde-control px-3 font-titulo text-base font-semibold tracking-[.14em] uppercase outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:cursor-not-allowed disabled:text-gris [@media(hover:hover)]:hover:border-tinta';

const PLURAL = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Los entrenamientos de la categoría, el más reciente primero: tocar uno lo abre para verlo o corregirlo. */
export function AsistenciaHistorial() {
  const plantelId = usePlantelId();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: `/plantel`, texto: 'Plantel' }}
      soloCuerpoTecnico="La coordinación ve la asistencia de cada categoría en conjunto, no la de cada chico."
    >
      {(p) => <Dias clubId={p.clubId} plantelId={p.plantelId} categoria={p.categoria} />}
    </ConPlantel>
  );
}

function Dias({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const hoy = hoyLocal() as string;
  const dias = useHistorialDeAsistencia(plantelId, hoy);
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const historial = `/plantel/asistencia/historial`;

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
              <BajarPlanilla clubId={clubId} hoy={hoy} />
            </div>
            {lista.length === 0 ? (
              <Vacio
                icono={ClipboardCheck}
                titulo="Todavía no hay asistencia"
                accion={<Link to={`/plantel/asistencia`} className="inline-flex min-h-11 items-center rounded-btn bg-club px-5 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-club uppercase">Tomar asistencia</Link>}
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
                          to={`/plantel/asistencia?fecha=${d.fecha}`}
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

/**
 * Un .xlsx con una hoja por categoría del profe, para entregar al área. Se arma acá, en el dispositivo:
 * los nombres de los chicos no pasan por ningún servidor más que la base.
 */
function BajarPlanilla({ clubId, hoy }: { clubId: string; hoy: string }) {
  const cargar = useRepositorio();
  const planteles = usePlantelActivo()?.visibles ?? [];
  const [estado, setEstado] = useState<'libre' | 'armando'>('libre');
  const [resultado, setResultado] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  async function bajar() {
    if (estado === 'armando') return;
    setEstado('armando');
    setResultado(null);
    try {
      const hojas = await hojasDeAsistencia(await cargar(), clubId, planteles, hoy);
      await bajarLibro(hojas, `Asistencia ${hoy}.xlsx`);
      setResultado({ tono: 'ok', texto: 'Planilla lista' });
    } catch (e) {
      setResultado({ tono: 'error', texto: mensajeDeError(e, 'No se pudo armar la planilla. Probá de nuevo.') });
    } finally {
      setEstado('libre');
    }
  }

  return (
    <>
      <button type="button" onClick={() => void bajar()} disabled={estado === 'armando' || planteles.length === 0} className={BOTON_PLANILLA}>
        <Download aria-hidden className="size-4" />
        {estado === 'armando' ? 'Armando…' : 'Bajar planilla'}
      </button>
      <div aria-live="polite" className="w-full empty:hidden">
        {resultado && <Aviso tono={resultado.tono} titulo={resultado.texto} />}
      </div>
    </>
  );
}
