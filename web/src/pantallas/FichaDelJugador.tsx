import { motion } from 'motion/react';
import { HeartPulse } from 'lucide-react';
import { ToggleGroup } from 'radix-ui';
import { useState } from 'react';
import { PESTANAS_FICHA, PESTANA_INICIAL } from '@datos/pestanasFicha.js';
import { textoDeLesion } from '@datos/asistencia.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from '../components/ui/pestanas';
import { TiroCurva } from '../components/ui/tiro-curva';
import { useAbrirLesion, useDarAlta, useMarcarAsistencia, useSacarDelPlantel } from '../datos/consultas';
import { mensajeDeError } from '../datos/errores';
import type { EstadoAsistencia } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { ESTADO_DE_BOTON, type FilaPlantel } from '../plantel/filas';

const SALIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];
const BOTONES = [
  ['presente', 'Presente'],
  ['avisó', 'Avisó'],
  ['faltó', 'Faltó'],
] as const;

// La ficha abre en la última pestaña que se usó en la sesión; la primera vez, Físico.
let ultimaPestana: string = PESTANA_INICIAL;

const cifra = (v: number | null, unidad: string) => (v === null ? '—' : `${String(v).replace('.', ',')} ${unidad}`);
const SUAVE = 'text-sobre-club/80';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className={cn('text-xs', SUAVE)}>{etiqueta}</dt>
      <dd className="cifra mt-0.5 font-titulo text-3xl leading-none font-bold">{valor}</dd>
    </div>
  );
}

function Fisico({ f }: { f: FilaPlantel }) {
  const nivel = { excelente: 'Excelente', regular: 'Regular', alerta: 'En alerta' }[f.nivel ?? 'alerta'];
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Asistencia">
        <h3 className="mb-2 font-titulo text-lg font-semibold tracking-wide uppercase">Asistencia</h3>
        {f.asistenciaPct === null ? (
          <p className={cn('text-sm', SUAVE)}>Todavía no se tomó asistencia.</p>
        ) : (
          <dl className="grid grid-cols-3 gap-3">
            <Dato etiqueta={nivel} valor={`${f.asistenciaPct}%`} />
            <Dato etiqueta="Vino" valor={`${f.asistidos} de ${f.entrenados}`} />
            <Dato etiqueta="Avisó" valor={String(f.justificadas)} />
          </dl>
        )}
      </section>
      <section aria-label="Medidas vigentes">
        <h3 className="mb-2 font-titulo text-lg font-semibold tracking-wide uppercase">Medidas</h3>
        <dl className="grid grid-cols-3 gap-3">
          <Dato etiqueta="Altura" valor={cifra(f.alturaCm, 'cm')} />
          <Dato etiqueta="Peso" valor={cifra(f.pesoKg, 'kg')} />
          <Dato etiqueta="Edad" valor={f.edad === null ? '—' : `${f.edad} años`} />
        </dl>
      </section>
      <PendienteEnLaApp titulo="Mediciones, salto, sprint, Yo-Yo y cargas" />
    </div>
  );
}

