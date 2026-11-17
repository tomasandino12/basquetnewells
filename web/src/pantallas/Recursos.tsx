import { BookOpen, Copy, Package, Pencil, Play, Plus, Printer, Search, Tag, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { duplicarDatos, etiquetaDeTipo, nosotrosDefiende, pantallaAptaParaEditar } from '@datos/jugadas.js';
import { LIMITE } from '@datos/limites.js';
import { nombreDeEje, ordenarVariaciones } from '@datos/variaciones.js';
import { urlDeMiniatura } from '@datos/youtube.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Chip, ChipBoton, Etiqueta } from '../components/ui/chip';
import { Campo } from '../components/ui/campo';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Pizarra } from '../components/ui/pizarra';
import { Hoja } from '../components/ui/sheet';
import { useAsignarJugada, useBorrarJugada, useDetalleDeEjercicio, useDuplicarJugada, useEjercicios, useJugadasDelClub, usePlantelesDeJugada } from '../datos/consultasRecursos';
import { useSesion } from '../datos/contexto';
import { mensajeDeError } from '../datos/errores';
import type { EjercicioDeLista, JugadaDelClub, NotaDeEjercicio, PlantelDelClub, VariacionDeEjercicio } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { usePlantelActivo } from '../plantel/activo';
import { colorDeTema, colorDeTipo } from '../recursos/colores';
import { FORMACIONES, TIPOS_JUGADA } from '../recursos/operaciones';
import { filtrarEjercicios, filtrarJugadas, nombreDeCopia, nombreDeTema, temasConEjercicios, textoDeVariaciones, tiposConJugadas } from '../recursos/biblioteca';
import { Pagina } from '../components/ui/pagina';
import { SinCategoria } from './PlantelDelClub';
import { VideoDeEjercicio } from '../fisico/VideoDeEjercicio';
import { BorrarEjercicio, BorrarNota, BorrarVariacion, HojaDeEjercicio, HojaDeNota, HojaDeVariacion } from './RecursosEscritura';
import { Videos } from './RecursosVideos';
import { rutaDelEditor } from './EditorDeJugada';

type Pestana = 'ejercicios' | 'jugadas' | 'videos';
const NOMBRE_DE_PESTANA: Record<Pestana, string> = { ejercicios: 'Ejercicios', jugadas: 'Jugadas', videos: 'Videos' };

// Un enlace con forma de botón recto y a la vista; el texto largo entra en una línea (el botón de mayúsculas lo partía).
const BOTON_DE_ENLACE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-borde-control px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta';

const ENLACE_TEXTO =
  'inline-flex min-h-11 items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:decoration-club';

/**
 * Recursos: la biblioteca del club. En compu, tres columnas (la lista, la pizarra, el detalle); en
 * el celular, la pizarra arriba, después el detalle y la lista abajo. Los ejercicios y las jugadas se crean, editan,
 * asignan y borran acá (el editor de jugadas necesita compu o tablet).
 */
export function Recursos() {
  const activo = usePlantelActivo();
  if (!activo) {
    return (
      <Pagina>
        <SinCategoria />
      </Pagina>
    );
  }
  return <Biblioteca clubId={activo.clubId} planteles={activo.visibles} plantelId={activo.plantelId} categoria={activo.categoria} />;
}

