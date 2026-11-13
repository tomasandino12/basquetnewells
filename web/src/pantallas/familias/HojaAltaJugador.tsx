import { useState, type FormEvent } from 'react';
import { hoyLocal } from '@datos/antropometria.js';
import { clavearNombre, limpiarNombre } from '@datos/claveNombre.js';
import { LIMITE } from '@datos/limites.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Hoja } from '../../components/ui/sheet';
import { esSinConexion, mensajeDeGuardado } from '../../datos/errores';
import type { JugadorDelClub } from '../../datos/repositorio';
import { useAccion, useRepositorio } from '../../familias/consultas';
import { TituloDeHoja } from './piezas';

interface Props {
  clubId: string;
  plantel: { id: string; categoria: string; temporadaId: string | null };
  alCerrar: () => void;
  /** Lo que la pantalla dice arriba cuando se agregó a alguien. */
  alAgregar: (texto: string) => void;
}

/**
 * Agregar un jugador a mano. Antes de crearlo se mira todo el club: si ya existe (el chico de Sub 17
 * citado a Sub 21, por ejemplo) se ofrece sumarlo a esta categoría en vez de duplicarlo. La base igual
 * lo bloquea con JUGADOR_YA_EXISTE: esto es sólo para dar el mensaje bueno.
 */
export function HojaAltaJugador({ clubId, plantel, alCerrar, alAgregar }: Props) {
  const cargar = useRepositorio();
  const alta = useAccion((repo, v: { nombreClave: string; nombreLimpio: string }) =>
    repo.altaJugadorManual({ clubId, plantelId: plantel.id, temporadaId: plantel.temporadaId, desde: hoyLocal() as string, ...v }),
  );
  const sumar = useAccion((repo, jugadorId: string) =>
    repo.crearPertenencia({ clubId, jugadorId, plantelId: plantel.id, temporadaId: plantel.temporadaId, desde: hoyLocal() as string }),
  );
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState<{ tono: 'error' | 'ok'; texto: string } | null>(null);
  const [aSumar, setASumar] = useState<JugadorDelClub | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function agregar(e: FormEvent) {
    e.preventDefault();
    // Un solo guardia para el clic y para Enter: son dos entradas al mismo flujo y no tiene que salir dos veces.
    if (ocupado) return;
    const nombreLimpio = limpiarNombre(nombre) as string;
    const nombreClave = clavearNombre(nombreLimpio) as string;
    if (!nombreClave) return setAviso({ tono: 'error', texto: 'Escribí un nombre.' });
    setOcupado(true);
    setAviso(null);
    try {
      let existentes: JugadorDelClub[];
      try {
        existentes = await (await cargar()).obtenerJugadoresDelClub(clubId);
      } catch (err) {
        setAviso({ tono: 'error', texto: esSinConexion(err) ? 'Sin conexión. Revisá tu wifi o tus datos.' : 'No se pudo verificar si el jugador ya existe.' });
        return;
      }
      const yaExiste = existentes.find((j) => j.nombreClave === nombreClave);
      if (yaExiste) {
        if (yaExiste.plantelesActuales.includes(plantel.id)) {
          setAviso({ tono: 'ok', texto: `${yaExiste.nombreLimpio} ya está en ${plantel.categoria}.` });
        } else {
          setASumar(yaExiste);
        }
        return;
      }
      try {
        await alta.mutateAsync({ nombreClave, nombreLimpio });
      } catch (err) {
        setAviso({
          tono: 'error',
          texto: (err as { message?: string } | null)?.message === 'JUGADOR_YA_EXISTE'
            ? 'Ese nombre ya existe en el club. Cerrá y volvé a abrir para ver la opción de sumarlo a esta categoría.'
            : mensajeDeGuardado(err, 'No se pudo agregar el jugador.'),
        });
        return;
      }
      alAgregar(`${nombreLimpio} agregado a ${plantel.categoria}`);
      alCerrar();
    } finally {
      setOcupado(false);
    }
  }

  async function sumarloAEstaCategoria(j: JugadorDelClub) {
    if (ocupado) return;
    setOcupado(true);
    setAviso(null);
    try {
      await sumar.mutateAsync(j.id);
    } catch (err) {
      setAviso({ tono: 'error', texto: mensajeDeGuardado(err, 'No se pudo sumar a la categoría.') });
      setOcupado(false);
      return;
    }
    alAgregar(`${j.nombreLimpio} sumado a ${plantel.categoria}`);
    alCerrar();
  }

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="Agregar jugador" descripcion={`Agregar un jugador a ${plantel.categoria}`} etiquetaCerrar="Cerrar">
      <form onSubmit={(e) => void agregar(e)} className="flex flex-col gap-4 p-5 pt-12">
        <TituloDeHoja>Agregar jugador</TituloDeHoja>
        {aSumar ? (
          <>
            <Aviso tono="ok" titulo={`${aSumar.nombreLimpio} ya está cargado en el club, en otra categoría.`}>
              Se lo suma también a {plantel.categoria}, sin crear un perfil nuevo.
            </Aviso>
            {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}
            <Boton disabled={ocupado} onClick={() => void sumarloAEstaCategoria(aSumar)}>
              {ocupado ? 'Sumando…' : `Sumarlo a ${plantel.categoria}`}
            </Boton>
            <Boton variante="contorno" disabled={ocupado} onClick={() => { setASumar(null); setAviso(null); }}>Volver</Boton>
          </>
        ) : (
          <>
            <Campo
              etiqueta="Nombre"
              ayuda="Como en la CABB: Apellido, Nombre. El orden importa para que un import futuro lo reconozca en vez de duplicarlo."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={LIMITE.nombrePersona}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            {aviso && <Aviso tono={aviso.tono} titulo={aviso.texto} />}
            <Boton type="submit" disabled={ocupado}>
              {ocupado ? 'Agregando…' : `Agregar a ${plantel.categoria}`}
            </Boton>
          </>
        )}
      </form>
    </Hoja>
  );
}
