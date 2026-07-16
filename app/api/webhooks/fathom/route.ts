// =============================================================================
// Webhook: Fathom → leads
// =============================================================================
// Endpoint público que recibe el webhook "new-meeting-content-ready" de Fathom.
// Seguridad: verifica la firma Svix con FATHOM_WEBHOOK_SECRET.
//
// Qué hace: matchea el invitado EXTERNO de la reunión (su email) con un lead,
// decide si fue R1 o R2 (por la fecha de la grabación contra fecha_junta_1/2) y
// marca la asistencia (solo si estaba sin marcar) + guarda el link de la
// grabación. Esto es el disparador "asistencia" del funnel: el lead avanza solo.
//
// Inerte hasta registrar la URL en Fathom (Settings → API → Add Webhook).
// =============================================================================

import type { NextRequest } from 'next/server';
import { verifyFathomSignature, externalInvitee, inviteeSpoke, webhookDurationMin, FathomSignatureError, type FathomWebhookPayload } from '@/lib/fathom';
import { findLeadByContacto, applyFathomRecording } from '@/lib/leads';
import { isoToFechaTijuana } from '@/lib/calendly';
import { emitirDelCatalogo } from '@/lib/avisos';
import { dispararEvento } from '@/lib/flujos';
import { runWithWorkspace } from '@/lib/workspace';
import { wsPorIdentificador } from '@/lib/webhook-routing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const tStart = Date.now();
  const rawBody = await request.text();

  // 1) Verificar firma (Svix)
  try {
    verifyFathomSignature(
      rawBody,
      {
        id: request.headers.get('webhook-id'),
        timestamp: request.headers.get('webhook-timestamp'),
        signature: request.headers.get('webhook-signature'),
      },
      process.env.FATHOM_WEBHOOK_SECRET ?? '',
    );
  } catch (err) {
    if (err instanceof FathomSignatureError) {
      console.warn(`[webhook:fathom] firma rechazada: ${err.message}`);
      return Response.json({ ok: false, error: 'signature', message: err.message }, { status: 401 });
    }
    throw err;
  }

  // 2) Parsear
  let body: FathomWebhookPayload;
  try { body = JSON.parse(rawBody) as FathomWebhookPayload; }
  catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  // 2.5) Resolver el workspace por el email de la cuenta que grabó (recorded_by).
  //      Fail-CLOSED: sin mapeo (webhook_routing), NO tocamos datos — nunca cae al
  //      dueño (evita matchear la grabación de un cliente contra leads ajenos).
  const hostEmail = body.recorded_by?.email ?? null;
  const ws = await wsPorIdentificador('fathom', hostEmail);
  if (ws == null) {
    console.warn(`[webhook:fathom] sin workspace para recorded_by=${hostEmail ?? '—'} — ignorado`);
    return Response.json({ ok: true, ignored: 'sin workspace' });
  }

  // 3) Matchear lead + aplicar — TODO confinado al workspace resuelto.
  return runWithWorkspace(ws, async () => {
   try {
    const invitee = externalInvitee(body);
    if (!invitee?.email) {
      console.warn('[webhook:fathom] sin invitado externo con email — ignorado');
      return Response.json({ ok: true, ignored: true, reason: 'sin invitado externo' });
    }

    const lead = await findLeadByContacto(invitee.email, null);
    if (!lead) {
      console.warn(`[webhook:fathom] sin lead para email=${invitee.email} — ignorado`);
      return Response.json({ ok: true, ignored: true, reason: 'sin match de lead', email: invitee.email });
    }

    // R1 vs R2: por la fecha de la grabación contra las fechas del lead.
    const startIso = body.recording_start_time || body.scheduled_start_time || null;
    const fecha = startIso ? isoToFechaTijuana(startIso) : null;
    let which: 'j1' | 'j2' = 'j1';
    if (fecha && lead.fecha_junta_2 && fecha === lead.fecha_junta_2) which = 'j2';
    else if (fecha && lead.fecha_junta_1 && fecha === lead.fecha_junta_1) which = 'j1';
    else if (lead.fecha_junta_2 && lead.asistio_j1 != null) which = 'j2'; // R1 ya resuelta → es la R2

    // Asistencia: si el payload trae transcript, confirmamos que el invitado habló.
    const attended = inviteeSpoke(body, invitee.email);

    const res = await applyFathomRecording(lead, which, body.share_url ?? null, attended);

    // Aviso al dueño: terminó la reunión y ya hay grabación/transcript. Solo la
    // 1ª vez que el webhook aporta algo nuevo a ese lead (idempotente ante Svix).
    if (res.markedAsistencia || res.addedLink) {
      const nombre = invitee.name?.trim() || lead.nombre;
      const reunion = which === 'j1' ? 'R1' : 'R2';
      const dur = webhookDurationMin(body);
      const durTxt = dur ? ` (${dur} min)` : '';
      await emitirDelCatalogo('reunion-ocurrio-fathom', {
        texto: `✅ Terminó la *${reunion} con ${nombre}*${durTxt}. Ya tengo la grabación y el transcript listos.\n\n¿Querés que te pase el resumen y las objeciones acá? — MaKo`,
      });
      // Flujos configurados por el dueño (editor de flujos): disparar 'reunion.ocurrio'.
      await dispararEvento('reunion.ocurrio', { leadId: lead.id, leadNombre: nombre, reunion });
    }

    const ms = Date.now() - tStart;
    console.log(`[webhook:fathom] lead id=${lead.id} ${which} asistencia=${res.markedAsistencia} link=${res.addedLink} attended=${attended ?? 'desconocido'} ms=${ms}`);
    return Response.json({ ok: true, lead_id: lead.id, which, ...res, ms });
   } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook:fathom] error procesando: ${message}`);
    return Response.json({ ok: false, error: 'processing', message }, { status: 500 });
   }
  });
}

// Healthcheck por GET.
export async function GET() {
  return Response.json({ ok: true, endpoint: 'fathom webhook', usage: 'POST con headers webhook-id/webhook-timestamp/webhook-signature' });
}
