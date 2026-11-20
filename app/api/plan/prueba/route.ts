// =============================================================================
// GET /api/plan/prueba — la prueba gratis del negocio en un vistazo (25/10/2026)
// =============================================================================
// Lo leen el cartel de la versión de prueba (al pie de la barra lateral, app/_components/CartelPrueba.tsx) y la franja de
// cada pantalla con tope (app/_ui/FranjaPrueba.tsx): cuántos días quedan, qué se cobra después y cuánto usó de cada tope
// (lib/prueba-uso.ts, `resumenDePrueba`). Cualquiera del negocio lo ve, como Madgicx: es el estado de la cuenta, no un dato
// suyo. Sin sesión o fuera de la prueba: `{ enPrueba: false }` (y el cartel no se dibuja).
//
// EL NEGOCIO QUE SE ESTÁ MIRANDO (20/11/2026, la llamada con Leila, 00:40:00: «en la sidebar no estoy viendo versión de prueba de
// siete días»). Leía `s.ws`, el negocio PROPIO de quien inició sesión: mirando a un cliente como administrador (el `?ws=` de la
// pestaña, que app/_components/WsFetch.tsx suma a cada /api) o como agencia, el cartel era el de su propia cuenta. Ahora es el del
// pedido (`getWorkspaceActual`), el mismo que muestra el resto de la pantalla.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { resumenDePrueba } from '@/lib/prueba-uso';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getUsuarioActual().catch(() => null);
  if (!s || s.legacy) return Response.json({ enPrueba: false });
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return Response.json({ enPrueba: false });
  return Response.json(await resumenDePrueba(ws).catch(() => ({ enPrueba: false })));
}
