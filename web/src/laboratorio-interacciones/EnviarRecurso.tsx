import { Check, PlayCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Boton } from '../components/ui/button';
import { Panel } from '../components/ui/card';
import { Opciones, useDuracion } from './piezas';

type Estado = 'reposo' | 'enviando' | 'enviado';
const ENVIO_MS = 600;

// La estela: puntos de tiza que quedan atrás del avión, en la diagonal por la que sale (como una flecha de pizarra).
const ESTELA = Array.from({ length: 4 }, (_, k) => ({ x: 4 + k * 7, y: -(4 + k * 7), retraso: 170 + k * 45 }));

export function BotonEnviarRecurso({ textoListo }: { textoListo: string }) {
  const [estado, setEstado] = useState<Estado>('reposo');
  const dur = useDuracion();
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);

  const enviar = () => {
    if (estado !== 'reposo') return;
    setEstado('enviando');
    // Acá iría el pedido real; el estado confirmado espera a la respuesta, nunca la adivina.
    reloj.current = setTimeout(() => setEstado('enviado'), dur(ENVIO_MS));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-estado={estado}
        aria-disabled={estado !== 'reposo' || undefined}
        onClick={enviar}
        className="lab-enviar inline-grid overflow-hidden min-h-11 min-w-[17.5rem] items-center rounded-btn border border-borde-control bg-negro px-5 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-negro uppercase outline-offset-2 transition-transform duration-[var(--dur-1)] select-none focus-visible:outline-2 focus-visible:outline-tinta active:scale-[.97] aria-disabled:cursor-default"
      >
        <span className="capa-lima" aria-hidden />
        <span className="flex items-center justify-center gap-2.5">
          <span className="grid">
            <span className="texto [grid-area:1/1]" data-t="reposo" aria-hidden={estado !== 'reposo'}>Enviar recurso</span>
            <span className="texto [grid-area:1/1]" data-t="enviando" aria-hidden={estado !== 'enviando'}>Enviando…</span>
            <span className="texto text-sobre-lima [grid-area:1/1]" data-t="enviado" aria-hidden={estado !== 'enviado'}>{textoListo}</span>
          </span>
          <span aria-hidden className="relative size-5 shrink-0">
            <Send className="avion absolute inset-0 size-5" strokeWidth={2} />
            <span className="estela absolute top-1/2 left-1/2">
              {ESTELA.map((p, k) => (
                <i
                  key={k}
                  style={{ transform: `translate(${p.x}px, ${p.y}px)`, animationDelay: `calc(${p.retraso}ms * var(--lab-lento))` }}
                />
              ))}
            </span>
            <Check className="tilde absolute inset-0 size-5 text-sobre-lima" strokeWidth={3} />
          </span>
        </span>
      </button>
      <p className="sr-only" aria-live="polite">{estado === 'enviado' ? `Recurso enviado: ${textoListo}` : ''}</p>
      {estado === 'enviado' && (
        <Boton tamano="chico" variante="contorno" className="lab-aparece" onClick={() => setEstado('reposo')}>Mandar otro</Boton>
      )}
    </div>
  );
}

export function SeccionEnviarRecurso() {
  const [texto, setTexto] = useState<'cancha' | 'enviado'>('cancha');
  return (
    <Panel titulo="3 · Enviar recurso">
      <div className="mb-4 rounded-tarjeta bg-sup-2 p-3">
        <div className="flex items-center gap-3">
          <PlayCircle aria-hidden className="size-9 shrink-0 text-club-texto" strokeWidth={1.6} />
          <div className="min-w-0">
            <p className="font-semibold">Bandeja con mano débil</p>
            <p className="text-sm text-gris">Video de técnica · 0:42 · para <b className="font-semibold text-tinta">Sub 13 · todo el plantel</b></p>
          </div>
        </div>
      </div>
      <div className="mb-3">
        <Opciones
          etiqueta="Texto al confirmar"
          valor={texto}
          alCambiar={setTexto}
          opciones={[{ id: 'cancha', nombre: '«Recurso en cancha»' }, { id: 'enviado', nombre: '«Enviado»' }]}
        />
      </div>
      <BotonEnviarRecurso textoListo={texto === 'cancha' ? 'Recurso en cancha' : 'Enviado'} />
      <p className="mt-3 text-xs text-gris">Pasá el mouse (o enfocá con Tab): el avión se echa para atrás, como tomando impulso. Al tocar sale disparado hacia donde apunta, deja la estela y el botón queda en lima con la tilde.</p>
    </Panel>
  );
}
