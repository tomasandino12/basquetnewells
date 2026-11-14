import { ArrowRight, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { APP_DE_SIEMPRE, enlaceDeMedir } from '../clasica';
import { Boton } from '../components/ui/button';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import { useSesion } from '../datos/contexto';
import { useJugadoresDeAsistencia, useSesionesDeMedicion } from '../datos/consultas';
import type { SesionMedicion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import {
  borrarBorrador, claveBorrador, cuantosCargados, formatearFecha, leerBorrador, masNuevasPrimero,
  NOMBRE_DE_TEST, TESTS, ultimaPorTipo, type Borrador, type TipoDeTest,
} from '../medir/sesiones';
import { usePlantelId } from '../plantel/activo';
import { ConPlantel } from './ConPlantel';

// Cada test lleva su color (el color distingue, el nombre dice cuál es): relleno del botón «Medir» y
// cifra grande de la última medición. Los valores viven en estilos.css, con su par para cada tema.
const COLOR_DE_TEST: Record<TipoDeTest, { boton: string; cifra: string }> = {
  tiro: { boton: 'bg-test-tiro text-sobre-test-tiro', cifra: 'text-test-tiro-t' },
  salto: { boton: 'bg-test-salto text-sobre-test-salto', cifra: 'text-test-salto-t' },
  sprint: { boton: 'bg-test-sprint text-sobre-test-sprint', cifra: 'text-test-sprint-t' },
  yoyo: { boton: 'bg-test-yoyo text-sobre-test-yoyo', cifra: 'text-test-yoyo-t' },
};

const ETIQUETA = 'font-mono text-xs tracking-wide text-gris uppercase';
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Medir: elegir el test, retomar una sesión sin terminar y ver lo ya cargado. Los cuatro tests con su
 * cronómetro, el video y los pitidos todavía se hacen en la app de siempre (todavía no se mudaron):
 * cada fila lleva hasta allá. En compu: a la izquierda título, sesión sin terminar y últimas sesiones;
 * a la derecha la lista de tests.
 */
export function Medir() {
  const plantelId = usePlantelId();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: '/hoy', texto: 'Hoy' }}
      soloCuerpoTecnico="La coordinación ve las mediciones en la app anterior."
    >
      {(p) => <MedirDeLaCategoria {...p} />}
    </ConPlantel>
  );
}

function MedirDeLaCategoria({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const { sesion } = useSesion();
  const usuarioId = sesion?.user.id;
  const sesiones = useSesionesDeMedicion(clubId, plantelId);
  const chicos = useJugadoresDeAsistencia(clubId, plantelId);
  // Los borradores viven en el teléfono; `version` los vuelve a leer después de descartar uno.
  const [version, setVersion] = useState(0);
  const [aDescartar, setADescartar] = useState<TipoDeTest | null>(null);

  const borradores = TESTS.flatMap((t) => {
    const b = leerBorrador(claveBorrador(usuarioId, clubId, plantelId, t.tipo));
    return b ? [{ tipo: t.tipo, borrador: b }] : [];
  });
  void version;

  const descartar = () => {
    if (!aDescartar) return;
    borrarBorrador(claveBorrador(usuarioId, clubId, plantelId, aDescartar));
    setADescartar(null);
    setVersion((v) => v + 1);
  };
  const pendiente = borradores.find((b) => b.tipo === aDescartar)?.borrador ?? null;

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-x-12">
        <div className="lg:col-start-1 lg:row-start-1">
          <header className="pt-2">
            <h1 className="font-titulo text-7xl leading-[.9] font-bold uppercase lg:text-8xl">Medir</h1>
            <p className={`${ETIQUETA} mt-2`}>{categoria}</p>
          </header>

          {borradores.length > 0 && (
            <section aria-label="Sesiones sin terminar" className="mt-5 flex flex-col gap-3">
              {borradores.map(({ tipo, borrador }) => (
                <Pendiente key={tipo} tipo={tipo} borrador={borrador} alDescartar={() => setADescartar(tipo)} />
              ))}
            </section>
          )}
        </div>

        {/* Los tests no dependen de las sesiones: con la lista cargando, vacía o caída, los botones están. */}
        <Tests lista={sesiones.data} />
        <section aria-label="Sesiones cargadas" className="mt-8 lg:col-start-1 lg:row-start-2 lg:mt-6">
          <Consulta consulta={sesiones} errorGenerico="No se pudieron cargar las sesiones">
            {(lista) => <Sesiones lista={lista} chicos={chicos.data?.length} />}
          </Consulta>
        </section>
      </div>

      <Hoja
        abierta={aDescartar !== null}
        alCambiar={(abierta) => !abierta && setADescartar(null)}
        titulo="Descartar la sesión"
        descripcion="Confirmá si querés borrar la sesión sin terminar."
        etiquetaCerrar="Cerrar"
      >
        <div className="flex flex-col gap-3 p-5 pt-12">
          <h2 className="font-titulo text-2xl leading-none font-semibold uppercase">Descartar la sesión</h2>
          <p className="text-sm text-gris">{textoDeDescartar(aDescartar, pendiente)}</p>
          <div className="flex gap-2 pt-1">
            <Boton variante="club" onClick={descartar}>Descartar</Boton>
            <Boton variante="contorno" onClick={() => setADescartar(null)}>Cancelar</Boton>
          </div>
        </div>
      </Hoja>
    </>
  );
}

