// =============================================================================
// Webhook: Calendly → leads
// =============================================================================
// Endpoint público (no requiere CRON_SECRET) que recibe webhooks de Calendly.
// Seguridad: verifica firma HMAC-SHA256 con CALENDLY_WEBHOOK_SIGNING_KEY.
//
// Eventos manejados:
//   - invitee.created   → upsert lead (decisión 2026-05-31)
//   - invitee.canceled  → cancela la junta en el lead (`cancelarJuntaEnLead`)
//   - cualquier otro    → 200 OK con `ignored: true`
//
// Un error de proceso contesta 503 SÓLO si reintentar lo arregla; si no, 200 y anotado en
// `calendly.fallos_proceso` (ver `responderFalloDeProceso`). Un 5xx de más apaga la suscripción.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  verifyCalendlySignature,
  isoToFechaTijuana,
  extractAnswer,
  extractRespuestaPorFrase,
  clasificarJunta,
  CalendlySignatureError,
  type CalendlyWebhookPayload,
  type CalendlyInviteePayload,
} from '@/lib/calendly';
import {
  esErrorTransitorio,
  mensajeDeError,
  huellaFallosPrevia,
  sumarFalloProceso,
  uuidDeUri,
  KEY_FALLOS_PROCESO,
} from '@/lib/calendly-error';
import {
  upsertLeadFromCalendly,
  findLeadByContacto,
  setFechaJunta2,
  cancelarJuntaEnLead,
  guardarLinkDeReunion,
  saveLeadRespuestas,
  logLeadEvent,
} from '@/lib/leads';
import { linkDeReunion, juntaQueSeCancela } from '@/lib/recordatorio-lead';
import { enqueueJ2SinMatch } from '@/lib/review-queue';
import { hoyEnTijuana } from '@/lib/date-utils';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { sendMetaCAPIEvent } from '@/lib/meta-capi';
import { emitirDelCatalogo } from '@/lib/avisos';
import { linkResumenLead } from '@/lib/lead-resumen';
import { dispararEvento } from '@/lib/flujos';
import { enrolarPorEvento } from '@/lib/nutricion';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';
import { credWsEstricta, envCred } from '@/lib/credenciales';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { decidirReserva } from '@/lib/agenda-evento-etapa';
import { rutaDeReserva, ubicarReservaVinculada } from '@/lib/agenda-evento-etapa-server';

const KEYWORDS_TEL = ['tel', 'phone', 'celular', 'móvil', 'movil'];

