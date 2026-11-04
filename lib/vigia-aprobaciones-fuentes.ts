// =============================================================================
// vigia-aprobaciones-fuentes — de dónde sale el estado de cada aprobación (4/11/2026)
// =============================================================================
// Cada ítem de `ITEMS` (lib/vigia-aprobaciones.ts) tiene acá su lector. El orden en que se busca el estado es el que pidió
// Martín: (1) la API oficial, si existe y hay credencial; (2) si no, algo PÚBLICO que lo diga sin credencial (la ficha de la
// tienda); (3) si nada sirve, «hay que mirarlo a mano», sin inventar un estado.
//
// ⚠️ SIN `server-only` y SIN RED PROPIA: el `fetch`, las credenciales y la lista de dominios llegan en `Entorno`. Así los tests
// las reemplazan por fuentes de mentira (tests/vigia-aprobaciones-fuentes.test.ts) y el servidor pone las de verdad
// (lib/vigia-aprobaciones-server.ts).
//
// ⚠️ NINGÚN LECTOR TIRA. Un error de red, un 5xx o un cuerpo que no se entiende es `no_pude` con su motivo, y un motivo
// NUNCA lleva una clave: se arma con el status y el nombre de la fuente.
//
// LO QUE SE LEE, Y CON QUÉ (medido en la documentación oficial el 4/11/2026, ver docs/hallazgos-operaciones.md):
//   · App Store: App Store Connect API, `appVersionState` de la versión de iOS más nueva (JWT ES256, 20 minutos como mucho).
//     Sin la clave, la búsqueda pública de iTunes dice sólo si ya está en la tienda.
//   · Google Play: `tracks/{track}/releases` de la Android Publisher API, con `releaseLifecycleState` (dice si está en
//     revisión, aprobada o rechazada). Sin la cuenta de servicio, la ficha pública dice sólo si producción ya está publicada.
//   · Chrome Web Store: `fetchStatus` de la API V2 (la V1 se apagó el 15/10/2026). Sin credencial, la ficha pública dice la
//     versión publicada.
//   · Meta: `/{app}/permissions` con el token de la app dice qué permisos quedaron APROBADOS (`live`). Lo que está en revisión
//     o rechazado no lo dice ninguna API (medido el 11/09/2026: docs/hallazgos-ads.md).
//   · Resend: la lista de dominios con la clave que los administra (lib/resend-dominios.ts); se miran sólo los de MaKo.
// =============================================================================

import { createPrivateKey, createSign } from 'node:crypto';
import type { Estado, Lectura } from './vigia-aprobaciones';
import { APPLE_ID_APP, META_APP_ID_VIGIA, PAQUETE_APP } from './vigia-aprobaciones';
import { pemPkcs8 } from './push-apns-reglas';
import { esDominioDeMako } from './email-remitente';

/** Las credenciales que lee el vigía, del workspace de la plataforma. `null` = no está cargada. */
export type CredencialesVigia = {
  ASC_ISSUER_ID?: string | null;
  ASC_KEY_ID?: string | null;
  ASC_P8?: string | null;
  TIENDAS_GOOGLE_CUENTA_SERVICIO?: string | null;
  CWS_PUBLISHER_ID?: string | null;
  MAKO_META_APP_SECRET?: string | null;
};

export const CLAVES_ASC = ['ASC_ISSUER_ID', 'ASC_KEY_ID', 'ASC_P8'] as const;
export const CLAVE_GOOGLE = 'TIENDAS_GOOGLE_CUENTA_SERVICIO';
export const CLAVE_CWS_PUBLISHER = 'CWS_PUBLISHER_ID';
/**
 * Lo que falta para leer los dominios de Resend, en palabras. ⚠️ No el nombre de la variable: ése lo nombra SÓLO
 * lib/resend-dominios.ts (tests/resend-clave-admin.test.ts), que es el único que la lee.
 */
export const FALTA_RESEND_ADMIN = 'la clave de Resend que administra dominios (variable de Vercel)';
export const CLAVE_META = 'MAKO_META_APP_SECRET';

