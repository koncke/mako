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
  actualizarUsuario, contarAdminsActivos, crearUsuario, eliminarUsuario,
  listarUsuarios, type EstadoUsuario, type Usuario,
} from '@/lib/usuarios';
import { origenCredencial } from '@/lib/credenciales';
import { SERVICIOS_METODO } from '@/lib/metodo-catalogo';
import { getAnswers, getSchema } from '@/lib/onboarding';
import { listarWorkspaces } from '@/lib/workspace';
import type { Rol } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Estado por servicio del catálogo, mirando el process.env ya hidratado.
function resumenIntegraciones() {
  const porServicio = SERVICIOS_METODO.map((s) => {
    const requeridos = s.campos.filter((c) => !c.opcional);
    // Todos opcionales → conectado exige al menos un campo con valor.
    const conectada = requeridos.length > 0
      ? requeridos.every((c) => origenCredencial(c.env))
      : s.campos.some((c) => origenCredencial(c.env));
    return { key: s.key, nombre: s.nombre, core: s.core ?? false, conectada };
  });
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
    const [usuarios, workspaces, perfilNegocio] = await Promise.all([
      listarUsuarios(), listarWorkspaces(), resumenPerfilNegocio(),
    ]);
    return NextResponse.json({
      ok: true,
      usuarios,
      workspaces,
      resumen: { integraciones: resumenIntegraciones(), perfilNegocio },
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
  estado?: EstadoUsuario;
  workspace_id?: number | null;
};

// true si tocar (bajar de rol / suspender / borrar) a este usuario dejaría el
// workspace sin ningún admin activo.
async function dejariaSinAdmins(u: Usuario): Promise<boolean> {
  if (u.rol !== 'admin' || u.estado === 'suspendido') return false;
  return (await contarAdminsActivos()) <= 1;
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
        const nuevo = await crearUsuario({ email, nombre: body.nombre, rol, invitado_por: invitadoPor, workspace_id: rol === 'admin' ? null : wsId });
        return NextResponse.json({ ok: true, usuario: nuevo });
      }

      case 'workspace': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        const wsId = typeof body.workspace_id === 'number' ? body.workspace_id : null;
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { workspace_id: wsId }) });
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
        if (estado === 'suspendido' && (await dejariaSinAdmins(objetivo))) {
          return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigná otro admin antes.' }, { status: 400 });
        }
        return NextResponse.json({ ok: true, usuario: await actualizarUsuario(objetivo.id, { estado }) });
      }

      case 'eliminar': {
        if (!objetivo) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 });
        if (await dejariaSinAdmins(objetivo)) {
          return NextResponse.json({ ok: false, error: 'Es el único admin activo — asigná otro admin antes.' }, { status: 400 });
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
