// =============================================================================
// /api/admin/workspaces — clientes/workspaces (solo admin)
// =============================================================================
// GET  → lista de workspaces + cuántos usuarios tiene cada uno.
// POST → { action: 'crear', nombre } | { action: 'nombre'|'estado', id, ... }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { actualizarWorkspace, crearWorkspace, listarWorkspaces } from '@/lib/workspace';
import { listarUsuarios } from '@/lib/usuarios';

export const dynamic = 'force-dynamic';

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

type Body = { action?: string; id?: number; nombre?: string; estado?: 'activo' | 'pausado' };

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    switch (body.action) {
      case 'crear': {
        const nombre = (body.nombre ?? '').trim();
        if (nombre.length < 2) return NextResponse.json({ ok: false, error: 'Poné un nombre de cliente.' }, { status: 400 });
        return NextResponse.json({ ok: true, workspace: await crearWorkspace(nombre) });
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
