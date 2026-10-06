// =============================================================================
// /api/admin/agencia/altas — el super admin firma (o rechaza) un alta pedida
// =============================================================================
// POST { id, estado: 'aprobada' | 'rechazada', motivo? }
//
// ⚠️ ES UNA RUTA PROPIA Y NO UN `estado` MÁS DE /api/admin/agencia, por lo mismo
// que aquélla no es un `action` de /api/admin/workspaces: no es la misma decisión.
// Aprobar una CARTERA es dejar mirar; aprobar un ALTA es CREAR UNA CUENTA y mandar
// un mail. Un solo endpoint haría que el día que alguien afloje el guard de una se
// lleve puesta a la otra sin darse cuenta.
//
// ⚠️ Y NO HAY «BORRAR». Un pedido rechazado se queda en 'rechazada' con su motivo:
// «esta agencia quiso meter a esta persona y se le dijo que no» es lo que alguien
// va a querer auditar, y una fila borrada no cuenta nada.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { reclamarAlta, anotarUsuarioDeAlta } from '@/lib/agencia';
import { ROTULO_ROL, type RolAlta } from '@/lib/agencia-altas';
import { buscarUsuarioPorEmail, crearUsuario } from '@/lib/usuarios';
import { invitarPorEmail } from '@/lib/invitaciones';
import { getWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: { id?: unknown; estado?: unknown; motivo?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const id = Number(body.id);
  const estado = String(body.estado ?? '');
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: 'pedido inválido' }, { status: 400 });
  if (estado !== 'aprobada' && estado !== 'rechazada') {
    return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
  }

  // ⚠️ SE RECLAMA ANTES DE CREAR NADA. Dos pestañas del super admin, o un doble
  // click, aprobarían el mismo pedido dos veces — y aprobar manda un mail. Sin fila
  // devuelta, alguien llegó primero: se contesta y no se crea nada.
  const fila = await reclamarAlta(
    id, estado, admin.email,
    typeof body.motivo === 'string' ? body.motivo : undefined,
  );
  if (!fila) return NextResponse.json({ ok: false, error: 'ese pedido ya no está pendiente' }, { status: 409 });

  if (estado === 'rechazada') return NextResponse.json({ ok: true, alta: fila });

  // ── Aprobar: recién ACÁ existe la cuenta ───────────────────────────────────
  // ⚠️ SI YA EXISTE, NO SE PISA. Entre el pedido y la firma pueden pasar días, y en
  // el medio el propio cliente pudo haber sumado a esa persona desde su panel de
  // Equipo. Crear encima rebota contra el único de `usuarios.email` con un error que
  // no dice nada; moverla de workspace sería peor — le sacaría el acceso a donde ya
  // estaba trabajando. Se informa y el alta queda aprobada igual: el resultado que
  // la agencia pidió (esa persona adentro) ya está.
  const existente = await buscarUsuarioPorEmail(fila.email);
  if (existente) {
    // ⚠️ `fila` ES LA FOTO DEL RECLAMO, así que su `usuario_id` sale null en la
    // respuesta aunque en la base quede escrito (medido el 28/09: la fila decía
    // `usuario_id=7` y el JSON `null`). No se relee a propósito —nadie del navegador
    // lo usa— pero el que vaya a depurar esto por el JSON tiene que saberlo.
    await anotarUsuarioDeAlta(fila.id, existente.id);
    return NextResponse.json({
      ok: true, alta: fila,
      aviso: existente.workspace_id === fila.cliente_ws
        ? { tono: 'ok', texto: `${fila.email} ya estaba en el equipo de ese cliente.` }
        : { tono: 'warn', texto: `${fila.email} ya tiene cuenta en otro cliente. No se movió: revísalo a mano.` },
    });
  }

  try {
    const u = await crearUsuario({
      email: fila.email,
      nombre: fila.nombre.trim() || fila.email,
      // El rol GLOBAL es de cliente, siempre. Este camino no puede crear un super
      // admin: el rol de plataforma sale de sumar a alguien EN el workspace de la
      // plataforma, y ése no está en la cartera de ninguna agencia.
      rol: 'usuario',
      workspace_id: fila.cliente_ws,
      rol_ws: fila.rol_ws as RolAlta,
    });
    await anotarUsuarioDeAlta(fila.id, u.id);

    // La invitación es lo que hace que el alta signifique algo: sin el mail, la
    // cuenta existe y la persona no se entera. Si el envío falla, el alta NO se
    // deshace —la cuenta está bien creada— y el aviso lo dice, que es lo que deja
    // usar «Reenviar acceso» del equipo en vez de borrar y recrear.
    const ws = await getWorkspace(fila.cliente_ws);
    const invitacion = await invitarPorEmail({
      email: u.email, nombre: u.nombre, workspace: ws?.nombre, rolWs: u.rol_ws,
    }).catch(() => null);

    // ⚠️ `invitacion?.enviado`, NO `invitacion`: `invitarPorEmail` devuelve SIEMPRE un objeto,
    // también cuando el mail no salió. Con `invitacion ? …` decía «Ya se le mandó el acceso»
    // sobre un mail que nunca existió (06/10/2026). El `.catch(() => null)` cubre que tire.
    return NextResponse.json({
      ok: true, alta: fila, usuario: u, invitacion,
      aviso: invitacion?.enviado
        ? { tono: 'ok', texto: `${u.email} entra como ${ROTULO_ROL[fila.rol_ws as RolAlta] ?? fila.rol_ws}. Ya se le mandó el acceso.` }
        : { tono: 'warn', texto: `${u.email} quedó creado, pero no se le pudo mandar el acceso${invitacion?.error ? ` (${invitacion.error})` : ''}. Reenvíaselo desde su equipo.` },
    });
  } catch (e) {
    // La cuenta no se creó y el pedido ya está reclamado como 'aprobada'. Se dice con
    // todas las letras: un 500 mudo dejaría al super admin creyendo que la persona
    // está adentro. Volver a 'pendiente' sería peor — la regla de la casa es que lo
    // reclamado no vuelve, justamente para que un reintento no ejecute dos veces.
    return NextResponse.json({
      ok: false,
      error: `Aprobado, pero no pude crear la cuenta: ${e instanceof Error ? e.message : String(e)}. Súmalo a mano desde su equipo.`,
    }, { status: 500 });
  }
}
