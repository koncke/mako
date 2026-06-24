// =============================================================================
// Plantillas de WhatsApp — borradores (Supabase) + Graph API de Meta
// =============================================================================
// Las plantillas APROBADAS viven en Meta (source of truth del status). Acá:
//  - CRUD de BORRADORES en whatsapp_template_drafts (se redactan/validan en la app).
//  - Lectura de plantillas reales de Meta (con su status: PENDING/APPROVED/REJECTED).
//  - Envío de una plantilla a aprobar (POST a la Graph API).
// Las credenciales (WABA id + token con whatsapp_business_management) salen del
// provider_config del inbox de Chatwoot (ver lib/chatwoot.getWabaConfig).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { getWabaConfig } from '@/lib/chatwoot';

export type TemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string };

export type TemplateParam = { name: string; example: string };

export type TemplateCategoria = 'marketing' | 'utility' | 'authentication';
export type TemplateStatus = 'borrador' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
export type HeaderMediaFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type HeaderMedia = { format: HeaderMediaFormat; handle: string; filename: string };

export type TemplateDraft = {
  id?: number;
  name: string;
  language: string;
  category: TemplateCategoria;
  body: string;
  header?: string | null;              // encabezado de TEXTO (si no hay headerMedia)
  headerMedia?: HeaderMedia | null;    // encabezado MULTIMEDIA (imagen/video/documento)
  footer?: string | null;
  buttons: TemplateButton[];
  params: TemplateParam[];
  status: TemplateStatus;
  meta_template_id?: string | null;
  rejection_reason?: string | null;
  validacion?: unknown;
  etapa?: string | null;
  updated_at?: string;
};

type DraftRow = {
  id: number; name: string; language: string; category: TemplateCategoria; body: string;
  header: string | null; header_media: unknown; footer: string | null; buttons: unknown; params: unknown;
  status: TemplateStatus; meta_template_id: string | null; rejection_reason: string | null;
  validacion: unknown; etapa: string | null; updated_at: string;
};

function rowToDraft(r: DraftRow): TemplateDraft {
  return {
    id: r.id,
    name: r.name,
    language: r.language,
    category: r.category,
    body: r.body,
    header: r.header,
    headerMedia: r.header_media && typeof r.header_media === 'object' ? (r.header_media as HeaderMedia) : null,
    footer: r.footer,
    buttons: Array.isArray(r.buttons) ? (r.buttons as TemplateButton[]) : [],
    params: Array.isArray(r.params) ? (r.params as TemplateParam[]) : [],
    status: r.status,
    meta_template_id: r.meta_template_id,
    rejection_reason: r.rejection_reason,
    validacion: r.validacion,
    etapa: r.etapa,
    updated_at: r.updated_at,
  };
}

// ── CRUD de borradores ───────────────────────────────────────────────────────
export async function listDrafts(opts: { status?: string; etapa?: string } = {}): Promise<TemplateDraft[]> {
  const supabase = getSupabaseServer();
  let q = supabase.from('whatsapp_template_drafts').select('*').order('updated_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.etapa) q = q.eq('etapa', opts.etapa);
  const { data, error } = await q;
  if (error) throw new Error(`listDrafts: ${error.message}`);
  return ((data ?? []) as DraftRow[]).map(rowToDraft);
}

export async function getDraft(id: number): Promise<TemplateDraft | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('whatsapp_template_drafts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getDraft: ${error.message}`);
  return data ? rowToDraft(data as DraftRow) : null;
}

// Crea o actualiza un borrador. No toca el status si ya existe (eso lo manejan
// submit / setDraftStatus) salvo que se pida explícito.
export async function upsertDraft(d: TemplateDraft): Promise<TemplateDraft> {
  const supabase = getSupabaseServer();
  const base = {
    name: d.name.trim(),
    language: d.language || 'es_MX',
    category: d.category,
    body: d.body ?? '',
    header: d.header?.trim() || null,
    header_media: d.headerMedia ?? null,
    footer: d.footer?.trim() || null,
    buttons: d.buttons ?? [],
    params: d.params ?? [],
    etapa: d.etapa ?? null,
    validacion: d.validacion ?? null,
    updated_at: new Date().toISOString(),
  };
  if (d.id) {
    const { data, error } = await supabase
      .from('whatsapp_template_drafts').update(base).eq('id', d.id).select('*').single();
    if (error) throw new Error(`upsertDraft update: ${error.message}`);
    return rowToDraft(data as DraftRow);
  }
  const { data, error } = await supabase
    .from('whatsapp_template_drafts').insert({ ...base, status: 'borrador' }).select('*').single();
  if (error) throw new Error(`upsertDraft insert: ${error.message}`);
  return rowToDraft(data as DraftRow);
}

export async function deleteDraft(id: number): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('whatsapp_template_drafts').delete().eq('id', id);
  if (error) throw new Error(`deleteDraft: ${error.message}`);
}

