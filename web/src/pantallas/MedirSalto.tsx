import { useRef, useState } from 'react';
import { prepararPayloadSalto } from '@datos/prepararPayloadMedicion.js';
import { alturaDeSalto, INTENTOS_SALTO, TESTS_SALTO } from '@datos/salto.js';
import { Boton } from '../components/ui/button';
import { REJILLA } from '../components/ui/pagina';
import type { JugadorDelPlantel, PayloadDeMedicion } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { MarcadorDeSalto, prepararVideo, RechazoDeVideo, type Intento, type Preparado } from '../medir/MarcadorDeSalto';
import { BotonAusente, CampoFecha, Encabezado, PantallaDeTest, PieDeGuardado, type Categoria } from '../medir/MarcoDeTest';
import { useTest } from '../medir/useTest';

type TestSalto = 'cmj' | 'abalakov';
type ValorSalto = { ausente: true } | { intentos: (Intento | null)[] };

const NOMBRE_DE_SALTO: Record<TestSalto, string> = { cmj: 'CMJ (manos en la cadera)', abalakov: 'Abalakov (brazos libres)' };
const TESTS = TESTS_SALTO as TestSalto[];

export const textoDeIntento = (i: Intento) => `${(alturaDeSalto(i.tiempoVueloMs / 1000) as number).toFixed(1).replace('.', ',')} cm`;

/** Salto (CMJ o Abalakov) por video: 3 intentos por chico, cada uno marcado cuadro a cuadro. */
export function MedirSalto() {
  return <PantallaDeTest>{(c) => <Salto {...c} />}</PantallaDeTest>;
}

function Salto({ clubId, plantelId, categoria, jugadores }: Categoria & { jugadores: JugadorDelPlantel[] }) {
  const t = useTest<ValorSalto, { testSalto: TestSalto }>({
    clubId, plantelId, tipo: 'salto',
    extraInicial: (b) => ({ testSalto: TESTS.includes(b?.testSalto as TestSalto) ? (b!.testSalto as TestSalto) : 'cmj' }),
    payload: (e) => prepararPayloadSalto({
      sesionId: e.sesionId, clubId, plantelId, fecha: e.fecha, testSalto: e.extra.testSalto, valores: e.valores,
    }) as PayloadDeMedicion,
    vacio: 'Todavía no cargaste ningún salto.',
  });
  const entrada = useRef<HTMLInputElement>(null);
  const destino = useRef<{ jugadorId: string; indice: number } | null>(null);
  const [abierto, setAbierto] = useState<{ archivo: File; preparado: Preparado } | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  const elegirVideo = (jugadorId: string, indice: number) => {
    destino.current = { jugadorId, indice };
    if (entrada.current) {
      entrada.current.value = '';
      entrada.current.click();
    }
  };

  const alElegir = async (archivo: File | undefined) => {
    if (!archivo || !destino.current) return;
    setLeyendo(true);
    try {
      setAbierto({ archivo, preparado: await prepararVideo(archivo) });
    } finally {
      setLeyendo(false);
    }
  };

  const alMarcar = (r: Intento | null) => {
    setAbierto(null);
    const d = destino.current;
    if (!r || !d) return;
    const v = t.estado.valores[d.jugadorId];
    const intentos = [...(v && 'intentos' in v ? v.intentos : [])];
    intentos[d.indice] = r;
    t.ponerValor(d.jugadorId, { intentos });
  };

  return (
    <>
      <Encabezado tipo="salto" categoria={categoria} fecha={t.estado.fecha}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Test</span>
          <select
            value={t.estado.extra.testSalto}
            onChange={(e) => t.cambiar((s) => ({ ...s, extra: { testSalto: e.target.value as TestSalto } }))}
            className="h-11 rounded-campo border border-borde-control bg-sup px-3 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
          >
            {TESTS.map((x) => <option key={x} value={x}>{NOMBRE_DE_SALTO[x] ?? x}</option>)}
          </select>
        </label>
        <CampoFecha fecha={t.estado.fecha} alCambiar={(f) => t.cambiar((s) => ({ ...s, fecha: f }))} />
      </Encabezado>

      <p className="mt-4 text-sm text-gris">Tocá un salto y elegí el video en cámara lenta. El video no se sube: sólo se usa para marcar los cuadros.</p>
      {leyendo && <p role="status" className="mt-2 text-sm">Leyendo el video…</p>}

      <ul className={cn('mt-4', REJILLA)}>
        {jugadores.map((j) => {
          const v = t.estado.valores[j.id];
          const ausente = !!v && 'ausente' in v;
          const intentos = v && 'intentos' in v ? v.intentos : [];
          return (
            <li key={j.id} className={cn('flex flex-col gap-3 rounded-tarjeta border border-linea bg-sup p-4', ausente && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{j.nombreLimpio}</span>
                <BotonAusente nombre={j.nombreLimpio} ausente={ausente} alTocar={() => t.ponerValor(j.id, ausente ? undefined : { ausente: true })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: INTENTOS_SALTO as number }, (_, i) => {
                  const intento = intentos[i];
                  return (
                    <Boton
                      key={i}
                      tamano="chico"
                      variante={intento ? 'secundario' : 'contorno'}
                      disabled={ausente || leyendo}
                      onClick={() => elegirVideo(j.id, i)}
                      aria-label={intento ? `${j.nombreLimpio}, salto ${i + 1}: ${textoDeIntento(intento)}. Tocá para cambiarlo` : `${j.nombreLimpio}: cargar el salto ${i + 1}`}
                    >
                      {intento ? textoDeIntento(intento) : `Salto ${i + 1}`}
                    </Boton>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <input ref={entrada} type="file" accept="video/*" hidden onChange={(e) => void alElegir(e.target.files?.[0])} />
      {abierto?.preparado.tipo === 'medir' && (
        <MarcadorDeSalto archivo={abierto.archivo} tabla={abierto.preparado.tabla} fps={abierto.preparado.fps} alTerminar={alMarcar} />
      )}
      {abierto && abierto.preparado.tipo !== 'medir' && <RechazoDeVideo preparado={abierto.preparado} alCerrar={() => setAbierto(null)} />}

      <PieDeGuardado guardando={t.guardando} aviso={t.aviso} alGuardar={t.guardar} />
    </>
  );
}
