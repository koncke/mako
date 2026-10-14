import 'server-only';

// =============================================================================
// curso-tarea-comunidad — la tarea de una clase que se contesta EN LA COMUNIDAD del producto
// =============================================================================
// Pedido de Martín (08/10/2026, item 17), textual: «Faltan opciones en las tareas para interactuar en
// la comunidad que hicimos». Dos tipos de campo (`CampoTipo`, lib/curso.ts):
//   · `publicar` → el alumno escribe un post (título y texto) desde la tarea, en la categoría que eligió
//     el equipo al armarla. Al publicarlo el campo queda contestado, y el post queda en la comunidad con
//     su nombre, como cualquier otro.
//   · `comentar` → comenta un post que eligió el equipo (o el último FIJADO). Al comentar, contestado.
//
// ⚠️ ENTRA POR LA PUERTA DEL ALUMNO: la ruta de la tarea (app/api/compartido/curso/tarea), que ya pasó
//    la firma del token, el resolver, la clase de ESE alumno con su candado (`exigeAbierta`) y el rate
//    limit, antes de llegar acá. Y la comunidad pone la suya: `actorDelAlumno` (no es un líder de área,
//    el producto es suyo, no está sacado de la comunidad).
// ⚠️ SE PUBLICA Y SE COMENTA CON LAS FUNCIONES DE LA COMUNIDAD (`publicarPost`, `comentar`,
//    lib/comunidad-datos.ts), no con una copia: los permisos por nivel y por categoría, las menciones,
//    los avisos a quien sigue el post y la actividad salen de ahí. Una segunda escritura de un post es
//    la que se olvida de avisar.
// ⚠️ LA CATEGORÍA Y EL POST LOS DECIDE EL CAMPO (lo que armó el equipo), nunca el pedido: lo que manda
//    el navegador del alumno es el texto.
// ⚠️ LO QUE QUEDA EN LA RESPUESTA ES UNA REFERENCIA («qué post», `refDeComunidad`), y la escribe el
//    navegador con el resto de los valores (el autoguardado). Por eso, antes de guardar, la ruta
//    VERIFICA que esa referencia sea de ESTE alumno en ESTE producto (`verificarComunidad`), igual que
//    las entregas: un número lo escribe cualquiera, y un «ya publiqué» con el post de otro completaría
//    la tarea sin haber hecho nada.

import { getWorkspaceActual } from './workspace';
import {
  actorDelAlumno, categoriasDeLaComunidad, comentar, de, publicarPost, ultimoPostFijado,
} from './comunidad-datos';
import { claveDeLead, extracto } from './comunidad-reglas';
import {
  esCampoDeComunidad, refDeComunidad, valorDeComunidad,
  type Campo, type Valores,
} from './curso';

/** Lo que el equipo puede elegir al armar el campo (la action de la tab Curso). */
export async function opcionesParaTareas(productoId: number): Promise<{
  categorias: Array<{ id: number; nombre: string }>;
  posts: Array<{ id: number; titulo: string; fijado: boolean }>;
}> {
  const ws = await getWorkspaceActual();
  if (!ws) throw new Error('No hay un negocio abierto.');
  // ⚠️ SIN LOS HILOS DE LAS CLASES (mig 0227, revisión final del 08/10/2026): un hilo de clase es un post
  //    con `clase_id`, su título es el de la clase, y no sale en el feed. Ofrecido acá, el equipo podía
  //    elegir «comentar el hilo de la clase 7» como tarea de la clase 2, y el alumno que todavía no abrió
  //    la 7 recibía una tarea imposible («Esa clase ya no está»). Lo mismo que el feed y la búsqueda.
  const [cats, fijados, recientes] = await Promise.all([
    categoriasDeLaComunidad(ws, productoId),
    de(ws, 'comunidad_posts').select('id, titulo').eq('producto_id', productoId).is('clase_id', null).not('fijado_at', 'is', null).order('fijado_at', { ascending: false }).limit(10),
    de(ws, 'comunidad_posts').select('id, titulo').eq('producto_id', productoId).is('clase_id', null).order('created_at', { ascending: false }).limit(30),
  ]);
  if (fijados.error) throw new Error(fijados.error.message);
  if (recientes.error) throw new Error(recientes.error.message);
  const vistos = new Set<number>();
  const posts: Array<{ id: number; titulo: string; fijado: boolean }> = [];
  for (const [filas, fijado] of [[fijados.data, true], [recientes.data, false]] as const) {
    for (const f of (filas ?? []) as Array<{ id: number; titulo: string }>) {
      const id = Number(f.id);
      if (vistos.has(id)) continue;
      vistos.add(id);
      posts.push({ id, titulo: (f.titulo ?? '').trim() || `Post ${id}`, fijado });
    }
  }
  // Sólo las categorías donde puede publicar un ALUMNO: en una «sólo equipo» su post rebotaría.
  return { categorias: cats.filter((c) => c.permiso === 'todos').map((c) => ({ id: c.id, nombre: c.nombre })), posts };
}

