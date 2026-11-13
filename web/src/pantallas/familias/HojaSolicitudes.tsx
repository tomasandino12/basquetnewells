import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { hoyLocal, validarFechaNacimiento } from '@datos/antropometria.js';
import { clavearNombre, limpiarNombre } from '@datos/claveNombre.js';
import { LIMITE } from '@datos/limites.js';
import { fichaExistente, normalizarCodigo } from '@datos/solicitudJugador.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Consulta } from '../../components/ui/consulta';
import { Hoja } from '../../components/ui/sheet';
import { mensajeDeGuardado } from '../../datos/errores';
import type { AprobacionDeSolicitud, JugadorDelPlantel, SolicitudDelPlantel } from '../../datos/repositorio';
import { useAccion, useRepositorio, useSolicitudesDelPlantel } from '../../familias/consultas';
import { FILA_TOCABLE, RotuloDeBloque, TituloDeHoja, fechaCorta } from './piezas';

// Lo que dice la base cuando algo no cierra (aprobar_solicitud_jugador y rechazar_solicitud_jugador).
const REGLAS: [RegExp, string][] = [
  [/JUGADOR_YA_TIENE_CUENTA/, 'Esa ficha ya tiene una cuenta vinculada.'],
  [/CUENTA_YA_VINCULADA/, 'Esa cuenta ya está vinculada a otra ficha.'],
  [/SOLICITUD_NO_ENCONTRADA/, 'Esa solicitud ya no está pendiente: la resolvió otro profe o no es de tu categoría.'],
  [/ES_DEL_CUERPO_TECNICO/, 'Esa cuenta ya es del cuerpo técnico: no se la puede vincular a una ficha de jugador. Rechazá la solicitud.'],
  [/FICHA_FUERA_DEL_PLANTEL/, 'Esa ficha no está en esta categoría.'],
  [/CODIGO_INCORRECTO/, 'Ese código no es el de esta solicitud. Pedíselo al chico en persona.'],
  [/FECHA_NACIMIENTO_REQUERIDA/, 'Falta la fecha de nacimiento.'],
];

interface Props {
  plantel: { id: string; categoria: string };
  clubId: string;
  /** Los chicos de la categoría: la otra forma de aprobar es decir cuál de ellos es. */
  jugadores: JugadorDelPlantel[];
  alCerrar: () => void;
  /** Lo que la pantalla dice arriba cuando se resolvió una solicitud. */
  alResolver: (texto: string) => void;
}

/**
 * «Pidieron entrar»: los chicos que pidieron acceso a la categoría. Quien decide qué ficha es cuál es
 * siempre el profe: el sistema no compara nombres para vincular. Lo primero que se ofrece es crear la
 * ficha (el caso normal: un chico que entra en marzo no tiene ni un partido cargado); elegir una que
 * ya existe es el otro camino. El código que el chico muestra en persona lo valida la base.
 */
export function HojaSolicitudes({ plantel, clubId, jugadores, alCerrar, alResolver }: Props) {
  const datos = useSolicitudesDelPlantel(plantel.id);
  const [elegida, setElegida] = useState<string | null>(null);
  return (
    <Hoja
      abierta
      alCambiar={(a) => !a && alCerrar()}
      titulo="Pidieron entrar"
      descripcion={`Chicos que pidieron acceso a ${plantel.categoria}`}
      etiquetaCerrar="Cerrar"
    >
      <div className="flex flex-col gap-4 p-5 pt-12">
        <Consulta consulta={datos} errorGenerico="No se pudieron cargar los pedidos.">
          {(lista) => {
            const s = lista.find((x) => x.id === elegida);
            return s ? (
              <Detalle
                key={s.id}
                s={s}
                clubId={clubId}
                plantel={plantel}
                jugadores={jugadores}
                alVolver={() => setElegida(null)}
                alResolver={(texto) => {
                  alResolver(texto);
                  alCerrar();
                }}
              />
            ) : (
              <Lista lista={lista} categoria={plantel.categoria} alElegir={setElegida} />
            );
          }}
        </Consulta>
      </div>
    </Hoja>
  );
}