export type DominiosResend =
  | { ok: true; domains: ReadonlyArray<{ name: string; status: string }> }
  | { ok: false; error: string; /** No hay clave que administre dominios, o la que hay es de sólo envío. */ sinClave?: boolean };

export type Entorno = {
  fetch: typeof fetch;
  ahoraMs: () => number;
  creds: CredencialesVigia;
  /** Las credenciales que NO se pudieron leer (la base falló). Su fuente da «no pude leer», nunca «falta cargarla». */
  credsSinLeer?: readonly string[];
  /** La versión de la extensión que tiene el repo (`EXTENSION_VERSION`). */
  versionExtension: string;
  /** El id de la extensión en la Chrome Web Store (`EXTENSION_ID`). */
  extensionId: string;
  /** `META_API_VERSION` o la de siempre. */
  metaApiVersion?: string;
  dominiosResend: () => Promise<DominiosResend>;
  /** Tope de cada pedido, en ms (default 15 s). */
  topeMs?: number;
};

// ── Pedir sin tirar ─────────────────────────────────────────────────────────

type Respuesta = { status: number; texto: string; json: unknown };

async function pedir(e: Entorno, url: string, init: RequestInit = {}): Promise<Respuesta | { error: string }> {
  try {
    const r = await e.fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(e.topeMs ?? 15_000) });
    const texto = await r.text();
    let json: unknown = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
    return { status: r.status, texto, json };
  } catch (err) {
    const n = err instanceof Error ? err.name : '';
    return { error: n === 'TimeoutError' || n === 'AbortError' ? 'no contestó a tiempo' : 'no se pudo conectar' };
  }
}

const noPude = (motivo: string): Lectura => ({ tipo: 'no_pude', motivo });
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});
const txt = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim() : null);
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Qué credenciales de esta lista faltan. Si alguna NO SE PUDO LEER, devuelve `sinLeer` (eso es «no pude», no «falta»). */
function faltantes(e: Entorno, claves: readonly (keyof CredencialesVigia)[]): { faltan: string[]; sinLeer: boolean } {
  const sinLeer = claves.some((c) => e.credsSinLeer?.includes(c));
  return { faltan: claves.filter((c) => !txt(e.creds[c])), sinLeer };
}

// ── App Store Connect ───────────────────────────────────────────────────────

/** El JWT de App Store Connect: ES256, `aud` fijo y a lo sumo 20 minutos (usamos 15). */
export function jwtAsc(c: { issuerId: string; keyId: string; p8: string }, ahoraMs: number): string {
  const iat = Math.floor(ahoraMs / 1000);
  const cabecera = b64u(JSON.stringify({ alg: 'ES256', kid: c.keyId, typ: 'JWT' }));
  const cuerpo = b64u(JSON.stringify({ iss: c.issuerId, iat, exp: iat + 15 * 60, aud: 'appstoreconnect-v1' }));
  const firma = createSign('SHA256').update(`${cabecera}.${cuerpo}`).sign({ key: createPrivateKey(c.p8), dsaEncoding: 'ieee-p1363' });
  return `${cabecera}.${cuerpo}.${b64u(firma)}`;
}

/**
 * `appVersionState` (y el viejo `appStoreState`, deprecado desde la 3.7) en nuestro idioma. Lo que no está acá no se adivina:
 * vuelve `null` y el lector dice «no pude leer» (un estado nuevo de Apple no puede leerse como aprobado).
 */
