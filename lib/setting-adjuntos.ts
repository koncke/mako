// =============================================================================
// setting-adjuntos — la biblioteca de ARCHIVOS de los mensajes (fotos, videos, documentos)
// =============================================================================
// Mig 0225 (`setting_adjuntos`), con el molde de lib/setting-audios.ts. Un paso de una secuencia
// con `tipo: 'media'` lleva `media_id` y su `cuerpo` es el caption; nunca el binario (AGENTS.md:
// «un adjunto va por referencia»). Las reglas puras —tipos, topes, path— viven en
// lib/setting-adjuntos-reglas.ts.
//
// Quién lee qué:
//   · el motor (lib/nutricion.ts) y la prueba real («Probar en mi WhatsApp»): `getAdjunto` +
//     `adjuntoBase64`, y con `tipoEnvioDeMime` eligen imagen, video o documento;
//   · el editor del mensaje, por /api/chat-agent/adjuntos (sólo admin): listar, subir, borrar.
//
// ⚠️ NADA DE AQUÍ PREGUNTA QUIÉN LLAMA: eso lo hace la ruta. Aquí se valida LO QUE SE ESCRIBE y LO
//    QUE SE BORRA: que el path sea de la biblioteca de ESTE workspace.
//
// ⚠️ EL ARCHIVO NO PASA POR EL SERVER (el molde es lib/curso-adjuntos.ts). La biblioteca de audios
//    sube base64 en JSON y una función de Vercel corta el cuerpo en ~4,5 MB; un video de 16 MB no
//    entra. El navegador sube DIRECTO al bucket con una URL firmada, y al registrar se pregunta a
//    Storage qué se guardó (`info()`: tipo y tamaño REALES, medido el 08/10/2026 contra wa-media).
//
// ⚠️ CADA CONSULTA LLEVA SU `workspace_id` A MANO, además de `getTenantDb()`. `getTenantDb` acota
//    sólo las tablas de `TENANT_TABLES` y con las demás es PASSTHROUGH: si al juntar las partes del
//    rediseño se pierde la línea de `setting_adjuntos` en lib/workspace.ts, una lectura por id
//    devolvería el archivo de OTRO negocio. Con la tabla registrada, el filtro va dos veces y no
//    cuesta nada.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import {
  BUCKET_ADJUNTOS_WA, CARPETA_ADJUNTOS, esMimeAdjuntoWA, pathDeAdjuntoWA, pathEsAdjuntoDe, pasosUsanAdjunto,
  topeDe, tituloDeArchivo, validarArchivoWA, sinFilaConfirmada, tablaNoExiste, huerfanosDelBucket, type AdjuntoDto,
} from './setting-adjuntos-reglas';

export type AdjuntoSetting = {
  id: number;
  titulo: string;
  media_path: string;
  media_mime: string;
  nombre_archivo: string | null;
  tamano: number | null;
};

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

const COLS = 'id, titulo, media_path, media_mime, nombre_archivo, tamano';
const TABLA = 'setting_adjuntos';

/**
 * Cuánto vive la URL para VER un archivo en la app: 12 horas, como la de los audios. La lista se
 * pide una vez al abrir el editor y las URLs quedan en el DOM toda la sesión; con una hora, una
 * foto dejaba de verse sin ningún error (lib/setting-audios.ts lo tiene medido).
 */
const HORAS_URL = 12;

const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

function normalizar(r: Record<string, unknown>): AdjuntoSetting {
  return {
    id: Number(r.id),
    titulo: String(r.titulo ?? ''),
    media_path: String(r.media_path ?? ''),
    media_mime: String(r.media_mime ?? ''),
    nombre_archivo: r.nombre_archivo == null ? null : String(r.nombre_archivo),
    tamano: r.tamano == null ? null : Number(r.tamano),
  };
}

/**
 * El archivo, o null si no existe en ESTE workspace.
 *
 * ⚠️ «NO PUDE LEER» TIRA, NO DEVUELVE NULL. Para el motor son dos cosas: null es «el archivo ya
 *    no existe» (el paso falla y se avisa), una excepción es la base caída (se reintenta). Un null
 *    por un error de red le diría al dueño que borró algo que sigue ahí.
 */
