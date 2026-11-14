import { useRef, useState } from 'react';
import { temporadaComoAnio } from '@datos/categorias.js';
import { cruzarConPadron, filasParaImportar, inscriptosDelPlantel } from '@datos/inscriptos.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Hoja } from '../../components/ui/sheet';
import { mensajeDeError, mensajeDeGuardado } from '../../datos/errores';
import type { JugadorDelPlantel } from '../../datos/repositorio';
import { useAccion, useRepositorio } from '../../familias/consultas';
import {
  REGLAS_INSCRIPTOS, sinCodigo, textoDeMails, textoInscriptosListo, textoSalteadas,
} from '../../importar/textos';
import { TituloDeHoja } from '../familias/piezas';
import { CampoDeArchivo, FilaTildable, PasosDeImportacion } from './piezas';

interface Cruzado {
  nombreLimpio: string;
  estado: 'existente' | 'nuevo' | 'conflicto';
  mails: string[];
  sinRama?: boolean;
  aviso?: string | null;
}

const ETIQUETA = {
  existente: 'Ya está en el club',
  nuevo: 'Chico nuevo',
  conflicto: 'Mismo nombre, otra fecha',
} as const;

type Estado =
  | { tipo: 'nada' }
  | { tipo: 'leyendo' }
  | { tipo: 'error'; texto: string }
  | { tipo: 'lista'; cruzados: Cruzado[]; salteadas: number; advertencias: string[] };

interface Props {
  clubId: string;
  plantel: { id: string; categoria: string; categoriaCodigo: string | null; temporadaId: string | null };
  /** Los chicos del plantel, con su fecha de nacimiento: la fecha sólo se conoce de las fichas de este plantel. */
  jugadores: JugadorDelPlantel[];
  alCerrar: () => void;
  /** Lo que la pantalla dice arriba cuando se importó. */
  alImportar: (texto: string) => void;
}

/**
 * Plantel → «Importar inscriptos»: el profe baja la planilla «Para Semillero» (la arma el club con las
 * inscripciones de Google, sin DNI) y la sube acá. Ve fila por fila qué se va a hacer, tilda lo que quiere
 * y confirma. Nada se guarda hasta ese último paso, y se guarda todo o nada.
 */
