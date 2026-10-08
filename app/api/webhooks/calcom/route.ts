// =============================================================================
// Webhook: Cal.com → leads
// =============================================================================
// El hermano de /api/webhooks/calendly, y hace falta porque son DOS PRODUCTOS
// distintos. Un cliente real (ws13, Código Inmobiliario) vende por una agenda de
// Cal.com embebida en su landing: se agendó en vivo y MaKo no registró nada —
// ni el evento ni el lead— porque no había por dónde entrar.
//
// ⚠️ EL MISMO ORDEN QUE CALENDLY, Y POR EL MISMO MOTIVO:
//   parsear → resolver workspace → verificar la firma CON LA KEY DE ESE WORKSPACE.
// Verificar primero contra un secreto GLOBAL abre una vía de escritura
// cross-tenant: el secreto lo elige quien crea el webhook y se le pide al cliente
// que lo comparta, así que con ese secreto y el slug del event type de otro
// inquilino —que es público en su página de reservas— se podrían forjar reservas
// que le escriben leads a la víctima. Parsear antes de verificar es seguro: el
// JSON sin firmar solo elige CONTRA QUÉ KEY validar.
//
// La lógica de negocio NO se duplica: se normaliza la reserva y de ahí en
// adelante se llama a las MISMAS funciones que usa Calendly (upsertLeadFromCalendly,
// setFechaJunta2, cancelarJuntaEnLead). Dos caminos que escriben leads distinto
// son dos CRMs.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  verifyCalcomSignature,
  normalizarReserva,
  clasificarJuntaCalcom,
  accionDeTrigger,
  CalcomSignatureError,
  type CalcomWebhookPayload,
} from '@/lib/calcom';
import { isoToFechaTijuana } from '@/lib/calendly';
import {
  upsertLeadFromCalendly,
  findLeadByContacto,
  setFechaJunta2,
  cancelarJuntaEnLead,
} from '@/lib/leads';
import { hoyEnTijuana } from '@/lib/date-utils';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { emitirDelCatalogo } from '@/lib/avisos';
import { linkResumenLead } from '@/lib/lead-resumen';
import { dispararEvento } from '@/lib/flujos';
import { runWithWorkspace } from '@/lib/workspace';
import { credWsEstricta } from '@/lib/credenciales';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';

export const dynamic = 'force-dynamic';

