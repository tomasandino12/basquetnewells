import { ArrowLeft, Pencil, Play, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useBlocker, useParams } from 'react-router';
import { LIMITE } from '@datos/limites.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Chip, Etiqueta } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { Pagina } from '../components/ui/pagina';
import { PistaDeUnaVez } from '../guia/GuiaDePrimerUso';
import { MuestraDeTrazo, Pizarra } from '../components/ui/pizarra';
import { PizarraEditable, type Herramienta, type Seleccion } from '../components/ui/pizarra-editable';
import { Hoja } from '../components/ui/sheet';
import { useGuardarJugada, useJugada } from '../datos/consultasRecursos';
import { mensajeDeError } from '../datos/errores';
import type { DatosDePizarra, JugadaDelClub } from '../datos/repositorio';
import { usePlantelActivo } from '../plantel/activo';
import { cn } from '../lib/cn';
import { colorDeTipo } from '../recursos/colores';
import { actual, crearHistorial, deshacer, empujar, haySinGuardar, marcarGuardado, puedeDeshacer, puedeRehacer, rehacer, type Historial } from '../recursos/historial';
import { ops } from '../recursos/operaciones';
import { SinCategoria } from './PlantelDelClub';

const TRAZOS: { clave: Herramienta; nombre: string }[] = [
  { clave: 'corte', nombre: 'Corte' },
  { clave: 'dribbling', nombre: 'Dribbling' },
  { clave: 'pase', nombre: 'Pase' },
  { clave: 'cortina', nombre: 'Cortina' },
  { clave: 'tiro', nombre: 'Tiro' },
  { clave: 'handoff', nombre: 'Handoff' },
];

/** La dirección del editor de una jugada y la de la biblioteca a la que vuelve. */
export const rutaDelEditor = (jugadaId: string) => `/recursos/jugadas/${jugadaId}/editar`;
export const rutaDeLaBiblioteca = (jugadaId?: string) => `/recursos?pestana=jugadas${jugadaId ? `&jugada=${jugadaId}` : ''}`;

/** El editor de jugadas (pizarra táctica): para compu o tablet; en un celular no hay lugar para la cancha. */
export function EditorDeJugada() {
  const activo = usePlantelActivo();
  const { jugadaId } = useParams();
  const consulta = useJugada(activo?.clubId, jugadaId);
  if (!activo) {
    return (
      <Pagina>
        <SinCategoria />
      </Pagina>
    );
  }
  return (
    <Pagina>
      <Consulta consulta={consulta} errorGenerico="No pudimos cargar la jugada">
        {(jugada) => (jugada ? <Cargada key={jugada.id} clubId={activo.clubId} jugada={jugada} /> : <SinJugada texto="Esta jugada ya no existe." />)}
      </Consulta>
    </Pagina>
  );
}

function SinJugada({ texto, id }: { texto: string; id?: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-base">{texto}</p>
      <Link to={rutaDeLaBiblioteca(id)} className="inline-flex min-h-11 items-center gap-2 font-semibold underline">
        <ArrowLeft aria-hidden className="size-4" />
        Volver a Recursos
      </Link>
    </div>
  );
}

function Cargada({ clubId, jugada }: { clubId: string; jugada: JugadaDelClub }) {
  // El lado corto decide: una tablet parada también entra. Se mide una vez al abrir.
  const [apta] = useState(() => ops.pantallaAptaParaEditar(window.innerWidth, window.innerHeight));
  if (!jugada.esMia) return <SinJugada id={jugada.id} texto="Esta jugada es de otro profe: sólo quien la creó puede editarla. Desde Recursos podés duplicarla y editar tu copia." />;
  if (!apta) return <SinJugada id={jugada.id} texto="El editor de jugadas es para compu o tablet. Desde Recursos podés verlas, asignarlas y duplicarlas." />;
  return <Editor clubId={clubId} jugada={jugada} />;
}

