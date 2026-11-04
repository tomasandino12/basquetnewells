import { createRoot } from 'react-dom/client';
import { Piezas } from './pantallas/Piezas';
import { Plantel } from './pantallas/Plantel';
import './estilos.css';

// Pantallas escondidas: nadie las enlaza desde la app vieja. `#piezas` muestra las piezas base.
const Pantalla = window.location.hash === '#piezas' ? Piezas : Plantel;
createRoot(document.getElementById('raiz')!).render(<Pantalla />);
