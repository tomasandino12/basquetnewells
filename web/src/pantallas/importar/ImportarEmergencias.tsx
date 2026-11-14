import { useRef, useState } from 'react';
import { cruzarEmergencias, filasParaImportarEmergencias } from '@datos/emergencias.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Hoja } from '../../components/ui/sheet';
import { mensajeDeError, mensajeDeGuardado } from '../../datos/errores';
import type { JugadorDelPlantel } from '../../datos/repositorio';
import { useAccion } from '../../familias/consultas';
import { REGLAS_EMERGENCIAS, sinCodigo, textoDeAlertas, textoEmergenciasListo } from '../../importar/textos';
import { TituloDeHoja } from '../familias/piezas';
import { CampoDeArchivo, FilaTildable, PasosDeImportacion } from './piezas';

interface Cruzada {
  fila: number;
  nombreLimpio: string;
  alertas: unknown[];
}

interface SinCruzar {
  fila: number;
  nombre: string;
  motivo: string;
}

type Estado =
  | { tipo: 'nada' }
  | { tipo: 'leyendo' }
  | { tipo: 'error'; texto: string }
  | { tipo: 'lista'; cruzadas: Cruzada[]; notas: string[] };

interface Props {
  plantel: { id: string; categoria: string };
  /** Los chicos del plantel, con su fecha de nacimiento: nunca se crea a nadie, sólo se cruza con ellos. */
  jugadores: JugadorDelPlantel[];
  alCerrar: () => void;
  alImportar: (texto: string) => void;
}

/**
 * Plantel → «Importar emergencias»: el profe sube la planilla «Emergencias para Semillero» (otra que «Para
 * Semillero», para que esa nunca lleve salud). Cruza por nombre y fecha con los chicos DEL PLANTEL y no
 * crea a nadie. Lo que sube pisa lo que ya había. Son datos de salud de menores: el archivo se lee acá,
 * no se guarda y no se anota en ningún registro. Nada se manda hasta el último paso, y se manda todo o nada.
 */
export function ImportarEmergencias({ plantel, jugadores, alCerrar, alImportar }: Props) {
  const guardar = useAccion((repo, filas: unknown[]) => repo.importarEmergencias({ plantelId: plantel.id, filas }));
  const [estado, setEstado] = useState<Estado>({ tipo: 'nada' });
  const [tildes, setTildes] = useState<boolean[]>([]);
  const [errorAlGuardar, setErrorAlGuardar] = useState<string | null>(null);
  const lectura = useRef(0);

  async function leer(archivo: File | undefined) {
    const esta = ++lectura.current;
    setErrorAlGuardar(null);
    if (!archivo) {
      setEstado({ tipo: 'nada' });
      return;
    }
    setEstado({ tipo: 'leyendo' });
    try {
      const { parsearEmergencias } = await import('@parser/parserEmergencias.js');
      const parseo = parsearEmergencias(await archivo.arrayBuffer(), archivo.name) as {
        exito: boolean; errores: string[]; filas: unknown[]; advertencias: string[];
      };
      if (esta !== lectura.current) return;
      if (!parseo.exito) {
        setEstado({ tipo: 'error', texto: sinCodigo(parseo.errores[0]) });
        return;
      }
      const r = cruzarEmergencias(parseo.filas, jugadores) as { cruzadas: Cruzada[]; sinCruzar: SinCruzar[]; advertencias: string[] };
      setTildes(r.cruzadas.map(() => true));
      setEstado({
        tipo: 'lista',
        cruzadas: r.cruzadas,
        notas: [
          ...parseo.advertencias,
          ...r.advertencias,
          ...r.sinCruzar.map((s) => `fila ${s.fila}: ${s.nombre} no se carga (${s.motivo}).`),
        ],
      });
    } catch (e) {
      if (esta !== lectura.current) return;
      setEstado({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo leer la planilla. Revisá que sea la de «Emergencias para Semillero».') });
    }
  }

  async function confirmar(cruzadas: Cruzada[]) {
    if (guardar.isPending) return;
    const elegidos = cruzadas.filter((_, i) => tildes[i]);
    if (elegidos.length === 0) {
      setErrorAlGuardar('No tildaste a nadie.');
      return;
    }
    setErrorAlGuardar(null);
    try {
      const r = await guardar.mutateAsync(filasParaImportarEmergencias(elegidos) as unknown[]);
      alImportar(textoEmergenciasListo(r));
      alCerrar();
    } catch (e) {
      setErrorAlGuardar(mensajeDeGuardado(e, 'No se pudo guardar. Probá de nuevo.', REGLAS_EMERGENCIAS));
    }
  }

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="Importar emergencias" descripcion={`Cargar datos de emergencia de ${plantel.categoria} desde la planilla`} etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <TituloDeHoja>Importar emergencias</TituloDeHoja>
        <PasosDeImportacion>
          <li>En la planilla <b>Emergencias para Semillero</b> del club, andá a Archivo → Descargar → Microsoft Excel (.xlsx).</li>
          <li>Elegí ese archivo acá abajo.</li>
          <li>Revisá la lista: sólo se cargan los chicos de {plantel.categoria} que figuren en la planilla.</li>
        </PasosDeImportacion>
        <Aviso titulo="Son datos de salud de menores">
          Usá sólo la planilla de emergencias, nunca la de respuestas completas. El archivo no se guarda: se lee en tu dispositivo y se manda a Semillero.
        </Aviso>
        <CampoDeArchivo etiqueta="Planilla de emergencias (.xlsx)" alElegir={(a) => void leer(a)} disabled={guardar.isPending} />

        <div aria-live="polite" className="flex flex-col gap-4">
          {estado.tipo === 'leyendo' && <p role="status" className="text-sm text-gris">Leyendo la planilla…</p>}
          {estado.tipo === 'error' && <Aviso tono="error" titulo={estado.texto} />}
          {estado.tipo === 'lista' && (
            <>
              {estado.notas.map((n, i) => <Aviso key={i} titulo={n} />)}
              {estado.cruzadas.length === 0 ? (
                <p className="text-sm text-gris">No hay chicos de {plantel.categoria} en esta planilla.</p>
              ) : (
                <>
                  <Aviso titulo="Si ya tenían datos, se reemplazan por los de la planilla.">
                    Tildá a quienes querés cargar.
                  </Aviso>
                  <ul aria-label="Chicos de la planilla" className="flex flex-col gap-2">
                    {estado.cruzadas.map((c, i) => (
                      <FilaTildable
                        key={`${c.fila}-${i}`}
                        tildada={tildes[i] ?? false}
                        alCambiar={(v) => setTildes((t) => t.map((x, j) => (j === i ? v : x)))}
                        nombre={c.nombreLimpio}
                        detalle={textoDeAlertas(c.alertas.length)}
                      />
                    ))}
                  </ul>
                  {errorAlGuardar && <Aviso tono="error" titulo={errorAlGuardar} />}
                  <Boton onClick={() => void confirmar(estado.cruzadas)} disabled={guardar.isPending}>
                    {guardar.isPending ? 'Guardando…' : 'Cargar los datos'}
                  </Boton>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Hoja>
  );
}
