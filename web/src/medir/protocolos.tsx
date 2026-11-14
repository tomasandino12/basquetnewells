import type { ReactNode } from 'react';
import { PARCIAL_SPRINT_MAX_MS, PARCIAL_SPRINT_MIN_MS, TIEMPO_SPRINT_MAX_MS } from '@datos/sprint.js';
import { IDA_M, IDAS_MAX, metrosDe } from '@datos/yoyo.js';
import type { TipoDeTest } from './sesiones';

// Los mismos pasos que src/ui/componentes/protocolo*.js de la app de siempre, en piezas de React.

type Paso = [titulo: string, texto: ReactNode];

const segundos = (ms: number) => String(ms / 1000).replace('.', ',');

const SALTO: Paso[] = [
  ['Cámara', 'Modo «Cámara lenta» común, nunca «instantánea» ni con IA. De costado al chico, al ras del piso (0–10 cm), a 2–3 m, en horizontal y fija. Tienen que verse los dos pies y el piso.'],
  ['Grabación', 'Mucha luz y zapatillas. Grabar, esperar 2 s y recién ahí saltar. No editar ni recortar el video. Elegirlo en la app desde la galería del mismo celular: si pasa por WhatsApp, Quick Share o la compu pierde la cámara lenta y la app no lo mide.'],
  ['Test', <><b>CMJ:</b> manos en la cadera toda la ejecución. <b>Abalakov:</b> brazos libres.</>],
  ['Salto', 'Contramovimiento a la profundidad que elija el chico. Piernas extendidas en el aire y al aterrizar.'],
  ['Intentos', '3 válidos, con 30–60 s de pausa. Cuenta el mejor.'],
  ['Marcado', 'Despegue = último cuadro con la punta del pie tocando el piso. Aterrizaje = primer cuadro en que vuelve a tocar.'],
  ['Después', 'Borrá el video de la galería (la app no puede hacerlo por vos).'],
  ['Medidas de pierna', <><b>L0</b> = del trocánter mayor a la punta del pie, con la pierna extendida y el tobillo en flexión plantar. <b>hpush</b> = del trocánter al piso, en cuclillas con la rodilla a 90°. Medí al medio centímetro.</>],
];

const SPRINT: Paso[] = [
  ['Pista', <>Marcá la línea de salida y, a <b>30 m</b>, un cono para el giro (o a <b>20 m</b> si no hay 30 despejados). El chico corre hasta el cono, frena, gira y vuelve a la línea: <b>30 + 30</b>. Los de 20 y los de 30 no se comparan entre sí. Mismo piso y mismo calzado en todas las mediciones.</>],
  ['Entrada en calor', 'Trote, movilidad y dos o tres arranques progresivos antes del primer intento. Practicá el giro una vez sin cronómetro.'],
  ['Dónde te parás', 'En la línea de salida, siempre el mismo profe: ahí controlás que arranque bien y ves la llegada. El giro lo ves de frente, a 30 m.'],
  ['Salida', 'De pie, con un pie adelante y detrás de la línea. La app dice «En sus marcas… listos…» y suena un pitido: el reloj arranca con el pitido, no cuando el chico se mueve.'],
  ['Giró y Llegó', <>Tocá <b>¡Giró!</b> en el momento en que el chico frena para dar la vuelta, y <b>¡Llegó!</b> cuando cruza otra vez la línea de salida. Siempre el mismo criterio para el giro (por ejemplo, cuando planta el pie junto al cono).</>],
  ['Qué mira la app', <>El dato principal es el <b>total</b> (ida y vuelta), porque un toque de más o de menos pesa menos sobre unos 10 segundos. La <b>ida</b> sirve para comparar con el sprint simple, y la <b>vuelta</b> (total menos ida) incluye el giro: mostrala como aproximada.</>],
  ['Intentos', '2 intentos con 3 minutos de pausa. Cuenta el mejor total.'],
  ['Qué esperar', `Un tiempo fuera de rango se rechaza (la ida entre ${segundos(PARCIAL_SPRINT_MIN_MS)} y ${segundos(PARCIAL_SPRINT_MAX_MS)} s, el total hasta ${segundos(TIEMPO_SPRINT_MAX_MS)} s): casi seguro fue un toque de más. El cronómetro a mano sirve para ver la evolución del chico con el mismo profe, no para compararlo con tablas. Si el CReAR mide con fotocélulas, ese dato queda marcado como más exacto.`],
];

const YOYO: Paso[] = [
  ['Pista', <>Dos líneas a <b>{IDA_M} m</b> una de otra, marcadas con conos. Los chicos corren de una línea a la otra, sin pausa: una ida por pitido.</>],
  ['Celular', 'Con el parlante fuerte (o un parlante bluetooth) y el volumen al máximo: tienen que oír los pitidos desde toda la pista. No bloquees el celular ni cambies de aplicación durante la prueba; si pasa, la app avisa y hay que rehacerla.'],
  ['Entrada en calor', 'Trote, movilidad y unos arranques progresivos antes de empezar.'],
  ['Salida y ritmo', 'La app cuenta 5 segundos y suena un pitido largo: ahí arrancan. Cada pitido corto marca el fin de una ida y un pitido doble, el paso a un nivel más rápido. Hay que pisar la línea con el pitido.'],
  ['Avisos y eliminación', <>Al <b>primer</b> pitido que un chico no llega a la línea a tiempo, tocalo: queda con un aviso. Si llega bien en el siguiente, tocá <b>Llegó</b> para limpiarlo. Si falla dos veces seguidas, tocalo de nuevo: queda afuera y la app anota sus idas.</>],
  ['Cuántos por tanda', 'No más de 8 a 10 jugadores a la vez, para poder mirarlos a todos. Las tandas se cargan como sesiones separadas.'],
  ['Cuánto dura y cuánto se repite', `Hasta unos 15 minutos, y agota: no lo repitas más de 2 o 3 veces por año. El máximo son ${IDAS_MAX} idas (${metrosDe(IDAS_MAX)} m). Sirve para comparar al chico contra sí mismo; si el CReAR lo mide, ese dato queda marcado como más exacto.`],
];

export const PROTOCOLOS: Partial<Record<TipoDeTest, { titulo: string; sub: string; pasos: Paso[] }>> = {
  salto: { titulo: 'Protocolo del salto', sub: 'Cómo filmar y marcar para que el número sea confiable.', pasos: SALTO },
  sprint: { titulo: 'Protocolo del sprint', sub: 'Cómo medir para que el tiempo sea confiable.', pasos: SPRINT },
  yoyo: { titulo: 'Protocolo del Yo-Yo', sub: 'Cómo medir la resistencia con pitidos.', pasos: YOYO },
};

/** Los pasos numerados; va en la hoja de «¿Cómo se mide?» y adentro del marcador del salto. */
export function Pasos({ pasos }: { pasos: Paso[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {pasos.map(([titulo, texto], i) => (
        <li key={titulo} className="flex gap-3">
          <span aria-hidden className="cifra grid size-7 shrink-0 place-items-center rounded-full bg-sup-2 font-titulo text-lg leading-none font-bold">{i + 1}</span>
          <div className="min-w-0">
            <p className="font-semibold">{titulo}</p>
            <p className="text-sm text-gris">{texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
