import { useState, type FormEvent, type ReactNode } from 'react';
import { inicialesDeNombre, LARGO_MAXIMO_NOMBRE, nombreDeUsuario, normalizarNombre, rolesLegibles } from '@datos/cuenta.js';
import { LineaCargando } from '../components/ui/estados';
import { irALaDeSiempre } from '../clasica';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Chip } from '../components/ui/chip';
import { Interruptor } from '../components/ui/interruptor';
import { Panel } from '../components/ui/card';
import { Pagina } from '../components/ui/pagina';
import { Hoja } from '../components/ui/sheet';
import { useSalir } from '../datos/consultas';
import { useCategoriasDelEntrenador, useDatosDelPerfil, useGuardarNombre } from '../datos/consultasPerfil';
import { useSesion } from '../datos/contexto';
import { esSinConexion, mensajeDeError } from '../datos/errores';
import { guardarNueva, nuevaPrendida } from '../perfil/interruptorNueva';
import { aplicarTema, guardarTema, useTema } from '../tema';
import { TituloDeHoja } from './familias/piezas';

const ENLACE_TEXTO =
  'inline-flex min-h-11 items-center text-sm font-semibold underline decoration-linea decoration-2 underline-offset-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:decoration-club';

/**
 * Mi perfil: quién sos para la app. El nombre grande arriba, los datos al lado y los dos
 * interruptores del teléfono (tema y versión de la app). Sólo lo que a esta app le sirve: nombre,
 * mail, rol y categorías a cargo. Cerrar sesión vive acá y en el marco.
 */
export function Perfil() {
  const { sesion } = useSesion();
  const datos = useDatosDelPerfil();
  const nombre = nombreDeUsuario(sesion?.user) as string | null;
  const iniciales = inicialesDeNombre(nombre ?? '') as string;
  const roles = rolesLegibles(datos) as string[];
  const [editando, setEditando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const salir = useSalir();

  return (
    <Pagina>
      <header className="mb-6 flex items-center gap-4">
        <div aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-club font-titulo text-3xl leading-none font-bold text-sobre-club">
          {iniciales || '?'}
        </div>
        <div className="min-w-0">
          <div className="flex min-h-6 flex-wrap gap-1.5" aria-label="Tus roles">
            {datos.rolesListos && roles.map((r) => <Chip key={r}>{r}</Chip>)}
          </div>
          <h1 className="font-titulo text-4xl leading-none font-bold tracking-tight break-words lg:text-5xl">
            {nombre ?? <span className="text-gris">Sin nombre cargado</span>}
          </h1>
          {datos.clubNombre && <p className="mt-1 text-sm text-gris">{datos.clubNombre}</p>}
        </div>
      </header>

      {!nombre && !datos.esJugador && (
        <Aviso titulo="Cargá tu nombre" className="mb-4">
          Es lo que ven los demás profes y la coordinación. Mientras no esté, ven tu mail.
        </Aviso>
      )}
      {hecho && <Aviso tono="ok" titulo={hecho} className="mb-4" />}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel titulo="Tus datos">
          <dl className="flex flex-col divide-y divide-linea">
            <Fila rotulo="Nombre" accion={<Boton variante="contorno" tamano="chico" onClick={() => setEditando(true)}>{nombre ? 'Editar' : 'Cargar'}</Boton>}>
              {nombre ?? <span className="text-gris">Sin nombre cargado</span>}
            </Fila>
            <Fila rotulo="Correo electrónico">{sesion?.user.email ?? '—'}</Fila>
            <Fila rotulo={datos.esFamilia ? 'Tus chicos' : datos.esJugador ? 'Tu categoría' : 'Categorías a cargo'}>
              <Categorias datos={datos} />
            </Fila>
          </dl>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel titulo="Apariencia">
            <SelectorDeTema />
          </Panel>
          {datos.esEntrenador && (
            <Panel titulo="Versión de la app">
              <SelectorDeVersion alAvisar={setHecho} />
            </Panel>
          )}
          <div className="flex flex-col items-start gap-3">
            <Boton variante="contorno" onClick={() => salir.mutate()} disabled={salir.isPending}>
              {salir.isPending ? 'Saliendo…' : 'Cerrar sesión'}
            </Boton>
            <p className="flex flex-wrap gap-x-5 text-sm">
              <a href="/privacidad" target="_blank" rel="noopener" className={ENLACE_TEXTO}>Política de privacidad</a>
              <a href="/terminos" target="_blank" rel="noopener" className={ENLACE_TEXTO}>Términos y condiciones</a>
            </p>
          </div>
        </div>
      </div>

      {editando && (
        <HojaDeNombre
          actual={nombre ?? ''}
          alCerrar={() => setEditando(false)}
          alGuardar={() => {
            setEditando(false);
            setHecho('Listo: tu nombre quedó guardado.');
          }}
        />
      )}
    </Pagina>
  );
}

function Fila({ rotulo, accion, children }: { rotulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <dt className="font-mono text-xs tracking-wide text-gris uppercase">{rotulo}</dt>
        <dd className="break-words">{children}</dd>
      </div>
      {accion}
    </div>
  );
}

/** Las categorías, los chicos o la categoría propia, según quién sos. Cargando y error se dicen con palabras. */
function Categorias({ datos }: { datos: ReturnType<typeof useDatosDelPerfil> }) {
  const entrena = datos.rolesListos && datos.esEntrenador && !datos.esFamilia && !datos.esJugador;
  const q = useCategoriasDelEntrenador(datos.clubId, entrena);

  if (!datos.rolesListos) return <LineaCargando />;
  if (datos.esFamilia) {
    return <Etiquetas lista={datos.chicos.map((c) => c.nombre)} vacio="Todavía no hay chicos vinculados." />;
  }
  if (datos.esJugador) {
    return <Etiquetas lista={datos.categoriasDeJugador} vacio="Todavía no estás en ninguna categoría." />;
  }
  if (!datos.esEntrenador) return <span className="text-gris">Coordinación no tiene categorías a cargo: ve el panorama de todas.</span>;
  if (q.isPending) return <LineaCargando />;
  if (q.isError) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-gris">
        {esSinConexion(q.error) ? 'Sin conexión: no se pudieron cargar.' : mensajeDeError(q.error, 'No se pudieron cargar.')}
        <button type="button" onClick={() => void q.refetch()} className="font-semibold text-tinta underline">Reintentar</button>
      </span>
    );
  }
  return <Etiquetas lista={q.data} vacio="Todavía no tenés categorías asignadas. Pedíselas al coordinador del club." />;
}

