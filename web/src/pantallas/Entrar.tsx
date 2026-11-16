import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Aviso } from '../components/ui/aviso';
import { Cargando } from '../components/ui/estados';
import { Pagina } from '../components/ui/pagina';
import { Portada } from './Portada';
import { useCrearCuenta, useEntrar, useEntrarConGoogle, useRecuperarClave } from '../datos/consultas';
import { useSesion } from '../datos/contexto';
import { esSinConexion, mensajeDeError } from '../datos/errores';
import { VERSION_LEGAL } from '@datos/legal.js';
import { anotarJugadorPorGoogle } from '../cuenta/jugadorPorGoogle';
import { soltarFallaDeLaVuelta, useFallaDeLaVuelta } from '../cuenta/vuelta';
import { emailValido, mensajeDeCreacion, mensajeDeGoogle, mensajeDeIngreso, validarCuenta } from '../cuenta/validaciones';

type Modo = 'portada' | 'entrar' | 'crear' | 'recuperar';

export function Entrar() {
  const sesion = useSesion();
  const entrar = useEntrar();
  const crear = useCrearCuenta();
  const recuperar = useRecuperarClave();
  const google = useEntrarConGoogle();
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/';
  const falla = useFallaDeLaVuelta();
  // Quien llega sin cuenta ve primero la portada; quien vuelve de un link vencido, directo el formulario (ahí se le explica).
  const [modo, setModo] = useState<Modo>(falla ? 'entrar' : 'portada');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [esJugador, setEsJugador] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  // Sobre el mismo negro de la portada: así no hay un destello claro antes de que aparezca.
  if (sesion.estado === 'cargando') return <div className="min-h-svh bg-negro"><Pagina><Cargando titulo filas={3} className="pt-10 opacity-30" /></Pagina></div>;
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

  if (modo === 'portada') {
    // Un resplandor rojo apagado arriba (el rojo de la camiseta) sobre el negro del club.
    return (
      <div className="min-h-svh bg-negro bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgb(168_5_25/0.45),transparent)] text-sobre-negro">
        <Pagina><Portada alCrear={() => cambiarModo('crear')} alEntrar={() => cambiarModo('entrar')} /></Pagina>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-negro text-sobre-negro">
    <Pagina className="flex min-h-svh flex-col justify-center">
      {/* La página ocupa todo el ancho como las demás; sólo el formulario es una columna angosta, sobre una caja clara. */}
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-tarjeta bg-sup p-5 text-tinta">
        <button type="button" className="self-start text-sm underline" onClick={() => cambiarModo('portada')}>‹ Volver</button>
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
    </div>
  );
}
