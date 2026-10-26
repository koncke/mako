// =============================================================================
// meta-via — ¿por dónde habla MaKo con Meta para ESTE negocio? Zernio primero, el token de respaldo (25/10/2026)
// =============================================================================
// Martín, 25/10: «implementa zernio y depreca la conexión con API de Meta». Desde ese día el camino principal de Meta
// es la conexión de anuncios de Zernio de cada negocio (`metaads`, la ventana «Conectar con Facebook»), con SU clave de
// Zernio. El token de Meta que se pegaba queda de RESPALDO, escondido, para los negocios que hoy lo usan: tienen que
// seguir andando (regla `cambios-impactan-clientes`).
//
// Lo que decide la vía es puro (`viaDeMeta`, lib/zernio-meta-cuerpo.ts, con test). Acá se juntan los datos y se habla con
// Zernio: las lecturas que reemplazan a la Graph API (insights, presupuestos en vivo) devuelven la MISMA forma que Meta,
// así quien las usa no cambia su parser.
//
// Prendido para todos el 25/10/2026 (`ZERNIO_META_PROBADO`), con la prueba pasada primero en el negocio de la plataforma (el de
// MaKo): ningún cliente pasó primero. Apagarlo vuelve a dejar a Zernio sólo en el negocio de la plataforma.
//
// TENANT-SAFETY: `ws` explícito o el del contexto (`runWithWorkspace` en los crons). La clave de Zernio es la del negocio
// (`claveZernioAnuncios`: la de la plataforma sólo para el negocio de la plataforma).

import 'server-only';
import { credWs } from './credenciales';
import { getWorkspaceActual, wsSuperAdmin } from './workspace';
import { claveZernioAnuncios } from './zernio-ads';
import { zFetch } from './zernio';
import { normalizarCuentaMeta } from './meta-cuenta-id';
import { aUnidadMeta } from './presupuesto-cambio';
import {
  CORTE_TOKEN_META, ENV_CUENTA_ZERNIO, ZERNIO_META_PROBADO, avisoTokenVencido, cuentaCrudaDesdeZernio, cuentasDeZernio, hoyEnArgentina,
  paginaDeConjuntos, paginaDeInsights, queryInsightsZernio, tokenMetaVencido, viaDeMeta,
  type ConjuntoVivo,
} from './zernio-meta-cuerpo';
import type { MetaInsightRaw } from './types';

/** ¿Zernio está activo para este negocio? Prendido para todos con la prueba pasada; antes, sólo en el de la plataforma. */
export async function zernioMetaActivo(ws: number): Promise<boolean> {
  if (ZERNIO_META_PROBADO) return true;
  return ws === (await wsSuperAdmin().catch(() => null));
}

export type CanalMeta =
  /** `respaldo`: el token de Meta que el negocio conserva de antes, para LEER por ahí si Zernio falla. Nunca para escribir. */
  | { via: 'zernio'; ws: number; clave: string; accountId: string; adAccountId: string; respaldo: string | null }
  | { via: 'token'; ws: number; token: string; adAccountId: string }
  | { via: 'ninguna'; ws: number | null };

/**
 * El canal de Meta del negocio. NUNCA tira por «no tiene»: devuelve `ninguna` y quien llama decide qué decir.
 * ⚠️ `credWs` lee una base caída como «no hay»: un negocio sólo por Zernio queda `ninguna` en ese momento (la lectura tira
 * después, sin borrar nada; un evento de CAPI sale `sin_token`, como ya pasaba con el token). No es «no tiene Meta».
 */
export async function canalMeta(wsArg?: number | null): Promise<CanalMeta> {
  const ws = wsArg ?? (await getWorkspaceActual());
  if (ws == null) return { via: 'ninguna', ws: null };
  const activo = await zernioMetaActivo(ws);
  // Apagado (todo cliente antes de la prueba) no se lee la conexión de Zernio: el camino de siempre no paga lecturas de más.
  const [cuentaZernio, act, token] = await Promise.all([
    activo ? credWs(ENV_CUENTA_ZERNIO, ws) : Promise.resolve(null),
    credWs('META_AD_ACCOUNT_ID', ws),
    credWs('META_ACCESS_TOKEN', ws),
  ]);
  // La clave se lee sólo si hace falta (es una lectura descifrada más).
  const clave = activo && cuentaZernio && act ? await claveZernioAnuncios(ws) : null;
  const via = viaDeMeta({ activo, cuentaZernio, adAccountId: act, claveZernio: !!clave, token });
  if (via === 'zernio') {
    const respaldo = token && !token.startsWith('PENDING') ? token : null;
    return { via, ws, clave: clave!, accountId: cuentaZernio!.trim(), adAccountId: normalizarCuentaMeta(act), respaldo };
  }
  if (via === 'token') return { via, ws, token: token!, adAccountId: normalizarCuentaMeta(act) };
  return { via: 'ninguna', ws };
}

