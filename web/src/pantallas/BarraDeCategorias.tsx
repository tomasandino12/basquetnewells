import { ANCHO_DE_PAGINA } from '../components/ui/pagina';
import { cn } from '../lib/cn';
import { usePlantelActivo } from '../plantel/activo';

/**
 * Los chips de categoría de arriba, como en la app de siempre (U17M · U21M). Con una sola
 * categoría no hay nada que elegir y no se muestra. Cambiar de categoría no cambia la dirección:
 * la pantalla que estás mirando pasa a ser la de la otra categoría.
 */
export function BarraDeCategorias() {
  const activo = usePlantelActivo();
  if (!activo || activo.visibles.length < 2) return null;
  return (
    <nav aria-label="Categoría" className={cn(ANCHO_DE_PAGINA, 'flex gap-2 pt-4 lg:pt-6')}>
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
