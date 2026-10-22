// =============================================================================
// POST /api/ia-del-negocio/modelo { modelo: 'haiku' | 'sonnet' } — el modelo de SU Claude por clave (IA5, 22/10/2026)
// =============================================================================
// PRIVADA, del admin (la clave es del negocio y la paga su cuenta). Lo usa la puerta 2 del veto (lib/anthropic.ts →
// `permisoDeLaClaveDelNegocio`). Una clave que es el crédito de Max de la plataforma sigue con el barato aunque elija Sonnet.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { setSetting } from '@/lib/settings';
import { CLAVE_MODELO_SU_CLAUDE, MODELO_SU_CLAUDE } from '@/lib/veto-claude';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  if (persona.rol !== 'admin') return NextResponse.json({ ok: false, error: 'Sólo el admin del negocio.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  if (typeof body?.modelo !== 'string' || !(body.modelo in MODELO_SU_CLAUDE)) return NextResponse.json({ ok: false, error: 'Ese modelo no está.' }, { status: 400 });
  await runWithWorkspace(persona.ws, () => setSetting(CLAVE_MODELO_SU_CLAUDE, String(body.modelo)));
  return NextResponse.json({ ok: true });
}
