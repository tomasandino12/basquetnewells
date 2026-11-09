import { Users } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { useDatosDelPlantel } from '../datos/consultas';
import { armarFilas } from '../plantel/filas';
import { FichaDelJugador } from './FichaDelJugador';
import { ConDatosDeEjemplo } from './PlantelEjemplo';
import { ConCategoria, MarcoDelPlantel, VolverAlPlantel } from './PlantelDelClub';

/** La ficha de un chico en su propia pantalla: /plantel/tobias-funes. */
export function PantallaDeFicha() {
  return (
    <MarcoDelPlantel>
      <ConCategoria>{(activo) => <ContenidoDeFicha key={activo.plantelId} clubId={activo.clubId} plantelId={activo.plantelId} />}</ConCategoria>
    </MarcoDelPlantel>
  );
}

/** La misma ficha con los chicos inventados de la maqueta. */
export function FichaEjemplo() {
  return (
    <ConDatosDeEjemplo>
      <MarcoDelPlantel>
        <ContenidoDeFicha clubId="demo" plantelId="demo" base="/maqueta/plantel" />
      </MarcoDelPlantel>
    </ConDatosDeEjemplo>
  );
}

function ContenidoDeFicha({ clubId, plantelId, base = '/plantel' }: { clubId: string; plantelId: string; base?: string }) {
  const { jugador } = useParams();
  const hoy = hoyLocal() as string;
  const datos = useDatosDelPlantel(clubId, plantelId, hoy);
  const navegar = useNavigate();
  const filas = useMemo(() => (datos.data ? armarFilas({ ...datos.data, hoy }) : undefined), [datos.data, hoy]);
  const fila = filas?.find((f) => f.slug === jugador);

  return (
    <>
      <VolverAlPlantel a={base} />
      <Consulta consulta={datos} errorGenerico="No pudimos cargar la ficha">
        {() =>
          fila ? (
            <div className="overflow-hidden rounded-tarjeta border border-linea shadow-tarjeta">
              <FichaDelJugador key={fila.id} fila={fila} clubId={clubId} plantelId={plantelId} hoy={hoy} alSacar={() => navegar(base)} />
            </div>
          ) : (
            <Vacio icono={Users} titulo="No encontramos a ese jugador">
              No está en esta categoría. Volvé al plantel y elegilo de la lista.
            </Vacio>
          )
        }
      </Consulta>
    </>
  );
}
