// =============================================================================
// POST /api/ads-manager/audience-create — crear un público personalizado en Meta
// =============================================================================
// Para no tener que entrar a Meta a armar el retargeting. { tipo:'page'|'pixel',
// dias } → crea el Custom Audience y devuelve { ok, audience:{id,name} }.
// =============================================================================

import type { NextRequest } from 'next/server';
import { createCustomAudience, type AudienceTipo, metaErrorEnvelope } from '@/lib/meta-ads-create';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TIPOS: AudienceTipo[] = ['page', 'ig', 'video', 'pixel'];

export async function POST(req: NextRequest) {
  let body: { tipo?: string; dias?: number; name?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const tipo: AudienceTipo = TIPOS.includes(body.tipo as AudienceTipo) ? (body.tipo as AudienceTipo) : 'page';
  const dias = Number(body.dias) > 0 ? Number(body.dias) : 90;
  try {
    const audience = await createCustomAudience({ tipo, dias, name: typeof body.name === 'string' ? body.name : undefined });
    return Response.json({ ok: true, audience });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:audience-create] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
