// =============================================================================
// Meta Conversions API (CAPI) — Prompt 6 del plan del mentor
// =============================================================================
// Envía eventos server-side al Pixel de Meta con email/teléfono hasheados.
// Permite que Meta optimice las campañas hacia los perfiles que califican
// (no solo hacia el lead crudo), incluso si el usuario bloquea el pixel
// client-side.
//
// Credenciales:
//   - META_CRM_DATASET_ID (OPCIONAL — el destino PREFERIDO: ver `destinoCAPI`)
//   - META_PIXEL_ID     (el destino de siempre; hace falta uno de los dos)
//   - META_CAPI_TOKEN   (el token del PÍXEL, el que genera Events Manager: ver abajo)
//   - META_API_VERSION  (opcional, default 'v24.0' — matchea Marketing API)
//
// POR DÓNDE SALE (25/10/2026, Martín: «revisa el tema de CAPI y alimentar al pixel»):
//   1. Por la Zernio del negocio (`POST /v1/ads/conversions`), con la MISMA conexión de anuncios con la que MaKo lee
//      y publica: el negocio no pega nada más. Zernio hashea la identidad (va en claro: lib/zernio-meta-cuerpo.ts).
//   2. Si Zernio no tiene permiso sobre ese píxel (una conexión con «Administrar campañas» puede no alcanzar: no está
//      medido), o el negocio no tiene Zernio, por la Graph API con el token del píxel (`META_CAPI_TOKEN`, el botón
//      «Generar token de acceso» de Events Manager → tutorial en docs/tutorial-capi-pixel.md y en /integraciones).
//   3. El token de Meta de siempre (`META_ACCESS_TOKEN`), deprecado, para los negocios que lo conservan.
//
// Regla de oro: CAPI NUNCA debe romper el flujo de negocio. Cualquier error
// se loguea (console.error) pero NO se propaga. updateLead debe seguir
// funcionando aunque Meta esté caído o el token expiró.
//
// ⚠️ PERO «NO SE PROPAGA» NO ES «NO SE ENTERA NADIE». Hasta el 05/10/2026 esta
// función devolvía `void` y se quedaba con `res.ok`, así que un evento que Meta
// RECHAZABA se veía igual que uno que entró: `[capi] event sent` en un log que nadie
// lee. Ahora devuelve un resultado y el llamador lo escribe donde se mira — la regla
// de la casa es que `res.ok` no es «salió bien», los proveedores mandan el fallo
// ADENTRO del 200, y con Meta ya mordió (200 con `body.error`, subcode 4841013).
//
// Las cuatro decisiones del payload viven en `lib/meta-capi-payload.ts`, sin
// `server-only`, para que tengan test: el filtro del `lead_id`, la hora del hecho,
// qué cuenta como identidad y cómo se lee ese 200.
// =============================================================================

import 'server-only';
import crypto from 'node:crypto';
import { credWs, credWsEstricta } from './credenciales';
import type { AdondeVaLaCalificacion } from './meta-capi-payload';
import { CUSTOM_DATA_CRM, adondeDe, destinoCAPI, falloEnRespuesta, eventosRecibidos, hayIdentidad, leadIdDeMeta, tiempoDelHecho } from './meta-capi-payload';
import { canalMeta, type CanalMeta } from './meta-via';
import { zFetch, ZernioError } from './zernio';
import { esFalloDePermiso, eventoParaZernio, resultadoConversionZernio, type EventoZernio } from './zernio-meta-cuerpo';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type CAPIEventParams = {
  eventName: string;
  email: string | null;
  phone: string | null;
  /**
   * El `leadgen_id` del formulario de Meta (`leads.meta_lead_id`), SIN hashear.
   *
   * Es el identificador de MÁXIMA prioridad de Meta y lo único que mueve la
   * Cobertura de leads. Se manda sólo si es uno de verdad: `leadIdDeMeta` lo
   * valida, porque uno inválido hace que Meta rechace el evento entero.
   */
  metaLeadId?: string | null;
  /**
   * El instante del HECHO. Sin esto va la hora de la LLAMADA, que no es lo mismo:
   * ver `tiempoDelHecho`.
   */
  eventTime?: Date | string | null;
  customData?: Record<string, unknown>;
  /** Clave de deduplicación pixel↔CAPI (mismo event_name + event_id = 1 evento). */
  eventId?: string;
  /**
   * El visitante del Pixel de MaKo (`nqe_visitor_id`), el UID que la landing de MaKo le pasa al Píxel de Meta como
   * `external_id` (app/vsl/Landing.tsx). Va hasheado (sha256), como lo hashea el Píxel: así Meta cruza la visita con
   * el evento del server. No cuenta como identidad por sí solo (sin email, teléfono ni lead_id no se manda).
   */
  externalId?: string | null;
  /** URL de origen (para action_source='website'). */
  eventSourceUrl?: string;
  /** Por defecto 'system_generated'; usar 'website' para deduplicar con el pixel. */
  actionSource?: CAPIDataEntry['action_source'];
  /**
   * El código de «Probar eventos» del Administrador de eventos (`TEST…`): el evento se ve en esa pestaña y NO cuenta en los
   * datos del píxel. Sólo para probar (`probar_capi_meta` de la API de MaKo); un envío real nunca lo lleva.
   */
  testCode?: string;
};

