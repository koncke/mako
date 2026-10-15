// =============================================================================
// apify — el cliente de la API de Apify, con la key del NEGOCIO (BYOK)
// =============================================================================
// Donde corre el Leads Scraper (docs/diseno-leads-scraper.md §5, decisión 5): una búsqueda de
// 1.000 resultados tarda más que los 300 s de una función de Vercel, así que MaKo la LANZA en Apify
// y vuelve a buscar el resultado cuando terminó (aviso de Apify o la pantalla, lo que llegue
// primero). Se paga por resultado con la cuenta de Apify de cada negocio: `APIFY_TOKEN`, guardada
// en /integraciones como cualquier credencial.
//
// La API (docs.apify.com/api/v2, consultada el 15/10/2026):
//   · POST /acts/{dueño~actor}/runs  → body = el input; `?maxItems` y `?maxTotalChargeUsd` topean lo
//     que se cobra; `?webhooks` = base64 de una lista `{ eventTypes, requestUrl, payloadTemplate }`.
//     Contesta 201 con `data.id` y `data.defaultDatasetId`, sin esperar a que termine.
//   · GET  /actor-runs/{id}          → `data.status`: READY, RUNNING, SUCCEEDED, FAILED, TIMING-OUT,
//     TIMED-OUT, ABORTING, ABORTED.
//   · GET  /datasets/{id}/items      → la lista de resultados (`clean=true`, `format=json`).
//   · GET  /users/me                 → la cuenta (el ping de /integraciones).
// ⚠️ APIFY NO FIRMA SUS AVISOS: su doc recomienda un secreto propio. Va en el CUERPO del aviso
// (`payloadTemplate`) y no en la URL, y la búsqueda guarda sólo su hash (lib/prospectos.ts).

import 'server-only';
import { mensajeDeError } from './calendly-error';

const BASE = 'https://api.apify.com/v2';
const timeout = (ms = 15_000) => AbortSignal.timeout(ms);

export type EstadoCorrida = 'corriendo' | 'termino' | 'fallo';

/** Lo que dice Apify de una corrida, en tres estados que le importan al CRM. */
export function estadoDeCorrida(status: unknown): EstadoCorrida {
  if (status === 'SUCCEEDED') return 'termino';
  if (status === 'READY' || status === 'RUNNING') return 'corriendo';
  // FAILED, TIMING-OUT, TIMED-OUT, ABORTING, ABORTED y cualquier otro: no va a llegar nada más.
  return 'fallo';
}

/** El error de Apify en una frase para la persona. Branchea por el STATUS, nunca por el texto. */
export function errorDeApify(status: number, cuerpo: unknown): string {
  if (status === 401 || status === 403) return 'Apify rechazó tu clave. Cópiala de nuevo desde Apify → Settings → API & Integrations.';
  if (status === 402) return 'A tu cuenta de Apify no le alcanza el saldo para esta búsqueda.';
  if (status === 404) return 'Apify no encontró el buscador. Avísanos: puede que lo hayan cambiado de nombre.';
  if (status === 429) return 'Apify está limitando los pedidos de tu cuenta. Prueba en unos minutos.';
  const msg = (cuerpo as { error?: { message?: unknown } } | null)?.error?.message;
  return `Apify contestó ${status}${typeof msg === 'string' && msg ? `: ${msg.slice(0, 160)}` : '.'}`;
}

async function pedir(token: string, ruta: string, init: RequestInit & { ms?: number } = {}): Promise<{ status: number; cuerpo: unknown }> {
  const r = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    cache: 'no-store',
    signal: timeout(init.ms),
  });
  let cuerpo: unknown = null;
  try { cuerpo = await r.json(); } catch { /* sin cuerpo JSON */ }
  return { status: r.status, cuerpo };
}

export type AvisoApify = { url: string; payloadTemplate: string };

