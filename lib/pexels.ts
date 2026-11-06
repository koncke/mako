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
import { sniffImagen } from './editor-landing/server-reglas';
import {
  ORIGEN_API_PEXELS,
  errorDePexels,
  fotoDePexels,
  orientacionPexels,
  urlDeFotoPexels,
  type FotoBroll,
  type OrientacionBroll,
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
