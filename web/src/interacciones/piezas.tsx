import { useReducedMotion } from 'motion/react';
import { createContext, useContext, useId } from 'react';

/**
 * Cámara lenta del laboratorio: multiplica cada duración (en CSS vía `--ix-lento`, en JS con
 * `useDuracion`). Sirve para mirar la física cuadro a cuadro; en producción no existe.
 */
export const ContextoLento = createContext(1);

/** Una duración de JS al ritmo del laboratorio. Con movimiento reducido, casi cero: el estado cambia y listo. */
export function useDuracion() {
  const lento = useContext(ContextoLento);
  const reducido = useReducedMotion();
  return (ms: number) => (reducido ? 1 : ms * lento);
}

export type EstiloDePelota = 'clasica' | 'gajos' | 'trazo';

export const ESTILOS_DE_PELOTA: { id: EstiloDePelota; nombre: string; detalle: string }[] = [
  { id: 'clasica', nombre: 'Clásica adaptada', detalle: 'Terracota: quemado con caramelo' },
  { id: 'gajos', nombre: 'Rojinegra con gajos', detalle: 'Franja roja, costados negros' },
  { id: 'trazo', nombre: 'Rojinegra de trazo', detalle: 'Carmesí, carbón y un toque lima' },
];

// Las costuras de una pelota de básquet en un lienzo de 48: la vertical, la horizontal y las dos curvas.
const COSTURAS = 'M24 2V46M2 24H46M9 8C17 16 17 32 9 40M39 8C31 16 31 32 39 40';
// La franja del medio, entre las dos curvas (para la rojinegra con gajos).
const FRANJA = 'M9 8C17 16 17 32 9 40A22 22 0 0 0 39 40C31 32 31 16 39 8A22 22 0 0 0 9 8Z';

/** La pelota en sus tres estilos. Es decorado: siempre `aria-hidden`, el estado lo dice el texto. */
export function Pelota({ estilo, x = 0, y = 0, tamano = 48 }: { estilo: EstiloDePelota; x?: number; y?: number; tamano?: number }) {
  // Las costuras se recortan al círculo: con la punta redondeada del trazo asomaban por el borde.
  const recorte = `pelota-${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden x={x} y={y} width={tamano} height={tamano} viewBox="0 0 48 48" className="overflow-visible">
      <clipPath id={recorte}>
        <circle cx="24" cy="24" r={estilo === 'trazo' ? 20.5 : 22} />
      </clipPath>
      {estilo === 'clasica' && (
        <>
          <circle cx="24" cy="24" r="22" fill="var(--pelota-clasica)" />
          {/* Una sombra de volumen, apenas: sin brillo plástico. */}
          <path d="M24 46A22 22 0 0 0 46 24A22 22 0 0 1 10 40Z" fill="var(--negro)" opacity=".12" />
          <path d={COSTURAS} clipPath={`url(#${recorte})`} fill="none" stroke="var(--pelota-costura)" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {estilo === 'gajos' && (
        <>
          <circle cx="24" cy="24" r="22" fill="var(--negro)" />
          <path d={FRANJA} fill="var(--club)" />
          <path d={COSTURAS} clipPath={`url(#${recorte})`} fill="none" stroke="var(--sobre-negro)" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--negro)" strokeWidth="1" />
        </>
      )}
      {estilo === 'trazo' && (
        <>
          <circle cx="24" cy="24" r="21.5" fill="none" stroke="var(--club)" strokeWidth="2.5" />
          <path d={COSTURAS} clipPath={`url(#${recorte})`} fill="none" stroke="var(--tinta)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11 14A16 16 0 0 1 18 8.5" fill="none" stroke="var(--lima)" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/**
 * La red de un aro como rombos: columnas que se cierran hacia abajo, unidas en diagonal.
 * `cx` y `arriba` son el centro del aro; los anchos, la boca y el fondo de la red.
 */
export function caminoDeRed(cx: number, arriba: number, anchoArriba: number, anchoAbajo: number, alto: number, columnas = 4, filas = 3) {
  const punto = (c: number, f: number) => {
    const t = f / filas;
    const ancho = anchoArriba + (anchoAbajo - anchoArriba) * t;
    return [cx - ancho / 2 + (ancho * c) / columnas, arriba + alto * t] as const;
  };
  const tramos: string[] = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const [ax, ay] = punto(c, f);
      const [bx, by] = punto(c + 1, f + 1);
      const [cx2, cy2] = punto(c + 1, f);
      const [dx, dy] = punto(c, f + 1);
      tramos.push(`M${ax} ${ay}L${bx} ${by}M${cx2} ${cy2}L${dx} ${dy}`);
    }
  }
  return tramos.join('');
}

/** Elegir una opción de un grupo: los chips del proyecto, con `aria-pressed`. */
export function Opciones<T extends string>({
  etiqueta, opciones, valor, alCambiar,
}: { etiqueta: string; opciones: { id: T; nombre: string }[]; valor: T; alCambiar: (v: T) => void }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === valor}
          onClick={() => alCambiar(o.id)}
          className="inline-flex min-h-11 items-center px-0.5 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
        >
          <span
            className={
              o.id === valor
                ? 'inline-flex min-h-8 items-center rounded-chip bg-tinta px-3 text-sm font-medium text-sup'
                : 'inline-flex min-h-8 items-center rounded-chip bg-sup-2 px-3 text-sm font-medium text-tinta'
            }
          >
            {o.nombre}
          </span>
        </button>
      ))}
    </div>
  );
}
