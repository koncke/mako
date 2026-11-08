// =============================================================================
// Zernio — el cliente de la API, para Instagram y Messenger como canales del Chatbot
// =============================================================================
// Restaurado el 09/10/2026 (sexta tanda, CRON 4: «ya tenemos la integración de Zernio, utiliza eso
// para poder enviar mensajes por allí»). El de antes (commit 8d16c6ff^) hablaba de posts, de la
// bandeja y de las automatizaciones de comentarios de Zernio; éste sólo lo que el CANAL necesita:
// la cuenta, las cuentas conectadas, el webhook, mandar un DM y la respuesta privada a un comentario.
// Y desde la duodécima tanda (12/10/2026), «¿te sigue?» (`estadoDeSeguimiento`), que lee el motor para
// la condición «Te sigue en Instagram».
//
// Zernio (https://zernio.com/api/v1, auth bearer) envuelve las APIs de Instagram y de Facebook de
// Meta. Un error se tira TIPADO (`ZernioError`, con el envelope del body); Zernio ya reintenta
// contra Meta, así que acá no se reintenta nada.
//
// CREDENCIALES — BYOK, SIN respaldo de la plataforma (23/10/2026):
//   · Cada negocio con SU key de Zernio: `credDelClienteEstricta('ZERNIO_API_KEY', ws)` (lib/credenciales.ts),
//     la fila del negocio y nunca el entorno, y «no pude leer» tira. Martín: «que cada usuario traiga su API de
//     Zernio». Medido ese día en producción (sólo lectura): el único workspace que dependía del respaldo era el
//     ws3 (Cliente de Prueba), y no hay ni una conversación ni un envío de Instagram o Messenger en toda la
//     historia. Si el ws3 hace falta para pruebas, se le pega una key a mano.
//   · Hasta el 23/10 la key de la PLATAFORMA (`envCred`) era el respaldo, y el aislamiento lo daba un PROFILE por
//     workspace (`ensureProfile`, `mako_ws_<ws>`). Esa rama sigue SÓLO para el `OWNER_WS` (el ws1, que es un
//     cliente y tiene su fila, pegada el 23/10 con la misma key que la de la plataforma): se va con su key.
//   · 28/10/2026 (el Cerebro, la promesa a Teo: «te logueás con Instagram y Facebook y ya tiene acceso»): un negocio SIN key
//     vuelve a poder usar la cuenta de la plataforma con su profile `mako_ws_<ws>`, PERO sólo si el negocio de la plataforma
//     prende `zernio.cuenta_de_la_plataforma` (apagado por defecto: cada cuenta conectada la paga MaKo). La key propia gana.
//   · ⚠️ La key puede CAMBIAR después de guardar el profile (ws11: profile acuñado con la de la
//     plataforma el 15/08, key propia el 28/08), así que el profile guardado se valida contra la
//     cuenta de la key de HOY (`profileIdEfectivo`, lib/zernio-profile.ts), en las dos direcciones.
//
// TENANT-SAFETY: todo recibe `ws` EXPLÍCITO (corre en webhooks y crons, sin sesión). La tabla
// `zernio_workspace` se lee con el cliente crudo y `.eq('workspace_id', ws)`, igual que
// lib/webhook-routing.ts.

import 'server-only';
import { esperaDeRetryAfter, topeDeError, type TopeSocial } from './zernio-tope';
import { clavesGuardadasConBase, credDelClienteEstricta, credWsEstricta, envCred } from './credenciales';
import { createHash } from 'node:crypto';
import { CLAVES_ZERNIO, leerCuentasDeZernio, slotDeClaveZernio, tieneListaDeCuentas } from './zernio-redes';
import { getSupabaseServer } from './supabase';
import { OWNER_WS, wsSuperAdmin } from './workspace';
import { upsertRouting } from './webhook-routing';
import { linkApp } from './app-url';
import { webhookDeLaCuenta } from './zernio-firma';
import { profileDeLaCuenta } from './zernio-profile';
import { seguimientoDe, seguimientoNoSe, conTope, CONCURRENCIA_SEGUIMIENTO } from './canal-social';
import type { BotonZernio } from './botones-social';
import { publicacionesDeZernio, type PublicacionDeLaCuenta } from './publicacion-cron';
import { avisoDeLeads, escuchaComoBooleano, escuchaDelWebhook, type AvisoLeads, type EscuchaWebhook, type LecturaLeads } from './zernio-leads-estado';

const ZERNIO_BASE = 'https://zernio.com/api/v1';

/** Los servicios de `webhook_routing`: el profile (lo acuña el server) y la cuenta conectada. */
export const RUTEO_PERFIL = 'zernio';
export const RUTEO_CUENTA = 'zernio_cuenta';

/**
 * Los eventos que el canal escucha: los que se suscriben al registrar el webhook Y los que el webhook
 * procesa (app/api/webhooks/zernio/route.ts importa esta lista). Sin `message.sent`: lo que le llegó a
 * cada lead ya está en `nutricion_envios.texto_enviado`. La tabla, en docs/hallazgos-chatbot.md.
 */
export const EVENTOS_WEBHOOK = ['message.received', 'referral.received', 'comment.received', 'account.connected'] as const;

/**
 * Los leads de los formularios de Meta (23/10/2026). APARTE de la lista de arriba a propósito: es un evento del complemento de
 * ANUNCIOS de Zernio («leads require ads enabled on the team»), y un negocio sin el complemento no puede suscribirse a los eventos
 * de anuncios (403 `ads_addon_required`). Si fueran una sola lista, ese 403 dejaría al negocio SIN mensajes ni comentarios.
 * `asegurarWebhook` los pide juntos y, si Zernio los rechaza, registra los de siempre solos.
 */
export const EVENTO_LEADS = 'lead.received';

/** Todo lo que el webhook PROCESA (app/api/webhooks/zernio/route.ts): lo suscripto de siempre y los leads. */
export const EVENTOS_ESCUCHADOS: readonly string[] = [...EVENTOS_WEBHOOK, EVENTO_LEADS];

// ── Error tipado (envelope de Zernio: «Branch on type and code, never on error text») ──

