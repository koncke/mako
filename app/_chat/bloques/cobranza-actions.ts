'use server';

// =============================================================================
// «A quién cobrar» en el chat con MaKo: la lista VIVA (20/10/2026, Ops Center = lo principal, la 2.27)
// =============================================================================
// El bloque guardado en el hilo es la foto del momento (lib/pagos-bloque.ts). Al dibujarse se vuelve a leer con la
// MISMA lectura que la tab General (`getPorCobrar` + `armarCobranza` + `cobroDeFila`): un «Cobrada» sobre una fila vieja
// marcaría de nuevo una cuota ya cobrada, y `marcarPago` le reescribiría la fecha (el cobro saltaría de mes).
//
// ⚠️ SÓLO EL ADMIN: `a_quien_cobrar` es de admin (los montos del negocio no son de un closer ni de un setter). Y sin
//    sesión no hay rol: `getWorkspaceActual()` sin cookie cae al ws1, así que el rol va PRIMERO.

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getPorCobrar } from '@/lib/pagos';
import { armarCobranza } from '@/lib/datos-comercial';
import { hoyEnWorkspace, tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { cobrosDeFilas } from '@/lib/pagos-bloque';
import type { FilaCobranza } from '@/lib/chat-bloques';

export type CobranzaViva = { ok: true; filas: FilaCobranza[]; tz: string } | { ok: false; error: string };

const fecha = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function leerCobranzaDelHilo(ventana: { desde: string; hasta: string } | null): Promise<CobranzaViva> {
  try {
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'La cobranza la ve el admin del negocio.' };
    const ws = await getWorkspaceActual();
    if (ws == null) return { ok: false, error: 'No sé de qué negocio es esta lista.' };
    const desde = fecha(ventana?.desde);
    const hasta = fecha(ventana?.hasta);
    const [hoy, tz] = await Promise.all([hoyEnWorkspace(), tzDeWorkspace(ws).catch(() => TZ_DEFAULT)]);
    const { items } = await getPorCobrar(hoy, desde && hasta ? desde : null, desde && hasta ? hasta : null);
    return { ok: true, filas: cobrosDeFilas(armarCobranza(items, hoy).filas), tz };
  } catch (e) {
    console.error('[chat] cobranza viva:', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'No pude leer la cobranza.' };
  }
}
