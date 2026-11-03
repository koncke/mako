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
import { cfg, cfgDeCuenta, cfgDeHuella, clavesZernio, huellaClave, zFetch, ZernioError } from './zernio';
import type { CuerpoPost, PostZernio } from './calendario-publicar-reglas';

/** La huella de una clave (nunca la clave): con ella se sabe si el post se programó con la clave de HOY (la verificación del 28/10). */
const huellaDe = huellaClave;

/** La huella de la clave con la que el negocio habla HOY con Zernio (la 1). */
export async function huellaClaveActual(ws: number): Promise<string> {
  return huellaDe((await cfg(ws)).apiKey);
}

/** Las huellas de TODAS las claves del negocio (varias claves, 29/10/2026): un post sigue siendo «de hoy» si su clave sigue. */
export async function huellasDelNegocio(ws: number): Promise<Set<string>> {
  return new Set((await clavesZernio(ws)).map((k) => k.huella));
}

/**
 * Programa un post. Devuelve su id en Zernio y la huella de la clave con la que se programó. `yaEstaba`: Zernio contestó 409 (el
 * mismo contenido en 24 h) y el id es el del post que YA tenía: quien llama mira que no sea el de otra publicación.
 */
export async function crearPostZernio(ws: number, cuerpo: CuerpoPost, requestId: string): Promise<{ id: string; clave: string; yaEstaba?: true }> {
  // Con la clave DUEÑA de la cuenta donde se publica (varias claves, 29/10/2026); con una sola, la de siempre.
  const c = await cfgDeCuenta(ws, cuerpo.platforms[0]?.accountId);
  const clave = huellaDe(c.apiKey);
  try {
    const r = await zFetch<{ post?: { _id?: string } }>(c.apiKey, '/posts', {
      method: 'POST', headers: { 'x-request-id': requestId }, body: JSON.stringify(cuerpo),
    });
    const id = r.post?._id;
    if (!id) throw new ZernioError('Zernio no devolvió el post programado.', 502, null);
    return { id, clave };
  } catch (e) {
    // El mismo contenido en 24 h: Zernio devuelve el que ya estaba. Es ESE post (no se programa otro).
    const existente = e instanceof ZernioError && e.status === 409 ? idExistente(e) : null;
    if (existente) return { id: existente, clave, yaEstaba: true };
    throw e;
  }
}

function idExistente(e: ZernioError): string | null {
  const det = e.body?.details;
  const d = det && typeof det === 'object' ? (det as { existingPostId?: unknown }).existingPostId : null;
  return typeof d === 'string' && d.trim() ? d.trim() : null;
}

/** El post como está ahora en Zernio. */
export async function leerPostZernio(ws: number, postId: string, huella?: string | null): Promise<PostZernio> {
  // Con la clave que lo creó (su huella), si sigue siendo del negocio; si no, la 1.
  const c = (await cfgDeHuella(ws, huella)) ?? await cfg(ws);
  const r = await zFetch<{ post?: PostZernio }>(c.apiKey, `/posts/${encodeURIComponent(postId)}`);
  return r.post ?? {};
}

/** Cancela un post programado. ⚠️ Uno ya publicado no se borra así (Zernio da 400): eso es «despublicar», otra cosa. */
export async function borrarPostZernio(ws: number, postId: string, huella?: string | null): Promise<void> {
  const c = (await cfgDeHuella(ws, huella)) ?? await cfg(ws);
  await zFetch<unknown>(c.apiKey, `/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
}
