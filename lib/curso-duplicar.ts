import 'server-only';

// =============================================================================
// curso-duplicar — DUPLICAR un programa: el producto con su curso, módulos, clases y su configuración
// =============================================================================
// Pedido (25/10/2026, Martín por el Cerebro): «Duplicar un programa, de punta a punta: la acción en el server (curso,
// módulos, clases y su configuración; nunca los alumnos ni su progreso), "Duplicar" en el «…» y en el clic derecho, con
// "Deshacer", y en la API de MaKo». Lo llaman `duplicarServicioAction` (la cabecera de Clients) y `duplicar_curso`
// (la API de MaKo): ninguno de los dos pasa la sesión, cada puerta pregunta lo suyo antes.
//
// QUÉ SE COPIA, en este orden (las reglas de cada pieza, puras y con test, en ./curso-duplicar-reglas.ts):
//   1. el producto, con la MISMA cadena que «+ Nuevo producto» (`crearProductoConFunnel`: producto → oferta → embudo),
//      llamado «X (copia)»: así existe en el CRM como cualquier otro;
//   2. las etapas de la entrega (el kanban) y sus fases, si el original las había declarado;
//   3. los videos SUBIDOS (si entre todos entran en `TOPE_VIDEOS_COPIA`) y los adjuntos de las descripciones y tareas,
//      a archivos NUEVOS del producto nuevo: el alumno sólo ve un archivo de SU producto;
//   4. las clases (las de la papelera no), con sus tareas, en su orden; después sus candados, con los ids nuevos;
//   5. los módulos (claves iguales: son las de las etapas) con sus candados;
//   6. el estilo (color, fuente, portadas, disposición, comentarios por clase) y el título puesto a mano, «X (copia)».
//
// QUÉ NO SE COPIA, a propósito: los alumnos y todo lo suyo (accesos, avance, entregas, desbloqueos, la cartera de la
// entrega), la comunidad (sus posts son de sus miembros; la del programa nuevo arranca vacía), las notas del equipo de
// cada clase, las automatizaciones de la entrega y el precio del producto (se completa en el CRM).
//
// ⚠️ NO ES UNA TRANSACCIÓN (PostgREST no las tiene). Si algo falla a mitad, el programa nuevo se ARCHIVA
//    (`eliminarPrograma`, vuelve desde «Productos eliminados» del CRM) y se devuelve el error: una copia a medias no
//    queda a la vista pareciendo entera.
// ⚠️ CORRE EN EL NEGOCIO DEL CONTEXTO (`getTenantDb()` estampa el workspace en cada escritura); `ws` es el mismo, para
//    armar las rutas de los archivos.

import { randomUUID } from 'node:crypto';
import { getTenantDb } from './workspace';
import { getSupabaseServer } from './supabase';
import { crearProductoConFunnel } from './producto-con-funnel';
import { entregaDeProductoEstricta, guardarEtapasEntrega } from './entrega-servicio';
import { BUCKET_CURSO } from './curso-admin';
import { BUCKET_ADJUNTOS } from './curso-adjuntos-reglas';
import { refsEnHtml } from '@/app/_ui/HtmlSeguro';
import { saneaBloqueo } from './curso-bloqueo';
import { TOPE_TITULO_CURSO } from './curso-estilo';
import type { Campo } from './curso';
import {
  nombreDeCopia, bloqueoDeCopia, camposDeCopia, conAdjuntosDeCopia, claveDeEstiloEnCopia, tituloDeCopia, videosACopiar,
  extensionDe,
} from './curso-duplicar-reglas';
import { eliminarPrograma } from '@/app/customer-success/programa-datos';

/** El tope del nombre de un producto (el de «+ Nuevo producto», `crearServicioAction`). */
const TOPE_NOMBRE_PRODUCTO = 60;

const COLS_CLASE_COPIA = 'id, etapa, orden, titulo, descripcion, tipo, minutos, video_tipo, video_url, video_path, tarea, campos, '
  + 'obligatoria, origen, bloqueo, grabar, por_area, descripcion_html, tarea_html';
type FilaClase = {
  id: number; etapa: string; orden: number | null; titulo: string; descripcion: string | null; tipo: string; minutos: number | null;
  video_tipo: string; video_url: string | null; video_path: string | null; tarea: string | null; campos: unknown;
  obligatoria: boolean | null; origen: string | null; bloqueo: unknown; grabar: boolean | null; por_area: boolean | null;
  descripcion_html: string | null; tarea_html: string | null;
};
type FilaModulo = { clave: string; vinculado: boolean | null; nombre: string | null; despues_de: string | null; bloqueo: unknown };
type FilaAdjunto = { id: string; path: string; nombre: string; mime: string; bytes: number | string; creado_por: string | null };

export type ProgramaDuplicado = {
  productoId: number;
  nombre: string;
  clases: number;
  modulos: number;
  /** Adjuntos copiados y los que no se pudieron copiar (su imagen o su archivo no se verá en la copia). */
  adjuntos: { copiados: number; fallidos: number };
  /** Videos subidos copiados, y los que no (pesaban más que el tope, o falló la copia): esas clases quedan sin video. */
  videos: { copiados: number; sinCopiar: number };
};