export type ZernioErrorBody = {
  error?: string;
  type?: string;
  code?: string;
  param?: string;
  platform?: string;
  platformError?: unknown;
  details?: unknown;
};

export class ZernioError extends Error {
  /** HTTP status; 0 si el error es local (config, red, base). */
  readonly status: number;
  readonly code: string | null;
  readonly type: string | null;
  readonly body: ZernioErrorBody | null;
  /** Cuánto pide esperar Zernio antes de reintentar (`Retry-After`, 28/10/2026: el tope de Leandro). null = no lo dijo. */
  readonly esperaMs: number | null;
  /** Cuántos pedidos le quedan a la key en la ventana (`X-RateLimit-Remaining`). null = no lo dijo. */
  readonly restantes: number | null;

  constructor(message: string, status: number, body: ZernioErrorBody | null, cabeceras: { esperaMs?: number | null; restantes?: number | null } = {}) {
    super(message);
    this.name = 'ZernioError';
    this.status = status;
    this.code = body?.code ?? null;
    this.type = body?.type ?? null;
    this.body = body;
    this.esperaMs = cabeceras.esperaMs ?? null;
    this.restantes = cabeceras.restantes ?? null;
  }
}

// EL TOPE (28/10/2026, Leandro): lo puro vive en lib/zernio-tope.ts (lo prueba el test sin este módulo, que es server-only).
export { esperaDeRetryAfter, ESPERA_TOPE_META_MS, ESPERA_TOPE_ZERNIO_MS, type TopeSocial } from './zernio-tope';

/** ¿Este error de Zernio es un TOPE (de Zernio o de Meta)? Ver `topeDeError`. */
export function topeDe(e: unknown): TopeSocial | null {
  return e instanceof ZernioError ? topeDeError(e) : null;
}

// ── Config por workspace ─────────────────────────────────────────────────────

export type ZernioCfg = { apiKey: string; byok: boolean };

export async function cfg(ws: number): Promise<ZernioCfg> {
  // ⚠️ SÓLO la fila del negocio, y estricta: ni `credWs` (cae al entorno para el OWNER_WS) ni `envCred` (la cuenta de la
  // casa). Con la base caída TIRA: «no pude leer» no es «no tiene Zernio».
  const propia = await credDelClienteEstricta('ZERNIO_API_KEY', ws, { ilegibleTira: true });
  // El OWNER_WS (el ws1) sigue en el modo de la cuenta de la plataforma hasta que se le saque la key (ver la cabecera).
  if (propia) return { apiKey: propia, byok: ws !== OWNER_WS };
  // ⚠️ SIN KEY PROPIA, LA CUENTA DE ZERNIO DE LA PLATAFORMA, con un perfil por negocio (`ensureProfile`, `mako_ws_<ws>`), SÓLO
  // si MaKo lo prendió (28/10/2026, el Cerebro: «conectar Instagram y Facebook sin pegar una clave de Zernio», la promesa a Teo).
  // Apagado por defecto: cada cuenta conectada de cada cliente la paga la plataforma. Nunca para el negocio de la plataforma
  // (su key es su fila) y la key propia gana siempre.
  if (ws !== (await wsSuperAdmin()) && (await plataformaPrestaSuCuenta())) {
    const deLaPlataforma = await envCred('ZERNIO_API_KEY');
    if (deLaPlataforma) return { apiKey: deLaPlataforma, byok: false };
  }
  throw new ZernioError('Zernio no está configurado', 0, null);
}

// ── Varias claves de Zernio por negocio (29/10/2026) ─────────────────────────
//
// Martín, 29/10: «la posibilidad de pegar una segunda API key con otra cuenta de Gmail del cliente... y ya tendrías cuatro redes».
// Cada clave es OTRA cuenta (otro equipo) de Zernio DEL CLIENTE. La 1 es `cfg(ws)`, con sus reglas (el ws1, la cuenta prestada);
// las extra (`ZERNIO_API_KEY_2…`) son SÓLO del negocio. UNA RED QUEDA ATADA A LA CLAVE CON QUE SE CONECTÓ: lo que opera sobre una
// cuenta (un DM, un comentario, un post, los anuncios) habla con la clave que la tiene (`cfgDeCuenta`). Con una sola clave, todo
// es exactamente como antes (y no se lee nada de más: `clavesZernio` corta en la 1 si no hay extra).

/** Una clave del negocio, con su número y su huella (nunca se guarda ni se loguea la clave). */
export type ClaveZernio = ZernioCfg & { slot: number; huella: string };
/** La huella de una clave (sha256 corto): con ella se sabe con qué clave se hizo algo sin guardar la clave. */
export const huellaClave = (apiKey: string): string => createHash('sha256').update(apiKey).digest('hex').slice(0, 16);

const TTL_CLAVES_MS = 60_000;
const extrasCache = new Map<number, { extras: ClaveZernio[]; vence: number }>();
const cuentasCache = new Map<string, { ids: Set<string>; vence: number; releida: number | null }>();

/**
 * Las claves de Zernio del negocio, en orden (la 1 primero). Tira como `cfg` si no hay ninguna. La misma clave pegada dos veces
 * cuenta una vez. ⚠️ La 1 se lee SIEMPRE (`cfg`, como antes de las extra: cambiarla vale en el acto); sólo las EXTRA se cachean un
 * minuto, porque el motor manda de a muchos mensajes y cada uno pregunta. `fresca`: sin caché, para conectar y para la lista de
 * redes (quien acaba de pegar la clave 2 y toca «Conectar» no puede recibir el aviso de la 3.ª red de nuevo por un minuto viejo).
 */
