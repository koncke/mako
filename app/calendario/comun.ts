// =============================================================================
// comun — lo que comparten las piezas de la copia de Google Calendar: de qué calendario es cada renglón y su color
// =============================================================================
// En la barra lateral, como en Google, cada renglón cuelga de UN calendario con su casilla de color:
//   · «Mis calendarios» (MaKo): Publicaciones, Llamadas, Bloques de trabajo, el Plan y los Objetivos — las capas de
//     siempre (lib/calendario-modelo.ts), con un color de la paleta de Google para que se lean como calendarios.
//   · La cuenta de Google conectada: cada uno de sus calendarios, con el color que le dio Google.
// La llave de un calendario es `mk:<capa>` o `g:<id de Google>`, y es lo que se prende y apaga.
// =============================================================================

import { CAPAS_CALENDARIO, type CapaCalendario, type ItemCalendario } from '@/lib/calendario-modelo';

/** El color de cada calendario de MaKo, de la paleta de eventos de Google (los mismos hex que su web). */
export const COLOR_CAPA: Record<CapaCalendario, string> = {
  publicaciones: '#8e24aa',
  llamadas: '#039be5',
  bloques: '#33b679',
  plan: '#f4511e',
  objetivos: '#616161',
};

/** El nombre de cada calendario de MaKo en la barra lateral. */
export const NOMBRE_CAPA: Record<CapaCalendario, string> = {
  publicaciones: 'Publicaciones',
  llamadas: 'Llamadas',
  bloques: 'Bloques de trabajo',
  plan: 'Plan',
  objetivos: 'Objetivos',
};

export const LLAVES_MAKO = CAPAS_CALENDARIO.map((c) => `mk:${c.id}`);

export const llaveDe = (it: ItemCalendario): string => (it.google ? `g:${it.google.calendarioId}` : `mk:${it.capa}`);
export const colorDe = (it: ItemCalendario): string => it.google?.color ?? COLOR_CAPA[it.capa];

/** Se puede mover en la grilla: lo propio, y lo de Google que es editable. */
export const sePuedeMover = (it: ItemCalendario, googleEscribe: boolean): boolean =>
  it.fuente === 'propio' || (!!it.google && it.google.editable && googleEscribe);
