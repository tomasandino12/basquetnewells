import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { armarProfes, plantelesEnOrdenDeCatalogo, temporadaMasReciente } from '@datos/coordinacion.js';
import { temporadaComoAnio } from '@datos/categorias.js';
import { agruparPases, DESPUES, filasParaConfirmar, NO_SIGUE, proponerPases } from '@datos/pasesDeTemporada.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton, claseBoton } from '../../components/ui/button';
import { Consulta } from '../../components/ui/consulta';
import { useAccionCoord, useDatosDeTemporada } from '../../coord/consultas';
import { Confirmar, Hecho, Rotulo, Seleccion, TITULO_DE_PANTALLA } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { PlantelDelClub } from '../../datos/repositorio';
import { useClubCoord } from './MarcoCoord';

const REGLAS: [RegExp, string][] = [
  [/TEMPORADA_NO_ES_POSTERIOR/, 'Esa temporada ya existe o es anterior a la actual.'],
  [/PLANTEL_FUERA_DE_LA_TEMPORADA/, 'Alguno de los planteles no es de la temporada nueva. Actualizá la pantalla.'],
  [/JUGADOR_DE_OTRO_CLUB/, 'Alguno de los chicos no es de este club. Actualizá la pantalla.'],
];
const mensajeDeTemporada = (e: unknown) => mensajeDeGuardado(e, 'No se pudo guardar. Probá de nuevo.', REGLAS);

interface Propuesto {
  jugadorId: string;
  nombreLimpio: string;
  anioNacimiento: number | null;
  codigos: string[];
  propuesto: string | null;
  sube?: boolean;
  motivo?: string;
}

/**
 * Cambio de temporada, en tres pasos que se ven en orden: abrir la temporada nueva, tener profe en cada
 * plantel y pasar a cada chico. Los profes van antes que los chicos a propósito: al confirmar se cierra
 * la pertenencia vieja, y sin profe en el plantel nuevo nadie vería a esos chicos. Nada se borra: la
 * historia queda en las temporadas anteriores. Los nombres de los chicos son los de la lista de pases;
 * sólo coordinación los ve.
 */
export function CoordTemporada() {
  const clubId = useClubCoord();
  const datos = useDatosDeTemporada(clubId);
  const [hecho, setHecho] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITULO_DE_PANTALLA}>Cambio de temporada</h1>
        <Link to="/coordinacion/profes" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Volver a Profes</Link>
      </div>
      <Hecho texto={hecho} />
      <Consulta consulta={datos} errorGenerico="No se pudo cargar el cambio de temporada.">
        {(d) => <Pasos clubId={clubId} datos={d} alHacer={setHecho} />}
      </Consulta>
    </div>
  );
}

type Datos = NonNullable<ReturnType<typeof useDatosDeTemporada>['data']>;

function Pasos({ clubId, datos, alHacer }: { clubId: string; datos: Datos; alHacer: (t: string) => void }) {
  const vigente = temporadaMasReciente(datos.temporadas) as { id: string; nombre: string } | null;
  const planteles = plantelesEnOrdenDeCatalogo(datos.planteles, datos.catalogo, vigente?.id) as PlantelDelClub[];
  const sinProfe = (armarProfes({ ...datos, pendientes: [], usuarioActualId: null }) as { sinProfe: PlantelDelClub[] }).sinProfe;
  const anio = temporadaComoAnio(vigente?.nombre) as number | null;

  if (anio == null) {
    return <p className="text-sm text-gris">La temporada actual ({vigente?.nombre ?? 'ninguna'}) no es un año, así que no se puede armar el cambio automático.</p>;
  }
  if (!datos.pases.length) return <AbrirTemporada clubId={clubId} vigente={vigente!.nombre} anio={anio} alHacer={alHacer} />;
  return <PasarChicos clubId={clubId} vigente={vigente!.nombre} anio={anio} planteles={planteles} sinProfe={sinProfe} pases={datos.pases} alHacer={alHacer} />;
}

