import 'server-only';

// =============================================================================
// El Image Editor en la base: diseños (image_disenos), subidos (image_subidos) y el bucket
// =============================================================================
// Lo llaman las rutas de app/api/image-editor/*. Las reglas puras están en ./reglas.ts y el contrato
// con el navegador en ./tipos.ts. Molde: lib/editor-landing/server.ts (compare-and-set) y
// app/api/landing-generator/imagenes/route.ts (firmar → subir → registrar).
//
// LA PUERTA (`puerta`) es la del editor: la misma pregunta que sus páginas (app/image-editor/acceso.ts →
// `veEditorImagen`: admin del workspace y la tab en su capa). Para cualquier otro, 404: la ruta no existe.
// Cada consulta va por `getTenantDb()` (las dos tablas están en TENANT_TABLES) y además lleva el
// `.eq('workspace_id', ws)` escrito a mano, como el Landing: si la línea del registro se pierde,
// esto sigue acotado.

import { after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { veEditorImagen } from '@/app/image-editor/acceso';
import {
  BUCKET_IMAGE, CARPETA_SUBIDAS, TOPE_DOC_BYTES, esTipoAudio, medida, pathDeMiniatura, pathDeSubida,
  resumirDoc, sanearNombre, sanearTitulo, sniffArchivo, srcsLocales, subidaDelWs, topeDeTipo, uuidValido,
  validarSubida, versionValida,
} from './reglas';
import type {
  DisenoCompleto, PedidoCrear, PedidoGuardar, PedidoSubidos, RespCrear, RespDiseno, RespFirmar, RespGuardar,
  RespLista, RespMiniatura, RespOk, RespRegistrar, RespSubidos, ResumenDiseno, Subido,
} from './tipos';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const mal = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export type Puerta = { ws: number; quien: string };

/** Sesión → admin del workspace con la tab en su capa → un workspace. Lo que no pase, contesta la ruta tal cual. */
export async function puerta(): Promise<Puerta | Response> {
  const yo = await getUsuarioActual();
  if (!yo) return mal('no autenticado', 401);
  if (!(await veEditorImagen())) return mal('No existe', 404);
  const ws = await getWorkspaceActual();
  if (ws == null) return mal('Abre el editor desde un negocio', 409);
  return { ws, quien: yo.email || yo.sub };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diseños
// ─────────────────────────────────────────────────────────────────────────────

const COLS_RESUMEN = 'id, titulo, ancho, alto, paginas, miniatura, created_at, updated_at';
type FilaResumen = { id: string; titulo: string; ancho: number; alto: number; paginas: number; miniatura: string | null; created_at: string; updated_at: string };

const aResumen = (f: FilaResumen): ResumenDiseno => ({
  id: f.id, titulo: f.titulo, ancho: f.ancho, alto: f.alto, paginas: f.paginas, miniatura: f.miniatura,
  creado: f.created_at, actualizado: f.updated_at,
});

export async function listarDisenos(ws: number): Promise<RespLista> {
  const db = await getTenantDb();
  const { data, error } = await db.from('image_disenos').select(COLS_RESUMEN)
    .eq('workspace_id', ws).is('borrado_at', null).order('updated_at', { ascending: false }).limit(500);
  if (error) return { ok: false, error: error.message };
  return { ok: true, disenos: ((data ?? []) as FilaResumen[]).map(aResumen) };
}

export async function leerDiseno(ws: number, id: string): Promise<RespDiseno & { status?: number }> {
  if (!uuidValido(id)) return { ok: false, error: 'No existe', status: 404 };
  const db = await getTenantDb();
  const { data, error } = await db.from('image_disenos').select(`${COLS_RESUMEN}, doc, version`)
    .eq('workspace_id', ws).eq('id', id).is('borrado_at', null).maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data) return { ok: false, error: 'No existe', status: 404 };
  const f = data as FilaResumen & { doc: unknown; version: number };
  const diseno: DisenoCompleto = { ...aResumen(f), doc: f.doc, version: f.version };
  return { ok: true, diseno };
}

/** El documento, validado: forma de diseño, sin `blob:`/`idb://` y dentro del tope. */
function docGuardable(doc: unknown): { ok: true; resumen: { ancho: number; alto: number; paginas: number } } | { ok: false; error: string; status: number } {
  const resumen = resumirDoc(doc);
  if (!resumen) return { ok: false, error: 'El diseño no tiene la forma esperada', status: 400 };
  const locales = srcsLocales(doc);
  if (locales.length) return { ok: false, error: 'Hay imágenes que todavía no se subieron', status: 422 };
  if (JSON.stringify(doc).length > TOPE_DOC_BYTES) return { ok: false, error: 'El diseño es demasiado grande', status: 413 };
  return { ok: true, resumen };
}

/**
 * Un diseño nuevo. Con `id` (un diseño que estaba en el navegador y sube con su uuid) es
 * IDEMPOTENTE: si ya está en este workspace, contesta el que hay sin pisarlo. Así una subida que
 * se cortó a mitad de camino se reintenta sin crear una copia.
 */
export async function crearDiseno(ws: number, quien: string, p: PedidoCrear): Promise<RespCrear & { status?: number }> {
  const v = docGuardable(p.doc);
  if (!v.ok) return { ok: false, error: v.error, status: v.status };
  const id = p.id === undefined ? randomUUID() : p.id;
  if (!uuidValido(id)) return { ok: false, error: 'Id inválido', status: 400 };
  const db = await getTenantDb();
  if (p.id !== undefined) {
    const { data: hay } = await db.from('image_disenos').select('id, version').eq('workspace_id', ws).eq('id', id).maybeSingle();
    if (hay) return { ok: true, id: (hay as { id: string }).id, version: (hay as { version: number }).version };
  }
  const { data, error } = await db.from('image_disenos').insert({
    id, workspace_id: ws, titulo: sanearTitulo(p.titulo), doc: p.doc,
    ancho: v.resumen.ancho, alto: v.resumen.alto, paginas: v.resumen.paginas, creado_por: quien,
  }).select('id, version').single();
  if (error) return { ok: false, error: /duplicate key/i.test(error.message) ? 'Ese diseño ya existe' : error.message, status: /duplicate key/i.test(error.message) ? 409 : 500 };
  return { ok: true, id: (data as { id: string }).id, version: (data as { version: number }).version };
}

/**
 * Guarda lo que mandó el editor, sólo si la versión que tiene es la de la base. Parcial: el título
 * solo no manda el documento. EL COMPARE-AND-SET es el `.eq('version', v)`: si otra pestaña guardó
 * en el medio, 0 filas y 409 con la versión actual.
 */
export async function guardarDiseno(ws: number, id: string, p: PedidoGuardar): Promise<RespGuardar & { status?: number }> {
  if (!uuidValido(id)) return { ok: false, error: 'No existe', status: 404 };
  const abierta = versionValida(p.version);
  if (!abierta) return { ok: false, error: 'Falta la versión', status: 400 };
  const ahora = new Date().toISOString();
  const patch: Record<string, unknown> = { version: abierta + 1, updated_at: ahora };
  if (p.titulo !== undefined) patch.titulo = sanearTitulo(p.titulo);
  if (p.doc !== undefined) {
    const v = docGuardable(p.doc);
    if (!v.ok) return { ok: false, error: v.error, status: v.status };
    Object.assign(patch, { doc: p.doc, ancho: v.resumen.ancho, alto: v.resumen.alto, paginas: v.resumen.paginas });
  }
  const db = await getTenantDb();
  const { data, error } = await db.from('image_disenos').update(patch)
    .eq('workspace_id', ws).eq('id', id).eq('version', abierta).is('borrado_at', null)
    .select('version, updated_at');
  if (error) return { ok: false, error: error.message, status: 500 };
  const fila = (data ?? [])[0] as { version: number; updated_at: string } | undefined;
  if (fila) return { ok: true, version: fila.version, actualizado: fila.updated_at };
  const { data: actual } = await db.from('image_disenos').select('version').eq('workspace_id', ws).eq('id', id).is('borrado_at', null).maybeSingle();
  if (!actual) return { ok: false, error: 'No existe', status: 404 };
  return { ok: false, error: 'Hay una versión más nueva', conflicto: true, versionActual: (actual as { version: number }).version, status: 409 };
}

/** Una copia del diseño (con «(copia)» en el título), como «Hacer una copia» de Canva. Sin la miniatura: se dibuja al abrirla. */
export async function duplicarDiseno(ws: number, quien: string, id: string): Promise<RespCrear & { status?: number }> {
  const r = await leerDiseno(ws, id);
  if (!r.ok) return { ok: false, error: r.error, status: r.status };
  return crearDiseno(ws, quien, { titulo: `${r.diseno.titulo} (copia)`.slice(0, 200), doc: r.diseno.doc });
}

/** Lo saca de la lista (`borrado_at`). La fila queda: cerrar no es borrar. */
export async function borrarDiseno(ws: number, id: string): Promise<RespOk & { status?: number }> {
  if (!uuidValido(id)) return { ok: false, error: 'No existe', status: 404 };
  const db = await getTenantDb();
  const { data, error } = await db.from('image_disenos').update({ borrado_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('id', id).is('borrado_at', null).select('id');
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data?.length) return { ok: false, error: 'No existe', status: 404 };
  return { ok: true };
}

/**
 * La miniatura de la primera página: el editor la manda al guardar (cada 15 s como mucho). Se
 * verifica por magic bytes, se pisa SIEMPRE el mismo archivo y la URL guardada lleva `?v=` para que
 * el CDN no sirva la vieja.
 */
export async function guardarMiniatura(ws: number, id: string, bytes: Uint8Array): Promise<RespMiniatura & { status?: number }> {
  if (!uuidValido(id)) return { ok: false, error: 'No existe', status: 404 };
  const tipo = sniffArchivo(bytes.subarray(0, 16));
  if (tipo !== 'image/webp' && tipo !== 'image/png' && tipo !== 'image/jpeg') return { ok: false, error: 'La miniatura no es una imagen', status: 400 };
  const db = await getTenantDb();
  const { data: hay } = await db.from('image_disenos').select('id').eq('workspace_id', ws).eq('id', id).is('borrado_at', null).maybeSingle();
  if (!hay) return { ok: false, error: 'No existe', status: 404 };
  const path = pathDeMiniatura(ws, id);
  const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
  const { error: e1 } = await bucket.upload(path, bytes, { contentType: tipo, upsert: true, cacheControl: '31536000' });
  if (e1) return { ok: false, error: e1.message, status: 500 };
  const miniatura = `${bucket.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error: e2 } = await db.from('image_disenos').update({ miniatura }).eq('workspace_id', ws).eq('id', id);
  if (e2) return { ok: false, error: e2.message, status: 500 };
  return { ok: true, miniatura };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subidos: firmar → (el navegador sube directo al bucket) → registrar
// ─────────────────────────────────────────────────────────────────────────────

type FilaSubido = { id: string; nombre: string; tipo: string; ancho: number; alto: number; bytes: number; url: string; created_at: string };
const aSubido = (f: FilaSubido): Subido => ({ id: f.id, nombre: f.nombre, tipo: f.tipo, ancho: f.ancho, alto: f.alto, bytes: Number(f.bytes), url: f.url, creado: f.created_at });

export async function listarSubidos(ws: number, clase: 'imagen' | 'audio' | null, q: string): Promise<RespSubidos> {
  const db = await getTenantDb();
  let consulta = db.from('image_subidos').select('id, nombre, tipo, ancho, alto, bytes, url, created_at')
    .eq('workspace_id', ws).is('borrado_at', null);
  if (clase === 'audio') consulta = consulta.like('tipo', 'audio/%');
  if (clase === 'imagen') consulta = consulta.like('tipo', 'image/%');
  const aguja = q.trim().slice(0, 80);
  if (aguja) consulta = consulta.ilike('nombre', `%${aguja.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await consulta.order('created_at', { ascending: false }).limit(300);
  if (error) return { ok: false, error: error.message };
  return { ok: true, subidos: ((data ?? []) as FilaSubido[]).map(aSubido) };
}

/** Saca el archivo de «Subidos». El archivo queda en el bucket: un diseño lo puede estar usando. */
export async function borrarSubido(ws: number, id: string): Promise<RespOk & { status?: number }> {
  if (!uuidValido(id)) return { ok: false, error: 'No existe', status: 404 };
  const db = await getTenantDb();
  const { data, error } = await db.from('image_subidos').update({ borrado_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('id', id).is('borrado_at', null).select('id');
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data?.length) return { ok: false, error: 'No existe', status: 404 };
  return { ok: true };
}

export async function firmarSubida(ws: number, p: Extract<PedidoSubidos, { accion: 'firmar' }>): Promise<RespFirmar & { status?: number }> {
  const v = validarSubida(p.tipo, p.tamano);
  if (!v.ok) return { ok: false, error: v.error, status: 400 };
  const path = pathDeSubida(ws, randomUUID(), v.ext);
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_IMAGE).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'No pude preparar la subida', status: 500 };
  // Lo que quedó de una pestaña cerrada entre la subida y el registro se barre DESPUÉS de contestar.
  // Fuera de un request (un script, un runner) `after` tira: ahí se barre sin esperar.
  try {
    after(() => runWithWorkspace(ws, () => barrerSubidasViejas(ws)));
  } catch {
    void barrerSubidasViejas(ws);
  }
  // La clave PÚBLICA de Supabase: el PUT a la URL firmada la pide (subirConProgreso, como el Landing).
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  return { ok: true, path, signedUrl: data.signedUrl, apikey };
}

/** Las subidas sin registrar de más de una hora. Best-effort: si falla, queda en el log. */
async function barrerSubidasViejas(ws: number): Promise<void> {
  try {
    const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
    const { data, error } = await bucket.list(`${ws}/${CARPETA_SUBIDAS}`, { limit: 1000 });
    if (error) throw new Error(error.message);
    const limite = Date.now() - 3_600_000;
    const viejas = (data ?? [])
      .filter((f) => f.id && f.created_at && Date.parse(f.created_at) < limite)
      .map((f) => `${ws}/${CARPETA_SUBIDAS}/${f.name}`);
    if (!viejas.length) return;
    const { error: e2 } = await bucket.remove(viejas);
    if (e2) throw new Error(e2.message);
  } catch (e) {
    console.warn(`[image-editor] ws ${ws}: no pude barrer las subidas viejas: ${msg(e)}`);
  }
}

/** Los primeros bytes y el tamaño total, con un pedido de RANGO (no hace falta bajar 25 MB). */
async function primerosBytes(url: string, n = 32): Promise<{ buf: Uint8Array; total: number | null } | null> {
  const r = await fetch(url, { headers: { Range: `bytes=0-${n - 1}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (r.status !== 206 && r.status !== 200) return null;
  const rango = /\/(\d+)\s*$/.exec(r.headers.get('content-range') ?? '');
  const largo = Number(r.headers.get('content-length'));
  const total = r.status === 206 ? (rango ? Number(rango[1]) : null) : Number.isFinite(largo) && largo > 0 ? largo : null;
  const buf = new Uint8Array(await r.arrayBuffer()).subarray(0, n);
  return { buf, total };
}

/**
 * Verifica la subida (que exista, que sus MAGIC BYTES sean lo que dice su extensión y que no pase
 * su tope), la muda a `<ws>/<uuid>.<ext>` y la anota en «Subidos». Si no da, la BORRA.
 */
export async function registrarSubida(ws: number, p: Extract<PedidoSubidos, { accion: 'registrar' }>): Promise<RespRegistrar & { status?: number }> {
  const sub = subidaDelWs(p.path, ws);
  if (!sub) return { ok: false, error: 'Esa subida no es de este negocio', status: 400 };
  const path = p.path;
  const bucket = getSupabaseServer().storage.from(BUCKET_IMAGE);
  const { data: hay } = await bucket.exists(path);
  if (!hay) return { ok: false, error: 'No terminó de subir', status: 404 };
  const descartar = async (motivo: string) => {
    const { error } = await bucket.remove([path]);
    if (error) console.warn(`[image-editor] no pude borrar ${path}: ${error.message}`);
    console.warn(`[image-editor] descarté ${path}: ${motivo}`);
  };
  const cabeza = await primerosBytes(bucket.getPublicUrl(path).data.publicUrl);
  if (!cabeza) return { ok: false, error: 'No pude leer el archivo', status: 502 };
  const real = sniffArchivo(cabeza.buf);
  // El tipo REAL tiene que ser el de la extensión (que salió del tipo declarado al firmar). Un MP4
  // y un M4A comparten firma: los dos se aceptan como audio/mp4.
  if (real !== sub.tipo) {
    await descartar(`dice ${sub.tipo} y es ${real ?? 'otra cosa'}`);
    return { ok: false, error: 'El archivo no es lo que dice', status: 400 };
  }
  if (cabeza.total != null && cabeza.total > topeDeTipo(sub.tipo)) {
    await descartar(`pesa ${cabeza.total}`);
    return { ok: false, error: esTipoAudio(sub.tipo) ? 'El audio pasa de 25 MB.' : 'La imagen pasa de 15 MB.', status: 413 };
  }
  const { error: e1 } = await bucket.move(path, sub.final);
  if (e1) return { ok: false, error: e1.message, status: 500 };
  const url = bucket.getPublicUrl(sub.final).data.publicUrl;
  const db = await getTenantDb();
  const { data, error } = await db.from('image_subidos').insert({
    id: sub.uuid, workspace_id: ws, nombre: sanearNombre(p.nombre, esTipoAudio(sub.tipo) ? 'Audio' : 'Imagen'), tipo: sub.tipo,
    ancho: medida(p.ancho), alto: medida(p.alto), bytes: cabeza.total ?? 0, ruta: sub.final, url,
  }).select('id, nombre, tipo, ancho, alto, bytes, url, created_at').single();
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, subido: aSubido(data as FilaSubido) };
}
