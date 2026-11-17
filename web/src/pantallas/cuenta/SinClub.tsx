import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quiereSerJugador } from '@datos/cuenta.js';
import { hoyLocal, validarFechaNacimiento } from '@datos/antropometria.js';
import { clubesDelCatalogo } from '@datos/solicitudJugador.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Consulta } from '../../components/ui/consulta';
import { Pagina } from '../../components/ui/pagina';
import { eligioJugadorPorGoogle, soltarJugadorPorGoogle } from '../../cuenta/jugadorPorGoogle';
import { useMiUsuario } from '../../datos/consultasCuenta';
import { useCargarRepositorio } from '../../datos/contexto';
import { mensajeDeGuardado } from '../../datos/errores';
import type { MiSolicitud } from '../../datos/repositorio';
import { useDatosDelPedido } from '../../familias/consultas';
import { SalirDeLaCuenta } from './PasosDeCuenta';

const REGLAS: [RegExp, string][] = [
  [/SOLICITUD_YA_PENDIENTE/, 'Ya tenés una solicitud pendiente. Esperá a que la apruebe un entrenador.'],
  [/ES_DEL_CUERPO_TECNICO/, 'Tu cuenta es del cuerpo técnico: no hace falta pedir acceso como jugador.'],
  [/YA_TIENE_CUENTA/, 'Tu cuenta ya tiene acceso como jugador. Cerrá la sesión y volvé a entrar.'],
  [/MAIL_SIN_CONFIRMAR/, 'Primero confirmá tu mail: te llegó un link cuando creaste la cuenta.'],
  [/PLANTEL_INVALIDO/, 'Esa categoría ya no está disponible. Elegí otra.'],
  [/FECHA_NACIMIENTO_REQUERIDA/, 'Ingresá tu fecha de nacimiento.'],
  [/FECHA_NACIMIENTO_FUTURA/, 'La fecha de nacimiento no puede ser futura.'],
];

const MARCO = 'mx-auto flex w-full max-w-sm flex-col gap-4';

const fechaCorta = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

/** Lo que se dice cuando ya hay un pedido esperando. */
const textoDeSolicitudPendiente = (s: MiSolicitud) =>
  `Tu solicitud a ${s.clubNombre} · ${s.categoriaNombre} está pendiente desde el ${fechaCorta(s.creadoEn)}. Un entrenador de esa categoría la tiene que aprobar.`;

function useMiPedidoRechazado() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['cuenta', 'rechazada'],
    staleTime: 0,
    retry: false,
    // Un error de red no bloquea nada: la pantalla queda como estaba.
    queryFn: async () => (await cargar()).miPedidoDescartado().catch(() => false),
  });
}

/**
 * «Tu cuenta está lista, falta el acceso»: la cuenta existe pero todavía no es de nadie. No es un
 * error: es lo normal de quien recién se registró. Vincularla a un club no se pide desde acá, salvo
 * el jugador, que pide acceso a su categoría y lo aprueba el entrenador de esa categoría.
 */