/** Por qué no entró. Cada motivo es una acción distinta, así que no se funden. */
export type CAPIMotivo = 'sin_pixel' | 'sin_token' | 'sin_identidad' | 'http' | 'rechazado' | 'red';

export type CAPIResultado =
  | { ok: true; recibidos: number }
  | { ok: false; motivo: CAPIMotivo; detalle: string };

// Forma del payload que Meta espera dentro de "data: [...]"
type CAPIDataEntry = {
  event_name: string;
  event_time: number;
  action_source: 'system_generated' | 'website' | 'email' | 'app';
  event_id?: string;
  event_source_url?: string;
  user_data: {
    em?: string[];
    ph?: string[];
    /** SIN hashear, a propósito: la doc de Meta lo pide en claro. */
    lead_id?: string;
    /** sha256 del visitante del Pixel de MaKo (`externalId`). */
    external_id?: string[];
  };
  custom_data?: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** SHA-256 hex, formato que Meta acepta para identidad del usuario. */
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Normaliza email (lowercase + trim) y devuelve su SHA-256.
 * Null si email vacío o inválido.
 */
function hashEmail(email: string | null): string | null {
  if (!email) return null;
  const norm = email.trim().toLowerCase();
  if (!norm || !norm.includes('@')) return null;
  return sha256Hex(norm);
}

/**
 * Normaliza teléfono (solo dígitos, sin espacios/guiones/paréntesis) y
 * devuelve su SHA-256. Null si phone vacío o sin dígitos.
 */
function hashPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return sha256Hex(digits);
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envía un evento server-side a Meta Conversions API.
 *
 * NUNCA lanza excepciones. Si algo falla (env vars faltantes, red, token
 * inválido, respuesta no-200, o un 200 con el fallo adentro) loguea y devuelve
 * `{ ok: false, motivo, detalle }`. El caller no necesita try/catch — pero
 * envolverlo igual es buena práctica para que un bug futuro en este código no
 * rompa updateLead.
 *
 * ⚠️ EL RESULTADO ES PARA ESCRIBIRLO DONDE ALGUIEN LO LEA. Devolverlo y tirarlo
 * deja el mismo agujero que había: el llamador que tiene un lead a mano lo manda
 * al historial de la ficha (`logLeadEvent`), que es donde el dueño mira.
 */
/**
 * A dónde va un evento y con qué token. Lo usan el envío y la pregunta de la ficha
 * (`adondeVaLaCalificacion`): dos lecturas distintas contestarían distinto.
 */
async function destinoYToken(): Promise<{ destino: ReturnType<typeof destinoCAPI>; accessToken: string | null; canal: CanalMeta }> {
  // Primero el conjunto de datos de CRM si el cliente lo creó, y si no el píxel del
  // sitio: el porqué y el centinela PENDING están en `destinoCAPI`.
  const destino = destinoCAPI(await credWs('META_CRM_DATASET_ID'), await credWs('META_PIXEL_ID'));
  const canal = await canalMeta();
  // El token de CAPI dejó de ser obligatorio: el botón "Generar token de acceso"
  // de Events Manager arma por detrás un token con ads_management sobre ese píxel
  // — no es un tipo especial de credencial. El token principal sirve igual si el
  // píxel está asignado al usuario de sistema (verificado contra la API real).
  // META_CAPI_TOKEN queda como override para el píxel que vive en OTRO negocio.
  // Desde el 25/10/2026 el token del píxel deja de ser «sólo para el píxel de otro negocio»: con el token de Meta
  // deprecado, es la salida de un negocio que conectó por Zernio cuando su conexión no alcanza para el píxel.
  const usado = await credWs('META_CAPI_TOKEN');
  const accessToken = usado && !usado.startsWith('PENDING') ? usado : await credWs('META_ACCESS_TOKEN');
  return { destino, accessToken, canal };
}

/**
 * ¿Le llega a Meta lo que se marca en «¿Era calificado?»? Lo que la ficha le dice a quien
 * marca (14/10/2026). Medido ese día: ws9 y ws11 tienen el token y NINGÚN píxel, así que
 * lo que se marcaba ahí no salía (`sin_pixel`, que a propósito no va al historial de cada
 * lead) y la tarjeta afirmaba «Meta aprende de esto».
 *
 * null = no se pudo leer. `credWs` convierte una base caída en «no hay», y «no pude
 * leer» no es «no tiene» (AGENTS.md): sin esta sonda la ficha mandaría a conectar un
 * píxel que está. Lo que se contesta sale de `destinoYToken`, lo mismo que usa el envío.
 */
export async function adondeVaLaCalificacion(ws: number): Promise<AdondeVaLaCalificacion | null> {
  try { await credWsEstricta('META_PIXEL_ID', ws); } catch { return null; }
  const { destino, accessToken, canal } = await destinoYToken();
  // Con la conexión de Zernio el evento sale aunque no haya token: Zernio hace de token (no se pega nada).
  return adondeDe(destino, canal.via === 'zernio' ? 'zernio' : accessToken);
}

export async function sendMetaCAPIEvent(params: CAPIEventParams): Promise<CAPIResultado> {
  const { destino, accessToken, canal } = await destinoYToken();
  const apiVersion = process.env.META_API_VERSION || 'v24.0';

  if (!destino) {
    console.error('[capi] skip: no hay destino (ni META_CRM_DATASET_ID ni META_PIXEL_ID)');
    return { ok: false, motivo: 'sin_pixel', detalle: 'no hay conjunto de datos ni píxel de Meta configurado' };
  }
  const hayToken = !!accessToken && !accessToken.startsWith('PENDING');
  if (!hayToken && canal.via !== 'zernio') {
    console.error('[capi] skip: no hay por dónde mandar (ni la conexión de Zernio, ni META_CAPI_TOKEN, ni META_ACCESS_TOKEN)');
    return { ok: false, motivo: 'sin_token', detalle: 'no hay conexión de Meta por Zernio ni token del píxel cargado' };
  }

  const emHash = hashEmail(params.email);
  const phHash = hashPhone(params.phone);
  const leadId = leadIdDeMeta(params.metaLeadId);
  // Lo que llegó con forma de id y no lo es se DECLARA. Un `meta_lead_id` descartado
  // sin rastro hace indistinguibles «este lead no vino de un formulario de Meta» de
  // «lo tiramos nosotros», que es exactamente la pregunta de la Cobertura de leads.
  if (params.metaLeadId && !leadId) {
    console.warn(`[capi] ${params.eventName}: meta_lead_id "${params.metaLeadId}" no es un leadgen_id (15-17 dígitos) — va sin lead_id`);
  }

  // Meta requiere AL MENOS un identificador del usuario. Sin ninguno el evento no
  // será atribuible — mejor saltarlo. El lead_id cuenta por sí solo: es el de más
  // prioridad para el match.
  if (!hayIdentidad({ em: emHash, ph: phHash, leadId })) {
    console.error(`[capi] skip: ${params.eventName} sin email, phone ni lead_id, no es atribuible`);
    return { ok: false, motivo: 'sin_identidad', detalle: 'el lead no tiene email, teléfono ni id de formulario de Meta' };
  }

  const t = tiempoDelHecho(params.eventTime, new Date());
  if (t.recortado) {
    console.warn(`[capi] ${params.eventName}: el hecho es de ${t.real} y cae fuera de la ventana de CAPI — se manda en el borde`);
  }

  // El `custom_data` es el mismo por los dos caminos: los dos campos de CRM van PRIMERO (si un llamador declara su
  // propio `event_source`, el suyo gana), y sólo cuando el destino es el conjunto de datos de CRM — mandarlos al píxel
  // del sitio es lo que la doc de Meta prohíbe.
  const customData = params.customData || t.recortado || destino.esCrm
    ? { ...(destino.esCrm ? CUSTOM_DATA_CRM : {}), ...params.customData, ...(t.recortado && t.real ? { hecho_en: t.real } : {}) }
    : null;

  // 1) Por Zernio. Si no tiene permiso sobre el píxel y hay un token, sigue por el token; cualquier otro fallo se devuelve.
  if (canal.via === 'zernio') {
    const ev = eventoParaZernio({
      eventName: params.eventName, segundos: t.segundos, eventId: params.eventId, actionSource: params.actionSource,
      eventSourceUrl: params.eventSourceUrl, email: params.email, phone: params.phone, leadId, externalId: params.externalId, customData,
    });
    const r = await enviarPorZernio(canal, destino.id, ev, params.testCode);
    if (r.ok) return { ok: true, recibidos: r.recibidos };
    if (!r.permiso || !hayToken) return { ok: false, motivo: r.motivo, detalle: r.detalle };
    console.warn(`[capi] ${params.eventName}: Zernio sin permiso sobre el píxel (${r.detalle}) — sigo con el token del píxel`);
  }

  // 2) Por la Graph API con el token del píxel (o el de Meta de siempre).
  const user_data: CAPIDataEntry['user_data'] = {};
  if (emHash) user_data.em = [emHash];
  if (phHash) user_data.ph = [phHash];
  if (leadId) user_data.lead_id = leadId;
  const uid = typeof params.externalId === 'string' ? params.externalId.trim().toLowerCase() : '';
  if (uid) user_data.external_id = [sha256Hex(uid)];

  const entry: CAPIDataEntry = {
    event_name: params.eventName,
    event_time: t.segundos,
    action_source: params.actionSource ?? 'system_generated',
    ...(params.eventId ? { event_id: params.eventId } : {}),
    ...(params.eventSourceUrl ? { event_source_url: params.eventSourceUrl } : {}),
    user_data,
    ...(customData ? { custom_data: customData } : {}),
  };

  const url = `https://graph.facebook.com/${apiVersion}/${destino.id}/events`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [entry],
        access_token: accessToken,
        ...(params.testCode ? { test_event_code: params.testCode } : {}),
      }),
    });

    const crudo = await res.text().catch(() => '');
    if (!res.ok) {
      console.error(`[capi] ${params.eventName} HTTP ${res.status} — ${crudo.slice(0, 300)}`);
      return { ok: false, motivo: 'http', detalle: `HTTP ${res.status}: ${crudo.slice(0, 200)}` };
    }

    // ⚠️ Acá estaba el agujero: alcanzaba con `res.ok`. Meta contesta 200 con el
    // fallo ADENTRO, y un 200 que no confirma ningún evento tampoco es un éxito.
    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      console.error(`[capi] ${params.eventName} 200 con un cuerpo que no es JSON — ${crudo.slice(0, 200)}`);
      return { ok: false, motivo: 'rechazado', detalle: `respuesta ilegible: ${crudo.slice(0, 200)}` };
    }
    const fallo = falloEnRespuesta(cuerpo);
    if (fallo) {
      console.error(`[capi] ${params.eventName} RECHAZADO por Meta (HTTP 200) — ${fallo}`);
      return { ok: false, motivo: 'rechazado', detalle: fallo };
    }

    const recibidos = eventosRecibidos(cuerpo);
    console.log(`[capi] event sent: ${params.eventName} (recibidos=${recibidos}${leadId ? ', con lead_id' : ''})`);
    return { ok: true, recibidos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[capi] ${params.eventName} network error: ${msg}`);
    return { ok: false, motivo: 'red', detalle: msg };
  }
}

/**
 * Un evento por la Zernio del negocio (`POST /v1/ads/conversions`). Nunca tira. `permiso`: el fallo es de PERMISO sobre el
 * píxel (vale probar con el token del píxel); un fallo de red o de datos no, porque repetiría el mismo error.
 * ⚠️ Un rechazo de Meta viene en un 200 (`eventsFailed`), no en el status.
 */
async function enviarPorZernio(
  canal: Extract<CanalMeta, { via: 'zernio' }>,
  destinoId: string,
  ev: EventoZernio,
  testCode?: string,
): Promise<{ ok: true; recibidos: number } | { ok: false; motivo: CAPIMotivo; detalle: string; permiso: boolean }> {
  try {
    const body = await zFetch<unknown>(canal.clave, '/ads/conversions', {
      method: 'POST',
      body: JSON.stringify({ accountId: canal.accountId, destinationId: destinoId, events: [ev], ...(testCode ? { testCode } : {}) }),
    }, 30_000);
    const r = resultadoConversionZernio(body);
    if (r.ok) {
      console.log(`[capi] event sent por Zernio: ${ev.eventName} (recibidos=${r.recibidos}${ev.user.leadId ? ', con lead_id' : ''})`);
      return r;
    }
    console.error(`[capi] ${ev.eventName} RECHAZADO por Meta (por Zernio) — ${r.detalle}`);
    return { ok: false, motivo: 'rechazado', detalle: `por Zernio: ${r.detalle}`, permiso: esFalloDePermiso(200, r.detalle) };
  } catch (e) {
    if (e instanceof ZernioError) {
      const detalle = `Zernio ${e.status}: ${e.message}`.slice(0, 300);
      console.error(`[capi] ${ev.eventName} por Zernio — ${detalle}`);
      return { ok: false, motivo: e.status >= 400 ? 'http' : 'red', detalle, permiso: esFalloDePermiso(e.status, e.message) };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[capi] ${ev.eventName} por Zernio, error de red: ${msg}`);
    return { ok: false, motivo: 'red', detalle: `por Zernio: ${msg}`, permiso: false };
  }
}