function textoDeDescartar(tipo: TipoDeTest | null, borrador: Borrador | null): string {
  if (!tipo) return '';
  const nombre = NOMBRE_DE_TEST[tipo].toLowerCase();
  const cargados = cuantosCargados(borrador);
  if (!cargados) return `Se descarta la sesión de ${nombre} sin terminar. No se puede deshacer.`;
  return `Se pierde ${cargados === 1 ? 'el jugador cargado' : `los ${cargados} jugadores cargados`} en ${nombre}. No se puede deshacer.`;
}

/** La sesión sin terminar: el bloque lima (la acción principal de la pantalla cuando hay algo para retomar). */
function Pendiente({ tipo, borrador, alDescartar }: { tipo: TipoDeTest; borrador: Borrador; alDescartar: () => void }) {
  const cargados = cuantosCargados(borrador);
  const total = Math.max(Object.keys(borrador.valores ?? {}).length, cargados);
  const nombre = NOMBRE_DE_TEST[tipo];
  return (
    <div role="status" className="rounded-tarjeta bg-lima p-5 text-sobre-lima">
      <p className="font-titulo text-3xl leading-none font-bold uppercase">Seguí la {nombre.toLowerCase()}</p>
      <p className="cifra mt-3 font-titulo text-2xl leading-none font-semibold">{cargados} de {total} cargados</p>
      <p className="mt-1 text-sm">
        {nombre} del {formatearFecha(borrador.fecha)} · {cargados} {plural(cargados, 'jugador cargado', 'jugadores cargados')}
      </p>
      <a
        href={enlaceDeMedir(tipo)}
        className="group mt-4 inline-flex min-h-11 items-center gap-2 rounded-btn bg-negro px-5 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-negro uppercase outline-offset-2 focus-visible:outline-2 focus-visible:outline-sobre-lima"
      >
        Continuar<span className="sr-only"> {nombre}</span>
        <ArrowRight aria-hidden strokeWidth={2.5} className="size-5 transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] [@media(hover:hover)]:group-hover:translate-x-1" />
      </a>
      <button
        type="button"
        onClick={alDescartar}
        className="mt-1 block min-h-11 text-sm font-medium underline underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sobre-lima"
      >
        Descartar esa sesión<span className="sr-only"> de {nombre}</span>
      </button>
    </div>
  );
}

const CUANTAS_ULTIMAS = 4;

