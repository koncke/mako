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
// mismo índice de plataforma que ya usan Meta/Calendly/Fathom. Lo
// espeja setSetting('landing_token') (lib/settings.ts) — es el ÚNICO que se
// espeja desde ahí, porque lo acuña el server y no puede colisionar. Los
// identificadores que pega el usuario (page id de Meta, event types de Calendly) van por guardarCredencial(), que falla cerrado.
// =============================================================================

import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { getSetting, setSetting } from './settings';
import { getTenantDb, runWithWorkspace } from './workspace';
import { upsertRouting, wsPorIdentificador } from './webhook-routing';
import { APP_BASE_URL } from './app-url';
import { VIDEOS_KEY, parsearVideos, type VideoLanding, VIDEOS_OCULTOS_KEY, parsearOcultos } from './landing-videos';
import { esPreviewDeEditor, normalizarUrl } from './landing-paginas';
import { catalogoPanda } from './panda';
import { esEventoDeVideo } from './vsl-retencion';
import { estadoVideo } from './landing-analisis';
import { enumerar } from './landing-snapshot';
import { type ConsultaPaginada } from './supabase-paginado';
// `verificarPagina`: qué visitas pueden ser de una página (una consulta acotada, no el host entero en serie).
import { TOPE_VISITAS_VERIFICAR, regexDeLaPagina } from './landing-mapa-visitas';
import { distintosPorExclusion, listaPostgrest } from './ids-con-filas';
// Los números del replay NO se escriben de nuevo acá: el grabador los interpola del
// contrato. Un tope distinto del lado del server descarta la cola de cada sesión y
// nadie se entera (ver lib/replay-contrato.ts).
import { REPLAY_LOTE_MAX_BYTES } from './replay-sellado';
import { versionServida } from './pixel-servido';
import { PIXEL_MINIMO_AVISO } from './pixel-aviso';
import { RUTA_CARGADOR } from './pixel-cargador';
import { PARAM_LEER } from './editor-landing/lector';
import { PARAM_LECTOR_CARGADOR } from './editor-landing/lector-script';
import {
  REPLAY_VERSION,
  REPLAY_OPCIONES_RRWEB,
  REPLAY_TOPE_SEGUNDOS,
  REPLAY_TOPE_BYTES,
  REPLAY_PISO_SEGUNDOS,
  REPLAY_PISO_EVENTOS,
  REPLAY_LOTE_MS,
  REPLAY_LOTE_EVENTOS,
  REPLAY_BEACON_MAX_BYTES,
  rutaDeLibreria,
} from './replay-contrato';

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
 *  15 — AGENDÓ también con Cal.com, no solo con Calendly, y con el nombre y el
 *       mail de quien reserva (24/08/2026). Y se arregla el texto de los clics:
 *       el snippet servido borraba todas las eses («¿Qué pa a de pué…»).
 *  19 — se mide el SCROLL: hasta dónde bajó la persona en la página (hitos de
 *       25/50/75/100 + el punto exacto al irse). CON FRENO — el evento del
 *       navegador se dispara por cada pixel, así que el handler agenda una mirada
 *       cada 400 ms y solo se manda al cruzar un hito.
 *  20 — el clic viaja con SU PUNTO (posición en la página, ancho de la ventana y
 *       alto del documento), que es lo que el mapa de calor necesita para pintarlo
 *       sobre la página. Y entran los clics al VACÍO, que hasta acá se descartaban:
 *       son el dato más informativo del mapa —gente tocando algo que no es
 *       clickeable— y van con tipo propio ('clic_vacio') para no contaminar el
 *       escalón del embudo, con 12 por carga de tope y SIN texto del elemento.
 *  10 — se miden AGENDÓ (Calendly avisa al padre por postMessage) y el ciclo de
 *       vida del video: pausa, retoma y fin. Sin lo primero, el embudo de quien
 *       vende por llamada terminaba en «vio el video»; sin lo segundo, «vio 3
 *       minutos» no distinguía a quien miraba de quien lo dejó corriendo.
 *  21 — GRABACIÓN DE SESIÓN: el snippet puede grabar lo que la persona ve y hace
 *       en la página y reproducirlo después. ⚠️ APAGADO para todos: el permiso lo
 *       contesta el servidor en la respuesta del pageview (`landing.replay`, por
 *       workspace), y mientras diga que no, la librería ni se baja. Los campos
 *       tapados viajan tapados desde la primera línea. Ver docs/replay-diseno.md.
 *  22 — el clic viaja ANCLADO AL ELEMENTO que se tocó (la ruta CSS corta, sin
 *       texto, y dónde dentro de su caja), con el alto de la ventana y la marca de
 *       si el elemento es fijo (06/10/2026). Es lo que el mapa de calor de Landing
 *       Analyst necesita para ubicar un toque sobre una foto de la página: el punto
 *       de página de la v20 depende del alto del documento, que medido varía hasta
 *       un 32% en la misma página y el mismo ancho. Y es el primer código SIN el tag
 *       de Clarity: una página repegada con la v21 antes del 06/10 a las 07:23 UTC
 *       todavía lo trae adentro, y con la versión en 21 contaba como al día.
 *  23 — el token viaja en `var CUENTA` y no en `var TOKEN` (09/10/2026). El editor con
 *       IA de un cliente tapaba el código con ******** al pegarlo, y la línea del token
 *       era lo único con cara de secreto: una palabra de las que buscan los detectores
 *       (token, key, secret, api, auth) y un valor de alta entropía. Sale junto con el
 *       CARGADOR de una línea (lib/pixel-cargador.ts, app/m.js/route.ts), que sirve
 *       siempre esta versión: quien lo usa no vuelve a pegar nada.
 *       ⚠️ NO SE LE PIDE A NADIE QUE REPEGUE POR ESTO: a quien tiene la 22 no le cambia
 *       nada de lo que mide. Por eso PIXEL_MINIMO_AVISO (lib/pixel-aviso.ts) queda en 22
 *       y todo lo que pide repegar (el aviso fijo, el WhatsApp del vigilante, el chip y
 *       el bloqueo de «Probar») corta ahí y no en esta constante.
 *  24 — MaKo puede LEER la página como un visitante (14/10/2026). Pedido de Martín: «El mimso error que
 *       nos saltaba con Mauricio "No pude leer el texto de esa página.". Soluciona eso...», y su decisión
 *       «si detecta que tenes el pixel instalado, que lo haga desde allí». Con `?mako_leer=<id>` en la URL
 *       y la ventana de MaKo como `opener`, el Pixel NO MIDE NADA (abrirla para leerla no es una visita, y
 *       los toques del lector no son clics) y carga el lector de `/m.js?leer=<id>`
 *       (lib/editor-landing/lector-script.ts). `VERSION_PIXEL_LECTOR` (lib/editor-landing/lector.ts) dice
 *       desde qué versión el código pegado lo trae.
 *       ⚠️ TAMPOCO SE LE PIDE A NADIE QUE REPEGUE: PIXEL_MINIMO_AVISO sigue en 22. Quien tiene la línea de
 *       /m.js ya la tiene; a quien pegó el código, el lector le llega por la ventana aislada.
 */
export const SNIPPET_VERSION = 24;

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
 *
 * ⚠️ «VIEJO» ES «HAY QUE PEDIRLE QUE REPEGUE», Y ESO CORTA EN `PIXEL_MINIMO_AVISO`, NO EN
 * `SNIPPET_VERSION` (09/10/2026). Con la versión actual, cada subida —también la v23, que
 * sólo renombra una variable— le mandaba el WhatsApp del vigilante a todos los negocios
 * (su dedupKey sale del mismo número) y le ponía el cartel del pulso. El número que se
 * DICE (`instalada`) no cambia; lo que cambia es cuándo se pide algo.
 */
export async function snippetDesactualizado(): Promise<{ viejo: boolean; instalada: number }> {
  const token = (await getSetting(LANDING_TOKEN_KEY))?.trim();
  if (!token) return { viejo: false, instalada: 0 };
  const instalada = Number(await getSetting(SNIPPET_VERSION_KEY)) || 1;
  return { viejo: instalada < PIXEL_MINIMO_AVISO, instalada };
}

/**
 * Qué se pierde quien quedó en una versión vieja, para poder DECÍRSELO.
 *
 * Un aviso que solo dice «actualizá» es una tarea sin motivo, y una tarea sin
 * motivo no la hace nadie — menos todavía cuando lo que tiene puesto parece
 * andar. Al subir SNIPPET_VERSION, sumá su renglón acá.
 */
const NOVEDADES: Record<number, string> = {
  // ⚠️ Cada renglón NO repite los de al lado a propósito: `novedadesDesde()`
  // junta los que faltan, de la más nueva a la más vieja, así que quien está en
  // una versión muy vieja lee lo más importante primero y vuelve a pegar el código
  // UNA sola vez.
  //
  // ⚠️ Y NINGÚN RENGLÓN AFIRMA SI ALGO ESTÁ PRENDIDO O APAGADO. El mismo texto lo
  // lee la pantalla de cualquier negocio y el aviso de WhatsApp: «llega apagada»
  // era falso para los cuatro negocios con la grabación prendida (06/10/2026). Si
  // un mensaje necesita decir el estado, lo agrega quien lo arma, leyendo el dato.
  24: 'que MaKo lea tu página como la ve un visitante —lo que hay dentro de cada desplegable, a dónde lleva cada botón y si tu agenda carga— cuando la analizas o la replicas',
  23: 'una línea de instalación que se actualiza sola: la pegas una vez y cada mejora del Pixel te llega sin volver a pegar nada',
  22: 'el mapa de calor de tu página: en qué parte exacta toca la gente, dibujado sobre tu página y separado en celular y computadora',
  21: 'la grabación de cada visita: mirar lo que hizo cada persona en tu página —dónde se detuvo, qué intentó tocar, en qué punto se fue— desde su ficha en el CRM. Lo que alguien escribe en un formulario viaja tapado, así que no queda grabado',
  20: 'EN QUÉ PUNTO de tu página toca cada persona, que es lo que hace falta para dibujar el mapa de calor. Hasta ahora se guardaba a dónde iba cada clic y nunca dónde se hizo, así que no se podía pintar sobre tu página; y los toques en algo que no es un botón —una foto que parece clickeable, un precio que la gente aprieta esperando que pase algo— se tiraban, cuando son lo que más te dice qué está confundiendo a la gente',
  19: 'hasta dónde baja cada persona en tu página. Hasta ahora se sabía quién entró, qué video vio y qué botón apretó, y nada de cuánto leyó: quien se fue arriba sin leer la oferta y quien llegó hasta el final y no la apretó se veían iguales, y son dos problemas distintos',
  18: 'la retención de tu VSL cuando usa un reproductor moderno: se estaba midiendo dos veces, como si fueran dos videos distintos, así que las reproducciones salían al doble y la curva partida en dos',
  17: 'de qué anuncio viene cada persona que deja sus datos, y qué contestó en tu formulario. Antes el lead entraba sin origen —tu CRM decía «Directo» aunque hubiera llegado por una campaña— y el WhatsApp de aviso solo traía el nombre y el teléfono; ahora trae también lo que completó, así sabes qué le interesa antes de escribirle',
  16: 'la medición de los videos que NO están subidos a tu página: Wistia, YouTube y Vimeo. Hasta ahora un VSL alojado ahí no registraba ni una reproducción, y el panel te decía que lo subieras a otro lado; ahora se mide igual, con su curva de retención. Y de los que no se pueden medir —los de Google Drive— al menos queda registrado que la persona los tocó',
  2: 'la captura automática del formulario de tu página: quien lo completa ingresa solo al CRM',
  3: 'una corrección importante: la versión anterior salió sin identificador y dejó de medir y de capturar',
  4: 'la medición de videos cortos: antes, uno de menos de 15 segundos no registraba ningún avance',
  5: 'la medición de todos los videos por separado: antes, con más de uno, el segundo casi no se medía y su avance se calculaba con la duración del primero',
  6: 'la medición de los clics: qué botones y enlaces usan tus visitantes, incluido el de WhatsApp · y la prueba del código ahora muestra solo tus propios eventos, sin mezclarlos con las visitas del día',
  11: 'distinguir el video que ARRANCA SOLO del que alguien reproduce: con autoplay, hasta ahora contaba como si la persona hubiera querido verlo',
  12: 'saber en CUÁL de tus páginas pasó cada cosa: hasta ahora solo las visitas decían de dónde venían, así que con dos páginas los videos y los clics de las dos caían juntos',
  13: 'medir la pausa, el retomar y el final del video también en los reproductores de Panda: hasta ahora eso solo funcionaba con videos subidos directo a la página',
  15: 'la reserva en tu agenda de Cal.com —hasta ahora solo se registraba la de Calendly, así que quien vende por llamada tenía el embudo cortado justo en la venta— y el nombre y el mail de quien reserva, que entran solos al CRM. Además, el texto de los botones en los que se hace clic ya no llega con las letras "s" borradas',
  14: 'saber cuando alguien se va de tu pagina a otra pestana y cuando vuelve, y cuando cierra: hasta ahora las tres cosas se veian igual',
  10: 'dos eventos que faltaban: cuando alguien AGENDA en tu Calendly embebido —que para vender por llamada es el evento más importante— y las pausas del video, que distinguen a quien lo mira de quien lo dejó corriendo',
  9: 'la medición de los primeros segundos de un video largo: hasta ahora, en un video de 20 minutos no se registraba ningún avance durante el primer minuto — y ahí es donde se pierde a la mayoría',
  8: 'poder ver cada video desde la app al momento de identificarlo: antes solo aparecía un código y había que adivinar',
  7: 'la medición de tu video cuando no usas Panda: con un reproductor común no se registraba ni una reproducción',
};