function Editor({ clubId, jugada }: { clubId: string; jugada: JugadaDelClub }) {
  const guardar = useGuardarJugada(clubId, jugada.id);
  const [historial, setHistorial] = useState<Historial<DatosDePizarra>>(() => crearHistorial(jugada.datos));
  // Lo que está en la base: el renombrar guarda esto, no los cambios sin guardar.
  const [guardados, setGuardados] = useState(jugada.datos);
  const [nombre, setNombre] = useState(jugada.nombre);
  const [paso, setPaso] = useState(0);
  const [herramienta, setHerramienta] = useState<Herramienta>('seleccionar');
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const [renombrando, setRenombrando] = useState(false);
  const [viendo, setViendo] = useState(false);

  const datos = actual(historial);
  const sucio = haySinGuardar(historial);
  const nosotrosDefiende = ops.nosotrosDefiende(jugada.tipo);
  const pasos = datos.pasos.length;
  const pasoVisto = Math.min(paso, Math.max(0, pasos - 1));

  const limpiar = () => {
    setSeleccion(null);
    setOrigen(null);
  };

  const avisar = (texto: string) => setAviso({ tono: 'error', texto });

  /** Aplica una regla pura; si no se cumple, el motivo se lee en pantalla y los datos no cambian. */
  const aplicar = (fn: (d: DatosDePizarra) => DatosDePizarra): boolean => {
    try {
      const nuevos = fn(datos);
      setHistorial((h) => empujar(h, nuevos));
      setAviso(null);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo aplicar el cambio.');
      return false;
    }
  };

  const borrarElegido = () => {
    if (!seleccion) return;
    if (seleccion.tipo === 'ficha') aplicar((d) => ops.quitarFicha(d, seleccion.id));
    else aplicar((d) => ops.quitarAccion(d, pasoVisto, seleccion.indice));
    limpiar();
  };

  const alDeshacer = () => {
    setHistorial(deshacer);
    limpiar();
  };
  const alRehacer = () => {
    setHistorial(rehacer);
    limpiar();
  };

  const irAlPaso = (k: number) => {
    setPaso(Math.max(0, Math.min(pasos - 1, k)));
    limpiar();
  };

  const agregarFicha = (tipo: 'ataque' | 'defensa' | 'cono') => {
    if (pasoVisto !== 0) return avisar('Las fichas se suman en la formación inicial (paso 1).');
    const n = datos.fichas.length;
    aplicar((d) =>
      ops.agregarFicha(d, {
        id: crypto.randomUUID(),
        tipo,
        x: Math.min(0.92, Math.max(0.08, 0.5 + ((n % 6) - 2.5) * 0.08)),
        y: 0.95,
        numero: tipo === 'cono' ? null : ops.proximoNumeroLibre(d, tipo),
      }),
    );
  };

  const alGuardar = () => {
    const aGuardar = datos;
    guardar.mutate(
      { nombre, tipo: jugada.tipo, datos: aGuardar },
      {
        onSuccess: () => {
          setHistorial(marcarGuardado);
          setGuardados(aGuardar);
          setAviso({ tono: 'ok', texto: 'Guardado' });
        },
        onError: (e) => avisar(e?.message === 'NO_ES_TUYA' ? 'Esta jugada ya no es tuya: no se puede guardar.' : mensajeDeError(e, 'No se pudo guardar.')),
      },
    );
  };

  // Salir con cambios sin guardar pide confirmación: el botón de volver, el menú o Atrás del sistema (todo cambio de ruta).
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!sucio) return;
    // Cerrar la pestaña o recargar no pasa por el router: lo ataja el navegador.
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [sucio]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const enTexto = ['TEXTAREA', 'INPUT'].includes((document.activeElement as HTMLElement | null)?.tagName ?? '');
      const tecla = e.key.toLowerCase();
      if ((e.key === 'Delete' || e.key === 'Backspace') && !enTexto) {
        e.preventDefault();
        borrarElegido();
      } else if (e.ctrlKey && !e.shiftKey && tecla === 'z' && !enTexto) {
        e.preventDefault();
        alDeshacer();
      } else if (e.ctrlKey && ((e.shiftKey && tecla === 'z') || tecla === 'y') && !enTexto) {
        e.preventDefault();
        alRehacer();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  const elegirHerramienta = (h: Herramienta) => {
    setHerramienta(h);
    limpiar();
  };

  const titulosDePaso = useMemo(() => datos.pasos.map((p, i) => ops.resumenDePaso(p, i)), [datos.pasos]);

  return (
    <div className="flex flex-col gap-4">
      <PistaDeUnaVez id="jugada-editor" />
      <header className="flex flex-wrap items-center gap-3">
        <Link to={rutaDeLaBiblioteca(jugada.id)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4">
          <ArrowLeft aria-hidden className="size-4" />
          Volver
        </Link>
        <h1 className="font-titulo text-3xl leading-none font-bold tracking-wide uppercase">{nombre}</h1>
        <button
          type="button"
          aria-label="Renombrar jugada"
          onClick={() => setRenombrando(true)}
          className="grid size-11 place-items-center rounded-full text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
        >
          <Pencil aria-hidden className="size-4" />
        </button>
        <Etiqueta className={cn('min-h-7 px-2.5 text-xs', colorDeTipo(jugada.tipo))}>{ops.etiquetaDeTipo(jugada.tipo)}</Etiqueta>
        {sucio && <Chip>Sin guardar</Chip>}
        <div className="ml-auto flex items-center gap-1">
          <BotonIcono etiqueta="Deshacer" disabled={!puedeDeshacer(historial)} onClick={alDeshacer}>
            <Undo2 aria-hidden className="size-5" />
          </BotonIcono>
          <BotonIcono etiqueta="Rehacer" disabled={!puedeRehacer(historial)} onClick={alRehacer}>
            <Redo2 aria-hidden className="size-5" />
          </BotonIcono>
          <Boton onClick={alGuardar} disabled={guardar.isPending} tamano="chico">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </header>

      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}</div>

      <div className="grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)_17rem] lg:items-start">
        <section aria-label="Herramientas" className="flex flex-wrap gap-2 lg:flex-col">
          <Titulito>Trazos</Titulito>
          <Herr activa={herramienta === 'seleccionar'} onClick={() => elegirHerramienta('seleccionar')}>
            Elegir
          </Herr>
          {TRAZOS.map((t) => (
            <Herr key={t.clave} activa={herramienta === t.clave} disabled={pasos === 0} onClick={() => elegirHerramienta(t.clave)}>
              <span className="flex items-center gap-2">
                <MuestraDeTrazo tipo={t.clave} />
                {t.nombre}
              </span>
            </Herr>
          ))}
          <Titulito>Fichas</Titulito>
          {pasoVisto === 0 ? (
            <>
              <Herr onClick={() => agregarFicha('ataque')}>+ Atacante</Herr>
              <Herr onClick={() => agregarFicha('defensa')}>+ Defensor</Herr>
              <Herr onClick={() => agregarFicha('cono')}>+ Cono</Herr>
              <Herr activa={herramienta === 'pelota'} onClick={() => elegirHerramienta('pelota')}>
                Pelota
              </Herr>
            </>
          ) : (
            <p className="text-sm text-gris">Las fichas y quién arranca con la pelota se eligen en la formación inicial (paso 1).</p>
          )}
          {herramienta !== 'seleccionar' && herramienta !== 'pelota' && (
            <p className="text-sm text-gris">
              {origen ? (herramienta === 'pase' || herramienta === 'handoff' ? 'Tocá a quién le llega.' : herramienta === 'tiro' ? '' : 'Tocá adónde va.') : 'Tocá la ficha que hace la acción.'}
            </p>
          )}
          {herramienta === 'pelota' && <p className="text-sm text-gris">Tocá al atacante que arranca con la pelota.</p>}
          {seleccion && (
            <Boton variante="contorno" tamano="chico" onClick={borrarElegido}>
              <Trash2 aria-hidden className="size-4" />
              Borrar {seleccion.tipo === 'ficha' ? 'ficha' : 'trazo'}
            </Boton>
          )}
        </section>

        <section aria-label="Pizarra" className="min-w-0">
          <PizarraEditable
            datos={datos}
            paso={pasoVisto}
            nosotrosDefiende={nosotrosDefiende}
            herramienta={herramienta}
            seleccion={seleccion}
            origen={origen}
            etiqueta={`Editor de la jugada: ${nombre}`}
            alSeleccionar={setSeleccion}
            alElegirOrigen={setOrigen}
            alAplicar={aplicar}
            alReemplazar={(nuevos) => setHistorial((h) => empujar(h, nuevos))}
            alAvisar={avisar}
          />
        </section>

        <section aria-label="Pasos" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Titulito>Secuencia de pasos</Titulito>
            <Boton
              variante="contorno"
              tamano="chico"
              onClick={() => {
                if (aplicar((d) => ops.agregarPaso(d))) setPaso(pasos);
                limpiar();
              }}
            >
              <Plus aria-hidden className="size-4" />
              Nuevo paso
            </Boton>
          </div>
          {pasos === 0 ? (
            <p className="text-sm text-gris">Todavía es sólo la formación inicial: «Nuevo paso» arranca la secuencia.</p>
          ) : (
            <>
              <ol className="flex flex-col divide-y divide-linea overflow-hidden rounded-btn border border-linea bg-sup">
                {titulosDePaso.map(({ numero, titulo }, i) => (
                  <li key={i} className={cn('flex items-center', i === pasoVisto && 'bg-club-cl')}>
                    <button
                      type="button"
                      aria-current={i === pasoVisto ? 'step' : undefined}
                      onClick={() => irAlPaso(i)}
                      className="flex min-h-11 flex-1 items-center gap-3 px-3 py-2 text-left text-sm outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-tinta"
                    >
                      <span className="font-mono text-xs text-gris">{numero}</span>
                      <span className={i === pasoVisto ? 'font-bold' : 'font-semibold'}>{titulo}</span>
                    </button>
                    {i === pasoVisto && (
                      <BotonIcono
                        etiqueta="Borrar este paso"
                        onClick={() => {
                          if (aplicar((d) => ops.quitarPaso(d, pasoVisto))) setPaso(Math.max(0, Math.min(pasoVisto, pasos - 2)));
                          limpiar();
                        }}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </BotonIcono>
                    )}
                  </li>
                ))}
              </ol>
              <Boton variante="contorno" tamano="chico" onClick={() => setViendo(true)}>
                <Play aria-hidden className="size-4" />
                Ver animación
              </Boton>
              <NotaDelPaso key={pasoVisto} paso={pasoVisto} valor={datos.pasos[pasoVisto]?.nota ?? ''} alCambiar={(t) => aplicar((d) => ops.fijarNotaDePaso(d, pasoVisto, t))} />
            </>
          )}
        </section>
      </div>

      <Renombrar
        abierta={renombrando}
        alCambiar={setRenombrando}
        actual={nombre}
        guardando={guardar.isPending}
        error={guardar.isError && renombrando ? mensajeDeError(guardar.error, 'No se pudo renombrar.') : null}
        alGuardar={(nuevo) =>
          guardar.mutate(
            { nombre: nuevo, tipo: jugada.tipo, datos: guardados },
            {
              onSuccess: () => {
                setNombre(nuevo);
                setRenombrando(false);
                setAviso({ tono: 'ok', texto: 'Nombre actualizado' });
              },
            },
          )
        }
      />

      <Hoja abierta={viendo} alCambiar={setViendo} titulo="Animación" descripcion="La jugada animada, con los cambios que hiciste hasta ahora." etiquetaCerrar="Cerrar" ancha>
        <div className="p-5 pt-12">
          <Pizarra datos={datos} nosotrosDefiende={nosotrosDefiende} etiqueta={`Animación de la jugada: ${nombre}`} />
        </div>
      </Hoja>

      <Hoja
        abierta={bloqueo.state === 'blocked'}
        alCambiar={(a) => {
          if (!a && bloqueo.state === 'blocked') bloqueo.reset();
        }}
        titulo="Salir sin guardar"
        descripcion="Tenés cambios sin guardar: si salís ahora se pierden."
        etiquetaCerrar="Cerrar el aviso"
      >
        <div className="flex flex-col gap-4 p-5 pt-12">
          <h2 className="font-titulo text-2xl font-semibold uppercase">Salir sin guardar</h2>
          <p className="text-base">Tenés cambios sin guardar. Si salís ahora se pierden.</p>
          <Boton variante="club" onClick={() => bloqueo.state === 'blocked' && bloqueo.proceed()}>
            Salir sin guardar
          </Boton>
          <Boton variante="contorno" onClick={() => bloqueo.state === 'blocked' && bloqueo.reset()}>
            Seguir editando
          </Boton>
        </div>
      </Hoja>
    </div>
  );
}

