// =============================================================================
// Grabación de sesión — recibe los lotes de rrweb de la landing del CLIENTE
// =============================================================================
// La landing manda acá la pantalla de su visitante, por lotes:
//   { v, t, visitor_id, s: 'rs_…', n, e, z, ms, landing_url?, prueba?, fin? }
//
// La forma del lote, los topes, el piso, la retención y el apagador viven UNA vez
// en `lib/replay-contrato.ts`, y el formato del objeto sellado en
// `lib/replay-sellado.ts`. Acá no se decide nada de eso: esta ruta es la PUERTA
// —CORS, tamaño, token, ruteo— y el trabajo lo hace `recibirLote`.
//
// ⚠️ ESTA RUTA NO SELLA, aunque el lote traiga `fin: 1`. Sólo anota `fin_at` y el
// cron (`/api/cron/replay-purga`) sella un par de minutos después. Las dos
// razones están en la cabecera de `lib/replay-ingesta.ts`, y la que más cuesta
// ver es que el ORDEN DE LLEGADA NO ESTÁ GARANTIZADO: el lote con `fin` puede
// llegar antes que el anterior, así que sellar en este request tira justo el
// final de la grabación.
//
// RUTEO (lo que la hace multi-tenant): `t` es el token público de landing del
// workspace, el mismo que ya usa /api/track/vsl. webhook_routing('landing', t) →
// workspace_id, y TODA escritura va dentro de runWithWorkspace(ws).
//
// FAIL-CLOSED: sin token que resuelva, no se escribe nada. Mandar esto al dueño
// sería meter las pantallas de los visitantes de un cliente en el workspace de
// otro — que en este endpoint es lo más grave que podría pasar.
//
// ⚠️ ESTÁ CUBIERTA POR `lib/rutas-publicas.ts` PORQUE `/api/track` YA ES UN
// PREFIJO DE `PUBLICOS`. Si algún día esa entrada se vuelve una lista de rutas
// exactas, ésta tiene que entrar a mano: sin eso el middleware la corta con un
// 401 ANTES de que corra una línea de acá, y en local NO SE VE —sin AUTH_SECRET
// el gate es no-op—, así que anda perfecto contra localhost y falla sólo en
// producción. Ya pasó: una integración vivió meses rota y la descubrió una
// clienta.
//
// Diseño: errores SIEMPRE silenciosos hacia el cliente (200 con ok/ignorado). Un
// fallo de grabación jamás puede romper la landing de nadie. Pero `ignorado`
// SIEMPRE dice el motivo, que es lo que el grabador necesita para dejar de mandar
// —y lo que separa «no llegó» de «lo tiramos nosotros».
// =============================================================================

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { mensajeDeError } from '@/lib/calendly-error';
import { LANDING_SERVICIO } from '@/lib/landing-token';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { REPLAY_LOTE_EVENTOS, REPLAY_VERSION, sesionIdValido } from '@/lib/replay-contrato';
import { REPLAY_CUERPO_MAX_BYTES, REPLAY_LOTE_MAX_BYTES, REPLAY_LOTES_MAX } from '@/lib/replay-sellado';
import { recibirLote } from '@/lib/replay-ingesta';

export const dynamic = 'force-dynamic';
// Guardar un lote son dos escrituras indexadas. Si esto tarda, algo está mal y es
// mejor cortar que dejar al visitante esperando.
export const maxDuration = 20;

// Un visitor_id legítimo es un UUID/token de cookie: solo [A-Za-z0-9_-].
const VISITOR_RE = /^[\w-]{8,128}$/;
// Sanity check del token antes de pegarle a la base. La autoridad es la tabla.
const TOKEN_RE = /^[\w-]{8,64}$/;

// La landing vive en el dominio del cliente — CORS abierto, igual que
// /api/track/vsl y por el mismo motivo: cada cliente sirve su landing desde SU
// dominio y nada de esto se configura en el servidor.
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

