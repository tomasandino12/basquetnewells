import { useState } from 'react';
import { POSICIONES_BATERIA, INTENTOS_POR_POSICION } from '@datos/posiciones.js';
import { prepararPayloadBateria } from '@datos/prepararPayloadMedicion.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import type { JugadorDelPlantel, PayloadDeMedicion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { Encabezado, PantallaDeTest, PieDeGuardado, type Categoria } from '../medir/MarcoDeTest';
import { useTest } from '../medir/useTest';

/** { ausente: true } o el número de anotados por posición (0 a 10). Un 0 es un dato: 0 de 10. */
type ValorTiro = { ausente?: boolean } & Record<string, number | boolean | undefined>;

const POSICIONES = POSICIONES_BATERIA as { id: string; nombre: string }[];

export function estadoDeJugador(v: ValorTiro | undefined): 'ausente' | 'completo' | 'parcial' | 'vacio' {
  if (v?.ausente) return 'ausente';
  const cargadas = POSICIONES.filter((p) => v?.[p.id] != null).length;
  if (cargadas === POSICIONES.length) return 'completo';
  return cargadas > 0 ? 'parcial' : 'vacio';
}

/** Como en el plantel de la app de siempre: inicial del apellido y del nombre. */
const iniciales = (nombre: string) => {
  const [apellido = '', resto = ''] = nombre.split(',').map((x) => x.trim());
  return `${apellido.charAt(0)}${resto.charAt(0)}`.toUpperCase() || '?';
};

/** Batería de tiro: un chico por vez, 6 posiciones de 10 tiros. Se guarda en el celular en cada toque. */
export function MedirBateria() {
  return <PantallaDeTest>{(c) => <Bateria {...c} />}</PantallaDeTest>;
}

function Bateria({ clubId, plantelId, categoria, jugadores }: Categoria & { jugadores: JugadorDelPlantel[] }) {
  const t = useTest<ValorTiro, Record<string, never>>({
    clubId, plantelId, tipo: 'tiro',
    extraInicial: () => ({}),
    payload: (e) => prepararPayloadBateria({ clubId, plantelId, fecha: e.fecha, valores: e.valores, sesionId: e.sesionId }) as PayloadDeMedicion,
    vacio: 'Todavía no cargaste ninguna medición.',
  });
  const [indice, setIndice] = useState(0);
  const jugador = jugadores[indice];
  const v = t.estado.valores[jugador.id];
  const ausente = !!v?.ausente;
  const ultimo = indice === jugadores.length - 1;

  const tocarNumero = (pos: string, n: number) => {
    const actual = { ...(v ?? {}) };
    delete actual.ausente;
    // Volver a tocar el mismo número lo borra: deshacer un error sin elegir otro número que sería mentira.
    if (actual[pos] === n) delete actual[pos];
    else actual[pos] = n;
    t.ponerValor(jugador.id, actual);
  };

  const alternarAusente = () => {
    if (ausente) {
      // Desmarcar nunca avanza: el profe tiene que ver su corrección.
      t.ponerValor(jugador.id, undefined);
      return;
    }
    t.ponerValor(jugador.id, { ausente: true });
    // Avanza sólo si hay otro: en el último no decide cerrar la sesión por el profe.
    if (!ultimo) setIndice(indice + 1);
  };

  return (
    <>
      <Encabezado tipo="tiro" categoria={categoria} fecha={t.estado.fecha} />

      <section aria-label="Jugadores" className="mt-5">
        <p className="mb-2 font-mono text-xs tracking-wide text-gris uppercase">Saltar a otro jugador</p>
        <ol className="-mx-1 flex gap-1.5 overflow-x-auto p-1 pb-2">
          {jugadores.map((j, i) => {
            const e = estadoDeJugador(t.estado.valores[j.id]);
            return (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => setIndice(i)}
                  aria-current={i === indice ? 'step' : undefined}
                  aria-label={`${j.nombreLimpio}: ${{ ausente: 'ausente', completo: 'completo', parcial: 'a medias', vacio: 'sin cargar' }[e]}`}
                  title={j.nombreLimpio}
                  className={cn(
                    'grid size-11 place-items-center rounded-full border font-titulo text-base font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                    e === 'completo' && 'border-transparent bg-test-tiro text-sobre-test-tiro',
                    e === 'parcial' && 'border-test-tiro-t border-dashed',
                    e === 'ausente' && 'border-linea text-gris line-through',
                    e === 'vacio' && 'border-linea',
                    i === indice && 'ring-2 ring-tinta ring-offset-2 ring-offset-fondo',
                  )}
                >
                  {iniciales(j.nombreLimpio)}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Jugador actual" className="mt-4">
        <h2 className="font-titulo text-4xl leading-none font-bold uppercase">{jugador.nombreLimpio}</h2>
        <p className="mt-1 font-mono text-xs tracking-wide text-gris uppercase">{indice + 1} de {jugadores.length}</p>

        {ausente ? (
          <Aviso className="mt-4" titulo="Marcado como ausente.">
            Se guarda como «no midió», no como 0 de 10. Se lo puede medir otro día en una sesión nueva.
          </Aviso>
        ) : (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {POSICIONES.map((p) => (
              <li key={p.id}>
                <p className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
                  {p.nombre}
                  <span className="font-normal text-gris">de {INTENTOS_POR_POSICION}</span>
                </p>
                <div role="group" aria-label={`${p.nombre}: anotados`} className="grid grid-cols-11 gap-1">
                  {Array.from({ length: INTENTOS_POR_POSICION + 1 }, (_, n) => {
                    const on = v?.[p.id] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        onClick={() => tocarNumero(p.id, n)}
                        className={cn(
                          'cifra h-11 rounded-btn border font-titulo text-lg font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                          on ? 'border-transparent bg-test-tiro text-sobre-test-tiro' : 'border-linea bg-sup',
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex gap-2">
          <Boton variante="contorno" onClick={alternarAusente}>{ausente ? 'Estuvo presente' : 'Marcar ausente'}</Boton>
          <Boton variante="secundario" flecha={!ultimo} onClick={() => (ultimo ? t.guardar() : setIndice(indice + 1))} disabled={ultimo && t.guardando}>
            {ultimo ? 'Terminar' : 'Siguiente'}
          </Boton>
        </div>
      </section>

      <PieDeGuardado texto="Cerrar y guardar la sesión" variante="contorno" guardando={t.guardando} aviso={t.aviso} alGuardar={t.guardar} />
    </>
  );
}

