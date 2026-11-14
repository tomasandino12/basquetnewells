import { BookOpen, Copy, Package, Pencil, Printer, Search, Tag, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { duplicarDatos, etiquetaDeTipo, nosotrosDefiende, pantallaAptaParaEditar } from '@datos/jugadas.js';
import { LIMITE } from '@datos/limites.js';
import { nombreDeEje, ordenarVariaciones } from '@datos/variaciones.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Chip, ChipBoton, Etiqueta } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Pizarra } from '../components/ui/pizarra';
import { Hoja } from '../components/ui/sheet';
import { APP_DE_SIEMPRE } from '../clasica';
import { useAsignarJugada, useDetalleDeEjercicio, useDuplicarJugada, useEjercicios, useJugadasDelClub, usePlantelesDeJugada } from '../datos/consultasRecursos';
import { mensajeDeError } from '../datos/errores';
import type { EjercicioDeLista, JugadaDelClub, NotaDeEjercicio, PlantelDelClub, VariacionDeEjercicio } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { usePlantelActivo } from '../plantel/activo';
import { colorDeTema, colorDeTipo } from '../recursos/colores';
import { filtrarEjercicios, filtrarJugadas, nombreDeCopia, nombreDeTema, temasConEjercicios, textoDeVariaciones, tiposConJugadas } from '../recursos/biblioteca';
import { Pagina } from '../components/ui/pagina';
import { SinCategoria } from './PlantelDelClub';
import { VideoDeEjercicio } from '../fisico/VideoDeEjercicio';
import { Videos } from './RecursosVideos';

type Pestana = 'ejercicios' | 'jugadas' | 'videos';
const NOMBRE_DE_PESTANA: Record<Pestana, string> = { ejercicios: 'Ejercicios', jugadas: 'Jugadas', videos: 'Videos' };

// Un enlace con forma de botón recto y a la vista; el texto largo entra en una línea (el botón de mayúsculas lo partía).
const BOTON_DE_ENLACE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-borde-control px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta';

const ENLACE_TEXTO =
  'inline-flex min-h-11 items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:decoration-club';

/**
 * Recursos: la biblioteca del club. En compu, tres columnas (la lista, la pizarra, el detalle); en
 * el celular, la pizarra arriba, después el detalle y la lista abajo. Crear, editar y borrar siguen
 * en la app de siempre (hace falta compu o tablet para la pizarra).
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
  const [pestana, setPestana] = useState<Pestana>('ejercicios');
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<string | null>(null);
  const [elegida, setElegida] = useState<Record<Pestana, string | null>>({ ejercicios: null, jugadas: null, videos: null });

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
        ) : null
      ) : (
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)_minmax(16rem,1fr)] lg:items-start">
        <section aria-label="Lista" className="order-3 flex flex-col gap-3 lg:order-1 print:hidden">
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
          <Consulta consulta={{ isPending: lista.isPending, isError: lista.isError, error: lista.error, data: lista.data as unknown, refetch: lista.refetch }} errorGenerico={pestana === 'ejercicios' ? 'No pudimos cargar los ejercicios' : 'No pudimos cargar las jugadas'}>
            {() =>
              pestana === 'ejercicios' ? (
                <ListaDeEjercicios todos={ejercicios.data ?? []} visibles={visiblesEj} filtro={filtro} setFiltro={setFiltro} elegido={idElegido} elegir={elegir} />
              ) : (
                <ListaDeJugadas todas={jugadas.data ?? []} visibles={visiblesJu} filtro={filtro} setFiltro={setFiltro} elegido={idElegido} elegir={elegir} />
              )
            }
          </Consulta>
          <p className="text-sm text-gris">
            Crear, editar y borrar, los jugadores y el inventario siguen en{' '}
            <a href={APP_DE_SIEMPRE} className="font-semibold underline">la app de siempre</a>.
          </p>
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

function ListaDeEjercicios({ todos, visibles, filtro, setFiltro, elegido, elegir }: { todos: EjercicioDeLista[]; visibles: EjercicioDeLista[]; filtro: string | null; setFiltro: (f: string | null) => void; elegido: string | null; elegir: (id: string) => void }) {
  if (todos.length === 0) {
    return (
      <Vacio icono={BookOpen} titulo="La biblioteca está vacía">
        Acá van los ejercicios del club, con lo que cada profe aprendió al usarlos. Cargar uno son dos campos: título y tema, desde la app de siempre.
      </Vacio>
    );
  }
  return (
    <>
      <Filtros opciones={temasConEjercicios(todos)} filtro={filtro} setFiltro={setFiltro} color={colorDeTema} />
      <ul className={LISTA}>
        {visibles.map((e) => (
          <Item key={e.id} elegido={e.id === elegido} alTocar={() => elegir(e.id)}>
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
        La biblioteca del club: cada profe carga las suyas y todos las ven. Las nuevas se arman en la app de siempre, en compu o tablet.
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

function DeEjercicio({ clubId, ejercicio }: { clubId: string; ejercicio: EjercicioDeLista }) {
  const detalle = useDetalleDeEjercicio(clubId, ejercicio.id);
  const conPizarra = Boolean(detalle.data?.ejercicio?.pizarra);
  const textos = (notas: NotaDeEjercicio[], variaciones: VariacionDeEjercicio[]) => (
    <>
      {ejercicio.descripcion && (
        <section aria-label="Cómo se hace">
          <h3 className={SECCION}>Cómo se hace</h3>
          <p className="text-base leading-relaxed whitespace-pre-line">{ejercicio.descripcion}</p>
        </section>
      )}
      <Variaciones variaciones={variaciones} />
      <Notas notas={notas} />
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
        <a href={APP_DE_SIEMPRE} className={BOTON_DE_ENLACE}>
          <Pencil aria-hidden className="size-4" />
          Editar o anotar en la app de siempre
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta className={cn('min-h-7 px-2.5 text-xs', colorDeTema(ejercicio.tema))}>{nombreDeTema(ejercicio.tema)}</Etiqueta>
          {ejercicio.tieneNotas && <span className="text-sm font-semibold text-sube">✓ probado</span>}
        </div>
        <dl className="flex flex-col gap-3">
          {ejercicio.material && <Dato icono={Package} tono="bg-baja-fondo text-baja" clave="Material" valor={ejercicio.material} />}
          {ejercicio.jugadores != null && <Dato icono={Users} tono="bg-sube-fondo text-sube" clave="Jugadores" valor={String(ejercicio.jugadores)} />}
          {ejercicio.categorias && ejercicio.categorias.length > 0 && <Dato icono={Tag} tono="bg-club-cl text-club-texto" clave="Categorías" valor={ejercicio.categorias.join(', ')} />}
        </dl>
        {ejercicio.enlace && <VideoDeEjercicio link={ejercicio.enlace} titulo={ejercicio.titulo} />}
        {conPizarra && (
          <Consulta consulta={detalle} errorGenerico="No pudimos cargar las notas" filas={1}>
            {({ notas, variaciones }) => textos(notas, variaciones)}
          </Consulta>
        )}
      </aside>
    </>
  );
}

const SECCION = 'mb-2 font-titulo text-xl leading-none font-semibold tracking-wide uppercase';

/** Cuántas hay, al lado del título; vacía no ocupa lugar con un cartel grande. */
function Variaciones({ variaciones }: { variaciones: VariacionDeEjercicio[] }) {
  if (variaciones.length === 0) {
    return (
      <section aria-label="Variaciones">
        <h3 className={cn(SECCION, 'text-gris')}>Variaciones</h3>
        <p className="text-sm text-gris">Todavía no hay variaciones.</p>
      </section>
    );
  }
  return (
    <section aria-label="Variaciones">
      <h3 className={SECCION}>
        Variaciones <span className="ml-1 font-mono text-xs font-medium text-gris">{variaciones.length}</span>
      </h3>
      <ol className="flex flex-col divide-y divide-linea border-y border-linea">
        {(ordenarVariaciones(variaciones) as VariacionDeEjercicio[]).map((v) => (
          <li key={v.id} className="flex items-start gap-3 py-3 text-sm">
            <Etiqueta className="mt-0.5 shrink-0 bg-tinta text-sup">Nivel {v.nivel}</Etiqueta>
            <div className="min-w-0">
              <p className="font-semibold">{v.titulo}</p>
              {v.eje && <p className="font-mono text-xs tracking-wide text-gris uppercase">{nombreDeEje(v.eje) as string}</p>}
              {v.descripcion && <p className="mt-1 text-gris">{v.descripcion}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Notas({ notas }: { notas: NotaDeEjercicio[] }) {
  if (notas.length === 0) {
    return (
      <section aria-label="Notas de uso">
        <h3 className={cn(SECCION, 'text-gris')}>Notas de uso</h3>
        <p className="text-sm text-gris">Nadie anotó nada todavía.</p>
      </section>
    );
  }
  return (
    <section aria-label="Notas de uso">
      <h3 className={SECCION}>
        Notas de uso <span className="ml-1 font-mono text-xs font-medium text-gris">{notas.length}</span>
      </h3>
      <ul className="flex flex-col divide-y divide-linea border-y border-linea">
        {notas.map((n) => (
          <li key={n.id} className="py-3 text-sm whitespace-pre-line">
            {n.texto}
          </li>
        ))}
      </ul>
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
              <a href={APP_DE_SIEMPRE} className={ENLACE_TEXTO}>
                <Pencil aria-hidden className="mr-2 size-4" />
                Editar en la app de siempre
              </a>
            ) : (
              <p className="text-sm text-gris">El editor de jugadas es para compu o tablet. Desde acá podés verlas, asignarlas y duplicarlas.</p>
            ))}
        </div>
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