function Titulito({ children }: { children: ReactNode }) {
  return <span className="w-full font-mono text-[0.6875rem] tracking-wide text-gris uppercase">{children}</span>;
}

function Herr({ activa = false, disabled, onClick, children }: { activa?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-start rounded-btn border px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:cursor-not-allowed disabled:opacity-40 lg:w-full',
        activa ? 'border-negro bg-negro text-sobre-negro' : 'border-borde-control text-tinta [@media(hover:hover)]:hover:border-tinta',
      )}
    >
      {children}
    </button>
  );
}

function BotonIcono({ etiqueta, onClick, disabled, children }: { etiqueta: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full text-tinta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** El texto del paso se confirma al salir del campo: un cambio por indicación, no uno por letra en el deshacer. */
function NotaDelPaso({ paso, valor, alCambiar }: { paso: number; valor: string; alCambiar: (t: string) => void }) {
  const [texto, setTexto] = useState(valor);
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      Indicaciones del paso {paso + 1}
      <textarea
        value={texto}
        rows={3}
        maxLength={LIMITE.notaPaso}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => texto !== valor && alCambiar(texto)}
        className="w-full rounded-campo border border-borde-control bg-sup p-3 text-base font-normal outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
      />
    </label>
  );
}

function Renombrar({ abierta, alCambiar, actual: nombreActual, guardando, error, alGuardar }: { abierta: boolean; alCambiar: (a: boolean) => void; actual: string; guardando: boolean; error: string | null; alGuardar: (nombre: string) => void }) {
  const [texto, setTexto] = useState(nombreActual);
  const [vacio, setVacio] = useState(false);
  return (
    <Hoja abierta={abierta} alCambiar={(a) => { alCambiar(a); if (a) { setTexto(nombreActual); setVacio(false); } }} titulo="Renombrar jugada" descripcion="Cambiá el nombre con el que se ve en la biblioteca." etiquetaCerrar="Cerrar">
      <form
        className="flex flex-col gap-4 p-5 pt-12"
        onSubmit={(e) => {
          e.preventDefault();
          const limpio = texto.trim();
          if (!limpio) return setVacio(true);
          alGuardar(limpio);
        }}
      >
        <h2 className="font-titulo text-2xl font-semibold uppercase">Renombrar jugada</h2>
        <Campo etiqueta="Nombre" value={texto} maxLength={LIMITE.titulo} autoComplete="off" onChange={(e) => setTexto(e.target.value)} error={vacio ? 'Poné un nombre.' : undefined} />
        {error && <Aviso tono="error" titulo="No se guardó">{error}</Aviso>}
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </form>
    </Hoja>
  );
}