export function Biblioteca({ clubId, planteles, plantelId, categoria }: { clubId: string; planteles: PlantelDelClub[]; plantelId?: string; categoria?: string }) {
  const ejercicios = useEjercicios(clubId);
  const jugadas = useJugadasDelClub(clubId);
  // El editor vuelve con ?pestana=jugadas&jugada=<id>: la jugada que se estaba editando queda elegida.
  const [params] = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>(params.get('pestana') === 'jugadas' ? 'jugadas' : params.get('pestana') === 'videos' ? 'videos' : 'ejercicios');
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [elegida, setElegida] = useState<Record<Pestana, string | null>>({ ejercicios: null, jugadas: params.get('jugada'), videos: null });

  const cambiarPestana = (p: Pestana) => {
    setPestana(p);
    setFiltro(null);
    setTexto('');
  };

  const lista = pestana === 'ejercicios' ? ejercicios : jugadas;
  const visiblesEj = useMemo(() => filtrarEjercicios(ejercicios.data ?? [], { texto, tema: filtro }), [ejercicios.data, texto, filtro]);
  const visiblesJu = useMemo(() => filtrarJugadas(jugadas.data ?? [], { texto, tipo: filtro }), [jugadas.data, texto, filtro]);
  const ids = pestana === 'ejercicios' ? visiblesEj.map((e) => e.id) : visiblesJu.map((j) => j.id);
  // Lo elegido si sigue en la lista; si no, la primera: así la pizarra nunca queda vacía habiendo algo.
  const idElegido = ids.includes(elegida[pestana] ?? '') ? elegida[pestana] : (ids[0] ?? null);
  const elegir = (id: string) => {
    setElegida((e) => ({ ...e, [pestana]: id }));
    // En el celular la pizarra está arriba: se sube a verla.
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0 });
  };

  return (
    <Pagina>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Recursos</h1>
        <div role="tablist" aria-label="Biblioteca" className="flex rounded-campo border border-borde-control p-0.5">
          {(['ejercicios', 'jugadas', 'videos'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pestana === p}
              onClick={() => cambiarPestana(p)}
              className={cn(
                'min-h-11 rounded-[0.4375rem] px-4 font-titulo text-lg font-semibold tracking-wide uppercase outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                pestana === p ? 'bg-negro text-sobre-negro' : 'text-gris',
              )}
            >
              {NOMBRE_DE_PESTANA[p]}
            </button>
          ))}
        </div>
      </header>

      {pestana === 'videos' ? (
        plantelId && categoria ? (
          <Videos clubId={clubId} plantelId={plantelId} categoria={categoria} />
        ) : (
          <Vacio icono={BookOpen} titulo="Elegí una categoría">
            Los videos se ofrecen por plantel: elegí una categoría arriba para ver los de ese grupo.
          </Vacio>
        )
      ) : (
      <div className="flex flex-col gap-5 lg:grid lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)_minmax(16rem,1fr)] lg:items-start">
        <section aria-label="Lista" className="order-3 flex flex-col gap-3 lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto print:hidden">
          {pestana === 'jugadas' && (
            <Boton variante="secundario" onClick={() => setCreando(true)}>
              <Plus aria-hidden className="size-4" />
              Nueva jugada
            </Boton>
          )}
          <label className="relative block">
            <span className="sr-only">{pestana === 'ejercicios' ? 'Buscar ejercicio' : 'Buscar jugada'}</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gris" />
            <input
              type="search"
              value={texto}
              maxLength={LIMITE.titulo}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={pestana === 'ejercicios' ? 'Buscar ejercicio' : 'Buscar jugada'}
              className="h-11 w-full rounded-campo border border-borde-control bg-sup pr-3 pl-9 text-base outline-offset-2 placeholder:text-gris focus-visible:outline-2 focus-visible:outline-tinta"
            />
          </label>
          {pestana === 'ejercicios' && (
            <Boton variante="secundario" onClick={() => setCargando(true)}>
              <Plus aria-hidden className="size-4" />
              Cargar un ejercicio
            </Boton>
          )}
          <Consulta consulta={{ isPending: lista.isPending, isError: lista.isError, error: lista.error, data: lista.data as unknown, refetch: lista.refetch }} errorGenerico={pestana === 'ejercicios' ? 'No pudimos cargar los ejercicios' : 'No pudimos cargar las jugadas'}>
            {() =>
              pestana === 'ejercicios' ? (
                <ListaDeEjercicios todos={ejercicios.data ?? []} visibles={visiblesEj} filtro={filtro} setFiltro={setFiltro} elegido={idElegido} elegir={elegir} />
              ) : (
                <ListaDeJugadas todas={jugadas.data ?? []} visibles={visiblesJu} filtro={filtro} setFiltro={setFiltro} elegido={idElegido} elegir={elegir} />
              )
            }
          </Consulta>
        </section>

        {idElegido !== null &&
          (pestana === 'ejercicios' ? (
            <DeEjercicio key={idElegido} clubId={clubId} ejercicio={visiblesEj.find((e) => e.id === idElegido)!} />
          ) : (
            <DeJugada key={idElegido} clubId={clubId} jugada={visiblesJu.find((j) => j.id === idElegido)!} planteles={planteles} />
          ))}
        {idElegido === null && lista.data && (
          <div className="order-1 lg:order-2 lg:col-span-2">
            <Vacio icono={BookOpen} titulo={pestana === 'ejercicios' ? 'No hay ejercicios' : 'No hay jugadas'}>
              {(pestana === 'ejercicios' ? ejercicios.data : jugadas.data)?.length ? 'Ninguno coincide con la búsqueda.' : 'Cuando se cargue el primero, lo vas a ver acá con su pizarra.'}
            </Vacio>
          </div>
        )}
      </div>
      )}
      {cargando && <HojaDeEjercicio abierta alCambiar={(a) => !a && setCargando(false)} clubId={clubId} />}
      <NuevaJugada abierta={creando} alCambiar={setCreando} clubId={clubId} />
    </Pagina>
  );
}