// Formatea un ISO UTC como "jueves 16 a las 11:00" (es-MX) para la voz de los
// avisos. Estaba clavado a 'America/Tijuana': el aviso le decía a un cliente de
// otro huso la hora del DUEÑO, y encima el nombre del día podía ser el
// equivocado. La zona la manda el WORKSPACE al que se ruteó el evento.
function fmtFechaHoraLocal(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric' }).format(d).replace(',', '');
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${fecha} a las ${hora}`;
}

// =============================================================================
// La huella de lo que se DESCARTA: reservas que llegan y no se pueden atribuir
// =============================================================================
// Vive en `app_settings` del workspace de la PLATAFORMA (`wsSuperAdmin()`), y no en
// el de un cliente: aquí, por definición, no se sabe de quién es el evento, así que
// anotarlo en el workspace de alguien sería inventarle un dueño. `OWNER_WS` tampoco
// sirve — vale 1 y el 1 es Mauricio, un CLIENTE.
//
// El molde es el de `optin_bloqueado` (app/api/track/optin/route.ts) y el de
// `flow.plantillas_descartes` (app/api/flow/puente/route.ts): una fila que se puede
// consultar sin abrir los logs —que a los 60 minutos ya no existen—, con el motivo y
// la fecha, y SIN datos de ninguna persona. Lo que se guarda es que PASÓ y por qué,
// nunca quién: el invitado de una reserva que el producto decidió no ingestar no tiene
// por qué quedar escrito en ningún lado, y el motivo del descarte no necesita saberlo.
//
// Se pisa ENTERA en cada descarte y topea en `TOPE_SIN_RUTEO` tipos de evento: es una
// huella, no un log, y no crece sin límite. `veces` es best-effort —se lee y se vuelve
// a escribir, así que dos reservas simultáneas pueden perder un incremento—; lo que
// importa y no se pierde es CUÁLES tipos de evento están llegando sin ruteo, que es el
// único dato con el que alguien puede arreglarlo.
const KEY_SIN_RUTEO = 'calendly.reservas_sin_ruteo';
const TOPE_SIN_RUTEO = 20;

type HuellaSinRuteo = {
  /** ISO de la última reserva descartada. */
  cuando: string;
  /** Cuántas se descartaron en total. Best-effort (ver arriba). */
  veces: number;
  /** Por tipo de evento entrante: cuántas llegaron, el último evento de Calendly y cuándo. */
  porEventType: Record<string, { veces: number; evento: string; ultima: string }>;
};

/**
 * La huella guardada, saneada. Un valor ilegible NO puede hacer que el descarte
 * siguiente tampoco deje rastro: se vuelve a empezar de cero y se sigue anotando.
 */
function huellaPrevia(crudo: string | null): HuellaSinRuteo {
  const vacia: HuellaSinRuteo = { cuando: '', veces: 0, porEventType: {} };
  if (!crudo) return vacia;
  try {
    const parsed: unknown = JSON.parse(crudo);
    if (parsed === null || typeof parsed !== 'object') return vacia;
    const o = parsed as Partial<HuellaSinRuteo>;
    return {
      cuando: typeof o.cuando === 'string' ? o.cuando : '',
      veces: typeof o.veces === 'number' && Number.isFinite(o.veces) ? o.veces : 0,
      porEventType:
        o.porEventType && typeof o.porEventType === 'object'
          ? (o.porEventType as HuellaSinRuteo['porEventType'])
          : {},
    };
  } catch {
    return vacia;
  }
}

/** Anota que llegó una reserva y no entró: el tipo de evento, el evento y cuándo. Nunca lanza. */
async function anotarReservaSinRuteo(identificador: string, evento: string): Promise<void> {
  const clave = (identificador.trim() || '(la reserva no trae tipo de evento)').slice(0, 120);
  const ahora = new Date().toISOString();
  try {
    await runWithWorkspace(await wsSuperAdmin(), async () => {
      const previa = huellaPrevia(await getSetting(KEY_SIN_RUTEO));
      const anterior = previa.porEventType[clave];
      const porEventType: HuellaSinRuteo['porEventType'] = {
        ...previa.porEventType,
        [clave]: { veces: (anterior?.veces ?? 0) + 1, evento, ultima: ahora },
      };
      // El tope deja los más RECIENTES: un tipo de evento que llegó una vez hace tres
      // meses no puede empujar afuera al que está llegando hoy.
      const recientes = Object.entries(porEventType)
        .sort((a, b) => b[1].ultima.localeCompare(a[1].ultima))
        .slice(0, TOPE_SIN_RUTEO);
      await setSetting(
        KEY_SIN_RUTEO,
        JSON.stringify({
          cuando: ahora,
          veces: previa.veces + 1,
          porEventType: Object.fromEntries(recientes),
        } satisfies HuellaSinRuteo),
      );
    });
  } catch (e) {
    // Anotar el descarte NUNCA puede romper el webhook: si esto tirara, una reserva
    // ignorada se volvería un 500, Calendly empezaría a reintentar y tras días de
    // entregas fallidas DESHABILITA la suscripción —y no deja reactivarla—, que es el
    // daño grande (le pasó a la de MaKo el 11/09/2026: seis reservas perdidas).
    console.error(
      `[webhook:calendly] no se pudo anotar la reserva sin ruteo: ${e instanceof Error ? e.message : e}`,
    );
  }
}

// =============================================================================
// Un error de PROCESO: 503 si se arregla reintentando, 200 y anotado si no
// =============================================================================
// ⚠️⚠️ Los tres catch de proceso contestaban 500 a TODO. Calendly, ante un no-2xx, reintenta un
// par de días y después DESHABILITA LA SUSCRIPCIÓN ENTERA —sin avisar y sin dejar reactivarla—,
// así que un solo evento que falla SIEMPRE (un dato que no cierra, una excepción del código)
// apagaba la integración de todos. Pasó el 11/09 y otra vez el 21/09/2026: tres cancelaciones
// del anfitrión en un minuto y 4 reservas perdidas hasta el 06/10 (docs/hallazgos-infra.md →
// «Y se murió OTRA VEZ…»). Es la regla de AGENTS.md: UN WEBHOOK CONTESTA 5xx SÓLO A LO QUE SE
// ARREGLA REINTENTANDO.
//
//   · Transitorio (red, timeout, 5xx de un proveedor, la base sin conexión) → 503: es justo lo
//     que el reintento de Calendly viene a cubrir. Lo decide `esErrorTransitorio`
//     (lib/calendly-error.ts), puro y con test sobre errores medidos; en la duda dice que NO.
//   · Todo lo demás → 200, y anotado en `calendly.fallos_proceso` del workspace del evento con
//     lo justo para recuperarlo. ⚠️ Recuperarlo tiene letra chica (medido el 06/10/2026):
//     `scripts/backfill-calendly.ts --desde=<día>` trae de vuelta una reserva SÓLO del ws1 (corre
//     con el token y la config del dueño), y la trae como lead con su reunión y su link pero SIN
//     lo que dispara este webhook —la bienvenida, el aviso al dueño, el CAPI, los flujos—. La de
//     otro negocio y una CANCELACIÓN (el backfill lista sólo `status=active`) se corrigen a mano
//     en la ficha con lo anotado.
//   · El RUTEO también pasa por acá (rama `ruteo`): falla ANTES de saber de quién es el evento,
//     así que lo suyo se anota en el workspace del super admin, nunca en el de un cliente —y
//     antes de la firma, menos que menos—.
//
// El 200 lleva `ok: false` y el porqué en el CUERPO, que es lo que Calendly muestra en su
// registro de entregas: un 200 es un ACK, no un «salió bien».
//
// ⚠️ TODO catch del despacho pasa por acá, incluida la red de afuera de `runWithWorkspace`. Lo
// fija tests/calendly-error.test.ts sobre el fuente SIN comentarios: ningún `status: 5xx` fuera
// de esta función, y ningún catch del despacho que devuelva o relance sin pasar por ella.
type ContextoFallo = {
  evento: string;
  rama: 'ruteo' | 'j1' | 'j2' | 'cancelacion' | 'despacho';
  payload?: CalendlyInviteePayload;
};

/** Anota un fallo de proceso en el workspace EN CURSO (el del evento). Nunca lanza. */
async function anotarFalloDeProceso(ctx: ContextoFallo, mensaje: string): Promise<void> {
  try {
    const anotar = async () => {
      // `getSettingEstricto` y no `getSetting` (que es lo que usa el molde, `anotarReservaSinRuteo`):
      // «no pude leer» no es «no hay nada». Con `getSetting` un error de lectura vuelve null, la
      // huella arranca de cero y el upsert PISA los fallos anotados antes. Si no se puede leer, no
      // se escribe: se pierde ESTA anotación —queda el console.error de abajo—, nunca las anteriores.
      const previa = huellaFallosPrevia(await getSettingEstricto(KEY_FALLOS_PROCESO));
      const huella = sumarFalloProceso(previa, {
        cuando: new Date().toISOString(),
        evento: ctx.evento,
        rama: ctx.rama,
        uuid: uuidDeUri(ctx.payload?.scheduled_event?.uri),
        email: ctx.payload?.email?.trim() || null,
        mensaje,
      });
      await setSetting(KEY_FALLOS_PROCESO, JSON.stringify(huella));
    };
    // ⚠️ La rama `ruteo` falla FUERA de todo `runWithWorkspace`: ahí `setSetting` resuelve el
    // workspace por su cuenta y, en un webhook sin sesión, cae al ws1 —Mauricio, un cliente—. Va
    // al del super admin, como la huella del «sin ruteo». Y es anterior a la firma: lo anotado ahí
    // no está verificado, así que es una pista para mirar en Calendly, nunca un dato para cargar.
    if (ctx.rama === 'ruteo') await runWithWorkspace(await wsSuperAdmin(), anotar);
    else await anotar();
  } catch (e) {
    // Anotar NUNCA puede cambiar la respuesta: si esto tirara, el 200 se volvería un 500 y
    // estaríamos otra vez en el agujero que esto viene a cerrar.
    console.error(`[webhook:calendly] no se pudo anotar el fallo de proceso: ${mensajeDeError(e)}`);
  }
}

/** La respuesta a un error de proceso: 503 si es transitorio, 200 y anotado si no (ver arriba). */
async function responderFalloDeProceso(err: unknown, ctx: ContextoFallo): Promise<Response> {
  const message = mensajeDeError(err).slice(0, 500);
  if (esErrorTransitorio(err)) {
    console.error(`[webhook:calendly] error TRANSITORIO en ${ctx.rama} (${ctx.evento}) → 503, Calendly reintenta: ${message}`);
    return Response.json(
      { ok: false, error: 'transitorio', reintentar: true, message, event: ctx.evento, rama: ctx.rama },
      { status: 503 },
    );
  }
  console.error(`[webhook:calendly] error de proceso en ${ctx.rama} (${ctx.evento}) → 200 y anotado, reintentar no lo arregla: ${message}`);
  await anotarFalloDeProceso(ctx, message);
  return Response.json(
    { ok: false, error: 'processing', reintentar: false, message, event: ctx.evento, rama: ctx.rama, anotado: KEY_FALLOS_PROCESO },
    { status: 200 },
  );
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const tStart = Date.now();

  // ORDEN: parsear → resolver workspace → verificar firma CON LA KEY DE ESE
  // WORKSPACE. Antes se verificaba primero contra una signing key GLOBAL de
  // process.env, y eso abría una vía de ESCRITURA CROSS-TENANT: en Calendly la
  // signing key la elige quien crea la suscripción, y la ayuda de /integraciones le
  // pide al cliente que la comparta. Con esa key —y con el nombre del event type de
  // otro inquilino, que es público en su página de reservas— se podían forjar
  // eventos que entraban en runWithWorkspace(víctima) y le escribían leads, fechas
  // de junta, CAPI al píxel y nutrición.
  //
  // Parsear antes de verificar es seguro: el JSON sin firmar solo elige CONTRA QUÉ
  // KEY validar. Un payload forjado muere en la firma, porque la key que se prueba
  // es la del workspace que el propio payload nombra.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('calendly-webhook-signature');

  // 1) Parse JSON (todavía sin confiar en el contenido)
  // El chequeo de objeto NO es de más: `JSON.parse('null')` no lanza, devuelve null, y
  // `body.payload` sobre null tira TypeError → 500 sin autenticar. Antes era
  // inalcanzable porque la firma mataba el request primero.
  let body: CalendlyWebhookPayload;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as CalendlyWebhookPayload;
  } catch {
    return Response.json(
      { ok: false, error: 'bad_json', message: 'Body no es JSON válido' },
      { status: 400 },
    );
  }

  const ms = Date.now() - tStart;

  // 2) Resolver el workspace por el event type del scheduled_event — el MISMO
  //    campo que clasificarJunta usa para distinguir R1/R2. En webhook_routing el
  //    identificador de calendly es el valor EXACTO de CALENDLY_EVENT_TYPE_J1/J2,
  //    así que probamos event_type → name → uri contra el índice y tomamos el
  //    primero que resuelva (J1 y J2 del mismo cliente apuntan al mismo ws).
  //    Fail-CLOSED: sin mapeo, NO tocamos datos (nunca cae al dueño). Esto corta
  //    que el Schedule de un cliente vaya al píxel/CRM del dueño.
  const scheduled = body.payload?.scheduled_event;
  //
  //    ⚠️ «NO PUDE LEER» NO ES «NO ESTÁ MAPEADO» (06/10/2026). Con `wsPorIdentificador`, que no
  //    lee el `error` de supabase-js, la base caída daba null y la reserva de un cliente caía en
  //    la rama de abajo: 200, «ningún negocio tiene cargado este tipo de evento» y perdida, sin
  //    pasar por el 503 que existe justo para eso. Ahora la lectura es estricta y su fallo va por
  //    el clasificador (rama `ruteo`): transitorio → 503 y Calendly reintenta; si no, 200 y
  //    anotado en el workspace del super admin.
  //
  //    Y por eso el TOPE de largo: esto corre antes de la firma, y un identificador de 20 KB armaría
  //    una URL que falla SIEMPRE —un 200 anotado por cada pedido sin firmar—. Un tipo de evento de
  //    Calendly mide ~80 caracteres; lo que pasa de 300 no puede estar en `webhook_routing`.
  const candidatosWs = [scheduled?.event_type, scheduled?.name, scheduled?.uri].filter(
    (c): c is string => !!c && c.trim() !== '' && c.length <= 300,
  );
  let ws: number | null = null;
  try {
    for (const c of candidatosWs) {
      const r = await wsPorIdentificadorEstricto('calendly', c);
      if (r != null) { ws = r; break; }
    }
  } catch (err) {
    return responderFalloDeProceso(err, { evento: body.event, rama: 'ruteo', payload: body.payload });
  }

  // 3) Verificar la firma con la key DE ESE workspace. Sin la suya cargada se cae a
  //    la de plataforma (compatibilidad con lo que hacía antes para todos), pero
  //    mientras se use ese fallback dos inquilinos comparten secreto y la vía de
  //    forja sigue abierta para ellos. Vaciar el fallback = cerrarla del todo.
  //
  //    Sin workspace se verifica igual, contra la de plataforma, y RECIÉN DESPUÉS se
  //    ignora: si acá se cortara antes de la firma, el código de respuesta delataría
  //    qué event types están dados de alta (200 = no, 401 = sí) y se podría enumerar
  //    la cartera de clientes con payloads sin firmar.
  //
  //    La key se lee ESTRICTA por la misma razón: con `credWs`, una base caída daba null, se caía a
  //    la de plataforma y la firma de un negocio con key propia daba 401 — un no-2xx que Calendly
  //    cuenta para deshabilitar, con un mensaje que culpa a la firma.
  let keyWs: string | null;
  try {
    keyWs = ws == null ? null : await credWsEstricta('CALENDLY_WEBHOOK_SIGNING_KEY', ws);
  } catch (err) {
    return responderFalloDeProceso(err, { evento: body.event, rama: 'ruteo', payload: body.payload });
  }
  const signingKey = keyWs ?? (await envCred('CALENDLY_WEBHOOK_SIGNING_KEY'));
  if (ws != null && !keyWs) {
    console.warn(`[webhook:calendly] ws ${ws} sin CALENDLY_WEBHOOK_SIGNING_KEY propia — usando la de plataforma`);
  }
  try {
    verifyCalendlySignature(rawBody, signatureHeader, signingKey ?? '');
  } catch (err) {
    if (err instanceof CalendlySignatureError) {
      console.warn(`[webhook:calendly] firma rechazada (ws ${ws ?? '—'}): ${err.message}`);
      return Response.json(
        { ok: false, error: 'signature', message: err.message },
        { status: 401 },
      );
    }
    throw err;
  }

  // Firma válida pero sin ruteo: 200 para que Calendly no reintente eternamente algo
  // que nunca vamos a poder atribuir. Fail-CLOSED igual — no se toca un solo dato.
  //
  // ⚠️⚠️ Y EL 200 NO PUEDE SER LO ÚNICO QUE QUEDE. Una política puede RECHAZAR; no puede
  // no dejar rastro. Esta rama devolvía `{ ok: true, ignored: 'sin workspace' }` y un
  // `console.warn` que a los 60 minutos ya no existe, así que «la reserva no llegó» y «la
  // tiramos nosotros» se veían EXACTAMENTE igual: mirando la base, mirando los logs y
  // repitiendo la prueba. Es el síntoma textual de la tarjeta #174 —«el cliente conecta,
  // no entra nada y no hay ningún error»— y lo que lo vuelve urgente es que el workspace
  // del super admin no tiene hoy ninguna ruta de agenda: el primero que va a pasar por
  // aquí es Martín (medido en producción el 03/10/2026).
  //
  // EL 200 SE QUEDA, y por una razón medida: Calendly DESHABILITA una suscripción tras
  // días de entregas fallidas y no deja reactivarla (el porqué, en la cabecera de
  // scripts/arreglar-webhook-calendly.ts). Devolver 4xx aquí cambiaría un evento
  // descartado por la integración entera caída, que es peor.
  //
  // Lo que cambia son las DOS superficies donde esto sí se puede leer:
  //   · la huella en la base (`anotarReservaSinRuteo`), consultable sin abrir logs;
  //   · el CUERPO de la respuesta, que es lo que Calendly muestra en su propio registro
  //     de entregas — el renglón que decía «sin workspace» ahora dice qué falta y dónde.
  if (ws == null) {
    const identificador = candidatosWs[0] ?? '';
    await anotarReservaSinRuteo(identificador, body.event);
    console.warn(`[webhook:calendly] sin workspace para event_type=${identificador || '—'} evento=${body.event} — ignorado`);
    return Response.json({
      ok: true,
      event: body.event,
      ignored: 'sin_ruteo',
      // Sin nombre, sin email y sin teléfono: el renglón dice QUÉ pasó y por qué, no quién.
      message: 'La reserva llegó y no entró: ningún negocio de MaKo tiene cargado este tipo de evento de Calendly. Se carga en /integraciones, en el campo «Tipo de evento de R1».',
    });
  }

  // 4) Dispatch por tipo de evento — TODO confinado al workspace resuelto.
  return runWithWorkspace(ws, async () => {
  // La red de AFUERA: lo que escape a los tres catch de proceso pasa por el mismo clasificador
  // (`responderFalloDeProceso`) en vez de llegar a Next, que lo contesta con un 500 pelado.
  // Y la lectura de la R1/R2, que es estricta a propósito y cae acá si la base no contesta.
  try {
   // Config de clasificación R1/R2 POR WORKSPACE (dueño → env; cliente → su fila).
   // ⚠️ ESTRICTA (06/10/2026): con `credWs`, una base caída daba null, y sin el tipo de evento
   // de la R2 una reunión R2 se graba como R1 — sin error. Si no se puede leer, no se adivina:
   // el error sale por la red de afuera (rama `despacho`), y siendo transitorio es un 503.
   const cfgJuntas = {
     j1: await credWsEstricta('CALENDLY_EVENT_TYPE_J1', ws),
     j2: await credWsEstricta('CALENDLY_EVENT_TYPE_J2', ws),
   };
   // Zona del inquilino, SOLO para el texto de los avisos. Nunca lanza: un
   // setting roto no puede tirar un webhook que ya validó firma.
   const tzWs = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
   // ¿El evento está VINCULADO a una etapa de reunión de un embudo? (16/10/2026, lib/agenda-evento-etapa.ts.)
   // Si lo está, qué reunión es y a qué embudo va lo dice la ETAPA, no J1/J2; sin vínculo `ruta` es null y todo
   // sigue EXACTAMENTE como antes. Estricta, como la R1/R2 de arriba: si la base no contesta, sale por la red de
   // afuera (transitorio → 503 y Calendly reintenta) en vez de mandar la reserva al funnel principal.
   const vinculada = await rutaDeReserva('calendly', candidatosWs, ws);
   switch (body.event) {
    case 'invitee.created': {
      const payload = body.payload;
      if (!payload) {
        return Response.json(
          { ok: false, error: 'no_payload', event: body.event },
          { status: 400 },
        );
      }

      // ── Ruteo J1/J2 (Fase 10), o el de la etapa vinculada ──
      // `decidirReserva` (puro, con test): la R, si puede crear un lead y a dónde va. La R2 NUNCA crea.
      const decision = decidirReserva(vinculada.ruta, clasificarJunta(payload.scheduled_event, cfgJuntas));
      if (!decision.puedeCrearLead) {
        const emailJ2 = payload.email?.trim() || null;
        const nombreJ2 = (payload.name || `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim()).trim() || null;
        const telefonoJ2 = extractAnswer(payload.questions_and_answers, KEYWORDS_TEL);
        const startTimeIso = payload.scheduled_event?.start_time;
        if (!startTimeIso) {
          return Response.json(
            { ok: false, error: 'incomplete_payload', missing: { start_time: true }, tipo: 'j2' },
            { status: 400 },
          );
        }
        try {
          // Clave de cohorte persistida, NO display: queda en TJ a propósito
          // (el porqué, en el JSDoc de isoToFechaTijuana).
          const fechaJ2 = isoToFechaTijuana(startTimeIso);
          const lead = await findLeadByContacto(emailJ2, telefonoJ2);
          if (lead) {
            // NUNCA crear desde una J2: solo seteamos fecha_junta_2 del lead existente.
            await setFechaJunta2(lead.id, fechaJ2, startTimeIso);
            // El link para entrar, para el recordatorio al lead (mig 0204). Aparte y sin tirar.
            await guardarLinkDeReunion(lead.id, 'R2', linkDeReunion(payload.scheduled_event?.location));
            // El form de la R2 tiene sus propias respuestas: se guardan POR reunión
            // (antes se descartaban — solo existían columnas para el set de R1).
            await saveLeadRespuestas(lead.id, 'R2', payload.questions_and_answers, fechaJ2);
            // Evento vinculado: a SU embudo y SU etapa (agregado si su casa es otra). ANTES del aviso y de los
            // flujos, para que una automatización de «agendó» ya lo vea donde cayó.
            const ubicacion = decision.destino ? await ubicarReservaVinculada(lead, vinculada, 'Calendly') : null;
            // Aviso al dueño: el lead agendó su R2 (best-effort, no bloquea).
            await emitirDelCatalogo('reunion-nuevo-agendado', {
              // ⚠️ Dedup POR RESERVA — los webhooks se reentregan. El `uri` del
              // scheduled_event es único por reserva; el horario va en la clave
              // para que un REAGENDADO (que sí hay que avisar) no quede tapado.
              dedupTtlMin: 180, dedupKey: `calendly:${payload.scheduled_event?.uri ?? emailJ2}|${startTimeIso}`,
              texto: `🎯 *Nuevo agendado*: ${lead.nombre} reservó una *R2 para el ${fmtFechaHoraLocal(startTimeIso, tzWs)}*.\n\n👉 Mira el resumen del lead:\n${linkResumenLead(lead.id, ws)}\n\n— MaKo`,
              // El lead del evento (11/10/2026: es un Evento de MaKo, `lead_agendo`): sin él la CONDITION de la
              // automatización no ve nada y `{{lead_nombre}}` o `{{link_lead}}` salen crudos.
              lead: { id: lead.id, nombre: lead.nombre },
            });
            // Flujos configurados por el dueño: disparar 'lead.agendo' (R2).
            // La MISMA clave que el aviso de arriba: Calendly reentrega, y una reentrega no repite los pasos.
            await dispararEvento('lead.agendo', { ws, leadId: lead.id, leadNombre: lead.nombre, reunion: 'R2', dedupKey: `calendly:${payload.scheduled_event?.uri ?? emailJ2}|${startTimeIso}` });
            console.log(`[webhook:calendly] J2 → lead id=${lead.id} email=${emailJ2 ?? '—'} fecha_j2=${fechaJ2}${ubicacion ? ` etapa: ${ubicacion}` : ''} ms=${ms}`);
            return Response.json({ ok: true, event: body.event, tipo: 'j2', action: 'set_j2', lead_id: lead.id, ...(ubicacion ? { ubicacion } : {}), ms });
          }
          // Sin match: a la cola de revisión manual (tab Hoy).
          await enqueueJ2SinMatch({
            email: emailJ2,
            nombre: nombreJ2,
            fecha_evento: fechaJ2,
            payload_resumen: { email: emailJ2, nombre: nombreJ2, start_time: startTimeIso, event_type: payload.scheduled_event?.event_type ?? payload.scheduled_event?.name ?? null },
          });
          console.warn(`[webhook:calendly] J2 SIN MATCH → review_queue email=${emailJ2 ?? '—'} fecha_j2=${fechaJ2} ms=${ms}`);
          return Response.json({ ok: true, event: body.event, tipo: 'j2', action: 'review_queue', ms });
        } catch (err) {
          // 503 sólo si reintentar lo arregla; si no, 200 y anotado (ver `responderFalloDeProceso`).
          return responderFalloDeProceso(err, { evento: body.event, rama: 'j2', payload });
        }
      }
      // R1 (J1, un evento desconocido o uno vinculado a la primera reunión de su embudo) → crea o actualiza.

      const email = payload.email?.trim();
      const nombre = (payload.name || `${payload.first_name ?? ''} ${payload.last_name ?? ''}`.trim()).trim();
      const createdAtIso = payload.created_at;
      const startTimeIso = payload.scheduled_event?.start_time;

      // ⚠️ Este 400 (y el `no_payload` y el de la R2, más arriba) también es un no-2xx: Calendly lo
      // REINTENTA y, si se repite, apaga la suscripción igual que un 500. Quedó así a propósito el
      // 06/10/2026: con un evento real es inalcanzable (Calendly siempre manda email, nombre y
      // fechas), y `scripts/arreglar-webhook-calendly.ts` usa este 400 como la señal de «la firma
      // del ws validó y no se tocó un dato». Pasarlo a 200 + anotado es una decisión, y ese script
      // cambia en el mismo commit.
      if (!email || !nombre || !createdAtIso || !startTimeIso) {
        return Response.json(
          {
            ok: false,
            error: 'incomplete_payload',
            missing: {
              email: !email,
              nombre: !nombre,
              created_at: !createdAtIso,
              start_time: !startTimeIso,
            },
          },
          { status: 400 },
        );
      }

      try {
        const fechaAgenda = isoToFechaTijuana(createdAtIso);
        const fechaJ1 = isoToFechaTijuana(startTimeIso);
        const empresa = extractAnswer(payload.questions_and_answers, ['empresa', 'company', 'organiz']);
        const telefono = extractAnswer(payload.questions_and_answers, ['tel', 'phone', 'celular', 'móvil', 'movil']);

        // Respuestas de calificación (Fase B v3): mapeo por FRASE DISTINTIVA,
        // no keyword suelta. Antes "equipo" cruzaba inversión↔colaboradores.
        // extractRespuestaPorFrase elige la coincidencia más larga/específica.
        const qa = payload.questions_and_answers;
        const respuesta_objetivo = extractRespuestaPorFrase(qa, [
          'qué quieres lograr', 'que quieres lograr', 'qué querés lograr', 'que queres lograr',
        ]);
        const respuesta_inversion = extractRespuestaPorFrase(qa, [
          'posibilidad de invertir', 'invertir para superar',
        ]);
        const respuesta_colaboradores = extractRespuestaPorFrase(qa, [
          'cuántos colaboradores', 'cuantos colaboradores', 'colaboradores tienes actualmente', 'colaboradores tienes',
        ]);
        const respuesta_facturacion = extractRespuestaPorFrase(qa, [
          '20 millones', '$20', 'es tu caso',
        ]);
        const respuesta_decisor = extractRespuestaPorFrase(qa, [
          'participar en la decisión', 'participar en la decision', 'alguien más', 'alguien mas',
        ]);
        const respuesta_cuando_empezar = extractRespuestaPorFrase(qa, [
          'cuándo quieres empezar', 'cuando quieres empezar', 'cuándo querés empezar', 'cuando queres empezar',
        ]);

        // UTMs — vienen de la landing (Lovable) que los pasa al booking de
        // Calendly. Calendly los re-emite en payload.tracking. Si el lead es
        // orgánico, tracking puede no venir o venir vacío — todos NULL.
        const tracking = payload.tracking;
        const utm_source = tracking?.utm_source?.trim() || null;
        const utm_medium = tracking?.utm_medium?.trim() || null;
        const utm_campaign = tracking?.utm_campaign?.trim() || null;
        const utm_content = tracking?.utm_content?.trim() || null;
        // utm_term transporta el UUID anónimo de la landing (cookie
        // nqe_visitor_id) — cruza al lead con sus eventos de VSL (Fase 6).
        const visitor_id = tracking?.utm_term?.trim() || null;

        const { created, lead } = await upsertLeadFromCalendly({
          email,
          nombre,
          fecha_agenda: fechaAgenda,
          fecha_junta_1: fechaJ1,
          junta_1_at: startTimeIso,   // ISO con hora → No Show preciso (crm-auto T1)
          empresa,
          telefono,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          respuesta_facturacion,
          respuesta_colaboradores,
          respuesta_objetivo,
          respuesta_cuando_empezar,
          respuesta_inversion,
          respuesta_decisor,
          visitor_id,
        // Evento vinculado: el lead NUEVO nace en ese embudo y esa etapa. Sin vínculo es null: lo de antes.
        }, { alCrear: vinculada.alCrear });

        // El link para entrar a la R1, para el recordatorio al lead (mig 0204). Va en un update
        // APARTE de `upsertLeadFromCalendly` y no tira: sin la migración puesta, la reserva
        // tiene que entrar igual (ver `guardarLinkDeReunion`).
        await guardarLinkDeReunion(lead.id, 'R1', linkDeReunion(payload.scheduled_event?.location));

        // Set de respuestas de la R1 por reunión (las columnas del lead quedan
        // como legacy/compat; la ficha lee lead_respuestas primero).
        await saveLeadRespuestas(lead.id, 'R1', qa, fechaJ1);

        // Evento vinculado y el lead YA existía: a SU embudo y SU etapa, sin cambiarle la casa (si es otra, se
        // lo AGREGA). El nuevo ya nació ahí. ANTES del aviso y de los flujos, que lo tienen que ver donde cayó.
        const ubicacion = decision.destino && !created ? await ubicarReservaVinculada(lead, vinculada, 'Calendly') : null;

        // (Hasta el 09/10/2026 acá se le creaba al lead nuevo su contacto y su conversación en
        // Chatwoot; se fue con la integración.)

        console.log(
          `[webhook:calendly] ${created ? 'INSERT' : 'UPDATE'} lead id=${lead.id} email=${email} fecha_j1=${fechaJ1} utm_campaign=${utm_campaign ?? '—'}${ubicacion ? ` etapa: ${ubicacion}` : ''} ms=${ms}`,
        );

        // CAPI: evento "Schedule" server-side (la verdad del agendamiento) para
        // que Meta optimice sobre reservas reales. event_id determinístico por
        // reserva (email + hora de inicio) → deduplica reintentos y permite
        // deduplicar con el pixel del navegador si éste envía el mismo id.
        const capiSchedule = await sendMetaCAPIEvent({
          eventName: 'Schedule',
          email,
          phone: telefono,
          // El `leadgen_id`, si este lead vino de un formulario de Meta: es el
          // identificador de más prioridad para el match y lo único que mueve la
          // Cobertura de leads. Un lead orgánico no lo tiene y va sin él — mandar el
          // campo vacío es peor que no mandarlo (Meta rechaza el evento entero).
          metaLeadId: lead.meta_lead_id,
          actionSource: 'website',
          eventId: `schedule:${email.toLowerCase()}:${startTimeIso}`,
          customData: {
            lead_type: 'agenda_j1',
            ...(utm_campaign ? { utm_campaign } : {}),
          },
        });
        // Lo que Meta rechaza va al historial de la ficha, no sólo al log: un 200
        // con el error adentro no deja ningún rastro que alguien vaya a abrir.
        if (!capiSchedule.ok && (capiSchedule.motivo === 'rechazado' || capiSchedule.motivo === 'http' || capiSchedule.motivo === 'red')) {
          await logLeadEvent(lead.id, 'Meta', `No entró la conversión Schedule: ${capiSchedule.detalle}`.slice(0, 300), 'MaKo');
        }

        // Aviso al dueño: nuevo lead que agendó una R1 (best-effort, no bloquea).
        const anuncio = utm_campaign ? ` Vino del anuncio "${utm_campaign}".` : '';
        await emitirDelCatalogo('reunion-nuevo-agendado', {
          // Ver la nota de la R2: dedup por reserva + horario.
          dedupTtlMin: 180, dedupKey: `calendly:${payload.scheduled_event?.uri ?? email}|${startTimeIso}`,
          texto: `🎯 *Nuevo agendado*: ${nombre} reservó una *R1 para el ${fmtFechaHoraLocal(startTimeIso, tzWs)}*.${anuncio}\n\n👉 Mira el resumen del lead:\n${linkResumenLead(lead.id, ws)}\n\n— MaKo`,
          // El lead del evento: ver la nota de la R2.
          lead: { id: lead.id, nombre },
        });
        // Flujos configurados por el dueño: disparar 'lead.agendo' (R1).
        await dispararEvento('lead.agendo', { ws, leadId: lead.id, leadNombre: nombre, reunion: 'R1', dedupKey: `calendly:${payload.scheduled_event?.uri ?? email}|${startTimeIso}` });
        // Nutrición de preparación (reunión 31/07): el audio de bienvenida sale
        // al toque de agendar — es la palanca contra el no-show del 45%.
        await enrolarPorEvento(lead.id, 'agenda_nueva');

        return Response.json({
          ok: true,
          event: body.event,
          action: created ? 'created' : 'updated',
          lead_id: lead.id,
          ...(decision.destino ? { funnel_id: decision.destino.funnelId, etapa: decision.destino.etapa, ...(ubicacion ? { ubicacion } : {}) } : {}),
          ms,
        });
      } catch (err) {
        // 503 sólo si reintentar lo arregla; si no, 200 y anotado (ver `responderFalloDeProceso`).
        return responderFalloDeProceso(err, { evento: body.event, rama: 'j1', payload });
      }
    }

    case 'invitee.canceled': {
      const payload = body.payload;
      if (!payload) {
        return Response.json({ ok: true, event: body.event, ignored: true, reason: 'sin payload' });
      }
      try {
        const email = payload.email?.trim() || null;
        const telefono = extractAnswer(payload.questions_and_answers, KEYWORDS_TEL);
        const startTimeIso = payload.scheduled_event?.start_time;
        const lead = await findLeadByContacto(email, telefono);
        if (!lead || !startTimeIso) {
          console.log(`[webhook:calendly] cancelación sin lead/fecha (email=${email ?? '—'}) — ignorada`);
          return Response.json({ ok: true, event: body.event, ignored: true, reason: 'sin match o sin fecha' });
        }
        // Los DOS en zona TJ, y tienen que seguir juntos: acá se compara la
        // fecha de la junta contra "hoy". Mezclar zonas entre el dato guardado y
        // el hoy es justo lo que rompe los bordes del día (ver isoToFechaTijuana).
        const fechaCancelada = isoToFechaTijuana(startTimeIso);
        // Con el INSTANTE: en una reagenda del mismo día, la reserva nueva puede haber llegado
        // primero y la fecha sola no distingue cuál de las dos se cancela (`juntaACancelar`).
        const cambio = await cancelarJuntaEnLead(lead, fechaCancelada, hoyEnTijuana(), startTimeIso);
        // El link de la reunión cancelada se borra; `junta_X_at` NO (corrección del refutador del
        // #17: en null, la regla T1 del CRM propone No Show sobre la R1 cancelada). El recordatorio
        // al lead ya no sale porque mira `fecha_junta_X`, que la cancelación sí pone en null.
        // Se compara el INSTANTE: si la reserva nueva de una reagenda llegó primero, la fila ya
        // tiene el horario nuevo y su link no se toca.
        const cualLink = juntaQueSeCancela(lead, startTimeIso);
        if (cualLink) await guardarLinkDeReunion(lead.id, cualLink, null, { soloSiInicio: startTimeIso });
        // Aviso al dueño: reunión cancelada → sugerir reagendar (best-effort).
        // Con evento vinculado, la R la dice su etapa. La cancelación NO mueve la tarjeta (borra la fecha, como
        // antes): es lo de HubSpot con Calendly, que marca la reunión cancelada y deja el negocio donde está.
        const tipoCancelada = decidirReserva(vinculada.ruta, clasificarJunta(payload.scheduled_event, cfgJuntas)).reunion;
        await emitirDelCatalogo('reunion-cancelada', {
          // La pregunta vieja («¿le mando un WhatsApp para conseguir otro
          // horario?») no tenía a dónde ir: nadie escuchaba la respuesta. Ahora
          // MaKo sí puede reagendar en Calendly desde el chat, así que se dice
          // exactamente qué escribirle para que pase (ver lib/calendly-agenda.ts).
          texto: `🔄 *Se canceló* la ${tipoCancelada} con ${lead.nombre} (era el ${fmtFechaHoraLocal(startTimeIso, tzWs)}) y todavía no reagendó.\n\n👉 Mira el resumen del lead:\n${linkResumenLead(lead.id, ws)}\n\nSi consigues otro horario, dime *«reagéndale la ${tipoCancelada} a ${lead.nombre}»*.\n\n— MaKo`,
        });
        // Flujos configurados por el dueño: disparar 'lead.cancelo'.
        await dispararEvento('lead.cancelo', { ws, leadId: lead.id, leadNombre: lead.nombre, reunion: tipoCancelada, dedupKey: `calendly-cancelo:${payload.scheduled_event?.uri ?? lead.id}|${startTimeIso}` });
        console.log(`[webhook:calendly] cancelación lead id=${lead.id} fecha=${fechaCancelada}: ${cambio} ms=${ms}`);
        return Response.json({ ok: true, event: body.event, lead_id: lead.id, cambio, ms });
      } catch (err) {
        // La suscripción se apagó el 21/09 en el MISMO minuto de tres cancelaciones del anfitrión
        // (qué falló adentro no se sabe: los logs ya vencieron). 503 sólo si reintentar lo arregla;
        // si no, 200 y anotado — y entonces sí queda escrito qué falló.
        return responderFalloDeProceso(err, { evento: body.event, rama: 'cancelacion', payload });
      }
    }

    default:
      console.log(`[webhook:calendly] evento no manejado: ${body.event}`);
      return Response.json({ ok: true, event: body.event, ignored: true });
   }
  } catch (err) {
    return responderFalloDeProceso(err, { evento: body.event, rama: 'despacho', payload: body.payload });
  }
  });
}

// Healthcheck simple por GET (útil para probar que el endpoint existe)
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: 'calendly webhook',
    usage: 'POST con header Calendly-Webhook-Signature',
  });
}