// ── Las lecturas por Zernio, con la forma de Meta ────────────────────────────

/** Tope de páginas de una lectura (como `MAX_PAGES` del cron de Meta): una cuenta que no termina nunca es un error. */
const MAX_PAGINAS = 50;

/**
 * Insights de un nodo de Meta por Zernio (`GET /v1/ads/insights`, el paso directo): las filas de Meta tal cual, todas las
 * páginas. Tira `ZernioError` (con el fallo de Meta adentro) o un Error si la respuesta no trae lista.
 */
export async function insightsPorZernio(
  c: Extract<CanalMeta, { via: 'zernio' }>,
  p: Omit<Parameters<typeof queryInsightsZernio>[0], 'accountId' | 'after' | 'objectId'> & { objectId?: string },
): Promise<MetaInsightRaw[]> {
  const out: MetaInsightRaw[] = [];
  let after: string | null = null;
  for (let pag = 0; pag < MAX_PAGINAS; pag++) {
    const q = queryInsightsZernio({ ...p, accountId: c.accountId, objectId: p.objectId ?? c.adAccountId, after });
    // 60 s: una cuenta grande a nivel anuncio tarda más que los 20 s del canal de mensajes.
    const body = await zFetch<unknown>(c.clave, `/ads/insights?${q}`, undefined, 60_000);
    const pagina = paginaDeInsights(body);
    if (!pagina) throw new Error('Zernio: la lectura de insights no trajo la lista de filas (`data`)');
    out.push(...pagina.filas);
    if (!pagina.after) return out;
    after = pagina.after;
  }
  throw new Error(`Zernio: los insights pasan de ${MAX_PAGINAS} páginas`);
}

/** Los conjuntos de la cuenta EN VIVO por Zernio, con su presupuesto diario en UNIDADES de la moneda de la cuenta. */
export async function conjuntosVivosPorZernio(c: Extract<CanalMeta, { via: 'zernio' }>): Promise<{ filas: ConjuntoVivo[]; moneda: string | null }> {
  const filas: ConjuntoVivo[] = [];
  let moneda: string | null = null;
  let after: string | null = null;
  for (let pag = 0; pag < MAX_PAGINAS; pag++) {
    const q = new URLSearchParams({ accountId: c.accountId, adAccountId: c.adAccountId, level: 'adSet', limit: '500' });
    if (after) q.set('after', after);
    const body = await zFetch<unknown>(c.clave, `/ads/accounts/live?${q.toString()}`, undefined, 60_000);
    const pagina = paginaDeConjuntos(body);
    if (!pagina) throw new Error('Zernio: la lectura de conjuntos no trajo la lista (`adSets`)');
    filas.push(...pagina.filas);
    moneda = moneda ?? pagina.moneda;
    if (!pagina.after) return { filas, moneda };
    after = pagina.after;
  }
  throw new Error(`Zernio: los conjuntos pasan de ${MAX_PAGINAS} páginas`);
}

/** Lo que el cron guarda del creativo de cada anuncio: la imagen y el enlace al post (Facebook o Instagram). */
export type CreativoZernio = { imagen: string | null; permalink: string | null };

/**
 * El creativo de cada anuncio que entregó en el día, por el árbol de Zernio (`GET /v1/ads/tree` con `hasDelivery`): la
 * imagen y el enlace, con la MISMA regla que la lectura por el token (`fetchAdCreatives`): el permalink de Instagram
 * primero, y si no el post de Facebook (`effectiveObjectStoryId`).
 */
