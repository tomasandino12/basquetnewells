import { BookOpen, Copy, Pencil, Printer, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { duplicarDatos, etiquetaDeTipo, nosotrosDefiende, pantallaAptaParaEditar } from '@datos/jugadas.js';
import { LIMITE } from '@datos/limites.js';
import { nombreDeEje, ordenarVariaciones } from '@datos/variaciones.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Chip, ChipBoton } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Pizarra } from '../components/ui/pizarra';
import { Hoja } from '../components/ui/sheet';
import { APP_DE_SIEMPRE } from '../clasica';
import { useAsignarJugada, useDetalleDeEjercicio, useDuplicarJugada, useEjercicios, useJugadasDelClub, usePlantelesDeJugada } from '../datos/consultasRecursos';
import { mensajeDeError } from '../datos/errores';
import type { EjercicioDeLista, JugadaDelClub, PlantelDelClub } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { usePlantelActivo } from '../plantel/activo';
import { filtrarEjercicios, filtrarJugadas, nombreDeCopia, nombreDeTema, temasConEjercicios, textoDeVariaciones, tiposConJugadas } from '../recursos/biblioteca';
import { SinCategoria } from './PlantelDelClub';
import { VideoDeEjercicio } from '../fisico/VideoDeEjercicio';

type Pestana = 'ejercicios' | 'jugadas';

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
      <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5">
        <SinCategoria />
      </main>
    );
  }
  return <Biblioteca clubId={activo.clubId} planteles={activo.visibles} />;
}

