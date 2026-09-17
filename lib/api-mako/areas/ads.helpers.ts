// =============================================================================
// api-mako/areas/ads.helpers — lecturas y utilidades del área `ads` que no tienen
// un export en lib/ (la deuda de cada una está en su comentario y en la cabecera de
// ads.def.ts, sección OMITIDAS)
// =============================================================================
// Todo corre ADENTRO de runWithWorkspace(ctx.ws) (lo pone el choke point): las
// lecturas van por getTenantDb, que scopea sola. Nada acá escribe.
//
// ⚠️ Por qué el vocabulario de ángulos/avatares NO se lee con getAngles/getAvatares
// antes de ESCRIBIR: getSetting convierte «no pude leer» en null y getAngles lo
// completa con los 5 ángulos default. Agregar un ángulo sobre esa lectura PISA la
// lista propia del cliente con los default + el nuevo, sin ningún error. Para
// escribir se lee con getSettingEstricto, que tira.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { getSettingEstricto } from '@/lib/settings';
import { DEFAULT_ANGLES, type Angle } from '@/lib/script-angles';
import { getMetaHealth, type NodoEstado, type MetaHealth } from '@/lib/meta-health';
import { integracionConectada, envCred } from '@/lib/credenciales';

export const soloDigitos = (s: string): boolean => /^\d{1,30}$/.test(s);
export const esFecha = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** El error de «Meta no está conectada», igual en todas las lecturas en vivo. */
export const SIN_META = 'Meta Ads no está conectada en este negocio (Integraciones → Meta Ads). No hay datos en vivo que leer: dilo así, no inventes un estado ni un cero.';

export async function metaConectada(): Promise<boolean> {
  try { return await integracionConectada('meta'); } catch { return false; }
}

/** El árbol vivo de Meta, o el motivo por el que no se pudo leer (≠ vacío). */
export async function arbolMeta(): Promise<{ h: MetaHealth } | { error: string }> {
  if (!(await metaConectada())) return { error: SIN_META };
  try {
    return { h: await getMetaHealth() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `No pude leer la cuenta de Meta (${msg}). Eso NO significa que no haya campañas: es la lectura la que falló.` };
  }
}

/** Busca una entidad en el árbol vivo por nivel e id. */
export function nodoDe(h: MetaHealth, nivel: 'campaign' | 'adset' | 'ad', id: string): NodoEstado | null {
  const lista = nivel === 'campaign' ? h.campaigns : nivel === 'adset' ? h.adsets : h.ads;
  return lista.find((n) => n.id === id) ?? null;
}

// ── meta_campaign_drafts: nadie la leía (mig 0157) ───────────────────────────

export type PublicacionMako = {
  id: number; nombre: string; objetivo: string; status: string; error: string | null;
  meta_campaign_id: string | null; meta_adset_ids: unknown; meta_ad_ids: unknown;
  creada: string; actualizada: string;
};

export async function publicacionesMako(status: string | null, limite: number): Promise<PublicacionMako[]> {
  const db = await getTenantDb();
  let q = db.from('meta_campaign_drafts')
    .select('id, name, objective, status, error, meta_campaign_id, meta_adset_ids, meta_ad_ids, created_at, updated_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limite);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(`api-mako: no pude leer meta_campaign_drafts: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id), nombre: String(r.name ?? ''), objetivo: String(r.objective ?? ''), status: String(r.status ?? ''),
    error: (r.error as string | null) ?? null, meta_campaign_id: (r.meta_campaign_id as string | null) ?? null,
    meta_adset_ids: r.meta_adset_ids ?? [], meta_ad_ids: r.meta_ad_ids ?? [],
    creada: String(r.created_at ?? ''), actualizada: String(r.updated_at ?? ''),
  }));
}

// ── ad_transcripts: lib/ads-analyst.ts la lee en funciones privadas ─────────

export type TranscriptAnuncio = {
  ad_id: string; video_id: string | null; tipo: string | null; status: string | null; transcript: string | null;
  secciones: unknown; idioma: string | null; duracion_s: number | null; error: string | null; actualizado: string | null;
};

