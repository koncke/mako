// =============================================================================
// api-mako/areas/experimentos.helpers — la medición de UN experimento
// =============================================================================
// DEUDA, a propósito y escrita: `medir()` de lib/experimentos.ts no está exportada
// (es un cambio de una línea allá, fuera del alcance de esta área). La única
// medición en vivo exportada es getExperimentosView(), que mide TODOS los activos
// (2 ventanas + una serie de hasta 21 tramos de getMarketingWindow por cada uno):
// con varios activos se pasa del maxDuration de 60 s de la ruta HTTP.
//
// Esto copia medir() con el MISMO criterio (baseline del mismo largo que lo
// corrido, inmediatamente antes del inicio; ventana anclada al último día completo
// en Tijuana y topada al fin de ventana; serie en ≤ 21 tramos contiguos). Si cambia
// uno, cambia el otro: el día que medir() se exporte, esto se borra y se importa.
//
// Solo lee. medirVentana traga el error y devuelve null, igual que la lib: un null
// acá es «no se pudo calcular», no «la fuente no contestó».
// =============================================================================

import 'server-only';
import { METRICAS, type Experimento, type Medicion, type Punto } from '@/lib/experimentos';
import { getMarketingWindow } from '@/lib/queries';
import { hoyEnTijuana, ayerEnTijuana, diasAntes } from '@/lib/date-utils';

const diaInclusive = (a: string, b: string): number =>
  Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

async function medirVentana(metrica: string, desde: string, hasta: string): Promise<number | null> {
  const def = METRICAS.find((m) => m.key === metrica);
  if (!def) return null;
  try {
    const v = def.extraer(await getMarketingWindow(desde, hasta));
    return v != null && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

async function serie(metrica: string, desde: string, hasta: string, maxPuntos = 21): Promise<Punto[]> {
  const dias = diaInclusive(desde, hasta);
  if (dias <= 0) return [];
  const n = Math.min(dias, maxPuntos);
  const base = Math.floor(dias / n);
  const resto = dias % n;
  const tramos: Array<{ desde: string; hasta: string }> = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const len = base + (i < resto ? 1 : 0);
    tramos.push({ desde: diasAntes(desde, -cursor), hasta: diasAntes(desde, -(cursor + len - 1)) });
    cursor += len;
  }
  const valores = await Promise.all(tramos.map((t) => medirVentana(metrica, t.desde, t.hasta)));
  return tramos.map((t, i) => ({ fecha: t.hasta, valor: valores[i] }));
}

/** Mide un experimento con fecha de inicio. `conSerie: false` ahorra los hasta 21
 *  tramos (para el resumen de cerrar, que solo necesita baseline, actual y delta). */
export async function medirExperimento(exp: Experimento, conSerie: boolean): Promise<Medicion | null> {
  if (!exp.fecha_inicio) return null;
  const inicio = exp.fecha_inicio;
  const hoy = hoyEnTijuana();
  const fin = exp.fecha_fin && exp.fecha_fin < hoy ? exp.fecha_fin : ayerEnTijuana();
  const hasta = fin < inicio ? inicio : fin;
  const dias = Math.max(1, diaInclusive(inicio, hasta));
  const baseHasta = diasAntes(inicio, 1);
  const baseDesde = diasAntes(inicio, dias);
  const [actual, baseline, s] = await Promise.all([
    medirVentana(exp.metrica, inicio, hasta),
    medirVentana(exp.metrica, baseDesde, baseHasta),
    conSerie ? serie(exp.metrica, inicio, hasta) : Promise.resolve([] as Punto[]),
  ]);
  const va_bien = actual == null || baseline == null ? null : exp.direccion === 'subir' ? actual >= baseline : actual <= baseline;
  const delta_pct = actual == null || baseline == null || baseline === 0 ? null : ((actual - baseline) / Math.abs(baseline)) * 100;
  return {
    baseline, actual, objetivo: exp.objetivo_valor,
    dias_corridos: dias, dias_total: exp.ventana_dias,
    delta_pct, va_bien, serie: s,
    desde: inicio, hasta, baseline_desde: baseDesde, baseline_hasta: baseHasta,
  };
}
