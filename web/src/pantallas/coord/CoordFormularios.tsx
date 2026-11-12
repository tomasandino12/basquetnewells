import { ArrowDown, ArrowUp, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { DESTINOS, MENSAJE_ENLACE_FORMULARIO, moverFormulario, ordenarFormularios, validarFormulario } from '@datos/formulariosPortal.js';
import { quienTieneElDestino } from '../../coord/validaciones';
import { LIMITE } from '@datos/limites.js';
import { PORTAL } from '@datos/portal.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton, claseBoton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Chip } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { Hoja } from '../../components/ui/sheet';
import { useAccionCoord, useFormularios } from '../../coord/consultas';
import { Hecho, Rotulo, Seleccion, TITULO_DE_PANTALLA } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { DatosDeFormulario, FormularioDelPortal } from '../../datos/repositorioCoord';
import { useClubCoord } from './MarcoCoord';

const REGLAS: [RegExp, string][] = [[/formulario_portal_enlace_google/, MENSAJE_ENLACE_FORMULARIO]];
const mensajeDeFormulario = (e: unknown) => mensajeDeGuardado(e, 'No se pudo guardar el formulario. Probá de nuevo.', REGLAS);
const rotuloDeDestino = (clave: string | null) => DESTINOS.find((d: { clave: string }) => d.clave === clave)?.chip ?? '';

/**
 * Los formularios que las familias ven en la página pública del básquet. Los carga la coordinación.
 * Un formulario no se borra: se oculta. Lo que se escribe acá lo ve cualquiera, sin sesión.
 */
export function CoordFormularios() {
  const clubId = useClubCoord();
  const datos = useFormularios(clubId);
  const [hoja, setHoja] = useState<{ formulario: FormularioDelPortal | null; inicial?: DatosDeFormulario } | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [errorAlMover, setErrorAlMover] = useState<string | null>(null);
  const mover = useAccionCoord((repo, cambios: unknown[]) => repo.reordenarFormularios(cambios));

  const lista: FormularioDelPortal[] = datos.data ? ordenarFormularios(datos.data) : [];
  const alMover = (id: string, direccion: 'subir' | 'bajar') => {
    const { cambios } = moverFormulario(lista, id, direccion);
    if (!cambios.length || mover.isPending) return;
    setErrorAlMover(null);
    // Si algo falla, la lista se vuelve a pedir y se ve lo que hay de verdad en la base.
    mover.mutate(cambios, { onError: (e) => setErrorAlMover(mensajeDeFormulario(e)) });
  };
  const inscripcionDePrueba = PORTAL.formularios[0] as DatosDeFormulario | undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITULO_DE_PANTALLA}>Formularios</h1>
        <div className="flex gap-2">
          <Link to="/coordinacion/familias" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Volver a Familias</Link>
          <Boton onClick={() => setHoja({ formulario: null })}>Agregar formulario</Boton>
        </div>
      </div>
      <p className="mb-2 max-w-3xl text-sm text-gris">
        Esto lo ve cualquiera que abra la página del básquet, sin entrar con ninguna cuenta: no pongas nombres de chicos ni datos personales.
        Cada formulario lleva una línea que le cuenta a la familia para qué es y qué tiene que tener a mano.
      </p>
      <p className="mb-4 text-sm"><a href="/" target="_blank" rel="noopener" className="font-semibold underline">Ver cómo lo ven las familias</a></p>
      <Hecho texto={hecho} />
      {errorAlMover && <Aviso tono="error" titulo={errorAlMover} className="mb-4" />}
      <Consulta consulta={datos} errorGenerico="No se pudieron cargar los formularios.">
        {() =>
          lista.length === 0 ? (
            <Vacio
              icono={FileText}
              titulo="Todavía no hay formularios"
              accion={inscripcionDePrueba && <Boton variante="contorno" onClick={() => setHoja({ formulario: null, inicial: inscripcionDePrueba })}>Agregar el de Inscripción</Boton>}
            >
              Sumá los que necesiten las familias: inscripción, pase, rifas, aranceles…
            </Vacio>
          ) : (
            <section aria-label="En la página">
              <Rotulo cuenta={`${lista.filter((f) => f.activo).length} a la vista`}>En la página</Rotulo>
              <ul className="grid gap-2 lg:grid-cols-2">
                {lista.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-2 rounded-tarjeta border border-linea bg-sup px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setHoja({ formulario: f })}
                      className="min-h-11 min-w-0 flex-1 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
                    >
                      <span className="block font-semibold">{f.titulo}</span>
                      <span className="block truncate text-xs text-gris">{f.texto}</span>
                    </button>
                    {f.destino && <Chip>{rotuloDeDestino(f.destino)}</Chip>}
                    {!f.activo && <Chip>Oculto</Chip>}
                    <button
                      type="button"
                      aria-label={`Subir ${f.titulo}`}
                      disabled={i === 0 || mover.isPending}
                      onClick={() => alMover(f.id, 'subir')}
                      className="grid size-11 place-items-center rounded-full outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-30"
                    >
                      <ArrowUp aria-hidden className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Bajar ${f.titulo}`}
                      disabled={i === lista.length - 1 || mover.isPending}
                      onClick={() => alMover(f.id, 'bajar')}
                      className="grid size-11 place-items-center rounded-full outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-30"
                    >
                      <ArrowDown aria-hidden className="size-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        }
      </Consulta>
      {hoja && (
        <HojaDeFormulario
          clubId={clubId}
          formulario={hoja.formulario}
          inicial={hoja.inicial}
          lista={lista}
          alCerrar={() => setHoja(null)}
          alGuardar={() => {
            setHoja(null);
            setHecho('Listo.');
          }}
        />
      )}
    </div>
  );
}

function HojaDeFormulario({ clubId, formulario, inicial, lista, alCerrar, alGuardar }: {
  clubId: string;
  formulario: FormularioDelPortal | null;
  inicial?: DatosDeFormulario;
  lista: FormularioDelPortal[];
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const v = formulario ?? inicial ?? { titulo: '', texto: '', enlace: '', destino: null };
  const [titulo, setTitulo] = useState(v.titulo);
  const [texto, setTexto] = useState(v.texto);
  const [enlace, setEnlace] = useState(v.enlace);
  const [destino, setDestino] = useState(v.destino ?? '');
  const [error, setError] = useState<{ texto: string; campo: 'titulo' | 'texto' | 'enlace' | 'destino' | null } | null>(null);
  const guardar = useAccionCoord(async (repo, pedido: { datos: DatosDeFormulario; poseedor: FormularioDelPortal | null; orden: number }) => {
    const { datos, poseedor, orden } = pedido;
    // El índice único de la base no deja dos con el mismo destino: primero se lo sacamos al que lo tiene, después se guarda.
    if (poseedor) await repo.asignarDestinoFormulario(poseedor.id, null);
    try {
      if (formulario) await repo.actualizarFormulario(formulario.id, { ...datos, activo: formulario.activo });
      else await repo.crearFormulario({ clubId, ...datos, orden });
    } catch (e) {
      // Si no se pudo guardar, el que lo tenía no se queda sin su lugar.
      if (poseedor && datos.destino) await repo.asignarDestinoFormulario(poseedor.id, datos.destino).catch(() => {});
      throw e;
    }
  });
  const alternar = useAccionCoord((repo, f: FormularioDelPortal) =>
    repo.actualizarFormulario(f.id, { titulo: f.titulo, texto: f.texto, enlace: f.enlace, destino: f.destino, activo: !f.activo }),
  );

  const otro = quienTieneElDestino(lista, destino || null, formulario?.id ?? null);
  const ocupado = guardar.isPending || alternar.isPending;
  const de = (c: string) => (error?.campo === c ? error.texto : undefined);

  const alIntentar = () => {
    const r = validarFormulario({ titulo, texto, enlace, destino });
    if (r.error || !r.formulario) {
      const campo = /título/i.test(r.error ?? '') ? 'titulo' : /enlace/i.test(r.error ?? '') ? 'enlace' : /cómo se muestra/i.test(r.error ?? '') ? 'destino' : 'texto';
      setError({ texto: r.error ?? '', campo });
      return;
    }
    setError(null);
    const orden = Math.min(1000, (lista[lista.length - 1]?.orden ?? 0) + 1);
    guardar.mutate(
      { datos: r.formulario, poseedor: quienTieneElDestino(lista, r.formulario.destino, formulario?.id ?? null), orden },
      { onSuccess: alGuardar, onError: (e) => setError({ texto: mensajeDeFormulario(e), campo: null }) },
    );
  };

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={formulario ? formulario.titulo : 'Agregar formulario'} descripcion="Título, texto, enlace y lugar del formulario en la página de las familias" etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{formulario ? formulario.titulo : 'Agregar formulario'}</h2>
        <Campo etiqueta="Título" value={titulo} maxLength={LIMITE.titulo} autoComplete="off" placeholder="Ej.: Comprobante de rifas" onChange={(e) => setTitulo(e.target.value)} error={de('titulo')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="form-texto" className="text-sm font-semibold">Para qué es y qué tienen que tener a mano</label>
          <textarea
            id="form-texto"
            rows={4}
            value={texto}
            maxLength={LIMITE.textoFormulario}
            placeholder="Ej.: Para subir la foto del comprobante de pago de las rifas. Tené a mano la foto del comprobante."
            aria-invalid={de('texto') ? true : undefined}
            onChange={(e) => setTexto(e.target.value)}
            className="w-full rounded-campo border border-borde-control bg-sup px-3 py-2 text-base outline-offset-2 placeholder:text-gris focus-visible:outline-2 focus-visible:outline-tinta"
          />
          {de('texto') && <p className="text-sm font-medium text-club-texto">{de('texto')}</p>}
        </div>
        <Campo
          etiqueta="Enlace del formulario"
          type="url"
          inputMode="url"
          maxLength={LIMITE.enlace}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://forms.gle/…"
          ayuda={`Pegá el enlace de Google Forms (empieza con https://docs.google.com/forms o https://forms.gle).${formulario ? (formulario.activo ? ' Si lo ocultás, las familias dejan de verlo; podés volver a mostrarlo cuando quieras.' : ' Está oculto: las familias no lo ven.') : ''}`}
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          error={de('enlace')}
        />
        <div className="flex flex-col gap-1">
          <Seleccion etiqueta="Cómo se muestra en la página" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Común (en la lista de formularios)</option>
            {DESTINOS.map((d: { clave: string; rotulo: string }) => <option key={d.clave} value={d.clave}>{d.rotulo}</option>)}
          </Seleccion>
          {de('destino') && <p className="text-sm font-medium text-club-texto">{de('destino')}</p>}
          <p className="text-sm text-gris">
            Los lugares especiales son únicos: la inscripción es el botón principal de arriba (con la inscripción cerrada, es «Anotarse para probar», al que lleva el QR impreso); el comprobante está dentro de la hoja que abre el botón «Pagar»; colaborar tiene su sección; recaudación es la franja dorada de debajo del calendario.
          </p>
          {otro && <p role="status" className="text-sm font-semibold">Hoy lo tiene «{otro.titulo}»: al guardar, ese formulario pasa a ser común.</p>}
        </div>
        {error && error.campo === null && <Aviso tono="error" titulo={error.texto} />}
        <div className="flex flex-col gap-2">
          <Boton disabled={ocupado} onClick={alIntentar}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Boton>
          {formulario && (
            <Boton
              variante="contorno"
              disabled={ocupado}
              onClick={() => alternar.mutate(formulario, { onSuccess: alGuardar, onError: (e) => setError({ texto: mensajeDeFormulario(e), campo: null }) })}
            >
              {formulario.activo ? 'Ocultar de la página' : 'Mostrar en la página'}
            </Boton>
          )}
          <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
        </div>
      </div>
    </Hoja>
  );
}
