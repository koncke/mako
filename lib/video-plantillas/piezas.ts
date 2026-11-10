// =============================================================================
// Las piezas de un video, reutilizables en TODA plantilla de la tab Video (PURO; 9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «documentar y reusar las piezas generales para todas las plantillas: personaje, fondo, voz, tomas
// blancas, música, subtítulos, efectos». La tabla de origen está en docs/plantillas-video/mensaje-para/PROCESO.md; la regla de
// cada pieza, con su porqué, en docs/manual-video-mako.md (§3 las universales, §8 las de cada asset).
//
// Cada pieza dice QUÉ le pide MaKo a la persona (lo que se dibuja en el chat) y su REGLA en una línea (lo que se valida antes de
// mostrarle algo). Una plantilla nombra sus piezas por id; una pieza nueva se agrega acá, nunca adentro de una plantilla.
// =============================================================================

export const IDS_PIEZA = ['personaje', 'fondo', 'clip-hablado', 'voz', 'toma-blanca', 'musica', 'subtitulos', 'efecto', 'cartel'] as const;
export type IdPieza = (typeof IDS_PIEZA)[number];

/** Dónde queda guardada la pieza en el proyecto: la carpeta de Multimedia (./carpetas abajo). */
export type IdCarpeta = 'recursos' | 'generaciones' | 'voz' | 'musica' | 'entregas';

export type Pieza = {
  id: IdPieza;
  nombre: string;
  /** Lo que MaKo le pide a la persona para esta pieza (vacío: la arma el editor solo). */
  pide: string;
  /** La regla, en una línea: lo que se revisa antes de mostrarle el resultado. */
  regla: string;
  /** ¿Gasta créditos? Sólo el video (Flow cobra el video; la imagen, no: manual §2). */
  gasta: boolean;
  carpeta: IdCarpeta;
};

export const PIEZAS: Readonly<Record<IdPieza, Pieza>> = {
  personaje: {
    id: 'personaje', nombre: 'Personaje', pide: 'Una foto tuya de frente, con luz de día, o un personaje que ya aprobaste.',
    regla: 'Es la base de toda imagen: nunca se parte del cuadro de otro clip.', gasta: false, carpeta: 'recursos',
  },
  fondo: {
    id: 'fondo', nombre: 'Fondo', pide: 'Dónde vas a estar: una referencia del lugar.',
    regla: 'Se termina solo, sin personas, y recién después entra el personaje.', gasta: false, carpeta: 'generaciones',
  },
  'clip-hablado': {
    id: 'clip-hablado', nombre: 'Clip hablado', pide: 'La frase de ese bloque del guion.',
    regla: 'Primero la imagen y tu OK; después UN video, con la duración que piden sus palabras.', gasta: true, carpeta: 'generaciones',
  },
  voz: {
    id: 'voz', nombre: 'Voz', pide: 'Tu voz clonada, o grabarla ahora.',
    regla: 'Se pasa con tu voz sobre la del clip: el acento lo pone el clip.', gasta: false, carpeta: 'voz',
  },
  'toma-blanca': {
    id: 'toma-blanca', nombre: 'Toma blanca', pide: 'La pose, con una foto de referencia.',
    regla: 'A contraluz sobre blanco, con la luz copiada de una toma ya aprobada.', gasta: true, carpeta: 'generaciones',
  },
  musica: {
    id: 'musica', nombre: 'Música', pide: 'La canción de la referencia u otra.',
    regla: 'Golpes donde los pone la referencia; nunca debajo de la voz.', gasta: false, carpeta: 'musica',
  },
  subtitulos: {
    id: 'subtitulos', nombre: 'Subtítulos', pide: '',
    regla: 'De 2 a 3 palabras, debajo del mentón medido en cada clip.', gasta: false, carpeta: 'entregas',
  },
  efecto: {
    id: 'efecto', nombre: 'Efecto de sonido', pide: '',
    regla: 'De a uno, sólo donde suma.', gasta: false, carpeta: 'musica',
  },
  cartel: {
    id: 'cartel', nombre: 'Cartel', pide: 'Lo que pides al final y tu oferta.',
    regla: 'Legible, en el cierre sin voz.', gasta: false, carpeta: 'entregas',
  },
};

/** Las carpetas de un proyecto de plantilla, en el orden en que se muestran (Martín: «recursos, generaciones, etc.»). */
export const CARPETAS: readonly { id: IdCarpeta; nombre: string; que: string }[] = [
  { id: 'recursos', nombre: 'Recursos', que: 'Lo que subiste: tus fotos y tus audios.' },
  { id: 'generaciones', nombre: 'Generaciones', que: 'Lo que hizo MaKo: imágenes y clips.' },
  { id: 'voz', nombre: 'Voz', que: 'Tu voz, pasada sobre cada clip.' },
  { id: 'musica', nombre: 'Música', que: 'La canción y los efectos.' },
  { id: 'entregas', nombre: 'Entregas', que: 'El video terminado, con y sin música.' },
];
