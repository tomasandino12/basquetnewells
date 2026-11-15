import { EllipsisVertical, History, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker, useLocation, useNavigate } from 'react-router';
import { usePlantelId } from '../plantel/activo';
import { LADOS, TIPOS, ZONAS } from '@datos/asistencia.js';
import { hoyLocal } from '@datos/antropometria.js';
import {
  contar,
  esFechaTomable,
  etiqueta,
  filasAGuardar,
  hayCambios,
  lesionDe,
  accionesDelMenu,
  estabaLesionado,
  ordenarPorNombre,
  ponerEstado,
  tarjetasIniciales,
  type Estado,
  type Tarjeta,
} from '../asistencia/toma';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { ChipBoton } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import {
  useDarAlta,
  useEntrenamientoDelDia,
  useGuardarDia,
  useJugadoresDeAsistencia,
  useLesionesDeAsistencia,
  useRegistrarLesion,
} from '../datos/consultas';
import { mensajeDeGuardado } from '../datos/errores';
import type { Entrenamiento, JugadorDelPlantel, Lesion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { ConPlantel } from './ConPlantel';

/** Desde dónde se abrió la toma (el historial, por ejemplo): ahí se vuelve al guardar. */
interface EstadoDeNavegacion {
  volverA?: string;
}

/**
 * La toma de asistencia de una categoría. Lo marcado vive en la pantalla hasta que se toca «Guardar»
 * (una sola escritura por día): si el guardado falla no se pierde nada y se reintenta. Lo único que
 * se guarda al instante es la lesión, que es del chico y no de este entrenamiento.
 */
export function Asistencia() {
  const plantelId = usePlantelId();
  const desde = (useLocation().state as EstadoDeNavegacion | null)?.volverA;
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: desde ?? `/plantel`, texto: desde ? 'Historial' : 'Plantel' }}
      soloCuerpoTecnico="La coordinación ve la asistencia de cada categoría en conjunto, no la de cada chico."
    >
      {(p) => <Toma {...p} />}
    </ConPlantel>
  );
}

function Toma({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const hoy = hoyLocal() as string;
  const navigate = useNavigate();
  const lugar = useLocation();
  const [fecha, setFecha] = useState(() => {
    const pedida = new URLSearchParams(lugar.search).get('fecha') ?? '';
    return esFechaTomable(pedida, hoy) ? pedida : hoy;
  });
  const [cambiarA, setCambiarA] = useState<string | null>(null);
  const jugadores = useJugadoresDeAsistencia(clubId, plantelId);
  const lesiones = useLesionesDeAsistencia(plantelId);
  const guardado = useEntrenamientoDelDia(plantelId, fecha);

  // Lo que la pantalla del día sabe y esta necesita: si hay algo sin guardar (para el cambio de día y
  // para salir) y si ya se guardó (después de guardar, salir no tiene que preguntar).
  const pendiente = useRef(false);
  const yaGuardado = useRef(false);
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) =>
    pendiente.current && !yaGuardado.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const pedirCambioDeDia = (nueva: string) => {
    // Un campo vacío o un día que todavía no llegó: se queda donde está.
    if (!esFechaTomable(nueva, hoy) || nueva === fecha) return;
    if (pendiente.current) setCambiarA(nueva);
    else setFecha(nueva);
  };

  const campoFecha = (
    <label className="mt-4 block">
      <span className="mb-1 block text-sm font-semibold">Día del entrenamiento</span>
      <input
        type="date"
        value={fecha}
        max={hoy}
        onChange={(e) => pedirCambioDeDia(e.target.value)}
        className="h-11 w-full rounded-campo border border-borde-control bg-sup px-3 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta sm:w-auto"
      />
    </label>
  );

  const destino = (lugar.state as EstadoDeNavegacion | null)?.volverA ?? `/plantel`;

  return (
    <>
      <Link
        to={`/plantel/asistencia/historial`}
        className="float-right inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
      >
        <History aria-hidden className="size-4" />
        Historial
      </Link>
      <Consulta consulta={jugadores} errorGenerico="No se pudo cargar la asistencia">
        {(lista) => (
          <>
          {/* Mientras llega (o falla) el día que se pidió, el campo de fecha sigue a mano para elegir otro. */}
          {guardado.data === undefined && campoFecha}
          <Consulta consulta={guardado} errorGenerico="No se pudo cargar ese día" filas={4}>
            {(delDia) => (
              // key por día: cambiar de fecha empieza una toma nueva, con su propia línea de base.
              <DiaDeAsistencia
                key={fecha}
                clubId={clubId}
                plantelId={plantelId}
                categoria={categoria}
                fecha={fecha}
                jugadores={ordenarPorNombre(lista)}
                lesiones={lesiones.data ?? []}
                guardado={delDia}
                campoFecha={campoFecha}
                alPendiente={(hay) => { pendiente.current = hay; }}
                alGuardar={() => {
                  yaGuardado.current = true;
                }}
                destino={destino}
                navegar={navigate}
              />
            )}
          </Consulta>
          </>
        )}
      </Consulta>

      <Confirmar
        abierta={cambiarA !== null}
        titulo="Cambiar de día"
        texto="Lo que marcaste en este día todavía no se guardó. Si cambiás de día, se pierde."
        verbo="Cambiar de día"
        alConfirmar={() => {
          if (cambiarA) setFecha(cambiarA);
          pendiente.current = false;
          setCambiarA(null);
        }}
        alCancelar={() => setCambiarA(null)}
      />
      <Confirmar
        abierta={bloqueo.state === 'blocked'}
        titulo="Salir sin guardar"
        texto="Marcaste asistencia que todavía no guardaste. Si salís, se pierde."
        verbo="Salir"
        alConfirmar={() => bloqueo.proceed?.()}
        alCancelar={() => bloqueo.reset?.()}
      />
    </>
  );
}