export async function getAdjunto(id: number): Promise<AdjuntoSetting | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const ws = await getWorkspaceActual();
  if (!ws) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLS).eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) throw new Error(`getAdjunto: ${error.message}`);
  return data ? normalizar(data as Record<string, unknown>) : null;
}

/** El binario en base64 (lo que pide Evolution `sendMedia`), o null si no se pudo bajar. */
export async function adjuntoBase64(a: Pick<AdjuntoSetting, 'media_path'>): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA).download(a.media_path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer()).toString('base64');
  } catch { return null; }
}

/** La biblioteca del workspace, la más nueva primero. Paginada: PostgREST corta en 1000 sin avisar. */
export async function listarAdjuntos(): Promise<AdjuntoSetting[]> {
  const ws = await getWorkspaceActual();
  if (!ws) return [];
  const db = await getTenantDb();
  const filas = await leerTodo<Record<string, unknown>>(db, TABLA, COLS, { eq: { workspace_id: ws }, orden: [{ col: 'id', asc: false }] });
  return filas.map(normalizar);
}

/** Las URLs para VER los archivos en la app (`id → URL`). Lo que no se pudo firmar no está. */
export async function urlsDeAdjuntos(lista: AdjuntoSetting[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  if (!lista.length) return out;
  try {
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA)
      .createSignedUrls(lista.map((a) => a.media_path), HORAS_URL * 3600);
    if (error) { console.warn('[setting-adjuntos] no pude firmar la biblioteca:', error.message); return out; }
    const idDe = new Map(lista.map((a) => [a.media_path, a.id]));
    for (const s of data ?? []) {
      const id = s.path ? idDe.get(s.path) : undefined;
      if (id != null && s.signedUrl && !s.error) out[id] = s.signedUrl;
    }
  } catch (e) {
    console.warn('[setting-adjuntos] no pude firmar la biblioteca:', msg(e, String(e)));
  }
  return out;
}

/** Lo que viaja a la pantalla: sin el path del bucket. */
export function aDto(a: AdjuntoSetting, url: string | null): AdjuntoDto {
  return { id: a.id, titulo: a.titulo, media_mime: a.media_mime, nombre_archivo: a.nombre_archivo, tamano: a.tamano, url };
}

/**
 * La URL firmada para que el NAVEGADOR suba el archivo directo al bucket (PUT multipart, el
 * pedido de `uploadToSignedUrl`; lo arma `subirConProgreso`, app/customer-success/curso/
 * subir-video.ts). Valida lo que el navegador DECLARA; lo que de verdad llegó se valida al
 * registrar.
 */
export async function urlSubidaAdjunto(input: { nombre: string; mime: string; tamano: number }): Promise<Resultado<{ path: string; signedUrl: string; apikey: string | null }>> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    const v = validarArchivoWA({ nombre: input.nombre, tipo: input.mime, tamano: input.tamano });
    if (!v.ok) return v;
    const path = pathDeAdjuntoWA(ws, v.mime, randomUUID());
    if (!path) return { ok: false, error: 'No pude armar la subida.' };
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? 'No pude firmar la subida.' };
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    return { ok: true, path, signedUrl: data.signedUrl, apikey };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude preparar la subida.') };
  }
}

/**
 * Borra del bucket un archivo que se SUBIÓ y NO quedó registrado (revisión del 08/10/2026,
 * costuras-10). Sin esto, cada registro fallido —`info()` caído, un insert que rebota, la tabla de
 * la 0225 todavía sin aplicar— dejaba el binario en `wa-media` para siempre: nadie lista ni limpia
 * `<ws>/setting-adjuntos/` (no es el prefijo del espejo), y cada reintento sube otra copia con otro
 * uuid. Best-effort: si algo falla aquí, el huérfano queda como antes, nunca un error nuevo.
 *
 * ⚠️ SE BORRA SÓLO SI SE CONFIRMA QUE NO HAY FILA. Un insert que «falló» por la red pudo haber
 *    escrito igual, y un 23505 dice que OTRO registro del mismo path ganó: borrar ahí dejaría una
 *    fila sin binario, que el motor manda como «el archivo ya no existe». Con la lectura caída
 *    (`error`) no se sabe, y no se borra — salvo que el error diga que la TABLA no existe: sin
 *    tabla no puede haber fila.
 * ⚠️ Y LA GUARDA DEL PATH SE VUELVE A PREGUNTAR AQUÍ ADENTRO: el `remove` cuelga de ella siempre,
 *    no de que el que llama se haya acordado.
 */
