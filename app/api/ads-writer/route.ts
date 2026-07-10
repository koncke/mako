// =============================================================================
// POST /api/ads-writer — MaKo ESCRIBE (o AJUSTA) copy de anuncios de Meta
// =============================================================================
// mode='suggest': { prompt } → MaKo devuelve variantes de copy aterrizadas en el
//   brief real del negocio (oferta/avatar/funnel/ganadores).
// mode='adjust' : { setActual, instruccion } → MaKo aplica el cambio pedido.
// Devuelve { ok, set, uso }. Los prompts son editables en /configuraciones.
// =============================================================================

import type { NextRequest } from 'next/server';
import { generarAdCopy, type AdCopySet } from '@/lib/ad-copy';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { mode?: string; prompt?: string; setActual?: AdCopySet; instruccion?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const mode = body.mode === 'adjust' ? 'adjust' : 'suggest';
  const prompt = String(body.prompt ?? '').trim();
  const instruccion = String(body.instruccion ?? '').trim();
  if (mode === 'suggest' && !prompt) return Response.json({ ok: false, error: 'Escribí qué anuncio querés que MaKo escriba.' }, { status: 400 });
  if (mode === 'adjust' && (!instruccion || !body.setActual)) return Response.json({ ok: false, error: 'Falta el cambio a aplicar o las variantes actuales.' }, { status: 400 });

  const res = await generarAdCopy({ mode, prompt, setActual: body.setActual, instruccion });
  if (!res.ok) {
    console.error(`[ads-writer:${mode}] ${res.error}`);
    return Response.json({ ok: false, error: res.error }, { status: 500 });
  }
  return Response.json({ ok: true, set: res.set, uso: res.uso });
}
