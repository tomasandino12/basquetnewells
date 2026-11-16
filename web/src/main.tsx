import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from './datos/contexto';
import { BASE, crearRouter } from './rutas';
import { limpiarDireccionVieja } from './direccionVieja';
import { reenviarSiCorresponde } from './clasica';
import { registrarFallaDeLaVuelta } from './cuenta/vuelta';
import './estilos.css';

if (!reenviarSiCorresponde()) {
  // Un link vencido llega como error en la dirección: se guarda para decirlo en Entrar.
  registrarFallaDeLaVuelta();
  limpiarDireccionVieja(BASE);
  createRoot(document.getElementById('raiz')!).render(
    <Proveedores>
      <RouterProvider router={crearRouter()} />
    </Proveedores>,
  );
}
