// =============================================================================
// canal-vigilante — que la VOZ de MaKo no se muera en silencio
// =============================================================================
// EL CASO (2026-09-08). Martín: «MaKo en WhatsApp NO está funcionando». Medido:
//
//   · `mako_doer_conv`, últimas 48 h ................. 0 mensajes
//   · último mensaje entrante de cualquier cliente .... 2026-09-02
//   · `connectionState mako_superadmin` .............. "state": "open"
//   · cualquier operación REAL sobre ese socket ...... HTTP 428, Connection Closed
//
// La línea de voz de MaKo llevaba **seis días muerta** informando «open». No
// entraba nada y —peor— tampoco SALÍA nada: los avisos que los crons generaron
// esos días se escribieron, se pagó la IA que los redactó, y nunca llegaron.
// Mauricio y el cliente de Codigo Inmobiliario le escribieron a una pared.
//
// ── LO QUE NO FALTABA ───────────────────────────────────────────────────────
//
// La DETECCIÓN ya existía y era correcta. `socketVivo()` (lib/evolution.ts) hace
// una lectura que de verdad habla con WhatsApp, y `estadoCanalMaKo()` la usa con
// este comentario al lado, escrito el 16/08:
//
//   «"open" es la fila en la base de Evolution, no la sesión. Sin esta
//    confirmación el panel dice "conectado" con el socket muerto.»
//
// Sabíamos exactamente esto. Lo que faltaba es que alguien MIRARA:
// `estadoCanalMaKo()` tenía UN consumidor, la ruta del panel `/agencia`. Un
// estado correcto que solo se calcula cuando alguien abre una pantalla no es un
// control — es un dato disponible. Es la regla de AGENTS.md, otra vez: si el que
// se tiene que enterar es el dueño, el aviso va donde él mira, y nadie mira un
// panel que no tiene por qué abrir.
//
// ⚠️ Y LA PARTE QUE HACE ESTO DISTINTO A CUALQUIER OTRA ALARMA:
// **el aviso NO PUEDE VIAJAR POR EL CANAL QUE SE ROMPIÓ.** Mandar por WhatsApp
// «tu WhatsApp está caído» es no mandar nada. Por eso esto avisa por EMAIL, que
// es el único camino que no depende de lo que está fallando. Vale como regla
// general: la alarma de un canal sale por otro canal.
//
// ── 11/09/2026: LA ALARMA EXISTÍA Y NO LE LLEGABA A NADIE ─────────────────────
//
// Tres días después de escribir esto, la voz volvió a estar caída y nadie recibió un
// solo mail (ver `EMAILS_ALERTA_VOZ`). Ahora además hay una alerta gigante arriba de
// todas las pantallas de admin (`AlertaVozMaKo`), que lee `estadoAlertaVoz`. Y dos
// revisiones adversariales encontraron más huecos, cada uno anotado donde vive.
// =============================================================================

import 'server-only';
import { sondearSocketDetalle, type Sondeo } from './evolution';
import { instanciaVoz } from './mako-grupo';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin, OWNER_WS } from './workspace';
import { sendEmail } from './resend';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';

const KEY_ULTIMO_AVISO = 'mako.canal.caido.avisado';
/** Desde cuándo está caída (ISO), para el «hace cuánto» de la alerta. '' = no está caída. */
const KEY_CAIDA_DESDE = 'mako.canal.caido.desde';
/** Desde cuándo NO se puede comprobar (Evolution caído, key rechazada). '' = sí se puede. */
const KEY_SIN_RESPUESTA_DESDE = 'mako.canal.sinrespuesta.desde';
const KEY_SIN_RESPUESTA_AVISO = 'mako.canal.sinrespuesta.avisado';
/** Cada cuánto se repite el aviso mientras siga caído. */
const CADA_MIN = 60;
/** Cuánto sin poder comprobar antes de avisar: tres corridas del cron. Un corte de un minuto no es noticia. */
const SIN_RESPUESTA_MIN = 30;
/** Tope del envío: un Resend colgado no puede dejar sin correr el resto del cron (las alertas de Meta van después). */
const TOPE_ENVIO_MS = 15_000;

