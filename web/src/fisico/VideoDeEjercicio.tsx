import { Play } from 'lucide-react';
import { useState } from 'react';
import { esEnlaceWeb } from '@datos/enlaces.js';
import { idDeYoutube, urlDeReproductor } from '@datos/youtube.js';
import { Hoja } from '../components/ui/sheet';
import { enlaceBoton } from './estilos';

/**
 * «Ver video» de un ejercicio: si es de YouTube se ve embebido en una hoja (una página de YouTube por
 * tarjeta traba un celular, por eso recién al tocar); cualquier otro link web se abre aparte; lo que
 * no es un link web no muestra nada. Es un control propio: tocarlo no abre los escalones.
 */
export function VideoDeEjercicio({ link, titulo, alAbrir }: { link: string; titulo: string; alAbrir?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const id = idDeYoutube(link) as string | null;

  if (id) {
    return (
      <>
        <button type="button" onClick={() => { alAbrir?.(); setAbierto(true); }} className={`${enlaceBoton} min-h-11 gap-2 px-3 text-sm`}>
          <Play aria-hidden className="size-4" />
          Ver video
        </button>
        <Hoja abierta={abierto} alCambiar={setAbierto} titulo={titulo} descripcion="Video del ejercicio." etiquetaCerrar="Cerrar el video">
          <div className="flex flex-col gap-3 p-5 pt-12">
            <h2 className="font-titulo text-2xl font-semibold">{titulo}</h2>
            {abierto && (
              <div className="aspect-video w-full overflow-hidden rounded-tarjeta bg-sup-2">
                <iframe
                  src={urlDeReproductor(link, { autoplay: true }) as string}
                  title={`Video: ${titulo}`}
                  loading="lazy"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="size-full"
                />
              </div>
            )}
            {/* El link se arma con el ID ya validado, nunca con el texto guardado. */}
            <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline">
              Abrir en YouTube
            </a>
          </div>
        </Hoja>
      </>
    );
  }
  if (esEnlaceWeb(link)) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" onClick={alAbrir} className={`${enlaceBoton} gap-2 px-3 text-sm`}>
        <Play aria-hidden className="size-4" />
        Ver video
      </a>
    );
  }
  return null;
}