async function soltarSiNoQuedo(db: Awaited<ReturnType<typeof getTenantDb>>, ws: number, path: string): Promise<void> {
  if (!pathEsAdjuntoDe(path, ws)) return;
  try {
    const lectura = await db.from(TABLA).select('id').eq('workspace_id', ws).eq('media_path', path).maybeSingle();
    if (!sinFilaConfirmada(lectura)) return;
    await getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA).remove([path]);
  } catch { /* best-effort: queda huérfano, como antes */ }
}

/**
 * Registra un archivo YA SUBIDO. Registrar dos veces el mismo path devuelve la misma fila.
 *
 * ⚠️ SE LE PREGUNTA A STORAGE QUÉ SE GUARDÓ (`info()`), no se le cree al navegador: el bucket no
 *    filtra tipos ni tamaños, y la URL firmada acepta cualquier cosa en ese path. Lo que no pasa la
 *    lista blanca o el tope se BORRA del bucket y no se registra. Si `info()` no contesta, no se
 *    registra (fail-closed): «el archivo no terminó de subir».
 * ⚠️ Y LO QUE NO SE REGISTRA NO SE QUEDA EN EL BUCKET (`soltarSiNoQuedo`): desde que la lectura
 *    previa dijo que no hay fila, toda salida con error borra lo subido. Lo que esto no cubre —la
 *    pestaña cerrada entre la subida y el registro, donde no corre nada del server— lo levanta
 *    `barrerAdjuntosHuerfanos` en la subida siguiente.
 */