/**
 * A quién le llega SIEMPRE el aviso, además de los destinatarios del workspace SuperAdmin.
 *
 * ⚠️ HASTA EL 11/09/2026 ESTE AVISO NO LE LLEGABA A NADIE. Iba a los destinatarios del ws
 * SuperAdmin (el 9), que no tiene ningún mail cargado: `getDestinatariosDe(9)` devolvía
 * `{"telefonos":[],"emails":[]}`. Cada «🚨 MaKo no puede hablar por WhatsApp» terminó en el
 * `console.error` de «NO hay email de destino», y la marca de «ya avisé» se ponía ANTES de
 * mandar, así que ni siquiera reintentaba. La voz estuvo caída días sin un solo mail.
 * Martín pidió recibirlo, el 11/09.
 *
 * ⚠️ Y DESDE EL 07/10/2026 VA AL CORREO DE MaKo, no a uno personal. El pedido, textual: «todas
 * las notificaciones me lleguen al email nuevo de MaKo, porque me llegaron al email de
 * martinkoncke@gmail.com» — esa noche se desvinculó la línea y las dos alarmas («no puede
 * hablar» y «volvió») salieron a su Gmail. Es `EMAIL_MAKO`, la misma dirección que firma, y
 * NO una copia escrita acá: una dirección repetida a mano es la que se queda vieja.
 * ⚠️ Que reciba se comprobó ese día, no se dedujo del MX (ver la nota de `EMAIL_MAKO` en
 * lib/app-url.ts): un mail de prueba a `equipo@hola-mako.com` quedó `delivered` en Resend.
 */
const EMAILS_ALERTA_VOZ = [EMAIL_MAKO];

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type EstadoVoz = { instancia: string; viva: boolean; sondeo: Sondeo; status: number; detalle: string | null };

/**
 * ¿La voz de MaKo puede hablar AHORA?
 *
 * ⚠️ No mira `connectionState`. Ese campo mintió en LAS DOS DIRECCIONES el 8/9/2026:
 * `mako_superadmin` daba `state=open` con toda operación real en 428 Connection Closed.
 * (La misma medición anotó `mako_ws1` y `mako_ws13` en `close` «funcionando»; eso NO se
 * sostuvo: remedido el 08/09, ws1 daba 500 Connection Closed, y el 11/09 ws1 figura cerrada
 * por WhatsApp (403) y ws13 nunca se vinculó. La conclusión queda en pie con la zombi sola.)
 * La única pregunta que se puede contestar es la que se hace HABLANDO con WhatsApp.
 */
export async function vozViva(topeMs?: number): Promise<EstadoVoz> {
  // ⚠️ LA VOZ SE LEE ESTRICTA. `instanciaVoz()` cae a `mako_ws1` —la línea de un CLIENTE, hoy
  // cerrada— si falla la lectura de la base, y sondear esa daba «muerto»: barra roja y mail de
  // «re-escaneá el QR» por un 5xx de Supabase (revisión del 11/09/2026). No saber cuál es la
  // voz es `sin_respuesta`, no una medición.
  let instancia: string;
  try {
    instancia = await instanciaVoz({ estricto: true });
  } catch (e) {
    return { instancia: '', viva: false, sondeo: 'sin_respuesta', status: 0, detalle: `no pude leer cuál es la línea de voz: ${msg(e)}` };
  }
  // ⚠️ EL `.catch(() => false)` CONVERTÍA «no pude preguntar» EN «está caída».
  // Y lo que cuelga de ese booleano es un email que AFIRMA que la sesión está
  // muerta y manda a re-escanear el QR — o sea que un corte de red de dos
  // segundos disparaba una alarma falsa que instruye una acción DESTRUCTIVA:
  // re-escanear tumba la sesión que estaba viva.
  //
  // `sondearSocketDetalle` separa los tres casos, y acá se conservan los tres.
  // `viva` se mantiene para no cambiarle la forma a nadie, pero la decisión de
  // ALARMAR mira `sondeo`.
  const d = await sondearSocketDetalle(instancia, topeMs)
    .catch((e) => ({ sondeo: 'sin_respuesta' as Sondeo, status: 0, detalle: msg(e) }));
  return { instancia, viva: d.sondeo === 'vivo', sondeo: d.sondeo, status: d.status, detalle: d.detalle };
}

export type AlertaVoz = {
  caida: boolean;
  sinConfirmar: boolean;
  /** false = no hubo medición AHORA. La alerta conserva lo que mostraba en vez de apagarse. */
  medido: boolean;
  instancia: string;
  desde: string | null;
  /** HTTP con que contestó Evolution (0 = no contestó): la alerta ámbar dice POR QUÉ. */
  status: number;
  detalle: string | null;
};

/** Cuánto vale una medición para la alerta. La piden TODAS las pestañas admin. */
const MEMO_MS = 30_000;
let memo: { at: number; valor: Promise<AlertaVoz> } | null = null;

