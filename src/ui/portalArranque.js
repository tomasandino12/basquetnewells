import { iniciarPortal } from './portal.js';
import { iniciarRise } from './animaciones.js';

// Aparte de portal.js para que los tests importen los armadores de HTML sin
// que se ejecute nada contra el DOM.
iniciarPortal();
iniciarRise();
