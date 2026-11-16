import { useState } from 'react';
import { hoyLocal, validarFechaNacimiento } from '@datos/antropometria.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Hoja } from '../components/ui/sheet';
import { useActualizarNacimiento } from '../datos/consultas';
import { mensajeDeError } from '../datos/errores';
import { TituloDeHoja } from './familias/piezas';

interface Props {
  clubId: string;
  jugadorId: string;
  nombre: string;
  /** 'YYYY-MM-DD' o null (no se sabe). */
  nacimiento: string | null;
}

/**
 * Corregir la fecha de nacimiento (un typeo, o un chico que entró por planilla y nunca la cargó).
 * Vacía significa «no se sabe», no cero: sin ella no se puede distinguir progreso de crecimiento.
 */
export function EditarNacimiento({ clubId, jugadorId, nombre, nacimiento }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [valor, setValor] = useState(nacimiento ?? '');
  const [errorDeCampo, setErrorDeCampo] = useState<string | undefined>();
  const guardar = useActualizarNacimiento(clubId);

  const abrir = (a: boolean) => {
    if (a) {
      setValor(nacimiento ?? '');
      setErrorDeCampo(undefined);
      guardar.reset();
    }
    setAbierta(a);
  };

  const enviar = () => {
    const r = validarFechaNacimiento(valor) as { ok: boolean; errores: string[]; valor: string | null };
    if (!r.ok) {
      setErrorDeCampo(r.errores.join(' '));
      return;
    }
    setErrorDeCampo(undefined);
    guardar.mutate({ jugadorId, fechaNacimiento: r.valor }, { onSuccess: () => setAbierta(false) });
  };

  return (
    <>
      <Boton variante="contorno" tamano="chico" onClick={() => abrir(true)}>Editar fecha de nacimiento</Boton>
      <Hoja abierta={abierta} alCambiar={abrir} titulo="Fecha de nacimiento" descripcion={`Corregir la fecha de nacimiento de ${nombre}`} etiquetaCerrar="Cerrar">
        <form
          noValidate
          className="flex flex-col gap-4 p-5 pt-10"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <TituloDeHoja>Fecha de nacimiento</TituloDeHoja>
          <Campo
            etiqueta="Fecha de nacimiento"
            type="date"
            max={hoyLocal() as string}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            error={errorDeCampo}
            ayuda="Vacía significa «no se sabe». Sin ella no se puede saber si una mejora es progreso o es crecimiento."
          />
          {guardar.isError && <Aviso tono="error" titulo="No se pudo guardar">{mensajeDeError(guardar.error, 'No se pudo guardar la fecha.')}</Aviso>}
          <Boton type="submit" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Boton>
        </form>
      </Hoja>
    </>
  );
}
