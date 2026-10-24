// =============================================================================
// Publicar y editar anuncios por Zernio, con la cuenta de Zernio DEL NEGOCIO (23/10/2026)
// =============================================================================
// El porqué y el contrato están en lib/zernio-ads-cuerpo.ts (la parte pura). Acá, lo que habla con
// Zernio: qué clave se usa, cuál es la conexión de anuncios del negocio, crear el anuncio dentro de un
// conjunto y cambiarle los textos a uno vivo.
//
// LA CLAVE ES DEL NEGOCIO (BYOK), SIEMPRE. Martín, 23/10: «que cada usuario traiga su API de Zernio».
// Para un cliente se lee con `credDelCliente`: nunca cae a la de la plataforma (la que usa el canal de
// Instagram, lib/zernio.ts, sí cae; acá NO, porque un anuncio es plata y cuentas del cliente). La única
// excepción es el negocio de la PLATAFORMA (`wsSuperAdmin`, el de MaKo), donde la clave de la plataforma
// ES la suya: ahí corre la prueba que decide (scripts/prueba-zernio-anuncio.mts).
//
// Nunca tira por «no hay Zernio»: devuelve null, y quien llama publica por Meta como siempre.

import 'server-only';
import { credDelCliente, envCred } from './credenciales';
import { wsSuperAdmin } from './workspace';
import { ZernioError, type ZernioErrorBody } from './zernio';
import { normalizarCuentaMeta } from './meta-cuenta-id';
import { cuerpoCambiarTextos, idsDelAnuncioCreado, subcodeDeZernio, type ConexionAnunciosZernio } from './zernio-ads-cuerpo';

const ZERNIO_BASE = 'https://zernio.com/api/v1';

/** La clave de Zernio con la que este negocio publica, o null. Nunca la de la plataforma para un cliente. */
export async function claveZernioAnuncios(ws: number): Promise<string | null> {
  if (ws === (await wsSuperAdmin().catch(() => null))) return envCred('ZERNIO_API_KEY');
  return credDelCliente('ZERNIO_API_KEY', ws);
}

async function zAds<T>(clave: string, path: string, init?: RequestInit & { headers?: Record<string, string> }): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    // Crear un anuncio sube media y espera a Meta: más que los 20 s del canal.
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const b: ZernioErrorBody = body != null && typeof body === 'object' ? (body as ZernioErrorBody) : { error: text.slice(0, 300) };
    throw new ZernioError(`Zernio ${res.status}: ${b.error ?? text.slice(0, 200)}`, res.status, b);
  }
  if (body == null) throw new ZernioError(`Zernio: respuesta no-JSON en ${path}`, res.status, { error: text.slice(0, 300) });
  // Un 200 no es «salió bien» (AGENTS.md): `success: false` es un fallo.
  if ((body as { success?: unknown }).success === false) {
    const b = body as ZernioErrorBody;
    throw new ZernioError(`Zernio: ${b.error ?? 'success: false'}`, res.status, b);
  }
  return body as T;
}

type CuentaZernio = { _id: string; platform: string };

/**
 * La conexión de anuncios del negocio: una cuenta `metaads` de SU Zernio que administra SU cuenta
 * publicitaria (la de `META_AD_ACCOUNT_ID`, o la que se pase). null si no hay clave, no hay conexión, o
 * ninguna conexión ve esa cuenta: entonces se publica por Meta como siempre.
 *
 * ⚠️ Se pregunta por la cuenta publicitaria EXACTA (`GET /v1/ads/accounts?adAccountId=`): con la clave
 * de la plataforma la lista de conexiones no es sólo de este negocio, y publicar en otra cuenta sería
 * el peor error posible acá.
 */
export async function conexionAnunciosZernio(ws: number, adAccountId: string | null): Promise<ConexionAnunciosZernio | null> {
  const clave = await claveZernioAnuncios(ws);
  const act = adAccountId ? normalizarCuentaMeta(adAccountId) : null;
  if (!clave || !act) return null;
  const r = await zAds<{ accounts?: CuentaZernio[] }>(clave, '/accounts?platform=metaads');
  for (const a of (r.accounts ?? []).filter((x) => x.platform === 'metaads')) {
    const q = new URLSearchParams({ accountId: a._id, adAccountId: act });
    const l = await zAds<{ accounts?: Array<{ id?: string }> }>(clave, `/ads/accounts?${q.toString()}`).catch(() => null);
    if (l?.accounts?.some((x) => x.id === act)) return { accountId: a._id, adAccountId: act };
  }
  return null;
}

/**
 * El link para conectar la cuenta publicitaria a la Zernio del negocio (inicio de sesión para empresas
 * de Meta, `loginMode=business`: crea una conexión `metaads` aparte). La ventana de Facebook dice
 * «Zernio», no MaKo. El profile es el Default de SU cuenta de Zernio.
 */
export async function urlConectarAnunciosZernio(ws: number, redirectUrl: string): Promise<string> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const p = await zAds<{ profiles?: Array<{ _id: string; isDefault?: boolean }> }>(clave, '/profiles');
  const perfil = (p.profiles ?? []).find((x) => x.isDefault) ?? p.profiles?.[0];
  if (!perfil) throw new ZernioError('Zernio: la cuenta no tiene ningún profile para conectar', 0, null);
  const q = new URLSearchParams({ profileId: perfil._id, loginMode: 'business', redirect_url: redirectUrl });
  const r = await zAds<{ authUrl: string }>(clave, `/connect/facebook/ads?${q.toString()}`);
  return r.authUrl;
}

/** Crea UN anuncio (en pausa) con el cuerpo de `cuerpoAnuncioEnConjunto`. Devuelve el id de Meta. */
export async function crearAnuncioPorZernio(ws: number, cuerpo: Record<string, unknown>, idempotencia: string): Promise<{ adId: string; zernioId: string | null }> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  const r = await zAds<unknown>(clave, '/ads/create', {
    method: 'POST',
    // Un reintento después de un corte no publica dos veces (Zernio acepta Idempotency-Key, tope 255).
    headers: { 'Idempotency-Key': idempotencia.slice(0, 255) },
    body: JSON.stringify(cuerpo),
  });
  return idsDelAnuncioCreado(r);
}

/**
 * Un fallo de Zernio, leído: su mensaje y el subcode de Meta que trae adentro (`platformError`). null si no
 * es de Zernio. Lo usa lib/meta-ads-create.ts para traducirlo a su error sin importar el cliente de Zernio.
 */
export function leerErrorDeZernio(e: unknown): { mensaje: string; subcode: number | null } | null {
  if (!(e instanceof ZernioError)) return null;
  return { mensaje: e.body?.error ?? e.message, subcode: subcodeDeZernio(e.body) };
}

/** Cambia los textos de un anuncio vivo (Zernio crea el creativo nuevo y lo apunta). */
export async function cambiarTextosPorZernio(
  ws: number,
  adId: string,
  edited: { primary_text?: string; headline?: string; description?: string; cta_type?: string; destination_url?: string },
): Promise<void> {
  const clave = await claveZernioAnuncios(ws);
  if (!clave) throw new ZernioError('Este negocio no tiene su clave de Zernio', 0, null);
  await zAds<unknown>(clave, `/ads/${encodeURIComponent(adId)}`, { method: 'PUT', body: JSON.stringify(cuerpoCambiarTextos(edited)) });
}