export function estadoDeApple(s: string): { estado: Estado; detalle?: string } | null {
  switch (s) {
    case 'READY_FOR_DISTRIBUTION': case 'READY_FOR_SALE': case 'PREORDER_READY_FOR_SALE': case 'REPLACED_WITH_NEW_VERSION':
      return { estado: 'aprobado' };
    case 'PROCESSING_FOR_DISTRIBUTION': case 'PROCESSING_FOR_APP_STORE':
      return { estado: 'aprobado', detalle: 'Apple la aprobó y la está procesando (menos de un día)' };
    case 'PENDING_DEVELOPER_RELEASE':
      return { estado: 'aprobado', detalle: 'Apple la aprobó: falta tocar «Publicar» en App Store Connect' };
    case 'PENDING_APPLE_RELEASE':
      return { estado: 'aprobado', detalle: 'Apple la publica cuando salga la versión de iOS que pide' };
    case 'WAITING_FOR_REVIEW': case 'IN_REVIEW':
      return { estado: 'en_revision' };
    case 'WAITING_FOR_EXPORT_COMPLIANCE':
      return { estado: 'en_revision', detalle: 'Apple revisa el cumplimiento de exportación' };
    case 'ACCEPTED':
      return { estado: 'piden_algo', detalle: 'Apple aceptó la versión pero rechazó algo del envío' };
    case 'PENDING_CONTRACT':
      return { estado: 'piden_algo', detalle: 'Falta aceptar un contrato en App Store Connect' };
    case 'REJECTED':
      return { estado: 'rechazado' };
    case 'METADATA_REJECTED':
      return { estado: 'rechazado', detalle: 'Por la ficha (textos, capturas o datos), no por la app' };
    case 'INVALID_BINARY':
      return { estado: 'rechazado', detalle: 'El archivo de la app no cumple lo que pide Apple' };
    case 'REMOVED_FROM_SALE':
      return { estado: 'rechazado', detalle: 'Apple la sacó de la tienda' };
    case 'PREPARE_FOR_SUBMISSION': case 'READY_FOR_REVIEW': case 'DEVELOPER_REJECTED':
      return { estado: 'sin_enviar' };
    case 'DEVELOPER_REMOVED_FROM_SALE':
      return { estado: 'sin_publicar', detalle: 'La sacamos nosotros de la venta' };
    default:
      return null;
  }
}

async function leerAppStore(e: Entorno): Promise<Lectura> {
  const { faltan, sinLeer } = faltantes(e, CLAVES_ASC);
  if (sinLeer) return noPude('no pude leer la clave de App Store Connect');
  if (!faltan.length) {
    const p8 = pemPkcs8(e.creds.ASC_P8);
    if (!p8) return noPude('la clave .p8 de App Store Connect no se entiende');
    let jwt: string;
    try { jwt = jwtAsc({ issuerId: txt(e.creds.ASC_ISSUER_ID)!, keyId: txt(e.creds.ASC_KEY_ID)!, p8 }, e.ahoraMs()); } catch {
      return noPude('la clave .p8 de App Store Connect no se entiende');
    }
    const url = `https://api.appstoreconnect.apple.com/v1/apps/${APPLE_ID_APP}/appStoreVersions`
      + '?filter[platform]=IOS&fields[appStoreVersions]=versionString,appVersionState,appStoreState,createdDate&limit=20';
    const r = await pedir(e, url, { headers: { Authorization: `Bearer ${jwt}` } });
    if ('error' in r) return noPude(`App Store Connect ${r.error}`);
    if (r.status === 401 || r.status === 403) return noPude(`App Store Connect no aceptó la clave (HTTP ${r.status})`);
    if (r.status !== 200) return noPude(`App Store Connect contestó HTTP ${r.status}`);
    const data = obj(r.json).data;
    if (!Array.isArray(data)) return noPude('App Store Connect contestó algo que no entiendo');
    if (!data.length) return { tipo: 'leido', fuente: 'asc-api', estado: 'sin_enviar', detalle: 'Todavía no hay ninguna versión cargada' };
    const versiones = data.map((d) => obj(obj(d).attributes))
      .sort((a, b) => (Date.parse(String(b.createdDate ?? '')) || 0) - (Date.parse(String(a.createdDate ?? '')) || 0));
    const v = versiones[0];
    const crudo = txt(v.appVersionState) ?? txt(v.appStoreState);
    const m = crudo ? estadoDeApple(crudo) : null;
    if (!m) return noPude(`App Store Connect dijo un estado que no conozco (${crudo ?? 'vacío'})`);
    return { tipo: 'leido', fuente: 'asc-api', estado: m.estado, version: txt(v.versionString), detalle: m.detalle ?? null };
  }
  // Sin la clave: la búsqueda pública de iTunes sólo dice si ya está en la tienda (México y, si no, Estados Unidos).
  for (const pais of ['mx', 'us']) {
    const r = await pedir(e, `https://itunes.apple.com/lookup?id=${APPLE_ID_APP}&country=${pais}`);
    if ('error' in r) return noPude(`la búsqueda pública de Apple ${r.error}`);
    if (r.status !== 200) return noPude(`la búsqueda pública de Apple contestó HTTP ${r.status}`);
    const j = obj(r.json);
    if (typeof j.resultCount !== 'number') return noPude('la búsqueda pública de Apple contestó algo que no entiendo');
    const res = Array.isArray(j.results) ? j.results : [];
    if (j.resultCount > 0 && res.length) return { tipo: 'leido', fuente: 'itunes', estado: 'aprobado', version: txt(obj(res[0]).version), faltan };
  }
  return {
    tipo: 'leido', fuente: 'itunes', estado: 'sin_publicar', faltan,
    detalle: 'No está en la App Store. Sin la clave de App Store Connect no sé si está en revisión',
  };
}

