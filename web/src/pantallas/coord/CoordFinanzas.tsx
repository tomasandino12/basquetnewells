import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { hoyLocal } from '@datos/antropometria.js';
import {
  formatearPesos, mesVecino, montoParaEditar, nombreDelMes, resumenDelPeriodo, ROTULO_TIPO,
} from '@datos/finanzas.js';
import { validarMovimiento } from '../../coord/validaciones';
import { LIMITE } from '@datos/limites.js';
import { Boton, claseBoton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { Hoja } from '../../components/ui/sheet';
import { Aviso } from '../../components/ui/aviso';
import { useAccionCoord, useFinanzasDelMes } from '../../coord/consultas';
import { Confirmar, Hecho, Rotulo, Seleccion, TITULO_DE_PANTALLA } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { FilaDeMovimiento, Movimiento, Rubro } from '../../datos/repositorioCoord';
import { cn } from '../../lib/cn';
import { useClubCoord } from './MarcoCoord';

const REGLAS: [RegExp, string][] = [[/MOVIMIENTO_BORRADO/, 'Este movimiento ya estaba borrado. Actualizá la pantalla.']];
const mensajeDeMovimiento = (e: unknown) => mensajeDeGuardado(e, 'No se pudo guardar el movimiento. Probá de nuevo.', REGLAS);

/** Signo con texto: egreso en negativo, ingreso con «+». El tipo no se dice sólo con el color. */
const montoConSigno = (tipo: string | undefined, centavos: number) =>
  formatearPesos(tipo === 'egreso' ? -centavos : centavos, { signo: true });

const fechaCorta = (iso: string) => {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
};

const resultadoTexto = (r: number) => (r > 0 ? 'a favor' : r < 0 ? 'en contra' : 'en cero');

/**
 * Finanzas del básquet: el mes elegido con ingresos, egresos, resultado, totales por rubro y los
 * movimientos, que se cargan, editan y borran desde una hoja. Los montos viajan en centavos enteros.
 */
export function CoordFinanzas() {
  const clubId = useClubCoord();
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const datos = useFinanzasDelMes(clubId, periodo.anio, periodo.mes);
  const [hoja, setHoja] = useState<{ movimiento: Movimiento | null } | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const nombreMes = nombreDelMes(periodo.anio, periodo.mes);

  return (
    <div>
      <h1 className={cn(TITULO_DE_PANTALLA, 'mb-4')}>Finanzas</h1>
      <Hecho texto={hecho} />
      <Consulta consulta={datos} errorGenerico="No se pudieron cargar las finanzas.">
        {({ rubros, movimientos }) => {
          if (!rubros.length) {
            return (
              <Vacio
                icono={Wallet}
                titulo="Primero, los rubros"
                accion={<Link to="/coordinacion/rubros" className={claseBoton({ variante: 'principal' })}>Crear rubros</Link>}
              >
                Para cargar ingresos y egresos, primero creá los rubros con que se agrupan (Patrocinios, Arbitrajes, Alquiler de cancha…).
              </Vacio>
            );
          }
          const resumen = resumenDelPeriodo(movimientos, rubros);
          const rubroDe = new Map(rubros.map((r) => [r.id, r]));
          return (
            <>
              <div className="mb-5 flex items-center justify-between gap-2">
                <Boton variante="contorno" tamano="chico" aria-label="Mes anterior" onClick={() => setPeriodo((p) => mesVecino(p.anio, p.mes, -1))}>
                  <ChevronLeft aria-hidden className="size-5" />
                </Boton>
                <h2 aria-live="polite" className="font-titulo text-3xl leading-none font-semibold uppercase">{nombreMes}</h2>
                <Boton variante="contorno" tamano="chico" aria-label="Mes siguiente" onClick={() => setPeriodo((p) => mesVecino(p.anio, p.mes, 1))}>
                  <ChevronRight aria-hidden className="size-5" />
                </Boton>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Total rotulo="Ingresos" valor={formatearPesos(resumen.ingresos, { signo: true })} />
                <Total rotulo="Egresos" valor={formatearPesos(-resumen.egresos)} />
                <Total rotulo="Resultado" valor={formatearPesos(resumen.resultado, { signo: true })} nota={resultadoTexto(resumen.resultado)} />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <section aria-label="Por rubro">
                  <Rotulo>Por rubro</Rotulo>
                  {resumen.porRubro.length === 0 ? (
                    <p className="text-sm text-gris">Sin movimientos en {nombreMes}.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {resumen.porRubro.map((l: { rubroId: string; nombre: string; tipo: 'ingreso' | 'egreso'; total: number; cantidad: number }) => (
                        <li key={l.rubroId} className="flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3">
                          <span>
                            <span className="block font-semibold">{l.nombre}</span>
                            <span className="block text-xs text-gris">
                              {ROTULO_TIPO[l.tipo]} · {l.cantidad} {l.cantidad === 1 ? 'movimiento' : 'movimientos'}
                            </span>
                          </span>
                          <span className="font-mono text-sm font-semibold">{montoConSigno(l.tipo, l.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-label="Movimientos">
                  <div className="mt-6 mb-2 flex items-center justify-between gap-2 first:mt-0 lg:mt-0">
                    <h2 className="font-mono text-xs tracking-wide text-gris uppercase">Movimientos</h2>
                    <Link to="/coordinacion/rubros" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Rubros</Link>
                  </div>
                  {movimientos.length === 0 ? (
                    <p className="text-sm text-gris">Todavía no hay movimientos en {nombreMes}.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {movimientos.map((m) => {
                        const rubro = rubroDe.get(m.rubroId);
                        const detalle = [m.descripcion, m.comprobanteUrl && 'con comprobante'].filter(Boolean).join(' · ');
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => setHoja({ movimiento: m })}
                              className="flex min-h-14 w-full items-center gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                            >
                              <span className="font-mono text-xs text-gris">{fechaCorta(m.fecha)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{rubro?.nombre ?? '—'}</span>
                                {detalle && <span className="block truncate text-xs text-gris">{detalle}</span>}
                              </span>
                              <span className="font-mono text-sm font-semibold">{montoConSigno(rubro?.tipo, m.centavos)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>

              <div className="mt-6">
                <Boton onClick={() => setHoja({ movimiento: null })}>Cargar movimiento</Boton>
              </div>

              {hoja && (
                <HojaDeMovimiento
                  clubId={clubId}
                  movimiento={hoja.movimiento}
                  rubros={rubros}
                  alCerrar={() => setHoja(null)}
                  alGuardar={(fecha) => {
                    setHoja(null);
                    const [anio, mes] = fecha.split('-').map(Number);
                    setHecho(anio === periodo.anio && mes === periodo.mes ? 'Listo.' : `Listo: quedó en ${nombreDelMes(anio, mes)}.`);
                  }}
                  alBorrar={() => {
                    setHoja(null);
                    setHecho('Listo: movimiento borrado.');
                  }}
                />
              )}
            </>
          );
        }}
      </Consulta>
    </div>
  );
}

function Total({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-tarjeta border border-linea bg-sup p-4 shadow-tarjeta">
      <p className="font-mono text-xs tracking-wide text-gris uppercase">{rotulo}</p>
      <p className="mt-1 font-titulo text-3xl leading-none font-bold">{valor}</p>
      {nota && <p className="mt-1 text-sm text-gris">{nota}</p>}
    </div>
  );
}

type Campos = 'fecha' | 'rubro' | 'monto' | 'descripcion' | 'comprobante';

function HojaDeMovimiento({ clubId, movimiento, rubros, alCerrar, alGuardar, alBorrar }: {
  clubId: string;
  movimiento: Movimiento | null;
  rubros: Rubro[];
  alCerrar: () => void;
  alGuardar: (fecha: string) => void;
  alBorrar: () => void;
}) {
  const editando = movimiento !== null;
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoyLocal());
  const [rubroId, setRubroId] = useState(movimiento?.rubroId ?? '');
  const [monto, setMonto] = useState(movimiento ? montoParaEditar(movimiento.centavos) : '');
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? '');
  const [comprobante, setComprobante] = useState(movimiento?.comprobanteUrl ?? '');
  const [error, setError] = useState<{ texto: string; campo: Campos | null } | null>(null);
  const [borrando, setBorrando] = useState(false);

  const guardar = useAccionCoord((repo, fila: FilaDeMovimiento) =>
    editando ? repo.editarMovimiento(movimiento.id, fila) : repo.agregarMovimiento({ clubId, ...fila }),
  );
  const borrar = useAccionCoord((repo, id: string) => repo.borrarMovimiento(id));

  // Rubros que se ofrecen: los activos y, al editar, el que ya tenía aunque esté desactivado.
  const visibles = rubros.filter((r) => r.activo || r.id === movimiento?.rubroId);
  const grupo = (tipo: 'ingreso' | 'egreso', rotulo: string) => {
    const lista = visibles.filter((r) => r.tipo === tipo);
    return lista.length ? (
      <optgroup label={rotulo}>
        {lista.map((r) => <option key={r.id} value={r.id}>{r.nombre} ({tipo === 'ingreso' ? '+' : '−'})</option>)}
      </optgroup>
    ) : null;
  };

  const alIntentar = () => {
    const r = validarMovimiento(
      { fecha, rubroId, monto, descripcion, comprobanteUrl: comprobante },
      rubros,
      { rubroOriginal: movimiento?.rubroId ?? null },
    );
    if (r.error || !r.fila) {
      setError({ texto: r.error ?? 'Revisá los datos.', campo: (r.campo as Campos) ?? null });
      return;
    }
    setError(null);
    const fila = r.fila;
    guardar.mutate(fila, {
      onSuccess: () => alGuardar(fila.fecha),
      onError: (e) => setError({ texto: mensajeDeMovimiento(e), campo: null }),
    });
  };
  const de = (c: Campos) => (error?.campo === c ? error.texto : undefined);

  return (
    <>
      <Hoja abierta={!borrando} alCambiar={(a) => !a && alCerrar()} titulo={editando ? 'Editar movimiento' : 'Cargar movimiento'} descripcion="Fecha, rubro, monto y comprobante del movimiento" etiquetaCerrar="Cerrar">
        <div className="flex flex-col gap-4 p-5 pt-12">
          <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{editando ? 'Editar movimiento' : 'Cargar movimiento'}</h2>
          <Campo etiqueta="Fecha" type="date" min="2000-01-01" value={fecha} onChange={(e) => setFecha(e.target.value)} error={de('fecha')} />
          <div className="flex flex-col gap-1">
            <Seleccion etiqueta="Rubro" value={rubroId} onChange={(e) => setRubroId(e.target.value)} aria-invalid={de('rubro') ? true : undefined}>
              <option value="">Elegí un rubro</option>
              {grupo('ingreso', 'Ingresos')}
              {grupo('egreso', 'Egresos')}
            </Seleccion>
            {de('rubro') && <p className="text-sm font-medium text-club-texto">{de('rubro')}</p>}
          </div>
          <Campo
            etiqueta="Monto en pesos"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1.234,50"
            ayuda="Siempre positivo: si es ingreso o egreso lo dice el rubro."
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            error={de('monto')}
          />
          <Campo
            etiqueta="Descripción (opcional)"
            maxLength={LIMITE.descripcionMovimiento}
            autoComplete="off"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            error={de('descripcion')}
          />
          <Campo
            etiqueta="Link al comprobante (opcional)"
            type="url"
            inputMode="url"
            maxLength={LIMITE.enlace}
            autoComplete="off"
            placeholder="https://drive.google.com/…"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
            error={de('comprobante')}
          />
          {movimiento?.comprobanteUrl && (
            <a href={movimiento.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline">Abrir el comprobante</a>
          )}
          {error && error.campo === null && <Aviso tono="error" titulo={error.texto} />}
          <div className="flex flex-col gap-2">
            <Boton disabled={guardar.isPending} onClick={alIntentar}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Boton>
            {editando && <Boton variante="contorno" onClick={() => setBorrando(true)}>Borrar movimiento</Boton>}
            <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
          </div>
        </div>
      </Hoja>
      {editando && (
        <Confirmar
          abierta={borrando}
          alCerrar={() => setBorrando(false)}
          titulo="Borrar movimiento"
          texto={`${rubros.find((r) => r.id === movimiento.rubroId)?.nombre ?? 'Movimiento'} del ${fechaCorta(movimiento.fecha)} por ${formatearPesos(movimiento.centavos)}: deja de contar en los totales. Queda registrado quién lo borró y cuándo.`}
          verbo="Borrar"
          mensajeDeError={mensajeDeMovimiento}
          alConfirmar={async () => {
            await borrar.mutateAsync(movimiento.id);
            alBorrar();
          }}
        />
      )}
    </>
  );
}
