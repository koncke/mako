import 'server-only';

// =============================================================================
// automatizacion-quienes — quiénes son los números de las Métricas (31/10/2026)
// =============================================================================
// Leila (30/10): que «respondieron 8» se pueda tocar y muestre quiénes, para seguirlos. Con el MISMO criterio que el número
// (`ESTADOS_RESPONDIO`, lib/graficos-datos-puro.ts; `en_curso`, lib/graficos-datos.ts) y en el período con que abre la hoja (`ult30`).
// =============================================================================

import { getTenantDb } from './workspace';
import { ESTADOS_RESPONDIO } from './graficos-datos-puro';

export const QUIENES = ['respondieron', 'en_curso', 'entraron'] as const;
export type Quienes = (typeof QUIENES)[number];
export const esQuienes = (v: unknown): v is Quienes => typeof v === 'string' && (QUIENES as readonly string[]).includes(v);

/** ¿Esta inscripción cuenta en ese número? La misma regla que la fuente del Dashboard. */
export function cuentaEn(cual: Quienes, estado: string | null | undefined): boolean {
  if (cual === 'respondieron') return ESTADOS_RESPONDIO.has(String(estado ?? ''));
  if (cual === 'en_curso') return estado === 'activa' || estado === 'pausada';
  return true;
}

export type FilaQuienes = { leadId: number; nombre: string; telefono: string | null; cuando: string | null };
export const TOPE_QUIENES = 500;
const DIAS = 30;

/** Tira si no puede leer: «no pude» no es «nadie». `total` cuenta aunque la lista llegue hasta el tope. */
export async function quienesDeAutomatizacion(secuenciaId: number, cual: Quienes, ahoraMs = Date.now()): Promise<{ total: number; filas: FilaQuienes[] }> {
  const db = await getTenantDb();
  const desde = new Date(ahoraMs - DIAS * 86_400_000).toISOString();
  const { data, error } = await db.from('nutricion_inscripciones').select('lead_id, estado, inscripto_at, updated_at')
    .eq('secuencia_id', secuenciaId).gte('inscripto_at', desde).order('inscripto_at', { ascending: false }).limit(5000);
  if (error) throw new Error(`No pude leer quiénes son: ${error.message}`);
  const elegidas = ((data ?? []) as Array<{ lead_id: number | null; estado: string | null; inscripto_at: string | null; updated_at: string | null }>)
    .filter((f) => f.lead_id != null && cuentaEn(cual, f.estado));
  const ids = [...new Set(elegidas.map((f) => Number(f.lead_id)))];
  const leads = new Map<number, { nombre: string | null; telefono: string | null }>();
  const aMostrar = ids.slice(0, TOPE_QUIENES);
  for (let i = 0; i < aMostrar.length; i += 200) {
    const { data: l, error: e } = await db.from('leads').select('id, nombre, telefono').in('id', aMostrar.slice(i, i + 200));
    if (e) throw new Error(`No pude leer quiénes son: ${e.message}`);
    for (const x of (l ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null }>) leads.set(Number(x.id), x);
  }
  const vistos = new Set<number>();
  const filas: FilaQuienes[] = [];
  for (const f of elegidas) {
    const id = Number(f.lead_id);
    const lead = leads.get(id);
    if (vistos.has(id) || !lead) continue;
    vistos.add(id);
    filas.push({ leadId: id, nombre: lead.nombre?.trim() || 'Sin nombre', telefono: lead.telefono, cuando: cual === 'respondieron' ? f.updated_at : f.inscripto_at });
  }
  return { total: ids.length, filas };
}
