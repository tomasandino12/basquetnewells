import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatearTiempoSprint, validarIntentoSprint } from '@datos/sprint.js';
import { Boton } from '../components/ui/button';

const ESPERA_MIN_MS = 1000;
const ESPERA_MAX_MS = 2000;
// Si el navegador no avisa que terminó de hablar, se sigue igual.
const ESPERA_VOZ_MAX_MS = 4000;
const PITIDO_HZ = 1000;
const PITIDO_S = 0.35;
const TEXTO_MARCAS = 'En sus marcas… listos…';

const enVivo = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1).replace('.', ',');
const tiempo = (ms: number | null) => (formatearTiempoSprint(ms) as string | null) ?? '—';
/** El toque llega con `timeStamp` en el reloj de performance.now(); en navegadores viejos era epoch. */
const instanteDelToque = (e: { timeStamp: number }) => (e.timeStamp > 1e12 ? performance.now() : e.timeStamp);

type Fase = 'listo' | 'marcas' | 'manual' | 'corriendo' | 'resultado';

/**
 * Cronómetro de salida por sonido para el sprint de ida y vuelta, igual que el de la app de siempre:
 * «En sus marcas… listos…», una espera al azar y un pitido. El cero es el instante programado del
 * pitido en el reloj del audio. El profe toca *Giró* (la ida) y *Llegó* (el total) desde la línea de
 * salida, con el pointerdown (sin la demora del click). Sin audio, cae a la salida manual.
 */
