// =============================================================================
// Webhook: un EMAIL QUE LLEGA (Resend, `email.received`) dispara las automatizaciones de su lead
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, CRON 8): «Si recibo un email, que se pueda configurar
// automatizaciones». Lo que decide vive en lib/email-entrante.ts (la base) y
// lib/email-entrante-reglas.ts (las reglas, puras y con test).
//
// FIRMA: Resend firma con Svix (`svix-id` / `svix-timestamp` / `svix-signature`; se aceptan también
// los `webhook-*` del estándar). El secreto es el del webhook que apunta ACÁ:
// `RESEND_INBOUND_WEBHOOK_SECRET` y, si no está, `RESEND_WEBHOOK_SECRET` (el del webhook de siempre,
// /api/webhooks/resend: la cuenta de Resend es la misma). Sin firma válida, 401 y nada más.
//
// QUÉ FALTA PARA QUE LLEGUE UN MAIL (medido el 09/10/2026 contra la cuenta de Resend, sólo lectura):
//   1. Prender «Receiving» en el dominio que va a recibir, en la cuenta de Resend de MaKo, y que el
//      cliente cargue el MX que Resend muestra (el de prioridad más baja: mejor en un SUBDOMINIO,
//      p. ej. inbox.negocio.com, para no tocar su correo de siempre). Hoy la cuenta tiene un solo
//      dominio, hola-mako.com, con `receiving: disabled`.
//   2. Que ese dominio (o el que lo contiene) sea el `resend_domain` del workspace (lo carga /email).
//   3. Un webhook de Resend a ESTA ruta con el evento `email.received`, y su secreto en
//      `RESEND_INBOUND_WEBHOOK_SECRET`. O nada más: el webhook de siempre (/api/webhooks/resend) YA
//      está suscripto a ese evento y desde la segunda pasada de la sexta tanda lo manda a la misma
//      `recibirEmailEntrante`. Con los dos a la vez no hay duplicado (la fila deduplica por email_id).
//
// RESPUESTAS: 401 sin firma; 503 sólo si reintentar lo arregla (Resend reintenta y, con Svix, apaga
// el endpoint si falla días seguidos: AGENTS.md, «un webhook contesta 5xx SÓLO a lo que se arregla
// reintentando»); 200 a todo lo demás, con el motivo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { verifyResendSignature } from '@/lib/resend';
import { envCred } from '@/lib/credenciales';
import { recibirEmailEntrante } from '@/lib/email-entrante';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = {
    id: req.headers.get('svix-id') ?? req.headers.get('webhook-id'),
    timestamp: req.headers.get('svix-timestamp') ?? req.headers.get('webhook-timestamp'),
    signature: req.headers.get('svix-signature') ?? req.headers.get('webhook-signature'),
  };
  // `envCred` y no `process.env`: con la hidratación de credenciales en curso, un secreto vacío.
  const secretos = [await envCred('RESEND_INBOUND_WEBHOOK_SECRET'), await envCred('RESEND_WEBHOOK_SECRET')]
    .filter((s): s is string => !!s && !!s.trim());
  if (!secretos.some((s) => verifyResendSignature(rawBody, headers, s))) {
    console.warn('[webhook:email-entrante] firma inválida o sin secreto (RESEND_INBOUND_WEBHOOK_SECRET / RESEND_WEBHOOK_SECRET)');
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  let evt: unknown;
  try { evt = JSON.parse(rawBody); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  try {
    const r = await recibirEmailEntrante(evt);
    return Response.json(r.body, { status: r.status });
  } catch (e) {
    // Un error del código no se arregla reintentando: 200 y al log (ver la cabecera).
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[webhook:email-entrante] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 200 });
  }
}
