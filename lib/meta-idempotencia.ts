// =============================================================================
// meta-idempotencia — que un reintento no publique dos veces en Meta
// =============================================================================
// Sin `server-only`, a propósito: la clave la arma el NAVEGADOR (`claveParaPayload`),
// las reglas las aplican las rutas que crean en Meta, y los tests importan las dos
// mitades. Lo que toca la base recibe el cliente por parámetro.
//
// EL DUPLICADO REAL (tarea #59, medido el 07/10/2026 contra el código): el server crea la
// campaña bien y la RESPUESTA se pierde —la plataforma corta a los 300 s con un 504, se
// cierra la pestaña, se cae la red—. El borrador sigue en localStorage, se reabre en
// «revisión» con el mismo spec, y el segundo clic crea OTRA campaña. Sin respuesta, el
// cliente no tiene cómo saber qué pasó: sólo el server lo sabe, y sólo si el pedido trae
// algo que lo identifique. Eso es la clave.
//
// Las reglas son DOS, no una, porque la misma fila significa cosas distintas según quién
// la escribió:
//
// - CAMPAÑA (campaign-create): `meta_campaign_id` es la campaña que ESTE pedido creó, y si
//   falló a mitad se borra y el error termina en «(revertido)». Error sin revertir con una
//   campaña puesta = quedó algo en Meta.
// - LOTE (ad-add, adset-add): `meta_campaign_id` es la campaña que YA existía —ad-add la
//   escribe al insertar— y no hay rollback: lo creado se queda en pausa. Con la regla de la
//   campaña, un lote que falló con 0 anuncios quedaría «a medias» para siempre y no se
//   podría reintentar nunca. Acá lo que cuenta es CUÁNTOS se crearon.
//
// ⚠️ Y LA CLAVE CAMBIA CUANDO CAMBIA EL PAYLOAD. Después de un parcial conocido el cliente
// recorta el spec (saca los N que entraron) y reintenta; con la MISMA clave el server
// contestaría desde la fila vieja «creados N», el cliente recortaría N más y se perderían
// en silencio anuncios que nunca se crearon. Por eso la clave sale de la FIRMA del payload:
// mismo payload → misma clave (un reintento ciego se deduplica); payload distinto → clave
// nueva (un recorte, una edición en la revisión o un «Regenerar» son otra publicación).
//
// ⚠️ SALVO QUE LA ANTERIOR HAYA QUEDADO SIN RESPUESTA: esa clave queda ABIERTA y manda
// sobre la firma hasta que el server la cierre (claveAMandar / trasRespuesta, más abajo).
// Sin eso, editar una palabra después de un 504 publicaba la campaña dos veces.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// La clave (navegador)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el server acepta como clave: corta, sin nada que se pueda interpolar. */
export const CLAVE_IDEM = /^[\w-]{8,64}$/;

/** La clave que llegó en el body. `clave: null` = no vino (camino viejo); `ok: false` =
 *  vino y no sirve (400: no se publica con una clave que no se puede guardar). */
export function claveIdemDe(x: unknown): { ok: true; clave: string | null } | { ok: false } {
  if (x === undefined || x === null || x === '') return { ok: true, clave: null };
  if (typeof x !== 'string' || !CLAVE_IDEM.test(x)) return { ok: false };
  return { ok: true, clave: x };
}

/**
 * Firma de un payload: dos FNV-1a de 32 bits con bases distintas y el largo. No es
 * criptográfica ni hace falta que lo sea: compara un payload consigo mismo después de un
 * viaje por localStorage, y `JSON.stringify` saca los `undefined` en las dos puntas.
 */
export function firmaDe(payload: unknown): string {
  const s = JSON.stringify(payload) ?? '';
  let a = 0x811c9dc5;
  let b = 0x9747b28c;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
  }
  return `${s.length.toString(36)}.${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`;
}

