import 'server-only';

// =============================================================================
// curso-admin — las escrituras de la tab Curso (lo que arma Mauricio) y la subida de videos
// =============================================================================
// Lo que hace el equipo desde /customer-success/curso: crear, editar, borrar y ordenar las
// clases de un producto, y subir sus videos. Las lecturas que comparten la ficha, el portal y
// el cron viven en lib/curso-datos.ts; las reglas de esta pantalla (validar, ordenar, el path
// del video), en app/customer-success/curso/reglas.ts, que un test ejecuta.
//
// ⚠️ NADA DE ACÁ PREGUNTA QUIÉN LLAMA: eso lo hacen las server actions
// (app/customer-success/curso/actions.ts), que es la puerta. Acá se valida LO QUE SE ESCRIBE:
// que el producto sea de este workspace, que la etapa exista en SU entrega, que el video sea
// de este curso. Todo contra `getTenantDb()`, que pone el `.eq` del inquilino.
//
// ⚠️ EL VIDEO NO PASA POR ACÁ. Una server action topa el cuerpo en 1 MB y una función de
// Vercel en ~4,5 MB (AGENTS.md, «tres topes del entorno»): el navegador lo sube DIRECTO al
// bucket con una URL firmada que firma `urlSubida`, y al guardar la clase se verifica que el
// archivo haya llegado.

import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { entregaDeProducto } from './entrega-servicio';
import { COLUMNAS_CLASE, aClase } from './curso-datos';
import { leerTodo } from './supabase-paginado';
import type { Clase } from './curso';
import {
  validarClase, pathDeSubida, pathEsDelWorkspace, reordenar, clasesDeEtapa, siguienteOrden,
  esMimeVideo, TOPE_VIDEO_BYTES, valorGrabar, type AccesoFila,
} from '@/app/customer-success/curso/reglas';

/** El bucket privado de la mig 0202. */
export const BUCKET_CURSO = 'curso-videos';

/** Cuánto vive el link para VER un video subido desde el editor: lo que dura revisarlo. */
const VIDA_LECTURA_SEG = 10 * 60;

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

type FilaDeClase = Parameters<typeof aClase>[0];

const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

/**
 * ¿El producto es de ESTE workspace? Y sus etapas de entrega (las CLAVES, en orden).
 *
 * ⚠️ NO MIRA `activo`: la tab ofrece sólo los productos vivos (la misma lista que el kanban),
 * pero una clase de un producto que se dio de baja se puede seguir borrando o moviendo —
 * negarlo dejaría su contenido trabado sin una pantalla que lo muestre.
 *
 * Exportada para las notas (lib/curso-notas.ts): la misma pregunta, en un solo lugar.
 */
