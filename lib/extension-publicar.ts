// =============================================================================
// extension-publicar — la extensión se publica SOLA en la Chrome Web Store (5/11/2026)
// =============================================================================
// Martín (27/10 y 5/11/2026): «si hay cosas que publicar... automáticamente», sin preguntarle. Cuando la versión de
// extension/ que está en main (`EXTENSION_VERSION`, la del zip que sirve el deploy) es más nueva que la de la tienda, el vigía
// de las aprobaciones (el cron de cada hora) la sube y la manda a revisión con la API V2 de la Chrome Web Store y la cuenta
// de servicio de Google de la plataforma (`TIENDAS_GOOGLE_CUENTA_SERVICIO` + `CWS_PUBLISHER_ID`). Sin esas claves no falla
// nada: la fila de la extensión en Approvals dice qué falta.
//
// Por qué en el cron y no en el deploy: un paso de deploy que falla porque falta una clave frena producción por algo que no
// es del código, y la clave vive en la base de la plataforma, donde GitHub no llega. El cron corre ya desplegado, con el zip
// de ESE deploy, a lo sumo una hora después.
//
// LAS REGLAS (cada una con su test, tests/extension-publicar.test.ts):
//   1. NUNCA SE CANCELA UNA REVISIÓN EN CURSO. Si hay otra versión en revisión, la nueva espera a que termine: cancelar para
//      mandar la nueva, con versiones que suben seguido, reinicia la cola de Google cada vez y no se aprueba nunca ninguna.
//   2. LO QUE LA TIENDA YA TIENE NO SE VUELVE A SUBIR: una versión publicada, en revisión o rechazada igual o más nueva que la
//      de main no hace nada. Una rechazada se corrige con una versión nueva, que sí sale sola (el vigía avisa el rechazo).
//   3. SE MARCA ANTES DE SUBIR, con compare-and-set (`CLAVE_PUBLICACION`): de dos vueltas a la vez, sube una.
//   4. UN 200 NO ES UN ÉXITO: la subida vale con `uploadState: SUCCEEDED` y la versión que dice el zip; la publicación, con un
//      `state` de los que significan «entró» (en revisión o publicada). Lo demás es un fallo con su motivo.
//   5. TRES FALLOS SEGUIDOS DE LA MISMA VERSIÓN Y SE DEJA DE INTENTAR, con el motivo a la vista: no se martilla la API cada hora.
//   6. ANTES DE SUBIR, EL ZIP SE ABRE y su manifest tiene que decir la versión de main: un zip viejo no se manda.
//
// ⚠️ LAS FORMAS DE LA API V2 no se midieron contra Google: la nube no llega a la documentación ni a la API, y la plataforma no
//    tiene las claves todavía. Salen de lo que el repo ya anotó (scripts/publicar-extension.mjs, lib/vigia-aprobaciones-fuentes.ts)
//    y de la documentación de la V2. Un campo distinto da un fallo con su motivo en Approvals, nunca un éxito.
// SIN `server-only` y SIN RED PROPIA: el `fetch`, el token y el zip llegan por parámetro (los tests los reemplazan).
// =============================================================================

import { versionAnterior } from './vigia-aprobaciones-fuentes';

/** La clave de `app_settings` (workspace de la plataforma) con la última publicación que intentó el cron. */
export const CLAVE_PUBLICACION = 'vigia.extension.publicacion';
/** Fallos seguidos de la misma versión antes de dejar de intentar (regla 5). */
export const MAX_INTENTOS = 3;
/** Una marca de «subiendo» más vieja que esto es de una vuelta que murió: se puede volver a intentar. */
export const SUBIENDO_VENCE_MS = 30 * 60_000;

const API = 'https://chromewebstore.googleapis.com';

/** Lo que dice `fetchStatus` de la tienda, ya leído. */
export type EstadoTienda = {
  enviada: { estado: string | null; version: string | null };
  publicada: { estado: string | null; version: string | null };
  /** `lastAsyncUploadState`: el de la última subida que la tienda procesa aparte. */
  subida: string | null;
  bajada: boolean;
};