// ── Google: la cuenta de servicio (Play y la Chrome Web Store) ──────────────

const ALCANCES_GOOGLE = 'https://www.googleapis.com/auth/androidpublisher https://www.googleapis.com/auth/chromewebstore.readonly';

/** El JWT que se canjea por un token de Google: RS256 con la clave de la cuenta de servicio, una hora. */
export function jwtCuentaServicio(sa: { client_email: string; private_key: string; private_key_id?: string; token_uri?: string }, ahoraMs: number): string {
  const iat = Math.floor(ahoraMs / 1000);
  const cabecera = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...(sa.private_key_id ? { kid: sa.private_key_id } : {}) }));
  const cuerpo = b64u(JSON.stringify({
    iss: sa.client_email, scope: ALCANCES_GOOGLE, aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600,
  }));
  const firma = createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(createPrivateKey(sa.private_key));
  return `${cabecera}.${cuerpo}.${b64u(firma)}`;
}

/** Un token de Google por vuelta, compartido por los lectores que lo usan. */
type TokenGoogle = { token: string } | { lectura: Lectura };

function tokenGoogle(e: Entorno): () => Promise<TokenGoogle> {
  let promesa: Promise<TokenGoogle> | null = null;
  return () => {
    promesa ??= (async (): Promise<TokenGoogle> => {
      if (e.credsSinLeer?.includes(CLAVE_GOOGLE)) return { lectura: noPude('no pude leer la cuenta de servicio de Google') };
      const crudo = txt(e.creds.TIENDAS_GOOGLE_CUENTA_SERVICIO);
      if (!crudo) return { lectura: { tipo: 'sin_credencial', faltan: [CLAVE_GOOGLE] } };
      let sa: { client_email: string; private_key: string; private_key_id?: string; token_uri?: string };
      try {
        const j = obj(JSON.parse(crudo));
        if (!txt(j.client_email) || !txt(j.private_key)) throw new Error('incompleta');
        sa = { client_email: String(j.client_email), private_key: String(j.private_key), private_key_id: txt(j.private_key_id) ?? undefined, token_uri: txt(j.token_uri) ?? undefined };
      } catch {
        return { lectura: noPude('la cuenta de servicio de Google no es el JSON que baja Google Cloud') };
      }
      let jwt: string;
      try { jwt = jwtCuentaServicio(sa, e.ahoraMs()); } catch {
        return { lectura: noPude('la clave de la cuenta de servicio de Google no se entiende') };
      }
      const r = await pedir(e, sa.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }).toString(),
      });
      if ('error' in r) return { lectura: noPude(`Google ${r.error}`) };
      const token = txt(obj(r.json).access_token);
      if (r.status !== 200 || !token) return { lectura: noPude(`Google no aceptó la cuenta de servicio (HTTP ${r.status})`) };
      return { token };
    })();
    return promesa;
  };
}