export function nuevaClaveIdem(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // randomUUID sólo existe en un contexto seguro (https o localhost). Respaldo: 32 hex.
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export type ClaveIdem = { clave: string; firma: string };

/** La clave para ESTE payload: la anterior si el payload es el mismo, una nueva si cambió. */
export function claveParaPayload(previa: ClaveIdem | null | undefined, payload: unknown, nueva: () => string = nuevaClaveIdem): ClaveIdem {
  const firma = firmaDe(payload);
  if (previa && previa.firma === firma && CLAVE_IDEM.test(previa.clave)) return previa;
  return { clave: nueva(), firma };
}

/** Lo que vuelve de localStorage se valida: un borrador viejo no la trae, y uno roto no
 *  puede mandar una clave que el server rechace. */
export function claveIdemGuardada(x: unknown): ClaveIdem | null {
  if (!x || typeof x !== 'object') return null;
  const { clave, firma } = x as { clave?: unknown; firma?: unknown };
  return typeof clave === 'string' && CLAVE_IDEM.test(clave) && typeof firma === 'string' && firma ? { clave, firma } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La clave ABIERTA (navegador): la que el server todavía no cerró
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ LA FIRMA SOLA DUPLICABA (revisión de la #59, 07/10/2026). Después de una respuesta
// perdida la pantalla vuelve a «revisión» con el nombre y el copy editables, y dice
// «Reintentar es seguro: no se duplica». Corregir una palabra cambiaba la firma, salía una
// clave nueva, y el server —que no tiene fila para ella— creaba una SEGUNDA campaña con la
// primera ya en Meta. Y en Agregar anuncio / Agregar conjunto la clave vivía en un ref:
// cerrar y reabrir el modal la perdía, así que hasta el MISMO payload salía con otra.
//
// La regla: la clave de un pedido que quedó sin respuesta queda ABIERTA y se manda en el
// próximo clic AUNQUE el payload haya cambiado. Es seguro mandarla con otro payload: el
// server contesta desde la fila si algo se creó ('devolver', 'esperar', 'a-medias') y, si
// nada se creó ('nueva', o una fila en 'error' que se puede reintentar), publica lo que
// llega ahora. Recién cuando el server la CIERRA vuelve a mandar la firma.

/** Lo que el navegador lee de una respuesta para decidir qué hacer con la clave. */
export type RespuestaIdem = { ok?: boolean; estado?: string; repetida?: boolean; created?: number } | null;

/**
 * La clave que se manda: la abierta si la hay —aunque el payload sea otro—, si no la de la
 * firma. `firma` es la de ESTE payload; `mandada.firma` la del payload con el que esa clave
 * salió por primera vez (son distintas sólo cuando se manda una abierta después de editar).
 */
export function claveAMandar(
  abierta: ClaveIdem | null | undefined, previa: ClaveIdem | null | undefined, payload: unknown, nueva: () => string = nuevaClaveIdem,
): { mandada: ClaveIdem; firma: string } {
  const firma = firmaDe(payload);
  if (abierta && CLAVE_IDEM.test(abierta.clave)) return { mandada: abierta, firma };
  return { mandada: claveParaPayload(previa, payload, nueva), firma };
}

export type TrasRespuesta = {
  /** La clave que queda abierta para el próximo clic, o null si el server la cerró. */
  abierta: ClaveIdem | null;
  /** La «previa» de claveParaPayload para el próximo clic. */
  previa: ClaveIdem;
  /** La respuesta habla de lo que se mandó ANTES con esa clave, no de esto: no es el éxito
   *  de lo que está en pantalla, y su `created` no se le recorta a esto. */
  deAntes: boolean;
};

/**
 * Qué queda después de una respuesta.
 *
 * - El server CIERRA la clave con un ok, un 'a-medias' o un parcial con `created`: ya
 *   contestó por ella, y lo que sigue es otra publicación (después de un parcial el
 *   cliente recorta, y con la misma clave contestaría «creados N» otra vez).
 * - Todo lo demás la deja ABIERTA: sin respuesta, 'esperar', y cualquier error. Un error
 *   puede ser un chequeo previo (409 de videos, 400, 403, 503) que ni miró la clave, y las
 *   reglas del server cubren el resto: con la fila en 'error', la misma clave reintenta o
 *   contesta «a medias» — nunca crea otra encima de lo que quedó en Meta.
 */
export function trasRespuesta(j: RespuestaIdem, mandada: ClaveIdem, firma: string): TrasRespuesta {
  const cerro = !!j && (j.ok === true || j.estado === 'a-medias' || (typeof j.created === 'number' && j.created > 0));
  if (!j || !cerro) return { abierta: mandada, previa: mandada, deAntes: false };
  // 'devolver' y 'a-medias' contestan desde la FILA, o sea por lo que se mandó antes; un ok
  // sin `repetida` (o un parcial) es lo que se acaba de publicar con lo que llegó ahora.
  const deAntes = mandada.firma !== firma && (j.repetida === true || j.estado === 'a-medias');
  return { abierta: null, previa: { clave: mandada.clave, firma: deAntes ? mandada.firma : firma }, deAntes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las reglas (server)
// ─────────────────────────────────────────────────────────────────────────────

export type FilaPublicacion = {
  id: number;
  status: string;
  updated_at: string | null;
  error: string | null;
  meta_campaign_id: string | null;
  meta_adset_ids: string[];
  meta_ad_ids: string[];
  meta_creative_ids: string[];
};

export const SELECT_FILA = 'id, status, updated_at, error, meta_campaign_id, meta_adset_ids, meta_ad_ids, meta_creative_ids';

/** Los `meta_*_ids` son jsonb, no arrays de Postgres: se normalizan a strings. */
function ids(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v) => v !== null && v !== undefined && v !== '').map(String) : [];
}

export function filaDe(r: Record<string, unknown>): FilaPublicacion {
  return {
    id: Number(r.id),
    status: String(r.status ?? ''),
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : null,
    error: typeof r.error === 'string' ? r.error : null,
    meta_campaign_id: r.meta_campaign_id == null || r.meta_campaign_id === '' ? null : String(r.meta_campaign_id),
    meta_adset_ids: ids(r.meta_adset_ids),
    meta_ad_ids: ids(r.meta_ad_ids),
    meta_creative_ids: ids(r.meta_creative_ids),
  };
}

export type Decision =
  | { tipo: 'devolver' }
  | { tipo: 'esperar' }
  | { tipo: 'a-medias'; creados: number }
  | { tipo: 'reintentar' };

export type Decidir = (fila: FilaPublicacion, ahoraMs: number) => Decision;

/**
 * Cuánto se espera a una fila en 'creando' antes de darla por muerta. Las rutas corren con
 * `maxDuration = 300`, y cada avance reescribe `updated_at`: una fila en curso de verdad no
 * puede tener más de 300 s sin tocarse. El minuto de más es margen de relojes.
 */
export const ESPERA_CREANDO_MS = 6 * 60_000;

function enCurso(fila: FilaPublicacion, ahoraMs: number): boolean {
  const t = Date.parse(fila.updated_at ?? '');
  return Number.isFinite(t) && ahoraMs - t < ESPERA_CREANDO_MS;
}

const REVERTIDO = /\(revertido\)\s*$/;

/**
 * CAMPAÑA. 'devolver' si está publicada; 'esperar' si otro pedido la está creando ahora;
 * 'a-medias' si ese pedido murió en el medio, o si falló sin poder borrar lo creado; y
 * 'reintentar' si falló sin crear nada o lo creado se borró.
 *
 * ⚠️ 'a-medias' NO se reintenta solo: en Meta hay una campaña en pausa sin todos sus
 * anuncios, y crear otra es duplicarla. Qué se le ofrece a la persona ahí (borrarla,
 * completarla, sólo avisar) es una decisión de producto pendiente; hoy se avisa.
 */
export function decidirReintentoCampana(fila: FilaPublicacion, ahoraMs: number): Decision {
  const creados = fila.meta_ad_ids.length;
  switch (fila.status) {
    // ⚠️ 'publicada' SIN campaña no se devuelve (revisión de la #59): el update que anota la
    // campaña traga su error, y la respuesta repetida decía `campaign_id: null` — el cliente
    // pintaba el éxito con un id vacío y le asignaba el producto a la campaña «null».
    case 'publicada': return fila.meta_campaign_id ? { tipo: 'devolver' } : { tipo: 'a-medias', creados };
    case 'creando': return enCurso(fila, ahoraMs) ? { tipo: 'esperar' } : { tipo: 'a-medias', creados };
    case 'error':
      if (!fila.meta_campaign_id || REVERTIDO.test(fila.error ?? '')) return { tipo: 'reintentar' };
      return { tipo: 'a-medias', creados };
    default: return { tipo: 'a-medias', creados };
  }
}

/**
 * LOTE (ad-add: `meta_ad_ids`; adset-add: `meta_adset_ids`). No mira `meta_campaign_id`:
 * en estas rutas es la campaña que ya existía. 'a-medias' lleva cuántos entraron, para que
 * el cliente recorte esos y reintente sólo el resto (con otra clave, porque es otro payload).
 */
export function decidirReintentoLote(fila: FilaPublicacion, ahoraMs: number, columna: 'meta_ad_ids' | 'meta_adset_ids' = 'meta_ad_ids'): Decision {
  const creados = fila[columna].length;
  switch (fila.status) {
    case 'publicada': return { tipo: 'devolver' };
    case 'creando': return enCurso(fila, ahoraMs) ? { tipo: 'esperar' } : { tipo: 'a-medias', creados };
    case 'error': return creados > 0 ? { tipo: 'a-medias', creados } : { tipo: 'reintentar' };
    default: return { tipo: 'a-medias', creados };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// La base (server): leer, reclamar y abrir el registro
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorDb = { code?: string | null; message?: string | null } | null;
export type Salida = { status: number; cuerpo: Record<string, unknown> };

export const MENSAJE_ESPERAR = 'Esto ya se está publicando. Espera un minuto y mira la tabla.';
export const MENSAJE_A_MEDIAS = 'Quedó a medias en Meta, en pausa. Revísalo en la tabla antes de reintentar.';
const MENSAJE_SIN_BASE = 'No pude registrar la publicación y no se creó nada. Reintenta en un momento.';

export const salidaEsperar = (): Salida => ({ status: 409, cuerpo: { ok: false, estado: 'esperar', error: MENSAJE_ESPERAR } });
export const salidaAMedias = (extra: Record<string, unknown> = {}): Salida => ({ status: 409, cuerpo: { ok: false, estado: 'a-medias', error: MENSAJE_A_MEDIAS, ...extra } });
const salidaSinBase = (detalle: string): Salida => ({ status: 503, cuerpo: { ok: false, estado: 'sin-base', error: MENSAJE_SIN_BASE, detalle } });

/**
 * ¿Falta la columna `idem_key`? (la migración 0215 sin aplicar). PostgREST contesta 42703
 * a un filtro sobre una columna que no existe y PGRST204 a un insert que la nombra.
 *
 * ⚠️ Con la columna faltando NO se bloquea: se publica por el camino viejo, sin clave, y se
 * loguea. Bloquear ahí apagaría las publicaciones de TODOS los clientes por un deploy que
 * llegó antes que su migración, a cambio de una protección que hasta hoy no existía. El
 * 503 queda para lo que sí es incierto: la base que no contesta.
 */
export function faltaColumnaIdem(e: ErrorDb): boolean {
  if (!e) return false;
  const code = String(e.code ?? '');
  if (code === '42703' || code === 'PGRST204') return true;
  const msg = String(e.message ?? '');
  return /idem_key/.test(msg) && /column|schema cache/i.test(msg);
}

export type Consulta =
  | { paso: 'nueva' }
  | { paso: 'reintentar'; fila: FilaPublicacion }
  | { paso: 'responder'; decision: Decision; fila: FilaPublicacion }
  | { paso: 'sin-columna' }
  | { paso: 'sin-base'; motivo: string };

/** Lee la fila de esa clave (en ESE workspace) y la decide. Lee el `error` siempre: «no
 *  hay fila» y «no pude leer» son dos respuestas, y la segunda no autoriza a crear. */
export async function consultarClave(db: SupabaseClient | null, ws: number, clave: string, decidir: Decidir, ahoraMs: number = Date.now()): Promise<Consulta> {
  if (!db) return { paso: 'sin-base', motivo: 'sin cliente de base' };
  try {
    const { data, error } = await db.from('meta_campaign_drafts').select(SELECT_FILA)
      .eq('workspace_id', ws).eq('idem_key', clave).maybeSingle();
    if (error) return faltaColumnaIdem(error) ? { paso: 'sin-columna' } : { paso: 'sin-base', motivo: String(error.message ?? 'error de base') };
    if (!data) return { paso: 'nueva' };
    const fila = filaDe(data as Record<string, unknown>);
    const decision = decidir(fila, ahoraMs);
    return decision.tipo === 'reintentar' ? { paso: 'reintentar', fila } : { paso: 'responder', decision, fila };
  } catch (e) {
    return { paso: 'sin-base', motivo: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Reclama una fila en 'error' para reintentar con ella. Compare-and-set: el update exige
 * `status = 'error'`, así que de dos pedidos con la misma clave reclama UNO; el otro lee 0
 * filas y espera. Pisa spec y nombre con lo que llega y limpia los ids viejos.
 */
export async function reclamarFila(db: SupabaseClient, ws: number, id: number, patch: Record<string, unknown>): Promise<'ok' | 'perdida' | 'error'> {
  try {
    const { data, error } = await db.from('meta_campaign_drafts')
      .update({ ...patch, status: 'creando', error: null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('workspace_id', ws).eq('status', 'error')
      .select('id');
    if (error) return 'error';
    return Array.isArray(data) && data.length > 0 ? 'ok' : 'perdida';
  } catch {
    return 'error';
  }
}

function idDe(data: unknown): number | null {
  const id = (data as { id?: unknown } | null)?.id;
  return typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null;
}

export type Apertura =
  | { registro: { draftId: number | null; conClave: boolean } }
  | { salida: Salida };

/**
 * Abre el registro de una publicación en `meta_campaign_drafts`, o contesta sin crear nada.
 *
 * - Sin clave: el camino de siempre, best-effort (si la base no está, igual se publica).
 * - Con clave: insert ESTRICTO. Si la base no contesta, 503 y no se crea nada en Meta:
 *   publicar sin registro es publicar sin poder deduplicar el reintento.
 *
 * El insert lo escribe la RUTA (`insertar`), no este módulo: tests/meta-campaign-drafts-
 * workspace.test.ts exige que cada ruta escriba su `workspace_id: wsDraft` a la vista.
 */
export async function abrirRegistro(o: {
  db: SupabaseClient | null;
  ws: number;
  clave: string | null;
  decidir: Decidir;
  responder: (d: Decision, fila: FilaPublicacion) => Salida;
  insertar: (db: SupabaseClient, conClave: boolean) => PromiseLike<{ data: unknown; error: ErrorDb }>;
  reclamo: Record<string, unknown>;
  ahoraMs?: number;
}): Promise<Apertura> {
  const sinClave = async (): Promise<Apertura> => {
    if (!o.db) return { registro: { draftId: null, conClave: false } };
    try {
      const { data } = await o.insertar(o.db, false);
      return { registro: { draftId: idDe(data), conClave: false } };
    } catch {
      return { registro: { draftId: null, conClave: false } };
    }
  };
  if (!o.clave) return sinClave();
  if (!o.db) return { salida: salidaSinBase('sin cliente de base') };

  const c = await consultarClave(o.db, o.ws, o.clave, o.decidir, o.ahoraMs);
  if (c.paso === 'sin-columna') {
    console.error('[meta-idempotencia] falta la columna idem_key (migración 0215): se publica SIN idempotencia');
    return sinClave();
  }
  if (c.paso === 'sin-base') return { salida: salidaSinBase(c.motivo) };
  if (c.paso === 'responder') return { salida: o.responder(c.decision, c.fila) };
  if (c.paso === 'reintentar') {
    const r = await reclamarFila(o.db, o.ws, c.fila.id, o.reclamo);
    if (r === 'ok') return { registro: { draftId: c.fila.id, conClave: true } };
    return { salida: r === 'perdida' ? salidaEsperar() : salidaSinBase('no pude reclamar el registro') };
  }

  try {
    const { data, error } = await o.insertar(o.db, true);
    const id = idDe(data);
    if (!error && id != null) return { registro: { draftId: id, conClave: true } };
    if (error && String(error.code ?? '') === '23505') {
      // Otro pedido con la misma clave (doble clic, dos pestañas) insertó primero.
      const c2 = await consultarClave(o.db, o.ws, o.clave, o.decidir, o.ahoraMs);
      return { salida: c2.paso === 'responder' ? o.responder(c2.decision, c2.fila) : salidaEsperar() };
    }
    if (error && faltaColumnaIdem(error)) {
      console.error('[meta-idempotencia] falta la columna idem_key (migración 0215): se publica SIN idempotencia');
      return sinClave();
    }
    return { salida: salidaSinBase(String(error?.message ?? 'el registro no devolvió id')) };
  } catch (e) {
    return { salida: salidaSinBase(e instanceof Error ? e.message : String(e)) };
  }
}