export async function setDraftStatus(
  id: number,
  status: TemplateStatus,
  extra: { meta_template_id?: string | null; rejection_reason?: string | null } = {},
): Promise<void> {
  const supabase = getSupabaseServer();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if ('meta_template_id' in extra) patch.meta_template_id = extra.meta_template_id ?? null;
  if ('rejection_reason' in extra) patch.rejection_reason = extra.rejection_reason ?? null;
  const { error } = await supabase.from('whatsapp_template_drafts').update(patch).eq('id', id);
  if (error) throw new Error(`setDraftStatus: ${error.message}`);
}

// ── Graph API: payload + envío + lectura ─────────────────────────────────────
type GraphComponent = Record<string, unknown>;

function buildComponents(d: TemplateDraft): GraphComponent[] {
  const comps: GraphComponent[] = [];
  // Encabezado: multimedia (con su handle de muestra) tiene prioridad sobre texto.
  if (d.headerMedia?.handle) {
    comps.push({ type: 'HEADER', format: d.headerMedia.format, example: { header_handle: [d.headerMedia.handle] } });
  } else if (d.header && d.header.trim()) {
    comps.push({ type: 'HEADER', format: 'TEXT', text: d.header.trim() });
  }

  const body: GraphComponent = { type: 'BODY', text: d.body };
  // Meta cuenta CADA aparición de {{var}} como una posición → el example necesita
  // un item por aparición (en orden), no por variable única. (Verificado contra la API.)
  const exMap = new Map(d.params.map((p) => [p.name, p.example]));
  const ocurrencias: Array<{ param_name: string; example: string }> = [];
  const reBody = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let mm: RegExpExecArray | null;
  while ((mm = reBody.exec(d.body)) !== null) ocurrencias.push({ param_name: mm[1], example: exMap.get(mm[1]) ?? '' });
  if (ocurrencias.length) body.example = { body_text_named_params: ocurrencias };
  comps.push(body);

  if (d.footer && d.footer.trim()) comps.push({ type: 'FOOTER', text: d.footer.trim() });

  if (d.buttons.length) {
    comps.push({
      type: 'BUTTONS',
      buttons: d.buttons.map((b) => {
        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
        return { type: 'QUICK_REPLY', text: b.text };
      }),
    });
  }
  return comps;
}

// Payload exacto del POST /{WABA}/message_templates (útil también para mostrarlo).
// parameter_format: 'NAMED' es OBLIGATORIO para variables {{nombre}}: sin él, Meta
// las interpreta como posicionales (tipo "Número") y rechaza con "parámetros
// incorrectos, deben ser {{1}}, {{2}}". El example va por aparición (ver buildComponents).
export function buildGraphPayload(d: TemplateDraft): Record<string, unknown> {
  return {
    name: d.name.trim(),
    language: d.language || 'es_MX',
    category: d.category.toUpperCase(),
    parameter_format: 'NAMED',
    components: buildComponents(d),
  };
}

// fetch con timeout (Meta a veces tarda; no queremos colgar la pantalla).
async function fetchConTimeout(url: string, init: RequestInit, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// Sube una MUESTRA de media (imagen/video/documento) al resumable-upload de Meta y
// devuelve el "handle" para usar en el encabezado de la plantilla. Dos pasos:
// 1) POST /{app_id}/uploads → sesión; 2) POST /{session} con los bytes → { h }.
export async function uploadMediaSample(
  bytes: ArrayBuffer, mime: string, filename: string,
): Promise<{ ok: boolean; handle?: string; error?: string }> {
  const waba = await getWabaConfig();
  if (!waba.appId) return { ok: false, error: 'No se pudo obtener el app_id de Meta (para subir la muestra).' };
  const buf = Buffer.from(bytes);
  try {
    const u1 = await fetchConTimeout(
      `https://graph.facebook.com/${waba.version}/${waba.appId}/uploads?file_name=${encodeURIComponent(filename)}&file_length=${buf.length}&file_type=${encodeURIComponent(mime)}&access_token=${encodeURIComponent(waba.token)}`,
      { method: 'POST' }, 20000,
    );
    const j1 = await u1.json().catch(() => ({}));
    if (!j1.id) return { ok: false, error: j1?.error?.message || 'No se pudo iniciar la subida.' };
    const u2 = await fetchConTimeout(
      `https://graph.facebook.com/${waba.version}/${j1.id}`,
      { method: 'POST', headers: { Authorization: `OAuth ${waba.token}`, file_offset: '0' }, body: buf }, 30000,
    );
    const j2 = await u2.json().catch(() => ({}));
    if (!j2.h) return { ok: false, error: j2?.error?.message || 'No se pudo subir el archivo.' };
    return { ok: true, handle: j2.h as string };
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'La subida tardó demasiado.' : String(e) };
  }
}