/** Un renglón de la lista: plano, sin tarjeta ni reborde. El elegido va con fondo rojo suave y letra más firme. */
function Item({ elegido, alTocar, children }: { elegido: boolean; alTocar: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        aria-current={elegido ? 'true' : undefined}
        onClick={alTocar}
        className={cn(
          'flex min-h-14 w-full flex-col items-start gap-1 px-3 py-2.5 text-left outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-tinta',
          elegido ? 'bg-club-cl' : '[@media(hover:hover)]:hover:bg-sup-2',
        )}
      >
        {children}
      </button>
    </li>
  );
}

/** Todos los renglones en un solo bloque recto, separados por una línea. */
const LISTA = 'flex flex-col divide-y divide-linea overflow-hidden rounded-btn border border-linea bg-sup';

function Filtros({ opciones, filtro, setFiltro, color }: { opciones: { id: string; nombre: string }[]; filtro: string | null; setFiltro: (f: string | null) => void; color: (id: string) => string }) {
  return (
    <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-x-1">
      <ChipBoton activo={filtro === null} onClick={() => setFiltro(null)}>Todos</ChipBoton>
      {opciones.map((o) => (
        <ChipBoton key={o.id} activo={filtro === o.id} onClick={() => setFiltro(o.id)}>
          <span aria-hidden className={cn('mr-1.5 inline-block size-2 rounded-[1px]', color(o.id))} />
          {o.nombre}
        </ChipBoton>
      ))}
    </div>
  );
}

/** Si el ejercicio trae un video de YouTube, su miniatura 16:9 arriba del renglón (como las tarjetas de Videos); sin video, nada. */
function MiniaturaDeEjercicio({ enlace }: { enlace: string | null }) {
  const src = urlDeMiniatura(enlace ?? '') as string | null;
  const [rota, setRota] = useState(false);
  if (!src || rota) return null;
  return (
    <span aria-hidden className="relative block aspect-video w-full overflow-hidden rounded-btn bg-sup-2">
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setRota(true)} className="absolute inset-0 size-full object-cover" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-9 place-items-center rounded-full bg-negro/80 text-sobre-negro">
          <Play className="size-4 translate-x-px fill-current" />
        </span>
      </span>
    </span>
  );
}

function ListaDeEjercicios({ todos, visibles, filtro, setFiltro, elegido, elegir }: { todos: EjercicioDeLista[]; visibles: EjercicioDeLista[]; filtro: string | null; setFiltro: (f: string | null) => void; elegido: string | null; elegir: (id: string) => void }) {
  if (todos.length === 0) {
    return (
      <Vacio icono={BookOpen} titulo="La biblioteca está vacía">
        Acá van los ejercicios del club, con lo que cada profe aprendió al usarlos. Cargar uno son dos campos: título y tema.
      </Vacio>
    );
  }
  return (
    <>
      <Filtros opciones={temasConEjercicios(todos)} filtro={filtro} setFiltro={setFiltro} color={colorDeTema} />
      <ul className={LISTA}>
        {visibles.map((e) => (
          <Item key={e.id} elegido={e.id === elegido} alTocar={() => elegir(e.id)}>
            <MiniaturaDeEjercicio enlace={e.enlace} />
            <span className="flex w-full items-center gap-2">
              <Etiqueta className={colorDeTema(e.tema)}>{nombreDeTema(e.tema)}</Etiqueta>
              {e.tieneNotas && <span className="ml-auto text-xs font-semibold text-sube">✓ probado</span>}
            </span>
            <span className={cn('leading-snug', elegido === e.id ? 'font-bold' : 'font-semibold')}>{e.titulo}</span>
            {textoDeVariaciones(e.cantidadVariaciones) && <span className="text-xs text-gris">{textoDeVariaciones(e.cantidadVariaciones)}</span>}
          </Item>
        ))}
      </ul>
    </>
  );
}

