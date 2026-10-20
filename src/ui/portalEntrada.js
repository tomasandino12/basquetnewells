import { destinoDeAuth } from '../data/entradaAuth.js';

// Va primero en portal.html. Si la URL es la vuelta de un login o de un mail
// de Supabase (que todavía apuntan a "/"), se manda a /app con sus parámetros.
const destino = destinoDeAuth(window.location.search, window.location.hash);
if (destino) window.location.replace(destino);
