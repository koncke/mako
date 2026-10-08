import 'server-only';

// =============================================================================
// curso-adjuntos — los archivos de la descripción de una clase: subir, registrar, firmar
// =============================================================================
// Pedido de Martín (07/10/2026, item 17): «Se debería poder adjuntar cosas a la descripción…
// Imágenes, PDF, archivos, etc.». Tabla `curso_adjuntos` y bucket privado `curso-adjuntos`
// (mig 0216). Las reglas puras —tipos, topes, path, quién ve qué— en lib/curso-adjuntos-reglas.ts.
//
// ⚠️ NADA DE ACÁ PREGUNTA QUIÉN LLAMA: eso lo hacen las puertas. El equipo entra por
//    app/customer-success/curso/adjuntos-actions.ts (sesión, capa y rol); el alumno, por
//    /api/compartido/curso/adjunto (su token y el candado de la etapa, con `claseDelAlumno`). Acá
//    se valida LO QUE SE ESCRIBE y LO QUE SE FIRMA: que el producto, la clase y el archivo sean
//    de este workspace.
//
// ⚠️ EL ARCHIVO NO PASA POR EL SERVER, igual que el video y las notas: una server action topa el
//    cuerpo en 1 MB y una función de Vercel en ~4,5 MB (AGENTS.md, «tres topes del entorno»). El
//    navegador sube DIRECTO al bucket con una URL firmada, y al registrar se verifica que llegó.
//
// ⚠️ CADA CONSULTA LLEVA SU `workspace_id` A MANO, ADEMÁS de `getTenantDb()`. `getTenantDb` acota
//    SOLO las tablas de `TENANT_TABLES` (lib/workspace.ts) y con las demás es PASSTHROUGH: mientras
//    `curso_adjuntos` no esté registrada ahí, sin esto una lectura por id devolvería el adjunto de
//    OTRO negocio y una inserción caería en el workspace 1 (el default de la columna). Con la
//    tabla registrada, el filtro va dos veces y no cuesta nada.
//
// ⚠️ LA RUTA DEL BUCKET NO VIAJA AL NAVEGADOR después de subir: el HTML nombra el adjunto por su
//    id (`mako-adjunto:<uuid>`), y la URL se firma, corta, para quien mira.

import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { claseDeId } from './curso-datos';
import {
  BUCKET_ADJUNTOS, TOPE_ADJUNTO_BYTES, esMimeAdjunto, pathDeAdjunto, pathEsAdjuntoDelProducto, uuidDePath,
  validarRegistroAdjunto, decidirAdjuntoAlumno, descargaComo, refDeId, refsEnHtml,
} from './curso-adjuntos-reglas';

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Cuánto vive el link que firma el EQUIPO: lo que dura editar una clase. Una imagen ya cargada en
 * el editor no se vuelve a pedir; si la pantalla queda abierta más que esto y se redibuja, la
 * pantalla vuelve a pedir las URLs.
 */
const VIDA_EQUIPO_SEG = 60 * 60;

/**
 * Cuánto vive el link al que redirige la ruta del ALUMNO. La ruta firma uno NUEVO en cada pedido
 * (y revalida el token y el candado), así que alcanza con que dure lo que tarda en empezar la
 * descarga. Corto a propósito: es la ventana en la que el link sobrevive a cortar el acceso.
 */
const VIDA_ALUMNO_SEG = 5 * 60;

/** Cuántos adjuntos se firman de una vez (una descripción con más imágenes que esto es otra cosa). */
const TOPE_FIRMA_LOTE = 100;

const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

type FilaAdjunto = { id: string; producto_id: number | string; clase_id: number | string | null; path: string; nombre: string; mime: string };
const COLS = 'id, producto_id, clase_id, path, nombre, mime';

/** ¿El producto es de ESTE workspace? (sin leer su entrega: acá no hacen falta las etapas) */
async function productoDelWorkspace(ws: number, productoId: number): Promise<boolean> {
  if (!Number.isInteger(productoId) || productoId <= 0) return false;
  const db = await getTenantDb();
  const { data, error } = await db.from('productos').select('id').eq('workspace_id', ws).eq('id', productoId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * La URL firmada para que el NAVEGADOR suba un adjunto directo al bucket. El mismo pedido que el de
 * los videos y las notas (PUT multipart a `signedUrl`, que vale 2 h): lo arma `subirConProgreso`
 * (app/customer-success/curso/subir-video.ts).
 */
export async function urlSubidaAdjunto(productoId: number, mime: string, bytes: number): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    if (!(await productoDelWorkspace(ws, productoId))) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!esMimeAdjunto(mime)) return { ok: false, error: 'Ese formato no va.' };
    if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: 'El archivo está vacío.' };
    if (bytes > TOPE_ADJUNTO_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
    const path = pathDeAdjunto(ws, productoId, mime, randomUUID());
    if (!path) return { ok: false, error: 'No pude armar la subida.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_ADJUNTOS).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? 'No pude firmar la subida.' };
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude preparar la subida.') };
  }
}