function Tiro({ f }: { f: FilaPlantel }) {
  if (!f.bateria) return <p className={cn('text-sm', SUAVE)}>Todavía no tiene baterías de tiro.</p>;
  const { zonas, libres, fecha } = f.bateria;
  return (
    <div className="flex flex-col gap-3">
      <p className={cn('text-sm', SUAVE)}>Última batería de arco, del {fecha.split('-').reverse().join('/')}. 10 tiros por zona.</p>
      <TiroCurva zonas={zonas} />
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {zonas.map((z) => (
          <div key={z.id}>
            <dt className={cn('text-xs', SUAVE)}>{z.corto}</dt>
            <dd className="font-mono font-semibold tabular-nums">{z.pct === null ? '—' : `${z.pct}% (${z.anotados}/${z.intentos})`}</dd>
          </div>
        ))}
        <div>
          <dt className={cn('text-xs', SUAVE)}>LIBRES</dt>
          <dd className="font-mono font-semibold tabular-nums">{libres?.pct == null ? '—' : `${libres.pct}% (${libres.anotados}/${libres.intentos})`}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Lo que todavía se hace en la app anterior: se dice y se enlaza, para que nada quede sin salida. */
function PendienteEnLaApp({ titulo }: { titulo: string }) {
  return (
    <p className={cn('rounded-tarjeta border border-sobre-club/30 p-3 text-sm', SUAVE)}>
      {titulo}: todavía se ven en la{' '}
      <a href="/app/" className="font-semibold text-sobre-club underline underline-offset-2">app anterior</a>.
    </p>
  );
}

interface Props {
  fila: FilaPlantel;
  clubId: string;
  plantelId: string;
  hoy: string;
  /** Al sacar al chico del plantel: la pantalla suelta la ficha. */
  alSacar: () => void;
}

/** La ficha del chico sobre el rojo oscuro del club. La asistencia y la lesión son del profe: acá se marcan. */
export function FichaDelJugador({ fila: f, clubId, plantelId, hoy, alSacar }: Props) {
  const asistencia = useMarcarAsistencia(plantelId, hoy);
  const abrir = useAbrirLesion(clubId, hoy);
  const alta = useDarAlta(hoy);
  const sacar = useSacarDelPlantel(clubId, plantelId);
  const [confirmando, setConfirmando] = useState(false);
  const [pestana, setPestana] = useState(ultimaPestana);

  const nombre = `${f.nombre} ${f.apellido}`.trim();
  const valor = BOTONES.find(([k]) => ESTADO_DE_BOTON[k] === f.hoy)?.[0] ?? '';
  const error = [asistencia, abrir, alta, sacar].find((m) => m.isError)?.error;
  const ocupado = asistencia.isPending || abrir.isPending || alta.isPending || sacar.isPending;

  return (
    <motion.article
      aria-label={`Ficha de ${nombre}`}
      className="flex flex-col gap-4 bg-club-osc p-5 text-sobre-club"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: SALIDA }}
    >
      <header className="flex items-end gap-4 pr-10">
        <span aria-hidden className="font-titulo text-[4.5rem] leading-[.8] font-bold">{f.iniciales}</span>
        <div className="min-w-0 pb-1">
          <h2 className="font-titulo text-3xl leading-none font-semibold break-words">{nombre}</h2>
          <p className={cn('mt-1.5 text-sm', SUAVE)}>
            {f.edad === null ? 'Sin fecha de nacimiento' : `${f.edad} años`}
          </p>
        </div>
      </header>

      <section aria-label="Asistencia de hoy" className="flex flex-col gap-2">
        <ToggleGroup.Root
          type="single"
          value={valor}
          disabled={ocupado}
          aria-label="Asistencia de hoy"
          onValueChange={(v) => {
            const estado: EstadoAsistencia | null = v === '' ? null : ESTADO_DE_BOTON[v as keyof typeof ESTADO_DE_BOTON];
            asistencia.mutate({ jugadorId: f.id, estado });
          }}
          className="flex gap-2"
        >
          {BOTONES.map(([k, etiqueta]) => (
            <ToggleGroup.Item
              key={k}
              value={k}
              className="min-h-11 flex-1 rounded-btn border border-sobre-club/60 px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-sobre-club data-[state=on]:border-sobre-club/90 data-[state=on]:bg-sobre-club/90 data-[state=on]:text-club-osc"
            >
              {etiqueta}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>

        {f.lesion ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold">
              <HeartPulse aria-hidden className="size-4 shrink-0" />
              {textoDeLesion(f.lesion) as string}
            </p>
            <Boton variante="contorno" tamano="chico" disabled={ocupado} onClick={() => alta.mutate(f.lesion!.id)} className="border-sobre-club/60 text-sobre-club hover:border-sobre-club">
              Dar el alta
            </Boton>
          </div>
        ) : (
          <Boton variante="contorno" tamano="chico" disabled={ocupado} onClick={() => abrir.mutate(f.id)} className="self-start border-sobre-club/60 text-sobre-club hover:border-sobre-club">
            <HeartPulse aria-hidden className="size-4" />
            Marcar lesión
          </Boton>
        )}
        {error !== undefined && (
          <Aviso tono="error" titulo="No se pudo guardar">{mensajeDeError(error, 'Probá de nuevo en un momento.')}</Aviso>
        )}
      </section>

      <Pestanas
        value={pestana}
        onValueChange={(p) => {
          ultimaPestana = p;
          setPestana(p);
        }}
      >
        <ListaPestanas className="border-sobre-club/30" aria-label="Secciones de la ficha">
          {(PESTANAS_FICHA as readonly { id: string; titulo: string }[]).map((p) => (
            <Pestana key={p.id} value={p.id} className="text-sobre-club/75 outline-sobre-club data-[state=active]:border-sobre-club data-[state=active]:text-sobre-club">
              {p.titulo}
            </Pestana>
          ))}
        </ListaPestanas>
        <PanelPestana value="fisico"><Fisico f={f} /></PanelPestana>
        <PanelPestana value="tiro"><Tiro f={f} /></PanelPestana>
        <PanelPestana value="partidos"><PendienteEnLaApp titulo="Partido a partido y misiones" /></PanelPestana>
        <PanelPestana value="historia"><PendienteEnLaApp titulo="Temporadas y recursos enviados" /></PanelPestana>
      </Pestanas>

      <footer className="border-t border-sobre-club/30 pt-3">
        {confirmando ? (
          <div role="group" aria-label="Confirmar" className="flex flex-col gap-2">
            <p className="text-sm">¿Sacar a {nombre} del plantel? Su ficha y su historia se conservan.</p>
            <div className="flex gap-2">
              <Boton
                variante="contorno"
                tamano="chico"
                disabled={ocupado}
                className="border-sobre-club text-sobre-club"
                onClick={() => sacar.mutate(f.id, { onSuccess: alSacar })}
              >
                Sí, sacarlo
              </Boton>
              <Boton variante="contorno" tamano="chico" className="border-sobre-club/60 text-sobre-club" onClick={() => setConfirmando(false)}>
                Cancelar
              </Boton>
            </div>
          </div>
        ) : (
          <Boton variante="contorno" tamano="chico" className="border-sobre-club/60 text-sobre-club" onClick={() => setConfirmando(true)}>
            Sacar del plantel
          </Boton>
        )}
        <p className={cn('mt-3 text-xs', SUAVE)}>
          Editar la fecha de nacimiento, los datos de emergencia, el acceso del chico y la familia: en la{' '}
          <a href="/app/" className="underline underline-offset-2">app anterior</a>.
        </p>
      </footer>
    </motion.article>
  );
}
