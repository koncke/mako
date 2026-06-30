// =============================================================================
// Baja de email (unsubscribe) — link del footer + One-Click (RFC 8058)
// =============================================================================
// GET  ?lead=N&t=token → marca leads.email_opt_out=true y muestra confirmación.
// POST (List-Unsubscribe-Post=One-Click) → idem, responde 200 sin HTML.
// El token evita que alguien dé de baja a otro lead cambiando el id en la URL.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifyUnsubscribeToken } from '@/lib/resend';

export const dynamic = 'force-dynamic';

function page(titulo: string, detalle: string): Response {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;background:#F2F0EA;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1813;">
<div style="max-width:480px;margin:64px auto;padding:32px;background:#fff;border:1px solid #E7E3D9;border-radius:14px;text-align:center;">
<div style="font-size:20px;font-weight:600;">${titulo}</div>
<div style="margin-top:10px;color:#6B675C;font-size:15px;line-height:1.5;">${detalle}</div>
</div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function darDeBaja(req: NextRequest): Promise<{ ok: boolean; error?: string }> {
  const url = new URL(req.url);
  const leadId = Number(url.searchParams.get('lead'));
  const token = url.searchParams.get('t') ?? '';
  if (!Number.isFinite(leadId) || !token) return { ok: false, error: 'link inválido' };
  if (!verifyUnsubscribeToken(leadId, token)) return { ok: false, error: 'token inválido' };
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('leads').update({ email_opt_out: true }).eq('id', leadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const r = await darDeBaja(req);
  if (!r.ok) return page('No se pudo procesar la baja', r.error === 'token inválido' || r.error === 'link inválido' ? 'El enlace no es válido o expiró.' : 'Ocurrió un error. Probá de nuevo más tarde.');
  return page('Listo, te diste de baja', 'No vas a recibir más correos de esta lista. Si fue un error, escribinos y te volvemos a sumar.');
}

export async function POST(req: NextRequest) {
  const r = await darDeBaja(req);
  return Response.json({ ok: r.ok, ...(r.error ? { error: r.error } : {}) }, { status: r.ok ? 200 : 400 });
}
