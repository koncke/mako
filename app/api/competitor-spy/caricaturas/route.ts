// =============================================================================
// /api/competitor-spy/caricaturas — las caricaturas de los competidores del negocio, para cambiarlas sin recargar (4/11/2026)
// =============================================================================
// Martín: «para yo poder ver el avatar... sí o sí tengo que refrescar la página, no debería. Eso debería actualizarse solo». La
// caricatura la hace el Runner (lib/spy-caricatura-cola.ts) y queda en `spy.caricaturas`; la pantalla pregunta acá cada pocos
// segundos MIENTRAS alguna está en camino, y deja de preguntar cuando llegan. Es una RUTA y no una server action: las actions van
// de a una, y ésta haría fila detrás de una lectura larga.
//
//   GET → { ok, caras: Array<{ id, caricatura: string | null, pendiente: boolean }>, frenadaDesde?: string }
//
// `frenadaDesde` (6/11/2026) es SÓLO para el super admin: desde cuándo espera la pendiente más vieja, si ya pasó
// `COLA_FRENADA_MS`. Una cola frenada no dejaba rastro en ninguna pantalla —la tarjeta sigue diciendo «Haciendo su
// caricatura…» para siempre— y la única forma de verlo era un comando a mano.
//
// Sólo lee (la lista del negocio y su registro de caricaturas): no llama a nadie.
// =============================================================================

import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { colaFrenadaDesde } from '@/lib/spy-caricatura-reglas';
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
  // Sólo al super admin: el Runner es nuestro, y a un cliente «la cola está frenada» no le dice nada que pueda hacer.
  const frenadaDesde = (await getSesionAdmin().catch(() => null)) ? colaFrenadaDesde(r.caricaturasDesde, Date.now()) : null;
  return Response.json({ ok: true, caras, ...(frenadaDesde ? { frenadaDesde } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}
