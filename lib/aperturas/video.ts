// =============================================================================
// La apertura del Video Editor: los subtítulos primero (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Video Editor»), T11. Con un video que tiene voz, sin subtítulos y con la charla vacía, MaKo
// pregunta un HECHO, «¿Lo van a ver sin sonido?»: «Sí, en el feed» pone los subtítulos con el mismo motor que el botón de la tab
// (`generarSubtitulos`, Whisper en el navegador: anda SIN la app de escritorio); «No, con sonido» queda contestado para ESE
// proyecto (alcance `entidad`) y no vuelve.
//
// ⚠️ PURO Y SIN EL EDITOR: lo que cuenta subtítulos y voz (`subtitulosDe`, las pistas) vive en _opencut, que importa el WASM y no
// carga en node (AGENTS.md). El chat cuenta y le pasa los números; acá sólo se decide.
// ⚠️ LA DE LA LÍNEA VACÍA («¿Ya grabaste tu video?») NO ESTÁ: falta cómo abrir la biblioteca desde el chat. docs/relevo/nube-iniciativa.md.
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosVideo = {
  /** El proyecto abierto (su id): la clave de lo contestado. null = no hay proyecto. */
  proyecto: string | null;
  /** ¿Hay algo con sonido en la línea de tiempo (un video o un audio)? */
  conAudio: boolean;
  /** Cuántos subtítulos tiene la escena (`subtitulosDe`). */
  subtitulos: number;
  /** ¿La charla de este proyecto está vacía? Con un mensaje, el hilo ya es la conversación. */
  charlaVacia: boolean;
};

export const ID_SIN_SONIDO = 'video:sin-sonido';
export const CON_SONIDO = 'con-sonido';

export const ACCIONES_VIDEO = ['subtitulos'] as const;
export type AccionVideo = (typeof ACCIONES_VIDEO)[number];

/** El id del proyecto como entra en la clave de la memoria (`[A-Za-z0-9_-]`, 60 como mucho). */
const entidadDe = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);

export function aperturaVideo(h: HechosVideo, r: Respuestas): Apertura<AccionVideo> | null {
  if (!h.proyecto || !entidadDe(h.proyecto) || !h.charlaVacia || !h.conAudio || h.subtitulos > 0 || r[ID_SIN_SONIDO]) return null;
  return {
    id: ID_SIN_SONIDO, alcance: 'entidad', entidad: entidadDe(h.proyecto),
    texto: 'Tu video tiene voz y todavía no tiene subtítulos. ¿Lo van a ver sin sonido?',
    botones: [
      { tipo: 'hacer', rotulo: 'Sí, en el feed', accion: 'subtitulos' },
      { tipo: 'respuesta', rotulo: 'No, con sonido', valor: CON_SONIDO },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_VIDEO: Superficie<HechosVideo, AccionVideo> = { id: 'video', acciones: ACCIONES_VIDEO, apertura: aperturaVideo };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_SIN_SONIDO, cuando: 'Un video con voz, sin subtítulos y con la charla de ese proyecto vacía.' },
];

export const EJEMPLOS: readonly { nombre: string; h: HechosVideo; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'con voz y sin subtítulos', h: { proyecto: 'p-7f3a', conAudio: true, subtitulos: 0, charlaVacia: true }, r: {}, espera: ID_SIN_SONIDO, primerPaso: true },
  { nombre: 'ya tiene subtítulos', h: { proyecto: 'p-7f3a', conAudio: true, subtitulos: 12, charlaVacia: true }, r: {}, espera: null },
  { nombre: 'sin sonido en la línea', h: { proyecto: 'p-7f3a', conAudio: false, subtitulos: 0, charlaVacia: true }, r: {}, espera: null },
  { nombre: 'con la charla empezada', h: { proyecto: 'p-7f3a', conAudio: true, subtitulos: 0, charlaVacia: false }, r: {}, espera: null },
  { nombre: 'contestó «con sonido» en esta visita', h: { proyecto: 'p-7f3a', conAudio: true, subtitulos: 0, charlaVacia: true }, r: { [ID_SIN_SONIDO]: CON_SONIDO }, espera: null },
  { nombre: 'sin proyecto abierto', h: { proyecto: null, conAudio: true, subtitulos: 0, charlaVacia: true }, r: {}, espera: null },
];