/**
 * Lo que pinta la alerta de admin (`AlertaVozMaKo`).
 *
 *   caida ........ la caída MEDIDA (`muerto`), o sostenida: sin medición ahora pero con la
 *                  última del cron en «caída» (su «desde» sigue puesto). Roja.
 *   sinConfirmar . hace más de `SIN_RESPUESTA_MIN` que no se puede comprobar (el «desde» lo
 *                  fija el cron). Ámbar: no afirma que esté caída ni manda a re-escanear.
 *
 * Con memo de 30 s y UNA sola sonda en vuelo: cada pedido era un `fetchBusinessProfile` real, y
 * Martín trabaja con una pestaña por cliente (revisión del 11/09/2026). `fresco` lo saltea.
 */
export function estadoAlertaVoz(opts?: { fresco?: boolean }): Promise<AlertaVoz> {
  if (!opts?.fresco && memo && Date.now() - memo.at < MEMO_MS) return memo.valor;
  let entrada: { at: number; valor: Promise<AlertaVoz> } | null = null;
  const valor = calcularAlertaVoz()
    .then((v) => {
      // ⚠️ SOLO SE MEMORIZA LO MEDIDO. Un «no pude comprobar» memorizado 30 s le contestaba
      // «sin alerta» a todas las pestañas y apagaba la roja (segunda revisión del 11/09/2026).
      if (!v.medido && memo === entrada) memo = null;
      return v;
    })
    .catch((e) => {
      if (memo === entrada) memo = null; // un fallo no se cachea
      throw e;
    });
  entrada = { at: Date.now(), valor };
  memo = entrada;
  return valor;
}

async function calcularAlertaVoz(): Promise<AlertaVoz> {
  const { instancia, sondeo, status, detalle } = await vozViva(4000);
  if (sondeo === 'vivo') return { caida: false, sinConfirmar: false, medido: true, instancia, desde: null, status, detalle: null };
  const ws = await wsSuperAdmin().catch(() => OWNER_WS);
  const desde = await runWithWorkspace(ws, () => getSetting(KEY_CAIDA_DESDE)).catch(() => null);
  if (sondeo === 'muerto') {
    return { caida: true, sinConfirmar: false, medido: true, instancia, desde: desde || null, status, detalle };
  }
  // No se pudo comprobar AHORA. Si la última medición firme del cron fue «caída» —su «desde»
  // sigue puesto, y solo lo borra un «vivo» medido—, la roja se sostiene: un timeout no la
  // desmiente. Si no, la ámbar recién a la media hora.
  if (desde) return { caida: true, sinConfirmar: false, medido: false, instancia, desde, status, detalle };
  const sinDesde = await runWithWorkspace(ws, () => getSetting(KEY_SIN_RESPUESTA_DESDE)).catch(() => null);
  const largo = !!sinDesde && Date.now() - Date.parse(sinDesde) >= SIN_RESPUESTA_MIN * 60_000;
  return { caida: false, sinConfirmar: largo, medido: false, instancia, desde: largo ? sinDesde : null, status, detalle };
}

/**
 * Revisa la voz y, si está caída, avisa POR EMAIL. Devuelve qué hizo.
 *
 * Idempotente por hora: mientras siga caída repite cada `CADA_MIN` — es una
 * hemorragia, no una noticia (mismo criterio que `lib/alerta-critica.ts`), pero
 * sin llenar la casilla. Al recuperarse limpia la marca y avisa que volvió: una
 * alarma que no sabe decir «ya está» obliga a adivinar si se arregló o si se
 * rompió el aviso.
 */