export function novedadesDesde(instalada: number, max = 3): string {
  // ⚠️ DE LA MÁS NUEVA A LA MÁS VIEJA, Y CORTADA. `Object.entries` recorre las
  // claves numéricas de MENOR a mayor aunque el literal esté escrito al revés, así
  // que la novedad más nueva —la que justifica el aviso— salía ÚLTIMA: medido el
  // 06/10/2026, entre el 66% y el 84% de un texto de 1.042 a 2.240 caracteres que
  // se manda por WhatsApp. Las tres más nuevas alcanzan para dar el motivo; el
  // resto se cuenta.
  const l = Object.entries(NOVEDADES)
    .map(([v, t]) => [Number(v), t] as const)
    .filter(([v]) => v > instalada)
    .sort((a, b) => b[0] - a[0])
    .map(([, t]) => t);
  if (!l.length) return 'mejoras de medición';
  const resto = l.length - max;
  return l.slice(0, max).join(' · ') + (resto > 0 ? ` · y ${resto} ${resto === 1 ? 'mejora más' : 'mejoras más'}` : '');
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

/**
 * Espeja token → ws en webhook_routing solo si el mapeo no está ya vivo.
 *
 * ⚠️ TOLERANTE A PROPÓSITO (07/10/2026), y es la única lectura del ruteo que lo es. No decide de
 * quién es nada que entra: si «no pude leer» se lee como «no está», lo que pasa es un
 * `upsertRouting` de más, que es idempotente (primer reclamante gana) y no lanza. La estricta
 * acá rompería /integraciones por un pestañeo de la base. Lo fija la lista de excepciones de
 * tests/webhooks-ruteo-estricto.test.ts.
 */
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
/**
 * Cuántos eventos dejó una prueba y en qué página fue.
 *
 * Lo usa el aviso de cierre: un conteo concreto —«23 eventos»— es lo que hace
 * que el mensaje diga «quedó registrado» en vez de solo «terminó».
 */
export async function contarEventosDePrueba(prueba: string): Promise<{ eventos: number; pagina: string | null }> {
  try {
    const db = await getTenantDb();
    const [ev, vi] = await Promise.all([
      db.from('vsl_events').select('*', { count: 'exact', head: true }).eq('prueba', prueba),
      db.from('landing_visits').select('landing_url').eq('prueba', prueba).limit(1),
    ]);
    const url = (vi.data?.[0] as { landing_url?: string } | undefined)?.landing_url ?? null;
    let host: string | null = null;
    try { host = url ? new URL(url).hostname.replace(/^www\./, '') : null; } catch { host = null; }
    // La visita cuenta como evento: para quien probó, entrar a la página ES algo
    // que pasó, y decir «0 eventos» sobre una prueba donde se registró la visita
    // sería contradecir el panel que acaba de ver.
    return { eventos: (ev.count ?? 0) + (vi.data?.length ?? 0), pagina: host };
  } catch {
    return { eventos: 0, pagina: null };
  }
}

/** Los videos que el negocio marcó como «no son de mi página». */
export async function getVideosOcultos(): Promise<string[]> {
  return parsearOcultos(await getSetting(VIDEOS_OCULTOS_KEY).catch(() => null));
}

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
    //
    // ⚠️ Y EL `order` SOLO NO ALCANZABA: en ws1 las 1000 filas más nuevas son 25
    // HORAS de eventos (908/día), así que un catálogo que decía cubrir 90 días
    // cubría uno, y un video que dejó de reproducirse anteayer no se podía
    // nombrar. Paginar los 90 días serían ~80.000 filas para quedarse con una
    // decena de ids: se descubren POR EXCLUSIÓN (lib/ids-con-filas.ts) — cada
    // vuelta pide las más nuevas de los videos que todavía no aparecieron.
    type FilaVsl = { video_id: string | null; vsl_titulo: string | null; detalle: string | null; landing_url: string | null };
    const out = new Map<string, { id: string; titulo: string | null; eventos: number; url: string | null; pagina: string | null; redirigeA: string | null }>();
    await distintosPorExclusion<FilaVsl, string>(
      async (excluidos) => {
        // Tipo mínimo a mano: encadenar `.not()` sobre el builder genérico de
        // supabase-js revienta el typecheck («excessively deep»).
        type Q = {
          not(col: string, op: string, v: unknown): Q;
          gte(col: string, v: string): Q;
          order(col: string, o: { ascending: boolean }): Q;
          limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
        };
        let q = (db.from('vsl_events').select('video_id, vsl_titulo, detalle, landing_url') as unknown as Q)
          .not('video_id', 'is', null)
          .gte('created_at', desde);
        if (excluidos.length) q = q.not('video_id', 'in', listaPostgrest(excluidos));
        const { data, error } = await q
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1000);
        if (error) throw new Error(error.message);
        return (data ?? []) as FilaVsl[];
      },
      // Clave CRUDA (sin trim): la exclusión se compara contra el valor tal cual
      // está en la base.
      (r) => r.video_id,
      (r) => {
        const id = r.video_id?.trim();
        if (!id) return;
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
      },
    );
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

    // Lo que no vino en las filas de la vuelta en que el video apareció (la URL
    // viaja solo en el `play`, la página desde la v12) se busca puntual: UNA fila
    // por dato faltante, la más nueva que lo tenga. Son pocos videos.
    for (const v of out.values()) {
      const falta: Array<['url' | 'pagina' | 'titulo', string, (q: ConsultaPaginada) => ConsultaPaginada]> = [];
      if (!v.url) falta.push(['url', 'detalle', (q) => q.like('detalle', 'http%')]);
      if (!v.pagina) falta.push(['pagina', 'landing_url', (q) => q.like('landing_url', 'http%')]);
      if (!v.titulo) falta.push(['titulo', 'vsl_titulo', (q) => q.not('vsl_titulo', 'is', null).neq('vsl_titulo', '')]);
      for (const [campo, col, filtro] of falta) {
        const { data } = await filtro(db.from('vsl_events').select(col).eq('video_id', v.id).gte('created_at', desde) as ConsultaPaginada)
          .order('created_at', { ascending: false })
          .limit(1);
        const valor = ((data?.[0] as Record<string, string | null> | undefined)?.[col] ?? '').trim();
        if (valor) v[campo] = valor;
      }
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
  /** Cuántas visitas en los últimos 30 días, para distinguir «anda» de «andaba». Con `visitasTope`, es un PISO. */
  visitas: number;
  /** Se leyeron las TOPE_VISITAS_VERIFICAR más nuevas y había más: `visitas` es «al menos», no el total. */
  visitasTope?: boolean;
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
    //
    // ⚠️ Y SE FILTRA EN EL SERVER por el HOST. Antes era `.limit(400)` sobre los
    // 30 días y el filtro por URL recién en memoria: en ws1 las 400 más nuevas
    // son 3 días (con 2.552 URLs distintas), así que a cualquier página que no
    // fuera la de más tráfico se le decía «el Pixel no está instalado ahí» sobre
    // una página que manda eventos. La comparación exacta sigue siendo la de
    // `normalizarUrl`.
    //
    // ⚠️ Y ES UNA SOLA CONSULTA ACOTADA (12/10/2026). Hasta ese día se filtraba por el
    // HOST y se leía TODO, en serie: en el ws1 eran 7.180 visitas (8 páginas una
    // detrás de la otra) en cada apertura del mapa de calor, que la llama sólo para
    // saber la versión (relevo v5, área D). Ahora la base trae las más nuevas de ESTA
    // dirección (`regexDeLaPagina`: http o https, el prefijo de Netlify, las barras y
    // cualquier query; un camino más largo no entra), con tope, y la más nueva manda
    // la versión. Si se llegó al tope, `visitas` es un PISO y el texto dice «al menos».
    const patron = regexDeLaPagina(url);
    if (!patron) throw new Error('la dirección normalizada no se pudo leer');
    type FilaVisita = { created_at: string; landing_url: string | null; sv: number | null };
    const { data, error } = await db
      .from('landing_visits')
      .select('created_at, landing_url, sv')
      .gte('created_at', desde)
      .filter('landing_url', 'imatch', patron)
      .order('created_at', { ascending: false })
      .limit(TOPE_VISITAS_VERIFICAR);
    if (error) throw new Error(error.message);
    const crudas = (data ?? []) as FilaVisita[];
    // Las más nuevas primero (así vienen), que es lo que leen `ultima` y la versión.
    const filas = crudas.filter((r) => normalizarUrl(r.landing_url ?? '') === url);
    const visitasTope = crudas.length >= TOPE_VISITAS_VERIFICAR;
    if (!filas.length) {
      return { url, instalada: false, version: null, vieja: false, ultima: null, visitas: 0,
        texto: 'No llega ninguna visita de esta página desde hace 30 días. El Pixel no está instalado ahí, o esa página aún no se publica.' };
    }
    const nVisitas = `${visitasTope ? 'al menos ' : ''}${filas.length} ${filas.length === 1 ? 'visita' : 'visitas'}`;
    // La versión de la visita MÁS RECIENTE: si repegaron el código hace una hora,
    // lo que importa es eso y no las 300 visitas viejas de antes.
    const conSv = filas.find((r) => r.sv != null);
    const version = conSv?.sv ?? null;
    // «Vieja» es «hay que pedirle que repegue», y eso corta en PIXEL_MINIMO_AVISO (ver
    // `snippetDesactualizado`): una página en la 22 no se nombra en el WhatsApp por la v23.
    const vieja = version != null && version < PIXEL_MINIMO_AVISO;
    return {
      url, instalada: true, version, vieja, ultima: filas[0].created_at, visitas: filas.length, visitasTope,
      texto: version == null
        // Llegan visitas pero ninguna dice su versión: son de antes de que el
        // snippet la mandara, o sea de las más viejas que hay.
        ? `Está midiendo (${nVisitas} en 30 días), pero el Pixel es tan antiguo que no informa su versión. Pon la línea del Pixel en lugar del código viejo.`
        : vieja
          ? `Está midiendo con la versión ${version}, y la actual es la ${SNIPPET_VERSION}. Pon la línea del Pixel EN ESTA PÁGINA, en lugar del código viejo, para sumar: ${novedadesDesde(version)}.`
          : version >= SNIPPET_VERSION
            ? `Todo correcto: está midiendo con la última versión (${nVisitas} en 30 días).`
            : `Todo correcto: está midiendo (${nVisitas} en 30 días).`,
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
  id: 'version' | 'pageview' | 'play' | 'profundidad' | 'click' | 'optin';
  label: string;
  estado: 'ok' | 'falta' | 'viejo' | 'na';
  detalle: string;
  /**
   * Es un PASO DEL EMBUDO (llega → ve → clickea → deja sus datos), y por eso va
   * numerado. «Pixel actualizado» y «Grabaciones» no lo son: acompañan.
   *
   * ⚠️ EL NÚMERO NO VIVE EN EL `label`. Estaba escrito a mano —«2. Reproduce tu
   * video»— y eso hacía imposible esconder un paso que no aplica: sacando el 2 y
   * el 3 quedaba «1, 4, 5» y la lista se leía rota. Se numeran los aplicables al
   * pintarlos, así el que no aplica se puede sacar sin dejar un hueco.
   */
  paso?: boolean;
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
  const qVsl = db.from('vsl_events').select('created_at, tipo_evento, porcentaje, segundos, vsl_titulo, detalle, auto, landing_url, video_id, visitor_id');
  const qVis = db.from('landing_visits').select('created_at, landing_url, visitor_id');

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

  // ⚠️ UN OPT-IN QUE FUNCIONA NO DEJA UNA PROPUESTA: DEJA UN LEAD.
  //
  // Este chequeo miraba solo `propuestas`, y una propuesta se crea **únicamente
  // cuando el contacto choca con uno que ya existe** — el camino normal escribe
  // el lead directo. O sea que el renglón «5. Deja sus datos» solo podía ponerse
  // verde si el lead era DUPLICADO: un formulario que anda perfecto lo dejaba en
  // rojo para siempre.
  //
  // Reportado el 2026-08-16 —«envié el form de la landing y la prueba NO lo
  // detectó»— y comprobado mandando un opt-in de prueba con el token real: el
  // server contestó `{ok:true, lead:2246, creado:true}`. El formulario nunca
  // estuvo roto; lo que estaba roto era dónde miraba el chequeo.
  //
  // Se cruza por `visitor_id` y no por el marcador de la prueba porque un lead no
  // guarda ese marcador: lo que sí guarda es el identificador de la visita
  // anónima, que es justamente lo que ata todo lo que esa persona hizo antes.
  const visitantes = [...new Set([
    ...((vsl.data ?? []) as Array<{ visitor_id: string | null }>).map((r) => r.visitor_id),
    ...((visitas.data ?? []) as Array<{ visitor_id: string | null }>).map((r) => r.visitor_id),
  ].filter((x): x is string => !!x))];
  const qLeads = db.from('leads').select('id, created_at, nombre').eq('origen_lead', 'landing');
  const leadsOptin = visitantes.length
    ? await (prueba ? qLeads.in('visitor_id', visitantes) : qLeads.gte('created_at', desde)).limit(10)
    : { data: [] as Array<{ id: number; created_at: string; nombre: string | null }> };

  const leadsFeed = leadsOptin.data ?? [];

  // ⚠️ Los eventos de OTRAS páginas no cuentan. Con dos landings, «llegan las
  // visitas» daba verde por la que sí funciona mientras la elegida no mandaba
  // nada — que es exactamente el caso que este rediseño vino a cerrar.
  //
  // ⚠️⚠️ PERO DURANTE UNA PRUEBA NO SE FILTRA, y esto casi borra la única
  // evidencia que quedó de un agendado real. El marcador YA aísla la prueba —es
  // más preciso que la URL, porque distingue TU visita de la de un desconocido
  // que esté en la misma página—, así que acá el filtro no agrega nada y sí
  // quita: una prueba recorre el SITIO, no una sola URL. El 24/08/2026 el ws13
  // se agendó y terminó en `/gracias?name=Codigo+Inmobiliario&email=…`; ese
  // pageview es de otra ruta, así que filtrar por la landing elegida lo habría
  // sacado del feed. Era lo único en toda la base que probaba que esa persona
  // llegó hasta el final.
  // (`!!prueba` y no `enPrueba`: esa constante se declara más abajo y acá sería
  //  un uso antes de la declaración — `let`/`const` no se izan.)
  const deEstaLanding = (u: string | null | undefined) =>
    !!prueba || !urlLanding || !u || normalizarUrl(u) === normalizarUrl(urlLanding);

  const eventos: EventoDiag[] = [
    ...((vsl.data ?? []) as Array<{ created_at: string; tipo_evento: string | null; porcentaje: number | null; segundos: number | null; vsl_titulo: string | null ; detalle: string | null; auto: boolean | null; landing_url: string | null; video_id: string | null; visitor_id: string | null }>)
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
    ...((visitas.data ?? []) as Array<{ created_at: string; landing_url: string | null; visitor_id: string | null }>)
      .filter((r) => deEstaLanding(r.landing_url))
      .map((r) => ({ ts: r.created_at, tipo: 'pageview', porcentaje: null, segundos: null, auto: false, detalle: r.landing_url })),
    ...((optinsFeed.data ?? []) as Array<{ created_at: string; resumen: string | null }>)
      .map((r) => ({ ts: r.created_at, tipo: 'optin', porcentaje: null, segundos: null, auto: false, detalle: r.resumen })),
    // Un lead creado por el formulario es un opt-in que FUNCIONÓ. Sin esto la
    // lista se quedaba muda justo en el evento más importante del embudo, y la
    // instrucción de arriba dice «completá tu formulario, los eventos aparecen
    // acá»: era una promesa que la pantalla no podía cumplir.
    ...((leadsFeed ?? []) as Array<{ created_at: string; nombre: string | null }>)
      .map((r) => ({ ts: r.created_at, tipo: 'optin', porcentaje: null, segundos: null, auto: false, detalle: r.nombre })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1));

  // ⚠️ LOS CHEQUEOS MIRAN TODO; LA LISTA QUE SE MUESTRA, LAS 25 MÁS NUEVAS.
  //
  // Estaban mirando lo mismo, y por eso la pantalla se contradecía sola. Medido
  // el 2026-08-16 en una prueba real: decía «aún no llega la visita» y dos
  // renglones más abajo «llegan los avances: ya se puede calcular la retención»,
  // con el pageview guardado en la base, con su marcador y su versión.
  //
  // La causa es de ORDEN. La lista se ordena de más nueva a más vieja y se corta
  // en 25 para que el feed sea legible, y el `pageview` y el `play` son los
  // PRIMEROS eventos de cualquier prueba: son los primeros en caerse del corte. El
  // problema nació el día que el snippet empezó a mandar más eventos por visita
  // —clics, salió, volvió—: antes de eso 25 alcanzaba, y por eso nadie lo vio.
  //
  // «Que no entre en la ventana» no es «que no haya pasado». Un chequeo que
  // depende de cuántos eventos entran en una lista de pantalla mide la lista, no
  // el negocio.
  const eventosVisibles = eventos.slice(0, 25);

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
  // ⚠️ Lo que la página NO tiene no se pide. El analizador ya sabe si hay botones
  // propios: sin esta línea, a una landing cuyo CTA es un Calendly embebido se le
  // pedía «hace clic en tus botones» para siempre.
  const tieneBotones = !piezas || piezas.includes('botones') || piezas.includes('link-whatsapp');
  const tieneFormPropio = !piezas || piezas.includes('formulario');
  // ⚠️ La agenda también se deriva del EVENTO, no solo del analizador. El embed
  // se inyecta por JavaScript en runtime (Cal.com se monta desde un chunk), así
  // que el HTML servido puede no tener una sola mención de él. Si llegó un
  // `agendo`, esa página tiene agenda: es un hecho medido, y un hecho medido
  // gana contra una lectura de HTML que puede estar vieja o incompleta.
  const hayAgendo = eventos.some((e) => e.tipo === 'agendo');
  const tieneAgenda = !!piezas?.includes('embed-agenda') || hayAgendo;
  // (Ya no se cuentan los eventos «con segundos»: la versión del código se
  // pregunta, no se infiere. Ver el chequeo 'version'.)
  //
  // ⚠️ ESTO CONTABA CUALQUIER EVENTO QUE NO FUERA UN PAGEVIEW, y por eso el
  // punto 3 salía en ÁMBAR —«solo llega el inicio, no el avance»— sobre landings
  // que no tienen un solo video. Se llamaba `soloVsl` y el nombre decía la
  // verdad el día que se escribió: entonces lo único que no era pageview era un
  // evento del VSL. Desde la v6 el snippet manda clics, y desde la v14 también
  // «se fue», «volvió» y «cerró»: con eso, cualquiera que abra la página y haga
  // UN clic queda contado como si hubiera reproducido un video.
  //
  // Medido el 24/08/2026 sobre el ws13 (Código Inmobiliario, landing sin video):
  // 28 eventos de su prueba —9 clics, 8 «se fue», 5 «volvió», 3 «cerró», 3
  // pageviews— y CERO de video en toda la historia del workspace. El contador
  // daba 25 y el chequeo le informaba un problema de retención de un video que
  // no existe.
  //
  // La regla que queda: un contador que se llama «eventos de X» se filtra por
  // los tipos de X, nunca por «todo menos Y». La lista de lo que no es Y crece
  // sola con cada evento nuevo, y crece en silencio.
  // La lista vive en lib/vsl-retencion.ts, que es donde también la aplica
  // `avanceDe()`. Tenerla en dos lados garantiza que un día se agregue un tipo
  // nuevo en uno solo y los dos contadores dejen de coincidir sin que nadie lo note.
  const eventosDeVideo = eventos.filter((e) => esEventoDeVideo(e.tipo)).length;
  const tuvoVideoAlgunaVez = hayPlay || eventosDeVideo > 0;
  const hayProfundidad = eventos.some((e) => /^[ps]\d+$/.test(e.tipo));

  // ⚠️ ¿ESTA PÁGINA TIENE VIDEO? La pregunta que los chequeos 2 y 3 nunca hacían.
  //
  // `tieneBotones`, `tieneFormPropio` y `tieneAgenda` ya se leían del analizador;
  // el video era el único que no, así que a un negocio sin video se le pedían dos
  // pasos que su página no puede cumplir nunca. Y el helper para contestarlo
  // —`tieneVideoMedible()` en lib/landing-analisis.ts— existía desde hacía
  // semanas sin un solo consumidor.
  //
  // Tres fuentes, y el orden importa:
  //   · sin análisis (`!piezas`) → NO SÉ, y no saber nunca apaga un chequeo: se
  //     ofrecen todos los pasos. Es la misma regla que el resto.
  //   · el analizador vio una pieza de video → sí.
  //   · llegó un evento de video de verdad → sí, y esto MANDA sobre lo anterior.
  //
  // Lo último no es redundante: el analizador lee el HTML servido, que puede
  // venir del cache del CDN (medido en esta landing: `X-Vercel-Cache: HIT` con
  // `Age` de casi 4 h) o no traer nada porque la página se monta por JavaScript.
  // Con esta tercera fuente, el día que el cliente suba su video los chequeos
  // vuelven SOLOS con el primer play, sin que nadie tenga que reanalizar nada.
  // ⚠️ TRES ESTADOS, NO DOS, y el tercero es el que faltaba. Esto era una lista
  // cerrada de cuatro piezas copiada a mano, y todo lo que no estuviera en ella se
  // traducía en pantalla como «Tu página no tiene video, así que este paso no
  // aplica». El cliente del ws13 leyó exactamente eso con su VSL a la vista: el
  // analizador no sabía ver Wistia, y «no lo reconocí» salió como «no lo tenés».
  //
  // Ahora sale del catálogo de hosts (lib/landing-analisis.ts):
  //   · medible        — hay video y el Pixel lo mide. El paso aplica.
  //   · no-medible     — hay video y desde ese host no se puede medir. Se DICE,
  //                      nombrando el host, y el paso no aplica.
  //   · no-reconocido  — el análisis salió bien y no se reconoció ningún
  //                      reproductor. NO se afirma que no tenga video.
  //   · no-se          — no hubo análisis. Se ofrecen TODOS los pasos, como siempre.
  //
  // Y un evento de video REAL sigue ganándole a todo esto: si llegó un play, hay
  // video medible, diga lo que diga el HTML (que puede venir del cache del CDN o
  // montarse por JavaScript).
  const vid = estadoVideo(piezas ?? null);
  const hayVideoMedible = vid.estado === 'medible' || tuvoVideoAlgunaVez;
  const noSeSiHayVideo = vid.estado === 'no-se';
  const soloNoMedible = vid.estado === 'no-medible' && !tuvoVideoAlgunaVez;
  const sinReconocer = vid.estado === 'no-reconocido' && !tuvoVideoAlgunaVez;
  /** Los pasos de video se piden cuando hay algo que medir, o cuando no sabemos. */
  const videoAplica = noSeSiHayVideo || hayVideoMedible;
  // Los dos motivos son distintos y se dicen distinto. El segundo es el que
  // faltaba: antes cualquier página sin una pieza conocida leía «Tu página no
  // tiene video», que es afirmar algo que no sabemos.
  const motivoSinVideo = soloNoMedible
    ? `Tu video está en ${enumerar(vid.noMedibles)}, y desde ahí el reproductor no le avisa nada a la página: la reproducción no se puede medir. Lo que sí queda registrado es que alguien lo tocó.`
    : sinReconocer
      ? 'No reconocí ningún reproductor en tu página. Si tienes un video ahí, puede ser uno que todavía no sabemos medir: escríbenos y lo agregamos.'
      : 'Este paso no aplica a tu página.';

  // ── ¿El formulario entra al CRM? ──────────────────────────────────────────
  // El chequeo que faltaba. El snippet captura el opt-in, pero eso pasa en el
  // server y en silencio: sin esta fila, la única forma de saber si anda era
  // llenar el formulario y después ir a buscar el lead a otra pantalla.
  //
  // Son TRES estados distintos y separarlos importa, porque mandan a lugares
  // distintos: «no lo declaraste» se arregla en /funnel, «todavía no probaste» se
  // arregla llenando tu propio formulario, y «llegó» ya está.
  // Import dinámico: a nivel de módulo esto sería un ciclo. Es el mismo recurso
  // que usa `emitirAviso` con `plantillas`. La puerta se lee de donde el cliente
  // la configura (/funnel), no de una copia — si acá se leyera la tabla a mano,
  // sería el segundo lugar que decide lo mismo y el que se queda viejo.
  // DEFAULT: la puerta del Pixel es del NEGOCIO, no de un lead.
  const { getFunnelDefault } = await import('./funnels');
  const { entradas } = await getFunnelDefault().catch(() => ({ entradas: [] as string[] }));
  const declarado = (entradas as string[]).includes('landing');
  // ⚠️⚠️ PEGAR EL PIXEL YA DECLARA LA ENTRADA (Martín, 04/10/2026): «cargar el
  // pixel en una landing ya debería contar». La ruta del opt-in acepta cualquier
  // opt-in que venga de una PÁGINA, sin mirar la casilla
  // (app/api/track/optin/route.ts), así que `declarado` dejó de decidir si el
  // formulario entra — y este renglón se leía de `declarado`.
  //
  // Es la otra mitad de la regla de la casa: al cambiar quién decide, hay que
  // buscar QUIÉN MIRABA el campo que decidía. Sin esto, la pantalla le pinta en
  // rojo «falta marcar la landing como entrada» a un cliente cuyo formulario SÍ
  // está entrando, y lo manda a una casilla que ya no hace nada.
  //
  // Un pageview de ESTA página es la prueba de que el Pixel está ahí, que es
  // exactamente de lo que la ruta da fe.
  const entraAlCrm = declarado || hayPageview;
  const { data: optins } = entraAlCrm
    ? await db.from('propuestas').select('created_at').eq('origen', 'landing').gte('created_at', desde).limit(1)
    : { data: null };
  const hayOptin = (optins?.length ?? 0) > 0 || ((leadsOptin.data?.length ?? 0) > 0);

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
  // ⚠️ LA VERSION ES DE LA PAGINA, NO DEL WORKSPACE. `landing.snippet_version` es
  // un solo setting que escribe el ULTIMO evento que llega, venga de donde venga:
  // con dos landings publicadas en versiones distintas el veredicto era verdad
  // para una y mentira para la otra, y el bloqueo de «Probar» —que es de
  // workspace— dejaba sin poder probar justo la que SI estaba al dia.
  //
  // `verificarPagina` ya resuelve esto por pagina, leyendo el `sv` de las visitas
  // de ESA URL, y el cron ya la usa desde el 25/08. La pantalla habia quedado atras.
  //
  // Se toma el MAXIMO de las dos fuentes, nunca solo la de la pagina: el setting
  // puede estar mas adelantado si la visita con la version nueva todavia no llego
  // (acaban de repegar el codigo), y un «tienes el codigo viejo» sobre una pagina
  // recien actualizada es el mismo falso positivo, al reves.
  const { instalada: instaladaDelWs } = await snippetDesactualizado();
  const svDeLaPagina = urlLanding ? await verificarPagina(urlLanding).catch(() => null) : null;
  // ⚠️ Y LO QUE LA PÁGINA SIRVE HOY también entra al máximo (06/10/2026). Sin esto,
  // quien acaba de republicar con el código nuevo apretaba «Comprobar» y el primer
  // renglón le decía que tenía la versión vieja: la última visita era de antes. Sólo
  // puede SUBIR el número —un HTML que no se pudo leer no baja nada—, igual que el setting.
  const servida = urlLanding ? await versionServida(urlLanding, { minimo: SNIPPET_VERSION, actual: SNIPPET_VERSION }).catch(() => null) : null;
  const instalada = Math.max(
    svDeLaPagina?.instalada && typeof svDeLaPagina.version === 'number' ? svDeLaPagina.version : 0,
    instaladaDelWs,
    servida ?? 0,
  );

  // ⚠️ Y EL BLOQUEO SOLO FRENA SI ESTA PAGINA GANA ALGO CON LA VERSION NUEVA.
  // Antes alcanzaba con que el numero fuera menor, asi que al subir a v16 los
  // cuatro clientes quedaban con el boton bloqueado — incluida una landing de
  // Panda, a la que la v16 no le cambia nada. Un candado sin llave se saltea, y
  // con el se pierde la mitad que servia.
  //
  // La v16 agrega la medicion de los videos alojados afuera: le sirve a la pagina
  // que tenga uno de esos hosts. Para el resto el renglon queda informativo — se
  // dice que hay una version nueva y no se frena nada.
  //
  // `!piezas` es «no se»: ahi se frena, como en el resto de los chequeos.
  const HOSTS_DE_LA_V16 = ['video-wistia', 'video-youtube', 'video-vimeo', 'video-drive'];
  // ⚠️ LA V19 LE SIRVE A TODAS. Mide el scroll, y no hay landing que no se pueda
  // bajar: el gate por host era correcto para el salto a la v16 —que solo le
  // cambiaba algo a quien aloja el video afuera— y con la v19 puesto deja mudo
  // justo el caso general. Se pregunta por la version, no por las piezas.
  //
  // ⚠️ Y LA v22 TAMBIÉN LE SIRVE A TODAS: ancla el clic para el mapa de calor, y es
  // el primer código sin el tag de Clarity. Por eso el corte es la ÚLTIMA versión
  // que le sirve a todas, no la del scroll: con 19, una página en la 21 leía «para
  // esta página miden igual, no hay apuro» sobre la única versión que le saca el
  // tag de un tercero.
  const ULTIMA_PARA_TODAS = 22;
  const ganaConLaNueva = instalada < ULTIMA_PARA_TODAS
    || !piezas || piezas.some((p) => HOSTS_DE_LA_V16.includes(p));
  // ⚠️ Y EL CORTE ES EL DEL AVISO, no la última versión (09/10/2026): la v23 sólo renombra
  // una variable y trae el cargador de una línea, así que a una página en la 22 no le mide
  // nada distinto, y frenarle la prueba era un candado sin llave.
  const codigoViejo = instalada > 0 && instalada < PIXEL_MINIMO_AVISO && ganaConLaNueva;

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
  // ⚠️⚠️ Y EL 'na' DEJÓ DE AFIRMAR UN HECHO QUE NO SABEMOS.
  //
  // El texto decía «este negocio no recibe leads por un formulario en la
  // página», y eso NO es lo que dice `declarado`: `declarado` dice que nadie
  // marcó la casilla en /funnel, que es otra cosa. El 24/08/2026 el ws13 se
  // agendó de verdad en su propia landing y la pantalla le contestó «no
  // aplica» — sobre el evento más importante de su embudo.
  //
  // La distinción que faltaba: si el analizador VE que la página tiene por dónde
  // entrar un lead (un formulario propio o una agenda embebida), entonces no es
  // «no aplica»: es **una puerta abierta que no está conectada**, y eso es una
  // tarea con acción. Sigue sin ser ámbar cuando de verdad no sabemos nada.
  //
  // ⚠️ Y la señal MÁS FUERTE no es el analizador: es que ya llegó un opt-in y lo
  // bloqueamos nosotros. Eso no es una lectura de HTML que puede estar vieja —
  // es una persona que completó algo en esa página. Si eso pasó, «no aplica» es
  // directamente falso.
  // ⚠️ Y UN BLOQUEO SOLO CUENTA SI HOY SEGUIRÍA BLOQUEANDO. Las filas
  // `optin_bloqueado` de antes del 04/10/2026 son de la política vieja: tratarlas
  // como un problema vivo mandaría a marcar una casilla que ya no cambia nada.
  const hayOptinBloqueado = !entraAlCrm && eventos.some((e) => e.tipo === 'optin_bloqueado');
  const puedeCaptar = hayOptinBloqueado
    || (!!piezas && (piezas.includes('formulario') || piezas.includes('embed-agenda')));
  const paso5: Omit<ChequeoDiag, 'id'> = tieneAgenda && !tieneFormPropio
    ? {
        label: 'Agenda una llamada',
        paso: true,
        // ⚠️ MEDIR LA RESERVA NO ES QUEDARSE CON EL CONTACTO, y en verde eso no se
        // distinguía. Desde la v15 una reserva manda las dos cosas: el evento
        // (que llega siempre) y el opt-in con quién reservó (que el gate del
        // funnel puede tirar). Con `hayAgendo ? 'ok'` a secas, el renglón daba
        // verde —«se registra cuando alguien reserva»— mientras cada persona que
        // agendaba se perdía. Un verde que cierra la pregunta sobre algo que se
        // está perdiendo es peor que un rojo.
        estado: hayOptinBloqueado ? 'falta' : hayAgendo ? 'ok' : 'falta',
        detalle: hayOptinBloqueado
          ? 'Se registra la reserva, pero el contacto de quien reserva no entra al CRM. Pega el código en esta página y vuelve a probar.'
          : hayAgendo
          ? 'Se registra cuando alguien reserva en tu calendario: es el final de tu embudo.'
          : enPrueba ? 'Aún no llega. Reserva un horario en tu propio calendario para probarlo.'
          : 'Aún no llega ninguna reserva. Se registra sola cuando alguien agenda.',
        // Ya NO se ofrece «Activar la landing como entrada de leads»: desde el
        // 04/10/2026 esa casilla no decide si el contacto entra, así que el botón
        // mandaría a hacer un trámite que no arregla nada. Lo que lo arregla es
        // pegar el código, y eso es el paso 3 de esta misma pantalla.
        accion: undefined,
      }
    : {
        label: 'Deja sus datos',
        paso: true,
        // ⚠️ 'na' SOLO cuando de verdad no aplica. Que este negocio no reciba
        // leads por formulario NO es un problema por resolver: es cómo vende. El
        // ámbar queda para lo que SÍ hay que hacer; un aviso permanente entrena
        // a ignorar la lista entera. Pero si su página TIENE formulario o agenda,
        // el problema existe y es de una sola casilla.
        estado: !entraAlCrm ? (puedeCaptar ? 'falta' : 'na') : hayOptin ? 'ok' : 'falta',
        detalle: !entraAlCrm
          ? (hayOptinBloqueado
            ? 'Alguien dejó sus datos y NO entró al CRM. Pega el código en esta página y vuelve a probar.'
            : puedeCaptar
            ? `Tu página tiene ${piezas!.includes('formulario') ? 'un formulario' : 'una agenda'} y sus leads no están entrando. Pega el código en esta página.`
            : 'Este paso aún no aplica: no llega ninguna visita de esta página.')
          : hayOptin
            ? `El formulario llega y la persona ingresa sola al CRM.${pendientes > 0 ? ` Hay ${pendientes} pendiente${pendientes === 1 ? '' : 's'}: ${pendientes === 1 ? 'coincide' : 'coinciden'} con un contacto que ya tienes, así que esa decisión es tuya.` : ''}`
            : enPrueba ? 'Aún no llega. Completa tu formulario en la pestaña que abrimos: ingresará solo al CRM.'
            : 'Aún no llega ninguno. Para probarlo, completa tu propio formulario: ingresa solo al CRM.',
        // El link solo si hay algo que decidir. Un botón permanente al lado de algo
        // que funciona lo convierte en una tarea que nunca se termina.
        // ⚠️ Y si la puerta está abierta sin conectar, el link ES la solución
        // entera: el texto mandaba a «Funnel → De dónde entran tus leads» en
        // prosa, o sea a buscarlo a mano desde una ventana de 440 px.
        accion: pendientes > 0
          ? { texto: pendientes === 1 ? 'Ver el pendiente' : `Ver los ${pendientes} pendientes`, href: '/crm/revisar' }
          : undefined,
      };

  const chequeos: ChequeoDiag[] = [
    { id: 'version', label: 'Pixel actualizado',
      estado: instalada === 0 || !hayPageview ? 'falta' : codigoViejo ? 'viejo' : 'ok',
      detalle: instalada === 0 || !hayPageview ? 'Aún no llega ningún evento para saber qué versión del Pixel tienes instalada.'
        : codigoViejo ? `Tienes la versión ${instalada} y la actual es la ${SNIPPET_VERSION}. Pon la línea del Pixel en lugar del código viejo para sumar: ${novedadesDesde(instalada)}.`
        // Hay una version nueva y a ESTA pagina no le cambia nada: se dice, y no se
        // frena la prueba. Mandar a actualizar algo que va a medir igual es mandar
        // a hacer un tramite.
        : instalada < SNIPPET_VERSION ? `Tienes la versión ${instalada} y la actual es la ${SNIPPET_VERSION}. Para esta página mide igual, así que no hay apuro. Lo nuevo: ${novedadesDesde(instalada)}.`
        : 'Es la última versión.' },
    { id: 'pageview', label: 'Llega a tu página', paso: true,
      estado: hayPageview ? 'ok' : 'falta',
      detalle: hayPageview ? 'El Pixel está instalado y funciona.'
        : enPrueba ? 'Aún no llega la visita. Recarga la pestaña que abrimos.'
        : 'No llega ninguna visita desde hace 24 h. Revisa que el Pixel esté instalado y que la página esté publicada.' },
    // ⚠️ LOS DOS PASOS DE VIDEO SE APAGAN CUANDO LA PÁGINA NO TIENE VIDEO, Y
    // TAMBIÉN DURANTE LA PRUEBA. El `enPrueba` de acá los forzaba a 'falta'
    // siempre: justo en la pantalla que el cliente MIRA, los dos pasos que su
    // página no puede cumplir aparecían como pendientes. La prueba es cuando
    // más importa no pedir lo imposible, no cuando menos.
    { id: 'play', label: 'Reproduce tu video', paso: true,
      // Con SOLO plays automáticos el chequeo no está ni bien ni mal: el player
      // se detectó (que es la mitad técnica) pero nadie eligió ver el video, que
      // es lo que este punto pregunta. Va como 'falta' con el motivo escrito, no
      // como 'ok': un verde acá se lee «esto ya está» y cierra la pregunta.
      estado: hayPlayManual ? 'ok' : videoAplica ? 'falta' : 'na',
      detalle: hayPlayManual ? 'Detectamos tu reproductor de video.'
        : !videoAplica ? motivoSinVideo
        : hayPlayAuto ? 'Tu video arranca solo, así que el reproductor ya se detectó. Dale play a mano para comprobar que también medimos cuando alguien decide verlo.'
        // ⚠️ EN UNA PRUEBA NO SE DICE «nadie en 24 h». La persona ACABA de apretar
        // play; contestarle con una estadística del día es contestarle otra cosa.
        : enPrueba ? 'Aún no llega. Reproduce tu video en la pestaña que abrimos.'
        : 'Nadie reprodujo el video en las últimas 24 h.' },
    { id: 'profundidad', label: 'Se mide el tiempo de retención', paso: true,
      // ⚠️ El ámbar sale de que lleguen eventos DE VIDEO sin avances. Antes salía
      // de `soloVsl`, que contaba clics y cierres: por eso este renglón acusaba un
      // problema de retención en una página sin un solo video.
      estado: hayProfundidad ? 'ok' : !videoAplica ? 'na' : eventosDeVideo > 0 ? 'viejo' : 'falta',
      detalle: hayProfundidad ? 'Llegan los avances: ya se puede calcular la retención de cada lead.'
        // ⚠️ SIN EL «súbelo a Panda». Desde la v16 se mide el video alojado en
        // Wistia, YouTube y Vimeo, así que mandar a mudarlo era hacerle rehacer su
        // página por un límite que ya no existe. El único que no se puede medir es
        // el de Drive, y ahí lo que corresponde es decirlo, no pedir una mudanza.
        : !videoAplica ? motivoSinVideo
        : eventosDeVideo > 0 ? 'Solo llega el inicio, no el avance. Con el Pixel actualizado aparece a los pocos segundos, aunque el video sea corto.'
        : enPrueba ? 'Deja el video reproduciéndose unos segundos.'
        : 'Aún sin datos.' },
    // El click FALTABA, y para una landing cuyo CTA es un ancla (#registro) es el
    // único punto entre «vio» y «dejó sus datos». Sin él no se puede distinguir
    // una página que no convence de una que nadie mira.
    { id: 'click', label: 'Hace clic en tus botones', paso: true,
      estado: hayClick ? 'ok' : !tieneBotones ? 'na' : 'falta',
      detalle: hayClick ? 'Se registran los clics: sabes qué botones y enlaces usa cada visitante.'
        // ⚠️ Se avisa del caso que NO podemos medir, en vez de dejarlo en rojo sin
        // explicación: si el CTA de la página es un formulario embebido (Calendly,
        // Typeform), lo que la persona hace ahí adentro es de otro dominio y
        // ningún pixel del mundo lo ve. Decirlo evita que alguien pierda una
        // tarde buscando por qué no llega.
        // ⚠️ El ejemplo NOMBRA una sola herramienta y a un cliente que usa otra le
        // suena a que el aviso no es para él. «Una agenda embebida» es lo que de
        // verdad describe el caso, y cubre a todas.
        : enPrueba ? 'Aún no llega ninguno. Haz clic en un botón o enlace de tu página. Si tu llamado a la acción es una agenda o un formulario embebido, lo que pase dentro de él no se puede medir: es de otro dominio.'
        : 'Aún no llega ningún clic. Si tu página no tiene botones propios —por ejemplo, si su llamado a la acción es una agenda embebida— es normal.' },
    // El paso 5 se arma arriba: es UNO solo con dos identidades.
    { id: 'optin', ...paso5 },
    // ⚠️ ACÁ HABÍA UN CHEQUEO DE CLARITY («Grabaciones y mapas de calor») y se fue
    // el 06/10/2026 con Clarity entero. Ya mentía antes de irse: mandaba a
    // activarlo «en el paso 1», y el paso 1 del Pixel es elegir la página — Clarity
    // no se configuraba en ninguno de los cuatro. La grabación de la prueba la
    // contesta ahora `chequeoGrabacion`, con la grabación PROPIA
    // (app/api/integraciones/landing/estado/route.ts).
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

  // Lo que viaja a la pantalla es la ventana corta; los chequeos ya se calcularon
  // sobre TODO. `ultima` sale de la lista completa: es «cuándo fue lo último que
  // llegó», y con la lista cortada contestaría «lo último que entra en pantalla».
  return { eventos: eventosVisibles, chequeos, veredicto, urls, codigoViejo, ultima: eventos[0]?.ts ?? null };
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
  // La ruta de la librería del grabador sale del contrato, PARTIDA por el número de
  // versión: la versión la dice el servidor en cada visita, no el snippet. Es la
  // única forma de que arreglar el grabador no exija que el cliente vuelva a pegar
  // el código — hoy hay un workspace con 7.052 visitas midiendo con la v14.
  const SENAL = 7777777;
  const [libAntes, libDespues] = rutaDeLibreria(SENAL).split(String(SENAL));
  // ⚠️ EL TOKEN VA EN «var CUENTA», NO EN «var TOKEN» (v23, 09/10/2026). El editor con IA
  // de un cliente tapaba el código con ******** al pegarlo, y lo único con cara de secreto
  // era esa línea: una palabra de las que buscan los detectores (token, key, secret, api,
  // auth) pegada a un valor de alta entropía. El token es público —va en el HTML de cada
  // página—: no hay nada que esconder, sólo hay que no parecerse a un secreto. Los campos
  // del payload (`t`, y `token` en el opt-in) son el contrato con el server y no se tocan.
  // El análisis de la página (lib/landing-analisis.ts) lee los DOS nombres.
  // Lo fija tests/landing-snippet-emitido.test.ts.
  //
  // ⚠️ LA GUARDA DE UNA SOLA COPIA (13/10/2026) NO SUBE LA VERSIÓN, a propósito: con el
  // código pegado una vez, la página hace exactamente lo mismo. Subirla no manda ningún
  // WhatsApp (eso corta en PIXEL_MINIMO_AVISO), pero «Comprobar» y MaKo (`al_dia`) le
  // dirían a cada página en la 23 que hay una versión nueva, por algo que no le cambia
  // nada. Y la versión no delata la página pegada dos veces: las dos copias mandan el
  // mismo `sv`. Le llega a quien carga la línea de /m.js (se sirve siempre lo actual) y a
  // quien lo pegue de nuevo. Lo que NO cubre: una copia vieja más una nueva, porque la
  // vieja no se anota.
  return `<script>
(function () {
  // Una sola copia por página. Pegado dos veces (en el head y en el body, o el
  // código entero y la línea corta), cada visita, clic y opt-in se mandaba dos veces.
  // La primera que corre se anota y las demás no hacen nada.
  if (window.__makoPixel) return;
  window.__makoPixel = 1;
  var ENDPOINT = '${APP_BASE_URL}/api/track/vsl';
  var CUENTA = '${token}';
  // Versión del snippet: viaja en cada evento para que MaKo sepa quién quedó
  // con el código viejo y le avise. Ver SNIPPET_VERSION.
  var SV = ${SNIPPET_VERSION};

  // Lectura de MaKo (v24): abierta por MaKo para leerla, la página no mide nada
  // y carga el lector. Sin la ventana de MaKo detrás, el parámetro no hace nada.
  try {
    var leer = new URLSearchParams(location.search).get('${PARAM_LEER}');
    if (leer && /^[A-Za-z0-9_-]{16,64}$/.test(leer) && window.opener) {
      var lector = document.createElement('script');
      lector.src = '${APP_BASE_URL}${RUTA_CARGADOR}?${PARAM_LECTOR_CARGADOR}=' + leer;
      (document.head || document.documentElement).appendChild(lector);
      return;
    }
  } catch (e) {}

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

  function enviar(data, alResponder) {
    data.t = CUENTA;
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
      var pedido = fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      });
      // La respuesta se LEE solo cuando alguien la pidio. El pageview la pide: ahi
      // viene el permiso para grabar la sesion (ver el bloque del grabador, al
      // final). Cero requests extra, y el server es el unico que decide — la misma
      // regla que ya cumple el bloque de opt-in.
      if (alResponder) {
        pedido
          .then(function (r) { return r && r.ok ? r.json() : null; })
          .then(function (j) { if (j) { try { alResponder(j); } catch (e) {} } })
          .catch(function () {});
      } else pedido.catch(function () {});
    } catch (e) {}
  }

  // Visita a la landing. Su respuesta trae el interruptor del grabador de sesion.
  enviar(
    { tipo_evento: 'pageview', landing_url: location.href, referrer: document.referrer || null },
    function (r) { if (r && r.rec) replayArrancar(r.rec); }
  );

  // VSL (Panda Video) — si no hay video en la página, esto no hace nada.
  function tituloVsl(id) {
    var f = document.querySelectorAll('iframe');
    for (var i = 0; i < f.length; i++) if (id && (f[i].src || '').indexOf(id) !== -1 && f[i].title) return f[i].title;
    // ⚠️ EL NOMBRE DEL PROVEEDOR VA PARTIDO. Escrito entero, este snippet se
    // delata a si mismo: el analizador de piezas busca esa marca en el JavaScript
    // propio de la pagina, y toda landing que copie el codigo a un archivo suyo
    // (como /mako-tracking.js) aparecia con un video que no tiene. Medido el
    // 11/09/2026 con el analizador real: el snippet servido como archivo daba la
    // pieza «video de Panda» en una pagina vacia.
    var MP = 'panda' + 'video';
    for (var j = 0; j < f.length; j++) if ((f[j].src || '').indexOf(MP) !== -1 && f[j].title) return f[j].title;
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
      // El video que arma el embed inline de «W» lo mide su API (bloque «W», más
      // abajo). Engancharlo acá también lo contaba DOS veces, con un id interno del
      // reproductor, una URL blob: que no abre nada y sin el fin de un video con loop.
      if (esDeW(el)) { el.__mko = true; continue; }
      el.__mko = true;
      // ⚠️ Un video de luz que aparece ADENTRO de un player que ya se mide por su
      // host (el bloque de players de más abajo) no se engancha: ese host ya
      // manda sus eventos, y engancharlo contaba la misma reproducción dos veces
      // (medido el 11/09/2026 con un host que avisa play y recién después crea
      // su video). Gana el primero que se registró, igual que entre hosts.
      for (var pa = el.parentNode; pa && pa.nodeType === 1 && !pa.__mkoH; pa = pa.parentNode) {}
      if (pa && pa.nodeType === 1) continue;
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

  // ── EL REPRODUCTOR COMO ETIQUETA PROPIA (el player nuevo de Wistia) ──────
  // ⚠️ NI IFRAME, NI postMessage, NI UN ELEMENTO DE VIDEO A LA VISTA. Ese player
  // es un custom element que guarda su video adentro de un shadow root abierto
  // (medido el 11/09/2026): document.querySelectorAll no lo encuentra en ningún
  // momento del ciclo, así que el enganche nativo de arriba no lo mide.
  //
  // Los eventos los despacha SOBRE EL ELEMENTO, sin bubbles y sin composed, pero
  // la fase de CAPTURA pasa por document igual. Un listener por nombre alcanza:
  // no se recorre el DOM ni ningún shadow root, y agarra también a los players
  // que se montan después de cargar.
  //
  // ⚠️ LÍMITE MEDIDO: si el player vive adentro del shadow root de OTRO
  // componente, sus eventos no salen de ahí (composed: false) y esto no lo ve.
  // Un listener puesto en ese shadow root los recibió; el de document, ninguno.
  //
  // ⚠️ play y pause se llaman IGUAL que los del video común, y esos también pasan
  // por acá: sin el filtro por la forma del target, cada play nativo se contaría
  // dos veces, con dos ids.
  //
  // Se lo reconoce por su FORMA (mediaId + percentWatched) y no por el nombre de
  // la etiqueta: ese nombre es la marca que el analizador de piezas persigue, y
  // este texto viaja pegado en la página del cliente.
  function wisHost(t) {
    try {
      return (t && typeof t.mediaId === 'string' && t.mediaId && ('percentWatched' in t)) ? t : null;
    } catch (x) { return null; }
  }
  // ⚠️ EL ID SE FIJA LA PRIMERA VEZ QUE SE VE EL ELEMENTO, no se relee en cada
  // evento. mediaId copia el atributo media-id al instante, pero cambiarle ese
  // atributo a un player ya cargado NO carga el otro video (medido el 11/09/2026:
  // 10 s reproduciendo y 8 s en pausa, el mismo contenido con su name y su
  // duration, y ningún evento de carga). Releerlo le mandaba al id nuevo los
  // hitos, la escalera, el fin y el título del video que se estaba viendo, sin un
  // solo play suyo. Si el player sí carga otro media, lo anuncia con api-ready, y
  // ahí se vuelve a fijar.
  function wisId(p) {
    if (!p.__mkoW) p.__mkoW = String(p.mediaId).slice(0, 40);
    return p.__mkoW;
  }
  try {
    document.addEventListener('api-ready', function (ev) {
      var p = wisHost(ev.target);
      if (p) p.__mkoW = String((ev.detail && ev.detail.mediaId) || p.mediaId).slice(0, 40);
    }, true);
  } catch (x) {}
  function wisLeer(p, e) {
    var t = Number(p.currentTime);
    if (isFinite(t) && t >= 0) e.segs = t;
    // duration vale 0 hasta que el player tiene los datos del video (medido): con
    // el guard > 0 no se divide por cero ni se pisa una duración buena.
    var d = Number(p.duration);
    if (d > 0 && isFinite(d)) {
      e.dur = d;
      e.pct = Math.min(100, Math.round((e.segs / d) * 100));
    }
    if (!e.tit && p.name) e.tit = String(p.name).slice(0, 200);
  }
  function wisOir(nombre, fn) {
    try {
      document.addEventListener(nombre, function (ev) {
        var p = wisHost(ev.target);
        if (!p) return;
        var id = 'w:' + wisId(p);
        var e = est(id);
        try { wisLeer(p, e); fn(p, id, e); } catch (err) {}
      }, true);
    } catch (x) {}
  }
  function wisAvance(p, id, e) {
    if (e.dur > 0) {
      var h = Math.floor(e.pct / 5) * 5;
      if (h >= 5 && !e.hitos[h]) {
        e.hitos[h] = true;
        enviar({ tipo_evento: 'p' + h, porcentaje: e.pct, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      }
    }
    // La escalera corre TAMBIÉN con duración conocida, por lo mismo que en Panda:
    // en un video de 11 minutos el primer 5% cae a los 35 segundos.
    for (var k = 0; k < ESCALERA.length; k++) {
      var s = ESCALERA[k];
      if (e.segs >= s && !e.seg[s]) {
        e.seg[s] = true;
        enviar({ tipo_evento: 's' + s, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      }
    }
  }
  wisOir('play', function (p, id, e) {
    e.wFin = false;
    if (e.play) {
      // Igual que el nativo: el play de un video ya arrancado es RETOMAR.
      enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      return;
    }
    e.play = true;
    // La URL pública del embed: abre sin login, con el título y el video. Sale del
    // id FIJADO, no del atributo de hoy, por lo mismo que el id.
    enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: id, vsl_titulo: e.tit, auto: !huboInteraccion, detalle: 'https://fast.' + 'wistia.net/embed/iframe/' + encodeURIComponent(id.slice(2)) });
  });
  wisOir('pause', function (p, id, e) {
    // La pausa que acompaña al fin no es una pausa.
    if (!e.play || p.ended || p.state === 'ended') return;
    enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
  });
  wisOir('time-update', wisAvance);
  // ⚠️ AL TERMINAR DISPARA DOS EVENTOS, end Y ended, en el mismo instante
  // (medido, también con el final en reset). Se escuchan los dos y la marca por
  // ciclo deja pasar uno: sin ella, cada final contaba dos veces. El play
  // siguiente la baja, así que volver a verlo entero vuelve a mandar su fin,
  // igual que el video común.
  function wisFin(p, id, e) {
    if (e.wFin) return;
    e.wFin = true;
    // El último tramo antes del fin: el tick que lo lleva al 100% llega DESPUÉS.
    wisAvance(p, id, e);
    enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
  }
  wisOir('end', wisFin);
  wisOir('ended', wisFin);

  // ── PLAYERS QUE SON UN CUSTOM ELEMENT (el video vive en su shadow root) ────
  // ⚠️ querySelectorAll('video') NO ENTRA A UN SHADOW ROOT, y los eventos del
  // video de adentro tampoco salen de ahí: play, pause y timeupdate son
  // composed:false. Un player armado como web component era invisible entero:
  // ni el enganche por elemento de arriba ni su MutationObserver lo ven (medido
  // el 11/09/2026: un nodo agregado adentro de un shadow abierto no aparece en
  // el observer del documento).
  //
  // Lo que SÍ sale es lo que el player re-despacha SOBRE SU HOST, que es lo que
  // hacen los players que imitan la API de un video. Esos eventos no burbujean,
  // pero un listener de CAPTURA en document los recibe igual, con target = el
  // host. Medido con dos players reales —uno despacha composed desde adentro y
  // llega retargeteado al host; el otro despacha directo en el host, composed
  // false, y al avance lo llama time-update, con guion— y con custom elements
  // escritos a mano.
  //
  // Por qué así y no recorriendo shadow roots: no hay selector para «tiene
  // shadow root», así que habría que visitar cada elemento, y el observer no ve
  // lo que cambia adentro de un shadow: habría que re-recorrer en cada mutación.
  // Esto no recorre nada: seis listeners y una salida en la primera línea.
  //
  // ⚠️ Lo que NO re-despacha sigue sin medirse: un shadow CERRADO mudo, y
  // también un player que despacha sus eventos SOBRE SU VIDEO DE LUZ en vez de
  // sobre el host (medido con uno real: ahí gana el enganche por elemento, y el
  // id sale por POSICIÓN si ese video no tiene id ni src).
  //
  // ⚠️ ACÁ NO SE NOMBRA NINGÚN PROVEEDOR, por lo mismo que en el bloque de la
  // agenda: este texto viaja en la página del cliente y el analizador lo lee.
  var HOSTS = [];
  function hostDeMedia(t, n) {
    // Un no-host se recuerda, pero se vuelve a mirar en cada play: un player que
    // todavía no terminó de armar su API no puede quedar descartado para siempre.
    if (t.__mkoH || (t.__mkoH === null && n !== 'play')) return t.__mkoH;
    var tag = String(t.tagName || '').toLowerCase();
    // API de media en el host: currentTime y duration numéricos, muted booleano
    // y play(). El muted deja afuera a lo que «reproduce» algo que no es un
    // video: un visor 3D tiene play, currentTime y duration, y no tiene audio.
    var ok = tag.indexOf('-') > 0 && typeof t.currentTime === 'number' && typeof t.duration === 'number' &&
      typeof t.muted === 'boolean' && typeof t.play === 'function';
    // ⚠️ SIN DOBLE CONTEO, Y EN LAS DOS DIRECCIONES: gana el primero que se
    // registra. Un envoltorio con un video de luz adentro ya lo mide el enganche
    // por elemento. Y un host que CONTIENE a otro ya medido, o que está ADENTRO
    // de uno ya medido, no se registra. Mirar una sola dirección suponía que el
    // de adentro despacha primero, y no siempre: un envoltorio que avisa el play
    // ANTES de pedírselo al player de adentro se contaba dos veces (medido el
    // 11/09/2026: dos plays, dos pausas, dos fines y dos exits por una sola
    // reproducción). El caso espejo del video de luz —el que aparece DESPUÉS de
    // que el host se registró— lo corta el enganche por elemento, que no engancha
    // un video que vive adentro de un host ya medido (ver la PARTE 2).
    if (ok && t.querySelector('video')) ok = false;
    // ⚠️ Y NO SE REGISTRA LO QUE UNA RAMA PROPIA YA MIDE. Este enganche es
    // genérico —cualquier custom element con API de media— y eso incluye al
    // player que la rama de más arriba reconoce por su FORMA. Los dos escuchan
    // los mismos play/pause/time-update en captura sobre document, así que el
    // mismo video salía DOS VECES y con dos identidades: una por el nombre de
    // la etiqueta y otra por su id de media. Medido en producción el
    // 27/09/2026 sobre el VSL de un cliente: 348 plays con un id y 348 con el
    // otro, los 348 pares dentro de 2 segundos, y la curva de retención
    // partida entre dos videos que la pantalla no sabía que eran el mismo — se
    // reportó como que la retención no se medía bien.
    //
    // Gana la rama propia, y no es un empate: mide la escalera de segundos que
    // ésta no tiene (270 eventos contra 0 en la misma medición) y sabe armar la
    // URL pública del embed. Alcanza con cortar de este lado porque la
    // pertenencia se decide por la FORMA del elemento y no por quién se
    // registró primero, así que no depende del orden.
    if (ok && wisHost(t)) ok = false;
    for (var i = 0; ok && i < HOSTS.length; i++) if (HOSTS[i] !== t && (t.contains(HOSTS[i]) || HOSTS[i].contains(t))) ok = false;
    if (!ok) { t.__mkoH = null; return null; }
    // El id: lo que identifica AL VIDEO (el atributo de id del player), después
    // el id del elemento, después su src y recién si no hay nada la posición.
    // Siempre con la etiqueta adelante: dos players pueden usar la misma clave,
    // y el id tiene que decir de cuál vino.
    var clave = null;
    var attrs = ['media-id', 'playback-id', 'video-id', 'asset-id', 'id'];
    for (var j = 0; !clave && j < attrs.length; j++) clave = t.getAttribute(attrs[j]);
    var src = typeof t.src === 'string' ? t.src : (t.getAttribute('src') || '');
    if (src.indexOf('http') !== 0) src = '';
    if (!clave && src) clave = src.split('//').slice(1).join('//');
    if (!clave) clave = 'pos' + Array.prototype.indexOf.call(document.getElementsByTagName(tag), t);
    // La URL para reconocerlo: el archivo si es uno que se abre (una lista de
    // reproducción adaptativa no se mira en un navegador de escritorio); si no,
    // la página con el id del video en el fragmento.
    var h = {
      id: (tag + ':' + clave).slice(0, 120),
      url: (src && !/[.](m3u8|mpd)([?#]|$)/i.test(src)) ? src : location.href.split('#')[0] + '#' + tag + ':' + clave
    };
    t.__mkoH = h;
    HOSTS.push(t);
    return h;
  }
  function alEventoDeHost(ev) {
    var t = ev.target;
    // El video de luz ya tiene sus listeners: acá se sale en la primera línea.
    if (!t || t.nodeType !== 1 || t instanceof HTMLMediaElement) return;
    var n = ev.type;
    var h = hostDeMedia(t, n);
    if (!h) return;
    var id = h.id, e = est(id);
    if (!e.tit) e.tit = t.getAttribute('title') || t.getAttribute('aria-label') || t.getAttribute('metadata-video-title') || (typeof t.name === 'string' && t.name) || null;
    if (n === 'play') {
      // ⚠️ EL MISMO PLAY PUEDE LLEGAR DOS VECES: despachado composed desde adentro
      // del shadow Y otra vez sobre el host, con el mismo target. Se sigue la
      // transición pausado → sonando, que es lo único que un video nativo reporta
      // como play; sin esto el segundo llegaba como un «retoma» falso.
      if (e.sonando) return;
      e.sonando = true;
      e.finH = false;
      if (e.play) {
        enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        return;
      }
      e.play = true;
      enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: id, vsl_titulo: e.tit, auto: !huboInteraccion, detalle: h.url.slice(0, 300) });
      return;
    }
    if (n === 'pause') {
      if (!e.sonando) return;
      e.sonando = false;
      // La pausa que dispara el fin no es una pausa (igual que en el nativo).
      if (t.ended === true || t.state === 'ended' || !e.play) return;
      enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      return;
    }
    if (n === 'ended' || n === 'end') {
      // ⚠️ Los dos nombres pueden llegar en el MISMO milisegundo: medido con un
      // player que manda 'end' y 'ended' juntos al terminar. Un fin por
      // reproducción, y se rearma con el próximo play.
      e.sonando = false;
      if (e.finH) return;
      e.finH = true;
      enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      return;
    }
    // timeupdate o time-update: el avance se LEE del host; el evento solo avisa.
    e.segs = Number(t.currentTime) || 0;
    var dur = Number(t.duration);
    if (dur > 0 && isFinite(dur)) {
      e.dur = dur;
      e.pct = Math.min(100, Math.round((e.segs / e.dur) * 100));
      var hh = Math.floor(e.pct / 5) * 5;
      if (hh >= 5 && !e.hitos[hh]) {
        e.hitos[hh] = true;
        enviar({ tipo_evento: 'p' + hh, porcentaje: e.pct, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
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
  }
  // Los dos nombres del avance y los dos del fin: hay players que los escriben
  // distinto. Un nombre de más no duplica nada: el play y la pausa siguen la
  // transición, el fin se manda una vez por reproducción y los hitos una vez.
  ['play', 'pause', 'ended', 'end', 'timeupdate', 'time-update'].forEach(function (n) {
    try { document.addEventListener(n, alEventoDeHost, true); } catch (err) {}
  });

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

  // ── YOUTUBE (iframe) ──────────────────────────────────────────────────────
  // ⚠️ UN IFRAME DE YOUTUBE NO LE DICE NADA A LA PAGINA SI NO SE LO PIDEN, Y SIN
  // enablejsapi=1 EN SU DIRECCION NO LO DICE NUNCA. Medido el 11/09/2026 con el
  // codigo que hoy da YouTube para pegar (/embed/ID?si=…) y tambien con el que
  // pega una landing a mano (/embed/ID?rel=0): cero mensajes durante la carga,
  // doce pedidos de escucha, el play, la pausa y la retoma. El mismo player con
  // enablejsapi=1 contesta al primer pedido y manda estado, segundos, duracion y
  // titulo cada ~266 ms. Por eso el snippet le agrega ese parametro — solo a los
  // iframes que NO lo traian — y lo hace apenas aparecen, que es el unico momento
  // en que nadie pudo haberles dado play: cambiar la direccion recarga el iframe,
  // y reproduciendo, el video vuelve al principio.
  //
  // ⚠️ AL QUE YA TRAIA enablejsapi=1 NO SE LE PIDE NADA: SOLO SE LO ESCUCHA. Ese
  // parametro lo pone quien usa la API del player, y un pedido de escucha nuestro
  // le rompe la suya en las dos direcciones (medido): si llega despues del suyo,
  // el player pasa a hablarle a nuestro id y su onStateChange no dispara mas; si
  // llega antes, su player contesta «ya inicializado», su onReady no dispara nunca
  // y se queda sin metodos. Lo que el player le manda a esa API pasa igual por
  // esta ventana, asi que leerlo alcanza.
  //
  // El id va con prefijo (yt:) para que no se confunda con uno de Panda o de un
  // video propio, y el detalle es la direccion de ver el video, no la del embed:
  // es la que se abre, y no es una marca que busque el analizador de piezas.
  var YTS = [];
  var YT_EMBED = /^https?:\\/\\/(www\\.)?youtube(-nocookie)?\\.com\\/embed\\/([A-Za-z0-9_-]{6,20})/;
  var YT_ORIGEN = /^https:\\/\\/(www\\.)?youtube(-nocookie)?\\.com$/;
  var YT_ID = 'mko-yt';
  // Los iframes que ya estaban cuando arranco el snippet se parchan solo si
  // arranco en los primeros segundos y el foco no esta adentro de ese iframe. Si
  // el snippet llego tarde, recargar puede cortarle el video a alguien: se deja.
  var ytTemprano = !(window.performance && performance.now) || performance.now() < 10000;

  function ytOir(y) {
    if (y.pasivo) return;
    if (y.timer) clearInterval(y.timer);
    y.vivo = false;
    var intentos = 0;
    y.timer = setInterval(function () {
      if (y.vivo || ++intentos > 60) { clearInterval(y.timer); y.timer = null; return; }
      try { y.f.contentWindow.postMessage('{"event":"listening","id":"' + YT_ID + '","channel":"widget"}', '*'); } catch (err) {}
    }, 250);
  }

  // ⚠️ SI APARECE OTRA API EN LA MISMA PAGINA, SE LE DEVUELVE EL PLAYER. Que el
  // iframe no trajera enablejsapi=1 no garantiza que nadie vaya a usar la API
  // despues: el disparador de video de un gestor de etiquetas le agrega ese
  // parametro el mismo y engancha su player cuando su contenedor carga, o sea
  // varios segundos despues que el snippet — y si el snippet ya lo parcho, el
  // ajeno ni recarga: engancha sobre un player ya inicializado, el player le
  // contesta «ya inicializado» y esa API queda muerta, sin onReady y sin metodos
  // (medido). Se reconoce porque el player empieza a contestar con un id que no
  // es el nuestro. Ahi el snippet deja de pedir para siempre en ese iframe y lo
  // recarga UNA vez: al recargar, el ajeno vuelve a pedir solo —su propio
  // listener de load reinicia el sondeo— y esta vez el player le contesta a el,
  // mientras el snippet sigue midiendo en pasivo lo mismo que le llega a esa API.
  // Lo que NO se recarga es un video que esta reproduciendo: cortarle el video a
  // alguien es peor que dejar sin metodos a una API que ya arranco mal.
  function ytCeder(y) {
    if (y.pasivo) return;
    y.pasivo = true;
    if (y.timer) { clearInterval(y.timer); y.timer = null; }
    if (y.recargado || y.estado === 1) return;
    y.recargado = true;
    try { y.f.src = y.f.src; } catch (err) {}
  }

  function ytRevisar(f, puedeParchar) {
    var src = f.src || '';
    var m = YT_EMBED.exec(src);
    if (!m) return;
    var tiene = /[?&]enablejsapi=1(&|#|$)/.test(src);
    var y = f.__mkoY;
    if (!y) {
      y = f.__mkoY = { f: f, estado: null, cual: null, vivo: false, timer: null, pasivo: tiene, recargado: false };
      YTS.push(y);
    }
    y.vid = m[3] === 'videoseries' ? null : m[3];
    if (!tiene) {
      if (!puedeParchar) return;
      var i = src.indexOf('#');
      var base = i >= 0 ? src.slice(0, i) : src;
      base = base.replace(/([?&])enablejsapi=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
      y.pasivo = false;
      f.src = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'enablejsapi=1' + (i >= 0 ? src.slice(i) : '');
      return;
    }
    ytOir(y);
  }

  function ytEnganchar(f, puedeParchar) {
    if (f.__mkoI) return;
    f.__mkoI = true;
    // Si la pagina le cambia el video al mismo iframe (React lo hace al cambiar
    // una prop), el src vuelve sin el parametro: se lo vuelve a poner en la misma
    // tarea, y medido con React eso es UNA carga, no dos.
    try { new MutationObserver(function () { ytRevisar(f, true); }).observe(f, { attributes: true, attributeFilter: ['src'] }); } catch (err) {}
    try { f.addEventListener('load', function () { if (f.__mkoY && YT_EMBED.test(f.src || '')) ytOir(f.__mkoY); }); } catch (err) {}
    ytRevisar(f, puedeParchar);
  }

  function ytBuscar(nodo) {
    if (!nodo) return;
    if (nodo.nodeName === 'IFRAME') { ytEnganchar(nodo, true); return; }
    if (!nodo.getElementsByTagName) return;
    var l = nodo.getElementsByTagName('iframe');
    for (var i = 0; i < l.length; i++) ytEnganchar(l[i], true);
  }

  function ytAvance(e, id) {
    if (e.dur > 0) {
      e.pct = Math.min(100, Math.round((e.segs / e.dur) * 100));
      var h = Math.floor(e.pct / 5) * 5;
      if (h >= 5 && !e.hitos[h]) {
        e.hitos[h] = true;
        enviar({ tipo_evento: 'p' + h, porcentaje: e.pct, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      }
    }
    // La escalera corre TAMBIEN con duracion conocida, por la misma razon que en
    // Panda: en un video largo el primer 5% llega tarde.
    for (var k = 0; k < ESCALERA.length; k++) {
      var s = ESCALERA[k];
      if (e.segs >= s && !e.seg[s]) {
        e.seg[s] = true;
        enviar({ tipo_evento: 's' + s, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      }
    }
  }

  // Estados del player: -1 sin empezar, 0 terminado, 1 reproduciendo, 2 pausado,
  // 3 cargando, 5 listo. Solo cuentan los cambios: 1 despues de 3 es la carga
  // que termino, no una retoma.
  function ytEstado(e, id, s) {
    if (s === 1) {
      if (!e.play) {
        e.play = true;
        e.pausado = false;
        enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: id, vsl_titulo: e.tit, auto: !huboInteraccion, detalle: 'https://www.youtube.com/watch?v=' + id.slice(3) });
      } else if (e.pausado) {
        e.pausado = false;
        enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      }
      return;
    }
    if (!e.play) return;
    // Al terminar el player NO pasa por pausado (medido: 1 y despues 0), asi que
    // no hay una pausa falsa que descartar como con el video nativo.
    if (s === 2 && !e.pausado) {
      e.pausado = true;
      enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
    } else if (s === 0) {
      e.pausado = true;
      // ⚠️ EL ULTIMO SEGUNDO QUE AVISA EL PLAYER NO LLEGA A LA DURACION, asi que
      // el hito del 100% no salia nunca: medido, un video que YouTube declara de
      // 95 s termina avisando 94.30 —el 99%— y el ultimo hito que salia era p95.
      // El video nativo SI lo manda, porque al terminar su currentTime ES la
      // duracion. Terminar es el 100% por definicion, y la curva de retencion se
      // arma con los hitos: sin este, ningun video de YouTube llega al ultimo
      // corte. Sale ANTES del fin, en el mismo orden que en el nativo.
      if (e.dur > 0 && !e.hitos[100]) {
        e.hitos[100] = true;
        e.pct = 100;
        enviar({ tipo_evento: 'p100', porcentaje: 100, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
      }
      enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
    }
  }

  function ytInfo(y, info) {
    var vd = info.videoData;
    var vid = (vd && vd.video_id) || y.vid;
    if (!vid) return;
    if (vid !== y.cual) { y.cual = vid; y.estado = null; }
    var id = 'yt:' + vid;
    var e = est(id);
    if (vd && vd.title) e.tit = String(vd.title).slice(0, 200);
    else if (!e.tit) e.tit = y.f.getAttribute('title') || null;
    if (info.duration > 0) e.dur = info.duration;
    var hayTiempo = typeof info.currentTime === 'number';
    if (hayTiempo) e.segs = info.currentTime;
    var st = typeof info.playerState === 'number' && info.playerState !== y.estado ? info.playerState : null;
    if (st !== null) y.estado = st;
    // play antes que el avance; pausa y fin despues, para que salgan con el
    // porcentaje del ultimo segundo y el p100 no llegue detras del fin.
    if (st === 1) ytEstado(e, id, st);
    if (hayTiempo && e.play) ytAvance(e, id);
    if (st !== null && st !== 1) ytEstado(e, id, st);
  }

  window.addEventListener('message', function (ev) {
    if (!YTS.length || typeof ev.data !== 'string' || !YT_ORIGEN.test(ev.origin || '')) return;
    var y = null;
    for (var i = 0; i < YTS.length; i++) if (YTS[i].f.contentWindow === ev.source) { y = YTS[i]; break; }
    if (!y) return;
    var d;
    try { d = JSON.parse(ev.data); } catch (err) { return; }
    if (!d || !d.event) return;
    y.vivo = true;
    // El player le contesta al ultimo que le pidio escuchar: un id ajeno es otra
    // API enganchada al mismo iframe. Ver ytCeder.
    if (d.id && d.id !== YT_ID) ytCeder(y);
    if ((d.event === 'initialDelivery' || d.event === 'infoDelivery') && d.info && typeof d.info === 'object') ytInfo(y, d.info);
  });

  // ⚠️ UN CLIC ADENTRO DE UN IFRAME NO LO VE ESTA PAGINA: el pointerdown cae en el
  // documento del player. Sin esto, quien entra y aprieta play directo en el video
  // queda contado como reproduccion automatica. Lo que si llega (medido) es que la
  // ventana pierde el foco con el iframe como elemento activo, en el mismo clic.
  window.addEventListener('blur', function () {
    try { var a = document.activeElement; if (a && a.tagName === 'IFRAME') huboInteraccion = true; } catch (err) {}
  });

  (function () {
    var l = document.getElementsByTagName('iframe');
    for (var i = 0; i < l.length; i++) ytEnganchar(l[i], ytTemprano && document.activeElement !== l[i]);
  })();
  try {
    new MutationObserver(function (recs) {
      for (var r = 0; r < recs.length; r++) for (var a = 0; a < recs[r].addedNodes.length; a++) ytBuscar(recs[r].addedNodes[a]);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (err) {}

  // ── VIMEO (el reproductor en su iframe) ───────────────────────────────────
  // ⚠️ SIN ESTO, UN VSL EN VIMEO ERA INVISIBLE, y el panel le decía al cliente que
  // lo subiera a otro lado. El reproductor vive en un iframe de otro dominio: no
  // emite eventos del DOM hacia esta página, y por su cuenta solo avisa «listo».
  // Lo que SÍ hace —sin ningún parámetro en el src, y también con el código de
  // inserción que entrega Vimeo, con su librería al lado— es contestar el
  // protocolo de su librería oficial: el padre le manda { method:
  // 'addEventListener', value: 'play' } y desde ahí recibe { event: 'play',
  // data: { seconds, percent, duration } }. La duración viaja en CADA evento:
  // acá no pasa lo de Panda.
  //
  // ⚠️ SE RECONOCE POR EL ORIGEN DEL MENSAJE, nunca buscando iframes en cada
  // mutación del DOM. El «listo» llega solo cuando el iframe carga (y llega como
  // TEXTO JSON, no como objeto: por eso el parse). Al que ya había cargado antes
  // que este código —un archivo propio que carga tarde— se le manda un ping UNA
  // vez al arrancar, y contesta con el id de su video. Suscribirse dos veces no
  // duplica eventos (medido: timeupdate suscripto 3 veces, 12 en 3 s, 12 valores
  // distintos).
  //
  // ⚠️ Y EL DOMINIO NO SE ESCRIBE ENTERO, por lo mismo que el de las agendas: el
  // analizador de piezas lo busca en el texto de la página.
  var VIM = [];
  var VIM_ORIGEN = /^https:\\/\\/(player\\.)?vimeo\\.com$/;
  var VIM_VIGIA = 0;
  function vimeoDe(w) {
    for (var i = 0; i < VIM.length; i++) if (VIM[i].w === w) return VIM[i];
    var f = document.getElementsByTagName('iframe');
    for (var j = 0; j < f.length; j++) {
      if (f[j].contentWindow !== w) continue;
      var r = { w: w, el: f[j], origen: null, vid: null, tu: 0 };
      VIM.push(r);
      return r;
    }
    return null;
  }
  function vimeoId(r) {
    var m = /\\/video\\/(\\d+)/.exec(r.el.getAttribute('src') || '');
    return 'vimeo:' + (m ? m[1] : 'iframe');
  }
  // ⚠️ ANTES DE SUSCRIBIRSE SE PREGUNTA SI YA ESTÁ REPRODUCIENDO. Un video que
  // arrancó solo (autoplay muted) antes de que cargara este código ya mandó su
  // play, y a nadie: medido el 11/09/2026 con el archivo propio inyectado a los 5
  // s, llegaron p10, s3 … p35 sin un solo play, la pausa se descartó por «nunca
  // arrancó» y el retomar salió como play en el segundo 0 estando en el 14. La
  // pregunta va PRIMERO para que la respuesta llegue antes que cualquier avance.
  function vimeoSuscribir(r, origen) {
    var n = ['getPaused', 'play', 'pause', 'ended', 'timeupdate'];
    for (var i = 0; i < n.length; i++) {
      try { r.w.postMessage(i ? { method: 'addEventListener', value: n[i] } : { method: n[i] }, origen); } catch (e) {}
    }
  }
  // Dos trabajos, cada 2 s y solo sobre los iframes que ya hablaron (nunca el DOM):
  //
  // ⚠️ 1) UN IFRAME QUE SE SACA DE LA PÁGINA NO AVISA NADA. El video nativo
  // dispara pause al desmontarse; el iframe muere callado. Medido el 11/09/2026
  // cerrando y reabriendo un modal con el video corriendo: el nativo mandó pausa
  // y retoma, y el de Vimeo NADA — ni la pausa, ni el retomar del iframe nuevo.
  // Si el que se fue era el que estaba reproduciendo, se manda la pausa que el
  // nativo habría mandado, y el próximo play sale como retoma.
  //
  // ⚠️ 2) LA PÁGINA NOS PUEDE APAGAR SIN SABERLO. El reproductor guarda UNA
  // suscripción por evento para toda la página, no una por quien la pidió: si el
  // código del cliente usa la librería oficial y hace off('timeupdate'), los
  // avances dejan de llegarnos a nosotros también (medido: 8 en 2 s, 0 en 4 s con
  // el video corriendo, 8 en 2 s al re-suscribir). Un video que según nosotros
  // está reproduciendo y lleva 5 s sin avances se vuelve a suscribir.
  function vimeoVigia() {
    var ahora = Date.now();
    for (var i = VIM.length - 1; i >= 0; i--) {
      var r = VIM[i], e = r.vid ? V[r.vid] : null;
      var vivo = !!e && e.play && !e.pausado && !e.fin && e.vel === r.el;
      if (!document.documentElement.contains(r.el)) {
        if (vivo) {
          e.pausado = true;
          enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: r.vid, vsl_titulo: e.tit });
        }
        VIM.splice(i, 1);
        continue;
      }
      if (!vivo || !r.origen || ahora - r.tu < 5000) continue;
      r.tu = ahora;
      vimeoSuscribir(r, r.origen);
    }
  }
  try {
    var fv = document.getElementsByTagName('iframe');
    for (var q = 0; q < fv.length; q++) {
      var o = /^https:\\/\\/[^\\/]+/.exec(fv[q].src || '');
      if (o && VIM_ORIGEN.test(o[0])) fv[q].contentWindow.postMessage({ method: 'ping' }, o[0]);
    }
  } catch (e) {}
  window.addEventListener('message', function (ev) {
    try {
      if (!VIM_ORIGEN.test(ev.origin || '')) return;
      var d = ev.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
      if (!d || typeof d !== 'object') return;
      var r = vimeoDe(ev.source);
      if (!r) return;
      r.origen = ev.origin;
      // ⚠️ EL VIDEO SE FIJA EN EL SALUDO, NO EN CADA MENSAJE. Leer el src en cada
      // evento parecía cubrir al iframe que cambia de video, y hacía lo contrario:
      // medido el 11/09/2026 cambiando el src de A a B con A en el segundo 10, los
      // dos últimos avances de A llegaron DESPUÉS del cambio y salieron como p5,
      // s3, s5 y s8 de B, un video que nadie había reproducido (y con la duración
      // de A). El id queda fijo desde el ready —o desde lo que el reproductor
      // contesta al ping, que es el id de SU video— hasta el próximo ready.
      if (d.event === 'ready' || d.method === 'ping') {
        r.vid = d.method === 'ping' && /^\\d+$/.test(String(d.value)) ? 'vimeo:' + d.value : vimeoId(r);
        vimeoSuscribir(r, ev.origin);
        if (!VIM_VIGIA) VIM_VIGIA = setInterval(vimeoVigia, 2000);
        return;
      }
      var tipo = d.event;
      if (d.method === 'getPaused') { if (d.value !== false) return; tipo = 'play'; }
      if (tipo !== 'play' && tipo !== 'pause' && tipo !== 'ended' && tipo !== 'timeupdate') return;
      if (!r.vid) r.vid = vimeoId(r);
      var x = d.data || {};
      var id = r.vid;
      var e = est(id);
      // La respuesta a «¿está pausado?» solo sirve para el que todavía no arrancó:
      // sobre uno ya contado, un «no» viejo se leería como un retomar.
      if (d.method === 'getPaused' && e.play) return;
      var antes = e.vel;
      e.vel = r.el;
      r.tu = Date.now();
      if (!e.tit) e.tit = r.el.getAttribute('title') || null;
      if (x.duration > 0 && isFinite(x.duration)) e.dur = x.duration;
      // ⚠️ DESPUÉS DEL FINAL, LA POSICIÓN NO SE MUEVE hasta el próximo play. Con
      // algunos videos el reproductor se rebobina solo y manda una pausa en 0; si
      // ese cero pisara los segundos, el exit de quien vio el video entero diría
      // que se fue en el segundo 0.
      if (!(e.fin && tipo !== 'play') && typeof x.seconds === 'number' && isFinite(x.seconds)) e.segs = x.seconds;
      if (e.dur > 0) e.pct = Math.min(100, Math.round((e.segs / e.dur) * 100));
      if (tipo === 'play') {
        if (!e.play) {
          e.play = true;
          // ⚠️ UN CLICK ADENTRO DEL IFRAME NO LLEGA A ESTA PÁGINA: ni pointerdown
          // ni ninguno de los que marcan huboInteraccion (medido). Lo que sí queda
          // es el FOCO: el iframe pasa a ser el elemento activo del documento. Se
          // pregunta por ESTE iframe y no por cualquiera, para que el autoplay de
          // otro video no se cuente como querido.
          enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: id, vsl_titulo: e.tit, auto: !(huboInteraccion || document.activeElement === r.el), detalle: (r.el.src || '').slice(0, 300) });
        } else if (e.pausado || (antes && antes !== r.el && !document.documentElement.contains(antes))) {
          // El segundo caso es el modal que se cierra y se reabre antes de que
          // pase el vigía: el iframe que reproducía ya no está, así que esto
          // también es un retomar.
          e.pausado = false;
          e.fin = false;
          enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        }
        return;
      }
      if (tipo === 'pause') {
        if (!e.play || e.pausado || e.fin) return;
        // La pausa que llega JUSTO ANTES de ended (medido: 45 ms antes, con los
        // segundos ya en la duración) no es una pausa, igual que en el nativo.
        if (e.dur > 0 && e.dur - e.segs < 0.5) return;
        e.pausado = true;
        enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        return;
      }
      if (tipo === 'ended') {
        if (!e.play || e.fin) return;
        e.fin = true;
        e.pausado = true;
        enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        return;
      }
      if (e.dur > 0) {
        var h = Math.floor(e.pct / 5) * 5;
        if (h >= 5 && !e.hitos[h]) {
          e.hitos[h] = true;
          enviar({ tipo_evento: 'p' + h, porcentaje: e.pct, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        }
      }
      // La escalera corre también con duración conocida, como en Panda y a
      // diferencia del nativo: con un VSL largo el primer 5% cae tarde.
      for (var k = 0; k < ESCALERA.length; k++) {
        var s = ESCALERA[k];
        if (e.segs >= s && !e.seg[s]) {
          e.seg[s] = true;
          enviar({ tipo_evento: 's' + s, segundos: e.segs, video_id: id, vsl_titulo: e.tit });
        }
      }
    } catch (err) {}
  });

  // ── VIDEOS QUE NO SE PUEDEN MEDIR (iframes de Drive y de YouTube sin API) ──
  // Medido el 11/09/2026 en Chrome: un iframe de Drive le manda a la página UN
  // solo mensaje al cargar, igual en todos los archivos y sin ningún dato. Su
  // reproductor vive un nivel más adentro, configurado para hablar SOLO con
  // Drive: le llegan los mensajes de la página y no contesta ninguno, y mientras
  // tanto le manda 110 a Drive. Un YouTube sin enablejsapi recibe el mismo saludo
  // que uno con enablejsapi=1 y, a diferencia de ese, no contesta ni obedece. No
  // hay play, pausa ni avance que escuchar, así que acá NO se inventa ninguno: se
  // dice que el iframe está y, si alguien lo toca, que lo tocó. Los dos eventos
  // son de la PÁGINA (ver ES_EVENTO_DE_VIDEO): no entran a la retención.
  //
  // ⚠️ «drive:» es un ARCHIVO de Drive, no necesariamente un video: un ZIP o un
  // PDF embebido usan la misma vista previa con el mismo formato de id. Medido con
  // un ZIP: salía como toque_video. Que sea un video lo confirma el servidor
  // bajando esa vista previa, que trae el tipo del archivo; desde acá no se puede
  // saber, y el iframe tampoco lo dice (los frames internos son 2 en un video, 2
  // en un PDF y 1 en un ZIP).
  //
  // La lista es POSITIVA a propósito: un iframe que no está acá no es un video
  // (la agenda embebida también recibe clicks y no lo es).
  function videoAjeno(src) {
    var m = /^(?:https?:)?\\/\\/([^\\/?#]+)([^?#]*)(\\?[^#]*)?/i.exec(src || '');
    if (!m) return null;
    var host = m[1].toLowerCase(), ruta = m[2] || '', q = m[3] || '', id, extra;
    if (/^(drive|docs)\\.google\\.com$/.test(host)) {
      id = /^\\/file\\/d\\/([\\w-]{10,})/.exec(ruta);
      if (id) return { id: 'drive:' + id[1], url: 'https://' + host + '/file/d/' + id[1] + '/view' };
    }
    if (/(^|\\.)youtube(-nocookie)?\\.com$/.test(host)) {
      id = /^\\/embed\\/([\\w-]{6,20})/.exec(ruta);
      // Con enablejsapi=1 el player SÍ le contesta a la página: ese no es de este bloque.
      if (!id || /[?&]enablejsapi=1/.test(q)) return null;
      // ⚠️ «videoseries» y «live_stream» NO son ids de video: son la ruta de una
      // lista y la de un vivo. Tomados como id, dos listas distintas quedaban con
      // el MISMO identificador (medido: las dos daban videoseries).
      if (id[1] === 'videoseries') {
        extra = /[?&]list=([\\w-]+)/.exec(q);
        return extra ? { id: 'yt:lista:' + extra[1], url: 'https://www.youtube' + '.com/playlist?list=' + extra[1] } : null;
      }
      if (id[1] === 'live_stream') {
        extra = /[?&]channel=([\\w-]+)/.exec(q);
        return extra ? { id: 'yt:vivo:' + extra[1], url: 'https://www.youtube' + '.com/channel/' + extra[1] + '/live' } : null;
      }
      return { id: 'yt:' + id[1], url: 'https://www.youtube' + '.com/watch?v=' + id[1] };
    }
    return null;
  }

  // (1) QUE EXISTE. Una vez por carga, con la lista en el detalle y SIN video_id:
  // con video_id cada visita sumaría un «evento» a cada video en la pantalla que
  // los nombra, sin que nadie lo haya tocado.
  // ⚠️ Barato a propósito: la colección de iframes es VIVA (no se recorre nada
  // hasta leerla) y el observer solo agenda una revisión; la revisión mira los
  // iframes de a uno, sin bajar a shadow roots, como mucho cada 1,5 s.
  var AJENOS = {}, ajenosPend = 0, ajenosEnvios = 0;
  var IFRS = document.getElementsByTagName('iframe');
  function revisarAjenos() {
    ajenosPend = 0;
    var nuevos = [];
    for (var i = 0; i < IFRS.length; i++) {
      var f = IFRS[i], src = f.getAttribute('src') || '';
      if (!src || f.__mkoSrc === src) continue;
      f.__mkoSrc = src;
      var v = videoAjeno(src);
      if (!v || AJENOS[v.id]) continue;
      AJENOS[v.id] = v;
      nuevos.push(v.id);
    }
    if (!nuevos.length || ajenosEnvios >= 3) return;
    ajenosEnvios++;
    enviar({ tipo_evento: 'video_ajeno', detalle: nuevos.join(' ').slice(0, 300) });
  }
  function programarAjenos() { if (!ajenosPend) ajenosPend = setTimeout(revisarAjenos, 1500); }
  programarAjenos();
  try {
    new MutationObserver(programarAjenos).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  } catch (e) {}

  // (2) QUE LO TOCARON. Un click adentro de un iframe no le llega a la página,
  // pero le saca el foco: window dispara blur y document.activeElement pasa a ser
  // ese iframe. NO pasa en el segundo click ni al saltar de un iframe a otro: eso
  // lo ve un sondeo de 1 s mientras el foco esté adentro de un iframe.
  // Lo que NO dice: si fue play, pausa o adelantar, ni si el video llegó a
  // reproducirse — medido el 11/09/2026, con el tope de Drive para visitantes sin
  // cuenta el click abre la ayuda de Google en otra pestaña y el toque sale igual.
  // Por eso es UN evento por video por carga, y no una reproducción.
  // ⚠️ Un iframe adentro de un shadow root ABIERTO deja como activeElement al HOST
  // del componente, no al iframe: sin bajar por shadowRoot.activeElement, ese
  // toque no salía y además se apagaba el sondeo (medido).
  var ultimoTab = 0, focoEn = null, sondeoFoco = 0, TOQUES = {};
  window.addEventListener('keydown', function (ev) {
    if (ev.key === 'Tab' || ev.keyCode === 9) ultimoTab = Date.now();
  }, true);
  function focoReal() {
    var a = document.activeElement;
    try { while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; } catch (e) {}
    return a;
  }
  function mirarFoco() {
    var a = focoReal();
    if (!a || a.tagName !== 'IFRAME') { focoEn = null; return false; }
    if (a === focoEn) return true;
    focoEn = a;
    // ⚠️ El Tab mete el foco en un iframe con el mismo blur que un click: se
    // descarta. Ese toque se pierde y no hay con qué recuperarlo — medido: un
    // click DENTRO de un iframe que ya tenía el foco no le da a la página ningún
    // evento.
    if (Date.now() - ultimoTab < 1000) return true;
    var v = videoAjeno(a.getAttribute('src') || '');
    if (!v || TOQUES[v.id]) return true;
    TOQUES[v.id] = true;
    // ⚠️ SIN video_id, igual que el click. Del lado del servidor, toda fila con
    // video_id cuenta como un video EN JUEGO (videosDe en lib/leads.ts, que no
    // mira el tipo): con el toque de un testimonio, la duración única del VSL deja
    // de aplicarse y el avance de esa persona pasa a «—». El id no se pierde:
    // viaja adentro de la URL del detalle.
    enviar({ tipo_evento: 'toque_video', detalle: v.url, vsl_titulo: a.getAttribute('title') || null });
    return true;
  }
  function soltarSondeo() { if (sondeoFoco) { clearInterval(sondeoFoco); sondeoFoco = 0; } }
  window.addEventListener('blur', function () {
    setTimeout(function () {
      if (!mirarFoco()) return;
      if (!sondeoFoco) sondeoFoco = setInterval(function () { if (!mirarFoco()) soltarSondeo(); }, 1000);
    }, 0);
  });
  window.addEventListener('focus', function () {
    setTimeout(function () {
      var a = focoReal();
      if (!a || a.tagName !== 'IFRAME') { focoEn = null; soltarSondeo(); }
    }, 0);
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
  //
  // ⚠️ Y DESDE LA v20 EL CLIC VIAJA CON SU PUNTO. Hasta la v19 se guardaba ADÓNDE
  // iba el clic y nunca EN QUÉ PUNTO se hizo, así que el dato servía para el embudo
  // y no se podía DIBUJAR sobre la página: un mapa de calor necesita coordenadas,
  // no destinos.
  var CLICKS = 0;
  var VACIOS = 0;
  // ⚠️ EL PUNTO VA EN COORDENADAS DE LA PÁGINA, NO DE LA VENTANA. Con la posición
  // en la ventana, el mismo clic sobre el mismo botón da un número distinto según
  // cuánto había bajado la persona: los puntos salen apilados arriba y el mapa no
  // se parece a la página.
  //
  // Y con cada punto viajan el ANCHO de la ventana y el ALTO del documento. Sin el
  // ancho, un punto de un celular no se puede ubicar sobre la captura de un
  // escritorio —el mapa sale corrido y no hay forma de saber por qué—; sin el alto,
  // un y de 3000 no dice si fue al final de la página o a un tercio.
  function puntoDelClic(ev) {
    var doc = document.documentElement || {};
    var cuerpo = document.body || {};
    // pageX/pageY no están en todos los navegadores: se reconstruyen con el scroll.
    var px = typeof ev.pageX === 'number' ? ev.pageX : (ev.clientX || 0) + (window.pageXOffset || doc.scrollLeft || 0);
    var py = typeof ev.pageY === 'number' ? ev.pageY : (ev.clientY || 0) + (window.pageYOffset || doc.scrollTop || 0);
    var ancho = window.innerWidth || doc.clientWidth || 0;
    var alto = Math.max(doc.scrollHeight || 0, cuerpo.scrollHeight || 0, doc.offsetHeight || 0);
    // ⚠️ EL (0,0) NO ES UN PUNTO: es lo que reporta un clic disparado POR CÓDIGO
    // —el propio sitio llamando a click(), un cartel de cookies que se cierra
    // solo—. Dejarlo pasar le pone al mapa una mancha fija en la esquina de arriba
    // a la izquierda que nadie hizo. El evento igual sale, porque al embudo le
    // sirve; lo que no sale son las coordenadas, que es la verdad.
    if (!px && !py) return null;
    return { x: Math.round(px), y: Math.round(py), vw: Math.round(ancho), dh: Math.round(alto) };
  }
  function accionable(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName.toUpperCase();
    return t === 'A' || t === 'BUTTON' || (el.getAttribute && el.getAttribute('role') === 'button');
  }
  // ⚠️ SÓLO LA ETIQUETA, Y NINGÚN TEXTO. Ver el aviso de privacidad más abajo.
  function etiquetaDe(el) {
    var t = String((el && el.tagName) || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
    return 'vacio: ' + (t || 'nada');
  }
  document.addEventListener('click', function (ev) {
    try {
      // Topes por carga. Sin esto, un click accidental repetido —o una página con
      // un carrusel— manda cientos de eventos, y el ruido tapa lo que importa.
      // Se preguntan los dos ACÁ para que, con el presupuesto agotado, el handler
      // salga sin medir: leer el alto del documento fuerza al navegador a
      // recalcular el layout, y eso no se paga en un clic que no se va a mandar.
      if (CLICKS >= 40 && VACIOS >= 12) return;
      var punto = puntoDelClic(ev);
      var tocado = ev.target;
      var el = tocado;
      // Se sube hasta el elemento accionable: el click casi siempre cae en el
      // <span> de adentro del botón, no en el botón.
      for (var i = 0; el && i < 5 && !accionable(el); i++) el = el.parentElement;
      // ── EL CLIC AL VACÍO ──────────────────────────────────────────────────
      // Hasta la v19 esto se DESCARTABA, y es el dato más informativo que tiene un
      // mapa de calor: gente tocando algo que no es clickeable. Una foto que parece
      // un botón, un título que parece un enlace, un precio que la gente aprieta
      // esperando que pase algo. Eso no se deduce de ninguna otra señal que midamos.
      //
      // Va con tipo_evento PROPIO y no con una marca adentro del clic: todo lo que
      // hoy lee 'click' —el chequeo «hace clic en tus botones», el pulso de la
      // página y el recorrido del lead— cuenta llamados a la acción del negocio, y
      // un toque en una foto no es uno. Con una marca, el chequeo se pondría verde
      // porque alguien tocó una imagen.
      if (!accionable(el)) {
        // Sin punto no hay nada que dibujar, y al embudo no le suma: no es un CTA.
        if (!punto) return;
        // TOPE PROPIO, Y MÁS BAJO QUE EL DE LOS CLICS DE VERDAD. Un mapa de calor se
        // lee por densidad ENTRE visitas, no adentro de una: el toque número 13 de la
        // misma persona en el mismo lugar no agrega información, le mete sesgo. Y el
        // presupuesto no se comparte con los 40 accionables, porque esto no puede
        // taparle el lugar al clic que ES el embudo. Techo por carga: 40 + 12.
        if (VACIOS >= 12) return;
        if (esDeW(tocado)) return;
        VACIOS++;
        // ⚠️ ACÁ NO VIAJA NINGÚN TEXTO, y es a propósito. Un clic al vacío cae muchas
        // veces sobre un campo del formulario YA COMPLETADO, y el texto de esa zona es
        // el nombre, el mail o el teléfono de quien está mirando. La etiqueta del
        // elemento (DIV, IMG, INPUT) dice todo lo que el mapa necesita y no identifica
        // a nadie; una coordenada tampoco.
        var dv = { tipo_evento: 'clic_vacio', detalle: etiquetaDe(tocado), clic_x: punto.x, clic_y: punto.y, ancho_ventana: punto.vw, alto_pagina: punto.dh };
        var av = anclaDe(tocado, ev);
        if (av) { dv.sel = av.sel; dv.rel_x = av.rx; dv.rel_y = av.ry; dv.alto_ventana = av.vh; dv.fijo = av.fijo; }
        enviar(dv);
        return;
      }
      if (CLICKS >= 40) return;
      // Los controles del embed inline de «W» son botones de SU reproductor: apretar
      // play no es un clic en un llamado a la acción del negocio (medido: el primer
      // clic, el del botón grande de play, salía como «boton: » vacío).
      if (esDeW(el)) return;
      var href = el.getAttribute ? (el.getAttribute('href') || '') : '';
      // El DESTINO manda sobre el texto: «Confirmar por WhatsApp» y «Escribinos»
      // pueden ser el mismo link, y lo que se quiere contar es adónde va la gente.
      // ⚠️ \\s, CON DOS BARRAS. Esto vive adentro de un template literal, y ahí
      // \\s NO es una barra seguida de ese, es la letra "s" sola: el snippet
      // servido decía .replace(/s+/g, ' ') y le borraba TODAS las eses al texto
      // de los botones. «¿Qué pasa después de agendar una llamada?» le llegaba
      // al cliente como «¿Qué pa a de pué de agendar una». Estuvo a la vista en
      // el panel desde la v6 y se leía como un texto cortado, no como un bug.
      var texto = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
      var detalle = href ? (href.indexOf('#') === 0 ? 'ancla ' + href : href) : ('boton: ' + texto);
      if (!detalle) return;
      CLICKS++;
      var d = { tipo_evento: 'click', detalle: detalle.slice(0, 300) + (texto && href ? ' — ' + texto : '') };
      // Las coordenadas se SUMAN cuando las hay: un clic disparado por código no
      // tiene punto y el evento tiene que salir igual, porque para el embudo ese
      // clic ocurrió. Mandar un 0 inventaría una mancha en la esquina.
      if (punto) {
        d.clic_x = punto.x; d.clic_y = punto.y; d.ancho_ventana = punto.vw; d.alto_pagina = punto.dh;
        // El ancla sólo con punto real: un clic disparado por código no tiene dónde.
        var a = anclaDe(el, ev);
        if (a) { d.sel = a.sel; d.rel_x = a.rx; d.rel_y = a.ry; d.alto_ventana = a.vh; d.fijo = a.fijo; }
      }
      enviar(d);
    } catch (e) {}
  }, true);

  // ⚠️ Y DESDE LA v22 EL CLIC VIAJA ANCLADO AL ELEMENTO. El punto de página
  // depende del alto del documento, que en la misma página y al mismo ancho varía
  // hasta un tercio (imágenes que cargan, bloques que se abren): sobre una foto de
  // la página, un toque en el botón del precio caía cientos de píxeles más arriba
  // o más abajo. El elemento no se mueve así: «el segundo botón de esa sección, a
  // un tercio de su ancho» se ubica igual en cualquier foto donde ese botón esté.
  //
  // La ruta va con etiquetas y su posición entre hermanas, hasta el primer
  // ancestro con id. SIN TEXTO, por la misma regla del toque al vacío: el texto de
  // la zona tocada puede ser el nombre de quien mira.
  function selDe(el) {
    var partes = [];
    var n = el;
    var anclada = false;
    for (var i = 0; n && n.nodeType === 1 && i < 8; i++) {
      var t = String(n.tagName || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!t) return '';
      if (t === 'html' || t === 'body') { anclada = true; break; }
      if (n.id && /^[A-Za-z][\\w-]{0,40}$/.test(n.id)) { partes.unshift('#' + n.id); anclada = true; break; }
      var k = 1;
      var h = n.previousElementSibling;
      while (h) { if (h.tagName === n.tagName) k++; h = h.previousElementSibling; }
      partes.unshift(t + ':nth-of-type(' + k + ')');
      n = n.parentElement;
    }
    if (!partes.length || !anclada) return '';
    var s = partes.join(' > ');
    if (anclada && partes[0].charAt(0) !== '#') s = 'body > ' + s;
    return s.length <= 200 ? s : '';
  }
  function anclaDe(el, ev) {
    try {
      if (!el || !el.getBoundingClientRect) return null;
      var r = el.getBoundingClientRect();
      if (!r || r.width < 1 || r.height < 1) return null;
      if (typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return null;
      var rx = Math.round(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * 1000);
      var ry = Math.round(Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) * 1000);
      // Un botón flotante (el de WhatsApp, un sello del constructor) se mueve con la
      // pantalla: su punto de página cambia con el scroll y, sin esta marca, mancha
      // la página a lo largo con toques que fueron todos en el mismo botón.
      var fijo = false;
      for (var n = el, i = 0; n && n.nodeType === 1 && i < 12; i++, n = n.parentElement) {
        var pos = window.getComputedStyle ? window.getComputedStyle(n).position : '';
        if (pos === 'fixed' || pos === 'sticky') { fijo = true; break; }
      }
      var sel = selDe(el);
      if (!sel) return null;
      return { sel: sel, rx: rx, ry: ry, vh: Math.round(window.innerHeight || 0), fijo: fijo };
    } catch (e) { return null; }
  }

  // ── SCROLL ──────────────────────────────────────────────────────────────────
  // HASTA DONDE BAJO LA PERSONA EN LA PAGINA. Faltaba la otra mitad de la visita:
  // se sabia que entro, que video vio y que apreto, y nada de cuanto LEYO. En una
  // pagina larga eso es la diferencia entre alguien que se fue arriba y alguien
  // que llego hasta la oferta y no la apreto — dos problemas distintos, con
  // arreglos distintos, que hasta hoy se veian iguales.
  //
  // ⚠️ VA CON FRENO, y no es prolijidad: el evento 'scroll' del navegador se
  // dispara por cada pixel que se mueve la pagina, asi que un enviar() adentro del
  // handler son cientos de requests por visita. Hay dos frenos encimados:
  //   · el handler no calcula nada: agenda UNA mirada cada 400 ms y sale;
  //   · y solo se manda al CRUZAR un hito (25/50/75/100), una vez cada uno.
  // Techo: 4 eventos por visita, mas el del cierre. El mismo orden de magnitud
  // que los clics, que estan topeados en 40.
  //
  // Y sale por enviar(), igual que los clics: un solo camino, un solo lugar donde
  // se le pega el token, la pagina y el marcador de prueba.
  var HITOS_SCROLL = [25, 50, 75, 100];
  var scrollHito = 0;      // el hito mas alto YA mandado
  var scrollMax = 0;       // lo mas abajo que llego, exacto
  var scrollTimer = 0;
  var scrollFinales = 0;
  function profundidadScroll() {
    var doc = document.documentElement || {};
    var cuerpo = document.body || {};
    var alto = Math.max(doc.scrollHeight || 0, cuerpo.scrollHeight || 0, doc.offsetHeight || 0);
    var visible = window.innerHeight || doc.clientHeight || 0;
    if (!visible || !alto) return 0;
    // Una pagina que entra ENTERA en la pantalla no se scrollea, y ahi un 0%
    // seria mentir: la persona la vio completa sin mover un dedo. Va 100.
    if (alto <= visible) return 100;
    var y = window.pageYOffset || doc.scrollTop || cuerpo.scrollTop || 0;
    var pct = Math.round(((y + visible) * 100) / alto);
    return pct < 0 ? 0 : (pct > 100 ? 100 : pct);
  }
  function mirarScroll() {
    try {
      var pct = profundidadScroll();
      if (pct > scrollMax) scrollMax = pct;
      for (var i = 0; i < HITOS_SCROLL.length; i++) {
        var h = HITOS_SCROLL[i];
        if (scrollMax >= h && h > scrollHito) {
          scrollHito = h;
          enviar({ tipo_evento: 'scroll', porcentaje: h });
        }
      }
    } catch (e) {}
  }
  window.addEventListener('scroll', function () {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () { scrollTimer = 0; mirarScroll(); }, 400);
  }, { passive: true });
  // El punto EXACTO al irse, que el hito no sabe dar: quien llego al 68% quedaria
  // registrado como 50. Topeado en 3 — la pestana puede esconderse y volver varias
  // veces — y solo si supera al hito ya mandado, porque si no no agrega nada.
  function cerrarScroll() {
    try {
      if (scrollTimer) { clearTimeout(scrollTimer); scrollTimer = 0; }
      mirarScroll();
      if (scrollFinales >= 3 || scrollMax <= scrollHito) return;
      scrollFinales++;
      scrollHito = scrollMax;
      enviar({ tipo_evento: 'scroll', porcentaje: scrollMax });
    } catch (e) {}
  }
  window.addEventListener('pagehide', cerrarScroll);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') cerrarScroll();
  });
  // ⚠️ LA PRIMERA MEDIDA ESPERA AL 'load'. Mientras la pagina carga, el alto del
  // documento todavia no cuenta las imagenes: se mide una pagina corta que no lo
  // es, y la regla de arriba (entra entera -> 100) mandaria un 100 falso en la
  // primera linea de cada visita.
  if (document.readyState === 'complete') setTimeout(mirarScroll, 500);
  else window.addEventListener('load', function () { setTimeout(mirarScroll, 500); });

  // ── AGENDÓ ────────────────────────────────────────────────────────────────
  // ⚠️ EL EVENTO QUE FALTABA, y para un negocio que vende por llamada es EL
  // evento: la reserva. Lo que pasa adentro del iframe de Calendly es de otro
  // dominio y no se puede espiar — pero Calendly AVISA al padre por postMessage
  // cuando alguien agenda, y eso sí lo podemos escuchar. Es la única forma de
  // cerrar el embudo de una landing cuyo llamado a la acción es una agenda
  // embebida, que hasta hoy terminaba en «vio el video» y nada más.
  //
  // ⚠️⚠️ Y NO SOLO CALENDLY. Esto entendía 'calendly.event_scheduled' y nada
  // más — el primer guard era indexOf('calendly.') !== 0 —, así que el OTRO
  // producto de agendas (el de Cal, que no es una variante de nombre sino otra
  // empresa) moría en la primera línea: manda { originator: 'CAL', type:
  // 'bookingSuccessful' }, sin campo 'event' y sin ese prefijo.
  //
  // Medido el 24/08/2026 en la landing del ws13: su sección «agenda» monta el
  // embed oficial de ese producto y, al confirmar la reserva, redirige a su
  // página de gracias con el nombre y el mail en la URL. La persona se agendó de
  // verdad y MaKo no registró NADA — ni el evento ni el lead. Y no es que se
  // rechazó: nunca se enteró. El formulario real vive adentro de un iframe de
  // otro dominio, así que el capturador de opt-in de más abajo tampoco puede
  // verlo: este handler es el ÚNICO camino que tiene una agenda embebida.
  //
  // De ahí se sacan además el nombre y el mail de quien reserva, que vienen en
  // el payload: para quien vende por llamada, esa reserva ES el lead, y hasta
  // hoy el CRM se quedaba sin él aunque el negocio tuviera todo bien conectado.
  //
  // ⚠️ Y ACÁ NO SE ESCRIBE EL DOMINIO DE ESE PRODUCTO, A PROPÓSITO. Este texto
  // viaja pegado en la página del cliente, y el analizador de piezas busca
  // justamente ese dominio para decidir si la landing tiene una agenda. Un
  // comentario que nombra la marca que el detector persigue haría que TODA
  // landing con el Pixel puesto pareciera tener una. Ya pasó exactamente eso
  // con las etiquetas de video y de botón, que salían de los comentarios de
  // este mismo snippet (ver \`sinRuido\` en lib/landing-analisis.ts).
  // Las reservas ya contadas en esta pagina. Ver el guard de mas abajo: el embed
  // manda dos mensajes por la misma reserva.
  var AGENDADOS = {};
  window.addEventListener('message', function (ev) {
    try {
      var d = ev.data;
      if (!d) return;

      // ── Calendly ──────────────────────────────────────────────────────────
      var e = typeof d === 'string' ? d : d.event;
      if (typeof e === 'string' && e.indexOf('calendly.') === 0) {
        // Solo la reserva confirmada. Calendly emite varios eventos del ciclo
        // (abrió, eligió fecha…) y contarlos todos convertiría «agendó» en «miró
        // el calendario», que es justo la diferencia que importa.
        if (e !== 'calendly.event_scheduled') return;
        enviar({ tipo_evento: 'agendo', detalle: 'calendly' });
        // Calendly no manda los datos del invitado al padre: el evento se
        // registra igual, y el lead entra por su webhook si está conectado.
        return;
      }

      // ── El otro producto de agendas ───────────────────────────────────────
      // Se acepta por \`originator\`, y el tipo se lee de \`type\` o de \`fullType\`
      // ('CAL:bookingSuccessful'): el embed cambió esa forma entre versiones y
      // atarse a una sola es volver a quedar ciego con la próxima.
      if (d.originator !== 'CAL') return;
      var t = String(d.type || d.fullType || '');
      if (t.indexOf('bookingSuccessful') === -1) return;
      // ⚠️⚠️ DOS MENSAJES POR UNA MISMA RESERVA. Este embed dispara el evento
      // viejo Y el nuevo ('...V2') por cada reserva, y el indexOf de arriba
      // matchea los dos: sin este guard, cada agenda entraba DOS VECES —dos
      // eventos y dos opt-ins— y el CRM veria el doble de reservas que las que
      // hubo. Se deduplica por el identificador del booking, y si no viene, por
      // la reserva a secas: una persona no reserva dos veces en el mismo instante.
      //
      // Se aceptan los DOS tipos a proposito, en vez de quedarse con uno: el que
      // trae el nombre y el mail de quien reserva es justo el que esta marcado
      // como deprecado en el codigo del proveedor, asi que atarse a el es quedar
      // ciego el dia que lo apaguen — y atarse solo al nuevo es perder el lead
      // hoy. Gana el primero que llegue, y el otro se descarta.
      var pAgenda = d.data || {};
      var bAgenda = pAgenda.booking || pAgenda;
      var uidAgenda = String(bAgenda.uid || bAgenda.id || 'sin-uid');
      if (AGENDADOS[uidAgenda]) return;
      AGENDADOS[uidAgenda] = true;
      // El detalle NO lleva el dominio, por lo mismo que el comentario de
      // arriba: cualquier cadena que el analizador persiga y que viaje pegada en
      // la pagina del cliente vuelve como una pieza que esa pagina no tiene.
      enviar({ tipo_evento: 'agendo', detalle: 'agenda-cal' });
      // El asistente viaja anidado y la forma varía según la versión del embed.
      // Se busca en los dos lugares conocidos y se falla en silencio: el evento
      // 'agendo' ya salió, así que peor caso es una reserva medida sin lead —
      // nunca una reserva perdida.
      var a = (bAgenda.attendees && bAgenda.attendees[0]) || pAgenda.attendee || {};
      mandarOptin({
        nombre: a.name || bAgenda.name || null,
        email: a.email || bAgenda.email || null,
        telefono: (a.phoneNumber || a.phone || null),
        origen: 'agenda'
      });
    } catch (err) {}
  });

  window.addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') alSalir();
  });

  // ── VIDEO DEL REPRODUCTOR «W» (embed clásico e iframe) ────────────────────
  // «W» es el proveedor de video de la segunda landing del ws13. Su nombre NO se
  // escribe entero en este snippet, a propósito, por lo mismo que el otro producto
  // de agendas: este texto viaja pegado en la página del cliente (o copiado a un
  // archivo propio, como /mako-tracking.js) y el analizador de piezas persigue sus
  // marcas. Por eso las cadenas se arman concatenando.
  //
  // Dos caminos, uno por forma de embeber, y no se pisan:
  //   1. IFRAME, con o sin el script del proveedor en la página. El iframe le avisa
  //      al padre SOLO, sin handshake, con un postMessage por cada cosa que pasa:
  //      un string JSON {"method":"_trigger","args":[nombre, ...]} con "play" (y de
  //      dónde vino), "pause", "end", "timechange" (segundos) y "transmit-stats"
  //      (trae media_duration). Medido el 11/09/2026.
  //   2. EMBED INLINE (el div con la clase del proveedor + su script). Ahí no hay
  //      iframe ni mensajes: se usa su cola pública _wq, que acepta que la empuje un
  //      tercero antes o después de que cargue su script (medido las dos cosas).
  // ⚠️ NO SE CARGA el script del proveedor para el caso 1. Medido: 153 KB más 25 KB
  // de un Sentry que instala en la página del cliente, 10 globales, una tarea larga
  // de ~100 ms, y sobre un iframe sin la clase del proveedor ni siquiera se engancha.
  // Los mensajes del iframe ya traen todo lo que hace falta.
  //
  // ⚠️⚠️ Y EL VIDEO PUEDE CAMBIAR SIN QUE CAMBIE EL LUGAR DONDE VIVE. Las dos formas
  // de hacerlo están medidas (11/09/2026) y las dos dejaban al segundo video sin
  // medir o medido como el primero: un carrusel que le cambia el src al MISMO
  // <iframe> (ventana idéntica) y la API del embed inline reemplazando el video en
  // el mismo reproductor. Por eso la identidad se revisa en cada documento nuevo
  // (camino 1) y la marca del camino 2 es el id del video y no un booleano.
  var WN = 'wis' + 'tia';
  var W_ORIGEN = {};
  W_ORIGEN['https://fast.' + WN + '.net'] = true;
  W_ORIGEN['https://fast.' + WN + '.com'] = true;
  // La URL pública con la que una persona abre ESE video y lo reconoce (contesta
  // 200 con el nombre del video en el título).
  function wUrl(mid) { return 'https://fast.' + WN + '.net/embed/' + 'iframe/' + mid; }
  // ¿Este elemento es del embed inline del proveedor? Lo usan el enganche nativo y
  // el de clics. Arma su cadena adentro y no usa WN: engancharNativos corre ANTES de
  // que este bloque se ejecute, y ahí WN todavía vale undefined.
  function esDeW(el) {
    var w = 'wis' + 'tia';
    if (String((el && el.id) || '').indexOf(w + '_') === 0) return true;
    for (var p = el && el.parentNode, i = 0; p && i < 15; p = p.parentNode, i++) {
      if (typeof p.className === 'string' && p.className.indexOf(w + '_embed') !== -1) return true;
    }
    return false;
  }
  function wPlay(vid, e, info, mid) {
    // ⚠️ Un clic ADENTRO de un iframe de otro dominio no le llega al padre como
    // pointerdown (medido: pointerdown 0, blur 1), así que con huboInteraccion solo,
    // una persona que apretó play quedaba como «automático». El reproductor dice de
    // dónde vino el play: source 'user-event' o 'non-user-event'.
    var deUsuario = !!(info && info.source === 'user-event');
    if (!e.play) {
      e.play = true; e.pausado = false;
      enviar({ tipo_evento: 'play', porcentaje: 0, segundos: 0, video_id: vid, vsl_titulo: e.tit, auto: !(huboInteraccion || deUsuario), detalle: wUrl(mid).slice(0, 300) });
      return;
    }
    if (e.pausado) {
      e.pausado = false;
      enviar({ tipo_evento: 'retoma', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
    }
  }
  function wPausa(vid, e) {
    if (!e.play || e.pausado || e.fin) return;
    // Una pausa pegada al final no es una pausa. El reproductor no la manda hoy
    // (medido), pero si algún día la manda antes del fin, no se cuenta.
    if (e.dur > 0 && e.dur - e.segs < 0.5) return;
    e.pausado = true;
    enviar({ tipo_evento: 'pausa', porcentaje: e.dur > 0 ? e.pct : null, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
  }
  function wFin(vid, e, seDetuvo) {
    if (!e.play || e.fin) return;
    e.fin = true;
    // Darle play de nuevo a un video que terminó es un retomar, igual que en el nativo.
    if (seDetuvo) e.pausado = true;
    enviar({ tipo_evento: 'fin', porcentaje: 100, segundos: e.segs, video_id: vid, vsl_titulo: e.tit });
  }
  function wTiempo(vid, e, t) {
    t = Number(t);
    if (!(t >= 0)) return;
    // ⚠️ EL FIN CON LOOP NO AVISA. Un video configurado para repetirse vuelve a 0 sin
    // 'end', sin 'pause' y sin cambiar de estado (medido en el iframe y en la API):
    // la única huella es el salto del final al principio.
    if (e.dur > 0 && e.segs >= e.dur - 1.5 && t < 1) wFin(vid, e, false);
    if (e.fin && e.dur > 0 && t < e.dur - 2) e.fin = false;
    e.segs = t;
    if (e.dur > 0) {
      e.pct = Math.min(100, Math.round((t / e.dur) * 100));
      var h = Math.floor(e.pct / 5) * 5;
      if (h >= 5 && !e.hitos[h]) {
        e.hitos[h] = true;
        enviar({ tipo_evento: 'p' + h, porcentaje: e.pct, segundos: t, video_id: vid, vsl_titulo: e.tit });
      }
    }
    // La escalera corre también con duración, por lo mismo que en Panda: con un VSL
    // de 11 minutos el primer 5% cae a los 35 segundos.
    for (var i = 0; i < ESCALERA.length; i++) {
      var s = ESCALERA[i];
      if (t >= s && !e.seg[s]) {
        e.seg[s] = true;
        enviar({ tipo_evento: 's' + s, segundos: t, video_id: vid, vsl_titulo: e.tit });
      }
    }
  }

  // Camino 1: los mensajes del iframe. Qué iframe mandó cada uno se resuelve UNA vez
  // por documento y queda en W_IFR: no se recorre el DOM por mensaje.
  var W_IFR = [];
  // ⚠️ LA VENTANA NO ALCANZA PARA IDENTIFICAR AL VIDEO. Un carrusel que le cambia el
  // src al MISMO <iframe> —lo que hace React cuando solo cambia esa prop— deja el
  // contentWindow idéntico (medido: mismaVentana true). Atando la caché solo a la
  // ventana, todo lo del segundo video salía con el id, el título y la duración del
  // primero: su play se perdía entero, su pausa se contaba como pausa del primero y
  // sus 44 segundos se medían contra una duración de 31. Se olvida lo sabido cuando
  // el reproductor anuncia documento nuevo, y en cada play se revisa el src.
  function wOlvidar(w) {
    for (var i = 0; i < W_IFR.length; i++) {
      if (W_IFR[i].w !== w) continue;
      // Lo que se estaba mirando ahí se detuvo: si ese mismo video vuelve, es un retomar.
      var ea = est(WN + ':' + W_IFR[i].mid);
      if (ea.play && !ea.fin) ea.pausado = true;
      W_IFR.splice(i, 1);
      return;
    }
  }
  function wIframe(w, verificar) {
    for (var i = 0; i < W_IFR.length; i++) {
      if (W_IFR[i].w !== w) continue;
      if (verificar && W_IFR[i].f && W_IFR[i].f.src !== W_IFR[i].src) { wOlvidar(w); break; }
      return W_IFR[i];
    }
    var f = document.getElementsByTagName('iframe');
    for (var j = 0; j < f.length; j++) {
      if (f[j].contentWindow !== w) continue;
      // .../embed/iframe/<id>?... : el id es lo que sigue al tipo de embed.
      var dir = String(f[j].src || '');
      var trozos = dir.split('?')[0].split('#')[0].split('/embed/');
      var partes = trozos.length > 1 ? trozos[1].split('/') : [];
      var it = { w: w, f: f[j], src: dir, mid: partes[1] || ('iframe' + j), tit: f[j].getAttribute('title') || null };
      W_IFR.push(it);
      return it;
    }
    return null;
  }
  window.addEventListener('message', function (ev) {
    try {
      // El origen se compara ENTERO: un prefijo deja pasar a cualquier dominio que empiece igual.
      if (!W_ORIGEN[ev.origin]) return;
      var d = ev.data;
      if (typeof d !== 'string') return;
      // El primer mensaje de CADA documento del reproductor, y lo único que avisa que
      // ese iframe cambió de video. Medido: llega 144 ms después de cambiarle el src
      // y ningún mensaje del documento anterior llega después de él.
      if (d === 'new-' + WN + '-iframe') { wOlvidar(ev.source); return; }
      if (d.indexOf('_trigger') === -1) return;
      var m = JSON.parse(d);
      var n = m && m.method === '_trigger' && m.args ? m.args[0] : null;
      if (n !== 'play' && n !== 'pause' && n !== 'end' && n !== 'timechange' && n !== 'transmit-stats') return;
      // En el play se vuelve a mirar el src del iframe: un play no puede venir de un
      // documento que se está yendo, así que ahí la comprobación no confunde a los dos.
      var it = wIframe(ev.source, n === 'play');
      if (!it) return;
      var vid = WN + ':' + it.mid, e = est(vid);
      if (!e.tit && it.tit) e.tit = it.tit;
      if (n === 'transmit-stats') {
        if (e.dur > 0 && (e.tit || m.signature)) return;
        var st = JSON.parse(m.args[1]);
        if (st.media_duration > 0) e.dur = st.media_duration;
        // ⚠️ page_title es el nombre del video SOLO sin el script del proveedor en la
        // página. Con él (los mensajes traen signature) el script le pasa al iframe el
        // título de la página del cliente, y page_title pasa a ser ese (medido).
        if (!e.tit && !m.signature && st.page_title) e.tit = String(st.page_title).slice(0, 200);
        return;
      }
      if (n === 'play') wPlay(vid, e, m.args[1], it.mid);
      else if (n === 'pause') wPausa(vid, e);
      else if (n === 'end') wFin(vid, e, true);
      else wTiempo(vid, e, m.args[1]);
    } catch (err) {}
  });

  // Camino 2: la cola pública del script del proveedor. En una página sin ese script
  // queda un arreglo con un objeto y no pasa nada más.
  try {
    window._wq = window._wq || [];
    window._wq.push({ id: '_all', onReady: function (video) {
      try {
        if (!video) return;
        var mid = video.hashedId();
        // ⚠️ LA MARCA ES EL ID DEL VIDEO, NO UN BOOLEANO. Una galería que cambia de
        // video sin recargar reusa el MISMO objeto del reproductor: onReady vuelve a
        // disparar con otro id (medido) y los binds de antes dejan de dispararse
        // (medido con un espía propio: el video nuevo se reprodujo 5 s y no salió
        // NADA). Con un booleano, ese video no se mide nunca.
        if (!mid || video.__mko === mid) return;
        var previo = video.__mko;
        video.__mko = mid;
        // El que estaba antes en ese reproductor se detuvo: si vuelve, es un retomar.
        if (previo) { var ep = est(WN + ':' + previo); if (ep.play && !ep.fin) ep.pausado = true; }
        var vid = WN + ':' + mid, e = est(vid);
        try {
          if (!e.tit) e.tit = video.name() || null;
          if (!(e.dur > 0)) e.dur = video.duration() || 0;
        } catch (x) {}
        // Un iframe ya lo mide el camino 1: de acá solo se le toman el nombre y la
        // duración, que la API sí sabe. Bindearlo también contaría todo dos veces.
        if (video.iframe) return;
        // Los binds viejos hoy no disparan después de un reemplazo, pero si algún día
        // lo hicieran estarían contando con el id de OTRO video: se apagan solos.
        var vive = function () { try { return video.hashedId() === mid; } catch (x) { return true; } };
        video.bind('play', function (info) { if (vive()) wPlay(vid, e, info, mid); });
        video.bind('pause', function () { if (vive()) wPausa(vid, e); });
        video.bind('end', function () { if (vive()) wFin(vid, e, true); });
        video.bind('timechange', function (t) { if (vive()) wTiempo(vid, e, t); });
      } catch (err) {}
    } });
  } catch (err) {}

  // ── SALIR DE LA PAGINA, VOLVER, Y CERRAR ──────────────────────────────────
  // Tres cosas distintas que hasta ahora eran una sola. El evento exit de arriba
  // mide el punto de abandono DEL VIDEO y se dispara igual si la persona se fue a
  // otra pestana o si cerro todo: sirve para la retencion y no contesta nada
  // sobre la PAGINA.
  //
  // Lo que se agrega, y por que cada uno importa:
  //   salio  - la pestana dejo de estar a la vista. Cambio de pestana, minimizo,
  //            se fue a otra app en el celular. En una landing con un VSL de 23
  //            minutos esto es constante, y es la diferencia entre alguien que
  //            abandono y alguien que fue a buscar la tarjeta.
  //   volvio - regreso. Con los segundos que estuvo afuera, que es el dato que
  //            distingue una interrupcion de 20 segundos de una de media hora.
  //   cierre - la pagina se esta yendo de verdad.
  //
  // ⚠️ AL CERRAR UNA PESTANA LLEGAN LOS DOS: el navegador dispara primero
  // visibilitychange y despues pagehide. No se puede saber de antemano cual de
  // los dos va a pasar, asi que no se intenta adivinar — se manda lo que ocurrio
  // y la lectura es la que ordena: un salio SIN volvio y seguido de cierre es un
  // cierre; un salio con volvio es una interrupcion.
  //
  // El tope de 10 idas y vueltas no es un capricho: alguien que trabaja con
  // muchas pestanas abiertas genera decenas por sesion, y a partir de ahi el
  // dato no agrega nada y solo tapa el resto de la lista.
  var CAMBIOS = 0;
  var afuera = 0;                       // cuando se fue, para saber cuanto estuvo
  var arranquePagina = Date.now();
  document.addEventListener('visibilitychange', function () {
    try {
      if (CAMBIOS >= 10) return;
      if (document.visibilityState === 'hidden') {
        afuera = Date.now();
        CAMBIOS++;
        enviar({ tipo_evento: 'salio', segundos: Math.round((Date.now() - arranquePagina) / 1000) });
      } else if (afuera) {
        enviar({ tipo_evento: 'volvio', segundos: Math.round((Date.now() - afuera) / 1000) });
        afuera = 0;
      }
    } catch (e) {}
  });
  var cerrado = false;
  window.addEventListener('pagehide', function () {
    if (cerrado) return;
    cerrado = true;
    try { enviar({ tipo_evento: 'cierre', segundos: Math.round((Date.now() - arranquePagina) / 1000) }); } catch (e) {}
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

  // ── De donde vino esta persona ──────────────────────────────────────────
  // Los parametros de campana viven en la URL de la PRIMERA pagina, y el
  // formulario puede estar tres clics despues. Se guardan al aterrizar y
  // viajan con el opt-in aunque para entonces la URL ya no los tenga.
  //
  // sessionStorage y no localStorage a proposito: una visita es una sesion. Con
  // localStorage, alguien que llego por un anuncio en marzo y vuelve directo en
  // julio quedaria atribuido al anuncio de marzo para siempre.
  var ORIGEN = (function () {
    var CLAVE = 'mk_origen';
    var CAMPOS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'];
    function deLaUrl() {
      var q = null, o = {}, hay = false;
      try { q = new URLSearchParams(location.search); } catch (e) { return null; }
      for (var i = 0; i < CAMPOS.length; i++) {
        var v = q.get(CAMPOS[i]);
        if (v && v.trim()) { o[CAMPOS[i]] = v.trim().slice(0, 200); hay = true; }
        else o[CAMPOS[i]] = null;
      }
      return hay ? o : null;
    }
    var ahora = deLaUrl();
    try {
      // La primera pagina con parametros gana: si ya hay algo guardado en esta
      // sesion, no se pisa. Navegar adentro del sitio no reescribe el origen.
      if (ahora) { sessionStorage.setItem(CLAVE, JSON.stringify(ahora)); return ahora; }
      var g = sessionStorage.getItem(CLAVE);
      if (g) return JSON.parse(g);
    } catch (e) {}
    // Ventana privada, o nadie llego por un anuncio: se manda vacio y el server
    // igual lo lee de pagina. Nunca null, para no romper el JSON.stringify.
    return ahora || { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, fbclid: null };
  })();

  // El envío, UNA sola vez. Antes vivía inline adentro del listener de submit, y
  // por eso la agenda embebida no tenía forma de usarlo: el único camino al CRM
  // pasaba por un <form> del documento del cliente.
  // keepalive para que sobreviva a la navegación: quien agenda se va a /gracias
  // en el mismo instante.
  function mandarOptin(d) {
    try {
      if (!d || (!d.email && !d.telefono)) return;
      fetch(OPTIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: CUENTA, visitor_id: visitorId,
          nombre: d.nombre || null, email: d.email || null,
          telefono: d.telefono || null, empresa: d.empresa || null,
          origen_captura: d.origen || 'formulario',
          pagina: location.href, prueba: prueba,
          // De donde vino. Se guardan al ATERRIZAR, no al enviar: el formulario
          // puede estar en otra pagina y ahi los parametros ya no estan.
          utm_source: ORIGEN.utm_source, utm_medium: ORIGEN.utm_medium,
          utm_campaign: ORIGEN.utm_campaign, utm_content: ORIGEN.utm_content,
          fbclid: ORIGEN.fbclid,
          // Lo que la persona escribio ademas del contacto.
          respuestas: d.respuestas || null
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

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

  // Lo que la persona contesto ADEMAS del contacto: zona, presupuesto, si compra
  // o renta. Es lo que hace util el aviso — sin esto el inmobiliario recibe
  // «Fulano dejo sus datos» y tiene que entrar a la ficha para saber que queria.
  //
  // Se mandan con el ROTULO que ve la persona, no con el name del input: un
  // formulario de Lovable manda field_3, y «field_3: Tijuana» no le dice nada a
  // nadie. Se busca la etiqueta y se cae al placeholder y al name, en ese orden.
  function otrosCampos(form) {
    var fuera = 'email correo mail tel phone whats celular movil nombre name first apellido empresa company negocio';
    var out = {}, n = 0;
    try {
      var els = form.querySelectorAll('input, textarea, select');
      for (var i = 0; i < els.length && n < 8; i++) {
        var el = els[i];
        var t = (el.type || '').toLowerCase();
        // Nada de contrasenas ni de botones, y los no marcados no son respuestas.
        if (t === 'password' || t === 'hidden' || t === 'submit' || t === 'button' || t === 'file') continue;
        if ((t === 'checkbox' || t === 'radio') && !el.checked) continue;
        var val = String(el.value == null ? '' : el.value).trim();
        if (!val) continue;
        var pistas = [el.name, el.id, el.getAttribute('autocomplete'), el.placeholder, el.getAttribute('aria-label')].join(' ').toLowerCase();
        var esContacto = false;
        var claves = fuera.split(' ');
        for (var k = 0; k < claves.length; k++) if (pistas.indexOf(claves[k]) !== -1) { esContacto = true; break; }
        if (esContacto || t === 'email' || t === 'tel') continue;
        var rot = null;
        try {
          if (el.labels && el.labels.length) rot = String(el.labels[0].textContent || '').trim();
        } catch (e) {}
        rot = rot || el.placeholder || el.getAttribute('aria-label') || el.name || el.id;
        if (!rot) continue;
        out[String(rot).trim().slice(0, 40)] = val.slice(0, 120);
        n++;
      }
    } catch (e) {}
    return n ? out : null;
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
      mandarOptin({
        nombre: campo(form, ['nombre', 'name', 'first', 'apellido']),
        email: email,
        telefono: telefono,
        empresa: campo(form, ['empresa', 'company', 'negocio']),
        respuestas: otrosCampos(form),
        origen: 'formulario'
      });
    } catch (e) { /* nunca romper el formulario del cliente */ }
  }, true);

  // ── GRABACIÓN DE SESIÓN (v21) ─────────────────────────────────────────────
  // El contrato entero —qué se graba, qué no, cuánto se guarda, cuánto vive y por
  // qué— está en lib/replay-contrato.ts y en docs/replay-diseno.md. Acá va SOLO el
  // grabador: junta los eventos, los manda por lotes y se calla.
  //
  // ⚠️ VA AL FINAL DEL SNIPPET A PROPÓSITO. Todo esto es un IIFE: una excepción
  // adentro mata lo que viene después. Con el grabador último, lo peor que puede
  // pasar es que no grabe — la visita ya se mandó en la primera línea y el video,
  // el scroll, los clics y el formulario ya están enganchados.
  //
  // ⚠️ Y NADA ARRANCA SOLO. El permiso lo contesta el SERVIDOR en la respuesta del
  // pageview que este snippet ya manda: mientras no diga que sí, la librería ni se
  // baja — lo que se ahorra no es el tiempo de grabar, es la DESCARGA. El código
  // pegado en la página no decide nada, la misma regla del bloque de opt-in.
  var RLOTE = '${APP_BASE_URL}/api/track/replay';
  // ⚠️ LA URL DE LA LIBRERÍA VA ABSOLUTA, y el número de versión lo pone el server.
  // Con la ruta relativa que devuelve rutaDeLibreria() el navegador la buscaría en
  // el dominio de la landing del cliente y daría 404 en todas.
  var RLIB_A = '${APP_BASE_URL}${libAntes}';
  var RLIB_B = '${libDespues}';
  // Los números son los del contrato, interpolados. El grabador, el receptor y el
  // reproductor no se ven entre sí: un tope más chico de un lado descarta la cola
  // del otro EN SILENCIO.
  var RV = ${REPLAY_VERSION};
  var RTOPE_MS = ${REPLAY_TOPE_SEGUNDOS} * 1000;
  var RTOPE_BYTES = ${REPLAY_TOPE_BYTES};
  var RPISO_MS = ${REPLAY_PISO_SEGUNDOS} * 1000;
  var RPISO_EV = ${REPLAY_PISO_EVENTOS};
  var RCADA_MS = ${REPLAY_LOTE_MS};
  var RCADA_EV = ${REPLAY_LOTE_EVENTOS};
  var RBEACON_MAX = ${REPLAY_BEACON_MAX_BYTES};
  // ⚠️ EL TOPE DE UN LOTE ES DEL RECEPTOR, Y ÉSTE ES EL CASO NORMAL, NO EL RARO.
  // El primer evento de CUALQUIER sesión es la foto entera de la página con su hoja
  // de estilos adentro (inlineStylesheet), y sola puede pasar los 256 KiB que el
  // receptor acepta por lote. Si se pasa, él lo tira ('pesado') y acá los eventos ya
  // se tiraron: la grabación queda sin su foto —o sea sin nada que reproducir— y el
  // agujero no lo ve nadie. Así que el grabador PARTE por tamaño, no sólo por
  // cantidad, con el mismo número que mira el que recibe.
  var RLOTE_MAX = ${REPLAY_LOTE_MAX_BYTES};
  // ⚠️ maskAllInputs EN TRUE DESDE LA PRIMERA LÍNEA, y viene del contrato tal cual
  // —no escrito de nuevo acá—. De fábrica la librería lo trae en FALSE: tapa la
  // contraseña y NADA MÁS, o sea que manda el teléfono, el mail y el nombre que la
  // persona está tecleando, carácter por carácter, antes de que apriete enviar. El
  // servidor manda el permiso para grabar; las opciones no se piden ni se reciben,
  // así que esto no se puede bajar desde ningún lado.
  var ROPT = ${JSON.stringify(REPLAY_OPCIONES_RRWEB)};

  var RSID = null, RCOLA = [], RN = 0, RMS = 0, RBYTES = 0, REV = 0;
  var Rultimo = 0, Rtimer = 0, Rparado = false, Rdetener = null, Rprendido = false;

  // El id de sesión: 'rs_' + 20 del alfabeto de URL, en sessionStorage y NO en una
  // cookie. Una cookie haría que «la sesión» durara un año; sessionStorage sobrevive
  // a navegar dentro de la pestaña —que es lo que hace un botón que lleva a otra
  // página, y ahí la grabación es la misma— y muere al cerrarla. La misma decisión
  // que ya toma mko_test más arriba.
  function replaySesion() {
    var A = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
    var id = null;
    try { id = sessionStorage.getItem('mko_rs'); } catch (e) {}
    if (id && /^rs_[A-Za-z0-9_-]{16,32}$/.test(id)) return id;
    id = 'rs_';
    for (var i = 0; i < 20; i++) id += A.charAt(Math.floor(Math.random() * A.length));
    try { sessionStorage.setItem('mko_rs', id); } catch (e) {}
    return id;
  }

  // EL PISO, en la punta del navegador. Debajo de 10 s o 20 eventos no sale NI UN
  // request: el 32,4 % de las sesiones del workspace grande duran menos de 10 s
  // (46,6 % en otro) y son rebotes. Una grabación de dos segundos no se puede mirar
  // y cuesta una fila, un objeto y una llamada igual que una de diez minutos. Lo
  // único que de verdad se ahorra acá es el request, y es el que se ahorra.
  function replayPiso() { return RMS >= RPISO_MS && REV >= RPISO_EV; }

  function replayArmar(fin, z, cuerpo, n) {
    var l = { v: RV, t: CUENTA, visitor_id: visitorId, s: RSID, n: n, e: cuerpo, z: z, ms: Math.round(RMS) };
    l.landing_url = location.href;
    if (prueba) l.prueba = prueba;
    if (fin) l.fin = 1;
    return l;
  }

  // Comprimir en el navegador ahorra la SUBIDA DEL VISITANTE, que es el único
  // tráfico que alguien siente (un celular con datos). Donde no haya compresor va
  // crudo y el campo z lo dice, así que el servidor nunca adivina.
  //
  // ⚠️ z=1 ES base64 DEL GZIP, no el gzip pelado: el campo e viaja dentro de un JSON y los
  // bytes de un gzip no son texto válido. El base64 agrega un tercio sobre lo
  // comprimido, así que la cuenta sigue dando a favor; el receptor tiene que
  // decodificar en ese orden.
  //
  // ⚠️ Y ESTO SOLO SIRVE MIENTRAS LA PESTAÑA ESTÁ ABIERTA: comprimir es asíncrono y
  // al irse de la página no hay dónde esperarlo. Ese camino manda crudo a propósito.
  function replayGzip(txt, listo) {
    try {
      if (!window.CompressionStream || !window.Blob || !window.Response) { listo(txt, 0); return; }
      var cs = new CompressionStream('gzip');
      new Response(new Blob([txt]).stream().pipeThrough(cs)).arrayBuffer().then(function (buf) {
        try {
          var b = new Uint8Array(buf), s = '';
          // En pedazos: fromCharCode.apply con un arreglo de cientos de kB revienta
          // la pila del navegador.
          for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
          listo(btoa(s), 1);
        } catch (e) { listo(txt, 0); }
      }).catch(function () { listo(txt, 0); });
    } catch (e) { listo(txt, 0); }
  }

  // El lote de todos los días, mientras la persona está en la página.
  //
  // ⚠️ SIN keepalive, Y NO ES UN OLVIDO. La cuota de keepalive es de 64 KiB para
  // TODO el documento y la comparten fetch(keepalive) y sendBeacon: un lote de ~17
  // kB marcado keepalive le come un cuarto de la cuota al beacon del final, que es
  // el único camino que queda al irse. Con la pestaña abierta no hace falta.
  //
  // ⚠️ Y el cuerpo va etiquetado text/plain, igual que el del beacon: con
  // application/json el navegador pide permiso primero (preflight) y son dos
  // requests por lote. El receptor parsea el CUERPO, no la etiqueta.
  function replayMandar(fin) {
    if (Rtimer) { try { clearTimeout(Rtimer); } catch (e) {} Rtimer = 0; }
    if (!RSID) return;
    if (!replayPiso()) { if (fin) RCOLA = []; return; }
    if (!RCOLA.length && !(fin && RN > 0)) return;
    var eventos = RCOLA;
    RCOLA = [];
    // Se parte por TAMAÑO: ver RLOTE_MAX. Cada tanda se lleva su propio número de
    // lote, así que el reproductor las vuelve a pegar en orden.
    var tandas = replayPartir(eventos);
    // Con la cola vacía y el aviso de cierre, la tanda vacía es el mensaje.
    if (!tandas.length) tandas = [[]];
    for (var i = 0; i < tandas.length; i++) {
      replayPost(tandas[i], fin && i === tandas.length - 1 ? 1 : 0, RN++);
    }
  }

  /**
   * Parte los eventos en tandas que entren en lo que el receptor acepta.
   *
   * ⚠️ UN EVENTO SOLO QUE NO ENTRA NO SE PUEDE PARTIR, y va igual: la foto de una
   * página grande es un solo evento. Comprimido casi siempre entra —el tope se
   * aplica a los bytes comprimidos—, y si no entra lo tira el que recibe, que es
   * quien tiene el número de verdad. Lo que no se puede hacer es tirarlo acá en
   * silencio: una sesión sin su foto no se puede reproducir.
   */
  function replayPartir(eventos) {
    var tandas = [], actual = [], largo = 2;
    for (var i = 0; i < eventos.length; i++) {
      var s;
      try { s = JSON.stringify(eventos[i]); } catch (e) { continue; }
      if (actual.length && largo + s.length + 1 > RLOTE_MAX) { tandas.push(actual); actual = []; largo = 2; }
      actual.push(eventos[i]);
      largo += s.length + 1;
    }
    if (actual.length) tandas.push(actual);
    return tandas;
  }

  function replayPost(eventos, fin, n) {
    var txt = JSON.stringify(eventos);
    // ⚠️ SE CUENTA LO CRUDO, no lo comprimido, y eso corta ANTES del tope de sesión.
    // El navegador no puede saber cuánto va a pesar comprimido antes de decidir si
    // sigue grabando, y de los dos errores posibles este es el bueno: el tope existe
    // para la página con un carrusel que tira megas por minuto, y errarle para el
    // lado de cortar antes la frena igual. El tope de verdad lo aplica el servidor.
    RBYTES += txt.length;
    replayGzip(txt, function (cuerpo, z) {
      // El tope del receptor se mira sobre lo que de verdad va a recibir: con z=1
      // son los bytes del gzip (el base64 los infla un tercio en el cable, pero él
      // lo decodifica antes de medir), con z=0 el texto tal cual.
      var pesa = z === 1 ? Math.ceil(cuerpo.length * 3 / 4) : cuerpo.length;
      // No entra: no se manda, y el agujero queda EN EL NÚMERO DE LOTE, que es la
      // verdad. Mandarlo para que el receptor lo tire gasta la subida del visitante
      // dos veces y deja el mismo agujero.
      if (pesa > RLOTE_MAX) return;
      try {
        fetch(RLOTE, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(replayArmar(fin, z, cuerpo, n))
        }).catch(function () {});
      } catch (e) {}
    });
  }

  // ── AL IRSE DE LA PÁGINA ──────────────────────────────────────────────────
  // sendBeacon, no fetch(keepalive). La cuota es la misma (64 KiB de documento),
  // pero sendBeacon DEVUELVE FALSE cuando el cuerpo no entra y fetch(keepalive) no
  // avisa: su promesa resuelve igual. El camino que parece más moderno es el que
  // pierde datos sin decirlo.
  function replayBeacon(fin) {
    if (!RSID || Rparado) return;
    if (!replayPiso()) { RCOLA = []; return; }
    // Con la cola vacía pero con lotes ya enviados, el aviso de cierre vale el
    // beacon igual: es lo que le dice al receptor que puede sellar la sesión en vez
    // de esperar a que un barrido por fecha la encuentre.
    if (!RCOLA.length && !(fin && RN > 0)) return;
    var txt = JSON.stringify(RCOLA);
    var cuerpo = JSON.stringify(replayArmar(fin, 0, txt, RN));
    var b;
    try { b = new Blob([cuerpo], { type: 'text/plain' }); } catch (e) { return; }
    // No entra en la cuota: se tira, y el agujero queda EN EL NÚMERO DE LOTE, que es
    // la verdad. Partirlo no ayuda —la cuota es del documento, no del request— y
    // fingir que salió le haría al reproductor pegar dos momentos como si fueran
    // seguidos.
    if (b.size > RBEACON_MAX) { RCOLA = []; RN++; RBYTES += txt.length; return; }
    var salio = false;
    try { salio = !!(navigator.sendBeacon && navigator.sendBeacon(RLOTE, b)); } catch (e) { salio = false; }
    // ⚠️ EL FALSE SE MIRA. Si el navegador no se quedó con el lote, el lote sigue
    // siendo nuestro: la cola NO se vacía y el número NO avanza, así que lo que no
    // salió ahora sale en el próximo intento (una pestaña que se esconde puede
    // volver). Darlo por enviado deja un agujero que el reproductor no puede ver.
    if (!salio) return;
    RCOLA = [];
    RN++;
    RBYTES += txt.length;
  }

  function replayEmitir(ev) {
    if (Rparado) return;
    try {
      var ahora = Date.now();
      // ⚠️ EL TOPE SE MIDE EN TIEMPO GRABADO, NO EN RELOJ DE PARED. Una pestaña
      // escondida no genera eventos, así que Date.now() menos el inicio le comería
      // los 10 minutos sin haber grabado nada: el cierre más largo medido en la base
      // es de 34 horas. Se suma el hueco ENTRE eventos, topeado en lo que dura un
      // lote — un hueco más largo que eso es tiempo en el que no pasó nada.
      if (Rultimo) RMS += Math.min(ahora - Rultimo, RCADA_MS);
      Rultimo = ahora;
      RCOLA.push(ev);
      REV++;
      if (RMS >= RTOPE_MS || RBYTES >= RTOPE_BYTES) { replayCerrar(); return; }
      // Los dos cortes a la vez, y gana el primero: solo por tiempo, una página con
      // una animación manda un lote gigante; solo por cantidad, una página quieta no
      // manda nada durante minutos y una pestaña que se cierra se lleva todo.
      if (RCOLA.length >= RCADA_EV) replayMandar(0);
      else if (!Rtimer) Rtimer = setTimeout(function () { Rtimer = 0; replayMandar(0); }, RCADA_MS);
    } catch (e) {}
  }

  function replayCerrar() {
    if (Rparado) return;
    Rparado = true;
    // Se APAGA la grabación, que es para lo que existe el tope: si no, una pestaña
    // olvidada sigue generando eventos para siempre.
    try { if (Rdetener) Rdetener(); } catch (e) {}
    Rdetener = null;
    // ⚠️ ACÁ NO VIAJA NINGÚN MOTIVO DE CORTE. El navegador no sabe cuántos bytes
    // quedaron guardados de verdad —se le pueden haber perdido lotes en el camino— y
    // el receptor sí: el corte lo decide quien tiene los números finales. Mandarlo
    // desde acá sería una conclusión servida como dato.
    replayMandar(1);
  }

  function replayGrabar() {
    var grabar = (window.rrweb && window.rrweb.record) || window.rrwebRecord;
    if (typeof grabar !== 'function') return;
    RSID = replaySesion();
    var o = {};
    for (var k in ROPT) if (Object.prototype.hasOwnProperty.call(ROPT, k)) o[k] = ROPT[k];
    o.emit = replayEmitir;
    Rultimo = Date.now();
    Rdetener = grabar(o) || null;
    // Los listeners se cuelgan SOLO acá: con el grabador apagado no queda ni uno.
    window.addEventListener('pagehide', function () { replayBeacon(1); });
    document.addEventListener('visibilitychange', function () {
      // Escondida puede ser el cierre o puede volver, y no se sabe de antemano cuál
      // de los dos va a pasar. Se manda lo que hay sin marcar el fin; si el navegador
      // no lo aceptó, queda en la cola para el próximo intento.
      if (document.visibilityState === 'hidden') replayBeacon(0);
    });
  }

  function replayArrancar(cfg) {
    if (Rprendido) return;
    Rprendido = true;
    try {
      var v = Math.trunc(Number(cfg && cfg.v));
      if (!(v >= 1 && v <= 9999)) return;
      var s = document.createElement('script');
      s.async = true;
      s.src = RLIB_A + v + RLIB_B;
      // ⚠️ SI NO BAJA, NO PASA NADA MÁS. Una landing no puede dejar de registrar
      // visitas porque no bajó una librería: el pageview ya salió, el resto de la
      // medición ya está enganchado y acá no queda ni un listener puesto.
      s.onerror = function () { Rparado = true; };
      s.onload = function () { try { replayGrabar(); } catch (e) { Rparado = true; } };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }
})();
</script>`;
}
