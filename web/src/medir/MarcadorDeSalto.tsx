import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fpsDeCaptura } from '@datos/metadatosVideo.js';
import { cuadroEnTiempo, tablaDeCuadros } from '@datos/tablaCuadros.js';
import { alturaDeSalto, fpsParaMedir, pareceSinCamaraLenta, tiempoDeVuelo, validarTiempoDeVuelo } from '@datos/salto.js';
import { Boton } from '../components/ui/button';
import { Pasos, PROTOCOLOS } from './protocolos';

// El moov (y el átomo con los fps) de un mp4/mov está al principio o al final del archivo.
const BYTES_EXTREMO = 4 * 1024 * 1024;
const ESPERA_SEEK_MS = 1500;
const ESPERA_CARGA_MS = 10000;

export interface Intento {
  tiempoVueloMs: number;
  fpsCaptura: number;
}

interface Tabla {
  tiempos: number[];
  intervaloS: number;
}

async function extremos<T>(archivo: File, leer: (b: Uint8Array) => T | null): Promise<T | null> {
  const cabeza = leer(new Uint8Array(await archivo.slice(0, BYTES_EXTREMO).arrayBuffer()));
  if (cabeza) return cabeza;
  if (archivo.size <= BYTES_EXTREMO) return null;
  return leer(new Uint8Array(await archivo.slice(archivo.size - BYTES_EXTREMO).arrayBuffer()));
}

export type Preparado =
  | { tipo: 'medir'; tabla: Tabla; fps: number }
  | { tipo: 'rechazo'; fpsDelArchivo: number }
  | { tipo: 'ilegible' };

/** Lee la tabla de cuadros y los fps del archivo: si no se puede saber cuánto se estiró, no se mide. */
export async function prepararVideo(archivo: File): Promise<Preparado> {
  let tabla: Tabla | null = null;
  let fpsMetadatos: number | null = null;
  try {
    tabla = (await extremos(archivo, (b) => tablaDeCuadros(b) as Tabla | null)) ?? null;
    fpsMetadatos = (await extremos(archivo, (b) => fpsDeCaptura(b) as number | null)) ?? null;
  } catch {
    tabla = null;
  }
  if (!tabla || tabla.tiempos.length < 2) return { tipo: 'ilegible' };
  const medida = fpsParaMedir({ fpsMetadatos, intervaloS: tabla.intervaloS }) as { fps: number } | null;
  if (!medida) return { tipo: 'rechazo', fpsDelArchivo: Math.round(1 / tabla.intervaloS) };
  return { tipo: 'medir', tabla, fps: medida.fps };
}

const coma = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

