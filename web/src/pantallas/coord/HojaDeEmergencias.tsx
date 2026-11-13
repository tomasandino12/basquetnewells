import { enlaceTelefono, etiquetasDeAlertas } from '@datos/emergencias.js';
import { linkCarpetaEnDrive } from '@datos/enlacesGoogle.js';
import { Boton, claseBoton } from '../../components/ui/button';
import { Consulta } from '../../components/ui/consulta';
import { Hoja } from '../../components/ui/sheet';
import { useEmergencias } from '../../coord/consultas';
import type { EmergenciaDeJugador } from '../../datos/repositorioCoord';
import { FILA_PLANA } from '../familias/piezas';

function Telefono({ texto }: { texto: string | null }) {
  if (!texto) return <span className="text-gris">sin cargar</span>;
  const tel = enlaceTelefono(texto) as string | null;
  return tel ? <a href={tel} className="font-semibold underline">{texto}</a> : <>{texto}</>;
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null }) {
  return valor ? <p className="text-sm"><b>{titulo}:</b> {valor}</p> : null;
}

/** Cada chico es una fila con fondo propio (sin borde); las alertas se dicen con texto en el rojo del club, no con pastillas. */
function Ficha({ e }: { e: EmergenciaDeJugador }) {
  if (!e.cargado) {
    return (
      <li className={FILA_PLANA}>
        <p className="font-semibold">{e.nombreLimpio}</p>
        <p className="text-sm text-gris">sin datos cargados</p>
      </li>
    );
  }
  const alertas = etiquetasDeAlertas(e.alertas) as string[];
  return (
    <li className={`${FILA_PLANA} flex flex-col gap-0.5`}>
      <p className="font-semibold">{e.nombreLimpio}</p>
      {alertas.length > 0 && (
        <p className="my-1 text-sm font-semibold text-club-texto">Alertas: {alertas.join(' · ')}</p>
      )}
      <p className="text-sm"><b>Adulto:</b> <Telefono texto={e.telefonoAdulto} /></p>
      <p className="text-sm"><b>Urgencia:</b> <Telefono texto={e.contactoUrgencia} /></p>
      <Dato titulo="Alergias" valor={e.alergias} />
      <Dato titulo="Medicación" valor={e.medicacion} />
      <Dato titulo="Indicación médica" valor={e.indicacion} />
      <Dato titulo="Obra social" valor={e.obraSocial} />
    </li>
  );
}

interface Props {
  plantel: { id: string; categoria?: string };
  /** Sólo ese chico (acceso rápido desde su ficha); sin esto, la categoría entera con los que tienen alertas primero. */
  jugadorId?: string;
  alCerrar: () => void;
}

/**
 * Datos de emergencia, sólo para leer. Es salud de menores: se piden a la base cada vez que se abre la
 * hoja, no se guardan (gcTime 0 en la consulta) y al cerrar se sueltan. Quién los puede ver lo decide la base.
 */
export function HojaDeEmergencias({ plantel, jugadorId, alCerrar }: Props) {
  const datos = useEmergencias(plantel.id);
  const titulo = jugadorId ? 'Datos de emergencia' : `Emergencias · ${plantel.categoria}`;
  return (
    <Hoja
      abierta
      alCambiar={(a) => !a && alCerrar()}
      titulo={titulo}
      descripcion={jugadorId ? 'Teléfonos y alertas médicas del chico, sólo para leer' : 'Teléfonos y alertas médicas de la categoría, sólo para leer'}
      etiquetaCerrar="Cerrar"
    >
      <div className="flex flex-col gap-3 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{titulo}</h2>
        <Consulta consulta={datos} errorGenerico="No se pudieron cargar los datos de emergencia.">
          {(todos) => {
            const lista = jugadorId
              ? todos.filter((e) => e.jugadorId === jugadorId)
              // Los que tienen alertas, primero.
              : [...todos].sort((a, b) => Number(b.alertas.length > 0) - Number(a.alertas.length > 0));
            const drive = jugadorId && lista[0] ? (linkCarpetaEnDrive(lista[0].nombreLimpio) as string | null) : null;
            return (
              <>
                {lista.length === 0 ? (
                  <p className="text-sm">{jugadorId ? 'No hay datos de este chico.' : 'No hay chicos en este plantel.'}</p>
                ) : (
                  <ul className="flex flex-col gap-2">{lista.map((e) => <Ficha key={e.jugadorId} e={e} />)}</ul>
                )}
                {drive && (
                  <>
                    <p className="text-sm text-gris">La ficha completa está en la carpeta del club en Google. Se abre sólo si tu cuenta tiene acceso.</p>
                    <a href={drive} target="_blank" rel="noopener noreferrer" className={claseBoton({ variante: 'contorno' })}>
                      Ver ficha completa en Google
                    </a>
                  </>
                )}
              </>
            );
          }}
        </Consulta>
        <p className="text-xs text-gris">Estos datos son sólo para cuidar al chico. No se guardan en tu celular: si cerrás esta pantalla, se vuelven a pedir.</p>
        <Boton variante="contorno" onClick={alCerrar}>Cerrar</Boton>
      </div>
    </Hoja>
  );
}
