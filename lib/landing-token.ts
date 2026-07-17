// =============================================================================
// landing-token — token público de landing por workspace (ruteo del beacon)
// =============================================================================
// El beacon de la landing (/api/track/vsl) llega SIN sesión: es un <script> que
// el cliente pega en SU landing (Lovable, Framer, Webflow, WordPress, HTML
// plano…). La única pista de a qué workspace pertenece cada evento es un
// identificador en claro que viaja en el payload. Ese identificador es este
// token.
//
// El token NO es un secreto: viaja en el HTML de una página pública, como
// cualquier pixel (Meta, GA). Solo IDENTIFICA al workspace — no autoriza a leer
// nada. Lo peor que habilita es que alguien que lo copie mande eventos falsos a
// ese workspace (metric poisoning, mitigado por el rate-limit del beacon), que
// es exactamente el mismo modelo de amenaza de cualquier pixel de analítica.
// Por eso se guarda en app_settings (no en credenciales cifradas) y se muestra
// en claro en /integraciones.
//
// El mapeo token → workspace vive en webhook_routing('landing', token, ws), el
// mismo índice de plataforma que ya usan Meta/Chatwoot/Calendly/Fathom. Lo
// espeja setSetting('landing_token') (lib/settings.ts), igual que meta_page_id.
// =============================================================================

import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { getSetting, setSetting } from './settings';
import { getTenantDb, runWithWorkspace } from './workspace';
import { upsertRouting, wsPorIdentificador } from './webhook-routing';

/** Key en app_settings. setSetting la espeja a webhook_routing('landing', …). */
export const LANDING_TOKEN_KEY = 'landing_token';

/** Servicio bajo el que se indexa el token en webhook_routing. */
export const LANDING_SERVICIO = 'landing';

/** mko_ + 32 hex al azar. Fallback si no hay secret de firma configurado. */
function generarLandingToken(): string {
  return `mko_${randomBytes(16).toString('hex')}`;
}

/**
 * Token de PRIMERA acuñación, DETERMINISTA por workspace: HMAC(secret, ws).
 *
 * Por qué determinista y no aleatorio: /integraciones dispara varios renders
 * concurrentes, y con un token al azar cada pasada acuñaba uno distinto y
 * espejaba el suyo → N filas huérfanas en webhook_routing (medido: 8 cargas
 * concurrentes = 1 setting + 5 mapeos). Con un valor determinista la carrera
 * desaparece de raíz: todas las pasadas calculan el MISMO token, el setSetting
 * es un overwrite idempotente y el espejo apunta siempre a la misma fila. Sin
 * locks, sin reintentos (imposibles acá: Next memoiza los GET dentro de un
 * render, así que re-leer nunca vería al ganador).
 *
 * Sigue siendo impredecible desde afuera (HMAC con el secret del server), que es
 * todo lo que se le pide: el token no autoriza nada, solo identifica.
 *
 * OJO: esto solo acuña el PRIMER token. El valor guardado es la fuente de verdad
 * y nunca se recalcula (ver getOrCreateLandingToken), así que rotar AUTH_SECRET
 * NO cambia los tokens ya emitidos ni apaga la analítica de nadie.
 */
function tokenDeterminista(ws: number): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return generarLandingToken(); // sin secret, mejor azar que predecible
  return `mko_${createHmac('sha256', secret).update(`landing:${ws}`).digest('hex').slice(0, 32)}`;
}

/**
 * Token público de landing del workspace. Idempotente y a prueba de carreras.
 *
 * El valor GUARDADO es la fuente de verdad: si ya existe se devuelve tal cual (y
 * de paso se revive el espejo en webhook_routing si alguien borró la fila). Solo
 * si no hay nada se acuña, con un valor determinista para que N renders
 * concurrentes converjan al mismo token en vez de pisarse (ver
 * tokenDeterminista). Guardar va por setSetting, que espeja el routing solo.
 *
 * Se pinnea el workspace con runWithWorkspace porque getSetting/setSetting
 * resuelven el ws del request (cookies) y acá queremos el ws EXPLÍCITO.
 */
export async function getOrCreateLandingToken(ws: number): Promise<string> {
  return runWithWorkspace(ws, async () => {
    const actual = (await getSetting(LANDING_TOKEN_KEY))?.trim();
    if (actual) {
      await espejarSiHaceFalta(actual, ws);
      return actual;
    }
    const token = tokenDeterminista(ws);
    await setSetting(LANDING_TOKEN_KEY, token); // espeja a webhook_routing
    return token;
  });
}

/** Espeja token → ws en webhook_routing solo si el mapeo no está ya vivo. */
async function espejarSiHaceFalta(token: string, ws: number): Promise<void> {
  if ((await wsPorIdentificador(LANDING_SERVICIO, token)) !== ws) {
    await upsertRouting(LANDING_SERVICIO, token, ws);
  }
}

/**
 * ¿La landing de este workspace ya mandó al menos un evento? Es la señal HONESTA
 * de "conectada": el token existe para todos apenas abren /integraciones (se
 * genera solo), así que "tiene token" no prueba nada. Que haya llegado un
 * pageview sí prueba que el código está pegado y el ruteo funciona.
 *
 * Barato: 1 fila con LIMIT 1 sobre un índice, sin COUNT y sin ORDER. Lo corre
 * CADA carga de /integraciones (el semáforo del board) → se mantiene así de
 * chico a propósito. Si además necesitás CUÁNDO fue el último evento, usá
 * landingUltimoEvento(), que ordena y es a demanda.
 */
