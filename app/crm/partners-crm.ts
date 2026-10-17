import 'server-only';

// =============================================================================
// partners-crm — ¿el CRM ofrece «Llevar a MaKo Partners»? (17/10/2026)
// =============================================================================
// Martín, 17/10/2026: «si un usuario se unió al programa de "MaKo Partners", que le aparezca la opción en el CRM para
// llevarlos allí». La ventana y el alta son de Clients (app/partners/LlevarAPartners.tsx, `llevarAPartnersAction`);
// el CRM sólo decide si OFRECE la opción, en sus dos puertas: el menú de un lead en el tablero (app/crm/page.tsx) y el
// «⋯» de la ficha (`getLeadFullAction`). La MISMA regla que la puerta de /partners y que la acción:
//   · el workspace es una agencia (`esAgencia`, lib/agencia.ts);
//   · quien mira es su admin, o el super admin (`adminDeWorkspaceActual`, lib/workspace.ts).
// Ofrecerla a alguien que no puede usarla sería un botón que siempre contesta «Sólo el admin…».
// Nunca tira: sin poder leer, no se ofrece.
// =============================================================================

import { esAgencia } from '@/lib/agencia';
import { adminDeWorkspaceActual } from '@/lib/workspace';

export async function ofrecePartners(): Promise<boolean> {
  try {
    const ws = await adminDeWorkspaceActual();
    return ws != null && (await esAgencia(ws));
  } catch {
    return false;
  }
}
