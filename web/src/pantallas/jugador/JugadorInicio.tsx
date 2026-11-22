import { useMemo, useState } from 'react';
import { recursosPracticables, semanaDePracticas, vecesEnLaSemana, vistaDeAsistencia } from '@datos/constancia.js';
import { fechaLocal } from '@datos/escalones.js';
import { proximaSesion } from '@datos/planDelJugador.js';
import { Consulta } from '../../components/ui/consulta';
import { mensajeDeGuardado } from '../../datos/errores';
import { useMarcarPractica, useMiAsistencia, useMisPracticas, useMisRecursos, useMiPlan } from '../../datos/consultasJugador';
import type { MiPlan, PracticaMarcada, RecursoDelJugador } from '../../datos/repositorio';
import { AsistenciaContinuada, AsistenciaDelPeriodo, CheckDeRutina, Semana } from '../../interacciones/Constancia';
import { Opciones } from '../../interacciones/piezas';
import { cn } from '../../lib/cn';
import { FilaDeSesion, sesionesDelJugador, type SesionDelJugador } from './JugadorFisico';

/**
 * Inicio del jugador: lo que sigue (la sesión de físico de hoy o la próxima), «Tu semana» (el check de la rutina
 * y la constancia) y «Tu asistencia». Cada bloque pide lo suyo y falla solo: si uno no carga, los otros se ven.
 * Lo que el jugador marca o ve lo decide la base (marcar_practica, mi_asistencia); acá sólo se muestra.
 */
export function JugadorInicio() {
  return (
    <>
      <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Inicio</h1>
      <div className="mt-4 flex flex-col gap-6">
        <LoQueSigue />
        <TuSemana />
        <TuAsistencia />
      </div>
    </>
  );
}

function LoQueSigue() {
  const plan = useMiPlan();
  return (
    <section aria-label="Lo que sigue">
      <Consulta consulta={plan} errorGenerico="No se pudo cargar tu plan" filas={1}>
        {(p) => <Proxima plan={p} />}
      </Consulta>
    </section>
  );
}

function Proxima({ plan }: { plan: MiPlan }) {
  const sesiones = useMemo(() => sesionesDelJugador(plan), [plan]);
  const hoy = fechaLocal() as string;
  const proxima = proximaSesion(sesiones, hoy) as SesionDelJugador | null;
  if (!proxima) {
    return <p className="text-sm text-gris">Cuando tu profe cargue la próxima sesión de físico, aparece acá.</p>;
  }
  return (
    <>
      <h2 className="mb-2 font-mono text-xs tracking-wide text-gris uppercase">{proxima.fecha === hoy ? 'Hoy' : 'Próxima sesión'}</h2>
      <FilaDeSesion sesion={proxima} hoy={hoy} conCategoria={plan.planes.length > 1} destacada />
    </>
  );
}

function TuSemana() {
  const recursos = useMisRecursos();
  const practicas = useMisPracticas();
  const hoy = fechaLocal() as string;
  // El día de la semana de hoy, en palabras. La fecha es 'AAAA-MM-DD' argentina: se lee en UTC para que no se corra.
  const dia = new Date(`${hoy}T12:00:00Z`).toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' });
  return (
    <section aria-labelledby="inicio-semana" className="flex flex-col gap-5 rounded-tarjeta border border-sobre-negro/15 bg-negro p-4 text-sobre-negro">
      <div className="flex items-baseline justify-between">
        <h2 id="inicio-semana" className="font-titulo text-2xl leading-none font-bold tracking-wide uppercase">Tu semana</h2>
        <p className="font-mono text-xs tracking-wide text-sobre-negro/60 uppercase">hoy · {dia}</p>
      </div>
      <Consulta consulta={recursos} errorGenerico="No se pudieron cargar tus recursos" filas={2}>
        {(lista) => (
          <Consulta consulta={practicas} errorGenerico="No se pudo cargar tu semana" filas={2}>
            {(marcas) => <Rutina recursos={lista} marcas={marcas ?? []} hoy={hoy} />}
          </Consulta>
        )}
      </Consulta>
    </section>
  );
}