/** Igual que en Calendly: la hora se muestra en la zona del INQUILINO, no en la del dueño. */
function fmtFechaHoraLocal(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric' }).format(d).replace(',', '');
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${fecha} a las ${hora}`;
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const rawBody = await request.text();
  const firma = request.headers.get('x-cal-signature-256');

  // 1) Parsear sin confiar. `JSON.parse('null')` no lanza: devuelve null, y leer
  //    `.payload` de ahí sería un 500 sin autenticar.
  let body: CalcomWebhookPayload;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as CalcomWebhookPayload;
  } catch {
    return Response.json({ ok: false, error: 'bad_json', message: 'Body no es JSON válido' }, { status: 400 });
  }

  const reserva = normalizarReserva(body.payload);

  // 2) Resolver el workspace por el event type. Se prueban los TRES identificadores
  //    —id, slug y nombre— porque en `webhook_routing` queda el que el dueño pegó
  //    en la configuración, y no siempre es el mismo. Fail-CLOSED: sin mapeo no se
  //    toca un solo dato, nunca cae al dueño.
  //
  //    ⚠️ «NO PUDE LEER» NO ES «NO ESTÁ MAPEADO» (07/10/2026, el molde es Calendly). Con
  //    `wsPorIdentificador`, que no lee el `error` de supabase-js, la base caída daba null y la
  //    reserva de un cliente caía en «sin workspace» → 200 y perdida. Cal.com NO reintenta nunca,
  //    así que el código que se conteste no la recupera: lo que cambia es que queda ANOTADA
  //    (`webhooks.fallos_ruteo`, ver lib/webhook-fallo-ruteo.ts) en vez de leerse como «no es de
  //    nadie». Y el tope de largo, porque esto corre antes de la firma: un identificador de 20 KB
  //    armaría una URL que falla siempre, una anotación por cada pedido sin firmar.
  const candidatos = [reserva?.eventType.id, reserva?.eventType.slug, reserva?.eventType.nombre]
    .filter((c): c is string => !!c && c.trim() !== '' && c.length <= 300);
  let ws: number | null = null;
  try {
    for (const c of candidatos) {
      const r = await wsPorIdentificadorEstricto('calcom', c);
      if (r != null) { ws = r; break; }
    }
  } catch (err) {
    return responderFalloDeRuteo('calcom', err, candidatos[0]);
  }

  // 3) Verificar la firma con la key DE ESE workspace.
  //
  //    ⚠️ SIN FALLBACK A UN SECRETO DE PLATAFORMA, a diferencia de Calendly. Ese
  //    fallback existe allá por compatibilidad con lo que se hacía antes, y su
  //    propio comentario dice que mientras se use, dos inquilinos comparten
  //    secreto y la vía de forja sigue abierta para ellos. Esta integración nace
  //    hoy: no tiene historia que arrastrar, así que nace cerrada.
  //
  //    Y se verifica ANTES de contestar «no te conozco»: si acá se cortara por
  //    falta de ruteo, el código de respuesta delataría qué event types están
  //    dados de alta (200 = no, 401 = sí) y se podría enumerar la cartera de
  //    clientes mandando payloads sin firmar.
  //
  //    La key se lee ESTRICTA por lo mismo: con `credWs`, una base caída daba null y la firma de
  //    un negocio con su key cargada daba 401 «firma rechazada», que manda a revisar un secreto
  //    que está bien.
  let key: string | null;
  try {
    key = ws == null ? null : await credWsEstricta('CALCOM_WEBHOOK_SECRET', ws);
  } catch (err) {
    return responderFalloDeRuteo('calcom', err, candidatos[0]);
  }
  try {
    verifyCalcomSignature(rawBody, firma, key ?? '');
  } catch (err) {
    if (err instanceof CalcomSignatureError) {
      console.warn(`[webhook:calcom] firma rechazada (ws ${ws ?? '—'}): ${err.message}`);
      return Response.json({ ok: false, error: 'signature', message: err.message }, { status: 401 });
    }
    throw err;
  }

  if (ws == null) {
    console.warn(`[webhook:calcom] sin workspace para event_type=${candidatos[0] ?? '—'} trigger=${body.triggerEvent} — ignorado`);
    return Response.json({ ok: true, trigger: body.triggerEvent, ignored: 'sin workspace' });
  }
  if (!reserva) {
    return Response.json({ ok: false, error: 'no_payload', trigger: body.triggerEvent }, { status: 400 });
  }

  const accion = accionDeTrigger(body.triggerEvent);
  // MEETING_ENDED y todo lo que no sea agenda/cancela se acusa recibo y se ignora:
  // reintentar algo que nunca vamos a procesar solo llena el log del cliente.
  if (accion == null || accion === 'termina') {
    return Response.json({ ok: true, trigger: body.triggerEvent, ignored: 'trigger sin acción' });
  }

  return runWithWorkspace(ws, async () => {
    const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
    const ms = Date.now() - t0;

    try {
      // ESTRICTAS y adentro del try: con `credWs` y la base caída, J1 y J2 daban null, una R2 se
      // clasificaba como R1 y CREABA un lead —justo lo que «una R2 nunca crea un lead» prohíbe—.
      const cfg = {
        j1: await credWsEstricta('CALCOM_EVENT_TYPE_J1', ws),
        j2: await credWsEstricta('CALCOM_EVENT_TYPE_J2', ws),
      };
      const tipo = clasificarJuntaCalcom(reserva.eventType, cfg);
      // ── CANCELACIÓN ───────────────────────────────────────────────────────
      if (accion === 'cancela') {
        const lead = await findLeadByContacto(reserva.email, reserva.telefono);
        if (!lead) {
          console.warn(`[webhook:calcom] cancelación sin lead email=${reserva.email ?? '—'} uid=${reserva.uid}`);
          return Response.json({ ok: true, trigger: body.triggerEvent, ignored: 'sin lead' });
        }
        if (!reserva.inicio) {
          return Response.json({ ok: false, error: 'incomplete_payload', missing: { startTime: true } }, { status: 400 });
        }
        // Con el instante, como en Calendly: la fecha sola borra la reunión nueva de una reagenda
        // del mismo día (`juntaACancelar`, lib/recordatorio-lead.ts).
        const detalle = await cancelarJuntaEnLead(lead, isoToFechaTijuana(reserva.inicio), hoyEnTijuana(), reserva.inicio);
        console.log(`[webhook:calcom] cancelación lead=${lead.id}: ${detalle} ms=${ms}`);
        return Response.json({ ok: true, trigger: body.triggerEvent, action: 'cancelar', lead_id: lead.id, detalle, ms });
      }

      // ── AGENDA ────────────────────────────────────────────────────────────
      if (!reserva.inicio) {
        return Response.json({ ok: false, error: 'incomplete_payload', missing: { startTime: true } }, { status: 400 });
      }
      // Clave de cohorte persistida, NO display: queda en TJ a propósito. El porqué
      // está en el JSDoc de isoToFechaTijuana — y se migra escritura y lectura en el
      // mismo commit, o no se migra.
      const fechaReunion = isoToFechaTijuana(reserva.inicio);

      // ⚠️ UNA R2 NUNCA CREA UN LEAD. Si es la segunda reunión, esa persona ya tiene
      // que existir: crearla desde acá produciría un lead que nació en la mitad del
      // embudo, sin R1 y sin origen. Es la misma regla que en Calendly.
      if (tipo === 'j2') {
        const lead = await findLeadByContacto(reserva.email, reserva.telefono);
        if (!lead) {
          console.warn(`[webhook:calcom] J2 SIN MATCH email=${reserva.email ?? '—'} uid=${reserva.uid} ms=${ms}`);
          return Response.json({ ok: true, trigger: body.triggerEvent, tipo: 'j2', action: 'sin_match', ms });
        }
        await setFechaJunta2(lead.id, fechaReunion, reserva.inicio);
        await emitirDelCatalogo('reunion-nuevo-agendado', {
          // ⚠️ Dedup POR RESERVA. Los webhooks se reentregan y el mismo agendado
          // salía 2 y 3 veces (medido: 9 s, 25 s, 38 s y 41 s de diferencia). La
          // clave lleva el HORARIO además del uid: un reintento trae los dos
          // iguales, y un REAGENDADO cambia el horario — o sea que ese sí avisa.
          dedupTtlMin: 180, dedupKey: `calcom:${reserva.uid ?? reserva.email}|${reserva.inicio}`,
          texto: `🎯 *Nuevo agendado*: ${lead.nombre} reservó una *R2 para el ${fmtFechaHoraLocal(reserva.inicio, tz)}*.\n\n👉 Mira el resumen del lead:\n${linkResumenLead(lead.id, ws)}\n\n— MaKo`,
        });
        // La MISMA clave que el aviso de arriba: Cal.com reentrega, y una reentrega no repite los pasos.
        await dispararEvento('lead.agendo', { ws, leadId: lead.id, leadNombre: lead.nombre, reunion: 'R2', dedupKey: `calcom:${reserva.uid ?? reserva.email}|${reserva.inicio}` });
        console.log(`[webhook:calcom] J2 → lead=${lead.id} fecha=${fechaReunion} ms=${ms}`);
        return Response.json({ ok: true, trigger: body.triggerEvent, tipo: 'j2', action: 'set_j2', lead_id: lead.id, ms });
      }

      // R1 (o desconocido, que se trata como R1 por compatibilidad con Calendly).
      //
      // ⚠️ SIN EMAIL NO HAY LEAD, y no es un capricho: `upsertLeadFromCalendly`
      // deduplica por email. Cal.com siempre lo pide, pero un event type mal
      // configurado podría no traerlo, y crear un lead sin forma de contacto es
      // crear una tarjeta con la que nadie puede hacer nada.
      if (!reserva.email) {
        console.warn(`[webhook:calcom] reserva sin email uid=${reserva.uid} — ignorada`);
        return Response.json({ ok: false, error: 'incomplete_payload', missing: { email: true } }, { status: 400 });
      }

      const { lead, created } = await upsertLeadFromCalendly({
        email: reserva.email,
        nombre: reserva.nombre ?? reserva.email,
        // Cuándo AGENDÓ, no cuándo es la reunión. Sin `createdAt` en el sobre se
        // usa el instante de la reserva: es lo más cercano y no inventa nada.
        fecha_agenda: isoToFechaTijuana(body.createdAt ?? new Date().toISOString()),
        fecha_junta_1: fechaReunion,
        junta_1_at: reserva.inicio,
        telefono: reserva.telefono,
        // De qué agenda vino, para que la ficha y el reporte de origen no le
        // atribuyan la venta a una herramienta que este cliente no usa.
        origen_lead: 'calcom',
      });

      await emitirDelCatalogo('reunion-nuevo-agendado', {
        // Ver la nota de la R2: dedup por reserva + horario.
        dedupTtlMin: 180, dedupKey: `calcom:${reserva.uid ?? reserva.email}|${reserva.inicio}`,
        texto: `🎯 *Nuevo agendado*: ${reserva.nombre ?? reserva.email} reservó una *R1 para el ${fmtFechaHoraLocal(reserva.inicio, tz)}*.\n\n👉 Mira el resumen del lead:\n${linkResumenLead(lead.id, ws)}\n\n— MaKo`,
      });
      await dispararEvento('lead.agendo', { ws, leadId: lead.id, leadNombre: reserva.nombre ?? reserva.email, reunion: 'R1', dedupKey: `calcom:${reserva.uid ?? reserva.email}|${reserva.inicio}` });

      console.log(`[webhook:calcom] R1 → lead=${lead.id} ${created ? 'creado' : 'actualizado'} fecha=${fechaReunion} ms=${ms}`);
      return Response.json({ ok: true, trigger: body.triggerEvent, tipo, action: created ? 'crear' : 'actualizar', lead_id: lead.id, ms });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[webhook:calcom] error procesando ${body.triggerEvent}: ${message}`);
      return Response.json({ ok: false, error: 'processing', message }, { status: 500 });
    }
  });
}
