import { ArrowLeft, Package } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { TIPOS, agruparInventario, buscarIgual, etiquetaDeFila, textoYaExiste, tipoDe, ultimoCambio, validarMaterial } from '@datos/inventario.js';
import { formatearKg } from '@datos/escalones.js';
import { LIMITE } from '@datos/limites.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Consulta } from '../components/ui/consulta';
import { Vacio } from '../components/ui/estados';
import { Pagina, REJILLA_CHICA } from '../components/ui/pagina';
import { Hoja } from '../components/ui/sheet';
import { useMisClubes } from '../datos/consultas';
import { useEscrituraDeInventario, useInventario } from '../datos/consultasInventario';
import { mensajeDeGuardado } from '../datos/errores';
import type { MaterialDelClub } from '../datos/repositorio';
import { Confirmar, Hecho, Rotulo, TITULO_DE_PANTALLA } from '../coord/piezas';
import { fechaDiaMes } from '../estadisticas/formatos';
import { cn } from '../lib/cn';
import { useClubCoord } from './coord/MarcoCoord';

// Lo que cada uno puede hacer lo impone la base (0026); esta pantalla sólo no ofrece lo que la base rechazaría.
const PERMISO = /NO_SE_PUDO|row-level security|permission denied/i;
const REPETIDA = 'Ya hay otra fila igual. Editá esa, o quitá esta.';
const mensajeDeMaterial = (e: unknown) =>
  (e as { code?: string } | null)?.code === '23505'
    ? REPETIDA
    : mensajeDeGuardado(e, 'No se pudo guardar. Probá de nuevo.', [[PERMISO, 'No tenés permiso para cambiar el inventario.']]);

const aFechaLocal = (iso: string) => {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/** El profe llega desde Físico: ve todo y no puede cambiar nada. */
export function InventarioLectura() {
  const clubes = useMisClubes();
  return (
    <Pagina>
      <Link to="/fisico" className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-gris outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta">
        <ArrowLeft aria-hidden className="size-4" />
        Físico
      </Link>
      <Consulta consulta={clubes} errorGenerico="No pudimos cargar tu club">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={Package} titulo="Sin club todavía">Pedile a la coordinación que te sume al club.</Vacio>
          ) : (
            <Cuerpo clubId={lista[0].id} editable={false} />
          )
        }
      </Consulta>
    </Pagina>
  );
}

/** Coordinación agrega, edita y quita. Vive dentro de la puerta de coordinación. */
export function CoordInventario() {
  return <Cuerpo clubId={useClubCoord()} editable />;
}

