import { MotionConfig } from 'motion/react';
import { Moon, Search, Sun } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Card } from '../components/ui/card';
import { ChipBoton } from '../components/ui/chip';
import { Hoja } from '../components/ui/sheet';
import { plantelDemo } from '../mocks/plantelDemo';
import type { Jugador, Posicion } from '../plantel/tipos';
import { POSICIONES, filtrarPlantel, nombreCompleto } from '../plantel/vista';
import { FichaJugador } from './FichaJugador';
import { TarjetaJugador } from './TarjetaJugador';

// Desde 64rem (el corte de escritorio de layout.css) la ficha va en un panel fijo.
const ESCRITORIO = '(min-width: 64rem)';

function useEscritorio(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const m = window.matchMedia?.(ESCRITORIO);
      m?.addEventListener('change', aviso);
      return () => m?.removeEventListener('change', aviso);
    },
    () => window.matchMedia?.(ESCRITORIO).matches ?? false,
    () => false,
  );
}

interface Props {
  jugadores?: Jugador[];
}

export function Plantel({ jugadores = plantelDemo }: Props) {
  const escritorio = useEscritorio();
  const [texto, setTexto] = useState('');
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [oscuro, setOscuro] = useState(false);

  // El tema va en <html> y no en un contenedor: la hoja del celular se dibuja
  // fuera de la pantalla (en <body>) y tiene que heredar los mismos colores.
  useEffect(() => {
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
  }, [oscuro]);

  const visibles = useMemo(() => filtrarPlantel(jugadores, texto, posicion), [jugadores, texto, posicion]);
  // En compu siempre hay alguien en el panel (el elegido o el primero de la lista);
  // en celular la hoja sólo se abre si se tocó una tarjeta.
  const enFicha = visibles.find((j) => j.id === elegido) ?? (escritorio ? visibles[0] : undefined);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-svh bg-fondo text-tinta">
        <main className="mx-auto w-full max-w-[24.375rem] px-4 py-5 sm:max-w-none sm:px-6 lg:px-8">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div>
              <p className="text-sm text-gris">Sub 13 · Datos de ejemplo</p>
              <h1 className="font-titulo text-4xl leading-none font-semibold">Plantel</h1>
            </div>
            <button
              type="button"
              onClick={() => setOscuro((o) => !o)}
              aria-label={oscuro ? 'Pasar al tema claro' : 'Pasar al tema oscuro'}
              className="grid size-11 place-items-center rounded-full border border-borde-control text-tinta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
            >
              {oscuro ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
            </button>
          </header>

          <div className="mb-4 flex flex-col gap-1">
            <label className="relative block">
              <span className="sr-only">Buscar jugador por nombre o número</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gris" />
              <input
                type="search"
                value={texto}
                maxLength={40}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por nombre o número"
                className="h-11 w-full rounded-[0.5625rem] border border-borde-control bg-sup pr-3 pl-9 text-base outline-offset-2 placeholder:text-gris focus-visible:outline-2 focus-visible:outline-tinta sm:max-w-sm"
              />
            </label>
            <div role="group" aria-label="Filtrar por posición" className="-mx-1 flex flex-wrap">
              <ChipBoton activo={posicion === null} onClick={() => setPosicion(null)}>Todos</ChipBoton>
              {POSICIONES.map((p) => (
                <ChipBoton key={p} activo={posicion === p} onClick={() => setPosicion(posicion === p ? null : p)}>
                  {p}
                </ChipBoton>
              ))}
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
            {visibles.length === 0 ? (
              <p className="py-10 text-center text-gris">Ningún jugador coincide con la búsqueda.</p>
            ) : (
              <ul
                aria-label="Jugadores del plantel"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]"
              >
                {visibles.map((j) => (
                  <li key={j.id} className="min-w-0">
                    <TarjetaJugador
                      jugador={j}
                      activa={enFicha?.id === j.id}
                      escritorio={escritorio}
                      alElegir={setElegido}
                    />
                  </li>
                ))}
              </ul>
            )}

            {escritorio && enFicha && (
              <Card className="sticky top-4 max-h-[calc(100svh-2rem)] overflow-y-auto">
                <FichaJugador key={enFicha.id} jugador={enFicha} />
              </Card>
            )}
          </div>
        </main>

        {!escritorio && (
          <Hoja
            abierta={enFicha !== undefined}
            alCambiar={(abierta) => !abierta && setElegido(null)}
            titulo={enFicha ? `Ficha de ${nombreCompleto(enFicha)}` : 'Ficha'}
            descripcion="Promedios, tiro, últimos partidos y físico del jugador."
          >
            {enFicha && <FichaJugador key={enFicha.id} jugador={enFicha} />}
          </Hoja>
        )}
      </div>
    </MotionConfig>
  );
}
