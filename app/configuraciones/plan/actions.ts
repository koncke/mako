'use server';

// =============================================================================
// «Tu plan»: abrir el portal de Stripe o cancelar el plan de MaKo (15/10/2026)
// =============================================================================
// «Cancelar uno mismo», como todo SaaS (lo decidió Estrategia el 15/10). Sólo el ADMIN de ESTE workspace
// (`adminDeWorkspaceActual`, que también deja pasar al super admin parado en él): el plan es lo que la plataforma le
// cobra al negocio. El cobro se busca por `alta_ws = ws` (`suscripcionDeMakoDe`, lib/cobros.ts): un negocio toca el
// suyo y nunca el de otro. Lo que mueve plata no se reintenta acá: el segundo clic lo decide la persona.

import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { cancelarMiPlan, portalDeMiPlan } from '@/lib/cobros';
import { linkApp } from '@/lib/app-url';

export async function abrirPortalPlanAction(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, error: 'Sólo quien administra el negocio puede ver su plan.' };
  // Vuelve a ESTA sección y a ESTE negocio: sin el `?ws=`, quien mira un cliente volvería a su propia cuenta.
  return portalDeMiPlan(ws, linkApp('/configuraciones/plan', ws));
}

export async function cancelarPlanAction(): Promise<{ ok: boolean; resumen: string }> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede cancelar su plan.' };
  const sesion = await getUsuarioActual();
  const r = await cancelarMiPlan(ws, sesion?.nombre || sesion?.email || 'el negocio');
  revalidatePath('/configuraciones/plan');
  return r;
}