function Etiquetas({ lista, vacio }: { lista: string[]; vacio: string }) {
  if (lista.length === 0) return <span className="text-gris">{vacio}</span>;
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {lista.map((t, i) => (
        <li key={`${t}-${i}`}><Chip>{t}</Chip></li>
      ))}
    </ul>
  );
}

/** El tema es del teléfono: cada pantalla y cada pieza funcionan en los dos. */
function SelectorDeTema() {
  const tema = useTema();
  const [sinRecordar, setSinRecordar] = useState(false);
  return (
    <>
      <Interruptor
        etiqueta="Tema oscuro"
        descripcion="Se guarda en este teléfono."
        activo={tema === 'oscuro'}
        alCambiar={(oscuro) => {
          const nuevo = oscuro ? 'oscuro' : 'claro';
          aplicarTema(nuevo);
          setSinRecordar(!guardarTema(nuevo));
        }}
      />
      {sinRecordar && <p role="status" className="mt-1 text-sm text-gris">No se pudo recordar en este teléfono.</p>}
    </>
  );
}

/** Apagar la versión nueva manda a la de siempre en este teléfono. Si no se puede guardar, queda como estaba. */
function SelectorDeVersion({ alAvisar }: { alAvisar: (texto: string | null) => void }) {
  const [prendida, setPrendida] = useState(nuevaPrendida);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Interruptor
        etiqueta="Versión nueva de la app"
        descripcion="Si la apagás, volvés a la versión de siempre en este teléfono."
        activo={prendida}
        alCambiar={(nueva) => {
          if (!guardarNueva(nueva)) {
            setError('No se pudo guardar en este teléfono.');
            return;
          }
          setError(null);
          setPrendida(nueva);
          if (nueva) alAvisar('La versión nueva quedó prendida.');
          // Sin la de siempre a mano (en la compu) no hay adónde ir: el cambio vale la próxima vez que se abra.
          else if (!irALaDeSiempre()) alAvisar('Listo: la próxima vez que abras la app se abre la de siempre.');
        }}
      />
      {error && <p role="alert" className="mt-1 text-sm font-semibold text-club-texto">{error}</p>}
    </>
  );
}

function HojaDeNombre({ actual, alCerrar, alGuardar }: { actual: string; alCerrar: () => void; alGuardar: () => void }) {
  const guardar = useGuardarNombre();
  const [texto, setTexto] = useState(actual);
  const [error, setError] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (guardar.isPending) return;
    const nombre = normalizarNombre(texto) as string;
    if (!nombre) {
      setError('Escribí tu nombre y apellido.');
      return;
    }
    setError(null);
    guardar.mutate(nombre, {
      onSuccess: alGuardar,
      onError: (err) => setError(mensajeDeError(err, 'No se pudo guardar tu nombre.')),
    });
  };

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="Tu nombre" descripcion="Cambiar el nombre que ven los demás profes y la coordinación." etiquetaCerrar="Cerrar">
      <form onSubmit={enviar} className="flex flex-col gap-3 p-5 pt-12">
        <TituloDeHoja>Tu nombre</TituloDeHoja>
        <p className="text-sm text-gris">Es lo que ven los demás profes y la coordinación.</p>
        <Campo
          etiqueta="Nombre y apellido"
          type="text"
          autoComplete="name"
          spellCheck={false}
          maxLength={LARGO_MAXIMO_NOMBRE}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        {error && <Aviso tono="error" titulo={error} />}
        <div className="flex gap-2">
          <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Boton>
          <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
        </div>
      </form>
    </Hoja>
  );
}
