import { useEffect, useRef, useState, type ReactNode } from 'react';
import { valorContado } from '@datos/animacion.js';
import { JUGADA_DEMO_LANDING } from '@datos/jugadaDemoLanding.js';
import escudo from '../../../public/escudo.png';
import { Boton } from '../components/ui/button';
import { PizarraDeLaPortada } from '../components/ui/pizarra';
import { cn } from '../lib/cn';
import type { DatosDePizarra } from '../datos/repositorio';

/**
 * La portada que ve quien llega sin cuenta (la landing de siempre, en oscuro como el portal público):
 * qué es la app y dos puertas, crear cuenta o entrar. Las demos son dibujos con datos inventados.
 * Todo el texto describe lo que ya está construido: lo que no existe, no se promete.
 * La animación es decoración: sin IntersectionObserver o con movimiento reducido, la portada se lee igual.
 */
export function Portada({ alCrear, alEntrar }: { alCrear: () => void; alEntrar: () => void }) {
  const anillo = useRef<SVGSVGElement>(null);

  // El anillo es la única animación continua: se pausa cuando no se ve, para no gastar batería girando para nadie.
  useEffect(() => {
    const el = anillo.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const o = new IntersectionObserver(([e]) => el.classList.toggle('quieto', !e.isIntersecting));
    o.observe(el);
    return () => o.disconnect();
  }, []);

  return (
    <div className="portada flex flex-col gap-10 py-10 lg:py-16">
      <section className="flex flex-col items-center gap-6 text-center" aria-label="Qué es Inferiores">
        {/* El nombre del club está escrito como texto: el anillo es decorativo. textLength = circunferencia, así llena el círculo justo. */}
        <div className="relative size-52 shrink-0 md:size-72">
          <svg ref={anillo} viewBox="0 0 200 200" aria-hidden focusable="false" className="anillo absolute inset-0 size-full">
            <defs>
              <path id="circulo-anillo" d="M100,22 a78,78 0 1,1 0,156 a78,78 0 1,1 0,-156" />
            </defs>
            <text fontSize="15" className="fill-current font-titulo font-semibold opacity-70" letterSpacing="0.6">
              <textPath href="#circulo-anillo" textLength="490" lengthAdjust="spacing">BÁSQUET · NEWELL&apos;S OLD BOYS · </textPath>
            </text>
          </svg>
          <img src={escudo} alt="" width={96} height={96} className="absolute inset-[26%] size-[48%] object-contain" />
        </div>
        <div className="max-w-3xl">
          <p className="font-mono text-xs tracking-widest text-sobre-negro uppercase opacity-70">Inferiores · Newell&apos;s Old Boys</p>
          <h1 className="mt-3 font-titulo text-5xl leading-none font-bold uppercase md:text-7xl">
            Lo que se trabaja en inferiores, <span className="text-club">queda</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg opacity-80 md:text-xl">
            Partidos, mediciones y ejercicios de las formativas en un solo lugar, que sigue estando cuando cambia el cuerpo técnico.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Boton variante="club" onClick={alCrear}>Crear cuenta</Boton>
          <Boton variante="contorno" className="border-sobre-negro/40 text-sobre-negro" onClick={alEntrar}>Ya tengo cuenta</Boton>
        </div>
      </section>

      <section aria-label="Qué hace" className="mx-auto grid w-full max-w-6xl gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <Beneficio ancho titulo="El plantel se arma solo" texto="Subís la planilla del partido de la CABB y los jugadores se crean solos. Un partido trae la enorme mayoría del plantel sin escribir un nombre a mano.">
          {() => (
            <div aria-hidden className="demo">
              <div className="planilla">
                <div className="fila cab"><b>N°</b><b>Jugador</b><b>Pts</b></div>
                {[
                  ['4', 'GÓMEZ, Mateo', '12'],
                  ['7', 'FERREYRA, Lucas', '9'],
                  ['9', 'IBARRA, Tomás', '14'],
                  ['11', 'SOSA, Joaquín', '8'],
                  ['15', 'MOLINA, Bruno', '6'],
                ].map(([n, j, p]) => (
                  <div key={n} className="fila"><span>{n}</span><span>{j}</span><span>{p}</span></div>
                ))}
              </div>
              <span className="text-2xl opacity-70">→</span>
              <div className="chips-j">
                {['#4 Gómez', '#7 Ferreyra', '#9 Ibarra', '#11 Sosa', '#15 Molina', '+ 9 más'].map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>
          )}
        </Beneficio>

        <Beneficio alta titulo="El trabajo no se pierde" texto="El historial de cada jugador sobrevive a las temporadas, a los cambios de categoría y al cambio de entrenador. Lo que se midió hace dos años sigue estando.">
          {() => (
            <div aria-hidden className="demo">
              <ol className="linea-t">
                <li>U13 · 2025 · Profe A</li>
                <li>U13 · 2026 · Profe B</li>
                <li>U15 · 2027 · Profe C</li>
              </ol>
            </div>
          )}
        </Beneficio>

        <Beneficio ancho titulo="Estadísticas con historia" texto="Reparto de minutos y de puntos, el tiro del equipo partido a partido, y las mediciones que se cargan en la práctica: la batería de tiro y los saltos. Queda la evolución de cada jugador y del equipo a lo largo del tiempo.">
          {(corre) => (
            <div aria-hidden className="demo" style={{ gap: '0.75rem 1.5rem' }}>
              <svg viewBox="0 0 220 80" className="h-auto w-full max-w-[22rem]" focusable="false">
                <polyline className="curva-demo" points="10,60.4 26,47.6 42,66.8 58,44.4 74,38 90,54 106,31.6 122,41.2 138,25.2 154,18.8" />
                <rect className="tapa" width="220" height="80" />
                <circle className="punto" cx="154" cy="18.8" r="3.5" />
                <text className="cifra-tiro" x="166" y="27" fontSize="20">44 %</text>
              </svg>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-titulo text-sm font-semibold tracking-[.11em] uppercase opacity-70">Salto CMJ</span>
                <span className="font-mono text-4xl font-semibold tabular-nums"><CifraDeSalto corre={corre} /> cm</span>
                <span className="sube-osc">+4 cm</span>
              </div>
            </div>
          )}
        </Beneficio>

        <Beneficio ancho horizontal titulo="Las jugadas del club" texto="Los profes arman las jugadas en un editor y las ven entre ellos, para ir forjando una identidad de juego. Cada jugador ve las que su profe le asigna a su categoría, para repasarlas antes de los partidos.">
          {(corre) => (
            <div aria-hidden className="demo !block">
              <PizarraDeLaPortada datos={JUGADA_DEMO_LANDING as DatosDePizarra} corre={corre} />
            </div>
          )}
        </Beneficio>
        <Beneficio titulo="Los ejercicios quedan en el club" texto="Una biblioteca compartida entre los profes, con notas de qué funcionó y qué no con cada categoría. Justo lo que hoy se pierde cuando alguien se va." />
        <Beneficio titulo="Pensada para el celular" texto="En la cancha, con una mano, durante la práctica. No es una planilla de escritorio adaptada a una pantalla chica." />
      </section>

      <p className="mx-auto max-w-xl border-t border-white/10 pt-5 text-center text-sm opacity-70">
        Piloto en curso. Todo lo que está listado acá arriba está construido y funcionando; lo que no está en esa lista, todavía no existe.
      </p>
      <p className="text-center text-sm">
        <a className="underline" href="/privacidad">Política de privacidad</a> · <a className="underline" href="/terminos">Términos y condiciones</a>
      </p>
    </div>
  );
}

/** La cifra está escrita en su valor final (42); con animación arranca en 38 y cuenta hasta 42 en lo que dura la demo. */
function CifraDeSalto({ corre }: { corre: number }) {
  const [valor, setValor] = useState(42);
  useEffect(() => {
    if (corre === 0 || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      setValor(42);
      return;
    }
    const duracion = 1400;
    const inicio = performance.now();
    let raf = 0;
    const cuadro = (ahora: number) => {
      const t = (ahora - inicio) / duracion;
      setValor(valorContado(38, 42, t) as number);
      if (t < 1) raf = requestAnimationFrame(cuadro);
    };
    setValor(38);
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [corre]);
  return <>{valor}</>;
}

/**
 * Una tarjeta. Su demo queda en el primer cuadro hasta que la tarjeta entra en pantalla (con una pausa corta,
 * para que no corra mientras todavía se mira el hero); después se repite al pasar el mouse o tocar, no sola.
 * `corre` cuenta las veces que se soltó: es la `key` que reinicia las animaciones de CSS.
 */
function Beneficio({ titulo, texto, ancho, alta, horizontal, children }: { titulo: string; texto: string; ancho?: boolean; alta?: boolean; horizontal?: boolean; children?: (corre: number) => ReactNode }) {
  const tarjeta = useRef<HTMLElement>(null);
  const [corre, setCorre] = useState(0);
  const enVista = corre > 0;
  const ocupada = useRef(false);

  const soltar = () => {
    setCorre((c) => c + 1);
    // Un rato en el que no se acepta otra repetición: si no, pasar el mouse la reinicia a la mitad y parpadea.
    ocupada.current = true;
    setTimeout(() => { ocupada.current = false; }, 2600);
  };

  useEffect(() => {
    const el = tarjeta.current;
    if (!el || !children) return;
    if (typeof IntersectionObserver === 'undefined') {
      setCorre(1);
      return;
    }
    let espera = 0;
    const o = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      espera = window.setTimeout(soltar, 500);
    }, { threshold: 0.3 });
    o.observe(el);
    return () => {
      o.disconnect();
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repetir = () => { if (enVista && !ocupada.current) soltar(); };

  return (
    <article
      ref={tarjeta}
      onPointerEnter={repetir}
      onClick={repetir}
      className={cn(
        'ben flex flex-col gap-3 rounded-tarjeta p-5 lg:last:col-span-3',
        ancho && 'sm:col-span-2',
        // Bento: en dos columnas la «alta» ocupa el ancho; en tres, una columna y dos filas.
        alta && 'sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:justify-center',
        // La pizarra es cuadrada: al costado del texto la tarjeta no queda altísima.
        horizontal && 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:content-center lg:gap-x-6 lg:[&>div]:row-span-2 lg:[&>h2]:col-start-2 lg:[&>h2]:self-end lg:[&>p]:col-start-2 lg:[&>p]:self-start',
        enVista && 'en-vista',
      )}
    >
      {children && <div key={corre}>{children(corre)}</div>}
      <h2 className="border-l-4 border-club pl-3 font-titulo text-xl leading-none font-semibold uppercase">{titulo}</h2>
      <p className="text-sm opacity-80">{texto}</p>
    </article>
  );
}
