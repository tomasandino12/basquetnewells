import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { cn } from '../lib/cn';
import { caminoDeRed, useDuracion } from './piezas';
import './interacciones.css';

/** Lo que dura la encestada: la misma parábola que el tiro del cargador. */
export const ENCESTA_MS = 700;

type Estado = 'reposo' | 'encima' | 'procesando' | 'listo' | 'error';

const esXlsx = (a: File) => a.name.toLowerCase().endsWith('.xlsx');

/** El aro sobre un tablero negro (así la red lima se lee también en el tema claro) y la planilla que encesta. */
export function DibujoDeAro() {
  return (
    <svg aria-hidden viewBox="0 0 240 120" className="ix-imp-dibujo h-auto w-full max-w-72 shrink-0 overflow-visible">
      <rect x="128" y="4" width="108" height="112" rx="10" fill="var(--negro)" />
      <rect x="214" y="14" width="3" height="42" rx="1" fill="var(--sobre-negro)" opacity=".7" />
      <path d="M198 46L214 38" stroke="var(--sobre-negro)" strokeWidth="2.2" opacity=".7" />
      <line x1="4" x2="120" y1="112" y2="112" stroke="var(--linea)" strokeWidth="1.5" />
      {/* Atrás va la mitad de arriba del aro; el documento pasa entre las dos mitades y por dentro de la red. */}
      <path d="M154 46A22 5 0 0 1 198 46" fill="none" stroke="var(--club)" strokeWidth="2.6" />
      <g className="doc">
        <g className="doc-x">
          <g className="doc-y">
            <g className="doc-giro">
              <path d="M23 70h16l6 6v24H23Z" fill="var(--sup)" stroke="var(--tinta)" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M39 70v6h6" fill="none" stroke="var(--tinta)" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M27 83h14M27 88h14M27 93h14M34 80v16" stroke="var(--sube)" strokeWidth="1.3" />
            </g>
          </g>
        </g>
      </g>
      <g className="red-imp">
        <path d={caminoDeRed(176, 46, 42, 24, 30, 4, 3)} fill="none" stroke="var(--sobre-negro)" strokeWidth="1.2" opacity=".55" />
        <path className="red-lima" d={caminoDeRed(176, 46, 42, 24, 30, 4, 3)} fill="none" stroke="var(--lima)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M154 46A22 5 0 0 0 198 46" fill="none" stroke="var(--club)" strokeWidth="2.6" />
    </svg>
  );
}

/**
 * Elegir o soltar una planilla .xlsx: la planilla encesta en el aro mientras la pantalla la lee, sin modal.
 * Avisa el archivo apenas llega (`alElegir`): la lectura y la animación corren juntas, y lo que se leyó
 * (o el error) lo sigue mostrando la pantalla, como antes. La etiqueta es el nombre accesible del campo.
 */
export function ZonaDeArchivo({ etiqueta, alElegir, disabled }: { etiqueta: string; alElegir: (archivo: File | undefined) => void; disabled?: boolean }) {
  const [estado, setEstado] = useState<Estado>('reposo');
  const [nombre, setNombre] = useState('');
  const id = useId();
  const dur = useDuracion();
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Un arrastre que pasa por encima de los hijos dispara enter/leave varias veces: se cuentan.
  const profundidad = useRef(0);
  useEffect(() => () => clearTimeout(reloj.current), []);

  function recibir(archivo: File | undefined) {
    if (!archivo) return;
    clearTimeout(reloj.current);
    if (!esXlsx(archivo)) {
      setEstado('error');
      setNombre(archivo.name);
      return;
    }
    setNombre(archivo.name);
    setEstado('procesando');
    // Se apaga por reloj y no por animationend: con movimiento reducido no hay animación que termine.
    reloj.current = setTimeout(() => setEstado('listo'), dur(ENCESTA_MS));
    alElegir(archivo);
  }

  const libre = !disabled && estado !== 'procesando';

  return (
    <label
      htmlFor={id}
      data-estado={estado}
      onDragEnter={(e) => {
        e.preventDefault();
        profundidad.current++;
        if (libre) setEstado('encima');
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        profundidad.current = Math.max(0, profundidad.current - 1);
        if (profundidad.current === 0 && estado === 'encima') setEstado('reposo');
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        profundidad.current = 0;
        if (libre) recibir(e.dataTransfer.files[0]);
        else setEstado((s) => (s === 'encima' ? 'reposo' : s));
      }}
      className={cn(
        'ix-imp flex cursor-pointer flex-col items-center gap-2 rounded-tarjeta border-[1.5px] border-dashed p-4 text-center outline-offset-2',
        'transition-[border-color,background-color] duration-[var(--dur-2)] focus-within:outline-2 focus-within:outline-tinta',
        estado === 'encima' ? 'border-tinta bg-sup-2' : estado === 'error' ? 'border-club-texto' : 'border-borde-control',
        !libre && 'cursor-default',
      )}
    >
      <input
        id={id}
        type="file"
        accept=".xlsx"
        aria-label={etiqueta}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => recibir(e.target.files?.[0])}
      />
      <DibujoDeAro />
      <span className="text-sm font-semibold">{etiqueta}</span>
      <span key={estado} className="ix-aparece min-h-5 text-sm text-gris" aria-live="polite">
        {estado === 'reposo' && 'Soltala acá o tocá para elegirla. Se lee en tu dispositivo.'}
        {estado === 'encima' && 'Soltala: se lee en tu dispositivo.'}
        {estado === 'procesando' && 'Leyendo la planilla…'}
        {estado === 'listo' && <>Planilla: <b className="font-semibold text-tinta break-all">{nombre}</b> · tocá para elegir otra</>}
        {estado === 'error' && <span className="font-semibold text-club-texto">«{nombre}» no es un .xlsx. Probá con la planilla bajada como Excel.</span>}
      </span>
    </label>
  );
}
