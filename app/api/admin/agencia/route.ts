// =============================================================================
// /api/admin/agencia — el super admin aprueba (o corta) la vista de una agencia
// =============================================================================
// GET                                        → lo que espera su firma.
// POST { agenciaWs, clienteWs, estado, motivo } → aprobar | revocar | volver a pendiente.
//
// ⚠️ ES UNA RUTA PROPIA Y NO UN `action` MÁS DE /api/admin/workspaces, porque no
// es lo mismo: aquella cambia un atributo de UN workspace; ésta decide si un
// inquilino puede ver los datos de OTRO. Mezclarlas haría que el día que alguien
// afloje el guard de la primera —para que un cliente se renombre solo, digamos—
// se lleve puesta a la segunda sin darse cuenta.
//
// ⚠️ Y NO HAY «BORRAR». Revocar deja la fila en 'revocado' con su motivo: sacarle
// el acceso a una agencia es un hecho que alguien va a querer auditar, y una fila
// borrada no cuenta nada. Es la misma razón por la que el CHECK de la mig 0175
// tiene tres estados y no dos.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { pendientesDeAprobar, agenciasHabilitadas } from '@/lib/agencia';
import { esWsValido, ESTADOS_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return NextResponse.json({
    ok: true,
    pendientes: await pendientesDeAprobar(),
    agencias: await agenciasHabilitadas(),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: { agenciaWs?: unknown; clienteWs?: unknown; estado?: unknown; motivo?: unknown; habilitar?: unknown; ws?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // ── Habilitar (o quitar) a un workspace como AGENCIA ───────────────────────
  // Es la decisión anterior a todo lo demás: quién puede TENER clientes. La
  // otra rama decide a cuáles puede entrar cada uno.
  if (typeof body.habilitar === 'boolean') {
    const ws = Number(body.ws);
    if (!esWsValido(ws)) return NextResponse.json({ ok: false, error: 'workspace inválido' }, { status: 400 });
    if (body.habilitar) {
      const { error } = await getSupabaseServer()
        .from('agencias').upsert({ ws, habilitada_por: admin.email }, { onConflict: 'ws' });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, ws, agencia: true });
    }
    // ⚠️ QUITAR LA HABILITACIÓN NO TOCA LA CARTERA, a propósito: son dos hechos y
    // se revierten por separado. Sin la fila de `agencias` no puede pedir clientes
    // NUEVOS, y a los que ya tenía aprobados sigue entrando hasta que se les
    // revoque uno por uno — que es lo que hay que poder auditar. Borrar todo de un
    // golpe dejaría sin rastro de qué acceso existía.
    const { error } = await getSupabaseServer().from('agencias').delete().eq('ws', ws);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ws, agencia: false });
  }

  const agenciaWs = Number(body.agenciaWs);
  const clienteWs = Number(body.clienteWs);
  const estado = String(body.estado ?? '') as EstadoCartera;

  if (!esWsValido(agenciaWs) || !esWsValido(clienteWs)) {
    return NextResponse.json({ ok: false, error: 'workspace inválido' }, { status: 400 });
  }
  // La lista sale del catálogo compartido, no de un literal repetido acá: un
  // estado nuevo en el CHECK sin su entrada allá ya falla en el test de rótulos.
  if (!(ESTADOS_CARTERA as readonly string[]).includes(estado)) {
    return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
  }

  // Quién firmó y cuándo. El email y no un id: los usuarios se dan de baja y la
  // decisión queda igual.
  const { data, error } = await getSupabaseServer()
    .from('agencia_clientes')
    .update({
      estado,
      decidido_por: admin.email,
      decidido_at: new Date().toISOString(),
      motivo: typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 300) || null : null,
    })
    .eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs)
    .select('agencia_ws, cliente_ws, estado').maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // Sin fila, no hay nada que aprobar. Decirlo: un 200 sobre un update que no tocó
  // nada se lee como que se aprobó, y el botón desaparece de la pantalla igual.
  if (!data) return NextResponse.json({ ok: false, error: 'ese pedido ya no está' }, { status: 404 });

  return NextResponse.json({ ok: true, fila: data });
}
