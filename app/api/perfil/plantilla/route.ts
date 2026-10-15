// =============================================================================
// /api/perfil/plantilla — estado + alta de la plantilla de WhatsApp "reporte_mako"
// =============================================================================
// GET  → estado real en Meta (approved | pending | rejected | ausente | error).
// POST → crea el borrador y lo manda a aprobar a Meta (idempotente).
// =============================================================================

import { estadoPlantillaReporte, asegurarPlantillaReporte } from '@/lib/reporte-template';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';

// ⚠️ SÓLO ADMIN (auditoría de seguridad, 14/10/2026), como su hermana /api/perfil: el proxy sólo pide
// sesión, y un closer o setter creaba la plantilla del negocio y la mandaba a aprobar a Meta.
async function noEsAdmin(): Promise<boolean> {
  return (await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin';
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (await noEsAdmin()) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const e = await estadoPlantillaReporte();
  return Response.json({ ok: e.estado !== 'error', ...e });
}

export async function POST() {
  if (await noEsAdmin()) return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const r = await asegurarPlantillaReporte();
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
