// =============================================================================
// ig-contenido — el puente entre los writers y el programador de Instagram
// =============================================================================
// Los botones «Enviar a publicación» de las tabs Reels/Carousels/Stories llaman
// a `crearBorradorPublicacion()`: inserta la fila en `contenido_posts` (mig
// 0136) en estado 'borrador' —sin tocar Zernio, igual que el camino borrador de
// crearPublicacionAction en app/instagram/actions.ts— y devuelve el id + el
// href a /instagram, donde el usuario completa la media y programa.
//
// Vive en lib/ y no en app/instagram/ porque lo consumen TRES tabs («una cosa,
// un lugar») y porque app/instagram/ está tomado por otra sesión.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { type FormatoIg, CAPTION_MAX } from './ig-formatos';

export type BorradorPublicacionInput = {
  /** Valor EXACTO del check de contenido_posts.tipo. */
  tipo: FormatoIg;
  caption: string;
  /**
   * Notas de producción del writer (guion, indicaciones de escena). La tabla NO
   * tiene columna para esto (mig 0136), así que van ANEXADAS a la caption con un
   * rótulo visible que pide borrarlas antes de publicar — en la pantalla donde
   * el usuario ya va a editar. La alternativa (aceptarlas y tirarlas) sería una
   * pérdida de datos silenciosa.
   */
  notas?: string;
};

export type BorradorPublicacionOut =
  | { ok: true; id: number; href: string }
  | { ok: false; error: string };

const SEPARADOR_NOTAS = '\n\n———\nNOTAS DE PRODUCCIÓN (borra este bloque antes de publicar):\n';

/**
 * Crea el borrador en contenido_posts (estado 'borrador', media vacía) y
 * devuelve a dónde seguir. No toca Zernio: las URLs firmadas vencerían antes de
 * un futuro indefinido (mismo criterio que crearPublicacionAction).
 *
 * `ws` se verifica en POSITIVO contra el workspace del request: getTenantDb
 * estampa el del contexto, así que un `ws` distinto escribiría el borrador en
 * OTRO cliente en silencio. Sin workspace (agencia sin impersonar) se corta con
 * error — nunca se cae al dueño.
 */
export async function crearBorradorPublicacion(ws: number, input: BorradorPublicacionInput): Promise<BorradorPublicacionOut> {
  const wsActual = await getWorkspaceActual();
  if (wsActual == null) return { ok: false, error: 'No hay un workspace activo: entra al cliente antes de guardar.' };
  if (ws !== wsActual) return { ok: false, error: 'El workspace pedido no es el de esta sesión.' };

  const caption = (input.caption ?? '').trim().slice(0, CAPTION_MAX);
  const notas = (input.notas ?? '').trim();
  // El bloque de notas puede empujar el total por encima de CAPTION_MAX: está
  // bien — el tope de 2.200 lo impone Instagram AL PUBLICAR, y este texto se
  // edita (y el bloque se borra) en /instagram antes de eso.
  const texto = [caption, notas ? `${SEPARADOR_NOTAS}${notas}` : ''].join('') || null;

  const db = await getTenantDb();
  const { data, error } = await db
    .from('contenido_posts')
    .insert({ tipo: input.tipo, caption: texto, media: [], estado: 'borrador' })
    .select('id')
    .single();
  if (error) return { ok: false, error: `No se pudo guardar el borrador: ${error.message}` };

  return { ok: true, id: (data as { id: number }).id, href: '/instagram' };
}
