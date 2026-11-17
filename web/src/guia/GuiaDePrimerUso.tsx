import { BarChart3, Library, LineChart, LayoutDashboard, Package, Ruler, UserCog, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GUIAS, PISTAS, estadoDePaso, pasosDeGuia } from '@datos/guias.js';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Hoja } from '../components/ui/sheet';
import { useSesion } from '../datos/contexto';
import { ajustesDePrueba, claveGuia, marcarVista, yaVista } from './vista';

type Modo = 'entrenar' | 'coordinar' | 'jugar' | 'familia';
interface Paso { pestana: string; titulo: string; texto: string }

const ICONO: Record<string, LucideIcon> = {
  'p-plantel': Users,
  'p-medir': Ruler,
  'p-datos': BarChart3,
  'p-coord-panorama': LayoutDashboard,
  'p-coord-profes': UserCog,
  'p-coord-inventario': Package,
  'p-jug-recursos': Library,
  'p-jug-progreso': LineChart,
  'p-fam-chicos': Users,
};

/**
 * La intro de primer uso de cada modo, en una hoja: tres pasos como máximo (una intro más larga se saltea sin
 * leer). Se marca como vista al cerrarla de cualquier forma (Saltar, Empezar, el velo, Escape): si alguien
 * la cerró, no se la volvemos a mostrar. Subir `version` en @datos/guias.js la vuelve a mostrar a todos.
 */
export function GuiaDePrimerUso({ modo, esCoordinador = false }: { modo: Modo; esCoordinador?: boolean }) {
  const { sesion } = useSesion();
  const usuarioId = sesion?.user.id;
  const guia = GUIAS[modo] as { version: number } | undefined;
  const [abierta, setAbierta] = useState(false);
  const [indice, setIndice] = useState(0);

  // Recién cuando se sabe quién es: la clave lleva el usuario.
  useEffect(() => {
    if (!ajustesDePrueba.sinGuias && guia && usuarioId && !yaVista(claveGuia(usuarioId, modo), guia.version)) setAbierta(true);
  }, [guia, usuarioId, modo]);

  const pasos = pasosDeGuia(modo, { esCoordinador }) as Paso[];
  useEffect(() => {
    if (!abierta) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndice((i) => Math.min(pasos.length - 1, i + 1));
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [abierta, pasos.length]);

  if (!guia || pasos.length === 0) return null;
  const paso = pasos[indice];
  const estado = estadoDePaso(indice, pasos.length) as { contador: string; hayAnterior: boolean; textoSiguiente: string };
  const Icono = ICONO[paso.pestana] ?? Users;

  const cerrar = () => {
    marcarVista(claveGuia(usuarioId, modo), guia.version);
    setAbierta(false);
  };

  return (
    <Hoja abierta={abierta} alCambiar={(a) => !a && cerrar()} titulo={paso.titulo} descripcion="Guía de primer uso" etiquetaCerrar="Saltar la guía">
      <div className="flex flex-col gap-4 p-5 pt-10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-sup-2"><Icono className="size-5" /></span>
          <span aria-live="polite" className="font-mono text-xs text-gris">{estado.contador}</span>
          <Boton variante="contorno" tamano="chico" className="ml-auto" onClick={cerrar}>Saltar</Boton>
        </div>
        {/* El título que lee el lector de pantalla ya está en la hoja: éste es sólo el visible. */}
        <p aria-hidden className="font-titulo text-3xl leading-none font-semibold uppercase">{paso.titulo}</p>
        <p className="text-base">{paso.texto}</p>
        <div className="flex gap-2">
          {estado.hayAnterior && <Boton variante="contorno" onClick={() => setIndice(indice - 1)}>Anterior</Boton>}
          <Boton onClick={() => (indice >= pasos.length - 1 ? cerrar() : setIndice(indice + 1))}>{estado.textoSiguiente}</Boton>
        </div>
      </div>
    </Hoja>
  );
}

/**
 * Pista de una vez: un aviso arriba de una pantalla que no se entiende sola, con «Entendido». No bloquea nada:
 * si alguien la ignora y sigue, la pantalla funciona igual, y vuelve hasta que la cierre.
 */
export function PistaDeUnaVez({ id, className = 'mb-3' }: { id: keyof typeof PISTAS; className?: string }) {
  const { sesion } = useSesion();
  const clave = claveGuia(sesion?.user.id, `pista.${id}`);
  const [vista, setVista] = useState(() => yaVista(clave, 1));
  const texto = (PISTAS as Record<string, string>)[id];
  if (!texto || vista) return null;
  return (
    <Aviso titulo="Antes de empezar" className={className}>
      <span className="flex flex-wrap items-center gap-3">
        <span>{texto}</span>
        <Boton variante="contorno" tamano="chico" onClick={() => { marcarVista(clave, 1); setVista(true); }}>Entendido</Boton>
      </span>
    </Aviso>
  );
}
