// =============================================================================
// api-mako/areas/general.helpers — lo que el área `general` necesita y no exporta lib/
// =============================================================================
// Dos cosas, y las dos son DEUDA con lib/objectives.ts:
//
//  1. El SANEO de un objetivo y de un KPI vive SOLO en app/general/actions.ts
//     (guardarObjectiveAction / guardarKpiAction): upsertObjective y upsertKpi
//     guardan lo que reciben. Una métrica fuera del set o un fuenteId inventado
//     quedan escritos y la pantalla contesta «métrica/fuente desconocida» para
//     siempre. Se copió aquí la MISMA regla; el día que exista
//     validarObjectiveInput/validarKpiInput en lib, esto se borra y se usa aquello.
//  2. Lecturas por id que lib no tiene: no existe getObjective(id) (listObjectives
//     solo trae los ACTIVOS del Q) ni una lectura de un registro de KPI puntual.
//
// Todo pasa por getTenantDb(): corre adentro de runWithWorkspace(ctx.ws).
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { fuenteKpi, type MetricaObjetivo, type UnidadObjetivo, type Cadencia, type FuenteKpi } from '@/lib/objectives-modelo';

export const METRICAS_OBJETIVO: readonly MetricaObjetivo[] = ['cash_usd', 'sold_usd', 'cierres', 'agendas', 'leads', 'libre'];

export type ObjetivoFila = {
  id: string; anio: number; quarter: number | null; titulo: string; metrica: string; meta_valor: number;
  unidad: string; avance_manual: number | null; orden: number | null; origen: string | null; estado: string;
};

/** Un objetivo por id, ACTIVO o CERRADO (listObjectives solo trae los activos). Trae la
 *  fila COMPLETA: editar parte de ella y completa lo omitido con lo que ya está, incluidos
 *  orden y origen (upsertObjective los pisa con Date.now() y 'user' si no viajan). */
export async function objetivoPorId(id: string): Promise<ObjetivoFila | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('objectives')
    .select('id, anio, quarter, titulo, metrica, meta_valor, unidad, avance_manual, orden, origen, estado').eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: objetivoPorId falló: ${error.message}`);
  return (data as ObjetivoFila | null) ?? null;
}

/** El valor ya registrado de un KPI en la clave de un período, o null si no hay fila. */
export async function registroKpiExistente(kpiId: string, clave: string): Promise<number | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('kpi_registros')
    .select('valor').eq('kpi_id', kpiId).eq('fecha', clave).maybeSingle();
  if (error) throw new Error(`api-mako: registroKpiExistente falló: ${error.message}`);
  if (!data) return null;
  const n = Number((data as { valor: unknown }).valor);
  return Number.isFinite(n) ? n : null;
}

/** El saneo de guardarObjectiveAction, sin el guard ni el bust (eso lo pone el registro). */
export function sanearObjetivo(input: { anio: number; quarter: number; metrica: string; metaValor: number; avanceManual?: number | null }) {
  const metrica: MetricaObjetivo = (METRICAS_OBJETIVO as readonly string[]).includes(input.metrica)
    ? (input.metrica as MetricaObjetivo)
    : 'cash_usd';
  const unidad: UnidadObjetivo = metrica === 'cash_usd' || metrica === 'sold_usd' ? 'usd' : 'cantidad';
  // En el registro `quarter: 0` es ANUAL (el validador no admite null).
  const quarter = input.quarter === 0 ? null : Math.max(1, Math.min(4, Math.trunc(input.quarter)));
  return {
    anio: Math.trunc(input.anio),
    quarter,
    metrica,
    unidad,
    metaValor: Math.max(0, Number(input.metaValor) || 0),
    avanceManual: metrica === 'libre' ? (input.avanceManual ?? null) : null,
  };
}

/** El saneo de guardarKpiAction: fuente fuera del catálogo → manual, umbrales ordenados.
 *  (En la API la fuente fuera del catálogo no llega: fuenteId tiene enum y el validador
 *  contesta 400 antes. La rama queda por la paridad con la server action.) */
export function sanearKpi(input: { cadencia: string; fuente: string; fuenteId?: string | null; unidad?: string; compromiso: number; umbralVerde?: number; umbralAmbar?: number }) {
  const cadencia: Cadencia = input.cadencia === 'diaria' ? 'diaria' : 'semanal';
  const pedida: FuenteKpi = input.fuente === 'auto' ? 'auto' : 'manual';
  const def = pedida === 'auto' ? fuenteKpi(input.fuenteId) : undefined;
  const fuente: FuenteKpi = pedida === 'auto' && def ? 'auto' : 'manual';
  const unidad: UnidadObjetivo = def ? def.unidad : input.unidad === 'usd' ? 'usd' : 'cantidad';
  const umbralVerde = Math.max(1, Math.min(200, input.umbralVerde ?? 100));
  const umbralAmbar = Math.max(1, Math.min(umbralVerde, input.umbralAmbar ?? 70));
  return {
    cadencia, fuente, unidad, umbralVerde, umbralAmbar,
    fuenteId: fuente === 'auto' ? (input.fuenteId ?? null) : null,
    compromiso: Math.max(0, Number(input.compromiso) || 0),
  };
}
