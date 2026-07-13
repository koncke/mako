// =============================================================================
// retro — retrospectivas de /experimentos (tab Retro)
// =============================================================================
// MaKo lee el funnel real + los experimentos + las conclusiones + las tareas de
// un período y produce:
//   - destacados: métricas clave del funnel con su delta vs el período anterior
//     de igual largo (DATO duro, calculado acá, no inventado por MaKo).
//   - resumen: reporte narrativo (MaKo interpreta el dato; enmarca causa-efecto
//     como hipótesis, salvo las conclusiones ya validadas).
//   - recomendaciones: separadas en "probá esto" (→ experimento) y "hacé esto"
//     (→ tarea), listas para aplicar con 1 clic.
// Se guarda como snapshot histórico para comparar retros en el tiempo.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getMarketingWindow, type MarketingWindow } from './queries';
import { diasAntes, ayerEnTijuana } from './date-utils';
import { METRICAS, fmtMetrica, metricaDef, type Direccion } from './experimentos';
import { type Prioridad } from './todo';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type Tono = 'good' | 'bad' | 'neutral';

export type RetroDestacado = {
  metrica: string;
  label: string;
  valor: string;          // valor del período, formateado
  valor_prev: string;     // valor del período anterior, formateado
  delta: number | null;   // variación % vs período anterior (firmada)
  tono: Tono;             // ¿mejoró o empeoró, según la dirección natural?
};

export type RetroRecoExperimento = {
  tipo: 'experimento';
  titulo: string; hipotesis: string; cambio: string;
  metrica: string; direccion: Direccion; objetivo_valor: number | null;
  criterio_exito: string; ventana_dias: number; racional: string;
};
export type RetroRecoTarea = {
  tipo: 'tarea';
  titulo: string; detalle: string; prioridad: Prioridad;
};
export type RetroReco = RetroRecoExperimento | RetroRecoTarea;

export type Retro = {
  id: number;
  periodo_desde: string;
  periodo_hasta: string;
  titulo: string;
  resumen: string;
  destacados: RetroDestacado[] | null;
  recomendaciones: RetroReco[] | null;
  snapshot: Record<string, unknown> | null;
  /** Reporte compuesto v3 (lib/retro-reporte.ts). Null en retros viejas (legacy). */
  reporte: import('./retro-reporte').RetroReporte | null;
  model: string | null;
  created_at: string;
};

const COLS = '*';
const rowTo = (r: Record<string, unknown>): Retro => r as unknown as Retro;

// ─────────────────────────────────────────────────────────────────────────────
// Destacados (DATO duro: métricas del período vs período anterior de igual largo)
// ─────────────────────────────────────────────────────────────────────────────

const DESTACADOS: string[] = ['spend_usd', 'leads_count', 'cp_form', 'agendamientos', 'cpa', 'cierres', 'cac'];

const diaInclusive = (a: string, b: string): number =>
  Math.floor((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) -
    Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000) + 1;

export async function calcularDestacados(desde: string, hasta: string): Promise<{ destacados: RetroDestacado[]; snapshot: Record<string, unknown> }> {
  const dias = Math.max(1, diaInclusive(desde, hasta));
  const prevHasta = diasAntes(desde, 1);
  const prevDesde = diasAntes(desde, dias);
  let w: MarketingWindow | null = null;
  let wPrev: MarketingWindow | null = null;
  try { w = await getMarketingWindow(desde, hasta); } catch { /* sin datos */ }
  try { wPrev = await getMarketingWindow(prevDesde, prevHasta); } catch { /* sin datos */ }

  const destacados: RetroDestacado[] = DESTACADOS.map((key) => {
    const def = metricaDef(key);
    const val = w && def ? def.extraer(w) : null;
    const prev = wPrev && def ? def.extraer(wPrev) : null;
    const delta = val != null && prev != null && prev !== 0 ? ((val - prev) / Math.abs(prev)) * 100 : null;
    let tono: Tono = 'neutral';
    if (delta != null && Math.abs(delta) >= 3 && def) {
      const subioBien = def.mejor === 'subir' ? delta > 0 : delta < 0;
      tono = subioBien ? 'good' : 'bad';
    }
    return {
      metrica: key,
      label: def?.label ?? key,
      valor: fmtMetrica(val, key),
      valor_prev: fmtMetrica(prev, key),
      delta,
      tono,
    };
  });

  const snapshot: Record<string, unknown> = { desde, hasta, prevDesde, prevHasta };
  if (w) for (const m of METRICAS) snapshot[m.key] = m.extraer(w);
  return { destacados, snapshot };
}

export async function listRetros(): Promise<Retro[]> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').select(COLS).order('created_at', { ascending: false });
  if (error) throw new Error(`listRetros: ${error.message}`);
  return (data ?? []).map(rowTo);
}

export async function getRetro(id: number): Promise<Retro | null> {
  const supabase = (await getTenantDb());
  const { data, error } = await supabase.from('retros').select(COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`getRetro: ${error.message}`);
  return data ? rowTo(data) : null;
}

export async function borrarRetro(id: number): Promise<void> {
  const supabase = (await getTenantDb());
  const { error } = await supabase.from('retros').delete().eq('id', id);
  if (error) throw new Error(`borrarRetro: ${error.message}`);
}

/** Período por defecto para una retro nueva: últimos 30 días completos. */
export function periodoDefault(dias = 30): { desde: string; hasta: string } {
  const hasta = ayerEnTijuana();
  const desde = diasAntes(hasta, dias - 1);
  return { desde, hasta };
}

/** Período "todo el histórico": desde el primer día con datos de marketing hasta ayer. */
export async function periodoHistorico(): Promise<{ desde: string; hasta: string }> {
  const hasta = ayerEnTijuana();
  let desde = diasAntes(hasta, 729); // fallback: ~2 años
  try {
    const supabase = (await getTenantDb());
    const { data } = await supabase.from('marketing_metrics_daily').select('fecha').order('fecha', { ascending: true }).limit(1);
    const f = data && data[0] ? (data[0] as { fecha?: string }).fecha : null;
    if (f && /^\d{4}-\d{2}-\d{2}/.test(f)) desde = f.slice(0, 10);
  } catch { /* sin datos → fallback */ }
  return { desde: desde < hasta ? desde : hasta, hasta };
}
