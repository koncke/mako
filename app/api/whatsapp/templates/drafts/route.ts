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
  listDrafts, upsertDraft, deleteDraft, enviarBorradorAMeta, listMetaTemplates, reconcileDrafts,
  type TemplateDraft,
} from '@/lib/meta-templates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
    return Response.json({ ok: true, drafts, meta });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts GET] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
  // nombre meta-safe: minúsculas, números y guiones bajos.
  const nameOk = /^[a-z0-9_]+$/.test(d.name);
  if (!nameOk) {
    return Response.json({ ok: false, error: 'El nombre solo admite minúsculas, números y guiones bajos.' }, { status: 400 });
  }
  try {
    const draft = await upsertDraft({
      id: d.id,
      name: d.name,
      language: d.language ?? 'es_MX',
      category: d.category ?? 'marketing',
      body: d.body,
      header: d.header ?? null,
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
  let body: { id?: unknown; action?: unknown };
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
    return Response.json({ ok: false, error: 'action desconocida' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts PATCH] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  try {
    await deleteDraft(id);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/drafts DELETE] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