export async function vigilarVozMaKo(): Promise<{
  viva: boolean; aviso: 'ninguno' | 'caida' | 'recuperada' | 'sin_confirmar'; enviadoA?: number; error?: string;
}> {
  const { instancia, viva, sondeo, status, detalle } = await vozViva();
  const ws = await wsSuperAdmin().catch(() => OWNER_WS);

  // Las marcas se leen ESTRICTAS: una lectura fallida leída como «no hay marca» mandaba el
  // mismo mail dos veces, o el de «volvió» sin haber avisado nada.
  let marca: string | null, desde: string | null, sinDesde: string | null, sinAviso: string | null;
  try {
    [marca, desde, sinDesde, sinAviso] = await runWithWorkspace(ws, () => Promise.all([
      getSettingEstricto(KEY_ULTIMO_AVISO),
      getSettingEstricto(KEY_CAIDA_DESDE),
      getSettingEstricto(KEY_SIN_RESPUESTA_DESDE),
      getSettingEstricto(KEY_SIN_RESPUESTA_AVISO),
    ]));
  } catch (e) {
    return { viva, aviso: 'ninguno', error: `no pude leer las marcas del aviso: ${msg(e)}` };
  }
  const ahora = new Date().toISOString();

  if (sondeo === 'sin_respuesta') {
    // No poder preguntar no es una noticia sobre la LÍNEA: no se toca ninguna marca de caída.
    // ⚠️ PERO SI DURA ES UNA NOTICIA SOBRE EVOLUTION. Con el servidor caído o la key rotada, la
    // voz de MaKo está igual de muda, y esto salía cada 10 minutos para siempre sin avisar
    // nada (revisión del 11/09/2026). Pasada media hora se avisa, con un mail que NO afirma que
    // la línea esté caída ni manda a re-escanear.
    if (!sinDesde) {
      await runWithWorkspace(ws, () => setSetting(KEY_SIN_RESPUESTA_DESDE, ahora)).catch(() => {});
      return { viva: false, aviso: 'ninguno' };
    }
    if (Date.now() - Date.parse(sinDesde) < SIN_RESPUESTA_MIN * 60_000) return { viva: false, aviso: 'ninguno' };
    const ultimo = sinAviso ? Date.parse(sinAviso) : NaN;
    if (!Number.isNaN(ultimo) && Date.now() - ultimo < CADA_MIN * 60_000) return { viva: false, aviso: 'ninguno' };
    const envio = await avisarPorEmail(
      ws,
      '⚠️ No puedo comprobar si MaKo puede hablar por WhatsApp',
      [
        `Hace ${haceCuanto(sinDesde)} que no puedo preguntarle a Evolution por la línea de voz${instancia ? ` (${instancia})` : ''}.`,
        `Lo último que contestó: ${status ? `HTTP ${status}` : 'nada, no hubo respuesta'}${detalle ? ` — ${detalle}` : ''}.`,
        '',
        'No sé si la línea está caída, así que NO hace falta re-escanear el QR: re-escanear una línea que está bien la tumba.',
        'Lo que hay que revisar es el servidor de Evolution y su EVOLUTION_API_KEY.',
        '',
        `${APP_BASE_URL}/agencia?canal=1`,
      ].join('\n'),
    );
    if (envio.enviadoA) await runWithWorkspace(ws, () => setSetting(KEY_SIN_RESPUESTA_AVISO, ahora)).catch(() => {});
    return { viva: false, aviso: 'sin_confirmar', ...envio };
  }

  // Se pudo preguntar: la racha de «no pude comprobar» terminó.
  const avisadoSinRespuesta = !!sinAviso;
  if (sinDesde) await runWithWorkspace(ws, () => setSetting(KEY_SIN_RESPUESTA_DESDE, '')).catch(() => {});
  if (sinAviso) await runWithWorkspace(ws, () => setSetting(KEY_SIN_RESPUESTA_AVISO, '')).catch(() => {});

  if (viva) {
    // «Volvió» SOLO si antes salió un «se cayó». Con este código la marca siempre viene con su
    // «desde» (el mail de caída lo exige). Una marca SIN «desde» es herencia del código viejo,
    // que la ponía sin mandar nada a nadie, y se limpia en silencio: mandaba «volvió» sobre una
    // caída que nadie había avisado (segunda revisión del 11/09/2026).
    const avisada = !!marca && !!desde;
    if (desde) await runWithWorkspace(ws, () => setSetting(KEY_CAIDA_DESDE, '')).catch(() => {});
    if (marca) await runWithWorkspace(ws, () => setSetting(KEY_ULTIMO_AVISO, '')).catch(() => {});
    if (avisada) {
      const envio = await avisarPorEmail(
        ws,
        'MaKo volvió a WhatsApp',
        `La línea de voz (${instancia}) volvió a responder. MaKo ya puede recibir y mandar mensajes.`,
      );
      return { viva: true, aviso: 'recuperada', ...envio };
    }
    if (avisadoSinRespuesta) {
      // El «no puedo comprobar» también se cierra. Si no, lo último en la casilla es la duda, y
      // no se distingue «Evolution sigue caído» de «se arregló y no avisó».
      const envio = await avisarPorEmail(
        ws,
        '✅ Ya puedo comprobar la voz de MaKo: está funcionando',
        `Evolution volvió a responder y la línea de voz (${instancia}) está viva. No hizo falta tocar nada.`,
      );
      return { viva: true, aviso: 'recuperada', ...envio };
    }
    return { viva: true, aviso: 'ninguno' };
  }

  // Caída MEDIDA.
  if (!desde) {
    // ⚠️ LA PRIMERA MEDICIÓN NO MANDA MAIL: fija el «desde» y espera a la próxima corrida. Un
    // reinicio de Evolution deja las instancias unos segundos sin socket, y un solo «muerto»
    // mandaba «re-escaneá el QR» seguido de «volvió» (revisión del 11/09/2026). La barra de
    // admin sí se prende en vivo.
    await runWithWorkspace(ws, () => setSetting(KEY_CAIDA_DESDE, ahora)).catch(() => {});
    return { viva: false, aviso: 'ninguno' };
  }
  const ultimo = marca ? Date.parse(marca) : NaN;
  if (!Number.isNaN(ultimo) && Date.now() - ultimo < CADA_MIN * 60_000) {
    return { viva: false, aviso: 'ninguno' };
  }
  const envio = await avisarPorEmail(
    ws,
    '🚨 MaKo no puede hablar por WhatsApp',
    [
      `La línea de voz de MaKo (${instancia}) dice estar conectada pero su sesión está CAÍDA desde hace ${haceCuanto(desde)}:`,
      'no entra ni sale un solo mensaje, y los avisos que MaKo genere se pierden.',
      '',
      'Se arregla volviendo a vincular el número (escanear el QR):',
      `${APP_BASE_URL}/agencia?canal=1`,
      '',
      'Mientras tanto, ningún cliente puede escribirle a MaKo ni recibir sus avisos.',
    ].join('\n'),
  );
  // ⚠️ La marca de «ya avisé» se pone SOLO si el mail salió. Antes se ponía antes de mandar:
  // un envío que no le llegaba a nadie además silenciaba el reintento durante una hora.
  if (envio.enviadoA) await runWithWorkspace(ws, () => setSetting(KEY_ULTIMO_AVISO, ahora)).catch(() => {});
  return { viva: false, aviso: 'caida', ...envio };
}

