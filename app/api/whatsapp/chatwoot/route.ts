// =============================================================================
// API interna: salud del webhook de Chatwoot (canal oficial de WhatsApp)
// =============================================================================
// GET  → estado del webhook Chatwoot → app (para el chip de la tab /whatsapp).
// POST → { action:'reparar-webhook' } → (re)registra el webhook en la cuenta de
//        Chatwoot del workspace + reclama el ruteo del account_id, y re-verifica.
// Guard: solo el admin del workspace (registrar un webhook es config sensible).
// Mismo patrón que app/api/whatsapp/evolution/route.ts.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { chatwootConfigurado, estadoWebhookChatwoot, repararWebhookChatwoot } from '@/lib/chatwoot';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede configurar el webhook de Chatwoot.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await soloAdmin();
  if (g) return g;
  try {
    if (!(await chatwootConfigurado())) return Response.json({ ok: true, configurado: false });
    const s = await estadoWebhookChatwoot();
    return Response.json({ ok: true, configurado: true, ...s });
  } catch (e) {
    console.error(`[api:whatsapp/chatwoot GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await soloAdmin();
  if (g) return g;
  if (!(await chatwootConfigurado())) {
    return Response.json({ ok: false, error: 'Chatwoot no está configurado en este espacio.' }, { status: 400 });
  }

  let body: { action?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'reparar-webhook') {
      const r = await repararWebhookChatwoot();
      return Response.json({ ok: r.ok, estado: r.estado, error: r.error });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:whatsapp/chatwoot POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
