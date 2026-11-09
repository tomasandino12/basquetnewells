import { motion } from 'motion/react';
import { Flame, HeartPulse, Ruler, Weight } from 'lucide-react';
import { ToggleGroup } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { PESTANAS_FICHA, PESTANA_INICIAL } from '@datos/pestanasFicha.js';
import { ETIQUETAS, LADOS, MOTIVOS, TIPOS, ZONAS, diaMes, textoDeLesion } from '@datos/asistencia.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { ChipBoton } from '../components/ui/chip';
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from '../components/ui/pestanas';
import { TiroCurva } from '../components/ui/tiro-curva';
import { useDarAlta, useMarcarAsistencia, useRegistrarLesion, useSacarDelPlantel } from '../datos/consultas';
import { mensajeDeError } from '../datos/errores';
import type { EstadoAsistencia, Lesion, MotivoFalta } from '../datos/repositorio';
import { cn } from '../lib/cn';
import { ESTADO_DE_BOTON, type DiaDeLaTira, type FilaPlantel } from '../plantel/filas';
import { APP_DE_SIEMPRE } from '../clasica';

const SALIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];
const BOTONES = [
  ['presente', 'Presente'],
  ['avisó', 'Avisó'],
  ['faltó', 'Faltó'],
] as const;

const etiqueta = (clave: string) => (ETIQUETAS as Record<string, string>)[clave] ?? clave;

// La ficha abre en la última pestaña que se usó en la sesión; la primera vez, Físico.
let ultimaPestana: string = PESTANA_INICIAL;

const cifra = (v: number | null, unidad: string) => (v === null ? '—' : `${String(v).replace('.', ',')} ${unidad}`);
const TITULO = 'mb-2 font-mono text-xs tracking-wide text-gris uppercase';

function Dato({ etiqueta: e, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-gris">{e}</dt>
      <dd className="cifra mt-0.5 font-titulo text-3xl leading-none font-bold">{valor}</dd>
    </div>
  );
}

/** Color de cada día en la tira: el mismo en la tira y en su leyenda. */
const COLOR_DIA: Record<string, string> = {
  presente: 'bg-sube',
  justificada: 'bg-ambar',
  ausente: 'bg-baja',
  sin_entreno: 'bg-linea',
};

function textoDelDia(d: DiaDeLaTira) {
  const cuando = diaMes(d.fecha) as string;
  if (d.estado === 'sin_entreno') return `${cuando}: no hubo entrenamiento`;
  if (d.estado === null) return `${cuando}: no se tomó`;
  if (d.estado === 'justificada') return `${cuando}: avisó${d.motivo ? ` (${etiqueta(d.motivo).toLowerCase()})` : ''}`;
  const base = `${cuando}: ${d.estado === 'presente' ? 'vino' : 'faltó sin avisar'}`;
  return d.lesionado ? `${base}, lesionado` : base;
}

