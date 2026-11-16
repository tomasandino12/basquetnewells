import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from './datos/contexto';
import { BASE, crearRouter } from './rutas';
import { limpiarDireccionVieja } from './direccionVieja';
import { registrarFallaDeLaVuelta } from './cuenta/vuelta';
import { AvisoDeFalla, PantallaRota, iniciarReporteDeErrores } from './errores/reporte';
import { registrarServiceWorker } from './pwa';
import './estilos.css';

// Un link vencido llega como error en la dirección: se guarda para decirlo en Entrar.
registrarFallaDeLaVuelta();
limpiarDireccionVieja(BASE);
iniciarReporteDeErrores();
registrarServiceWorker();
createRoot(document.getElementById('raiz')!).render(
  <PantallaRota>
    <Proveedores>
      <RouterProvider router={crearRouter()} />
      <AvisoDeFalla />
    </Proveedores>
  </PantallaRota>,
);
