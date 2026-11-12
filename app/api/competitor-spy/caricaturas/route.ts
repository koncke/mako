// =============================================================================
// /api/competitor-spy/caricaturas — las caricaturas de los competidores del negocio, para cambiarlas sin recargar (4/11/2026)
// =============================================================================
// Martín: «para yo poder ver el avatar... sí o sí tengo que refrescar la página, no debería. Eso debería actualizarse solo». La
// caricatura la hace el Runner (lib/spy-caricatura-cola.ts) y queda en `spy.caricaturas`; la pantalla pregunta acá cada pocos
// segundos MIENTRAS alguna está en camino, y deja de preguntar cuando llegan. Es una RUTA y no una server action: las actions van
// de a una, y ésta haría fila detrás de una lectura larga.
//
//   GET → { ok, caras: Array<{ id, caricatura: string | null, pendiente: boolean }> }
//
// (Hasta el 12/11/2026 mandaba también `frenadaDesde` al super admin, para un aviso en la pantalla. Martín lo sacó: «el
// texto innecesario no lo pongas». La espera se mira con `scripts/spy-caricaturas-pendientes.mjs`.)
//
// Sólo lee (la lista del negocio y su registro de caricaturas): no llama a nadie.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { listarCompetidores } from '@/lib/spy';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  // La misma puerta que la pantalla (`requireRolWs([], { nav: 'market-an' })`).
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  const r = await listarCompetidores();
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { headers: { 'Cache-Control': 'no-store' } });
  const caras = r.competidores.map((c) => ({ id: c.id, caricatura: c.caricatura ?? null, pendiente: !!c.caricaturaPendiente }));
  return Response.json({ ok: true, caras }, { headers: { 'Cache-Control': 'no-store' } });
}