export async function landingRecibioEventos(): Promise<boolean> {
  try {
    const supabase = await getTenantDb(); // scopea landing_visits por workspace
    const { data, error } = await supabase.from('landing_visits').select('id').limit(1);
    if (error) {
      console.error(`[landing-token] chequeo de eventos falló: ${error.message}`);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error(`[landing-token] chequeo de eventos error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/** Resultado del "Verificar" de la landing: si llegó algo y cuándo fue lo último. */
export type LandingEstado = { recibio: boolean; ultima: string | null };

/**
 * Igual que landingRecibioEventos pero devolviendo la fecha del ÚLTIMO evento,
 * para que el "Verificar" del modal pueda decir "recibiendo eventos (última hace
 * X)" en vez de un sí/no pelado.
 *
 * Va aparte porque ordena (ORDER BY created_at DESC LIMIT 1) y esto se pide a
 * demanda —cuando el usuario toca el botón—, no en cada render del board.
 */
export async function landingUltimoEvento(): Promise<LandingEstado> {
  try {
    const supabase = await getTenantDb(); // scopea landing_visits por workspace
    const { data, error } = await supabase
      .from('landing_visits')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error(`[landing-token] último evento falló: ${error.message}`);
      return { recibio: false, ultima: null };
    }
    const ultima = (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
    return { recibio: ultima != null, ultima };
  } catch (err) {
    console.error(`[landing-token] último evento error: ${err instanceof Error ? err.message : String(err)}`);
    return { recibio: false, ultima: null };
  }
}

// URL absoluta de la app para el snippet (mismo patrón que lib/resend.ts).
const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://dashboard-marketing-six.vercel.app'
).replace(/\/+$/, '');

/**
 * El <script> que el usuario copia y pega en su landing. Autocontenido, sin
 * dependencias y con SU token embebido.
 *
 * El payload es EXACTAMENTE el que ya manda la landing hoy (ver
 * docs/lovable-tracking.md) + `t` (el token) — no inventamos contrato nuevo:
 *   · pageview → { tipo_evento:'pageview', landing_url, referrer }
 *   · VSL      → { tipo_evento:'play'|'pNN'|'exit', porcentaje, video_id, vsl_titulo }
 *   · Camino 1 → `l` (?l=<meta_lead_id> del link de WhatsApp), si viene.
 */
export function landingSnippet(token: string): string {
  return `<script>
(function () {
  var ENDPOINT = '${APP_BASE_URL}/api/track/vsl';
  var TOKEN = '${token}';

  // visitor_id anónimo, persistente (cookie de 1 año)
  function getCookie(n) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  var visitorId = getCookie('nqe_visitor_id');
  if (!visitorId) {
    visitorId = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    document.cookie = 'nqe_visitor_id=' + visitorId + '; max-age=31536000; path=/; SameSite=Lax';
  }
  var leadToken = new URLSearchParams(location.search).get('l') || null;

  function enviar(data) {
    data.t = TOKEN;
    data.visitor_id = visitorId;
    if (leadToken) data.l = leadToken;
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  // Visita a la landing
  enviar({ tipo_evento: 'pageview', landing_url: location.href, referrer: document.referrer || null });

  // VSL (Panda Video) — si no hay video en la página, esto no hace nada.
  function tituloVsl(id) {
    var f = document.querySelectorAll('iframe');
    for (var i = 0; i < f.length; i++) if (id && (f[i].src || '').indexOf(id) !== -1 && f[i].title) return f[i].title;
    for (var j = 0; j < f.length; j++) if (/pandavideo/i.test(f[j].src || '') && f[j].title) return f[j].title;
    return null;
  }
  var yaPlay = false, hitos = {}, pct = 0, dur = 0, vid = null, tit = null;

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object' || String(d.message || '').indexOf('panda_') !== 0) return;
    if (d.video || d.videoId) { vid = d.video || d.videoId; tit = tituloVsl(vid) || tit; }
    if (d.message === 'panda_play' && !yaPlay) {
      yaPlay = true;
      enviar({ tipo_evento: 'play', porcentaje: 0, video_id: vid, vsl_titulo: tit });
    }
    if (d.message === 'panda_timeupdate' && d.currentTime != null) {
      if (d.duration) dur = d.duration;
      if (!dur) return;
      pct = Math.min(100, Math.round((d.currentTime / dur) * 100));
      var h = Math.floor(pct / 5) * 5; // hito de retención cada 5%
      if (h >= 5 && !hitos[h]) {
        hitos[h] = true;
        enviar({ tipo_evento: 'p' + h, porcentaje: pct, video_id: vid, vsl_titulo: tit });
      }
    }
  });

  // Punto exacto de abandono
  var exitEnviado = false;
  function alSalir() {
    if (exitEnviado || !yaPlay) return;
    exitEnviado = true;
    enviar({ tipo_evento: 'exit', porcentaje: pct, video_id: vid, vsl_titulo: tit });
  }
  window.addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') alSalir();
  });
})();
</script>`;
}