/** Lo guardado de la última publicación que intentó el cron. */
export type Publicacion = {
  version: string;
  paso: 'subiendo' | 'procesando' | 'subida' | 'enviada' | 'fallo';
  at: string;
  /** Los fallos seguidos de esta versión (también en la marca de «subiendo», para no perder la cuenta). */
  intentos?: number;
  error?: string;
  /** En qué paso falló: un fallo al publicar se reintenta publicando (volver a subir la misma versión lo rechaza la tienda). */
  en?: 'subir' | 'publicar';
};

export type Decision =
  | { hacer: 'nada'; motivo: string }
  | { hacer: 'esperar'; motivo: string }
  | { hacer: 'publicar' }
  | { hacer: 'subir' };

const ENTRO = new Set(['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS', 'STAGED']);

export function leerPublicacion(crudo: string | null | undefined): Publicacion | null {
  if (!crudo) return null;
  try {
    const o = JSON.parse(crudo) as Partial<Publicacion>;
    if (typeof o?.version !== 'string' || typeof o.at !== 'string') return null;
    if (!['subiendo', 'procesando', 'subida', 'enviada', 'fallo'].includes(String(o.paso))) return null;
    return o as Publicacion;
  } catch { return null; }
}

const noEsAnterior = (a: string | null, b: string) => !!a && !versionAnterior(a, b);

/** Qué hacer con la versión de main, mirando la tienda y lo que se intentó antes. Puro. */
export function decidirPublicacion(versionMain: string, t: EstadoTienda, previa: Publicacion | null, ahoraMs: number): Decision {
  if (t.bajada) return { hacer: 'nada', motivo: 'Google bajó la extensión de la tienda: una versión nueva no se manda sola' };
  // Regla 1: una revisión en curso no se cancela.
  if (t.enviada.estado === 'PENDING_REVIEW') {
    if (t.enviada.version === versionMain) return { hacer: 'nada', motivo: `La ${versionMain} está en revisión` };
    return { hacer: 'esperar', motivo: `La ${t.enviada.version ?? 'anterior'} está en revisión: la ${versionMain} se manda sola cuando termine` };
  }
  // Regla 2: lo que la tienda ya tiene no se vuelve a subir.
  if (noEsAnterior(t.publicada.version, versionMain)) return { hacer: 'nada', motivo: `La tienda ya tiene la ${t.publicada.version}` };
  if (t.enviada.estado === 'REJECTED' && noEsAnterior(t.enviada.version, versionMain)) {
    return { hacer: 'nada', motivo: `Google rechazó la ${t.enviada.version}: sale sola la próxima versión` };
  }
  if (t.enviada.estado === 'CANCELLED' && noEsAnterior(t.enviada.version, versionMain)) {
    return { hacer: 'nada', motivo: `La revisión de la ${t.enviada.version} se canceló en el panel: no se vuelve a mandar sola` };
  }
  if (ENTRO.has(t.enviada.estado ?? '') && noEsAnterior(t.enviada.version, versionMain)) {
    return { hacer: 'nada', motivo: `La tienda ya tiene la ${t.enviada.version}` };
  }
  if (t.subida === 'IN_PROGRESS') return { hacer: 'esperar', motivo: 'La tienda sigue procesando la última subida' };
  if (previa && previa.version === versionMain) {
    if (previa.paso === 'fallo' && (previa.intentos ?? 0) >= MAX_INTENTOS) {
      return { hacer: 'nada', motivo: `No pude mandar la ${versionMain} sola (${MAX_INTENTOS} intentos): ${previa.error ?? 'sin motivo'}` };
    }
    if (previa.paso === 'subiendo' && ahoraMs - Date.parse(previa.at) < SUBIENDO_VENCE_MS) {
      return { hacer: 'esperar', motivo: `Se está subiendo la ${versionMain}` };
    }
    if (previa.paso === 'procesando') {
      if (t.subida === 'SUCCEEDED') return { hacer: 'publicar' };
      if (t.subida === 'FAILED') return { hacer: 'subir' };
      return { hacer: 'esperar', motivo: 'La tienda sigue procesando la subida' };
    }
    if (previa.paso === 'subida') return { hacer: 'publicar' };
    if (previa.paso === 'fallo' && previa.en === 'publicar') return { hacer: 'publicar' };
    if (previa.paso === 'enviada') return { hacer: 'nada', motivo: `La ${versionMain} se mandó a revisión` };
  }
  return { hacer: 'subir' };
}

