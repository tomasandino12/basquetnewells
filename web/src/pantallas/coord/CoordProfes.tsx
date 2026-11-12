import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { armarProfes } from '@datos/coordinacion.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton, claseBoton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Chip } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Hoja } from '../../components/ui/sheet';
import { useAccionCoord, useDatosDeProfes } from '../../coord/consultas';
import { Confirmar, Hecho, Rotulo, TITULO_DE_PANTALLA } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { PlantelDelClub } from '../../datos/repositorio';
import type { UsuarioPendiente } from '../../datos/repositorioCoord';
import { cn } from '../../lib/cn';
import { HojaDeEmergencias } from './HojaDeEmergencias';
import { useClubCoord } from './MarcoCoord';

const REGLAS: [RegExp, string][] = [
  [/SIN_CATEGORIAS/, 'Marcá al menos una categoría.'],
  [/NO_ES_ENTRENADOR/, 'Esa cuenta es de coordinación. Para que además entrene, hay que dárselo desde la base.'],
  [/YA_ES_DEL_CLUB/, 'Esa cuenta ya es del club. Actualizá la lista.'],
  [/ES_JUGADOR/, 'Esa cuenta es de un jugador: se la puede habilitar como profe, no rechazar.'],
  [/DADO_DE_BAJA/, 'Esa cuenta está dada de baja: reactivarla no se hace desde acá.'],
  [/ES_COORDINACION/, 'Esa cuenta es de coordinación: no se la puede dar de baja desde acá.'],
  [/NO_ES_UNO_MISMO/, 'No podés darte de baja a vos mismo.'],
  [/YA_DADO_DE_BAJA/, 'Esa cuenta ya está dada de baja.'],
  [/NO_SE_PUDO_CERRAR|row-level security|permission denied|42501/i, 'No tenés permiso para hacer eso. Si creés que es un error, volvé a entrar.'],
];
export const mensajeDeProfes = (e: unknown) => mensajeDeGuardado(e, 'No se pudo guardar. Probá de nuevo.', REGLAS);

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

interface Profe {
  userId: string;
  etiqueta: string;
  email: string;
  esEntrenador: boolean;
  esCoordinador: boolean;
  esUnoMismo: boolean;
  bajaEn: string | null;
  categorias: { asignacionId: string; plantelId: string; etiqueta: string; origen: string | null }[];
}

type Abierta =
  | { tipo: 'habilitar'; pendiente: UsuarioPendiente }
  | { tipo: 'rechazar'; pendiente: UsuarioPendiente }
  | { tipo: 'asignar-a'; profe: Profe }
  | { tipo: 'elegir-profe'; plantel: PlantelDelClub }
  | { tipo: 'quitar'; profe: Profe; categoria: Profe['categorias'][number] }
  | { tipo: 'baja'; profe: Profe }
  | { tipo: 'emergencias'; plantel: PlantelDelClub };

/**
 * Quién tiene acceso a qué, y el único lugar desde donde se cambia. Lo que se ve lo garantiza la base,
 * no esta pantalla: la pantalla sólo evita ofrecer lo que la base va a rechazar (por ejemplo, que el
 * coordinador se asigne a sí mismo).
 */
export function CoordProfes() {
  const clubId = useClubCoord();
  const datos = useDatosDeProfes(clubId);
  const [hoja, setHoja] = useState<Abierta | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const cerrar = () => setHoja(null);
  const listo = (texto: string) => {
    setHoja(null);
    setHecho(texto);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITULO_DE_PANTALLA}>Profes</h1>
        <Link to="/coordinacion/temporada" className={claseBoton({ variante: 'secundario', tamano: 'chico' })}>Cambio de temporada</Link>
      </div>
      <Hecho texto={hecho} />
      <Consulta consulta={datos} errorGenerico="No se pudo cargar la lista de profes.">
        {(d) => (
          <Contenido
            datos={d}
            clubId={clubId}
            hoja={hoja}
            abrir={setHoja}
            cerrar={cerrar}
            listo={listo}
          />
        )}
      </Consulta>
    </div>
  );
}

