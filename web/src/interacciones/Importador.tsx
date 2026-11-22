import { FileSpreadsheet } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Boton } from '../components/ui/button';
import { Panel } from '../components/ui/card';
import { cn } from '../lib/cn';
import { filasConDatos } from './logica';
import { useDuracion } from './piezas';
import { DibujoDeAro, ENCESTA_MS } from './ZonaDeArchivo';

type Estado =
  | { tipo: 'reposo' }
  | { tipo: 'encima' }
  | { tipo: 'procesando' }
  | { tipo: 'listo'; filas: number; hojas: number; ms: number }
  | { tipo: 'error'; texto: string };


/**
 * Lee la planilla EN EL DISPOSITIVO y sólo cuenta filas: no se muestra ni se guarda ninguna celda
 * (una planilla real trae nombres de menores). Es el mismo lector que usa la app (`xlsx` vendorizado).
 */
async function contarFilas(archivo: File) {
  const XLSX = await import('xlsx');
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
  const filas = (libro.SheetNames as string[]).reduce((suma: number, nombre: string) => {
    const hoja = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, blankrows: false }) as unknown[][];
    return suma + filasConDatos(hoja);
  }, 0);
  return { filas, hojas: libro.SheetNames.length };
}

const esXlsx = (a: File) => a.name.toLowerCase().endsWith('.xlsx');

export function SeccionImportador() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'reposo' });
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const dur = useDuracion();
  const vigente = useRef(0);
  // Un arrastre que pasa por encima de los hijos dispara enter/leave varias veces: se cuentan.
  const profundidad = useRef(0);
  useEffect(() => () => { vigente.current++; }, []);

  async function procesar(leer: () => Promise<{ filas: number; hojas: number }>) {
    const turno = ++vigente.current;
    const inicio = performance.now();
    setEstado({ tipo: 'procesando' });
    try {
      // La lectura y la encestada corren juntas; el resumen sale cuando terminan las dos.
      const [r] = await Promise.all([leer(), new Promise((ok) => setTimeout(ok, dur(ENCESTA_MS)))]);
      if (turno !== vigente.current) return;
      setEstado({ tipo: 'listo', ...r, ms: Math.round(performance.now() - inicio) });
    } catch {
      if (turno !== vigente.current) return;
      setEstado({ tipo: 'error', texto: 'No pudimos leer esa planilla. ¿Es la que exporta la CABB o la del plan físico?' });
    }
  }

  function recibir(archivo: File | undefined) {
    if (!archivo) return;
    if (!esXlsx(archivo)) {
      setEstado({ tipo: 'error', texto: 'Eso no es un .xlsx. Probá con la planilla del partido o del plan físico.' });
      return;
    }
    void procesar(() => contarFilas(archivo));
  }

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    profundidad.current = 0;
    recibir(e.dataTransfer.files[0]);
  };
  const libre = estado.tipo !== 'procesando';

  return (
    <Panel titulo="2 · Importador de planillas">
      <label
        htmlFor={id}
        data-estado={estado.tipo}
        onDragEnter={(e) => {
          e.preventDefault();
          profundidad.current++;
          if (libre) setEstado({ tipo: 'encima' });
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          profundidad.current = Math.max(0, profundidad.current - 1);
          if (profundidad.current === 0 && estado.tipo === 'encima') setEstado({ tipo: 'reposo' });
        }}
        onDrop={alSoltar}
        className={cn(
          'ix-imp flex min-h-36 cursor-pointer flex-col items-center gap-3 rounded-tarjeta border-[1.5px] border-dashed p-4 outline-offset-2',
          'transition-[border-color,background-color] duration-[var(--dur-2)] focus-within:outline-2 focus-within:outline-tinta',
          estado.tipo === 'encima' ? 'border-tinta bg-sup-2' : estado.tipo === 'error' ? 'border-club-texto' : 'border-borde-control',
        )}
      >
        <input
          ref={entrada}
          id={id}
          type="file"
          accept=".xlsx"
          className="sr-only"
          disabled={!libre}
          onChange={(e) => {
            recibir(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <DibujoDeAro />
        <div key={estado.tipo} className="ix-aparece min-h-12 min-w-0 text-center" aria-live="polite">
          {estado.tipo === 'reposo' && (
            <>
              <p className="font-semibold">Soltá la planilla acá</p>
              <p className="text-sm text-gris">o tocá para elegirla · .xlsx del partido o del plan físico</p>
            </>
          )}
          {estado.tipo === 'encima' && <p className="font-semibold">Soltala: se lee en tu celu</p>}
          {estado.tipo === 'procesando' && <p className="font-mono text-sm text-gris">Leyendo filas…</p>}
          {estado.tipo === 'listo' && (
            <>
              <p className="text-lg font-semibold">
                <span className="cifra font-mono text-2xl">{estado.filas}</span> {estado.filas === 1 ? 'fila importada' : 'filas importadas'}
              </p>
              <p className="text-sm text-gris">
                {estado.hojas} {estado.hojas === 1 ? 'hoja' : 'hojas'} · en <span className="cifra font-mono">{(estado.ms / 1000).toFixed(1).replace('.', ',')} s</span> · laboratorio: no se guardó nada
              </p>
            </>
          )}
          {estado.tipo === 'error' && <p role="alert" className="font-semibold text-club-texto">{estado.texto}</p>}
        </div>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Boton
          tamano="chico"
          variante="contorno"
          disabled={!libre}
          onClick={() => void procesar(async () => ({ filas: 24, hojas: 1 }))}
        >
          <FileSpreadsheet aria-hidden className="size-4" /> Probar sin archivo
        </Boton>
        {(estado.tipo === 'listo' || estado.tipo === 'error') && (
          <Boton tamano="chico" variante="contorno" onClick={() => setEstado({ tipo: 'reposo' })}>Volver al reposo</Boton>
        )}
      </div>
      <p className="mt-2 text-xs text-gris">Sin modal: la zona queda en su lugar y el resumen aparece adentro. La planilla se lee en el dispositivo y sólo se cuentan filas.</p>
    </Panel>
  );
}
