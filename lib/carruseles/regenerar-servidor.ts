// =============================================================================
// carruseles/regenerar-servidor — cada lámina REGENERADA con IA desde su referencia, por ApiMart (21/11/2026)
// =============================================================================
// Lo puro (los prompts, qué se espera leer) está en ./regenerar.ts, con su porqué. Acá, la red, por lámina:
//   1. se cobran los MaKo Tokens de la imagen ANTES de pedirla (`cobrarMediosMt`, como todo medio: se cobra el intento);
//   2. el paso de TEXTO: la lámina original de base y cada texto por el suyo (Nano Banana Pro por defecto, lib/apimart.ts);
//   3. se LEE el texto de lo que salió con la IA del negocio (visión) y, si falta una palabra o está mal escrita, se vuelve a
//      generar (hasta `INTENTOS_POR_LAMINA`; el segundo intento manda la lista de los textos en orden, sin los originales);
//   4. el paso de la PERSONA, si el negocio la pone: lo que salió de base y su foto (o su personaje) de segunda referencia;
//   5. lo que salió se copia a NUESTRO bucket (el link de ApiMart vence a las 24 h). En seco, como data URL.
// Nunca tira: una lámina que no se pudo devuelve `error` con el porqué para la persona.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from '../supabase';
import { BUCKET_IMAGE } from '../image-editor/reglas';
import { generarImagen, esperarTarea } from '../apimart';
import { MODELO_IMAGEN_POR_DEFECTO, sePuedeReintentar, type IdModeloImagen } from '../apimart-reglas';
import { mtDeImagenDe } from '../mako-tokens-reglas';
import { cobrarMediosMt, devolverMediosMt } from '../mako-tokens-medidor';
import { INTENTOS_POR_LAMINA, PROMPT_DE_PERSONA, cambiosReales, escribirSinPares, promptDeTextos, textoQueFalta, textosEsperados, type PedidoDeLamina } from './regenerar';

/** La función de los MaKo Tokens y del registro de uso: regenerar una lámina de un carrusel con la IA de imagen. */
export const FEATURE_REGENERAR = 'carrusel-regenerar';

export type LaminaRegenerada =
  | { ok: true; src: string; intentos: number; faltan: string[]; sinLeer?: boolean }
  | { ok: false; error: string; sinSaldo?: boolean };

export type OpcionesRegenerar = {
  modelo?: IdModeloImagen;
  /** Hasta cuándo (epoch ms) se puede esperar a la IA de imagen. */
  hastaMs: number;
  /** En seco: no se guarda nada en el bucket (la imagen vuelve como data URL). Los MaKo Tokens se cobran igual: la IA cobra. */
  seco?: boolean;
  /** Lee el texto de una imagen (data URL) con la IA del negocio. null = no se pudo leer (la lámina se acepta sin revisar). */
  leer?: (dataUrl: string) => Promise<string | null>;
  /** Un nombre para el registro de los MaKo Tokens («Carrusel de @awakpenn, lámina 3»). */
  referencia?: string;
};

