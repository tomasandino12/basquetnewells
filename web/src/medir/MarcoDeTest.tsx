import { Info, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { etiquetaMetodologia } from '@datos/metodologia.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Hoja } from '../components/ui/sheet';
import { useMisClubes } from '../datos/consultas';
import type { JugadorDelPlantel } from '../datos/repositorio';
import { usePlantelId } from '../plantel/activo';
import { ConPlantel } from '../pantallas/ConPlantel';
import { Pasos, PROTOCOLOS } from './protocolos';
import { formatearFecha, hoyLocal, NOMBRE_DE_TEST, type TipoDeTest } from './sesiones';
import { useJugadoresParaMedir } from './useTest';

export interface Categoria {
  clubId: string;
  plantelId: string;
  categoria: string;
}

/** Pantalla de un test: volver a Medir, la categoría elegida y los chicos cargados antes de dibujar nada. */
export function PantallaDeTest({ children }: { children: (c: Categoria & { jugadores: JugadorDelPlantel[] }) => ReactNode }) {
  const plantelId = usePlantelId();
  return (
    <ConPlantel plantelId={plantelId} volver={{ a: '/medir', texto: 'Medir' }} soloCuerpoTecnico="La coordinación ve las mediciones en la app anterior.">
      {(c) => <ConJugadores {...c}>{children}</ConJugadores>}
    </ConPlantel>
  );
}

function ConJugadores({ clubId, plantelId, categoria, children }: Categoria & { children: (c: Categoria & { jugadores: JugadorDelPlantel[] }) => ReactNode }) {
  const jugadores = useJugadoresParaMedir(clubId, plantelId);
  return (
    <Consulta consulta={jugadores} errorGenerico="No se pudo cargar el plantel">
      {(lista) =>
        lista.length === 0 ? (
          <Vacio icono={Users} titulo={`${categoria} no tiene jugadores`}>
            Cargá el plantel antes de medir: desde Plantel podés importar una planilla de la CABB o agregar jugadores a mano.
          </Vacio>
        ) : (
          // La clave remonta el test si cambia la categoría: el borrador es de otra.
          <div key={plantelId}>{children({ clubId, plantelId, categoria, jugadores: lista })}</div>
        )
      }
    </Consulta>
  );
}

/** Título del test con la categoría y la fecha, y el «¿Cómo se mide?» si el test tiene protocolo. */
export function Encabezado({ tipo, categoria, fecha, children }: { tipo: TipoDeTest; categoria: string; fecha: string; children?: ReactNode }) {
  return (
    <header className="pt-2">
      <h1 className="font-titulo text-6xl leading-[.9] font-bold uppercase lg:text-7xl">{NOMBRE_DE_TEST[tipo]}</h1>
      <p className="mt-2 font-mono text-xs tracking-wide text-gris uppercase">
        {categoria} · {formatearFecha(fecha)}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {children}
        {PROTOCOLOS[tipo] && <BotonProtocolo tipo={tipo} />}
      </div>
    </header>
  );
}

function BotonProtocolo({ tipo }: { tipo: TipoDeTest }) {
  const [abierta, setAbierta] = useState(false);
  const clubes = useMisClubes();
  const protocolo = PROTOCOLOS[tipo]!;
  return (
    <>
      <Boton variante="contorno" tamano="chico" onClick={() => setAbierta(true)}>
        <Info aria-hidden className="size-4" />
        {tipo === 'salto' ? '¿Cómo se mide?' : '¿Cómo medir?'}
      </Boton>
      <Hoja abierta={abierta} alCambiar={setAbierta} titulo={protocolo.titulo} descripcion={protocolo.sub} etiquetaCerrar="Cerrar">
        <div className="flex flex-col gap-4 p-5 pt-12">
          <div>
            <h2 className="font-titulo text-3xl leading-none font-bold uppercase">{protocolo.titulo}</h2>
            <p className="mt-1 font-mono text-xs tracking-wide text-gris uppercase">{etiquetaMetodologia(clubes.data?.[0] ?? null)}</p>
            <p className="mt-2 text-sm text-gris">{protocolo.sub}</p>
          </div>
          <Pasos pasos={protocolo.pasos} />
        </div>
      </Hoja>
    </>
  );
}

/** La fecha de la sesión: hasta hoy, nunca futura. */
export function CampoFecha({ fecha, alCambiar }: { fecha: string; alCambiar: (f: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold">Fecha</span>
      <input
        type="date"
        value={fecha}
        max={hoyLocal()}
        onChange={(e) => e.target.value && alCambiar(e.target.value)}
        className="h-11 rounded-campo border border-borde-control bg-sup px-3 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
      />
    </label>
  );
}

/** El pie fijo con el guardado, y el aviso del error arriba de él. */
export function PieDeGuardado({ texto = 'Guardar la sesión', guardando, aviso, alGuardar, variante = 'principal' }: {
  texto?: string;
  guardando: boolean;
  aviso: string | null;
  alGuardar: () => void;
  variante?: 'principal' | 'contorno';
}) {
  return (
    <>
      {aviso && <Aviso tono="error" titulo={aviso} className="mt-4" />}
      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 border-t border-linea bg-fondo/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8">
        <Boton variante={variante} className="w-full sm:w-auto" disabled={guardando} onClick={alGuardar}>
          {guardando ? 'Guardando…' : texto}
        </Boton>
      </div>
    </>
  );
}

/** El botón de ausente de un chico: dice el estado, no sólo el color. */
export function BotonAusente({ ausente, alTocar, nombre }: { ausente: boolean; alTocar: () => void; nombre: string }) {
  return (
    <Boton variante={ausente ? 'secundario' : 'contorno'} tamano="chico" aria-pressed={ausente} aria-label={`Ausente ${nombre}`} onClick={alTocar}>
      {ausente ? 'Ausente ✓' : 'Ausente'}
    </Boton>
  );
}
