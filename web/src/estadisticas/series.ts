/** Varias series con fechas distintas sobre un mismo eje: las fechas de todas, y null donde una no tiene dato. */
export function alinear<T>(series: { puntos: { fecha: string; valor: T }[] }[]): { fechas: string[]; valores: (T | null)[][] } {
  const fechas = [...new Set(series.flatMap((s) => s.puntos.map((p) => p.fecha)))].sort();
  return {
    fechas,
    valores: series.map((s) => {
      const porFecha = new Map(s.puntos.map((p) => [p.fecha, p.valor]));
      return fechas.map((f) => (porFecha.has(f) ? (porFecha.get(f) as T) : null));
    }),
  };
}