interface DiaProps {
  clubId: string;
  plantelId: string;
  categoria: string;
  fecha: string;
  jugadores: JugadorDelPlantel[];
  lesiones: Lesion[];
  guardado: Entrenamiento | null;
  campoFecha: ReactNode;
  alPendiente: (hay: boolean) => void;
  alGuardar: () => void;
  destino: string;
  navegar: ReturnType<typeof useNavigate>;
}

function DiaDeAsistencia({
  clubId, plantelId, categoria, fecha, jugadores, lesiones, guardado, campoFecha, alPendiente, alGuardar, destino, navegar,
}: DiaProps) {
  // Lo ya guardado arma la línea de base contra la que se mide lo cambiado. Se lee una sola vez:
  // que la consulta se vuelva a pedir (una lesión, un alta) no tiene que pisar lo que el profe marcó.
  const [inicial, setInicial] = useState(() => tarjetasIniciales(jugadores, guardado));
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>(inicial);
  const [huboInicial, setHuboInicial] = useState(guardado ? guardado.hubo : true);
  const [hubo, setHubo] = useState(huboInicial);
  const [error, setError] = useState<string | null>(null);
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [confirmarSin, setConfirmarSin] = useState(false);
  const guardar = useGuardarDia(plantelId, fecha);

  const pendiente = hayCambios({ inicial, actual: tarjetas, hubo, huboInicial });
  useEffect(() => alPendiente(pendiente), [pendiente, alPendiente]);

  const porId = new Map(jugadores.map((j) => [j.id, j]));
  const { total, presentes, sinTomar } = contar(tarjetas);
  const yaTomados = guardado?.filas.length ?? 0;

  const ponerSinEntrenamiento = () => {
    if (hubo && yaTomados) setConfirmarSin(true);
    else setHubo(!hubo);
  };

  const guardarDia = async () => {
    if (guardar.isPending || !pendiente) return;
    setError(null);
    try {
      await guardar.mutateAsync({ hubo, filas: hubo ? filasAGuardar(tarjetas) : [] });
    } catch (e) {
      setError(
        mensajeDeGuardado(e, 'No se pudo guardar la asistencia.', [
          [/SIN_PERMISO/, 'No tenés permiso para tomar asistencia en esta categoría.'],
          [/FECHA_FUTURA/, 'Ese día todavía no llegó.'],
        ]),
      );
      return;
    }
    // Lo guardado pasa a ser la línea de base: si no, salir preguntaría si se quiere perder lo marcado.
    setInicial(tarjetas);
    setHuboInicial(hubo);
    alGuardar();
    navegar(destino, { state: { aviso: hubo ? 'Asistencia guardada' : 'Día sin entrenamiento guardado' } });
  };

  const sinJugadores = jugadores.length === 0;
  const jugadorDelMenu = menuDe ? porId.get(menuDe) : undefined;
  const tarjetaDelMenu = menuDe ? tarjetas.find((t) => t.jugadorId === menuDe) : undefined;

  return (
    <>
      <header className="pt-2">
        <p className="font-mono text-xs tracking-wide text-gris uppercase">Asistencia · {categoria}</p>
        {sinJugadores ? (
          <h1 className="font-titulo text-4xl leading-none font-semibold">Asistencia</h1>
        ) : !hubo ? (
          <p role="status" aria-label="Presentes" className="font-titulo text-6xl leading-none font-semibold">Sin entrenamiento</p>
        ) : (
          <p role="status" aria-label="Presentes" className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-titulo text-[6.5rem] leading-[.85] font-semibold tabular-nums">
              {presentes}<span className="text-6xl text-gris">/{total}</span>
            </span>
            <span className="font-titulo text-3xl leading-none font-semibold uppercase">presentes</span>
            {sinTomar > 0 && <span className="text-sm font-semibold text-club-texto">· {sinTomar} sin tomar</span>}
          </p>
        )}
        {campoFecha}
      </header>

      {sinJugadores ? (
        <Vacio
          icono={Users}
          titulo="Esta categoría no tiene jugadores"
          accion={<Link to={`/plantel`} className="text-sm font-semibold underline">Ir al plantel</Link>}
        >
          Sumá jugadores al plantel para tomar asistencia.
        </Vacio>
      ) : (
        <>
          <div className="mt-3">
            <Boton variante="contorno" tamano="chico" onClick={ponerSinEntrenamiento}>
              {hubo ? 'No hubo entrenamiento' : 'Sí hubo entrenamiento'}
            </Boton>
          </div>

          {hubo ? (
            <>
              <p className="mt-3 text-sm text-gris">Tocá Presente, Ausente o Justificada en cada jugador. Los que no marques no se guardan.</p>
              <ul aria-label="Jugadores" className="mt-3 flex flex-col gap-2 pb-4">
                {tarjetas.map((t) => {
                  const j = porId.get(t.jugadorId)!;
                  return (
                    <FilaDeToma
                      key={t.jugadorId}
                      nombre={j.nombreLimpio}
                      estado={t.estado}
                      lesionado={estabaLesionado(lesionDe(lesiones, t.jugadorId), fecha)}
                      alMarcar={(e) => setTarjetas((ts) => ponerEstado(ts, t.jugadorId, e))}
                      alMenu={() => setMenuDe(t.jugadorId)}
                    />
                  );
                })}
              </ul>
            </>
          ) : (
            <Aviso titulo="Este día figura sin entrenamiento" className="mt-3 mb-4">
              Nadie queda con falta. Si sí hubo, tocá «Sí hubo entrenamiento».
            </Aviso>
          )}
        </>
      )}

      {!sinJugadores && (
        <div className="sticky bottom-0 -mx-4 border-t border-linea bg-fondo px-4 py-3 sm:-mx-6 sm:px-6">
          {error && <Aviso tono="error" titulo={error} className="mb-3" />}
          <Boton className="w-full" disabled={!pendiente || guardar.isPending} onClick={() => void guardarDia()}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      )}

      {jugadorDelMenu && tarjetaDelMenu && (
        <MenuDeJugador
          key={menuDe}
          clubId={clubId}
          nombre={jugadorDelMenu.nombreLimpio}
          jugadorId={jugadorDelMenu.id}
          estado={tarjetaDelMenu.estado}
          lesiones={lesionDe(lesiones, jugadorDelMenu.id)}
          fecha={fecha}
          alCerrar={() => setMenuDe(null)}
        />
      )}

      <Confirmar
        abierta={confirmarSin}
        titulo="Marcar sin entrenamiento"
        texto={`Este día ya tiene ${yaTomados} asistencia${yaTomados === 1 ? '' : 's'} guardada${yaTomados === 1 ? '' : 's'}. Al guardar, se borran.`}
        verbo="Marcar sin entrenamiento"
        alConfirmar={() => {
          setHubo(false);
          setConfirmarSin(false);
        }}
        alCancelar={() => setConfirmarSin(false)}
      />
    </>
  );
}