/**
 * Registra un adjunto YA SUBIDO y devuelve su referencia. El id de la fila es el uuid del path:
 * registrar dos veces el mismo archivo (un doble clic, un reintento) devuelve la misma fila.
 *
 * ⚠️ EL ARCHIVO SE VERIFICA ANTES DE REGISTRAR (`exists`): lo subió el navegador y la subida puede
 *    cortarse. Una referencia a un archivo que no está es una imagen rota en la clase de cada
 *    alumno. (`exists` de algo que no está devuelve `false` con un «Bad Request», no tira: medido
 *    el 06/10 contra el bucket de videos, ver lib/curso-admin.ts. NO medido contra éste.)
 */
export async function registrarAdjunto(raw: unknown, autor: string | null): Promise<Resultado<{ id: string; ref: string; nombre: string; mime: string }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    const productoId = Number((raw as { productoId?: unknown } | null)?.productoId);
    if (!(await productoDelWorkspace(ws, productoId))) return { ok: false, error: 'Ese producto no es de este negocio.' };
    const v = validarRegistroAdjunto(raw, { ws, productoId });
    if (!v.ok) return v;
    if (v.fila.clase_id != null) {
      const c = await claseDeId(v.fila.clase_id);
      if (!c || c.productoId !== productoId) return { ok: false, error: 'Esa clase ya no existe.' };
    }
    const ref = refDeId(v.fila.id)!;

    const db = await getTenantDb();
    const { data: previa, error: ePrevia } = await db.from('curso_adjuntos').select(COLS).eq('workspace_id', ws).eq('id', v.fila.id).maybeSingle();
    if (ePrevia) return { ok: false, error: ePrevia.message };
    if (previa) {
      const p = previa as FilaAdjunto;
      if (Number(p.producto_id) !== productoId || p.path !== v.fila.path) return { ok: false, error: 'Ese archivo no es de este curso.' };
      return { ok: true, id: p.id, ref, nombre: p.nombre, mime: p.mime };
    }

    const { data: hay } = await getSupabaseServer().storage.from(BUCKET_ADJUNTOS).exists(v.fila.path);
    if (!hay) return { ok: false, error: 'El archivo no terminó de subir.' };

    const { data, error } = await db.from('curso_adjuntos')
      .insert([{ ...v.fila, workspace_id: ws, creado_por: autor || null }])
      .select(COLS).single();
    if (error) return { ok: false, error: error.message };
    const f = data as FilaAdjunto;
    return { ok: true, id: f.id, ref, nombre: f.nombre, mime: f.mime };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo adjuntar.') };
  }
}

/** Lee adjuntos de ESTE workspace por id. Lo que no está (o es de otro negocio) no vuelve. */
async function adjuntosPorId(ws: number, ids: readonly string[]): Promise<FilaAdjunto[]> {
  const validos = [...new Set(ids)].filter((id) => refDeId(id)).slice(0, TOPE_FIRMA_LOTE);
  if (!validos.length) return [];
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_adjuntos').select(COLS).eq('workspace_id', ws).in('id', validos);
  if (error) throw new Error(error.message);
  // ⚠️ El path se vuelve a preguntar: se firma lo que tiene la forma de un adjunto de ESTE
  //    workspace y de SU producto, nunca una ruta que diga otra cosa (la fila puede venir de otro
  //    camino de escritura).
  return ((data ?? []) as FilaAdjunto[]).filter((f) => pathEsAdjuntoDelProducto(f.path, ws, Number(f.producto_id)) && uuidDePath(f.path) === f.id);
}

/**
 * Las URLs para que el EQUIPO vea los adjuntos de una descripción (el editor y la vista previa):
 * `id → URL firmada`. Lo que no se pudo firmar no está en el mapa (la imagen no se dibuja; la
 * pantalla no se cae por eso).
 *
 * Las imágenes, el PDF y el texto se firman para verse en el navegador; el resto (una planilla, un
 * Word, un ZIP) para bajarse con su nombre original — la ruta es un uuid.
 */
export async function urlsAdjuntosEquipo(ids: readonly string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const ws = await getWorkspaceActual();
  if (!ws) return out;
  const filas = await adjuntosPorId(ws, ids);
  if (!filas.length) return out;
  const bucket = getSupabaseServer().storage.from(BUCKET_ADJUNTOS);
  const seVen = filas.filter((f) => !descargaComo(f.mime, f.nombre));
  if (seVen.length) {
    const { data, error } = await bucket.createSignedUrls(seVen.map((f) => f.path), VIDA_EQUIPO_SEG);
    if (error) console.warn('[curso-adjuntos] no pude firmar los adjuntos:', error.message);
    const idDe = new Map(seVen.map((f) => [f.path, f.id]));
    for (const s of data ?? []) {
      const id = s.path ? idDe.get(s.path) : undefined;
      if (id && s.signedUrl && !s.error) out[id] = s.signedUrl;
    }
  }
  // Los que se bajan, de a uno: el nombre de la descarga es por archivo. Son pocos (un chip por
  // archivo adjunto, no por imagen).
  for (const f of filas.filter((x) => descargaComo(x.mime, x.nombre))) {
    const { data, error } = await bucket.createSignedUrl(f.path, VIDA_EQUIPO_SEG, { download: descargaComo(f.mime, f.nombre) });
    if (error || !data) { console.warn(`[curso-adjuntos] no pude firmar ${f.id}: ${error?.message ?? 'sin URL'}`); continue; }
    out[f.id] = data.signedUrl;
  }
  return out;
}

