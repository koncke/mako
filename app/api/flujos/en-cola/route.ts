// =============================================================================
// GET /api/flujos/en-cola?sec=<id> — cuántos esperan en cada tarjeta y por qué no les sale (23/10/2026, P0 de #289)
// =============================================================================
// Lo pide el lienzo de Automations para el chip de cada tarjeta («2 esperando · Sale mañana 9:00», con el porqué entero
// al pasar). Lo puro en lib/en-cola-por-paso.ts y lib/por-que-no-sale.ts; lo del negocio, con las MISMAS lecturas que la
// ficha del lead (lib/por-que-no-sale-db.ts). Sólo el admin del workspace, como las otras rutas del lienzo. Si lo del
// negocio no se puede leer, vuelve vacío: sin chip, nunca un motivo inventado.
// =============================================================================

import { getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { frenosDelNegocio } from '@/lib/por-que-no-sale-db';
import { enColaPorPaso } from '@/lib/en-cola-por-paso';
import type { FilaAutomatizacion, FilaInscripcion } from '@/lib/automatizaciones-del-lead-reglas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null) return Response.json({ ok: false, error: 'Entra al workspace de un cliente.' }, { status: 400 });
  if (rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const id = Number(new URL(req.url).searchParams.get('sec'));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta la automatización.' }, { status: 400 });
  try {
    const db = await getTenantDb();
    const [{ data: sec, error: eS }, { data: filas, error: eF }] = await Promise.all([
      db.from('nutricion_secuencias').select('id, nombre, activa, archivada_at, pasos, instance_name').eq('id', id).maybeSingle(),
      db.from('nutricion_inscripciones').select('id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, proximo_envio_at').eq('secuencia_id', id).eq('estado', 'activa').limit(2000),
    ]);
    if (eS || eF) throw new Error((eS ?? eF)?.message);
    if (!sec) return Response.json({ ok: false, error: 'Esa automatización no es de este negocio.' }, { status: 404 });
    const automatizacion = sec as FilaAutomatizacion;
    const vivas = (filas ?? []) as FilaInscripcion[];
    return Response.json({ ok: true, porPaso: enColaPorPaso(vivas, automatizacion, await frenosDelNegocio(vivas, [automatizacion])) });
  } catch (e) {
    console.error('[api/flujos/en-cola]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: 'No pude leer quién espera.' }, { status: 500 });
  }
}