export async function registrarAdjunto(input: { path: string; titulo?: string | null; nombre?: string | null }): Promise<Resultado<{ adjunto: AdjuntoDto }>> {
  // Se arma recién cuando la guarda del path pasó y se sabe que no hay fila: antes de eso, un
  // error no autoriza a borrar nada (el path puede no ser de este negocio, o ya estar registrado).
  let soltar: (() => Promise<void>) | null = null;
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    const path = String(input.path ?? '');
    if (!pathEsAdjuntoDe(path, ws)) return { ok: false, error: 'Ese archivo no es de este negocio.' };
    const db = await getTenantDb();

    const previa = await db.from(TABLA).select(COLS).eq('workspace_id', ws).eq('media_path', path).maybeSingle();
    if (previa.error) {
      // Sin la tabla (la 0225 sin aplicar y el código ya desplegado) no hay dónde registrar lo que
      // se acaba de subir, y tampoco puede haber una fila: se suelta. Con cualquier otro error de
      // lectura no se sabe si la fila existe, y no se toca nada.
      if (tablaNoExiste(previa.error)) {
        await soltarSiNoQuedo(db, ws, path);
        return { ok: false, error: 'La biblioteca de archivos no está lista.' };
      }
      return { ok: false, error: previa.error.message };
    }
    if (previa.data) {
      const a = normalizar(previa.data as Record<string, unknown>);
      return { ok: true, adjunto: aDto(a, (await urlsDeAdjuntos([a]))[a.id] ?? null) };
    }
    soltar = () => soltarSiNoQuedo(db, ws, path);

    const bucket = getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA);
    const info = await bucket.info(path);
    if (info.error || !info.data) { await soltar(); return { ok: false, error: 'El archivo no terminó de subir.' }; }
    const mime = String(info.data.contentType ?? '').toLowerCase().split(';')[0]!.trim();
    const tamano = Number(info.data.size ?? 0);
    const rechazo = !esMimeAdjuntoWA(mime) ? 'Ese formato no va.'
      : !(tamano > 0) ? 'El archivo está vacío.'
        : tamano > topeDe(mime) ? 'Pasa del tope de WhatsApp.' : null;
    if (rechazo) {
      // Se borra lo que subió el navegador: el path es de ESTE workspace (lo dijo la guarda).
      try { await bucket.remove([path]); } catch { /* huérfano tolerable: la fila no existe */ }
      return { ok: false, error: rechazo };
    }

    const nombre = (input.nombre ?? '').toString().trim().slice(0, 200) || null;
    const titulo = ((input.titulo ?? '').toString().trim() || tituloDeArchivo(nombre ?? '')).slice(0, 160);
    const fila = { workspace_id: ws, titulo, media_path: path, media_mime: mime, nombre_archivo: nombre, tamano };
    const { data, error } = await db.from(TABLA).insert(fila).select(COLS).single();
    if (error) {
      // Dos registros en paralelo del mismo path: el segundo choca con el índice único y
      // contesta con la fila del primero.
      if ((error as { code?: string }).code === '23505') {
        const otra = await db.from(TABLA).select(COLS).eq('workspace_id', ws).eq('media_path', path).maybeSingle();
        if (otra.data) {
          const a = normalizar(otra.data as Record<string, unknown>);
          return { ok: true, adjunto: aDto(a, (await urlsDeAdjuntos([a]))[a.id] ?? null) };
        }
      }
      // Un error de la base (o la tabla que todavía no existe): lo subido no queda colgado.
      // `soltarSiNoQuedo` vuelve a mirar: si la fila sí se escribió, no borra.
      await soltar();
      return { ok: false, error: error.message };
    }
    soltar = null;
    const a = normalizar(data as Record<string, unknown>);
    return { ok: true, adjunto: aDto(a, (await urlsDeAdjuntos([a]))[a.id] ?? null) };
  } catch (e) {
    if (soltar) await soltar();
    return { ok: false, error: msg(e, 'No se pudo guardar el archivo.') };
  }
}

/**
 * Las automatizaciones VIVAS que tienen un paso con este archivo. Las archivadas no frenan el
 * borrado: no se ven en ningún lado, y si alguien las restaura el paso falla con «el archivo ya no
 * existe» en vez de mandar otro.
 */
export async function usosDeAdjunto(id: number): Promise<Array<{ id: number; nombre: string }>> {
  const ws = await getWorkspaceActual();
  if (!ws) return [];
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; nombre: string | null; pasos: unknown; archivada_at: string | null }>(
    db, 'nutricion_secuencias', 'id, nombre, pasos, archivada_at', { eq: { workspace_id: ws } },
  );
  return filas.filter((s) => !s.archivada_at && pasosUsanAdjunto(s.pasos, id)).map((s) => ({ id: Number(s.id), nombre: s.nombre ?? 'Sin nombre' }));
}

/**
 * Borra un archivo de la biblioteca.
 *
 * ⚠️ NO SI UN PASO LO USA. El DELETE de la biblioteca de audios limpia su mapa por clave pero no
 *    los pasos (relevo de la parte del composer, 08/10/2026): el motor después falla con «el audio
 *    del paso ya no existe» y reintenta cada 24 h sin un aviso en la pantalla. Aquí se contesta
 *    con la automatización que lo usa, para que se cambie el paso primero.
 * ⚠️ EL BINARIO SE BORRA SÓLO SI ES DE LA BIBLIOTECA DE ESTE WORKSPACE (`pathEsAdjuntoDe`): una
 *    copia de «Completar con los datos de Mau» apunta al archivo del dueño.
 */
