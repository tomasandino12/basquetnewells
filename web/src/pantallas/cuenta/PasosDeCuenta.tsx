import { useState, type FormEvent, type ReactNode } from 'react';
import { necesitaNombre, nombreSugerido, normalizarNombre } from '@datos/cuenta.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Consulta } from '../../components/ui/consulta';
import { Cargando } from '../../components/ui/estados';
import { Pagina } from '../../components/ui/pagina';
import { useAceptarLegal, useAceptoLegal, useAcceso, useGuardarNombreInicial, useMiUsuario } from '../../datos/consultasCuenta';
import { esSinConexion, mensajeDeError } from '../../datos/errores';
import { useSalir } from '../../datos/consultas';
import { SinClub } from './SinClub';

/**
 * Entre «abrí sesión» y «entrá a la app»: el nombre, los Términos y, si la cuenta todavía no es de
 * nadie, la pantalla de «falta el acceso». Es el mismo orden que tenía la app de siempre y se
 * resuelve para cualquiera que llegue con sesión: por mail, por Google o por el link de un mail.
 * La seguridad de verdad la pone la base (RLS); esto sólo dice qué mostrar.
 */
export function PasosDeCuenta({ children, sinAcceso = false }: { children: ReactNode; /** Mi perfil lo abre cualquiera con cuenta, aunque todavía no sea de nadie: sólo pide nombre y Términos. */ sinAcceso?: boolean }) {
  const usuario = useMiUsuario();
  const legal = useAceptoLegal();

  if (usuario.isError || legal.isError) {
    return (
      <Pagina>
        <Consulta
          consulta={{ isPending: false, isError: true, error: usuario.error ?? legal.error, data: undefined, refetch: () => Promise.all([usuario.refetch(), legal.refetch()]) }}
          errorGenerico="No pudimos cargar tu cuenta"
        >
          {() => null}
        </Consulta>
      </Pagina>
    );
  }
  if (usuario.isPending || legal.isPending) return <Pagina><Cargando filas={2} /></Pagina>;
  if (usuario.data && necesitaNombre(usuario.data)) return <PedirNombre sugerido={nombreSugerido(usuario.data)} />;
  if (!legal.data) return <AceptarLegal />;
  // El acceso se pregunta recién con nombre y Términos resueltos: una cuenta incompleta no pasa a nada.
  if (sinAcceso) return <>{children}</>;
  return <ConAcceso mail={usuario.data?.email}>{children}</ConAcceso>;
}

function ConAcceso({ children, mail }: { children: ReactNode; mail: string | undefined }) {
  const acceso = useAcceso();
  if (acceso.estado === 'cargando') return <Pagina><Cargando filas={2} /></Pagina>;
  if (acceso.estado === 'error') {
    return (
      <Pagina>
        <Consulta
          consulta={{ isPending: false, isError: true, error: acceso.error, data: undefined, refetch: async () => acceso.reintentar() }}
          errorGenerico="No pudimos cargar tu acceso"
        >
          {() => null}
        </Consulta>
      </Pagina>
    );
  }
  if (acceso.estado === 'sin-club') return <SinClub mail={mail} />;
  return <>{children}</>;
}

const MARCO = 'mx-auto flex w-full max-w-sm flex-col gap-4';

export function SalirDeLaCuenta() {
  const salir = useSalir();
  return (
    <button type="button" className="self-start text-sm underline" disabled={salir.isPending} onClick={() => salir.mutate()}>
      Salir de esta cuenta
    </button>
  );
}

/**
 * La cuenta existe pero no tiene nombre: la primera entrada con Google o una cuenta de mail creada sin él.
 * No se saltea: es lo que ven los demás profes y la coordinación. Lo que trae Google se ofrece escrito
 * en el campo pero no se guarda hasta que la persona toca Continuar.
 */
function PedirNombre({ sugerido }: { sugerido: string }) {
  const guardar = useGuardarNombreInicial();
  const [nombre, setNombre] = useState(sugerido);
  const [problema, setProblema] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = normalizarNombre(nombre) as string;
    if (!limpio) return setProblema('Escribí tu nombre y apellido.');
    setProblema(null);
    guardar.mutate(limpio);
  };

  return (
    <Pagina className="flex min-h-svh flex-col justify-center">
      <div className={MARCO}>
        <h1 className="font-titulo text-4xl leading-none font-semibold">¿Cómo te llamás?</h1>
        <p className="text-sm text-gris">
          Es lo que ven los demás profes y la coordinación al lado de lo que cargues. Revisalo antes de seguir: lo podés cambiar después desde Mi perfil.
        </p>
        <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
          <Campo etiqueta="Nombre y apellido" autoComplete="name" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {problema && <Aviso tono="error" titulo="Revisá el nombre">{problema}</Aviso>}
          {guardar.isError && (
            <Aviso tono="error" titulo="No pudimos guardarlo">
              {mensajeDeError(guardar.error, 'No se pudo guardar tu nombre. Intentá de nuevo.')}
            </Aviso>
          )}
          <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Continuar'}</Boton>
        </form>
        <SalirDeLaCuenta />
      </div>
    </Pagina>
  );
}

/**
 * Términos y Privacidad sin aceptar en su versión vigente (VERSION_LEGAL: la fecha en que cambió el texto).
 * La casilla arranca siempre destildada: aceptar tiene que ser un gesto de la persona.
 */
function AceptarLegal() {
  const aceptar = useAceptarLegal();
  const [acepto, setAcepto] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!acepto) return setProblema('Tildá la casilla para seguir.');
    setProblema(null);
    aceptar.mutate();
  };

  return (
    <Pagina className="flex min-h-svh flex-col justify-center">
      <div className={MARCO}>
        <h1 className="font-titulo text-4xl leading-none font-semibold">Antes de seguir</h1>
        <p className="text-sm text-gris">
          La app guarda datos de jugadores, muchos de ellos menores. Leé cómo se cuidan y cuáles son las reglas para usarla.
        </p>
        <div className="flex flex-col gap-1 text-sm">
          <a className="underline" href="/privacidad" target="_blank" rel="noopener">Política de privacidad</a>
          <a className="underline" href="/terminos" target="_blank" rel="noopener">Términos y condiciones</a>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            Leí y acepto los Términos y la Política de privacidad. Si soy menor de 18, un adulto responsable los leyó y me autorizó.
          </label>
          {problema && <Aviso tono="error" titulo="Falta aceptar">{problema}</Aviso>}
          {aceptar.isError && (
            <Aviso tono="error" titulo="No pudimos guardarlo">
              {esSinConexion(aceptar.error) ? mensajeDeError(aceptar.error, '') : 'No se pudo guardar. Intentá de nuevo.'}
            </Aviso>
          )}
          <Boton type="submit" disabled={aceptar.isPending}>{aceptar.isPending ? 'Guardando…' : 'Continuar'}</Boton>
        </form>
        <SalirDeLaCuenta />
      </div>
    </Pagina>
  );
}
