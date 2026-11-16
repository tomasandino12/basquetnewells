import { ArrowLeft } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { clavearNombre } from '@datos/claveNombre.js';
import { esEnlaceWeb, MENSAJE_ENLACE_NO_WEB } from '@datos/enlaces.js';
import { calcularHashArchivo } from '@datos/mapearImportacion.js';
import {
  bibliotecaParaElegir, decisionDesdeOpcion, nombresPorResolver, prepararPayloadPlanFisico,
} from '@datos/prepararPayloadPlanFisico.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton, claseBoton } from '../../components/ui/button';
import { Panel } from '../../components/ui/card';
import { mensajeDeError, mensajeDeGuardado } from '../../datos/errores';
import type { EjercicioDeFuerza } from '../../datos/repositorio';
import { useAccion, useRepositorio } from '../../familias/consultas';
import { sinCodigo } from '../../importar/textos';
import { cn } from '../../lib/cn';
import { ConCategoria, MarcoDelPlantel } from '../PlantelDelClub';
import { CampoDeArchivo } from './piezas';

// Cargar el plan de fuerza de una categoría desde su .xlsx: archivo → resumen (con videos opcionales) → resultado.
// Nada se guarda hasta «Guardar», y se guarda todo o nada (importar_plan_fisico es una sola transacción).

interface Leido {
  errores: { mensaje: string }[];
  advertencias: { mensaje: string }[];
  sesiones: { fecha: string }[];
}

interface Resumen {
  sesiones: number;
  ejercicios: number;
  pendientes: number;
  ejerciciosNuevos: number;
}

interface Armado {
  error: string | null;
  payload: unknown;
  resumen: Resumen;
}

interface Pendiente {
  nombreClave: string;
  nombresOriginales: string[];
  apariciones: number;
}

interface Opcion {
  id: string | null;
  clave: string;
  nombre: string;
  bloque: string | null;
  link: string | null;
}

type Decision = { tipo: 'existente'; ejercicioId: string } | { tipo: 'nueva'; nombre: string; bloque: string | null; link: string };
type Decisiones = Record<string, Decision>;

interface Datos {
  nombreArchivo: string;
  hash: string;
  leido: Leido;
  biblioteca: EjercicioDeFuerza[];
  sinVideo: Pendiente[];
}

type Paso =
  | { tipo: 'archivo'; leyendo: boolean; fallo: ReactNode | null }
  | { tipo: 'resumen' }
  | { tipo: 'videos' }
  | { tipo: 'resultado'; texto: string };

const enlaceVolver = 'mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta';
const CAMPO = 'h-11 w-full rounded-campo border border-borde-control bg-sup px-3 text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta';

const fechaCorta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** El plan de fuerza de la categoría elegida arriba, desde un .xlsx. */
export function CargarPlanFisico() {
  return (
    <MarcoDelPlantel>
      <ConCategoria>{(a) => <PasosDelPlan key={a.plantelId} clubId={a.clubId} plantelId={a.plantelId} categoria={a.categoria} />}</ConCategoria>
    </MarcoDelPlantel>
  );
}