function AbrirTemporada({ clubId, vigente, anio, alHacer }: { clubId: string; vigente: string; anio: number; alHacer: (t: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  const abrir = useAccionCoord((repo, nombre: string) => repo.abrirTemporada({ clubId, nombre }));
  return (
    <section aria-label="Paso 1" className="max-w-2xl">
      <Rotulo>Paso 1 · Abrir la temporada nueva</Rotulo>
      <p className="mb-4 text-sm">
        Hoy la temporada es la <b>{vigente}</b> y no queda ningún chico por pasar. Cuando arranque la {anio + 1}, abrila acá: se crean los mismos
        planteles y después elegís a cuál pasa cada chico. No se borra nada de lo que ya está cargado.
      </p>
      <Boton onClick={() => setAbierta(true)}>Abrir la temporada {anio + 1}</Boton>
      <Confirmar
        abierta={abierta}
        alCerrar={() => setAbierta(false)}
        titulo={`Abrir la temporada ${anio + 1}`}
        texto={`Se crea la temporada ${anio + 1} con los mismos planteles que la actual. Desde ahora el panel de coordinación muestra la ${anio + 1}. Los chicos siguen en su plantel de ahora hasta que los pases.`}
        verbo={`Abrir la ${anio + 1}`}
        mensajeDeError={mensajeDeTemporada}
        alConfirmar={async () => {
          await abrir.mutateAsync(String(anio + 1));
          alHacer(`Listo: la temporada ${anio + 1} está abierta.`);
        }}
      />
    </section>
  );
}

function PasarChicos({ clubId, vigente, anio, planteles, sinProfe, pases, alHacer }: {
  clubId: string;
  vigente: string;
  anio: number;
  planteles: PlantelDelClub[];
  sinProfe: PlantelDelClub[];
  pases: Datos['pases'];
  alHacer: (t: string) => void;
}) {
  const propuestos = useMemo(() => proponerPases(pases, planteles, anio) as Propuesto[], [pases, planteles, anio]);
  // Lo que eligió la persona; mientras no toque nada, vale la propuesta (o «decidir después» si no hay).
  const [cambios, setCambios] = useState<Record<string, string>>({});
  const eleccion = (p: Propuesto) => cambios[p.jugadorId] ?? p.propuesto ?? DESPUES;
  const grupos = agruparPases(propuestos, planteles) as { plantelId: string | null; filas: Propuesto[] }[];
  const [confirmando, setConfirmando] = useState(false);
  const [sinElegir, setSinElegir] = useState(false);
  const confirmar = useAccionCoord((repo, filas: { jugadorId: string; plantelId: string | null }[]) => repo.confirmarPases({ clubId, filas }));

  const filas = filasParaConfirmar(propuestos.map((p) => ({ jugadorId: p.jugadorId, eleccion: eleccion(p) }))) as { jugadorId: string; plantelId: string | null }[];
  const noSiguen = filas.filter((f) => f.plantelId === null).length;
  const pasan = filas.length - noSiguen;

  return (
    <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <Rotulo>Paso 1 · Temporada {vigente} abierta ✔</Rotulo>
        {sinProfe.length > 0 ? (
          <Aviso tono="info" titulo={`Paso 2 · Falta profe en ${sinProfe.map((p) => p.categoria).join(', ')}.`} className="mt-2">
            Si pasás a los chicos ahora, nadie los va a ver hasta que haya un profe asignado.
            <Link to="/coordinacion/profes" className={`${claseBoton({ variante: 'contorno', tamano: 'chico' })} mt-3`}>Asignar profes</Link>
          </Aviso>
        ) : (
          <p className="mt-2 text-sm"><b>Paso 2 ·</b> Todos los planteles de la {vigente} tienen profe. ✔</p>
        )}
      </div>

      <div>
        <Rotulo cuenta={propuestos.length}>Paso 3 · Pasar a los chicos</Rotulo>
        <p className="mb-2 text-sm text-gris">
          Esta es la propuesta según el año de nacimiento. Cambiala donde no coincida y confirmá. Podés confirmar de a tandas: los que dejes en
          «Decidir después» siguen en esta pantalla.
        </p>
        {grupos.map((g) => (
          <section key={g.plantelId ?? 'decidir'} aria-label={g.plantelId ? `Van a ${planteles.find((p) => p.id === g.plantelId)?.categoria}` : 'Para decidir vos'}>
            <Rotulo cuenta={g.filas.length}>
              {g.plantelId ? `Van a ${planteles.find((p) => p.id === g.plantelId)?.categoria}` : 'Para decidir vos'}
            </Rotulo>
            <ul className="grid gap-2 xl:grid-cols-2">
              {g.filas.map((c) => (
                <li key={c.jugadorId} className="rounded-tarjeta border border-linea bg-sup p-3">
                  <Seleccion
                    etiqueta={c.nombreLimpio}
                    value={eleccion(c)}
                    onChange={(e) => setCambios((x) => ({ ...x, [c.jugadorId]: e.target.value }))}
                  >
                    <option value={DESPUES}>Decidir después</option>
                    {planteles.map((p) => <option key={p.id} value={p.id}>{p.categoria}</option>)}
                    <option value={NO_SIGUE}>No sigue en el club</option>
                  </Seleccion>
                  <p className="mt-1 text-xs text-gris">
                    Nació en {c.anioNacimiento ?? '¿?'} · hoy en {c.codigos.join(' y ')} · {c.propuesto ? (c.sube ? 'Sube de categoría' : 'Sigue en la misma') : c.motivo}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {sinElegir && <Aviso tono="info" titulo="No elegiste a nadie todavía." className="mt-4" />}
        <div className="mt-6">
          <Boton
            onClick={() => {
              if (!filas.length) {
                setSinElegir(true);
                return;
              }
              setSinElegir(false);
              setConfirmando(true);
            }}
          >
            Confirmar los pases
          </Boton>
        </div>
      </div>

      <Confirmar
        abierta={confirmando}
        alCerrar={() => setConfirmando(false)}
        titulo="Confirmar los pases"
        texto={`Pasan ${pasan} chico${pasan === 1 ? '' : 's'} a su categoría nueva${noSiguen ? ` y ${noSiguen} dejan de estar en el club (se borran sus datos de emergencia; su historia queda)` : ''}. Su recorrido en la ${vigente} queda guardado.`}
        verbo="Confirmar"
        mensajeDeError={mensajeDeTemporada}
        alConfirmar={async () => {
          const r = await confirmar.mutateAsync(filas);
          setCambios({});
          alHacer(`Listo: ${r.pasados} pasado${r.pasados === 1 ? '' : 's'}.`);
        }}
      />
    </div>
  );
}