/** `fetchStatus` en nuestro idioma, o null si la respuesta no se entiende. */
export function estadoTiendaDe(json: unknown): EstadoTienda | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const rev = (x: unknown) => {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const canales = Array.isArray(r.distributionChannels) ? r.distributionChannels : [];
    const c0 = (canales[0] && typeof canales[0] === 'object' ? canales[0] : {}) as Record<string, unknown>;
    return { estado: typeof r.state === 'string' ? r.state : null, version: typeof c0.crxVersion === 'string' ? c0.crxVersion : null };
  };
  return {
    enviada: rev(o.submittedItemRevisionStatus),
    publicada: rev(o.publishedItemRevisionStatus),
    subida: typeof o.lastAsyncUploadState === 'string' ? o.lastAsyncUploadState : null,
    bajada: o.takenDown === true,
  };
}

export type Dependencias = {
  fetch: typeof fetch;
  token: string;
  publisherId: string;
  extensionId: string;
  versionMain: string;
  /** El zip de ESTE deploy. `version` es la que dice su manifest (regla 6). */
  zip: () => Promise<{ bytes: Uint8Array; version: string | null } | { error: string }>;
  topeMs?: number;
};

export type Resultado = { paso: 'procesando' | 'subida' | 'enviada' | 'fallo'; error?: string; estado?: string; en?: 'subir' | 'publicar' };

async function pedirJson(d: Dependencias, url: string, init: RequestInit): Promise<{ status: number; json: Record<string, unknown> } | { error: string }> {
  try {
    const r = await d.fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(d.topeMs ?? 50_000) });
    const texto = await r.text();
    let json: Record<string, unknown> = {};
    try { json = texto ? JSON.parse(texto) : {}; } catch { json = {}; }
    return { status: r.status, json };
  } catch (err) {
    const n = err instanceof Error ? err.name : '';
    return { error: n === 'TimeoutError' || n === 'AbortError' ? 'la tienda no contestó a tiempo' : 'no me pude conectar con la tienda' };
  }
}

/** El motivo de un error de Google, sin claves: el status y su mensaje, corto. */
function motivoDe(status: number, json: Record<string, unknown>): string {
  const e = (json.error && typeof json.error === 'object' ? json.error : {}) as Record<string, unknown>;
  const msg = typeof e.message === 'string' ? e.message.replace(/\s+/g, ' ').slice(0, 160) : '';
  return `la tienda contestó HTTP ${status}${msg ? `: ${msg}` : ''}`;
}

