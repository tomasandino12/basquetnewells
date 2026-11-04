import { Inbox, Moon, Sun } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Campo } from '../components/ui/campo';
import { Card } from '../components/ui/card';
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
    <div className="min-h-svh bg-fondo text-tinta">
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
                <Boton>Guardar</Boton>
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
