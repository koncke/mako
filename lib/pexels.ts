// =============================================================================
// pexels — buscar y bajar fotos de Pexels con la clave DEL NEGOCIO (el B-roll del Video Editor)
// =============================================================================
// Por qué Pexels y no el repositorio de las portadas: lib/editor-video/broll-pexels.ts (la licencia deja el uso
// comercial; Openverse quedó «licencia no verificada» para anuncios).
//
// Las reglas, las mismas de lib/imagenes-stock.ts:
//   · EL NAVEGADOR MANDA UN ID, NUNCA UNA URL A BAJAR. Con el id, la URL la dice la API de Pexels, y sólo se baja si es
//     de images.pexels.com (`urlDeFotoPexels`), con la baranda de lib/fetch-seguro.ts (cada salto revalidado, la IP
//     clavada, 3 MB como techo mientras se lee).
//   · EL TIPO SE DECIDE POR MAGIC BYTES (`sniffImagen`), nunca por el content-type de un tercero.
//   · La clave es la del negocio, leída ESTRICTA (`credDelClienteEstricta`): sin respaldo de la plataforma, y «no pude
//     leer» no se confunde con «no tiene» (la regla de Zernio, 23/10/2026).
// =============================================================================

import 'server-only';
import { credDelClienteEstricta } from './credenciales';
import { fetchSeguro } from './fetch-seguro';
import { bajarWebSegura, pedirClavado } from './archivero-bajada';
import { validarDestino } from './landing-fetch';
import { sniffImagen } from './editor-landing/server-reglas';
import {
  FALLA_VIDEO_PEXELS,
  MAX_BYTES_VIDEO_BROLL,
  ORIGEN_API_PEXELS,
  PLAZO_VIDEO_BROLL_MS,
  TOPES_VIDEO_BROLL,
  archivosDeVideoPexels,
  errorDePexels,
  fotoDePexels,
  orientacionPexels,
  primerVideoQueEntra,
  urlDeFotoPexels,
  videoDePexels,
  type FotoBroll,
  type OrientacionBroll,
  type VideoBroll,
} from './editor-video/broll-pexels';

export const CLAVE_PEXELS = 'PEXELS_API_KEY';

export type FallaPexels = { ok: false; error: string; status: number; falta?: { servicio: 'pexels' } };

/** La clave del negocio. `falta` cuando no la cargó: la pantalla ofrece conectarla ahí mismo. */
export async function clavePexels(ws: number): Promise<{ ok: true; clave: string } | FallaPexels> {
  try {
    const clave = await credDelClienteEstricta(CLAVE_PEXELS, ws, { ilegibleTira: true });
    if (!clave) return { ok: false, error: 'Conecta Pexels para buscar las imágenes del B-roll.', status: 409, falta: { servicio: 'pexels' } };
    return { ok: true, clave };
  } catch (e) {
    console.error('[pexels] no pude leer la clave', e);
    return { ok: false, error: 'No pude leer tu conexión con Pexels. Vuelve a intentar.', status: 503 };
  }
}

