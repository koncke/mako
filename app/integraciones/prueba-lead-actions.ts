'use server';

// =============================================================================
// prueba-lead-actions — la puerta del botón «Ver la grabación» de la prueba
// =============================================================================
// Pedido de MARTÍN el 06/10/2026, textual: «Para probar la grabación de la sesión
// que hicimos, que simplemente se cree un lead de PRUEBA en el CRM en ese
// producto. Con el nombre de PRUEBA. Y allí se podrá ver esa grabación.»
//
// La lógica vive en `lib/lead-de-prueba.ts` (con todos sus porqués), porque
// también la usa el cron que avisa por WhatsApp. Acá queda lo que es de la
// PANTALLA: quién puede, y de qué workspace.

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { asegurarLeadDePrueba, type LeadDePruebaResult } from '@/lib/lead-de-prueba';

export async function leadDePruebaAction(marcador: string | null): Promise<LeadDePruebaResult> {
  try {
    await requireRolWs([], { nav: 'integraciones' });
  } catch {
    return { ok: false, error: 'No tienes permiso para esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Entra a un cliente para ver su grabación.' };
  return asegurarLeadDePrueba(ws, marcador);
}