function Cuerpo({ clubId, editable }: { clubId: string; editable: boolean }) {
  const inventario = useInventario(clubId);
  const [hoja, setHoja] = useState<{ fila: MaterialDelClub | null } | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pt-2">
        <h1 className={TITULO_DE_PANTALLA}>Inventario</h1>
        {editable && <Boton onClick={() => setHoja({ fila: null })}>Agregar material</Boton>}
      </div>
      <Hecho texto={hecho} />
      <Consulta consulta={inventario} errorGenerico="No se pudo cargar el inventario.">
        {({ filas, nombres }) => {
          if (!filas.length) {
            return (
              <Vacio icono={Package} titulo="Inventario">
                {editable
                  ? 'Todavía no hay nada en el inventario. Agregá lo que tiene el club para que los profes sepan con qué cuentan.'
                  : 'Todavía no hay nada en el inventario. Lo carga coordinación.'}
              </Vacio>
            );
          }
          const ultimo = ultimoCambio(filas) as MaterialDelClub;
          return (
            <>
              {(agruparInventario(filas) as { titulo: string; grupos: { tipo: string; titulo: string; filas: MaterialDelClub[] }[] }[]).map((s) => (
                <section key={s.titulo} aria-label={s.titulo}>
                  <Rotulo>{s.titulo}</Rotulo>
                  {s.grupos.map((g) => (
                    <div key={g.tipo} className="mb-3">
                      {g.tipo !== 'otro' && <h3 className="mb-1 text-sm font-semibold">{g.titulo}</h3>}
                      <ul className={REJILLA_CHICA}>
                        {g.filas.map((f) => (
                          <li key={f.id}>
                            <FilaDeMaterial fila={f} alElegir={editable ? () => setHoja({ fila: f }) : undefined} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
              <p className="mt-4 text-sm text-gris">Último cambio: {autoria(ultimo, nombres)}</p>
            </>
          );
        }}
      </Consulta>
      {/* Afuera de la consulta: con el inventario vacío la hoja de alta también tiene que abrirse. */}
      {hoja && (
        <HojaDeMaterial
          key={hoja.fila?.id ?? 'nueva'}
          clubId={clubId}
          fila={hoja.fila}
          filas={inventario.data?.filas ?? []}
          nombres={inventario.data?.nombres ?? {}}
          alCerrar={() => setHoja(null)}
          alGuardar={(texto) => {
            setHoja(null);
            setHecho(texto);
          }}
          alEditarOtra={(otra) => setHoja({ fila: otra })}
        />
      )}
    </div>
  );
}

/** «Tomás, 18/09», o sólo la fecha si esa persona no cargó nombre. */
function autoria(fila: MaterialDelClub, nombres: Record<string, string>) {
  const fecha = fechaDiaMes(aFechaLocal(fila.actualizadoEn));
  const nombre = fila.actualizadoPor ? nombres[fila.actualizadoPor] : undefined;
  return nombre ? `${nombre}, ${fecha}` : fecha;
}

function FilaDeMaterial({ fila, alElegir }: { fila: MaterialDelClub; alElegir?: () => void }) {
  const etiqueta = (etiquetaDeFila(fila) as string) || (tipoDe(fila.tipo)?.nombre ?? fila.tipo);
  const contenido = (
    <>
      <span className="font-semibold">{etiqueta}</span>
      <span className="text-sm text-gris">{fila.cantidad} unid.</span>
    </>
  );
  const clases = 'flex min-h-14 w-full items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3 text-left';
  return alElegir ? (
    <button type="button" onClick={alElegir} className={cn(clases, 'outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta')}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

type Modo = 'form' | 'ya-existe' | 'quitar';

function HojaDeMaterial({ clubId, fila, filas, nombres, alCerrar, alGuardar, alEditarOtra }: {
  clubId: string;
  fila: MaterialDelClub | null;
  filas: MaterialDelClub[];
  nombres: Record<string, string>;
  alCerrar: () => void;
  alGuardar: (texto: string) => void;
  alEditarOtra: (otra: MaterialDelClub) => void;
}) {
  const [tipoClave, setTipoClave] = useState<string | null>(fila?.tipo ?? null);
  const [peso, setPeso] = useState(fila?.pesoKg != null ? (formatearKg(fila.pesoKg) as string) : '');
  const [detalle, setDetalle] = useState(fila?.detalle ?? '');
  const [cantidad, setCantidad] = useState(String(fila?.cantidad ?? 1));
  const [modo, setModo] = useState<Modo>('form');
  const [igual, setIgual] = useState<MaterialDelClub | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agregar = useEscrituraDeInventario(clubId, (repo, v: { tipo: string; pesoKg: number | null; detalle: string; cantidad: number }) =>
    repo.agregarMaterial({ clubId, ...v }),
  );
  const editar = useEscrituraDeInventario(clubId, (repo, v: { pesoKg: number | null; detalle: string; cantidad: number }) =>
    repo.editarMaterial(fila!.id, v),
  );
  const quitar = useEscrituraDeInventario(clubId, (repo) => repo.quitarMaterial(fila!.id));
  const ocupado = agregar.isPending || editar.isPending;

  const tipo = tipoClave ? tipoDe(tipoClave) : null;
  const esOtro = tipo?.peso === 'opcional';
  const rotuloDetalle = esOtro ? 'Nombre' : tipo?.clave === 'pelota' ? 'Número (opcional)' : 'Detalle (opcional)';
  const rotuloPeso = `Peso de cada unidad (kg)${esOtro ? ' (opcional)' : ''}`;
  const titulo = fila ? (tipoDe(fila.tipo)?.nombre ?? fila.tipo) : 'Agregar material';

  const sumar = (delta: number) => {
    const n = parseInt(cantidad, 10);
    setCantidad(String(delta < 0 ? (Number.isInteger(n) && n > 1 ? n - 1 : 1) : Number.isInteger(n) && n > 0 ? n + 1 : 1));
  };

  const guardar = () => {
    if (!tipoClave) return;
    const r = validarMaterial({ tipo: tipoClave, peso, detalle, cantidad }) as {
      error: string | null;
      fila: { tipo: string; pesoKg: number | null; detalle: string; cantidad: number } | null;
    };
    if (r.error || !r.fila) {
      setError(r.error ?? 'Revisá los datos.');
      return;
    }
    const otra = buscarIgual(fila ? filas.filter((f) => f.id !== fila.id) : filas, r.fila) as MaterialDelClub | null;
    if (otra && fila) {
      setError(REPETIDA);
      return;
    }
    if (otra) {
      setIgual(otra);
      setModo('ya-existe');
      return;
    }
    setError(null);
    const fallo = (e: unknown) => setError(mensajeDeMaterial(e));
    if (fila) editar.mutate({ pesoKg: r.fila.pesoKg, detalle: r.fila.detalle, cantidad: r.fila.cantidad }, { onSuccess: () => alGuardar('Listo.'), onError: fallo });
    else agregar.mutate(r.fila, { onSuccess: () => alGuardar('Listo.'), onError: fallo });
  };

  if (modo === 'ya-existe' && igual) {
    return (
      <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="Ya está cargado" descripcion="Esa variante ya está en el inventario" etiquetaCerrar="Cerrar">
        <div className="flex flex-col gap-4 p-5 pt-12">
          <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">Ya está cargado</h2>
          <p className="text-sm text-gris">{textoYaExiste(igual) as string} ¿Editar esa fila?</p>
          <div className="flex flex-col gap-2">
            <Boton onClick={() => alEditarOtra(igual)}>Editar esa fila</Boton>
            <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
          </div>
        </div>
      </Hoja>
    );
  }

  if (modo === 'quitar' && fila) {
    const nombre = [tipoDe(fila.tipo)?.grupo, etiquetaDeFila(fila)].filter(Boolean).join(' · ');
    return (
      <Confirmar
        abierta
        alCerrar={alCerrar}
        titulo="Quitar del inventario"
        texto={`¿Quitar ${nombre} (${fila.cantidad} unid.) del inventario?`}
        verbo="Quitar"
        alConfirmar={async () => {
          await quitar.mutateAsync(undefined as never);
          alGuardar('Listo: quitado del inventario.');
        }}
        mensajeDeError={mensajeDeMaterial}
      />
    );
  }

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={titulo} descripcion="Tipo, peso, detalle y cantidad del material" etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{titulo}</h2>
        {!fila && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {(TIPOS as { clave: string; nombre: string }[]).map((t) => (
                <button
                  key={t.clave}
                  type="button"
                  aria-pressed={tipoClave === t.clave}
                  onClick={() => setTipoClave(t.clave)}
                  className={cn(
                    'min-h-11 rounded-campo border px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                    tipoClave === t.clave ? 'border-tinta bg-tinta text-sup' : 'border-borde-control',
                  )}
                >
                  {t.nombre}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {tipo && (
          <>
            {esOtro && <Campo etiqueta={rotuloDetalle} value={detalle} maxLength={LIMITE.detalleMaterial} autoComplete="off" onChange={(e) => setDetalle(e.target.value)} />}
            {tipo.peso !== 'no' && <Campo etiqueta={rotuloPeso} inputMode="decimal" autoComplete="off" value={peso} onChange={(e) => setPeso(e.target.value)} />}
            {!esOtro && <Campo etiqueta={rotuloDetalle} value={detalle} maxLength={LIMITE.detalleMaterial} autoComplete="off" onChange={(e) => setDetalle(e.target.value)} />}
            <div className="flex flex-col gap-1">
              <label htmlFor="inv-cant" className="text-sm font-semibold">Cantidad (unidades sueltas)</label>
              <div className="flex items-center gap-2">
                <Boton variante="contorno" tamano="chico" aria-label="Una menos" onClick={() => sumar(-1)}>−</Boton>
                <input
                  id="inv-cant"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="h-11 w-20 rounded-campo border border-borde-control bg-sup px-3 text-center text-base outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
                />
                <Boton variante="contorno" tamano="chico" aria-label="Una más" onClick={() => sumar(1)}>+</Boton>
              </div>
            </div>
          </>
        )}
        {fila && <p className="text-sm text-gris">Modificado: {autoria(fila, nombres)}</p>}
        {error && <Aviso tono="error" titulo={error} />}
        <div className="flex flex-col gap-2">
          <Boton disabled={!tipo || ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
          {fila && <Boton variante="contorno" disabled={ocupado} onClick={() => setModo('quitar')}>Quitar del inventario</Boton>}
          <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
        </div>
      </div>
    </Hoja>
  );
}
