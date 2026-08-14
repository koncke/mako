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
import { VIDEOS_KEY, parsearVideos, type VideoLanding } from './landing-videos';
import { normalizarUrl } from './landing-paginas';

/** Key en app_settings. setSetting la espeja a webhook_routing('landing', …). */
export const LANDING_TOKEN_KEY = 'landing_token';

/**
 * VERSIÓN DEL SNIPPET. Subila cada vez que cambie `landingSnippet()`.
 *
 * ⚠️ El snippet queda CONGELADO en el HTML del cliente el día que lo copia, así
 * que un cambio acá NO llega solo: hay que avisarle y que lo vuelva a pegar. Sin
 * una versión, no hay forma de saber quién quedó viejo — y la integración sigue
 * en VERDE, porque los eventos del código viejo llegan igual. Eso ya costó 18
 * días de medición muerta (15/jul → 3/ago 2026) y nadie se enteró.
 *
 * El número viaja en cada evento (`sv`), el beacon lo guarda en
 * `landing.snippet_version`, y el cron `tracking-vigilante` avisa por WhatsApp
 * cuando el instalado se quedó atrás.
 *
 * Historial:
 *   1 — medición de landing + VSL (pageview, play, hitos, exit).
 *   2 — se suma la captura del formulario de opt-in (13/08/2026).
 *   3 — ⚠️ la v2 salió MUDA: al insertar la línea de la versión se perdió la
 *       interpolación del token (`var TOKEN = ''`), así que ese snippet no
 *       identifica el workspace y el beacon lo descarta fail-closed. Quien haya
 *       copiado durante esas horas tiene una landing que no mide ni captura
 *       nada. Se sube la versión para poder avisarle.
 *   4 — la escalera de avance arranca a los 3 s: con el primer escalón en 15, un
 *       video de 10 segundos no registraba UN solo avance (14/08/2026).
 *   5 — el estado del player pasa a ser POR VIDEO. Era uno global para toda la
 *       página, así que una landing con dos videos no medía dos curvas mezcladas:
 *       medía mal la segunda. Ver el comentario de `est()` en el snippet.
 */
export const SNIPPET_VERSION = 5;

/** Key en app_settings donde el beacon deja la versión que el cliente TIENE puesta. */
export const SNIPPET_VERSION_KEY = 'landing.snippet_version';

/**
 * ¿El código pegado en la landing de este workspace se quedó atrás?
 *
 * Lee lo que anotó el beacon. Un workspace del que nunca se anotó nada se trata
 * como v1: es el caso de todos los que pegaron el código antes de que existiera
 * el versionado, y son exactamente a quienes hay que avisarles.
 *
 * `false` si no hay token acuñado: sin código pegado no hay nada que actualizar,
 * y decirle a alguien que actualice algo que nunca instaló es ruido.
 */
export async function snippetDesactualizado(): Promise<{ viejo: boolean; instalada: number }> {
  const token = (await getSetting(LANDING_TOKEN_KEY))?.trim();
  if (!token) return { viejo: false, instalada: 0 };
  const instalada = Number(await getSetting(SNIPPET_VERSION_KEY)) || 1;
  return { viejo: instalada < SNIPPET_VERSION, instalada };
}

/**
 * Qué se pierde quien quedó en una versión vieja, para poder DECÍRSELO.
 *
 * Un aviso que solo dice «actualizá» es una tarea sin motivo, y una tarea sin
 * motivo no la hace nadie — menos todavía cuando lo que tiene puesto parece
 * andar. Al subir SNIPPET_VERSION, sumá su renglón acá.
 */
const NOVEDADES: Record<number, string> = {
  2: 'la captura automática del formulario de tu landing (quien lo completa te entra al CRM)',
  3: 'un arreglo del código: la versión anterior salió sin identificador y dejó de medir y de capturar',
  4: 'la medición de videos CORTOS: antes, uno de menos de 15 segundos no registraba ningún avance',
  5: 'la medición de TODOS los videos de la página por separado: antes, si tenías más de uno, el segundo casi no medía y su avance se calculaba con la duración del primero',
};

