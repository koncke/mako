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
// que el producto sea de este workspace, que el MÓDULO exista en su curso (una etapa del kanban o
// un módulo suelto, lib/curso-modulos.ts), que el video sea de este curso. Todo contra `getTenantDb()`, que pone el `.eq` del inquilino.
//
// ⚠️ EL VIDEO NO PASA POR ACÁ. Una server action topa el cuerpo en 1 MB y una función de
// Vercel en ~4,5 MB (AGENTS.md, «tres topes del entorno»): el navegador lo sube DIRECTO al
// bucket con una URL firmada que firma `urlSubida`, y al guardar la clase se verifica que el
// archivo haya llegado.

import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { COLUMNAS_CLASE, aClase } from './curso-datos';
import { modulosDelCurso } from './curso-modulos-datos';
import type { ModuloCurso } from './curso-modulos';
import { tieneTarea, type Clase, type TipoClase } from './curso';
import {
  validarClase, validarVideoEntrada, validarCamposEntrada, pathDeSubida, pathEsDelWorkspace, reordenar, clasesDeEtapa, siguienteOrden,
  ordenConClaseEn, esMimeVideo, TOPE_VIDEO_BYTES, TOPE_TITULO, TOPE_TEXTO, ERROR_OBLIGATORIA_SUELTO, TIPOS_CLASE, type AccesoFila,
} from '@/app/customer-success/curso/reglas';

/** El bucket privado de la mig 0202. */
export const BUCKET_CURSO = 'curso-videos';

/** Cuánto vive el link para VER un video subido desde el editor: lo que dura revisarlo. */
const VIDA_LECTURA_SEG = 10 * 60;

export type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

type FilaDeClase = Parameters<typeof aClase>[0];

const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

/** ¿El producto es de ESTE workspace? (sin leer su curso: lo que pide la subida de un video). */
async function productoDelNegocio(productoId: number): Promise<boolean> {
  if (!Number.isInteger(productoId) || productoId <= 0) return false;
  const db = await getTenantDb();
  const { data, error } = await db.from('productos').select('id').eq('id', productoId).limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/**
 * ¿El producto es de ESTE workspace? Y los MÓDULOS de su curso (D1, lib/curso-modulos.ts): las
 * etapas del kanban que son módulo y los sueltos, en orden.
 *
 * ⚠️ NO MIRA `activo`: la tab ofrece sólo los productos vivos (la misma lista que el kanban),
 * pero una clase de un producto que se dio de baja se puede seguir borrando o moviendo —
 * negarlo dejaría su contenido trabado sin una pantalla que lo muestre.
 *
 * ⚠️ LEE ESTRICTO, Y TIRA SI NO PUEDE (riesgo 12 del relevo del 07/10/2026). Hasta el 08/10/2026
 * validaba contra `entregaDeProducto`, que con la lectura caída devuelve las etapas DE FÁBRICA:
 * «onboarding» pasaba por una etapa válida sobre un producto que tenía nueve propias, y la clase
 * quedaba colgando de un módulo que no existe. Una lectura que cae al default sirve para dibujar,
 * nunca para decidir.
 */
export async function productoConModulos(productoId: number): Promise<{ modulos: ModuloCurso[]; claves: string[] } | null> {
  if (!(await productoDelNegocio(productoId))) return null;
  const cur = await modulosDelCurso(productoId, { estricta: true });
  if (!cur) throw new Error('No pude leer los módulos. Intenta de nuevo.');
  return { modulos: cur.modulos, claves: cur.modulos.map((m) => m.clave) };
}

/**
 * Lo mismo con el nombre de antes, para las notas (lib/curso-notas.ts): una nota «de etapa» cuelga
 * de la clave de un MÓDULO desde el 08/10/2026 (desvincular le muda la clave junto con sus clases,
 * lib/curso-modulos-datos.ts). La misma pregunta, en un solo lugar.
 */
export async function productoConEtapas(productoId: number): Promise<{ etapas: string[] } | null> {
  const p = await productoConModulos(productoId);
  return p ? { etapas: p.claves } : null;
}

async function claseCruda(claseId: number): Promise<Clase | null> {
  if (!Number.isInteger(claseId) || claseId <= 0) return null;
  const db = await getTenantDb();
  // Sin las de la papelera (mig 0223): para el editor, una clase borrada no existe.
  const { data, error } = await db.from('curso_clases').select(COLUMNAS_CLASE).eq('id', claseId).is('borrada_at', null).maybeSingle();
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
    // ⚠️ CON LAS DE LA PAPELERA (mig 0223; excepción nombrada en tests/curso-papelera.test.ts): una clase
    // borrada que vuelve con «Deshacer» tiene que volver CON su video.
    const { data: usos, error: eUsos } = await (await getTenantDb()).from('curso_clases').select('id').eq('video_path', path).limit(1);
    if (eUsos || (usos ?? []).length) return;
    const { error } = await getSupabaseServer().storage.from(BUCKET_CURSO).remove([path]);
    if (error) console.warn(`[curso-admin] no pude borrar el video ${path}: ${error.message}`);
  } catch (e) {
    console.warn('[curso-admin] no pude borrar el video:', msg(e, String(e)));
  }
}

