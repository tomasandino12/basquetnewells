interface Fila {
  etiqueta: string;
  valor: number;
}

/**
 * Barras horizontales: cada una mide contra la mayor, así se lee quién concentra y quién no.
 * La cifra va escrita al lado de cada barra: nada se dice sólo con el largo.
 */
export function Barras({ filas, formato, etiquetaDeLista }: { filas: Fila[]; formato: (valor: number) => string; etiquetaDeLista: string }) {
  const mayor = Math.max(...filas.map((f) => f.valor), 0);
  return (
    <ul aria-label={etiquetaDeLista} className="flex flex-col gap-1.5">
      {filas.map((f, i) => (
        <li key={`${f.etiqueta}-${i}`} className="grid grid-cols-[minmax(0,9rem)_1fr_3.25rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_3.5rem]">
          <span className="truncate">{f.etiqueta}</span>
          <span aria-hidden className="h-3 rounded-full bg-sup-2">
            <span className="block h-full rounded-full bg-club" style={{ width: `${mayor === 0 ? 0 : Math.max((f.valor / mayor) * 100, 2)}%` }} />
          </span>
          <span className="cifra text-right font-mono">{formato(f.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