export function SinClub({ mail }: { mail: string | undefined }) {
  const usuario = useMiUsuario();
  // Se lee una sola vez, al abrir: la cuenta de jugador cae directo en el formulario de pedir acceso.
  const [abrirDeEntrada] = useState(() => quiereSerJugador(usuario.data) || eligioJugadorPorGoogle());
  const [verPedido, setVerPedido] = useState(abrirDeEntrada);
  const consultas = useQueryClient();
  const pedido = useDatosDelPedido();
  const rechazada = useMiPedidoRechazado();
  const cargar = useCargarRepositorio();

  useEffect(() => {
    soltarJugadorPorGoogle();
  }, []);

  const volverAPedir = useMutation({
    mutationFn: async () => (await cargar()).volverAPedirAcceso(),
    onSuccess: () => consultas.invalidateQueries({ queryKey: ['cuenta', 'rechazada'] }),
  });

  // «Ya me dieron el acceso»: se vuelve a preguntar todo lo que decide la puerta.
  const reintentar = () => {
    void consultas.invalidateQueries({
      predicate: ({ queryKey: [a, b] }) => a !== 'sesion' && !(a === 'cuenta' && (b === 'usuario' || b === 'legal')),
    });
  };

  if (verPedido) {
    return <PedirComoJugador alVolver={() => setVerPedido(false)} alReintentar={reintentar} />;
  }

  const pendiente = pedido.data?.pendiente ?? null;
  const hayRechazo = rechazada.data === true && !volverAPedir.isSuccess;

  return (
    <Pagina className="flex min-h-svh flex-col justify-center">
      <div className={MARCO}>
        <h1 className="font-titulo text-4xl leading-none font-semibold">Tu cuenta está lista, falta el acceso</h1>
        <p className="text-sm text-gris">
          La cuenta se creó bien y podés entrar con ella. Lo que todavía no tenés es acceso a los datos del club, y depende de quién seas.
        </p>
        {pendiente && <Aviso tono="info" titulo="Pedido enviado">{textoDeSolicitudPendiente(pendiente)}</Aviso>}
        {hayRechazo && (
          <>
            <Aviso tono="error" titulo="Sin habilitar">
              Coordinación no habilitó esta cuenta. Si fue un error, podés pedir el acceso de nuevo.
            </Aviso>
            <Boton variante="contorno" disabled={volverAPedir.isPending} onClick={() => volverAPedir.mutate()}>
              Fue un error, pedir acceso de nuevo
            </Boton>
          </>
        )}
        {volverAPedir.isSuccess && (
          <Aviso tono="ok" titulo="Listo">
            Coordinación lo va a ver de nuevo. Cuando te habiliten, entrá con «reintentar».
          </Aviso>
        )}
        {volverAPedir.isError && (
          <Aviso tono="error" titulo="No pudimos pedirlo">
            {mensajeDeGuardado(volverAPedir.error, 'No se pudo pedir de nuevo. Probá otra vez.')}
          </Aviso>
        )}
        <Boton onClick={() => setVerPedido(true)}>{pendiente ? 'Ver mi solicitud' : 'Soy jugador de un club'}</Boton>

        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-semibold">¿Sos familiar de un jugador?</h2>
          <p className="text-gris">Tu hijo todavía no figura con este mail. Probá así:</p>
          <ol className="list-decimal pl-5 text-gris">
            <li>Anotalo en el formulario de inscripción de la página del básquet.</li>
            <li>Usá este mismo mail para el formulario.</li>
            <li>Esperá unos días a que el club lo cargue y tocá «Ya me dieron el acceso, reintentar».</li>
          </ol>
          <p className="text-gris">Si pasó tiempo y no aparece, avisale al coordinador.</p>
        </section>
        <section className="flex flex-col gap-1 text-sm">
          <p className="text-gris">Si sos profe o coordinador, pasale este mail al coordinador de tu club para que te habilite:</p>
          <p className="font-semibold break-all">{mail ?? '—'}</p>
        </section>
        <Boton variante="contorno" onClick={reintentar}>Ya me dieron el acceso, reintentar</Boton>
        <SalirDeLaCuenta />
      </div>
    </Pagina>
  );
}

