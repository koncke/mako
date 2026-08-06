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
// espeja setSetting('landing_token') (lib/settings.ts) — es el ÚNICO que se
// espeja desde ahí, porque lo acuña el server y no puede colisionar. Los
// identificadores que pega el usuario (page id de Meta, account id de Chatwoot,
// event types de Calendly) van por guardarCredencial(), que falla cerrado.
// =============================================================================

import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { getSetting, setSetting } from './settings';
import { getTenantDb, runWithWorkspace } from './workspace';
import { upsertRouting, wsPorIdentificador } from './webhook-routing';
import { APP_BASE_URL } from './app-url';

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

/** Días hacia atrás que definen "el tracking está VIVO". */
export const LANDING_VENTANA_DIAS = 3;

/**
 * ¿La landing de este workspace mandó eventos RECIENTES (últimos
 * LANDING_VENTANA_DIAS días)? Es la señal HONESTA de "conectada": el token existe
 * para todos apenas abren /integraciones (se genera solo), así que "tiene token"
 * no prueba nada, y "llegó algo alguna vez" tampoco — el snippet vive en una
 * propiedad de un tercero y puede dejar de mandar sin que nadie se entere.
 *
 * Barato: 1 fila con LIMIT 1 sobre un índice, sin COUNT y sin ORDER. Lo corre
 * CADA carga de /integraciones (el semáforo del board) → se mantiene así de
 * chico a propósito. Si además necesitás CUÁNDO fue el último evento, usá
 * landingUltimoEvento(), que ordena y es a demanda.
 */
