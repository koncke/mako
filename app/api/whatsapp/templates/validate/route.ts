// =============================================================================
// API interna: validar un borrador de plantilla contra las reglas de Meta (MaKo)
// =============================================================================
// POST { draft } → { ok, validacion: { riesgo, categoria_sugerida, bloqueantes,
// razones, correcciones } }. Lo usa el editor de plantillas ("Validar con MaKo").
// =============================================================================

import type { NextRequest } from 'next/server';
import { validarPlantilla } from '@/lib/template-validator';
import type { TemplateDraft } from '@/lib/meta-templates';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { draft?: Partial<TemplateDraft> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  const d = body.draft;
  if (!d || typeof d.body !== 'string') {
    return Response.json({ ok: false, error: 'falta draft.body' }, { status: 400 });
  }
  const draft: TemplateDraft = {
    name: d.name ?? '',
    language: d.language ?? 'es_MX',
    category: d.category ?? 'marketing',
    body: d.body,
    header: d.header ?? null,
    footer: d.footer ?? null,
    buttons: Array.isArray(d.buttons) ? d.buttons : [],
    params: Array.isArray(d.params) ? d.params : [],
    status: 'borrador',
  };
  try {
    const validacion = await validarPlantilla(draft);
    return Response.json({ ok: true, validacion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/validate] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