export async function clavesZernio(ws: number, opc: { fresca?: boolean } = {}): Promise<ClaveZernio[]> {
  const base = await cfg(ws);
  const claves: ClaveZernio[] = [{ ...base, slot: 1, huella: huellaClave(base.apiKey) }];
  const hit = opc.fresca ? undefined : extrasCache.get(ws);
  let extras = hit && hit.vence > Date.now() ? hit.extras : null;
  if (!extras) {
    extras = [];
    // Una lectura para saber si hay extra (lo normal es que no): sólo se descifran las que están. ⚠️ Con los nombres de las EXTRA
    // (`ZERNIO_API_KEY_2…`), no con la base: `clavesGuardadasConBase` corta en `__` (las cuentas de una pasarela), así que con
    // `ZERNIO_API_KEY` sólo devolvía la 1 y las extra no aparecían nunca.
    const guardadas = await clavesGuardadasConBase(ws, CLAVES_ZERNIO.slice(1));
    for (const env of CLAVES_ZERNIO.filter((n) => guardadas.includes(n))) {
      const k = await credDelClienteEstricta(env, ws, { ilegibleTira: true });
      if (k) extras.push({ apiKey: k, byok: true, slot: slotDeClaveZernio(env) ?? 0, huella: huellaClave(k) });
    }
    extrasCache.set(ws, { extras, vence: Date.now() + TTL_CLAVES_MS });
  }
  for (const k of extras) if (!claves.some((x) => x.apiKey === k.apiKey)) claves.push(k);
  return claves;
}

/** Lo que espera una relectura después de otra: una cuenta que no es de NINGUNA clave no hace leer Zernio en cada mensaje. */
const RELEER_MIN_MS = 10_000;

/**
 * Los ids de TODAS las cuentas del equipo de una clave (sin filtrar por perfil), cacheados un minuto. `fresca`: se relee, salvo que
 * lo cacheado ya sea una relectura de hace menos de 10 s (la primera vez que una cuenta no aparece, se relee siempre).
 */
async function idsDeCuentasDe(k: ClaveZernio, fresca = false): Promise<Set<string>> {
  const hit = cuentasCache.get(k.huella);
  const vigente = hit && hit.vence > Date.now();
  if (vigente && (!fresca || (hit.releida != null && Date.now() - hit.releida < RELEER_MIN_MS))) return hit.ids;
  const r = await zFetch<unknown>(k.apiKey, '/accounts?excludeHidden=true');
  const ids = new Set(tieneListaDeCuentas(r) ? leerCuentasDeZernio(r).map((c) => c.accountId) : []);
  cuentasCache.set(k.huella, { ids, vence: Date.now() + TTL_CLAVES_MS, releida: fresca ? Date.now() : null });
  return ids;
}

/**
 * La clave DUEÑA de una cuenta de Zernio (la red quedó atada a la clave con que se conectó). Con una sola clave, la 1 sin preguntar
 * nada. Si una clave no se puede leer, se sigue con las demás. Si no está en lo cacheado, se relee UNA vez (claves y cuentas): la red
 * recién conectada con una clave extra no espera el minuto. Sin encontrarla, la 1 (Zernio dirá si no es suya).
 * ⚠️ Lo que SÍ puede esperar hasta un minuto: la PRIMERA clave extra recién pegada, en un proceso que ya había leído «sólo la 1» (con
 * una sola clave no se relee nada, a propósito: es el 99% de los negocios y cada mensaje pregunta).
 */