/** Lanza un actor. No espera: devuelve el id de la corrida y el de su dataset. */
export async function lanzarActor(
  token: string,
  actor: string,
  input: Record<string, unknown>,
  topes: { maxItems: number; maxUsd: number },
  aviso: AvisoApify | null,
): Promise<{ ok: true; runId: string; datasetId: string } | { ok: false; error: string }> {
  const q = new URLSearchParams({ maxItems: String(topes.maxItems), maxTotalChargeUsd: String(topes.maxUsd) });
  if (aviso) {
    const webhooks = [{ eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'], requestUrl: aviso.url, payloadTemplate: aviso.payloadTemplate }];
    q.set('webhooks', Buffer.from(JSON.stringify(webhooks), 'utf8').toString('base64'));
  }
  try {
    const { status, cuerpo } = await pedir(token, `/acts/${encodeURIComponent(actor)}/runs?${q}`, { method: 'POST', body: JSON.stringify(input) });
    if (status !== 201 && status !== 200) return { ok: false, error: errorDeApify(status, cuerpo) };
    const d = (cuerpo as { data?: { id?: unknown; defaultDatasetId?: unknown } } | null)?.data;
    if (typeof d?.id !== 'string' || typeof d.defaultDatasetId !== 'string') return { ok: false, error: 'Apify no devolvió la corrida.' };
    return { ok: true, runId: d.id, datasetId: d.defaultDatasetId };
  } catch (e) {
    return { ok: false, error: `No pude hablar con Apify: ${mensajeDeError(e).slice(0, 120)}` };
  }
}

/** Cómo va una corrida. `null` = no se pudo leer (no es «falló»). */
export async function leerCorrida(token: string, runId: string): Promise<{ estado: EstadoCorrida; datasetId: string | null; status: string } | { error: string }> {
  try {
    const { status, cuerpo } = await pedir(token, `/actor-runs/${encodeURIComponent(runId)}`);
    if (status !== 200) return { error: errorDeApify(status, cuerpo) };
    const d = (cuerpo as { data?: { status?: unknown; defaultDatasetId?: unknown } } | null)?.data;
    return { estado: estadoDeCorrida(d?.status), datasetId: typeof d?.defaultDatasetId === 'string' ? d.defaultDatasetId : null, status: String(d?.status ?? '') };
  } catch (e) {
    return { error: `No pude hablar con Apify: ${mensajeDeError(e).slice(0, 120)}` };
  }
}

/** Los resultados de una corrida terminada. */
export async function itemsDelDataset(token: string, datasetId: string, limite: number): Promise<{ items: unknown[] } | { error: string }> {
  try {
    const q = new URLSearchParams({ clean: 'true', format: 'json', limit: String(Math.max(1, Math.min(limite, 1000))) });
    const { status, cuerpo } = await pedir(token, `/datasets/${encodeURIComponent(datasetId)}/items?${q}`, { ms: 30_000 });
    if (status !== 200) return { error: errorDeApify(status, cuerpo) };
    return Array.isArray(cuerpo) ? { items: cuerpo } : { error: 'Apify devolvió los resultados con otra forma.' };
  } catch (e) {
    return { error: `No pude hablar con Apify: ${mensajeDeError(e).slice(0, 120)}` };
  }
}

/** La cuenta de la key (el ping de /integraciones). */
export async function cuentaDeApify(token: string): Promise<{ ok: true; usuario: string; plan: string | null } | { ok: false; error: string }> {
  try {
    const { status, cuerpo } = await pedir(token, '/users/me', { ms: 8_000 });
    if (status !== 200) return { ok: false, error: errorDeApify(status, cuerpo) };
    const d = (cuerpo as { data?: { username?: unknown; plan?: { id?: unknown } } } | null)?.data;
    return { ok: true, usuario: typeof d?.username === 'string' ? d.username : 'tu cuenta', plan: typeof d?.plan?.id === 'string' ? d.plan.id : null };
  } catch (e) {
    return { ok: false, error: `No pude hablar con Apify: ${mensajeDeError(e).slice(0, 120)}` };
  }
}
