// =============================================================================
// experimentos-formato — cómo se ESCRIBE un número de Experiments (módulo puro)
// =============================================================================
// Lo leen dos pantallas: la tab de escritorio (/experimentos, que lo re-exporta desde
// app/experimentos/ui.tsx y app/experimentos/VistaAnalisis.tsx) y la del teléfono
// (app/m/experimentos), que formatea en el SERVER y le pasa al cliente texto ya escrito.
//
// ⚠️ POR QUÉ VIVE ACÁ Y NO EN app/experimentos/ui.tsx: ui.tsx es 'use client' (y trae
// recharts). Un valor exportado desde un módulo de cliente NO es ese valor para el server,
// es una referencia de cliente (AGENTS.md, «'use client' es una frontera de DATOS»), y el
// teléfono necesita estos números en su page.tsx. Mudado el 15/10/2026 sin cambiar una
// coma: «mismos números» quiere decir el MISMO formateador, no una copia en /m.
//
// Sin imports: ni 'server-only' ni nada que lea la base. Lo prueba tests/m-experimentos.test.ts.
// =============================================================================

/** El formato de cada métrica (en sync con METRICAS de lib/experimentos.ts). */
export const METRICA_FMT: Record<string, 'usd' | 'pct' | 'num'> = {
  cpl: 'usd', cp_form: 'usd', cpc: 'usd', cpm: 'usd', cpa: 'usd', cac: 'usd', spend_usd: 'usd',
  ctr: 'pct', tasa_landing: 'pct', tasa_form: 'pct', tasa_agenda: 'pct',
  impressions: 'num', landing_page_views: 'num', leads_count: 'num', agendamientos: 'num',
  vsl_views: 'num', cierres: 'num',
};

export function fmtVal(v: number | null | undefined, metrica: string): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const f = METRICA_FMT[metrica] ?? 'num';
  if (f === 'usd') return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (f === 'pct') return `${v.toFixed(1)}%`;
  return Math.round(v).toLocaleString('es-MX');
}

export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

export function fmtFechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${+d} ${meses[+m - 1] ?? ''} ${y}`;
}

export const fmtDelta = (d: number | null | undefined): string =>
  d == null ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;

export const dirLabel = (d: 'subir' | 'bajar') => (d === 'subir' ? 'subir ↑' : 'bajar ↓');

// ── La tab Análisis (app/experimentos/VistaAnalisis.tsx) ─────────────────────

/** Una proporción 0..1 como porcentaje entero. */
export const pctAnalisis = (v: number | null): string => (v == null ? '—' : `${Math.round(v * 100)}%`);
/** Un número entero con miles es-MX. */
export const n0Analisis = (v: number | null): string => (v == null ? '—' : Math.round(v).toLocaleString('es-MX'));

/** Los rangos preseteados del informe. Los tres que se piden de verdad. */
export const RANGOS_ANALISIS: Array<{ label: string; dias: number }> = [
  { label: '30 días', dias: 30 },
  { label: '90 días', dias: 90 },
  { label: '12 meses', dias: 365 },
];

/** El rango de los últimos `dias` días hasta hoy (UTC), como lo arman los links de Análisis. */
export function rangoHace(dias: number, hoy: Date = new Date()): { desde: string; hasta: string } {
  const d = new Date(hoy.getTime() - dias * 86_400_000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { desde: iso(d), hasta: iso(hoy) };
}
