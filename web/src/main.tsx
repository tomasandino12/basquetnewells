import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from './datos/contexto';
import { crearRouter } from './rutas';
import './estilos.css';

createRoot(document.getElementById('raiz')!).render(
  <Proveedores>
    <RouterProvider router={crearRouter()} />
  </Proveedores>,
);
