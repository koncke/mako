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
// ⚠️ SÓLO SE ENTREGA UN ADJUNTO DE UN TRABAJO EN VUELO: `tomado` hace menos de `VENTANA_ADJUNTO_MS` (lo reclamó un
//    cartero y todavía no acusó) y nombrado en su texto firmado. Lo `tomado` que nunca acusa vence a las 2 horas
//    (`TOMADO_VENCE_MS`, lib/operaciones.ts → cicloCartero) y su binario se borra. Quien robe el token del cartero no puede pedir cualquier archivo del bucket: sólo los de un trabajo que
//    la PC está por entregar.
// ⚠️ EL BINARIO NO QUEDA: se borra cuando el trabajo termina para la PC (cualquier acuse), cuando se cancela y cuando
//    vence. Lo subido que nunca se firmó (se cerró la pestaña entre subir y firmar) queda: no hay barrido todavía.

import { createHash, randomUUID } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { BUCKET_ADJUNTOS } from './chart-chats';
import { validarAdjuntos } from './mako-adjuntos';
import {
  DESTINO_RE, MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, MAX_BYTES_ADJUNTO_TURNO, MAX_NOMBRE_ADJUNTO, MIMES_ADJUNTO, MIMES_ADJUNTO_TURNO, UUID_RE,
  leerFirmable, refAdjuntoTurno, type AdjuntoPedido, type MimeAdjunto, type TurnoChat,
} from './operaciones-reglas';

/** Fuera de los `<ws>/…` del Archivero: los trabajos del Centro son de la plataforma, como sus tablas (mig 0285). */
const rutaDe = (ref: string) => `operaciones/${ref}`;
const bucket = () => getSupabaseServer().storage.from(BUCKET_ADJUNTOS);
/** Un adjunto se da sólo en este rato desde que la PC tomó su trabajo: lo baja en la misma vuelta (segundos). */
export const VENTANA_ADJUNTO_MS = 15 * 60 * 1000;

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

// ── Los archivos grandes (cartero 1.16.0, 18/10/2026): directo al storage, sin pasar por Vercel ────────────────────────
// Martín: «quita esa limitación» (los 4 MB). Una ruta de Vercel no deja pasar más de ~4,5 MB, ni de ida ni de vuelta. Ahora
// el navegador pide acá una URL firmada por archivo y lo sube DIRECTO al storage; la PC pide otra para bajarlo. Lo que
// protege sigue siendo la firma: el navegador firma el sha256 que calculó él, y la PC compara lo que baja con ése.
/** Cuánto vale la URL para bajar. La de subir vale 2 horas (la fija Supabase): alcanza para un archivo grande. */
const BAJADA_VENCE_S = 5 * 60;

export type SubidasFirmadas = { ok: true; subidas: { ref: string; url: string }[] } | { ok: false; error: string };

/** Una URL firmada por archivo, para que el navegador lo suba directo. Mira lo que se puede mirar sin los bytes (cuántos,
 *  cuánto pesan, el tipo que declaran); el tipo por los BYTES lo mira el navegador antes y la PC al bajarlo. */
export async function firmarSubidasCentro(lista: unknown): Promise<SubidasFirmadas> {
  if (!Array.isArray(lista) || !lista.length) return { ok: false, error: 'No llegó ningún archivo.' };
  if (lista.length > MAX_ADJUNTOS) return { ok: false, error: `Máximo ${MAX_ADJUNTOS} archivos.` };
  for (const a of lista) {
    const o = (a ?? {}) as Record<string, unknown>;
    if (typeof o.nombre !== 'string' || !o.nombre.trim() || o.nombre.length > MAX_NOMBRE_ADJUNTO) return { ok: false, error: 'Falta el nombre del archivo.' };
    if (!(MIMES_ADJUNTO as readonly unknown[]).includes(o.mime)) return { ok: false, error: 'Solo fotos (JPG, PNG, WEBP, GIF) o PDF.' };
    if (typeof o.bytes !== 'number' || !Number.isInteger(o.bytes) || o.bytes < 1 || o.bytes > MAX_BYTES_ADJUNTO) {
      return { ok: false, error: `Hasta ${MAX_BYTES_ADJUNTO / 1024 / 1024} MB cada uno.` };
    }
  }
  const subidas: { ref: string; url: string }[] = [];
  for (let i = 0; i < lista.length; i += 1) {
    const ref = randomUUID();
    const { data, error } = await bucket().createSignedUploadUrl(rutaDe(ref));
    if (error || !data?.signedUrl) return { ok: false, error: 'No pude preparar la subida: vuelve a intentarlo.' };
    subidas.push({ ref, url: data.signedUrl });
  }
  return { ok: true, subidas };
}