function ListaDeJugadas({ todas, visibles, filtro, setFiltro, elegido, elegir }: { todas: JugadaDelClub[]; visibles: JugadaDelClub[]; filtro: string | null; setFiltro: (f: string | null) => void; elegido: string | null; elegir: (id: string) => void }) {
  if (todas.length === 0) {
    return (
      <Vacio icono={BookOpen} titulo="Todavía no hay jugadas">
        La biblioteca del club: cada profe carga las suyas y todos las ven. Las nuevas se arman acá, en compu o tablet: tocá «Nueva jugada».
      </Vacio>
    );
  }
  return (
    <>
      <Filtros opciones={tiposConJugadas(todas).map((t) => ({ id: t.clave, nombre: t.etiqueta }))} filtro={filtro} setFiltro={setFiltro} color={colorDeTipo} />
      <ul className={LISTA}>
        {visibles.map((j) => (
          <Item key={j.id} elegido={j.id === elegido} alTocar={() => elegir(j.id)}>
            <span className="flex w-full items-center gap-2">
              <Etiqueta className={colorDeTipo(j.tipo)}>{etiquetaDeTipo(j.tipo)}</Etiqueta>
              {j.esMia && <span className="ml-auto text-xs font-semibold text-gris">Tuya</span>}
            </span>
            <span className={cn('leading-snug', elegido === j.id ? 'font-bold' : 'font-semibold')}>{j.nombre}</span>
            <span className="text-xs text-gris">{j.datos.pasos.length === 1 ? '1 paso' : `${j.datos.pasos.length} pasos`}</span>
          </Item>
        ))}
      </ul>
    </>
  );
}

/* ---------- Ejercicio: pizarra al centro, detalle a la derecha ---------- */

type Dialogo =
  | { tipo: 'editar' }
  | { tipo: 'borrar' }
  | { tipo: 'nota' }
  | { tipo: 'borrarNota'; id: string }
  | { tipo: 'variacion'; previa?: VariacionDeEjercicio }
  | { tipo: 'borrarVariacion'; variacion: VariacionDeEjercicio };