// Valida que las variables sean nombradas ({{nombre}}, no {{1}}) y con ejemplo, y
// que header/footer sean estáticos. Meta rechaza lo contrario con parameter_format NAMED.
function validarVarsParaMeta(d: TemplateDraft): string | null {
  const tieneVar = (s: string | null | undefined) => !!s && /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(s);
  if (tieneVar(d.header)) return 'El encabezado no puede tener variables; las variables van solo en el cuerpo.';
  if (tieneVar(d.footer)) return 'El pie no puede tener variables.';
  const vars: string[] = [];
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d.body)) !== null) vars.push(m[1]);
  for (const v of vars) {
    if (/^\d/.test(v)) return `Usá variables con nombre (ej. {{nombre}}), no posicionales como {{${v}}}: Meta las rechaza en este formato.`;
    if (!d.params.some((p) => p.name === v)) return `Falta el ejemplo de la variable {{${v}}}.`;
  }
  return null;
}

// Envía una plantilla a aprobar a Meta. Devuelve el status inicial (PENDING) y el id.
export async function submitTemplate(
  d: TemplateDraft,
): Promise<{ ok: boolean; status?: string; metaId?: string; error?: string }> {
  const errVars = validarVarsParaMeta(d);
  if (errVars) return { ok: false, error: errVars };

  const waba = await getWabaConfig();
  let res: Response;
  try {
    res = await fetchConTimeout(`https://graph.facebook.com/${waba.version}/${waba.wabaId}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waba.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGraphPayload(d)),
    });
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'Meta no respondió a tiempo, probá de nuevo.' : String(e) };
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) {
    const err = j?.error?.error_user_msg || j?.error?.message || `Meta ${res.status}`;
    return { ok: false, error: err };
  }
  if (!j.id) return { ok: false, error: 'Meta no devolvió el id de la plantilla (no se pudo confirmar el envío).' };
  return { ok: true, status: (j.status as string) || 'PENDING', metaId: j.id as string };
}

// Persiste el envío: guarda/actualiza el borrador y lo deja en 'pending' con su meta id.
export async function enviarBorradorAMeta(
  id: number,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const draft = await getDraft(id);
  if (!draft) return { ok: false, error: 'borrador no encontrado' };
  if (draft.status !== 'borrador' && draft.status !== 'rejected') {
    return { ok: false, error: `la plantilla ya está en estado "${draft.status}"` };
  }
  const r = await submitTemplate(draft);
  if (!r.ok) return { ok: false, error: r.error };
  await setDraftStatus(id, 'pending', { meta_template_id: r.metaId ?? null, rejection_reason: null });
  return { ok: true, status: 'pending' };
}

export type MetaTemplate = {
  name: string;
  language: string;
  category: string;       // minúsculas: marketing | utility | authentication
  status: string;         // minúsculas: pending | approved | rejected | paused | disabled
  body: string;
  header: string | null;
  headerFormat: string | null; // TEXT | IMAGE | VIDEO | DOCUMENT | null
  footer: string | null;
  buttons: TemplateButton[];
  params: string[];       // nombres de variables del body
  rejectedReason: string | null; // motivo de Meta si está rechazada (enum)
  metaId: string | null;
};

type GraphBtn = { type?: string; text?: string; url?: string; phone_number?: string };
type GraphTplComponent = {
  type?: string; format?: string; text?: string;
  buttons?: GraphBtn[];
  example?: { body_text_named_params?: Array<{ param_name?: string }> };
};
type GraphTpl = {
  id?: string; name?: string; language?: string; category?: string; status?: string;
  rejected_reason?: string;
  components?: GraphTplComponent[];
};

// La traducción del motivo de rechazo vive en template-vars (client-safe) y se
// re-exporta acá para los endpoints. Guardamos el enum crudo en la DB.
export { explicarRechazo } from '@/lib/template-vars';

// Lista las plantillas reales del WABA en Meta (con su status, componentes y motivo de rechazo).
export async function listMetaTemplates(): Promise<MetaTemplate[]> {
  const waba = await getWabaConfig();
  const url =
    `https://graph.facebook.com/${waba.version}/${waba.wabaId}/message_templates` +
    `?fields=name,status,category,language,components,id,rejected_reason&limit=200`;
  const res = await fetchConTimeout(url, { headers: { Authorization: `Bearer ${waba.token}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.message || `Meta ${res.status}`);
  // Convención: minúsculas en todo el código/DB; MAYÚSCULAS sólo en el payload de salida a Meta.
  return ((j.data ?? []) as GraphTpl[]).map((t) => {
    const comps = t.components ?? [];
    const body = comps.find((c) => c.type === 'BODY');
    const headerComp = comps.find((c) => c.type === 'HEADER');
    const headerFormat = headerComp?.format ?? null;
    const header = headerComp && (headerComp.format ?? 'TEXT') === 'TEXT' ? headerComp : undefined;
    const footer = comps.find((c) => c.type === 'FOOTER');
    const btns = comps.find((c) => c.type === 'BUTTONS');
    const params = (body?.example?.body_text_named_params ?? []).map((p) => p.param_name ?? '').filter(Boolean);
    const buttons: TemplateButton[] = (btns?.buttons ?? []).map((b) => {
      if (b.type === 'URL') return { type: 'URL', text: b.text ?? '', url: b.url ?? '' };
      if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text ?? '', phone_number: b.phone_number ?? '' };
      return { type: 'QUICK_REPLY', text: b.text ?? '' };
    });
    const rr = (t.rejected_reason ?? '').toUpperCase();
    return {
      name: t.name ?? '',
      language: t.language ?? '',
      category: (t.category ?? '').toLowerCase(),
      status: (t.status ?? '').toLowerCase(),
      body: body?.text ?? '',
      header: header?.text ?? null,
      headerFormat,
      footer: footer?.text ?? null,
      buttons,
      params,
      rejectedReason: rr && rr !== 'NONE' ? rr : null,
      metaId: t.id ?? null,
    };
  }).filter((t) => t.name);
}

// Editar una plantilla existente en Meta (POST /{id}). El nombre y el idioma NO se
// pueden cambiar; sí el contenido y la categoría. Al editar vuelve a PENDING.
export async function editTemplate(
  metaId: string,
  d: TemplateDraft,
): Promise<{ ok: boolean; error?: string }> {
  const errVars = validarVarsParaMeta(d);
  if (errVars) return { ok: false, error: errVars };
  const waba = await getWabaConfig();
  let res: Response;
  try {
    res = await fetchConTimeout(`https://graph.facebook.com/${waba.version}/${metaId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waba.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: d.category.toUpperCase(), components: buildComponents(d) }),
    });
  } catch (e) {
    return { ok: false, error: (e as Error)?.name === 'AbortError' ? 'Meta no respondió a tiempo, probá de nuevo.' : String(e) };
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) return { ok: false, error: j?.error?.error_user_msg || j?.error?.message || `Meta ${res.status}` };
  return { ok: true };
}

// Borra una plantilla de Meta por nombre (todos los idiomas).
export async function deleteMetaTemplate(name: string): Promise<{ ok: boolean; error?: string }> {
  const waba = await getWabaConfig();
  try {
    const res = await fetchConTimeout(
      `https://graph.facebook.com/${waba.version}/${waba.wabaId}/message_templates?name=${encodeURIComponent(name)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${waba.token}` } },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) return { ok: false, error: j?.error?.error_user_msg || j?.error?.message || `Meta ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteDraftByName(name: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from('whatsapp_template_drafts').delete().eq('name', name);
}

// Tras editar en Meta una plantilla que TAMBIÉN tiene fila local: dejarla en
// pending (idempotente; si no hay fila no hace nada).
export async function markDraftPendingByName(name: string, language: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from('whatsapp_template_drafts')
    .update({ status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() })
    .eq('name', name)
    .eq('language', language);
}

// Reconcilia el status real en Meta para los borradores en 'pending' Y los ya
// 'rejected' (para BACKFILL del motivo: un rejected no vuelve a 'pending', así que
// si quedó sin motivo hay que rellenarlo igual). Devuelve cuántos cambió. Acepta
// la lista de Meta ya traída (para no pegarle dos veces a la Graph API).
export async function reconcileDrafts(metasArg?: MetaTemplate[]): Promise<number> {
  const [pend, rej] = await Promise.all([listDrafts({ status: 'pending' }), listDrafts({ status: 'rejected' })]);
  const candidatos = [...pend, ...rej];
  if (!candidatos.length) return 0;
  const metas = metasArg ?? await listMetaTemplates();
  const byName = new Map(metas.map((m) => [`${m.name}::${m.language}`, m]));
  let cambios = 0;
  for (const d of candidatos) {
    const m = byName.get(`${d.name}::${d.language}`);
    if (!m || !d.id) continue;
    const st = m.status.toLowerCase();
    const reason = st === 'rejected' ? m.rejectedReason : null; // ENUM crudo; se traduce al renderizar
    const statusCambio = (st === 'approved' || st === 'rejected' || st === 'paused' || st === 'disabled') && st !== d.status;
    const faltaMotivo = st === 'rejected' && d.status === 'rejected' && !d.rejection_reason && !!reason;
    if (statusCambio) { await setDraftStatus(d.id, st as TemplateStatus, { rejection_reason: reason }); cambios += 1; }
    else if (faltaMotivo) { await setDraftStatus(d.id, 'rejected', { rejection_reason: reason }); cambios += 1; }
  }
  return cambios;
}
