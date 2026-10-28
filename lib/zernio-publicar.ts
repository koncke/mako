// =============================================================================
// zernio-publicar — los posts de Zernio: programar, leer y cancelar (28/10/2026, el Calendario publica)
// =============================================================================
// El molde es el de la tab Instagram retirada (`8d16c6ff^:lib/zernio.ts`, `createPost`/`getPost`/`deletePost`), con la clave
// del canal (`cfg`, lib/zernio.ts: la del negocio, estricta). Lo usa SÓLO lib/calendario-publicar.ts. Está en la lista
// `CANAL` de tests/sin-instagram.test.ts: es el único otro lugar que habla con Zernio fuera del canal de Automations.
//
// ⚠️ La IDEMPOTENCIA es `x-request-id` (Zernio devuelve el post original si el mismo id se repite en ~5 minutos), y un 409
//    es su dedup por contenido (24 h) con `details.existingPostId`: no es un error, es el post que ya estaba.
// =============================================================================

import 'server-only';
import { cfg, zFetch, ZernioError } from './zernio';
import type { CuerpoPost, PostZernio } from './calendario-publicar-reglas';

/** Programa un post. Devuelve su id en Zernio. */
export async function crearPostZernio(ws: number, cuerpo: CuerpoPost, requestId: string): Promise<string> {
  const c = await cfg(ws);
  try {
    const r = await zFetch<{ post?: { _id?: string } }>(c.apiKey, '/posts', {
      method: 'POST', headers: { 'x-request-id': requestId }, body: JSON.stringify(cuerpo),
    });
    const id = r.post?._id;
    if (!id) throw new ZernioError('Zernio no devolvió el post programado.', 502, null);
    return id;
  } catch (e) {
    // El mismo contenido en 24 h: Zernio devuelve el que ya estaba. Es ESE post (no se programa otro).
    const existente = e instanceof ZernioError && e.status === 409 ? idExistente(e) : null;
    if (existente) return existente;
    throw e;
  }
}

function idExistente(e: ZernioError): string | null {
  const det = e.body?.details;
  const d = det && typeof det === 'object' ? (det as { existingPostId?: unknown }).existingPostId : null;
  return typeof d === 'string' && d.trim() ? d.trim() : null;
}

/** El post como está ahora en Zernio. */
export async function leerPostZernio(ws: number, postId: string): Promise<PostZernio> {
  const c = await cfg(ws);
  const r = await zFetch<{ post?: PostZernio }>(c.apiKey, `/posts/${encodeURIComponent(postId)}`);
  return r.post ?? {};
}

/** Cancela un post programado. ⚠️ Uno ya publicado no se borra así (Zernio da 400): eso es «despublicar», otra cosa. */
export async function borrarPostZernio(ws: number, postId: string): Promise<void> {
  const c = await cfg(ws);
  await zFetch<unknown>(c.apiKey, `/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
}
