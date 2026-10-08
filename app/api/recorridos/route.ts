// =============================================================================
// /api/recorridos — qué recorridos guiados ya vio la PERSONA logueada
// =============================================================================
// El recorrido (app/_ui/Recorrido.tsx) se ve UNA vez por persona y no por workspace
// (docs/diseno-curso-skool.md, D7). Lo que ya vio vive en el jsonb `perfil` de su fila de
// `usuarios` (mig 0056), bajo `recorridos`, al lado del sonido de las notificaciones.
//
//   GET  → { ok, guardado, vistos: string[], quien }
//   POST { id } → { ok, guardado }
//
// `quien` es la huella de la persona (16 hex de un sha256 del email de la sesión). La
// usa el gancho para que su respaldo en `localStorage` sea POR PERSONA y no por
// navegador (ver `claveLocal` en lib/recorridos.ts). Va también en el 503: la base
// puede estar caída y la sesión saberse igual, y es justo cuando el respaldo trabaja.
// Es una huella y no el id ni el email: el navegador sólo necesita distinguir personas.
//
// `guardado: false` = la sesión no tiene fila propia (acceso de desarrollo, contraseña
// maestra). No es un error: el gancho del navegador se queda con su respaldo local. Se
// devuelve en vez de tragárselo por la misma razón que `setNotifInApp` (lib/perfil.ts):
// sin eso, «lo guardé» y «no tengo dónde guardarlo» se ven iguales.
//
// ⚠️ NO SE APLICA EL «VIENDO COMO CLIENTE». El super admin que entra a mirar un cliente
// sigue siendo él frente al teclado: el recorrido que vio es suyo, y marcarlo sobre el
// usuario del cliente le escondería el recorrido a quien todavía no lo vio. Por eso la
// fila sale del email de la SESIÓN y nunca del workspace que se está mirando — es el
// criterio de `filaPropia` en lib/perfil.ts, que no se importa porque es privada y además
// no trae `updated_at`, que acá hace falta (abajo).
//
// No va en lib/rutas-publicas.ts a propósito: sin sesión no hay persona, y el proxy corta
// con 401 antes de llegar acá. El portal del alumno (que no tiene sesión) usa el modo
// `soloLocal` del gancho y no pega nunca a esta ruta.

import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { idRecorridoValido, perfilConVisto, vistosDePerfil } from '@/lib/recorridos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Fila = { id: number; perfil: unknown; updated_at: string | null };

/** El email de la sesión, normalizado como se guarda en `usuarios`. '' = sin persona. */
async function emailDeLaSesion(): Promise<string> {
  const sesion = await getUsuarioActual();
  return sesion?.email?.trim().toLowerCase() ?? '';
}

/** La huella de la persona para el respaldo del navegador (ver la cabecera). */
const quienDe = (email: string): string | null =>
  email ? createHash('sha256').update(`mako-recorrido:${email}`).digest('hex').slice(0, 16) : null;

/**
 * La fila de la persona logueada, o null si no tiene (sesión de desarrollo o maestra).
 * TIRA si la lectura falla: «no pude leer» es un tercer estado, y confundirlo con «no hay
 * fila» haría que el navegador se quede con lo local creyendo que el server no existe.
 */
async function filaDeLaSesion(): Promise<Fila | null> {
  const email = await emailDeLaSesion();
  if (!email) return null;
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('id, perfil, updated_at').eq('email', email).maybeSingle();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return (data as Fila | null) ?? null;
}

export async function GET() {
  // Antes del `try`: si la base se cae, la huella sale igual en el 503 (sale de la sesión
  // firmada, no de la base) y el respaldo del navegador sigue siendo de ESTA persona.
  let quien: string | null = null;
  try {
    quien = quienDe(await emailDeLaSesion());
    const fila = await filaDeLaSesion();
    if (!fila) return Response.json({ ok: true, guardado: false, vistos: [], quien });
    return Response.json({ ok: true, guardado: true, vistos: Object.keys(vistosDePerfil(fila.perfil)), quien });
  } catch (err) {
    // 503 y no 500: es la base que no contestó, y el gancho lo lee como «no sé» —se queda
    // con lo que recuerda el navegador— en vez de como «no lo vio».
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err), quien }, { status: 503 });
  }
}

/** Cuántas veces se reintenta si alguien escribió la fila entre la lectura y la escritura. */
const INTENTOS = 3;

export async function POST(req: NextRequest) {
  let body: { id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'json inválido' }, { status: 400 });
  }
  if (!idRecorridoValido(body.id)) return Response.json({ ok: false, error: 'id de recorrido inválido' }, { status: 400 });
  const id = body.id;

  try {
    const sb = getSupabaseServer();
    // ⚠️ EL JSONB `perfil` TIENE VARIOS ESCRITORES (el formulario del perfil, el sonido de
    // las notificaciones, esto) y cada uno lo reescribe ENTERO. Leer-modificar-escribir sin
    // condición deja una ventana donde el último pisa al de al lado: guardar el perfil en
    // una pestaña mientras se cierra el recorrido en otra borraría uno de los dos, sin un
    // error. Por eso la escritura va con compare-and-set sobre `updated_at` —que los cuatro
    // escritores de este jsonb suben siempre (lib/perfil.ts ×2, lib/datos-mau.ts ×2)— y se
    // reintenta leyendo de nuevo si alguien se adelantó.
    for (let intento = 0; intento < INTENTOS; intento++) {
      const fila = await filaDeLaSesion();
      if (!fila) return Response.json({ ok: true, guardado: false });
      // Ya estaba: no se escribe nada. Marcar dos veces no es un cambio.
      if (vistosDePerfil(fila.perfil)[id]) return Response.json({ ok: true, guardado: true });

      const ahora = new Date().toISOString();
      const perfil = perfilConVisto(fila.perfil, id, ahora);
      let q = sb.from('usuarios').update({ perfil, updated_at: ahora }).eq('id', fila.id);
      q = fila.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', fila.updated_at);
      const { data, error } = await q.select('id');
      if (error) throw new Error(`usuarios: ${error.message}`);
      if (Array.isArray(data) && data.length > 0) return Response.json({ ok: true, guardado: true });
    }

    // ⚠️ TRES CHOQUES SEGUIDOS no son una carrera: es que la condición no calza (NO MEDIDO
    // contra la base que el texto de `updated_at` que devuelve supabase-js vuelva a matchear
    // en el `.eq`; lo esperable es que sí). En vez de no guardar nunca, se escribe sin la
    // condición —que es lo que hace `setNotifInApp`— y la respuesta lo dice (`cas: false`),
    // para que se vea en la red del navegador y no quede como una degradación muda.
    const fila = await filaDeLaSesion();
    if (!fila) return Response.json({ ok: true, guardado: false });
    const ahora = new Date().toISOString();
    const { error } = await sb.from('usuarios')
      .update({ perfil: perfilConVisto(fila.perfil, id, ahora), updated_at: ahora }).eq('id', fila.id);
    if (error) throw new Error(`usuarios: ${error.message}`);
    return Response.json({ ok: true, guardado: true, cas: false });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
