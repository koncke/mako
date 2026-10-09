// =============================================================================
// Webhook de Resend — eventos de entrega/engagement de email
// =============================================================================
// Resend firma con Svix (headers svix-id / svix-timestamp / svix-signature).
// Eventos que nos importan:
//   email.opened     → marca abierto_at
//   email.clicked    → marca clic_at
//   email.bounced    → da de baja al lead (supresión)
//   email.complained → da de baja al lead (marcó spam)
// Cualquier otro evento se ignora (200 para que Resend no reintente).
//
// Setup: en Resend → Webhooks, apuntar a /api/webhooks/resend y copiar el
// Signing Secret a RESEND_WEBHOOK_SECRET (whsec_...).
// =============================================================================

import type { NextRequest } from 'next/server';
import { verifyResendSignature } from '@/lib/resend';
import { envCred } from '@/lib/credenciales';
import { marcarEventoEmail, suprimirPorRebote } from '@/lib/email-marketing';

export const dynamic = 'force-dynamic';

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; created_at?: string; bounce?: { type?: string; subType?: string } };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  // envCred y no process.env: el mismo agujero que la key de la plataforma (lib/resend.ts), con
  // la hidratación de credenciales todavía en curso la firma se verificaba contra un secreto vacío.
  const secret = (await envCred('RESEND_WEBHOOK_SECRET')) ?? '';

  const ok = verifyResendSignature(
    rawBody,
    {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    },
    secret,
  );
  if (!ok) {
    console.warn('[webhook:resend] firma inválida o RESEND_WEBHOOK_SECRET sin configurar');
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  let evt: ResendEvent;
  try { evt = JSON.parse(rawBody) as ResendEvent; } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const emailId = evt.data?.email_id;
  const when = evt.data?.created_at || evt.created_at || new Date().toISOString();
  if (!emailId) return Response.json({ ok: true, ignored: 'sin email_id' });

  try {
    switch (evt.type) {
      case 'email.opened':
        await marcarEventoEmail(emailId, 'abierto', when);
        break;
      case 'email.clicked':
        // Un clic implica apertura: marcamos las dos.
        await marcarEventoEmail(emailId, 'abierto', when);
        await marcarEventoEmail(emailId, 'clic', when);
        break;
      case 'email.bounced': {
        // Solo suprimir en rebote PERMANENTE (dirección inválida). Los soft/transient
        // (buzón lleno, temporal) no deben dar de baja a un lead válido.
        const tipo = (evt.data?.bounce?.type ?? '').toLowerCase();
        if (tipo === 'permanent' || tipo === 'hardbounce' || tipo === 'hard') await suprimirPorRebote(emailId);
        break;
      }
      case 'email.complained':
        // Marcó spam → baja inmediata.
        await suprimirPorRebote(emailId);
        break;
      default:
        return Response.json({ ok: true, ignored: evt.type ?? 'sin tipo' });
    }
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook:resend] error: ${msg}`);
    // 200 igual: el evento llegó bien, el error es nuestro; no queremos reintentos.
    return Response.json({ ok: false, error: msg });
  }
}