export function ImportarInscriptos({ clubId, plantel, jugadores, alCerrar, alImportar }: Props) {
  const cargar = useRepositorio();
  const guardar = useAccion((repo, filas: unknown[]) => repo.importarInscriptos({ plantelId: plantel.id, filas }));
  const [estado, setEstado] = useState<Estado>({ tipo: 'nada' });
  const [tildes, setTildes] = useState<boolean[]>([]);
  const [errorAlGuardar, setErrorAlGuardar] = useState<string | null>(null);
  // Si se elige otro archivo mientras se lee el anterior, el viejo no pisa al nuevo.
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
      const { parsearInscriptos } = await import('@parser/parserInscriptos.js');
      const parseo = parsearInscriptos(await archivo.arrayBuffer(), archivo.name) as {
        exito: boolean; errores: string[]; filas: unknown[]; advertencias: string[];
      };
      if (esta !== lectura.current) return;
      if (!parseo.exito) {
        setEstado({ tipo: 'error', texto: sinCodigo(parseo.errores[0]) });
        return;
      }
      const repo = await cargar();
      const temporada = (await repo.obtenerTemporadasDelClub(clubId)).find((t) => t.id === plantel.temporadaId);
      const delPlantel = inscriptosDelPlantel(parseo.filas, plantel.categoriaCodigo, // El JS infiere el año como «null» por su valor por defecto; en verdad es un número o null.
        temporadaComoAnio(temporada?.nombre) as never);
      // La fecha sólo la conocemos de las fichas de este plantel; el resto del club aporta el nombre, que alcanza para no duplicar a alguien.
      const fechaPorId = new Map(jugadores.map((j) => [j.id, j.fechaNacimiento ?? null]));
      const padron = (await repo.obtenerJugadoresDelClub(clubId)).map((j) => ({
        id: j.id, nombreClave: j.nombreClave, fechaNacimiento: fechaPorId.get(j.id) ?? null,
      }));
      const cruzados = cruzarConPadron(delPlantel.inscriptos, padron) as Cruzado[];
      if (esta !== lectura.current) return;
      setTildes(cruzados.map((c) => c.estado !== 'conflicto' && !c.sinRama));
      setEstado({
        tipo: 'lista',
        cruzados,
        salteadas: delPlantel.salteadas.length,
        advertencias: [...parseo.advertencias.map(sinCodigo), ...delPlantel.advertencias],
      });
    } catch (e) {
      if (esta !== lectura.current) return;
      setEstado({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo leer la planilla. Revisá que sea la de «Para Semillero».') });
    }
  }

  async function confirmar(cruzados: Cruzado[]) {
    if (guardar.isPending) return;
    const elegidos = cruzados.filter((_, i) => tildes[i]);
    if (elegidos.length === 0) {
      setErrorAlGuardar('No tildaste a nadie.');
      return;
    }
    setErrorAlGuardar(null);
    try {
      const r = await guardar.mutateAsync(filasParaImportar(elegidos) as unknown[]);
      alImportar(textoInscriptosListo(r));
      alCerrar();
    } catch (e) {
      setErrorAlGuardar(mensajeDeGuardado(e, 'No se pudo guardar. Probá de nuevo.', REGLAS_INSCRIPTOS));
    }
  }

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="Importar inscriptos" descripcion={`Sumar chicos a ${plantel.categoria} desde la planilla de inscriptos`} etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <TituloDeHoja>Importar inscriptos</TituloDeHoja>
        <PasosDeImportacion>
          <li>En la planilla <b>Para Semillero</b> del club, andá a Archivo → Descargar → Microsoft Excel (.xlsx).</li>
          <li>Elegí ese archivo acá abajo.</li>
          <li>Revisá la lista: sólo se muestran los chicos de {plantel.categoria}.</li>
        </PasosDeImportacion>
        <CampoDeArchivo etiqueta="Planilla de inscriptos (.xlsx)" alElegir={(a) => void leer(a)} disabled={guardar.isPending} />

        <div aria-live="polite" className="flex flex-col gap-4">
          {estado.tipo === 'leyendo' && <p role="status" className="text-sm text-gris">Leyendo la planilla…</p>}
          {estado.tipo === 'error' && <Aviso tono="error" titulo={estado.texto} />}
          {estado.tipo === 'lista' && (
            <Lista
              estado={estado}
              categoria={plantel.categoria}
              tildes={tildes}
              alTildar={(i, v) => setTildes((t) => t.map((x, j) => (j === i ? v : x)))}
              error={errorAlGuardar}
              ocupado={guardar.isPending}
              alConfirmar={() => void confirmar(estado.cruzados)}
            />
          )}
        </div>
      </div>
    </Hoja>
  );
}

function Lista({
  estado, categoria, tildes, alTildar, error, ocupado, alConfirmar,
}: {
  estado: Extract<Estado, { tipo: 'lista' }>;
  categoria: string;
  tildes: boolean[];
  alTildar: (i: number, v: boolean) => void;
  error: string | null;
  ocupado: boolean;
  alConfirmar: () => void;
}) {
  const notas = [estado.salteadas > 0 && textoSalteadas(estado.salteadas), ...estado.advertencias].filter(Boolean) as string[];
  return (
    <>
      {notas.map((n, i) => <Aviso key={i} titulo={n} />)}
      {estado.cruzados.length === 0 ? (
        <p className="text-sm text-gris">No hay chicos de {categoria} en esta planilla.</p>
      ) : (
        <>
          <p className="text-sm text-gris">
            Tildá los que querés sumar a {categoria}. Los que ya están en el club sólo se agregan a esta categoría; no se duplican.
          </p>
          <ul aria-label="Chicos de la planilla" className="flex flex-col gap-2">
            {estado.cruzados.map((c, i) => (
              <FilaTildable
                key={`${c.nombreLimpio}-${i}`}
                tildada={tildes[i] ?? false}
                alCambiar={(v) => alTildar(i, v)}
                nombre={c.nombreLimpio}
                detalle={`${ETIQUETA[c.estado]} · ${textoDeMails(c.mails.length)}`}
              >
                {c.sinRama && <span className="mt-1 block text-sm text-gris">Anotado en U13 mixto sin decir la rama. Tildalo sólo si juega en U13 masculino.</span>}
                {c.aviso && <span className="mt-1 block text-sm text-gris">{c.aviso}</span>}
                {c.estado === 'conflicto' && <span className="mt-1 block text-sm text-gris">Ya hay un chico con ese nombre y otra fecha. Tildalo sólo si son dos chicos distintos.</span>}
              </FilaTildable>
            ))}
          </ul>
          {error && <Aviso tono="error" titulo={error} />}
          <Boton onClick={alConfirmar} disabled={ocupado}>{ocupado ? 'Guardando…' : `Sumar a ${categoria}`}</Boton>
        </>
      )}
    </>
  );
}
