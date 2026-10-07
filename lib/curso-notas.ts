import 'server-only';

// =============================================================================
// curso-notas — las notas del EQUIPO sobre una clase o una etapa del curso, con su adjunto
// =============================================================================
// Pedido (tablero #692, 06/10/2026): «Habilitar sección de notas y subida de archivos en las
// clases del curso» — una caja de notas debajo de cada clase (y de cada etapa), donde Mauricio y
// su equipo dejan comentarios y suben PDF, documentos o planillas. Tabla y bucket: mig 0208.
//
// ⚠️ ESTO ES DEL EQUIPO Y NUNCA LLEGA AL ALUMNO. El portal (lib/curso-portal.ts) arma lo que ve
// el cliente con una lista blanca (`claseVista`) y no importa este módulo; un test lo fija
// (tests/curso-portal.test.ts). Una nota puede nombrar a otro cliente de Mauricio.
//
// ⚠️ COMENTA QUIEN VE LA TAB, no sólo un admin: la puerta es `puedeVer` en las actions
// (app/customer-success/curso/actions.ts). Borrar es de quien la escribió o de un admin.
//
// ⚠️ EL ADJUNTO NO PASA POR EL SERVER, igual que el video (lib/curso-admin.ts, `urlSubida`): el
// navegador lo sube directo al bucket con una URL firmada, y al comentar se verifica que haya
// llegado. Y se LEE con una URL firmada de vida corta que se pide al hacer clic, por el id de la
// nota: la ruta del bucket no viaja al navegador.
//
// Todo contra `getTenantDb()` (la tabla está en TENANT_TABLES): cada lectura y escritura lleva el
// `.eq` del inquilino puesto por el proxy.

import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { claseDeId } from './curso-datos';
import { productoConEtapas, type Resultado } from './curso-admin';
import {
  validarNota, pathDeNota, pathEsNotaDelWorkspace, esMimeNota, adjuntoSeVe, TOPE_NOTA_BYTES,
  type NotaVista, type DestinoNota,
} from '@/app/customer-success/curso/reglas';

/** El bucket privado de la mig 0208. */
export const BUCKET_NOTAS = 'curso-notas';

/** Cuánto vive el link para abrir un adjunto: lo que tarda en abrirse, no lo que dura leerlo. */
const VIDA_ADJUNTO_SEG = 120;

/** Cuántas notas se leen de una clase o etapa. Es una conversación, no un archivo: si alguna vez
 *  pasa de esto, lo que hace falta es otra pantalla, no subir el número. */
const TOPE_LECTURA = 300;

/** Quién está mirando o escribiendo: lo arma la action desde la sesión, nunca el navegador. */
export type Quien = { email: string; nombre: string; admin: boolean };

type FilaNota = {
  id: number; autor_email: string | null; autor_nombre: string | null; texto: string;
  archivo_path: string | null; archivo_nombre: string | null; archivo_mime: string | null;
  archivo_bytes: number | string | null; created_at: string;
};
const COLS = 'id, autor_email, autor_nombre, texto, archivo_path, archivo_nombre, archivo_mime, archivo_bytes, created_at';

const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);
const mismaPersona = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function aVista(f: FilaNota, quien: Quien): NotaVista {
  return {
    id: Number(f.id),
    autor: f.autor_nombre || f.autor_email || 'Alguien',
    texto: f.texto ?? '',
    archivo: f.archivo_path
      ? { nombre: f.archivo_nombre ?? 'archivo', mime: f.archivo_mime ?? '', bytes: f.archivo_bytes == null ? null : Number(f.archivo_bytes) }
      : null,
    createdAt: f.created_at,
    borrable: quien.admin || mismaPersona(f.autor_email, quien.email),
  };
}

/**
 * ¿El destino es de ESTE negocio? El producto (con sus etapas) y, si es una clase, que la clase
 * sea de ese producto. Devuelve el error corto, o `null` si está todo bien.
 */
async function destinoValido(productoId: number, destino: DestinoNota): Promise<string | null> {
  const prod = await productoConEtapas(productoId);
  if (!prod) return 'Ese producto no es de este negocio.';
  if ('claseId' in destino) {
    const c = await claseDeId(Number(destino.claseId));
    if (!c || c.productoId !== productoId) return 'Esa clase ya no existe.';
  } else if (!prod.etapas.includes(destino.etapa)) {
    return 'Esa etapa no existe.';
  }
  return null;
}