export function novedadesDesde(instalada: number): string {
  const l = Object.entries(NOVEDADES).filter(([v]) => Number(v) > instalada).map(([, t]) => t);
  return l.join(' · ') || 'mejoras de medición';
}

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
export type LandingEstado = { recibio: boolean; ultima: string | null; codigoViejo?: boolean };

/**
 * Igual que landingRecibioEventos pero devolviendo la fecha del ÚLTIMO evento,
 * para que el "Verificar" del modal pueda decir "recibiendo eventos (última hace
 * X)" en vez de un sí/no pelado.
 *
 * Va aparte porque ordena (ORDER BY created_at DESC LIMIT 1) y esto se pide a
 * demanda —cuando el usuario toca el botón—, no en cada render del board.
 */
/**
 * El catálogo de videos que declaró el negocio: qué es cada `video_id`.
 *
 * Lo consume el CRM para rotular la retención de cada video. Degrada a lista
 * vacía porque un catálogo caído NO puede tapar la medición: sin nombres, las
 * curvas se muestran igual rotuladas con el id, que es feo pero verdadero.
 */
export async function getVideosLanding(): Promise<VideoLanding[]> {
  try {
    return parsearVideos(await getSetting(VIDEOS_KEY));
  } catch (e) {
    console.error('[getVideosLanding] falló:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Los videos que se VIERON en los eventos, para poder ofrecerlos y nombrarlos.
 *
 * El catálogo de arriba es lo que la persona declaró; esto es lo que el sistema
 * observó. Son cosas distintas y la pantalla las ofrece por separado, igual que
 * con las páginas: una detectada es una observación, y nombrarla la adopta.
 *
 * ⚠️ El `video_id` no siempre es un id de Panda. Cuando el player no se
 * identifica, el snippet cae a `iframe0`/`iframe1` por posición, y el `exit` de
 * un video anónimo llega con null. Los null se descartan acá —no se pueden
 * nombrar, porque el nombre no tendría a qué pegarse— pero sus eventos siguen
 * contándose en el CRM bajo «Video sin identificar».
 */
export async function videosDetectados(dias = 90): Promise<Array<{ id: string; titulo: string | null; eventos: number }>> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  try {
    const db = await getTenantDb();
    const { data } = await db
      .from('vsl_events')
      .select('video_id, vsl_titulo')
      .not('video_id', 'is', null)
      .gte('created_at', desde)
      .limit(2000);
    const out = new Map<string, { id: string; titulo: string | null; eventos: number }>();
    for (const r of (data ?? []) as Array<{ video_id: string | null; vsl_titulo: string | null }>) {
      const id = r.video_id?.trim();
      if (!id) continue;
      const e = out.get(id) ?? { id, titulo: null, eventos: 0 };
      e.eventos++;
      // El título del player viene en unos eventos y no en otros: gana el primero
      // que llegue en vez de pisarse con null a mitad de camino.
      if (!e.titulo && r.vsl_titulo?.trim()) e.titulo = r.vsl_titulo.trim();
      out.set(id, e);
    }
    // El más visto primero: es el que más probablemente sea el VSL, así que es el
    // que conviene tener arriba cuando hay que elegir.
    return [...out.values()].sort((a, b) => b.eventos - a.eventos);
  } catch (e) {
    console.error('[videosDetectados] falló:', e instanceof Error ? e.message : e);
    return [];
  }
}

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
      return { recibio: false, ultima: null, codigoViejo: false };
    }
    const ultima = (data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
    // «Verificar» decía «✓ Recibiendo eventos» y se quedaba ahí, aunque el código
    // pegado fuera de una versión anterior: el botón que la persona aprieta para
    // saber si está todo bien contestaba que sí sobre un snippet que le está
    // faltando la mitad. La versión viaja en cada evento, así que se dice.
    const { viejo } = await snippetDesactualizado();
    return { recibio: ultima != null, ultima, codigoViejo: viejo };
  } catch (err) {
    console.error(`[landing-token] último evento error: ${err instanceof Error ? err.message : String(err)}`);
    return { recibio: false, ultima: null, codigoViejo: false };
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
  id: 'pageview' | 'version' | 'optin' | 'play' | 'profundidad';
  label: string;
  estado: 'ok' | 'falta' | 'viejo';
  detalle: string;
  /** Adónde ir a resolverlo. El href lo arma el server con el id real: un
   *  chequeo que dice «tenés 8 sin revisar» sin decir dónde no es accionable. */
  accion?: { texto: string; href: string };
};

export type LandingDiagnostico = {
  eventos: EventoDiag[];
  chequeos: ChequeoDiag[];
  /** Resumen en una línea para el encabezado del panel. */
  veredicto: string;
  /** Las landings que ya mandaron eventos: para elegir en vez de tipear. */
  urls: string[];
  /** El código pegado es de una versión anterior: la prueba no puede empezar. */
  codigoViejo: boolean;
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
  // (Ya no se cuentan los eventos «con segundos»: la versión del código se
  // pregunta, no se infiere. Ver el chequeo 'version'.)
  const soloVsl = eventos.filter((e) => e.tipo !== 'pageview').length;
  const hayProfundidad = eventos.some((e) => /^[ps]\d+$/.test(e.tipo));

  // ── ¿El formulario entra al CRM? ──────────────────────────────────────────
  // El chequeo que faltaba. El snippet captura el opt-in, pero eso pasa en el
  // server y en silencio: sin esta fila, la única forma de saber si anda era
  // llenar el formulario y después ir a buscar el lead a otra pantalla.
  //
  // Son TRES estados distintos y separarlos importa, porque mandan a lugares
  // distintos: «no lo declaraste» se arregla en /funnel, «todavía no probaste» se
  // arregla llenando tu propio formulario, y «llegó» ya está.
  // Import dinámico: `lib/leads.ts` es enorme y trae medio CRM atrás; a nivel de
  // módulo esto sería un ciclo. Es el mismo recurso que usa `emitirAviso` con
  // `plantillas`. La puerta se lee de donde el cliente la configura (/funnel), no
  // de una copia — si acá se leyera `funnel_config` a mano, sería el segundo lugar
  // que decide lo mismo y el que se queda viejo.
  const { getFunnel } = await import('./leads');
  const { entradas } = await getFunnel().catch(() => ({ entradas: [] as string[] }));
  const declarado = (entradas as string[]).includes('landing');
  const { data: optins } = declarado
    ? await db.from('propuestas').select('created_at').eq('origen', 'landing').gte('created_at', desde).limit(1)
    : { data: null };
  const hayOptin = (optins?.length ?? 0) > 0;

  // ⚠️ Y CUÁNTOS ESTÁN SIN REVISAR, que es la pregunta que el chequeo no hacía.
  //
  // Decía «llegó al menos un formulario ✓» y con eso se leía «esto funciona,
  // seguí». Los dos verbos que le faltaban son los que importan: llegó ¿y ENTRÓ?
  // Un opt-in crea una PROPUESTA, y una propuesta sin confirmar no es un lead: es
  // una persona que dejó su teléfono y a la que nadie escribió. El 14/08/2026 el
  // ws11 tenía OCHO en ese estado mientras el chequeo estaba en verde.
  //
  // Sin ventana de tiempo, a propósito: una propuesta de hace tres días sin
  // revisar es MÁS urgente que la de hoy, no menos.
  const { data: pend } = declarado
    ? await db.from('propuestas').select('id').eq('origen', 'landing').eq('estado', 'pendiente').order('created_at', { ascending: false }).limit(50)
    : { data: null };
  const pendientes = (pend as Array<{ id: string }> | null)?.length ?? 0;
  const primerPendiente = (pend as Array<{ id: string }> | null)?.[0]?.id ?? null;

  // ── ¿Qué versión del código tiene puesta? ─────────────────────────────────
  // Antes esto se INFERÍA de la ausencia de `segundos` en los eventos del VSL, y
  // esa heurística mentía en el caso más común: una landing SIN video nunca manda
  // segundos, así que le decía «tenés el código viejo» para siempre a alguien que
  // lo tenía al día. Ahora la versión viaja de verdad en cada evento (`sv`), y el
  // proxy sobra: se pregunta por el dato.
  const { viejo: codigoViejo, instalada } = await snippetDesactualizado();

  const chequeos: ChequeoDiag[] = [
    { id: 'pageview', label: 'Llegan las visitas a la landing',
      estado: hayPageview ? 'ok' : 'falta',
      detalle: hayPageview ? 'El código está pegado y el ruteo funciona.' : 'No llegó ninguna visita en 24 h. Revisá que el código esté pegado y publicado.' },
    { id: 'version', label: 'El código es la versión nueva',
      estado: instalada === 0 || !hayPageview ? 'falta' : codigoViejo ? 'viejo' : 'ok',
      detalle: instalada === 0 || !hayPageview ? 'Todavía no llegó ningún evento para saber qué versión tenés puesta.'
        : codigoViejo ? `Tenés la versión ${instalada} y la actual es la ${SNIPPET_VERSION}. Te estás perdiendo ${novedadesDesde(instalada)}. Copiá el código de arriba y reemplazalo.`
        : 'Es la última versión.' },
    // ⚠️ «Llegó» y «entró» son DOS cosas, y el chequeo solo miraba la primera.
    // Con gente esperando sin revisar, el estado es de ACCIÓN, no de éxito: un ✓
    // verde ahí se lee «esto anda, seguí» sobre ocho personas que dejaron su
    // teléfono y a las que nadie escribió.
    { id: 'optin', label: 'El formulario entra al CRM',
      estado: !declarado ? 'viejo' : pendientes > 0 ? 'viejo' : hayOptin ? 'ok' : 'falta',
      detalle: !declarado
        ? 'Está apagado: marcá «Llenan un formulario en tu página» en Funnel → De dónde entran tus leads. Hasta entonces, lo que completen no entra.'
        : pendientes > 0
          ? `Llegaron y están esperándote: ${pendientes} ${pendientes === 1 ? 'persona dejó sus datos' : 'personas dejaron sus datos'} y ${pendientes === 1 ? 'todavía NO está' : 'todavía NO están'} en el CRM. Los confirmás vos, para revisar el dato antes de que valga.`
          : hayOptin ? 'Llegó al menos un formulario en las últimas 24 h, y ya los revisaste todos.'
          : 'Todavía no llegó ninguno. Para probarlo, completá tu propio formulario — aparece acá y te aviso por WhatsApp con el link para revisarlo.',
      // El link lo arma el CÓDIGO con el id real. Es lo único que convierte «tenés
      // 8 sin revisar» en algo que se puede hacer: la pantalla de revisión es por
      // id y no hay lista, así que sin esto la información no lleva a ningún lado.
      accion: primerPendiente ? { texto: pendientes === 1 ? 'Revisarlo' : `Revisar el más reciente`, href: `/crm/revisar/${primerPendiente}` } : undefined },
    { id: 'play', label: 'Se detecta el play del VSL',
      estado: hayPlay ? 'ok' : 'falta',
      detalle: hayPlay ? 'El reproductor está enganchado.' : 'Nadie reprodujo el video en 24 h (o el player no es el que el código escucha). Si tu página no tiene video, ignoralo.' },
    { id: 'profundidad', label: 'Se mide cuánto del VSL ven',
      estado: hayProfundidad ? 'ok' : soloVsl > 0 ? 'viejo' : 'falta',
      detalle: hayProfundidad ? 'Llegan los hitos de avance: la retención por lead se puede calcular.'
        : soloVsl > 0 ? 'Solo llega el arranque, no el avance. Con el código nuevo aparece a los pocos segundos de reproducción, aunque el video sea corto.'
        : 'Todavía sin datos.' },
  ];

  // El total sale de la LISTA, no de un número escrito al lado. Estuvo en «de 4»
  // mientras los chequeos ya eran cinco: un contador que se mantiene a mano queda
  // viejo en el mismo commit que agrega la fila, y encima es lo primero que se
  // lee del panel.
  const okCount = chequeos.filter((c) => c.estado === 'ok').length;
  const veredicto = okCount === chequeos.length ? 'Todo funcionando'
    : okCount === 0 ? 'No está llegando nada'
    : `${okCount} de ${chequeos.length} chequeos OK`;

  // Las landings que YA mandaron eventos: es lo que permite ofrecerle elegir en
  // vez de pedirle que tipee una URL que el sistema ya conoce.
  //
  // ⚠️ SE DEDUPLICA NORMALIZADO, no por el texto crudo. Deduplicar strings parecía
  // alcanzar y no alcanzaba: cada deploy de Netlify emite una URL inmutable con
  // el id adelante (`6a7f350e…--sitio.netlify.app`) y el snippet mide en todas, así
  // que una clienta que publicaba varias veces por día veía SIETE renglones de la
  // misma página — y su retención repartida entre los siete sin que nada lo dijera.
  // `normalizarUrl` colapsa esos hosts; acá solo hay que llamarla.
  const urls = [...new Set(
    ((visitas.data ?? []) as Array<{ landing_url: string | null }>)
      .map((v) => normalizarUrl(v.landing_url ?? ''))
      .filter((u): u is string => !!u),
  )].slice(0, 8);

  return { eventos, chequeos, veredicto, urls, codigoViejo, ultima: eventos[0]?.ts ?? null };
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
  // Versión del snippet: viaja en cada evento para que MaKo sepa quién quedó
  // con el código viejo y le avise. Ver SNIPPET_VERSION.
  var SV = ${SNIPPET_VERSION};

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
    data.sv = SV;
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
  // ⚠️ EL ESTADO ES POR VIDEO, no uno global. Hasta la v4 había UNA sola tanda de
  // variables (\`yaPlay\`, \`hitos\`, \`dur\`, \`segs\`) para toda la página, y con dos
  // videos eso no «mezclaba las curvas»: rompía la segunda entera. \`yaPlay\` global
  // hacía que solo el PRIMER video mandara un play; \`hitos\` compartido suprimía el
  // 25% del segundo porque el primero ya lo había mandado; y \`dur\` lo pisaba el
  // último que reportara duración, así que el % de un video se calculaba con la
  // duración de otro. Una landing con un VSL y un testimonio medía el testimonio
  // como si durara lo que el VSL.
  var V = {};
  function est(id) {
    var k = id || '_';
    if (!V[k]) V[k] = { play: false, hitos: {}, seg: {}, pct: 0, dur: 0, segs: 0, tit: null };
    return V[k];
  }
  // Qué video mandó ESTE mensaje. Panda lo dice en \`video\`, pero si algún día no
  // viniera, el iframe que originó el postMessage lo identifica igual — y sin eso
  // dos players anónimos volverían a compartir un solo estado, que es el bug de
  // arriba servido de nuevo.
  function quien(d, src) {
    if (d.video || d.videoId) return d.video || d.videoId;
    var f = document.querySelectorAll('iframe');
    for (var i = 0; i < f.length; i++) if (f[i].contentWindow === src) return 'iframe' + i;
    return null;
  }
  // Escalera de segundos: la red de seguridad cuando no se conoce la duración.
  // Doce puntos hasta los 40 minutos — alcanza para reconstruir la curva
  // server-side sin inundar el endpoint.
  // ⚠️ ARRANCA EN 3 SEGUNDOS, no en 15. El primer escalón era 15 s, y con eso un
  // video de 10 —los hay, y son justo los que más se miran enteros— no marcaba
  // NUNCA un avance: la pantalla decía «solo llega el arranque» sobre un video
  // que la gente terminaba. Un umbral pensado para un VSL de 20 minutos aplicado
  // a uno de 10 segundos mide exactamente cero.
  // Sigue siendo una escalera y no un tick por segundo: un evento por segundo son
  // 1.200 requests por cada persona que mira un VSL largo, para reconstruir una
  // curva que con estos puntos ya queda igual de bien.
  var ESCALERA = [3, 5, 8, 12, 15, 20, 30, 45, 60, 90, 120, 180, 300, 420, 600, 900, 1200, 1800, 2400];

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object' || String(d.message || '').indexOf('panda_') !== 0) return;
    var vid = quien(d, ev.source);
    var e = est(vid);
    if (!e.tit) e.tit = tituloVsl(vid);
    // Único mensaje que trae la duración. El guard > 0 es obligatorio: el player
    // la emite una vez con duration 0 antes de tener metadata, y pisarla con 0
    // reintroduce el bug entero.
    if (d.message === 'panda_allData' && d.playerData && d.playerData.duration > 0) {
      e.dur = d.playerData.duration;
    }
    if (d.message === 'panda_play' && !e.play) {
      e.play = true;
      enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: vid, vsl_titulo: e.tit });
    }
    if (d.message === 'panda_timeupdate' && d.currentTime != null) {
      e.segs = d.currentTime;
      if (e.dur > 0) {
        e.pct = Math.min(100, Math.round((e.segs / e.dur) * 100));
        var h = Math.floor(e.pct / 5) * 5; // hito de retención cada 5%
        if (h >= 5 && !e.hitos[h]) {
          e.hitos[h] = true;
          enviar({ tipo_evento: 'p' + h, porcentaje: e.pct, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
        }
        return;
      }
      // Sin duración: se marca por TIEMPO. El servidor lo convierte a % después.
      for (var i = 0; i < ESCALERA.length; i++) {
        var s = ESCALERA[i];
        if (e.segs >= s && !e.seg[s]) {
          e.seg[s] = true;
          enviar({ tipo_evento: 's' + s, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
        }
      }
    }
  });

  // Punto exacto de abandono
  // Un exit POR VIDEO que se haya reproducido. Con el exit único, de dos videos
  // mirados solo quedaba el punto de abandono del último que hubiera hablado.
  var exitEnviado = false;
  function alSalir() {
    if (exitEnviado) return;
    exitEnviado = true;
    for (var k in V) {
      if (!Object.prototype.hasOwnProperty.call(V, k)) continue;
      var e = V[k];
      if (!e.play) continue;
      // Los segundos van SIEMPRE; el % solo si se pudo calcular.
      enviar({ tipo_evento: 'exit', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: k === '_' ? null : k, vsl_titulo: e.tit });
    }
  }
  window.addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') alSalir();
  });

  // ── Opt-in: el formulario de la página entra al CRM ──────────────────────
  // Va en ESTE script y no en uno aparte a propósito. El snippet queda CONGELADO
  // en el HTML del cliente (ver el aviso de arriba: así se perdieron 18 días de
  // medición), así que un segundo script para pegar después es un segundo script
  // que la mitad no va a pegar. Uno solo: mide y captura.
  //
  // Que el opt-in ENTRE o no al CRM lo decide el SERVER, mirando si ese negocio
  // declaró la landing como entrada de leads (/funnel). Por eso este bloque se le
  // puede dar a todos los clientes sin que a nadie se le llene el CRM de algo que
  // no esperaba: el código pegado en la página no decide nada.
  var OPTIN = '${APP_BASE_URL}/api/track/optin';

  // Qué campo es cuál. Se mira el type, el name, el id, el autocomplete y el
  // placeholder: los constructores (Lovable, Framer, WordPress) nombran distinto
  // y el dueño de la página no tiene por qué renombrar nada para que ande.
  function campo(form, pats, types) {
    var els = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.value || !String(el.value).trim()) continue;
      if (types && types.indexOf(el.type) !== -1) return String(el.value).trim();
      var pistas = [el.name, el.id, el.getAttribute('autocomplete'), el.placeholder, el.getAttribute('aria-label')].join(' ').toLowerCase();
      for (var j = 0; j < pats.length; j++) if (pistas.indexOf(pats[j]) !== -1) return String(el.value).trim();
    }
    return null;
  }

  // En captura y sin preventDefault: el formulario del cliente sigue haciendo lo
  // que hacía (redirigir, mostrar su gracias, mandar a su herramienta). Esto se
  // cuelga al lado. keepalive para que el envío sobreviva a la navegación.
  document.addEventListener('submit', function (ev) {
    try {
      var form = ev.target;
      if (!form || form.tagName !== 'FORM') return;
      var email = campo(form, ['email', 'correo', 'mail'], ['email']);
      var telefono = campo(form, ['tel', 'phone', 'whats', 'celular', 'movil', 'móvil'], ['tel']);
      if (!email && !telefono) return; // no es un formulario de contacto
      fetch(OPTIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: TOKEN,
          visitor_id: visitorId,
          nombre: campo(form, ['nombre', 'name', 'first', 'apellido']),
          email: email,
          telefono: telefono,
          empresa: campo(form, ['empresa', 'company', 'negocio']),
          pagina: location.href
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* nunca romper el formulario del cliente */ }
  }, true);
})();
</script>`;
}