export function PasosDelPlan({ clubId, plantelId, categoria }: { clubId: string; plantelId: string; categoria: string }) {
  const cargar = useRepositorio();
  const consultas = useQueryClient();
  const guardar = useAccion((repo, payload: unknown) => repo.importarPlanFisico(payload));
  const [paso, setPaso] = useState<Paso>({ tipo: 'archivo', leyendo: false, fallo: null });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [decisiones, setDecisiones] = useState<Decisiones>({});
  const [error, setError] = useState<string | null>(null);
  // Si se elige otro archivo mientras se lee el anterior, el viejo no pisa al nuevo.
  const lectura = useRef(0);

  const fallo = (nodo: ReactNode) => setPaso({ tipo: 'archivo', leyendo: false, fallo: nodo });

  const armar = (d: Datos, dec: Decisiones): Armado => prepararPayloadPlanFisico(
    d.leido, d.biblioteca, { porClave: dec },
    { clubId, plantelId, nombreArchivo: d.nombreArchivo, hashArchivo: d.hash },
  ) as unknown as Armado;

  async function leer(archivo: File | undefined) {
    const esta = ++lectura.current;
    if (!archivo) return;
    setPaso({ tipo: 'archivo', leyendo: true, fallo: null });
    let buffer: ArrayBuffer;
    try {
      buffer = await archivo.arrayBuffer();
    } catch {
      return fallo(<Aviso tono="error" titulo="No se pudo leer el archivo. Probá de nuevo." />);
    }
    try {
      const { parsearPlanFisico } = await import('@parser/parserFisico.js');
      const leido = parsearPlanFisico(buffer, archivo.name) as unknown as Leido;
      if (esta !== lectura.current) return;
      if (leido.errores.length > 0) {
        return fallo(
          <>
            <p className="font-mono text-xs tracking-wide text-gris uppercase">No se pudo leer el plan</p>
            {leido.errores.map((e, i) => <Aviso key={i} tono="error" titulo={sinCodigo(e.mensaje)} />)}
          </>,
        );
      }
      const [hash, biblioteca] = await Promise.all([
        calcularHashArchivo(buffer) as Promise<string>,
        cargar().then((repo) => repo.obtenerEjerciciosFuerza(clubId)),
      ]);
      if (esta !== lectura.current) return;
      const nuevo: Datos = { nombreArchivo: archivo.name, hash, leido, biblioteca, sinVideo: [] };
      // Un archivo que no se puede importar (sin sesiones, sesiones sin fecha) se frena acá, antes de mostrar un resumen que no se va a poder guardar.
      const prueba = armar(nuevo, {});
      if (prueba.error) return fallo(<Aviso tono="error" titulo={`Este archivo no se puede importar: ${prueba.error}.`} />);
      nuevo.sinVideo = nombresPorResolver(leido, biblioteca) as Pendiente[];
      setDatos(nuevo);
      setDecisiones({});
      setError(null);
      setPaso({ tipo: 'resumen' });
    } catch (e) {
      if (esta !== lectura.current) return;
      fallo(<Aviso tono="error" titulo={mensajeDeError(e, 'Ocurrió un error inesperado.')} />);
    }
  }

  async function guardarPlan() {
    if (!datos || guardar.isPending) return;
    const { error: errorPayload, payload } = armar(datos, decisiones);
    if (errorPayload) {
      setError(`No se puede guardar: ${errorPayload}.`);
      return;
    }
    setError(null);
    let r: { sesiones: number; ejercicios: number; pendientes: number };
    try {
      r = await guardar.mutateAsync(payload);
    } catch (e) {
      setError(textoDeErrorAlGuardar(e, categoria));
      return;
    }
    await consultas.invalidateQueries({ queryKey: ['fisico'] });
    const conVideo = r.ejercicios - r.pendientes;
    setPaso({
      tipo: 'resultado',
      texto: `Se guardaron ${r.sesiones} ${plural(r.sesiones, 'sesión', 'sesiones')} y ${r.ejercicios} ${plural(r.ejercicios, 'ejercicio', 'ejercicios')} en ${categoria}${conVideo > 0 ? `, ${conVideo} con video` : ''}.`,
    });
  }

  return (
    <>
      <Link to="/fisico" className={enlaceVolver}>
        <ArrowLeft aria-hidden className="size-4" />
        Volver a Físico
      </Link>
      <header className="mb-5">
        <p className="font-mono text-xs tracking-wide text-gris uppercase">Físico · {categoria}</p>
        <h1 className="font-titulo text-4xl leading-none font-bold tracking-tight lg:text-5xl">Cargar plan de fuerza</h1>
      </header>

      {paso.tipo === 'archivo' && (
        <Panel titulo="Planilla del plan">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gris">
              Elegí el plan de fuerza en <b>.xlsx</b>. Se lee en tu dispositivo y recién se guarda al final, cuando confirmes.
            </p>
            <CampoDeArchivo etiqueta="Plan de fuerza (.xlsx)" alElegir={(a) => void leer(a)} disabled={paso.leyendo} />
            <div aria-live="polite" className="flex flex-col gap-3">
              {paso.leyendo && <p role="status" className="text-sm text-gris">Leyendo archivo…</p>}
              {paso.fallo}
            </div>
          </div>
        </Panel>
      )}

      {paso.tipo === 'resumen' && datos && (
        <Resumen
          datos={datos}
          resumen={armar(datos, decisiones).resumen}
          categoria={categoria}
          error={error}
          guardando={guardar.isPending}
          alAgregarVideos={() => setPaso({ tipo: 'videos' })}
          alGuardar={() => void guardarPlan()}
        />
      )}

      {paso.tipo === 'videos' && datos && (
        <Videos
          datos={datos}
          decisiones={decisiones}
          alDecidir={(clave, d) => setDecisiones((x) => {
            const otras = { ...x };
            if (d) otras[clave] = d;
            else delete otras[clave];
            return otras;
          })}
          categoria={categoria}
          error={error}
          guardando={guardar.isPending}
          alVolver={() => setPaso({ tipo: 'resumen' })}
          alGuardar={() => void guardarPlan()}
        />
      )}

      {paso.tipo === 'resultado' && datos && (
        <div className="flex flex-col gap-4">
          <Aviso tono="ok" titulo={paso.texto} />
          <Advertencias lista={datos.leido.advertencias} />
          <Link to="/fisico" className={cn(claseBoton(), 'self-start')}>Volver a Físico</Link>
        </div>
      )}
    </>
  );
}

