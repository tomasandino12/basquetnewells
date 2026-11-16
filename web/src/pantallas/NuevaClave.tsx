import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Aviso } from '../components/ui/aviso';
import { Cargando } from '../components/ui/estados';
import { Pagina } from '../components/ui/pagina';
import { problemaDeClave } from '../cuenta/validaciones';
import { soltarRecuperacion } from '../cuenta/recuperacion';
import { useCambiarClave } from '../datos/consultas';
import { useSesion } from '../datos/contexto';
import { esSinConexion, mensajeDeError } from '../datos/errores';

/** Un fallo del servidor al cambiar la clave: no se muestra su texto (puede ser en inglés o técnico). */
const MENSAJE_GENERICO = 'No se pudo cambiar la clave. Pedí el link de nuevo desde «Olvidé la clave».';

/**
 * A donde llega quien volvió del mail de «olvidé la clave». El link ya le abrió una sesión:
 * hasta que elija una clave nueva no se lo deja pasar a la app.
 */
export function NuevaClave() {
  const sesion = useSesion();
  const cambiar = useCambiarClave();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [problema, setProblema] = useState<string | null>(null);

  if (sesion.estado === 'cargando') return <Pagina><Cargando filas={2} /></Pagina>;

  if (sesion.estado !== 'con-sesion') {
    return (
      <Pagina className="flex min-h-svh flex-col justify-center">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <h1 className="font-titulo text-4xl leading-none font-semibold">Nueva clave</h1>
          <Aviso tono="error" titulo="El link ya no sirve">
            Venció o ya se usó. Pedí otro desde «Olvidé la clave».
          </Aviso>
          <Link className="underline" to="/entrar">Ir a entrar</Link>
        </div>
      </Pagina>
    );
  }

  if (cambiar.isSuccess) return <Navigate to="/" replace />;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const p = problemaDeClave(clave, repetida);
    if (p) return setProblema(p);
    setProblema(null);
    cambiar.mutate(clave, { onSuccess: soltarRecuperacion });
  };

  return (
    <Pagina className="flex min-h-svh flex-col justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-titulo text-4xl leading-none font-semibold">Nueva clave</h1>
        <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
          <Campo etiqueta="Clave nueva" type="password" autoComplete="new-password" maxLength={200} ayuda="Al menos 8 caracteres." value={clave} onChange={(e) => setClave(e.target.value)} />
          <Campo etiqueta="Repetí la clave" type="password" autoComplete="new-password" maxLength={200} value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          {problema && <Aviso tono="error" titulo="Revisá los datos">{problema}</Aviso>}
          {cambiar.isError && (
            <Aviso tono="error" titulo="No pudimos cambiarla">
              {esSinConexion(cambiar.error) ? mensajeDeError(cambiar.error, '') : MENSAJE_GENERICO}
            </Aviso>
          )}
          <Boton type="submit" disabled={cambiar.isPending}>{cambiar.isPending ? 'Guardando…' : 'Guardar la clave'}</Boton>
        </form>
      </div>
    </Pagina>
  );
}