export async function productoConEtapas(productoId: number): Promise<{ etapas: string[] } | null> {
  if (!Number.isInteger(productoId) || productoId <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('productos').select('id').eq('id', productoId).limit(1);
  if (error) throw new Error(error.message);
  if (!(data ?? []).length) return null;
  const cfg = await entregaDeProducto(productoId);
  return { etapas: cfg.etapas.map((e) => e.key) };
}

async function claseCruda(claseId: number): Promise<Clase | null> {
  if (!Number.isInteger(claseId) || claseId <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select(COLUMNAS_CLASE).eq('id', claseId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? aClase(data as FilaDeClase) : null;
}

/**
 * Borra un video del bucket. No tira: lo que importa (la clase) ya se guardó, y un archivo
 * que quedó de más se ve en Storage; una clase que no se guarda porque falló un borrado, no.
 */
async function borrarArchivo(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    // ⚠️ SÓLO SI YA NO LO USA NINGUNA CLASE. Corre DESPUÉS de cambiar o borrar la fila, y dos
    // clases pueden apuntar al mismo archivo (`validarClase` acepta cualquier video del producto):
    // borrarlo sin preguntar dejaba el reproductor negro en la otra, para todos sus clientes. Ante
    // la duda (la consulta falla) no se borra: un archivo huérfano cuesta disco, uno borrado de más
    // cuesta la clase.
    const { data: usos, error: eUsos } = await (await getTenantDb()).from('curso_clases').select('id').eq('video_path', path).limit(1);
    if (eUsos || (usos ?? []).length) return;
    const { error } = await getSupabaseServer().storage.from(BUCKET_CURSO).remove([path]);
    if (error) console.warn(`[curso-admin] no pude borrar el video ${path}: ${error.message}`);
  } catch (e) {
    console.warn('[curso-admin] no pude borrar el video:', msg(e, String(e)));
  }
}

/**
 * Crea o edita una clase. Una clase nueva (o que cambia de etapa) entra AL FINAL de su etapa.
 *
 * ⚠️ UN VIDEO SUBIDO SE VERIFICA ANTES DE GUARDAR (`exists`): la subida la hace el navegador y
 * puede cortarse (pestaña cerrada, red), y una clase que apunta a un archivo que no está es un
 * reproductor negro en el portal del cliente. Y si la clase TENÍA otro archivo, se borra
 * después de guardar: 2 GiB por video contra un tope global de 5 GiB no dejan acumular.
 */
export async function guardarClase(raw: unknown): Promise<Resultado<{ clase: Clase }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    const productoId = Number((raw as { productoId?: unknown } | null)?.productoId);
    const prod = await productoConEtapas(productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    const v = validarClase(raw, { ws, productoId, etapas: prod.etapas });
    if (!v.ok) return v;

    const previa = v.id ? await claseCruda(v.id) : null;
    if (v.id && (!previa || previa.productoId !== productoId)) return { ok: false, error: 'Esa clase ya no existe.' };

    if (v.fila.video_tipo === 'archivo' && v.fila.video_path !== previa?.videoPath) {
      // ⚠️ `exists` contesta `false` con un error «Bad Request» (HTTP 400, no 404) cuando el
      // archivo no está — medido el 06/10 contra el bucket. Cualquier otro fallo TIRA (lo
      // ataja el catch), así que `false` acá es «no llegó», no «no pude preguntar».
      const { data: hay } = await getSupabaseServer().storage.from(BUCKET_CURSO).exists(v.fila.video_path!);
      if (!hay) return { ok: false, error: 'El video no terminó de subir.' };
    }

    const db = await getTenantDb();
    let orden = previa?.orden ?? 0;
    if (!previa || previa.etapa !== v.fila.etapa) {
      const { data: hermanas, error } = await db.from('curso_clases').select('id, etapa, orden')
        .eq('producto_id', productoId).eq('etapa', v.fila.etapa);
      if (error) return { ok: false, error: error.message };
      orden = siguienteOrden((hermanas ?? []) as Array<{ id: number; etapa: string; orden: number }>, v.fila.etapa);
    }

    const ahora = new Date().toISOString();
    const fila = { ...v.fila, orden, updated_at: ahora };
    const { data, error } = previa
      ? await db.from('curso_clases').update(fila).eq('id', previa.id).select(COLUMNAS_CLASE).single()
      : await db.from('curso_clases').insert([{ ...fila, producto_id: productoId }]).select(COLUMNAS_CLASE).single();
    if (error) return { ok: false, error: error.message };

    if (previa?.videoPath && previa.videoPath !== v.fila.video_path) await borrarArchivo(previa.videoPath);
    return { ok: true, clase: aClase(data as FilaDeClase) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar la clase.') };
  }
}

/**
 * Borra una clase. Su avance (`curso_progreso`) se va con ella por la FK `on delete cascade`
 * de la mig 0202 — por eso la pantalla pregunta antes diciendo cuántos clientes lo pierden.
 */
export async function borrarClase(claseId: number): Promise<Resultado> {
  try {
    const c = await claseCruda(claseId);
    if (!c) return { ok: false, error: 'Esa clase ya no existe.' };
    const db = await getTenantDb();
    const { error } = await db.from('curso_clases').delete().eq('id', c.id);
    if (error) return { ok: false, error: error.message };
    await borrarArchivo(c.videoPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar la clase.') };
  }
}

/**
 * Sube o baja una clase un lugar dentro de su etapa. Renumera la etapa ENTERA 0..n-1 (ver
 * `reordenar`): con huecos o empates en `orden`, intercambiar dos números puede no mover nada.
 */
export async function moverClase(claseId: number, dir: 'arriba' | 'abajo'): Promise<Resultado<{ ids: number[] }>> {
  try {
    if (dir !== 'arriba' && dir !== 'abajo') return { ok: false, error: 'Dirección inválida.' };
    const c = await claseCruda(claseId);
    if (!c) return { ok: false, error: 'Esa clase ya no existe.' };
    // El orden sólo tiene sentido adentro de una etapa que existe: una huérfana se MUEVE de
    // etapa desde el editor, no se ordena entre otras huérfanas.
    const prod = await productoConEtapas(c.productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!prod.etapas.includes(c.etapa)) return { ok: false, error: 'Su etapa ya no existe.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').select('id, etapa, orden')
      .eq('producto_id', c.productoId).eq('etapa', c.etapa);
    if (error) return { ok: false, error: error.message };
    const actuales = clasesDeEtapa((data ?? []) as Array<{ id: number; etapa: string; orden: number }>, c.etapa);
    const ids = reordenar(actuales.map((x) => Number(x.id)), c.id, dir);
    if (!ids) return { ok: true, ids: actuales.map((x) => Number(x.id)) };
    const ahora = new Date().toISOString();
    const cambios = ids
      .map((id, orden) => ({ id, orden }))
      .filter(({ id, orden }) => actuales.find((x) => Number(x.id) === id)?.orden !== orden);
    // Uno por fila: son las clases de UNA etapa (un puñado) y PostgREST no tiene un update
    // con un valor distinto por fila sin un upsert, que pediría mandar la fila entera.
    for (const { id, orden } of cambios) {
      const { error: e2 } = await db.from('curso_clases').update({ orden, updated_at: ahora }).eq('id', id);
      if (e2) return { ok: false, error: e2.message };
    }
    return { ok: true, ids };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo mover la clase.') };
  }
}

/**
 * La URL firmada para que el NAVEGADOR suba un video directo al bucket.
 *
 * Cómo se usa del otro lado (verificado contra `uploadToSignedUrl` de
 * node_modules/@supabase/storage-js 2.106.1, no adivinado): `PUT` a `signedUrl` —que ya trae
 * el `?token=`— con un `FormData` de dos partes (`cacheControl` y el archivo con nombre de
 * campo vacío) y el header `x-upsert`. La URL vale 2 horas.
 *
 * Probado de punta a punta el 06/10/2026 contra `curso-videos` en producción (archivo de
 * prueba, borrado después): firma → PUT multipart → 200 → `exists` true → lectura firmada 200
 * `video/mp4`. Y la parte del archivo con `application/octet-stream` rebota con HTTP 400
 * `invalid_mime_type`: por eso el editor corrige el tipo antes (`mimeDeArchivo`).
 *
 * ⚠️ `apikey` VA DE VUELTA, y no es un secreto: es la anon, la misma que ya viaja en el bundle
 * (`NEXT_PUBLIC_…`). La subida de creativos dice que el gateway la exige
 * (app/api/ads-manager/creative-signurl/route.ts) y la medición de hoy dice que NO: sin ella
 * también entra con 200. Se manda igual porque no cuesta nada y no hay cómo saber si aquello
 * fue verdad alguna vez.
 */
export async function urlSubida(productoId: number, mime: string, bytes: number): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    if (!(await productoConEtapas(productoId))) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!esMimeVideo(mime)) return { ok: false, error: 'Ese formato no va: MP4, WEBM o MOV.' };
    if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: 'El archivo está vacío.' };
    if (bytes > TOPE_VIDEO_BYTES) return { ok: false, error: 'Pasa de 2 GB.' };
    const path = pathDeSubida(ws, productoId, mime, randomUUID());
    if (!path) return { ok: false, error: 'No pude armar la subida.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_CURSO).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? 'No pude firmar la subida.' };
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    if (!apikey) console.warn('[curso-admin] sin NEXT_PUBLIC_SUPABASE_ANON_KEY: la subida directa puede rebotar en el gateway.');
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude preparar la subida.') };
  }
}

