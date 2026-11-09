import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Proveedores } from './datos/contexto';
import { crearRouter } from './rutas';
import { reenviarSiCorresponde } from './clasica';
import './estilos.css';

// La vuelta del login o de un mail la resuelve la app de siempre (clasica.ts).
if (!reenviarSiCorresponde()) {
  createRoot(document.getElementById('raiz')!).render(
    <Proveedores>
      <RouterProvider router={crearRouter()} />
    </Proveedores>,
  );
}
