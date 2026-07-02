// =============================================================================
// /api/admin/usuarios — gestión de cuentas (solo admin)
// =============================================================================
// GET  → lista de usuarios + resumen del estado del workspace (integraciones
//        conectadas según /metodo y avance del perfil del negocio).
// POST → { action: 'crear' | 'nombre' | 'rol' | 'estado' | 'eliminar', ... }.
//        Guard duro: nunca dejar el workspace sin un admin activo.
// El proxy ya exige rol admin para llegar acá; igual re-verificamos contra la
// base (getSesionAdmin) por si el rol cambió después de firmada la cookie.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  actualizarUsuario, contarAdminsActivos, contarAdminsClienteActivos, crearUsuario, eliminarUsuario,
  listarUsuarios, type EstadoUsuario, type Usuario,
} from '@/lib/usuarios';
import { integracionConectada } from '@/lib/credenciales';
import { SERVICIOS_METODO } from '@/lib/metodo-catalogo';
import { getAnswers, getSchema } from '@/lib/onboarding';
import { listarWorkspaces, OWNER_WS } from '@/lib/workspace';
import type { Rol, RolWorkspace } from '@/lib/auth-session';

const ROLES_WS: RolWorkspace[] = ['admin', 'closer', 'setter'];

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Estado de integraciones del workspace actual (sin impersonar = el dueño).
async function resumenIntegraciones() {
  const porServicio = await Promise.all(SERVICIOS_METODO.map(async (s) => ({
    key: s.key, nombre: s.nombre, core: s.core ?? false,
    conectada: await integracionConectada(s.key, OWNER_WS),
  })));
  return {
    conectadas: porServicio.filter((s) => s.conectada).length,
    total: porServicio.length,
    porServicio,
  };
}

async function resumenPerfilNegocio() {
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    const campos = schema.flatMap((g) => g.fields);
    const completados = campos.filter((f) => (answers[f.key] ?? '').trim()).length;
    return { completados, total: campos.length };
  } catch {
    return { completados: 0, total: 0 };
  }
}

export async function GET() {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const [usuarios, workspaces, perfilNegocio, integraciones] = await Promise.all([
      listarUsuarios(), listarWorkspaces(), resumenPerfilNegocio(), resumenIntegraciones(),
    ]);
    return NextResponse.json({
      ok: true,
      usuarios,
      workspaces,
      resumen: { integraciones, perfilNegocio },
      // Solo la cookie compartida real dispara el aviso "sesión vieja" — no la
      // sesión dev-admin de local (sub 'dev'), que también lleva legacy:true.
      sesion: { email: admin.email, legacy: admin.sub === 'legacy' },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = {
  action?: string;
  id?: number;
  email?: string;
  nombre?: string;
  rol?: Rol;
  rol_ws?: RolWorkspace | null;
  estado?: EstadoUsuario;
  workspace_id?: number | null;
};

// true si tocar (bajar de rol / suspender / borrar) a este usuario dejaría a la
// AGENCIA sin ningún admin activo.
async function dejariaSinAdmins(u: Usuario): Promise<boolean> {
  if (u.rol !== 'admin' || u.estado === 'suspendido') return false;
  return (await contarAdminsActivos()) <= 1;
}

// true si tocar a este usuario dejaría a su CLIENTE sin ningún admin-cliente
// activo. `nuevoRolWs` = rol que quedaría tras el cambio (undefined = suspender/borrar).
async function dejariaClienteSinAdmin(u: Usuario, nuevoRolWs?: RolWorkspace | null): Promise<boolean> {
  if (u.rol !== 'usuario' || u.rol_ws !== 'admin' || u.estado === 'suspendido' || u.workspace_id == null) return false;
  if (nuevoRolWs === 'admin') return false; // sigue siendo admin del cliente
  return (await contarAdminsClienteActivos(u.workspace_id)) <= 1;
}

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  try {
    const usuarios = await listarUsuarios();
    const objetivo = typeof body.id === 'number' ? usuarios.find((u) => u.id === body.id) : undefined;

    switch (body.action) {
      case 'crear': {
        const email = (body.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
        if (usuarios.some((u) => u.email === email)) {
          return NextResponse.json({ ok: false, error: 'Ya existe un usuario con ese email.' }, { status: 400 });
        }
        const rol: Rol = body.rol === 'admin' ? 'admin' : 'usuario';
        const invitadoPor = admin.legacy ? 'admin' : (admin.email || 'admin');
        // Un usuario (no admin) tiene que pertenecer a un workspace.
        const wsId = typeof body.workspace_id === 'number' ? body.workspace_id : null;
        // rol dentro del negocio: admin de agencia → null; usuario-cliente → el
        // rol pedido (default 'admin', el dueño del negocio).
        const rolWs: RolWorkspace | null = rol === 'admin'
          ? null
          : (body.rol_ws && ROLES_WS.includes(body.rol_ws) ? body.rol_ws : 'admin');
        const nuevo = await crearUsuario({ email, nombre: body.nombre, rol, invitado_por: invitadoPor, workspace_id: rol === 'admin' ? null : wsId, rol_ws: rolWs });
        return NextResponse.json({ ok: true, usuario: nuevo });
      }

      case 'workspace': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const wsId = typeof body.workspace_id === 'number' ? body.workspace_id : null;
        // Mover/desasignar al único admin-cliente lo sacaría de su workspace y lo
        // dejaría sin ningún admin de cliente.
        if (wsId !== objetivo.workspace_id && (await dejariaClienteSinAdmin(objetivo))) {
          return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigná otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { workspace_id: wsId }) });
      }

      case 'rolws': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const rolWs = body.rol_ws;
        if (!rolWs || !ROLES_WS.includes(rolWs)) return NextResponse.json({ ok: false, error: 'rol_ws inválido' }, { status: 400 });
        if (objetivo.rol !== 'usuario' || objetivo.workspace_id == null) {
          return NextResponse.json({ ok: false, error: 'El rol de equipo solo aplica a usuarios de un cliente.' }, { status: 400 });
        }
        if (await dejariaClienteSinAdmin(objetivo, rolWs)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigná otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { rol_ws: rolWs }) });
      }

      case 'nombre': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { nombre: (body.nombre ?? '').trim() }) });
      }

      case 'rol': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const rol: Rol = body.rol === 'admin' ? 'admin' : 'usuario';
        if (rol !== 'admin' && (await dejariaSinAdmins(objetivo))) {
          return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigná otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { rol }) });
      }

      case 'estado': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const estado = body.estado;
        if (estado !== 'activo' && estado !== 'suspendido' && estado !== 'invitado') {
          return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
        }
        if (estado === 'suspendido') {
          if (await dejariaSinAdmins(objetivo)) return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigná otro admin antes.' }, { status: 400 });
          if (await dejariaClienteSinAdmin(objetivo)) return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigná otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { estado }) });
      }

      case 'eliminar': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        if (await dejariaSinAdmins(objetivo)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigná otro admin antes.' }, { status: 400 });
        }
        if (await dejariaClienteSinAdmin(objetivo)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin de ese cliente — asigná otro admin antes.' }, { status: 400 });
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
