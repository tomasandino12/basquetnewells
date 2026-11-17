import { useId, useState, type ComponentProps } from 'react';
import { esEnlaceWeb, MENSAJE_ENLACE_NO_WEB } from '@datos/enlaces.js';
import { LIMITE } from '@datos/limites.js';
import { TEMAS } from '@datos/temas.js';
import { EJES, NIVEL, nivelSugerido, validarVariacion } from '@datos/variaciones.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { ChipBoton } from '../components/ui/chip';
import { Campo } from '../components/ui/campo';
import { Hoja } from '../components/ui/sheet';
import { Confirmar } from '../coord/piezas';
import { useAgregarNota, useBorrarEjercicio, useBorrarNota, useBorrarVariacion, useGuardarEjercicio, useGuardarVariacion } from '../datos/consultasRecursos';
import { mensajeDeGuardado } from '../datos/errores';
import type { CamposDeEjercicio, EjercicioDeLista, VariacionDeEjercicio } from '../datos/repositorio';
import { cn } from '../lib/cn';

// Crear, editar y borrar en la biblioteca. La garantía de «sólo lo propio» es la policy de la base
// (0015 y 0052): los botones de editar y borrar se muestran sólo en lo propio por comodidad.

/** Si la base no devolvió ninguna fila, lo editado ya no es del profe. */
const noEsTuyo = (texto: string): [RegExp, string] => [/NO_ES_TUYO/, texto];

function AreaDeTexto({ etiqueta, className, ...props }: { etiqueta: string } & ComponentProps<'textarea'>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-semibold">{etiqueta}</label>
      <textarea
        id={id}
        rows={4}
        className="w-full rounded-campo border border-borde-control bg-sup px-3 py-2 text-base outline-offset-2 placeholder:text-gris focus-visible:outline-2 focus-visible:outline-tinta"
        {...props}
      />
    </div>
  );
}

/** El marco común de una hoja con formulario. */
function Marco({ abierta, alCambiar, titulo, descripcion, children }: { abierta: boolean; alCambiar: (a: boolean) => void; titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <Hoja abierta={abierta} alCambiar={alCambiar} titulo={titulo} descripcion={descripcion} etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{titulo}</h2>
        {children}
      </div>
    </Hoja>
  );
}

/* ---------- Ejercicio: crear y editar ---------- */

/** Título y tema son lo único obligatorio; cargar es rápido y lo demás se completa editando. */
export function HojaDeEjercicio({ abierta, alCambiar, clubId, previo }: { abierta: boolean; alCambiar: (a: boolean) => void; clubId: string; previo?: EjercicioDeLista }) {
  return (
    <Marco abierta={abierta} alCambiar={alCambiar} titulo={previo ? 'Editar ejercicio' : 'Cargar un ejercicio'} descripcion="Título y tema son lo único obligatorio.">
      <FormularioDeEjercicio clubId={clubId} previo={previo} alTerminar={() => alCambiar(false)} />
    </Marco>
  );
}

