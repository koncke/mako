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

export type TemplateDraft = {
  id?: number;
  name: string;
  language: string;
  category: TemplateCategoria;
  body: string;
  header?: string | null;
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
  header: string | null; footer: string | null; buttons: unknown; params: unknown;
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
  if (d.header && d.header.trim()) comps.push({ type: 'HEADER', format: 'TEXT', text: d.header.trim() });

  const body: GraphComponent = { type: 'BODY', text: d.body };
  if (d.params.length) {
    body.example = { body_text_named_params: d.params.map((p) => ({ param_name: p.name, example: p.example })) };
  }
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
// OJO: NO mandamos `parameter_format: 'NAMED'`. Con ese campo, una variable
// repetida (ej. {{nombre}} dos veces) hace que Meta rechace con "BODY missing
// example" (verificado contra la Graph API). Sin el campo, Meta autodetecta el
// formato named desde la sintaxis {{nombre}} y acepta el example una sola vez.
export function buildGraphPayload(d: TemplateDraft): Record<string, unknown> {
  return {
    name: d.name.trim(),
    language: d.language || 'es_MX',
    category: d.category.toUpperCase(),
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
  params: string[];       // nombres de variables del body
  metaId: string | null;
};

type GraphTplComponent = {
  type?: string; text?: string;
  example?: { body_text_named_params?: Array<{ param_name?: string }> };
};
type GraphTpl = {
  id?: string; name?: string; language?: string; category?: string; status?: string;
  components?: GraphTplComponent[];
};

// Lista las plantillas reales del WABA en Meta (con su status en vivo).
export async function listMetaTemplates(): Promise<MetaTemplate[]> {
  const waba = await getWabaConfig();
  const url =
    `https://graph.facebook.com/${waba.version}/${waba.wabaId}/message_templates` +
    `?fields=name,status,category,language,components,id&limit=200`;
  const res = await fetchConTimeout(url, { headers: { Authorization: `Bearer ${waba.token}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j?.error?.message || `Meta ${res.status}`);
  // Convención: minúsculas en todo el código/DB; MAYÚSCULAS sólo en el payload de salida a Meta.
  return ((j.data ?? []) as GraphTpl[]).map((t) => {
    const body = (t.components ?? []).find((c) => c.type === 'BODY');
    const params = (body?.example?.body_text_named_params ?? []).map((p) => p.param_name ?? '').filter(Boolean);
    return {
      name: t.name ?? '',
      language: t.language ?? '',
      category: (t.category ?? '').toLowerCase(),
      status: (t.status ?? '').toLowerCase(),
      body: body?.text ?? '',
      params,
      metaId: t.id ?? null,
    };
  }).filter((t) => t.name);
}

// Reconcilia: para los borradores en 'pending', mira el status real en Meta y lo
// actualiza (approved/rejected). Devuelve cuántos cambió.
export async function reconcileDrafts(): Promise<number> {
  const pendientes = await listDrafts({ status: 'pending' });
  if (!pendientes.length) return 0;
  const metas = await listMetaTemplates();
  const byName = new Map(metas.map((m) => [`${m.name}::${m.language}`, m]));
  let cambios = 0;
  for (const d of pendientes) {
    const m = byName.get(`${d.name}::${d.language}`);
    if (!m || !d.id) continue;
    const st = m.status.toLowerCase();
    if ((st === 'approved' || st === 'rejected' || st === 'paused' || st === 'disabled') && st !== d.status) {
      await setDraftStatus(d.id, st as TemplateStatus);
      cambios += 1;
    }
  }
  return cambios;
}
