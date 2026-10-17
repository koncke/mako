import 'server-only';

// =============================================================================
// Los adjuntos de un trabajo del Ops Center: guardarlos, dárselos al cartero y borrarlos (17/10/2026)
// =============================================================================
// Martín: adjuntar fotos y PDF en la caja (también pegar una captura con Ctrl+V) y que le lleguen al chat. Dio el OK de que
// un archivo baje a la PC; las condiciones están en lib/operaciones-reglas.ts («Los adjuntos de un trabajo»).
//
// ⚠️ LO QUE PROTEGE ES LA FIRMA, NO ESTE ARCHIVO. El navegador calcula el sha256 de los bytes que sube y lo firma con el
//    trabajo; la PC compara lo que baja con ESE hash (cartero.mjs → bajarAdjuntos). Este servidor guarda y entrega bytes:
//    si mintiera, la PC no los acepta.
// ⚠️ SÓLO SE ENTREGA UN ADJUNTO DE UN TRABAJO EN VUELO: `tomado` (lo reclamó un cartero y todavía no acusó) y nombrado en su
//    texto firmado. Quien robe el token del cartero no puede pedir cualquier archivo del bucket: sólo los de un trabajo que
//    la PC está por entregar.
// ⚠️ EL BINARIO NO QUEDA: se borra cuando el trabajo termina para la PC (cualquier acuse), cuando se cancela y cuando
//    vence. Lo subido que nunca se firmó (se cerró la pestaña entre subir y firmar) queda: no hay barrido todavía.

import { createHash, randomUUID } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { BUCKET_ADJUNTOS } from './chart-chats';
import { validarAdjuntos } from './mako-adjuntos';
import { MIMES_ADJUNTO, UUID_RE, leerFirmable, type AdjuntoPedido, type MimeAdjunto } from './operaciones-reglas';

/** Fuera de los `<ws>/…` del Archivero: los trabajos del Centro son de la plataforma, como sus tablas (mig 0285). */
const rutaDe = (ref: string) => `operaciones/${ref}`;
const bucket = () => getSupabaseServer().storage.from(BUCKET_ADJUNTOS);

export type SubidaAdjuntos = { ok: true; adjuntos: AdjuntoPedido[] } | { ok: false; error: string };

/** Guarda lo que mandó la caja. Lo valida como el chat con MaKo (cuántos, cuánto pesan y qué son por sus BYTES). */
export async function subirAdjuntosCentro(lista: ReadonlyArray<{ nombre: string; mime: string; bytes: Uint8Array }>): Promise<SubidaAdjuntos> {
  if (!lista.length) return { ok: false, error: 'No llegó ningún archivo.' };
  const v = validarAdjuntos(lista);
  if (!v.ok) return v;
  const subidos: AdjuntoPedido[] = [];
  for (const a of v.adjuntos) {
    if (!(MIMES_ADJUNTO as readonly string[]).includes(a.mime)) return { ok: false, error: 'Solo fotos (JPG, PNG, WEBP, GIF) o PDF.' };
    const ref = randomUUID();
    const { error } = await bucket().upload(rutaDe(ref), Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
    if (error) {
      await borrarRefs(subidos.map((s) => s.ref));
      return { ok: false, error: `No pude guardar «${a.nombre}»: vuelve a intentarlo.` };
    }
    subidos.push({
      ref, nombre: a.nombre.replace(/[\u0000-\u001f]/g, '').trim() || 'adjunto', mime: a.mime as MimeAdjunto,
      bytes: a.bytes.byteLength, sha256: createHash('sha256').update(a.bytes).digest('hex'),
    });
  }
  return { ok: true, adjuntos: subidos };
}

/**
 * Los bytes de un adjunto para el cartero: sólo si el trabajo está `tomado` y su texto firmado lo nombra. null = no hay
 * (o no se le da). Quien llama ya validó el token del cartero.
 */
export async function adjuntoParaElCartero(pedido: string, ref: string): Promise<Buffer | null> {
  if (!UUID_RE.test(pedido) || !UUID_RE.test(ref)) return null;
  const { data, error } = await getSupabaseServer().from('operaciones_pedidos').select('firmado')
    .eq('id', pedido).eq('estado', 'tomado').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.firmado) return null;
  if (!refsDe(data.firmado as string).includes(ref)) return null;
  const { data: blob, error: e2 } = await bucket().download(rutaDe(ref));
  if (e2 || !blob) return null;
  return Buffer.from(await blob.arrayBuffer());
}

/** Los `ref` que nombra un texto firmado (vacío si no tiene adjuntos o no se lee). */
export function refsDe(firmado: string): string[] {
  const l = leerFirmable(firmado, Date.now());
  // Un trabajo vencido también se limpia: para BORRAR alcanza con que el texto nombre el adjunto.
  if (l.ok) return (l.p.adjuntos ?? []).map((a) => a.ref);
  try {
    const o = JSON.parse(firmado) as { adjuntos?: unknown };
    return Array.isArray(o.adjuntos) ? o.adjuntos.map((a) => (a as { ref?: unknown })?.ref).filter((r): r is string => typeof r === 'string' && UUID_RE.test(r)) : [];
  } catch {
    return [];
  }
}

/** Borra los binarios de estos trabajos (los que ya terminaron). Nunca tira: es limpieza. */
export async function borrarAdjuntosDe(firmados: ReadonlyArray<string | null | undefined>): Promise<void> {
  await borrarRefs(firmados.flatMap((f) => (f ? refsDe(f) : [])));
}

async function borrarRefs(refs: readonly string[]): Promise<void> {
  if (!refs.length) return;
  await bucket().remove(refs.map(rutaDe)).then(() => null, () => null);
}