function textoDeErrorAlGuardar(e: unknown, categoria: string): string {
  const mensaje = (e as { message?: string } | null)?.message ?? '';
  if (mensaje.startsWith('EJERCICIO_DUPLICADO')) {
    const nombre = mensaje.split(':').slice(1).join(':').trim();
    return `"${nombre}" ya está en la biblioteca: se cargó mientras tanto. Volvé a abrir el archivo.`;
  }
  return mensajeDeGuardado(e, 'No se pudo guardar. Intentá de nuevo.', [
    [/^PLAN_DUPLICADO/, `Este plan ya está cargado en ${categoria}.`],
  ]);
}

function Advertencias({ lista }: { lista: { mensaje: string }[] }) {
  if (lista.length === 0) return null;
  return (
    <details className="rounded-tarjeta bg-sup-2 px-4 py-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
        {lista.length} {plural(lista.length, 'advertencia', 'advertencias')} del archivo
      </summary>
      <ul aria-label="Advertencias del archivo" className="flex flex-col gap-2 pb-2">
        {lista.map((a, i) => <li key={i}><Aviso titulo={a.mensaje} /></li>)}
      </ul>
    </details>
  );
}

/* ---------- Paso: resumen ---------- */

function Resumen({
  datos, resumen, categoria, error, guardando, alAgregarVideos, alGuardar,
}: {
  datos: Datos;
  resumen: Resumen;
  categoria: string;
  error: string | null;
  guardando: boolean;
  alAgregarVideos: () => void;
  alGuardar: () => void;
}) {
  const fechas = datos.leido.sesiones.map((s) => s.fecha).sort();
  const rango = fechas.length > 1 ? `del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}` : fechaCorta(fechas[0] ?? '');
  const filas: [string, string][] = [
    ['Archivo', datos.nombreArchivo],
    ['Sesiones', `${resumen.sesiones}, ${rango}`],
    ['Ejercicios', String(resumen.ejercicios)],
    ['Con video', String(resumen.ejercicios - resumen.pendientes)],
    ['Sin video', String(resumen.pendientes)],
    ['Videos nuevos', `${resumen.ejerciciosNuevos} a la biblioteca`],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Aviso titulo={`El plan se guarda en ${categoria}. Revisá que sea la categoría correcta: no se deshace desde la app. Para cambiarla, elegí otra arriba.`} />
      <Panel titulo="Qué trae el archivo">
        <dl className="flex flex-col gap-1 text-sm">
          {filas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-gris">{k}</dt><dd className="min-w-0 text-right font-semibold break-words">{v}</dd></div>
          ))}
        </dl>
        {datos.sinVideo.length > 0 && (
          <Boton variante="contorno" tamano="chico" className="mt-3" onClick={alAgregarVideos}>Agregar videos</Boton>
        )}
      </Panel>
      <Advertencias lista={datos.leido.advertencias} />
      {error && <Aviso tono="error" titulo={error} />}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={alGuardar} disabled={guardando}>{guardando ? 'Guardando…' : `Guardar en ${categoria}`}</Boton>
        <Link to="/fisico" className={claseBoton({ variante: 'contorno' })}>Volver</Link>
      </div>
    </div>
  );
}

/* ---------- Paso opcional: agregar videos ---------- */

function textoDeVideo(d: Decision | undefined, biblioteca: EjercicioDeFuerza[]): string {
  if (!d) return 'sin video';
  if (d.tipo === 'existente') return `video de ${biblioteca.find((f) => f.id === d.ejercicioId)?.nombre ?? 'un ejercicio de la biblioteca'}`;
  return `video de ${d.nombre}`;
}