/** `releaseLifecycleState` de Play, con o sin el prefijo `RELEASE_LIFECYCLE_STATE_` (la documentación lo muestra de las dos formas). */
export function estadoDePlay(s: string): { estado: Estado; detalle?: string } | null {
  switch (s.replace(/^RELEASE_LIFECYCLE_STATE_/, '')) {
    case 'DRAFT': return { estado: 'sin_enviar', detalle: 'Está en borrador' };
    case 'NOT_SENT_FOR_REVIEW': return { estado: 'sin_enviar', detalle: 'Lista, pero falta mandarla a revisión' };
    case 'IN_REVIEW': return { estado: 'en_revision' };
    case 'APPROVED_NOT_PUBLISHED': return { estado: 'aprobado', detalle: 'Google la aprobó: falta publicarla en Play Console' };
    case 'NOT_APPROVED': return { estado: 'rechazado' };
    case 'PUBLISHED': return { estado: 'aprobado' };
    default: return null;
  }
}

/** La versión más nueva de una pista (por su `versionCode`, no por el orden de la lista, que la documentación no promete). */
function releaseMasNueva(releases: unknown[]): Record<string, unknown> | null {
  let mejor: Record<string, unknown> | null = null;
  let codigo = -1;
  for (const r of releases) {
    const o = obj(r);
    const arts = Array.isArray(o.activeArtifacts) ? o.activeArtifacts : [];
    const max = Math.max(-1, ...arts.map((a) => Number(obj(a).versionCode) || 0));
    if (mejor == null || max > codigo) { mejor = o; codigo = max; }
  }
  return mejor;
}

async function leerPlayPista(e: Entorno, token: () => Promise<TokenGoogle>, pista: 'production' | 'alpha'): Promise<Lectura | null> {
  const t = await token();
  if ('lectura' in t) return t.lectura.tipo === 'sin_credencial' ? null : t.lectura;
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUETE_APP}/tracks/${pista}/releases`;
  const r = await pedir(e, url, { headers: { Authorization: `Bearer ${t.token}` } });
  if ('error' in r) return noPude(`Play Console ${r.error}`);
  if (r.status === 404) return { tipo: 'leido', fuente: 'play-api', estado: 'sin_enviar', detalle: 'Play Console todavía no tiene la app o esta pista' };
  if (r.status === 401 || r.status === 403) return noPude(`Play Console no dejó leer con la cuenta de servicio (HTTP ${r.status}): hay que invitarla en Play Console`);
  if (r.status !== 200) return noPude(`Play Console contestó HTTP ${r.status}`);
  const releases = obj(r.json).releases;
  const lista = Array.isArray(releases) ? releases : [];
  if (!lista.length) return { tipo: 'leido', fuente: 'play-api', estado: 'sin_enviar', detalle: 'No hay ninguna versión en esta pista' };
  const rel = releaseMasNueva(lista)!;
  const crudo = txt(rel.releaseLifecycleState);
  const m = crudo ? estadoDePlay(crudo) : null;
  if (!m) return noPude(`Play Console dijo un estado que no conozco (${crudo ?? 'vacío'})`);
  return { tipo: 'leido', fuente: 'play-api', estado: m.estado, version: txt(rel.releaseName), detalle: m.detalle ?? null };
}

async function leerPlayProduccion(e: Entorno, token: () => Promise<TokenGoogle>): Promise<Lectura> {
  const api = await leerPlayPista(e, token, 'production');
  if (api) return api;
  // Sin la cuenta de servicio: la ficha pública dice sólo si producción ya está publicada (404 = no está).
  const r = await pedir(e, `https://play.google.com/store/apps/details?id=${PAQUETE_APP}&hl=es_419`);
  if ('error' in r) return noPude(`la ficha de Google Play ${r.error}`);
  if (r.status === 200) return { tipo: 'leido', fuente: 'play-ficha', estado: 'aprobado', faltan: [CLAVE_GOOGLE] };
  if (r.status === 404) {
    return {
      tipo: 'leido', fuente: 'play-ficha', estado: 'sin_publicar', faltan: [CLAVE_GOOGLE],
      detalle: 'No está en Google Play. Sin la cuenta de servicio no sé si está en revisión',
    };
  }
  return noPude(`la ficha de Google Play contestó HTTP ${r.status}`);
}

async function leerPlayPruebaCerrada(e: Entorno, token: () => Promise<TokenGoogle>): Promise<Lectura> {
  return (await leerPlayPista(e, token, 'alpha')) ?? { tipo: 'sin_credencial', faltan: [CLAVE_GOOGLE] };
}

// ── Chrome Web Store ────────────────────────────────────────────────────────

