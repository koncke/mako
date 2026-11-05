// Lo que la pantalla de Revenue decide sobre los números, sin React (5/11/2026): qué meses se dibujan y cómo se arma la tabla
// de saldos de Lago. Sin `'use client'` ni `server-only`: lo ejecutan los tests.

import type { MesIngresos, TipoMovimiento } from '@/lib/admin-ingresos-reglas';

/**
 * Los meses que se dibujan: desde el primero con plata o con MRR (doce meses vacíos adelante se leen como «se cayó todo»),
 * y al menos los últimos tres, para que un negocio que empezó este mes igual tenga contra qué compararse.
 */
export function mesesVisibles(meses: readonly MesIngresos[]): MesIngresos[] {
  const primero = meses.findIndex((m) => m.cobrado > 0 || m.mrr > 0);
  const desde = primero < 0 ? meses.length - 3 : Math.min(primero, meses.length - 3);
  return meses.slice(Math.max(0, desde));
}

/** El % de cambio, redondeado. `null` si no hay contra qué (antes en 0). */
export const cambioPct = (actual: number, antes: number): number | null => (antes > 0 ? Math.round(((actual - antes) / antes) * 100) : null);

export type FilaSaldo = { id: 'inicio' | TipoMovimiento | 'cierre'; rotulo: string; /** 1 suma, −1 resta, 0 es un saldo. */ signo: 1 | -1 | 0; total: boolean; valores: number[] };

const MOVS: ReadonlyArray<{ id: TipoMovimiento; rotulo: string; signo: 1 | -1 }> = [
  { id: 'nuevo', rotulo: 'Nuevos', signo: 1 },
  { id: 'vuelve', rotulo: 'Volvieron', signo: 1 },
  { id: 'sube', rotulo: 'Subieron', signo: 1 },
  { id: 'baja', rotulo: 'Bajaron', signo: -1 },
  { id: 'corte', rotulo: 'Se cortaron', signo: -1 },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * La tabla de Lago: el MRR al empezar cada mes, cada movimiento y al cerrar. «Al empezar» se DERIVA del cierre y los
 * movimientos del mes (y no del cierre del mes anterior): así la columna cierra exacta también en el primer mes visible. Una
 * fila de movimiento en cero en todos los meses no se dibuja (sin datos no se muestra nada que no diga algo).
 */
export function filasDeSaldos(meses: readonly MesIngresos[]): FilaSaldo[] {
  const neto = (m: MesIngresos) => m.nuevo + m.vuelve + m.sube - m.baja - m.corte;
  const out: FilaSaldo[] = [{ id: 'inicio', rotulo: 'Al empezar', signo: 0, total: false, valores: meses.map((m) => r2(m.mrr - neto(m))) }];
  for (const mv of MOVS) {
    const valores = meses.map((m) => m[mv.id]);
    if (valores.some((v) => v !== 0)) out.push({ id: mv.id, rotulo: mv.rotulo, signo: mv.signo, total: false, valores });
  }
  out.push({ id: 'cierre', rotulo: 'Al cerrar', signo: 0, total: true, valores: meses.map((m) => m.mrr) });
  return out;
}