export async function landingRecibioEventos(): Promise<boolean> {
  try {
    const supabase = await getTenantDb(); // scopea landing_visits por workspace
    // ⚠️ La VENTANA es lo que hace honesto al semáforo. Sin ella esto era un
    // `select id limit 1` sobre toda la historia: con una sola fila de 2024, la
    // landing quedaba en verde PARA SIEMPRE aunque el tracking estuviera muerto.
    // No es hipotético — hubo un apagón de 18 días (2026-07-15 → 08-03) con
    // anuncios corriendo, y este semáforo no podía detectarlo por construcción.
    const desde = new Date(Date.now() - LANDING_VENTANA_DIAS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('landing_visits').select('id').gte('created_at', desde).limit(1);
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

// ── Probador del tracking (el "Test Events" de MaKo) ────────────────────────
// El equivalente al Pixel Helper de Meta: el usuario pega el código, abre su
// landing, reproduce unos segundos del VSL y acá ve LLEGAR los eventos en vivo.
// Sin esto, "conectado" era un semáforo verde que solo probaba que ALGUNA VEZ
// llegó algo — y de hecho estuvo en verde 3 semanas mientras el VSL no medía nada.

export type EventoDiag = {
  ts: string;
  tipo: string;          // 'pageview' | 'play' | 'pNN' | 'sNN' | 'exit'
  porcentaje: number | null;
  segundos: number | null;
  detalle: string | null; // url de la landing o título del video
};

export type ChequeoDiag = {
  id: 'pageview' | 'play' | 'segundos' | 'profundidad';
  label: string;
  estado: 'ok' | 'falta' | 'viejo';
  detalle: string;
};

export type LandingDiagnostico = {
  eventos: EventoDiag[];
  chequeos: ChequeoDiag[];
  /** Resumen en una línea para el encabezado del panel. */
  veredicto: string;
  ultima: string | null;
};

/**
 * Últimos eventos + los 4 chequeos que importan. La ventana es corta a propósito
 * (24 h): "¿anda AHORA?" no se contesta con lo que llegó el mes pasado.
 */
export async function landingDiagnostico(): Promise<LandingDiagnostico> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [vsl, visitas] = await Promise.all([
    db.from('vsl_events').select('created_at, tipo_evento, porcentaje, segundos, vsl_titulo').gte('created_at', desde).order('created_at', { ascending: false }).limit(40),
    db.from('landing_visits').select('created_at, landing_url').gte('created_at', desde).order('created_at', { ascending: false }).limit(20),
  ]);

  const eventos: EventoDiag[] = [
    ...((vsl.data ?? []) as Array<{ created_at: string; tipo_evento: string | null; porcentaje: number | null; segundos: number | null; vsl_titulo: string | null }>)
      .map((r) => ({ ts: r.created_at, tipo: r.tipo_evento ?? 'evento', porcentaje: r.porcentaje, segundos: r.segundos, detalle: r.vsl_titulo })),
    ...((visitas.data ?? []) as Array<{ created_at: string; landing_url: string | null }>)
      .map((r) => ({ ts: r.created_at, tipo: 'pageview', porcentaje: null, segundos: null, detalle: r.landing_url })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 25);

  const hayPageview = eventos.some((e) => e.tipo === 'pageview');
  const hayPlay = eventos.some((e) => e.tipo === 'play');
  const conSegundos = eventos.filter((e) => e.tipo !== 'pageview' && e.segundos != null).length;
  const soloVsl = eventos.filter((e) => e.tipo !== 'pageview').length;
  const hayProfundidad = eventos.some((e) => /^[ps]\d+$/.test(e.tipo));

  const chequeos: ChequeoDiag[] = [
    { id: 'pageview', label: 'Llegan las visitas a la landing',
      estado: hayPageview ? 'ok' : 'falta',
      detalle: hayPageview ? 'El código está pegado y el ruteo funciona.' : 'No llegó ninguna visita en 24 h. Revisá que el código esté pegado y publicado.' },
    { id: 'play', label: 'Se detecta el play del VSL',
      estado: hayPlay ? 'ok' : 'falta',
      detalle: hayPlay ? 'El reproductor está enganchado.' : 'Nadie reprodujo el video en 24 h (o el player no es el que el código escucha).' },
    { id: 'segundos', label: 'El código es la versión nueva',
      estado: soloVsl === 0 ? 'falta' : conSegundos > 0 ? 'ok' : 'viejo',
      detalle: soloVsl === 0 ? 'Todavía no hay eventos del VSL para saberlo.'
        : conSegundos > 0 ? 'Manda los segundos vistos: con eso se calcula el % aunque el player no diga la duración.'
        : 'Los eventos llegan SIN segundos: la landing tiene el código viejo. Copiá el de arriba y reemplazalo.' },
    { id: 'profundidad', label: 'Se mide cuánto del VSL ven',
      estado: hayProfundidad ? 'ok' : soloVsl > 0 ? 'viejo' : 'falta',
      detalle: hayProfundidad ? 'Llegan los hitos de avance: la retención por lead se puede calcular.'
        : soloVsl > 0 ? 'Solo llega el arranque, no el avance. Con el código nuevo aparece al mirar más de 15 segundos.'
        : 'Todavía sin datos.' },
  ];

  const okCount = chequeos.filter((c) => c.estado === 'ok').length;
  const veredicto = okCount === 4 ? 'Todo funcionando'
    : okCount === 0 ? 'No está llegando nada'
    : `${okCount} de 4 chequeos OK`;

  return { eventos, chequeos, veredicto, ultima: eventos[0]?.ts ?? null };
}

/**
 * El <script> que el usuario copia y pega en su landing. Autocontenido, sin
 * dependencias y con SU token embebido.
 *
 * El payload es EXACTAMENTE el que ya manda la landing hoy (ver
 * docs/lovable-tracking.md) + `t` (el token) — no inventamos contrato nuevo:
 *   · pageview → { tipo_evento:'pageview', landing_url, referrer }
 *   · VSL      → { tipo_evento:'play'|'pNN'|'sNN'|'exit', porcentaje, segundos,
 *                  video_id, vsl_titulo }
 *   · Camino 1 → `l` (?l=<meta_lead_id> del link de WhatsApp), si viene.
 *
 * `segundos` (mig 0121) es el dato CRUDO y el que manda: el player de Panda no
 * le dice la duración al navegador en cada tick, así que el porcentaje se
 * deriva server-side. Los hitos 'sNN' son la red de seguridad por tiempo.
 *
 * ⚠️ El snippet queda CONGELADO en el HTML de la landing con el APP_BASE_URL
 * del día en que se copió: un arreglo acá NO llega solo a producción, hay que
 * volver a pegarlo. Así se perdieron 18 días de medición (15/jul → 3/ago 2026).
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
  // OJO — panda_timeupdate NO trae \`duration\`. Su payload es { message, video,
  // currentTime, isMutedIndicator, isPreviousProgressLoaded } y nada más. Ese
  // fue el bug que dejó la retención muerta del 15/jul al 5/ago de 2026: el
  // código hacía \`if (!dur) return;\` y salía en TODOS los eventos.
  // La duración solo llega por panda_allData, que el player emite cuando quiere
  // y que NO se le puede pedir (los mensajes que acepta del padre son play,
  // pause, currentTime, volume, speed, colors y fullscreen — ninguno de
  // lectura). Por eso acá se mandan SIEMPRE los segundos absolutos y el % se
  // deriva en el servidor con la duración que ya da la API de Panda.
  var yaPlay = false, hitos = {}, seg = {}, pct = 0, dur = 0, segs = 0, vid = null, tit = null;
  // Escalera de segundos: la red de seguridad cuando no se conoce la duración.
  // Doce puntos hasta los 40 minutos — alcanza para reconstruir la curva
  // server-side sin inundar el endpoint.
  var ESCALERA = [15, 30, 60, 120, 180, 300, 420, 600, 900, 1200, 1800, 2400];

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object' || String(d.message || '').indexOf('panda_') !== 0) return;
    if (d.video || d.videoId) { vid = d.video || d.videoId; tit = tituloVsl(vid) || tit; }
    // Único mensaje que trae la duración. El guard > 0 es obligatorio: el player
    // la emite una vez con duration 0 antes de tener metadata, y pisarla con 0
    // reintroduce el bug entero.
    if (d.message === 'panda_allData' && d.playerData && d.playerData.duration > 0) {
      dur = d.playerData.duration;
    }
    if (d.message === 'panda_play' && !yaPlay) {
      yaPlay = true;
      enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: vid, vsl_titulo: tit });
    }
    if (d.message === 'panda_timeupdate' && d.currentTime != null) {
      segs = d.currentTime;
      if (dur > 0) {
        pct = Math.min(100, Math.round((segs / dur) * 100));
        var h = Math.floor(pct / 5) * 5; // hito de retención cada 5%
        if (h >= 5 && !hitos[h]) {
          hitos[h] = true;
          enviar({ tipo_evento: 'p' + h, porcentaje: pct, segundos: segs, video_id: vid, vsl_titulo: tit });
        }
        return;
      }
      // Sin duración: se marca por TIEMPO. El servidor lo convierte a % después.
      for (var i = 0; i < ESCALERA.length; i++) {
        var s = ESCALERA[i];
        if (segs >= s && !seg[s]) {
          seg[s] = true;
          enviar({ tipo_evento: 's' + s, segundos: segs, video_id: vid, vsl_titulo: tit });
        }
      }
    }
  });

  // Punto exacto de abandono
  var exitEnviado = false;
  function alSalir() {
    if (exitEnviado || !yaPlay) return;
    exitEnviado = true;
    // Los segundos van SIEMPRE; el % solo si se pudo calcular.
    enviar({ tipo_evento: 'exit', porcentaje: dur > 0 ? pct : null, segundos: segs, video_id: vid, vsl_titulo: tit });
  }
  window.addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') alSalir();
  });
})();
</script>`;
}
