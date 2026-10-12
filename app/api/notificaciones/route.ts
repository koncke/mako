// =============================================================================
// /api/notificaciones — el feed de «Avisos» del workspace (Inbox de MaKo Mobile)
// =============================================================================
// GET  ?limit=N&antes=<iso> → { items, noVistas, vistoHasta }
// POST { action: 'visto', hasta?: <iso> } → corre la marca de agua de ESTA persona
//      { action: 'marcar_todas' }          → lo mismo, hasta ahora
//
// ⚠️ EL WORKSPACE ES EL DEL REQUEST (`getWorkspaceActual`, que valida el `?ws=` de la pestaña
// contra la sesión): un super admin mirando a un cliente ve el feed de ese cliente. Hasta el
// 11/10/2026 esta ruta contestaba sólo al ws1 (`esWorkspaceDueno`) porque la tabla no tenía
// workspace; con la mig 0250 cada fila tiene el suyo.
//
// ⚠️ EL LEÍDO ES DE LA PERSONA y por workspace (lib/perfil.ts, `notifVistoHasta`): lo que
// marca un admin no se le apaga a su equipo, y lo que marca el super admin mirando un cliente
// no le apaga sus propios avisos. Ya no existe «marcar UNA»: con marca de agua, ver es ver
// hasta un momento.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo } from '@/lib/workspace';
import { listNotificaciones, contarNoVistas } from '@/lib/notificaciones';
import { getNotifVistoHasta, setNotifVistoHasta } from '@/lib/perfil';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  const ws = await getWorkspaceActual();
  // Los avisos hablan del negocio entero (adeudos, cuotas con montos, reportes): en escritorio
  // son de admin, y un closer o setter no los lee por acá. Vacío y no 403: la pantalla no se rompe.
  if (!ws || (await getRolWsEfectivo()) !== 'admin') return Response.json({ ok: true, items: [], noVistas: 0, vistoHasta: null });
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '30');
  const limite = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 30;
  const antesDe = req.nextUrl.searchParams.get('antes');
  const vistoHasta = await getNotifVistoHasta(ws);
  const [items, noVistas] = await Promise.all([
    listNotificaciones(ws, { limite, antesDe }),
    contarNoVistas(ws, vistoHasta),
  ]);
  // `noVistas: null` = no se pudo contar: la pantalla no dibuja un cero que no midió.
  return Response.json({ ok: true, items, noVistas, vistoHasta });
}

export async function POST(req: NextRequest) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  const ws = await getWorkspaceActual();
  if (!ws) return Response.json({ ok: false, error: 'sin workspace' }, { status: 400 });
  if ((await getRolWsEfectivo()) !== 'admin') return Response.json({ ok: false, error: 'sólo admin' }, { status: 403 });
  let body: { action?: string; hasta?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  try {
    if (body.action === 'visto' || body.action === 'marcar_todas') {
      const r = await setNotifVistoHasta(ws, body.action === 'visto' ? body.hasta ?? null : null);
      return Response.json({ ok: true, ...r });
    }
    return Response.json({ ok: false, error: 'acción no reconocida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
