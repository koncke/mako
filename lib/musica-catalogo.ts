// =============================================================================
// La música de fondo de un anuncio
// =============================================================================
// SIN `server-only`: lo lee el editor para pintar las opciones y lo lee el server
// para validar lo que le mandan.
//
// ⚠️ HOY ESTÁ VACÍO, Y NO ES UN OLVIDO. La licencia es lo que falta, no el
// código: una pista de fondo en un anuncio que se publica en Meta necesita
// derechos comerciales, y la fuente elegida es **Epidemic Sound Connect**, que
// está pendiente de alta. Poner acá un mp3 cualquiera sería regalarle al cliente
// un reclamo de copyright sobre su propia campaña.
//
// ── Cómo se llena, cuando Epidemic esté ────────────────────────────────────
// Una fila por pista, con su archivo subido al bucket `video-clips` (público, el
// mismo del que el worker baja las tomas). No hace falta tocar nada más: el
// worker ya baja `musica` y el montaje ya la mezcla con `loudnorm`.
//
//   { id: 'empuje', nombre: 'Empuje', url: 'https://…/musica/empuje.mp3' }
//
// El `id` es lo que viaja y lo que queda guardado; la `url` puede cambiar sin
// romper los anuncios ya montados.

export type Pista = {
  /** Lo que viaja y lo que queda guardado. Estable. */
  id: string;
  /** Cómo se llama en la pantalla. Una palabra: es lo único que se lee. */
  nombre: string;
  /** El mp3, en un bucket público. El worker le pega un GET pelado. */
  url: string;
};

export const PISTAS: Pista[] = [];

/** La pista con este id, o `null`. */
export function pistaPorId(id: string | null | undefined): Pista | null {
  if (!id) return null;
  return PISTAS.find((p) => p.id === id) ?? null;
}

/**
 * ¿Hay música para elegir?
 *
 * ⚠️ LA PANTALLA PREGUNTA ESTO, no dibuja el control «por las dudas». Un selector
 * con una sola opción que dice «Sin música» es un control muerto: ocupa el mismo
 * lugar que el que funciona y enseña que tocarlo no hace nada.
 */
export function hayMusica(): boolean {
  return PISTAS.length > 0;
}
