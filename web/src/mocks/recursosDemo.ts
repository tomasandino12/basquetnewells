import type { DatosDePizarra, EjercicioDeLista, JugadaDelClub, Repositorio } from '../datos/repositorio';

// Todo inventado para la maqueta de Recursos: ningún dato es del club.
const ej = (id: string, titulo: string, tema: string, extra: Partial<EjercicioDeLista> = {}): EjercicioDeLista => ({
  id, titulo, tema, descripcion: null, enlace: null, material: null, jugadores: null, categorias: null,
  creadoPor: null, creadoEn: '2026-10-01T10:00:00Z', tieneNotas: false, cantidadVariaciones: 0, ...extra,
});

const PIZARRA: DatosDePizarra = {
  cancha: 'media',
  fichas: [
    { id: 'a1', tipo: 'ataque', numero: 1, x: 0.5, y: 0.78 },
    { id: 'a2', tipo: 'ataque', numero: 2, x: 0.86, y: 0.5 },
    { id: 'a3', tipo: 'ataque', numero: 3, x: 0.14, y: 0.5 },
    { id: 'a4', tipo: 'ataque', numero: 4, x: 0.32, y: 0.3 },
    { id: 'a5', tipo: 'ataque', numero: 5, x: 0.66, y: 0.3 },
    { id: 'd1', tipo: 'defensa', numero: 1, x: 0.5, y: 0.66 },
    { id: 'd2', tipo: 'defensa', numero: 2, x: 0.78, y: 0.44 },
  ],
  pelota: 'a1',
  pasos: [
    { acciones: [{ tipo: 'dribbling', ficha: 'a1', hasta: { x: 0.56, y: 0.62 }, control: null }, { tipo: 'cortina', ficha: 'a4', hasta: { x: 0.44, y: 0.5 }, control: null }], nota: 'El 1 entra al lado de la cortina' },
    { acciones: [{ tipo: 'pase', ficha: 'a1', a: 'a2' }, { tipo: 'corte', ficha: 'a5', hasta: { x: 0.6, y: 0.14 }, control: null }] },
    { acciones: [{ tipo: 'pase', ficha: 'a2', a: 'a5' }, { tipo: 'tiro', ficha: 'a5' }], nota: 'Termina el que cortó' },
  ],
};

const EJERCICIOS = [
  ej('e1', 'Pase de pecho en parejas', 'pase', { descripcion: 'Dos filas enfrentadas a cuatro metros. Cada pase va con los dos pies firmes y los dedos hacia afuera.\n\nDespués de pasar, se cambia de fila.', material: '2 pelotas', jugadores: '8', categorias: 'U13, U15', tieneNotas: true, cantidadVariaciones: 2 }),
  ej('e2', 'Cierre de línea de pase', 'defensa', { descripcion: 'El defensor se mueve para quedar entre la pelota y su atacante, con una mano en la línea de pase.', material: 'Conos', jugadores: '6' }),
  ej('e3', 'Tres contra dos en 6 segundos', 'contraataque', { descripcion: 'Salida rápida con tres jugadores contra dos defensores. Hay que terminar antes de los 6 segundos.', material: 'Muchas pelotas', jugadores: '10', tieneNotas: true }),
  ej('e4', 'Pelotas en el centro', 'juego', { descripcion: 'Se agrupan en grupos de 2 a 3 chicos y aros al lado. Los chicos corren a buscar las pelotas y van con su grupo con dribbling.', material: 'Muchas pelotas', jugadores: '12' }),
  ej('e5', 'Rebote de dos en dos', 'rebote', { descripcion: 'Dos jugadores pelean el rebote de un tiro del entrenador.', jugadores: '4' }),
  ej('e6', 'Sentadilla con salto', 'fisico', { enlace: 'https://ejemplo.test/video', descripcion: 'Tres series de ocho saltos con buena técnica de aterrizaje.' }),
  ej('e7', 'Movimiento sin balón con 3 atacantes', 'otro'),
];

const JUGADAS: JugadaDelClub[] = [
  { id: 'j1', nombre: 'Gero', tipo: 'ataque', datos: PIZARRA, creadoPor: 'u-1', esMia: true, actualizadoEn: '2026-10-01T10:00:00Z' },
  { id: 'j2', nombre: 'Salida lateral rápida', tipo: 'lateral', datos: PIZARRA, creadoPor: 'u-2', esMia: false, actualizadoEn: '2026-10-01T10:00:00Z' },
  { id: 'j3', nombre: 'Zona 2-3', tipo: 'defensa', datos: PIZARRA, creadoPor: 'u-1', esMia: true, actualizadoEn: '2026-10-01T10:00:00Z' },
  { id: 'j4', nombre: 'Rojo (presión)', tipo: 'presion', datos: PIZARRA, creadoPor: 'u-1', esMia: true, actualizadoEn: '2026-10-01T10:00:00Z' },
];

/** Lo que Recursos le pide al repositorio, con datos de ejemplo. Nada se guarda. */
export const PARA_RECURSOS: Partial<Repositorio> = {
  obtenerEjercicios: async () => EJERCICIOS,
  obtenerEjercicio: async (_club, id) => {
    const e = EJERCICIOS.find((x) => x.id === id);
    return e ? { ...e, pizarra: id === 'e1' ? PIZARRA : null } : null;
  },
  obtenerNotas: async (_club, id) =>
    id === 'e1' || id === 'e3'
      ? [{ id: 'n1', texto: 'Con chicos de 12 funciona mejor a media velocidad.', creadoPor: null, creadoEn: '2026-10-02T10:00:00Z' }]
      : [],
  obtenerVariaciones: async (_club, id) =>
    id === 'e1'
      ? [
          { id: 'v2', nivel: 3, eje: 'oposicion', titulo: 'Con defensor pasivo', descripcion: null, creadoEn: '2026-10-02T10:00:00Z' },
          { id: 'v1', nivel: 1, eje: 'espacio', titulo: 'Más cerca', descripcion: 'Un paso menos de distancia.', creadoEn: '2026-10-01T10:00:00Z' },
        ]
      : [],
  // En la demo nada se guarda: las escrituras responden sin tocar nada.
  crearEjercicio: async () => 'demo',
  actualizarEjercicio: async () => {},
  borrarEjercicio: async () => {},
  guardarRecurso: async () => ({}),
  borrarRecurso: async () => {},
  crearNota: async () => 'demo',
  borrarNota: async () => {},
  crearVariacion: async () => 'demo',
  actualizarVariacion: async () => {},
  borrarVariacion: async () => {},
  listarJugadas: async () => JUGADAS,
  plantelesDeJugada: async () => [],
  asignarJugada: async () => {},
  crearJugada: async () => 'ju-nueva',
  obtenerJugada: async () => null,
  guardarJugada: async () => {},
  borrarJugada: async () => {},
};
