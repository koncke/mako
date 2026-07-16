// =============================================================================
// Tracking del VSL — recibe eventos de la landing del CLIENTE (Lovable, etc.)
// =============================================================================
// La landing manda acá la visita y la profundidad de visualización del VSL:
//   { t, visitor_id, tipo_evento: 'pageview'|'play'|'pNN'(cada 5%)|'exit', porcentaje, video_id }
// 'exit' lleva el % EXACTO de abandono. Compat: payload viejo { event, play_count }.
//
// RUTEO (lo que hace multi-tenant a este beacon): `t` es el token público de
// landing del workspace (mko_ + 32 hex), que el usuario copia de /integraciones
// → Landing y pega en su landing. webhook_routing('landing', t) → workspace_id,
// el mismo índice de plataforma que usan los webhooks de Meta/Chatwoot/Calendly.
// TODA escritura va dentro de runWithWorkspace(ws) → los eventos caen en el
// workspace dueño de esa landing, no en el del dueño de la app.
//
// FAIL-CLOSED: sin token que resuelva, NO se escribe nada. Antes, este beacon
// caía a OWNER_WS (getTenantDb sin sesión → dueño) y la analítica de landing de
// TODOS los clientes se mezclaba en el workspace 1.
//
// El visitor_id es un UUID anónimo de la cookie nqe_visitor_id. El mismo
// UUID llega como utm_term cuando la persona agenda en Calendly — el
// webhook lo guarda en leads.visitor_id y así cruzamos comportamiento por
// persona (Panda mide agregado y anónimo; este beacon mide quién).
//
// Camino 1 (instant form + WhatsApp): el beacon también puede traer `l` = el
// meta_lead_id que el link de WhatsApp pegó como ?l=…. Si viene, cosemos el
// visitor_id anónimo al lead conocido en el acto, sin esperar a la agenda.
//
// Diseño: errores SIEMPRE silenciosos hacia el cliente (200 a lo sumo con
// ok:false / ignored). Un fallo de tracking jamás debe romper la experiencia de
// la landing ni filtrar detalles internos — por eso hasta el rechazo por
// workspace responde 200.
// =============================================================================

import type { NextRequest } from 'next/server';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { wsPorIdentificador } from '@/lib/webhook-routing';
import { LANDING_SERVICIO } from '@/lib/landing-token';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// El TOKEN es lo único que identifica al workspace. NO hay allowlist de origins
// ni escape hatch por env: la landing de cada cliente vive en SU dominio
// (lovable.app, el propio, …) y nada de esto se configura en el servidor — se
// resuelve pegando el código que da /integraciones → Landing, igual para el
// dueño que para cualquier cliente nuevo.

// Un visitor_id legítimo es un UUID/token de cookie: solo [A-Za-z0-9_-].
const VISITOR_RE = /^[\w-]{8,128}$/;
// Sanity check del token antes de pegarle a la base (la autoridad es la tabla,
// por eso no se valida contra el formato canónico: si el formato cambia, el
// mapeo sigue mandando).
const TOKEN_RE = /^[\w-]{8,64}$/;

// La landing vive en otro dominio — CORS abierto. Endpoint de tracking
// anónimo sin credenciales ni datos sensibles, '*' es aceptable y necesario:
// cada cliente sirve su landing desde SU dominio.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (body: Record<string, unknown>) =>
  Response.json(body, { status: 200, headers: CORS_HEADERS });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// Camino 1 — cose el UUID anónimo (visitor_id) al lead conocido cuando el
