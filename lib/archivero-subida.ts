// =============================================================================
// archivero-subida — subirle algo al Archivero desde el NAVEGADOR (un archivo o una web)
// =============================================================================
// Puro (fetch y nada más): sin `server-only` ni 'use client'. La secuencia vivía ADENTRO del
// `analizar` de app/onboarding/Archivero.tsx (un componente 'use client'), y el Second Brain del
// teléfono (app/m/second-brain) sube por el MISMO camino: AGENTS.md, «lo que se reusa de
// escritorio no puede vivir en un módulo use client: se muda a lib».
//
// La subida es DIRECTA a Supabase (sin pasar por el serverless: Vercel corta los POST de más de
// ~4,5 MB con un 413, aun con un solo PDF): 1) URL firmada, 2) el binario derecho a storage,
// 3) el server lo procesa (baja + extrae). Los tres pasos van con el workspace del request: el
// parche de fetch de la app pega el `?ws=` de la pestaña, y las rutas lo resuelven con
// `resolverWsAdmin` (sólo el admin del negocio).
//
// app/onboarding/Archivero.tsx usa esto desde el 15/10/2026 (ACCEPT, labelAnalizar y los tres fetch
// de `analizar`); tests/m-second-brain.test.ts falla si vuelve a tener su copia. ⚠️ Le queda la suya
// de `normalizarUrlArchivero` (en main se llama `urlDelLink`): no se tocó para no pisar ese renombre.
// =============================================================================

/** Lo que el Archivero sabe leer (lo mismo que acepta su server: texto, Word, PDF o imagen). */
export const ACEPTA_ARCHIVERO = '.txt,.md,.markdown,.docx,.pdf,image/*';

/** Una web escrita a mano («tunegocio.com») como URL, o null si no lo parece. */
export function normalizarUrlArchivero(u: string): string | null {
  let s = u.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const url = new URL(s);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch { return null; }
}

/** El objeto del botón «Analizar …»: «1 documento», «2 webs», «3 cosas». */
export function rotuloAnalizar(archivos: number, webs: number): string {
  if (archivos && webs) return `${archivos + webs} cosas`;
  if (webs) return `${webs} ${webs === 1 ? 'web' : 'webs'}`;
  return `${archivos} documento${archivos === 1 ? '' : 's'}`;
}

/** Lo que contesta /api/onboarding/archivero: el estado entero del Archivero, o el error. */
export type RespuestaArchivero = {
  ok?: boolean;
  error?: string;
  warnings?: string[];
  brief?: unknown;
  [k: string]: unknown;
};

type Fetch = typeof fetch;

/**
 * Sube UN archivo y lo hace leer. `finalizar` va en el ÚLTIMO de una tanda. Lanza si la subida
 * no se pudo ni preparar ni hacer; si se subió pero no se pudo leer, devuelve la respuesta con
 * `ok: false` y su `error` (422: «No pude sacar texto de…», 400: «Necesito una IA…»).
 */
export async function subirAlArchivero(archivo: File, finalizar: boolean, f: Fetch = fetch): Promise<RespuestaArchivero> {
  const su = await (await f('/api/onboarding/archivero/upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: archivo.name, mime: archivo.type }),
  })).json().catch(() => null) as { ok?: boolean; error?: string; fileId?: string; path?: string; signedUrl?: string } | null;
  if (!su?.ok || !su.signedUrl) throw new Error(su?.error || 'No se pudo preparar la subida.');
  const up = await f(su.signedUrl, {
    method: 'PUT', headers: { 'content-type': archivo.type || 'application/octet-stream', 'x-upsert': 'true' }, body: archivo,
  });
  if (!up.ok) throw new Error(`No se pudo subir "${archivo.name}" (${up.status}).`);
  const res = await f('/api/onboarding/archivero', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'procesar', fileId: su.fileId, path: su.path, nombre: archivo.name, mime: archivo.type, tamano: archivo.size, finalizar }),
  });
  const j = await res.json().catch(() => null) as RespuestaArchivero | null;
  if (!j) throw new Error(`No se pudo procesar "${archivo.name}" (error ${res.status}).`);
  return j;
}

/** Hace leer UNA web (el server la baja con su baranda anti-SSRF). null si no contestó nada legible. */
export async function leerWebEnArchivero(url: string, finalizar: boolean, f: Fetch = fetch): Promise<RespuestaArchivero | null> {
  const res = await f('/api/onboarding/archivero', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'procesar-link', url, finalizar }),
  });
  return await res.json().catch(() => null) as RespuestaArchivero | null;
}

/** ¿Lo leyó? La misma vara que el escritorio: sin `ok: false` y con el brief de vuelta. */
export const leido = (j: RespuestaArchivero | null): boolean => !!j && j.ok !== false && !!j.brief;
