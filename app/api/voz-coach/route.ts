// =============================================================================
// /api/voz-coach — el audio de un mensaje de un coach (Offer Coach, Funnel Coach), con la voz de la plataforma
// =============================================================================
//   GET                          → { disponible }: si el botón se muestra (la revisión de Martín + la key de la plataforma).
//   POST { texto, fija? }        → audio/mpeg: el mensaje dicho. `fija`: una pregunta predefinida del coach, que se guarda.
//
// Detrás del interruptor del onboarding V2 (lib/onboarding-v2/revision.ts): a quien no lo ve, `disponible: false` y nada más. Sin
// `MAKO_ELEVENLABS_API_KEY` (lib/voz-mako.ts), tampoco: sin key no hay botón a medias. Las reglas, en lib/voz-coach-reglas.ts.
// POST y no GET: el texto del coach puede traer datos del negocio, y en una URL quedaría en los logs.
// =============================================================================

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { veOnboardingV2 } from '@/lib/onboarding-v2/revision';
import { audioDelCoach, vozCoachDisponible } from '@/lib/voz-coach';

export const dynamic = 'force-dynamic';

async function quien(): Promise<{ ws: number } | null> {
  const s = await getUsuarioActual().catch(() => null);
  if (!s || s.legacy) return null;
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null || !veOnboardingV2({ email: s.email, ws })) return null;
  return { ws };
}

export async function GET() {
  const q = await quien();
  return NextResponse.json({ disponible: !!q && vozCoachDisponible() }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const q = await quien();
  if (!q) return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { texto?: unknown; fija?: unknown } | null;
  const texto = typeof body?.texto === 'string' ? body.texto : '';
  const r = await audioDelCoach(texto, { fija: body?.fija === true, ws: q.ws });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return new Response(r.cuerpo as BodyInit, {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, no-store', 'x-voz-coach': r.guardado ? 'guardada' : 'nueva' },
  });
}