const tira = (e: { message: string } | null, que: string) => { if (e) throw new Error(`${que}: ${e.message}`); };

/** Duplica el programa `productoId`. Ver la cabecera. */
export async function duplicarPrograma(ws: number, productoId: number, autor: string | null): Promise<{ ok: true; copia: ProgramaDuplicado } | { ok: false; error: string }> {
  const db = await getTenantDb();

  // ── Lo que se lee del original, antes de crear nada ──
  const { data: prod, error: eProd } = await db.from('productos').select('id, nombre').eq('id', productoId).maybeSingle();
  tira(eProd, 'No pude leer el producto');
  if (!prod) return { ok: false, error: 'Ese producto no es de este negocio.' };
  const entrega = await entregaDeProductoEstricta(productoId);
  if (!entrega) return { ok: false, error: 'No pude leer las etapas del producto. Vuelve a intentarlo.' };
  const [clasesR, modulosR, estiloR] = await Promise.all([
    db.from('curso_clases').select(COLS_CLASE_COPIA).eq('producto_id', productoId).is('borrada_at', null).order('etapa').order('orden').order('id'),
    db.from('curso_modulos').select('clave, vinculado, nombre, despues_de, bloqueo').eq('producto_id', productoId).is('borrado_at', null).order('id'),
    db.from('curso_estilo').select('clave, valor').eq('producto_id', productoId),
  ]);
  tira(clasesR.error, 'No pude leer las clases');
  tira(modulosR.error, 'No pude leer los módulos');
  tira(estiloR.error, 'No pude leer el estilo');
  const clases = (clasesR.data ?? []) as unknown as FilaClase[];
  const modulos = (modulosR.data ?? []) as unknown as FilaModulo[];
  const estilo = (estiloR.data ?? []) as Array<{ clave: string; valor: string }>;
  const campos = (c: FilaClase): Campo[] => (Array.isArray(c.campos) ? (c.campos as Campo[]) : []);

  // Los adjuntos que NOMBRAN las clases que se copian (descripción, consigna de la tarea y la de cada tarea de más).
  const refs = [...new Set(clases.flatMap((c) => [c.descripcion_html, c.tarea_html, ...campos(c).map((x) => x.descripcionHtml)].flatMap((h) => refsEnHtml(h))))];
  let adjuntosA: FilaAdjunto[] = [];
  if (refs.length) {
    const { data, error } = await db.from('curso_adjuntos').select('id, path, nombre, mime, bytes, creado_por').eq('producto_id', productoId).in('id', refs.slice(0, 500));
    tira(error, 'No pude leer los adjuntos');
    adjuntosA = (data ?? []) as FilaAdjunto[];
  }

  // Los videos SUBIDOS: cuánto pesan, del listado de la carpeta del producto en el bucket.
  const videosA = clases.filter((c) => c.video_tipo === 'archivo' && c.video_path).map((c) => c.video_path!);
  const peso = new Map<string, number>();
  if (videosA.length) {
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_CURSO).list(`${ws}/${productoId}`, { limit: 1000 });
    if (!error) for (const o of data ?? []) peso.set(`${ws}/${productoId}/${o.name}`, Number((o.metadata as { size?: number } | null)?.size ?? NaN));
  }
  const decision = videosACopiar(videosA, peso);

  // ── El producto nuevo, con la cadena del CRM ──
  const nombre = nombreDeCopia(String((prod as { nombre: string }).nombre ?? ''), TOPE_NOMBRE_PRODUCTO);
  const { productoId: nuevo } = await crearProductoConFunnel(nombre);

  try {
    if (entrega.origen === 'declarado' && !(await guardarEtapasEntrega(nuevo, entrega.etapas, entrega.fases))) {
      throw new Error('No pude copiar las etapas de la entrega');
    }

    // Los archivos, a rutas del producto NUEVO (el alumno ve sólo los de su producto).
    const sb = getSupabaseServer();
    const videoNuevo = new Map<string, string>();
    for (const path of decision.copiar) {
      const destino = `${ws}/${nuevo}/${randomUUID()}.${extensionDe(path) ?? 'mp4'}`;
      const { error } = await sb.storage.from(BUCKET_CURSO).copy(path, destino);
      if (!error) videoNuevo.set(path, destino);
      else console.warn(`[curso-duplicar] no pude copiar el video ${path}: ${error.message}`);
    }
    const adjuntoNuevo = new Map<string, string>();
    const filasAdjunto: Array<FilaAdjunto & { idNuevo: string; pathNuevo: string }> = [];
    let adjuntosFallidos = refs.length - adjuntosA.length;
    for (const a of adjuntosA) {
      const idNuevo = randomUUID();
      const pathNuevo = `${ws}/${nuevo}/${idNuevo}.${extensionDe(a.path) ?? 'bin'}`;
      const { error } = await sb.storage.from(BUCKET_ADJUNTOS).copy(a.path, pathNuevo);
      if (error) { adjuntosFallidos += 1; console.warn(`[curso-duplicar] no pude copiar el adjunto ${a.id}: ${error.message}`); continue; }
      adjuntoNuevo.set(a.id, idNuevo);
      filasAdjunto.push({ ...a, idNuevo, pathNuevo });
    }

    // Las clases, de a una y en orden (el mapa viejo → nuevo sale de cada respuesta).
    const claseNueva = new Map<number, number>();
    const primeraQueNombra = new Map<string, number>();
    for (const c of clases) {
      const copiaVideo = c.video_tipo === 'archivo' ? videoNuevo.get(c.video_path ?? '') ?? null : null;
      const sinVideo = c.video_tipo === 'archivo' && !copiaVideo;
      const { data, error } = await db.from('curso_clases').insert({
        producto_id: nuevo, etapa: c.etapa, orden: c.orden ?? 0, titulo: c.titulo, descripcion: c.descripcion ?? '', tipo: c.tipo,
        minutos: c.minutos, video_tipo: sinVideo ? 'ninguno' : c.video_tipo, video_url: sinVideo ? null : c.video_url,
        video_path: c.video_tipo === 'archivo' ? copiaVideo : null, tarea: c.tarea ?? '',
        campos: camposDeCopia(campos(c), adjuntoNuevo), obligatoria: c.obligatoria === true, origen: c.origen, bloqueo: null,
        grabar: c.grabar, por_area: c.por_area === true,
        descripcion_html: conAdjuntosDeCopia(c.descripcion_html, adjuntoNuevo),
        tarea_html: c.tarea_html == null ? null : conAdjuntosDeCopia(c.tarea_html, adjuntoNuevo),
      }).select('id').single();
      tira(error, `No pude copiar la clase «${c.titulo}»`);
      const id = Number((data as { id: number }).id);
      claseNueva.set(Number(c.id), id);
      for (const r of [c.descripcion_html, c.tarea_html, ...campos(c).map((x) => x.descripcionHtml)].flatMap((h) => refsEnHtml(h))) {
        if (!primeraQueNombra.has(r)) primeraQueNombra.set(r, id);
      }
    }
    // Sus candados, con los ids nuevos (uno puede apuntar a una clase que se insertó después).
    for (const c of clases) {
      const b = bloqueoDeCopia(saneaBloqueo(c.bloqueo), claseNueva);
      if (!b) continue;
      const { error } = await db.from('curso_clases').update({ bloqueo: b }).eq('id', claseNueva.get(Number(c.id))!);
      tira(error, `No pude copiar el candado de «${c.titulo}»`);
    }

    // Los adjuntos: su fila, del producto nuevo y de la primera clase que lo nombra.
    if (filasAdjunto.length) {
      const { error } = await db.from('curso_adjuntos').insert(filasAdjunto.map((a) => ({
        id: a.idNuevo, producto_id: nuevo, clase_id: primeraQueNombra.get(a.id) ?? null, path: a.pathNuevo,
        nombre: a.nombre, mime: a.mime, bytes: Number(a.bytes), creado_por: autor ?? a.creado_por,
      })));
      tira(error, 'No pude copiar los adjuntos');
    }

    // Los módulos (las claves son las de las etapas, que ya se copiaron) con sus candados.
    if (modulos.length) {
      const { error } = await db.from('curso_modulos').insert(modulos.map((m) => ({
        producto_id: nuevo, clave: m.clave, vinculado: m.vinculado === true, nombre: m.nombre, despues_de: m.despues_de,
        bloqueo: bloqueoDeCopia(saneaBloqueo(m.bloqueo), claseNueva),
      })));
      tira(error, 'No pude copiar los módulos');
    }

    // El estilo: las claves de una clase con su id nuevo, y el título puesto a mano como «X (copia)».
    const filasEstilo = estilo.flatMap((e) => {
      const clave = claveDeEstiloEnCopia(e.clave, claseNueva);
      if (!clave) return [];
      const valor = clave === 'titulo' ? tituloDeCopia(e.valor, TOPE_TITULO_CURSO) : e.valor;
      return valor ? [{ producto_id: nuevo, clave, valor, updated_by: autor }] : [];
    });
    if (filasEstilo.length) {
      const { error } = await db.from('curso_estilo').insert(filasEstilo);
      tira(error, 'No pude copiar el estilo');
    }

    return {
      ok: true,
      copia: {
        productoId: nuevo, nombre, clases: claseNueva.size, modulos: modulos.length,
        adjuntos: { copiados: filasAdjunto.length, fallidos: adjuntosFallidos },
        videos: { copiados: videoNuevo.size, sinCopiar: decision.sinCopiar.length + (decision.copiar.length - videoNuevo.size) },
      },
    };
  } catch (e) {
    // Una copia a medias no queda a la vista: se archiva (vuelve desde «Productos eliminados» del CRM).
    await eliminarPrograma(nuevo).catch((x) => console.error('[curso-duplicar] no pude archivar la copia a medias:', x instanceof Error ? x.message : x));
    return { ok: false, error: `${e instanceof Error ? e.message : 'No se pudo duplicar'}. No quedó ninguna copia a la vista.` };
  }
}