/** Baja una imagen generada y la devuelve como JPEG (las de ApiMart vienen en PNG de 2 a 3 MB). */
async function bajarComoJpeg(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const { default: sharp } = await import('sharp');
    return await sharp(Buffer.from(await r.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  } catch { return null; }
}

/** Un pedido a la IA de imagen, cobrado antes, y esperado. Devuelve la URL de lo que salió o el porqué. */
async function unPaso(referencias: readonly string[], prompt: string, o: OpcionesRegenerar): Promise<{ url: string } | { error: string; sinSaldo?: boolean; reintentable: boolean }> {
  const modelo = o.modelo ?? MODELO_IMAGEN_POR_DEFECTO;
  const mt = mtDeImagenDe(modelo);
  const sinSaldo = await cobrarMediosMt(mt, { feature: FEATURE_REGENERAR, referencia: o.referencia ?? null });
  if (sinSaldo) return { error: sinSaldo, sinSaldo: true, reintentable: false };
  const a = await generarImagen({ referencias, prompt, modelo, formato: '4:5' });
  if (a.estado === 'rechazado') {
    // No arrancó: el proveedor no cobró, y se devuelve lo cobrado.
    await devolverMediosMt(mt, { feature: FEATURE_REGENERAR, referencia: o.referencia ?? null }).catch(() => {});
    return { error: a.sinSaldo ? 'La generación de imágenes de MaKo está sin crédito en este momento. Avísanos y lo resolvemos.' : `La IA de imagen no aceptó el pedido: ${a.porque}`, reintentable: sePuedeReintentar(a) && !a.sinSaldo };
  }
  if (a.estado === 'desconocido') return { error: 'No supe si la imagen arrancó (se cortó la conexión con el proveedor).', reintentable: false };
  const r = await esperarTarea(a.taskId, { hastaMs: o.hastaMs, cadaMs: 4000 });
  if (r.fase === 'listo') return { url: r.url };
  return { error: r.fase === 'error' ? `La IA de imagen falló: ${r.detalle}` : 'La IA de imagen tardó demasiado.', reintentable: r.fase === 'error' };
}

/**
 * Lo que falta escribir en una imagen: vacío = bien escrita; `null` = NO SE PUDO LEER (o no hay con qué). ⚠️ Hasta el 21/11/2026 un
 * «no pude leer» volvía vacío, como «bien escrita»: las láminas 5 y 6 del de Hormozi salieron en inglés, iguales a la referencia, sin
 * ningún aviso. Ahora quien llama lo distingue (`escribirSinPares`, `sinLeer`).
 */
async function revisar(jpeg: Buffer, esperados: readonly string[], o: OpcionesRegenerar): Promise<string[] | null> {
  if (!esperados.length) return [];
  if (!o.leer) return null;
  const leido = await o.leer(`data:image/jpeg;base64,${jpeg.toString('base64')}`).catch(() => null);
  return leido == null ? null : textoQueFalta(leido, esperados);
}

/**
 * UNA lámina regenerada: el texto (con su revisión y sus reintentos) y después la persona. Si el texto no queda bien escrito en
 * ningún intento, vuelve el que menos falla con `faltan` (quien llama lo dice; nunca se entrega callado).
 */
export async function regenerarLamina(ws: number, p: PedidoDeLamina, o: OpcionesRegenerar): Promise<LaminaRegenerada> {
  const esperados = textosEsperados(p.cambios);
  let mejor: { jpeg: Buffer; url: string; faltan: string[]; sinLeer: boolean } | null = null;
  let intentos = 0;
  // ⚠️ LOS PARES NO SIEMPRE DICEN LA VERDAD (21/11/2026, el carrusel de Ramiro): la IA principal escribió el texto NUEVO también en
  // «original», los pares no cambiaban nada, la lámina se salteaba y salía IGUAL a la referencia, sin revisar. Sin un par que
  // cambie algo, primero se LEE la original: si ya dice lo esperado, no se genera; si no, va la lista en orden desde el primer intento.
  let enOrdenDesdeElPrimero = false;
  let hayQueEscribir = cambiosReales(p.cambios).length > 0;
  if (!hayQueEscribir && esperados.length) {
    const m = /^data:image\/[a-z]+;base64,(.+)$/.exec(p.base);
    const original = m ? Buffer.from(m[1], 'base64') : await bajarComoJpeg(p.base);
    // Sin poder leerla, se escribe igual: saltearla entregaba la referencia tal cual (Hormozi 5 y 6).
    if (escribirSinPares(original ? await revisar(original, esperados, o) : null)) { hayQueEscribir = true; enOrdenDesdeElPrimero = true; }
  }
  // 1. El texto. Sin nada que cambiar, la base va tal cual a la persona.
  if (hayQueEscribir) {
    for (let i = 0; i < INTENTOS_POR_LAMINA && Date.now() < o.hastaMs; i++) {
      intentos++;
      const prompt = i === 0 && !enOrdenDesdeElPrimero ? promptDeTextos(p.cambios) : promptDeTextos(p.cambios, { enOrden: esperados });
      const paso = await unPaso([p.base], prompt, o);
      if ('error' in paso) {
        if (!paso.reintentable || mejor) { if (!mejor) return { ok: false, error: paso.error, ...(paso.sinSaldo ? { sinSaldo: true } : {}) }; break; }
        continue;
      }
      const jpeg = await bajarComoJpeg(paso.url);
      if (!jpeg) continue;
      const leido = await revisar(jpeg, esperados, o);
      const faltan = leido ?? [];
      if (!mejor || faltan.length < mejor.faltan.length) mejor = { jpeg, url: paso.url, faltan, sinLeer: leido === null };
      if (!faltan.length) break;
    }
    if (!mejor) return { ok: false, error: 'La IA de imagen no devolvió la lámina.' };
  }
  // 2. La persona, sobre lo que salió (o sobre la original si no había texto que cambiar): UN paso más, nunca un tercero.
  if (p.persona && Date.now() < o.hastaMs) {
    const base = mejor?.url ?? p.base;
    intentos++;
    const paso = await unPaso([base, p.persona], PROMPT_DE_PERSONA, o);
    if (!('error' in paso)) {
      const jpeg = await bajarComoJpeg(paso.url);
      if (jpeg) {
        const leido = await revisar(jpeg, esperados, o);
        const faltan = leido ?? [];
        // Si poner a la persona rompió el texto, queda la de antes (con la persona del original) y se dice.
        if (!mejor || faltan.length <= mejor.faltan.length) mejor = { jpeg, url: paso.url, faltan, sinLeer: leido === null };
      }
    } else if (!mejor) return { ok: false, error: paso.error, ...(paso.sinSaldo ? { sinSaldo: true } : {}) };
  }
  if (!mejor) {
    // Sin texto ni persona que cambiar: la original tal cual.
    return { ok: true, src: p.base, intentos, faltan: [] };
  }
  if (o.seco) return { ok: true, src: `data:image/jpeg;base64,${mejor.jpeg.toString('base64')}`, intentos, faltan: mejor.faltan, sinLeer: mejor.sinLeer };
  const ruta = `${ws}/regenerada-${randomUUID()}.jpg`;
  const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
  const up = await bucket.upload(ruta, mejor.jpeg, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  if (up.error) return { ok: false, error: `No pude guardar la lámina: ${up.error.message}` };
  return { ok: true, src: bucket.getPublicUrl(ruta).data.publicUrl, intentos, faltan: mejor.faltan, sinLeer: mejor.sinLeer };
}

/** Varias láminas a la vez, de a `deA` (el proveedor y la memoria agradecen no mandar doce juntas). En el mismo orden. */
export async function regenerarLaminas(ws: number, pedidos: readonly PedidoDeLamina[], o: OpcionesRegenerar & { deA?: number }): Promise<LaminaRegenerada[]> {
  const out: LaminaRegenerada[] = new Array(pedidos.length);
  let siguiente = 0;
  const trabajar = async () => {
    while (siguiente < pedidos.length) {
      const i = siguiente++;
      out[i] = await regenerarLamina(ws, pedidos[i], { ...o, referencia: `${o.referencia ?? 'Carrusel'}, lámina ${i + 1}` })
        .catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(pedidos.length, Math.max(1, o.deA ?? 4)) }, trabajar));
  return out;
}
