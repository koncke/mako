import 'server-only';

// =============================================================================
// comunidad-moderacion — sacar a un alumno de la comunidad (y volver a admitirlo), cerrar comentarios
// =============================================================================
// Skool (relevo, B.8): admins y moderadores borran lo ajeno, fijan, sacan a alguien y cierran lo que
// haga falta. Borrar lo ajeno y fijar ya estaban (lib/comunidad-datos.ts); acá está lo que faltaba.
// Lo hace el EQUIPO: cada función vuelve a preguntar la regla (`puedeSacar`, `puedeModerar`,
// lib/comunidad-reglas.ts) antes de escribir, con el actor de la SESIÓN.
//
// ⚠️ SACAR ES DEL PROGRAMA ENTERO: LA COMUNIDAD Y EL CURSO (24/10/2026, f32/f33 de la llamada con Leandro: «no me
//    saca del curso, pero me saca de la comunidad»). Hasta ese día el baneo cerraba sólo la comunidad y el alumno
//    seguía entrando a sus clases, con la comunidad diciéndole «tu acceso no está activo». Ahora son dos escrituras:
//    el baneo en `comunidad_baneos` (mig 0217), que cierra la comunidad —`actorDelAlumno`, el portón de
//    /api/compartido/comunidad, lo devuelve `null` mientras esté vigente—, y el curso de ese programa
//    (`sacarDelCurso`, lib/curso-datos.ts): se le saca de su lista o, si era lo único que veía, se le corta el acceso
//    y el portal le dice en la entrada que no está activo. Las dos con el MISMO instante: «Volver a admitir» lo usa
//    para habilitar sólo un corte que hizo este «sacar» (`accesoTrasAdmitir`).

import { idValido, leerClave, puedeModerar, puedeSacar, sanearTexto } from './comunidad-reglas';
import { de, msg, postDe, infoDeMiembros, miembroVista, descartarAdjunto, type Actor } from './comunidad-datos';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace } from './workspace';
import { leerTodo } from './supabase-paginado';
import type { Resultado, SacadoVista } from './comunidad-tipos';

/** Hasta dónde llega «borrar lo que escribió» al sacar a alguien: los últimos 7 días, como el ban de Skool. */
const BORRAR_DIAS = 7;
const TOPE_MOTIVO = 300;

/** Qué pasó con su curso al sacarlo: se le sacó ése, se le cortó el acceso (era el único) o no tenía ese curso. */
export type CursoAlSacar = 'quitado' | 'cortado' | 'sin-curso';

/**
 * Saca a un alumno del programa: su comunidad y su curso (ver la cabecera). Con `borrarContenido`, además borra sus
 * posts y comentarios de los últimos 7 días (sin vuelta atrás, y lo dice el botón). Volver a sacar a alguien que
 * había vuelto reescribe su fila.
 */
export async function sacarAlumno(a: Actor, claveRaw: unknown, opts: { motivo?: unknown; borrarContenido?: unknown } = {}):
  Promise<Resultado<{ borrados: { posts: number; comentarios: number }; curso: CursoAlSacar }>> {
  try {
    const c = leerClave(claveRaw);
    if (!c || !puedeSacar(a, c.clave)) return { ok: false, error: 'Solo el equipo saca a un alumno.' };
    // El lead tiene que ser de ESTE negocio: la clave viaja desde el navegador.
    const { data: lead, error: eLead } = await getSupabaseServer().from('leads').select('id').eq('workspace_id', a.ws).eq('id', c.id).maybeSingle();
    if (eLead) return { ok: false, error: eLead.message };
    if (!lead) return { ok: false, error: 'Esa persona ya no está.' };
    const motivo = sanearTexto(opts.motivo, { unaLinea: true }).slice(0, TOPE_MOTIVO);
    const borrar = opts.borrarContenido === true;
    const ahora = new Date();
    const { error } = await de(a.ws, 'comunidad_baneos').upsert({
      producto_id: a.productoId, miembro: c.clave, lead_id: c.id, motivo, por: a.nombre, borro_contenido: borrar,
      levantado_at: null, created_at: ahora.toISOString(),
    }, { onConflict: 'workspace_id,producto_id,miembro' });
    if (error) return { ok: false, error: error.message };
    // El curso, con el mismo instante que el baneo. En el negocio del actor: el acceso se lee con `getTenantDb()`.
    let curso: CursoAlSacar;
    try {
      const { sacarDelCurso } = await import('./curso-datos');
      curso = await runWithWorkspace(a.ws, () => sacarDelCurso(c.id, a.productoId, ahora));
    } catch (e) {
      return { ok: false, error: `Quedó fuera de la comunidad, pero no pude sacarle el curso: ${msg(e, 'error de lectura')}. Vuelve a intentarlo.` };
    }

    const borrados = { posts: 0, comentarios: 0 };
    if (borrar) {
      const desde = new Date(Date.now() - BORRAR_DIAS * 86_400_000).toISOString();
      // ⚠️ SIN LOS HILOS DE LAS CLASES (mig 0227): el «autor» de un hilo es quien comentó primero, y
      //    borrarlo se llevaría en cascada los comentarios de TODOS los demás. Lo suyo ahí son sus
      //    comentarios, que se borran en la línea de abajo.
      const p = await de(a.ws, 'comunidad_posts').delete().eq('producto_id', a.productoId).eq('miembro', c.clave).is('clase_id', null).gte('created_at', desde).select('id, adjunto_path');
      if (p.error) return { ok: false, error: `Quedó fuera, pero no pude borrar sus posts: ${p.error.message}` };
      const k = await de(a.ws, 'comunidad_comentarios').delete().eq('producto_id', a.productoId).eq('miembro', c.clave).gte('created_at', desde).select('id');
      if (k.error) return { ok: false, error: `Quedó fuera, pero no pude borrar sus comentarios: ${k.error.message}` };
      const filas = (p.data ?? []) as Array<{ id: number; adjunto_path: string | null }>;
      // Los archivos de lo borrado se van del bucket (`descartarAdjunto` mira que nadie más los nombre).
      for (const f of filas) if (f.adjunto_path) await descartarAdjunto(a, f.adjunto_path);
      borrados.posts = filas.length;
      borrados.comentarios = (k.data ?? []).length;
    }
    return { ok: true, borrados, curso };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo sacar.') };
  }
}