// beacon llega con un token de identidad `l` (= meta_lead_id del link de
// WhatsApp). Solo escribe si el lead aún no tenía visitor_id ("primero gana",
// con guard .is('visitor_id', null) para ser a prueba de carreras). Todo el
// historial anónimo previo bajo ese UUID queda enganchado retroactivo, porque
// vsl_events/landing_visits siempre estuvieron bajo el mismo UUID. Silencioso
// por diseño: un fallo acá jamás debe tumbar el tracking.
async function stampVisitorOnLead(token: string, visitorId: string): Promise<void> {
  try {
    // Corre dentro de runWithWorkspace(ws del token) → getTenantDb scopea `leads`
    // al workspace dueño de la landing: el match por meta_lead_id no puede tocar
    // los leads de otro cliente.
    const supabase = await getTenantDb();
    const { data: lead, error } = await supabase
      .from('leads')
      .select('id, visitor_id')
      .eq('meta_lead_id', token)
      .maybeSingle();
    if (error || !lead || lead.visitor_id) return;
    const { error: updErr } = await supabase
      .from('leads')
      .update({ visitor_id: visitorId })
      .eq('id', lead.id)
      .is('visitor_id', null);
    if (updErr) {
      console.error(`[track:vsl] Camino 1 stamp falló: ${updErr.message}`);
    } else {
      console.log(`[track:vsl] Camino 1 → lead ${lead.id} cosido a visitor_id=${visitorId}`);
    }
  } catch (err) {
    console.error(`[track:vsl] stampVisitorOnLead error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

type Payload = {
  t?: unknown;           // token público de landing (mko_…) → workspace
  ws_token?: unknown;    // alias de `t`
  visitor_id?: unknown;
  tipo_evento?: unknown;
  porcentaje?: unknown;
  video_id?: unknown;    // id del video de Panda (pruebas A/B de VSL)
  vsl_titulo?: unknown;  // título del video de Panda, si la landing lo puede leer
  landing_url?: unknown; // URL exacta de la landing (pruebas A/B de landing)
  referrer?: unknown;
  event?: unknown;       // legacy
  play_count?: unknown;  // legacy
  l?: unknown;           // Camino 1: token de identidad (meta_lead_id) del link de WhatsApp
};

export async function POST(request: NextRequest) {
  // Anti-flood por IP. Silencioso (200 ok:false) para no dar señal ni romper la landing.
  const ip = clientIp(request);
  if (!rateLimit(`vsl:${ip}`, 300, 60_000)) return json({ ok: false });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false });
  }

  const visitorId = typeof payload.visitor_id === 'string' ? payload.visitor_id.trim() : '';
  if (!VISITOR_RE.test(visitorId)) return json({ ok: false });

  // ── Ruteo: token → workspace ───────────────────────────────────────────────
  // Se acepta del body (`t` o `ws_token`) o del query (?t=…).
  const crudo =
    (typeof payload.t === 'string' && payload.t) ||
    (typeof payload.ws_token === 'string' && payload.ws_token) ||
    request.nextUrl.searchParams.get('t') ||
    '';
  const token = crudo.trim();

  let ws: number | null = null;
  if (token && TOKEN_RE.test(token)) {
    ws = await wsPorIdentificador(LANDING_SERVICIO, token);
  }

  if (ws == null) {
    // Fail-CLOSED, sin excepciones: sin token que resuelva no escribimos nada.
    // Mandarlo al dueño sería el misrouteo que este beacon vino a arreglar.
    console.warn(
      `[track:vsl] beacon descartado (fail-closed): token=${token || '(ninguno)'} ` +
      `origin=${request.headers.get('origin') ?? '—'} — sin workspace mapeado. ` +
      `El código de la landing se copia en /integraciones → Landing.`,
    );
    return json({ ok: true, ignored: 'sin workspace' });
  }

  // Desde acá, TODA escritura cae en el workspace dueño de la landing.
  return runWithWorkspace(ws, () => procesar(payload, visitorId, ip));
}

// Todo lo que escribe. Corre SIEMPRE dentro de runWithWorkspace.
async function procesar(payload: Payload, visitorId: string, ip: string): Promise<Response> {
  // Camino 1: si el beacon trae `l` (meta_lead_id pegado por el link de
  // WhatsApp), cosemos el visitor_id al lead conocido. Se evalúa antes de la
  // rama 'pageview' para que el PRIMER beacon (la visita al cargar) ya conecte.
  // El "stamp" es una escritura sensible con "primero gana" → límite MÁS DURO por
  // IP para frenar el preclaim masivo de visitor_id sobre leads ajenos.
  const leadToken = typeof payload.l === 'string' ? payload.l.trim() : '';
  if (leadToken && leadToken.length <= 128 && rateLimit(`vslstamp:${ip}`, 15, 60_000)) {
    await stampVisitorOnLead(leadToken, visitorId);
  }

  // tipo_evento: play | pNN (cada 5%) | exit | pageview; compat: legacy 'event' → play.
  let tipoEvento =
    typeof payload.tipo_evento === 'string' ? payload.tipo_evento.trim().toLowerCase() : '';

  // Sanitizadores de los campos nuevos (opcionales, beacon viejo sigue andando).
  const texto = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  // Visita a la landing → tabla propia (landing_visits), NO vsl_events.
  // Se intercepta antes de la coerción a 'play' de tipos desconocidos.
  if (tipoEvento === 'pageview') {
    try {
      const supabase = await getTenantDb();
      const { error } = await supabase.from('landing_visits').insert({
        visitor_id: visitorId,
        // URL exacta de la landing (multi-landing / pruebas A/B) + referrer.
        landing_url: texto(payload.landing_url, 500),
        referrer: texto(payload.referrer, 500),
      });
      if (error) console.error(`[track:vsl] landing_visits insert falló: ${error.message}`);
    } catch (err) {
      console.error(`[track:vsl] landing_visits error: ${err instanceof Error ? err.message : String(err)}`);
    }
    return json({ ok: true });
  }

  if (!tipoEvento) tipoEvento = 'play';

  // tipo_evento válido: 'play' | 'exit' | 'pNN' (1..100). 'pNN' = hito de
  // retención al cruzar NN% (la landing los manda cada 5%); 'exit' = punto
  // EXACTO de abandono (% preciso en payload.porcentaje). Lo desconocido →
  // 'play' para no perder la señal de vista.
  const milestoneMatch = /^p(\d{1,3})$/.exec(tipoEvento);
  if (tipoEvento !== 'play' && tipoEvento !== 'exit' && !milestoneMatch) {
    tipoEvento = 'play';
  }

  // porcentaje (0-100): del payload si viene (afinado, ej. exit=73); si no, del pNN.
  let porcentaje: number | null = null;
  if (typeof payload.porcentaje === 'number' && Number.isFinite(payload.porcentaje)) {
    porcentaje = Math.max(0, Math.min(100, Math.round(payload.porcentaje)));
  } else if (milestoneMatch) {
    porcentaje = Math.max(0, Math.min(100, Number(milestoneMatch[1])));
  } else if (tipoEvento === 'play') {
    porcentaje = 0;
  }

  // `event` legacy derivado para que contarVslPlays (event='vsl_play') siga sirviendo.
  const event = tipoEvento === 'play' ? 'vsl_play' : 'vsl_watch';
  const playCount =
    typeof payload.play_count === 'number' && Number.isFinite(payload.play_count)
      ? Math.max(0, Math.floor(payload.play_count))
      : null;

  try {
    const supabase = await getTenantDb();
    const { error } = await supabase.from('vsl_events').insert({
      visitor_id: visitorId,
      event,
      tipo_evento: tipoEvento,
      porcentaje,
      play_count: playCount,
      // Multi-VSL (pruebas A/B desde Panda): id del video + título si la landing
      // lo puede leer. Antes video_id llegaba en el payload y se descartaba.
      video_id: texto(payload.video_id, 120),
      vsl_titulo: texto(payload.vsl_titulo, 200),
    });
    if (error) {
      console.error(`[track:vsl] insert falló: ${error.message}`);
      return json({ ok: false });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[track:vsl] error: ${msg}`);
    return json({ ok: false });
  }

  return json({ ok: true });
}

// Healthcheck
export async function GET() {
  return Response.json(
    {
      ok: true,
      endpoint: 'vsl tracking',
      usage: "POST { t: 'mko_…', visitor_id, tipo_evento: 'pageview'|'play'|'p10'..'p100', porcentaje, video_id }",
    },
    { headers: CORS_HEADERS },
  );
}
