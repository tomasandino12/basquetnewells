import { Link2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  categoriaDeChico, conceptosDe, contadores, debeAlgo, envioViejo, estadoDePago, filtrar, haceCuanto, linkFila, porVerificar,
} from '@datos/estadoInscripcion.js';
import { linkCarpetaEnDrive } from '@datos/enlacesGoogle.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton, claseBoton } from '../../components/ui/button';
import { Chip, ChipBoton } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { Hoja } from '../../components/ui/sheet';
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from '../../components/ui/pestanas';
import { useAccionCoord, useEstadoDePapeles, useVinculosDeFamilia } from '../../coord/consultas';
import { Confirmar, Hecho, Rotulo, TITULO_DE_PANTALLA } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { ChicoDeInscripcion, ConexionGoogle, VinculoDeFamilia } from '../../datos/repositorioCoord';
import { cn } from '../../lib/cn';
import { useClubCoord } from './MarcoCoord';

/**
 * Familias: «Papeles y pagos» (lo que manda el script de Google, sólo lectura) y «Cuentas» (las
 * familias vinculadas). Acá nunca hay un DNI ni un archivo: los links llevan al tablero y a la carpeta de
 * Drive, y ahí manda Google con sus permisos.
 */
export function CoordFamilias({ pestanaInicial = 'papeles' }: { pestanaInicial?: 'papeles' | 'cuentas' }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITULO_DE_PANTALLA}>Familias</h1>
        <Link to="/coordinacion/formularios" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>
          Formularios de la página del básquet
        </Link>
      </div>
      <Pestanas defaultValue={pestanaInicial}>
        <ListaPestanas aria-label="Secciones de Familias">
          <Pestana value="papeles">Papeles y pagos</Pestana>
          <Pestana value="cuentas">Cuentas</Pestana>
        </ListaPestanas>
        <PanelPestana value="papeles"><Papeles /></PanelPestana>
        <PanelPestana value="cuentas"><Cuentas /></PanelPestana>
      </Pestanas>
    </div>
  );
}

/* ---------- Papeles y pagos ---------- */

const REGLAS_CONEXION: [RegExp, string][] = [[/42501|Sólo coordinación/, 'Sólo coordinación puede conectar con Google.']];

const BLOQUES = [
  { clave: 'ok', titulo: 'Chicos', ayuda: null },
  { clave: 'homonimo', titulo: 'Posible homónimo', ayuda: 'El nombre coincide con una ficha, pero la fecha de nacimiento no. Revisalo en el tablero antes de darlo por el mismo chico.' },
  { clave: 'sin_ficha', titulo: 'En Google, no en Semillero', ayuda: 'Están en el tablero y no tienen ficha en Semillero. Importalos desde Plantel → Importar inscriptos.' },
  { clave: 'sin_tablero', titulo: 'No figuran en el tablero', ayuda: 'Tienen ficha en un plantel y no se inscribieron en Google. Cuentan como que deben todo y les falta todo.' },
] as const;

const PAGO = {
  verificado: { texto: 'Verificado', clase: 'text-sube' },
  subido: { texto: 'Por verificar', clase: '' },
  falta: { texto: 'Falta', clase: 'text-club-texto' },
} as const;

const ESTADO_FILTROS = { categoria: null as string | null, debe: false, faltaDoc: false, verificar: false };

