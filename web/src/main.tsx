import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from './datos/contexto';
import { BASE, crearRouter } from './rutas';
import { limpiarDireccionVieja } from './direccionVieja';
import { reenviarSiCorresponde } from './clasica';
import './estilos.css';

// La vuelta del login o de un mail la resuelve la app de siempre (clasica.ts).
if (!reenviarSiCorresponde()) {
  limpiarDireccionVieja(BASE);
  createRoot(document.getElementById('raiz')!).render(
    <Proveedores>
      <RouterProvider router={crearRouter()} />
    </Proveedores>,
  );
}
