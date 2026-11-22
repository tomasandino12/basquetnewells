import { cn } from '../lib/cn';
import { ALZA_MINIMA, sesionesEnAlza } from './logica';
import './interacciones.css';

/**
 * La «mano caliente»: un fueguito que se prende al aparecer la racha y flamea tres veces (no en loop).
 * Crece con la racha: 3 mejoras es el chico; desde 5, el grande.
 */
export function Fueguito({ racha }: { racha: number }) {
  const grande = racha >= 5;
  return (
    <svg aria-hidden viewBox="0 0 32 40" className={cn('ix-fuego shrink-0 overflow-visible', grande ? 'h-14 w-11' : 'h-11 w-9')}>
      <path className="llama" d="M16 1C18 9 27 13 27 25A11 11 0 0 1 5 25C5 18 9 14.5 10.5 8.5C12.5 12.5 13.5 14.5 15 15.5C15 10.5 14.5 5.5 16 1Z" fill="var(--fuego-afuera)" />
      <path className="nucleo" d="M16 17C18.5 21 21.5 23.5 21.5 28.5A5.5 5.5 0 0 1 10.5 28.5C10.5 25.5 12.5 23.5 13.8 20.8C14.8 22.6 15.6 22.8 16 17Z" fill="var(--fuego-centro)" />
    </svg>
  );
}

/**
 * Los porcentajes de práctica que cuentan para la racha: uno con pocos intentos no se lee como señal
 * (igual que en el resto de la app), así que corta la racha en vez de inventar una mejora.
 */
export function rachaDeTiro(serie: { valor: { pct: number; muestraChica: boolean } }[]): number {
  return sesionesEnAlza(serie.map((p) => (p.valor.muestraChica ? null : p.valor.pct)));
}

/** El reconocimiento: aparece sólo con ALZA_MINIMA mejoras seguidas; si no, no hay nada (ni un «casi»). */
export function ManoCaliente({ racha, que }: { racha: number; que: string }) {
  if (racha < ALZA_MINIMA) return null;
  return (
    <div className="ix-reconoce flex items-center gap-3 rounded-tarjeta bg-negro px-4 py-3 text-sobre-negro">
      <Fueguito racha={racha} />
      <p className="min-w-0">
        <span className="block font-titulo text-sm font-semibold tracking-[.16em] text-lima uppercase">Mano caliente</span>
        <span className="block font-titulo text-2xl leading-none font-bold uppercase">{racha} prácticas en alza</span>
        <span className="block text-sm text-sobre-negro/70">Tu {que} mejoró {racha} prácticas seguidas.</span>
      </p>
    </div>
  );
}
