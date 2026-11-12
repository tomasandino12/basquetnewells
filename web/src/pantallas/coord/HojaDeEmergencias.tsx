import { enlaceTelefono, etiquetasDeAlertas } from '@datos/emergencias.js';
import { Boton } from '../../components/ui/button';
import { Chip } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Hoja } from '../../components/ui/sheet';
import { useEmergencias } from '../../coord/consultas';
import type { PlantelDelClub } from '../../datos/repositorio';
import type { EmergenciaDeJugador } from '../../datos/repositorioCoord';

function Telefono({ texto }: { texto: string | null }) {
  if (!texto) return <span className="text-gris">sin cargar</span>;
  const tel = enlaceTelefono(texto) as string | null;
  return tel ? <a href={tel} className="font-semibold underline">{texto}</a> : <>{texto}</>;
}

function Dato({ titulo, valor }: { titulo: string; valor: string | null }) {
  return valor ? <p className="text-sm"><b>{titulo}:</b> {valor}</p> : null;
}

function Ficha({ e }: { e: EmergenciaDeJugador }) {
  if (!e.cargado) {
    return (
      <li className="rounded-tarjeta border border-linea bg-sup p-3">
        <p className="font-semibold">{e.nombreLimpio}</p>
        <Chip className="mt-1">sin datos cargados</Chip>
      </li>
    );
  }
  const alertas = etiquetasDeAlertas(e.alertas) as string[];
  return (
    <li className="flex flex-col gap-0.5 rounded-tarjeta border border-linea bg-sup p-3">
      <p className="font-semibold">{e.nombreLimpio}</p>
      {alertas.length > 0 && (
        <div className="my-1 flex flex-wrap gap-1.5">
          {alertas.map((a) => <Chip key={a} className="bg-club-cl text-club-texto">{a}</Chip>)}
        </div>
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

/**
 * Datos de emergencia de una categoría, sólo para leer. Es salud de menores: se piden a la base cada
 * vez que se abre la hoja, no se guardan (gcTime 0 en la consulta) y al cerrar se sueltan.
 */
export function HojaDeEmergencias({ plantel, alCerrar }: { plantel: PlantelDelClub; alCerrar: () => void }) {
  const datos = useEmergencias(plantel.id);
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={`Emergencias · ${plantel.categoria}`} descripcion="Teléfonos y alertas médicas de la categoría, sólo para leer" etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-3 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">Emergencias · {plantel.categoria}</h2>
        <Consulta consulta={datos} errorGenerico="No se pudieron cargar los datos de emergencia.">
          {(lista) => {
            // Los que tienen alertas, primero.
            const ordenada = [...lista].sort((a, b) => Number(b.alertas.length > 0) - Number(a.alertas.length > 0));
            return ordenada.length === 0 ? (
              <p className="text-sm">No hay chicos en este plantel.</p>
            ) : (
              <ul className="flex flex-col gap-2">{ordenada.map((e) => <Ficha key={e.jugadorId} e={e} />)}</ul>
            );
          }}
        </Consulta>
        <p className="text-xs text-gris">Estos datos son sólo para cuidar al chico. No se guardan en tu celular: si cerrás esta pantalla, se vuelven a pedir.</p>
        <Boton variante="contorno" onClick={alCerrar}>Cerrar</Boton>
      </div>
    </Hoja>
  );
}