/**
 * Borra un video que se SUBIÓ y no se llegó a guardar en ninguna clase (el editor se cerró sin
 * guardar, o se eligió otro archivo encima).
 *
 * ⚠️ SÓLO SI NINGUNA CLASE LO USA: el path viaja desde el navegador, y sin esta pregunta un
 * «descartar» con el path de una clase ya guardada le borraría el video a todos los clientes.
 * Y sólo de este workspace (el prefijo del path). Sin esto, cada subida abandonada deja hasta
 * 2 GiB en un bucket con 5 GiB de tope para TODA la plataforma.
 */
export async function descartarVideo(path: string): Promise<Resultado> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws || !pathEsDelWorkspace(path, ws)) return { ok: false, error: 'Ese video no es de este negocio.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').select('id').eq('video_path', path).limit(1);
    if (error) return { ok: false, error: error.message };
    if ((data ?? []).length) return { ok: true };
    await borrarArchivo(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo descartar el video.') };
  }
}

/**
 * Un link de VIDA CORTA para ver un video subido (la vista previa del editor).
 *
 * ⚠️ SÓLO PATHS DE ESTE WORKSPACE: el path viaja desde el navegador, y sin el prefijo firmar
 * cualquier ruta del bucket le mostraría a un negocio el video de otro.
 */
export async function urlLectura(path: string): Promise<Resultado<{ url: string }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws || !pathEsDelWorkspace(path, ws)) return { ok: false, error: 'Ese video no es de este negocio.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_CURSO).createSignedUrl(path, VIDA_LECTURA_SEG);
    if (error || !data) return { ok: false, error: error?.message ?? 'No pude abrir el video.' };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude abrir el video.') };
  }
}

