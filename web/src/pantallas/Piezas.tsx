import { Inbox, Moon, Sun } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Card, Panel } from '../components/ui/card';
import { Cargando, Vacio } from '../components/ui/estados';
import { FilaJugador, type Aviso as TipoAviso } from '../components/ui/fila-jugador';
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from '../components/ui/pestanas';
import { Hoja } from '../components/ui/sheet';
import { asistenciaDemo } from '../mocks/asistenciaDemo';

interface Marca {
  presente: boolean;
  aviso: TipoAviso | null;
  lesion: boolean;
}

/** La paleta cálida por familias (DESIGN.md, «Sistema de la app nueva»): cada muestra con su rol. */
const PALETA: { familia: string; muestras: { nombre: string; clase: string; rol: string }[] }[] = [
  { familia: 'Base', muestras: [
    { nombre: 'Fondo', clase: 'bg-fondo', rol: 'crema' },
    { nombre: 'Tarjeta', clase: 'bg-sup', rol: 'hueso' },
    { nombre: 'Hundido', clase: 'bg-sup-2', rol: 'arena' },
    { nombre: 'Tinta', clase: 'bg-tinta', rol: 'texto' },
  ] },
  { familia: 'Rojos', muestras: [
    { nombre: 'Club', clase: 'bg-club', rol: 'escudo y acentos' },
    { nombre: 'Profundo', clase: 'bg-club-texto', rol: 'texto rojo' },
    { nombre: 'Cereza', clase: 'bg-cereza', rol: 'piezas fuertes' },
    { nombre: 'Bordó', clase: 'bg-bordo', rol: 'menú' },
  ] },
  { familia: 'Naranjas y marrones', muestras: [
    { nombre: 'Tomate', clase: 'bg-tomate', rol: 'gráficos' },
    { nombre: 'Quemado', clase: 'bg-quemado', rol: 'gráficos' },
    { nombre: 'Caramelo', clase: 'bg-caramelo', rol: 'etiquetas' },
    { nombre: 'Cuero', clase: 'bg-cuero', rol: 'etiquetas' },
  ] },
  { familia: 'Destacados', muestras: [
    { nombre: 'Ámbar', clase: 'bg-ambar', rol: 'mejor marca' },
    { nombre: 'Sol', clase: 'bg-sol', rol: 'dato clave' },
    { nombre: 'Lima', clase: 'bg-lima', rol: 'la acción principal' },
  ] },
];

