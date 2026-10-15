// =============================================================================
// /admin/runway — ahora es la entrada vieja a la Ticketera: redirige al mazo
// =============================================================================
// Hasta el 14/10/2026 esta tab era el tablero de decisiones en lista. Martín: se llama
// «Ticketera», el mazo para deslizar es LA vista y la lista queda como secundaria. Así que esta
// URL —que tienen links y favoritos viejos— lleva al mazo (/tickets/decisiones); la lista vive en
// /tickets/decisiones/lista. En el teléfono, lib/movil-rutas.ts la lleva directo al mazo.
//
// La foto del lanzamiento del 3/10 sigue en /admin/runway/foto (la enlaza Strategy).
//
// ⚠️ EL GUARD ES EL ROL DE AGENCIA (getSesionAdmin), y el proxy ya cierra /admin/* (SOLO_ADMIN).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { rutaConWs } from '@/lib/workspace';
import { TICKETERA } from '@/app/tickets/decisiones/reglas';

export const dynamic = 'force-dynamic';

export default async function RunwayPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  redirect(await rutaConWs(TICKETERA));
}