/**
 * Marca una clase para grabar (`true`), para no grabar (`false`) o la deja sin decidir (`null`).
 *
 * ⚠️ UNA ESCRITURA DE SÓLO ESA COLUMNA, y no por `guardarClase`: guardar la clase entera manda
 * la fila que arma `validarClase`, que NO trae `grabar` — así que ninguno de los dos caminos
 * puede pisar al otro. Si esto pasara por el guardado, abrir el editor en una pestaña vieja y
 * guardar un título le devolvería a la clase la marca de hace una hora.
 *
 * ⚠️ NI SIQUIERA `updated_at`: la marca es una decisión de PRODUCCIÓN (qué falta grabar), no un
 * cambio del contenido que ve el cliente.
 */
export async function marcarGrabar(claseId: number, raw: unknown): Promise<Resultado<{ grabar: boolean | null }>> {
  try {
    const valor = valorGrabar(raw);
    if (valor === undefined) return { ok: false, error: 'Marca inválida.' };
    if (!Number.isInteger(claseId) || claseId <= 0) return { ok: false, error: 'Esa clase ya no existe.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').update({ grabar: valor }).eq('id', claseId).select('id, grabar').maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Esa clase ya no existe.' };
    const g = (data as { grabar: boolean | null }).grabar;
    return { ok: true, grabar: g === true || g === false ? g : null };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo marcar.') };
  }
}

/**
 * La marca de grabar de las clases de varios productos: claseId → `true | false | null`.
 *
 * ⚠️ VA APARTE DE `COLUMNAS_CLASE`, a propósito: ésa la leen también el portal del alumno, la
 * ficha y el cron. Con `grabar` adentro, una migración atrasada tumbaría el portal de cada
 * cliente; así, lo único que depende de la 0208 es la tab del equipo.
 *
 * ⚠️ TIRA si no puede leer, y quien llama decide: leída como «nada marcado», una consulta caída
 * le diría a Mauricio que no hay nada por grabar.
 */
export async function grabarDeProductos(productoIds: readonly number[]): Promise<Record<number, boolean | null>> {
  const out: Record<number, boolean | null> = {};
  if (!productoIds.length) return out;
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; grabar: boolean | null }>(db, 'curso_clases', 'id, grabar',
    { filtros: (q) => q.in('producto_id', [...productoIds]), orden: 'id' });
  for (const f of filas) out[Number(f.id)] = f.grabar === true || f.grabar === false ? f.grabar : null;
  return out;
}

/**
 * Links de vida corta para los videos SUBIDOS de la vista previa del alumno
 * (app/customer-success/curso/vista). Ahí no hay token de alumno, así que la ruta del portal
 * (/api/compartido/curso/video, que valida el link) no sirve: se firma directo, como el editor.
 *
 * ⚠️ SÓLO PATHS DE ESTE WORKSPACE (el prefijo), por la misma razón que `urlLectura`. Lo que no se
 * pudo firmar no está en el mapa: la clase se dibuja sin video y la pantalla no se cae por eso.
 */
export async function urlsDeVistaPrevia(paths: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ws = await getWorkspaceActual();
  const propios = [...new Set(paths)].filter((p) => ws && pathEsDelWorkspace(p, ws));
  if (!propios.length) return out;
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_CURSO).createSignedUrls(propios, VIDA_LECTURA_SEG);
  if (error) { console.warn('[curso-admin] no pude firmar los videos de la vista previa:', error.message); return out; }
  for (const f of data ?? []) if (f.path && f.signedUrl && !f.error) out.set(f.path, f.signedUrl);
  return out;
}

/**
 * El acceso al portal de VARIOS clientes (la tabla de Avance): leadId → acceso. Los que nunca
 * recibieron su link no están en el mapa (y la tabla dice «sin link»).
 *
 * ⚠️ TIRA si no puede leer, y quien llama decide: leído como «nadie tiene link», una consulta
 * caída le diría a Mauricio que tiene que mandarle el link a los catorce.
 */
export async function accesosDeClientes(leadIds: readonly number[]): Promise<Map<number, AccesoFila>> {
  const out = new Map<number, AccesoFila>();
  if (!leadIds.length) return out;
  const db = await getTenantDb();
  // ⚠️ `area is null`: el acceso DEL CLIENTE. Desde la 0212 un cliente tiene además uno por cada
  // líder de área, y sin el filtro la columna «Acceso» pintaba el del último líder (#665).
  const { data, error } = await db.from('curso_accesos')
    .select('lead_id, revocado_at, ingresos, ultimo_ingreso_at').in('lead_id', [...leadIds]).is('area', null);
  if (error) throw new Error(error.message);
  for (const f of (data ?? []) as Array<{ lead_id: number; revocado_at: string | null; ingresos: number | null; ultimo_ingreso_at: string | null }>) {
    out.set(Number(f.lead_id), {
      estado: f.revocado_at ? 'cortado' : 'activo',
      ingresos: f.ingresos ?? 0,
      ultimoIngresoAt: f.ultimo_ingreso_at ?? null,
    });
  }
  return out;
}
