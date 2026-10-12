// =============================================================================
// Tracking del VSL — recibe eventos de la landing del CLIENTE (Lovable, etc.)
// =============================================================================
// La landing manda acá la visita y la profundidad de visualización del VSL:
//   { t, visitor_id, tipo_evento: 'pageview'|'play'|'pNN'(cada 5%)|'sNN'|'exit',
//     porcentaje, segundos, video_id }
// 'exit' lleva el punto EXACTO de abandono. Compat: payload viejo { event, play_count }.
//
// PROFUNDIDAD (mig 0121): el player de Panda NO le dice la duración al navegador
// en cada tick (panda_timeupdate trae currentTime y nada más), así que el dato
// que manda es `segundos` y el % se deriva server-side con la duración de la API
// de Panda. Los hitos 'sNN' son la red de seguridad por tiempo para cuando el
// navegador nunca supo la duración. Un 'exit' sin porcentaje NO es 0%: es
// desconocido, y se guarda NULL — confundir las dos cosas fue justamente lo que
// hizo que 18 días sin medición parecieran 18 días de gente que no miraba.
//
// RUTEO (lo que hace multi-tenant a este beacon): `t` es el token público de
// landing del workspace (mko_ + 32 hex), que el usuario copia de /integraciones
// → Landing y pega en su landing. webhook_routing('landing', t) → workspace_id,
// el mismo índice de plataforma que usan los webhooks de Meta/Calendly.
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
import { runWithWorkspace, getTenantDb, wsEnContexto } from '@/lib/workspace';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { mensajeDeError } from '@/lib/calendly-error';
import { LANDING_SERVICIO, SNIPPET_VERSION_KEY } from '@/lib/landing-token';
import { VERSIONES_POR_PAGINA_KEY, anotarVersionDePagina, clavePagina, parsearMapaVersiones } from '@/lib/pixel-aviso';
import { REPLAY_CONFIG_KEY, REPLAY_LIB_VERSION, grabaA, parsearReplay } from '@/lib/replay-contrato';
import { getSetting, setSetting } from '@/lib/settings';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { canonizarVideoId } from '@/lib/video-id';
import { esPreviewDeEditor } from '@/lib/landing-paginas';
import { alVisitarPagina } from '@/lib/landing-gracias';
import { ubicacionDeHeaders, type UbicacionVisita } from '@/lib/graficos-datos-puro';
import { PUENTE_MAPA_VERSION, esPruebaDelMapa } from '@/lib/landing-mapa-puente';

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

/**
 * La vista previa del constructor o la máquina de quien arma la página: las dos son el dueño
 * probando, no un visitante. Ni votan la versión del snippet ni ganan a nadie en una página de
 * gracias. Una sola regla para los dos usos.
 */
const esVistaDePrueba = (url: string): boolean =>
  esPreviewDeEditor(url) || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

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

/**
 * Deja anotado qué VERSIÓN del snippet tiene puesta este cliente.
 *
 * Es el único lugar del sistema donde se puede saber: el código vive en una
 * página de un tercero y no hay forma de leerlo desde acá. Sin esto, un snippet
 * viejo se ve idéntico a uno al día —los eventos siguen llegando y la integración
 * queda en verde— y una mejora nunca le llega a quien ya lo tenía pegado.
 *
 * Solo escribe cuando el número CAMBIA: el beacon corre en cada visita y un
 * setSetting por evento sería escribir miles de veces lo mismo.
 *
 * Un snippet sin `sv` es de la v1 (anterior al versionado). Se anota como 1 y no
 * como «desconocido»: es exactamente el que hay que avisarle que actualice.
 *
 * ⚠️ NI EL EDITOR NI LOCALHOST ANOTAN (06/10/2026). La versión es del WORKSPACE y
 * gana el último evento, así que una visita desde la vista previa del constructor
 * —que suele correr el código viejo un rato más— la bajaba de nuevo después de
 * que la página publicada ya mandaba la nueva. Medido en el ws1: v14 desde el
 * preview a las 03:28 y v21 desde la página a las 03:30. Con el aviso fijo de «tu
 * Pixel quedó viejo» que se apoya en este número, eso era prenderle el aviso a
 * quien ya repegó. Lo que se mide de esas visitas no cambia: sólo no votan.
 */
