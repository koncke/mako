// =============================================================================
// La miniatura de una pieza se BAJA y se guarda, en vez de apuntar al CDN ajeno
// =============================================================================
// Martín, 2/11/2026: «no quiero que se vea texto. Si tenemos que descargar la imagen de la
// miniatura y guardarla, lo hacemos, pero es importante que eso se vea bien».
//
// ⚠️ POR QUÉ NO ALCANZABA CON GUARDAR LA URL, que es lo que hacía 0359 a propósito. Dos cosas
// distintas, y las dos pasaban a la vez:
//
//   1. **La URL del CDN de Meta VENCE.** Eso ya se sabía y era el motivo de no guardarla.
//   2. **El CDN de Meta devuelve 403 a cualquier pedido que venga de otro dominio**, venza o no.
//      Eso NO se sabía, y es lo que hacía que en producción no se viera NINGUNA miniatura de
//      Instagram: la tarjeta quedaba como una caja de color vacía. Un `referrerPolicy` lo tapa a
//      veces; bajarla lo arregla siempre.
//
// Y el motivo de producto, que lo dio Martín y decide el diseño: la miniatura de un video largo
// «puede llegar a servir de referencia para crear miniaturas luego para los propios usuarios de
// MaKo». Una URL que vence no sirve de referencia; un archivo sí.
//
// ⚠️ LA RUTA NO LLEVA EL NEGOCIO: `spy/<canal>/<ref>.<ext>`. La miniatura de `@leilahormozi` es
// la misma para todos los que la miren, así que se baja UNA vez y la aprovechan todos. Es la
// misma idea que la de compartir Spy: se comparte lo caro, nunca la lista de cada negocio.
//
// ⚠️ SI BAJARLA FALLA, NO SE ROMPE LA LECTURA. Se devuelve la URL original y la pieza se guarda
// igual: una miniatura es una comodidad, y perder el competidor entero por una imagen sería
// cambiar un problema chico por uno grande.

import { getSupabaseServer } from './supabase';

export const BUCKET_MINIATURAS = 'spy-miniaturas';

/** Cuántas se bajan a la vez. Más no acelera: lo que manda es el CDN del otro lado. */
const EN_PARALELO = 6;

/** El tope por archivo, igual al del bucket. Una miniatura que pesa más no es una miniatura. */
const PESO_MAXIMO = 2 * 1024 * 1024;

/** Cuánto se espera a un CDN ajeno antes de rendirse con esa imagen. */
const ESPERA_MS = 4_000;

/**
 * Cuánto tiempo TOTAL puede gastar una lectura bajando imágenes.
 *
 * ⚠️ ESTO NO ES UNA OPTIMIZACIÓN, ES LO QUE EVITA ROMPER «REVISAR AHORA». Esta función corre
 * ADENTRO de `guardarVistas`, que a su vez corre adentro de la acción que el usuario dispara. Spy
 * no declara `maxDuration`, así que vale el tope por defecto de Vercel. Con 50 piezas, de a 6 y
 * hasta 4 s cada una, el peor caso son ~36 s sólo de imágenes: más que el tope, y la lectura
 * entera se cae — justo la que trae los datos.
 *
 * Con presupuesto, lo peor que pasa es que algunas miniaturas queden apuntando al CDN de origen
 * en esta vuelta. No se pierden: `miniatura_guardada_en` queda en null y `esNuestra` hace que la
 * próxima lectura siga por las que faltan. Converge en dos o tres vueltas sin romper ninguna.
 */
const PRESUPUESTO_MS = 9_000;

/**
 * El tipo REAL del archivo, por sus primeros bytes — nunca por el `content-type` que declara un
 * servidor ajeno ni por la extensión de la URL. Devuelve null si no es una imagen que aceptamos.
 */
