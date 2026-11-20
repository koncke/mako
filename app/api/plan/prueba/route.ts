// =============================================================================
// GET /api/plan/prueba — la prueba gratis del negocio en un vistazo (25/10/2026)
// =============================================================================
// Lo leen el cartel de la versión de prueba (al pie de la barra lateral, app/_components/CartelPrueba.tsx) y la franja de
// cada pantalla con tope (app/_ui/FranjaPrueba.tsx): cuántos días quedan, qué se cobra después y cuánto usó de cada tope
// (lib/prueba-uso.ts, `resumenDePrueba`). Cualquiera del negocio lo ve, como Madgicx: es el estado de la cuenta, no un dato
// suyo. Sin sesión o fuera de la prueba: `{ enPrueba: false }` (y el cartel no se dibuja).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { resumenDePrueba } from '@/lib/prueba-uso';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getUsuarioActual().catch(() => null);
  if (!s || s.legacy) return Response.json({ enPrueba: false });
  // El negocio que se MIRA, no el propio de quien inició sesión (20/11/2026, la llamada con Leila: «en la sidebar no estoy viendo
  // versión de prueba de siete días»). `s.ws` es el negocio de la sesión; mirando un cliente como administrador (el `?ws=` de la
  // pestaña, que suma WsFetch y valida el proxy), es el del cliente. Para un cliente en su cuenta, los dos son el mismo.
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return Response.json({ enPrueba: false });
  return Response.json(await resumenDePrueba(ws).catch(() => ({ enPrueba: false })));
}
