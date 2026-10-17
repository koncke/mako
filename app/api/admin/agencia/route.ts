// =============================================================================
// /api/admin/agencia — el super admin aprueba (o corta) la vista de una agencia
// =============================================================================
// GET                                        → lo que espera su firma (carteras + altas).
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
import { pendientesDeAprobar, agenciasHabilitadas, altasPendientes, todasLasCarteras } from '@/lib/agencia';
import { esWsValido, ESTADOS_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { avisarClienteAprobado } from '@/lib/agencia-habilitar';
import { revocarAgenteTokenSiPerdioAcceso } from '@/lib/agente-token';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return NextResponse.json({
    ok: true,
    pendientes: await pendientesDeAprobar(),
    agencias: await agenciasHabilitadas(),
    // ⚠️ VIENE EN LA MISMA LECTURA que las carteras, aunque se firme en otra ruta.
    // Las dos cosas las dibuja el MISMO bloque de la pantalla, y dos fetch para un
    // bloque es cómo termina diciendo «no hay nada» de un lado mientras el otro
    // todavía carga. Firmarlas por separado es otra pregunta (ver ./altas).
    altas: await altasPendientes(),
    // Quién es cliente de quién. Lo usa la GRILLA para no dibujar dos veces al mismo
    // negocio: una vez como tarjeta de MaKo y otra adentro de su agencia.
    carteras: await todasLasCarteras(),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: { agenciaWs?: unknown; clienteWs?: unknown; estado?: unknown; motivo?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // ⛔ ACA VIVIA «habilitar / quitar como agencia», y se fue el 27/09/2026 con la
  // capa nueva. Ser agencia ES EL PLAN, asi que darla de alta es «Pasar a
  // Agencia» en el menu de planes de su tarjeta — el mismo control con el que se
  // cambia cualquier otro. Dos caminos para el mismo hecho es como uno de los dos
  // se queda viejo.

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

  // SACARLE EL CLIENTE A LA AGENCIA APAGA TAMBIÉN SU TOKEN DE LA API (14/10/2026). Revocar la
  // fila corta la cookie de la vista de agencia, pero un `mkoag_…` que su admin acuñó desde esa
  // vista seguía valiendo. Sólo se borra si lo acuñó alguien que con esta decisión perdió el
  // acceso: el token del propio dueño del negocio no se toca. Best-effort (no tira).
  if (estado !== 'aprobado') await revocarAgenteTokenSiPerdioAcceso(clienteWs);

  // APROBAR ES EL MOMENTO EN QUE EL CLIENTE SE ENTERA. El aviso vive en lib/agencia-habilitar.ts desde el 17/10/2026,
  // porque el PAGO del primer mes también aprueba (#866) y tiene que decir lo mismo. El mail no tumba la aprobación.
  const aviso = estado === 'aprobado' ? await avisarClienteAprobado(clienteWs) : null;

  return NextResponse.json({ ok: true, fila: data, aviso });
}
