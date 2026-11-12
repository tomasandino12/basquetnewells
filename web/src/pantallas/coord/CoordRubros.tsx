import { Tags } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ROTULO_TIPO } from '@datos/finanzas.js';
import { nombreRepetido, validarRubro } from '../../coord/validaciones';
import { LIMITE } from '@datos/limites.js';
import { Boton, claseBoton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Chip } from '../../components/ui/chip';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { Hoja } from '../../components/ui/sheet';
import { useAccionCoord, useRubros } from '../../coord/consultas';
import { Hecho, Rotulo, TITULO_DE_PANTALLA } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { Rubro } from '../../datos/repositorioCoord';
import { cn } from '../../lib/cn';
import { useClubCoord } from './MarcoCoord';

const YA_EXISTE = 'Ya hay un rubro con ese nombre.';

/** El índice único de la base (23505) también dice «nombre repetido»: es el mismo caso. */
export const mensajeDeRubro = (e: unknown) =>
  (e as { code?: string } | null)?.code === '23505'
    ? YA_EXISTE
    : mensajeDeGuardado(e, 'No se pudo guardar el rubro. Probá de nuevo.', []);

/**
 * Rubros de finanzas: los nombres con que se agrupan ingresos y egresos. Un rubro no se borra: se
 * desactiva, porque los meses viejos lo siguen nombrando. El tipo no se cambia después de creado
 * (daría vuelta el signo de lo cargado).
 */
export function CoordRubros() {
  const clubId = useClubCoord();
  const rubros = useRubros(clubId);
  const [hoja, setHoja] = useState<{ rubro: Rubro | null } | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className={TITULO_DE_PANTALLA}>Rubros</h1>
        <div className="flex gap-2">
          <Link to="/coordinacion/finanzas" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Volver a Finanzas</Link>
          <Boton onClick={() => setHoja({ rubro: null })}>Agregar rubro</Boton>
        </div>
      </div>
      <p className="mb-4 text-sm text-gris">Usá nombres genéricos, nunca de personas: algún día este resumen puede mostrarse a las familias.</p>
      <Hecho texto={hecho} />
      <Consulta consulta={rubros} errorGenerico="No se pudieron cargar los rubros.">
        {(lista) =>
          lista.length === 0 ? (
            <Vacio icono={Tags} titulo="Todavía no hay rubros">
              Creá los de ingreso (por ejemplo, Patrocinios) y los de egreso (Arbitrajes, Alquiler de cancha) para empezar a cargar movimientos.
            </Vacio>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {(['ingreso', 'egreso'] as const).map((tipo) => {
                const delTipo = lista.filter((r) => r.tipo === tipo);
                if (!delTipo.length) return null;
                return (
                  <section key={tipo} aria-label={tipo === 'ingreso' ? 'Ingresos' : 'Egresos'}>
                    <Rotulo cuenta={delTipo.length}>{tipo === 'ingreso' ? 'Ingresos' : 'Egresos'}</Rotulo>
                    <ul className="flex flex-col gap-2">
                      {delTipo.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => setHoja({ rubro: r })}
                            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-tarjeta border border-linea bg-sup px-4 py-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta [@media(hover:hover)]:hover:border-tinta"
                          >
                            <span className={cn('font-semibold', !r.activo && 'text-gris')}>{r.nombre}</span>
                            {!r.activo && <Chip>Desactivado</Chip>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )
        }
      </Consulta>
      {hoja && (
        <HojaDeRubro
          clubId={clubId}
          rubro={hoja.rubro}
          rubros={rubros.data ?? []}
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

function HojaDeRubro({ clubId, rubro, rubros, alCerrar, alGuardar }: {
  clubId: string;
  rubro: Rubro | null;
  rubros: Rubro[];
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [nombre, setNombre] = useState(rubro?.nombre ?? '');
  const [tipo, setTipo] = useState<string | null>(rubro?.tipo ?? null);
  const [error, setError] = useState<{ texto: string; campo: 'nombre' | 'tipo' } | null>(null);
  const agregar = useAccionCoord((repo, v: { nombre: string; tipo: string }) => repo.agregarRubro({ clubId, ...v }));
  const editar = useAccionCoord((repo, v: { nombre?: string; activo?: boolean }) => repo.editarRubro(rubro!.id, v));
  const ocupado = agregar.isPending || editar.isPending;

  const fallo = (e: unknown) => setError({ texto: mensajeDeRubro(e), campo: 'nombre' });

  const guardar = () => {
    const r = validarRubro({ nombre, tipo });
    if (r.error || !r.fila) {
      setError({ texto: r.error ?? 'Revisá los datos.', campo: tipo ? 'nombre' : 'tipo' });
      return;
    }
    if (nombreRepetido(rubros, r.fila.nombre, rubro?.id ?? null)) {
      setError({ texto: YA_EXISTE, campo: 'nombre' });
      return;
    }
    setError(null);
    if (rubro) editar.mutate({ nombre: r.fila.nombre }, { onSuccess: alGuardar, onError: fallo });
    else agregar.mutate(r.fila, { onSuccess: alGuardar, onError: fallo });
  };

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo={rubro ? rubro.nombre : 'Agregar rubro'} descripcion="Nombre y tipo del rubro de finanzas" etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{rubro ? rubro.nombre : 'Agregar rubro'}</h2>
        <Campo
          etiqueta="Nombre"
          value={nombre}
          maxLength={LIMITE.nombreRubro}
          autoComplete="off"
          onChange={(e) => setNombre(e.target.value)}
          error={error?.campo === 'nombre' ? error.texto : undefined}
        />
        {rubro ? (
          <p className="text-sm text-gris">
            Tipo: {ROTULO_TIPO[rubro.tipo as 'ingreso' | 'egreso']}.{' '}
            {rubro.activo
              ? 'Si lo desactivás, no se ofrece al cargar, pero sigue sumando en los meses donde se usó.'
              : 'Está desactivado: no se ofrece al cargar.'}
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Tipo</legend>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROTULO_TIPO).map(([clave, rotulo]) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={tipo === clave}
                  onClick={() => setTipo(clave)}
                  className={cn(
                    'min-h-11 rounded-campo border px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                    tipo === clave ? 'border-tinta bg-tinta text-sup' : 'border-borde-control',
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <p className="text-sm text-gris">El tipo no se puede cambiar después.</p>
            {error?.campo === 'tipo' && <p className="text-sm font-medium text-club-texto">{error.texto}</p>}
          </fieldset>
        )}
        <div className="flex flex-col gap-2">
          <Boton disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
          {rubro && (
            <Boton
              variante="contorno"
              disabled={ocupado}
              onClick={() => editar.mutate({ activo: !rubro.activo }, { onSuccess: alGuardar, onError: fallo })}
            >
              {rubro.activo ? 'Desactivar' : 'Activar'}
            </Boton>
          )}
          <Boton variante="contorno" onClick={alCerrar}>Cancelar</Boton>
        </div>
      </div>
    </Hoja>
  );
}
