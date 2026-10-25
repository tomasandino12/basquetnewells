import { iniciarPortal } from './portal.js';
import { iniciarRise, iniciarParallax, iniciarDock, iniciarCintaPausa, iniciarGiroSponsor } from './animaciones.js';

// Aparte de portal.js para que los tests importen los armadores de HTML sin
// que se ejecute nada contra el DOM.
iniciarPortal();
iniciarRise();
iniciarParallax();
iniciarDock();
iniciarCintaPausa();
iniciarGiroSponsor();