function FormularioDeEjercicio({ clubId, previo, alTerminar }: { clubId: string; previo?: EjercicioDeLista; alTerminar: () => void }) {
  const guardar = useGuardarEjercicio(clubId);
  const [campos, setCampos] = useState<CamposDeEjercicio>({
    titulo: previo?.titulo ?? '',
    tema: previo?.tema ?? '',
    descripcion: previo?.descripcion ?? '',
    enlace: previo?.enlace ?? '',
    material: previo?.material ?? '',
    jugadores: previo?.jugadores ?? '',
    categorias: previo?.categorias ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const poner = (k: keyof CamposDeEjercicio) => (e: { target: { value: string } }) => setCampos((c) => ({ ...c, [k]: e.target.value }));

  const enviar = async () => {
    // El trim() es sólo para chequear que no esté vacío: el texto va tal cual lo escribió el profe.
    if (!campos.titulo.trim() || !campos.tema) return setError('Elegí un título y un tema.');
    // El enlace sí va recortado: un espacio adelante lo rechaza la base (0027).
    const enlace = campos.enlace.trim();
    if (enlace && !esEnlaceWeb(enlace)) return setError(MENSAJE_ENLACE_NO_WEB as string);
    setError(null);
    try {
      await guardar.mutateAsync({ ejercicioId: previo?.id, campos: { ...campos, enlace } });
    } catch (e) {
      return setError(mensajeDeGuardado(e, 'No se pudo guardar el ejercicio.', [noEsTuyo('Este ejercicio ya no es tuyo: no se puede editar.')]));
    }
    alTerminar();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <Campo etiqueta="Título" value={campos.titulo} maxLength={LIMITE.titulo} autoComplete="off" onChange={poner('titulo')} />
      <div role="group" aria-label="Tema" className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Tema</span>
        <div className="flex flex-wrap gap-x-1">
          {(TEMAS as { id: string; nombre: string }[]).map((t) => (
            <ChipBoton key={t.id} activo={campos.tema === t.id} onClick={() => setCampos((c) => ({ ...c, tema: t.id }))}>
              {t.nombre}
            </ChipBoton>
          ))}
        </div>
      </div>
      <AreaDeTexto etiqueta="Descripción" value={campos.descripcion} maxLength={LIMITE.descripcion} onChange={poner('descripcion')} />
      <Campo etiqueta="Enlace" type="url" inputMode="url" placeholder="https://" value={campos.enlace} maxLength={LIMITE.enlace} onChange={poner('enlace')} />
      <Campo etiqueta="Material" placeholder="conos, dos pelotas" value={campos.material} maxLength={LIMITE.material} onChange={poner('material')} />
      <Campo etiqueta="Jugadores" placeholder="6 a 12" value={campos.jugadores} maxLength={LIMITE.listaCorta} onChange={poner('jugadores')} />
      <Campo etiqueta="Categorías" placeholder="mini, sub-13" value={campos.categorias} maxLength={LIMITE.listaCorta} onChange={poner('categorias')} />
      {error && <Aviso tono="error" titulo={error} />}
      <Boton type="submit" disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : previo ? 'Guardar los cambios' : 'Guardar'}
      </Boton>
    </form>
  );
}

/* ---------- Ejercicio: borrar ---------- */

/** Pide confirmación: es para siempre y se lleva las notas de uso de otros profes (cascade de 0015). */
export function BorrarEjercicio({ abierta, alCerrar, clubId, ejercicio, alBorrar }: { abierta: boolean; alCerrar: () => void; clubId: string; ejercicio: EjercicioDeLista; alBorrar: () => void }) {
  const borrar = useBorrarEjercicio(clubId);
  return (
    <Confirmar
      abierta={abierta}
      alCerrar={alCerrar}
      titulo="Borrar este ejercicio"
      texto={`Se borra «${ejercicio.titulo}» para siempre: no se puede deshacer, y se borran con él todas las notas de uso y variaciones que hayan cargado otros profes.`}
      verbo="Borrar de todos modos"
      alConfirmar={async () => {
        await borrar.mutateAsync(ejercicio.id);
        alBorrar();
      }}
      mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo borrar el ejercicio.', [noEsTuyo('Este ejercicio ya no es tuyo: no se puede borrar.')])}
    />
  );
}

/* ---------- Notas de uso ---------- */

export function HojaDeNota({ abierta, alCambiar, clubId, ejercicioId }: { abierta: boolean; alCambiar: (a: boolean) => void; clubId: string; ejercicioId: string }) {
  return (
    <Marco abierta={abierta} alCambiar={alCambiar} titulo="Agregar una nota" descripcion="Qué pasó al usar el ejercicio con tus chicos.">
      <FormularioDeNota clubId={clubId} ejercicioId={ejercicioId} alTerminar={() => alCambiar(false)} />
    </Marco>
  );
}

function FormularioDeNota({ clubId, ejercicioId, alTerminar }: { clubId: string; ejercicioId: string; alTerminar: () => void }) {
  const agregar = useAgregarNota(clubId, ejercicioId);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enviar = async () => {
    if (!texto.trim()) return setError('Escribí qué pasó al usarlo.');
    setError(null);
    try {
      await agregar.mutateAsync(texto);
    } catch (e) {
      return setError(mensajeDeGuardado(e, 'No se pudo guardar la nota.'));
    }
    alTerminar();
  };
  return (
    <div className="flex flex-col gap-4">
      <AreaDeTexto etiqueta="Qué pasó al usarlo" value={texto} maxLength={LIMITE.nota} placeholder="Ej.: con los de mini no funcionó hasta que achiqué la cancha" onChange={(e) => setTexto(e.target.value)} />
      {error && <Aviso tono="error" titulo={error} />}
      <Boton disabled={agregar.isPending} onClick={() => void enviar()}>
        {agregar.isPending ? 'Guardando…' : 'Guardar la nota'}
      </Boton>
    </div>
  );
}

export function BorrarNota({ abierta, alCerrar, clubId, notaId }: { abierta: boolean; alCerrar: () => void; clubId: string; notaId: string }) {
  const borrar = useBorrarNota(clubId);
  return (
    <Confirmar
      abierta={abierta}
      alCerrar={alCerrar}
      titulo="Borrar la nota"
      texto="Se borra tu nota del ejercicio. No se puede deshacer."
      verbo="Borrar"
      alConfirmar={async () => { await borrar.mutateAsync(notaId); }}
      mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo borrar la nota.', [noEsTuyo('Esta nota ya no es tuya: no se puede borrar.')])}
    />
  );
}

/* ---------- Variaciones ---------- */

/** Cualquier profe suma una a un ejercicio ajeno; editar y borrar es sólo de quien la cargó. */
export function HojaDeVariacion({ abierta, alCambiar, clubId, ejercicioId, variaciones, previa }: { abierta: boolean; alCambiar: (a: boolean) => void; clubId: string; ejercicioId: string; variaciones: VariacionDeEjercicio[]; previa?: VariacionDeEjercicio }) {
  return (
    <Marco abierta={abierta} alCambiar={alCambiar} titulo={previa ? 'Editar la variación' : 'Sumar una variación'} descripcion="Cómo subirle la dificultad al ejercicio.">
      <FormularioDeVariacion clubId={clubId} ejercicioId={ejercicioId} variaciones={variaciones} previa={previa} alTerminar={() => alCambiar(false)} />
    </Marco>
  );
}

function FormularioDeVariacion({ clubId, ejercicioId, variaciones, previa, alTerminar }: { clubId: string; ejercicioId: string; variaciones: VariacionDeEjercicio[]; previa?: VariacionDeEjercicio; alTerminar: () => void }) {
  const guardar = useGuardarVariacion(clubId, ejercicioId);
  const [titulo, setTitulo] = useState(previa?.titulo ?? '');
  const [nivel, setNivel] = useState<number>(previa?.nivel ?? (nivelSugerido(variaciones) as number));
  const [eje, setEje] = useState<string | null>(previa?.eje ?? null);
  const [descripcion, setDescripcion] = useState(previa?.descripcion ?? '');
  const [error, setError] = useState<string | null>(null);
  const niveles = Array.from({ length: NIVEL.max - NIVEL.min + 1 }, (_, i) => NIVEL.min + i);

  const enviar = async () => {
    const campos = { titulo, nivel, eje, descripcion };
    const { ok, errores } = validarVariacion(campos) as { ok: boolean; errores: string[] };
    if (!ok) return setError(errores[0]);
    setError(null);
    try {
      await guardar.mutateAsync({ variacionId: previa?.id, campos });
    } catch (e) {
      return setError(mensajeDeGuardado(e, 'No se pudo guardar la variación.', [noEsTuyo('Esta variación ya no es tuya: no se puede editar.')]));
    }
    alTerminar();
  };

  return (
    <div className="flex flex-col gap-4">
      <Campo etiqueta="Qué cambia" value={titulo} maxLength={LIMITE.titulo} placeholder="Ej.: con un defensor que sólo acompaña" onChange={(e) => setTitulo(e.target.value)} />
      <div role="group" aria-label="Nivel" className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Nivel</span>
        <div className="flex flex-wrap gap-x-1">
          {niveles.map((n) => (
            <ChipBoton key={n} activo={nivel === n} onClick={() => setNivel(n)}>{n}</ChipBoton>
          ))}
        </div>
        <p className="text-sm text-gris">1 es la más fácil. Te sugerimos el que sigue a las que ya hay.</p>
      </div>
      <div role="group" aria-label="Qué se ajusta" className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Qué se ajusta (opcional)</span>
        <div className="flex flex-wrap gap-x-1">
          {(EJES as { id: string; nombre: string }[]).map((x) => (
            <ChipBoton key={x.id} activo={eje === x.id} onClick={() => setEje(eje === x.id ? null : x.id)}>{x.nombre}</ChipBoton>
          ))}
        </div>
      </div>
      <AreaDeTexto etiqueta="Cómo se hace (opcional)" value={descripcion} maxLength={LIMITE.descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      {error && <Aviso tono="error" titulo={error} />}
      <Boton disabled={guardar.isPending} onClick={() => void enviar()}>
        {guardar.isPending ? 'Guardando…' : 'Guardar la variación'}
      </Boton>
    </div>
  );
}

export function BorrarVariacion({ abierta, alCerrar, clubId, variacion }: { abierta: boolean; alCerrar: () => void; clubId: string; variacion: VariacionDeEjercicio }) {
  const borrar = useBorrarVariacion(clubId);
  return (
    <Confirmar
      abierta={abierta}
      alCerrar={alCerrar}
      titulo="Borrar la variación"
      texto={`Se borra la variación «${variacion.titulo}». No se puede deshacer.`}
      verbo="Borrar"
      alConfirmar={async () => { await borrar.mutateAsync(variacion.id); }}
      mensajeDeError={(e) => mensajeDeGuardado(e, 'No se pudo borrar la variación.', [noEsTuyo('Esta variación ya no es tuya: no se puede borrar.')])}
    />
  );
}