function Papeles() {
  const clubId = useClubCoord();
  const datos = useEstadoDePapeles(clubId);
  const [filtros, setFiltros] = useState(ESTADO_FILTROS);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [token, setToken] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<'cambiar' | 'desconectar' | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [errorToken, setErrorToken] = useState<string | null>(null);
  const rotar = useAccionCoord<void, string>((repo) => repo.rotarConexionGoogle(clubId));
  const desconectar = useAccionCoord<void>((repo) => repo.desconectarGoogle(clubId));
  const mensaje = (generico: string) => (e: unknown) => mensajeDeGuardado(e, generico, REGLAS_CONEXION);

  const generar = async () => {
    setErrorToken(null);
    try {
      setToken(await rotar.mutateAsync());
    } catch (e) {
      setErrorToken(mensaje('No se pudo generar el token. Probá de nuevo.')(e));
      throw e;
    }
  };

  return (
    <>
      <Hecho texto={hecho} />
      {errorToken && <Aviso tono="error" titulo={errorToken} className="mb-4" />}
      <Consulta consulta={datos} errorGenerico="No se pudo cargar el estado de papeles y pagos.">
        {({ chicos, conexion, catalogo }) => {
          const nombres = new Map(catalogo.map((c) => [c.codigo, c.nombre]));
          const conceptos: string[] = conceptosDe(chicos, conexion.conceptosOrden);
          const visibles: ChicoDeInscripcion[] = filtrar(chicos, { ...filtros, conceptos } as never);
          const codigos = [...new Set(chicos.map(categoriaDeChico).filter(Boolean) as string[])].sort();
          const nombreCategoria = (c: ChicoDeInscripcion) => {
            const codigo = categoriaDeChico(c);
            return codigo ? (nombres.get(codigo) ?? codigo) : (c.categoriaTexto ?? 'Sin categoría');
          };
          return (
            <>
              <Cabecera
                conexion={conexion}
                alConectar={() => generar().catch(() => {})}
                alCambiar={() => setConfirmar('cambiar')}
                alDesconectar={() => setConfirmar('desconectar')}
                conectando={rotar.isPending}
              />
              {chicos.length > 0 && (
                <>
                  <Contadores chicos={chicos} conceptos={conceptos} />
                  <div className="mt-4 flex flex-col gap-1">
                    <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap">
                      <ChipBoton activo={!filtros.categoria} onClick={() => setFiltros({ ...filtros, categoria: null })}>Todas</ChipBoton>
                      {codigos.map((k) => (
                        <ChipBoton key={k} activo={filtros.categoria === k} onClick={() => setFiltros({ ...filtros, categoria: k })}>{nombres.get(k) ?? k}</ChipBoton>
                      ))}
                    </div>
                    <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap">
                      <ChipBoton activo={filtros.debe} onClick={() => setFiltros({ ...filtros, debe: !filtros.debe })}>Debe algo</ChipBoton>
                      <ChipBoton activo={filtros.verificar} onClick={() => setFiltros({ ...filtros, verificar: !filtros.verificar })}>Por verificar</ChipBoton>
                      <ChipBoton activo={filtros.faltaDoc} onClick={() => setFiltros({ ...filtros, faltaDoc: !filtros.faltaDoc })}>Le falta documentación</ChipBoton>
                    </div>
                  </div>
                  {visibles.length === 0 && <p className="mt-4 text-sm text-gris">Ningún chico cumple esos filtros.</p>}
                  {BLOQUES.map((b) => {
                    const filas = visibles.filter((c) => c.emparejamiento === b.clave);
                    if (!filas.length) return null;
                    return (
                      <section key={b.clave} aria-label={b.titulo}>
                        <Rotulo cuenta={filas.length}>{b.titulo}</Rotulo>
                        {b.ayuda && <p className="mb-2 text-sm text-gris">{b.ayuda}</p>}
                        <ul className="grid gap-2 xl:grid-cols-2">
                          {filas.map((c) => (
                            <FilaDeChico
                              key={c.id}
                              chico={c}
                              conceptos={conceptos}
                              conexion={conexion}
                              categoria={nombreCategoria(c)}
                              abierto={abiertos.has(c.id)}
                              alAlternar={() => setAbiertos((s) => {
                                const n = new Set(s);
                                if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
                                return n;
                              })}
                            />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </>
              )}
            </>
          );
        }}
      </Consulta>

      <HojaDeToken token={token} alCerrar={() => setToken(null)} />
      <Confirmar
        abierta={confirmar === 'cambiar'}
        alCerrar={() => setConfirmar(null)}
        titulo="Cambiar el token"
        texto="El token anterior deja de servir ahora mismo: el script no manda nada hasta que pegues el nuevo."
        verbo="Cambiar"
        mensajeDeError={mensaje('No se pudo generar el token. Probá de nuevo.')}
        alConfirmar={async () => {
          setToken(await rotar.mutateAsync());
        }}
      />
      <Confirmar
        abierta={confirmar === 'desconectar'}
        alCerrar={() => setConfirmar(null)}
        titulo="Desconectar Google"
        texto="Se borra el token y todo el estado de papeles y pagos que mandó el script. Los archivos de Drive no se tocan. Para volver a conectar hay que generar un token nuevo."
        verbo="Desconectar"
        mensajeDeError={mensaje('No se pudo desconectar. Probá de nuevo.')}
        alConfirmar={async () => {
          await desconectar.mutateAsync();
          setHecho('Listo: Google quedó desconectado.');
        }}
      />
    </>
  );
}

function Cabecera({ conexion, alConectar, alCambiar, alDesconectar, conectando }: {
  conexion: ConexionGoogle;
  alConectar: () => void;
  alCambiar: () => void;
  alDesconectar: () => void;
  conectando: boolean;
}) {
  if (!conexion.conectado) {
    return (
      <Vacio icono={Link2} titulo="Todavía no llegó nada de Google" accion={<Boton disabled={conectando} onClick={alConectar}>Conectar con Google</Boton>}>
        Cuando el script del club esté conectado, acá vas a ver quién tiene los papeles y quién pagó, sin pedir fotos por WhatsApp.
      </Vacio>
    );
  }
  const gestion = (
    <div className="flex flex-wrap gap-2">
      {conexion.tableroUrl && (
        <a href={conexion.tableroUrl} target="_blank" rel="noopener noreferrer" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Abrir el tablero</a>
      )}
      <Boton variante="contorno" tamano="chico" onClick={alCambiar}>Cambiar el token</Boton>
      <Boton variante="contorno" tamano="chico" onClick={alDesconectar}>Desconectar</Boton>
    </div>
  );
  if (!conexion.ultimoEnvioEn) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Aviso titulo="Token generado: falta el primer envío de Google.">Si ya lo pegaste en el script, puede tardar unos minutos.</Aviso>
        {gestion}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-mono text-xs tracking-wide text-gris uppercase">Último envío · <span className="text-tinta">{haceCuanto(conexion.ultimoEnvioEn)}</span></p>
      {envioViejo(conexion.ultimoEnvioEn) && (
        <Aviso tono="error" titulo="Hace más de 2 horas que Google no manda nada.">
          Lo que ves puede estar desactualizado: revisá que el script siga andando.
        </Aviso>
      )}
      {gestion}
    </div>
  );
}

function Contadores({ chicos, conceptos }: { chicos: ChicoDeInscripcion[]; conceptos: string[] }) {
  const { porConcepto, documentacion } = contadores(chicos, conceptos) as {
    porConcepto: { concepto: string; verificado: number; subido: number; falta: number }[];
    documentacion: { completos: number; total: number };
  };
  return (
    <div className="mt-4 rounded-tarjeta border border-linea bg-sup p-4 shadow-tarjeta">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">Documentación completa</span>
        <Chip className="font-mono">{documentacion.completos}/{documentacion.total}</Chip>
      </div>
      {porConcepto.map((n) => (
        <div key={n.concepto} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-3">
          <span>{n.concepto}</span>
          <span className="flex flex-wrap gap-1.5">
            <Chip>{n.verificado} verif.</Chip>
            <Chip>{n.subido} por verif.</Chip>
            <Chip>{n.falta} faltan</Chip>
          </span>
        </div>
      ))}
    </div>
  );
}

function FilaDeChico({ chico, conceptos, conexion, categoria, abierto, alAlternar }: {
  chico: ChicoDeInscripcion;
  conceptos: string[];
  conexion: ConexionGoogle;
  categoria: string;
  abierto: boolean;
  alAlternar: () => void;
}) {
  const sinTablero = chico.emparejamiento === 'sin_tablero';
  const fila = sinTablero ? null : chico.fila;
  const tablero = linkFila(conexion, 'tablero', fila) as string | null;
  const pagos = linkFila(conexion, 'pagos', fila) as string | null;
  const carpeta = sinTablero ? null : (linkCarpetaEnDrive(chico.nombreGoogle ?? chico.nombre) as string | null);
  const enlace = claseBoton({ variante: 'contorno', tamano: 'chico' });
  return (
    <li className="rounded-tarjeta border border-linea bg-sup">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={alAlternar}
        className="flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{chico.nombre}</span>
          <span className="block text-xs text-gris">{categoria}</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Chip>{chico.completo === true ? 'Papeles completos' : chico.completo === false ? 'Faltan papeles' : 'Papeles sin datos'}</Chip>
          <Chip>{debeAlgo(chico, conceptos) ? 'Debe' : porVerificar(chico, conceptos) ? 'Por verificar' : 'Al día'}</Chip>
        </span>
      </button>
      {abierto && (
        <div className="flex flex-col gap-3 border-t border-linea px-4 py-3 text-sm">
          {sinTablero ? (
            <p className="text-gris">No figura en el tablero: no hay datos de papeles ni de pagos.</p>
          ) : (
            <div>
              <p className="mb-1 font-mono text-xs tracking-wide text-gris uppercase">Documentos</p>
              {conexion.documentosOrden.map((doc) => (
                <div key={doc} className="flex items-center justify-between gap-2 py-0.5">
                  <span>{doc}</span>
                  <Chip>{chico.documentos[doc] === true ? 'Está' : chico.documentos[doc] === false ? 'Falta' : 'Sin datos'}</Chip>
                </div>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1 font-mono text-xs tracking-wide text-gris uppercase">Pagos</p>
            {conceptos.map((k) => {
              const e = estadoDePago(chico, k) as keyof typeof PAGO;
              return (
                <div key={k} className="flex items-center justify-between gap-2 py-0.5">
                  <span>{k}</span>
                  <Chip className={cn(PAGO[e].clase)}>{PAGO[e].texto}</Chip>
                </div>
              );
            })}
          </div>
          {chico.cambioEn && <p className="text-xs text-gris">Cambió el {chico.cambioEn.slice(8, 10)}/{chico.cambioEn.slice(5, 7)}</p>}
          <div className="flex flex-wrap gap-2">
            {tablero && <a href={tablero} target="_blank" rel="noopener noreferrer" className={enlace}>Ver en el tablero</a>}
            {pagos && <a href={pagos} target="_blank" rel="noopener noreferrer" className={enlace}>Ver pagos</a>}
            {carpeta && <a href={carpeta} target="_blank" rel="noopener noreferrer" className={enlace}>Carpeta en Drive</a>}
          </div>
          {carpeta && <p className="text-xs text-gris">¿No aparece la carpeta? Buscala por el DNI en Drive: puede estar escrita distinto.</p>}
        </div>
      )}
    </li>
  );
}

/** El token se ve una sola vez (en la base queda su hash): se borra de la pantalla al cerrar la hoja. */
function HojaDeToken({ token, alCerrar }: { token: string | null; alCerrar: () => void }) {
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <Hoja
      abierta={token !== null}
      alCambiar={(a) => {
        if (!a) {
          setAviso(null);
          alCerrar();
        }
      }}
      titulo="Token del script de Google"
      descripcion="El token se ve una sola vez: copialo y pegalo en el script del club"
      etiquetaCerrar="Cerrar"
    >
      <div className="flex flex-col gap-3 p-5 pt-12 text-sm">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">Token del script de Google</h2>
        <p>Este token se ve <strong>una sola vez</strong>. Copialo ahora y pegalo en el script del club.</p>
        <p>1. Tocá <strong>Copiar</strong>.</p>
        <p>2. En el Apps Script del club: <em>Configuración del proyecto → Propiedades del script</em>, agregá <span className="font-mono">SEMILLERO_TOKEN</span> con este valor.</p>
        <p>3. Seguí la guía del script. En unos minutos el panel se llena solo.</p>
        <input
          readOnly
          aria-label="Token del script"
          value={token ?? ''}
          onFocus={(e) => e.target.select()}
          className="h-11 w-full rounded-campo border border-borde-control bg-sup px-3 font-mono text-sm"
        />
        {aviso && <p role="status" className="font-semibold">{aviso}</p>}
        <div className="flex flex-col gap-2">
          <Boton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(token ?? '');
                setAviso('Copiado.');
              } catch {
                setAviso('No se pudo copiar solo: seleccionalo y copialo a mano.');
              }
            }}
          >
            Copiar
          </Boton>
          <Boton variante="contorno" onClick={alCerrar}>Ya lo pegué</Boton>
        </div>
      </div>
    </Hoja>
  );
}

/* ---------- Cuentas (vínculos de familia) ---------- */

const REGLAS_VINCULO: [RegExp, string][] = [[/VINCULO_NO_ENCONTRADO/, 'Ese vínculo ya no está. Actualizá la lista.']];

function Cuentas() {
  const clubId = useClubCoord();
  const datos = useVinculosDeFamilia(clubId);
  const [baja, setBaja] = useState<VinculoDeFamilia | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const cerrar = useAccionCoord((repo, id: string) => repo.cerrarVinculoFamilia(id));
  return (
    <>
      <Hecho texto={hecho} />
      <Consulta consulta={datos} errorGenerico="No se pudieron cargar las familias.">
        {(vinculos) =>
          vinculos.length === 0 ? (
            <Vacio icono={Users} titulo="Todavía no hay familias vinculadas">
              Aparecen cuando un padre entra a la app con el mail con el que inscribió a su hijo y el profe ya cargó la inscripción en su categoría.
            </Vacio>
          ) : (
            <>
              <p className="mb-2 max-w-3xl text-sm text-gris">
                Cada familia se vincula sola, con el mail con el que inscribió a su hijo. Acá ves quién quedó vinculado con quién. Si algo no corresponde, dalo de baja.
              </p>
              <Rotulo cuenta={vinculos.length}>Vinculadas</Rotulo>
              <ul className="grid gap-2 xl:grid-cols-2">
                {vinculos.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{v.jugador}</p>
                      <p className="text-xs text-gris">{v.categorias ?? 'Sin categoría'}</p>
                      <p className="text-xs text-gris">Cuenta: {v.nombre ?? 'sin nombre'} · {v.emailEnmascarado} · desde el {v.desde.slice(8, 10)}/{v.desde.slice(5, 7)}</p>
                    </div>
                    <Boton variante="contorno" tamano="chico" onClick={() => setBaja(v)}>Dar de baja</Boton>
                  </li>
                ))}
              </ul>
            </>
          )
        }
      </Consulta>
      <Confirmar
        abierta={baja !== null}
        alCerrar={() => setBaja(null)}
        titulo="Dar de baja el vínculo"
        texto={baja ? `${baja.nombre ?? 'Esta cuenta'} (${baja.emailEnmascarado}) deja de ver a ${baja.jugador}. Si la familia vuelve a entrar, no se vuelve a vincular sola.` : ''}
        verbo="Dar de baja"
        mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo dar de baja. Probá de nuevo.', REGLAS_VINCULO)}
        alConfirmar={async () => {
          await cerrar.mutateAsync(baja!.id);
          setHecho('Listo: el vínculo se dio de baja.');
        }}
      />
    </>
  );
}
