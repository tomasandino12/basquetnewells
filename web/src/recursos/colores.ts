// Un color fijo por tema de ejercicio y por tipo de jugada, para reconocerlos de un vistazo en la lista.
// Salen de los colores de «gráficos y etiquetas» de la paleta (DESIGN.md): ningún valor suelto. Cada par
// de fondo y letra se mide en contraste.test.ts. El rojo del club queda para la acción principal.
const SUAVE = 'bg-sup-2 text-tinta';

const DE_TEMA: Record<string, string> = {
  pase: 'bg-ambar text-negro',
  defensa: 'bg-cuero text-sobre-club',
  // Contorno tenue: en oscuro el cereza casi se funde con la tarjeta.
  tiro: 'bg-cereza text-sobre-club ring-1 ring-inset ring-sobre-club/25',
  contraataque: 'bg-quemado text-sobre-club',
  rebote: 'bg-sol text-negro',
  fisico: 'bg-caramelo text-negro',
  juego: 'bg-tinta text-sup',
  otro: SUAVE,
};

const DE_TIPO: Record<string, string> = {
  ataque: DE_TEMA.contraataque,
  presion: DE_TEMA.tiro,
  defensa: DE_TEMA.defensa,
  lateral: DE_TEMA.pase,
  otro: SUAVE,
};

/** Clases de fondo y letra del tema; un tema que ya no está en la lista se ve como «otro». */
export const colorDeTema = (id: string | null | undefined): string => DE_TEMA[id ?? ''] ?? SUAVE;

/** Lo mismo para el tipo de una jugada. */
export const colorDeTipo = (clave: string | null | undefined): string => DE_TIPO[clave ?? ''] ?? SUAVE;