/** Las notas de una clase o de una etapa, la más nueva arriba. */
export async function notasDe(productoId: number, destino: DestinoNota, quien: Quien): Promise<Resultado<{ notas: NotaVista[] }>> {
  try {
    const no = await destinoValido(Number(productoId), destino);
    if (no) return { ok: false, error: no };
    const db = await getTenantDb();
    let q = db.from('curso_clase_notas').select(COLS).eq('producto_id', Number(productoId));
    q = 'claseId' in destino ? q.eq('clase_id', Number(destino.claseId)) : q.eq('etapa', destino.etapa).is('clase_id', null);
    const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(TOPE_LECTURA);
    if (error) return { ok: false, error: error.message };
    return { ok: true, notas: ((data ?? []) as FilaNota[]).map((f) => aVista(f, quien)) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude leer las notas.') };
  }
}

/**
 * Guarda una nota (con su adjunto, si trae). El autor lo pone la sesión.
 *
 * ⚠️ EL ADJUNTO SE VERIFICA ANTES DE GUARDAR (`exists`): lo subió el navegador y la subida puede
 * cortarse. Una nota que apunta a un archivo que no está es un clic que no abre nada.
 * (`exists` de algo que no está devuelve `false` con un «Bad Request», no tira: medido el 06/10
 * contra el bucket de videos, ver lib/curso-admin.ts.)
 */
export async function agregarNota(raw: unknown, quien: Quien): Promise<Resultado<{ nota: NotaVista }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    const productoId = Number((raw as { productoId?: unknown } | null)?.productoId);
    const prod = await productoConEtapas(productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    const v = validarNota(raw, { ws, productoId, etapas: prod.etapas });
    if (!v.ok) return v;
    if (v.fila.clase_id != null) {
      const c = await claseDeId(v.fila.clase_id);
      if (!c || c.productoId !== productoId) return { ok: false, error: 'Esa clase ya no existe.' };
    }
    if (v.fila.archivo_path) {
      const { data: hay } = await getSupabaseServer().storage.from(BUCKET_NOTAS).exists(v.fila.archivo_path);
      if (!hay) return { ok: false, error: 'El archivo no terminó de subir.' };
    }
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clase_notas')
      .insert([{ ...v.fila, autor_email: quien.email || null, autor_nombre: quien.nombre || null }])
      .select(COLS).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, nota: aVista(data as FilaNota, quien) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar la nota.') };
  }
}

/**
 * Borra un adjunto del bucket SÓLO si ninguna nota lo nombra. No tira: la nota ya se borró, y un
 * archivo de más lo barre el cron de huérfanos; uno borrado de más deja una nota sin su archivo.
 */
async function borrarAdjunto(path: string | null): Promise<void> {
  if (!path) return;
  try {
    const { data: usos, error } = await (await getTenantDb()).from('curso_clase_notas').select('id').eq('archivo_path', path).limit(1);
    if (error || (usos ?? []).length) return;
    const { error: e2 } = await getSupabaseServer().storage.from(BUCKET_NOTAS).remove([path]);
    if (e2) console.warn(`[curso-notas] no pude borrar el adjunto ${path}: ${e2.message}`);
  } catch (e) {
    console.warn('[curso-notas] no pude borrar el adjunto:', msg(e, String(e)));
  }
}

