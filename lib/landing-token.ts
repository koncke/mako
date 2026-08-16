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
import { esPreviewDeEditor, normalizarUrl } from './landing-paginas';
import { clarityProjectId } from './clarity';
import { catalogoPanda } from './panda';
import { bloqueClarity } from './clarity';

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
 *   6 — se miden los CLICKS en botones y links, y cada evento puede viajar con un
 *       MARCADOR DE PRUEBA (14/08/2026). Para una landing cuyo CTA es un ancla
 *       (#registro) o un link de WhatsApp, el click ES el embudo: sin eso, entre
 *       «visitó» y «dejó sus datos» no hay nada. El marcador entra en la MISMA
 *       versión a propósito: no estaba anunciada todavía, así que quien repega el
 *       código lo hace UNA vez y se lleva las dos cosas.
 *   7 — ⚠️ se mide el <video> NATIVO, no solo los iframes de Panda (14/08/2026).
 *       Faltaba entero, y era el caso de la primera clienta que lo usó: su landing
 *       tiene un `<video controls>` común, así que apretaba play y no se
 *       registraba NADA — el panel decía «nadie reprodujo el video en 24 h» para
 *       siempre, porque nunca iba a llegar un evento.
 *   8 — el 'play' manda la URL del video. Un id como «v:que-se-vive.mp4» alcanza
 *       para atribuir eventos y no para RECONOCERLO: sin la URL, la pantalla que
 *       te pide nombrar cada video no te deja ver cuál es el que estás nombrando.
 *   9 — la escalera de segundos corre TAMBIÉN cuando se conoce la duración. Con
 *       un video de 23 minutos el primer hito de 5% cae a los 71 segundos: hasta
 *       entonces no llegaba un solo avance, y quien miraba 40 segundos y se iba
 *       se registraba como si no hubiera visto nada (15/08/2026).
 *  10 — se miden AGENDÓ (Calendly avisa al padre por postMessage) y el ciclo de
 *       vida del video: pausa, retoma y fin. Sin lo primero, el embudo de quien
 *       vende por llamada terminaba en «vio el video»; sin lo segundo, «vio 3
 *       minutos» no distinguía a quien miraba de quien lo dejó corriendo.
 */
export const SNIPPET_VERSION = 13;

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
  2: 'la captura automática del formulario de tu página: quien lo completa ingresa solo al CRM',
  3: 'una corrección importante: la versión anterior salió sin identificador y dejó de medir y de capturar',
  4: 'la medición de videos cortos: antes, uno de menos de 15 segundos no registraba ningún avance',
  5: 'la medición de todos los videos por separado: antes, con más de uno, el segundo casi no se medía y su avance se calculaba con la duración del primero',
  6: 'la medición de los clics: qué botones y enlaces usan tus visitantes, incluido el de WhatsApp · y la prueba del código ahora muestra solo tus propios eventos, sin mezclarlos con las visitas del día',
  11: 'distinguir el video que ARRANCA SOLO del que alguien reproduce: con autoplay, hasta ahora contaba como si la persona hubiera querido verlo',
  12: 'saber en CUÁL de tus páginas pasó cada cosa: hasta ahora solo las visitas decían de dónde venían, así que con dos páginas los videos y los clics de las dos caían juntos',
  13: 'medir la pausa, el retomar y el final del video también en los reproductores de Panda: hasta ahora eso solo funcionaba con videos subidos directo a la página',
  10: 'dos eventos que faltaban: cuando alguien AGENDA en tu Calendly embebido —que para vender por llamada es el evento más importante— y las pausas del video, que distinguen a quien lo mira de quien lo dejó corriendo',
  9: 'la medición de los primeros segundos de un video largo: hasta ahora, en un video de 20 minutos no se registraba ningún avance durante el primer minuto — y ahí es donde se pierde a la mayoría',
  8: 'poder ver cada video desde la app al momento de identificarlo: antes solo aparecía un código y había que adivinar',
  7: 'la medición de tu video cuando no usas Panda: con un reproductor común no se registraba ni una reproducción',
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
export async function videosDetectados(dias = 90): Promise<Array<{ id: string; titulo: string | null; eventos: number; url: string | null; pagina: string | null; redirigeA: string | null }>> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  try {
    const db = await getTenantDb();
    // ⚠️ LOS MÁS NUEVOS PRIMERO, y el `order` no es un lujo: es lo único que hace
    // que esta consulta conteste. Sin él, PostgREST devuelve las filas en el
    // orden que le da Postgres —el físico, o sea las más VIEJAS— y el servidor
    // corta en 1000 aunque acá se pidan 2000 (`db-max-rows`, que no avisa: la
    // respuesta es un 200 con menos filas). La URL del video viaja en `detalle`
    // solo desde la v8, así que en esas 1000 filas viejas no había una sola que
    // la trajera y el botón «Ver este video» no aparecía NUNCA en una página con
    // historial. El síntoma engañaba doble: el texto decía «llega con la versión
    // nueva del Pixel» sobre una página que ya tenía la versión nueva.
    const { data } = await db
      .from('vsl_events')
      .select('video_id, vsl_titulo, detalle, landing_url')
      .not('video_id', 'is', null)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1000);
    const out = new Map<string, { id: string; titulo: string | null; eventos: number; url: string | null; pagina: string | null; redirigeA: string | null }>();
    for (const r of (data ?? []) as Array<{ video_id: string | null; vsl_titulo: string | null; detalle: string | null; landing_url: string | null }>) {
      const id = r.video_id?.trim();
      if (!id) continue;
      const e = out.get(id) ?? { id, titulo: null, eventos: 0, url: null, pagina: null, redirigeA: null };
      // En QUÉ página se vio. Es el plan B para verlo: un <video> nativo no está
      // en ningún catálogo, así que si no sabemos su URL igual sabemos dónde
      // abrirlo. Llega desde la v12.
      if (!e.pagina && r.landing_url?.trim().startsWith('http')) e.pagina = r.landing_url.trim();
      // La URL viene solo en el 'play'. Se queda la primera que llegue, igual que
      // el título: pisarla con el null de los demás eventos la perdería.
      if (!e.url && r.detalle?.trim().startsWith('http')) e.url = r.detalle.trim();
      e.eventos++;
      // El título del player viene en unos eventos y no en otros: gana el primero
      // que llegue en vez de pisarse con null a mitad de camino.
      if (!e.titulo && r.vsl_titulo?.trim()) e.titulo = r.vsl_titulo.trim();
      out.set(id, e);
    }
    // ⚠️ LO QUE PANDA YA SABE NO SE ESPERA A QUE ALGUIEN LO REPRODUZCA. La URL y
    // el título del video viajaban SOLO en el evento `play`, así que para poder
    // nombrar un video había que conseguir primero que alguien lo mirara — la
    // pantalla al revés. Panda tiene las dos cosas desde que el video se subió.
    //
    // Y el título de Panda le GANA al del iframe: el `title` del iframe es de la
    // PÁGINA, no del video, así que en esta landing los dos videos se llamaban
    // igual («VSL Principal - Negocio que Escala») y el rótulo no distinguía nada.
    // Nunca rompe: sin Panda configurado devuelve un mapa vacío y todo queda como
    // antes.
    const panda = await catalogoPanda().catch(() => new Map<string, { titulo: string; player: string; redirigeA: { titulo: string } | null }>());
    for (const v of out.values()) {
      const p = panda.get(v.id);
      if (!p) continue;
      v.url = p.player;
      v.titulo = p.titulo;
      v.redirigeA = p.redirigeA?.titulo ?? null;
    }

    // ⚠️ EL CONTEO EXACTO SE PREGUNTA, no se cuenta sobre lo que vino. Contar las
    // filas de la consulta daba «1000 eventos» —el tope del servidor— sobre un
    // video con 6446, y un número redondo al lado de un video se lee como un dato
    // real. Son pocos videos por página, así que es una consulta por video y
    // ninguna trae filas (`head: true`).
    for (const v of out.values()) {
      const { count } = await db
        .from('vsl_events')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', v.id)
        .gte('created_at', desde);
      if (typeof count === 'number') v.eventos = count;
    }
    // El más visto primero: es el que más probablemente sea el VSL, así que es el
    // que conviene tener arriba cuando hay que elegir.
    return [...out.values()].sort((a, b) => b.eventos - a.eventos);
  } catch (e) {
    console.error('[videosDetectados] falló:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * ¿ESTA página tiene el código puesto, y al día?
 *
 * El botón de verificar vivía al lado del CÓDIGO y contestaba por el workspace
 * entero. Al lado del desplegable la pregunta cambia y se vuelve la útil: no
 * «¿algún evento llegó alguna vez?» sino «¿la página que estoy por probar está
 * midiendo?». Un cliente con dos landings publicadas —la vieja y la nueva— tenía
 * una sola respuesta para las dos.
 *
 * La versión sale de `landing_visits.sv` (mig 0135), que es la que mandó ESTA
 * página, no la del último evento del workspace.
 */
export type VerificacionPagina = {
  url: string;
  /** Nunca llegó un evento de esta página. */
  instalada: boolean;
  version: number | null;
  vieja: boolean;
  ultima: string | null;
  /** Cuántas visitas en los últimos 30 días, para distinguir «anda» de «andaba». */
  visitas: number;
  texto: string;
};

export async function verificarPagina(urlCruda: string): Promise<VerificacionPagina> {
  const url = normalizarUrl(urlCruda);
  if (!url) return { url: urlCruda, instalada: false, version: null, vieja: false, ultima: null, visitas: 0, texto: 'Esa dirección no parece una página web.' };
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  try {
    const db = await getTenantDb();
    // ⚠️ Se compara NORMALIZADO en las dos puntas, no con un `eq` sobre el texto
    // crudo: en la base conviven la URL con barra final, con hash y con los
    // parámetros de cada campaña. Un `eq` diría «no está instalada» sobre una
    // página que manda eventos hace meses.
    const { data } = await db
      .from('landing_visits')
      .select('created_at, landing_url, sv')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(400);
    const filas = ((data ?? []) as Array<{ created_at: string; landing_url: string | null; sv: number | null }>)
      .filter((r) => normalizarUrl(r.landing_url ?? '') === url);
    if (!filas.length) {
      return { url, instalada: false, version: null, vieja: false, ultima: null, visitas: 0,
        texto: 'No llega ninguna visita de esta página desde hace 30 días. El Pixel no está instalado ahí, o esa página aún no se publica.' };
    }
    // La versión de la visita MÁS RECIENTE: si repegaron el código hace una hora,
    // lo que importa es eso y no las 300 visitas viejas de antes.
    const conSv = filas.find((r) => r.sv != null);
    const version = conSv?.sv ?? null;
    const vieja = version != null && version < SNIPPET_VERSION;
    return {
      url, instalada: true, version, vieja, ultima: filas[0].created_at, visitas: filas.length,
      texto: version == null
        // Llegan visitas pero ninguna dice su versión: son de antes de que el
        // snippet la mandara, o sea de las más viejas que hay.
        ? `Está midiendo (${filas.length} ${filas.length === 1 ? 'visita' : 'visitas'} en 30 días), pero el Pixel es tan antiguo que no informa su versión. Copia el código de arriba y reemplázalo.`
        : vieja
          ? `Está midiendo con la versión ${version}, y la actual es la ${SNIPPET_VERSION}. Copia el código de arriba y reemplázalo EN ESTA PÁGINA para sumar: ${novedadesDesde(version)}.`
          : `Todo correcto: está midiendo con la última versión (${filas.length} ${filas.length === 1 ? 'visita' : 'visitas'} en 30 días).`,
    };
  } catch (e) {
    console.error('[verificarPagina] falló:', e instanceof Error ? e.message : e);
    return { url, instalada: false, version: null, vieja: false, ultima: null, visitas: 0, texto: 'No se pudo consultar. Inténtalo de nuevo en un momento.' };
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
  /** El play arrancó SOLO (autoplay), sin que nadie hubiera tocado la página. */
  auto: boolean;
};

export type ChequeoDiag = {
  id: 'version' | 'pageview' | 'play' | 'profundidad' | 'click' | 'optin' | 'clarity';
  label: string;
  estado: 'ok' | 'falta' | 'viejo' | 'na';
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
export async function landingDiagnostico(
  prueba?: string | null,
  /** La landing elegida en el paso 1. Con ella, los eventos y los chequeos se
   *  acotan a ESA página: sin esto, «tu Pixel está al día» hablaba del workspace
   *  y con dos landings era verdad para una y mentira para la otra. */
  urlLanding?: string | null,
  /** Qué piezas tiene esa página (del analizador). Lo que no tiene, no se pide. */
  piezas?: string[] | null,
): Promise<LandingDiagnostico> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // ⚠️ CON MARCADOR, SOLO LOS DE ESA PRUEBA. Sin él, apretar «Probar» mostraba las
  // últimas 24 h enteras y aparecían horarios de la mañana entre los de recién:
  // no había forma de saber cuáles eran los propios. Es el `test_event_code` de
  // Meta — la app abre la landing con `?mko_test=<id>` y el snippet lo devuelve.
  //
  // Filtrar por HORA no alcanzaba: dejaría afuera los viejos pero NO los de otra
  // gente visitando la página en ese momento, y esta landing tiene tráfico real.
  // Un probador que te muestra la visita de un desconocido como si fuera tuya es
  // peor que uno que muestra de más: te hace creer que tu código anda cuando lo
  // que anda es el de la visita ajena.
  // Se escribe el ternario en cada query en vez de un helper genérico: el
  // encadenado de PostgREST está tipado con genéricos que se vuelven infinitos al
  // pasarlos por una función propia, y pelear con eso no vale un renglón menos.
  const qVsl = db.from('vsl_events').select('created_at, tipo_evento, porcentaje, segundos, vsl_titulo, detalle, auto, landing_url, video_id');
  const qVis = db.from('landing_visits').select('created_at, landing_url');

  const [vsl, visitas, optinsFeed] = await Promise.all([
    (prueba ? qVsl.eq('prueba', prueba) : qVsl.gte('created_at', desde)).order('created_at', { ascending: false }).limit(40),
    (prueba ? qVis.eq('prueba', prueba) : qVis.gte('created_at', desde)).order('created_at', { ascending: false }).limit(20),
    // ⚠️ EL OPT-IN, QUE NO PODÍA APARECER NUNCA. El feed se armaba solo con
    // `vsl_events` y `landing_visits`, así que un formulario que entraba PERFECTO
    // no producía un solo renglón — y la instrucción de arriba dice «completá tu
    // propio formulario, los eventos aparecen acá». Era una promesa que la
    // pantalla no podía cumplir, y se leyó como «el formulario no se registró».
    // Vive en `propuestas` porque un opt-in no es un evento: es algo para revisar.
    prueba
      ? db.from('propuestas').select('created_at, resumen').eq('origen', 'landing').eq('datos->>prueba', prueba).order('created_at', { ascending: false }).limit(10)
      : db.from('propuestas').select('created_at, resumen').eq('origen', 'landing').gte('created_at', desde).order('created_at', { ascending: false }).limit(10),
  ]);

  // ⚠️ Los eventos de OTRAS páginas no cuentan. Con dos landings, «llegan las
  // visitas» daba verde por la que sí funciona mientras la elegida no mandaba
  // nada — que es exactamente el caso que este rediseño vino a cerrar.
  const deEstaLanding = (u: string | null | undefined) =>
    !urlLanding || !u || normalizarUrl(u) === normalizarUrl(urlLanding);

  const eventos: EventoDiag[] = [
    ...((vsl.data ?? []) as Array<{ created_at: string; tipo_evento: string | null; porcentaje: number | null; segundos: number | null; vsl_titulo: string | null ; detalle: string | null; auto: boolean | null; landing_url: string | null; video_id: string | null }>)
      // Desde la v12 los eventos de video también dicen de qué página vinieron.
      // Los de antes traen NULL y `deEstaLanding` los DEJA PASAR a propósito: no
      // se puede atribuir lo que no se sabe, y descartarlos pintaría en rojo el
      // chequeo de alguien que tiene el Pixel andando y solo lo tiene viejo —
      // castigarlo por algo que no hizo mal. Se mezclan hasta que repegue el
      // código, que es lo que el aviso de «Pixel desactualizado» le pide.
      .filter((r) => deEstaLanding(r.landing_url))
      .map((r) => ({ ts: r.created_at, tipo: r.tipo_evento ?? 'evento', porcentaje: r.porcentaje, segundos: r.segundos, auto: r.auto === true, // Para un click el detalle ES el destino; para un evento de video, el título.
      // Sin este `??`, el click llegaba a la pantalla sin decir en qué se hizo.
      detalle: r.detalle ?? r.vsl_titulo })),
    ...((visitas.data ?? []) as Array<{ created_at: string; landing_url: string | null }>)
      .filter((r) => deEstaLanding(r.landing_url))
      .map((r) => ({ ts: r.created_at, tipo: 'pageview', porcentaje: null, segundos: null, auto: false, detalle: r.landing_url })),
    ...((optinsFeed.data ?? []) as Array<{ created_at: string; resumen: string | null }>)
      .map((r) => ({ ts: r.created_at, tipo: 'optin', porcentaje: null, segundos: null, auto: false, detalle: r.resumen })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 25);

  // Durante una prueba, los textos de «todavía no llegó» hablan de LA PRUEBA, no
  // de las últimas 24 h: quien acaba de apretar play no quiere una estadística.
  const enPrueba = !!prueba;
  const hayPageview = eventos.some((e) => e.tipo === 'pageview');
  // ⚠️ UN PLAY AUTOMÁTICO NO ES UNA REPRODUCCIÓN. Panda arranca solo: el chequeo
  // «reproduce tu video» daba verde con solo abrir la página, sin que nadie
  // tocara nada — o sea, afirmaba que el player medía la INTENCIÓN de ver cuando
  // lo único que había medido era que la página cargó. Peor: el mismo dato
  // alimenta la retención, así que cada visita entraba al embudo como un
  // espectador. El snippet v11 marca `auto` cuando el play llegó sin que hubiera
  // una sola interacción previa (click, tecla, scroll o toque).
  const hayPlayManual = eventos.some((e) => e.tipo === 'play' && !e.auto);
  const hayPlayAuto = eventos.some((e) => e.tipo === 'play' && e.auto);
  const hayPlay = hayPlayManual || hayPlayAuto;
  const hayClick = eventos.some((e) => e.tipo === 'click');
  // ⚠️ LOS CHEQUEOS SE ADAPTAN A LA LANDING. No todas tienen video, ni botones
  // propios, ni formulario: la de un cliente es un Calendly embebido y nada más.
  // Un chequeo que en ESA página no puede pasar nunca se pinta rojo para siempre
  // y entrena a ignorar la lista entera — que es exactamente lo que pasó con
  // «nadie reprodujo el video» sobre una página cuyo player nunca íbamos a ver.
  //
  // La señal es lo que la página YA mandó: si nunca llegó un play, esa página no
  // tiene video que midamos y el punto no aplica. No es esconder un problema: es
  // no inventar uno.
  const clarityPid = await clarityProjectId().catch(() => null);
  // ⚠️ Lo que la página NO tiene no se pide. El analizador ya sabe si hay botones
  // propios: sin esta línea, a una landing cuyo CTA es un Calendly embebido se le
  // pedía «hace clic en tus botones» para siempre.
  const tieneBotones = !piezas || piezas.includes('botones') || piezas.includes('link-whatsapp');
  const tieneFormPropio = !piezas || piezas.includes('formulario');
  const tieneAgenda = !!piezas?.includes('embed-agenda');
  const hayAgendo = eventos.some((e) => e.tipo === 'agendo');
  // (Ya no se cuentan los eventos «con segundos»: la versión del código se
  // pregunta, no se infiere. Ver el chequeo 'version'.)
  const soloVsl = eventos.filter((e) => e.tipo !== 'pageview').length;
  const tuvoVideoAlgunaVez = hayPlay || soloVsl > 0;
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


  // ── ¿Qué versión del código tiene puesta? ─────────────────────────────────
  // Antes esto se INFERÍA de la ausencia de `segundos` en los eventos del VSL, y
  // esa heurística mentía en el caso más común: una landing SIN video nunca manda
  // segundos, así que le decía «tenés el código viejo» para siempre a alguien que
  // lo tenía al día. Ahora la versión viaja de verdad en cada evento (`sv`), y el
  // proxy sobra: se pregunta por el dato.
  const { viejo: codigoViejo, instalada } = await snippetDesactualizado();

  // ⚠️ EL ORDEN ES EL DEL EMBUDO, no el de cuándo se escribió cada chequeo.
  // Antes empezaba por «llegan las visitas» y metía el formulario ANTES del video:
  // la persona lee de arriba a abajo esperando el recorrido de SU visitante, y ese
  // recorrido es llegar → ver → clickear → dejar los datos.
  //
  // Y la VERSIÓN va primera de todo, aunque no sea un paso del embudo: si el
  // código está viejo, todos los demás chequeos miden otra cosa y sus resultados
  // no significan nada. Un diagnóstico que no empieza por «¿estás mirando el
  // código correcto?» manda a investigar síntomas de una versión que ya no existe.
  // ⚠️ EL PASO 5 ES UNO SOLO Y CAMBIA DE IDENTIDAD SEGÚN CÓMO VENDE EL NEGOCIO.
  //
  // Si su llamado a la acción es una agenda embebida, el final del embudo no es
  // «deja sus datos»: es «agenda una llamada». Pedirle un formulario a quien
  // vende por Calendly es pedirle algo que su página no tiene — y ese renglón se
  // quedaba en gris para siempre sobre el paso MÁS importante de su embudo.
  //
  // Va armado ACÁ y no como dos elementos condicionales adentro del array: dos
  // ramas que producen el mismo `id` son dos chequeos para el que lee el código
  // y uno solo para el que lo corre. Un test que cuenta los ids sobre la fuente
  // veía siete pasos donde hay seis, y esa clase de desfase entre lo que el
  // código dice y lo que hace es justo lo que el test venía a cuidar.
  //
  // ⚠️ Y EL DE FORMULARIO YA NO PIDE CONFIRMAR: los leads entran solos. Lo único
  // que queda esperando es un CHOQUE —alguien que parece estar ya en el CRM—, y
  // eso no es una tarea pendiente del sistema sino una decisión que solo puede
  // tomar una persona. Por eso el estado es 'ok' aunque haya pendientes: el
  // formulario ESTÁ entrando, que es lo que este renglón mide.
  const paso5: Omit<ChequeoDiag, 'id'> = tieneAgenda && !tieneFormPropio
    ? {
        label: '5. Agenda una llamada',
        estado: hayAgendo ? 'ok' : 'falta',
        detalle: hayAgendo
          ? 'Se registra cuando alguien reserva en tu calendario: es el final de tu embudo.'
          : enPrueba ? 'Aún no llega. Reserva un horario en tu propio calendario para probarlo.'
          : 'Aún no llega ninguna reserva. Se registra sola cuando alguien agenda.',
      }
    : {
        label: '5. Deja sus datos',
        // ⚠️ 'na', no ámbar. Que este negocio no reciba leads por formulario NO es
        // un problema por resolver: es cómo vende. El ámbar queda para lo que SÍ
        // hay que hacer; un aviso permanente entrena a ignorar la lista entera.
        estado: !declarado ? 'na' : hayOptin ? 'ok' : 'falta',
        detalle: !declarado
          ? 'No aplica: este negocio no recibe leads por un formulario en la página. Si quieres activarlo, márcalo en Funnel → De dónde entran tus leads.'
          : hayOptin
            ? `El formulario llega y la persona ingresa sola al CRM.${pendientes > 0 ? ` Hay ${pendientes} pendiente${pendientes === 1 ? '' : 's'}: ${pendientes === 1 ? 'coincide' : 'coinciden'} con un contacto que ya tienes, así que esa decisión es tuya.` : ''}`
            : enPrueba ? 'Aún no llega. Completa tu formulario en la pestaña que abrimos: ingresará solo al CRM.'
            : 'Aún no llega ninguno. Para probarlo, completa tu propio formulario: ingresa solo al CRM.',
        // El link solo si hay algo que decidir. Un botón permanente al lado de algo
        // que funciona lo convierte en una tarea que nunca se termina.
        accion: pendientes > 0 ? { texto: pendientes === 1 ? 'Ver el pendiente' : `Ver los ${pendientes} pendientes`, href: '/crm/revisar' } : undefined,
      };

  const chequeos: ChequeoDiag[] = [
    { id: 'version', label: 'Pixel actualizado',
      estado: instalada === 0 || !hayPageview ? 'falta' : codigoViejo ? 'viejo' : 'ok',
      detalle: instalada === 0 || !hayPageview ? 'Aún no llega ningún evento para saber qué versión del Pixel tienes instalada.'
        : codigoViejo ? `Tienes la versión ${instalada} y la actual es la ${SNIPPET_VERSION}. Copia el código de arriba y reemplázalo para sumar: ${novedadesDesde(instalada)}.`
        : 'Es la última versión.' },
    { id: 'pageview', label: '1. Llega a tu página',
      estado: hayPageview ? 'ok' : 'falta',
      detalle: hayPageview ? 'El Pixel está instalado y funciona.'
        : enPrueba ? 'Aún no llega la visita. Recarga la pestaña que abrimos.'
        : 'No llega ninguna visita desde hace 24 h. Revisa que el Pixel esté instalado y que la página esté publicada.' },
    { id: 'play', label: '2. Reproduce tu video',
      // Con SOLO plays automáticos el chequeo no está ni bien ni mal: el player
      // se detectó (que es la mitad técnica) pero nadie eligió ver el video, que
      // es lo que este punto pregunta. Va como 'falta' con el motivo escrito, no
      // como 'ok': un verde acá se lee «esto ya está» y cierra la pregunta.
      estado: hayPlayManual ? 'ok' : enPrueba || tuvoVideoAlgunaVez ? 'falta' : 'na',
      detalle: hayPlayManual ? 'Detectamos tu reproductor de video.'
        : hayPlayAuto ? 'Tu video arranca solo, así que el reproductor ya se detectó. Dale play a mano para comprobar que también medimos cuando alguien decide verlo.'
        // ⚠️ EN UNA PRUEBA NO SE DICE «nadie en 24 h». La persona ACABA de apretar
        // play; contestarle con una estadística del día es contestarle otra cosa.
        : enPrueba ? 'Aún no llega. Reproduce tu video en la pestaña que abrimos.'
        : 'Nadie reprodujo el video en las últimas 24 h. Si tu página no tiene video, ignora este punto.' },
    { id: 'profundidad', label: '3. Se mide el tiempo de retención',
      estado: hayProfundidad ? 'ok' : !tuvoVideoAlgunaVez && !enPrueba ? 'na' : soloVsl > 0 ? 'viejo' : 'falta',
      detalle: hayProfundidad ? 'Llegan los avances: ya se puede calcular la retención de cada lead.'
        : soloVsl > 0 ? 'Solo llega el inicio, no el avance. Con el Pixel actualizado aparece a los pocos segundos, aunque el video sea corto.'
        : enPrueba ? 'Deja el video reproduciéndose unos segundos.'
        : 'Aún sin datos.' },
    // El click FALTABA, y para una landing cuyo CTA es un ancla (#registro) es el
    // único punto entre «vio» y «dejó sus datos». Sin él no se puede distinguir
    // una página que no convence de una que nadie mira.
    { id: 'click', label: '4. Hace clic en tus botones',
      estado: hayClick ? 'ok' : !tieneBotones ? 'na' : 'falta',
      detalle: hayClick ? 'Se registran los clics: sabes qué botones y enlaces usa cada visitante.'
        // ⚠️ Se avisa del caso que NO podemos medir, en vez de dejarlo en rojo sin
        // explicación: si el CTA de la página es un formulario embebido (Calendly,
        // Typeform), lo que la persona hace ahí adentro es de otro dominio y
        // ningún pixel del mundo lo ve. Decirlo evita que alguien pierda una
        // tarde buscando por qué no llega.
        : enPrueba ? 'Aún no llega ninguno. Haz clic en un botón o enlace de tu página. Si tu llamado a la acción es un formulario embebido (Calendly, Typeform), lo que pase dentro de él no se puede medir: es de otro dominio.'
        : 'Aún no llega ningún clic. Si tu página no tiene botones propios —por ejemplo, si es un Calendly embebido— es normal.' },
    // El paso 5 se arma arriba: es UNO solo con dos identidades.
    { id: 'optin', ...paso5 },
    // Clarity es opcional, así que sin conectar va 'na' y no 'falta': un punto en
    // rojo por algo que se eligió no usar es ruido.
    { id: 'clarity', label: 'Grabaciones y mapas de calor',
      estado: !clarityPid ? 'na' : 'ok',
      detalle: !clarityPid
        ? 'No lo activaste. Si lo activas en el paso 1, cada lead va a tener el video de lo que hizo en tu página.'
        : 'Activo. En la ficha de cada lead vas a ver el botón para abrir su grabación. Clarity tarda entre 30 minutos y 2 horas en mostrarla.' },
  ];

  // El total sale de la LISTA, no de un número escrito al lado. Estuvo en «de 4»
  // mientras los chequeos ya eran cinco: un contador que se mantiene a mano queda
  // viejo en el mismo commit que agrega la fila, y encima es lo primero que se
  // lee del panel.
  // ⚠️ El total NO cuenta los que no aplican. «3 de 6» sobre una página que solo
  // puede cumplir cuatro se lee como que faltan dos, y nunca van a llegar: el
  // veredicto quedaría a mitad de camino para siempre.
  const aplicables = chequeos.filter((c) => c.estado !== 'na');
  const okCount = aplicables.filter((c) => c.estado === 'ok').length;
  const veredicto = okCount === aplicables.length ? 'Todo funcionando'
    : okCount === 0 ? 'No está llegando nada'
    : `${okCount} de ${aplicables.length} chequeos OK`;

  // Las landings que YA mandaron eventos: es lo que permite ofrecerle elegir en
  // vez de pedirle que tipee una URL que el sistema ya conoce.
  //
  // ⚠️ SE DEDUPLICA NORMALIZADO, no por el texto crudo. Deduplicar strings parecía
  // alcanzar y no alcanzaba: cada deploy de Netlify emite una URL inmutable con
  // el id adelante (`6a7f350e…--sitio.netlify.app`) y el snippet mide en todas, así
  // que una clienta que publicaba varias veces por día veía SIETE renglones de la
  // misma página — y su retención repartida entre los siete sin que nada lo dijera.
  // `normalizarUrl` colapsa esos hosts; acá solo hay que llamarla.
  //
  // ⚠️ Y los previews del EDITOR se sacan en vez de colapsarse: el tráfico de
  // `id-preview--…lovable.app` es de quien está construyendo la página, no de sus
  // clientes, así que fundirlo con producción metería sesiones de desarrollo
  // adentro de su tasa de conversión. El porqué completo, en `esPreviewDeEditor`.
  const urls = [...new Set(
    ((visitas.data ?? []) as Array<{ landing_url: string | null }>)
      .map((v) => normalizarUrl(v.landing_url ?? ''))
      .filter((u): u is string => !!u && !esPreviewDeEditor(u)),
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
export function landingSnippet(token: string, clarityProjectId: string | null = null): string {
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

  // MARCADOR DE PRUEBA (como el test_event_code de Meta). La app abre la landing
  // con ?mko_test=<id> y desde ahí cada evento de ESTA pestaña viaja marcado, así
  // el probador muestra lo que hiciste vos y no las últimas 24 h de todo el mundo.
  //
  // En sessionStorage y no en una variable: el marcador tiene que sobrevivir a
  // navegar dentro de la pestaña (que es lo que hace un CTA que va a otra página),
  // y morir al cerrarla. En una cookie contaminaría el tráfico real durante un año.
  var prueba = null;
  try {
    prueba = new URLSearchParams(location.search).get('mko_test');
    if (prueba) sessionStorage.setItem('mko_test', prueba);
    else prueba = sessionStorage.getItem('mko_test');
  } catch (e) {}

  function enviar(data) {
    data.t = TOKEN;
    data.sv = SV;
    data.visitor_id = visitorId;
    // ⚠️ LA PÁGINA VIAJA EN CADA EVENTO, no solo en la visita. Hasta la v11 solo
    // el pageview decía de dónde venía, así que un negocio con dos landings tenía
    // los plays, los clics y los AGENDÓ de las dos en la misma bolsa: se podía
    // saber quién ENTRÓ a cada página y no qué HIZO en cada una. Va acá adentro y
    // no en cada llamada porque este es el único lugar por donde pasan todos.
    if (data.landing_url == null) data.landing_url = location.href;
    if (prueba) data.prueba = prueba;
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
  // ⚠️ ¿HUBO UNA PERSONA? Panda y muchos players arrancan solos, así que un
  // «play» no prueba que alguien haya querido ver el video — y el chequeo pasaba
  // en verde sin que nadie tocara nada. Se marca si hubo CUALQUIER interacción
  // antes: un click, una tecla, un toque, un scroll. Sin eso, el play es
  // automático y se manda como tal.
  var huboInteraccion = false;
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (n) {
    try { window.addEventListener(n, function () { huboInteraccion = true; }, { once: true, passive: true, capture: true }); } catch (e) {}
  });

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

  // ── VIDEO NATIVO (<video>) ────────────────────────────────────────────────
  // ⚠️ ESTO FALTABA ENTERO, y era el caso de la primera clienta que lo usó. El
  // snippet escuchaba SOLO mensajes \`panda_*\` de un iframe; su landing tiene un
  // \`<video controls>\` común. Resultado: apretaba play y no se registraba nada,
  // el panel decía «nadie reprodujo el video en 24 h» —para siempre, porque nunca
  // iba a llegar un evento— y como no se detectaba ningún video, tampoco aparecía
  // la pantalla para decir cuál es el VSL.
  //
  // Un <video> no manda postMessage: emite eventos del DOM. La medición es la
  // misma (play, hitos de 5%, escalera de segundos, exit) reusando \`est()\`, así
  // que las dos clases de player alimentan el mismo modelo por video.
  //
  // El id: un <video> no tiene uno propio, así que se arma con lo que lo
  // identifica de verdad —su \`id\`, su \`src\`— y recién si no hay nada, la
  // posición. La posición sola cambiaría de video al reordenar la página.
  function idDeVideo(el, i) {
    var src = el.currentSrc || el.getAttribute('src') || '';
    if (!src) { var f = el.querySelector && el.querySelector('source'); if (f) src = f.getAttribute('src') || ''; }
    if (el.id) return 'v:' + el.id;
    if (src) return 'v:' + src.split('/').pop().split('?')[0].slice(0, 80);
    return 'v:pos' + i;
  }
  function engancharNativos() {
    var vs = document.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) {
      var el = vs[i];
      if (el.__mko) continue;   // idempotente: se vuelve a llamar si el DOM cambia
      el.__mko = true;
      (function (el, i) {
        var id = idDeVideo(el, i);
        var e = est(id);
        e.tit = e.tit || el.getAttribute('title') || el.getAttribute('aria-label') || null;
        // ⚠️ PAUSA Y REANUDAR. Sin esto, «vio 3 minutos» podía ser alguien que
        // dejó el video corriendo mientras hacía otra cosa. Una pausa a los 40
        // segundos y un retomar a los 3 minutos es una señal de interés MUY
        // distinta de una reproducción corrida, y hasta ahora las dos se veían
        // exactamente igual.
        el.addEventListener('pause', function () {
          // El evento pause también dispara al terminar el video: eso no es una pausa.
          if (el.ended || !e.play) return;
          enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        });
        el.addEventListener('ended', function () {
          enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        });
        el.addEventListener('play', function () {
          if (e.play) {
            // Ya había arrancado: esto es RETOMAR después de una pausa, y es un
            // evento propio. Tratarlo como «otro play» inflaría el conteo de
            // reproducciones y haría ver dos personas donde hay una.
            enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
            return;
          }
          e.play = true;
          // La URL del archivo. Es lo que después deja abrir el video desde la app
          // para saber CUÁL es el que estás nombrando: un id como «v:que-se-vive.mp4»
          // alcanza para atribuir eventos y no para reconocerlo de un vistazo.
          enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: id, vsl_titulo: e.tit, auto: !huboInteraccion, detalle: (el.currentSrc || el.getAttribute('src') || '').slice(0, 300) });
        });
        el.addEventListener('timeupdate', function () {
          e.segs = el.currentTime || 0;
          // Acá SÍ se conoce la duración (el DOM la da), así que se miden hitos de
          // 5% igual que con Panda. El guard > 0 evita el NaN de un stream en vivo.
          if (el.duration > 0 && isFinite(el.duration)) {
            e.dur = el.duration;
            e.pct = Math.min(100, Math.round((e.segs / e.dur) * 100));
            var h = Math.floor(e.pct / 5) * 5;
            if (h >= 5 && !e.hitos[h]) {
              e.hitos[h] = true;
              enviar({ tipo_evento: 'p' + h, porcentaje: e.pct, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
            }
            return;
          }
          for (var k = 0; k < ESCALERA.length; k++) {
            var s = ESCALERA[k];
            if (e.segs >= s && !e.seg[s]) {
              e.seg[s] = true;
              enviar({ tipo_evento: 's' + s, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
            }
          }
        });
      })(el, i);
    }
  }
  engancharNativos();
  // Los videos que aparecen DESPUÉS: una landing armada con un builder monta el
  // reproductor cuando el bloque entra en pantalla, así que enganchar una sola vez
  // al cargar deja sin medir justo al que está más abajo.
  try {
    new MutationObserver(engancharNativos).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

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
      // Igual que con el <video> nativo: el src del iframe es lo que permite
      // abrirlo después y reconocerlo. Se busca el que contenga este id.
      var src = '';
      try {
        var ifr = document.querySelectorAll('iframe');
        for (var q = 0; q < ifr.length; q++) if (vid && (ifr[q].src || '').indexOf(vid) !== -1) { src = ifr[q].src; break; }
      } catch (err) {}
      enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: vid, vsl_titulo: e.tit, auto: !huboInteraccion, detalle: src.slice(0, 300) });
    }
    // ⚠️ PAUSA, RETOMA Y FIN, QUE PARA PANDA NUNCA EXISTIERON. La v10 los anunció
    // y solo los cableó para el <video> nativo: acá se escuchaban tres mensajes
    // —allData, play y timeupdate— y ninguno más. Medido el 2026-08-16 sobre un
    // workspace con 658 plays y 606 exits en 7 dias: pausa, retoma y fin,
    // CERO. No fallaban, no estaban.
    //
    // El nombre de los mensajes no se adivinó: la propia landing del cliente
    // escucha panda_ended en su propio codigo, asi que el player los emite con ese
    // prefijo y esa forma.
    if (d.message === 'panda_pause' && e.play) {
      enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
    }
    // El play de un video YA arrancado es un retomar, no una reproduccion
    // nueva: contarlo como play inflaría el conteo y haría ver dos personas
    // donde hay una. Es la misma regla que ya seguía el <video> nativo.
    if (d.message === 'panda_play' && e.play && e.pausado) {
      e.pausado = false;
      enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
    }
    if (d.message === 'panda_pause') e.pausado = true;
    if (d.message === 'panda_ended' && e.play && !e.fin) {
      e.fin = true;
      enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
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
        // ⚠️ NO se sale acá. La escalera de segundos corre TAMBIÉN cuando se
        // conoce la duración, y no es redundante: con un video de 23 minutos el
        // primer hito de 5% cae a los 71 SEGUNDOS, así que hasta entonces no
        // llega un solo avance y la pantalla dice «solo llega el arranque» sobre
        // algo que está midiendo perfecto. Lo mismo le pasa a un visitante real
        // que mira 40 segundos y se va: se registraba como si no hubiera visto
        // nada.
        //
        // El costo es un puñado de eventos más por visita —la escalera es
        // dispersa, no un tick por segundo— y a cambio los primeros segundos, que
        // son donde se pierde a la mayoría, dejan de ser un agujero.
      }
      // Por TIEMPO. Sin duración es la única señal; con duración, la que llega
      // antes del primer 5%.
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
  // ── CLICKS ────────────────────────────────────────────────────────────────
  // Para una landing cuyo CTA es un ancla (#registro) o un link de WhatsApp, el
  // click ES el embudo: entre «visitó» y «dejó sus datos» no había NINGÚN punto
  // intermedio, así que una página que convierte mal no se distinguía de una que
  // nadie mira. Va en captura y NUNCA frena el click: lo que la persona quería
  // hacer tiene que pasar igual, aunque el envío falle.
  var CLICKS = 0;
  document.addEventListener('click', function (ev) {
    try {
      // Tope por carga. Sin esto, un click accidental repetido —o una página con
      // un carrusel— manda cientos de eventos, y el ruido tapa lo que importa.
      if (CLICKS >= 40) return;
      var el = ev.target;
      // Se sube hasta el elemento accionable: el click casi siempre cae en el
      // <span> de adentro del botón, no en el botón.
      for (var i = 0; el && i < 5; i++) {
        var t = (el.tagName || '').toUpperCase();
        if (t === 'A' || t === 'BUTTON' || el.getAttribute && el.getAttribute('role') === 'button') break;
        el = el.parentElement;
      }
      if (!el || !el.tagName) return;
      var tag = el.tagName.toUpperCase();
      if (tag !== 'A' && tag !== 'BUTTON' && el.getAttribute('role') !== 'button') return;
      var href = el.getAttribute ? (el.getAttribute('href') || '') : '';
      // El DESTINO manda sobre el texto: «Confirmar por WhatsApp» y «Escribinos»
      // pueden ser el mismo link, y lo que se quiere contar es adónde va la gente.
      var texto = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      var detalle = href ? (href.indexOf('#') === 0 ? 'ancla ' + href : href) : ('boton: ' + texto);
      if (!detalle) return;
      CLICKS++;
      enviar({ tipo_evento: 'click', detalle: detalle.slice(0, 300) + (texto && href ? ' — ' + texto : '') });
    } catch (e) {}
  }, true);

${bloqueClarity(clarityProjectId)}
  // ── AGENDÓ ────────────────────────────────────────────────────────────────
  // ⚠️ EL EVENTO QUE FALTABA, y para un negocio que vende por llamada es EL
  // evento: la reserva. Lo que pasa adentro del iframe de Calendly es de otro
  // dominio y no se puede espiar — pero Calendly AVISA al padre por postMessage
  // cuando alguien agenda, y eso sí lo podemos escuchar. Es la única forma de
  // cerrar el embudo de una landing cuyo llamado a la acción es una agenda
  // embebida, que hasta hoy terminaba en «vio el video» y nada más.
  window.addEventListener('message', function (ev) {
    try {
      var d = ev.data;
      var e = d && (typeof d === 'string' ? d : d.event);
      if (typeof e !== 'string' || e.indexOf('calendly.') !== 0) return;
      // Solo la reserva confirmada. Calendly emite varios eventos del ciclo
      // (abrió, eligió fecha…) y contarlos todos convertiría «agendó» en «miró
      // el calendario», que es justo la diferencia que importa.
      if (e !== 'calendly.event_scheduled') return;
      enviar({ tipo_evento: 'agendo', detalle: 'calendly' });
    } catch (err) {}
  });

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
          pagina: location.href,
          prueba: prueba
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* nunca romper el formulario del cliente */ }
  }, true);
})();
</script>`;
}
