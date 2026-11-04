import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Aviso } from '../components/ui/aviso';
import { Cargando } from '../components/ui/estados';
import { useEntrar } from '../datos/consultas';
import { useSesion } from '../datos/contexto';
import { mensajeDeError } from '../datos/errores';

export function Entrar() {
  const sesion = useSesion();
  const entrar = useEntrar();
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/';
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');

  if (sesion.estado === 'cargando') return <main className="mx-auto max-w-sm p-4"><Cargando filas={2} /></main>;
  if (sesion.estado === 'con-sesion') return <Navigate to={desde} replace />;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    entrar.mutate({ email: email.trim(), clave });
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="font-titulo text-4xl leading-none font-semibold">Entrar</h1>
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <Campo etiqueta="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo etiqueta="Clave" type="password" autoComplete="current-password" required maxLength={200} value={clave} onChange={(e) => setClave(e.target.value)} />
        {entrar.isError && (
          <Aviso tono="error" titulo="No pudimos entrar">
            {mensajeDeError(entrar.error, 'Revisá el email y la clave.')}
          </Aviso>
        )}
        <Boton type="submit" disabled={entrar.isPending}>{entrar.isPending ? 'Entrando…' : 'Entrar'}</Boton>
      </form>
    </main>
  );
}
