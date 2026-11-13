import { PlaySquare, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { TIPOS_JUGADA, etiquetaDeTipo, nosotrosDefiende } from '@datos/jugadas.js';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { TOPE_DE_PAGINA } from '../../components/ui/pagina';
import { Pizarra, PizarraMini } from '../../components/ui/pizarra';
import { useMisJugadas } from '../../datos/consultasJugador';
import type { JugadaDelJugador } from '../../datos/repositorio';

/**
 * Jugadas asignadas al plantel del jugador, agrupadas por tipo, sin autor (la base ni siquiera lo devuelve).
 * Tocar una la abre a pantalla completa, pensada para el celular. Sólo se ven: editar es del profe.
 */
export function JugadorJugadas() {
  const jugadas = useMisJugadas();
  const [abierta, setAbierta] = useState<JugadaDelJugador | null>(null);
  return (
    <>
      <header>
        <h1 className="font-titulo text-4xl leading-none font-semibold">Tus jugadas</h1>
      </header>
      <div className="mt-5">
        <Consulta consulta={jugadas} errorGenerico="No se pudieron cargar tus jugadas">
          {(lista) => {
            if (lista.length === 0) {
              return (
                <Vacio icono={PlaySquare} titulo="Tu profe todavía no te asignó jugadas">
                  Cuando te asigne una, va a aparecer acá agrupada por tipo.
                </Vacio>
              );
            }
            const grupos = (TIPOS_JUGADA as { clave: string }[])
              .map((t) => ({ clave: t.clave, jugadas: lista.filter((j) => j.tipo === t.clave) }))
              .filter((g) => g.jugadas.length > 0);
            return (
              <div className="flex flex-col gap-6">
                {grupos.map((g) => (
                  <section key={g.clave} aria-label={etiquetaDeTipo(g.clave) as string}>
                    <h2 className="mb-2 font-titulo text-2xl leading-none font-semibold">{etiquetaDeTipo(g.clave) as string}</h2>
                    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                      {g.jugadas.map((j) => (
                        <li key={j.id}>
                          <button
                            type="button"
                            onClick={() => setAbierta(j)}
                            className="flex w-full flex-col gap-2 rounded-tarjeta border border-linea bg-sup p-2 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                          >
                            <PizarraMini datos={j.datos} nosotrosDefiende={nosotrosDefiende(j.tipo) as boolean} className="rounded-[0.375rem]" />
                            <span className="px-1 pb-1 font-semibold break-words">{j.nombre}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            );
          }}
        </Consulta>
      </div>

      <Dialog.Root open={abierta !== null} onOpenChange={(a) => !a && setAbierta(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="hoja-velo fixed inset-0 z-40 bg-[var(--velo)]" />
          <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-fondo text-tinta outline-none">
            <Dialog.Title className="sr-only">{abierta?.nombre ?? 'Jugada'}</Dialog.Title>
            <Dialog.Description className="sr-only">La jugada a pantalla completa, con sus pasos.</Dialog.Description>
            <div className={`mx-auto flex w-full ${TOPE_DE_PAGINA} items-center justify-between gap-3 px-4 pt-3`}>
              <p className="font-titulo text-2xl leading-none font-semibold break-words">{abierta?.nombre}</p>
              <Dialog.Close
                aria-label="Cerrar la jugada"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-borde-control outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
              >
                <X aria-hidden className="size-5" />
              </Dialog.Close>
            </div>
            {abierta && (
              <div className={`mx-auto w-full ${TOPE_DE_PAGINA} px-4 py-4`}>
                <Pizarra datos={abierta.datos} nosotrosDefiende={nosotrosDefiende(abierta.tipo) as boolean} etiqueta={`Jugada: ${abierta.nombre}`} />
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