/** La URL para que el EQUIPO abra UN adjunto. */
export async function urlAdjuntoEquipo(id: string): Promise<Resultado<{ url: string }>> {
  try {
    if (!refDeId(id)) return { ok: false, error: 'Ese archivo ya no existe.' };
    const urls = await urlsAdjuntosEquipo([id]);
    return urls[id] ? { ok: true, url: urls[id] } : { ok: false, error: 'Ese archivo ya no existe.' };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude abrir el archivo.') };
  }
}

/**
 * La URL firmada de un adjunto para el ALUMNO, o `null` (la ruta contesta 404).
 *
 * ⚠️ CORRE DESPUÉS DE `claseDelAlumno` con `exigeAbierta: true` (la ruta), adentro de
 *    `runWithWorkspace(firma.ws, …)`: la clase que recibe ya está abierta para ESTE alumno. Acá se
 *    contesta lo que falta (`decidirAdjuntoAlumno`): que el adjunto sea de este negocio y de ese
 *    producto, y que la descripción PUBLICADA de esa clase lo nombre.
 *
 * ⚠️ `descripcion_html` SE LEE ACÁ Y NO DE `COLUMNAS_CLASE`: esa lista la leen el portal, la ficha
 *    y el cron, y con una columna nueva adentro una migración atrasada tumbaría el portal de cada
 *    cliente. Si la 0216 no está, esta consulta falla y la ruta contesta 404 (fail-closed).
 */
export async function urlAdjuntoParaAlumno(clase: { id: number; productoId: number }, adjuntoId: string): Promise<string | null> {
  const ws = await getWorkspaceActual();
  if (!ws || !refDeId(adjuntoId)) return null;
  const db = await getTenantDb();
  const [{ data: filaClase, error: eClase }, filas] = await Promise.all([
    db.from('curso_clases').select('id, producto_id, descripcion_html').eq('workspace_id', ws).eq('id', clase.id).is('borrada_at', null).maybeSingle(),
    adjuntosPorId(ws, [adjuntoId]),
  ]);
  if (eClase) throw new Error(eClase.message);
  const c = filaClase as { id: number; producto_id: number | string; descripcion_html: string | null } | null;
  if (!c || Number(c.producto_id) !== clase.productoId) return null;
  const f = filas[0] ?? null;
  const decision = decidirAdjuntoAlumno({
    adjunto: f ? { id: f.id, productoId: Number(f.producto_id), path: f.path } : null,
    clase,
    htmlDeClase: c.descripcion_html,
    ws,
  });
  if (decision !== 'ok' || !f) return null;
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_ADJUNTOS)
    .createSignedUrl(f.path, VIDA_ALUMNO_SEG, { download: descargaComo(f.mime, f.nombre) });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Al GUARDAR la descripción de una clase: los adjuntos que nombra y todavía no tienen clase (se
 * subieron antes de que la clase existiera) pasan a ser de ésta. Best-effort: lo que decide si el
 * alumno ve un adjunto es que la descripción lo nombre (`decidirAdjuntoAlumno`), no esta columna;
 * esto la deja al día para saber de dónde es cada archivo (y para la purga). Devuelve cuántos.
 *
 * ⚠️ SÓLO LOS SIN CLASE: uno que ya es de otra clase (una imagen copiada de otra lección) se queda
 *    donde nació. Moverlo dejaría a la otra clase nombrando un adjunto «ajeno».
 */
export async function vincularAdjuntos(productoId: number, claseId: number, html: string): Promise<number> {
  try {
    const ws = await getWorkspaceActual();
    const ids = refsEnHtml(html).slice(0, TOPE_FIRMA_LOTE);
    if (!ws || !ids.length || !Number.isInteger(claseId) || claseId <= 0) return 0;
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_adjuntos').update({ clase_id: claseId })
      .eq('workspace_id', ws).eq('producto_id', productoId).is('clase_id', null).in('id', ids).select('id');
    if (error) { console.warn('[curso-adjuntos] no pude vincular los adjuntos:', error.message); return 0; }
    return (data ?? []).length;
  } catch (e) {
    console.warn('[curso-adjuntos] no pude vincular los adjuntos:', msg(e, String(e)));
    return 0;
  }
}
