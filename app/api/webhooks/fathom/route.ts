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

import { after, type NextRequest } from 'next/server';
import { verifyFathomSignature, externalInvitee, inviteeSpoke, webhookDurationMin, FathomSignatureError, type FathomWebhookPayload } from '@/lib/fathom';
import { findLeadByContacto, applyFathomRecording } from '@/lib/leads';
import { isoToFechaTijuana } from '@/lib/calendly';
import { emitirDelCatalogo } from '@/lib/avisos';
import { dispararEvento } from '@/lib/flujos';
import { runWithWorkspace } from '@/lib/workspace';
import { wsPorIdentificador } from '@/lib/webhook-routing';
import { credWs, envCred } from '@/lib/credenciales';
import { redactarFollowUpPostLlamada } from '@/lib/post-llamada';

export const dynamic = 'force-dynamic';
// El follow-up post-llamada (Closing Analyst + redacción con Claude) corre en
// background con after(); necesita margen más allá de la respuesta al webhook.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const tStart = Date.now();
  const rawBody = await request.text();

  // ORDEN: parsear → resolver workspace → verificar firma CON EL SECRETO DE ESE
  // WORKSPACE. Antes se verificaba primero contra un secreto GLOBAL de process.env,
  // y eso tenía un efecto que nadie veía: cada cliente registra el webhook en SU
  // cuenta de Fathom y recibe SU propio `whsec_`, que jamás se leía. Su webhook
  // devolvía 401 el 100% de las veces mientras la UI se lo pintaba en verde.
  //
  // Parsear antes de verificar es seguro: el JSON sin firmar solo se usa para elegir
  // CONTRA QUÉ SECRETO validar. Un payload forjado sigue muriendo en la firma, porque
  // el secreto que se prueba es el del workspace que el propio payload nombra.

  // 1) Parsear (todavía sin confiar en el contenido)
  let body: FathomWebhookPayload;
  try { body = JSON.parse(rawBody) as FathomWebhookPayload; }
  catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  // 2) Resolver el workspace por el email de la cuenta que grabó (recorded_by).
  //    Fail-CLOSED: sin mapeo (webhook_routing), NO tocamos datos — nunca cae al
  //    dueño (evita matchear la grabación de un cliente contra leads ajenos).
  const hostEmail = body.recorded_by?.email ?? null;
  const ws = await wsPorIdentificador('fathom', hostEmail);

  // 3) Verificar la firma con el secreto DE ESE workspace. Si el workspace no tiene
  //    el suyo cargado, se cae al de plataforma (compatibilidad: es lo que hacía
  //    antes para todos). Ese fallback es el que hay que ir vaciando: mientras se
  //    use, dos inquilinos comparten secreto.
  //
  //    Sin workspace se verifica igual, contra el de plataforma, y RECIÉN DESPUÉS se
  //    ignora. Parece redundante y no lo es: si acá se cortara antes de la firma, el
  //    código de respuesta delataría qué emails están dados de alta (200 = no está,
  //    401 = sí está) y cualquiera podría enumerar la cartera de clientes mandando
  //    payloads sin firmar. Verificando siempre, un request sin firma válida recibe
  //    401 sin importar a quién nombre.
  const secretWs = ws == null ? null : await credWs('FATHOM_WEBHOOK_SECRET', ws);
  const secret = secretWs ?? (await envCred('FATHOM_WEBHOOK_SECRET'));
  if (ws != null && !secretWs) {
    console.warn(`[webhook:fathom] ws ${ws} sin FATHOM_WEBHOOK_SECRET propio — usando el de plataforma`);
  }
  try {
    verifyFathomSignature(
      rawBody,
      {
        id: request.headers.get('webhook-id'),
        timestamp: request.headers.get('webhook-timestamp'),
        signature: request.headers.get('webhook-signature'),
      },
      secret ?? '',
    );
  } catch (err) {
    if (err instanceof FathomSignatureError) {
      console.warn(`[webhook:fathom] firma rechazada (ws ${ws ?? '—'}): ${err.message}`);
      return Response.json({ ok: false, error: 'signature', message: err.message }, { status: 401 });
    }
    throw err;
  }

  // Firma válida pero sin ruteo: 200 para que Fathom no reintente eternamente algo
  // que nunca vamos a poder atribuir. Fail-CLOSED igual — no se toca un solo dato.
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

      // sc18_2 — Post-llamada: MaKo analiza la charla (Closing Analyst) y deja el
      // follow-up como BORRADOR de WhatsApp para el setter — nunca envío automático
      // directo a un lead caliente (regla anti-ban). En background con after():
      // el análisis con Claude tarda más que el timeout de reintento de Svix, así
      // que respondemos 200 ya y el trabajo sigue hasta maxDuration. Si el lead
      // no asistió (attended=false), no hay charla que seguir: lo cubre la
      // nutrición de no-show.
      if (attended !== false) {
        const shareUrl = body.share_url ?? null;
        after(() => runWithWorkspace(ws, async () => {
          try {
            const r = await redactarFollowUpPostLlamada(lead.id, shareUrl, reunion);
            console.log(`[webhook:fathom] follow-up post-llamada lead=${lead.id}: ${r.creado ? 'borrador creado' : `no (${r.motivo})`}`);
          } catch (err2) {
            console.error(`[webhook:fathom] follow-up post-llamada lead=${lead.id} falló: ${err2 instanceof Error ? err2.message : String(err2)}`);
          }
        }));
      }
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
