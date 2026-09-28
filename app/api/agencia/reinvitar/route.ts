// =============================================================================
// /api/agencia/reinvitar — la agencia le reenvía el acceso a su propio cliente
// =============================================================================
// POST { clienteWs, usuarioId? } → { ok, invitacion }
//
// ⚠️ EXISTE PORQUE NINGUNA DE LAS DOS RUTAS QUE YA REENVÍAN LE SERVÍA A UNA AGENCIA.
// `/api/equipo` se scopea con `getWorkspaceActual()`, así que sólo reenvía DENTRO del
// workspace del request: desde la tab de Clientes de la agencia, ese workspace es el de
// la agencia y no el de su cliente. Y `/api/admin/*` exige `getSesionAdmin()`, que es el
// super admin. O sea que «reenviar la invitación», que es lo primero que hace falta
// cuando un cliente no puede entrar, no lo podía hacer nadie más que Martín a mano.
// El pedido fue textual: «de última Pausar cuenta, Re-enviar invitación, o cosas así»
// (29/09/2026), mirando un menú cuya única opción era abrir el CRM.
//
// ⚠️ EL PERMISO SE PREGUNTA EN EL MOMENTO Y CONTRA LA BASE (`puedeEntrarAhora`), nunca
// contra lo que mandó la pantalla: es la misma regla y el mismo helper que
// `/api/agencia/altas` y `/api/agencia/entrar`. Una cartera revocada tiene que cortar
// acá, no en el botón.
//
// ⚠️ Y 404 EN VEZ DE 403 cuando el cliente no es suyo. Un 403 confirma que ese workspace
// existe, y eso ya es contarle a una agencia algo de la cartera de otra.

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { puedeEntrarAhora } from '@/lib/agencia';
import { esWsValido, aQuienReinvitar } from '@/lib/agencia-cartera';
import { listarUsuarios } from '@/lib/usuarios';
import { invitarPorEmail } from '@/lib/invitaciones';
import { getWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = {}; }

  const clienteWs = body.clienteWs;
  if (!esWsValido(clienteWs)) return NextResponse.json({ ok: false, error: 'falta el cliente' }, { status: 400 });

  // El super admin no tiene cartera: puede sobre cualquiera, que es lo que ya puede por
  // /api/admin. Para el resto manda la cartera, leída ahora.
  const esSuper = sesion.rol === 'admin';
  if (!esSuper) {
    if (!esWsValido(sesion.ws)) return NextResponse.json({ ok: false, error: 'ese cliente no está en tu cartera' }, { status: 404 });
    if (!(await puedeEntrarAhora(sesion.ws, clienteWs))) {
      return NextResponse.json({ ok: false, error: 'ese cliente no está en tu cartera' }, { status: 404 });
    }
  }

  // A quién: lo decide `aQuienReinvitar`, que es pura y está testeada. Acá sólo se lee.
  const objetivo = aQuienReinvitar(await listarUsuarios(), clienteWs, body.usuarioId);

  if (!objetivo) {
    // No es un error del que llama: es el estado de esa cuenta, y hay que decirlo así
    // porque es exactamente el bug del 28/09 (una cuenta aprobada con cero usuarios).
    return NextResponse.json({ ok: false, error: 'ese cliente todavía no tiene a nadie adentro a quien escribirle' }, { status: 409 });
  }

  const invitacion = await invitarPorEmail({
    email: objetivo.email,
    nombre: objetivo.nombre,
    rolWs: objetivo.rol_ws,
    workspace: (await getWorkspace(clienteWs))?.nombre,
  });
  // `invitarPorEmail` NUNCA tira: devuelve {enviado,error,enlace}. Que el mail falle no
  // es un 500 — el que llamó necesita el enlace en pantalla para pasarlo a mano.
  return NextResponse.json({ ok: true, invitacion });
}
