// =============================================================================
// Tracking del VSL — recibe eventos de la landing (Lovable)
// =============================================================================
// La landing escucha los eventos nativos de Panda (panda_play, panda_watchtime)
// y reenvía acá, con profundidad de visualización (v3 Fase A):
//   { visitor_id, tipo_evento: 'play'|'p10'..'p100', porcentaje, video_id, timestamp }
// Compat: también acepta el payload viejo { visitor_id, event, play_count }.
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
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

// Milestones válidos del watchtime de Panda.
const TIPOS_VALIDOS = new Set([
  'play', 'p10', 'p20', 'p30', 'p40', 'p50', 'p60', 'p70', 'p80', 'p90', 'p100',
]);

// Camino 1 — cose el UUID anónimo (visitor_id) al lead conocido cuando el
// beacon llega con un token de identidad `l` (= meta_lead_id del link de
// WhatsApp). Solo escribe si el lead aún no tenía visitor_id ("primero gana",
// con guard .is('visitor_id', null) para ser a prueba de carreras). Todo el
// historial anónimo previo bajo ese UUID queda enganchado retroactivo, porque
// vsl_events/landing_visits siempre estuvieron bajo el mismo UUID. Silencioso
// por diseño: un fallo acá jamás debe tumbar el tracking.
async function stampVisitorOnLead(token: string, visitorId: string): Promise<void> {
  try {
    const supabase = getSupabaseServer();
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
  let payload: {
    visitor_id?: unknown;
    tipo_evento?: unknown;
    porcentaje?: unknown;
    video_id?: unknown;
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
  if (!visitorId || visitorId.length > 128) {
    return Response.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  // Camino 1: si el beacon trae `l` (meta_lead_id pegado por el link de
  // WhatsApp), cosemos el visitor_id al lead conocido. Se evalúa antes de la
  // rama 'pageview' para que el PRIMER beacon (la visita al cargar) ya conecte.
  const leadToken = typeof payload.l === 'string' ? payload.l.trim() : '';
  if (leadToken && leadToken.length <= 128) {
    await stampVisitorOnLead(leadToken, visitorId);
  }

  // tipo_evento nuevo (play|p10..p100); compat: si llega el legacy 'event',
  // lo tratamos como play.
  let tipoEvento =
    typeof payload.tipo_evento === 'string' ? payload.tipo_evento.trim().toLowerCase() : '';

  // Visita a la landing → tabla propia (landing_visits), NO vsl_events.
  // Se intercepta antes de la coerción a 'play' de tipos desconocidos.
  if (tipoEvento === 'pageview') {
    try {
      const supabase = getSupabaseServer();
      const { error } = await supabase.from('landing_visits').insert({ visitor_id: visitorId });
      if (error) console.error(`[track:vsl] landing_visits insert falló: ${error.message}`);
    } catch (err) {
      console.error(`[track:vsl] landing_visits error: ${err instanceof Error ? err.message : String(err)}`);
    }
    return Response.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  }

  if (!tipoEvento) {
    tipoEvento = typeof payload.event === 'string' && payload.event.trim() ? 'play' : 'play';
  }
  if (!TIPOS_VALIDOS.has(tipoEvento)) {
    // tipo desconocido → lo guardamos como play para no perder la señal de vista
    tipoEvento = 'play';
  }

  // porcentaje (0-100). Si no viene, derivar del milestone pXX.
  let porcentaje: number | null = null;
  if (typeof payload.porcentaje === 'number' && Number.isFinite(payload.porcentaje)) {
    porcentaje = Math.max(0, Math.min(100, Math.round(payload.porcentaje)));
  } else if (/^p\d{1,3}$/.test(tipoEvento)) {
    porcentaje = Math.min(100, Number(tipoEvento.slice(1)));
  }

  // `event` legacy derivado para que contarVslPlays (event='vsl_play') siga sirviendo.
  const event = tipoEvento === 'play' ? 'vsl_play' : 'vsl_watch';
  const playCount =
    typeof payload.play_count === 'number' && Number.isFinite(payload.play_count)
      ? Math.max(0, Math.floor(payload.play_count))
      : null;

  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from('vsl_events').insert({
      visitor_id: visitorId,
      event,
      tipo_evento: tipoEvento,
      porcentaje,
      play_count: playCount,
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
