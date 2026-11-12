import { BookOpen, ExternalLink, Eye } from 'lucide-react';
import { esEnlaceWeb } from '@datos/enlaces.js';
import { idDeYoutube } from '@datos/youtube.js';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { useAnotarApertura, useMisRecursos } from '../../datos/consultasJugador';
import type { RecursoDelJugador } from '../../datos/repositorio';
import { enlaceBoton } from '../../fisico/estilos';
import { VideoDeEjercicio } from '../../fisico/VideoDeEjercicio';
import { fechaCorta } from '../../fisico/plan';

/**
 * Lo que le mandó el profe, sin nada más: ni cuántos otros lo recibieron ni si lo miró. El jugador ve la lista,
 * no un tablero de seguimiento. Abrir un recurso se anota y el profe ve sólo cuántos abrieron, nunca quién:
 * por eso el aviso de arriba de la lista.
 */
export function JugadorRecursos() {
  const recursos = useMisRecursos();
  return (
    <>
      <header>
        <h1 className="font-titulo text-4xl leading-none font-semibold">Lo que te mandó tu profe</h1>
      </header>
      <div className="mt-5">
        <Consulta consulta={recursos} errorGenerico="No se pudieron cargar tus recursos">
          {(lista) =>
            lista.length === 0 ? (
              <Vacio icono={BookOpen} titulo="Todavía no te mandaron ningún recurso">
                Cuando tu profe te mande algo para mirar (un video, una rutina, un consejo), va a aparecer acá.
              </Vacio>
            ) : (
              <>
                <p className="text-sm">
                  Mirá lo que quieras, cuando quieras. <strong>No es obligación.</strong>
                </p>
                <p className="mb-4 flex items-center gap-1.5 text-sm text-gris">
                  <Eye aria-hidden className="size-4 shrink-0" />
                  Tu profe ve cuántos abrieron cada recurso, no quién.
                </p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {lista.map((r) => (
                    <TarjetaDeRecurso key={r.id} recurso={r} />
                  ))}
                </ul>
              </>
            )
          }
        </Consulta>
      </div>
    </>
  );
}

function TarjetaDeRecurso({ recurso }: { recurso: RecursoDelJugador }) {
  const anotar = useAnotarApertura();
  const alAbrir = () => anotar(recurso.id);
  const enlace = recurso.enlace;
  const esVideo = enlace != null && (idDeYoutube(enlace) as string | null) != null;
  const esLink = enlace != null && !esVideo && (esEnlaceWeb(enlace) as boolean);
  return (
    <li className="flex flex-col gap-1 rounded-tarjeta border border-linea bg-sup px-4 py-3">
      <span className="font-mono text-[0.6875rem] tracking-wide text-gris uppercase">Enviado el {fechaCorta(recurso.fecha)}</span>
      <span className="font-titulo text-xl leading-tight font-semibold break-words">{recurso.titulo}</span>
      {recurso.descripcion && <span className="text-sm text-gris break-words">{recurso.descripcion}</span>}
      {(esVideo || esLink) && (
        <span className="mt-2 flex">
          {esVideo && <VideoDeEjercicio link={enlace!} titulo={recurso.titulo} alAbrir={alAbrir} />}
          {esLink && (
            <a href={enlace!} target="_blank" rel="noopener noreferrer" onClick={alAbrir} className={`${enlaceBoton} gap-2 px-3 text-sm`}>
              <ExternalLink aria-hidden className="size-4" />
              Abrir el material
            </a>
          )}
        </span>
      )}
    </li>
  );
}