async function pedir(clave: string, ruta: string, params: Record<string, string> = {}): Promise<{ ok: true; cuerpo: unknown } | FallaPexels> {
  const url = new URL(ruta, ORIGEN_API_PEXELS);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    // La API es un host fijo (no lo escribe nadie): `fetch` con plazo alcanza. Lo que se BAJA de su respuesta va por
    // fetchSeguro (`bajarFotoPexels`).
    const r = await fetch(url, { headers: { Authorization: clave }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (!r.ok) return { ok: false, error: errorDePexels(r.status), status: r.status === 429 ? 429 : 502 };
    return { ok: true, cuerpo: await r.json() };
  } catch (e) {
    const plazo = e instanceof Error && e.name === 'TimeoutError';
    return { ok: false, error: plazo ? 'Pexels tardó demasiado. Vuelve a intentar.' : 'No pude hablar con Pexels.', status: 502 };
  }
}

/** Las primeras `cuantas` fotos para una búsqueda, en la orientación del video. */
export async function buscarFotosPexels(
  clave: string,
  consulta: string,
  { orientacion, cuantas = 3 }: { orientacion: OrientacionBroll; cuantas?: number },
): Promise<{ ok: true; fotos: FotoBroll[] } | FallaPexels> {
  const r = await pedir(clave, '/v1/search', {
    query: consulta.slice(0, 80),
    orientation: orientacionPexels(orientacion),
    per_page: String(Math.max(1, Math.min(15, cuantas))),
    // La búsqueda sin IA va en español (las palabras de la frase); con IA, en inglés. Pexels entiende las dos con el
    // `locale` en español.
    locale: 'es-ES',
  });
  if (!r.ok) return r;
  const fotos = ((r.cuerpo as { photos?: unknown[] }).photos ?? []).map(fotoDePexels).filter((f): f is FotoBroll => f !== null);
  return { ok: true, fotos };
}

/** Los bytes de la foto `id`, en la orientación del video. La URL la dice Pexels, no el navegador. */
export async function bajarFotoPexels(
  clave: string,
  id: number,
  orientacion: OrientacionBroll,
): Promise<{ ok: true; bytes: Uint8Array; tipo: string; autor: string } | FallaPexels> {
  const r = await pedir(clave, `/v1/photos/${id}`);
  if (!r.ok) return r;
  const url = urlDeFotoPexels(r.cuerpo, orientacion);
  const foto = fotoDePexels(r.cuerpo);
  if (!url || !foto) return { ok: false, error: 'Pexels no devolvió esa foto.', status: 404 };
  try {
    const res = await fetchSeguro(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: errorDePexels(res.status), status: 502 };
    const bytes = new Uint8Array(await res.arrayBuffer());
    const tipo = sniffImagen(bytes);
    if (!tipo) return { ok: false, error: 'Lo que bajó de Pexels no es una imagen.', status: 502 };
    return { ok: true, bytes, tipo, autor: foto.autor };
  } catch (e) {
    console.error('[pexels] no pude bajar la foto', e);
    return { ok: false, error: 'No pude bajar la foto de Pexels.', status: 502 };
  }
}

// ── Los videos (10/11/2026, pendientes-video-editor.md §4.1) ─────────────────
// Los mismos pasos que las fotos: el navegador manda el ID, la URL la dice la API, y sólo se baja de videos.pexels.com
// con la baranda (`validarDestino` en cada salto, la IP clavada). La diferencia es el peso: la ruta devuelve los bytes y
// Vercel corta la respuesta en ~4,5 MB, así que se prueba el archivo más chico que se ve bien y, si pasa del techo
// (`MAX_BYTES_VIDEO_BROLL`), el siguiente; si ninguno entra, ese video no se usa (nunca un MP4 cortado a la mitad).

/** Los primeros `cuantos` videos de hasta 30 s para una búsqueda, en la orientación del video. */
export async function buscarVideosPexels(
  clave: string,
  consulta: string,
  { orientacion, cuantos = 4 }: { orientacion: OrientacionBroll; cuantos?: number },
): Promise<{ ok: true; videos: VideoBroll[] } | FallaPexels> {
  const r = await pedir(clave, '/videos/search', {
    query: consulta.slice(0, 80),
    orientation: orientacionPexels(orientacion),
    // Pide de más: los que duran más de 30 s se descartan acá.
    per_page: String(Math.max(1, Math.min(30, cuantos * 2))),
    locale: 'es-ES',
  });
  if (!r.ok) return r;
  const videos = ((r.cuerpo as { videos?: unknown[] }).videos ?? [])
    .map(videoDePexels)
    .filter((v): v is VideoBroll => v !== null && v.duracion <= TOPES_VIDEO_BROLL.duracionMax)
    .slice(0, Math.max(1, Math.min(15, cuantos)));
  return { ok: true, videos };
}

/**
 * Los bytes del video `id` (un MP4 de hasta `MAX_BYTES_VIDEO_BROLL`). La URL la dice Pexels, no el navegador. Todo dentro
 * de UN plazo (`PLAZO_VIDEO_BROLL_MS`): la API, cada archivo y cada salto (lib/editor-video/broll-pexels.ts).
 */
export async function bajarVideoPexels(
  clave: string,
  id: number,
  reloj: () => number = Date.now,
): Promise<{ ok: true; bytes: Uint8Array; autor: string } | FallaPexels> {
  const limite = reloj() + PLAZO_VIDEO_BROLL_MS;
  const r = await pedir(clave, `/videos/videos/${id}`);
  if (!r.ok) return r;
  const video = videoDePexels(r.cuerpo);
  const candidatos = archivosDeVideoPexels(r.cuerpo);
  if (!video || !candidatos.length) return { ok: false, error: 'Pexels no tiene ese video en un tamaño que sirva.', status: 404 };
  // Tres intentos como mucho: cada uno puede bajar hasta 4 MB.
  const hecho = await primerVideoQueEntra({
    candidatos,
    reloj,
    limite,
    alFallar: (e) => console.error('[pexels] no pude bajar el video', e),
    bajar: async (url, plazoDelSalto) => {
      const bajada = await bajarWebSegura(url, {
        validar: validarDestino,
        // `pedirClavado` CORTA en `maxBytes` (no falla): con un byte más que el techo, si lo llega a leer, el archivo
        // pasa del techo y se prueba uno más chico. Nunca se devuelve un MP4 cortado a la mitad. Cada salto, con lo que
        // queda del plazo total.
        pedir: (u, ips) => {
          const ms = plazoDelSalto();
          if (!ms) throw new Error('Se terminó el plazo para traer el video.');
          return pedirClavado(u, ips, undefined, { maxBytes: MAX_BYTES_VIDEO_BROLL + 1, timeoutMs: ms });
        },
      });
      return { status: bajada.status, cuerpo: new Uint8Array(bajada.cuerpo) };
    },
  });
  return hecho.ok ? { ok: true, bytes: hecho.bytes, autor: video.autor } : { ok: false, ...FALLA_VIDEO_PEXELS[hecho.motivo] };
}
