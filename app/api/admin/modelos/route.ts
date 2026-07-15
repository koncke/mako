// =============================================================================
// /api/admin/modelos — ver y editar qué modelo/IA usa cada tarea (SuperAdmin)
// =============================================================================
// GET → catálogo con el modelo actual (override aplicado) + recomendación.
// POST { feature, provider, model } → fija el override; { feature, reset:true } → default.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getModelosConfig, setModeloFeature, CATALOGO_MODELOS, type Proveedor } from '@/lib/model-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return NextResponse.json({ ok: true, modelos: await getModelosConfig() });
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { feature?: string; provider?: string; model?: string; reset?: boolean };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const feature = String(body.feature ?? '');
  if (!feature || !CATALOGO_MODELOS.some((f) => f.feature === feature)) {
    return NextResponse.json({ ok: false, error: 'feature inválida' }, { status: 400 });
  }
  if (body.reset) {
    await setModeloFeature(feature, null);
    return NextResponse.json({ ok: true, modelos: await getModelosConfig() });
  }
  const provider = body.provider as Proveedor;
  const model = String(body.model ?? '').trim();
  if (!['anthropic', 'groq', 'openai'].includes(provider) || !model) {
    return NextResponse.json({ ok: false, error: 'provider/model requeridos' }, { status: 400 });
  }
  await setModeloFeature(feature, { provider, model });
  return NextResponse.json({ ok: true, modelos: await getModelosConfig() });
}
