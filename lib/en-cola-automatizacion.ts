// =============================================================================
// en-cola-automatizacion — cuántos esperan en cada tarjeta de UNA automatización y por qué no les sale
// =============================================================================
// La lectura del chip del lienzo («2 esperando · Sale mañana 9:00», app/api/flujos/en-cola) y de la API de MaKo
// (`espera_por_tarjeta`, 10/11/2026), en UN lugar: lo puro vive en lib/en-cola-por-paso.ts y lib/por-que-no-sale.ts, y lo del
// negocio sale con las MISMAS lecturas que la ficha del lead (lib/por-que-no-sale-db.ts). Si lo del negocio no se puede leer,
// `enColaPorPaso` devuelve vacío: sin chip, nunca un motivo inventado. Una automatización que no es del negocio no existe
// (`getTenantDb` filtra por el workspace).
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { frenosDelNegocio } from '@/lib/por-que-no-sale-db';
import { enColaPorPaso, type EnColaDelPaso } from '@/lib/en-cola-por-paso';
import type { FilaAutomatizacion, FilaInscripcion } from '@/lib/automatizaciones-del-lead-reglas';

export type EnColaDeAutomatizacion = { automatizacion: FilaAutomatizacion; porPaso: Record<string, EnColaDelPaso> } | null;

/** null = esa automatización no es de este negocio. TIRA si no se pudo leer (quien llama dice «no pude leer»). */
export async function enColaDeAutomatizacion(id: number): Promise<EnColaDeAutomatizacion> {
  const db = await getTenantDb();
  const [{ data: sec, error: eS }, { data: filas, error: eF }] = await Promise.all([
    db.from('nutricion_secuencias').select('id, nombre, activa, archivada_at, pasos, instance_name').eq('id', id).maybeSingle(),
    db.from('nutricion_inscripciones').select('id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, proximo_envio_at').eq('secuencia_id', id).eq('estado', 'activa').limit(2000),
  ]);
  if (eS || eF) throw new Error(`supabase: ${(eS ?? eF)?.message}`);
  if (!sec) return null;
  const automatizacion = sec as FilaAutomatizacion;
  const vivas = (filas ?? []) as FilaInscripcion[];
  return { automatizacion, porPaso: enColaPorPaso(vivas, automatizacion, await frenosDelNegocio(vivas, [automatizacion])) };
}
