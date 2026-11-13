import { useState, type FormEvent } from 'react';
import { normalizarMail } from '@datos/inscriptos.js';
import { LIMITE } from '@datos/limites.js';
import { Aviso } from '../../components/ui/aviso';
import { Boton } from '../../components/ui/button';
import { Campo } from '../../components/ui/campo';
import { Consulta } from '../../components/ui/consulta';
import { Hoja } from '../../components/ui/sheet';
import { Confirmar } from '../../coord/piezas';
import { mensajeDeGuardado } from '../../datos/errores';
import type { ResponsableDeJugador } from '../../datos/repositorio';
import { useAccion, useResponsables, useTieneCuenta } from '../../familias/consultas';
import { FILA_PLANA, RotuloDeBloque, TituloDeHoja } from './piezas';

/**
 * Lo que el profe maneja de la familia y del acceso de un chico, en su ficha:
 * - el acceso propio del chico (una cuenta de sólo lectura que se puede cerrar);
 * - los mails de la familia: quien entra a la app con alguno queda vinculada con el chico.
 */
export function FamiliaDelJugador({ clubId, jugadorId, nombre }: { clubId: string; jugadorId: string; nombre: string }) {
  return (
    <div className="flex flex-col gap-6">
      <AccesoDelJugador jugadorId={jugadorId} nombre={nombre} />
      <MailsDeLaFamilia clubId={clubId} jugadorId={jugadorId} nombre={nombre} />
    </div>
  );
}

/**
 * «Tiene acceso» y el botón para quitarlo. Quitarlo es cerrar la cuenta, no borrarla: el chico deja de
 * ver todo y queda escrito quién le dio y quién le sacó el acceso. Si la consulta falla no se dibuja
 * nada: es un agregado y la ficha no tiene que romperse por esto.
 */
function AccesoDelJugador({ jugadorId, nombre }: { jugadorId: string; nombre: string }) {
  const cuenta = useTieneCuenta(jugadorId);
  const revocar = useAccion((repo, id: string) => repo.revocarCuentaJugador(id));
  const [confirmando, setConfirmando] = useState(false);
  const [hecho, setHecho] = useState(false);
  if (!cuenta.data && !hecho) return null;
  return (
    <section aria-label="Acceso a la app" className="flex flex-col gap-2">
      <RotuloDeBloque>Acceso a la app</RotuloDeBloque>
      {hecho ? (
        <Aviso tono="ok" titulo="Acceso quitado" />
      ) : (
        <>
          <p className="text-sm">{nombre} tiene una cuenta propia, de sólo lectura: ve sus recursos, su plan y su progreso.</p>
          <div>
            <Boton variante="contorno" tamano="chico" onClick={() => setConfirmando(true)}>Quitarle el acceso</Boton>
          </div>
        </>
      )}
      <Confirmar
        abierta={confirmando}
        alCerrar={() => setConfirmando(false)}
        titulo="Quitarle el acceso"
        texto={`${nombre} deja de ver sus datos en la app. No se borra nada, y queda registrado quién le dio y quién le quitó el acceso. Si más adelante vuelve a pedirlo, se lo podés aprobar de nuevo.`}
        verbo="Quitarle el acceso"
        mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo quitar el acceso. Probá de nuevo.', [[/SIN_CUENTA_VIGENTE/, 'Ese chico ya no tiene una cuenta con acceso.']])}
        alConfirmar={async () => {
          await revocar.mutateAsync(jugadorId);
          setHecho(true);
        }}
      />
    </section>
  );
}

const REGLAS_MAIL: [RegExp, string][] = [[/duplicate key|23505/, 'Ese mail ya está cargado.']];

function MailsDeLaFamilia({ clubId, jugadorId, nombre }: { clubId: string; jugadorId: string; nombre: string }) {
  const datos = useResponsables(jugadorId);
  const quitar = useAccion((repo, id: string) => repo.quitarResponsable(id));
  const [agregando, setAgregando] = useState(false);
  const [aQuitar, setAQuitar] = useState<ResponsableDeJugador | null>(null);
  return (
    <section aria-label="Mails de la familia" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <RotuloDeBloque>Mails de la familia</RotuloDeBloque>
        <Boton variante="contorno" tamano="chico" onClick={() => setAgregando(true)}>Agregar</Boton>
      </div>
      <Consulta consulta={datos} errorGenerico="No se pudieron cargar los mails de la familia." filas={1}>
        {(lista) =>
          lista.length === 0 ? (
            <p className="text-sm text-gris">Todavía no hay ningún mail. Se cargan con «Importar inscriptos», o podés agregar uno a mano.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lista.map((r) => (
                <li key={r.id} className={`${FILA_PLANA} flex items-center gap-3`}>
                  <span className="min-w-0 flex-1 text-sm font-semibold break-all">{r.email}</span>
                  <Boton variante="contorno" tamano="chico" onClick={() => setAQuitar(r)}>Quitar</Boton>
                </li>
              ))}
            </ul>
          )
        }
      </Consulta>
      <p className="text-xs text-gris">La familia ve a este chico cuando entra a la app con alguno de estos mails.</p>

      {agregando && <HojaDeMail clubId={clubId} jugadorId={jugadorId} alCerrar={() => setAgregando(false)} />}
      <Confirmar
        abierta={aQuitar !== null}
        alCerrar={() => setAQuitar(null)}
        titulo="Quitar el mail"
        texto={aQuitar ? `${aQuitar.email} deja de poder ver a ${nombre}. Si ya estaba vinculada, la coordinación la da de baja desde Familias.` : ''}
        verbo="Quitar"
        mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo quitar. Probá de nuevo.')}
        alConfirmar={async () => {
          await quitar.mutateAsync(aQuitar!.id);
        }}
      />
    </section>
  );
}

function HojaDeMail({ clubId, jugadorId, alCerrar }: { clubId: string; jugadorId: string; alCerrar: () => void }) {
  const agregar = useAccion((repo, email: string) => repo.agregarResponsable(clubId, jugadorId, email));
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (agregar.isPending) return;
    const mail = normalizarMail(texto) as string | null;
    if (!mail) return setError('Ese mail no parece válido. Revisalo.');
    setError(null);
    try {
      await agregar.mutateAsync(mail);
    } catch (err) {
      setError(mensajeDeGuardado(err, 'No se pudo guardar el mail.', REGLAS_MAIL));
      return;
    }
    alCerrar();
  }

  return (
    <Hoja abierta alCambiar={(a) => !a && alCerrar()} titulo="Agregar un mail" descripcion="Sumar el mail de un familiar del chico" etiquetaCerrar="Cerrar">
      <form noValidate onSubmit={(e) => void guardar(e)} className="flex flex-col gap-4 p-5 pt-12">
        <TituloDeHoja>Agregar un mail</TituloDeHoja>
        <Campo
          etiqueta="Mail de la mamá, el papá o quien lo inscribió"
          type="email"
          inputMode="email"
          autoComplete="off"
          maxLength={LIMITE.mail}
          placeholder="nombre@ejemplo.com"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        {error && <Aviso tono="error" titulo={error} />}
        <Boton type="submit" disabled={agregar.isPending}>{agregar.isPending ? 'Guardando…' : 'Guardar'}</Boton>
      </form>
    </Hoja>
  );
}
