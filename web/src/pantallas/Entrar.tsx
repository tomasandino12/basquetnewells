import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Aviso } from '../components/ui/aviso';
import { Cargando } from '../components/ui/estados';
import { Pagina } from '../components/ui/pagina';
import { useCrearCuenta, useEntrar, useEntrarConGoogle, useRecuperarClave } from '../datos/consultas';
import { useSesion } from '../datos/contexto';
import { esSinConexion, mensajeDeError } from '../datos/errores';
import { VERSION_LEGAL } from '@datos/legal.js';
import { anotarJugadorPorGoogle } from '../cuenta/jugadorPorGoogle';
import { soltarFallaDeLaVuelta, useFallaDeLaVuelta } from '../cuenta/vuelta';
import { emailValido, mensajeDeCreacion, mensajeDeGoogle, mensajeDeIngreso, validarCuenta } from '../cuenta/validaciones';

type Modo = 'entrar' | 'crear' | 'recuperar';

export function Entrar() {
  const sesion = useSesion();
  const entrar = useEntrar();
  const crear = useCrearCuenta();
  const recuperar = useRecuperarClave();
  const google = useEntrarConGoogle();
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/';
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [esJugador, setEsJugador] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const falla = useFallaDeLaVuelta();

  if (sesion.estado === 'cargando') return <Pagina><Cargando filas={2} /></Pagina>;
  if (sesion.estado === 'con-sesion') return <Navigate to={desde} replace />;

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setProblema(null);
    soltarFallaDeLaVuelta();
    entrar.reset();
    crear.reset();
    recuperar.reset();
    google.reset();
  };

  const enviarEntrar = (e: FormEvent) => {
    e.preventDefault();
    entrar.mutate({ email: email.trim(), clave });
  };

  const enviarCrear = (e: FormEvent) => {
    e.preventDefault();
    const r = validarCuenta({ nombre, email, clave, repetida });
    if (!r.ok) return setProblema(r.problema);
    setProblema(null);
    crear.mutate({ email: r.email, clave, nombre: r.nombre, esJugador });
  };

  const enviarRecuperar = (e: FormEvent) => {
    e.preventDefault();
    if (!emailValido(email)) return setProblema('Escribí un mail válido.');
    setProblema(null);
    recuperar.mutate(email.trim());
  };

  const conGoogle = () => {
    anotarJugadorPorGoogle(modo === 'crear' && esJugador);
    google.mutate();
  };

  // Un fallo que no es de red se trata como éxito a propósito: contestar distinto según si el mail existe filtra el padrón.
  const recuperarEnviado = recuperar.isSuccess || (recuperar.isError && !esSinConexion(recuperar.error));
  const mailDeConfirmacion = crear.isSuccess && !crear.data.sesion;

  return (
    <Pagina className="flex min-h-svh flex-col justify-center">
      {/* La página ocupa todo el ancho como las demás; sólo el formulario es una columna angosta. */}
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-titulo text-4xl leading-none font-semibold">
          {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Recuperar la clave'}
        </h1>

        {falla && <Aviso tono="error" titulo="No pudimos abrir el link">{falla}</Aviso>}

        {modo === 'entrar' && (
          <form onSubmit={enviarEntrar} className="flex flex-col gap-3">
            <Campo etiqueta="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Campo etiqueta="Clave" type="password" autoComplete="current-password" required maxLength={200} value={clave} onChange={(e) => setClave(e.target.value)} />
            {entrar.isError && (
              <Aviso tono="error" titulo="No pudimos entrar">
                {esSinConexion(entrar.error) ? mensajeDeError(entrar.error, '') : mensajeDeIngreso(entrar.error)}
              </Aviso>
            )}
            <Boton type="submit" disabled={entrar.isPending}>{entrar.isPending ? 'Entrando…' : 'Entrar'}</Boton>
          </form>
        )}

        {modo === 'crear' && (
          <form onSubmit={enviarCrear} className="flex flex-col gap-3" noValidate>
            <Campo etiqueta="Nombre y apellido" autoComplete="name" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <Campo etiqueta="Email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Campo etiqueta="Clave" type="password" autoComplete="new-password" maxLength={200} ayuda="Al menos 8 caracteres." value={clave} onChange={(e) => setClave(e.target.value)} />
            <Campo etiqueta="Repetí la clave" type="password" autoComplete="new-password" maxLength={200} value={repetida} onChange={(e) => setRepetida(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={esJugador} onChange={(e) => setEsJugador(e.target.checked)} />
              Soy jugador: voy a pedir acceso a mi categoría
            </label>
            {problema && <Aviso tono="error" titulo="Revisá los datos">{problema}</Aviso>}
            {crear.isError && (
              <Aviso tono="error" titulo="No pudimos crear la cuenta">
                {esSinConexion(crear.error) ? mensajeDeError(crear.error, '') : mensajeDeCreacion(crear.error)}
              </Aviso>
            )}
            {mailDeConfirmacion && (
              <Aviso tono="ok" titulo="Revisá tu mail">
                Te mandamos un mail a {email.trim()}. Abrilo para confirmar la cuenta y después entrá
                {esJugador ? ': te va a llevar a pedir acceso a tu categoría' : ''}.
              </Aviso>
            )}
            <p className="text-xs text-gris">
              Al entrar por primera vez te pedimos leer y aceptar la{' '}
              <a className="underline" href="/privacidad" target="_blank" rel="noopener">Política de privacidad</a> y los{' '}
              <a className="underline" href="/terminos" target="_blank" rel="noopener">Términos</a> (versión del {VERSION_LEGAL.split('-').reverse().join('/')}).
            </p>
            <Boton type="submit" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear cuenta'}</Boton>
          </form>
        )}

        {modo === 'recuperar' && (
          <form onSubmit={enviarRecuperar} className="flex flex-col gap-3" noValidate>
            <Campo etiqueta="Email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            {problema && <Aviso tono="error" titulo="Revisá el mail">{problema}</Aviso>}
            {recuperar.isError && esSinConexion(recuperar.error) && (
              <Aviso tono="error" titulo="No pudimos mandarlo">{mensajeDeError(recuperar.error, '')}</Aviso>
            )}
            {recuperarEnviado && (
              <Aviso tono="ok" titulo="Listo">Si ese mail tiene una cuenta, ya le llegó el link para cambiar la clave.</Aviso>
            )}
            <Boton type="submit" disabled={recuperar.isPending}>{recuperar.isPending ? 'Mandando…' : 'Mandar el link'}</Boton>
          </form>
        )}

        {modo !== 'recuperar' && (
          <>
            <Boton variante="contorno" onClick={conGoogle} disabled={google.isPending}>
              {modo === 'crear' ? 'Crear con Google' : 'Entrar con Google'}
            </Boton>
            {google.isError && <Aviso tono="error" titulo="Google">{esSinConexion(google.error) ? mensajeDeError(google.error, '') : mensajeDeGoogle(google.error)}</Aviso>}
          </>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {modo !== 'entrar' && <button type="button" className="underline" onClick={() => cambiarModo('entrar')}>Ya tengo cuenta</button>}
          {modo !== 'crear' && <button type="button" className="underline" onClick={() => cambiarModo('crear')}>No tengo cuenta</button>}
          {modo === 'entrar' && <button type="button" className="underline" onClick={() => cambiarModo('recuperar')}>Olvidé la clave</button>}
        </div>
      </div>
    </Pagina>
  );
}