function haceCuanto(desde: string): string {
  const min = Math.max(1, Math.round((Date.now() - Date.parse(desde)) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} días`;
}

/**
 * ⚠️ POR EMAIL, NUNCA POR WHATSAPP. Es lo que hace que este aviso exista: mandar
 * «tu WhatsApp está caído» por WhatsApp es no mandar nada.
 *
 * Con el remitente de PLATAFORMA (`REMITENTE_MAKO`): `sendEmail` sin `from` lee el
 * `resend_from` del workspace actual, y esto corre en un cron que no es de ningún cliente
 * (mismo motivo que lib/invitaciones.ts). Y se LEE lo que devolvió: `sendEmail` no tira,
 * contesta `{ ok: false }`, y tragarlo es exactamente cómo este aviso no llegó durante días.
 * Con tope: `sendEmail` no tiene timeout, y un Resend colgado dejaba al cron sin correr las
 * alertas de Meta, que van después (segunda revisión del 11/09/2026).
 */
async function avisarPorEmail(ws: number, asunto: string, cuerpo: string): Promise<{ enviadoA: number; error?: string }> {
  const { getDestinatariosDe } = await import('./notif-destinatarios');
  const dest = await getDestinatariosDe(ws).catch(() => null);
  const para = [...new Set(
    [...EMAILS_ALERTA_VOZ, ...(dest?.emails ?? [])].map((e) => e.trim().toLowerCase()).filter(Boolean),
  )];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<{ ok: false; error: string }>((res) => {
    timer = setTimeout(() => res({ ok: false, error: `Resend no contestó en ${TOPE_ENVIO_MS / 1000} s` }), TOPE_ENVIO_MS);
  });
  const r = await Promise.race([
    runWithWorkspace(ws, () => sendEmail({
      from: REMITENTE_MAKO,
      replyTo: EMAIL_MAKO,
      to: para,
      subject: asunto,
      text: cuerpo,
      html: `<pre style="font:14px/1.6 system-ui,sans-serif;white-space:pre-wrap">${cuerpo
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
    })),
    tope,
  ])
    .catch((e): { ok: false; error: string } => ({ ok: false, error: msg(e) }))
    .finally(() => clearTimeout(timer));
  if (!r.ok) {
    console.error(`[canal-vigilante] el aviso «${asunto}» NO salió: ${r.error}`);
    return { enviadoA: 0, error: r.error };
  }
  return { enviadoA: para.length };
}