export async function transcriptDeAnuncio(adId: string): Promise<TranscriptAnuncio | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ad_transcripts')
    .select('ad_id, video_id, tipo, status, transcript, secciones, idioma, duracion_s, error, updated_at')
    .eq('ad_id', adId)
    .maybeSingle();
  if (error) throw new Error(`api-mako: no pude leer ad_transcripts: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    ad_id: String(r.ad_id), video_id: (r.video_id as string | null) ?? null, tipo: (r.tipo as string | null) ?? null,
    status: (r.status as string | null) ?? null, transcript: (r.transcript as string | null) ?? null, secciones: r.secciones ?? null,
    idioma: (r.idioma as string | null) ?? null, duracion_s: r.duracion_s == null ? null : Number(r.duracion_s),
    error: (r.error as string | null) ?? null, actualizado: (r.updated_at as string | null) ?? null,
  };
}

/** ¿El anuncio tiene fila en script_analyses? (getScriptView devuelve null también
 *  para «analizado pero sin señal», así que no sirve para validar un override). */
export async function tieneAnalisis(adId: string): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('script_analyses').select('ad_id').eq('ad_id', adId).maybeSingle();
  if (error) throw new Error(`api-mako: no pude leer script_analyses: ${error.message}`);
  return !!data;
}

// ── vocabulario (ángulos / avatares) leído ESTRICTO para escribir encima ─────

type Item = { key: string; label: string; color: string; desc?: string };

/** La lista CRUDA vigente, o un error si no se pudo leer. Nunca un default por error. */
export async function vocabularioParaEscribir(cual: 'angulos' | 'avatares'): Promise<{ lista: Item[] } | { error: string }> {
  const clave = cual === 'angulos' ? 'script_angles' : 'script_avatares';
  let raw: string | null;
  try { raw = await getSettingEstricto(clave); } catch (err) {
    return { error: `No pude leer la lista actual de ${cual} (${err instanceof Error ? err.message : 'error'}); no la toco para no pisarla.` };
  }
  const defaults = (): Item[] => (cual === 'angulos' ? DEFAULT_ANGLES.map((a: Angle) => ({ ...a })) : []);
  if (!raw) return { lista: defaults() };
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return { error: `La lista guardada de ${cual} no tiene la forma esperada; revísala en Ads Analyst antes de editarla por aquí.` };
    // Mismo criterio que getAngles (lib/script-angles.ts): una fila que al sanearla
    // queda sin ítems con nombre ('[]', ítems sin label) se MUESTRA como los 5 de
    // fábrica. Escribir sobre la lista vacía reemplazaría esos 5 visibles por uno.
    const conNombre = (p as Item[]).filter((x) => x && typeof x === 'object' && String(x.label ?? '').trim());
    if (!conNombre.length) return { lista: defaults() };
    return { lista: conNombre };
  } catch {
    return { error: `La lista guardada de ${cual} no es JSON válido; revísala en Ads Analyst antes de editarla por aquí.` };
  }
}

// ── estado EN VIVO de una entidad de Meta, sin caché ─────────────────────────

/**
 * Lee `configured_status` y `effective_status` de una campaña, conjunto o anuncio
 * directo de la Graph API, con `cache: 'no-store'`. Existe porque la guarda que
 * decide un BORRADO no puede salir de getMetaHealth, que es cachedRead con
 * revalidate 120 y que metaWrite no invalida al cambiar un estado: una entidad
 * activada hace un minuto sigue figurando PAUSED. Mismas credenciales que metaWrite
 * (envCred → cuenta del ws 1), así que solo se llama detrás del chequeo de OWNER_WS.
 * Deuda: lib/meta-write.ts no exporta una lectura así.
 */
export async function estadoVivoMeta(id: string): Promise<{ configurado: string | null; efectivo: string | null } | { error: string }> {
  const ver = process.env.META_API_VERSION;
  const token = await envCred('META_ACCESS_TOKEN');
  if (!ver || !token) return { error: 'Meta no está configurado: no pude leer el estado actual.' };
  if (!soloDigitos(id)) return { error: 'id inválido.' };
  try {
    const res = await fetch(`https://graph.facebook.com/${ver}/${id}?fields=configured_status,effective_status&access_token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string }; configured_status?: string; effective_status?: string };
    // Meta manda el fallo ADENTRO de un 200: se mira body.error, no res.ok.
    if (data.error) return { error: `Meta no dejó leer el estado actual (${data.error.message ?? 'error'}).` };
    const configurado = data.configured_status ?? null;
    const efectivo = data.effective_status ?? null;
    if (!configurado && !efectivo) return { error: 'Meta no devolvió el estado actual.' };
    return { configurado, efectivo };
  } catch (err) {
    return { error: `Meta no contestó (${err instanceof Error ? err.message : 'error'}).` };
  }
}