/** «Soy jugador de un club»: elige club y categoría y queda un pedido pendiente que aprueba el entrenador de esa categoría. */
function PedirComoJugador({ alVolver, alReintentar }: { alVolver: () => void; alReintentar: () => void }) {
  const pedido = useDatosDelPedido();
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  const [clubId, setClubId] = useState('');
  const [plantelId, setPlantelId] = useState('');
  const [nacimiento, setNacimiento] = useState('');
  const [problema, setProblema] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: async (d: { clubId: string; plantelId: string; fechaNacimiento: string }) => (await cargar()).crearSolicitudJugador(d),
    onSuccess: () => consultas.invalidateQueries({ queryKey: ['familia', 'pedido'] }),
  });

  return (
    <Pagina className="flex min-h-svh flex-col justify-center">
      <div className={MARCO}>
        <h1 className="font-titulo text-4xl leading-none font-semibold">Soy jugador de un club</h1>
        <Consulta consulta={pedido} errorGenerico="No pudimos cargar la lista de clubes">
          {({ pendiente, catalogo }) => {
            if (pendiente) {
              return (
                <>
                  <p role="status" className="text-sm text-gris">{textoDeSolicitudPendiente(pendiente)}</p>
                  {pendiente.codigo && (
                    <div className="flex flex-col gap-1">
                      <p className="font-titulo text-3xl tracking-widest">{pendiente.codigo}</p>
                      <p className="text-sm text-gris">Mostráselo a tu profe en la práctica.</p>
                    </div>
                  )}
                  <Boton onClick={alReintentar}>Ya me aprobaron, reintentar</Boton>
                </>
              );
            }
            const clubes = clubesDelCatalogo(catalogo) as { clubId: string; nombre: string; categorias: { plantelId: string; nombre: string }[] }[];
            if (!clubes.length) {
              return <p className="text-sm text-gris">Todavía no hay clubes con categorías cargadas para pedir acceso.</p>;
            }
            const club = clubes.find((c) => c.clubId === clubId) ?? clubes[0];
            const categoria = club.categorias.find((c) => c.plantelId === plantelId) ?? club.categorias[0];
            const mandar = (e: FormEvent) => {
              e.preventDefault();
              if (!categoria) return setProblema('Elegí tu club y tu categoría.');
              if (!nacimiento) return setProblema('Ingresá tu fecha de nacimiento.');
              const v = validarFechaNacimiento(nacimiento) as { ok: boolean; errores: string[]; valor: string | null };
              if (!v.ok || !v.valor) return setProblema(v.errores.join(' '));
              setProblema(null);
              enviar.mutate({ clubId: club.clubId, plantelId: categoria.plantelId, fechaNacimiento: v.valor });
            };
            return (
              <form onSubmit={mandar} className="flex flex-col gap-3" noValidate>
                <p className="text-sm text-gris">
                  Elegí tu club y tu categoría. El entrenador de esa categoría tiene que aprobar tu pedido antes de que veas tus datos.
                </p>
                <Selector etiqueta="Club" valor={club.clubId} alCambiar={(v) => { setClubId(v); setPlantelId(''); }} opciones={clubes.map((c) => [c.clubId, c.nombre])} />
                <Selector etiqueta="Categoría" valor={categoria?.plantelId ?? ''} alCambiar={setPlantelId} opciones={club.categorias.map((c) => [c.plantelId, c.nombre])} />
                <Campo etiqueta="Fecha de nacimiento" type="date" max={hoyLocal()} value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
                {problema && <Aviso tono="error" titulo="Revisá los datos">{problema}</Aviso>}
                {enviar.isError && (
                  <Aviso tono="error" titulo="No pudimos enviarlo">
                    {mensajeDeGuardado(enviar.error, 'No se pudo enviar el pedido. Probá de nuevo.', REGLAS)}
                  </Aviso>
                )}
                <Boton type="submit" disabled={enviar.isPending}>{enviar.isPending ? 'Enviando…' : 'Pedir acceso'}</Boton>
              </form>
            );
          }}
        </Consulta>
        <button type="button" className="self-start text-sm underline" onClick={alVolver}>Volver</button>
      </div>
    </Pagina>
  );
}

function Selector({ etiqueta, valor, alCambiar, opciones }: { etiqueta: string; valor: string; alCambiar: (v: string) => void; opciones: [string, string][] }) {
  const id = `sel-${etiqueta}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => alCambiar(e.target.value)} className="h-11 w-full rounded-campo border border-borde-control bg-sup px-3 text-base">
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  );
}