export async function cfgDeCuenta(ws: number, accountId: string | null | undefined): Promise<ClaveZernio> {
  const deAntes = await clavesZernio(ws);
  if (!accountId) return deAntes[0];
  for (const fresca of [false, true]) {
    const claves = fresca ? await clavesZernio(ws, { fresca: true }) : deAntes;
    if (claves.length === 1) return claves[0];
    for (const k of claves) {
      const ids = await idsDeCuentasDe(k, fresca).catch((e) => {
        console.warn(`[zernio] ws${ws}: no pude leer las cuentas de la clave ${k.slot}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      });
      if (ids?.has(accountId)) return k;
    }
  }
  return deAntes[0];
}

/** La clave del negocio con esa huella (la de un post programado), o null si ya no es del negocio. */
export async function cfgDeHuella(ws: number, huella: string | null | undefined): Promise<ClaveZernio | null> {
  if (!huella) return null;
  return (await clavesZernio(ws)).find((k) => k.huella === huella) ?? null;
}

/**
 * El perfil de una clave EXTRA: el Default de SU cuenta, y su ruteo (`RUTEO_PERFIL`), para que los mensajes de esas redes lleguen a
 * este negocio. ⚠️ NO pasa por `profileIdEfectivo`: ése guarda el perfil de la clave 1 en `zernio_workspace` y lo «suelta» si no es
 * de la cuenta que pregunta; preguntarle con la clave 2 le borraría el perfil a la 1.
 */
export async function perfilDeClaveExtra(ws: number, k: ClaveZernio): Promise<string | null> {
  const r = await zFetch<{ profiles?: ZernioProfile[] }>(k.apiKey, '/profiles');
  const { profileId } = profileDeLaCuenta(null, r.profiles ?? []);
  if (profileId) await upsertRouting(RUTEO_PERFIL, profileId, ws);
  return profileId;
}

/** Se olvida lo cacheado de un negocio (al guardar o quitar una clave en este proceso). */
export function olvidarClavesZernio(ws: number): void {
  extrasCache.delete(ws);
}

/** El ajuste del negocio de la PLATAFORMA que presta su cuenta de Zernio a los negocios sin key ('1'). Apagado por defecto. */
export const AJUSTE_CUENTA_PLATAFORMA = 'zernio.cuenta_de_la_plataforma';

/**
 * ¿La plataforma presta su cuenta de Zernio a los negocios sin key? «No pude leer» TIRA (como todo `cfg`): un negocio no pasa a
 * la cuenta de la casa, ni deja de pasar, por una base caída.
 */
export async function plataformaPrestaSuCuenta(): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value')
    .eq('workspace_id', await wsSuperAdmin()).eq('key', AJUSTE_CUENTA_PLATAFORMA).maybeSingle();
  if (error) throw new ZernioError(`app_settings (${AJUSTE_CUENTA_PLATAFORMA}): ${error.message}`, 0, null);
  return String((data as { value?: unknown } | null)?.value ?? '').trim() === '1';
}

/**
 * ¿Este workspace puede hablar con Zernio? `false` SÓLO cuando no pegó su key. «No pude leer» (la base caída, una fila que no se descifra) NO es
 * «no tiene»: TIRA, y quien llama decide (`estadoMedios` lo deja en «no sé» y no frena Publicar; la ruta contesta un error y no abre «pega tu key»
 * a un negocio que sí la tiene, que podía pisar una key buena). Hasta el 23/10/2026 esto tragaba todo y daba `false`.
 */
export async function zernioConfigurado(ws: number): Promise<boolean> {
  try { await cfg(ws); return true; } catch (e) {
    if (e instanceof ZernioError && e.status === 0 && e.message === 'Zernio no está configurado') return false;
    throw e;
  }
}

/**
 * ¿Este workspace habla con Zernio con su key PROPIA? La misma pregunta que `cfg`, con la lectura
 * ESTRICTA: la hace el webhook para decidir si un evento firmado con el secreto MAESTRO le toca
 * (`aceptaElWorkspace`, lib/zernio-firma.ts), y ahí «no pude leer» no puede contestarse «no tiene»:
 * tira, y el webhook lo manda por `responderFalloDeRuteo`.
 */
export async function usaCuentaPropia(ws: number): Promise<boolean> {
  if (ws === OWNER_WS) return false;
  return (await credWsEstricta('ZERNIO_API_KEY', ws)) != null;
}

export async function zFetch<T>(apiKey: string, path: string, init?: RequestInit & { headers?: Record<string, string> }, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const b: ZernioErrorBody = body != null && typeof body === 'object' ? (body as ZernioErrorBody) : { error: text.slice(0, 300) };
    // El TOPE (28/10/2026): cuánto esperar y cuánto queda, de las cabeceras (docs.zernio.com/rate-limits). Las lee `topeDe`.
    const restantes = Number(res.headers.get('x-ratelimit-remaining'));
    throw new ZernioError(`Zernio ${res.status}: ${b.error ?? text.slice(0, 200)}`, res.status, b, {
      esperaMs: esperaDeRetryAfter(res.headers.get('retry-after')),
      restantes: res.headers.get('x-ratelimit-remaining') != null && Number.isFinite(restantes) ? restantes : null,
    });
  }
  if (body == null) throw new ZernioError(`Zernio: respuesta no-JSON en ${path}`, res.status, { error: text.slice(0, 300) });
  // ⚠️ UN 200 NO ES «SALIÓ BIEN» (AGENTS.md): si el envelope trae `success: false`, es un fallo.
  if ((body as { success?: unknown }).success === false) {
    const b = body as ZernioErrorBody;
    throw new ZernioError(`Zernio: ${b.error ?? 'success: false'}`, res.status, b);
  }
  return body as T;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

type ZernioProfile = { _id: string; name: string; isDefault?: boolean };

/**
 * El profile de Zernio del workspace. Con la key de PLATAFORMA crea uno por workspace (`mako_ws_<ws>`,
 * lo que aísla a cada cliente dentro de la cuenta de la agencia); con key PROPIA, `null` = el Default
 * de SU cuenta. Reclama el ruteo del profile (`RUTEO_PERFIL`): el webhook rutea por él.
 *
 * Con key propia devuelve lo GUARDADO sin juzgarlo: si es de otra cuenta lo suelta `profileIdEfectivo`,
 * que es el que le pregunta a esa cuenta.
 */
export async function ensureProfile(ws: number): Promise<string | null> {
  const db = getSupabaseServer();
  const { data, error: errSel } = await db.from('zernio_workspace').select('profile_id').eq('workspace_id', ws).maybeSingle();
  if (errSel) throw new ZernioError(`zernio_workspace (select): ${errSel.message}`, 0, null);
  const guardado = data ? ((data.profile_id as string | null) ?? null) : null;
  const c = await cfg(ws);
  if (c.byok) {
    if (data) return guardado;
    const { error } = await db.from('zernio_workspace').upsert({ workspace_id: ws, profile_id: null }, { onConflict: 'workspace_id' });
    if (error) throw new ZernioError(`zernio_workspace (upsert byok): ${error.message}`, 0, null);
    return null;
  }
  // ⚠️ Con la key de la PLATAFORMA, un `null` guardado no es «el Default»: es lo que dejó una key propia
  // que ya no está. Devolverlo dejaba al negocio que borró su key sin profile para siempre («el
  // workspace no tiene profile»): la trampa de ws11 dada vuelta. Se acuña como la primera vez.
  if (guardado) return guardado;
  const nombre = `mako_ws_${ws}`;
  let profileId: string;
  try {
    const r = await zFetch<{ profile: ZernioProfile }>(c.apiKey, '/profiles', {
      method: 'POST', headers: { 'Idempotency-Key': nombre }, body: JSON.stringify({ name: nombre }),
    });
    profileId = r.profile._id;
  } catch (e) {
    const existente = e instanceof ZernioError && e.status === 409
      ? (e.body?.details as { existingProfileId?: string } | undefined)?.existingProfileId
      : undefined;
    if (!existente) throw e;
    profileId = existente;
  }
  const { error } = await db.from('zernio_workspace').upsert({ workspace_id: ws, profile_id: profileId }, { onConflict: 'workspace_id' });
  if (error) throw new ZernioError(`zernio_workspace (upsert): ${error.message}`, 0, null);
  await upsertRouting(RUTEO_PERFIL, profileId, ws);
  return profileId;
}

/**
 * El profile CONCRETO con el que se habla, y reclama su ruteo. Con la key de la plataforma, el
 * `mako_ws_<ws>`; con key propia, el guardado SI es de esa cuenta, y si no el Default de SU cuenta.
 */
export async function profileIdEfectivo(ws: number, c: ZernioCfg): Promise<string | null> {
  const guardado = await ensureProfile(ws);
  if (!c.byok) return guardado;
  // ⚠️ CON KEY PROPIA SE LE PREGUNTA A SU CUENTA SIEMPRE, aunque haya un guardado: el de ws11 era de la
  // cuenta de la AGENCIA (lib/zernio-profile.ts) y con él cada pedido iba a un profile ajeno. Un 401 o
  // un 402 de su cuenta tira como siempre.
  const r = await zFetch<{ profiles?: ZernioProfile[] }>(c.apiKey, '/profiles');
  const { profileId, soltarGuardado } = profileDeLaCuenta(guardado, r.profiles ?? []);
  if (soltarGuardado) {
    const { error } = await getSupabaseServer().from('zernio_workspace').update({ profile_id: null }).eq('workspace_id', ws);
    if (error) throw new ZernioError(`zernio_workspace (profile de otra cuenta): ${error.message}`, 0, null);
    console.warn(`[zernio] ws${ws}: el profile guardado ${guardado} no es de su cuenta de Zernio; queda ${profileId ?? 'ninguno'}`);
  }
  if (!profileId) return null;
  await upsertRouting(RUTEO_PERFIL, profileId, ws);
  return profileId;
}

// ── Cuentas ──────────────────────────────────────────────────────────────────

export type ZernioAccount = {
  _id: string;
  platform: string;
  username: string;
  displayName?: string;
  isActive?: boolean;
  profileId?: { _id: string } | string;
};

/**
 * Las cuentas conectadas del WORKSPACE (filtradas por su profile: con la key de plataforma, sin
 * filtro un cliente vería las de otro). Y RECLAMA el ruteo de cada una (`RUTEO_CUENTA`): un
 * `comment.received` trae SÓLO `account.accountId`, sin el profile (medido en la doc del webhook,
 * 09/10/2026), así que sin esta fila un comentario no tiene de quién ser.
 */
export async function cuentasConectadas(ws: number, plataforma?: 'instagram' | 'facebook'): Promise<ZernioAccount[]> {
  const c = await cfg(ws);
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId && !c.byok) throw new ZernioError('Zernio: el workspace no tiene profile', 0, null);
  const q = new URLSearchParams();
  if (profileId) q.set('profileId', profileId);
  if (plataforma) q.set('platform', plataforma);
  const r = await zFetch<{ accounts: ZernioAccount[] }>(c.apiKey, `/accounts?${q.toString()}`);
  const cuentas = (r.accounts ?? []).filter((a) => a.platform === 'instagram' || a.platform === 'facebook');
  // Y las de las claves EXTRA (29/10/2026): una red conectada con la clave 2 también tiene que poder recibir.
  // Sin caché: se llama al conectar (la clave recién pegada tiene que contar).
  for (const k of (await clavesZernio(ws, { fresca: true })).slice(1)) {
    try {
      const perfil = await perfilDeClaveExtra(ws, k);
      const qk = new URLSearchParams();
      if (perfil) qk.set('profileId', perfil);
      if (plataforma) qk.set('platform', plataforma);
      const rk = await zFetch<{ accounts: ZernioAccount[] }>(k.apiKey, `/accounts?${qk.toString()}`);
      cuentas.push(...(rk.accounts ?? []).filter((a) => a.platform === 'instagram' || a.platform === 'facebook'));
    } catch (e) {
      console.warn(`[zernio] ws${ws}: las cuentas de la clave ${k.slot} no se pudieron leer: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const a of cuentas) await upsertRouting(RUTEO_CUENTA, a._id, ws);
  return cuentas;
}

// ── El webhook ───────────────────────────────────────────────────────────────

type ZernioWebhook = { _id: string; url?: string; events?: string[]; isActive?: boolean };

/**
 * QUE ZERNIO LE AVISE A MAKO, con la cuenta del workspace. Idempotente: si ya hay un webhook a
 * nuestra URL, se le pone el secreto y los eventos; si no, se crea.
 *
 * ⚠️ SIN ESTO NO LLEGA NADA, Y NO DA ERROR. Medido el 09/10/2026 en producción: los dos workspaces
 * con Zernio (ws11 y ws13) tienen key PROPIA y `zernio_workspace.webhook_ok = false` desde agosto —
 * el webhook nunca les entregó un evento. Con key propia, el webhook vive en SU cuenta de Zernio y lo
 * tiene que registrar alguien: lo registra MaKo.
 *
 * ⚠️ Y EN ESA CUENTA NO VA EL SECRETO MAESTRO (`ZERNIO_WEBHOOK_SECRET`): lo que se le da a Zernio ahí lo
 * lee quien tenga la key de la cuenta (`GET /webhooks/settings` devuelve el `secret`, medido el
 * 10/10/2026), y con el maestro un cliente firmaba eventos de cualquier otro negocio. Va el secreto de
 * ESE negocio y la URL que lo nombra (`?w=<ws>`); el maestro, sólo a la cuenta de la plataforma.
 * El webhook verifica con el que nombra la URL (lib/zernio-firma.ts).
 */
export async function asegurarWebhook(ws: number): Promise<'creado' | 'actualizado' | 'sin_secreto'> {
  const maestro = await envCred('ZERNIO_WEBHOOK_SECRET');
  if (!maestro) return 'sin_secreto';
  const [principal, ...extra] = await clavesZernio(ws, { fresca: true });
  const r = await asegurarWebhookEn(ws, principal, maestro);
  // Las claves EXTRA (29/10/2026): cada una es otro equipo de Zernio, con su propio webhook. La URL y el secreto son del NEGOCIO
  // (`?w=<ws>`), así que la ruta del webhook verifica igual. Una que falle no tumba a la 1: se dice en el log.
  for (const k of extra) {
    await asegurarWebhookEn(ws, k, maestro).catch((e) => console.warn(`[zernio] ws${ws}: el webhook de la clave ${k.slot} no quedó: ${e instanceof Error ? e.message : String(e)}`));
  }
  return r;
}

async function asegurarWebhookEn(ws: number, c: ZernioCfg, maestro: string): Promise<'creado' | 'actualizado'> {
  const { ruta, secret } = webhookDeLaCuenta(maestro, ws, c.byok);
  const url = linkApp(ruta, null);
  const r = await zFetch<{ webhooks?: ZernioWebhook[] }>(c.apiKey, '/webhooks/settings');
  // Sólo la URL EXACTA. No se re-apunta uno a la URL pelada: si la key «propia» de un negocio fuera la
  // de la plataforma, ése es el webhook que comparten todos los negocios sin cuenta propia.
  const nuestro = (r.webhooks ?? []).find((w) => (w.url ?? '').trim() === url);
  const guardar = (events: string[]) => nuestro
    ? zFetch(c.apiKey, '/webhooks/settings', { method: 'PUT', body: JSON.stringify({ webhookId: nuestro._id, secret, events, isActive: true }) })
    : zFetch(c.apiKey, '/webhooks/settings', { method: 'POST', body: JSON.stringify({ name: 'MaKo', url, secret, events }) });
  // ⚠️ LOS LEADS VAN PRIMERO, Y SI ZERNIO LOS RECHAZA VAN LOS DE SIEMPRE SOLOS. Un negocio sin el complemento de anuncios no puede
  // suscribirse al evento: sin este reintento, ese rechazo le sacaría los mensajes y los comentarios, que hoy andan. Sólo un 4xx de
  // los que dicen «este pedido no» (400, 403, 422) reintenta; una key mala (401), un pago (402) o una caída suben tal cual. Si el
  // reintento también falla, sube SU error: el de los eventos de siempre es el que importa.
  try {
    await guardar([...EVENTOS_ESCUCHADOS]);
  } catch (e) {
    if (!(e instanceof ZernioError) || ![400, 403, 422].includes(e.status)) throw e;
    console.warn(`[zernio] ws${ws}: Zernio no acepta suscribir ${EVENTO_LEADS} (${e.status} ${e.code ?? '—'}): el webhook queda sin leads`);
    await guardar([...EVENTOS_WEBHOOK]);
  }
  return nuestro ? 'actualizado' : 'creado';
}

/**
 * ¿El webhook de ESTE negocio escucha los leads? `null` = no hay webhook registrado (o falta el secreto maestro para armar su URL).
 *
 * Mide lo REGISTRADO en Zernio, no si llega alguno: sin el complemento de anuncios, o con una página conectada antes de pedir
 * `leads_retrieval`, el evento puede estar suscripto y no llegar nunca. Existe porque `asegurarWebhook` deja los leads afuera SIN
 * error cuando Zernio los rechaza, y alguien tiene que poder decirle al negocio por qué no le entran.
 */
export async function leadsEnElWebhook(ws: number, cuentaAnuncios?: string | null): Promise<boolean | null> {
  const w = await webhookDeLeads(ws, cuentaAnuncios);
  return w.hayMaestro ? escuchaComoBooleano(w.escucha) : null;
}

/**
 * El webhook de MaKo en la cuenta de Zernio de ESA conexión de anuncios (`escuchaDelWebhook`, lib/zernio-leads-estado.ts). Sin el
 * secreto maestro no hay URL que buscar: `hayMaestro: false` (y no se afirma nada de él).
 */
export async function webhookDeLeads(ws: number, cuentaAnuncios?: string | null): Promise<{ hayMaestro: boolean; escucha: EscuchaWebhook }> {
  const maestro = await envCred('ZERNIO_WEBHOOK_SECRET');
  if (!maestro) return { hayMaestro: false, escucha: 'no-esta' };
  // Con varias claves (29/10/2026), la de la conexión de anuncios: sus leads llegan por el webhook de ESA cuenta de Zernio.
  const c = cuentaAnuncios ? await cfgDeCuenta(ws, cuentaAnuncios) : await cfg(ws);
  const { ruta } = webhookDeLaCuenta(maestro, ws, c.byok);
  const r = await zFetch<{ webhooks?: ZernioWebhook[] }>(c.apiKey, '/webhooks/settings');
  return { hayMaestro: true, escucha: escuchaDelWebhook(r.webhooks ?? [], linkApp(ruta, null), EVENTO_LEADS) };
}

/**
 * ¿La API de Zernio le entrega a esta conexión los leads de sus formularios? El MISMO pedido que el barrido de cada 30 minutos
 * (lib/zernio-leads-barrido.ts), con uno solo y desde ahora: no trae leads, sólo contesta si puede. 403 = falta el complemento
 * de anuncios. Cualquier otra falla es «no se sabe».
 */
export async function leadsPorLaApi(ws: number, cuentaAnuncios: string): Promise<LecturaLeads> {
  try {
    const k = await cfgDeCuenta(ws, cuentaAnuncios);
    const q = new URLSearchParams({ platform: 'meta', since: String(Math.floor(Date.now() / 1000)), limit: '1', accountIds: cuentaAnuncios });
    await zFetch(k.apiKey, `/ads/leads?${q.toString()}`);
    return 'anda';
  } catch (e) {
    return e instanceof ZernioError && e.status === 403 ? 'sin-complemento' : 'no-se';
  }
}

/**
 * Lo que dice el modal «Anuncios de Meta» de los leads de los formularios (`avisoDeLeads`). Pregunta a la API sólo si el webhook no
 * los escucha: con el webhook bien, un pedido de menos a Zernio (su tope por minuto es el ticket #34).
 */
export async function avisoDeLeadsZernio(ws: number, cuentaAnuncios: string): Promise<AvisoLeads> {
  const w = await webhookDeLeads(ws, cuentaAnuncios).catch(() => null);
  if (w?.hayMaestro && w.escucha === 'escucha') return 'si';
  const lectura = await leadsPorLaApi(ws, cuentaAnuncios);
  return avisoDeLeads({ hayMaestro: w?.hayMaestro ?? false, webhook: w?.escucha ?? null, lectura });
}

// ── Mandar ───────────────────────────────────────────────────────────────────

export type EnviarDmInput = {
  /** La cuenta conectada que manda (requerida por Zernio). */
  accountId: string;
  texto?: string;
  /** URL pública HTTPS del adjunto (sin redirect: Instagram la rechaza). */
  adjuntoUrl?: string;
  adjuntoTipo?: 'image' | 'video' | 'audio' | 'file';
  /**
   * Los botones de la burbuja (24/10/2026, lib/botones-social.ts): Meta los dibuja debajo del texto, en la MISMA burbuja
   * (su plantilla de botones), así que van sólo con `texto` y el texto hasta 640. Sin adjunto: un adjunto no lleva.
   */
  botones?: readonly BotonZernio[];
  /**
   * Mismo key + mismo body ⇒ Zernio devuelve la respuesta original en vez de mandar dos veces; key en
   * vuelo ⇒ 409. Se guarda 24 h, y SÓLO si la respuesta fue 2xx (un fallo libera el key).
   */
  idempotencyKey?: string;
};

/**
 * Un DM en una conversación existente (POST /v1/inbox/conversations/{id}/messages).
 *
 * ⚠️ SIN `messageTag` A PROPÓSITO: fuera de las 24 h Instagram acepta sólo HUMAN_AGENT, y por política
 * de Meta esa etiqueta es para una PERSONA que contesta, no para una automatización. Fuera de la
 * ventana, Zernio contesta 400 `PLATFORM_LIMITATION` y lib/canal-zernio.ts cierra el hilo.
 */
export async function enviarDm(ws: number, conversationId: string, input: EnviarDmInput): Promise<{ messageId: string | null }> {
  // La clave dueña de la cuenta (varias claves, 29/10/2026); con una sola, la de siempre.
  const c = await cfgDeCuenta(ws, input.accountId);
  if (!input.texto && !input.adjuntoUrl) throw new ZernioError('enviarDm: hace falta texto o adjunto', 0, null);
  const body: Record<string, unknown> = { accountId: input.accountId };
  if (input.texto) body.message = input.texto;
  if (input.adjuntoUrl) {
    body.attachmentUrl = input.adjuntoUrl;
    if (input.adjuntoTipo) body.attachmentType = input.adjuntoTipo;
  }
  if (input.botones?.length && input.texto && !input.adjuntoUrl) body.buttons = input.botones;
  const r = await zFetch<{ data?: { messageId?: string }; messageId?: string }>(c.apiKey, `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 255) } : {},
    body: JSON.stringify(body),
  });
  return { messageId: r.data?.messageId ?? r.messageId ?? null };
}

/**
 * LA RESPUESTA PRIVADA a un comentario (POST /v1/inbox/comments/{postId}/{commentId}/private-reply):
 * UNA por comentario y dentro de los 7 días. Sin adjuntos: desde agosto de 2026 Instagram rechaza
 * botones y adjuntos a quien no sigue la cuenta y el intento GASTA la única respuesta (doc de Zernio,
 * `details.privateReplyConsumed`). No se reintenta nunca.
 * ⚠️ CON BOTONES SÍ (24/10/2026, lib/botones-social.ts): el rechazo es DESPAREJO («la mayoría de las cuentas no lo
 * tienen»), y el primer DM de ManyChat es justo un botón. Quien llama decide si los manda (`cuentaRechazaBotones`).
 */
export async function responderComentario(ws: number, input: { accountId: string; postId: string; commentId: string; texto: string; idempotencyKey?: string; botones?: readonly BotonZernio[] }): Promise<{ messageId: string | null }> {
  const c = await cfgDeCuenta(ws, input.accountId);
  const r = await zFetch<{ messageId?: string }>(c.apiKey, `/inbox/comments/${encodeURIComponent(input.postId)}/${encodeURIComponent(input.commentId)}/private-reply`, {
    method: 'POST',
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 255) } : {},
    body: JSON.stringify({ accountId: input.accountId, message: input.texto, ...(input.botones?.length ? { buttons: input.botones } : {}) }),
  });
  return { messageId: r.messageId ?? null };
}

/**
 * LA RESPUESTA PÚBLICA a un comentario (ticket #17 de Leandro, 28/10/2026): POST /v1/inbox/comments/{postId} con
 * `commentId`, medido en la OpenAPI de Zernio v1.394.0 (zernio.com/openapi.json, 28/10/2026). Sale DEBAJO del comentario,
 * a la vista de todos; no gasta la respuesta privada ni mira la ventana de 24 h. Sólo texto (`attachmentUrl` es sólo de
 * Facebook). 403 = falta el add-on Inbox o la cuenta no puede comentar ese post; 422 = Meta lo rechazó (post cerrado,
 * comentario borrado) o la clave se reusó con otro texto. Las dos son terminales (`esRechazoDelComentario`).
 */
export async function responderComentarioEnPublico(ws: number, input: { accountId: string; postId: string; commentId: string; texto: string; idempotencyKey?: string }): Promise<{ commentId: string | null }> {
  const c = await cfgDeCuenta(ws, input.accountId);
  const r = await zFetch<{ data?: { commentId?: string }; commentId?: string }>(c.apiKey, `/inbox/comments/${encodeURIComponent(input.postId)}`, {
    method: 'POST',
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 255) } : {},
    body: JSON.stringify({ accountId: input.accountId, message: input.texto, commentId: input.commentId }),
  });
  return { commentId: r.data?.commentId ?? r.commentId ?? null };
}

/** ¿Zernio dijo que esa respuesta pública no va a salir nunca? (403: sin add-on o sin permiso; 422: Meta la rechazó.) */
export const esRechazoDelComentario = (e: unknown): boolean => e instanceof ZernioError && (e.status === 403 || e.status === 422);

// ── «¿Te sigue?» (duodécima tanda) ─────────────────────────────────────────────

/** Cuánto se espera UN «¿te sigue?»: corre adentro del motor, por lead que escribió. */
const TIMEOUT_SEGUIMIENTO_MS = 8_000;

/**
 * LAS ÚLTIMAS PUBLICACIONES DE UNA CUENTA (ticket #25: elegir la publicación o el Reel del CRON de comentario). GET
 * /v1/accounts/{id}/posts, con la clave DUEÑA de la cuenta (`cfgDeCuenta`): Zernio las lee en vivo de la plataforma, las 25
 * más nuevas, también las que no se publicaron por Zernio, con el MISMO id que trae el comentario (`platformPostId`). Tira
 * lo que tire Zernio: quien llama dice «no pude leer tus publicaciones».
 */
export async function publicacionesDeLaCuenta(ws: number, accountId: string): Promise<PublicacionDeLaCuenta[]> {
  const k = await cfgDeCuenta(ws, accountId);
  const r = await zFetch<unknown>(k.apiKey, `/accounts/${encodeURIComponent(accountId)}/posts`, undefined, TIMEOUT_SEGUIMIENTO_MS);
  return publicacionesDeZernio(r);
}

/**
 * La key para LEER el seguimiento: la propia del negocio, como `cfg` (lectura ESTRICTA: «no pude leer las
 * credenciales» tira, nunca se contesta «no tiene Zernio»), y sin respaldo de la plataforma.
 * null = el negocio no tiene Zernio, y nadie se sabe.
 */
async function keyDeSeguimiento(ws: number): Promise<string | null> {
  return credDelClienteEstricta('ZERNIO_API_KEY', ws);
}

/**
 * Un GET /accounts/{id}/follow-status/{igsid}. Con la caché de Zernio (`refresh=false`, que guarda la respuesta «briefly»
 * por cuenta y persona), salvo `fresco`: quien ACABA de decir que siguió la cuenta («Ya te sigo», ticket #29 de Leandro).
 * La doc de Zernio: «Pass refresh=true right after asking someone to follow, so a follow from a moment ago is visible».
 */
async function consultarSeguimiento(apiKey: string, accountId: string, igsid: string, fresco = false): Promise<boolean | null> {
  const r = await zFetch<unknown>(apiKey, `/accounts/${encodeURIComponent(accountId)}/follow-status/${encodeURIComponent(igsid)}?refresh=${fresco ? 'true' : 'false'}`, undefined, TIMEOUT_SEGUIMIENTO_MS);
  return seguimientoDe(r);
}

/**
 * «¿ESTA PERSONA SIGUE A LA CUENTA DE INSTAGRAM?» (GET /v1/accounts/{accountId}/follow-status/{igsid},
 * docs.zernio.com/accounts/get-instagram-follow-status). true / false sólo cuando Meta lo confirma;
 * `null` = no se sabe: sin Zernio, con cualquier `unavailableReason`, o con un 4xx definitivo de su
 * cuenta (401, 402, 404: `seguimientoNoSe`). Lo pasajero (red, tiempo, 429, 5xx) TIRA.
 *
 * ⚠️ Meta contesta SÓLO por quien ya le escribió a la cuenta por DM: preguntar por quien sólo comentó
 * es gastar un pedido en un «consent_required». Quien llama filtra antes (`pedidoDeSeguimiento`).
 */
export async function estadoDeSeguimiento(ws: number, accountId: string, igsid: string): Promise<boolean | null> {
  return (await estadosDeSeguimiento(ws, [{ leadId: 0, accountId, igsid }])).get(0) ?? null;
}

/**
 * «¿Te sigue?» para un LOTE, de a `CONCURRENCIA_SEGUIMIENTO` a la vez y con la key leída UNA vez. Un 401
 * o un 402 es de la CUENTA (key revocada, plan vencido): los que faltan no se consultan y dan «no sé».
 */
export async function estadosDeSeguimiento(
  ws: number,
  pedidos: ReadonlyArray<{ leadId: number; accountId: string; igsid: string }>,
  o: { fresco?: boolean } = {},
): Promise<Map<number, boolean | null>> {
  const out = new Map<number, boolean | null>();
  if (!pedidos.length) return out;
  const apiKey = await keyDeSeguimiento(ws);
  if (!apiKey) return out;
  // Con varias claves (29/10/2026), cada cuenta se pregunta con la suya; una clave caída (401/402) apaga sólo las suyas.
  const varias = (await clavesZernio(ws).catch(() => [])).length > 1;
  const caidas = new Set<string>();
  await conTope(pedidos, CONCURRENCIA_SEGUIMIENTO, async (p) => {
    const key = varias ? (await cfgDeCuenta(ws, p.accountId)).apiKey : apiKey;
    if (caidas.has(key)) { out.set(p.leadId, null); return; }
    try {
      out.set(p.leadId, await consultarSeguimiento(key, p.accountId, p.igsid, o.fresco === true));
    } catch (e) {
      if (!(e instanceof ZernioError) || !seguimientoNoSe(e.status)) throw e;
      if (e.status === 401 || e.status === 402) caidas.add(key);
      out.set(p.leadId, null);
    }
  });
  return out;
}

/**
 * ¿Este error de Zernio dice que META NO DEJA escribirle ahora? Es la respuesta que manda sobre el
 * reloj de acá (la ventana se cerró, la respuesta privada ya se gastó, otra app atiende la charla):
 * reintentar no lo arregla.
 */
/**
 * OTRA APP ES LA DUEÑA DEL HILO AHORA MISMO (Meta subcode 2534037, `not_thread_owner`).
 *
 * ⚠️ **No es permanente, y tratarlo como permanente costó 17 leads** (tickets #63 y #64 de Leandro,
 * 8/11/2026). El dueño del hilo es una CONFIGURACIÓN de la Página —el receptor primario del handover
 * de Meta—: cambia en cuanto el negocio saca la app rival, y de hecho cambió. Pero para entonces el
 * motor ya había cancelado las inscripciones, y a 17 de los 19 leads se les había pasado la ventana
 * de 24 h, así que quedaron inalcanzables para siempre.
 *
 * Con esto fuera de `esLimiteDeMeta`, el envío vuelve a intentarse: si el negocio arregla el ajuste
 * dentro de la ventana, el lead recibe lo suyo solo y nadie se entera de que falló.
 */
export function esDeOtraApp(e: unknown): boolean {
  return e instanceof ZernioError && e.code === 'not_thread_owner';
}

export function esLimiteDeMeta(e: unknown): boolean {
  if (!(e instanceof ZernioError)) return false;
  // ⚠️ UN TOPE NO ES «META NO DEJA» (28/10/2026): pasa solo. Sin esto, un «muchos pedidos» de Meta (un 400 `platform_error`)
  // caía en la última regla y CERRABA el hilo: el mensaje se perdía. Lo decide `topeDe`, y quien llama reintenta.
  if (topeDe(e)) return false;
  // ⚠️ NI «OTRA APP ES LA DUEÑA» (8/11/2026): se destraba solo cuando el negocio cambia el ajuste. Misma forma que el
  // tope, y el mismo daño si se cierra: el mensaje se pierde, y acá además se pierde al lead con la ventana de 24 h.
  if (esDeOtraApp(e)) return false;
  const d = e.body?.details as { privateReplyConsumed?: unknown } | undefined;
  return e.code === 'PLATFORM_LIMITATION' || e.code === 'not_thread_owner' || d?.privateReplyConsumed === true
    || (e.status === 400 && e.type === 'platform_error');
}
