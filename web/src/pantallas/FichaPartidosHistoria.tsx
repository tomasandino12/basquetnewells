import { textoDeMision } from '@datos/misiones.js';
import { Consulta } from '../components/ui/consulta';
import { useEnviosDelJugador, useHistorialDePartidos, type Porcentaje } from '../datos/consultasFicha';
import { HistoriaPorTemporada } from './FichaTemporadas';

const TITULO = 'mb-2 font-mono text-xs tracking-wide text-gris uppercase';
const SIN_DATO = <span className="text-gris">sin dato</span>;
const ESTADO_DE_MISION = { logrado: 'Logrado', en_proceso: 'En proceso', no_logrado: 'No logrado' } as const;

/** 'YYYY-MM-DD' → 'DD/MM', a mano: new Date('2026-05-01') es UTC y se corre un día. */
const fechaCorta = (iso: string) => {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
};

function Tiro({ etiqueta, p }: { etiqueta: string; p: Porcentaje | null }) {
  return (
    <div>
      {etiqueta}{' '}
      {p === null ? SIN_DATO : (
        <span className={p.muestraChica ? 'text-gris' : undefined}>
          {p.pct}% · {p.anotados}/{p.intentos}
          {p.muestraChica && <span className="ml-1 text-xs">(pocos datos)</span>}
        </span>
      )}
    </div>
  );
}

/** Pestaña PARTIDOS: lo que hizo el chico en cada partido cargado y las misiones que tuvo. */
export function PestanaPartidos({ clubId, plantelId, jugadorId }: { clubId: string; plantelId: string; jugadorId: string }) {
  const consulta = useHistorialDePartidos(clubId, plantelId, jugadorId);
  return (
    <Consulta consulta={consulta} errorGenerico="No pudimos cargar los partidos">
      {({ partidos, misiones }) => (
        <div className="flex flex-col gap-6">
          <section aria-label="Partido a partido">
            <h3 className={TITULO}>Partido a partido</h3>
            {partidos.length === 0 ? (
              <p className="text-sm text-gris">Todavía no jugó ningún partido cargado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {partidos.map((h) => (
                  <li key={h.partidoId} className="rounded-tarjeta border border-linea p-3 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{h.rivalNombre ?? 'Rival sin nombre'}</span>
                      <span className="font-mono text-xs text-gris">{fechaCorta(h.fecha)}</span>
                    </div>
                    <div className="cifra mt-1 flex gap-4">
                      <span>{h.minSegundos === null ? SIN_DATO : `${Math.round(h.minSegundos / 60)}′`}</span>
                      <span>{h.pts === null ? SIN_DATO : `${h.pts} pts`}</span>
                    </div>
                    <div className="cifra mt-1 grid gap-0.5">
                      <Tiro etiqueta="2P" p={h.dos} />
                      <Tiro etiqueta="3P" p={h.tres} />
                      <Tiro etiqueta="TL" p={h.libres} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {misiones !== null && (
            <section aria-label="Misiones">
              <h3 className={TITULO}>Misiones</h3>
              {misiones.length === 0 ? (
                <p className="text-sm text-gris">Todavía no tuvo misiones.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {misiones.map((m) => (
                    <li key={m.id} className="rounded-tarjeta border border-linea p-3 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{textoDeMision(m)}</span>
                        <span className="font-mono text-xs text-gris">{fechaCorta(m.fecha)}</span>
                      </div>
                      <div className="mt-1 text-xs text-gris">
                        {m.rival ? `vs ${m.rival} · ` : ''}
                        {m.estado ? ESTADO_DE_MISION[m.estado] : 'Sin evaluar'}
                      </div>
                      {m.comentario && <p className="mt-1">{m.comentario}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </Consulta>
  );
}

/** Sólo se enlaza lo que es una dirección web: el enlace lo escribió un profe. */
const enlaceSeguro = (e: string | null) => (e && /^https?:\/\//i.test(e) ? e : null);

/** Pestaña HISTORIA: los recursos que se le mandaron. Y el recorrido por temporadas. */
export function PestanaHistoria({ clubId, jugadorId }: { clubId: string; jugadorId: string }) {
  const consulta = useEnviosDelJugador(clubId, jugadorId);
  return (
    <div className="flex flex-col gap-6">
      <Consulta consulta={consulta} errorGenerico="No pudimos cargar los recursos enviados">
        {(envios) => (
          <section aria-label="Recursos enviados">
            <h3 className={TITULO}>Recursos enviados</h3>
            {envios.length === 0 ? (
              <p className="text-sm text-gris">Todavía no se le mandó ningún recurso.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {envios.map((e, i) => {
                  const enlace = enlaceSeguro(e.enlace);
                  const titulo = e.titulo ?? 'Recurso sin título';
                  return (
                    <li key={`${e.recursoId ?? 'x'}-${e.fecha}-${i}`} className="flex items-baseline justify-between gap-2 rounded-tarjeta border border-linea p-3 text-sm">
                      {enlace ? (
                        <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{titulo}</a>
                      ) : (
                        <span className="font-semibold">{titulo}</span>
                      )}
                      <span className="font-mono text-xs text-gris">{fechaCorta(e.fecha)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </Consulta>
      <HistoriaPorTemporada jugadorId={jugadorId} />
    </div>
  );
}
