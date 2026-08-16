// =============================================================================
// /api/admin/cliente-diseno — crear y dejar listo el «Cliente de Diseño»
// =============================================================================
// GET  → si existe y si ya tiene datos.
// POST → lo crea si falta (con el id FIJO WS_DISENO), y devuelve a quién le toca
//        traer los datos. Los datos NO se copian acá: eso ya lo hace
//        /api/datos-mau con `action:'todo'`, que además cierra el onboarding.
//        Duplicar esa lógica sería un segundo lugar que se queda viejo.
//
// Quién puede: SOLO super-admin de la agencia (getSesionAdmin).
//
// ⚠️ El id se inserta EXPLÍCITO, no por la secuencia. Es a propósito: el guard
// destructivo (`exigirClienteDePrueba`) es una lista blanca de números, así que
// el workspace tiene que nacer con el número que la lista espera. Si naciera por
// secuencia, el guard no lo reconocería y los controles de la agencia no
// aparecerían — que es la falla SEGURA, pero igual conviene que no pase.
// El 4 estaba libre y la secuencia ya pasó por ahí, así que no hay colisión.
// =============================================================================

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { WS_DISENO } from '@/lib/auth-session';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const NOMBRE = 'Cliente de Diseño';
const SLUG = 'cliente-diseno';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** ¿Existe la fila, y tiene algún lead adentro? */
async function estado() {
  const sb = getSupabaseServer();
  const { data: ws } = await sb.from('workspaces').select('id, nombre, capa').eq('id', WS_DISENO).maybeSingle();
  if (!ws) return { existe: false, conDatos: false, ws: null };
  // «Tiene datos» se pregunta por los leads: es la tabla que el atajo de
  // datos-mau llena sí o sí, y la que hace que el dashboard se vea vivo.
  const { count } = await sb
    .from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', WS_DISENO);
  return { existe: true, conDatos: (count ?? 0) > 0, ws };
}

export async function GET() {
  if (!(await getSesionAdmin())) {
    return NextResponse.json({ ok: false, error: 'Solo la agencia.' }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, id: WS_DISENO, ...(await estado()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST() {
  if (!(await getSesionAdmin())) {
    return NextResponse.json({ ok: false, error: 'Solo la agencia.' }, { status: 403 });
  }
  try {
    const previo = await estado();
    if (previo.existe) {
      return NextResponse.json({ ok: true, id: WS_DISENO, creado: false, ...previo });
    }
    // `capa: 'completo'` para que se vean TODAS las tabs: un cliente de diseño
    // con la mitad de la app escondida no sirve para juzgar un tema.
    const { error } = await getSupabaseServer()
      .from('workspaces')
      .insert({ id: WS_DISENO, nombre: NOMBRE, slug: SLUG, estado: 'activo', capa: 'completo' });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: WS_DISENO, creado: true, existe: true, conDatos: false });
  } catch (e) {
    console.error(`[api:cliente-diseno] ${msg(e)}`);
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
