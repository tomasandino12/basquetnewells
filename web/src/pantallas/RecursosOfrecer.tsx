import { useId, useState } from 'react';
import { Link } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { esEnlaceWeb, MENSAJE_ENLACE_NO_WEB } from '@datos/enlaces.js';
import { LIMITE } from '@datos/limites.js';
import { RANGO_FRECUENCIA, RANGO_MINUTOS, TIPOS_RECURSO, validarMetadatos } from '@datos/recursos.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { ChipBoton } from '../components/ui/chip';
import { Hoja } from '../components/ui/sheet';
import { Confirmar } from '../coord/piezas';
import { useBorrarRecurso, useGuardarRecurso } from '../datos/consultasRecursos';
import { BotonConAvion } from '../interacciones/EnviarRecurso';
import { useDuracion } from '../interacciones/piezas';
import { mensajeDeGuardado } from '../datos/errores';
import type { JugadorDelPlantel, RecursoDelClub } from '../datos/repositorio';

// Ofrecer un recurso, enviarlo a los que faltan y borrarlo. La garantía de «sólo lo propio» al borrar es la
// policy de la base (0042): el botón se muestra sólo en lo propio por comodidad.

const textoDeEnvios = (n: number) => `Enviado a ${n} jugador${n === 1 ? '' : 'es'}`;

type Metadatos = { valor?: { tipo: string | null; frecuenciaSemanal: number | null; minutos: number | null }; error?: string };

/** Lo que se ve el botón en «Enviado» antes de que se cierre la hoja. */
const ENVIADO_VISIBLE_MS = 700;

/**
 * La hoja de «Ofrecer un recurso» (sin `recurso`) o «Enviar a los que faltan» (con `recurso`: sólo se elige a
 * quién, los datos ya están). `jugadores` son los que se pueden elegir: todo el plantel en uno nuevo, los que
 * todavía no lo recibieron al reenviar (`yaLoTienen` es cuántos quedaron afuera, para decirlo).
 */
export function HojaDeEnvio({ abierta, alCambiar, clubId, categoria, jugadores, recurso, yaLoTienen = 0, alEnviar }: {
  abierta: boolean;
  alCambiar: (a: boolean) => void;
  clubId: string;
  categoria: string;
  jugadores: JugadorDelPlantel[];
  recurso?: RecursoDelClub;
  yaLoTienen?: number;
  alEnviar: (aviso: string) => void;
}) {
  const titulo = recurso ? 'Enviar a los que faltan' : 'Ofrecer un recurso';
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo={titulo} descripcion="Elegí a quién mandárselo: queda registrado qué se mandó y cuándo." etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{titulo}</h2>
        {jugadores.length === 0 ? (
          <>
            <p className="text-base">
              Para enviar un recurso hace falta elegir a quién mandárselo, y este plantel ({categoria}) todavía no tiene jugadores cargados.
            </p>
            <Link to="/plantel" className="inline-flex min-h-11 items-center justify-center rounded-btn bg-lima px-5 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-lima uppercase">
              Ir a Plantel
            </Link>
          </>
        ) : (
          // Se monta con la hoja abierta: el id del recurso nuevo es uno por formulario abierto, no por toque.
          <FormularioDeEnvio
            clubId={clubId}
            categoria={categoria}
            jugadores={jugadores}
            recurso={recurso}
            yaLoTienen={yaLoTienen}
            alTerminar={(aviso) => {
              alCambiar(false);
              alEnviar(aviso);
            }}
          />
        )}
      </div>
    </Hoja>
  );
}