/** Borra una nota (y su adjunto). Sólo quien la escribió, o un admin del negocio. */
export async function borrarNota(notaId: number, quien: Quien): Promise<Resultado> {
  try {
    if (!Number.isInteger(notaId) || notaId <= 0) return { ok: false, error: 'Esa nota ya no existe.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clase_notas').select('id, autor_email, archivo_path').eq('id', notaId).maybeSingle();
    if (error) return { ok: false, error: error.message };
    const f = data as { id: number; autor_email: string | null; archivo_path: string | null } | null;
    if (!f) return { ok: false, error: 'Esa nota ya no existe.' };
    if (!quien.admin && !mismaPersona(f.autor_email, quien.email)) return { ok: false, error: 'Solo quien la escribió la borra.' };
    const { error: e2 } = await db.from('curso_clase_notas').delete().eq('id', notaId);
    if (e2) return { ok: false, error: e2.message };
    await borrarAdjunto(f.archivo_path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar la nota.') };
  }
}

/**
 * La URL firmada para que el NAVEGADOR suba un adjunto directo al bucket. El mismo pedido que el
 * de los videos (`urlSubida`, lib/curso-admin.ts): PUT multipart a `signedUrl`, que vale 2 h.
 */
export async function urlSubidaNota(productoId: number, mime: string, bytes: number): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    if (!(await productoConEtapas(productoId))) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!esMimeNota(mime)) return { ok: false, error: 'Ese formato no va.' };
    if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: 'El archivo está vacío.' };
    if (bytes > TOPE_NOTA_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
    const path = pathDeNota(ws, productoId, mime, randomUUID());
    if (!path) return { ok: false, error: 'No pude armar la subida.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_NOTAS).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? 'No pude firmar la subida.' };
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude preparar la subida.') };
  }
}

/**
 * Borra un adjunto que se SUBIÓ y no llegó a quedar en ninguna nota (se quitó antes de comentar,
 * o se cerró la caja). ⚠️ Sólo de este workspace (el prefijo) y sólo si ninguna nota lo nombra:
 * el path viaja desde el navegador.
 */
export async function descartarAdjunto(path: string): Promise<Resultado> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws || !pathEsNotaDelWorkspace(path, ws)) return { ok: false, error: 'Ese archivo no es de este negocio.' };
    await borrarAdjunto(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo descartar.') };
  }
}

/**
 * El link de VIDA CORTA para abrir el adjunto de una nota. Por el id de la nota, no por la ruta:
 * la ruta no viaja al navegador, y la nota la lee `getTenantDb()`, así que la de otro negocio no
 * se encuentra. Lo que el navegador no puede mostrar (una planilla, un Word) se baja con su
 * nombre original; la ruta es un uuid.
 */
export async function urlAdjunto(notaId: number): Promise<Resultado<{ url: string }>> {
  try {
    if (!Number.isInteger(notaId) || notaId <= 0) return { ok: false, error: 'Esa nota ya no existe.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clase_notas').select('id, archivo_path, archivo_nombre, archivo_mime').eq('id', notaId).maybeSingle();
    if (error) return { ok: false, error: error.message };
    const f = data as { archivo_path: string | null; archivo_nombre: string | null; archivo_mime: string | null } | null;
    if (!f?.archivo_path) return { ok: false, error: 'Esa nota no tiene archivo.' };
    const opciones = adjuntoSeVe(f.archivo_mime) ? undefined : { download: f.archivo_nombre || true };
    const { data: firmado, error: e2 } = await getSupabaseServer().storage.from(BUCKET_NOTAS).createSignedUrl(f.archivo_path, VIDA_ADJUNTO_SEG, opciones);
    if (e2 || !firmado) return { ok: false, error: e2?.message ?? 'No pude abrir el archivo.' };
    return { ok: true, url: firmado.signedUrl };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude abrir el archivo.') };
  }
}

/**
 * Cuántas notas tiene cada clase y cada etapa (para el «N notas» de la lista). La etapa va con
 * su producto en la clave (`<producto>:<etapa>`): dos productos pueden tener una etapa con la
 * misma clave. TIRA si no puede leer, y quien llama decide.
 */
export async function conteoDeNotas(productoIds: readonly number[]): Promise<{ porClase: Record<number, number>; porEtapa: Record<string, number> }> {
  const porClase: Record<number, number> = {};
  const porEtapa: Record<string, number> = {};
  if (!productoIds.length) return { porClase, porEtapa };
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; producto_id: number; clase_id: number | null; etapa: string | null }>(
    db, 'curso_clase_notas', 'id, producto_id, clase_id, etapa',
    { filtros: (q) => q.in('producto_id', [...productoIds]), orden: 'id' });
  for (const f of filas) {
    if (f.clase_id != null) porClase[Number(f.clase_id)] = (porClase[Number(f.clase_id)] ?? 0) + 1;
    else if (f.etapa) {
      const k = `${Number(f.producto_id)}:${f.etapa}`;
      porEtapa[k] = (porEtapa[k] ?? 0) + 1;
    }
  }
  return { porClase, porEtapa };
}
