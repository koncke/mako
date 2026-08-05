// =============================================================================
// Webhook: Calendly → leads
// =============================================================================
// Endpoint público (no requiere CRON_SECRET) que recibe webhooks de Calendly.
// Seguridad: verifica firma HMAC-SHA256 con CALENDLY_WEBHOOK_SIGNING_KEY.
//
// Eventos manejados:
//   - invitee.created   → upsert lead (decisión 2026-05-31)
//   - invitee.canceled  → ignorado por ahora (MVP: marca manual)
//   - cualquier otro    → 200 OK con `ignored: true`
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  verifyCalendlySignature,
  isoToFechaTijuana,
  extractAnswer,
  extractRespuestaPorFrase,
  clasificarJunta,
  CalendlySignatureError,
  type CalendlyWebhookPayload,
} from '@/lib/calendly';
import {
  upsertLeadFromCalendly,
  findLeadByContacto,
  setFechaJunta2,
  cancelarJuntaEnLead,
  saveLeadRespuestas,
} from '@/lib/leads';
import { enqueueJ2SinMatch } from '@/lib/review-queue';
import { ensureContactoWhatsapp } from '@/lib/chatwoot';
import { hoyEnTijuana } from '@/lib/date-utils';
import { sendMetaCAPIEvent } from '@/lib/meta-capi';
import { emitirDelCatalogo } from '@/lib/avisos';
import { dispararEvento } from '@/lib/flujos';
import { enrolarPorEvento } from '@/lib/nutricion';
import { runWithWorkspace } from '@/lib/workspace';
import { credWs, envCred } from '@/lib/credenciales';
import { wsPorIdentificador } from '@/lib/webhook-routing';

const KEYWORDS_TEL = ['tel', 'phone', 'celular', 'móvil', 'movil'];

