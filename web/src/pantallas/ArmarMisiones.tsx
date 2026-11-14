import { Plus, Target, Trash2, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { LIMITE } from '@datos/limites.js';
import {
  MAX_DE_EQUIPO, MAX_POR_JUGADOR, metrica, metricasPara, prepararPayloadPrevia, textoDeMision, validarPrevia,
} from '@datos/misiones.js';
import { decimalEstricto } from '@datos/numeros.js';
import { Aviso } from '../components/ui/aviso';
import { Boton, claseBoton } from '../components/ui/button';
import { Card, Panel } from '../components/ui/card';
import { Campo } from '../components/ui/campo';
import { ChipBoton } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import { useDatosDeArmado, useGuardarPrevia } from '../datos/consultasJugador';
import { mensajeDeGuardado } from '../datos/errores';
import type { JugadorDelPlantel, PayloadDePrevia, PreviaCompleta } from '../datos/repositorio';
import { usePlantelId } from '../plantel/activo';
import { ConPlantel } from './ConPlantel';
import { TituloDeHoja } from './familias/piezas';

type Ambito = 'equipo' | 'jugador';

interface Mision {
  id: string;
  metrica: string | null;
  valor: number | null;
  texto: string | null;
  estado: string | null;
  comentario: string | null;
  jugadorId?: string;
}

interface Borrador {
  /** Se genera una sola vez, igual que el de cada misión: un reintento de «Guardar» manda los mismos y no duplica. */
  previaId: string;
  clubId: string;
  plantelId: string;
  fecha: string;
  rival: string;
  misionesJugador: Mision[];
  misionesEquipo: Mision[];
}

interface Metrica {
  clave: string;
  etiqueta: string;
  plural: string;
  sentido: 'al_menos' | 'como_maximo';
}

const SENTIDO = { al_menos: 'Al menos', como_maximo: 'Como máximo' };
const texto = (m: Mision) => textoDeMision(m) as string;

/**
 * Armar (o corregir) las misiones del próximo partido: un aporte concreto para cada chico y un
 * objetivo para el equipo. La app no propone ninguna métrica ni ningún valor: los pone el profe.
 * Con `:previaId` se edita la previa que ya está; sin él es una nueva.
 */
export function ArmarMisiones() {
  const { previaId } = useParams();
  const plantelId = usePlantelId();
  return (
    <ConPlantel plantelId={plantelId} volver={{ a: '/plantel', texto: 'Plantel' }} soloCuerpoTecnico="Las misiones las arma el cuerpo técnico.">
      {(p) => <Cargar key={`${p.plantelId}/${previaId ?? 'nueva'}`} clubId={p.clubId} plantelId={p.plantelId} categoria={p.categoria} previaId={previaId ?? null} />}
    </ConPlantel>
  );
}

function Cargar({ clubId, plantelId, categoria, previaId }: { clubId: string; plantelId: string; categoria: string; previaId: string | null }) {
  const datos = useDatosDeArmado(clubId, plantelId, previaId);
  return (
    <div className="pt-2 pb-8">
      <Consulta consulta={datos} errorGenerico="No se pudieron cargar las misiones">
        {({ jugadores, previa }) =>
          previaId && !previa ? (
            <Vacio icono={Target} titulo="No encontramos esas misiones" accion={<Link to="/plantel" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Volver al plantel</Link>}>
              Esa previa no existe o ya no es de tu categoría.
            </Vacio>
          ) : (
            <Formulario
              key={previa?.id ?? 'nueva'}
              clubId={clubId}
              plantelId={plantelId}
              categoria={categoria}
              previa={previa}
              jugadores={[...jugadores].sort((a, b) => a.nombreLimpio.localeCompare(b.nombreLimpio, 'es'))}
            />
          )
        }
      </Consulta>
    </div>
  );
}

function borradorInicial(clubId: string, plantelId: string, previa: PreviaCompleta | null): Borrador {
  if (!previa) {
    return { previaId: crypto.randomUUID(), clubId, plantelId, fecha: hoyLocal() as string, rival: '', misionesJugador: [], misionesEquipo: [] };
  }
  return {
    previaId: previa.id,
    clubId,
    plantelId,
    fecha: previa.fecha,
    rival: previa.rival ?? '',
    misionesJugador: previa.misionesJugador as unknown as Mision[],
    misionesEquipo: previa.misionesEquipo as unknown as Mision[],
  };
}

interface FormularioProps {
  clubId: string;
  plantelId: string;
  categoria: string;
  previa: PreviaCompleta | null;
  jugadores: JugadorDelPlantel[];
}

function Formulario({ clubId, plantelId, categoria, previa, jugadores }: FormularioProps) {
  const irA = useNavigate();
  const guardar = useGuardarPrevia();
  const [borrador, setBorrador] = useState(() => borradorInicial(clubId, plantelId, previa));
  const [error, setError] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState<{ ambito: Ambito; jugadorId?: string } | null>(null);

  const existe = previa !== null;
  // Con alguna misión ya evaluada la previa se cierra: sólo se corrige cómo salió, desde la evaluación.
  const evaluada = [...borrador.misionesJugador, ...borrador.misionesEquipo].some((m) => m.estado);
  const nombreDe = (id: string | undefined) => jugadores.find((j) => j.id === id)?.nombreLimpio ?? '';

  const cambiar = (c: Partial<Borrador>) => setBorrador((b) => ({ ...b, ...c }));
  const quitar = (ambito: Ambito, id: string) =>
    setBorrador((b) =>
      ambito === 'equipo'
        ? { ...b, misionesEquipo: b.misionesEquipo.filter((m) => m.id !== id) }
        : { ...b, misionesJugador: b.misionesJugador.filter((m) => m.id !== id) },
    );
  const agregar = (ambito: Ambito, jugadorId: string | undefined, mision: Mision) => {
    setBorrador((b) =>
      ambito === 'equipo'
        ? { ...b, misionesEquipo: [...b.misionesEquipo, mision] }
        : { ...b, misionesJugador: [...b.misionesJugador, { ...mision, jugadorId }] },
    );
    setEligiendo(null);
  };

  const alGuardar = () => {
    if (guardar.isPending) return;
    setError(null);
    const resultado = validarPrevia(borrador) as { ok: boolean; errores: string[] };
    if (!resultado.ok) {
      setError(resultado.errores.join(' '));
      return;
    }
    guardar.mutate(prepararPayloadPrevia(borrador) as PayloadDePrevia, {
      onSuccess: () => irA(-1),
      onError: (e) =>
        setError(
          mensajeDeGuardado(e, 'No se pudieron guardar las misiones.', [
            [/MISION_EVALUADA/, 'Alguna misión ya se evaluó y no se puede reemplazar.'],
            [/PREVIA_AJENA/, 'Esa previa es de otra categoría.'],
            [/SIN_PERMISO/, 'No tenés permiso para cargar misiones en esta categoría.'],
          ]),
        ),
    });
  };

  const puedeAgregarAlEquipo = !evaluada && borrador.misionesEquipo.length < MAX_DE_EQUIPO;

  return (
    <>
      <header>
        <p className="font-mono text-xs tracking-wide text-gris uppercase">Misiones del partido · {categoria}</p>
        <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">{existe ? 'Misiones del partido' : 'Armar misiones'}</h1>
        <p className="mt-2 text-sm text-gris">Antes del partido, un aporte concreto para cada chico y un objetivo para el equipo. Después marcás cómo salió.</p>
      </header>

      {evaluada && (
        <Aviso titulo="Este partido ya se evaluó" className="mt-4">
          Las misiones ya no se pueden cambiar; sí podés corregir cómo salió cada una desde la evaluación.
        </Aviso>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel titulo="El partido">
          <div className="flex flex-col gap-3">
            <Campo etiqueta="Fecha del partido" type="date" value={borrador.fecha} disabled={evaluada} onChange={(e) => cambiar({ fecha: e.target.value })} />
            <Campo
              etiqueta="Rival (opcional)"
              type="text"
              autoComplete="off"
              maxLength={LIMITE.rival}
              value={borrador.rival}
              disabled={evaluada}
              onChange={(e) => cambiar({ rival: e.target.value })}
              ayuda="Sirve para encontrar el partido cuando lo cargues, si ese día hubo dos."
            />
          </div>
        </Panel>

        <Panel titulo="Equipo">
          {borrador.misionesEquipo.length > 0 ? (
            <ul aria-label="Objetivos del equipo" className="flex flex-col divide-y divide-linea">
              {borrador.misionesEquipo.map((m) => (
                <FilaDeMision key={m.id} mision={m} bloqueada={evaluada} alQuitar={() => quitar('equipo', m.id)} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gris">Todavía no hay objetivo de equipo.</p>
          )}
          {puedeAgregarAlEquipo && (
            <Boton variante="contorno" tamano="chico" className="mt-3" onClick={() => setEligiendo({ ambito: 'equipo' })}>
              <Plus aria-hidden className="size-4" />
              Agregar objetivo
            </Boton>
          )}
        </Panel>
      </div>

      <h2 className="mt-8 mb-3 font-titulo text-2xl leading-none font-semibold">Jugadores</h2>
      {jugadores.length === 0 ? (
        <Vacio icono={Users} titulo="Esta categoría no tiene jugadores" accion={<Link to="/plantel" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Ir al plantel</Link>}>
          Sumá jugadores al plantel para asignarles misiones.
        </Vacio>
      ) : (
        <ul aria-label="Jugadores del plantel" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jugadores.map((j) => {
            const suyas = borrador.misionesJugador.filter((m) => m.jugadorId === j.id);
            return (
              <li key={j.id}>
                <Card className="flex h-full flex-col gap-1 p-4">
                  <p className="font-semibold break-words">{j.nombreLimpio}</p>
                  {suyas.length > 0 && (
                    <ul aria-label={`Misiones de ${j.nombreLimpio}`} className="flex flex-col divide-y divide-linea">
                      {suyas.map((m) => (
                        <FilaDeMision key={m.id} mision={m} bloqueada={evaluada} alQuitar={() => quitar('jugador', m.id)} />
                      ))}
                    </ul>
                  )}
                  {!evaluada && suyas.length < MAX_POR_JUGADOR && (
                    <Boton
                      variante="contorno"
                      tamano="chico"
                      className="mt-2 self-start"
                      aria-label={`Agregar misión a ${j.nombreLimpio}`}
                      onClick={() => setEligiendo({ ambito: 'jugador', jugadorId: j.id })}
                    >
                      <Plus aria-hidden className="size-4" />
                      Agregar misión
                    </Boton>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {error && <Aviso tono="error" titulo={error} className="mt-4" />}

      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 mt-6 -mx-4 flex flex-wrap gap-2 border-t border-linea bg-fondo px-4 py-3 sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8">
        {!evaluada && (
          <Boton onClick={alGuardar} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar misiones'}</Boton>
        )}
        {existe && (
          <Link to={`/misiones/${borrador.previaId}`} className={claseBoton({ variante: evaluada ? 'principal' : 'contorno' })}>
            {evaluada ? 'Ver la evaluación' : 'Evaluar el partido'}
          </Link>
        )}
      </div>

      {eligiendo && (
        <SelectorDeMision
          ambito={eligiendo.ambito}
          titulo={eligiendo.ambito === 'equipo' ? 'Objetivo de equipo' : nombreDe(eligiendo.jugadorId)}
          alAgregar={(m) => agregar(eligiendo.ambito, eligiendo.jugadorId, m)}
          alCerrar={() => setEligiendo(null)}
        />
      )}
    </>
  );
}

function FilaDeMision({ mision, bloqueada, alQuitar }: { mision: Mision; bloqueada: boolean; alQuitar: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0 break-words">{texto(mision)}</span>
      {!bloqueada && (
        <button
          type="button"
          onClick={alQuitar}
          aria-label={`Quitar misión: ${texto(mision)}`}
          title="Quitar misión"
          className="grid size-11 shrink-0 place-items-center rounded-full text-gris outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:text-club-texto"
        >
          <Trash2 aria-hidden className="size-5" />
        </button>
      )}
    </li>
  );
}

/**
 * Hoja para sumar una misión: se elige qué (una métrica o «Escribir otra»), se teclea el número o el
 * texto y se agrega. La app no propone ninguna métrica ni ningún valor.
 */
function SelectorDeMision({ ambito, titulo, alAgregar, alCerrar }: { ambito: Ambito; titulo: string; alAgregar: (m: Mision) => void; alCerrar: () => void }) {
  // null = todavía no eligió; '' = «Escribir otra».
  const [clave, setClave] = useState<string | null>(null);
  const [entrada, setEntrada] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = clave ? (metrica(clave) as Metrica | null) : null;

  const elegir = (c: string) => {
    setClave(c);
    setEntrada('');
    setError(null);
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const nueva: Mision = { id: crypto.randomUUID(), metrica: null, valor: null, texto: null, estado: null, comentario: null };
    if (m) {
      const valor = decimalEstricto(entrada) as number | null;
      if (valor === null || Number.isNaN(valor) || !Number.isInteger(valor) || valor < 0) {
        setError('Escribí un número entero, de 0 para arriba.');
        return;
      }
      alAgregar({ ...nueva, metrica: m.clave, valor });
      return;
    }
    const escrito = entrada.trim();
    if (!escrito) {
      setError('Escribí qué tiene que hacer.');
      return;
    }
    alAgregar({ ...nueva, texto: escrito });
  };

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={titulo} descripcion="Elegí qué le pedís y cuánto." etiquetaCerrar="Cerrar">
      <form onSubmit={enviar} className="flex flex-col gap-3 p-5 pt-12">
        <TituloDeHoja>{titulo}</TituloDeHoja>
        <div role="group" aria-label="¿Qué le pedís?" className="flex flex-wrap gap-x-1">
          {(metricasPara(ambito) as Metrica[]).map((x) => (
            <ChipBoton key={x.clave} activo={clave === x.clave} onClick={() => elegir(x.clave)}>{x.etiqueta}</ChipBoton>
          ))}
          <ChipBoton activo={clave === ''} onClick={() => elegir('')}>Escribir otra</ChipBoton>
        </div>
        {clave !== null && (
          m ? (
            <Campo
              key={m.clave}
              etiqueta={`${SENTIDO[m.sentido]} · ${m.plural}`}
              type="text"
              inputMode="numeric"
              maxLength={3}
              autoComplete="off"
              placeholder="Cuántos"
              value={entrada}
              error={error ?? undefined}
              onChange={(e) => setEntrada(e.target.value)}
              autoFocus
            />
          ) : (
            <Campo
              key="otra"
              etiqueta="Qué tiene que hacer"
              type="text"
              maxLength={LIMITE.textoMision}
              autoComplete="off"
              placeholder="Ej.: defender al base de ellos"
              value={entrada}
              error={error ?? undefined}
              onChange={(e) => setEntrada(e.target.value)}
              autoFocus
            />
          )
        )}
        <div className="flex gap-2">
          <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" disabled={clave === null}>Agregar</Boton>
        </div>
      </form>
    </Hoja>
  );
}