function Biblioteca({ clubId, planteles }: { clubId: string; planteles: PlantelDelClub[] }) {
  const ejercicios = useEjercicios(clubId);
  const jugadas = useJugadasDelClub(clubId);
  const [pestana, setPestana] = useState<Pestana>('ejercicios');
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState<string | null>(null);
  const [elegida, setElegida] = useState<{ ejercicios: string | null; jugadas: string | null }>({ ejercicios: null, jugadas: null });

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
    <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5 sm:max-w-none sm:px-6 lg:max-w-[96rem] lg:px-8 lg:py-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="font-titulo text-4xl leading-none font-bold tracking-wide uppercase">Recursos</h1>
        <div role="tablist" aria-label="Biblioteca" className="flex rounded-campo border border-borde-control p-0.5">
          {(['ejercicios', 'jugadas'] as const).map((p) => (
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
              {p === 'ejercicios' ? 'Ejercicios' : 'Jugadas'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)_20rem] lg:items-start">
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
    </main>
  );
}

/** Un ítem de la lista. El elegido va en rojo suave y con filete: se lee por forma, no sólo por color. */
function Item({ elegido, alTocar, children }: { elegido: boolean; alTocar: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        aria-current={elegido ? 'true' : undefined}
        onClick={alTocar}
        className={cn(
          'flex min-h-14 w-full flex-col items-start gap-1 rounded-tarjeta border border-l-[5px] px-3 py-2 text-left outline-offset-2 transition-transform duration-[var(--dur-1)] focus-visible:outline-2 focus-visible:outline-tinta active:scale-[.99]',
          elegido ? 'border-club bg-club-cl' : 'border-linea border-l-linea bg-sup [@media(hover:hover)]:hover:border-borde-control',
        )}
      >
        {children}
      </button>
    </li>
  );
}

function Filtros({ opciones, filtro, setFiltro }: { opciones: { id: string; nombre: string }[]; filtro: string | null; setFiltro: (f: string | null) => void }) {
  return (
    <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-x-1">
      <ChipBoton activo={filtro === null} onClick={() => setFiltro(null)}>Todos</ChipBoton>
      {opciones.map((o) => (
        <ChipBoton key={o.id} activo={filtro === o.id} onClick={() => setFiltro(o.id)}>
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
      <Filtros opciones={temasConEjercicios(todos)} filtro={filtro} setFiltro={setFiltro} />
      <ul className="flex flex-col gap-2">
        {visibles.map((e) => (
          <Item key={e.id} elegido={e.id === elegido} alTocar={() => elegir(e.id)}>
            <span className="flex w-full items-center gap-2">
              <span className="font-mono text-[0.6875rem] tracking-wide text-gris uppercase">{nombreDeTema(e.tema)}</span>
              {e.tieneNotas && <Chip className="ml-auto">✓ probado</Chip>}
            </span>
            <span className="font-semibold">{e.titulo}</span>
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
      <Filtros opciones={tiposConJugadas(todas).map((t) => ({ id: t.clave, nombre: t.etiqueta }))} filtro={filtro} setFiltro={setFiltro} />
      <ul className="flex flex-col gap-2">
        {visibles.map((j) => (
          <Item key={j.id} elegido={j.id === elegido} alTocar={() => elegir(j.id)}>
            <span className="font-mono text-[0.6875rem] tracking-wide text-gris uppercase">{etiquetaDeTipo(j.tipo)}</span>
            <span className="font-semibold">{j.nombre}</span>
            <span className="text-xs text-gris">
              {j.datos.pasos.length === 1 ? '1 paso' : `${j.datos.pasos.length} pasos`}
              {j.esMia ? ' · Tuya' : ''}
            </span>
          </Item>
        ))}
      </ul>
    </>
  );
}

/* ---------- Ejercicio: pizarra al centro, detalle a la derecha ---------- */

function DeEjercicio({ clubId, ejercicio }: { clubId: string; ejercicio: EjercicioDeLista }) {
  const detalle = useDetalleDeEjercicio(clubId, ejercicio.id);
  return (
    <>
      <section aria-label="Pizarra" className="order-1 min-w-0 lg:order-2">
        <h2 className="mb-3 font-titulo text-3xl leading-none font-semibold tracking-wide uppercase">{ejercicio.titulo}</h2>
        <Consulta consulta={detalle} errorGenerico="No pudimos cargar el ejercicio" filas={2}>
          {({ ejercicio: completo }) =>
            completo?.pizarra ? (
              <Pizarra datos={completo.pizarra} etiqueta={`Pizarra del ejercicio: ${ejercicio.titulo}`} />
            ) : (
              <p className="rounded-tarjeta border border-dashed border-borde-control p-6 text-center text-sm text-gris">Este ejercicio no tiene pizarra dibujada.</p>
            )
          }
        </Consulta>
      </section>
      <aside aria-label="Detalle" className="order-2 flex min-w-0 flex-col gap-4 lg:order-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tono="activo">{nombreDeTema(ejercicio.tema)}</Chip>
          {ejercicio.tieneNotas && <Chip>✓ probado</Chip>}
        </div>
        {ejercicio.descripcion && <p className="text-base whitespace-pre-line">{ejercicio.descripcion}</p>}
        <dl className="flex flex-col gap-1 text-sm">
          {ejercicio.material && <Dato clave="Material" valor={ejercicio.material} />}
          {ejercicio.jugadores != null && <Dato clave="Jugadores" valor={String(ejercicio.jugadores)} />}
          {ejercicio.categorias && ejercicio.categorias.length > 0 && <Dato clave="Categorías" valor={ejercicio.categorias.join(', ')} />}
        </dl>
        {ejercicio.enlace && <VideoDeEjercicio link={ejercicio.enlace} titulo={ejercicio.titulo} />}
        <Consulta consulta={detalle} errorGenerico="No pudimos cargar las notas" filas={1}>
          {({ notas, variaciones }) => (
            <>
              <section aria-label="Variaciones">
                <h3 className="mb-2 font-titulo text-xl font-semibold tracking-wide uppercase">Variaciones</h3>
                {variaciones.length === 0 ? (
                  <p className="text-sm text-gris">Todavía no hay variaciones.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {(ordenarVariaciones(variaciones) as typeof variaciones).map((v) => (
                      <li key={v.id} className="rounded-tarjeta border border-linea bg-sup p-3 text-sm">
                        <p className="font-semibold">
                          Nivel {v.nivel}
                          {v.eje ? ` · ${nombreDeEje(v.eje) as string}` : ''}
                        </p>
                        <p>{v.titulo}</p>
                        {v.descripcion && <p className="mt-1 text-gris">{v.descripcion}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section aria-label="Notas de uso">
                <h3 className="mb-2 font-titulo text-xl font-semibold tracking-wide uppercase">Notas de uso</h3>
                {notas.length === 0 ? (
                  <p className="text-sm text-gris">Nadie anotó nada todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {notas.map((n) => (
                      <li key={n.id} className="rounded-tarjeta border border-linea bg-sup p-3 text-sm whitespace-pre-line">
                        {n.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </Consulta>
        <a href={APP_DE_SIEMPRE} className={ENLACE_TEXTO}>
          <Pencil aria-hidden className="mr-2 size-4" />
          Editar o anotar en la app de siempre
        </a>
      </aside>
    </>
  );
}

function Dato({ clave, valor }: { clave: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-gris">{clave}</dt>
      <dd className="min-w-0">{valor}</dd>
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
          <Chip tono="activo">{etiquetaDeTipo(jugada.tipo) as string}</Chip>
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