export function tipoDeImagen(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  const riff = String.fromCharCode(b[0], b[1], b[2], b[3]);
  const webp = String.fromCharCode(b[8], b[9], b[10], b[11]);
  if (riff === 'RIFF' && webp === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** La ruta de una pieza adentro del bucket. Determinista: la misma pieza siempre cae en el mismo lugar. */
export const rutaDeMiniatura = (canal: string, ref: string, ext: string): string =>
  `spy/${canal}/${ref.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)}.${ext}`;

/** Si una URL ya es nuestra: no se vuelve a bajar lo que ya bajamos. */
export const esNuestra = (url: string | null | undefined): boolean =>
  !!url && url.includes(`/storage/v1/object/public/${BUCKET_MINIATURAS}/`);

type Pieza = { canal: string; ref: string; miniatura?: string | null };

/**
 * Baja una miniatura y la guarda. Devuelve nuestra URL pública, o la original si no se pudo.
 *
 * ⚠️ Nunca tira. Quien la llama está en medio de una lectura que no se puede perder por una imagen.
 */
async function guardarUna(p: Pieza): Promise<string | null> {
  const url = p.miniatura ?? null;
  if (!url || !url.startsWith('https://')) return url;
  if (esNuestra(url)) return url;

  try {
    const corte = AbortSignal.timeout(ESPERA_MS);
    // Sin `referer`: el CDN de Meta devuelve 403 a lo que venga de otro dominio.
    const r = await fetch(url, { signal: corte, referrerPolicy: 'no-referrer', redirect: 'follow' });
    if (!r.ok) return url;

    const buf = new Uint8Array(await r.arrayBuffer());
    if (!buf.length || buf.length > PESO_MAXIMO) return url;
    const tipo = tipoDeImagen(buf);
    // Lo que no es una imagen de verdad no entra: un CDN puede contestar 200 con una página de error.
    if (!tipo) return url;

    const ruta = rutaDeMiniatura(p.canal, p.ref, tipo.ext);
    const db = getSupabaseServer();
    const { error } = await db.storage.from(BUCKET_MINIATURAS)
      .upload(ruta, buf, { contentType: tipo.mime, upsert: true, cacheControl: '31536000' });
    if (error) return url;

    const { data } = db.storage.from(BUCKET_MINIATURAS).getPublicUrl(ruta);
    return data?.publicUrl || url;
  } catch {
    // Un CDN que no contesta, un timeout, un bucket que no existe todavía: se sigue con la de él.
    return url;
  }
}

/**
 * Baja las miniaturas de un lote de piezas, de a `EN_PARALELO`, y devuelve las piezas con la
 * `miniatura` ya apuntando a la nuestra donde se pudo.
 *
 * Las que no tienen miniatura, o ya la tienen guardada, no cuestan nada: salen por el camino corto.
 */
export async function guardarMiniaturas<T extends Pieza>(piezas: readonly T[]): Promise<T[]> {
  const out = piezas.slice() as T[];
  const pendientes = out
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !!p.miniatura && !esNuestra(p.miniatura));

  const hasta = Date.now() + PRESUPUESTO_MS;
  for (let desde = 0; desde < pendientes.length; desde += EN_PARALELO) {
    // Se corta ANTES de empezar una tanda nueva, nunca en el medio de una: cortar a mitad dejaría
    // subidas a medio hacer. Las que no entraron quedan con su URL original y las toma la próxima.
    if (Date.now() >= hasta) break;
    const tanda = pendientes.slice(desde, desde + EN_PARALELO);
    const urls = await Promise.all(tanda.map(({ p }) => guardarUna(p)));
    tanda.forEach(({ i }, k) => { out[i] = { ...out[i], miniatura: urls[k] }; });
  }
  return out;
}

/**
 * La caricatura ya hecha de alguna de estas cuentas (`refDeCuenta`: `instagram-den.borgg`), o null. Se guarda por
 * cuenta y no por negocio (lib/spy-caricatura-cola.ts), así que si existe la hizo el Runner para alguien que mira a la
 * misma persona. Nunca tira: sin poder mirar, se encola igual y el Runner la hace.
 */
export async function caricaturaGuardada(refs: readonly string[]): Promise<string | null> {
  const db = getSupabaseServer();
  for (const ref of refs) {
    // El nombre sin la extensión: la caricatura puede ser jpg, png o webp.
    const nombre = rutaDeMiniatura('caricatura', ref, 'x').split('/').pop()!.replace(/x$/, '');
    try {
      const { data, error } = await db.storage.from(BUCKET_MINIATURAS).list('spy/caricatura', { search: nombre, limit: 10 });
      if (error) continue;
      const f = (data ?? []).find((o) => o.name.startsWith(nombre));
      if (!f) continue;
      const { data: pub } = db.storage.from(BUCKET_MINIATURAS).getPublicUrl(`spy/caricatura/${f.name}`);
      const v = Date.parse(String((f as { updated_at?: string }).updated_at ?? '')) || 0;
      if (pub?.publicUrl) return `${pub.publicUrl}?v=${v}`;
    } catch { /* sin poder mirar: la próxima */ }
  }
  return null;
}