function Videos({
  datos, decisiones, alDecidir, categoria, error, guardando, alVolver, alGuardar,
}: {
  datos: Datos;
  decisiones: Decisiones;
  alDecidir: (clave: string, d: Decision | null) => void;
  categoria: string;
  error: string | null;
  guardando: boolean;
  alVolver: () => void;
  alGuardar: () => void;
}) {
  const sinElegir = datos.sinVideo.filter((n) => !decisiones[n.nombreClave]).reduce((s, n) => s + n.apariciones, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gris">
        Estos ejercicios no tienen video en la hoja «Ejercicios» del archivo, y no hace falta: se guardan igual. Si alguno lo necesita, elegí un video de la biblioteca o cargá el link.
      </p>
      <p role="status" className="text-sm font-semibold">
        {sinElegir ? `${sinElegir} ${plural(sinElegir, 'ejercicio', 'ejercicios')} sin video.` : 'Todos los ejercicios de esta lista tienen video.'}
      </p>
      <ul aria-label="Ejercicios sin video" className="flex flex-col gap-2">
        {datos.sinVideo.map((n) => (
          <FilaDeVideo key={n.nombreClave} datos={datos} pendiente={n} decisiones={decisiones} alDecidir={(d) => alDecidir(n.nombreClave, d)} />
        ))}
      </ul>
      {error && <Aviso tono="error" titulo={error} />}
      <div className="flex flex-wrap gap-2">
        <Boton onClick={alGuardar} disabled={guardando}>{guardando ? 'Guardando…' : `Guardar en ${categoria}`}</Boton>
        <Boton variante="contorno" onClick={alVolver}>Volver al resumen</Boton>
      </div>
    </div>
  );
}

function FilaDeVideo({
  datos, pendiente, decisiones, alDecidir,
}: { datos: Datos; pendiente: Pendiente; decisiones: Decisiones; alDecidir: (d: Decision | null) => void }) {
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nombre, setNombre] = useState(pendiente.nombresOriginales[0] ?? '');
  const [bloque, setBloque] = useState('');
  const [link, setLink] = useState('');
  const decision = decisiones[pendiente.nombreClave];
  const nombrePropio = pendiente.nombresOriginales.join(' / ');

  // Lo que ya decidieron los demás nombres: lo que eligió esta misma fila no cuenta como «ya existe» al cambiarla.
  const sinEsta = { ...decisiones };
  delete sinEsta[pendiente.nombreClave];
  const todas = bibliotecaParaElegir(datos.leido, datos.biblioteca, { porClave: sinEsta }) as Opcion[];
  const conLink = todas.filter((o) => typeof o.link === 'string' && o.link.trim() !== '');

  function elegir(clave: string) {
    const opcion = conLink.find((o) => o.clave === clave);
    if (opcion) alDecidir(decisionDesdeOpcion(opcion) as Decision);
  }

  function usarLink() {
    if (!nombre.trim()) return setAviso('Poné un nombre.');
    const enlace = link.trim();
    if (!enlace) return setAviso('Poné el link del video.');
    if (!esEnlaceWeb(enlace)) return setAviso(MENSAJE_ENLACE_NO_WEB);
    // Un nombre que ya existe no se da de alta de nuevo: se elige. Mismo criterio que la base, dicho antes de guardar.
    const existente = todas.find((o) => o.clave === clavearNombre(nombre));
    if (existente) {
      return setAviso(existente.link
        ? `"${existente.nombre}" ya está en la biblioteca. Elegilo de la lista.`
        : `"${existente.nombre}" ya está en la biblioteca, sin link, y desde acá no se le puede agregar uno. Usá otro nombre o dejalo sin video.`);
    }
    alDecidir({ tipo: 'nueva', nombre, bloque: bloque.trim() || null, link: enlace });
    setAviso(null);
    setCargando(false);
  }

  return (
    <li className="flex flex-col gap-2 rounded-tarjeta bg-sup-2 px-4 py-3">
      <span>
        <span className="block font-semibold">{nombrePropio}</span>
        <span className="block text-sm text-gris">
          {pendiente.apariciones} {plural(pendiente.apariciones, 'vez', 'veces')} en el plan · {textoDeVideo(decision, datos.biblioteca)}
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Elegir video para ${nombrePropio}`}
          value={decision?.tipo === 'existente' ? conLink.find((o) => o.id === decision.ejercicioId)?.clave ?? '' : ''}
          onChange={(e) => elegir(e.target.value)}
          className={cn(CAMPO, 'w-auto min-w-48')}
        >
          <option value="" disabled>Elegir video…</option>
          {conLink.map((o) => <option key={o.clave} value={o.clave}>{o.nombre}</option>)}
        </select>
        <Boton variante="contorno" tamano="chico" aria-expanded={cargando} onClick={() => setCargando((v) => !v)}>Cargar link</Boton>
        {decision && <Boton variante="contorno" tamano="chico" onClick={() => alDecidir(null)}>Quitar</Boton>}
      </div>
      {cargando && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Bloque
            <input value={bloque} onChange={(e) => setBloque(e.target.value)} autoComplete="off" className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">Link al video
            <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} autoComplete="off" className={CAMPO} />
          </label>
          {aviso && <Aviso tono="error" titulo={aviso} />}
          <Boton tamano="chico" className="self-start" onClick={usarLink}>Usar este</Boton>
        </div>
      )}
    </li>
  );
}
