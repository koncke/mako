// =============================================================================
// formulario-meta-funnel — los formularios de anuncios de Meta (lead forms) del negocio, y a qué funnel entran (server)
// =============================================================================
// «Asignar fuentes» (20/11/2026). Martín: «formularios de Meta, de anuncios». Hasta acá un lead de Meta entraba al funnel de
// su CAMPAÑA (lib/campana-funnel.ts) y el formulario no decidía nada: ni se guardaba cuál era (`form_id` llegaba en el
// webhook y se tiraba). Ahora un formulario asignado gana a la campaña, igual que en las páginas el formulario gana a la
// campaña y a la URL (app/api/track/optin/route.ts): es lo más preciso que hay.
//
// La asignación vive en `app_settings` (`meta.formularios`, lib/fuentes-formularios.ts). Los formularios se leen de Meta
// en el momento (`/{page}/leadgen_forms`), con la MISMA credencial que el poll (`credencialesDeLeads`).
// =============================================================================

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { productosAsignables } from './landing-funnel';
import { credencialesDeLeads, META_GRAPH_VERSION } from './meta-leads';
import {
  CLAVE_FORMULARIOS_META, parsearAsignacionesMeta, serializarAsignacionesMeta, esIdFormMeta, type AsignacionesMeta,
} from './fuentes-formularios';

export async function leerAsignacionesMeta(): Promise<AsignacionesMeta> {
  return parsearAsignacionesMeta(await getSetting(CLAVE_FORMULARIOS_META).catch(() => null));
}
export async function leerAsignacionesMetaEstricto(): Promise<AsignacionesMeta> {
  return parsearAsignacionesMeta(await getSettingEstricto(CLAVE_FORMULARIOS_META));
}
export async function guardarAsignacionesMeta(a: AsignacionesMeta): Promise<void> {
  await setSetting(CLAVE_FORMULARIOS_META, serializarAsignacionesMeta(a));
}

/**
 * A qué funnels entra un lead de este formulario, con la MISMA forma que `funnelDeCampana` (así `upsertLeadFromMeta` usa
 * una u otra sin cambiar nada más): la casa con el del negocio como `null`, y los otros con su id real. Tolerante: sin
 * poder leer, `asignada: false` y decide la campaña como siempre.
 */
export async function funnelDeFormularioMeta(formId: string | null | undefined): Promise<
  { asignada: false } | { asignada: true; funnelId: number | null; otros: number[]; nombre: string; producto: string }
> {
  if (!esIdFormMeta(formId)) return { asignada: false };
  try {
    const a = (await leerAsignacionesMeta())[formId.trim()];
    if (!a?.funnels.length) return { asignada: false };
    const vivos = await productosAsignables();
    const elegidos = a.funnels.map((id) => vivos.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f);
    if (!elegidos.length) return { asignada: false };
    const [casa, ...resto] = elegidos;
    return {
      asignada: true,
      funnelId: casa.esDefault ? null : casa.id,
      otros: resto.map((f) => f.id).filter((id) => id !== casa.id),
      nombre: a.nombre || 'un formulario de Meta',
      producto: casa.nombre,
    };
  } catch (e) {
    console.error('[formulario-meta] no se pudo leer la asignación:', e instanceof Error ? e.message : e);
    return { asignada: false };
  }
}

// ── Lo que dice Meta ───────────────────────────────────────────────────────────

const GRAPH = 'https://graph.facebook.com';
const TOPE_MS = 12_000;

async function graph<T>(url: string): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TOPE_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    const body = (await res.json()) as T & { error?: { message?: string } };
    if (body?.error) throw new Error(body.error.message ?? 'Meta no contestó');
    return body;
  } finally {
    clearTimeout(t);
  }
}

export type FormularioMeta = { id: string; nombre: string; estado: string | null; leads: number | null; creado: string | null; ultimo: string | null };

/**
 * Los formularios de la página de Facebook del negocio, sin los archivados ni borrados, con cuántos leads tiene cada uno y
 * cuándo llegó el último (una consulta más por formulario con leads, en paralelo y con tope). `pagina` = su nombre.
 */
