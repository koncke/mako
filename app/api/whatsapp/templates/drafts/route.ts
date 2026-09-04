// =============================================================================
// API interna: borradores de plantillas + status real en Meta
// =============================================================================
// GET    ?status=&etapa=  → { ok, drafts, meta }  (borradores locales + plantillas
//                            reales del WABA con su status en vivo)
// POST   { draft }        → crea/actualiza un borrador → { ok, draft }
// PATCH  { id, action }   → 'submit' (enviar a Meta) | 'reconcile' (sync status)
// DELETE ?id=             → borra un borrador
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  listDrafts, upsertDraft, deleteDraft, getDraft, enviarBorradorAMeta, editTemplate,
  deleteMetaTemplate, deleteDraftByName, markDraftPendingByName, listMetaTemplates, reconcileDrafts, explicarRechazo,
  type TemplateDraft,
} from '@/lib/meta-templates';
import { integracionConectada } from '@/lib/credenciales';

function normalizarDraft(d: Partial<TemplateDraft>): TemplateDraft {
  return {
    id: d.id,
    name: d.name ?? '',
    language: d.language ?? 'es_MX',
    category: d.category ?? 'marketing',
    body: d.body ?? '',
    header: d.header ?? null,
    headerMedia: d.headerMedia ?? null,
    footer: d.footer ?? null,
    buttons: Array.isArray(d.buttons) ? d.buttons : [],
    params: Array.isArray(d.params) ? d.params : [],
    status: d.status ?? 'borrador',
    meta_template_id: d.meta_template_id ?? null,
    etapa: d.etapa ?? null,
  };
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Fase 1: los borradores + la lista de Meta cuelgan del WABA global del dueño → vacío.
  if (!(await integracionConectada('whatsapp'))) return Response.json({ ok: true, drafts: [], meta: [] });
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') || undefined;
  const etapa = sp.get('etapa') || undefined;
  try {
    // Las plantillas de Meta son best-effort: si falla la Graph API, devolvemos
    // igual los borradores locales (no rompemos la pantalla).
    const [drafts, meta] = await Promise.all([
      listDrafts({ status, etapa }),
      listMetaTemplates().catch((e) => {
        console.error(`[api:templates/drafts] meta: ${e instanceof Error ? e.message : e}`);
        return [];
      }),
    ]);
    const metaConMotivo = meta.map((m) => ({ ...m, rejectedMotivo: m.status === 'rejected' ? explicarRechazo(m.rejectedReason) : null }));
    return Response.json({ ok: true, drafts, meta: metaConMotivo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts GET] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Fase 1: los borradores de plantilla son para el WABA global del dueño.
  if (!(await integracionConectada('whatsapp'))) return Response.json({ ok: false, error: 'WhatsApp no está conectado en este workspace. Conéctalo en Configuraciones → Método.' }, { status: 403 });
  let body: { draft?: Partial<TemplateDraft> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const d = body.draft;
  if (!d || !d.name || typeof d.body !== 'string') {
    return Response.json({ ok: false, error: 'falta draft.name / draft.body' }, { status: 400 });
  }
  // nombre meta-safe: minúsculas, números y guiones bajos, máx 512 (límite de Meta).
  const nameOk = /^[a-z0-9_]{1,512}$/.test(d.name);
  if (!nameOk) {
    return Response.json({ ok: false, error: 'El nombre solo admite minúsculas, números y guiones bajos (máx 512).' }, { status: 400 });
  }
  try {
    const draft = await upsertDraft({
      id: d.id,
      name: d.name,
      language: d.language ?? 'es_MX',
      category: d.category ?? 'marketing',
      body: d.body,
      header: d.header ?? null,
      headerMedia: d.headerMedia ?? null,
      footer: d.footer ?? null,
      buttons: Array.isArray(d.buttons) ? d.buttons : [],
      params: Array.isArray(d.params) ? d.params : [],
      etapa: d.etapa ?? null,
      validacion: d.validacion ?? null,
      status: 'borrador',
    });
    return Response.json({ ok: true, draft });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts POST] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Fase 1: submit/reconcile/edit tocan el WABA global del dueño en Meta.
  if (!(await integracionConectada('whatsapp'))) return Response.json({ ok: false, error: 'WhatsApp no está conectado en este workspace. Conéctalo en Configuraciones → Método.' }, { status: 403 });
  let body: { id?: unknown; action?: unknown; metaId?: unknown; draft?: Partial<TemplateDraft> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const action = body.action;
  try {
    if (action === 'reconcile') {
      const cambios = await reconcileDrafts();
      return Response.json({ ok: true, cambios });
    }
    if (action === 'submit') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
      const r = await enviarBorradorAMeta(id);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, status: r.status });
    }
    // Editar una plantilla EXISTENTE en Meta (aprobada/rechazada). Vuelve a revisión.
    if (action === 'edit') {
      const metaId = typeof body.metaId === 'string' ? body.metaId : '';
      if (!metaId || !body.draft) return Response.json({ ok: false, error: 'falta metaId / draft' }, { status: 400 });
      const d = normalizarDraft(body.draft);
      const r = await editTemplate(metaId, d);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      // si existe fila local con ese nombre/idioma, dejarla en pending (vuelve a revisión).
      await markDraftPendingByName(d.name, d.language).catch(() => {});
      return Response.json({ ok: true, status: 'pending' });
    }
    return Response.json({ ok: false, error: 'action desconocida' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts PATCH] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Fase 1: borrar toca el WABA global del dueño en Meta.
  if (!(await integracionConectada('whatsapp'))) return Response.json({ ok: false, error: 'WhatsApp no está conectado en este workspace. Conéctalo en Configuraciones → Método.' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const name = sp.get('name');
  const idRaw = sp.get('id');
  try {
    // Borrar por NOMBRE = plantilla de Meta (aprobada/cualquiera) + su borrador local.
    if (name) {
      const r = await deleteMetaTemplate(name);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      await deleteDraftByName(name);
      return Response.json({ ok: true });
    }
    const id = Number(idRaw);
    if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'falta id o name' }, { status: 400 });
    // Si el borrador ya está en Meta (enviado/aprobado/rechazado), borrarlo también allá
    // PRIMERO; si Meta falla, no borramos el local (evita huérfanas en Meta).
    const d = await getDraft(id);
    if (d && d.status !== 'borrador' && d.name) {
      const rm = await deleteMetaTemplate(d.name);
      if (!rm.ok) return Response.json({ ok: false, error: rm.error }, { status: 400 });
    }
    await deleteDraft(id);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts DELETE] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