function Rutina({ recursos, marcas, hoy }: { recursos: RecursoDelJugador[]; marcas: PracticaMarcada[]; hoy: string }) {
  const marcar = useMarcarPractica();
  const [abierta, setAbierta] = useState(false);
  const [nuevo, setNuevo] = useState<number | null>(null);

  const practicables = recursosPracticables(recursos) as RecursoDelJugador[];
  const dias = semanaDePracticas(marcas, hoy);
  const indiceDeHoy = dias.findIndex((d) => d.esHoy);
  const deHoy = new Set(marcas.filter((m) => m.fecha === hoy).map((m) => m.recursoId));
  const hechoHoy = deHoy.size > 0;

  // Una marca a la vez: dos toques seguidos no se pisan, y el segundo ya ve lo que devolvió la base.
  const practicar = (recursoId: string, hecho: boolean) => {
    if (marcar.isPending) return;
    marcar.mutate({ recursoId, hecho }, { onSuccess: () => setNuevo(hecho ? indiceDeHoy : null) });
  };
  const alCheck = () => {
    // Con un solo recurso no hay nada que elegir: marca directo. Con varios, abre la lista.
    if (practicables.length === 1) practicar(practicables[0].id, !deHoy.has(practicables[0].id));
    else setAbierta((a) => !a);
  };

  return (
    <>
      {practicables.length > 0 ? (
        <>
          <CheckDeRutina hecho={hechoHoy} alCambiar={alCheck} />
          {practicables.length > 1 && abierta && (
            <div role="group" aria-label="¿Qué practicaste?" className="flex flex-col gap-2">
              <p className="text-sm text-sobre-negro/70">Elegí cuál practicaste hoy. Podés marcar más de uno.</p>
              <ul className="flex flex-col gap-2">
                {practicables.map((r) => {
                  const hecho = deHoy.has(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-pressed={hecho}
                        onClick={() => practicar(r.id, !hecho)}
                        className={cn(
                          'flex min-h-11 w-full flex-col items-start justify-center rounded-campo border px-3 py-2 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima',
                          hecho ? 'border-lima bg-lima text-sobre-lima' : 'border-sobre-negro/25',
                        )}
                      >
                        <span className="font-semibold break-words">{r.titulo}</span>
                        {r.frecuenciaSemanal != null && (
                          <span className={cn('text-sm', hecho ? 'text-sobre-lima' : 'text-sobre-negro/70')}>
                            {vecesEnLaSemana(marcas, r.id, hoy) as number} de {r.frecuenciaSemanal} esta semana
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-sobre-negro/70">El check de tu rutina llega cuando tu profe te mande uno.</p>
      )}
      {marcar.isError && (
        <p role="alert" className="text-sm font-semibold">
          {mensajeDeGuardado(marcar.error, 'No pudimos guardar tu práctica.')}
        </p>
      )}
      <Semana dias={dias} nuevo={nuevo} />
    </>
  );
}

type Vista = 'ultimos' | 'mes' | 'anio';

function TuAsistencia() {
  const asistencia = useMiAsistencia();
  const [vista, setVista] = useState<Vista>('ultimos');
  const hoy = fechaLocal() as string;
  return (
    <section aria-labelledby="inicio-asistencia" className="flex flex-col gap-1">
      {/* El rótulo visible lo trae la propia tarjeta; este título es para quien navega por encabezados. */}
      <h2 id="inicio-asistencia" className="sr-only">Tu asistencia</h2>
      <Consulta consulta={asistencia} errorGenerico="No se pudo cargar tu asistencia" filas={2}>
        {(dias) =>
          !dias || dias.length === 0 ? (
            <p className="text-sm text-gris">Todavía no hay entrenamientos con asistencia tomada. Cuando tu profe la tome, la ves acá.</p>
          ) : (
            <>
              <Opciones
                etiqueta="Período de la asistencia"
                valor={vista}
                alCambiar={setVista}
                opciones={[{ id: 'ultimos', nombre: 'Últimos 10' }, { id: 'mes', nombre: 'Mes' }, { id: 'anio', nombre: 'Año' }]}
              />
              <Periodo dias={dias} vista={vista} hoy={hoy} />
            </>
          )
        }
      </Consulta>
    </section>
  );
}

function Periodo({ dias, vista, hoy }: { dias: { fecha: string; vino: boolean | null }[]; vista: Vista; hoy: string }) {
  const v = vistaDeAsistencia(dias, vista, hoy);
  const presencias = v.dias.map((d: { vino: boolean | null }) => d.vino);
  // key: al cambiar de vista la tarjeta entra de nuevo, como al cambiar de dato en el laboratorio.
  return vista === 'ultimos' ? (
    <AsistenciaContinuada key={vista} presencias={presencias} />
  ) : (
    <AsistenciaDelPeriodo key={vista} presencias={presencias} vino={v.vino} tomadas={v.tomadas} mejor={v.mejorRacha} />
  );
}