export async function formulariosDeMeta(): Promise<{ ok: true; pagina: string | null; formularios: FormularioMeta[] } | { ok: false; error: 'sin-meta' | string }> {
  const cred = await credencialesDeLeads();
  if (!cred.ok) return { ok: false, error: 'sin-meta' };
  const { token, pageId } = cred;
  const base = `${GRAPH}/${META_GRAPH_VERSION}`;
  try {
    const [pag, lista] = await Promise.all([
      graph<{ name?: string }>(`${base}/${pageId}?fields=name&access_token=${token}`).catch(() => ({ name: undefined })),
      graph<{ data?: Array<{ id?: string; name?: string; status?: string; leads_count?: number; created_time?: string }> }>(
        `${base}/${pageId}/leadgen_forms?fields=id,name,status,leads_count,created_time&limit=100&access_token=${token}`),
    ]);
    const formularios: FormularioMeta[] = (lista.data ?? [])
      .filter((f) => f.id && f.status !== 'ARCHIVED' && f.status !== 'DELETED')
      .map((f) => ({ id: String(f.id), nombre: f.name?.trim() || `Formulario ${f.id}`, estado: f.status ?? null, leads: typeof f.leads_count === 'number' ? f.leads_count : null, creado: f.created_time ?? null, ultimo: null }));
    // El último lead de cada uno: los 15 con más leads, en paralelo. Uno que no contesta queda sin fecha, no tumba la lista.
    const conLeads = [...formularios].filter((f) => (f.leads ?? 0) > 0).sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0)).slice(0, 15);
    await Promise.all(conLeads.map(async (f) => {
      try {
        const r = await graph<{ data?: Array<{ created_time?: string }> }>(`${base}/${f.id}/leads?fields=created_time&limit=1&access_token=${token}`);
        f.ultimo = r.data?.[0]?.created_time ?? null;
      } catch { /* sin fecha */ }
    }));
    return { ok: true, pagina: pag.name ?? null, formularios };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'Meta no contestó' };
  }
}

/** Los `meta_lead_id` de un formulario, del más nuevo al más viejo (hasta `tope`): con ellos se encuentran sus leads en el CRM. */
export async function leadIdsDeFormularioMeta(formId: string, tope = 1000): Promise<string[]> {
  if (!esIdFormMeta(formId)) return [];
  const cred = await credencialesDeLeads();
  if (!cred.ok) return [];
  const out: string[] = [];
  let url: string | null = `${GRAPH}/${META_GRAPH_VERSION}/${formId}/leads?fields=id&limit=100&access_token=${cred.token}`;
  let paginas = 0;
  while (url && out.length < tope && paginas++ < 20) {
    const r = await graph<{ data?: Array<{ id?: string }>; paging?: { next?: string } }>(url);
    for (const l of r.data ?? []) if (l.id) out.push(String(l.id));
    url = r.paging?.next ?? null;
  }
  return out.slice(0, tope);
}

/** Las preguntas de un formulario como las define Meta (para uno sin leads todavía): la `key` es la que llega en `field_data`. */
export async function preguntasDeFormularioMeta(formId: string): Promise<Array<{ pregunta: string; rotulo: string; opciones: string[] }>> {
  if (!esIdFormMeta(formId)) return [];
  const cred = await credencialesDeLeads();
  if (!cred.ok) return [];
  try {
    const r = await graph<{ questions?: Array<{ key?: string; label?: string; type?: string; options?: Array<{ key?: string; value?: string }> }> }>(
      `${GRAPH}/${META_GRAPH_VERSION}/${formId}?fields=questions&access_token=${cred.token}`);
    return (r.questions ?? [])
      .filter((q) => q.key && q.type === 'CUSTOM')
      .map((q) => ({ pregunta: String(q.key), rotulo: q.label?.trim() || String(q.key), opciones: (q.options ?? []).map((o) => String(o.value ?? o.key ?? '')).filter(Boolean) }));
  } catch {
    return [];
  }
}