// ── Lo que Martín adjuntó en la app de Claude (20/10/2026, cartero 1.17.0) ─────────────────────────────────────────────
// La PC lo sube DIRECTO al storage con esta URL firmada (la pide con su token: lo valida la ruta); la pantalla lo ve con
// otra, de 10 minutos, que sólo da `turnosCentroAction` (puedeOperar). El bucket es privado: sin URL firmada, nada.
const rutaTurno = (ref: string) => `operaciones-turnos/${ref}`;
const VER_TURNO_S = 10 * 60;

/** La URL para que la PC suba un adjunto de un turno de Martín. Con `upsert`: una vuelta que se repite no falla. */
export async function firmarAdjuntoDeTurno(x: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const o = (x ?? {}) as Record<string, unknown>;
  if (typeof o.local !== 'string' || !DESTINO_RE.test(o.local)) return { ok: false, error: 'falta el chat' };
  if (typeof o.uuid !== 'string' || !/^[\w-]{8,64}$/.test(o.uuid)) return { ok: false, error: 'falta el turno' };
  if (typeof o.n !== 'number' || !Number.isInteger(o.n) || o.n < 0 || o.n > 7) return { ok: false, error: 'número inválido' };
  if (typeof o.mime !== 'string' || !MIMES_ADJUNTO_TURNO.includes(o.mime)) return { ok: false, error: 'tipo inválido' };
  if (typeof o.bytes !== 'number' || !Number.isInteger(o.bytes) || o.bytes < 1 || o.bytes > MAX_BYTES_ADJUNTO_TURNO) return { ok: false, error: 'tamaño inválido' };
  const { data, error } = await bucket().createSignedUploadUrl(rutaTurno(refAdjuntoTurno(o.local, o.uuid, o.n)), { upsert: true });
  return error || !data?.signedUrl ? { ok: false, error: 'no pude preparar la subida' } : { ok: true, url: data.signedUrl };
}

/** Los turnos con la URL firmada de cada adjunto (10 minutos), para dibujarlos. Si no se pueden firmar, van sin URL. */
export async function conUrlsDeTurnos(turnos: TurnoChat[]): Promise<TurnoChat[]> {
  const refs = turnos.flatMap((t) => t.adjuntos?.map((a) => a.ref) ?? []);
  if (!refs.length) return turnos;
  const { data } = await bucket().createSignedUrls(refs.map(rutaTurno), VER_TURNO_S).catch(() => ({ data: null }));
  const urls = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  return turnos.map((t) => (t.adjuntos?.length ? { ...t, adjuntos: t.adjuntos.map((a) => ({ ...a, url: urls.get(rutaTurno(a.ref)) })) } : t));
}

/** ¿Se le da este adjunto al cartero? Sólo si el trabajo está `tomado` hace poco y su texto firmado lo nombra. */
async function seLeDa(pedido: string, ref: string): Promise<boolean> {
  if (!UUID_RE.test(pedido) || !UUID_RE.test(ref)) return false;
  const { data, error } = await getSupabaseServer().from('operaciones_pedidos').select('firmado')
    .eq('id', pedido).eq('estado', 'tomado').gt('tomado_at', new Date(Date.now() - VENTANA_ADJUNTO_MS).toISOString()).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data?.firmado && refsDe(data.firmado as string).includes(ref);
}

/** La URL firmada (5 minutos) para que el cartero 1.16.0 baje el adjunto directo del storage. null = no se le da. */
export async function urlParaElCartero(pedido: string, ref: string): Promise<string | null> {
  if (!(await seLeDa(pedido, ref))) return null;
  const { data, error } = await bucket().createSignedUrl(rutaDe(ref), BAJADA_VENCE_S);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

/**
 * Los bytes de un adjunto para el cartero de antes de la 1.16.0 (pasan por Vercel: sólo los chicos). null = no hay
 * (o no se le da). Quien llama ya validó el token del cartero.
 */
export async function adjuntoParaElCartero(pedido: string, ref: string): Promise<Buffer | null> {
  if (!(await seLeDa(pedido, ref))) return null;
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
