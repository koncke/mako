// =============================================================================
// ¿A una columna del CRM le falta su vínculo? (22/10/2026, lo puro de lib/vinculos-de-columnas.ts: lo usa el tablero)
// =============================================================================

import { cuentasValidas, type CuentaPago } from '@/lib/cobro-etapa';

/** Las etapas de UN CRM con un evento vinculado, y si Ganado cobra algo. */
export type VinculadosDelCrm = { eventos: string[]; cobro: boolean };

/** ¿A esta columna le falta su vínculo? Sólo las de reunión (el evento) y Ganado (el cobro); sin la lectura, nada. */
export function faltaVincular(c: { key: string; kind?: string | null }, v: VinculadosDelCrm | null | undefined): 'evento' | 'cobro' | null {
  if (!v) return null;
  if (c.kind === 'reunion' && !v.eventos.includes(c.key)) return 'evento';
  if (c.key === 'ganado' && !v.cobro) return 'cobro';
  return null;
}

/**
 * ¿Ganado cobra de verdad? Algún vínculo con alguna cuenta TODAVÍA conectada (revisión del 23/10/2026: con Mercado Pago
 * desconectado el vínculo sigue, pero ningún pago pasa a Ganado, y el aviso callaba).
 */
export function cobraDeVerdad(vinculos: ReadonlyArray<{ cuentas: readonly string[] }>, conectadas: readonly CuentaPago[]): boolean {
  return vinculos.some((v) => cuentasValidas(v.cuentas, conectadas).length > 0);
}
