import { Pagina } from '../components/ui/pagina';

// Pantalla de ejemplo: sólo prueba que React, Tailwind y TypeScript andan.
// No lee datos ni habla con Supabase; los datos entrarán por repositorio.js.
export function titularEjemplo(club: string): string {
  return `Hola, ${club}`;
}

export function Ejemplo() {
  return (
    <Pagina>
      <h1 className="text-xl font-semibold">{titularEjemplo('Newell’s')}</h1>
      <p>Pantalla de prueba de la mudanza a React.</p>
    </Pagina>
  );
}
