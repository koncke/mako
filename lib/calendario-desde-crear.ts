// =============================================================================
// calendario-desde-crear — «Publicar» desde el Video Editor, el Image Editor y el Copywriter (29/10/2026)
// =============================================================================
// Martín, por el Cerebro: «que con las funcionalidades que ya creamos puedan publicar en Facebook, TikTok, LinkedIn…». Y el
// Cerebro: «El botón lleva lo exportado (el video, la imagen o el texto) al Calendario con el evento ya armado, para elegir la red,
// el día y la hora. Un solo camino de publicación, el del Calendario». Acá viven las decisiones, puras: qué evento se arma con lo
// que viene de cada editor, qué archivo se acepta y a dónde se vuelve. Lo que escribe: `publicacionDesdeCrearAction`
// (app/calendario/actions.ts); lo que sube y navega: app/calendario/publicar-desde-crear.ts.
//
// ⚠️ NO HAY OTRO CAMINO A LA RED: nada de esto programa. Arma una Publicación «planeada» para MAÑANA a las 10:00 (la hora la cambia
//    la persona); la red, la cuenta y el «Programar» son los del Calendario, con los límites de cada red (motivoParaNoProgramar).
//
// Puro (sin `server-only`): lo prueba tests/publicar-desde-crear.test.ts.
// =============================================================================

import { sumarDias, TOPE_NOTAS, TOPE_TITULO, type EntradaEvento, type FormatoPublicacion } from './calendario-modelo';
import { TOPE_TEXTO, tipoDeArchivo } from './calendario-publicar-reglas';

export const ORIGENES_CREAR = ['video', 'imagen', 'texto'] as const;
export type OrigenCrear = (typeof ORIGENES_CREAR)[number];
export const esOrigenCrear = (x: unknown): x is OrigenCrear => typeof x === 'string' && (ORIGENES_CREAR as readonly string[]).includes(x);

/** El título del evento si lo exportado no trae nombre. */
export const TITULO_DE_ORIGEN: Readonly<Record<OrigenCrear, string>> = {
  video: 'Video del Video Editor', imagen: 'Imagen del Image Editor', texto: 'Texto del Copywriter',
};
/** El formato con que nace: un video, reel (el que más redes publican); una imagen o un texto, post. Se cambia en el evento. */
export const FORMATO_DE_ORIGEN: Readonly<Record<OrigenCrear, FormatoPublicacion>> = { video: 'reel', imagen: 'post', texto: 'post' };
/** La hora con que nace (mañana): es una sugerencia, la persona la elige en el Calendario. */
export const HORA_SUGERIDA = '10:00';

export type PublicacionDesdeCrear = {
  entrada: EntradaEvento;
  /** El texto de la publicación (el pie del post); vacío si no entra en una publicación (quedó en las notas). */
  texto: string;
};

/**
 * El evento que se arma con lo que viene de un editor. `mime`: el del archivo (null para el texto). El texto que pasa el tope de una
 * publicación (2.200) NO se corta en silencio: va entero a las notas del evento, con el aviso arriba, para que la persona lo recorte.
 */
export function publicacionDesdeCrear(p: {
  origen: unknown; titulo?: string | null; texto?: string | null; mime?: string | null; hoy: string;
}): { ok: true; publicacion: PublicacionDesdeCrear } | { ok: false; error: string } {
  if (!esOrigenCrear(p.origen)) return { ok: false, error: 'No sé de dónde viene esto.' };
  const origen = p.origen;
  if (origen !== 'texto') {
    const tipo = tipoDeArchivo(p.mime);
    if (origen === 'video' && tipo !== 'video') return { ok: false, error: 'Para publicar, el video va en MP4 o MOV.' };
    if (origen === 'imagen' && tipo !== 'image') return { ok: false, error: 'Para publicar, la imagen va en JPG, PNG o WEBP.' };
  }
  const limpio = String(p.texto ?? '').trim();
  if (origen === 'texto' && !limpio) return { ok: false, error: 'El texto está vacío: escribe algo antes de publicarlo.' };
  const titulo = String(p.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, TOPE_TITULO) || TITULO_DE_ORIGEN[origen];
  const cabe = limpio.length <= TOPE_TEXTO;
  // A mano: `toLocaleString('es')` no separa los miles de un número de 4 cifras («2200»).
  const aviso = `El texto pasa los ${String(TOPE_TEXTO).replace(/\B(?=(\d{3})+$)/g, '.')} caracteres de una publicación: recórtalo y pégalo en «Texto de la publicación».`;
  const notas = cabe ? '' : `${aviso}\n\n${limpio}`.slice(0, TOPE_NOTAS);
  return {
    ok: true,
    publicacion: {
      entrada: { titulo, tipo: 'publicacion', formato: FORMATO_DE_ORIGEN[origen], fecha: sumarDias(p.hoy, 1), hora: HORA_SUGERIDA, duracionMin: null, notas },
      texto: cabe ? limpio : '',
    },
  };
}

/** A dónde se vuelve: la semana del evento, con su modal abierto (`?evento=`, CalendarioApp). */
export const urlDelEventoEnCalendario = (id: string, fecha: string): string =>
  `/calendario?vista=semana&fecha=${encodeURIComponent(fecha)}&evento=${encodeURIComponent(id)}`;

/** El `?evento=` que vale: un id de evento propio (`ev` + base 36, lib/calendario.ts `nuevoId`), nada más. */
export const eventoDeLaUrl = (x: unknown): string | null => (typeof x === 'string' && /^ev[0-9a-z]{6,30}$/.test(x) ? x : null);
