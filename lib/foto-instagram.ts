// =============================================================================
// La foto de Instagram de un lead, copiada a NUESTRO bucket (24/10/2026)
// =============================================================================
// La tarjeta del tablero y la ficha muestran `foto_auto_url` (lib/contacto-lead.ts, `candidatasDeFoto`). Hasta hoy sólo la
// llenaba la copia de la foto de WhatsApp (lib/fotos-contacto.ts); un lead que entra con su Instagram elegido en el buscador
// del alta se quedaba con iniciales, aunque el buscador mostraba su foto. Esto la copia al crearlo, con las mismas reglas que
// la de WhatsApp: ruta al azar (lib/fotos-contacto-ruta.ts), tope de 2 MB, sólo imágenes.
// ⚠️ NO PISA NADA: sólo escribe si `foto_auto_url` está vacía (la de WhatsApp, si llegó, queda), y lo elegido por una persona
//    (`avatar_url`) vive en otra columna. Y nunca tira: sin foto, el lead sigue con sus iniciales.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { rutaNuevaDeFoto } from './fotos-contacto-ruta';
import { esFotoDeInstagram } from './foto-instagram-reglas';

const BUCKET = 'avatars';
/** Una foto de perfil pesa decenas de KB; 2 MB es un tope de cordura (el mismo de la de WhatsApp). */
const TOPE_BYTES = 2 * 1024 * 1024;

/** Copia la foto de perfil de Instagram del lead a nuestro bucket. true = quedó guardada. */
export async function guardarFotoDeInstagram(leadId: number, url: string): Promise<boolean> {
  if (!esFotoDeInstagram(url)) return false;
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return false;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    // Después de una redirección, el host final también tiene que ser de Meta.
    if (!r.ok || (r.url && !esFotoDeInstagram(r.url))) return false;
    const tipo = r.headers.get('content-type') ?? '';
    if (!tipo.startsWith('image/')) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > TOPE_BYTES) return false;
    const storage = getSupabaseServer().storage.from(BUCKET);
    const path = rutaNuevaDeFoto(ws, leadId);
    const up = await storage.upload(path, buf, { contentType: tipo, upsert: false });
    if (up.error) return false;
    const ahora = Date.now();
    const publica = `${storage.getPublicUrl(path).data.publicUrl}?v=${ahora}`;
    // Sólo si no tiene una foto automática: la de WhatsApp, si ya llegó, gana.
    const { data, error } = await (await getTenantDb()).from('leads')
      .update({ foto_auto_url: publica, foto_auto_at: new Date(ahora).toISOString() })
      .eq('id', leadId).is('foto_auto_url', null).select('id');
    if (error || !data?.length) { await storage.remove([path]).catch(() => undefined); return false; }
    return true;
  } catch (e) {
    console.error('[foto-instagram] no pude copiar la foto:', e instanceof Error ? e.message : String(e));
    return false;
  }
}