/** Pantalla completa encima de todo, como la de la app de siempre. */
function Capa({ etiqueta, alCerrar, children }: { etiqueta: string; alCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [alCerrar]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={etiqueta} className="fixed inset-0 z-50 overflow-y-auto bg-fondo text-tinta">
      <div className="relative mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-4 py-5">
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-full text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
          <X aria-hidden className="size-5" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** El motivo por el que el video no sirve (o no se pudo leer). */
export function RechazoDeVideo({ preparado, alCerrar }: { preparado: Exclude<Preparado, { tipo: 'medir' }>; alCerrar: () => void }) {
  return (
    <Capa etiqueta="Este video no se puede medir" alCerrar={alCerrar}>
      <div role="alert" className="mt-12 flex flex-col gap-3">
        {preparado.tipo === 'ilegible' ? (
          <p><b>No puedo leer los cuadros de este video.</b> Grabalo con la app de Cámara, sin editarlo.</p>
        ) : (
          <>
            <p>
              <b>Este video no se puede medir.</b> Está a {preparado.fpsDelArchivo} cuadros por segundo y no trae la velocidad a la que se grabó:
              eso se pierde cuando el video pasa por WhatsApp, Quick Share o la compu. Sin ese dato la altura sería un número inventado, así que la app no la calcula.
            </p>
            <p>Elegí el video original, tal cual salió de la cámara en modo «Cámara lenta», desde la galería del mismo celular con que se grabó.</p>
          </>
        )}
        <Boton className="self-start" onClick={alCerrar}>Entendido</Boton>
      </div>
    </Capa>
  );
}

/**
 * Marca despegue y aterrizaje en un video y devuelve el tiempo de vuelo. El video no se sube ni se
 * guarda: vive como objectURL mientras el marcador está abierto. Se mueve por índice de cuadro con la
 * tabla del archivo (en la cámara lenta del S24 FE el primer cuadro dura 1,17 s y un seek dentro del
 * mismo cuadro no avisa nunca); el video queda siempre en pausa y sin controles nativos.
 */
export function MarcadorDeSalto({ archivo, tabla, fps, alTerminar }: { archivo: File; tabla: Tabla; fps: number; alTerminar: (r: Intento | null) => void }) {
  const { tiempos, intervaloS } = tabla;
  const ultimo = tiempos.length - 1;
  const url = useMemo(() => URL.createObjectURL(archivo), [archivo]);
  const video = useRef<HTMLVideoElement>(null);
  const [actual, setActual] = useState(0);
  const [despegue, setDespegue] = useState<number | null>(null);
  const [aterrizaje, setAterrizaje] = useState<number | null>(null);
  const [avisoVideo, setAvisoVideo] = useState<string | null>(null);
  const yendo = useRef(false);
  const pendiente = useRef<number | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // A mitad del cuadro, no en su borde: en el borde el navegador puede redondear al cuadro vecino.
  const instanteDe = (i: number) => tiempos[i] + ((tiempos[i + 1] ?? tiempos[i] + intervaloS) - tiempos[i]) / 2;

  const irA = (i: number) => {
    const destino = Math.min(ultimo, Math.max(0, i));
    setActual(destino);
    const v = video.current;
    if (!v) return;
    if (yendo.current) {
      pendiente.current = destino;
      return;
    }
    yendo.current = true;
    let listo = false;
    const terminar = () => {
      if (listo) return;
      listo = true;
      v.removeEventListener('seeked', terminar);
      yendo.current = false;
      if (pendiente.current != null) {
        const p = pendiente.current;
        pendiente.current = null;
        irA(p);
      }
    };
    v.addEventListener('seeked', terminar);
    // Si el seek cae en el mismo cuadro, `seeked` puede no llegar.
    setTimeout(terminar, ESPERA_SEEK_MS);
    v.currentTime = instanteDe(destino);
  };
  const irARef = useRef(irA);
  irARef.current = irA;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') irARef.current(actualRef.current - 1);
      else if (e.key === 'ArrowRight') irARef.current(actualRef.current + 1);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  const actualRef = useRef(actual);
  actualRef.current = actual;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // Si la política de seguridad bloquea el video, el <video> queda en negro: se dice por qué.
    const alViolarCsp = (e: SecurityPolicyViolationEvent) => {
      if (e.effectiveDirective !== 'media-src' && !e.blockedURI.startsWith('blob')) return;
      setAvisoVideo(e.originalPolicy.includes('media-src')
        ? `La política de seguridad bloqueó el video (${e.effectiveDirective}).`
        : 'El navegador tiene guardada una versión anterior de la app, que bloquea el video. Recargá la página.');
    };
    const alFallar = () => {
      const e = v.error;
      const detalle = `error ${e?.code ?? '?'}${e?.message ? `: ${e.message}` : ''}`;
      setAvisoVideo(e?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        ? `Este navegador no puede abrir el video (${detalle}). Probá desde el celular, o grabá con «Videos de alta eficiencia» desactivado en la cámara.`
        : `No se pudo cargar el video (${detalle}).`);
    };
    const alCargar = () => {
      irARef.current(cuadroEnTiempo(tiempos, v.currentTime) as number);
      // Safari de iPhone no dibuja ningún cuadro de un video que nunca se reprodujo.
      v.play().then(() => v.pause()).catch(() => {});
    };
    const espera = setTimeout(() => {
      if (!v.error && v.readyState < HTMLMediaElement.HAVE_METADATA) {
        setAvisoVideo(`El video no terminó de cargar (readyState ${v.readyState}, networkState ${v.networkState}).`);
      }
    }, ESPERA_CARGA_MS);
    document.addEventListener('securitypolicyviolation', alViolarCsp);
    v.addEventListener('error', alFallar);
    v.addEventListener('loadedmetadata', alCargar, { once: true });
    return () => {
      clearTimeout(espera);
      document.removeEventListener('securitypolicyviolation', alViolarCsp);
      v.removeEventListener('error', alFallar);
      v.removeEventListener('loadedmetadata', alCargar);
      v.removeAttribute('src');
      v.load();
    };
  }, [tiempos]);

  let resultado: Intento | null = null;
  let texto = 'Marcá el despegue y el aterrizaje.';
  if (despegue != null && aterrizaje != null) {
    const cuadros = aterrizaje - despegue;
    const tv = tiempoDeVuelo(cuadros, fps) as number;
    const veredicto = validarTiempoDeVuelo(tv) as { ok: boolean; motivo?: string };
    if (!veredicto.ok) {
      texto = pareceSinCamaraLenta(cuadros, fps, intervaloS)
        ? 'Este video parece estar a velocidad normal: se perdió la cámara lenta (pasa si se comprime o se manda por chat). Elegí el archivo original, desde la galería del celular.'
        : (veredicto.motivo ?? 'Ese salto no da un tiempo de vuelo posible.');
    } else {
      // Centésimas de ms, como numeric(6,2) de medicion_salto.
      resultado = { tiempoVueloMs: Math.round(tv * 100000) / 100, fpsCaptura: fps };
      texto = `${cuadros} cuadros a ${fps} fps: vuelo de ${Math.round(tv * 1000)} ms, salto de ${coma(alturaDeSalto(tv) as number)} cm.`;
    }
  }

  return (
    <Capa etiqueta="Marcar el salto" alCerrar={() => alTerminar(null)}>
      <h2 className="font-titulo text-3xl leading-none font-bold uppercase">Marcar el salto</h2>
      <video ref={video} src={url} muted playsInline preload="auto" className="max-h-[52svh] w-full rounded-tarjeta bg-negro object-contain" />
      {avisoVideo && <p role="alert" className="text-sm font-medium text-club-texto">{avisoVideo}</p>}
      <input
        type="range" min={0} max={ultimo} step={1} value={actual}
        onChange={(e) => irA(Number(e.target.value))}
        aria-label="Cuadro del video"
        className="w-full accent-[var(--test-salto)]"
      />
      <p className="text-center text-sm text-gris">Cuadro <span className="cifra font-mono">{actual}</span> de {ultimo}</p>
      <div className="grid grid-cols-4 gap-2">
        {[-10, -1, 1, 10].map((p) => (
          <Boton key={p} variante="contorno" tamano="chico" onClick={() => irA(actual + p)}>{p > 0 ? `+${p}` : `−${-p}`}</Boton>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Boton variante={despegue != null ? 'secundario' : 'contorno'} onClick={() => setDespegue(actual)}>
          Despegue <span className="cifra font-mono">{despegue ?? '—'}</span>
        </Boton>
        <Boton variante={aterrizaje != null ? 'secundario' : 'contorno'} onClick={() => setAterrizaje(actual)}>
          Aterrizaje <span className="cifra font-mono">{aterrizaje ?? '—'}</span>
        </Boton>
      </div>
      <p role="status" className="text-sm">{texto}</p>
      <Boton disabled={!resultado} onClick={() => resultado && alTerminar(resultado)}>Usar este salto</Boton>
      <details className="rounded-tarjeta border border-linea bg-sup p-4">
        <summary className="cursor-pointer font-semibold">¿Cómo se mide?</summary>
        <div className="mt-3"><Pasos pasos={PROTOCOLOS.salto!.pasos} /></div>
      </details>
    </Capa>
  );
}