/** Sube el zip (regla 6 antes). `procesando` si la tienda lo procesa aparte: la vuelta siguiente lo publica. */
export async function subir(d: Dependencias): Promise<Resultado> {
  const z = await d.zip();
  if ('error' in z) return { paso: 'fallo', en: 'subir', error: z.error };
  if (z.version !== d.versionMain) return { paso: 'fallo', en: 'subir', error: `el zip dice ${z.version ?? 'otra versión'} y main la ${d.versionMain}` };
  const url = `${API}/upload/v2/publishers/${encodeURIComponent(d.publisherId)}/items/${encodeURIComponent(d.extensionId)}:upload`;
  const r = await pedirJson(d, url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${d.token}`, 'Content-Type': 'application/zip' },
    // Una copia: `fetch` pide un buffer propio (el `Uint8Array` que llega puede apuntar a uno compartido).
    body: new Uint8Array(z.bytes),
  });
  if ('error' in r) return { paso: 'fallo', en: 'subir', error: r.error };
  if (r.status !== 200) return { paso: 'fallo', en: 'subir', error: motivoDe(r.status, r.json) };
  const estado = typeof r.json.uploadState === 'string' ? r.json.uploadState : null;
  if (estado === 'IN_PROGRESS') return { paso: 'procesando' };
  if (estado !== 'SUCCEEDED') return { paso: 'fallo', en: 'subir', error: `la subida quedó en ${estado ?? 'un estado que no dice'}` };
  const crx = typeof r.json.crxVersion === 'string' ? r.json.crxVersion : null;
  if (crx && crx !== d.versionMain) return { paso: 'fallo', en: 'subir', error: `la tienda leyó la ${crx} y main es la ${d.versionMain}` };
  return { paso: 'subida' };
}

/** La manda a revisión (se publica sola cuando Google la apruebe). */
export async function publicar(d: Dependencias): Promise<Resultado> {
  const url = `${API}/v2/publishers/${encodeURIComponent(d.publisherId)}/items/${encodeURIComponent(d.extensionId)}:publish`;
  const r = await pedirJson(d, url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${d.token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if ('error' in r) return { paso: 'fallo', en: 'publicar', error: r.error };
  if (r.status !== 200) return { paso: 'fallo', en: 'publicar', error: motivoDe(r.status, r.json) };
  const estado = typeof r.json.state === 'string' ? r.json.state : null;
  if (!estado || !ENTRO.has(estado)) return { paso: 'fallo', en: 'publicar', error: `la tienda dejó la publicación en ${estado ?? 'un estado que no dice'}` };
  return { paso: 'enviada', estado };
}

/** Lo que se guarda después de un paso: los fallos de la misma versión se cuentan (regla 5). */
export function guardarPaso(previa: Publicacion | null, version: string, r: Resultado, ahoraMs: number): Publicacion {
  const at = new Date(ahoraMs).toISOString();
  if (r.paso !== 'fallo') return { version, paso: r.paso, at };
  const antes = previa?.version === version ? (previa.intentos ?? 0) : 0;
  return { version, paso: 'fallo', at, intentos: antes + 1, error: r.error, ...(r.en ? { en: r.en } : {}) };
}

/** La marca de «subiendo» que se escribe ANTES de tocar la tienda (regla 3). Lleva la cuenta de fallos de esta versión. */
export function marcaDeSubida(previa: Publicacion | null, version: string, ahoraMs: number): Publicacion {
  return { version, paso: 'subiendo', at: new Date(ahoraMs).toISOString(), intentos: previa?.version === version ? (previa.intentos ?? 0) : 0 };
}

/** La versión que dice el manifest de adentro del zip (regla 6), o null si el zip no se entiende. */
export async function versionDelZip(bytes: Uint8Array): Promise<string | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(bytes);
    const archivo = zip.file('manifest.json') ?? Object.values(zip.files).find((f) => /(^|\/)manifest\.json$/.test(f.name) && !f.dir) ?? null;
    if (!archivo) return null;
    const m = JSON.parse(await archivo.async('string')) as { version?: unknown };
    return typeof m.version === 'string' ? m.version : null;
  } catch { return null; }
}

/** Lee `fetchStatus` de la tienda (la misma lectura que el vigía), para decidir. */
export async function leerEstadoTienda(d: Pick<Dependencias, 'fetch' | 'token' | 'publisherId' | 'extensionId' | 'topeMs'>): Promise<EstadoTienda | { error: string }> {
  const url = `${API}/v2/publishers/${encodeURIComponent(d.publisherId)}/items/${encodeURIComponent(d.extensionId)}:fetchStatus`;
  const r = await pedirJson(d as Dependencias, url, { headers: { Authorization: `Bearer ${d.token}` } });
  if ('error' in r) return r;
  if (r.status !== 200) return { error: motivoDe(r.status, r.json) };
  return estadoTiendaDe(r.json) ?? { error: 'la tienda contestó algo que no entiendo' };
}

/** Lo que hizo (o no) la publicación en esta vuelta, para la fila de la extensión en Approvals. */
export type ResumenPublicacion =
  | { tipo: 'falta'; faltan: readonly string[] }
  | { tipo: 'no_pude'; motivo: string }
  | { tipo: 'decidido'; decision: Decision; previa: Publicacion | null }
  | { tipo: 'hecho'; resultado: Resultado; guardado: Publicacion };

const conFrase = (detalle: string | null | undefined, frase: string) => (detalle ? `${detalle.replace(/[.\s]+$/, '')}. ${frase}` : frase);

/**
 * La fila de la extensión con lo que pasó con la publicación (puro). Mandarla a revisión la deja «en revisión» con la versión
 * de main (el vigía no avisa eso: regla 1). Tres fallos seguidos la dejan en «piden algo», con el motivo: eso sí avisa, UNA vez.
 * Lo demás sólo suma una frase al detalle. Una lectura que no se pudo hacer no se toca.
 */
export function conLaPublicacion(l: import('./vigia-aprobaciones').Lectura, r: ResumenPublicacion, versionMain: string): import('./vigia-aprobaciones').Lectura {
  if (l.tipo !== 'leido') return l;
  if (r.tipo === 'hecho') {
    if (r.resultado.paso === 'enviada' || r.resultado.paso === 'subida' || r.resultado.paso === 'procesando') {
      return { ...l, estado: 'en_revision', version: versionMain, detalle: r.resultado.paso === 'enviada' ? 'MaKo la mandó sola a revisión' : 'MaKo la subió sola: la manda a revisión en la próxima vuelta' };
    }
    if ((r.guardado.intentos ?? 0) >= MAX_INTENTOS) {
      return { ...l, estado: 'piden_algo', version: versionMain, detalle: `No pude mandar la ${versionMain} sola (${MAX_INTENTOS} intentos): ${r.resultado.error ?? 'sin motivo'}` };
    }
    return { ...l, detalle: conFrase(l.detalle, `No pude mandar la ${versionMain} sola (intento ${r.guardado.intentos ?? 1} de ${MAX_INTENTOS}): ${r.resultado.error ?? 'sin motivo'}`) };
  }
  if (r.tipo === 'falta') {
    if (l.version && !versionAnterior(l.version, versionMain)) return l;
    return { ...l, detalle: conFrase(l.detalle, `La ${versionMain} se manda sola a revisión apenas estén las claves`) };
  }
  if (r.tipo === 'no_pude') return { ...l, detalle: conFrase(l.detalle, `No pude ver si hay que mandar la ${versionMain}: ${r.motivo}`) };
  const d = r.decision;
  if (d.hacer === 'nada' && r.previa?.paso === 'fallo' && (r.previa.intentos ?? 0) >= MAX_INTENTOS && r.previa.version === versionMain) {
    return { ...l, estado: 'piden_algo', version: versionMain, detalle: d.motivo };
  }
  if (d.hacer === 'esperar') return { ...l, detalle: conFrase(l.detalle, d.motivo) };
  // Recién mandada: la tienda puede tardar en decir que está en revisión. Sin esto la fila volvería a la versión vieja
  // «aprobada» y el vigía anunciaría como novedad una aprobación que no pasó.
  if (r.previa?.paso === 'enviada' && r.previa.version === versionMain && l.estado !== 'rechazado' && (!l.version || versionAnterior(l.version, versionMain))) {
    return { ...l, estado: 'en_revision', version: versionMain, detalle: 'MaKo la mandó sola a revisión' };
  }
  return l;
}
