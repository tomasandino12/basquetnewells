import { createRoot } from 'react-dom/client';
import { Ejemplo } from './pantallas/Ejemplo';
import './estilos.css';

// Pantalla única y escondida: nadie la enlaza desde la app vieja.
createRoot(document.getElementById('raiz')!).render(<Ejemplo />);
