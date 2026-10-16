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
// Y desde el 16/10/2026 también le avisa al PLAN: dispara la lectura de esa reunión (la misma del
// cron de cada hora, lib/reunion-auto.ts) para que el borrador aparezca al terminar la junta.
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
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta, envCred } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { redactarFollowUpPostLlamada } from '@/lib/post-llamada';
import { textoAvisoPostLlamada } from '@/lib/lead-resumen';
import { datosPostLlamada } from '@/lib/reunion-grabada';
import { esGrabacionDeEntrega } from '@/lib/insights-llamada-reparto';
import { procesarReunionesNuevas } from '@/lib/reunion-auto';
import { wsEnLaRonda } from '@/lib/cron-workspaces';

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
  // El chequeo de objeto NO es de más: `JSON.parse('null')` no lanza, devuelve null, y
  // el optional chaining de abajo protege el segundo nivel pero no el primero
  // (`body.recorded_by` sobre null tira TypeError → 500 sin autenticar). Antes era
  // inalcanzable porque la firma mataba el request primero.
  let body: FathomWebhookPayload;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as FathomWebhookPayload;
  } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  // 2) Resolver el workspace por el email de la cuenta que grabó (recorded_by).
  //    Fail-CLOSED: sin mapeo (webhook_routing), NO tocamos datos — nunca cae al
  //    dueño (evita matchear la grabación de un cliente contra leads ajenos).
  //
  //    ⚠️ «NO PUDE LEER» NO ES «NO ESTÁ MAPEADO» (07/10/2026, el molde es Calendly). Con
  //    `wsPorIdentificador`, que no lee el `error` de supabase-js, la base caída daba null y la
  //    grabación de un cliente caía en «sin workspace» → 200 y perdida. Fathom entrega por Svix,
  //    que reintenta durante días y DESHABILITA el endpoint si falla 5 días seguidos: por eso el
  //    fallo pasa por el clasificador —503 sólo si reintentar lo arregla— y queda anotado
  //    (lib/webhook-fallo-ruteo.ts). Con el tope de largo: esto corre antes de la firma.
  const hostEmail = body.recorded_by?.email && body.recorded_by.email.length <= 300 ? body.recorded_by.email : null;
  let ws: number | null;
  try {
    ws = await wsPorIdentificadorEstricto('fathom', hostEmail);
  } catch (err) {
    return responderFalloDeRuteo('fathom', err, hostEmail);
  }

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
  //
  //    El secreto se lee ESTRICTO por lo mismo: con `credWs`, una base caída daba null, se caía al
  //    de plataforma y la firma de un negocio con secreto propio daba 401 — un no-2xx que Svix
  //    cuenta, con un mensaje que culpa a la firma.
  let secretWs: string | null;
  try {
    secretWs = ws == null ? null : await credWsEstricta('FATHOM_WEBHOOK_SECRET', ws);
  } catch (err) {
    return responderFalloDeRuteo('fathom', err, hostEmail);
  }
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

  // 3') EL PLAN SE ENTERA AL TERMINAR LA REUNIÓN (16/10/2026, «Fathom sin fricción»). Hasta ese día
  //     las tareas de una reunión las sacaba sólo el cron de cada hora (a los :40): entre que terminaba
  //     la junta y que el borrador aparecía podía pasar una hora entera. Este aviso de Fathom es
  //     justamente «terminó la reunión y ya está el contenido», así que dispara la MISMA lectura del
  //     cron (`procesarReunionesNuevas`), acotada a esta grabación: el clasificador decide si va al
  //     plan, el candado de lectura (lib/reunion-leyendo.ts) impide que el cron la lea otra vez, y lo
  //     descartado queda anotado igual que en el cron.
  //
  //     Va ANTES de matchear el lead y por su cuenta: una reunión de EQUIPO no tiene invitado
  //     externo ni lead, y el camino de abajo la ignora en la primera línea. En `after()`: Svix
  //     reintenta si la respuesta tarda, y una lectura son minutos. Comparte el maxDuration (300 s)
  //     con el follow-up de abajo; `hasta` es ese reloj.
  {
    const wsPlan = ws;
    const rid = Number(body.recording_id);
    const hasta = tStart + 280_000;
    after(() => runWithWorkspace(wsPlan, async () => {
      try {
        // La MISMA vara que el cron (`correrRonda`): activo y con Fathom conectado. Sin esto, un
        // workspace pausado o dado de baja recibía la lectura y el WhatsApp de «tareas al plan».
        if (!(await wsEnLaRonda('fathom', wsPlan))) {
          console.log(`[webhook:fathom] plan ws=${wsPlan}: no está activo o no tiene Fathom conectado — no se lee`);
          return;
        }
        const r = await procesarReunionesNuevas(wsPlan, { hasta, max: 1, ...(Number.isFinite(rid) && rid > 0 ? { soloRecording: rid } : {}) });
        console.log(`[webhook:fathom] plan ws=${wsPlan} recording=${Number.isFinite(rid) ? rid : '—'}: miradas=${r.miradas} alPlan=${r.alPlan} borradores=${r.conTareas} tareas=${r.tareas}${r.enCurso ? ` · ya la leía otro` : ''}`);
      } catch (e) {
        console.error(`[webhook:fathom] plan ws=${wsPlan}: la lectura falló (${e instanceof Error ? e.message : String(e)}) — la levanta el cron`);
      }
    }));
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

    // ⚠️ UNA SESIÓN DE ENTREGA NO ES UNA R2 (06/10/2026). Este era el ÚNICO escritor de las
    // «Reunión 2» de más: el fallback de abajo («R1 ya resuelta → es la R2») le ponía esa
    // etiqueta a CADA reunión de un cliente que ya había tenido su R2 — 45 links en 6
    // clientes del ws1, todos posteriores al cierre. Y por cada una, además, disparaba el
    // evento de R2, pagaba un análisis del Closing Analyst y le avisaba al dueño «Terminó la
    // R2». La grabación no se pierde: el sync del Closing Analyst la guarda en
    // `closing_analyses` con el lead, y Customer Success la muestra desde ahí.
    // La categoría todavía no existe acá (el análisis corre después), así que decide la fecha.
    if (esGrabacionDeEntrega({ fecha }, lead)) {
      console.log(`[webhook:fathom] lead id=${lead.id} sesión de ENTREGA (${fecha} > cierre ${lead.fecha_cierre}) — no es R2, no se engancha`);
      return Response.json({ ok: true, ignored: true, reason: 'sesion de entrega' });
    }
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

      // Flujos configurados por el dueño (editor de flujos): disparar 'reunion.ocurrio'.
      //
      // ⚠️ EL `ws` VA EXPLÍCITO, Y NO ALCANZA CON ESTAR ADENTRO DEL runWithWorkspace (06/10/2026).
      // `dispararEvento` NO lee el workspace del contexto: usa `ctx.ws` y vuelve a envolver con
      // ESE. Hasta ese día resolvía `ctx.ws ?? OWNER_WS`, así que sin el campo la grabación de un
      // cliente corría los flujos del ws1 —Mauricio, otro cliente— en SU grupo de MaKo, con el
      // nombre de un lead que no es suyo; hoy el tipo lo exige y sin él no corre nada. `ws` es el
      // que resolvió `recorded_by`, y es el mismo del lead: la búsqueda de arriba corre confinada
      // a él (getTenantDb dentro del runWithWorkspace).
      // Lo fija tests/flujos-ws-explicito.test.ts, que barre las ocho llamadas.
      await dispararEvento('reunion.ocurrio', { ws, leadId: lead.id, leadNombre: nombre, reunion });

      // sc18_2 — Post-llamada: MaKo analiza la charla (Closing Analyst) y deja el
      // follow-up como BORRADOR de WhatsApp para el setter — nunca envío automático
      // directo a un lead caliente (regla anti-ban). En background con after():
      // el análisis con Claude tarda más que el timeout de reintento de Svix, así
      // que respondemos 200 ya y el trabajo sigue hasta maxDuration. Si el lead
      // no asistió (attended=false), no hay charla que seguir: lo cubre la
      // nutrición de no-show.
      //
      // ⚠️ EL AVISO AL DUEÑO VA ADENTRO DE ESTE `after()`, DESPUÉS del análisis.
      // Antes salía acá arriba, en el mismo instante del webhook, y por eso decía
      // «ya tengo la grabación, ¿te paso el resumen y las objeciones?»: en ese
      // momento el análisis todavía no había corrido, así que no había resumen que
      // pasar y la pregunta no tenía a dónde ir — nadie escuchaba la respuesta.
      // Corrido acá, el mensaje ya puede DECIR el desenlace y linkear la pantalla.
      const shareUrl = body.share_url ?? null;
      after(() => runWithWorkspace(ws, async () => {
        if (attended !== false) {
          try {
            const r = await redactarFollowUpPostLlamada(lead.id, shareUrl, reunion);
            console.log(`[webhook:fathom] follow-up post-llamada lead=${lead.id}: ${r.creado ? 'borrador creado' : `no (${r.motivo})`}`);
          } catch (err2) {
            console.error(`[webhook:fathom] follow-up post-llamada lead=${lead.id} falló: ${err2 instanceof Error ? err2.message : String(err2)}`);
          }
        }
        // El aviso sale SIEMPRE, aunque el análisis o la redacción hayan fallado:
        // sin él, una reunión terminada no le avisa a nadie. Y NO cuenta nada de
        // la charla — eso vive en la pantalla que linkea (ver lib/lead-resumen.ts).
        try {
          const texto = await textoAvisoPostLlamada({ leadId: lead.id, nombre, reunion, duracionMin: dur });
          // El lead y los DATOS van con el texto (15/10/2026): la automatización de la plataforma («Terminó la Reunión de un
          // Negocio») los cita por nombre; sin ella, sale el texto de siempre.
          await emitirDelCatalogo('reunion-ocurrio-fathom', { texto, lead: { id: lead.id, nombre }, datos: datosPostLlamada({ reunion, duracionMin: dur }) });
        } catch (err3) {
          console.error(`[webhook:fathom] aviso post-llamada lead=${lead.id} falló: ${err3 instanceof Error ? err3.message : String(err3)}`);
        }
      }));
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