/**
 * Vuelve a admitir a un alumno sacado: el baneo queda levantado (la fila se conserva, con su fecha) y el curso de ese
 * programa vuelve (`devolverElCurso`). `cursoCortado`: a su acceso lo cortó otra persona, y eso no lo deshace volver
 * a admitirlo (se habilita desde su ficha).
 */
export async function admitirAlumno(a: Actor, claveRaw: unknown): Promise<Resultado<{ cursoCortado: boolean }>> {
  try {
    const c = leerClave(claveRaw);
    if (!c || !puedeSacar(a, c.clave)) return { ok: false, error: 'Solo el equipo admite a un alumno.' };
    const { data, error } = await de(a.ws, 'comunidad_baneos').update({ levantado_at: new Date().toISOString() })
      .eq('producto_id', a.productoId).eq('miembro', c.clave).is('levantado_at', null).select('created_at');
    if (error) return { ok: false, error: error.message };
    const ban = ((data ?? []) as Array<{ created_at: string | null }>)[0];
    if (!ban) return { ok: true, cursoCortado: false }; // ya estaba adentro: no se toca su curso
    try {
      const { devolverElCurso } = await import('./curso-datos');
      const r = await runWithWorkspace(a.ws, () => devolverElCurso(c.id, a.productoId, ban.created_at));
      return { ok: true, cursoCortado: r === 'cortado' };
    } catch (e) {
      return { ok: false, error: `Volvió a la comunidad, pero no pude abrirle el curso: ${msg(e, 'error de lectura')}.` };
    }
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo admitir.') };
  }
}

/**
 * Los alumnos sacados de cada programa (baneo vigente), producto → leads. Lo leen las dos tablas de Avance (la de
 * Clients y la del Classroom) para no listarlos: sacarlo es del programa entero, y ahí se lo invitaría otra vez. Se
 * los ve, y se los vuelve a admitir, en Members → «Fuera». Tira si la base no contesta: quien llama decide.
 */
export async function sacadosPorProducto(ws: number): Promise<Map<number, Set<number>>> {
  const filas = await leerTodo<{ id: number; producto_id: number | string; lead_id: number | string | null }>(
    getSupabaseServer(), 'comunidad_baneos', 'id, producto_id, lead_id',
    { orden: 'id', eq: { workspace_id: ws }, filtros: (q) => q.is('levantado_at', null) },
  );
  const out = new Map<number, Set<number>>();
  for (const f of filas) {
    if (f.lead_id == null) continue;
    const p = Number(f.producto_id);
    if (!out.has(p)) out.set(p, new Set());
    out.get(p)!.add(Number(f.lead_id));
  }
  return out;
}

/** Los alumnos fuera de la comunidad (baneo vigente), del más reciente al más viejo. Sólo el equipo. */
export async function sacadosDeLaComunidad(a: Actor): Promise<Resultado<{ sacados: SacadoVista[] }>> {
  try {
    if (!puedeModerar(a)) return { ok: false, error: 'Solo el equipo ve a quién se sacó.' };
    const { data, error } = await de(a.ws, 'comunidad_baneos').select('miembro, motivo, por, created_at')
      .eq('producto_id', a.productoId).is('levantado_at', null).order('created_at', { ascending: false }).limit(300);
    if (error) return { ok: false, error: error.message };
    const filas = (data ?? []) as Array<{ miembro: string; motivo: string | null; por: string | null; created_at: string }>;
    const info = await infoDeMiembros(a.ws, filas.map((f) => f.miembro));
    const sinPuntos = new Map<string, number>();
    return {
      ok: true,
      sacados: filas.map((f) => ({ miembro: miembroVista(f.miembro, info, sinPuntos), desde: f.created_at, motivo: f.motivo ?? '', por: f.por })),
    };
  } catch (e) {
    return { ok: false, error: msg(e, 'No pude leer a quién se sacó.') };
  }
}

/**
 * Cierra (o abre) los comentarios de un post. Cerrado, no comenta nadie (`puedeComentar`); lo que ya
 * estaba se sigue viendo. Sólo el equipo.
 */
export async function cerrarComentarios(a: Actor, postIdRaw: unknown, si: boolean): Promise<Resultado<{ cerrado: boolean }>> {
  try {
    if (!puedeModerar(a)) return { ok: false, error: 'Solo el equipo cierra los comentarios.' };
    const postId = idValido(postIdRaw);
    const f = postId ? await postDe(a, postId) : null;
    if (!f) return { ok: false, error: 'Ese post ya no está.' };
    const { error } = await de(a.ws, 'comunidad_posts').update({ comentarios_cerrados_at: si ? (f.comentarios_cerrados_at ?? new Date().toISOString()) : null })
      .eq('producto_id', a.productoId).eq('id', f.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, cerrado: si };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo guardar.') };
  }
}
