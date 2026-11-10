import { ArrowRight, ClipboardList, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { APP_DE_SIEMPRE } from '../clasica';
import { Boton, claseBoton } from '../components/ui/button';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import { useSesion } from '../datos/contexto';
import { useSesionesDeMedicion } from '../datos/consultas';
import type { SesionMedicion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import {
  borrarBorrador, claveBorrador, cuantosCargados, formatearFecha, leerBorrador, masNuevasPrimero,
  NOMBRE_DE_TEST, TESTS, ultimaPorTipo, type Borrador, type TipoDeTest,
} from '../medir/sesiones';
import { usePlantelId } from '../plantel/activo';
import { ConPlantel } from './ConPlantel';

// Cada test tiene su franja de color (el color distingue, el nombre y el texto dicen cuál es). El botón
// es negro en todas: la franja es la que lleva el color y no compite con la lima de otras pantallas.
const COLOR_DE_TEST: Record<TipoDeTest, string> = {
  tiro: 'bg-quemado text-white',
  salto: 'bg-club-osc text-white',
  sprint: 'bg-ambar text-sobre-lima',
  yoyo: 'bg-cuero text-white',
};

const ETIQUETA = 'font-mono text-xs tracking-wide text-gris uppercase';
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/**
 * Medir: elegir el test, retomar una sesión sin terminar y ver lo ya cargado. Los cuatro tests con su
 * cronómetro, el video y los pitidos todavía se hacen en la app de siempre (todavía no se mudaron):
 * cada franja lleva hasta allá.
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
      <header className="pt-2">
        <p className={ETIQUETA}>Medir · {categoria}</p>
        <h1 className="font-titulo text-4xl leading-none font-semibold uppercase">¿Qué vas a medir?</h1>
      </header>

      {borradores.length > 0 && (
        <section aria-label="Sesiones sin terminar" className="mt-4 flex flex-col gap-2">
          {borradores.map(({ tipo, borrador }) => (
            <Pendiente key={tipo} tipo={tipo} borrador={borrador} alDescartar={() => setADescartar(tipo)} />
          ))}
        </section>
      )}

      <Consulta consulta={sesiones} errorGenerico="No se pudieron cargar las sesiones">
        {(lista) => <Contenido lista={lista} />}
      </Consulta>

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

function Pendiente({ tipo, borrador, alDescartar }: { tipo: TipoDeTest; borrador: Borrador; alDescartar: () => void }) {
  const cargados = cuantosCargados(borrador);
  return (
    <div role="status" className="flex gap-3 rounded-tarjeta border border-linea border-l-[5px] border-l-ambar bg-sup p-4">
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-baja" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Sesión sin terminar</p>
        <p className="text-sm text-gris">
          {NOMBRE_DE_TEST[tipo]} del {formatearFecha(borrador.fecha)} · {cargados} {plural(cargados, 'jugador cargado', 'jugadores cargados')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={APP_DE_SIEMPRE} className={claseBoton({ variante: 'principal', tamano: 'chico' })}>
            Continuar<span className="sr-only"> {NOMBRE_DE_TEST[tipo]}</span>
          </a>
          <Boton variante="contorno" tamano="chico" onClick={alDescartar}>
            Descartar<span className="sr-only"> {NOMBRE_DE_TEST[tipo]}</span>
          </Boton>
        </div>
      </div>
    </div>
  );
}

function Contenido({ lista }: { lista: SesionMedicion[] }) {
  const ultimas = ultimaPorTipo(lista);
  const cuantas = (tipo: TipoDeTest) => lista.filter((s) => s.tipo === tipo).length;
  return (
    <>
      <section aria-label="Tests" className="mt-4">
        <ul className="flex flex-col gap-2.5">
          {TESTS.map((t) => {
            const ultima = ultimas[t.tipo];
            const n = cuantas(t.tipo);
            return (
              <li key={t.tipo}>
                <a
                  href={APP_DE_SIEMPRE}
                  className={cn(
                    'group flex min-h-24 items-center justify-between gap-3 rounded-tarjeta px-4 py-3 outline-offset-2 transition-transform duration-[var(--dur-1)] active:scale-[.985] focus-visible:outline-2 focus-visible:outline-tinta',
                    COLOR_DE_TEST[t.tipo],
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-titulo text-3xl leading-none font-semibold uppercase">{t.nombre}</span>
                    <span className="mt-1 block text-sm opacity-90">{t.detalle}</span>
                    <span className="mt-1 block font-mono text-xs tracking-wide uppercase opacity-90">
                      {ultima ? `${n} ${plural(n, 'sesión', 'sesiones')} · última ${formatearFecha(ultima.fecha)}` : 'Sin mediciones todavía'}
                    </span>
                  </span>
                  <span aria-hidden className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-btn bg-negro px-4 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-negro uppercase">
                    Medir
                    <ArrowRight strokeWidth={2.5} className="size-5 transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] [@media(hover:hover)]:group-hover:translate-x-1" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Sesiones cargadas" className="mt-6">
        <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">Sesiones cargadas</h2>
        {lista.length === 0 ? (
          <Vacio icono={ClipboardList} titulo="Todavía no hay mediciones">
            La batería son 6 posiciones de 10 tiros cada una. Con una sola sesión ya podés ver desde dónde tira mejor cada chico; recién con la segunda empieza a verse si mejora.
          </Vacio>
        ) : (
          <ul className="flex flex-col gap-2">
            {masNuevasPrimero(lista).map((s) => (
              <li key={s.id} className="flex min-h-14 items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-2">
                <span className="font-semibold">{NOMBRE_DE_TEST[s.tipo] ?? s.tipo}</span>
                <span className="text-sm text-gris">{formatearFecha(s.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
