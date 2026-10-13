'use server';

// =============================================================================
// notas-actions — editar y borrar una nota del lead después de escrita
// =============================================================================
// Pedido de Martín (12/10/2026, punto 17): «Y una nota se debería poder editar o eliminar
// luego de ser creada».
//
// ⚠️ UNA NOTA ES UNA FILA DEL HISTORIAL: `lead_audit` con `campo = 'Nota'` (la escribe
// `addLeadNoteAction` por `logLeadEvent`, app/crm/actions.ts). No hay tabla de notas, y no se
// crea una: la ficha (NotasCard), la ficha de Customer Success y MaKo leen las notas de ahí.
// Por eso el WHERE lleva SIEMPRE `campo = 'Nota'`: sin él, un id cualquiera del historial —una
// «Etapa», un «Monto de cierre»— se podría reescribir o borrar desde el navegador, y el
// historial es lo que se audita.
//
// Las guardas son las de las vecinas (`guardarCaraLeadAction`, app/crm/lead-cabecera-actions.ts):
// sesión, la tab del CRM en la capa, y la fila del workspace de la sesión (`getTenantDb`
// inyecta el `workspace_id`; acá además va escrito, por si la tabla sale de TENANT_TABLES).
// Y una más, propia: una nota la cambia QUIEN LA ESCRIBIÓ, o un admin. Es un apunte con firma
// —«mandé WhatsApp, quedó en avisarme»—, y que un compañero pueda reescribirlo con el nombre
// de otro al pie es que la firma deje de decir quién lo dijo.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos). Un `export const`
// tipa perfecto y TIRA EL BUILD (AGENTS.md).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getTenantDb, getWorkspaceActual, getRolWsEfectivo, getCapaActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getUsuarioActual } from '@/lib/auth';
import { logLeadEvent } from '@/lib/leads';
import { tzActual } from '@/lib/timezone';
import { TOPE_NOTA, fechaDeNota, BUCKET_NOTAS_LEAD, pathDeNotaLead, pathEsNotaDelLead } from './notas-reglas';
import { esMimeNota, TOPE_NOTA_BYTES, adjuntoSeVe } from '@/app/customer-success/curso/reglas';
import { getSupabaseServer } from '@/lib/supabase';
import { randomUUID } from 'node:crypto';

export type ResultadoNota = { ok: true } | { ok: false; error: string };

type FilaNota = { id: number; lead_id: number; autor: string; valor_anterior: string | null; valor_nuevo: string | null; created_at: string; archivo_path: string | null };

/**
 * Las guardas de las dos acciones, y la nota que se va a tocar. Sin exportar (es 'use server').
 * Devuelve el error en una frase corta para la persona, o la fila y quién la toca.
 */
async function notaQueSePuedeTocar(leadId: number, notaId: number): Promise<{ ok: true; fila: FilaNota; autor: string } | { ok: false; error: string }> {
  if (!Number.isSafeInteger(leadId) || leadId <= 0 || !Number.isSafeInteger(notaId) || notaId <= 0) return { ok: false, error: 'Falta la nota.' };
  const rol = await getRolWsEfectivo();
  if (rol == null) return { ok: false, error: 'Inicia sesión para cambiar la nota.' };
  // Las notas se escriben desde DOS tabs (la ficha del CRM y la de un cliente de Customer
  // Success, que monta la misma NotasCard): alcanza con tener una de las dos.
  const capa = await getCapaActual();
  if (!tabEnCapa('crm', capa) && !tabEnCapa('customer-success', capa)) return { ok: false, error: 'No tienes acceso a esta ficha.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Elige una cuenta primero.' };

  const db = await getTenantDb();
  const { data, error } = await db
    .from('lead_audit')
    .select('id, lead_id, autor, valor_anterior, valor_nuevo, created_at, archivo_path')
    .eq('id', notaId)
    .eq('lead_id', leadId)
    .eq('campo', 'Nota')
    .eq('workspace_id', ws)
    .maybeSingle();
  // «No pude leer» no es «no existe»: se dice distinto.
  if (error) return { ok: false, error: 'No pude leer la nota.' };
  if (!data) return { ok: false, error: 'Esa nota ya no está.' };
  const fila = data as FilaNota;

  // El autor de una nota es el email de quien la escribió (`autorActual`, app/crm/actions.ts), o
  // 'CRM' para una sesión sin email: ésas sólo las toca un admin.
  const sesion = await getUsuarioActual().catch(() => null);
  const yo = sesion?.email?.trim().toLowerCase() || '';
  const esSuya = !!yo && fila.autor?.trim().toLowerCase() === yo;
  if (!esSuya && rol !== 'admin') return { ok: false, error: 'Sólo quien la escribió puede cambiarla.' };
  return { ok: true, fila, autor: sesion?.email?.trim() || 'CRM' };
}