/** Los cuatro tests, siempre a la vista; `lista` es undefined mientras las sesiones cargan o si no se pudieron leer. */
function Tests({ lista }: { lista: SesionMedicion[] | undefined }) {
  const ultimas = ultimaPorTipo(lista ?? []);
  const cuantas = (tipo: TipoDeTest) => (lista ?? []).filter((s) => s.tipo === tipo).length;
  return (
    <section aria-label="Tests" className="mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-2">
        <ul className="flex flex-col gap-3">
          {TESTS.map((t) => {
            const ultima = ultimas[t.tipo];
            const n = cuantas(t.tipo);
            const color = COLOR_DE_TEST[t.tipo];
            return (
              <li key={t.tipo}>
                <a
                  href={enlaceDeMedir(t.tipo)}
                  className="group flex min-h-28 items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-4 outline-offset-2 transition-transform duration-[var(--dur-1)] active:scale-[.985] focus-visible:outline-2 focus-visible:outline-tinta sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-titulo text-3xl leading-none font-bold uppercase sm:text-4xl">{t.nombre}</span>
                    <span className="mt-1.5 block text-sm text-gris">{t.detalle}</span>
                    <span className="mt-1.5 block font-mono text-xs tracking-wide text-gris uppercase">
                      {!lista ? ' ' : ultima ? `${n} ${plural(n, 'sesión', 'sesiones')} · última ${formatearFecha(ultima.fecha)}` : 'Sin mediciones todavía'}
                    </span>
                  </span>
                  <span aria-hidden className={cn('cifra shrink-0 font-titulo text-5xl leading-none font-bold sm:text-6xl', color.cifra)}>
                    {ultima ? diaMes(ultima.fecha) : '—'}
                  </span>
                  <span aria-hidden className={cn('inline-flex min-h-11 shrink-0 items-center gap-2 rounded-btn px-4 font-titulo text-lg font-semibold tracking-[.14em] uppercase', color.boton)}>
                    Medir
                    <ArrowRight strokeWidth={2.5} className="size-5 transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] [@media(hover:hover)]:group-hover:translate-x-1" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
    </section>
  );
}

function Sesiones({ lista, chicos }: { lista: SesionMedicion[]; chicos: number | undefined }) {
  const [verTodas, setVerTodas] = useState(false);
  const ordenadas = masNuevasPrimero(lista);
  const visibles = verTodas ? ordenadas : ordenadas.slice(0, CUANTAS_ULTIMAS);
  return (
    <>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-titulo text-2xl leading-none font-bold uppercase">Últimas sesiones</h2>
          {ordenadas.length > CUANTAS_ULTIMAS && (
            <button type="button" onClick={() => setVerTodas((v) => !v)} className="min-h-11 text-sm font-medium text-club-texto underline underline-offset-4">
              {verTodas ? 'Ver menos' : 'Ver todas'}
            </button>
          )}
        </div>
        {lista.length === 0 ? (
          <Vacio icono={ClipboardList} titulo="Todavía no hay mediciones">
            La batería son 6 posiciones de 10 tiros cada una. Con una sola sesión ya podés ver desde dónde tira mejor cada chico; recién con la segunda empieza a verse si mejora.
          </Vacio>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibles.map((s) => (
              <li key={s.id} className="flex min-h-14 items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-2">
                <span className="font-semibold">{NOMBRE_DE_TEST[s.tipo] ?? s.tipo}</span>
                <span className="text-sm text-gris">{formatearFecha(s.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-linea pt-4">
          <Cifra etiqueta="Sesiones" valor={String(lista.length)} />
          <Cifra etiqueta="Chicos" valor={chicos === undefined ? '—' : String(chicos)} />
          <Cifra etiqueta="Última" valor={ordenadas[0] ? diaMes(ordenadas[0].fecha) : '—'} />
        </dl>
    </>
  );
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-1">
      <dt className={ETIQUETA}>{etiqueta}</dt>
      <dd className="cifra font-titulo text-4xl leading-none font-bold">{valor}</dd>
    </div>
  );
}