/**
 * Crea o edita una clase entera (el editor de la clase). Una clase nueva (o que cambia de módulo)
 * entra AL FINAL de su módulo.
 *
 * ⚠️ SI CAMBIA EL TEXTO PLANO, LA DESCRIPCIÓN RICA SE VACÍA en la misma escritura. Este camino escribe
 * `descripcion` desde un textarea y no conoce `descripcion_html` (mig 0216): sin esto, el portal
 * seguiría dibujando el HTML viejo debajo de un texto que alguien acaba de cambiar — dos versiones
 * que dicen cosas distintas, y gana la que nadie editó. Lo que se edita en el lugar va por
 * `guardarCampoClase`, que escribe las dos juntas.
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
    const prod = await productoConModulos(productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    // ⚠️ «CIERRA LA ETAPA» QUE LA CLASE YA TENÍA EN UN SUELTO SE CONSERVA (revisión del 08/10/2026): llegó
    // ahí al desvincular su módulo o al arrastrarla, y no se borra (`moverClaseA`). Rechazarla acá
    // obligaba a destildarla para guardar CUALQUIER otra cosa de la clase —un candado sin llave sobre el
    // título—. Lo que se rechaza es ponerla NUEVA en un suelto.
    const idPedido = Number((raw as { id?: unknown } | null)?.id);
    const antes = Number.isInteger(idPedido) && idPedido > 0 ? await claseCruda(idPedido) : null;
    const yaLaTenia = antes?.obligatoria && antes.productoId === productoId ? antes.etapa : null;
    const sueltos = prod.modulos.filter((m) => !m.vinculado && m.clave !== yaLaTenia).map((m) => m.clave);
    const v = validarClase(raw, { ws, productoId, modulos: prod.claves, sueltos });
    if (!v.ok) return v;

    const previa = v.id ? (antes?.id === v.id ? antes : await claseCruda(v.id)) : null;
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
        .eq('producto_id', productoId).eq('etapa', v.fila.etapa).is('borrada_at', null);
      if (error) return { ok: false, error: error.message };
      orden = siguienteOrden((hermanas ?? []) as Array<{ id: number; etapa: string; orden: number }>, v.fila.etapa);
    }

    const ahora = new Date().toISOString();
    const fila = { ...v.fila, orden, updated_at: ahora, ...(previa && previa.descripcion !== v.fila.descripcion ? { descripcion_html: '' } : {}) };
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
 * Borra una clase: a la PAPELERA (mig 0223), no un `delete`. Hasta el 08/10/2026 era un `delete` y el
 * avance de cada alumno (`curso_progreso`) se iba con ella por la FK `on delete cascade` de la 0202;
 * ahora queda con `borrada_at`, invisible para todo lo demás (toda lectura de clases la filtra:
 * tests/curso-papelera.test.ts), y el «Deshacer» de 5 segundos la devuelve ENTERA con
 * `restaurarClases` —la misma fila, con su avance, sus entregas, su video, su portada y lo que se le
 * abrió a mano a cada alumno—. Lo que antes se limpiaba acá (el video, la portada, lo abierto a mano)
 * lo limpia la purga, cuando la borra de verdad (lib/curso-papelera.ts).
 *
 * Pedido de Martín (08/10/2026, item 18): «te falta el botón de arrepentimiento para muchas acciones,
 * el de 5 segundos de "Deshacer"».
 */