type Payload = {
  v?: unknown;
  t?: unknown;
  ws_token?: unknown;
  visitor_id?: unknown;
  s?: unknown;
  n?: unknown;
  e?: unknown;
  z?: unknown;
  ms?: unknown;
  landing_url?: unknown;
  prueba?: unknown;
  fin?: unknown;
};

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(request: NextRequest) {
  // ── 1. El tamaño, ANTES de parsear ────────────────────────────────────────
  // ⚠️ Parsear un cuerpo de 50 MB para después decidir que no se quería es
  // trabajo ya hecho. El `content-length` lo contesta gratis. Un cuerpo sin
  // `content-length` pasa a la etapa siguiente: lo acota el tope por lote.
  const largo = Number(request.headers.get('content-length'));
  if (Number.isFinite(largo) && largo > REPLAY_CUERPO_MAX_BYTES) {
    console.warn(`[track:replay] cuerpo de ${largo}B descartado (tope ${REPLAY_CUERPO_MAX_BYTES}B)`);
    return json({ ok: false, ignorado: 'cuerpo demasiado grande' });
  }

  // ── 2. Anti-flood por IP ──────────────────────────────────────────────────
  // El grabador manda un lote cada 10 s por pestaña, o sea 6 por minuto. 120
  // deja 20 pestañas de la misma IP (una oficina con NAT) y corta el flood
  // trivial, que acá es lo que engorda el buffer caliente y el bucket.
  const ip = clientIp(request);
  if (!rateLimit(`replay:${ip}`, 120, 60_000)) return json({ ok: false, ignorado: 'demasiados lotes' });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, ignorado: 'cuerpo ilegible' });
  }

  const visitorId = typeof payload.visitor_id === 'string' ? payload.visitor_id.trim() : '';
  if (!VISITOR_RE.test(visitorId)) return json({ ok: false, ignorado: 'visitante invalido' });

  // ⚠️ LA IDENTIDAD NO SE INVENTA. El `visitor_id` es el MISMO UUID de la cookie
  // nqe_visitor_id que ya usan landing_visits y vsl_events, y ése es el enganche
  // con la ficha del lead: `leads.visitor_id` se cose después por Calendly o por
  // el Camino 1 del beacon. Una identidad propia del replay dejaría las
  // grabaciones sin poder atarse a nadie.
  const sesionId = typeof payload.s === 'string' ? payload.s.trim() : '';
  if (!sesionIdValido(sesionId)) return json({ ok: false, ignorado: 'sesion invalida' });

  const n = typeof payload.n === 'number' ? payload.n : Number.NaN;
  if (!Number.isSafeInteger(n) || n < 0 || n > REPLAY_LOTES_MAX) {
    return json({ ok: false, ignorado: 'numero de lote invalido' });
  }

  // ── 3. Ruteo: token → workspace ───────────────────────────────────────────
  const crudo =
    (typeof payload.t === 'string' && payload.t) ||
    (typeof payload.ws_token === 'string' && payload.ws_token) ||
    request.nextUrl.searchParams.get('t') ||
    '';
  const token = crudo.trim();

  // ⚠️ ESTRICTA (07/10/2026), por lo mismo que el beacon de /api/track/vsl: «no pude leer» no es
  // «sin workspace mapeado». Sin reintento: un lote perdido es un hueco en una grabación.
  let ws: number | null = null;
  if (token && TOKEN_RE.test(token)) {
    try {
      ws = await wsPorIdentificadorEstricto(LANDING_SERVICIO, token);
    } catch (err) {
      console.error(`[track:replay] no pude leer de quién es el token (la base no contestó): lote perdido — ${mensajeDeError(err)}`);
      return Response.json({ ok: false, error: 'ruteo' }, { status: 503, headers: CORS_HEADERS });
    }
  }
  if (ws == null) {
    // Fail-CLOSED, sin excepciones. Lo que se descarta acá es la pantalla de una
    // persona: mandarla al workspace del dueño es peor que perderla.
    console.warn(
      `[track:replay] lote descartado (fail-closed): token=${token || '(ninguno)'} ` +
      `origin=${request.headers.get('origin') ?? '—'} — sin workspace mapeado.`,
    );
    return json({ ok: true, ignorado: 'sin workspace' });
  }

  // Desde acá, TODA escritura cae en el workspace dueño de la landing.
  return runWithWorkspace(ws, async () => {
    try {
      const r = await recibirLote({
        v: Number.isFinite(Number(payload.v)) ? Math.trunc(Number(payload.v)) : REPLAY_VERSION,
        visitorId,
        sesionId,
        n,
        e: payload.e,
        z: payload.z === 1 ? 1 : 0,
        ms: typeof payload.ms === 'number' && Number.isFinite(payload.ms) ? payload.ms : 0,
        landingUrl: texto(payload.landing_url, 500),
        prueba: texto(payload.prueba, 40),
        fin: payload.fin === 1 || payload.fin === true,
      });
      return json(r.guardado ? { ok: true } : { ok: true, ignorado: r.ignorado, corte: r.corte ?? null });
    } catch (err) {
      console.error(`[track:replay] error: ${err instanceof Error ? err.message : String(err)}`);
      return json({ ok: false, ignorado: 'error del servidor' });
    }
  });
}

// Healthcheck. Dice la forma del lote y los dos números que el grabador tiene que
// respetar, porque un grabador pegado en la página de un tercero no puede
// importar nada de este repo.
export async function GET() {
  return Response.json(
    {
      ok: true,
      endpoint: 'replay de sesion',
      protocolo: REPLAY_VERSION,
      lote_eventos: REPLAY_LOTE_EVENTOS,
      // ⚠️ EL TOPE QUE SE PUBLICA ES EL QUE LA PUERTA APLICA, y son DOS numeros
      // distintos: el cuerpo entero puede pesar hasta REPLAY_CUERPO_MAX_BYTES, pero
      // el campo de eventos corta mucho antes (REPLAY_LOTE_MAX_BYTES, aplicado en
      // la funcion que arma el cuerpo del lote). Publicar el grande era mandar a un grabador ajeno a armar
      // lotes de 1 MB que esta misma ruta rebota con «cuerpo: pesado» — medido:
      // 921.605 B, por debajo del numero publicado, rechazados. Este endpoint existe
      // justamente para que un grabador que no puede importar nada del repo sepa que
      // respetar; darle el numero que no es, es peor que no tenerlo.
      lote_max_bytes: REPLAY_LOTE_MAX_BYTES,
      cuerpo_max_bytes: REPLAY_CUERPO_MAX_BYTES,
      usage: "POST { v, t: 'mko_…', visitor_id, s: 'rs_…', n, e, z: 0|1, ms, landing_url?, prueba?, fin? }",
    },
    { headers: CORS_HEADERS },
  );
}