export function CronometroDeSalida({ jugador, intento, distanciaM, alTerminar }: {
  jugador: string;
  intento: number;
  distanciaM: number;
  alTerminar: (r: { parcialMs: number; tiempoMs: number } | null) => void;
}) {
  const [fase, setFase] = useState<Fase>('listo');
  const [manual, setManual] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [parcialMs, setParcialMs] = useState<number | null>(null);
  const [tiempoMs, setTiempoMs] = useState<number | null>(null);
  const [reloj, setReloj] = useState('0,0');
  const audio = useRef<AudioContext | null>(null);
  const inicio = useRef<number | null>(null);
  const temporizadores = useRef<number[]>([]);
  const cuadro = useRef<number | null>(null);

  const limpiar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
    if (cuadro.current) cancelAnimationFrame(cuadro.current);
    cuadro.current = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // Sin voz no pasa nada: el texto ya está en pantalla.
    }
    audio.current?.close?.().catch(() => {});
    audio.current = null;
  }, []);

  const cerrar = useCallback((v: { parcialMs: number; tiempoMs: number } | null) => {
    limpiar();
    alTerminar(v);
  }, [alTerminar, limpiar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar(null);
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [cerrar]);
  useEffect(() => limpiar, [limpiar]);

  const esperar = (ms: number, fn: () => void) => temporizadores.current.push(window.setTimeout(fn, ms));

  const animar = () => {
    if (inicio.current == null) return;
    setReloj(enVivo(performance.now() - inicio.current));
    cuadro.current = requestAnimationFrame(animar);
  };

  const arrancar = (instante: number) => {
    inicio.current = instante;
    setParcialMs(null);
    setFase('corriendo');
    if (cuadro.current) cancelAnimationFrame(cuadro.current);
    animar();
  };

  const decirMarcas = (seguir: () => void) => {
    let seguido = false;
    const una = () => {
      if (seguido) return;
      seguido = true;
      seguir();
    };
    try {
      const voz = window.speechSynthesis;
      if (!voz || typeof SpeechSynthesisUtterance === 'undefined') throw new Error('sin voz');
      const frase = new SpeechSynthesisUtterance(TEXTO_MARCAS);
      frase.lang = 'es-AR';
      frase.onend = una;
      frase.onerror = una;
      voz.cancel();
      voz.speak(frase);
      esperar(ESPERA_VOZ_MAX_MS, una);
    } catch {
      esperar(2400, una);
    }
  };

  const programarPitido = () => {
    const a = audio.current;
    if (!a) return;
    const espera = ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS);
    const cero = a.currentTime + espera / 1000;
    const oscilador = a.createOscillator();
    const volumen = a.createGain();
    oscilador.frequency.value = PITIDO_HZ;
    volumen.gain.setValueAtTime(0.0001, cero);
    volumen.gain.linearRampToValueAtTime(1, cero + 0.01);
    volumen.gain.setValueAtTime(1, cero + PITIDO_S - 0.02);
    volumen.gain.linearRampToValueAtTime(0.0001, cero + PITIDO_S);
    oscilador.connect(volumen).connect(a.destination);
    oscilador.start(cero);
    oscilador.stop(cero + PITIDO_S);
    // El cero, pasado al reloj de performance.now(): getOutputTimestamp cuenta la latencia de salida.
    const marca = a.getOutputTimestamp?.();
    const ceroMs = marca && (marca.performanceTime ?? 0) > 0
      ? marca.performanceTime! + (cero - marca.contextTime!) * 1000
      : performance.now() + (cero - a.currentTime) * 1000 - (a.outputLatency ?? 0) * 1000;
    // El reloj arranca en pantalla cuando suena el pitido.
    esperar(Math.max(0, ceroMs - performance.now()), () => arrancar(ceroMs));
  };

  const correr = () => {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    try {
      if (!Contexto) throw new Error('sin audio');
      // El toque de Correr es el gesto que habilita el audio en el celular.
      audio.current = new Contexto();
      void audio.current.resume?.();
    } catch {
      setMensaje('No se pudo usar el sonido. Usá la salida manual.');
      setManual(true);
      setFase('manual');
      return;
    }
    setMensaje(null);
    setManual(false);
    setParcialMs(null);
    setFase('marcas');
    decirMarcas(programarPitido);
  };

  const giro = (instante: number) => {
    if (fase !== 'corriendo' || parcialMs != null || inicio.current == null) return;
    setParcialMs(Math.round(instante - inicio.current));
  };

  const llego = (instante: number) => {
    if (fase !== 'corriendo' || parcialMs == null || inicio.current == null) return;
    setTiempoMs(Math.round(instante - inicio.current));
    limpiar();
    setFase('resultado');
  };

  const repetir = () => {
    setMensaje(null);
    setParcialMs(null);
    setTiempoMs(null);
    inicio.current = null;
    setReloj('0,0');
    setFase(manual ? 'manual' : 'listo');
  };

  const veredicto = fase === 'resultado' && parcialMs != null && tiempoMs != null
    ? (validarIntentoSprint(parcialMs / 1000, tiempoMs / 1000) as { ok: boolean; error?: string })
    : null;

  const GRANDE = 'flex min-h-[38svh] w-full flex-col items-center justify-center gap-2 rounded-tarjeta bg-test-sprint px-4 font-titulo text-6xl font-bold uppercase text-sobre-test-sprint outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-tinta active:scale-[.99] touch-manipulation';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Cronómetro de salida" className="fixed inset-0 z-50 overflow-y-auto bg-fondo text-tinta">
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col items-center gap-5 px-4 py-6 text-center">
        <button type="button" onClick={() => cerrar(null)} aria-label="Cerrar" className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
          <X aria-hidden className="size-5" />
        </button>
        <div className="mt-6">
          <p className="font-titulo text-3xl leading-none font-bold uppercase">{jugador}</p>
          <p className="mt-1 font-mono text-xs tracking-wide text-gris uppercase">Intento {intento} · {distanciaM} + {distanciaM} metros</p>
        </div>

        {fase === 'listo' && (
          <>
            {mensaje && <p role="alert" className="text-sm font-medium text-club-texto">{mensaje}</p>}
            <p aria-hidden className="cifra font-titulo text-8xl leading-none font-bold">0,0<span className="text-3xl">s</span></p>
            <button type="button" className={GRANDE} onClick={correr}>Correr</button>
            <Boton variante="contorno" tamano="chico" onClick={() => { setManual(true); setFase('manual'); }}>Sin sonido: salida manual</Boton>
          </>
        )}

        {fase === 'marcas' && <p role="status" className="my-auto font-titulo text-5xl leading-none font-bold uppercase">{TEXTO_MARCAS}</p>}

        {fase === 'manual' && (
          <>
            <p aria-hidden className="cifra font-titulo text-8xl leading-none font-bold">0,0<span className="text-3xl">s</span></p>
            <button type="button" className={GRANDE} onPointerDown={(e) => arrancar(instanteDelToque(e))}>¡Salida!</button>
          </>
        )}

        {fase === 'corriendo' && (
          <>
            <p role="timer" className="cifra font-titulo text-8xl leading-none font-bold">{reloj}<span className="text-3xl">s</span></p>
            <p role="status" className="min-h-6 font-mono text-sm">{parcialMs != null ? `Ida ${tiempo(parcialMs)}` : ''}</p>
            {parcialMs == null ? (
              <button type="button" className={GRANDE} onPointerDown={(e) => giro(instanteDelToque(e))}>
                ¡Giró!<span className="font-sans text-sm font-normal normal-case">Tocá cuando frene para dar la vuelta</span>
              </button>
            ) : (
              <button type="button" className={GRANDE} onPointerDown={(e) => llego(instanteDelToque(e))}>
                ¡Llegó!<span className="font-sans text-sm font-normal normal-case">Tocá cuando vuelva a la línea de salida</span>
              </button>
            )}
          </>
        )}

        {fase === 'resultado' && parcialMs != null && tiempoMs != null && (
          <>
            <p role="status" className="cifra font-titulo text-8xl leading-none font-bold">{tiempo(tiempoMs).replace(' s', '')}<span className="text-3xl">s</span></p>
            <p className="flex gap-4 text-sm">
              <span>Ida <b className="font-mono">{tiempo(parcialMs)}</b></span>
              <span>Vuelta <b className="font-mono">{tiempo(tiempoMs - parcialMs)}</b></span>
            </p>
            {veredicto && !veredicto.ok && <p role="alert" className="text-sm font-medium text-club-texto">{veredicto.error} Repetí el intento.</p>}
            <div className="flex gap-2">
              <Boton variante="contorno" onClick={repetir}>Repetir</Boton>
              <Boton disabled={!veredicto?.ok} onClick={() => cerrar({ parcialMs, tiempoMs })}>Guardar</Boton>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