/** `ItemState` de la API V2. */
function estadoDeCws(s: string): { estado: Estado; detalle?: string } | null {
  switch (s) {
    case 'PENDING_REVIEW': return { estado: 'en_revision' };
    case 'STAGED': return { estado: 'aprobado', detalle: 'Google la aprobó: falta tocar «Publicar» en el panel' };
    case 'PUBLISHED': return { estado: 'aprobado' };
    case 'PUBLISHED_TO_TESTERS': return { estado: 'aprobado', detalle: 'Publicada sólo para los testers' };
    case 'REJECTED': return { estado: 'rechazado' };
    default: return null;
  }
}

const crxDe = (rev: Record<string, unknown>): string | null => {
  const canales = Array.isArray(rev.distributionChannels) ? rev.distributionChannels : [];
  return txt(obj(canales[0]).crxVersion);
};

/** ¿`a` es anterior a `b`? (versiones «0.74.3»). */
export function versionAnterior(a: string, b: string): boolean {
  const na = a.split('.').map((n) => Number(n) || 0);
  const nb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    if ((na[i] ?? 0) !== (nb[i] ?? 0)) return (na[i] ?? 0) < (nb[i] ?? 0);
  }
  return false;
}

/**
 * La versión publicada que dice la ficha pública. Es la misma lectura que scripts/version-en-tienda.mjs (el manifest embebido,
 * anclado en NUESTRA descripción, y el panel «Versión»), con las dos descripciones que tuvo la extensión: la de antes de la
 * 0.75.0 y la de ahora. Si las dos lecturas no coinciden, no concluye nada.
 */
export function versionDeLaFicha(html: string): string | null | 'no_coinciden' {
  const huellas = ['Genera los anuncios de MaKo', 'Conecta tu navegador con MaKo'];
  let delManifest: string | null = null;
  for (const h of huellas) {
    for (let i = html.indexOf(h); i > 0 && !delManifest; i = html.indexOf(h, i + 1)) {
      const todas = [...html.slice(Math.max(0, i - 400), i).matchAll(/version\\?":\s*\\?"([0-9.]+)/g)];
      if (todas.length) delManifest = todas[todas.length - 1][1];
    }
    if (delManifest) break;
  }
  const delPanel = /class="nBZElf">([0-9]+\.[0-9]+(?:\.[0-9]+)?)</.exec(html)?.[1] ?? null;
  if (delManifest && delPanel && delManifest !== delPanel) return 'no_coinciden';
  return delManifest ?? delPanel;
}

