// =============================================================================
// /crm — las rutas que REDIRIGEN lo hacen acá, ANTES del loader (25/10/2026)
// =============================================================================
// El mismo riesgo de los tickets #7 (/general) y #9 (/web-generator): `app/crm/loading.tsx` envuelve a todas las páginas
// de /crm, y un `redirect()` de adentro va en el stream (200 + meta refresh, no 307), en carrera con la hidratación del
// router («Minified React error #310»). El layout queda afuera del loader: redirigir acá devuelve el 307. Y redirigen
// también las PUERTAS (`requireCapa`, `guardOnboarding`, `requireRolWs`): un cliente con el onboarding pendiente que abre
// /crm iba a /onboarding desde adentro del stream.
//
// Qué ruta pasa por qué puerta, en `redireccionDelLayoutCrm` (layout-reglas.ts, con test): la misma de su página, que la
// conserva por si se llega navegando (este layout envuelve a todo /crm y no se vuelve a dibujar entre sus rutas). La ruta
// la pone el proxy (lib/pedido-actual.ts): un layout no la recibe. Para cualquier otra ruta no hace nada.
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { workspaceDeLeadParaAdmin } from '@/lib/leads';
import { pedidoActual } from '@/lib/pedido-actual';
import { guardOnboarding, requireCapa, requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { destinoDelResumen, redireccionDelLayoutCrm } from './layout-reglas';

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const { ruta } = await pedidoActual();
  const r = redireccionDelLayoutCrm(ruta);
  if (r?.tipo === 'tab') {
    await requireCapa('crm');
    await guardOnboarding();
  }
  if (r?.tipo === 'pide-sesion' && !(await getUsuarioActual())) redirect(await rutaConWs('/inicio'));
  if (r?.tipo === 'resumen') {
    // La puerta de la página primero: el negocio del lead no se busca para quien no tiene el CRM.
    await requireCapa('crm');
    // La decisión de `ResumenAjeno` (la página): sólo el super admin sabe de quién es, y el `!==` corta el bucle.
    const [wsDueno, wsActual] = await Promise.all([
      workspaceDeLeadParaAdmin(r.leadId),
      getWorkspaceActual().catch(() => null),
    ]);
    if (wsDueno != null && wsDueno !== wsActual) redirect(destinoDelResumen(r.leadId, wsDueno));
  }
  return children;
}
