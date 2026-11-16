import { ExternalLink, FileText, Play, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { esEnlaceWeb } from '@datos/enlaces.js';
import {
  alcanceDeRecurso, claseDeEnlace, contarPorTipo, estadoDeEnvio, etiquetaDeTipo, filtrarPorTipo, SIN_TIPO, TIPOS_RECURSO,
} from '@datos/recursos.js';
import { idDeYoutube, urlDeMiniatura, urlDeReproductor } from '@datos/youtube.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { REJILLA_CHICA } from '../components/ui/pagina';
import { Chip, ChipBoton } from '../components/ui/chip';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import { useSesion } from '../datos/contexto';
import { useJugadoresDeAsistencia } from '../datos/consultas';
import { useRecursosDelClub, useResumenDeRecursos } from '../datos/consultasRecursos';
import type { JugadorDelPlantel, RecursoDelClub, ResumenDeRecursos } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { BorrarRecurso, HojaDeEnvio } from './RecursosOfrecer';

type Alcance = ReturnType<typeof alcanceDeRecurso>;
type Envio = ReturnType<typeof estadoDeEnvio>;

const ETIQUETA_SIN_MINIATURA: Record<string, string> = { drive: 'Drive', pdf: 'PDF', otro: 'Link', youtube: 'Video' };

const MOTIVO_SIN_ALCANCE: Record<string, string> = {
  'sin-envios': 'Todavía no se lo enviaste a nadie de este plantel.',
  'sin-cuentas': 'Sin datos: ningún jugador con cuenta lo recibió.',
  pocos: 'Hay pocos jugadores con cuenta para mostrar cuántos lo vieron sin señalar a nadie.',
  'sin-resumen': 'No se pudo leer cuántos lo vieron.',
};

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** A quién le llegó, medido contra el plantel que se está mirando (un recurso es del club y sus envíos pueden ser de otras categorías). */
function textoDeEnvio(envio: Envio, categoria: string): string {
  if (envio.estado === 'todos') return `Enviado a todo el plantel (${categoria})`;
  if (envio.estado === 'parcial') return `Enviado a ${envio.enviados} de ${envio.total} (${categoria})`;
  return `Sin enviar al plantel (${categoria})`;
}

/**
 * Videos y links que el profe ofrece a sus jugadores: una tarjeta por recurso, con la miniatura, los datos de
 * dedicación y cuántos lo vieron (un número y una barra, nunca quiénes: con adolescentes, controlar por nombre
 * convierte una herramienta de desarrollo en una de vigilancia).
 */
export function Videos({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const recursos = useRecursosDelClub(clubId);
  const resumen = useResumenDeRecursos(plantelId);
  const chicos = useJugadoresDeAsistencia(clubId, plantelId);
  const [tipo, setTipo] = useState('todos');
  const [ofreciendo, setOfreciendo] = useState(false);
  // Un aviso con lo que acaba de pasar (enviado, borrado): las tarjetas se refrescan solas debajo.
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <section aria-label="Videos para jugadores" className="flex flex-col gap-4 lg:min-h-[calc(100dvh-10rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-gris">
          Material que dejás disponible para que cada uno progrese por su cuenta. No es obligación ni control.
        </p>
        <Boton variante="contorno" disabled={!chicos.data} onClick={() => setOfreciendo(true)}>
          <Plus aria-hidden className="size-4" />
          Ofrecer un recurso
        </Boton>
      </div>
      {aviso && <Aviso tono="ok" titulo={aviso} />}
      {chicos.isError && <Aviso tono="error" titulo="No pudimos cargar el plantel: sin eso no se puede enviar un recurso." />}
      {chicos.data && (
        <HojaDeEnvio abierta={ofreciendo} alCambiar={setOfreciendo} clubId={clubId} categoria={categoria} jugadores={chicos.data} alEnviar={setAviso} />
      )}
      <Consulta consulta={{ isPending: recursos.isPending, isError: recursos.isError, error: recursos.error, data: recursos.data as unknown, refetch: recursos.refetch }} errorGenerico="No pudimos cargar los videos">
        {() => (
          <Tarjetas
            recursos={recursos.data ?? []}
            resumen={resumen.data ?? null}
            jugadores={chicos.data ?? []}
            clubId={clubId}
            categoria={categoria}
            alAvisar={setAviso}
            tipo={tipo}
            setTipo={setTipo}
          />
        )}
      </Consulta>
    </section>
  );
}

function Tarjetas({ recursos, resumen, jugadores, clubId, categoria, alAvisar, tipo, setTipo }: {
  recursos: RecursoDelClub[];
  resumen: ResumenDeRecursos | null;
  jugadores: JugadorDelPlantel[];
  clubId: string;
  categoria: string;
  alAvisar: (aviso: string) => void;
  tipo: string;
  setTipo: (t: string) => void;
}) {
  const cuenta = useMemo(() => contarPorTipo(recursos) as Record<string, number>, [recursos]);
  const opciones = [...TIPOS_RECURSO, { clave: SIN_TIPO, etiqueta: 'Sin tipo' }].filter((t) => cuenta[t.clave] > 0);
  // Un filtro que ya no tiene recursos no puede dejar la pantalla vacía sin salida.
  const activo = tipo !== 'todos' && cuenta[tipo] > 0 ? tipo : 'todos';
  const visibles = filtrarPorTipo(recursos, activo) as RecursoDelClub[];
  const filas = new Map((resumen?.recursos ?? []).map((f) => [f.recursoId, f]));
  // Con resumen, un recurso sin fila es uno que no se envió a este plantel.
  const filaDe = (id: string) => (resumen ? (filas.get(id) ?? { enviados: 0, conCuenta: 0, abrieron: null }) : null);

  if (recursos.length === 0) {
    return (
      <Vacio icono={Play} titulo="Todavía no compartiste ningún recurso">
        El chico lo recibe por donde ya se hablan hoy (WhatsApp). Lo que hace la app es dejar registrado qué se mandó, a quién y cuándo, que es justo lo que se pierde cuando cambia el entrenador.
      </Vacio>
    );
  }
  return (
    <>
      {opciones.length > 1 && (
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-x-1">
          <ChipBoton activo={activo === 'todos'} onClick={() => setTipo('todos')}>Todos {cuenta.todos}</ChipBoton>
          {opciones.map((o) => (
            <ChipBoton key={o.clave} activo={activo === o.clave} onClick={() => setTipo(o.clave)}>
              {o.etiqueta} {cuenta[o.clave]}
            </ChipBoton>
          ))}
        </div>
      )}
      <ul className={cn(REJILLA_CHICA, 'auto-rows-fr')}>
        {visibles.map((r) => {
          const fila = filaDe(r.id);
          return (
            <li key={r.id} className="flex min-w-0">
              <TarjetaDeRecurso
                recurso={r}
                alcance={alcanceDeRecurso(fila) as Alcance}
                envio={estadoDeEnvio(r.envios, jugadores) as Envio}
                clubId={clubId}
                jugadores={jugadores}
                categoria={categoria}
                alAvisar={alAvisar}
              />
            </li>
          );
        })}
      </ul>
      <Impacto recursos={recursos} resumen={resumen} />
    </>
  );
}

function TarjetaDeRecurso({ recurso: r, alcance, envio, clubId, jugadores, categoria, alAvisar }: {
  recurso: RecursoDelClub;
  alcance: Alcance;
  envio: Envio;
  clubId: string;
  jugadores: JugadorDelPlantel[];
  categoria: string;
  alAvisar: (aviso: string) => void;
}) {
  const [viendo, setViendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const { sesion } = useSesion();
  // Borrar es sólo de quien lo cargó: la policy de la base lo impone, el botón sólo se esconde por comodidad.
  const esMio = sesion?.user.id != null && r.creadoPor === sesion.user.id;
  const faltan = envio.faltan as JugadorDelPlantel[];
  const esVideo = Boolean(idDeYoutube(r.enlace ?? ''));
  const eyebrow = [etiquetaDeTipo(r.tipo) as string | null, diaMes(r.creadoEn.slice(0, 10))].filter(Boolean).join(' · ');
  return (
    <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-tarjeta border border-linea bg-sup">
      <Miniatura recurso={r} alTocar={esVideo ? () => setViendo(true) : undefined} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-gris uppercase">{eyebrow}</p>
          <h3 className="mt-1 font-titulo text-2xl leading-tight font-semibold break-words">{r.titulo}</h3>
          {/* En celular la descripción va completa (cortarla escondía datos); el recorte sólo ayuda a igualar alturas en la rejilla. */}
          {r.descripcion && <p className="mt-1 text-sm break-words text-gris md:line-clamp-4">{r.descripcion}</p>}
        </div>
        {/* Un dato que el profe no cargó no se muestra: ni cajita vacía ni «0». */}
        {(r.frecuenciaSemanal != null || r.minutos != null) && (
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {r.frecuenciaSemanal != null && <Dato clave="Frecuencia" valor={`${r.frecuenciaSemanal} por semana`} />}
            {r.minutos != null && <Dato clave="Dedicación" valor={`${r.minutos} min`} />}
          </dl>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Chip className={envio.estado === 'ninguno' ? undefined : 'bg-club-cl text-club-texto'}>{textoDeEnvio(envio, categoria)}</Chip>
          {envio.ultimaFecha && <Chip>Último envío {diaMes(envio.ultimaFecha)}</Chip>}
        </div>
        <Alcance alcance={alcance} />
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {esVideo && (
            <Boton onClick={() => setViendo(true)}>
              <Play aria-hidden className="size-4" />
              Ver video<span className="sr-only">: {r.titulo}</span>
            </Boton>
          )}
          {esEnlaceWeb(r.enlace ?? '') && (
            <a
              href={r.enlace!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-btn border border-borde-control px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
            >
              <ExternalLink aria-hidden className="size-4" />
              Material<span className="sr-only">: {r.titulo}</span>
            </a>
          )}
          {esMio && (
            <Boton variante="contorno" tamano="chico" onClick={() => setBorrando(true)}>
              Borrar<span className="sr-only">: {r.titulo}</span>
            </Boton>
          )}
        </div>
        {envio.estado === 'todos' ? (
          <Boton variante="contorno" disabled>Ya lo recibieron todos</Boton>
        ) : (
          <Boton variante="contorno" onClick={() => setEnviando(true)}>
            {envio.estado === 'parcial' ? `Enviar a los ${faltan.length} que faltan` : 'Enviar a jugadores'}
            <span className="sr-only">: {r.titulo}</span>
          </Boton>
        )}
      </div>
      <HojaDeEnvio abierta={enviando} alCambiar={setEnviando} clubId={clubId} categoria={categoria} jugadores={faltan} recurso={r} yaLoTienen={jugadores.length - faltan.length} alEnviar={alAvisar} />
      {esMio && <BorrarRecurso abierta={borrando} alCerrar={() => setBorrando(false)} clubId={clubId} recurso={r} />}
      {esVideo && <Reproductor recurso={r} abierto={viendo} alCambiar={setViendo} />}
    </article>
  );
}

/** La imagen de arriba: miniatura de YouTube con su play (abre el video) o un cuadro con el tipo de link. */
function Miniatura({ recurso: r, alTocar }: { recurso: RecursoDelClub; alTocar?: () => void }) {
  const src = urlDeMiniatura(r.enlace ?? '') as string | null;
  const [rota, setRota] = useState(false);
  const clase = claseDeEnlace(r.enlace) as string | null;
  const cuerpo = (
    <>
      {src && !rota && (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setRota(true)} className="absolute inset-0 size-full object-cover" />
      )}
      {alTocar ? (
        <span aria-hidden className="relative grid size-14 place-items-center rounded-full bg-negro/80 text-sobre-negro transition-transform duration-[var(--dur-2)] [@media(hover:hover)]:group-hover:scale-110">
          <Play className="size-6 translate-x-0.5 fill-current" />
        </span>
      ) : (
        <span className="relative flex flex-col items-center gap-1 text-gris">
          <FileText aria-hidden className="size-7" />
          <span className="font-mono text-xs tracking-wide uppercase">{clase ? ETIQUETA_SIN_MINIATURA[clase] : 'Instrucciones'}</span>
        </span>
      )}
    </>
  );
  const base = 'relative grid aspect-video w-full place-items-center overflow-hidden bg-sup-2';
  if (!alTocar) return <div className={base}>{cuerpo}</div>;
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-label={`Ver video: ${r.titulo}`}
      className={cn(base, 'group outline-offset-[-3px] focus-visible:outline-3 focus-visible:outline-tinta')}
    >
      {cuerpo}
    </button>
  );
}

/** El reproductor se arma recién al abrir (una página de YouTube por tarjeta traba un celular) y ocupa el ancho que da el aparato. */
function Reproductor({ recurso: r, abierto, alCambiar }: { recurso: RecursoDelClub; abierto: boolean; alCambiar: (a: boolean) => void }) {
  const id = idDeYoutube(r.enlace ?? '') as string;
  return (
    <Hoja abierta={abierto} alCambiar={alCambiar} titulo={r.titulo} descripcion="Video del recurso." etiquetaCerrar="Cerrar el video" ancha>
      <div className="flex flex-col gap-3 p-5 pt-12">
        <h2 className="font-titulo text-2xl font-semibold">{r.titulo}</h2>
        {abierto && (
          <div className="aspect-video w-full overflow-hidden rounded-tarjeta bg-sup-2">
            <iframe
              src={urlDeReproductor(r.enlace!, { autoplay: true }) as string}
              title={`Video: ${r.titulo}`}
              allow="autoplay; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full"
            />
          </div>
        )}
        {r.descripcion && <p className="text-sm text-gris">{r.descripcion}</p>}
        {/* El link se arma con el ID ya validado, nunca con el texto guardado. */}
        <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline">
          Abrir en YouTube
        </a>
      </div>
    </Hoja>
  );
}

/** Cuántos lo abrieron: un número y una barra. Sin dato se dice por qué, en vez de una barra vacía que se leería como 0 %. */
function Alcance({ alcance }: { alcance: Alcance }) {
  if (alcance.estado === 'ok') {
    return (
      <div>
        <p className="text-sm">
          Lo vieron <span className="cifra font-mono font-semibold">{alcance.abrieron}</span> de <span className="cifra font-mono font-semibold">{alcance.conCuenta}</span> con cuenta
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div role="img" aria-label={`Lo vieron ${alcance.abrieron} de ${alcance.conCuenta}`} className="h-2 flex-1 overflow-hidden rounded-full bg-sup-2">
            <div className="h-full rounded-full bg-club" style={{ width: `${alcance.porcentaje}%` }} />
          </div>
          <span className="cifra font-mono text-xs text-gris">{alcance.porcentaje}%</span>
        </div>
      </div>
    );
  }
  return <p className="text-sm text-gris">{MOTIVO_SIN_ALCANCE[alcance.estado]}</p>;
}

function Dato({ clave, valor }: { clave: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.6875rem] tracking-wide text-gris uppercase">{clave}</dt>
      <dd className="font-semibold break-words">{valor}</dd>
    </div>
  );
}

/** Impacto del plantel: todo agregado, sin nombres. Si la base no entrega el resumen, el panel no se muestra. */
function Impacto({ recursos, resumen }: { recursos: RecursoDelClub[]; resumen: ResumenDeRecursos | null }) {
  if (!resumen) return null;
  const masAbierto = resumen.recursos
    .filter((f) => f.abrieron != null && f.abrieron > 0)
    .sort((a, b) => (b.abrieron ?? 0) - (a.abrieron ?? 0))[0];
  const titulo = masAbierto ? recursos.find((r) => r.id === masAbierto.recursoId)?.titulo : undefined;
  return (
    <section aria-label="Impacto" className="rounded-tarjeta border border-linea bg-sup p-4">
      <h2 className="font-titulo text-xl leading-none font-semibold tracking-wide uppercase">Impacto</h2>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        <Dato clave="Ofrecidos" valor={String(recursos.length)} />
        <Dato clave="Con cuenta" valor={String(resumen.conCuenta)} />
        <Dato clave="Abrieron alguno" valor={resumen.abrieronAlguno == null ? 'sin datos' : `${resumen.abrieronAlguno} de ${resumen.conCuenta}`} />
        <Dato clave="Más abierto" valor={masAbierto && titulo ? `${titulo} (${masAbierto.abrieron})` : 'sin datos'} />
      </dl>
      <p className="mt-3 text-sm text-gris">Son conteos del plantel y sólo de los jugadores con cuenta. No hay nombres: la base no los entrega.</p>
    </section>
  );
}
