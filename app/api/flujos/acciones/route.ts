// =============================================================================
// GET /api/flujos/acciones — las acciones de MaKo que un paso de un flujo puede correr
// =============================================================================
// Lo piden los dos lienzos (las secuencias de /automations y los avisos de /mensajes) para
// armar el paso «⚡ Acción»: qué operaciones hay, por área, con sus parámetros. Se arma en
// el server (`accionesParaFlujo`, lib/api-mako/flujo.ts) porque el registro no se importa
// desde un componente cliente. Sólo el admin del workspace: lo que configura corre solo.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { accionesParaFlujo } from '@/lib/api-mako/flujo';

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null) return Response.json({ ok: false, error: 'Entra al workspace de un cliente para ver sus acciones.' }, { status: 400 });
  if (rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace configura acciones.' }, { status: 403 });
  try {
    return Response.json({ ok: true, acciones: await accionesParaFlujo(ws) });
  } catch (e) {
    console.error('[api/flujos/acciones]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: 'No se pudieron leer las acciones.' }, { status: 500 });
  }
}