function Paleta() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PALETA.map((f) => (
        <Card key={f.familia} className="p-3">
          <h3 className="mb-2 text-sm font-semibold">{f.familia}</h3>
          <ul className="flex flex-col gap-1.5">
            {f.muestras.map((m) => (
              <li key={m.nombre} className="flex items-center gap-2.5 text-sm">
                <span aria-hidden className={`size-7 shrink-0 rounded-[0.3125rem] border border-linea ${m.clase}`} />
                <span className="font-medium">{m.nombre}</span>
                <span className="text-gris">· {m.rol}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-titulo text-2xl leading-none font-semibold tracking-wide uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

/** Página interna que muestra cada pieza, en los dos temas, con datos inventados. */
export function Piezas() {
  const [oscuro, setOscuro] = useState(false);
  const [hoja, setHoja] = useState(false);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});

  // El tema va en <html>: la hoja se dibuja en <body> y tiene que heredarlo.
  useEffect(() => {
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
  }, [oscuro]);

  const marca = (id: string): Marca => marcas[id] ?? { presente: false, aviso: null, lesion: false };
  const cambiar = (id: string, parte: Partial<Marca>) => setMarcas((m) => ({ ...m, [id]: { ...marca(id), ...parte } }));
  const presentes = asistenciaDemo.filter((j) => marca(j.id).presente).length;

  return (
    <div className="entra min-h-svh text-tinta">
      <main className="mx-auto flex w-full max-w-[24.375rem] flex-col gap-8 px-4 py-5 sm:max-w-3xl sm:px-6 lg:max-w-5xl">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gris">Piezas base · datos de ejemplo</p>
            <h1 className="font-titulo text-4xl leading-none font-semibold uppercase">Piezas</h1>
          </div>
          <button
            type="button"
            onClick={() => setOscuro((o) => !o)}
            aria-label={oscuro ? 'Pasar al tema claro' : 'Pasar al tema oscuro'}
            className="grid size-11 place-items-center rounded-full border border-borde-control outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
          >
            {oscuro ? <Sun aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
          </button>
        </header>

        <Seccion titulo="Paleta">
          <Paleta />
        </Seccion>

        <Seccion titulo="Panel con cifra">
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel titulo="Asistencia del mes">
              <p className="cifra font-titulo text-6xl leading-none font-bold tracking-tight">
                87<span className="ml-1 text-3xl text-club-texto">%</span>
              </p>
              <p className="mt-2 text-sm text-gris">
                <span className="mr-1.5 rounded-[0.3125rem] bg-ambar px-1.5 py-0.5 text-xs font-semibold text-sobre-lima">Mejor del año</span>
                12 de 14 entrenamientos.
              </p>
            </Panel>
            <div className="flex flex-col justify-center gap-3 rounded-[0.6875rem] bg-bordo p-4 text-sobre-bordo">
              <p className="text-sm opacity-80">Entrenamiento de hoy · 18:30</p>
              <p className="font-titulo text-4xl leading-none font-bold uppercase">U13 · Microestadio</p>
              <Boton flecha className="self-start">Tomar asistencia</Boton>
            </div>
          </div>
        </Seccion>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
          <Seccion titulo="Asistencia">
            <p className="text-sm text-gris">
              Tocá la fila para marcar presente. Al ausente le marcás si avisó y si tiene una lesión. Presentes: {presentes} de{' '}
              {asistenciaDemo.length}.
            </p>
            <ul aria-label="Asistencia de ejemplo" className="flex flex-col gap-2">
              {asistenciaDemo.map((j) => (
                <FilaJugador
                  key={j.id}
                  nombre={j.nombre}
                  posicion={j.posicion}
                  numero={j.numero}
                  {...marca(j.id)}
                  alPresente={(presente) => cambiar(j.id, { presente })}
                  alAviso={(aviso) => cambiar(j.id, { aviso })}
                  alLesion={(lesion) => cambiar(j.id, { lesion })}
                />
              ))}
            </ul>
          </Seccion>

          <div className="flex flex-col gap-8">
            <Seccion titulo="Botones">
              <div className="flex flex-wrap gap-3">
                <Boton flecha>Tomar asistencia</Boton>
                <Boton variante="linea">Ver historial</Boton>
                <Boton variante="club">Borrar</Boton>
                <Boton variante="secundario">Ver ficha</Boton>
                <Boton variante="contorno">Cancelar</Boton>
                <Boton disabled>Guardando…</Boton>
              </div>
            </Seccion>

            <Seccion titulo="Tarjeta y hoja">
              <Card className="flex items-center justify-between gap-3 p-4">
                <p className="text-sm">Entrenamiento del martes, 18:30.</p>
                <Boton tamano="chico" variante="secundario" onClick={() => setHoja(true)}>
                  Abrir hoja
                </Boton>
              </Card>
              <Hoja abierta={hoja} alCambiar={setHoja} titulo="Hoja de ejemplo" descripcion="Una hoja inferior con datos inventados.">
                <div className="flex flex-col gap-3 p-5 pt-12">
                  <h3 className="font-titulo text-3xl leading-none font-semibold uppercase">Hoja de ejemplo</h3>
                  <p className="text-sm text-gris">Sube desde abajo en el celular. Se cierra con la cruz, el velo o Escape.</p>
                  <Boton onClick={() => setHoja(false)}>Listo</Boton>
                </div>
              </Hoja>
            </Seccion>

            <Seccion titulo="Pestañas">
              <Pestanas defaultValue="fisico">
                <ListaPestanas aria-label="Secciones de ejemplo">
                  <Pestana value="fisico">Físico</Pestana>
                  <Pestana value="tiro">Tiro</Pestana>
                  <Pestana value="partidos">Partidos</Pestana>
                </ListaPestanas>
                <PanelPestana value="fisico"><p className="text-sm text-gris">Salto y sprint del plantel.</p></PanelPestana>
                <PanelPestana value="tiro"><p className="text-sm text-gris">Porcentajes de tiro.</p></PanelPestana>
                <PanelPestana value="partidos"><p className="text-sm text-gris">Últimos partidos.</p></PanelPestana>
              </Pestanas>
            </Seccion>

            <Seccion titulo="Campos">
              <Campo etiqueta="Nombre del ejercicio" ayuda="Hasta 60 letras." maxLength={60} placeholder="Ej.: Tres contra dos" />
              <Campo etiqueta="Minutos" inputMode="decimal" defaultValue="1e2" error="Escribí un número, por ejemplo 15." />
            </Seccion>

            <Seccion titulo="Avisos">
              <Aviso titulo="Datos de ejemplo">Ningún nombre es de un chico real.</Aviso>
              <Aviso tono="ok" titulo="Asistencia guardada" />
              <Aviso tono="error" titulo="No se pudo guardar">Revisá la conexión y probá de nuevo.</Aviso>
            </Seccion>

            <Seccion titulo="Vacío y carga">
              <Card>
                <Vacio icono={Inbox} titulo="Sin partidos todavía" accion={<Boton tamano="chico">Cargar partido</Boton>}>
                  Cuando cargues el primero, vas a ver acá sus números.
                </Vacio>
              </Card>
              <Cargando filas={2} />
            </Seccion>
          </div>
        </div>
      </main>
    </div>
  );
}
