import { useEffect } from 'react';
import { ANCHO_DE_PAGINA } from '../components/ui/pagina';
import { cn } from '../lib/cn';
import { useCargaDeCategoria, usePlantelActivo } from '../plantel/activo';

/** Dónde se acuerda este teléfono de cuántas categorías vio la última vez (sólo para reservar el lugar). */
export const CLAVE_CANTIDAD = 'oficina.categorias.cantidad';

/**
 * Cuántos chips reservar mientras se averigua la categoría. Se usa lo que se vio la última vez; la
 * primera vez, dos (lo más común en el cuerpo técnico). Si resulta que hay una sola, el espacio se
 * cierra una vez y listo; lo que no se puede es empujar toda la pantalla cada vez que se abre la app.
 */
function cantidadRecordada(): number {
  try {
    const n = Number(localStorage.getItem(CLAVE_CANTIDAD));
    return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 2;
  } catch {
    return 2;
  }
}

function recordarCantidad(n: number) {
  try {
    localStorage.setItem(CLAVE_CANTIDAD, String(Math.min(4, n)));
  } catch {
    // Sin almacenamiento no se recuerda: la próxima vez se reservan dos y listo.
  }
}

/**
 * Los chips de categoría de arriba, como en la app de siempre (U17M · U21M). Con una sola
 * categoría no hay nada que elegir y no se muestra. Cambiar de categoría no cambia la dirección:
 * la pantalla que estás mirando pasa a ser la de la otra categoría.
 *
 * Mientras se averigua la categoría (club, planteles y roles son cuatro pedidos en cadena) reserva
 * el lugar de los chips con formas del mismo alto: antes la barra aparecía de golpe y bajaba todo
 * lo que ya se estaba viendo.
 */
export function BarraDeCategorias() {
  const activo = usePlantelActivo();
  const carga = useCargaDeCategoria();
  const cantidad = activo?.visibles.length;
  useEffect(() => {
    if (cantidad !== undefined) recordarCantidad(cantidad);
  }, [cantidad]);

  if (carga.isPending && !activo) return <ReservaDeCategorias />;
  if (!activo || activo.visibles.length < 2) return null;
  return (
    <nav aria-label="Categoría" className={cn(ANCHO_DE_PAGINA, 'entra flex gap-2 pt-4 lg:pt-6')}>
      {activo.visibles.map((p) => {
        const elegida = p.id === activo.plantelId;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={elegida}
            onClick={() => activo.elegir(p.id)}
            className={cn(
              'min-h-11 rounded-btn px-4 font-titulo text-lg font-bold tracking-wide uppercase outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
              elegida ? 'bg-club text-sobre-club' : 'border border-linea bg-sup text-tinta [@media(hover:hover)]:hover:border-borde-control',
            )}
          >
            {p.categoria}
          </button>
        );
      })}
    </nav>
  );
}

/** El lugar de los chips mientras llegan: mismo contenedor, mismo alto (min-h-11), sin texto. */
export function ReservaDeCategorias({ cantidad = cantidadRecordada() }: { cantidad?: number }) {
  return (
    <div aria-hidden data-reserva-categorias className={cn(ANCHO_DE_PAGINA, 'flex gap-2 pt-4 lg:pt-6')}>
      {Array.from({ length: cantidad }, (_, i) => (
        <span key={i} className="esqueleto min-h-11 w-[4.75rem] rounded-btn bg-sup-2" />
      ))}
    </div>
  );
}
