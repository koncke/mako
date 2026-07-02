// =============================================================================
// /api/admin/workspaces — clientes/workspaces (solo admin)
// =============================================================================
// GET  → lista de workspaces + cuántos usuarios tiene cada uno.
// POST → { action: 'crear', nombre } | { action: 'nombre'|'estado', id, ... }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { actualizarWorkspace, crearWorkspace, listarWorkspaces } from '@/lib/workspace';
import { crearUsuario, listarUsuarios } from '@/lib/usuarios';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const [workspaces, usuarios] = await Promise.all([listarWorkspaces(), listarUsuarios()]);
    const conteo = new Map<number, number>();
    for (const u of usuarios) if (u.workspace_id != null) conteo.set(u.workspace_id, (conteo.get(u.workspace_id) ?? 0) + 1);
    return NextResponse.json({
      ok: true,
      workspaces: workspaces.map((w) => ({ ...w, usuarios: conteo.get(w.id) ?? 0 })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

type Body = { action?: string; id?: number; nombre?: string; estado?: 'activo' | 'pausado'; adminEmail?: string; adminNombre?: string };

export async function POST(req: NextRequest) {
  const admin = await getSesionAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    switch (body.action) {
      case 'crear': {
        const nombre = (body.nombre ?? '').trim();
        if (nombre.length < 2) return NextResponse.json({ ok: false, error: 'Poné un nombre de cliente.' }, { status: 400 });
        const adminEmail = (body.adminEmail ?? '').trim().toLowerCase();
        // Si viene un email de admin, validarlo y chequear que no exista ANTES de
        // crear el workspace (evita dejar un workspace huérfano por un email dup).
        if (adminEmail) {
          if (!EMAIL_RE.test(adminEmail)) return NextResponse.json({ ok: false, error: 'Email del admin inválido.' }, { status: 400 });
          const existe = (await listarUsuarios()).some((u) => u.email === adminEmail);
          if (existe) return NextResponse.json({ ok: false, error: 'Ya existe un usuario con ese email.' }, { status: 400 });
        }
        const ws = await crearWorkspace(nombre);
        // Crear el usuario admin-del-cliente en el mismo paso. Si falla, revertir
        // el workspace para no dejar basura.
        if (adminEmail) {
          try {
            const invitadoPor = admin.legacy ? 'admin' : (admin.email || 'admin');
            await crearUsuario({ email: adminEmail, nombre: body.adminNombre, rol: 'usuario', rol_ws: 'admin', workspace_id: ws.id, invitado_por: invitadoPor });
          } catch (e) {
            await getSupabaseServer().from('workspaces').delete().eq('id', ws.id);
            return NextResponse.json({ ok: false, error: `No se pudo crear el admin del cliente: ${e instanceof Error ? e.message : e}` }, { status: 500 });
          }
        }
        return NextResponse.json({ ok: true, workspace: ws });
      }
      case 'nombre': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        return NextResponse.json({ ok: true, workspace: await actualizarWorkspace(body.id, { nombre: (body.nombre ?? '').trim() }) });
      }
      case 'estado': {
        if (typeof body.id !== 'number') return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
        if (body.estado !== 'activo' && body.estado !== 'pausado') return NextResponse.json({ ok: false, error: 'estado inválido' }, { status: 400 });
        return NextResponse.json({ ok: true, workspace: await actualizarWorkspace(body.id, { estado: body.estado }) });
      }
      default:
        return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