/** Lo que pide el alumno desde la tarea. `ver` = qué post se comenta (para dibujarlo antes de escribir). */
export type PedidoComunidad = { campo: string; accion: 'publicar' | 'comentar' | 'ver'; titulo?: unknown; cuerpo?: unknown };

export function leerPedidoComunidad(raw: unknown): PedidoComunidad | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const campo = typeof o.campo === 'string' ? o.campo.slice(0, 80) : '';
  const accion = o.accion === 'publicar' || o.accion === 'comentar' || o.accion === 'ver' ? o.accion : null;
  if (!campo || !accion) return null;
  return { campo, accion, titulo: o.titulo, cuerpo: o.cuerpo };
}

export type ResultadoComunidad =
  | { ok: true; valor?: string; post?: { id: number; titulo: string; extracto: string } | null }
  | { ok: false; status: number; error: string };

/**
 * Hace lo que pidió el alumno en la comunidad, con lo que armó el equipo en el campo. Lo llama la ruta
 * de la tarea DESPUÉS de todas sus puertas, adentro del workspace de la firma.
 */
export async function accionDeComunidad(token: string, clase: { productoId: number; campos: readonly Campo[] }, pedido: PedidoComunidad): Promise<ResultadoComunidad> {
  const campo = clase.campos.find((c) => c.id === pedido.campo && esCampoDeComunidad(c.tipo));
  if (!campo) return { ok: false, status: 404, error: 'Ese campo no existe.' };
  const actor = await actorDelAlumno(token, clase.productoId);
  if (!actor) return { ok: false, status: 403, error: 'Sin acceso a la comunidad.' };

  if (campo.tipo === 'publicar') {
    if (pedido.accion !== 'publicar') return { ok: false, status: 400, error: 'Pedido inválido.' };
    // La categoría la eligió el equipo; si ya no está (o es «sólo equipo»), la primera donde publica un
    // alumno. Una categoría borrada no puede dejar la tarea sin salida.
    const cats = await categoriasDeLaComunidad(actor.ws, actor.productoId);
    const abiertas = cats.filter((c) => c.permiso === 'todos');
    const categoriaId = abiertas.find((c) => c.id === campo.categoriaId)?.id ?? abiertas[0]?.id ?? null;
    if (cats.length && categoriaId == null) return { ok: false, status: 409, error: 'No hay dónde publicar.' };
    const r = await publicarPost(actor, { titulo: pedido.titulo, cuerpo: pedido.cuerpo, categoriaId });
    if (!r.ok) return { ok: false, status: 400, error: r.error };
    return { ok: true, valor: valorDeComunidad(r.post.id) };
  }

  // Comentar: el post que eligió el equipo, o el último fijado.
  const objetivo = campo.postId
    ? await postDeLaComunidad(actor.ws, actor.productoId, campo.postId)
    : await ultimoPostFijado(actor.ws, actor.productoId);
  if (pedido.accion === 'ver') {
    if (!objetivo) return { ok: true, post: null };
    const completo = await postDeLaComunidad(actor.ws, actor.productoId, objetivo.id);
    return { ok: true, post: completo ? { id: completo.id, titulo: completo.titulo, extracto: extracto(completo.cuerpo, 220) } : null };
  }
  if (pedido.accion !== 'comentar') return { ok: false, status: 400, error: 'Pedido inválido.' };
  if (!objetivo) return { ok: false, status: 409, error: 'No hay un post para comentar.' };
  const r = await comentar(actor, objetivo.id, { cuerpo: pedido.cuerpo });
  if (!r.ok) return { ok: false, status: 400, error: r.error };
  return { ok: true, valor: valorDeComunidad(objetivo.id, r.comentario.id) };
}

