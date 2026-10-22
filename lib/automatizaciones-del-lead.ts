// =============================================================================
// automatizaciones-del-lead — en qué automatizaciones está un lead (o varios) y frenarlo en una
// =============================================================================
// Martín, 22/10/2026 (por el Cerebro, la campaña del Sprint de Mauricio): «en el CRM debería indicar en la tarjeta o en algún
// lugar que esos leads están en una automatización activa, y que desde el CRM también se pueda frenar». La pantalla es del
// CRM (app/crm); acá la lectura y la escritura, lo puro en lib/automatizaciones-del-lead-reglas.ts, y las acciones en
// app/automations/automatizaciones-del-lead-actions.ts.
//
//   · `enAutomatizaciones(leadIds)`: UNA consulta por tablero (el aviso en cada tarjeta). Sólo inscripciones VIVAS ('activa',
//     o 'respondio': frenada porque contestó) de automatizaciones sin archivar; una pausada viene con
//     `automatizacionActiva: false` (el lead quedó congelado en su paso: lib/nutricion.ts, `idsDePausadas`).
//   · `frenarEnAutomatizacion`: el mismo núcleo que la operación de la API `sacar_lead_de_secuencia` (`sacarDeSecuencia`,
//     que también descarta sus borradores pendientes): no le sale nada más, y no se vuelve a abrir sola.
// =============================================================================
import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { sacarDeSecuencia } from '@/lib/nutricion-salida-manual';
import { enAutomatizacionesDe, textoDeFrenar, ESTADOS_VIVOS, type EnAutomatizacion, type FilaInscripcion, type FilaAutomatizacion } from '@/lib/automatizaciones-del-lead-reglas';

export type { EnAutomatizacion };

/** Cuántos leads se consultan de una vez (un tablero del CRM). */
export const TOPE_LEADS = 500;

/** Las automatizaciones VIVAS de cada lead (sólo aparecen los que están en alguna). Tira si no puede leer. */
export async function enAutomatizaciones(leadIds: readonly number[]): Promise<Map<number, EnAutomatizacion[]>> {
  const ids = [...new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, TOPE_LEADS);
  if (!ids.length) return new Map();
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_inscripciones')
    .select('lead_id, secuencia_id, estado, paso_actual, nodo_actual, proximo_envio_at')
    .in('lead_id', ids).in('estado', [...ESTADOS_VIVOS]);
  if (error) throw new Error(`automatizaciones del lead: ${error.message}`);
  const filas = (data ?? []) as FilaInscripcion[];
  const secIds = [...new Set(filas.map((f) => Number(f.secuencia_id)))];
  if (!secIds.length) return new Map();
  const { data: secs, error: eSecs } = await db.from('nutricion_secuencias')
    .select('id, nombre, activa, archivada_at, pasos').in('id', secIds);
  if (eSecs) throw new Error(`automatizaciones del lead (automatizaciones): ${eSecs.message}`);
  return enAutomatizacionesDe(filas, (secs ?? []) as FilaAutomatizacion[]);
}

/** Saca al lead de UNA automatización: no le sale nada más. El texto es para la persona. */
export async function frenarEnAutomatizacion(leadId: number, secuenciaId: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  return textoDeFrenar(await sacarDeSecuencia(leadId, secuenciaId));
}

/**
 * FRENAR VARIOS DE UNA (la barra de lote del CRM, 22/10/2026): saca a los leads tildados de UNA automatización, o de TODAS
 * sus automatizaciones vivas si no se dice cuál. UNA escritura sobre las inscripciones vivas (no N llamadas: con 50 tildados
 * eran lentas y dejaban el lote a medias si una fallaba), y sus borradores pendientes descartados, como `sacarDeSecuencia`.
 * Una fila que otra corrida movió entre medio ya no está viva y no se toca. Tira si no puede escribir.
 */
export async function frenarLeadsEnAutomatizaciones(leadIds: readonly number[], secuenciaId?: number | null): Promise<{ pedidos: number; frenados: number; nombre: string | null }> {
  const ids = [...new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, TOPE_LEADS);
  const db = await getTenantDb();
  let nombre: string | null = null;
  if (secuenciaId != null) {
    const { data: sec, error: eSec } = await db.from('nutricion_secuencias').select('nombre').eq('id', secuenciaId).maybeSingle();
    if (eSec) throw new Error(`frenar (automatización): ${eSec.message}`);
    if (!sec) throw new Error('Esa automatización no existe en este negocio.');
    nombre = String((sec as { nombre?: unknown }).nombre ?? '').trim() || `Automatización #${secuenciaId}`;
  }
  if (!ids.length) return { pedidos: 0, frenados: 0, nombre };
  let q = db.from('nutricion_inscripciones')
    .update({ estado: 'cancelada', proximo_envio_at: null, updated_at: new Date().toISOString() })
    .in('lead_id', ids).in('estado', [...ESTADOS_VIVOS]);
  if (secuenciaId != null) q = q.eq('secuencia_id', secuenciaId);
  const { data, error } = await q.select('lead_id, secuencia_id');
  if (error) throw new Error(`frenar: ${error.message}`);
  const filas = (data ?? []) as Array<{ lead_id: number; secuencia_id: number }>;
  // Sus borradores pendientes, por automatización (lo que esperaba aprobación tampoco sale).
  const porSec = new Map<number, number[]>();
  for (const f of filas) porSec.set(Number(f.secuencia_id), [...(porSec.get(Number(f.secuencia_id)) ?? []), Number(f.lead_id)]);
  for (const [sec, leads] of porSec) {
    const { error: eBorr } = await db.from('wa_borradores').update({ estado: 'descartado' })
      .in('lead_id', leads).eq('secuencia_id', sec).eq('estado', 'pendiente');
    if (eBorr) console.error(`[automatizaciones-del-lead] no pude descartar los borradores de la automatización ${sec}: ${eBorr.message}`);
  }
  const frenados = new Set(filas.map((f) => Number(f.lead_id))).size;
  console.log(`[automatizaciones-del-lead] frené ${frenados} de ${ids.length} leads${secuenciaId != null ? ` en la automatización ${secuenciaId}` : ' en todas sus automatizaciones'}`);
  return { pedidos: ids.length, frenados, nombre };
}
