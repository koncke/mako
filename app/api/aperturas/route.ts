// =============================================================================
// /api/aperturas — lo que la PERSONA decidió con las aperturas de MaKo, en el negocio que está mirando (29/10/2026)
// =============================================================================
// La memoria de «MaKo toma la iniciativa» (lib/aperturas/reglas.ts; docs/mako-iniciativa/plan.md §2.4). Es una copia de
// /api/recorridos (app/api/recorridos/route.ts) con una diferencia: la clave lleva el WORKSPACE.
//
//   GET            → { ok, guardado, memoria, primeraVez, nombre, quien }   (`memoria`: lo de ESTE negocio, sin el workspace)
//   POST { clave, d, valor?, pendiente? } → { ok, guardado }               (anota; no ejecuta nada)
//
// ⚠️ LA FILA ES LA DE LA SESIÓN, el negocio el que se MIRA. El super admin mirando un cliente escribe en SU perfil, con el
//    workspace del cliente en la clave: su «Ahora no» no le calla a MaKo al dueño, y el del dueño no lo calla a él. Sin el
//    workspace en la clave, una agencia mezclaba negocios.
// ⚠️ `guardado: false` = la sesión no tiene fila propia (acceso de desarrollo, contraseña maestra): el navegador se queda con su
//    respaldo, como /api/recorridos. Una lectura caída es un 503 (no «nunca vio nada»): el gancho calla mientras tanto.
// ⚠️ La clave la arma ESTA ruta con el workspace de la sesión: desde el navegador llega sin él, y una clave de otro negocio no
//    se puede escribir.

import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspaceActual } from '@/lib/workspace';
import { claveValida, memoriaDelNegocio, perfilConApertura, primeraVezDe, type DecisionApertura } from '@/lib/aperturas/reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Fila = { id: number; perfil: unknown; updated_at: string | null };

const DECISIONES: readonly DecisionApertura[] = ['vista', 'respondida', 'ahora-no', 'nunca'];

async function sesion(): Promise<{ email: string; nombre: string }> {
  const s = await getUsuarioActual();
  return { email: s?.email?.trim().toLowerCase() ?? '', nombre: s?.nombre?.trim() ?? '' };
}

/** La huella de la persona y el negocio para el respaldo del navegador (la de /api/recorridos, con el workspace). */
const quienDe = (email: string, ws: number): string | null =>
  email ? createHash('sha256').update(`mako-apertura:${ws}:${email}`).digest('hex').slice(0, 16) : null;

/** La fila de la sesión, o null (sin fila propia). TIRA si la lectura falla: «no pude leer» no es «no hay fila». */
async function filaDe(email: string): Promise<Fila | null> {
  if (!email) return null;
  const { data, error } = await getSupabaseServer().from('usuarios').select('id, perfil, updated_at').eq('email', email).maybeSingle();
  if (error) throw new Error(`usuarios: ${error.message}`);
  return (data as Fila | null) ?? null;
}

export async function GET() {
  let quien: string | null = null;
  try {
    const [{ email, nombre }, ws] = await Promise.all([sesion(), getWorkspaceActual()]);
    if (ws == null) return Response.json({ ok: false, error: 'Elige una cuenta primero.' }, { status: 400 });
    quien = quienDe(email, ws);
    const fila = await filaDe(email);
    if (!fila) return Response.json({ ok: true, guardado: false, memoria: {}, primeraVez: false, nombre, quien });
    return Response.json({ ok: true, guardado: true, memoria: memoriaDelNegocio(fila.perfil, ws), primeraVez: primeraVezDe(fila.perfil), nombre, quien });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err), quien }, { status: 503 });
  }
}

const INTENTOS = 3;

export async function POST(req: NextRequest) {
  let body: { clave?: unknown; d?: unknown; valor?: unknown; pendiente?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'json inválido' }, { status: 400 });
  }
  if (!claveValida(body.clave)) return Response.json({ ok: false, error: 'clave inválida' }, { status: 400 });
  const d = DECISIONES.find((x) => x === body.d);
  if (!d) return Response.json({ ok: false, error: 'decisión inválida' }, { status: 400 });
  const clave = body.clave;
  const extra = {
    ...(typeof body.valor === 'string' && body.valor ? { valor: body.valor } : {}),
    ...(typeof body.pendiente === 'string' && body.pendiente ? { pendiente: body.pendiente } : {}),
  };

  try {
    const [{ email }, ws] = await Promise.all([sesion(), getWorkspaceActual()]);
    if (ws == null) return Response.json({ ok: false, error: 'Elige una cuenta primero.' }, { status: 400 });
    const sb = getSupabaseServer();
    // ⚠️ EL JSONB `perfil` TIENE VARIOS ESCRITORES (el perfil, el sonido, los recorridos, esto) y cada uno lo reescribe ENTERO:
    // compare-and-set sobre `updated_at`, y se reintenta leyendo de nuevo (el mismo cuidado que /api/recorridos).
    for (let intento = 0; intento < INTENTOS; intento++) {
      const fila = await filaDe(email);
      if (!fila) return Response.json({ ok: true, guardado: false });
      const ahora = Date.now();
      const perfil = perfilConApertura(fila.perfil, ws, clave, d, ahora, extra);
      const at = new Date(ahora).toISOString();
      let q = sb.from('usuarios').update({ perfil, updated_at: at }).eq('id', fila.id);
      q = fila.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', fila.updated_at);
      const { data, error } = await q.select('id');
      if (error) throw new Error(`usuarios: ${error.message}`);
      if (Array.isArray(data) && data.length > 0) return Response.json({ ok: true, guardado: true });
    }
    // Tres choques seguidos: se escribe sin la condición y se dice (`cas: false`), como /api/recorridos.
    const fila = await filaDe(email);
    if (!fila) return Response.json({ ok: true, guardado: false });
    const ahora = Date.now();
    const { error } = await sb.from('usuarios')
      .update({ perfil: perfilConApertura(fila.perfil, ws, clave, d, ahora, extra), updated_at: new Date(ahora).toISOString() }).eq('id', fila.id);
    if (error) throw new Error(`usuarios: ${error.message}`);
    return Response.json({ ok: true, guardado: true, cas: false });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