// Formatea un ISO UTC como "jueves 16 a las 11:00" en zona Tijuana (es-MX), para
// la voz de los avisos al dueño.
function fmtFechaHoraTijuana(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Tijuana', weekday: 'long', day: 'numeric' }).format(d).replace(',', '');
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Tijuana', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${fecha} a las ${hora}`;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const tStart = Date.now();

  // ORDEN: parsear → resolver workspace → verificar firma CON LA KEY DE ESE
  // WORKSPACE. Antes se verificaba primero contra una signing key GLOBAL de
  // process.env, y eso abría una vía de ESCRITURA CROSS-TENANT: en Calendly la
  // signing key la elige quien crea la suscripción, y la ayuda de /integraciones le
  // pide al cliente que la comparta. Con esa key —y con el nombre del event type de
  // otro inquilino, que es público en su página de reservas— se podían forjar
  // eventos que entraban en runWithWorkspace(víctima) y le escribían leads, fechas
  // de junta, CAPI al píxel y nutrición.
  //
  // Parsear antes de verificar es seguro: el JSON sin firmar solo elige CONTRA QUÉ
  // KEY validar. Un payload forjado muere en la firma, porque la key que se prueba
  // es la del workspace que el propio payload nombra.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('calendly-webhook-signature');

  // 1) Parse JSON (todavía sin confiar en el contenido)
  let body: CalendlyWebhookPayload;
  try {
    body = JSON.parse(rawBody) as CalendlyWebhookPayload;
  } catch {
    return Response.json(
      { ok: false, error: 'bad_json', message: 'Body no es JSON válido' },
      { status: 400 },
    );
  }

  const ms = Date.now() - tStart;

  // 2) Resolver el workspace por el event type del scheduled_event — el MISMO
  //    campo que clasificarJunta usa para distinguir R1/R2. En webhook_routing el
  //    identificador de calendly es el valor EXACTO de CALENDLY_EVENT_TYPE_J1/J2,
  //    así que probamos event_type → name → uri contra el índice y tomamos el
  //    primero que resuelva (J1 y J2 del mismo cliente apuntan al mismo ws).
  //    Fail-CLOSED: sin mapeo, NO tocamos datos (nunca cae al dueño). Esto corta
  //    que el Schedule de un cliente vaya al píxel/CRM del dueño.
  const scheduled = body.payload?.scheduled_event;
  const candidatosWs = [scheduled?.event_type, scheduled?.name, scheduled?.uri].filter(
    (c): c is string => !!c && c.trim() !== '',
  );
  let ws: number | null = null;
  for (const c of candidatosWs) {
    const r = await wsPorIdentificador('calendly', c);
    if (r != null) { ws = r; break; }
  }
  if (ws == null) {
    console.warn(`[webhook:calendly] sin workspace para event_type=${candidatosWs[0] ?? '—'} evento=${body.event} — ignorado`);
    return Response.json({ ok: true, event: body.event, ignored: 'sin workspace' });
  }

  // 3) Verificar la firma con la key DE ESE workspace. Sin la suya cargada se cae a
  //    la de plataforma (compatibilidad con lo que hacía antes para todos), pero
  //    mientras se use ese fallback dos inquilinos comparten secreto y la vía de
  //    forja sigue abierta para ellos. Vaciar el fallback = cerrarla del todo.
  const keyWs = await credWs('CALENDLY_WEBHOOK_SIGNING_KEY', ws);
  const signingKey = keyWs ?? (await envCred('CALENDLY_WEBHOOK_SIGNING_KEY'));
  if (!keyWs) {
    console.warn(`[webhook:calendly] ws ${ws} sin CALENDLY_WEBHOOK_SIGNING_KEY propia — usando la de plataforma`);
  }
  try {
    verifyCalendlySignature(rawBody, signatureHeader, signingKey ?? '');
  } catch (err) {
    if (err instanceof CalendlySignatureError) {
      console.warn(`[webhook:calendly] firma rechazada (ws ${ws}): ${err.message}`);
      return Response.json(
        { ok: false, error: 'signature', message: err.message },
        { status: 401 },
      );
    }
    throw err;
  }

  // 4) Dispatch por tipo de evento — TODO confinado al workspace resuelto.
  return runWithWorkspace(ws, async () => {
   // Config de clasificación R1/R2 POR WORKSPACE (dueño → env; cliente → su fila).
   const cfgJuntas = {
     j1: await credWs('CALENDLY_EVENT_TYPE_J1', ws),
     j2: await credWs('CALENDLY_EVENT_TYPE_J2', ws),
   };
   switch (body.event) {
    case 'invitee.created': {
      const payload = body.payload;
      if (!payload) {
        return Response.json(
          { ok: false, error: 'no_payload', event: body.event },
          { status: 400 },
        );
      }

      // ── Ruteo J1/J2 (Fase 10) ──
      const tipoJunta = clasificarJunta(payload.scheduled_event, cfgJuntas);
      if (tipoJunta === 'j2') {
        const emailJ2 = payload.email?.trim() || null;
        const nombreJ2 = (payload.name || `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim()).trim() || null;
        const telefonoJ2 = extractAnswer(payload.questions_and_answers, KEYWORDS_TEL);
        const startTimeIso = payload.scheduled_event?.start_time;
        if (!startTimeIso) {
          return Response.json(
            { ok: false, error: 'incomplete_payload', missing: { start_time: true }, tipo: 'j2' },
            { status: 400 },
          );
        }
        try {
          const fechaJ2 = isoToFechaTijuana(startTimeIso);
          const lead = await findLeadByContacto(emailJ2, telefonoJ2);
          if (lead) {
            // NUNCA crear desde una J2: solo seteamos fecha_junta_2 del lead existente.
            await setFechaJunta2(lead.id, fechaJ2, startTimeIso);
            // El form de la R2 tiene sus propias respuestas: se guardan POR reunión
            // (antes se descartaban — solo existían columnas para el set de R1).
            await saveLeadRespuestas(lead.id, 'R2', payload.questions_and_answers, fechaJ2);
            // Aviso al dueño: el lead agendó su R2 (best-effort, no bloquea).
            await emitirDelCatalogo('reunion-nuevo-agendado', {
              texto: `🎯 *Nuevo agendado*: ${lead.nombre} reservó una *R2 para el ${fmtFechaHoraTijuana(startTimeIso)}*. Ya quedó en su ficha del CRM. — MaKo`,
            });
            // Flujos configurados por el dueño: disparar 'lead.agendo' (R2).
            await dispararEvento('lead.agendo', { leadId: lead.id, leadNombre: lead.nombre, reunion: 'R2' });
            console.log(`[webhook:calendly] J2 → lead id=${lead.id} email=${emailJ2 ?? '—'} fecha_j2=${fechaJ2} ms=${ms}`);
            return Response.json({ ok: true, event: body.event, tipo: 'j2', action: 'set_j2', lead_id: lead.id, ms });
          }
          // Sin match: a la cola de revisión manual (tab Hoy).
          await enqueueJ2SinMatch({
            email: emailJ2,
            nombre: nombreJ2,
            fecha_evento: fechaJ2,
            payload_resumen: { email: emailJ2, nombre: nombreJ2, start_time: startTimeIso, event_type: payload.scheduled_event?.event_type ?? payload.scheduled_event?.name ?? null },
          });
          console.warn(`[webhook:calendly] J2 SIN MATCH → review_queue email=${emailJ2 ?? '—'} fecha_j2=${fechaJ2} ms=${ms}`);
          return Response.json({ ok: true, event: body.event, tipo: 'j2', action: 'review_queue', ms });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[webhook:calendly] error procesando J2: ${message}`);
          return Response.json({ ok: false, error: 'processing', message, tipo: 'j2' }, { status: 500 });
        }
      }
      // tipoJunta 'j1' o 'desconocido' → flujo actual sin cambios.

      const email = payload.email?.trim();
      const nombre = (payload.name || `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim()).trim();
      const createdAtIso = payload.created_at;
      const startTimeIso = payload.scheduled_event?.start_time;

      if (!email || !nombre || !createdAtIso || !startTimeIso) {
        return Response.json(
          {
            ok: false,
            error: 'incomplete_payload',
            missing: {
              email: !email,
              nombre: !nombre,
              created_at: !createdAtIso,
              start_time: !startTimeIso,
            },
          },
          { status: 400 },
        );
      }

      try {
        const fechaAgenda = isoToFechaTijuana(createdAtIso);
        const fechaJ1 = isoToFechaTijuana(startTimeIso);
        const empresa = extractAnswer(payload.questions_and_answers, ['empresa', 'company', 'organiz']);
        const telefono = extractAnswer(payload.questions_and_answers, ['tel', 'phone', 'celular', 'móvil', 'movil']);

        // Respuestas de calificación (Fase B v3): mapeo por FRASE DISTINTIVA,
        // no keyword suelta. Antes "equipo" cruzaba inversión↔colaboradores.
        // extractRespuestaPorFrase elige la coincidencia más larga/específica.
        const qa = payload.questions_and_answers;
        const respuesta_objetivo = extractRespuestaPorFrase(qa, [
          'qué quieres lograr', 'que quieres lograr', 'qué querés lograr', 'que queres lograr',
        ]);
        const respuesta_inversion = extractRespuestaPorFrase(qa, [
          'posibilidad de invertir', 'invertir para superar',
        ]);
        const respuesta_colaboradores = extractRespuestaPorFrase(qa, [
          'cuántos colaboradores', 'cuantos colaboradores', 'colaboradores tienes actualmente', 'colaboradores tienes',
        ]);
        const respuesta_facturacion = extractRespuestaPorFrase(qa, [
          '20 millones', '$20', 'es tu caso',
        ]);
        const respuesta_decisor = extractRespuestaPorFrase(qa, [
          'participar en la decisión', 'participar en la decision', 'alguien más', 'alguien mas',
        ]);
        const respuesta_cuando_empezar = extractRespuestaPorFrase(qa, [
          'cuándo quieres empezar', 'cuando quieres empezar', 'cuándo querés empezar', 'cuando queres empezar',
        ]);

        // UTMs — vienen de la landing (Lovable) que los pasa al booking de
        // Calendly. Calendly los re-emite en payload.tracking. Si el lead es
        // orgánico, tracking puede no venir o venir vacío — todos NULL.
        const tracking = payload.tracking;
        const utm_source = tracking?.utm_source?.trim() || null;
        const utm_medium = tracking?.utm_medium?.trim() || null;
        const utm_campaign = tracking?.utm_campaign?.trim() || null;
        const utm_content = tracking?.utm_content?.trim() || null;
        // utm_term transporta el UUID anónimo de la landing (cookie
        // nqe_visitor_id) — cruza al lead con sus eventos de VSL (Fase 6).
        const visitor_id = tracking?.utm_term?.trim() || null;

        const { created, lead } = await upsertLeadFromCalendly({
          email,
          nombre,
          fecha_agenda: fechaAgenda,
          fecha_junta_1: fechaJ1,
          junta_1_at: startTimeIso,   // ISO con hora → No Show preciso (crm-auto T1)
          empresa,
          telefono,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          respuesta_facturacion,
          respuesta_colaboradores,
          respuesta_objetivo,
          respuesta_cuando_empezar,
          respuesta_inversion,
          respuesta_decisor,
          visitor_id,
        });

        // Set de respuestas de la R1 por reunión (las columnas del lead quedan
        // como legacy/compat; la ficha lee lead_respuestas primero).
        await saveLeadRespuestas(lead.id, 'R1', qa, fechaJ1);

        // Alta del chat: contacto + conversación en Chatwoot (silencioso) para
        // que el lead nuevo tenga su hilo de WhatsApp desde el día cero.
        if (created && lead.telefono) {
          await ensureContactoWhatsapp(lead.nombre, lead.telefono);
        }

        console.log(
          `[webhook:calendly] ${created ? 'INSERT' : 'UPDATE'} lead id=${lead.id} email=${email} fecha_j1=${fechaJ1} utm_campaign=${utm_campaign ?? '—'} ms=${ms}`,
        );

        // CAPI: evento "Schedule" server-side (la verdad del agendamiento) para
        // que Meta optimice sobre reservas reales. event_id determinístico por
        // reserva (email + hora de inicio) → deduplica reintentos y permite
        // deduplicar con el pixel del navegador si éste envía el mismo id.
        await sendMetaCAPIEvent({
          eventName: 'Schedule',
          email,
          phone: telefono,
          actionSource: 'website',
          eventId: `schedule:${email.toLowerCase()}:${startTimeIso}`,
          customData: {
            lead_type: 'agenda_j1',
            ...(utm_campaign ? { utm_campaign } : {}),
          },
        });

        // Aviso al dueño: nuevo lead que agendó una R1 (best-effort, no bloquea).
        const anuncio = utm_campaign ? ` Vino del anuncio "${utm_campaign}".` : '';
        await emitirDelCatalogo('reunion-nuevo-agendado', {
          texto: `🎯 *Nuevo agendado*: ${nombre} reservó una *R1 para el ${fmtFechaHoraTijuana(startTimeIso)}*.${anuncio} La ficha ya quedó armada en el CRM. — MaKo`,
        });
        // Flujos configurados por el dueño: disparar 'lead.agendo' (R1).
        await dispararEvento('lead.agendo', { leadId: lead.id, leadNombre: nombre, reunion: 'R1' });
        // Nutrición de preparación (reunión 31/07): el audio de bienvenida sale
        // al toque de agendar — es la palanca contra el no-show del 45%.
        await enrolarPorEvento(lead.id, 'agenda_nueva');

        return Response.json({
          ok: true,
          event: body.event,
          action: created ? 'created' : 'updated',
          lead_id: lead.id,
          ms,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[webhook:calendly] error procesando invitee.created: ${message}`);
        return Response.json(
          { ok: false, error: 'processing', message, event: body.event },
          { status: 500 },
        );
      }
    }

    case 'invitee.canceled': {
      const payload = body.payload;
      if (!payload) {
        return Response.json({ ok: true, event: body.event, ignored: true, reason: 'sin payload' });
      }
      try {
        const email = payload.email?.trim() || null;
        const telefono = extractAnswer(payload.questions_and_answers, KEYWORDS_TEL);
        const startTimeIso = payload.scheduled_event?.start_time;
        const lead = await findLeadByContacto(email, telefono);
        if (!lead || !startTimeIso) {
          console.log(`[webhook:calendly] cancelación sin lead/fecha (email=${email ?? '—'}) — ignorada`);
          return Response.json({ ok: true, event: body.event, ignored: true, reason: 'sin match o sin fecha' });
        }
        const fechaCancelada = isoToFechaTijuana(startTimeIso);
        const cambio = await cancelarJuntaEnLead(lead, fechaCancelada, hoyEnTijuana());
        // Aviso al dueño: reunión cancelada → sugerir reagendar (best-effort).
        const tipoCancelada = clasificarJunta(payload.scheduled_event, cfgJuntas) === 'j2' ? 'R2' : 'R1';
        await emitirDelCatalogo('reunion-cancelada', {
          texto: `🔄 *Se canceló* la ${tipoCancelada} con ${lead.nombre} que era para el ${fmtFechaHoraTijuana(startTimeIso)} y todavía no reagendó. ¿Le mando un WhatsApp para conseguir otro horario antes de que se enfríe? — MaKo`,
        });
        // Flujos configurados por el dueño: disparar 'lead.cancelo'.
        await dispararEvento('lead.cancelo', { leadId: lead.id, leadNombre: lead.nombre, reunion: tipoCancelada });
        console.log(`[webhook:calendly] cancelación lead id=${lead.id} fecha=${fechaCancelada}: ${cambio} ms=${ms}`);
        return Response.json({ ok: true, event: body.event, lead_id: lead.id, cambio, ms });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[webhook:calendly] error procesando cancelación: ${message}`);
        return Response.json({ ok: false, error: 'processing', message, event: body.event }, { status: 500 });
      }
    }

    default:
      console.log(`[webhook:calendly] evento no manejado: ${body.event}`);
      return Response.json({ ok: true, event: body.event, ignored: true });
   }
  });
}

// Healthcheck simple por GET (útil para probar que el endpoint existe)
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: 'calendly webhook',
    usage: 'POST con header Calendly-Webhook-Signature',
  });
}
