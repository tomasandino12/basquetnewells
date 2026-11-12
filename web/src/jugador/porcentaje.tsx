import { Chip } from '../components/ui/chip';

/** Lo que devuelve `porcentaje()` de src/data/estadisticas.js: nunca un número pelado, siempre con sus intentos. */
export interface Porc {
  pct: number;
  anotados: number;
  intentos: number;
  muestraChica: boolean;
}

/**
 * «60 % · 6/10». Con pocos intentos lleva su aviso («pocos datos») para que nadie lo lea como señal;
 * sin dato dice «sin datos», nunca 0 %.
 */
export function Porcentaje({ valor }: { valor: Porc | null | undefined }) {
  if (valor == null) return <span className="text-gris">sin datos</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={valor.muestraChica ? 'text-gris' : undefined}>
        {valor.pct}% · {valor.anotados}/{valor.intentos}
      </span>
      {valor.muestraChica && <Chip>pocos datos</Chip>}
    </span>
  );
}

/** «1,5»: el decimal con coma, como se lee en Argentina. */
export const coma = (n: number | string): string => String(n).replace('.', ',');