function FormularioDeEnvio({ clubId, categoria, jugadores, recurso, yaLoTienen, alTerminar }: {
  clubId: string;
  categoria: string;
  jugadores: JugadorDelPlantel[];
  recurso?: RecursoDelClub;
  yaLoTienen: number;
  alTerminar: (aviso: string) => void;
}) {
  const guardar = useGuardarRecurso();
  // Si falla por la red y el profe reintenta sin cerrar la hoja, guardar_recurso (0038) ve el mismo id y no duplica.
  const [recursoIdNuevo] = useState(() => crypto.randomUUID());
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enlace, setEnlace] = useState('');
  const [tipo, setTipo] = useState<string | null>(null);
  const [frecuencia, setFrecuencia] = useState('');
  const [minutos, setMinutos] = useState('');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const dur = useDuracion();
  const idDescripcion = useId();
  const esNuevo = !recurso;

  const alternar = (id: string) =>
    setElegidos((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(id)) nuevo.add(id);
      return nuevo;
    });

  const enviar = async () => {
    if (guardar.isPending || enviado) return;
    const link = enlace.trim();
    const metadatos: Metadatos = esNuevo
      ? (validarMetadatos({ tipo: tipo ?? undefined, frecuenciaSemanal: frecuencia, minutos }) as Metadatos)
      : { valor: undefined };
    if (esNuevo && (!titulo.trim() || !descripcion.trim())) return setError('Poné un título y las instrucciones.');
    // El enlace va recortado y se rechaza todo lo que no sea http(s): un «javascript:…» no puede llegar a un href.
    if (esNuevo && link && !esEnlaceWeb(link)) return setError(MENSAJE_ENLACE_NO_WEB as string);
    if (metadatos.error) return setError(metadatos.error);
    if (elegidos.size === 0) return setError('Elegí al menos un jugador.');
    setError(null);
    try {
      await guardar.mutateAsync({
        clubId,
        recursoId: recurso?.id ?? null,
        recursoIdNuevo: recurso ? null : recursoIdNuevo,
        titulo: esNuevo ? titulo.trim() : null,
        descripcion: esNuevo ? descripcion.trim() : null,
        enlace: esNuevo ? link || null : null,
        ...metadatos.valor,
        fecha: hoyLocal() as string,
        jugadorIds: [...elegidos],
      });
    } catch (e) {
      return setError(mensajeDeGuardado(e, 'No se pudo registrar el envío.'));
    }
    // El avión despega y el botón queda en «Enviado» un momento: recién ahí se cierra la hoja.
    setEnviado(true);
    setTimeout(() => alTerminar(textoDeEnvios(elegidos.size)), dur(ENVIADO_VISIBLE_MS));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {esNuevo && (
        <>
          <Campo etiqueta="Título" value={titulo} maxLength={LIMITE.titulo} autoComplete="off" onChange={(e) => setTitulo(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label htmlFor={idDescripcion} className="text-sm font-semibold">Instrucciones</label>
            <textarea
              id={idDescripcion}
              rows={3}
              maxLength={LIMITE.descripcion}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-campo border border-borde-control bg-sup px-3 py-2 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
            />
          </div>
          <Campo etiqueta="Link (opcional)" type="url" inputMode="url" placeholder="https://" autoComplete="off" value={enlace} maxLength={LIMITE.enlace} onChange={(e) => setEnlace(e.target.value)} />
          {/* Un solo tipo a la vez; tocar el elegido lo saca (el tipo es opcional). */}
          <div role="group" aria-label="Tipo (opcional)" className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Tipo (opcional)</span>
            <div className="flex flex-wrap gap-x-1">
              {(TIPOS_RECURSO as { clave: string; etiqueta: string }[]).map((t) => (
                <ChipBoton key={t.clave} activo={tipo === t.clave} onClick={() => setTipo(tipo === t.clave ? null : t.clave)}>{t.etiqueta}</ChipBoton>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Veces por semana (opcional)" inputMode="numeric" maxLength={1} autoComplete="off" placeholder={`${RANGO_FRECUENCIA.min} a ${RANGO_FRECUENCIA.max}`} value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} />
            <Campo etiqueta="Minutos (opcional)" inputMode="numeric" maxLength={3} autoComplete="off" placeholder={`${RANGO_MINUTOS.min} a ${RANGO_MINUTOS.max}`} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
          </div>
        </>
      )}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-semibold">A quién · {categoria}</legend>
          <Boton type="button" variante="contorno" tamano="chico" onClick={() => setElegidos(new Set(jugadores.map((j) => j.id)))}>
            {esNuevo ? 'Todo el plantel' : 'Todos los que faltan'}
          </Boton>
        </div>
        {yaLoTienen > 0 && (
          <p className="text-sm text-gris">
            {yaLoTienen === 1 ? 'Ya lo recibió 1 jugador' : `Ya lo recibieron ${yaLoTienen} jugadores`}: no aparece{yaLoTienen === 1 ? '' : 'n'} en la lista.
          </p>
        )}
        <ul className="flex flex-col">
          {jugadores.map((j) => (
            <li key={j.id}>
              <label className="flex min-h-11 items-center gap-3 text-base">
                <input type="checkbox" className="size-5 accent-club" checked={elegidos.has(j.id)} onChange={() => alternar(j.id)} />
                <span>{j.nombreLimpio}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {error && <Aviso tono="error" titulo={error} />}
      <BotonConAvion
        type="submit"
        estado={enviado ? 'enviado' : guardar.isPending ? 'enviando' : 'reposo'}
        textos={{ reposo: 'Registrar el envío', enviando: 'Registrando…', enviado: 'Enviado' }}
        className="self-start"
      />
    </form>
  );
}

/** Es para siempre: se lleva puesto a quién se le mandó y quién lo abrió. */
export function BorrarRecurso({ abierta, alCerrar, clubId, recurso }: { abierta: boolean; alCerrar: () => void; clubId: string; recurso: RecursoDelClub }) {
  const borrar = useBorrarRecurso(clubId);
  return (
    <Confirmar
      abierta={abierta}
      alCerrar={alCerrar}
      titulo="Borrar este recurso"
      texto="Es para siempre: los jugadores a los que se lo mandaste dejan de verlo, y se pierde el registro de a quién se le mandó y quién lo abrió."
      verbo="Borrar de todos modos"
      alConfirmar={async () => {
        await borrar.mutateAsync(recurso.id);
      }}
      mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo borrar el recurso.', [[/NO_ES_TUYO/, 'Este recurso ya no es tuyo: no se puede borrar.']])}
    />
  );
}