async function anotarVersionSnippet(sv: unknown, landingUrl?: unknown, tipo?: unknown): Promise<void> {
  const url = typeof landingUrl === 'string' ? landingUrl : '';
  if (url && esVistaDePrueba(url)) return;
  const n = Number(sv);
  const version = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  // ⚠️ Y LA DE CADA PÁGINA, sólo en el pageview (06/10/2026). El setting de arriba es
  // del workspace y gana el último evento: con dos páginas en versiones distintas, el
  // aviso fijo de «Actualiza el Pixel» se prendía y se apagaba según qué página recibió
  // la última visita. El mapa por página es lo que lee `estadoPixel` (lib/pixel-estado.ts).
  // En el pageview y no en cada evento: la versión no cambia a mitad de una visita, y
  // así es una lectura más por página vista y no por clic.
  if (tipo === 'pageview') {
    const clave = clavePagina(url);
    if (clave) {
      const nuevo = anotarVersionDePagina(parsearMapaVersiones(await getSetting(VERSIONES_POR_PAGINA_KEY)), clave, version, new Date().toISOString());
      if (nuevo) await setSetting(VERSIONES_POR_PAGINA_KEY, JSON.stringify(nuevo));
    }
  }
  const guardada = Number(await getSetting(SNIPPET_VERSION_KEY));
  if (guardada === version) return;
  await setSetting(SNIPPET_VERSION_KEY, String(version));
}

type Payload = {
  t?: unknown;           // token público de landing (mko_…) → workspace
  sv?: unknown;          // versión del snippet instalado (ver SNIPPET_VERSION)
  ws_token?: unknown;    // alias de `t`
  visitor_id?: unknown;
  tipo_evento?: unknown;
  porcentaje?: unknown;  // % del video; puede faltar (el player no siempre da la duración)
  segundos?: unknown;    // currentTime del player: el dato CRUDO del que se deriva el % (mig 0121)
  video_id?: unknown;    // id del video de Panda (pruebas A/B de VSL)
  vsl_titulo?: unknown;
  /** A qué apunta el evento: el destino de un click, o la URL de un video. */
  detalle?: unknown;
  /** true = el video arrancó SOLO (autoplay), sin que nadie lo pidiera. */
  auto?: unknown;
  // ── El PUNTO del clic (mig 0190, snippet v20) ──────────────────────────────
  // Las cuatro viajan juntas o no viajan: un punto sin el ancho de la ventana no
  // se puede ubicar sobre una captura, así que por separado no sirven de nada.
  clic_x?: unknown;        // posición en la PÁGINA, no en la ventana
  clic_y?: unknown;
  ancho_ventana?: unknown; // ancho del viewport en px CSS
  alto_pagina?: unknown;   // alto del documento en px CSS
  // ── El ANCLA del clic (mig 0201, snippet v22) ───────────────────────────────
  // El punto de página no alcanza para ubicar un toque sobre una foto: el alto del
  // documento varía hasta un 32% en la misma página y el mismo ancho. El elemento
  // tocado sí se ubica igual en cualquier foto donde exista.
  sel?: unknown;           // ruta CSS corta del elemento, SIN texto
  rel_x?: unknown;         // dónde dentro de su caja, en milésimos (0..1000)
  rel_y?: unknown;
  alto_ventana?: unknown;  // alto del viewport: la línea del pliegue
  fijo?: unknown;          // el elemento (o un ancestro) es fixed/sticky
  /** Marcador de sesión de prueba (?mko_test=). NULL en el tráfico real. */
  prueba?: unknown;  // título del video de Panda, si la landing lo puede leer
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

  // ⚠️ ESTRICTA (07/10/2026): con `wsPorIdentificador` la base caída daba null y el evento caía
  // abajo con un log que manda a revisar el código de la landing. Sin reintento a propósito: es
  // medición de alto volumen, y en un corte reintentar cada beacon es sumarle carga a la base.
  // Se pierde el evento y el log dice por qué; el snippet no lee la respuesta.
  let ws: number | null = null;
  if (token && TOKEN_RE.test(token)) {
    try {
      ws = await wsPorIdentificadorEstricto(LANDING_SERVICIO, token);
    } catch (err) {
      console.error(`[track:vsl] no pude leer de quién es el token (la base no contestó): evento perdido — ${mensajeDeError(err)}`);
      return Response.json({ ok: false, error: 'ruteo' }, { status: 503, headers: CORS_HEADERS });
    }
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

  // DE DÓNDE VIENE LA VISITA (mig 0262, decisión de Martín del 12/10/2026): país, región y ciudad, más la
  // latitud y longitud redondeadas, de los headers que agrega Vercel (`x-vercel-ip-*`). ⚠️ NUNCA LA IP: la
  // de arriba (`clientIp`) es sólo para el anti-flood y no se guarda en ningún lado. Se lee acá, afuera del
  // workspace, porque es del PEDIDO; sólo se escribe en la visita (el pageview).
  const ubicacion = ubicacionDeHeaders((n) => request.headers.get(n));

  // Desde acá, TODA escritura cae en el workspace dueño de la landing.
  return runWithWorkspace(ws, async () => {
    // Qué VERSIÓN del snippet tiene puesta este cliente. Es el único lugar del
    // sistema donde se puede saber: el código vive en una página de un tercero y
    // no hay forma de leerlo. Sin esto, un snippet viejo se ve idéntico a uno al
    // día —los eventos llegan igual y la integración queda en verde— y una mejora
    // no le llega nunca a quien ya lo tenía pegado. Best-effort: nunca rompe el
    // beacon, que es lo que de verdad importa.
    void anotarVersionSnippet(payload.sv, payload.landing_url, payload.tipo_evento).catch(() => {});
    return procesar(payload, visitorId, ip, ubicacion);
  });
}

/**
 * ¿El insert falló porque una COLUMNA no existe? (`42703` en Postgres, `PGRST204` en PostgREST.) Es lo que
 * pasa si este código sale antes de la mig 0262: la visita se reintenta SIN la ubicación en vez de perderse.
 */
const columnaFaltante = (e: { code?: string; message?: string } | null): boolean =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(e.message ?? ''));

