import { configure } from '@testing-library/react';

// Con muchos archivos en paralelo, la primera pantalla de cada archivo tarda en cargar
// (jsdom + rutas perezosas) y el segundo por defecto de findBy… no alcanza: la prueba
// fallaba sólo bajo carga. Más margen, sin cambiar lo que se verifica.
configure({ asyncUtilTimeout: 5000 });