type Datos = NonNullable<ReturnType<typeof useDatosDeProfes>['data']>;

function Contenido({ datos, clubId, hoja, abrir, cerrar, listo }: {
  datos: Datos;
  clubId: string;
  hoja: Abierta | null;
  abrir: (h: Abierta) => void;
  cerrar: () => void;
  listo: (texto: string) => void;
}) {
  const vista = useMemo(() => armarProfes(datos) as {
    plantelesDeLaTemporada: PlantelDelClub[];
    pendientes: UsuarioPendiente[];
    profes: Profe[];
    sinProfe: PlantelDelClub[];
  }, [datos]);
  const activos = vista.profes.filter((p) => !p.bajaEn);
  const exMiembros = vista.profes.filter((p) => p.bajaEn);

  // Los códigos de Mayores no se leen solos: se aclaran una vez, acá arriba, desde el catálogo.
  const mayores = datos.catalogo.filter((c) => c.codigo.startsWith('MAY_') && vista.plantelesDeLaTemporada.some((p) => p.categoriaCodigo === c.codigo));
  const notaCodigos = mayores.length
    ? `${mayores.map((c) => c.codigo).join(' y ')} ${mayores.length === 1 ? 'es' : 'son'} ${mayores.map((c) => c.nombre).join(' y ')}.`
    : '';

  const asignar = useAccionCoord((repo, v: { userId: string; plantelIds: string[] }) => repo.asignarPlanteles({ clubId, ...v }));
  const descartar = useAccionCoord((repo, userId: string) => repo.descartarCuenta({ userId, clubId }));
  const quitar = useAccionCoord((repo, asignacionId: string) => repo.cerrarAsignacion(asignacionId));
  const baja = useAccionCoord((repo, userId: string) => repo.darDeBajaProfe({ userId, clubId }));

  return (
    <>
      {notaCodigos && <p className="mb-4 text-sm text-gris">{notaCodigos}</p>}

      <div className="grid gap-x-8 lg:grid-cols-2">
        <div>
          <section aria-label="Esperando acceso">
            <Rotulo cuenta={vista.pendientes.length}>Esperando acceso</Rotulo>
            {vista.pendientes.length === 0 ? (
              <p className="text-sm text-gris">No hay cuentas esperando acceso.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {vista.pendientes.map((u) => (
                  <li key={u.userId} className="flex flex-wrap items-center gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{u.nombre || u.email}</p>
                      <p className="text-xs text-gris">
                        {u.nombre ? `${u.email} · ` : ''}{u.esJugador ? 'Es jugador del club · ' : ''}Se registró el {fechaCorta(u.registradoEn)}
                      </p>
                    </div>
                    {!u.esJugador && <Boton variante="contorno" tamano="chico" onClick={() => abrir({ tipo: 'rechazar', pendiente: u })}>Rechazar</Boton>}
                    <Boton tamano="chico" onClick={() => abrir({ tipo: 'habilitar', pendiente: u })}>Habilitar</Boton>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <BuscarJugador clubId={clubId} alEncontrar={(u) => abrir({ tipo: 'habilitar', pendiente: u })} />

          <section aria-label="Datos de emergencia">
            <Rotulo>Datos de emergencia</Rotulo>
            <p className="mb-2 text-sm text-gris">Teléfonos y alertas médicas de cada categoría, sólo para leer. Los carga el profe de la categoría.</p>
            <div className="flex flex-wrap gap-2">
              {vista.plantelesDeLaTemporada.map((p) => (
                <Boton key={p.id} variante="contorno" tamano="chico" onClick={() => abrir({ tipo: 'emergencias', plantel: p })}>{p.categoria}</Boton>
              ))}
            </div>
          </section>

          <section aria-label="Categorías sin profe">
            <Rotulo>Categorías sin profe</Rotulo>
            {vista.sinProfe.length === 0 ? (
              <p className="text-sm text-gris">Todas las categorías de la temporada tienen al menos un profe.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {vista.sinProfe.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3">
                    <span className="font-semibold">{p.categoria}</span>
                    <Boton variante="contorno" tamano="chico" onClick={() => abrir({ tipo: 'elegir-profe', plantel: p })}>Asignar</Boton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section aria-label="Profes del club">
            <Rotulo cuenta={activos.length}>Profes del club</Rotulo>
            <ul className="flex flex-col gap-2">
              {activos.map((p) => {
                const roles = [p.esEntrenador && 'Entrenador', p.esCoordinador && 'Coordinación'].filter(Boolean).join(' · ');
                // El propio coordinador no se edita desde acá (la base lo rechaza), y a un coordinador puro no se le asignan categorías.
                const editable = p.esEntrenador && !p.esUnoMismo;
                const sePuedeDarDeBaja = !p.esUnoMismo && !p.esCoordinador;
                return (
                  <li key={p.userId} className="flex flex-col gap-2 rounded-tarjeta border border-linea bg-sup px-4 py-3">
                    <div>
                      <p className="font-semibold">{p.etiqueta}{p.esUnoMismo && <span className="font-normal text-gris"> (vos)</span>}</p>
                      <p className="text-xs text-gris">{roles}{p.etiqueta !== p.email ? ` · ${p.email}` : ''}</p>
                    </div>
                    {p.categorias.length > 0 ? (
                      <ul className="flex flex-col gap-1">
                        {p.categorias.map((c) => (
                          <li key={c.asignacionId} className="flex items-center justify-between gap-2">
                            <span>
                              <span className="font-semibold">{c.etiqueta}</span>
                              {c.origen === 'migracion' && <span className="block text-xs text-gris">Asignada al activar el panel — confirmá que corresponde</span>}
                            </span>
                            {editable && <Boton variante="contorno" tamano="chico" aria-label={`Quitar ${c.etiqueta} a ${p.etiqueta}`} onClick={() => abrir({ tipo: 'quitar', profe: p, categoria: c })}>Quitar</Boton>}
                          </li>
                        ))}
                      </ul>
                    ) : p.esEntrenador ? <Chip className="self-start">Sin categorías</Chip> : null}
                    {(editable || sePuedeDarDeBaja) && (
                      <div className="flex flex-wrap gap-2">
                        {editable && <Boton variante="contorno" tamano="chico" aria-label={`Asignar categorías a ${p.etiqueta}`} onClick={() => abrir({ tipo: 'asignar-a', profe: p })}>Asignar categorías</Boton>}
                        {sePuedeDarDeBaja && <Boton variante="contorno" tamano="chico" aria-label={`Dar de baja a ${p.etiqueta}`} onClick={() => abrir({ tipo: 'baja', profe: p })}>Dar de baja</Boton>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          {exMiembros.length > 0 && (
            <details className="mt-6 rounded-tarjeta border border-linea bg-sup px-4 py-3">
              <summary className="min-h-11 cursor-pointer font-semibold">Ex miembros del club ({exMiembros.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {exMiembros.map((p) => (
                  <li key={p.userId}>
                    <p className="font-semibold">{p.etiqueta}</p>
                    <p className="text-xs text-gris">{p.etiqueta !== p.email ? `${p.email} · ` : ''}Dado de baja el {fechaCorta(p.bajaEn!)}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {hoja?.tipo === 'habilitar' && (() => {
        const u = hoja.pendiente;
        const quien = u.nombre || u.email;
        return (
          <ElegirCategorias
            titulo="Habilitar"
            texto={`${quien} va a poder entrar como entrenador y ver sólo las categorías que marques. La biblioteca de ejercicios la ve entera.${u.esJugador ? ' Como hoy es jugador del club, su acceso de jugador se cierra: deja de ver su ficha y pasa a entrar sólo como profe.' : ''}`}
            planteles={vista.plantelesDeLaTemporada}
            textoBoton="Habilitar y asignar"
            alCerrar={cerrar}
            alConfirmar={async (plantelIds) => {
              const r = await asignar.mutateAsync({ userId: u.userId, plantelIds });
              listo(`Listo: ${quien} ya puede entrar, con ${r.asignadas} categoría${r.asignadas === 1 ? '' : 's'}.`);
            }}
          />
        );
      })()}
      {hoja?.tipo === 'asignar-a' && (() => {
        const p = hoja.profe;
        const yaTiene = new Set(p.categorias.map((c) => c.plantelId));
        return (
          <ElegirCategorias
            titulo={`Asignar a ${p.etiqueta}`}
            texto="Marcá las categorías que suma. Las que ya tiene no aparecen."
            planteles={vista.plantelesDeLaTemporada.filter((x) => !yaTiene.has(x.id))}
            textoBoton="Asignar"
            alCerrar={cerrar}
            alConfirmar={async (plantelIds) => {
              await asignar.mutateAsync({ userId: p.userId, plantelIds });
              listo('Listo.');
            }}
          />
        );
      })()}
      {hoja?.tipo === 'elegir-profe' && (
        <ElegirProfe
          plantel={hoja.plantel}
          candidatos={activos.filter((p) => p.esEntrenador && !p.esUnoMismo)}
          alCerrar={cerrar}
          alElegir={async (userId) => {
            await asignar.mutateAsync({ userId, plantelIds: [hoja.plantel.id] });
            listo('Listo.');
          }}
        />
      )}
      <Confirmar
        abierta={hoja?.tipo === 'rechazar'}
        alCerrar={cerrar}
        titulo="Rechazar"
        texto={hoja?.tipo === 'rechazar' ? `${hoja.pendiente.nombre || hoja.pendiente.email} sale de la lista y no entra a la app. Si fue un error, puede volver a pedir el acceso desde su cuenta y va a aparecer de nuevo acá.` : ''}
        verbo="Rechazar"
        mensajeDeError={mensajeDeProfes}
        alConfirmar={async () => {
          if (hoja?.tipo !== 'rechazar') return;
          await descartar.mutateAsync(hoja.pendiente.userId);
          listo(`Listo: ${hoja.pendiente.nombre || hoja.pendiente.email} ya no figura en la lista.`);
        }}
      />
      <Confirmar
        abierta={hoja?.tipo === 'quitar'}
        alCerrar={cerrar}
        titulo={hoja?.tipo === 'quitar' ? `Quitar ${hoja.categoria.etiqueta}` : 'Quitar'}
        texto={hoja?.tipo === 'quitar' ? `${hoja.profe.etiqueta} deja de ver ${hoja.categoria.etiqueta} desde ahora. Lo que cargó queda en el club, y la asignación queda registrada con su fecha de cierre.` : ''}
        verbo={hoja?.tipo === 'quitar' ? `Quitar ${hoja.categoria.etiqueta}` : 'Quitar'}
        mensajeDeError={mensajeDeProfes}
        alConfirmar={async () => {
          if (hoja?.tipo !== 'quitar') return;
          await quitar.mutateAsync(hoja.categoria.asignacionId);
          listo(`Listo: ${hoja.profe.etiqueta} ya no ve ${hoja.categoria.etiqueta}.`);
        }}
      />
      <Confirmar
        abierta={hoja?.tipo === 'baja'}
        alCerrar={cerrar}
        titulo={hoja?.tipo === 'baja' ? `Dar de baja a ${hoja.profe.etiqueta}` : 'Dar de baja'}
        texto={hoja?.tipo === 'baja' ? `${hoja.profe.etiqueta} deja de ver el plantel entero desde ahora. Lo que cargó queda en el club; su historia no se borra.` : ''}
        verbo="Dar de baja"
        mensajeDeError={mensajeDeProfes}
        alConfirmar={async () => {
          if (hoja?.tipo !== 'baja') return;
          await baja.mutateAsync(hoja.profe.userId);
          listo(`Listo: ${hoja.profe.etiqueta} está dado de baja.`);
        }}
      />
      {hoja?.tipo === 'emergencias' && <HojaDeEmergencias plantel={hoja.plantel} alCerrar={cerrar} />}
    </>
  );
}

function BuscarJugador({ clubId, alEncontrar }: { clubId: string; alEncontrar: (u: UsuarioPendiente) => void }) {
  const [email, setEmail] = useState('');
  const [texto, setTexto] = useState<string | null>(null);
  const buscar = useAccionCoord((repo, mail: string) => repo.buscarJugadorParaHabilitar({ clubId, email: mail }));
  return (
    <section aria-label="Buscar un jugador" className="mt-6">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const limpio = email.trim();
          if (!limpio) return;
          setTexto(null);
          buscar.mutate(limpio, {
            onSuccess: (u) => (u ? alEncontrar(u) : setTexto('No encontramos ningún jugador con ese mail en el club.')),
            onError: (err) => setTexto(mensajeDeProfes(err)),
          });
        }}
      >
        <Campo
          etiqueta="¿Un jugador va a ser profe? Buscalo por mail"
          type="email"
          autoComplete="off"
          spellCheck={false}
          placeholder="mail@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Boton type="submit" variante="contorno" tamano="chico" disabled={buscar.isPending} className="self-start">Buscar</Boton>
        {texto && <p role="status" className="text-sm text-gris">{texto}</p>}
      </form>
    </section>
  );
}

/** Marcar una o varias categorías y confirmar: sirve para habilitar a alguien y para sumarle categorías a un profe. */
function ElegirCategorias({ titulo, texto, planteles, textoBoton, alCerrar, alConfirmar }: {
  titulo: string;
  texto: string;
  planteles: PlantelDelClub[];
  textoBoton: string;
  alCerrar: () => void;
  alConfirmar: (plantelIds: string[]) => Promise<void>;
}) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={titulo} descripcion={texto} etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{titulo}</h2>
        <p className="text-sm text-gris">{texto}</p>
        {planteles.length === 0 ? (
          <p className="text-sm font-semibold">No quedan categorías de esta temporada para asignar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {planteles.map((p) => {
              const marcado = elegidos.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => setElegidos((s) => {
                      const n = new Set(s);
                      if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                      return n;
                    })}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-campo border border-borde-control px-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
                  >
                    <span className="font-semibold">{p.categoria}</span>
                    <span aria-hidden className={cn('grid size-6 place-items-center rounded-[0.3125rem] border', marcado ? 'border-tinta bg-tinta text-sup' : 'border-borde-control')}>
                      {marcado && <Check className="size-4" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <Aviso tono="error" titulo={error} />}
        <div className="flex flex-col gap-2">
          <Boton
            disabled={ocupado || elegidos.size === 0}
            onClick={async () => {
              setOcupado(true);
              setError(null);
              try {
                await alConfirmar([...elegidos]);
              } catch (e) {
                setError(mensajeDeProfes(e));
                setOcupado(false);
              }
            }}
          >
            {ocupado ? 'Guardando…' : textoBoton}
          </Boton>
          <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
        </div>
      </div>
    </Hoja>
  );
}

function ElegirProfe({ plantel, candidatos, alCerrar, alElegir }: {
  plantel: PlantelDelClub;
  candidatos: Profe[];
  alCerrar: () => void;
  alElegir: (userId: string) => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={`Asignar ${plantel.categoria}`} descripcion={`Elegí quién queda a cargo de ${plantel.categoria}`} etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">Asignar {plantel.categoria}</h2>
        {candidatos.length === 0 ? (
          <p className="text-sm font-semibold">Todavía no hay entrenadores habilitados. Habilitá a alguien desde «Esperando acceso».</p>
        ) : (
          <>
            <p className="text-sm text-gris">¿Quién queda a cargo de {plantel.categoria}?</p>
            <ul className="flex flex-col gap-2">
              {candidatos.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={async () => {
                      setOcupado(true);
                      setError(null);
                      try {
                        await alElegir(p.userId);
                      } catch (e) {
                        setError(mensajeDeProfes(e));
                        setOcupado(false);
                      }
                    }}
                    className="flex min-h-11 w-full items-center rounded-campo border border-borde-control px-3 text-left font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-50"
                  >
                    {p.etiqueta}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <Aviso tono="error" titulo={error} />}
        <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
      </div>
    </Hoja>
  );
}
