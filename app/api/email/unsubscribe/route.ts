// =============================================================================
// Baja de email (unsubscribe) — link del footer + One-Click (RFC 8058)
// =============================================================================
// GET  ?lead=N&t=token → marca leads.email_opt_out=true y muestra confirmación.
// POST (List-Unsubscribe-Post=One-Click) → idem, responde 200 sin HTML.
// El token evita que alguien dé de baja a otro lead cambiando el id en la URL.
//
// Con `&b=<broadcast>` (los links desde el 29/10/2026), la baja además queda atribuida a ESE envío
// (`email_broadcast_envios.baja_at`, mig 0351: las bajas de cada edición del newsletter) y, si el lead está en el CRM
// del newsletter, su tarjeta pasa a «Dado de baja» en el acto (lib/newsletter.ts). Las dos cosas van DESPUÉS de la baja
// y nunca la frenan: lo que importa es que no le llegue otro correo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { verifyUnsubscribeToken } from '@/lib/resend';
import { runWithWorkspace } from '@/lib/workspace';

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
  const { data, error } = await supabase.from('leads').update({ email_opt_out: true }).eq('id', leadId).select('workspace_id');
  if (error) return { ok: false, error: error.message };
  await despuesDeLaBaja(leadId, Number(url.searchParams.get('b')), Number(((data ?? []) as Array<{ workspace_id: number | null }>)[0]?.workspace_id));
  return { ok: true };
}

/**
 * Lo que sigue a la baja: la estampa en el envío de donde vino y la tarjeta del newsletter. Nunca tira ni cambia la
 * respuesta: la baja ya está escrita.
 */
async function despuesDeLaBaja(leadId: number, broadcastId: number, ws: number): Promise<void> {
  if (Number.isSafeInteger(broadcastId) && broadcastId > 0) {
    try {
      const { error } = await getSupabaseServer().from('email_broadcast_envios')
        .update({ baja_at: new Date().toISOString() })
        .eq('broadcast_id', broadcastId).eq('lead_id', leadId).is('baja_at', null);
      if (error) console.error(`[unsubscribe] la baja del lead ${leadId} en el envío ${broadcastId}: ${error.message}`);
    } catch (e) {
      console.error(`[unsubscribe] la baja del lead ${leadId} en el envío ${broadcastId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (Number.isSafeInteger(ws) && ws > 0) {
    try {
      const { conciliarLeadDelNewsletter } = await import('@/lib/newsletter');
      await runWithWorkspace(ws, () => conciliarLeadDelNewsletter(leadId));
    } catch (e) {
      console.error(`[unsubscribe] la tarjeta del newsletter del lead ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export async function GET(req: NextRequest) {
  const r = await darDeBaja(req);
  if (!r.ok) return page('No se pudo procesar la baja', r.error === 'token inválido' || r.error === 'link inválido' ? 'El enlace no es válido o expiró.' : 'Ocurrió un error. Prueba de nuevo más tarde.');
  return page('Listo, te diste de baja', 'No vas a recibir más correos de esta lista. Si fue un error, escríbenos y te volvemos a sumar.');
}

export async function POST(req: NextRequest) {
  const r = await darDeBaja(req);
  return Response.json({ ok: r.ok, ...(r.error ? { error: r.error } : {}) }, { status: r.ok ? 200 : 400 });
}