/** Un post de la comunidad del producto (título y texto). `null` = ya no está. */
async function postDeLaComunidad(ws: number, productoId: number, postId: number): Promise<{ id: number; titulo: string; cuerpo: string } | null> {
  const { data, error } = await de(ws, 'comunidad_posts').select('id, titulo, cuerpo').eq('producto_id', productoId).eq('id', postId).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as { id: number; titulo: string; cuerpo: string | null } | null;
  return f ? { id: Number(f.id), titulo: f.titulo, cuerpo: f.cuerpo ?? '' } : null;
}

/**
 * Lo que mandó el navegador, con cada referencia a la comunidad VERIFICADA: se queda sólo si es la que
 * ya estaba guardada, o si el post (o el comentario, sobre ese post) existe y lo escribió ESTE alumno en
 * ESTE producto. Lo que no, se saca (el campo queda sin contestar). Devuelve también cuántas sacó.
 *
 * ⚠️ VA ANTES DE `guardarTarea`, como `verificarEntregas`: `sanearValores` mira sólo la FORMA.
 */
export async function verificarComunidad(
  campos: readonly Campo[],
  raw: unknown,
  guardados: Valores | null | undefined,
  dueno: { ws: number; productoId: number; leadId: number },
): Promise<{ valores: unknown; descartados: number }> {
  const deComunidad = campos.filter((c) => esCampoDeComunidad(c.tipo));
  if (!deComunidad.length || !raw || typeof raw !== 'object' || Array.isArray(raw)) return { valores: raw, descartados: 0 };
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const miembro = claveDeLead(dueno.leadId);
  let descartados = 0;
  for (const c of deComunidad) {
    if (!(c.id in out)) continue;
    const v = out[c.id];
    if (v === '' || v == null) continue;
    if (guardados && guardados[c.id] === v) continue;
    const ref = refDeComunidad(c.tipo, v);
    let suya = false;
    if (ref && ref.comentarioId == null) {
      // ⚠️ Un post DEL FEED (`clase_id is null`, mig 0227): el «autor» del hilo de una clase es quien
      //    comentó primero ahí, y sin este filtro su id completaba «Publicar en la comunidad» sin publicar.
      const { data, error } = await de(dueno.ws, 'comunidad_posts').select('id')
        .eq('producto_id', dueno.productoId).eq('id', ref.postId).eq('miembro', miembro).is('clase_id', null).maybeSingle();
      if (error) throw new Error(error.message);
      suya = !!data;
    } else if (ref) {
      // ⚠️ EL COMENTARIO TIENE QUE SER EN EL POST QUE PIDE LA TAREA (pendiente de la revisión del 08/10,
      //    cerrado el 13/10): con el post elegido por el equipo (`postId`), ése; sin él, el default de
      //    «Comentar» es el último FIJADO del feed, así que el post tiene que estar fijado y no ser el hilo de
      //    una clase. Antes cualquier comentario suyo en cualquier post completaba la tarea.
      if (c.postId != null && ref.postId !== c.postId) suya = false;
      else {
        const { data, error } = await de(dueno.ws, 'comunidad_comentarios').select('id')
          .eq('producto_id', dueno.productoId).eq('id', ref.comentarioId!).eq('post_id', ref.postId).eq('miembro', miembro).maybeSingle();
        if (error) throw new Error(error.message);
        suya = !!data;
        if (suya && c.postId == null) {
          const { data: post, error: e2 } = await de(dueno.ws, 'comunidad_posts').select('id')
            .eq('producto_id', dueno.productoId).eq('id', ref.postId).is('clase_id', null).not('fijado_at', 'is', null).maybeSingle();
          if (e2) throw new Error(e2.message);
          suya = !!post;
        }
      }
    }
    if (!suya) {
      // Lo que ya estaba guardado vuelve (un pedido armado a mano no lo borra); si no había, nada.
      if (guardados && c.id in guardados) out[c.id] = guardados[c.id];
      else delete out[c.id];
      descartados++;
    }
  }
  return { valores: out, descartados };
}