// Todo lo que escribe. Corre SIEMPRE dentro de runWithWorkspace.
async function procesar(payload: Payload, visitorId: string, ip: string, ubicacion: UbicacionVisita | null = null): Promise<Response> {
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

  // Un píxel: entero, no negativo y por debajo de un techo generoso.
  //
  // ⚠️ FUERA DE RANGO DEVUELVE NULL, NO EL TOPE. Acotar un 999999 a 500000 pone un
  // punto en un lugar donde nadie hizo clic, y un punto inventado en un mapa de
  // calor es indistinguible de uno real. NULL dice lo único que sabemos: que ese
  // número no sirve.
  const pixel = (v: unknown, max: number): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null;

  // Una posición DENTRO de un elemento, en milésimos. Fuera de 0..1000 no es un
  // redondeo de más: es otra cosa, y se guarda NULL por la misma razón que pixel().
  const milesimo = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000 ? Math.round(v) : null;

  // La ruta CSS del elemento tocado. El snippet la arma con etiquetas,
  // :nth-of-type(n), #id y « > »; cualquier carácter fuera de esa forma es un
  // payload que no salió del snippet (el beacon es público), y no se guarda.
  const selector = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!s || s.length > 200) return null;
    return /^[A-Za-z0-9 >#:()_-]+$/.test(s) ? s : null;
  };

  // Visita a la landing → tabla propia (landing_visits), NO vsl_events.
  // Se intercepta antes de la coerción a 'play' de tipos desconocidos.
  if (tipoEvento === 'pageview') {
    try {
      const supabase = await getTenantDb();
      // La ubicación va en el MISMO insert sólo si vino, y si la mig 0262 todavía no está, la visita se reintenta
      // SIN ella (`columnaFaltante`): es el modo de falla que ya costó los pageviews de producción —una columna que
      // no existe tira la fila ENTERA—, y una visita vale más que su ubicación.
      const insertarVisita = (conUbicacion: boolean) => supabase.from('landing_visits').insert({
        visitor_id: visitorId,
        // URL exacta de la landing (multi-landing / pruebas A/B) + referrer.
        landing_url: texto(payload.landing_url, 500),
        referrer: texto(payload.referrer, 500),
        prueba: texto(payload.prueba, 40),
        // ⚠️ ACÁ NO VA `auto`. Una VISITA no se reproduce sola: el autoplay es una
        // propiedad del play, y su columna vive en `vsl_events` (mig 0136), no en
        // esta tabla. Escribirlo acá hizo fallar el insert entero —Postgres
        // rechaza la fila por una columna que no existe— y los pageviews de
        // producción dejaron de guardarse: llegaban los plays y ninguna visita.
        // El chequeo «1. Llega a tu página» se apagó sobre una landing que estaba
        // recibiendo tráfico pago en ese mismo momento.
        // La versión POR PÁGINA (mig 0135). El setting `landing.snippet_version`
        // guarda una sola por workspace —la del último evento, venga de donde
        // venga—, y con dos landings publicadas eso no puede contestar «¿cuál de
        // las dos quedó vieja?».
        sv: Number.isFinite(Number(payload.sv)) ? Math.trunc(Number(payload.sv)) : null,
        // DE DÓNDE (mig 0262): país, región, ciudad y las coordenadas redondeadas. NUNCA la IP.
        ...(conUbicacion && ubicacion ? { pais: ubicacion.pais, region: ubicacion.region, ciudad: ubicacion.ciudad, lat: ubicacion.lat, lon: ubicacion.lon } : {}),
      });
      let { error } = await insertarVisita(true);
      if (error && ubicacion && columnaFaltante(error)) {
        console.warn('[track:vsl] landing_visits sin las columnas de ubicación (mig 0262): la visita va sin ella');
        ({ error } = await insertarVisita(false));
      }
      if (error) console.error(`[track:vsl] landing_visits insert falló: ${error.message}`);
    } catch (err) {
      console.error(`[track:vsl] landing_visits error: ${err instanceof Error ? err.message : String(err)}`);
    }
    // ── La página de GRACIAS → Ganado (lib/landing-gracias.ts) ────────────────
    // «Si alguien cae en una TKY Page, se pueda automatizar pasar al lead a Ganado» (Martín,
    // 07/10/2026). Después del insert —la visita ya quedó— y sin esperar el movimiento: acá sólo
    // se pregunta si la página está marcada (una lectura) y el resto va por detrás. Nunca tira.
    // ⚠️ El editor y localhost no ganan a nadie: son las vistas del dueño probando su página.
    // ⚠️ LA VISITA DEL MAPA EN VIVO (`?mko_test=mapa-…`) ES DE MaKo, no de una persona: no gana a nadie ni deja
    // un «llegó a gracias sin lead» en la página del cliente. Sin página, la pregunta de abajo no se hace.
    const pruebaDelMapa = esPruebaDelMapa(payload.prueba);
    const pagina = pruebaDelMapa ? null : texto(payload.landing_url, 500);
    const wsVisita = wsEnContexto();
    if (pagina && wsVisita != null && !esVistaDePrueba(pagina)) {
      await alVisitarPagina({ ws: wsVisita, visitorId, landingUrl: pagina });
    }
    // ── El interruptor de la grabación de sesión ──────────────────────────────
    // ⚠️ VIAJA EN ESTA RESPUESTA, no en un request propio. El snippet ya manda el
    // pageview en su primera línea, así que preguntar «¿grabo?» por separado sería
    // una llamada más por visita para contestar algo que acá ya sabemos.
    //
    // ⚠️ Y LO DECIDE EL SERVIDOR, SIEMPRE. El código pegado en la página de un
    // cliente no decide nada —la misma regla que ya cumple el opt-in—, y mientras
    // esto no conteste, el grabador ni se baja: lo que se ahorra no es el tiempo de
    // grabar, es la descarga. El muestreo también se resuelve acá, porque es
    // DETERMINISTA sobre el visitor_id (`grabaA`): con Math.random() del lado del
    // navegador la misma persona entra en la landing y queda afuera en la página de
    // gracias, y media sesión guardada es peor que ninguna.
    //
    // ⚠️ Lo único que viaja es la VERSIÓN de la librería. Las opciones de privacidad
    // no se mandan: si el permiso para tapar los campos viniera por la red, un
    // día va a venir mal. Viven en el snippet, que no las lee de ningún lado.
    //
    // Best-effort y después del insert: un setting ilegible no puede costar la
    // visita, que es el dato que de verdad importa.
    let rec: { v: number } | null = null;
    // ⚠️ EL MAPA DE CALOR EN VIVO (12/10/2026): a una visita de prueba del mapa se le contesta el PUENTE, no el
    // grabador (lib/landing-mapa-puente.ts). El r.js del puente no graba —a quien mira el mapa no se lo guarda
    // como una sesión del cliente— y contesta por postMessage, sólo a MaKo, dónde está cada cosa de la página.
    // No depende del interruptor de la grabación: el puente no graba nada, y sin él el mapa cae a la foto.
    // A cualquier otra visita, lo de siempre: el r.js de los visitantes de verdad NO cambia.
    if (pruebaDelMapa) return json({ ok: true, rec: { v: PUENTE_MAPA_VERSION } });
    try {
      const cfg = parsearReplay(await getSetting(REPLAY_CONFIG_KEY));
      if (grabaA(cfg, visitorId)) rec = { v: REPLAY_LIB_VERSION };
    } catch (err) {
      console.error(`[track:vsl] landing.replay ilegible: ${err instanceof Error ? err.message : String(err)}`);
    }
    return json({ ok: true, rec });
  }

  if (!tipoEvento) tipoEvento = 'play';

  // tipo_evento válido: 'play' | 'exit' | 'pNN' (1..100) | 'sNN' (segundo NN).
  // 'pNN' = hito de retención al cruzar NN% (la landing los manda cada 5%);
  // 'sNN' = red de seguridad por TIEMPO, para cuando el navegador no pudo saber
  // la duración del video (ver mig 0121): trae los segundos y el % se deriva
  // server-side. 'exit' = punto EXACTO de abandono.
  const milestoneMatch = /^p(\d{1,3})$/.exec(tipoEvento);
  const segundoMatch = /^s(\d{1,5})$/.exec(tipoEvento);
  // Los tipos que el snippet puede emitir. Sumar uno acá es obligatorio: sin
  // esto entra como 'desconocido' y se pierde con un nombre que no dice nada.
  // 'salio'/'volvio'/'cierre' son de la PAGINA, no del video: la pestaña dejó de
  // estar a la vista, volvió, o se cerró. Distinto de 'exit', que es el punto de
  // abandono DEL video.
  // 'scroll' (snippet v19) es de la PAGINA y viaja en `porcentaje`: hasta donde
  // bajo la persona. No entra a la retencion del video — eso lo corta
  // `esEventoDeVideo`, que es lista blanca — pero sin estar ACA se guardaba como
  // 'desconocido' y el dato quedaba con un nombre que no dice nada.
  // 'clic_vacio' (snippet v20) es un toque en algo que NO es boton ni enlace, y
  // tiene tipo propio a proposito: todo lo que hoy cuenta 'click' —el chequeo «hace
  // clic en tus botones», el pulso de la pagina, el recorrido del lead— cuenta
  // llamados a la accion del negocio, y un toque en una foto no es uno. Con una
  // marca adentro del 'click', ese chequeo se pondria verde porque alguien toco una
  // imagen. Lo que SI lo lee es el mapa de calor, que es donde ese toque es el dato
  // mas util que hay.
  const CONOCIDOS = ['play', 'exit', 'click', 'clic_vacio', 'scroll', 'pausa', 'retoma', 'fin', 'agendo', 'salio', 'volvio', 'cierre'];
  if (!CONOCIDOS.includes(tipoEvento) && !milestoneMatch && !segundoMatch) {
    // Antes esto caía a 'play' en silencio, y así un tipo desconocido inflaba
    // los plays sin dejar rastro. Se guarda como lo que es y se avisa: un
    // contrato que cambia del lado de la landing tiene que ser VISIBLE.
    console.warn(`[track:vsl] tipo_evento desconocido: ${tipoEvento.slice(0, 40)}`);
    tipoEvento = 'desconocido';
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

  // Segundos absolutos vistos (currentTime del player). Es el dato del que se
  // deriva la retención cuando el navegador no conoce la duración — mig 0121.
  const segundos =
    typeof payload.segundos === 'number' && Number.isFinite(payload.segundos)
      ? Math.max(0, Math.round(payload.segundos * 100) / 100)
      : segundoMatch
        ? Number(segundoMatch[1])
        : null;

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
      segundos,
      play_count: playCount,
      // Multi-VSL (pruebas A/B desde Panda): id del video + título si la landing
      // lo puede leer. Antes video_id llegaba en el payload y se descartaba.
      // ⚠️ CANONIZADO ACÁ, y es el único lugar del repo que escribe esta columna.
      // El snippet tiene dos ramas que pueden medir el MISMO reproductor y le ponen
      // dos ids distintos (el nombre de la etiqueta y el id de la media). Arreglar el
      // snippet no alcanza: va PEGADO en la página del cliente, y al 27/09/2026 ningún
      // cliente corría la versión con el arreglo — el ws1 estaba en la v14 con 3.304
      // visitas. Canonizar acá es lo único que cubre a quien no repegó el código.
      video_id: canonizarVideoId(payload.video_id),
      vsl_titulo: texto(payload.vsl_titulo, 200),
      // A QUÉ APUNTA este evento (mig 0133). En un 'click', el destino o el texto
      // del botón; en un 'play', la URL del video. No son dos usos de un mismo
      // campo: es una sola pregunta —«¿a qué se refiere esto?»— contestada por
      // cada tipo de evento con lo suyo. En los demás queda NULL, que es la
      // verdad: un default inventaría un dato.
      detalle: texto(payload.detalle, 300),
      // DÓNDE se hizo el clic (mig 0190, snippet v20). Es lo único que le faltaba
      // al clic para poder DIBUJARSE: hasta la v19 se guardaba a dónde iba y nunca
      // en qué punto se hizo. La posición es de la PÁGINA, no de la ventana, y va
      // con el ancho del viewport y el alto del documento porque sin ellos un punto
      // de un celular no se puede ubicar sobre la captura de un escritorio.
      //
      // NULL en todo lo que no es un clic, y también en los clics de un Pixel
      // anterior a la v20 o en los que un script disparó por código (sin punto
      // real). Las cuatro son nulables y sin default por lo mismo que `auto` y
      // `landing_url`: un 0 no es «no se sabe», es una mancha en la esquina de
      // arriba a la izquierda que nadie hizo.
      clic_x: pixel(payload.clic_x, 50_000),
      clic_y: pixel(payload.clic_y, 500_000),
      ancho_ventana: pixel(payload.ancho_ventana, 50_000),
      alto_pagina: pixel(payload.alto_pagina, 500_000),
      // EL ANCLA (mig 0201, snippet v22): el elemento tocado y dónde dentro de él.
      // Es lo que ubica un toque sobre una foto de la página sin depender del alto
      // del documento. El selector viaja SIN texto por diseño del snippet; acá se
      // sanea igual por forma, porque el beacon es público: sólo caracteres de una
      // ruta CSS, y si trae otra cosa no se guarda (NULL), no se recorta.
      sel: selector(payload.sel),
      rel_x: milesimo(payload.rel_x),
      rel_y: milesimo(payload.rel_y),
      alto_ventana: pixel(payload.alto_ventana, 50_000),
      // NULL —y no false— cuando no viene: un Pixel anterior a la v22 no lo midió.
      fijo: payload.fijo === true ? true : payload.fijo === false ? false : null,
      prueba: texto(payload.prueba, 40),
      // De qué página vino ESTE evento (mig 0137, snippet v12). Antes solo lo
      // decían las visitas, así que con dos landings los videos y los clics de
      // las dos caían en la misma bolsa. NULL en los eventos de un Pixel anterior
      // a la v12: no se sabe, y no se inventa.
      landing_url: texto(payload.landing_url, 500),
      // ⚠️ Un play automático NO es una reproducción (mig 0136). Se guarda como
      // tal para que el chequeo y la retención puedan descartarlo: con autoplay,
      // contar todo play como intención infla el embudo desde el primer escalón.
      // NULL —y no `false`— cuando no viene: las filas anteriores a la v11 no
      // saben si hubo interacción, y decir `false` afirmaría que la hubo.
      auto: payload.auto === true ? true : null,
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
      usage:
        "POST { t: 'mko_…', visitor_id, tipo_evento: 'pageview'|'play'|'p10'..'p100'|'s30'..'s2400'|'exit', porcentaje, segundos, video_id }",
    },
    { headers: CORS_HEADERS },
  );
}
