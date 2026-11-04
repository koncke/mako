// =============================================================================
// Webhook de Resend — eventos de entrega/engagement de email
// =============================================================================
// Resend firma con Svix (headers svix-id / svix-timestamp / svix-signature).
// Eventos que nos importan:
//   email.opened     → marca abierto_at (y mueve la tarjeta a la columna «abrió» de la automatización, si la eligió)
//   email.clicked    → marca clic_at (y la mueve a la columna «clic»)
//   email.bounced    → da de baja al lead (supresión), anota el rebote y mira el freno del email (lib/email-reputacion.ts)
//   email.complained → da de baja al lead (marcó spam), anota la queja y mira el freno
//   email.received   → un email que LLEGA dispara las automatizaciones de su lead
//                      (lib/email-entrante.ts, sexta tanda, CRON 8)
// Cualquier otro evento se ignora (200 para que Resend no reintente).
//
// ⚠️ `email.received` VA ACÁ TAMBIÉN, y no sólo en /api/webhooks/email-entrante (segunda pasada,
// 09/10/2026): el único webhook de la cuenta de Resend de MaKo apunta a esta ruta y YA está
// suscripto a `email.received` (medido el 09/10, sólo lectura). Sin este case, el día que alguien
// prenda la recepción en un dominio los mails llegaban acá, caían al `default` y se perdían con un
// 200. Con los dos endpoints suscriptos a la vez no hay duplicado: la fila de `email_entrantes`
// deduplica por `email_id`. La respuesta es la de `recibirEmailEntrante` (503 sólo si reintentar
// lo arregla).
//
// Setup: en Resend → Webhooks, apuntar a /api/webhooks/resend y copiar el
// Signing Secret a RESEND_WEBHOOK_SECRET (whsec_...). Ése es el de la cuenta de MaKo.
//
// ⚠️ CADA NEGOCIO CON SU CUENTA (4/11/2026, Martín: «Resend free permite hasta 3 dominios, pero eso lo trae cada user de
// mako»): la cuenta de Resend de un negocio manda sus eventos a esta misma ruta con `?cuenta=<ws>` (el webhook lo crea
// `conectarSeguimiento`, lib/email-dominio.ts). Ese número NO autoriza nada: lo que autentica es la firma con el secreto
// de ESA cuenta (`secretoDelWebhookPropio`, leído ESTRICTO: «no pude leer» es un 503 que Resend reintenta, nunca «no es
// de nadie»). Y lo que llega así sólo toca las filas de ese negocio: un negocio que conoce su propio secreto no puede
// marcar abierto, dar de baja ni disparar nada de otro, aunque nombre un `email_id` ajeno.
// =============================================================================

import type { NextRequest } from 'next/server';
import { verifyResendSignature } from '@/lib/resend';
import { envCred } from '@/lib/credenciales';
import { secretoDelWebhookPropio } from '@/lib/email-cuenta';
import { cuentaDelPedido, PARAM_CUENTA } from '@/lib/email-cuenta-reglas';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { marcarEventoEmail, moverPorEventoDeEmail, suprimirPorRebote } from '@/lib/email-marketing';
import { recibirEmailEntrante } from '@/lib/email-entrante';
import { revisarFrenoEmail } from '@/lib/email-reputacion';

export const dynamic = 'force-dynamic';
// `email.received` puede mandar el primer mensaje de una automatización en el acto (la vía rápida).
export const maxDuration = 60;

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; created_at?: string; bounce?: { type?: string; subType?: string } };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  // De qué cuenta viene: `?cuenta=<ws>` es la de un negocio; sin el parámetro, la de MaKo.
  const crudo = new URL(req.url).searchParams.get(PARAM_CUENTA);
  const cuenta = cuentaDelPedido(crudo);
  if (crudo != null && cuenta == null) return Response.json({ ok: false, error: 'cuenta' }, { status: 400 });
  let secret: string;
  if (cuenta != null) {
    try {
      secret = (await secretoDelWebhookPropio(cuenta)) ?? '';
    } catch (e) {
      return responderFalloDeRuteo('email', e, `cuenta ${cuenta}`);
    }
    if (!secret) console.warn(`[webhook:resend] la cuenta del ws ${cuenta} manda eventos y MaKo no tiene su secreto: falta conectar el seguimiento`);
  } else {
    // envCred y no process.env: el mismo agujero que la key de la plataforma (lib/email-cuenta.ts), con
    // la hidratación de credenciales todavía en curso la firma se verificaba contra un secreto vacío.
    secret = (await envCred('RESEND_WEBHOOK_SECRET')) ?? '';
  }

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
    console.warn(`[webhook:resend] firma inválida o sin secreto (${cuenta != null ? `la cuenta del ws ${cuenta}` : 'RESEND_WEBHOOK_SECRET'})`);
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  let evt: ResendEvent;
  try { evt = JSON.parse(rawBody) as ResendEvent; } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const emailId = evt.data?.email_id;
  const when = evt.data?.created_at || evt.created_at || new Date().toISOString();
  if (!emailId) return Response.json({ ok: true, ignored: 'sin email_id' });
  // Lo que llega por la cuenta de un negocio sólo toca SUS filas (ver la cabecera). Sin `cuenta`, la de MaKo, como siempre.
  const soloWs = cuenta ?? undefined;

  try {
    switch (evt.type) {
      // La tarjeta del CRM sigue al email (4/11/2026, lib/email-eventos-crm.ts): sólo la primera vez que se marca, en el
      // workspace de la fila del envío. `moverPorEventoDeEmail` no tira: esto sigue contestando 200.
      case 'email.opened':
        await moverPorEventoDeEmail(await marcarEventoEmail(emailId, 'abierto', when, soloWs), 'abierto');
        break;
      case 'email.clicked':
        // Un clic implica apertura: marcamos las dos.
        await moverPorEventoDeEmail(await marcarEventoEmail(emailId, 'abierto', when, soloWs), 'abierto');
        await moverPorEventoDeEmail(await marcarEventoEmail(emailId, 'clic', when, soloWs), 'clic');
        break;
      case 'email.bounced': {
        // Solo suprimir en rebote PERMANENTE (dirección inválida). Los soft/transient
        // (buzón lleno, temporal) no deben dar de baja a un lead válido.
        const tipo = (evt.data?.bounce?.type ?? '').toLowerCase();
        if (tipo === 'permanent' || tipo === 'hardbounce' || tipo === 'hard') {
          // Se anota con su hora (mig 0380) y se mira el freno del email del negocio (lib/email-reputacion.ts, 4/11/2026).
          const fila = await marcarEventoEmail(emailId, 'rebote', when, soloWs);
          await suprimirPorRebote(emailId, soloWs);
          if (fila?.workspace_id != null) await revisarFrenoEmail(fila.workspace_id);
        }
        break;
      }
      case 'email.complained': {
        // Marcó spam → baja inmediata, y el freno (una queja castiga al dominio más que un rebote).
        const fila = await marcarEventoEmail(emailId, 'queja', when, soloWs);
        await suprimirPorRebote(emailId, soloWs);
        if (fila?.workspace_id != null) await revisarFrenoEmail(fila.workspace_id);
        break;
      }
      case 'email.received': {
        // Un email que llega (ver la cabecera). Contesta lo que decida `recibirEmailEntrante`.
        const r = await recibirEmailEntrante(evt, { cuenta: soloWs });
        return Response.json(r.body, { status: r.status });
      }
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
