// =============================================================================
// Tracking del VSL — recibe eventos de la landing (Lovable)
// =============================================================================
// La landing escucha el evento panda_timeupdate y reenvía acá la profundidad
// de visualización:
//   { visitor_id, tipo_evento: 'play'|'pNN'(cada 5%)|'exit', porcentaje, video_id }
// 'exit' lleva el % EXACTO de abandono. Compat: payload viejo { event, play_count }.
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
// Diseño: errores SIEMPRE silenciosos hacia el cliente (200 con ok:false a
// lo sumo). Un fallo de tracking jamás debe romper la experiencia de la
// landing ni filtrar detalles internos.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/lib/workspace';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Origins permitidos de la landing (coma-separados) — opcional. Si está seteado,
// rechazamos beacons cuyo Origin/Referer no matchee (corta el envenenamiento de
// métricas desde otros sitios). Si NO está seteado, no se fuerza (compat).
const ALLOWED_ORIGINS = (process.env.VSL_ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

function origenPermitido(req: NextRequest): boolean {
  if (!ALLOWED_ORIGINS.length) return true;
  const origin = (req.headers.get('origin') || '').replace(/\/$/, '');
  const referer = req.headers.get('referer') || '';
  return ALLOWED_ORIGINS.some((a) => origin === a || referer.startsWith(a));
}

// Un visitor_id legítimo es un UUID/token de cookie: solo [A-Za-z0-9_-].
const VISITOR_RE = /^[\w-]{8,128}$/;

// La landing vive en otro dominio — CORS abierto. Endpoint de tracking
// anónimo sin credenciales ni datos sensibles, '*' es aceptable y evita
// romper si el dominio de la landing cambia (lovable.app ↔ dominio propio).
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

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
    // getTenantDb scopea `leads` por workspace. Este beacon es público (sin sesión)
    // → getWorkspaceActual resuelve al dueño (OWNER_WS), así que el match por
    // meta_lead_id queda confinado a los leads del dueño (antes, con el cliente
    // crudo, matcheaba GLOBAL). El VSL por-cliente —que la landing mande el
    // workspace— es Fase 2.
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

export async function POST(request: NextRequest) {
  // Anti-abuso: origen permitido (si está configurado) + límite de flood por IP.
  // Silencioso (200 ok:false) para no dar señal ni romper la landing.
  if (!origenPermitido(request)) {
    return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }
  const ip = clientIp(request);
  if (!rateLimit(`vsl:${ip}`, 300, 60_000)) {
    return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  let payload: {
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

  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  const visitorId =
    typeof payload.visitor_id === 'string' ? payload.visitor_id.trim() : '';
  if (!VISITOR_RE.test(visitorId)) {
    return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

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
    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
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
      return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[track:vsl] error: ${msg}`);
    return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}

// Healthcheck
export async function GET() {
  return Response.json(
    {
      ok: true,
      endpoint: 'vsl tracking',
      usage: "POST { visitor_id, tipo_evento: 'play'|'p10'..'p100', porcentaje, video_id }",
    },
    { headers: CORS_HEADERS },
  );
}