async function leerChromeWebStore(e: Entorno, token: () => Promise<TokenGoogle>): Promise<Lectura> {
  const pub = txt(e.creds.CWS_PUBLISHER_ID);
  const hayCuenta = !!txt(e.creds.TIENDAS_GOOGLE_CUENTA_SERVICIO);
  if (e.credsSinLeer?.includes(CLAVE_CWS_PUBLISHER) || e.credsSinLeer?.includes(CLAVE_GOOGLE)) return noPude('no pude leer las credenciales de la Chrome Web Store');
  if (pub && hayCuenta) {
    const t = await token();
    if ('lectura' in t) return t.lectura;
    const url = `https://chromewebstore.googleapis.com/v2/publishers/${encodeURIComponent(pub)}/items/${encodeURIComponent(e.extensionId)}:fetchStatus`;
    const r = await pedir(e, url, { headers: { Authorization: `Bearer ${t.token}` } });
    if ('error' in r) return noPude(`la Chrome Web Store ${r.error}`);
    if (r.status === 401 || r.status === 403) return noPude(`la Chrome Web Store no dejó leer con la cuenta de servicio (HTTP ${r.status}): hay que sumarla en el panel`);
    if (r.status !== 200) return noPude(`la Chrome Web Store contestó HTTP ${r.status}`);
    const j = obj(r.json);
    const enviada = obj(j.submittedItemRevisionStatus);
    const publicada = obj(j.publishedItemRevisionStatus);
    if (j.takenDown === true) return { tipo: 'leido', fuente: 'cws-api', estado: 'rechazado', version: crxDe(publicada), detalle: 'Google la bajó de la tienda por sus políticas' };
    const estadoEnviada = txt(enviada.state);
    const elegida = estadoEnviada && estadoEnviada !== 'CANCELLED' ? enviada : publicada;
    const crudo = txt(elegida.state);
    if (!crudo) return { tipo: 'leido', fuente: 'cws-api', estado: 'sin_publicar', detalle: 'No hay ninguna versión publicada ni en revisión' };
    const m = estadoDeCws(crudo);
    if (!m) return noPude(`la Chrome Web Store dijo un estado que no conozco (${crudo})`);
    if (j.warned === true && m.estado !== 'rechazado') {
      return { tipo: 'leido', fuente: 'cws-api', estado: 'piden_algo', version: crxDe(elegida), detalle: 'Google mandó una advertencia de sus políticas' };
    }
    return { tipo: 'leido', fuente: 'cws-api', estado: m.estado, version: crxDe(elegida), detalle: m.detalle ?? null };
  }
  // Sin credencial: la ficha pública dice la versión publicada.
  const faltan = [...(hayCuenta ? [] : [CLAVE_GOOGLE]), ...(pub ? [] : [CLAVE_CWS_PUBLISHER])];
  const r = await pedir(e, `https://chromewebstore.google.com/detail/mako/${e.extensionId}`, {
    headers: {
      // Sin un UA de navegador la tienda contesta una página distinta (scripts/version-en-tienda.mjs).
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'accept-language': 'es-419,es;q=0.9',
    },
  });
  if ('error' in r) return noPude(`la ficha de la Chrome Web Store ${r.error}`);
  if (r.status !== 200) return noPude(`la ficha de la Chrome Web Store contestó HTTP ${r.status}`);
  const v = versionDeLaFicha(r.texto);
  if (v === 'no_coinciden') return noPude('la ficha de la Chrome Web Store dice dos versiones distintas');
  if (!v) return noPude('no encontré la versión en la ficha de la Chrome Web Store');
  const atras = versionAnterior(v, e.versionExtension);
  return {
    tipo: 'leido', fuente: 'cws-ficha', estado: 'aprobado', version: v, faltan,
    detalle: atras ? `MaKo va por la ${e.versionExtension}: lo nuevo todavía no está publicado (sin la API no sé si está en revisión)` : null,
  };
}

// ── Meta ────────────────────────────────────────────────────────────────────

/** Los permisos que MaKo pidió o va a pedir en la revisión de la app (docs/hallazgos-ads.md, «Qué pide Meta», 11/09/2026). */
export const PERMISOS_META = [
  'ads_management', 'ads_read', 'business_management', 'leads_retrieval',
  'pages_manage_ads', 'pages_manage_metadata', 'pages_read_engagement', 'pages_show_list',
] as const;

async function leerMetaPermisos(e: Entorno): Promise<Lectura> {
  if (e.credsSinLeer?.includes(CLAVE_META)) return noPude('no pude leer el secreto de la app de Meta');
  const secreto = txt(e.creds.MAKO_META_APP_SECRET);
  if (!secreto) return { tipo: 'sin_credencial', faltan: [CLAVE_META] };
  const ver = e.metaApiVersion || 'v24.0';
  const url = `https://graph.facebook.com/${ver}/${META_APP_ID_VIGIA}/permissions`;
  // El token de la APP va en la cabecera, no en la URL: una URL termina en un log.
  const r = await pedir(e, url, { headers: { Authorization: `Bearer ${META_APP_ID_VIGIA}|${secreto}` } });
  if ('error' in r) return noPude(`Meta ${r.error}`);
  if (r.status !== 200) {
    const codigo = obj(obj(r.json).error).code;
    return noPude(`Meta contestó HTTP ${r.status}${codigo != null ? ` (código ${String(codigo)})` : ''}`);
  }
  const data = obj(r.json).data;
  if (!Array.isArray(data)) return noPude('Meta contestó algo que no entiendo');
  const aprobados = data.map(obj).filter((p) => p.status === 'live').map((p) => txt(p.permission)).filter((p): p is string => !!p);
  const faltanAprobar = PERMISOS_META.filter((p) => !aprobados.includes(p));
  return {
    tipo: 'leido', fuente: 'meta-api',
    estado: faltanAprobar.length ? 'sin_publicar' : 'aprobado',
    logros: aprobados,
    detalle: faltanAprobar.length
      ? `Sin aprobar todavía: ${faltanAprobar.join(', ')}. Meta no dice cuáles están en revisión`
      : null,
  };
}