function DeEjercicio({ clubId, ejercicio }: { clubId: string; ejercicio: EjercicioDeLista }) {
  const detalle = useDetalleDeEjercicio(clubId, ejercicio.id);
  const { sesion } = useSesion();
  const yo = sesion?.user.id ?? null;
  const esMio = (autor: string | null | undefined) => yo !== null && autor === yo;
  const propio = esMio(ejercicio.creadoPor);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);
  const conPizarra = Boolean(detalle.data?.ejercicio?.pizarra);
  const textos = (notas: NotaDeEjercicio[], variaciones: VariacionDeEjercicio[]) => (
    <>
      {ejercicio.descripcion && (
        <section aria-label="Cómo se hace">
          <h3 className={SECCION}>Cómo se hace</h3>
          <p className="text-base leading-relaxed whitespace-pre-line">{ejercicio.descripcion}</p>
        </section>
      )}
      <Variaciones
        variaciones={variaciones}
        esMia={(v) => esMio(v.creadoPor)}
        alSumar={() => setDialogo({ tipo: 'variacion' })}
        alEditar={(v) => setDialogo({ tipo: 'variacion', previa: v })}
        alBorrar={(v) => setDialogo({ tipo: 'borrarVariacion', variacion: v })}
      />
      <Notas notas={notas} esMia={(n) => esMio(n.creadoPor)} alAgregar={() => setDialogo({ tipo: 'nota' })} alBorrar={(n) => setDialogo({ tipo: 'borrarNota', id: n.id })} />
    </>
  );
  return (
    <>
      <section aria-label="Pizarra" className="order-1 min-w-0 lg:order-2">
        <h2 className="mb-3 font-titulo text-3xl leading-none font-semibold tracking-wide uppercase">{ejercicio.titulo}</h2>
        <Consulta consulta={detalle} errorGenerico="No pudimos cargar el ejercicio" filas={2}>
          {({ ejercicio: completo, notas, variaciones }) =>
            completo?.pizarra ? (
              <Pizarra datos={completo.pizarra} etiqueta={`Pizarra del ejercicio: ${ejercicio.titulo}`} />
            ) : (
              // Sin pizarra, el centro se usa para lo que sí hay: la descripción, las variaciones y las notas.
              <div className="flex flex-col gap-6">
                <p className="text-sm text-gris">Este ejercicio no tiene pizarra dibujada.</p>
                {textos(notas, variaciones)}
              </div>
            )
          }
        </Consulta>
      </section>
      <aside aria-label="Detalle" className="order-2 flex min-w-0 flex-col gap-5 lg:order-3 print:hidden">
        {propio && (
          <div className="flex gap-2">
            <Boton variante="contorno" tamano="chico" className="flex-1" onClick={() => setDialogo({ tipo: 'editar' })}>
              <Pencil aria-hidden className="size-4" />
              Editar
            </Boton>
            <Boton variante="contorno" tamano="chico" className="flex-1" onClick={() => setDialogo({ tipo: 'borrar' })}>
              <Trash2 aria-hidden className="size-4" />
              Borrar
            </Boton>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta className={cn('min-h-7 px-2.5 text-xs', colorDeTema(ejercicio.tema))}>{nombreDeTema(ejercicio.tema)}</Etiqueta>
          {ejercicio.tieneNotas && <span className="text-sm font-semibold text-sube">✓ probado</span>}
        </div>
        <dl className="flex flex-col gap-3">
          {ejercicio.material && <Dato icono={Package} tono="bg-baja-fondo text-baja" clave="Material" valor={ejercicio.material} />}
          {ejercicio.jugadores?.trim() && <Dato icono={Users} tono="bg-sube-fondo text-sube" clave="Jugadores" valor={ejercicio.jugadores.trim()} />}
          {ejercicio.categorias?.trim() && <Dato icono={Tag} tono="bg-club-cl text-club-texto" clave="Categorías" valor={ejercicio.categorias.trim()} />}
        </dl>
        {ejercicio.enlace && <VideoDeEjercicio link={ejercicio.enlace} titulo={ejercicio.titulo} />}
        {conPizarra && (
          <Consulta consulta={detalle} errorGenerico="No pudimos cargar las notas" filas={1}>
            {({ notas, variaciones }) => textos(notas, variaciones)}
          </Consulta>
        )}
      </aside>
      {dialogo?.tipo === 'editar' && <HojaDeEjercicio abierta alCambiar={(a) => !a && cerrar()} clubId={clubId} previo={ejercicio} />}
      {dialogo?.tipo === 'borrar' && <BorrarEjercicio abierta alCerrar={cerrar} clubId={clubId} ejercicio={ejercicio} alBorrar={cerrar} />}
      {dialogo?.tipo === 'nota' && <HojaDeNota abierta alCambiar={(a) => !a && cerrar()} clubId={clubId} ejercicioId={ejercicio.id} />}
      {dialogo?.tipo === 'borrarNota' && <BorrarNota abierta alCerrar={cerrar} clubId={clubId} notaId={dialogo.id} />}
      {dialogo?.tipo === 'variacion' && (
        <HojaDeVariacion abierta alCambiar={(a) => !a && cerrar()} clubId={clubId} ejercicioId={ejercicio.id} variaciones={detalle.data?.variaciones ?? []} previa={dialogo.previa} />
      )}
      {dialogo?.tipo === 'borrarVariacion' && <BorrarVariacion abierta alCerrar={cerrar} clubId={clubId} variacion={dialogo.variacion} />}
    </>
  );
}

const SECCION = 'mb-2 font-titulo text-xl leading-none font-semibold tracking-wide uppercase';

/** Un botón chico de texto para agregar, al lado del título de la sección. */
function Agregar({ alTocar, children }: { alTocar: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={alTocar} className={cn(ENLACE_TEXTO, 'gap-1')}>
      <Plus aria-hidden className="size-4" />
      {children}
    </button>
  );
}

/** Editar o borrar lo propio: ícono solo, con nombre para el lector de pantalla y alto táctil. */
function AccionPropia({ nombre, alTocar, children }: { nombre: string; alTocar: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={nombre} onClick={alTocar} className="grid min-h-11 w-11 shrink-0 place-items-center text-gris outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:text-tinta">
      {children}
    </button>
  );
}

/** Cuántas hay, al lado del título; vacía no ocupa lugar con un cartel grande. */
function Variaciones({ variaciones, esMia, alSumar, alEditar, alBorrar }: { variaciones: VariacionDeEjercicio[]; esMia: (v: VariacionDeEjercicio) => boolean; alSumar: () => void; alEditar: (v: VariacionDeEjercicio) => void; alBorrar: (v: VariacionDeEjercicio) => void }) {
  return (
    <section aria-label="Variaciones">
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn(SECCION, variaciones.length === 0 && 'text-gris')}>
          Variaciones {variaciones.length > 0 && <span className="ml-1 font-mono text-xs font-medium text-gris">{variaciones.length}</span>}
        </h3>
        <Agregar alTocar={alSumar}>Sumar una variación</Agregar>
      </div>
      {variaciones.length === 0 ? (
        <p className="text-sm text-gris">Todavía no hay variaciones. ¿Cómo le subís la dificultad? Con un defensor, menos espacio, un límite de tiempo…</p>
      ) : (
        <ol className="flex flex-col divide-y divide-linea border-y border-linea">
          {(ordenarVariaciones(variaciones) as VariacionDeEjercicio[]).map((v) => (
            <li key={v.id} className="flex items-start gap-3 py-3 text-sm">
              <Etiqueta className="mt-0.5 shrink-0 bg-tinta text-sup">Nivel {v.nivel}</Etiqueta>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{v.titulo}</p>
                {v.eje && <p className="font-mono text-xs tracking-wide text-gris uppercase">{nombreDeEje(v.eje) as string}</p>}
                {v.descripcion && <p className="mt-1 text-gris">{v.descripcion}</p>}
              </div>
              {esMia(v) && (
                <>
                  <AccionPropia nombre={`Editar la variación ${v.titulo}`} alTocar={() => alEditar(v)}>
                    <Pencil aria-hidden className="size-4" />
                  </AccionPropia>
                  <AccionPropia nombre={`Borrar la variación ${v.titulo}`} alTocar={() => alBorrar(v)}>
                    <Trash2 aria-hidden className="size-4" />
                  </AccionPropia>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Notas({ notas, esMia, alAgregar, alBorrar }: { notas: NotaDeEjercicio[]; esMia: (n: NotaDeEjercicio) => boolean; alAgregar: () => void; alBorrar: (n: NotaDeEjercicio) => void }) {
  return (
    <section aria-label="Notas de uso">
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn(SECCION, notas.length === 0 && 'text-gris')}>
          Notas de uso {notas.length > 0 && <span className="ml-1 font-mono text-xs font-medium text-gris">{notas.length}</span>}
        </h3>
        <Agregar alTocar={alAgregar}>Agregar una nota</Agregar>
      </div>
      {notas.length === 0 ? (
        <p className="text-sm text-gris">Nadie anotó nada todavía. Si lo probaste, lo que aprendiste le sirve al que venga.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea border-y border-linea">
          {notas.map((n) => (
            <li key={n.id} className="flex items-start gap-2 py-3 text-sm">
              <span className="min-w-0 flex-1 whitespace-pre-line">{n.texto}</span>
              {esMia(n) && (
                <AccionPropia nombre="Borrar esta nota" alTocar={() => alBorrar(n)}>
                  <Trash2 aria-hidden className="size-4" />
                </AccionPropia>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Un dato del ejercicio con su ícono de color: se reconoce sin leer la palabra. */
function Dato({ icono: Icono, tono, clave, valor }: { icono: typeof Package; tono: string; clave: string; valor: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-[2px]', tono)}>
        <Icono className="size-[1.125rem]" />
      </span>
      <div className="min-w-0">
        <dt className="font-mono text-[0.6875rem] tracking-wide text-gris uppercase">{clave}</dt>
        <dd className="font-semibold">{valor}</dd>
      </div>
    </div>
  );
}

/* ---------- Jugada: ver, asignar, duplicar, imprimir ---------- */

function DeJugada({ clubId, jugada, planteles }: { clubId: string; jugada: JugadaDelClub; planteles: PlantelDelClub[] }) {
  const [asignando, setAsignando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const duplicar = useDuplicarJugada(clubId);
  const [copiada, setCopiada] = useState(false);
  // El editor necesita espacio: en un celular las jugadas se ven, se asignan y se duplican.
  const [puedeEditar, setPuedeEditar] = useState(true);
  useEffect(() => {
    setPuedeEditar(pantallaAptaParaEditar(window.innerWidth, window.innerHeight) as boolean);
  }, []);

  const hacerCopia = () =>
    duplicar.mutate(
      { nombre: nombreDeCopia(jugada.nombre, LIMITE.titulo), tipo: jugada.tipo, datos: duplicarDatos(jugada.datos) as typeof jugada.datos },
      { onSuccess: () => setCopiada(true) },
    );

  return (
    <>
      <section aria-label="Pizarra" className="order-1 min-w-0 lg:order-2">
        <h2 className="mb-3 font-titulo text-3xl leading-none font-semibold tracking-wide uppercase">{jugada.nombre}</h2>
        <Pizarra datos={jugada.datos} nosotrosDefiende={nosotrosDefiende(jugada.tipo) as boolean} etiqueta={`Jugada: ${jugada.nombre}`} />
      </section>
      <aside aria-label="Detalle" className="order-2 flex min-w-0 flex-col gap-4 lg:order-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta className={cn('min-h-7 px-2.5 text-xs', colorDeTipo(jugada.tipo))}>{etiquetaDeTipo(jugada.tipo) as string}</Etiqueta>
          <Chip>{jugada.esMia ? 'Tuya' : 'De otro profe'}</Chip>
        </div>
        {copiada && <Aviso tono="ok" titulo="Jugada duplicada">Quedó en tu biblioteca como copia tuya.</Aviso>}
        {duplicar.isError && <Aviso tono="error" titulo="No pudimos duplicar la jugada">{mensajeDeError(duplicar.error, 'Probá de nuevo en un momento.')}</Aviso>}
        <div className="flex flex-col gap-2">
          <Boton variante="secundario" onClick={() => setAsignando(true)}>
            <Users aria-hidden className="size-4" />
            Asignar a planteles
          </Boton>
          <div className="flex gap-2">
            <Boton variante="contorno" className="flex-1" disabled={duplicar.isPending} onClick={hacerCopia}>
              <Copy aria-hidden className="size-4" />
              Duplicar
            </Boton>
            <Boton variante="contorno" className="flex-1" onClick={() => window.print()}>
              <Printer aria-hidden className="size-4" />
              Imprimir
            </Boton>
          </div>
          {jugada.esMia &&
            (puedeEditar ? (
              <Link to={rutaDelEditor(jugada.id)} className={BOTON_DE_ENLACE}>
                <Pencil aria-hidden className="size-4" />
                Editar jugada
              </Link>
            ) : (
              <p className="text-sm text-gris">El editor de jugadas es para compu o tablet. Desde acá podés verlas, asignarlas y duplicarlas.</p>
            ))}
          {jugada.esMia && (
            <button type="button" onClick={() => setBorrando(true)} className={cn(ENLACE_TEXTO, 'text-club-texto')}>
              <Trash2 aria-hidden className="mr-2 size-4" />
              Borrar jugada
            </button>
          )}
        </div>
        <Borrar abierta={borrando} alCambiar={setBorrando} clubId={clubId} jugada={jugada} />
        <Asignar abierta={asignando} alCambiar={setAsignando} clubId={clubId} jugada={jugada} planteles={planteles} />
      </aside>
    </>
  );
}

/** Asignar la jugada a los planteles propios: queda asignada exactamente a lo tildado. */
function Asignar({ abierta, alCambiar, clubId, jugada, planteles }: { abierta: boolean; alCambiar: (a: boolean) => void; clubId: string; jugada: JugadaDelClub; planteles: PlantelDelClub[] }) {
  const actuales = usePlantelesDeJugada(clubId, abierta ? jugada.id : undefined);
  const guardar = useAsignarJugada(clubId, jugada.id);
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo="Asignar a planteles" descripcion="Elegí a qué categorías les llega esta jugada." etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold uppercase">Asignar a planteles</h2>
        {planteles.length === 0 ? (
          <p className="text-sm text-gris">No tenés planteles propios para asignarle esta jugada.</p>
        ) : (
          <Consulta consulta={actuales} errorGenerico="No pudimos ver a quién está asignada">
            {(ids) => (
              <FormularioDeAsignacion
                key={ids.join(',')}
                inicial={ids}
                planteles={planteles}
                guardando={guardar.isPending}
                error={guardar.isError ? mensajeDeError(guardar.error, 'No se pudo guardar la asignación.') : null}
                alGuardar={(sel) => guardar.mutate(sel, { onSuccess: () => alCambiar(false) })}
              />
            )}
          </Consulta>
        )}
      </div>
    </Hoja>
  );
}

function FormularioDeAsignacion({ inicial, planteles, guardando, error, alGuardar }: { inicial: string[]; planteles: PlantelDelClub[]; guardando: boolean; error: string | null; alGuardar: (ids: string[]) => void }) {
  const [sel, setSel] = useState(new Set(inicial));
  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <>
      <ul className="flex flex-col gap-1">
        {planteles.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-11 items-center gap-3 rounded-campo px-2">
              <input type="checkbox" checked={sel.has(p.id)} onChange={() => alternar(p.id)} className="size-5 accent-[var(--club)]" />
              <span>{p.categoria}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <Aviso tono="error" titulo="No se guardó">{error}</Aviso>}
      <Boton disabled={guardando} onClick={() => alGuardar([...sel])}>
        Guardar
      </Boton>
    </>
  );
}

/** Borrar una jugada propia: se pide confirmación porque desaparece también de los planteles a los que estaba asignada. */
function Borrar({ abierta, alCambiar, clubId, jugada }: { abierta: boolean; alCambiar: (a: boolean) => void; clubId: string; jugada: JugadaDelClub }) {
  const borrar = useBorrarJugada(clubId);
  const error = borrar.isError ? (borrar.error?.message === 'NO_ES_TUYA' ? 'Esta jugada ya no es tuya: no se puede borrar.' : mensajeDeError(borrar.error, 'No se pudo borrar la jugada.')) : null;
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo="Borrar esta jugada" descripcion="Confirmá que querés borrar la jugada." etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold uppercase">Borrar esta jugada</h2>
        <p className="text-base">«{jugada.nombre}» se borra para todo el club y deja de verse en los planteles a los que estaba asignada. No se puede deshacer.</p>
        {error && <Aviso tono="error" titulo="No se borró">{error}</Aviso>}
        <Boton variante="club" disabled={borrar.isPending} onClick={() => borrar.mutate(jugada.id, { onSuccess: () => alCambiar(false) })}>
          {borrar.isPending ? 'Borrando…' : 'Borrar de todos modos'}
        </Boton>
        <Boton variante="contorno" onClick={() => alCambiar(false)}>
          Cancelar
        </Boton>
      </div>
    </Hoja>
  );
}

/** Alta de una jugada: nombre, tipo y formación inicial; al crearla se abre el editor. */
function NuevaJugada({ abierta, alCambiar, clubId }: { abierta: boolean; alCambiar: (a: boolean) => void; clubId: string }) {
  const crear = useDuplicarJugada(clubId);
  const navegar = useNavigate();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<string | null>(null);
  const [formacion, setFormacion] = useState<string | null>(null);
  const [falta, setFalta] = useState(false);
  const [apta, setApta] = useState(true);
  useEffect(() => {
    if (abierta) setApta(pantallaAptaParaEditar(window.innerWidth, window.innerHeight) as boolean);
  }, [abierta]);

  const enviar = () => {
    const elegida = FORMACIONES.find((f) => f.clave === formacion);
    if (!nombre.trim() || !tipo || !elegida) return setFalta(true);
    setFalta(false);
    crear.mutate(
      { nombre: nombre.trim(), tipo, datos: duplicarDatos(elegida.datos) as typeof elegida.datos },
      {
        onSuccess: (id) => {
          alCambiar(false);
          setNombre('');
          setTipo(null);
          setFormacion(null);
          void navegar(rutaDelEditor(id));
        },
      },
    );
  };

  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo="Nueva jugada" descripcion="Elegí un nombre, el tipo y desde qué formación arrancar." etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold uppercase">Nueva jugada</h2>
        {!apta ? (
          <p className="text-sm text-gris">El editor de jugadas es para compu o tablet. Desde acá podés verlas, asignarlas y duplicarlas.</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <Campo etiqueta="Nombre" value={nombre} maxLength={LIMITE.titulo} autoComplete="off" onChange={(e) => setNombre(e.target.value)} />
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">Tipo</legend>
              <div className="flex flex-wrap gap-x-1">
                {TIPOS_JUGADA.map((t) => (
                  <ChipBoton key={t.clave} type="button" activo={tipo === t.clave} aria-pressed={tipo === t.clave} onClick={() => setTipo(t.clave)}>
                    {t.etiqueta}
                  </ChipBoton>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">Formación</legend>
              <div className="flex flex-wrap gap-x-1">
                {FORMACIONES.map((f) => (
                  <ChipBoton key={f.clave} type="button" activo={formacion === f.clave} aria-pressed={formacion === f.clave} onClick={() => setFormacion(f.clave)}>
                    {f.etiqueta}
                  </ChipBoton>
                ))}
              </div>
            </fieldset>
            {falta && <Aviso tono="error" titulo="Poné un nombre y elegí tipo y formación." />}
            {crear.isError && <Aviso tono="error" titulo="No pudimos crear la jugada">{mensajeDeError(crear.error, 'Probá de nuevo en un momento.')}</Aviso>}
            <Boton type="submit" disabled={crear.isPending}>
              {crear.isPending ? 'Creando…' : 'Crear jugada'}
            </Boton>
          </form>
        )}
      </div>
    </Hoja>
  );
}
