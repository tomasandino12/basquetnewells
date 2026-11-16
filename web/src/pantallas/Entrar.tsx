import { Lock, Mail, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import escudo from '../../../public/escudo.png';
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

// El negro del club con un resplandor rojo apagado arriba: lo mismo en la portada y en los formularios,
// para que tocar «Crear cuenta» o «Ya tengo cuenta» no cambie de mundo.
const FONDO_DEL_CLUB = 'min-h-svh bg-negro bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgb(168_5_25/0.45),transparent)] text-sobre-negro';

const BAJADA: Record<Exclude<Modo, 'portada'>, string> = {
  entrar: 'Con el mail y la clave de tu cuenta.',
  crear: 'Un minuto y listo: después elegís cómo usarla.',
  recuperar: 'Te mandamos un link para elegir una clave nueva.',
};

/** El logo de Google en sus colores: lo pide su guía de marca para el botón de entrar con Google. */
function LogoDeGoogle() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

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
  if (sesion.estado === 'cargando') return <div className={FONDO_DEL_CLUB}><Pagina><Cargando titulo filas={3} className="pt-10 opacity-30" /></Pagina></div>;
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
    return (
      <div className={FONDO_DEL_CLUB}>
        <Pagina className="py-0 lg:py-0"><Portada alCrear={() => cambiarModo('crear')} alEntrar={() => cambiarModo('entrar')} /></Pagina>
      </div>
    );
  }

  return (
    // data-tema="oscuro": los campos, avisos y textos toman los colores del tema oscuro aunque la app esté en claro.
    <div data-tema="oscuro" className={FONDO_DEL_CLUB}>
    <Pagina className="flex min-h-svh flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-3">
        <img src={escudo} alt="" width={48} height={48} className="size-12 object-contain" />
        <div className="leading-none">
          <p className="font-titulo text-2xl font-bold uppercase">Inferiores</p>
          <p className="mt-1 font-mono text-xs tracking-widest uppercase opacity-70">Newell&apos;s Old Boys</p>
        </div>
      </div>
      {/* La página ocupa todo el ancho como las demás; sólo el formulario es una columna angosta, sin caja: sobre el negro. */}
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="text-center">
          <h1 className="font-titulo text-4xl leading-none font-semibold uppercase">
            {modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Recuperar la clave'}
          </h1>
          <p className="mt-2 text-sm opacity-80">{BAJADA[modo]}</p>
        </div>

        {falla && <Aviso tono="error" titulo="No pudimos abrir el link">{falla}</Aviso>}

        {modo === 'entrar' && (
          <form onSubmit={enviarEntrar} className="flex flex-col gap-3">
            <Campo etiqueta="Email" icono={<Mail className="size-4" />} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Campo etiqueta="Clave" icono={<Lock className="size-4" />} type="password" autoComplete="current-password" required maxLength={200} value={clave} onChange={(e) => setClave(e.target.value)} />
            {entrar.isError && (
              <Aviso tono="error" titulo="No pudimos entrar">
                {esSinConexion(entrar.error) ? mensajeDeError(entrar.error, '') : mensajeDeIngreso(entrar.error)}
              </Aviso>
            )}
            <Boton type="submit" variante="club" disabled={entrar.isPending}>{entrar.isPending ? 'Entrando…' : 'Entrar'}</Boton>
          </form>
        )}

        {modo === 'crear' && (
          <form onSubmit={enviarCrear} className="flex flex-col gap-3" noValidate>
            <Campo etiqueta="Nombre y apellido" icono={<User className="size-4" />} autoComplete="name" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <Campo etiqueta="Email" icono={<Mail className="size-4" />} type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Campo etiqueta="Clave" icono={<Lock className="size-4" />} type="password" autoComplete="new-password" maxLength={200} ayuda="Al menos 8 caracteres." value={clave} onChange={(e) => setClave(e.target.value)} />
            <Campo etiqueta="Repetí la clave" icono={<Lock className="size-4" />} type="password" autoComplete="new-password" maxLength={200} value={repetida} onChange={(e) => setRepetida(e.target.value)} />
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
            <Boton type="submit" variante="club" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear cuenta'}</Boton>
          </form>
        )}

        {modo === 'recuperar' && (
          <form onSubmit={enviarRecuperar} className="flex flex-col gap-3" noValidate>
            <Campo etiqueta="Email" icono={<Mail className="size-4" />} type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            {problema && <Aviso tono="error" titulo="Revisá el mail">{problema}</Aviso>}
            {recuperar.isError && esSinConexion(recuperar.error) && (
              <Aviso tono="error" titulo="No pudimos mandarlo">{mensajeDeError(recuperar.error, '')}</Aviso>
            )}
            {recuperarEnviado && (
              <Aviso tono="ok" titulo="Listo">Si ese mail tiene una cuenta, ya le llegó el link para cambiar la clave.</Aviso>
            )}
            <Boton type="submit" variante="club" disabled={recuperar.isPending}>{recuperar.isPending ? 'Mandando…' : 'Mandar el link'}</Boton>
          </form>
        )}

        {modo !== 'recuperar' && (
          <>
            <div aria-hidden className="flex items-center gap-3 text-xs uppercase opacity-60">
              <span className="h-px flex-1 bg-current" />o<span className="h-px flex-1 bg-current" />
            </div>
            <Boton variante="contorno" className="border-transparent bg-white text-negro [@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:bg-sobre-negro" onClick={conGoogle} disabled={google.isPending}>
              <LogoDeGoogle />
              {modo === 'crear' ? 'Crear con Google' : 'Entrar con Google'}
            </Boton>
            {google.isError && <Aviso tono="error" titulo="Google">{esSinConexion(google.error) ? mensajeDeError(google.error, '') : mensajeDeGoogle(google.error)}</Aviso>}
          </>
        )}

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
          {modo !== 'entrar' && <button type="button" className="min-h-11 underline" onClick={() => cambiarModo('entrar')}>Ya tengo cuenta</button>}
          {modo !== 'crear' && <button type="button" className="min-h-11 underline" onClick={() => cambiarModo('crear')}>No tengo cuenta</button>}
          {modo === 'entrar' && <button type="button" className="min-h-11 underline" onClick={() => cambiarModo('recuperar')}>Olvidé la clave</button>}
        </div>
        <button type="button" className="mx-auto min-h-11 text-sm opacity-80 underline" onClick={() => cambiarModo('portada')}>‹ Volver</button>
      </div>
    </Pagina>
    </div>
  );
}