export async function borrarAdjunto(id: number): Promise<{ ok: true } | { ok: false; error: string; usadoEn?: Array<{ id: number; nombre: string }> }> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
    const a = await getAdjunto(id);
    if (!a) return { ok: true };
    const usos = await usosDeAdjunto(id);
    if (usos.length) return { ok: false, error: `Lo usa «${usos[0]!.nombre}».`, usadoEn: usos };
    const db = await getTenantDb();
    const { error } = await db.from(TABLA).delete().eq('workspace_id', ws).eq('id', id);
    if (error) return { ok: false, error: error.message };
    if (pathEsAdjuntoDe(a.media_path, ws)) {
      try { await getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA).remove([a.media_path]); } catch { /* huérfano tolerable */ }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar el archivo.') };
  }
}

/** Cuántos objetos se piden por página al listar la carpeta, y el tope de lo que se revisa. */
const PAGINA_BUCKET = 500;
const TOPE_LISTADO = 5000;

/**
 * Barre `<ws>/setting-adjuntos/` y borra lo que no tiene fila y tiene más de una hora (revisión del
 * 08/10/2026, costuras-10). Es lo que `soltarSiNoQuedo` no puede cubrir: la pestaña cerrada entre
 * la subida y el registro, o la función cortada por su `maxDuration` a mitad de registrar. Ahí no
 * corre nada del server, y el binario quedaba para siempre.
 *
 * Lo dispara la ruta al firmar una subida nueva, con `after()` (no demora la respuesta): quien deja
 * huérfanos es quien sube, y así la limpieza no depende de un cron más.
 *
 * ⚠️ «NO PUDE MIRAR» NO DECIDE NADA: si el listado del bucket o la lectura de las filas fallan —la
 *    tabla sin aplicar incluida—, no se borra nada. Un error de lectura leído como «no hay filas»
 *    borraría la biblioteca entera de un negocio.
 * ⚠️ QUÉ ES HUÉRFANO LO DECIDE `huerfanosDelBucket` (pura, con test): sólo paths de la biblioteca de
 *    ESTE workspace, sin fila, con fecha y con más de una hora. Y como mucho `TOPE_BARRIDO` por vez.
 * ⚠️ LAS FILAS SE LEEN DESPUÉS DE LISTAR: un archivo registrado entre las dos lecturas aparece en
 *    las filas y se queda. Al revés (filas primero), lo registrado en el medio parecería huérfano.
 *
 * Devuelve qué hizo, o null si no pudo mirar.
 */
export async function barrerAdjuntosHuerfanos(): Promise<{ revisados: number; borrados: number } | null> {
  try {
    const ws = await getWorkspaceActual();
    if (!ws) return null;
    const bucket = getSupabaseServer().storage.from(BUCKET_ADJUNTOS_WA);
    const carpeta = `${ws}/${CARPETA_ADJUNTOS}`;
    const objetos: Array<{ path: string; creado: string | null }> = [];
    for (let offset = 0; offset < TOPE_LISTADO; offset += PAGINA_BUCKET) {
      const { data, error } = await bucket.list(carpeta, { limit: PAGINA_BUCKET, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) return null;
      for (const o of data ?? []) objetos.push({ path: `${carpeta}/${o.name}`, creado: o.created_at ?? null });
      if (!data || data.length < PAGINA_BUCKET) break;
    }
    if (!objetos.length) return { revisados: 0, borrados: 0 };
    const db = await getTenantDb();
    // `leerTodo` tira si la lectura falla: el catch de abajo devuelve null y no se borra nada.
    const filas = await leerTodo<{ media_path: string | null }>(db, TABLA, 'media_path', { eq: { workspace_id: ws } });
    const registrados = new Set(filas.map((f) => String(f.media_path ?? '')));
    const huerfanos = huerfanosDelBucket(objetos, registrados, ws, Date.now());
    if (huerfanos.length) {
      const { error } = await bucket.remove(huerfanos);
      if (error) { console.warn('[setting-adjuntos] el barrido no pudo borrar:', error.message); return null; }
      console.log(`[setting-adjuntos] barrido ws ${ws}: ${huerfanos.length} huérfanos borrados de ${objetos.length}`);
    }
    return { revisados: objetos.length, borrados: huerfanos.length };
  } catch (e) {
    console.warn('[setting-adjuntos] el barrido no pudo mirar:', msg(e, String(e)));
    return null;
  }
}
