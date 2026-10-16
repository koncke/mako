'use server';

// =============================================================================
// «Tu plan»: el botón «Darme de baja» del plan de MaKo (15/10/2026)
// =============================================================================
// Lo decidió Estrategia el 15/10: un botón PROPIO en MaKo (no el portal de Stripe), que cubre Stripe y Mercado Pago.
// Sólo el ADMIN de ESTE workspace (`adminDeWorkspaceActual`, que también deja pasar al super admin parado en él): el plan
// es lo que la plataforma le cobra al negocio. El cobro se busca por `alta_ws = ws` (`suscripcionDeMakoDe`, lib/cobros.ts):
// un negocio da de baja el suyo y nunca el de otro. Lo que corta plata no se reintenta acá: el segundo clic lo decide la
// persona (y pedirla dos veces devuelve el mismo código).

import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { adminDeWorkspaceActual, getCapaActual } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { darDeBajaMiPlan, type ResultadoBaja } from '@/lib/cobros';
import { mandarCodigoDeBaja } from '@/lib/invitaciones';

export async function darmeDeBajaAction(): Promise<ResultadoBaja> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede darlo de baja.' };
  const sesion = await getUsuarioActual();
  const r = await darDeBajaMiPlan(ws, sesion?.nombre || sesion?.email || 'el negocio');
  // El comprobante, al email de quien la pidió. Si no sale, la baja igual quedó hecha (el código está en pantalla).
  if (r.ok && sesion?.email) {
    const plan = capaDef(await getCapaActual()).nombre;
    const m = await mandarCodigoDeBaja({ to: sesion.email, codigo: r.codigo, plan, finAt: r.finAt });
    if (!m.enviado) console.error(`[plan] no salió el código de baja ${r.codigo}: ${m.error ?? 'sin detalle'}`);
  }
  revalidatePath('/configuraciones/plan');
  return r;
}