export async function borrarClase(claseId: number): Promise<Resultado<{ id: number }>> {
  try {
    const c = await claseCruda(claseId);
    if (!c) return { ok: false, error: 'Esa clase ya no existe.' };
    const db = await getTenantDb();
    const ahora = new Date().toISOString();
    const { error } = await db.from('curso_clases').update({ borrada_at: ahora, updated_at: ahora })
      .eq('id', c.id).eq('producto_id', c.productoId).is('borrada_at', null);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: c.id };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo borrar la clase.') };
  }
}

/**
 * El «Deshacer» de borrar clases (una, o las de un módulo): las saca de la papelera y las devuelve como
 * quedaron. SÓLO de este producto y sólo las que están en la papelera: los ids viajan desde el
 * navegador. Una cuyo módulo ya no existe vuelve a «Sin módulo», donde se ve y se mueve.
 */
export async function restaurarClases(productoId: number, raw: unknown): Promise<Resultado<{ clases: Clase[] }>> {
  try {
    const ids = Array.isArray(raw) ? [...new Set(raw.map(Number))].filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000) : [];
    if (!ids.length) return { ok: true, clases: [] };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').update({ borrada_at: null, updated_at: new Date().toISOString() })
      .in('id', ids).eq('producto_id', productoId).not('borrada_at', 'is', null).select(COLUMNAS_CLASE);
    if (error) return { ok: false, error: error.message };
    return { ok: true, clases: ((data ?? []) as FilaDeClase[]).map(aClase) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo devolver la clase.') };
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
    // El orden sólo tiene sentido adentro de un módulo que existe: una huérfana se MUEVE de
    // módulo, no se ordena entre otras huérfanas.
    const prod = await productoConModulos(c.productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!prod.claves.includes(c.etapa)) return { ok: false, error: 'Su módulo ya no existe.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').select('id, etapa, orden')
      .eq('producto_id', c.productoId).eq('etapa', c.etapa).is('borrada_at', null);
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
    if (!(await productoDelNegocio(productoId))) return { ok: false, error: 'Ese producto no es de este negocio.' };
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
    // ⚠️ CON LAS DE LA PAPELERA, como `borrarArchivo`: el video de una clase borrada sigue siendo suyo.
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

// ⚠️ LA MARCA DE GRABAR (#693, «Grabar / No grabar») SE FUE el 08/10/2026 (item 15: «Elimina el botón
// de "grabar/no grabar"»): su escritura, su lectura y su conteo. La COLUMNA `curso_clases.grabar`
// (mig 0208) queda, con lo que tenía: sacarla es una migración que nadie pidió, y nada la lee.

/**
 * Cambia SÓLO el título de una clase (el clic en el título de la lección, 07/10/2026).
 *
 * ⚠️ UN `update` DEL TÍTULO, nunca `guardarClase` con la fila armada en el navegador: esa escribe
 *    la clase ENTERA, y desde un clic en un título se mandaría el video, la tarea y los campos
 *    que la pantalla tenía en memoria — si otra pestaña los cambió en el medio, se pisan.
 *    `updated_at` va, como en cualquier edición de la clase.
 */
export async function renombrarClase(claseId: number, raw: unknown): Promise<Resultado<{ titulo: string }>> {
  try {
    const titulo = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (!titulo) return { ok: false, error: 'Falta el título.' };
    if (titulo.length > TOPE_TITULO) return { ok: false, error: `El título pasa de ${TOPE_TITULO} letras.` };
    if (!Number.isInteger(claseId) || claseId <= 0) return { ok: false, error: 'Esa clase ya no existe.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases')
      .update({ titulo, updated_at: new Date().toISOString() })
      .eq('id', claseId).is('borrada_at', null).select('id, titulo').maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Esa clase ya no existe.' };
    return { ok: true, titulo: (data as { titulo: string }).titulo };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo renombrar.') };
  }
}

// ── La lección que se edita en su lugar (D4, 08/10/2026) ─────────────────────────
// «Si quiero editar el título, le doy click, como la descripción… Si quiero agregar un vídeo… debe
// siempre estar un placeholder… Lo mismo con el botón de "Agregar tarea"» (Martín, items 12-16).
//
// ⚠️ CADA PIEZA ES UN `update` DE SÓLO SUS COLUMNAS, el molde de `renombrarClase`, nunca la fila
// entera: cada parte de la lección se guarda por su lado (el título al salir del campo, la
// descripción con un respiro, la tarea al tocarla), y un guardado de la fila armada en el navegador
// pisaría lo que otra parte guardó un segundo antes.

/**
 * Crea una clase «Nueva clase» AL PRINCIPIO del módulo y la devuelve: la pantalla la abre para
 * editarla en su lugar (item 12: «nueva clase, que aparezca primero, no por último»).
 *
 * ⚠️ AL PRINCIPIO CON `orden` = el más chico − 1, sin renumerar a las demás: una sola escritura. Los
 * huecos y los negativos no molestan (el orden se compara, no se cuenta), y el próximo arrastre
 * renumera el módulo entero.
 */
export async function crearClase(productoId: number, moduloClave: string): Promise<Resultado<{ clase: Clase }>> {
  try {
    const prod = await productoConModulos(productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!prod.claves.includes(moduloClave)) return { ok: false, error: 'Ese módulo no existe.' };
    const db = await getTenantDb();
    const { data: hermanas, error: e1 } = await db.from('curso_clases').select('id, orden').eq('producto_id', productoId).eq('etapa', moduloClave).is('borrada_at', null);
    if (e1) return { ok: false, error: e1.message };
    const ordenes = ((hermanas ?? []) as Array<{ orden: number }>).map((h) => h.orden ?? 0);
    const orden = ordenes.length ? Math.min(...ordenes) - 1 : 0;
    const { data, error } = await db.from('curso_clases')
      .insert([{ producto_id: productoId, etapa: moduloClave, orden, titulo: 'Nueva clase', tipo: 'clase', updated_at: new Date().toISOString() }])
      .select(COLUMNAS_CLASE).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, clase: aClase(data as FilaDeClase) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo crear la clase.') };
  }
}

/**
 * Lleva una clase al módulo `moduloClave`, ANTES de la clase `antesDe` (`null` = al final): el
 * arrastre, entre módulos y adentro del mismo. Renumera el módulo de destino entero 0..n-1 (el
 * criterio de `moverClase`: con huecos o empates, un número suelto puede no mover nada) y devuelve
 * la clase como quedó y el orden del módulo, para que la pantalla corrija si su versión optimista no
 * coincide.
 *
 * ⚠️ «Cierra la etapa» VIAJA CON LA CLASE y no se borra al llevarla a un suelto: ahí no cuenta (un
 * suelto no mueve a nadie en el kanban) y vuelve a contar si la traen de vuelta. Borrarla sería
 * perder una decisión del equipo por un arrastre.
 */
export async function moverClaseA(claseId: number, moduloClave: string, antesDe: number | null): Promise<Resultado<{ clase: Clase; ids: number[] }>> {
  try {
    const c = await claseCruda(claseId);
    if (!c) return { ok: false, error: 'Esa clase ya no existe.' };
    const prod = await productoConModulos(c.productoId);
    if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
    if (!prod.claves.includes(moduloClave)) return { ok: false, error: 'Ese módulo no existe.' };
    // ⚠️ Un módulo que se abre con la tarea de ESTA clase no la puede recibir (revisión del 08/10/2026):
    // cerrado, no deja completar sus clases, y no se abriría nunca. `guardarBloqueo` lo rechaza al
    // poner el candado; el arrastre era la otra puerta para llegar al mismo lugar.
    const destino = prod.modulos.find((m) => m.clave === moduloClave);
    if (destino?.bloqueo?.tipo === 'tarea' && destino.bloqueo.claseId === c.id) return { ok: false, error: 'Ese módulo se abre con esta clase.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').select('id, etapa, orden').eq('producto_id', c.productoId).eq('etapa', moduloClave).is('borrada_at', null);
    if (error) return { ok: false, error: error.message };
    const actuales = clasesDeEtapa((data ?? []) as Array<{ id: number; etapa: string; orden: number }>, moduloClave);
    const ids = ordenConClaseEn(actuales.map((x) => Number(x.id)), c.id, antesDe == null ? null : Number(antesDe));
    if (!ids) return { ok: false, error: 'Ese lugar ya no existe.' };
    const ahora = new Date().toISOString();
    const antes = new Map(actuales.map((x) => [Number(x.id), x.orden]));
    for (const [orden, id] of ids.entries()) {
      const cambiaModulo = id === c.id && c.etapa !== moduloClave;
      if (!cambiaModulo && antes.get(id) === orden) continue;
      const { error: e2 } = await db.from('curso_clases')
        .update(cambiaModulo ? { etapa: moduloClave, orden, updated_at: ahora } : { orden, updated_at: ahora })
        .eq('id', id).eq('producto_id', c.productoId);
      if (e2) return { ok: false, error: e2.message };
    }
    const quedo = await claseCruda(c.id);
    if (!quedo) return { ok: false, error: 'Esa clase ya no existe.' };
    return { ok: true, clase: quedo, ids };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo mover la clase.') };
  }
}

/**
 * Lo que se guarda de UNA parte de la lección. Un objeto con UNA de estas claves.
 *
 * `minutos` y `tipo` (08/10/2026, paso LECCIÓN): eran campos del editor de la clase, el modal que se
 * fue con el botón «Editar» (item 16). Desde la tanda siguiente del mismo día (items 11 y 12) el tipo
 * salió de la pantalla (la columna queda con su valor) y los minutos no se escriben a mano: los pone
 * la lección con la duración que dice el reproductor del video.
 */
export type CambioClase =
  | { titulo: string }
  | { descripcionHtml: string }
  | { video: { tipo: 'url'; url: string } | { tipo: 'archivo'; path: string } | null }
  | { tarea: string }
  | { campos: unknown }
  | { obligatoria: boolean }
  | { porArea: boolean }
  | { minutos: number | null }
  | { tipo: TipoClase };

const CLAVES_CAMBIO = ['titulo', 'descripcionHtml', 'video', 'tarea', 'campos', 'obligatoria', 'porArea', 'minutos', 'tipo'] as const;

/**
 * Guarda UNA parte de una clase (D4): el título, la descripción rica, el video, la tarea, los campos
 * del formulario, «Cierra la etapa» o «Por área». Devuelve la clase como quedó.
 *
 *   · `descripcionHtml`: se SANEA en el server con la lista blanca (`validarHtmlRico`,
 *     lib/html-seguro.ts) y se guarda con su texto plano al lado (`descripcion`: la búsqueda, la IA y
 *     los mensajes leen ése), recortado a `TOPE_TEXTO`. Después se atan a la clase los adjuntos que
 *     nombra (`vincularAdjuntos`), que es lo que deja servírselos al alumno.
 *   · `video`: el mismo validador que el guardado entero (`validarVideoEntrada`); un archivo subido se
 *     verifica en el bucket antes de guardar, y el que tenía se borra si ya nadie lo usa.
 *   · `tarea` / `campos`: si la clase queda SIN nada que pedir, «Cierra la etapa» se apaga EN LA MISMA
 *     ESCRITURA. No se rechaza: borrar la tarea es un gesto de la lección y frenarlo por una marca de
 *     otra parte de la pantalla sería un candado sin llave. Sin tarea, la marca no cerraría nada
 *     (`obligatoriasDe` sólo cuenta las que piden algo), y quedaría guardada sin efecto.
 *   · `obligatoria: true`: sólo con tarea, y sólo en un módulo VINCULADO (un suelto no cierra etapas).
 *   · `minutos` (0 a 600, o `null`) y `tipo` (uno de `TIPOS_CLASE`): la ficha de la lección. Las mismas
 *     reglas que el guardado entero (`validarClase`), escritas para UN campo.
 */
export async function guardarCampoClase(claseId: number, cambio: unknown): Promise<Resultado<{ clase: Clase }>> {
  try {
    if (!cambio || typeof cambio !== 'object' || Array.isArray(cambio)) return { ok: false, error: 'No llegó el cambio.' };
    const presentes = CLAVES_CAMBIO.filter((k) => Object.prototype.hasOwnProperty.call(cambio, k));
    if (presentes.length !== 1) return { ok: false, error: 'Un cambio por vez.' };
    const clave = presentes[0];
    const valor = (cambio as Record<string, unknown>)[clave];
    const c = await claseCruda(claseId);
    if (!c) return { ok: false, error: 'Esa clase ya no existe.' };
    const ahora = new Date().toISOString();
    let fila: Record<string, unknown>;
    let alFinal: (() => Promise<void>) | null = null;

    switch (clave) {
      case 'titulo': {
        const titulo = typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : '';
        if (!titulo) return { ok: false, error: 'Falta el título.' };
        if (titulo.length > TOPE_TITULO) return { ok: false, error: `El título pasa de ${TOPE_TITULO} letras.` };
        fila = { titulo };
        break;
      }
      case 'descripcionHtml': {
        const { validarHtmlRico } = await import('./html-seguro');
        const v = validarHtmlRico(valor);
        if (!v.ok) return v;
        fila = { descripcion_html: v.html, descripcion: v.texto.slice(0, TOPE_TEXTO) };
        alFinal = async () => {
          const { vincularAdjuntos } = await import('./curso-adjuntos');
          await vincularAdjuntos(c.productoId, c.id, v.html);
        };
        break;
      }
      case 'video': {
        const ws = await getWorkspaceActual();
        if (!ws) return { ok: false, error: 'No hay un negocio abierto.' };
        const v = validarVideoEntrada(valor, { ws, productoId: c.productoId });
        if (!v.ok) return v;
        if (v.video.video_tipo === 'archivo' && v.video.video_path !== c.videoPath) {
          // ⚠️ Lo mismo que `guardarClase`: la subida la hace el navegador y puede cortarse.
          const { data: hay } = await getSupabaseServer().storage.from(BUCKET_CURSO).exists(v.video.video_path!);
          if (!hay) return { ok: false, error: 'El video no terminó de subir.' };
        }
        fila = { ...v.video };
        // ⚠️ OTRO VIDEO, OTROS MINUTOS (item 12 del 08/10/2026: los minutos salen solos del video). Los
        //    de antes eran del video que se fue: quedan vacíos hasta que el reproductor del editor mida el
        //    nuevo (app/customer-success/curso/LeccionEditable.tsx, `useMinutosDelVideo`). Con el mismo
        //    video no se tocan.
        const mismo = v.video.video_tipo === c.videoTipo && v.video.video_url === c.videoUrl && v.video.video_path === c.videoPath;
        if (!mismo) fila.minutos = null;
        if (c.videoPath && c.videoPath !== v.video.video_path) alFinal = () => borrarArchivo(c.videoPath);
        break;
      }
      case 'tarea': {
        const tarea = typeof valor === 'string' ? valor.trim() : '';
        if (tarea.length > TOPE_TEXTO) return { ok: false, error: 'El texto es demasiado largo.' };
        fila = { tarea, ...(c.obligatoria && !tieneTarea({ tarea, campos: c.campos }) ? { obligatoria: false } : {}) };
        break;
      }
      case 'campos': {
        const v = validarCamposEntrada(valor);
        if (!v.ok) return v;
        fila = { campos: v.campos, ...(c.obligatoria && !tieneTarea({ tarea: c.tarea, campos: v.campos }) ? { obligatoria: false } : {}) };
        break;
      }
      case 'obligatoria': {
        if (typeof valor !== 'boolean') return { ok: false, error: 'Marca inválida.' };
        if (valor) {
          if (!tieneTarea(c)) return { ok: false, error: 'Para cerrar la etapa, agrega la tarea.' };
          const prod = await productoConModulos(c.productoId);
          if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
          if (!prod.modulos.find((m) => m.clave === c.etapa)?.vinculado) return { ok: false, error: ERROR_OBLIGATORIA_SUELTO };
        }
        fila = { obligatoria: valor };
        break;
      }
      case 'porArea': {
        if (typeof valor !== 'boolean') return { ok: false, error: 'Marca inválida.' };
        fila = { por_area: valor };
        break;
      }
      case 'minutos': {
        // El mismo tope que el guardado entero (`validarClase`): 0 a 600, entero. `null` = sin minutos.
        const m = valor === null ? null : Number(valor);
        if (m !== null && (typeof valor !== 'number' || !Number.isFinite(m) || m < 0 || m > 600)) return { ok: false, error: 'Los minutos no cierran.' };
        fila = { minutos: m === null ? null : Math.round(m) };
        break;
      }
      case 'tipo': {
        if (typeof valor !== 'string' || !TIPOS_CLASE.some((t) => t.value === valor)) return { ok: false, error: 'Ese tipo no existe.' };
        fila = { tipo: valor };
        break;
      }
      default:
        return { ok: false, error: 'No llegó el cambio.' };
    }

    const db = await getTenantDb();
    const { data, error } = await db.from('curso_clases').update({ ...fila, updated_at: ahora })
      .eq('id', c.id).eq('producto_id', c.productoId).select(COLUMNAS_CLASE).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Esa clase ya no existe.' };
    if (alFinal) await alFinal();
    return { ok: true, clase: aClase(data as FilaDeClase) };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}

/** ¿La clase es de ese producto (y de este workspace)? Para atar a ella una portada. */
export async function claseEsDelProducto(claseId: number, productoId: number): Promise<boolean> {
  if (!Number.isInteger(claseId) || claseId <= 0) return false;
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select('id').eq('id', claseId).eq('producto_id', productoId).is('borrada_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
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
 * El acceso de una fila de Avance CON su invitación (mig 0206): a qué email salió y cuándo.
 *
 * ⚠️ `null` EN LOS DOS ES «NUNCA», Y POR ESO VIAJAN SIEMPRE. Hasta el 07/10/2026 esta lectura no
 * los traía, la fila llegaba con `undefined` («no lo sé», ver `AccesoInvitacion` en
 * app/customer-success/curso-ficha-lectura.ts) y la tabla Avance le ofrecía «Invitar» —nunca
 * «Reenviar»— a gente ya invitada, con el modal vacío: un mail duplicado a un clic.
 */
export type AccesoFilaInvitacion = AccesoFila & { email: string | null; invitacionEnviadaAt: string | null };

/**
 * El acceso al portal de VARIOS clientes (la tabla de Avance y las tarjetas del kanban): leadId →
 * acceso. Los que nunca recibieron su link no están en el mapa (y la tabla dice «sin link»).
 *
 * ⚠️ TIRA si no puede leer, y quien llama decide: leído como «nadie tiene link», una consulta
 * caída le diría a Mauricio que tiene que mandarle el link a los catorce.
 */
export async function accesosDeClientes(leadIds: readonly number[]): Promise<Map<number, AccesoFilaInvitacion>> {
  const out = new Map<number, AccesoFilaInvitacion>();
  if (!leadIds.length) return out;
  const db = await getTenantDb();
  // ⚠️ `area is null`: el acceso DEL CLIENTE. Desde la 0212 un cliente tiene además uno por cada
  // líder de área, y sin el filtro la columna «Acceso» pintaba el del último líder (#665).
  const { data, error } = await db.from('curso_accesos')
    .select('lead_id, revocado_at, ingresos, ultimo_ingreso_at, email, invitacion_enviada_at').in('lead_id', [...leadIds]).is('area', null);
  if (error) throw new Error(error.message);
  for (const f of (data ?? []) as Array<{ lead_id: number; revocado_at: string | null; ingresos: number | null; ultimo_ingreso_at: string | null; email: string | null; invitacion_enviada_at: string | null }>) {
    out.set(Number(f.lead_id), {
      estado: f.revocado_at ? 'cortado' : 'activo',
      ingresos: f.ingresos ?? 0,
      ultimoIngresoAt: f.ultimo_ingreso_at ?? null,
      email: f.email ?? null,
      invitacionEnviadaAt: f.invitacion_enviada_at ?? null,
    });
  }
  return out;
}
