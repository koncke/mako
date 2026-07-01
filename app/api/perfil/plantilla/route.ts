// =============================================================================
// /api/perfil/plantilla — estado + alta de la plantilla de WhatsApp "reporte_mako"
// =============================================================================
// GET  → estado real en Meta (approved | pending | rejected | ausente | error).
// POST → crea el borrador y lo manda a aprobar a Meta (idempotente).
// =============================================================================

import { estadoPlantillaReporte, asegurarPlantillaReporte } from '@/lib/reporte-template';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const e = await estadoPlantillaReporte();
  return Response.json({ ok: e.estado !== 'error', ...e });
}

export async function POST() {
  const r = await asegurarPlantillaReporte();
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