interface FilaProps {
  nombre: string;
  estado: Estado;
  lesionado: boolean;
  alMarcar: (estado: Estado) => void;
  alMenu: () => void;
}

const OPCIONES: { estado: 'presente' | 'ausente' | 'justificada'; texto: string }[] = [
  { estado: 'presente', texto: 'Presente' },
  { estado: 'ausente', texto: 'Ausente' },
  { estado: 'justificada', texto: 'Justificada' },
];

/**
 * Un toque por fila: Presente, Ausente y Justificada están siempre a la vista y marcan directo
 * (volver a tocar el mismo no desmarca: marcar es idempotente). El botón de los tres puntos queda
 * sólo para la lesión.
 */
function FilaDeToma({ nombre, estado, lesionado, alMarcar, alMenu }: FilaProps) {
  const falto = estado === 'ausente' || estado === 'justificada';
  return (
    <li
      data-estado={estado ?? 'sin-tomar'}
      className={cn('rounded-tarjeta border p-2', estado === null ? 'border-borde-control bg-sup' : 'border-linea bg-sup')}
    >
      <div className="flex items-center gap-2 pb-2 pl-2">
        <span className={cn('min-w-0 flex-1 truncate font-titulo text-2xl leading-none font-semibold', falto && 'text-gris line-through decoration-2')}>{nombre}</span>
        {lesionado && <span className="shrink-0 rounded-chip bg-baja-fondo px-1.5 py-0.5 text-xs font-semibold text-baja">Lesionado</span>}
        <button
          type="button"
          onClick={alMenu}
          aria-label={`Lesión de ${nombre}`}
          title="Lesión"
          className="grid size-11 shrink-0 place-items-center rounded-tarjeta border border-linea bg-sup text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
        >
          <EllipsisVertical aria-hidden className="size-5" />
        </button>
      </div>
      {/* Los tres estados a la vista: un toque marca directo, sin menú ni segundo toque. */}
      <div role="group" aria-label={`Asistencia de ${nombre}`} className="grid grid-cols-3 gap-1">
        {OPCIONES.map((o) => {
          const activa = estado === o.estado;
          return (
            <button
              key={o.estado}
              type="button"
              aria-pressed={activa}
              aria-label={`${o.texto}: ${nombre}`}
              onClick={() => alMarcar(o.estado)}
              className={cn(
                'min-h-12 rounded-tarjeta border px-2 text-sm font-semibold transition-transform duration-[var(--dur-1)] active:scale-[.97] outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                activa ? 'border-tinta bg-tinta text-fondo' : 'border-borde-control bg-fondo text-tinta',
              )}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
    </li>
  );
}

interface MenuProps {
  clubId: string;
  nombre: string;
  jugadorId: string;
  estado: Estado;
  lesiones: Lesion[];
  fecha: string;
  alCerrar: () => void;
}

const GRUPOS = [
  { clave: 'zona', titulo: 'Zona', opciones: ZONAS as string[] },
  { clave: 'lado', titulo: 'Lado', opciones: LADOS as string[] },
  { clave: 'tipo', titulo: 'Tipo', opciones: TIPOS as string[] },
] as const;

type Marcas = { zona: string | null; lado: string | null; tipo: string | null };

/**
 * El menú de un jugador: lesión y alta (se guardan al
 * instante: son del jugador, no de este entrenamiento). Zona, lado y tipo son listas cerradas y
 * opcionales —«no sé» es un dato válido en la cancha—: es un dato de salud de un menor, sin texto libre.
 */
function MenuDeJugador({ clubId, nombre, jugadorId, estado, lesiones, fecha, alCerrar }: MenuProps) {
  const [modo, setModo] = useState<'opciones' | 'lesion'>('opciones');
  const [marcas, setMarcas] = useState<Marcas>({ zona: null, lado: null, tipo: null });
  const [error, setError] = useState<string | null>(null);
  const lesionar = useRegistrarLesion(clubId, fecha);
  const alta = useDarAlta(fecha);
  const { lesionar: puedeLesionar, altaDe } = accionesDelMenu(estado, lesiones, fecha);
  const ocupado = lesionar.isPending || alta.isPending;

  const guardarLesion = async () => {
    if (ocupado) return;
    setError(null);
    try {
      await lesionar.mutateAsync({ jugadorId, ...marcas });
    } catch (e) {
      setError(
        mensajeDeGuardado(e, 'No se pudo guardar la lesión.', [
          [/lesion_abierta_unica/, 'Ya tiene una lesión abierta. Dale el alta antes de marcar otra.'],
          [/FECHA_FUTURA/, 'Ese día todavía no llegó.'],
        ]),
      );
      return;
    }
    alCerrar();
  };

  const darAlta = async () => {
    if (ocupado || !altaDe) return;
    setError(null);
    try {
      await alta.mutateAsync(altaDe);
    } catch (e) {
      setError(mensajeDeGuardado(e, 'No se pudo dar el alta.'));
      return;
    }
    alCerrar();
  };

  return (
    <Hoja
      abierta
      alCambiar={(abierta) => !abierta && alCerrar()}
      titulo={nombre}
      descripcion="Lesión o alta del jugador."
      etiquetaCerrar="Cerrar el menú"
    >
      <div className="flex flex-col gap-3 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold">{nombre}</h2>
        {modo === 'opciones' ? (
          <>
            {puedeLesionar && <Boton variante="contorno" onClick={() => setModo('lesion')}>Se lesionó</Boton>}
            {altaDe && <Boton variante="contorno" disabled={ocupado} onClick={() => void darAlta()}>Dar el alta</Boton>}
            {error && <Aviso tono="error" titulo={error} />}
            <Boton variante="contorno" onClick={alCerrar}>Cerrar</Boton>
          </>
        ) : (
          <>
            <p className="text-sm text-gris">Se lesionó el {fecha.split('-').reverse().slice(0, 2).join('/')}. Marcá lo que sepas: todo es opcional.</p>
            {GRUPOS.map((g) => (
              <div key={g.clave} role="group" aria-labelledby={`lesion-${g.clave}`}>
                <p id={`lesion-${g.clave}`} className="mb-1 text-sm font-semibold">{g.titulo}</p>
                <div className="flex flex-wrap">
                  {g.opciones.map((o) => (
                    <ChipBoton
                      key={o}
                      activo={marcas[g.clave] === o}
                      onClick={() => setMarcas((m) => ({ ...m, [g.clave]: m[g.clave] === o ? null : o }))}
                    >
                      {etiqueta(o)}
                    </ChipBoton>
                  ))}
                </div>
              </div>
            ))}
            {error && <Aviso tono="error" titulo={error} />}
            <div className="flex gap-2">
              <Boton variante="contorno" className="flex-1" onClick={() => { setError(null); setModo('opciones'); }}>Cancelar</Boton>
              <Boton className="flex-1" disabled={ocupado} onClick={() => void guardarLesion()}>
                {lesionar.isPending ? 'Guardando…' : 'Guardar'}
              </Boton>
            </div>
          </>
        )}
      </div>
    </Hoja>
  );
}

interface ConfirmarProps {
  abierta: boolean;
  titulo: string;
  texto: string;
  verbo: string;
  alConfirmar: () => void;
  alCancelar: () => void;
}

/** Pregunta antes de perder algo: dos botones, y el que pierde dice lo que hace. */
export function Confirmar({ abierta, titulo, texto, verbo, alConfirmar, alCancelar }: ConfirmarProps) {
  return (
    <Hoja
      abierta={abierta}
      alCambiar={(a) => !a && alCancelar()}
      titulo={titulo}
      descripcion={texto}
      etiquetaCerrar="Cerrar sin cambiar nada"
    >
      <div className="flex flex-col gap-3 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold">{titulo}</h2>
        <p className="text-sm text-gris">{texto}</p>
        <Boton onClick={alConfirmar}>{verbo}</Boton>
        <Boton variante="contorno" onClick={alCancelar}>Seguir acá</Boton>
      </div>
    </Hoja>
  );
}
