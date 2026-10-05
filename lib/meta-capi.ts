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
//   - META_CAPI_TOKEN   (OPCIONAL — si no está, se usa META_ACCESS_TOKEN)
//   - META_API_VERSION  (opcional, default 'v24.0' — matchea Marketing API)
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
import { credWs } from './credenciales';
import { CUSTOM_DATA_CRM, destinoCAPI, falloEnRespuesta, eventosRecibidos, hayIdentidad, leadIdDeMeta, tiempoDelHecho } from './meta-capi-payload';

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
  /** URL de origen (para action_source='website'). */
  eventSourceUrl?: string;
  /** Por defecto 'system_generated'; usar 'website' para deduplicar con el pixel. */
  actionSource?: CAPIDataEntry['action_source'];
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
export async function sendMetaCAPIEvent(params: CAPIEventParams): Promise<CAPIResultado> {
  // Primero el conjunto de datos de CRM si el cliente lo creó, y si no el píxel del
  // sitio: el porqué y el centinela PENDING están en `destinoCAPI`.
  const destino = destinoCAPI(await credWs('META_CRM_DATASET_ID'), await credWs('META_PIXEL_ID'));
  // El token de CAPI dejó de ser obligatorio: el botón "Generar token de acceso"
  // de Events Manager arma por detrás un token con ads_management sobre ese píxel
  // — no es un tipo especial de credencial. El token principal sirve igual si el
  // píxel está asignado al usuario de sistema (verificado contra la API real).
  // META_CAPI_TOKEN queda como override para el píxel que vive en OTRO negocio.
  const usado = await credWs('META_CAPI_TOKEN');
  const accessToken = usado && !usado.startsWith('PENDING') ? usado : await credWs('META_ACCESS_TOKEN');
  const apiVersion = process.env.META_API_VERSION || 'v24.0';

  if (!destino) {
    console.error('[capi] skip: no hay destino (ni META_CRM_DATASET_ID ni META_PIXEL_ID)');
    return { ok: false, motivo: 'sin_pixel', detalle: 'no hay conjunto de datos ni píxel de Meta configurado' };
  }
  if (!accessToken || accessToken.startsWith('PENDING')) {
    console.error('[capi] skip: no hay token para CAPI (ni META_CAPI_TOKEN ni META_ACCESS_TOKEN)');
    return { ok: false, motivo: 'sin_token', detalle: 'no hay token de Meta cargado' };
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

  const user_data: CAPIDataEntry['user_data'] = {};
  if (emHash) user_data.em = [emHash];
  if (phHash) user_data.ph = [phHash];
  if (leadId) user_data.lead_id = leadId;

  const t = tiempoDelHecho(params.eventTime, new Date());
  if (t.recortado) {
    console.warn(`[capi] ${params.eventName}: el hecho es de ${t.real} y cae fuera de la ventana de CAPI — se manda en el borde`);
  }

  const entry: CAPIDataEntry = {
    event_name: params.eventName,
    event_time: t.segundos,
    action_source: params.actionSource ?? 'system_generated',
    ...(params.eventId ? { event_id: params.eventId } : {}),
    ...(params.eventSourceUrl ? { event_source_url: params.eventSourceUrl } : {}),
    user_data,
    // Los dos campos de CRM van PRIMERO: si un llamador declara su propio
    // `event_source`, el suyo gana. Y solo cuando el destino es el conjunto de datos
    // de CRM — mandarlos al píxel del sitio es lo que la doc de Meta prohíbe.
    ...(params.customData || t.recortado || destino.esCrm
      ? { custom_data: { ...(destino.esCrm ? CUSTOM_DATA_CRM : {}), ...params.customData, ...(t.recortado && t.real ? { hecho_en: t.real } : {}) } }
      : {}),
  };

  const url = `https://graph.facebook.com/${apiVersion}/${destino.id}/events`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [entry],
        access_token: accessToken,
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
