import escudo from '../../../public/escudo.png';
import { Boton } from '../components/ui/button';

/**
 * La portada que ve quien llega sin cuenta (la landing de siempre, en oscuro como el portal público):
 * qué es la app y dos puertas, crear cuenta o entrar. Las demos son dibujos quietos con datos inventados.
 * Todo el texto describe lo que ya está construido: lo que no existe, no se promete.
 */
export function Portada({ alCrear, alEntrar }: { alCrear: () => void; alEntrar: () => void }) {
  return (
    <div className="flex flex-col gap-10 py-10 lg:py-16">
      <section className="flex flex-col-reverse items-center gap-8 text-center md:flex-row md:justify-between md:text-left" aria-label="Qué es Inferiores">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-widest text-sobre-negro uppercase opacity-70">Inferiores · Newell&apos;s Old Boys</p>
          <h1 className="mt-3 font-titulo text-5xl leading-none font-bold uppercase md:text-6xl">
            Lo que se trabaja en inferiores, <span className="text-club">queda</span>
          </h1>
          <p className="mt-4 text-lg opacity-80">
            Partidos, mediciones y ejercicios de las formativas en un solo lugar, que sigue estando cuando cambia el cuerpo técnico.
          </p>
        </div>
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 200 200" aria-hidden focusable="false" className="absolute inset-0 size-full motion-safe:animate-[spin_60s_linear_infinite]">
            <defs>
              <path id="circulo-anillo" d="M100,22 a78,78 0 1,1 0,156 a78,78 0 1,1 0,-156" />
            </defs>
            <text fontSize="15" className="fill-current font-titulo font-semibold opacity-60" letterSpacing="0.6">
              <textPath href="#circulo-anillo" textLength="490" lengthAdjust="spacing">BÁSQUET · NEWELL&apos;S OLD BOYS · </textPath>
            </text>
          </svg>
          <img src={escudo} alt="" width={96} height={96} className="absolute inset-[26%] size-[48%] object-contain" />
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-3 md:justify-start">
        <Boton onClick={alCrear}>Crear cuenta</Boton>
        <Boton variante="contorno" className="border-sobre-negro/40 text-sobre-negro" onClick={alEntrar}>Ya tengo cuenta</Boton>
      </div>

      <section aria-label="Qué hace" className="grid gap-4 md:grid-cols-2">
        <Beneficio ancho titulo="El plantel se arma solo" texto="Subís la planilla del partido de la CABB y los jugadores se crean solos. Un partido trae la enorme mayoría del plantel sin escribir un nombre a mano.">
          <div aria-hidden className="flex flex-wrap items-center gap-4">
            <table className="font-mono text-xs">
              <tbody>
                {[
                  ['4', 'GÓMEZ, Mateo', '12'],
                  ['7', 'FERREYRA, Lucas', '9'],
                  ['9', 'IBARRA, Tomás', '14'],
                  ['11', 'SOSA, Joaquín', '8'],
                ].map(([n, j, p]) => (
                  <tr key={n} className="border-b border-white/10">
                    <td className="py-1 pr-3">{n}</td>
                    <td className="pr-3">{j}</td>
                    <td className="text-right">{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <span>→</span>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {['#4 Gómez', '#7 Ferreyra', '#9 Ibarra', '#11 Sosa', '+ 9 más'].map((c) => (
                <span key={c} className="rounded-full border border-white/20 px-2 py-0.5">{c}</span>
              ))}
            </div>
          </div>
        </Beneficio>

        <Beneficio titulo="El trabajo no se pierde" texto="El historial de cada jugador sobrevive a las temporadas, a los cambios de categoría y al cambio de entrenador. Lo que se midió hace dos años sigue estando.">
          <ol aria-hidden className="flex flex-col gap-2 border-l-2 border-club pl-4 text-sm">
            <li>U13 · 2025 · Profe A</li>
            <li>U13 · 2026 · Profe B</li>
            <li>U15 · 2027 · Profe C</li>
          </ol>
        </Beneficio>

        <Beneficio ancho titulo="Estadísticas con historia" texto="Reparto de minutos y de puntos, el tiro del equipo partido a partido, y las mediciones que se cargan en la práctica: la batería de tiro y los saltos. Queda la evolución de cada jugador y del equipo a lo largo del tiempo.">
          <div aria-hidden className="flex flex-wrap items-center gap-6">
            <svg viewBox="0 0 220 80" className="h-20 w-56" focusable="false">
              <polyline fill="none" stroke="var(--color-club)" strokeWidth="3" points="10,60.4 26,47.6 42,66.8 58,44.4 74,38 90,54 106,31.6 122,41.2 138,25.2 154,18.8" />
              <circle cx="154" cy="18.8" r="3.5" fill="var(--color-club)" />
              <text x="166" y="27" fontSize="20" className="fill-current font-mono font-bold">44 %</text>
            </svg>
            <p className="font-mono text-sm">
              <span className="block text-xs opacity-70">SALTO CMJ</span>
              <span className="text-2xl font-bold">42 cm</span> <span className="text-xs text-lima">+4 cm</span>
            </p>
          </div>
        </Beneficio>

        <Beneficio ancho titulo="Las jugadas del club" texto="Los profes arman las jugadas en un editor y las ven entre ellos, para ir forjando una identidad de juego. Cada jugador ve las que su profe le asigna a su categoría, para repasarlas antes de los partidos." />
        <Beneficio titulo="Los ejercicios quedan en el club" texto="Una biblioteca compartida entre los profes, con notas de qué funcionó y qué no con cada categoría. Justo lo que hoy se pierde cuando alguien se va." />
        <Beneficio titulo="Pensada para el celular" texto="En la cancha, con una mano, durante la práctica. No es una planilla de escritorio adaptada a una pantalla chica." />
      </section>

      <p className="text-sm opacity-70">
        Piloto en curso. Todo lo que está listado acá arriba está construido y funcionando; lo que no está en esa lista, todavía no existe.
      </p>
      <p className="text-sm">
        <a className="underline" href="/privacidad">Política de privacidad</a> · <a className="underline" href="/terminos">Términos y condiciones</a>
      </p>
    </div>
  );
}

function Beneficio({ titulo, texto, ancho, children }: { titulo: string; texto: string; ancho?: boolean; children?: React.ReactNode }) {
  return (
    <article className={`flex flex-col gap-3 rounded-tarjeta border border-white/10 bg-white/[0.03] p-5 ${ancho ? 'md:col-span-2' : ''}`}>
      {children}
      <h2 className="border-l-4 border-club pl-3 font-titulo text-xl leading-none font-semibold uppercase">{titulo}</h2>
      <p className="text-sm opacity-80">{texto}</p>
    </article>
  );
}