// ── Resend ──────────────────────────────────────────────────────────────────

/** El estado de UN dominio de Resend en nuestro idioma. */
function estadoDeDominio(s: string): Estado | null {
  switch (s) {
    case 'verified': case 'partially_verified': return 'aprobado';
    case 'pending': case 'not_started': return 'en_revision';
    case 'failed': case 'temporary_failure': case 'partially_failed': case 'failure': return 'piden_algo';
    default: return null;
  }
}

const ROTULO_DOMINIO: Record<string, string> = {
  verified: 'verificado', partially_verified: 'verificado a medias', pending: 'verificando', not_started: 'sin verificar',
  failed: 'falló la verificación', temporary_failure: 'le falta un registro DNS', partially_failed: 'falló a medias', failure: 'falló la verificación',
};

async function leerResend(e: Entorno): Promise<Lectura> {
  let r: DominiosResend;
  try { r = await e.dominiosResend(); } catch { return noPude('Resend no contestó'); }
  if (!r.ok) return r.sinClave ? { tipo: 'sin_credencial', faltan: [FALTA_RESEND_ADMIN] } : noPude(`Resend: ${r.error.slice(0, 120)}`);
  const deMako = r.domains.filter((d) => esDominioDeMako(d.name));
  if (!deMako.length) return { tipo: 'leido', fuente: 'resend-api', estado: 'sin_enviar', detalle: 'La cuenta de Resend no tiene ningún dominio de MaKo' };
  const estados = deMako.map((d) => ({ d, e: estadoDeDominio(d.status) }));
  const raro = estados.find((x) => !x.e);
  if (raro) return noPude(`Resend dijo un estado que no conozco (${raro.d.status})`);
  const estado: Estado = estados.some((x) => x.e === 'piden_algo') ? 'piden_algo'
    : estados.some((x) => x.e === 'en_revision') ? 'en_revision' : 'aprobado';
  return {
    tipo: 'leido', fuente: 'resend-api', estado,
    logros: estados.filter((x) => x.e === 'aprobado').map((x) => x.d.name),
    detalle: estado === 'aprobado' ? null : deMako.map((d) => `${d.name}: ${ROTULO_DOMINIO[d.status] ?? d.status}`).join('; '),
  };
}

// ── Todos ───────────────────────────────────────────────────────────────────

type Lector = (e: Entorno, token: () => Promise<TokenGoogle>) => Promise<Lectura>;

/** Un lector por ítem del inventario. Los que no tienen API devuelven `a_mano`. El test cruza estas claves con `ITEMS`. */
export const LECTORES: Readonly<Record<string, Lector>> = {
  'app-store': (e) => leerAppStore(e),
  'play-prueba-cerrada': (e, t) => leerPlayPruebaCerrada(e, t),
  'play-produccion': (e, t) => leerPlayProduccion(e, t),
  'play-cuenta': async () => ({ tipo: 'a_mano' }),
  'chrome-web-store': (e, t) => leerChromeWebStore(e, t),
  'meta-permisos': (e) => leerMetaPermisos(e),
  'meta-verificaciones': async () => ({ tipo: 'a_mano' }),
  'google-oauth': async () => ({ tipo: 'a_mano' }),
  'resend-dominios': (e) => leerResend(e),
  'firma-windows': async () => ({ tipo: 'a_mano' }),
};

/** Lee todo, en paralelo. Nunca tira: un lector que revienta es «no pude leer». */
export async function leerTodo(e: Entorno): Promise<Record<string, Lectura>> {
  const token = tokenGoogle(e);
  const pares = await Promise.all(Object.entries(LECTORES).map(async ([id, leer]) => {
    try { return [id, await leer(e, token)] as const; } catch { return [id, noPude('el lector falló')] as const; }
  }));
  return Object.fromEntries(pares);
}