function refrescar(leadId: number): void {
  try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/customer-success');
}

/**
 * Corrige el texto de una nota ya escrita.
 *
 * ⚠️ LA PRIMERA VERSIÓN NO SE PIERDE: queda en `valor_anterior`, que en una nota estaba vacío. Así
 * el historial del lead dice «Nota: lo que se escribió → lo que dice ahora» y la ficha puede
 * marcarla como editada. Las ediciones siguientes conservan la ORIGINAL, no la anterior: lo que
 * importa auditar es qué se dijo al principio, no cada coma intermedia.
 */
export async function editarNotaLeadAction(leadId: number, notaId: number, texto: string): Promise<ResultadoNota> {
  try {
    const t = String(texto ?? '').trim();
    if (!t) return { ok: false, error: 'La nota quedó vacía.' };
    // ⚠️ SE RECHAZA, NO SE RECORTA (revisión del 12/10/2026): con un `slice` acá, corregir una letra
    // de una nota más larga que el tope guardaba sólo el principio y contestaba «Nota guardada». El
    // tope es el mismo del alta (app/crm/notas-reglas.ts).
    if (t.length > TOPE_NOTA) return { ok: false, error: 'La nota es demasiado larga.' };
    const r = await notaQueSePuedeTocar(leadId, notaId);
    if (!r.ok) return r;
    if (t === (r.fila.valor_nuevo ?? '').trim()) return { ok: true };
    const ws = await getWorkspaceActual();
    const { error } = await (await getTenantDb())
      .from('lead_audit')
      .update({ valor_nuevo: t, valor_anterior: r.fila.valor_anterior ?? r.fila.valor_nuevo })
      .eq('id', notaId)
      .eq('lead_id', leadId)
      .eq('campo', 'Nota')
      .eq('workspace_id', ws ?? -1);
    if (error) return { ok: false, error: 'No se pudo guardar.' };
    refrescar(leadId);
    return { ok: true };
  } catch (e) {
    console.error('[notas] editar', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No se pudo guardar.' };
  }
}

/**
 * Borra una nota.
 *
 * ⚠️ DEJA UNA LÍNEA EN EL HISTORIAL, SIN EL TEXTO: «Nota borrada · escrita el 12/10/2026», firmada
 * por quien la borró. El texto se va —si alguien borra una nota casi siempre es porque decía algo
 * que no tenía que quedar—, pero que se borró una, y quién, sí queda: un historial al que se le
 * puede sacar una fila sin rastro deja de servir para saber qué pasó.
 */
export async function borrarNotaLeadAction(leadId: number, notaId: number): Promise<ResultadoNota> {
  try {
    const r = await notaQueSePuedeTocar(leadId, notaId);
    if (!r.ok) return r;
    const ws = await getWorkspaceActual();
    const { error } = await (await getTenantDb())
      .from('lead_audit')
      .delete()
      .eq('id', notaId)
      .eq('lead_id', leadId)
      .eq('campo', 'Nota')
      .eq('workspace_id', ws ?? -1);
    if (error) return { ok: false, error: 'No se pudo borrar.' };
    // La fecha en la zona del negocio, la misma con que la pintaba la tarjeta (`fechaDeNota`).
    // El adjunto se va con la nota (best-effort: la nota ya se borró, y un archivo suelto no
    // rompe nada). Sólo si es de este lead: la ruta se guardó validada, pero se vuelve a mirar.
    if (r.fila.archivo_path && ws != null && pathEsNotaDelLead(r.fila.archivo_path, ws, leadId)) {
      await getSupabaseServer().storage.from(BUCKET_NOTAS_LEAD).remove([r.fila.archivo_path]).catch(() => {});
    }
    const fecha = fechaDeNota(r.fila.created_at, await tzActual());
    const cuando = fecha ? ` · escrita el ${fecha}` : '';
    await logLeadEvent(leadId, 'Nota borrada', `Se borró una nota${cuando}`, r.autor);
    refrescar(leadId);
    return { ok: true };
  } catch (e) {
    console.error('[notas] borrar', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No se pudo borrar.' };
  }
}

// ── El adjunto de una nota (mig 0267) ─────────────────────────────────────────────────────
// El molde es el de las notas del curso (lib/curso-notas.ts): el navegador sube DIRECTO al
// bucket con una URL firmada, el alta verifica que llegó, y se abre con una URL firmada de vida
// corta que se pide por el id de la nota. La ruta no viaja a la pantalla.

/** Cuánto vive el link para abrir un adjunto: lo que tarda en abrirse, no lo que dura leerlo. */
const VIDA_ADJUNTO_SEG = 120;

/** Las guardas de quien sube a un lead: sesión, acceso a la ficha, negocio abierto y el lead es suyo. */
async function leadDondeSubir(leadId: number): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return { ok: false, error: 'Falta el lead.' };
  if ((await getRolWsEfectivo()) == null) return { ok: false, error: 'Inicia sesión para adjuntar.' };
  const capa = await getCapaActual();
  if (!tabEnCapa('crm', capa) && !tabEnCapa('customer-success', capa)) return { ok: false, error: 'No tienes acceso a esta ficha.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Elige una cuenta primero.' };
  const { data, error } = await (await getTenantDb()).from('leads').select('id').eq('id', leadId).maybeSingle();
  if (error) return { ok: false, error: 'No pude leer el lead.' };
  if (!data) return { ok: false, error: 'Ese lead no está.' };
  return { ok: true, ws };
}

/** La URL firmada para que el NAVEGADOR suba el adjunto directo al bucket (PUT multipart, 2 h). */
export async function urlSubidaNotaLeadAction(leadId: number, mime: string, bytes: number): Promise<{ ok: true; path: string; signedUrl: string; apikey: string | null } | { ok: false; error: string }> {
  try {
    const g = await leadDondeSubir(leadId);
    if (!g.ok) return g;
    if (!esMimeNota(mime)) return { ok: false, error: 'Ese formato no va.' };
    if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: 'El archivo está vacío.' };
    if (bytes > TOPE_NOTA_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
    const path = pathDeNotaLead(g.ws, leadId, randomUUID());
    if (!path) return { ok: false, error: 'No pude armar la subida.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_NOTAS_LEAD).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: 'No pude firmar la subida.' };
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    console.error('[notas] subida', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No pude preparar la subida.' };
  }
}

/**
 * El link de VIDA CORTA para abrir el adjunto de una nota, por su id. Lo que el navegador no puede
 * mostrar (una planilla, un Word) se baja con su nombre original: la ruta es un uuid.
 */
export async function urlAdjuntoNotaLeadAction(leadId: number, notaId: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const r = await notaQueSePuedeVer(leadId, notaId);
    if (!r.ok) return r;
    const f = r.fila;
    if (!f.archivo_path) return { ok: false, error: 'Esa nota no tiene archivo.' };
    const opciones = adjuntoSeVe(f.archivo_mime) ? undefined : { download: f.archivo_nombre || true };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_NOTAS_LEAD).createSignedUrl(f.archivo_path, VIDA_ADJUNTO_SEG, opciones);
    if (error || !data) return { ok: false, error: 'No pude abrir el archivo.' };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    console.error('[notas] abrir adjunto', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No pude abrir el archivo.' };
  }
}

/** Leer una nota para abrir su adjunto: mirarla alcanza (no hace falta poder editarla). */
async function notaQueSePuedeVer(leadId: number, notaId: number): Promise<{ ok: true; fila: { archivo_path: string | null; archivo_nombre: string | null; archivo_mime: string | null } } | { ok: false; error: string }> {
  const g = await leadDondeSubir(leadId);
  if (!g.ok) return g;
  if (!Number.isSafeInteger(notaId) || notaId <= 0) return { ok: false, error: 'Falta la nota.' };
  const { data, error } = await (await getTenantDb()).from('lead_audit')
    .select('archivo_path, archivo_nombre, archivo_mime')
    .eq('id', notaId).eq('lead_id', leadId).eq('campo', 'Nota').eq('workspace_id', g.ws).maybeSingle();
  if (error) return { ok: false, error: 'No pude leer la nota.' };
  if (!data) return { ok: false, error: 'Esa nota ya no existe.' };
  return { ok: true, fila: data as { archivo_path: string | null; archivo_nombre: string | null; archivo_mime: string | null } };
}

/**
 * Borra un adjunto que se SUBIÓ y no llegó a quedar en ninguna nota (se quitó antes de agregarla).
 * ⚠️ Sólo de este lead (el prefijo) y sólo si ninguna nota lo nombra: el path viaja desde el navegador.
 */
export async function descartarAdjuntoNotaLeadAction(leadId: number, path: string): Promise<ResultadoNota> {
  try {
    const g = await leadDondeSubir(leadId);
    if (!g.ok) return g;
    if (!pathEsNotaDelLead(path, g.ws, leadId)) return { ok: false, error: 'Ese archivo no es de este lead.' };
    const { data: usos } = await (await getTenantDb()).from('lead_audit').select('id').eq('archivo_path', path).limit(1);
    if ((usos ?? []).length) return { ok: true };
    await getSupabaseServer().storage.from(BUCKET_NOTAS_LEAD).remove([path]);
    return { ok: true };
  } catch (e) {
    console.error('[notas] descartar adjunto', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No se pudo descartar.' };
  }
}
