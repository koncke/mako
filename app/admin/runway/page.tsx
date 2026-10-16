// =============================================================================
// /admin/runway — la entrada más vieja a la Ticketera: lleva a la Ticketera adentro del Centro
// =============================================================================
// Hasta el 14/10/2026 esta tab era el tablero de decisiones en lista; después llevó al mazo (/tickets/decisiones), y
// desde el 16/10/2026 la Ticketera vive adentro del Centro de Operaciones (Martín: «elimines la ruta de la ticketera y
// lo pongas dentro del centro de operaciones»). Así que esta URL —que tienen links y favoritos viejos— lleva al mazo
// del Centro, sin perder la query. En el teléfono, lib/movil-rutas.ts la lleva directo a /m/operaciones.
//
// La foto del lanzamiento del 3/10 sigue en /admin/runway/foto (la enlaza Strategy).
//
// ⚠️ EL GUARD ES EL ROL DE AGENCIA (getSesionAdmin), y el proxy ya cierra /admin/* (SOLO_ADMIN).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { rutaConWs } from '@/lib/workspace';
import { aLaTicketera } from '@/app/tickets/decisiones/reglas';

export const dynamic = 'force-dynamic';

export default async function RunwayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  redirect(await rutaConWs(aLaTicketera('tarjetas', await searchParams)));
}
