// =============================================================================
// Webhook: Meta Lead Ads → leads
// =============================================================================
// Endpoint público que recibe webhooks de Meta cuando alguien envía un
// formulario instantáneo (instant form) en un anuncio.
//
// A diferencia de Calendly, el POST de Meta NO trae los datos del lead — solo
// un leadgen_id. Hay que llamar a la Graph API con ese ID para obtenerlos.
//
// Seguridad:
//   - GET de verificación: hub.verify_token vs META_LEADS_VERIFY_TOKEN
//   - POST firmado: X-Hub-Signature-256 = HMAC-SHA256(raw body, META_APP_SECRET)
//
// Env vars (Vercel production):
//   - META_LEADS_VERIFY_TOKEN  (string inventado, debe coincidir con Meta)
//   - META_APP_SECRET          (de la app "Leads - Dashboard MKT (Martin)")
//   - META_PAGE_ACCESS_TOKEN   (token de página — para leer el lead via Graph)
// =============================================================================

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { upsertLeadFromMeta, logLeadEvent } from '@/lib/leads';
import { sendMetaCAPIEvent } from '@/lib/meta-capi';
import { eventIdLeadCrudo } from '@/lib/meta-capi-payload';
import { parseLeadFields, META_GRAPH_VERSION } from '@/lib/meta-leads';
import { resumenRespuestas } from '@/lib/meta-leads-campos';
import { emitirDelCatalogo } from '@/lib/avisos';
import { dispararEvento } from '@/lib/flujos';
import { enrolarPorEvento } from '@/lib/nutricion';
import { credWsEstricta } from '@/lib/credenciales';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { anotarFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const GRAPH_VERSION = META_GRAPH_VERSION;

// ─────────────────────────────────────────────────────────────────────────────
// GET — verificación del webhook (handshake de Meta) + healthcheck
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const verifyToken = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  // Handshake de Meta: responder el challenge en texto plano
  if (mode === 'subscribe' && verifyToken !== null && challenge !== null) {
    const expected = process.env.META_LEADS_VERIFY_TOKEN;
    if (!expected) {
      console.error('[webhook:meta-leads] META_LEADS_VERIFY_TOKEN no configurado');
      return new Response('server not configured', { status: 500 });
    }
    if (verifyToken === expected) {
      console.log('[webhook:meta-leads] verificación OK — challenge devuelto');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    console.warn('[webhook:meta-leads] verify_token NO coincide');
    return new Response('forbidden', { status: 403 });
  }

  // Healthcheck simple (sin params de Meta)
  return Response.json({
    ok: true,
    endpoint: 'meta lead ads webhook',
    usage: 'GET con hub.* para verificación; POST firmado con X-Hub-Signature-256',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Firma del POST
// ─────────────────────────────────────────────────────────────────────────────

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('[webhook:meta-leads] META_APP_SECRET no configurado');
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const received = signatureHeader.slice('sha256='.length);
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph API — obtener los datos del lead por leadgen_id
// ─────────────────────────────────────────────────────────────────────────────

type GraphLeadResponse = {
  id?: string;
  field_data?: Array<{ name?: string; values?: string[] }>;
  /** Cuándo creó Meta el lead (ISO). Hasta el 04/10/2026 el webhook ni lo pedía. */
  created_time?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  ad_id?: string;
  /** Los ids que DECIDEN el producto (los nombres de arriba sólo se muestran). */
  campaign_id?: string;
  adset_id?: string;
  error?: { code?: number; message?: string };
};

async function fetchLeadFromGraph(leadgenId: string, ws: number): Promise<GraphLeadResponse> {
  // Token de página POR WORKSPACE: el lead se lee con las credenciales del
  // cliente dueño de la página. Para ws1 (dueño) cae al env — mismo valor.
  //
  // ESTRICTA (07/10/2026): con `credWs`, una base caída daba null y el lead quedaba anotado como
  // «META_PAGE_ACCESS_TOKEN no configurado», que manda a revisar una conexión que está bien.
  const token = await credWsEstricta('META_PAGE_ACCESS_TOKEN', ws);
  if (!token || token.startsWith('PENDING')) {
    throw new Error('META_PAGE_ACCESS_TOKEN no configurado (o placeholder)');
  }
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}`);
  url.searchParams.set('access_token', token);
  // `created_time` es cuándo creó Meta el lead, que no es cuándo lo ingestamos: el
  // webhook llega en segundos, pero un reintento de Meta o una cola trabada pueden
  // llegar horas después, y el poll rescata leads de hasta 90 días. Sin pedirlo,
  // `leads.meta_created_at` nace vacío por este camino y la atribución por fecha
  // mide la ingesta.
  //
  // `campaign_id` y `adset_id` desde el 05/10/2026: un nombre no es una clave (se
  // renombra, se repite) y con estos ids el lead nace en el tablero del PRODUCTO al que
  // esa campaña o ese conjunto están asignados (lib/campana-funnel.ts).
  url.searchParams.set('fields', 'field_data,created_time,campaign_name,adset_name,ad_name,ad_id,campaign_id,adset_id');

  const res = await fetch(url.toString());
  const body = (await res.json()) as GraphLeadResponse;
  if (body.error) {
    throw new Error(`Graph API error (${body.error.code}): ${body.error.message}`);
  }
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — lead nuevo del instant form
// ─────────────────────────────────────────────────────────────────────────────

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: {
        leadgen_id?: string;
        form_id?: string;
        page_id?: string;
        ad_id?: string;
        created_time?: number;
      };
    }>;
  }>;
};

export async function POST(request: NextRequest) {
  const tStart = Date.now();

  // 1) Raw body para verificar firma
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn('[webhook:meta-leads] firma rechazada');
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  // 2) Parse
  let body: MetaWebhookBody;
  try {
    body = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // 3) Juntar (leadgen_id, page_id) del payload. Puede venir más de un lead, y
  //    de más de UNA página (distintos workspaces) en un mismo POST — resolvemos
  //    el workspace por cada uno, no asumimos uno solo. page_id viene en
  //    changes[].value.page_id y/o, como fallback, en entry[].id.
  const items: Array<{ leadgenId: string; pageId: string | null }> = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'leadgen' && change.value?.leadgen_id) {
        items.push({
          leadgenId: change.value.leadgen_id,
          pageId: change.value.page_id ?? entry.id ?? null,
        });
      }
    }
  }

  if (items.length === 0) {
    console.log('[webhook:meta-leads] POST sin leadgen_id — ignorado');
    return Response.json({ ok: true, ignored: true });
  }

  // 4) Procesar cada lead en el workspace de SU página — un error individual NO
  //    bloquea a los demás. Devolvemos 200 siempre que el request fue legítimo:
  //    si devolvemos error, Meta reintenta TODO el batch (duplicaría el trabajo).
  const results: Array<{ leadgen_id: string; status: string; lead_id?: number }> = [];
  // ⚠️ LA EXCEPCIÓN AL «200 SIEMPRE»: no poder LEER de quién es la página (07/10/2026). Con
  // `wsPorIdentificador`, que no lee el `error` de supabase-js, la base caída daba null y el lead
  // caía en «sin workspace» → 200 y descartado, sin pasar por ningún reintento. Ahora la lectura
  // es estricta y, si falló de forma TRANSITORIA, el lote entero se contesta 503 para que Meta
  // lo reintente (lo hace ~36 h). Reprocesar los demás no duplica nada: `upsertLeadFromMeta`
  // deduplica por `meta_lead_id`, el aviso, los flujos y la nutrición salen sólo al CREAR, y el
  // `Lead` de CAPI lleva un event_id fijo. Lo que falla DESPUÉS del ruteo sigue yendo 200: ahí
  // ya pudieron correr efectos, y un reintento los salta (el cron meta-leads-poll lo rescata).
  let reintentar = false;

  for (const { leadgenId, pageId } of items) {
    // Fail-CLOSED: sin page_id mapeado a un workspace (webhook_routing), NO
    // ingerimos el lead. NUNCA cae al dueño (evita misrutear leads de un cliente).
    let ws: number | null;
    try {
      ws = await wsPorIdentificadorEstricto('meta', pageId);
    } catch (err) {
      const { transitorio, mensaje } = await anotarFalloDeRuteo('meta', err, pageId);
      if (transitorio) reintentar = true;
      console.error(`[webhook:meta-leads] no pude leer de quién es page_id=${pageId ?? '—'} leadgen=${leadgenId}${transitorio ? ' (transitorio: el lote va 503)' : ''}: ${mensaje}`);
      results.push({ leadgen_id: leadgenId, status: `error: ruteo${transitorio ? ' (se reintenta)' : ''}` });
      continue;
    }
    if (ws == null) {
      console.warn(`[webhook:meta-leads] sin workspace para page_id=${pageId ?? '—'} leadgen=${leadgenId} — ignorado`);
      results.push({ leadgen_id: leadgenId, status: 'ignored: sin workspace' });
      continue;
    }
    try {
      // Todo el procesamiento (Graph, upsert, chat, aviso, flujo) confinado al ws.
      await runWithWorkspace(ws, async () => {
        const graphLead = await fetchLeadFromGraph(leadgenId, ws);
        const { email, nombre, telefono, empresa, noReconocidos } = parseLeadFields(graphLead.field_data);

        const { created, lead } = await upsertLeadFromMeta({
          email,
          nombre,
          telefono,
          empresa,
          meta_lead_id: leadgenId,
          meta_ad_id: graphLead.ad_id ?? null,
          meta_ad_name: graphLead.ad_name ?? null,
          meta_campaign_name: graphLead.campaign_name ?? null,
          meta_adset_name: graphLead.adset_name ?? null,
          meta_campaign_id: graphLead.campaign_id ?? null,
          meta_adset_id: graphLead.adset_id ?? null,
          // Las respuestas CRUDAS del formulario y la fecha real de Meta. El parser
          // saca cuatro campos por palabra clave; lo demás se descartaba sin rastro, y
          // Meta borra el field_data a los 90 días. `noReconocidos` termina en el
          // historial del lead (lo escribe upsertLeadFromMeta, por los dos caminos).
          meta_field_data: graphLead.field_data ?? null,
          meta_created_at: graphLead.created_time ?? null,
          meta_campos_no_reconocidos: noReconocidos,
        });

        console.log(
          `[webhook:meta-leads] ws=${ws} ${created ? 'INSERT' : 'UPDATE'} lead id=${lead.id} page=${pageId ?? '—'} leadgen=${leadgenId} ad=${graphLead.ad_name ?? '—'} ms=${Date.now() - tStart}`,
        );
        results.push({ leadgen_id: leadgenId, status: created ? 'created' : 'updated', lead_id: lead.id });

        // CAPI: el evento `Lead` — el lead CRUDO, la primera etapa del embudo que
        // Meta necesita para poder optimizar por calidad. Acá y no en el CRM: hasta
        // el 05/10/2026 lo disparaba `calificado` (lib/leads.ts), o sea el lead crudo
        // y el calificado viajaban con el MISMO nombre y Meta no podía distinguir
        // dos etapas. Este es el único lugar que sabe cuándo ENTRA uno.
        //
        // Va con el `lead_id` sin hashear (el identificador de más prioridad de
        // Meta), con la hora REAL del formulario —no la de este request, que puede
        // llegar tarde— y con un event_id derivado del leadgen_id, porque Meta
        // reintenta el batch entero cuando el webhook no contesta 200.
        //
        // ⚠️ NO se agrega al camino de POLLING (lib/meta-leads.ts): ése hace una
        // pasada de 90 días, así que mandaría `Lead` por leads viejísimos que caen
        // fuera de la ventana de CAPI. Ahí no hay nada que optimizar.
        const capi = await sendMetaCAPIEvent({
          eventName: 'Lead',
          email: lead.email,
          phone: lead.telefono,
          metaLeadId: leadgenId,
          eventTime: graphLead.created_time ?? null,
          eventId: eventIdLeadCrudo(leadgenId),
          customData: { lead_type: 'formulario_meta' },
        });
        if (!capi.ok && (capi.motivo === 'rechazado' || capi.motivo === 'http' || capi.motivo === 'red')) {
          // Lo que Meta rechaza va donde el dueño lo lee, no sólo al log.
          await logLeadEvent(lead.id, 'Meta', `No entró la conversión Lead: ${capi.detalle}`.slice(0, 300), 'MaKo');
        }

        // (Hasta el 09/10/2026 acá se le creaba al lead nuevo su contacto y su conversación en
        // Chatwoot; se fue con la integración.)

        // Aviso al dueño del workspace: entró un lead nuevo por formulario de Meta
        // (solo en INSERT, para no re-avisar si Meta reenvía el batch). Best-effort.
        if (created) {
          // ⚠️ VAN LOS DATOS, NO EL TEXTO. Con `texto` armado acá, lo que el negocio
          // escribiera en /automations no salía nunca: el texto es el de la plantilla
          // (lib/avisos-catalogo.ts, que nace APAGADA) y esto le pone los valores. Los
          // que ya están en la mano van en `datos`, que ganan sobre la lectura de la
          // ficha. Y los dos que pueden faltar se dicen: un `{{lead_telefono}}` crudo en
          // el WhatsApp de un cliente se lee como que el mensaje está roto.
          const respuestasForm = resumenRespuestas(graphLead.field_data ?? null);
          await emitirDelCatalogo('lead-formulario-meta', {
            ws,
            lead: { id: lead.id, nombre: lead.nombre },
            datos: {
              lead_telefono: lead.telefono?.trim() || 'sin teléfono',
              lead_formulario: respuestasForm ?? 'Sin preguntas extra en el formulario.',
              ...(graphLead.campaign_name ? { lead_campana: graphLead.campaign_name } : {}),
            },
          });
          // Flujos configurados por el dueño: disparar 'lead.form_meta'.
          await dispararEvento('lead.form_meta', { ws, leadId: lead.id, leadNombre: lead.nombre });
          // Nutrición INMEDIATA (reunión 31/07): al que llena el formulario se
          // le escribe casi al instante, no en la próxima corrida del cron.
          await enrolarPorEvento(lead.id, 'lead_nuevo');
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[webhook:meta-leads] error procesando leadgen=${leadgenId} page=${pageId ?? '—'}: ${message}`);
      results.push({ leadgen_id: leadgenId, status: `error: ${message}` });
    }
  }

  if (reintentar) {
    return Response.json({ ok: false, error: 'ruteo', reintentar: true, processed: results.length, results }, { status: 503 });
  }
  return Response.json({ ok: true, processed: results.length, results });
}
