import 'server-only';

// =============================================================================
// leads-bajas — borrar un lead diciendo por qué camino, y leer lo que se borró (mig 0356)
// =============================================================================
// «Eliminar» manda a la papelera (lib/leads-papelera.ts). Los ÚNICOS dos que borran sin pasar por ella pasan por acá, y
// tests/crm-leads-bajas.test.ts barre el repo para que no aparezca un tercero:
//   · `unificar`: todo lo que colgaba ya se mudó a la ficha que queda. Recuperarla devolvería una ficha duplicada y vacía.
//   · `zernio_duplicado`: nació segundos antes y perdió la carrera contra otro evento de la misma persona. Nadie lo vio.
//
// El renglón lo escribe un trigger de la base, así que un camino que no pase por acá igual queda anotado (sin decir cuál).

import { getTenantDb } from './workspace';
import { AVISO_DESDE_CUANDO, agruparBajas, type FilaBaja, type RenglonBaja } from './leads-bajas-reglas';

type Db = Awaited<ReturnType<typeof getTenantDb>>;

/**
 * Borra UN lead de `ws` anotando el camino y quién. Si la función no contesta, borra igual: el registro nunca frena un borrado,
 * y el trigger lo anota de todos modos, como `sin_camino`.
 */
export async function borrarLeadConCamino(db: Db, ws: number, id: number, camino: 'unificar' | 'zernio_duplicado', por: string): Promise<{ error: { message: string } | null }> {
  const { error } = await db.rpc('borrar_lead_anotado', { p_ws: ws, p_id: id, p_camino: camino, p_por: por });
  if (!error) return { error: null };
  console.warn(`[leads-bajas] sin el camino para el lead ${id}: ${error.message}`);
  return db.from('leads').delete().eq('id', id).eq('workspace_id', ws);
}

/** Lo que se borró en este negocio, de lo más nuevo a lo más viejo, o lo que pasó con UN lead. */
export async function leerBajasDeLeads(o: { leadId?: number | null; limite?: number } = {}): Promise<{ renglones: RenglonBaja[]; aviso: string }> {
  const db = await getTenantDb();
  let q = db.from('leads_bajas').select('at, cuantos, lead_ids, camino, por, rol, app').order('at', { ascending: false }).limit(o.limite ?? 500);
  if (o.leadId) q = q.contains('lead_ids', [o.leadId]);
  const { data, error } = await q;
  if (error) throw new Error(`No pude leer lo que se borró: ${error.message}`);
  const filas = ((data ?? []) as FilaBaja[]).map((f) => ({ ...f, cuantos: Number(f.cuantos), lead_ids: (f.lead_ids ?? []).map(Number) }));
  return { renglones: agruparBajas(filas), aviso: AVISO_DESDE_CUANDO };
}