/** Los últimos entrenamientos de un vistazo: un rectángulo por día, del más viejo al más nuevo. */
function TiraDeAsistencia({ dias }: { dias: DiaDeLaTira[] }) {
  if (dias.length === 0) return null;
  return (
    <div>
      <ol aria-label="Últimos entrenamientos" className="flex gap-1">
        {dias.map((d) => (
          <li
            key={d.fecha}
            title={textoDelDia(d)}
            aria-label={textoDelDia(d)}
            className={cn(
              'h-3 flex-1 rounded-[2px]',
              d.estado === null ? 'border border-dashed border-borde-control' : COLOR_DIA[d.estado],
              d.lesionado && 'ring-2 ring-caramelo ring-offset-1 ring-offset-sup',
            )}
          />
        ))}
      </ol>
      <div className="mt-1.5 flex justify-between font-mono text-[0.6875rem] text-gris">
        <span>{diaMes(dias[0].fecha) as string}</span>
        <span>{diaMes(dias[dias.length - 1].fecha) as string}</span>
      </div>
      <ul aria-hidden className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gris">
        {[['presente', 'Vino'], ['justificada', 'Avisó'], ['ausente', 'Faltó'], ['sin_entreno', 'Sin entreno']].map(([k, t]) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[2px]', COLOR_DIA[k])} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Asistencia({ f }: { f: FilaPlantel }) {
  const nivel = { excelente: 'Excelente', regular: 'Regular', alerta: 'En alerta' }[f.nivel ?? 'alerta'];
  return (
    <section aria-label="Asistencia" className="flex flex-col gap-3">
      <h3 className={TITULO}>Asistencia</h3>
      {f.asistenciaPct === null ? (
        <p className="text-sm text-gris">Todavía no se tomó asistencia.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <Dato etiqueta={nivel} valor={`${f.asistenciaPct}%`} />
            <Dato etiqueta="Vino" valor={`${f.asistidos} de ${f.entrenados}`} />
            <Dato etiqueta="Avisó" valor={String(f.justificadas)} />
          </dl>
          <TiraDeAsistencia dias={f.ultimos} />
        </>
      )}
    </section>
  );
}

function Fisico({ f }: { f: FilaPlantel }) {
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Medidas vigentes">
        <h3 className={TITULO}>Medidas</h3>
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
  if (!f.bateria) return <p className="text-sm text-gris">Todavía no tiene baterías de tiro.</p>;
  const { zonas, libres, fecha } = f.bateria;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gris">Última batería de arco, del {fecha.split('-').reverse().join('/')}. 10 tiros por zona.</p>
      <TiroCurva zonas={zonas} />
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
        {zonas.map((z) => (
          <div key={z.id}>
            <dt className="text-xs text-gris">{z.corto}</dt>
            <dd className="font-mono font-semibold tabular-nums">{z.pct === null ? '—' : `${z.pct}% (${z.anotados}/${z.intentos})`}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-gris">LIBRES</dt>
          <dd className="font-mono font-semibold tabular-nums">{libres?.pct == null ? '—' : `${libres.pct}% (${libres.anotados}/${libres.intentos})`}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Lo que todavía se hace en la app anterior: se dice y se enlaza, para que nada quede sin salida. */
function PendienteEnLaApp({ titulo }: { titulo: string }) {
  return (
    <p className="rounded-tarjeta border border-linea p-3 text-sm text-gris">
      {titulo}: todavía se ven en la{' '}
      <a href={APP_DE_SIEMPRE} className="font-semibold text-tinta underline underline-offset-2">app anterior</a>.
    </p>
  );
}

type Marcas = { zona: string | null; lado: string | null; tipo: string | null };
const GRUPOS = [
  { clave: 'zona', titulo: 'Zona del cuerpo', opciones: ZONAS as string[] },
  { clave: 'lado', titulo: 'Lado', opciones: LADOS as string[] },
  { clave: 'tipo', titulo: 'Qué pasó', opciones: TIPOS as string[] },
] as const;

function Opciones({ titulo, id, children }: { titulo: string; id: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="text-sm font-semibold">{titulo}</p>
      <div className="-ml-1 flex flex-wrap">{children}</div>
    </div>
  );
}

const textoDePeriodo = (l: Lesion) => {
  const que = [l.zona && etiqueta(l.zona), l.lado && l.lado !== 'no_aplica' && l.lado, l.tipo && etiqueta(l.tipo).toLowerCase()]
    .filter(Boolean)
    .join(' · ');
  const cuando = l.hasta ? `del ${diaMes(l.desde)} al ${diaMes(l.hasta)}` : `desde el ${diaMes(l.desde)}`;
  return `${que || 'Sin detalle'}, ${cuando}`;
};

/**
 * La lesión con lo que el profe sepa: dónde, de qué lado y qué pasó. Listas cerradas y todas
 * opcionales —«no sé» vale en la cancha—: es un dato de salud de un menor, sin texto libre. Quedan
 * las fechas, para cruzarlas después con entrenamientos y partidos.
 */
function Lesiones({ f, clubId, hoy, ocupado }: { f: FilaPlantel; clubId: string; hoy: string; ocupado: boolean }) {
  const [cargando, setCargando] = useState(false);
  const [marcas, setMarcas] = useState<Marcas>({ zona: null, lado: null, tipo: null });
  const registrar = useRegistrarLesion(clubId, hoy);
  const alta = useDarAlta(hoy);
  const error = [registrar, alta].find((m) => m.isError)?.error;
  const anteriores = f.lesiones.filter((l) => l.hasta !== null);
  const trabado = ocupado || registrar.isPending || alta.isPending;

  return (
    <section aria-label="Lesiones" className="flex flex-col gap-3">
      <h3 className={TITULO}>Lesiones</h3>
      {f.lesion ? (
        <div className="flex flex-wrap items-center gap-2 rounded-tarjeta bg-baja-fondo p-3 text-baja">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold">
            <HeartPulse aria-hidden className="size-4 shrink-0" />
            {textoDeLesion(f.lesion) as string}
          </p>
          <Boton variante="contorno" tamano="chico" disabled={trabado} onClick={() => alta.mutate(f.lesion!.id)}>
            Dar el alta
          </Boton>
        </div>
      ) : cargando ? (
        <div className="flex flex-col gap-3 rounded-tarjeta border border-linea p-3">
          <p className="text-sm text-gris">Se lesionó hoy. Marcá lo que sepas: todo es opcional.</p>
          {GRUPOS.map((g) => (
            <Opciones key={g.clave} titulo={g.titulo} id={`lesion-${f.id}-${g.clave}`}>
              {g.opciones.map((o) => (
                <ChipBoton key={o} activo={marcas[g.clave] === o} onClick={() => setMarcas((m) => ({ ...m, [g.clave]: m[g.clave] === o ? null : o }))}>
                  {etiqueta(o)}
                </ChipBoton>
              ))}
            </Opciones>
          ))}
          <div className="flex gap-2">
            <Boton variante="contorno" tamano="chico" onClick={() => setCargando(false)}>Cancelar</Boton>
            <Boton
              tamano="chico"
              disabled={trabado}
              onClick={() => registrar.mutate({ jugadorId: f.id, ...marcas }, { onSuccess: () => setCargando(false) })}
            >
              {registrar.isPending ? 'Guardando…' : 'Guardar lesión'}
            </Boton>
          </div>
        </div>
      ) : (
        <Boton variante="contorno" tamano="chico" disabled={trabado} onClick={() => setCargando(true)} className="self-start">
          <HeartPulse aria-hidden className="size-4" />
          Marcar lesión
        </Boton>
      )}
      {anteriores.length > 0 && (
        <ul aria-label="Lesiones anteriores" className="flex flex-col gap-1 text-sm text-gris">
          {anteriores.map((l) => <li key={l.id}>{textoDePeriodo(l)}</li>)}
        </ul>
      )}
      {!f.lesion && anteriores.length === 0 && !cargando && <p className="text-sm text-gris">Sin lesiones registradas.</p>}
      {error !== undefined && (
        <Aviso tono="error" titulo="No se pudo guardar">
          {mensajeDeError(error, 'Probá de nuevo en un momento.')}
        </Aviso>
      )}
    </section>
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

/**
 * La ficha del chico. Arriba, en negro, quién es y cómo viene hoy (estado, motivo si avisó, racha);
 * abajo, asistencia, lesiones y lo demás. La asistencia y la lesión son del profe: acá se marcan.
 */
export function FichaDelJugador({ fila: f, clubId, plantelId, hoy, alSacar }: Props) {
  const asistencia = useMarcarAsistencia(plantelId, hoy);
  const sacar = useSacarDelPlantel(clubId, plantelId);
  const [confirmando, setConfirmando] = useState(false);
  const [pestana, setPestana] = useState(ultimaPestana);

  const nombre = `${f.nombre} ${f.apellido}`.trim();
  const valor = BOTONES.find(([k]) => ESTADO_DE_BOTON[k] === f.hoy)?.[0] ?? '';
  const error = [asistencia, sacar].find((m) => m.isError)?.error;
  const ocupado = asistencia.isPending || sacar.isPending;

  return (
    <motion.article
      aria-label={`Ficha de ${nombre}`}
      className="flex flex-col bg-sup text-tinta"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: SALIDA }}
    >
      <header className="flex flex-col gap-5 border-t-4 border-club bg-negro p-5 text-sobre-negro lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-8 lg:p-8">
        <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-tarjeta bg-sobre-negro font-titulo text-3xl font-bold text-negro lg:size-24 lg:text-5xl">
            {f.iniciales}
          </span>
          <div className="min-w-0">
            <h2 className="font-titulo text-4xl leading-[.9] font-bold break-words lg:text-6xl">
              {f.nombre && <span className="block">{f.nombre}</span>}
              {f.apellido}
            </h2>
            <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-xs text-sobre-negro/75">
              <span className="inline-flex items-center gap-1"><Ruler aria-hidden className="size-3.5" />{cifra(f.alturaCm, 'cm')}</span>
              <span className="inline-flex items-center gap-1"><Weight aria-hidden className="size-3.5" />{cifra(f.pesoKg, 'kg')}</span>
              <span>{f.edad === null ? 'Sin fecha de nacimiento' : `${f.edad} años`}</span>
            </p>
          </div>
        </div>

        {f.racha > 1 && (
          <p className="flex items-center gap-2 text-sm">
            <Flame aria-hidden className="size-4 text-club-cl" />
            <span><b className="cifra font-titulo text-lg">{f.racha}</b> entrenamientos seguidos</span>
          </p>
        )}
        </div>

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
            {BOTONES.map(([k, e]) => (
              <ToggleGroup.Item
                key={k}
                value={k}
                className="min-h-11 flex-1 rounded-btn border border-sobre-negro/40 px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-sobre-negro data-[state=on]:border-sobre-negro data-[state=on]:bg-sobre-negro data-[state=on]:text-negro"
              >
                {e}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          {f.hoy === 'justificada' && (
            // Avisó: por qué. Al profe le importa: no es lo mismo un examen que no tener ganas.
            <div role="group" aria-label="Por qué faltó" className="-ml-1 flex flex-wrap">
              {(MOTIVOS as MotivoFalta[]).map((m) => (
                <ChipBoton
                  key={m}
                  activo={f.motivoHoy === m}
                  disabled={ocupado}
                  onClick={() => asistencia.mutate({ jugadorId: f.id, estado: 'justificada', motivo: f.motivoHoy === m ? null : m })}
                >
                  {etiqueta(m)}
                </ChipBoton>
              ))}
            </div>
          )}
          {error !== undefined && (
            <Aviso tono="error" titulo="No se pudo guardar">{mensajeDeError(error, 'Probá de nuevo en un momento.')}</Aviso>
          )}
        </section>
      </header>

      <div className="grid gap-8 p-5 lg:grid-cols-2 lg:p-8">
        <div className="flex flex-col gap-8">
          <Asistencia f={f} />
          <Lesiones f={f} clubId={clubId} hoy={hoy} ocupado={ocupado} />
        </div>
        <div className="flex flex-col gap-6">

        <Pestanas
          value={pestana}
          onValueChange={(p) => {
            ultimaPestana = p;
            setPestana(p);
          }}
        >
          <ListaPestanas aria-label="Secciones de la ficha">
            {(PESTANAS_FICHA as readonly { id: string; titulo: string }[]).map((p) => (
              <Pestana key={p.id} value={p.id}>{p.titulo}</Pestana>
            ))}
          </ListaPestanas>
          <PanelPestana value="fisico"><Fisico f={f} /></PanelPestana>
          <PanelPestana value="tiro"><Tiro f={f} /></PanelPestana>
          <PanelPestana value="partidos"><PendienteEnLaApp titulo="Partido a partido y misiones" /></PanelPestana>
          <PanelPestana value="historia"><PendienteEnLaApp titulo="Temporadas y recursos enviados" /></PanelPestana>
        </Pestanas>

        <footer className="border-t border-linea pt-3">
          {confirmando ? (
            <div role="group" aria-label="Confirmar" className="flex flex-col gap-2">
              <p className="text-sm">¿Sacar a {nombre} del plantel? Su ficha y su historia se conservan.</p>
              <div className="flex gap-2">
                <Boton variante="contorno" tamano="chico" disabled={ocupado} onClick={() => sacar.mutate(f.id, { onSuccess: alSacar })}>
                  Sí, sacarlo
                </Boton>
                <Boton variante="contorno" tamano="chico" onClick={() => setConfirmando(false)}>Cancelar</Boton>
              </div>
            </div>
          ) : (
            <Boton variante="contorno" tamano="chico" onClick={() => setConfirmando(true)}>Sacar del plantel</Boton>
          )}
          <p className="mt-3 text-xs text-gris">
            Editar la fecha de nacimiento, los datos de emergencia, el acceso del chico y la familia: en la{' '}
            <a href={APP_DE_SIEMPRE} className="underline underline-offset-2">app anterior</a>.
          </p>
        </footer>
        </div>
      </div>
    </motion.article>
  );
}
