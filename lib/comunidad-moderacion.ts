import 'server-only';

// =============================================================================
// comunidad-moderacion — sacar a un alumno de la comunidad (y volver a admitirlo), cerrar comentarios
// =============================================================================
// Skool (relevo, B.8): admins y moderadores borran lo ajeno, fijan, sacan a alguien y cierran lo que
// haga falta. Borrar lo ajeno y fijar ya estaban (lib/comunidad-datos.ts); acá está lo que faltaba.
// Lo hace el EQUIPO: cada función vuelve a preguntar la regla (`puedeSacar`, `puedeModerar`,
// lib/comunidad-reglas.ts) antes de escribir, con el actor de la SESIÓN.
//
// ⚠️ SACAR NO CORTA EL CURSO. El baneo vive en `comunidad_baneos` (mig 0217), aparte de
//    `curso_accesos`: el alumno sigue con sus clases y su portal, y lo que pierde es la comunidad —
//    ni leer ni escribir—, porque `actorDelAlumno` (el portón de /api/compartido/comunidad) lo devuelve
//    `null` mientras el baneo esté vigente (`levantado_at` en null).

import { idValido, leerClave, puedeModerar, puedeSacar, sanearTexto } from './comunidad-reglas';
import { de, msg, postDe, infoDeMiembros, miembroVista, descartarAdjunto, type Actor } from './comunidad-datos';
import { getSupabaseServer } from './supabase';
import type { Resultado, SacadoVista } from './comunidad-tipos';

/** Hasta dónde llega «borrar lo que escribió» al sacar a alguien: los últimos 7 días, como el ban de Skool. */
const BORRAR_DIAS = 7;
const TOPE_MOTIVO = 300;

/**
 * Saca a un alumno de la comunidad. Con `borrarContenido`, además borra sus posts y comentarios de los
 * últimos 7 días (sin vuelta atrás, y lo dice el botón). Volver a sacar a alguien que había vuelto
 * reescribe su fila.
 */
export async function sacarAlumno(a: Actor, claveRaw: unknown, opts: { motivo?: unknown; borrarContenido?: unknown } = {}):
  Promise<Resultado<{ borrados: { posts: number; comentarios: number } }>> {
  try {
    const c = leerClave(claveRaw);
    if (!c || !puedeSacar(a, c.clave)) return { ok: false, error: 'Solo el equipo saca a un alumno.' };
    // El lead tiene que ser de ESTE negocio: la clave viaja desde el navegador.
    const { data: lead, error: eLead } = await getSupabaseServer().from('leads').select('id').eq('workspace_id', a.ws).eq('id', c.id).maybeSingle();
    if (eLead) return { ok: false, error: eLead.message };
    if (!lead) return { ok: false, error: 'Esa persona ya no está.' };
    const motivo = sanearTexto(opts.motivo, { unaLinea: true }).slice(0, TOPE_MOTIVO);
    const borrar = opts.borrarContenido === true;
    const { error } = await de(a.ws, 'comunidad_baneos').upsert({
      producto_id: a.productoId, miembro: c.clave, lead_id: c.id, motivo, por: a.nombre, borro_contenido: borrar,
      levantado_at: null, created_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,producto_id,miembro' });
    if (error) return { ok: false, error: error.message };

    const borrados = { posts: 0, comentarios: 0 };
    if (borrar) {
      const desde = new Date(Date.now() - BORRAR_DIAS * 86_400_000).toISOString();
      const p = await de(a.ws, 'comunidad_posts').delete().eq('producto_id', a.productoId).eq('miembro', c.clave).gte('created_at', desde).select('id, adjunto_path');
      if (p.error) return { ok: false, error: `Quedó fuera, pero no pude borrar sus posts: ${p.error.message}` };
      const k = await de(a.ws, 'comunidad_comentarios').delete().eq('producto_id', a.productoId).eq('miembro', c.clave).gte('created_at', desde).select('id');
      if (k.error) return { ok: false, error: `Quedó fuera, pero no pude borrar sus comentarios: ${k.error.message}` };
      const filas = (p.data ?? []) as Array<{ id: number; adjunto_path: string | null }>;
      // Los archivos de lo borrado se van del bucket (`descartarAdjunto` mira que nadie más los nombre).
      for (const f of filas) if (f.adjunto_path) await descartarAdjunto(a, f.adjunto_path);
      borrados.posts = filas.length;
      borrados.comentarios = (k.data ?? []).length;
    }
    return { ok: true, borrados };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo sacar.') };
  }
}

/** Vuelve a admitir a un alumno sacado: el baneo queda levantado (la fila se conserva, con su fecha). */
export async function admitirAlumno(a: Actor, claveRaw: unknown): Promise<Resultado> {
  try {
    const c = leerClave(claveRaw);
    if (!c || !puedeSacar(a, c.clave)) return { ok: false, error: 'Solo el equipo admite a un alumno.' };
    const { error } = await de(a.ws, 'comunidad_baneos').update({ levantado_at: new Date().toISOString() })
      .eq('producto_id', a.productoId).eq('miembro', c.clave).is('levantado_at', null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo admitir.') };
  }
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
