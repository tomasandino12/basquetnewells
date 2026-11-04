import { createRoot } from 'react-dom/client';
import { Plantel } from './pantallas/Plantel';
import './estilos.css';

// Pantalla única y escondida: nadie la enlaza desde la app vieja.
createRoot(document.getElementById('raiz')!).render(<Plantel />);
