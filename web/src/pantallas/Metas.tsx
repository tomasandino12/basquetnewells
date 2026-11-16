import { useState } from 'react';
import { useNavigate } from 'react-router';
import { zonasDeSesion } from '@datos/estadisticas.js';
import { metaDeZona, validarMeta } from '@datos/objetivosClub.js';
import { POSICIONES_BATERIA } from '@datos/posiciones.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Consulta } from '../components/ui/consulta';
import { useGuardarMetas, useMetasDeLaCategoria } from '../datos/consultasInventario';
import { mensajeDeGuardado } from '../datos/errores';
import type { MedicionTiro, MetasDeZona, SesionMedicion } from '../datos/repositorio';
import { usePlantelId } from '../plantel/activo';
import { ConPlantel } from './ConPlantel';

interface Zona {
  id: string;
  nombre: string;
}
interface Valor {
  pct: number;
  anotados: number;
  intentos: number;
  muestraChica?: boolean;
}

/**
 * Las metas del cuerpo técnico, una por zona del arco. Sin sugerencias: la app no propone ningún
 * número (sería inventar una norma). Al lado de cada campo muestra el porcentaje ACTUAL de la zona,
 * para fijar la meta mirando de dónde se parte. Campo vacío = sacar la meta (no es 0 %).
 */
export function Metas() {
  const plantelId = usePlantelId();
  return (
    <ConPlantel
      plantelId={plantelId}
      volver={{ a: '/hoy', texto: 'Hoy' }}
      soloCuerpoTecnico="Las metas las fija el cuerpo técnico de cada categoría."
    >
      {(p) => <EditorDeMetas {...p} />}
    </ConPlantel>
  );
}

/** La última batería de tiro, de la más nueva a la más vieja; sin ninguna, todas las zonas quedan «sin medir». */
export function valoresActuales(sesiones: SesionMedicion[], mediciones: MedicionTiro[]): Record<string, Valor> {
  const ultima = sesiones.filter((s) => s.tipo === 'tiro').sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return ultima ? (zonasDeSesion(mediciones, ultima.id).porZona as Record<string, Valor>) : {};
}

function EditorDeMetas({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const consulta = useMetasDeLaCategoria(clubId, plantelId);
  return (
    <div className="pt-2">
      <h1 className="font-titulo text-3xl leading-none font-semibold uppercase">Metas de {categoria}</h1>
      <p className="mt-2 mb-5 text-sm text-gris">
        Las fija el cuerpo técnico, no la app. Son de esta categoría y esta temporada. Dejá el campo vacío para sacar una meta.
      </p>
      <Consulta consulta={consulta} errorGenerico="No se pudieron cargar las metas.">
        {({ metas, sesiones, mediciones }) => (
          <Formulario clubId={clubId} plantelId={plantelId} metas={metas} actual={valoresActuales(sesiones, mediciones)} />
        )}
      </Consulta>
    </div>
  );
}

function Formulario({ clubId, plantelId, metas, actual }: { clubId: string; plantelId: string; metas: MetasDeZona; actual: Record<string, Valor> }) {
  const zonas = POSICIONES_BATERIA as Zona[];
  const navegar = useNavigate();
  const guardar = useGuardarMetas(clubId, plantelId);
  const [texto, setTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(zonas.map((z) => [z.id, metaDeZona(z.id, metas) == null ? '' : String(metaDeZona(z.id, metas))])),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);

  const enviar = () => {
    const nuevos: Record<string, string> = {};
    const payload: { zona: string; objetivoPct: number | null }[] = [];
    for (const z of zonas) {
      const r = validarMeta(texto[z.id]) as { ok: boolean; valor: number | null; error: string | null };
      if (!r.ok) nuevos[z.id] = r.error ?? 'Revisá el número.';
      else payload.push({ zona: z.id, objetivoPct: r.valor });
    }
    setErrores(nuevos);
    setFallo(null);
    if (Object.keys(nuevos).length) return;
    guardar.mutate(payload, {
      onSuccess: () => navegar('/hoy'),
      onError: (e) => setFallo(mensajeDeGuardado(e, 'No se pudieron guardar las metas.')),
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      noValidate
    >
      <ul aria-label="Metas por zona" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {zonas.map((z) => {
          const valor = actual[z.id];
          const idCampo = `meta-${z.id}`;
          return (
            <li key={z.id} className="flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup p-4">
              <div className="min-w-0">
                <p className="font-semibold">{z.nombre}</p>
                <p className="text-sm text-gris">
                  Hoy: {valor ? `${valor.pct}% · ${valor.anotados}/${valor.intentos}${valor.muestraChica ? ' · pocos datos' : ''}` : 'sin medir'}
                </p>
                {errores[z.id] && <p className="text-sm font-medium text-club-texto">{errores[z.id]}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label htmlFor={idCampo} className="sr-only">
                  Meta de {z.nombre} en porcentaje
                </label>
                <input
                  id={idCampo}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="—"
                  value={texto[z.id]}
                  aria-invalid={errores[z.id] ? true : undefined}
                  onChange={(e) => setTexto({ ...texto, [z.id]: e.target.value })}
                  className="h-11 w-20 rounded-campo border border-borde-control bg-sup px-3 text-right text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
                />
                <span aria-hidden className="text-gris">%</span>
              </div>
            </li>
          );
        })}
      </ul>
      {fallo && (
        <div className="mt-4">
          <Aviso tono="error" titulo={fallo} />
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Boton type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar las metas'}
        </Boton>
        <Boton type="button" variante="contorno" onClick={() => navegar('/hoy')}>Cancelar</Boton>
      </div>
    </form>
  );
}
