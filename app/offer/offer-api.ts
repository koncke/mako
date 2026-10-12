// =============================================================================
// /offer — las llamadas del navegador a /api/offer (y la subida y el PDF)
// =============================================================================
// El contrato lo implementa app/api/offer/route.ts: POST con { action, … } que
// contesta SIEMPRE { ok: true, … } o { ok: false, error }. Acá vive una sola forma
// de llamarlo para que ninguna pantalla lea `ok` a su manera.
//
// ⚠️ TODO fetch lleva `signal` (AGENTS.md: «un tope que vive en la RUTA no protege
// al cliente»). Sin él, una conexión caída en el medio deja el spinner girando para
// siempre: el `finally` que lo apaga no llega a correr. Los topes son el de la ruta
// más un margen, y los fija el contrato: turno 120 s, leer 200 s, diagnosticar y
// generar 310 s.
//
// El `?ws=` del cliente que mira el super admin lo pega solo el parche de
// app/_components/WsFetch.tsx a toda llamada a /api; la subida va a Supabase
// Storage, que no lo necesita (y el parche no la toca).

import { nombreDeDescarga } from './ayudas';
import type { OfferSesionVista } from '@/lib/offer-marco';

/**
 * El error de una llamada a /api/offer. Lleva la `sesion` cuando el servidor la
 * manda aunque haya fallado: un turno cuya IA no contestó YA guardó el mensaje del
 * dueño (y, si la conversación era nueva, la creó). Tirar esa sesión hacía que la
 * pantalla devolviera el texto al composer y, al reenviarlo, el mensaje quedara dos
 * veces — y en una conversación nueva, una sesión huérfana.
 */
export class ErrorOfferApi extends Error {
  sesion?: OfferSesionVista;
  /**
   * El HTTP de la respuesta. Decide si REINTENTAR tiene sentido: un 409 de 'generar' dice que falta el
   * diagnóstico (repetir 'generar' contesta lo mismo) y un 422 de un audio dice que no tenía voz
   * (volver a mandarlo vuelve a correr la cascada de transcripción entera, con su escalón pago).
   */
  status?: number;
}

/**
 * ¿El servidor ya dijo que mandar LO MISMO otra vez no sirve? 413 (pesa demasiado), 415 (formato que
 * no lee) y 422 (no se entendió: un audio sin voz). Un corte, un 502 o un 504 son pasajeros y sí se
 * reintentan. Pura: la ejecuta tests/offer-v2-pantalla.test.ts.
 */
export function esRechazoDefinitivo(status: number | undefined): boolean {
  return status === 413 || status === 415 || status === 422;
}

export const TOPE = {
  // El turno y la lectura también pueden llegar a los 300 s de la ruta (la red de plataforma rescata
  // hasta inicio+280 s): cortar antes en el navegador daba por fallido un mensaje que el server YA
  // había guardado, y al reenviarlo quedaba dos veces (revisión del 11/10).
  turno: 305_000,
  leer: 305_000,
  generar: 310_000,
  corto: 30_000,
  subida: 180_000,
  pdf: 120_000,
} as const;

const esCorte = (e: unknown): boolean => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');

/** El texto de un error, para pintarlo. Lo que no es un Error no trae nada legible. */
export function mensajeDeError(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Algo falló. Prueba de nuevo.';
}

/**
 * Una llamada a /api/offer. Devuelve el cuerpo si vino `ok: true` y tira con el
 * `error` del servidor si no. `corte` es lo que se dice si se pasa del tope.
 *
 * ⚠️ `ok` se lee del CUERPO, no del HTTP: el contrato manda el fallo adentro del
 * JSON, y un 200 con `ok: false` no es un éxito (AGENTS.md: «res.ok no es "salió
 * bien"»).
 */
export async function llamarOffer<T>(cuerpo: Record<string, unknown>, tope: number, corte = 'Tardó demasiado. Prueba de nuevo.'): Promise<T> {
  let r: Response;
  try {
    r = await fetch('/api/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(tope),
    });
  } catch (e) {
    throw new Error(esCorte(e) ? corte : 'Sin conexión. Prueba de nuevo.');
  }
  let j: unknown = null;
  try {
    j = await r.json();
  } catch (e) {
    // El cuerpo también corre contra el tope: un corte aquí es el mismo corte.
    if (esCorte(e)) throw new Error(corte);
  }
  const o = (j && typeof j === 'object' ? j : {}) as { ok?: unknown; error?: unknown; sesion?: unknown };
  if (o.ok !== true) {
    const err = new ErrorOfferApi(typeof o.error === 'string' && o.error.trim() ? o.error : 'No se pudo. Prueba de nuevo.');
    err.status = r.status;
    if (o.sesion && typeof o.sesion === 'object' && typeof (o.sesion as { id?: unknown }).id === 'number') err.sesion = o.sesion as OfferSesionVista;
    throw err;
  }
  return j as T;
}

/**
 * Sube un archivo a Storage y devuelve su `path`: 'subir-url' pide la URL
 * firmada y el binario va directo con un PUT (no pasa por una server action, que
 * topea en 1 MB: AGENTS.md, «tres topes del entorno»).
 */
export async function subirArchivo(f: File, mime: string): Promise<string> {
  const u = await llamarOffer<{ path: string; signedUrl: string }>(
    { action: 'subir-url', nombre: f.name, mime, tamano: f.size },
    TOPE.corto,
  );
  let r: Response;
  try {
    r = await fetch(u.signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'true', 'Content-Type': mime },
      body: f,
      signal: AbortSignal.timeout(TOPE.subida),
    });
  } catch (e) {
    throw new Error(esCorte(e) ? 'La subida tardó demasiado.' : 'No se pudo subir el archivo.');
  }
  if (!r.ok) throw new Error('No se pudo subir el archivo.');
  return u.path;
}

/**
 * Descarga el PDF de la conclusión. El nombre lo pone el servidor en el
 * Content-Disposition (es el único que sabe cómo se llama la oferta), y la URL
 * del blob se revoca DIFERIDA: en la misma vuelta Safari cancela la descarga
 * (molde: app/second-brain/ExportarCerebro.tsx).
 */
export async function descargarPdf(sesionId: number): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`/api/offer/pdf?id=${sesionId}`, { signal: AbortSignal.timeout(TOPE.pdf) });
  } catch (e) {
    throw new Error(esCorte(e) ? 'El PDF tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.');
  }
  if (!r.ok) {
    let msg = '';
    try {
      const j = (await r.json()) as { error?: unknown };
      if (typeof j?.error === 'string') msg = j.error;
    } catch { /* el cuerpo no era JSON: queda el mensaje genérico */ }
    throw new Error(msg || 'No se pudo armar el PDF.');
  }
  let blob: Blob;
  try {
    blob = await r.blob();
  } catch (e) {
    throw new Error(esCorte(e) ? 'El PDF tardó demasiado. Prueba de nuevo.' : 'No se pudo descargar el PDF.');
  }
  const nombre = nombreDeDescarga(r.headers.get('content-disposition'), `oferta-${sesionId}.pdf`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