function Lista({ lista, categoria, alElegir }: { lista: SolicitudDelPlantel[]; categoria: string; alElegir: (id: string) => void }) {
  return (
    <>
      <TituloDeHoja>Pidieron entrar</TituloDeHoja>
      <p className="text-sm text-gris">
        Chicos que pidieron acceso a {categoria}. Al aprobar, ven sus recursos, su plan y su progreso: nada de los demás.
      </p>
      {lista.length === 0 ? (
        <p className="py-4 text-sm">No hay pedidos pendientes.</p>
      ) : (
        <ul aria-label="Pedidos pendientes" className="flex flex-col gap-2">
          {lista.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => alElegir(s.id)} className={FILA_TOCABLE}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.nombre ?? 'Sin nombre'}</span>
                  <span className="block text-xs text-gris">Pidió el {fechaCorta(s.creadoEn.slice(0, 10))}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-gris" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type Oferta = { jugador: { id: string; nombreLimpio: string }; enPlantel: boolean } | null;

function Detalle({ s, clubId, plantel, jugadores, alVolver, alResolver }: {
  s: SolicitudDelPlantel;
  clubId: string;
  plantel: { id: string; categoria: string };
  jugadores: JugadorDelPlantel[];
  alVolver: () => void;
  alResolver: (texto: string) => void;
}) {
  const cargar = useRepositorio();
  const aprobar = useAccion((repo, p: AprobacionDeSolicitud) => repo.aprobarSolicitud(p));
  const rechazar = useAccion((repo, id: string) => repo.rechazarSolicitud(id));
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState(s.nombre ?? '');
  const [nacimiento, setNacimiento] = useState(s.fechaNacimiento ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Crear la ficha chocó con una que ya existe en el club: se ofrecen las dos salidas (la misma persona u otra).
  const [oferta, setOferta] = useState<{ existente: Oferta } | null>(null);
  const [distingue, setDistingue] = useState('');

  /** Corre la acción; si sale bien cierra la hoja y avisa. Si falla devuelve el error para que quien llama decida qué decir. */
  async function resolver(clave: string, hacer: () => Promise<unknown>, ok: string): Promise<{ fallo: unknown } | null> {
    setOcupado(clave);
    setError(null);
    try {
      await hacer();
    } catch (e) {
      setOcupado(null);
      return { fallo: e };
    }
    alResolver(ok);
    return null;
  }

  // El código lo mandan los dos caminos: sin él, la base rechaza con CODIGO_INCORRECTO.
  function leerCodigo(): string | null {
    const c = normalizarCodigo(codigo) as string | null;
    if (!c) setError('Pedile el código al chico: son 6 caracteres, se los muestra la app a él.');
    return c;
  }

  async function crearFicha(desambiguador: string) {
    const nombreLimpio = limpiarNombre(nombre) as string;
    const nombreClave = clavearNombre(nombreLimpio) as string;
    if (!nombreClave) return setError('Escribí el nombre de la ficha.');
    if (!nacimiento) return setError('Falta la fecha de nacimiento.');
    const f = validarFechaNacimiento(nacimiento) as { ok: boolean; errores: string[]; valor: string };
    if (!f.ok) return setError(f.errores.join(' '));
    const c = leerCodigo();
    if (!c) return;
    const payload: AprobacionDeSolicitud = {
      solicitudId: s.id, nombreClave, nombreLimpio, fechaNacimiento: f.valor, codigo: c,
      ...(desambiguador ? { desambiguador } : {}),
    };
    const r = await resolver('crear', () => aprobar.mutateAsync(payload), `${nombreLimpio} ya puede entrar`);
    if (!r) return;
    if ((r.fallo as { message?: string } | null)?.message === 'JUGADOR_YA_EXISTE') {
      let existente: Oferta = null;
      try {
        existente = fichaExistente((await (await cargar()).obtenerJugadoresDelClub(clubId)), nombreClave, plantel.id) as Oferta;
      } catch {
        // Sin la lista se muestran igual las dos salidas: el aviso alcanza para elegir.
      }
      setOferta({ existente });
      return;
    }
    setError(mensajeDeGuardado(r.fallo, 'No se pudo aprobar. Probá de nuevo.', REGLAS));
  }

  async function vincular(jugadorId: string) {
    const c = leerCodigo();
    if (!c) return;
    const r = await resolver(`vincular:${jugadorId}`, () => aprobar.mutateAsync({ solicitudId: s.id, jugadorId, codigo: c }), 'Listo: ya puede entrar');
    if (r) setError(mensajeDeGuardado(r.fallo, 'No se pudo aprobar. Probá de nuevo.', REGLAS));
  }

  async function rechazarPedido() {
    const r = await resolver('rechazar', () => rechazar.mutateAsync(s.id), 'Solicitud rechazada');
    if (r) setError(mensajeDeGuardado(r.fallo, 'No se pudo rechazar. Probá de nuevo.', REGLAS));
  }

  const libre = ocupado === null;
  const existente = oferta?.existente ?? null;

  return (
    <>
      <TituloDeHoja>{s.nombre ?? 'Solicitud'}</TituloDeHoja>
      <p className="text-sm text-gris">
        Pidió entrar a {plantel.categoria} el {fechaCorta(s.creadoEn.slice(0, 10))}. Escribió ese nombre al crear su cuenta.
        {s.emailEnmascarado ? ` Mail: ${s.emailEnmascarado}.` : ''}
      </p>

      <Campo
        etiqueta="Código que te mostró en persona"
        ayuda="Se lo pedís en la práctica: la app no te lo puede mostrar a vos."
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        maxLength={6}
        autoComplete="off"
        spellCheck={false}
        placeholder="A1B2C3"
      />

      <RotuloDeBloque className="mt-2">Es un chico nuevo</RotuloDeBloque>
      <Campo
        etiqueta="Nombre de la ficha"
        ayuda="Como en la CABB: Apellido, Nombre. Si lo dejás como lo escribió, cuando llegue una planilla el import te la va a sugerir para que la confirmes."
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={LIMITE.nombrePersona}
        autoComplete="off"
        spellCheck={false}
      />
      <Campo
        etiqueta="Fecha de nacimiento"
        ayuda="La escribió al pedir acceso. Si se equivocó (o le erró a propósito), corregila antes de confirmar."
        type="date"
        max={hoyLocal()}
        value={nacimiento}
        onChange={(e) => setNacimiento(e.target.value)}
      />

      {error && <Aviso tono="error" titulo={error} />}

      {oferta && (
        <section aria-label="Ya hay una ficha con ese nombre" className="flex flex-col gap-3">
          <Aviso tono="ok" titulo="Ya hay una ficha con ese nombre en el club.">
            {existente && !existente.enPlantel
              ? `${existente.jugador.nombreLimpio} está cargado en otra categoría. Si es la misma persona, sumala primero a ${plantel.categoria} (Agregar a mano, con ese nombre) y volvé a aprobar.`
              : 'Si es la misma persona, vinculala. Si es otra con el mismo nombre, creá la ficha con un dato que las distinga.'}
          </Aviso>
          {existente?.enPlantel && (
            <Boton disabled={!libre} onClick={() => void vincular(existente.jugador.id)}>
              Es la misma persona: darle acceso a {existente.jugador.nombreLimpio}
            </Boton>
          )}
          <Campo
            etiqueta="Es otra persona: un dato que la distinga"
            value={distingue}
            onChange={(e) => setDistingue(e.target.value)}
            maxLength={LIMITE.desambiguador}
            autoComplete="off"
            spellCheck={false}
            placeholder="Por ejemplo, el año de nacimiento"
          />
          <Boton
            variante="contorno"
            disabled={!libre}
            onClick={() => (distingue.trim() ? void crearFicha(distingue.trim()) : setError('Escribí un dato que distinga a esta persona de la otra ficha.'))}
          >
            Crear la ficha con ese dato
          </Boton>
        </section>
      )}

      {!oferta && (
        <Boton disabled={!libre} onClick={() => void crearFicha('')}>
          {ocupado === 'crear' ? 'Creando…' : 'Crear la ficha y darle acceso'}
        </Boton>
      )}

      {jugadores.length > 0 && (
        <section aria-label={`Ya está en la lista de ${plantel.categoria}`} className="flex flex-col gap-2">
          <RotuloDeBloque className="mt-2">O ya está en la lista de {plantel.categoria}</RotuloDeBloque>
          <ul className="flex flex-col gap-2">
            {jugadores.map((j) => (
              <li key={j.id}>
                <button type="button" disabled={!libre} onClick={() => void vincular(j.id)} className={FILA_TOCABLE}>
                  <span className="min-w-0 flex-1 font-semibold">{j.nombreLimpio}</span>
                  <span className="shrink-0 text-sm text-gris">
                    {ocupado === `vincular:${j.id}` ? 'Vinculando…' : 'Es él'}
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-gris" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-2 flex flex-col gap-2">
        <Boton variante="contorno" disabled={!libre} onClick={() => void rechazarPedido()}>
          {ocupado === 'rechazar' ? 'Rechazando…' : 'Rechazar'}
        </Boton>
        <Boton variante="contorno" disabled={!libre} onClick={alVolver}>Volver</Boton>
      </div>
    </>
  );
}
