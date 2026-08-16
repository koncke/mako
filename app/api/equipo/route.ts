// =============================================================================
// /api/equipo — equipo del CLIENTE (lo gestiona el admin-del-cliente)
// =============================================================================
// Scopeado al workspace del request (getWorkspaceActual). Solo el admin-del-
// cliente (rol_ws efectivo='admin') o un admin de agencia impersonando puede
// tocar acá. Un admin-cliente solo ve/gestiona a SU propio equipo: nunca a otro
// workspace ni a admins de la agencia (esos tienen rol GLOBAL 'admin').
//
// A diferencia de /api/admin/*, esta ruta NO requiere rol de agencia: la usa el
// cliente. Por eso el guard es por rol-de-workspace, no por getSesionAdmin.

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import {
  actualizarUsuario, contarAdminsClienteActivos, crearUsuario, eliminarUsuario,
  listarUsuarios, type EstadoUsuario, type Usuario,
} from '@/lib/usuarios';
import type { RolWorkspace } from '@/lib/auth-session';
import { invitarPorEmail } from '@/lib/invitaciones';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES_WS: RolWorkspace[] = ['admin', 'closer', 'setter'];

/** Miembros del workspace `ws` (usuarios-cliente; nunca admins de agencia). */
async function equipoDe(ws: number): Promise<Usuario[]> {
  const todos = await listarUsuarios();
  return todos.filter((u) => u.rol === 'usuario' && u.workspace_id === ws);
}

// Resuelve y autoriza: devuelve el ws si el request es admin-del-cliente (o
// agencia impersonando), o un Response de error si no.
async function contexto(): Promise<{ ws: number } | { error: NextResponse }> {
  const [ws, rolWs] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null) return { error: NextResponse.json({ ok: false, error: 'Sin workspace activo.' }, { status: 403 }) };
  if (rolWs !== 'admin') return { error: NextResponse.json({ ok: false, error: 'Solo el admin del cliente puede gestionar el equipo.' }, { status: 403 }) };
  return { ws };
}

export async function GET() {
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;
  try {
    return NextResponse.json({ ok: true, equipo: await equipoDe(ctx.ws) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = { action?: string; id?: number; email?: string; nombre?: string; rol_ws?: RolWorkspace; estado?: EstadoUsuario };

export async function POST(req: NextRequest) {
  const ctx = await contexto();
  if ('error' in ctx) return ctx.error;
  const { ws } = ctx;

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    // El objetivo (si hay id) tiene que ser un miembro de ESTE workspace.
    const equipo = await equipoDe(ws);
    const objetivo = typeof body.id === 'number' ? equipo.find((u) => u.id === body.id) : undefined;
    if (typeof body.id === 'number' && !objetivo) {
      return NextResponse.json({ ok: false, error: 'Ese miembro no pertenece a tu equipo.' }, { status: 404 });
    }

    switch (body.action) {
      case 'invitar': {
        const email = (body.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
        const rolWs = body.rol_ws && ROLES_WS.includes(body.rol_ws) ? body.rol_ws : 'setter';
        if ((await listarUsuarios()).some((u) => u.email === email)) {
          return NextResponse.json({ ok: false, error: 'Ya existe una cuenta con ese email.' }, { status: 400 });
        }
        const quien = (await getUsuarioActual())?.email || 'admin-cliente';
        const nuevo = await crearUsuario({ email, nombre: body.nombre, rol: 'usuario', rol_ws: rolWs, workspace_id: ws, invitado_por: quien });
        // ⚠️ ESTA ACCIÓN SE LLAMA 'invitar' Y NO INVITABA A NADIE: creaba la fila y ahí
        // terminaba. El cliente sumaba a su closer, el closer nunca se enteraba, y el
        // cliente no tenía cómo saber que faltaba avisarle — el botón decía «Invitar».
        const invitacion = await invitarPorEmail({ email, nombre: body.nombre, rolWs, invitadoPor: quien });
        return NextResponse.json({ ok: true, usuario: nuevo, invitacion });
      }

      case 'rolws': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'Falta el miembro.' }, { status: 400 });
        const rolWs = body.rol_ws;
        if (!rolWs || !ROLES_WS.includes(rolWs)) return NextResponse.json({ ok: false, error: 'rol inválido' }, { status: 400 });
        if (objetivo.rol_ws === 'admin' && rolWs !== 'admin' && (await contarAdminsClienteActivos(ws)) <= 1) {
          return NextResponse.json({ ok: false, error: 'Sos el único admin del cliente — nombrá otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { rol_ws: rolWs }) });
      }

      // Reenviar el acceso. `objetivo` sale de `equipoDe(ws)`, así que un cliente solo
      // puede reenviarle a SU propia gente: el scope es el mismo que el del resto de la
      // ruta y no hace falta un guard aparte.
      case 'reinvitar': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'Falta el miembro.' }, { status: 400 });
        const invitacion = await invitarPorEmail({
          email: objetivo.email, nombre: objetivo.nombre,
          rolWs: objetivo.rol_ws, invitadoPor: (await getUsuarioActual())?.email || objetivo.invitado_por,
        });
        return NextResponse.json({ ok: true, invitacion });
      }

      case 'estado': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'Falta el miembro.' }, { status: 400 });
        const estado = body.estado;
        if (estado !== 'activo' && estado !== 'suspendido') return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
        if (estado === 'suspendido' && objetivo.rol_ws === 'admin' && (await contarAdminsClienteActivos(ws)) <= 1) {
          return NextResponse.json({ ok: false, error: 'Sos el único admin del cliente — nombrá otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { estado }) });
      }

      case 'eliminar': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'Falta el miembro.' }, { status: 400 });
        if (objetivo.rol_ws === 'admin' && (await contarAdminsClienteActivos(ws)) <= 1) {
          return NextResponse.json({ ok: false, error: 'Sos el único admin del cliente — nombrá otro admin antes.' }, { status: 400 });
        }
        await eliminarUsuario(objetivo.id);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