export async function creativosPorZernio(c: Extract<CanalMeta, { via: 'zernio' }>, fecha: string): Promise<Map<string, CreativoZernio>> {
  type Ad = { platformAdId?: string; creative?: { thumbnailUrl?: string | null; imageUrl?: string | null; effectiveObjectStoryId?: string | null; instagramPermalinkUrl?: string | null } | null };
  type Nodo = { ads?: Ad[]; adSets?: Nodo[] };
  const out = new Map<string, CreativoZernio>();
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({
      accountId: c.accountId, adAccountId: c.adAccountId, platform: 'facebook', source: 'all',
      fromDate: fecha, toDate: fecha, hasDelivery: 'true', limit: '100', page: String(page),
    });
    const r = await zFetch<{ campaigns?: Nodo[]; pagination?: { page?: number; pages?: number } }>(c.clave, `/ads/tree?${q.toString()}`, undefined, 60_000);
    const pila: Nodo[] = [...(r.campaigns ?? [])];
    while (pila.length) {
      const n = pila.pop()!;
      for (const a of n.ads ?? []) {
        if (!a.platformAdId) continue;
        const cr = a.creative ?? {};
        // La imagen entera primero: la miniatura de Meta es de ~64 px (lo mismo que `bestImage` con el token).
        const imagen = cr.imageUrl || cr.thumbnailUrl || null;
        const permalink = cr.instagramPermalinkUrl || (cr.effectiveObjectStoryId ? `https://www.facebook.com/${cr.effectiveObjectStoryId}` : null);
        out.set(a.platformAdId, { imagen, permalink });
      }
      pila.push(...(n.adSets ?? []));
    }
    const pages = r.pagination?.pages;
    if (!(typeof pages === 'number' && page < pages)) break;
  }
  return out;
}

/**
 * La cuenta publicitaria con la forma de `GET /{act}` de Meta (estado, motivo, saldo, gastado, tope, medio de pago, zona),
 * leída por Zernio: la lista de cuentas de la conexión y sus finanzas. Para la salud de la cuenta (lib/meta-health.ts).
 * Unas finanzas que no se pueden leer (la conexión sin permiso de facturación) no tumban el estado: salen sin montos.
 */
export async function cuentaCrudaPorZernio(c: Extract<CanalMeta, { via: 'zernio' }>): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ accountId: c.accountId });
  const [lista, finanzas] = await Promise.all([
    zFetch<unknown>(c.clave, `/ads/accounts?${q.toString()}`, undefined, 30_000),
    zFetch<Record<string, unknown>>(c.clave, `/ads/accounts/finance?${new URLSearchParams({ accountId: c.accountId, adAccountId: c.adAccountId }).toString()}`, undefined, 30_000)
      .catch((e) => { console.warn(`[meta-via] finanzas por Zernio (ws${c.ws}): ${e instanceof Error ? e.message : String(e)}`); return null; }),
  ]);
  const cuentas = cuentasDeZernio(lista);
  if (!cuentas) throw new Error('Zernio: la lista de cuentas publicitarias no trajo `accounts`');
  const cuenta = cuentas.find((x) => x.id === c.adAccountId);
  if (!cuenta) throw new Error(`Zernio: la conexión no ve la cuenta publicitaria ${c.adAccountId}`);
  return cuentaCrudaDesdeZernio(cuenta, finanzas, (monto, moneda) => aUnidadMeta(monto, moneda));
}

/**
 * Con qué lee el creativo de un anuncio quien lo transcribe (lib/transcribe.ts): la clave de Zernio si el negocio conectó por
 * ahí (y el token de antes como respaldo), o el token. null = Meta no está conectado. Se resuelve en el server, nunca cae al
 * token del entorno para un negocio que conectó por Zernio.
 */
export async function accesoDeMeta(ws?: number | null): Promise<{ metaToken?: string; zernioClave?: string } | null> {
  const c = await canalMeta(ws);
  if (c.via === 'zernio') return { zernioClave: c.clave, ...(c.respaldo ? { metaToken: c.respaldo } : {}) };
  if (c.via === 'token') return { metaToken: c.token };
  return null;
}

/**
 * Pasado el corte (`CORTE_TOKEN_META`), una escritura con el token de Meta de un negocio que no conectó Zernio se frena: devuelve
 * el mensaje para la persona, o null si puede seguir. La llaman las puertas de escritura con el token (`escribirEnMeta`,
 * lib/meta-write.ts; `graphPost` y las subidas, lib/meta-ads-create.ts). Leer no pasa por acá.
 */
export async function frenoDelTokenMeta(ws: number): Promise<string | null> {
  if (!CORTE_TOKEN_META) return null;
  const c = await canalMeta(ws);
  return tokenMetaVencido({ corte: CORTE_TOKEN_META, hoy: hoyEnArgentina(), viaZernio: c.via === 'zernio' }) ? avisoTokenVencido(CORTE_TOKEN_META) : null;
}
