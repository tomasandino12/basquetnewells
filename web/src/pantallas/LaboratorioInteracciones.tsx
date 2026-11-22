import { useState } from 'react';
import { Interruptor } from '../components/ui/interruptor';
import { Pagina } from '../components/ui/pagina';
import { SeccionCargadores } from '../laboratorio-interacciones/Cargadores';
import { SeccionConstancia } from '../laboratorio-interacciones/Constancia';
import { SeccionEnviarRecurso } from '../laboratorio-interacciones/EnviarRecurso';
import { SeccionImportador } from '../laboratorio-interacciones/Importador';
import { ContextoLento } from '../laboratorio-interacciones/piezas';
import '../laboratorio-interacciones/interacciones.css';

/**
 * Laboratorio de microinteracciones: se prueban acá antes de tocar una pantalla de verdad. Datos
 * inventados, nada se guarda ni se manda. Cuelga de «Con datos de ejemplo», como Piezas.
 */
export function LaboratorioInteracciones() {
  const [lento, setLento] = useState(false);
  return (
    <ContextoLento.Provider value={lento ? 4 : 1}>
      <Pagina>
        <div className="lab flex flex-col gap-4" data-lento={lento ? 'si' : undefined}>
          <header className="flex flex-col gap-1">
            <p className="font-mono text-xs tracking-wide text-gris uppercase">Laboratorio · datos inventados</p>
            <h1 className="font-titulo text-4xl leading-none font-bold uppercase">Microinteracciones</h1>
            <p className="max-w-prose text-sm text-gris">
              Cuatro mecánicas para comparar antes de llevarlas a una pantalla. Sólo mueven transform y opacity, duran entre 250 y 700 ms y
              ninguna queda en loop. Probalas también con el tema oscuro y con «reducir movimiento» del sistema.
            </p>
          </header>
          <div className="max-w-md rounded-tarjeta border border-linea bg-sup px-4">
            <Interruptor etiqueta="Cámara lenta (×4)" descripcion="Para mirar la física cuadro a cuadro" activo={lento} alCambiar={setLento} />
          </div>
          <SeccionCargadores />
          <SeccionImportador />
          <SeccionEnviarRecurso />
          <SeccionConstancia />
        </div>
      </Pagina>
    </ContextoLento.Provider>
  );
}
