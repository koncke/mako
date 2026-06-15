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

export async function POST(request: NextRequest) {
  let payload: {
    visitor_id?: unknown;
    tipo_evento?: unknown;
    porcentaje?: unknown;
    video_id?: unknown;
    event?: unknown;       // legacy
    play_count?: unknown;  // legacy
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

  // tipo_evento nuevo (play|p10..p100); compat: si llega el legacy 'event',
  // lo tratamos como play.
  let tipoEvento =
    typeof payload.tipo_evento === 'string' ? payload.tipo_evento.trim().toLowerCase() : '';
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
