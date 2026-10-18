// =============================================================================
// /general — desde el 17/10/2026 es la hoja «Focus» del Dashboard: redirige ahí
// =============================================================================
// Martín (17/10/2026, prototipo docs/prototipos/coherencia-1710.md, pedido 3): «Home» sale de la sidebar y el Dashboard
// abre en la hoja fija «Focus», que es lo que era esta página. El cuerpo de antes vive en
// app/dashboard/FocusDeGeneral.tsx, tal cual, y las reglas del Dashboard unido en lib/dashboard-focus.ts.
//
// ⚠️ La query viaja entera (`conLaQuery`): el `?ws=` del cliente que se mira y la `?hoja=` de General, que abre esa
//    hoja (el editor la escribe en la URL al cambiar de hoja, y los links viejos la traen). Sin hoja, Focus.
// ⚠️ La puerta es la del Dashboard: quien no tiene Focus (el closer, el setter) ve lo suyo de siempre ahí.
// ⚠️ En el teléfono /general es el Today de MaKo Mobile (lib/movil-rutas.ts): el proxy lo reescribe antes de llegar acá.
// =============================================================================

import { redirect } from 'next/navigation';
import { conLaQuery } from '@/lib/ajustes-secciones';
import { hojaDesdeGeneral } from '@/lib/dashboard-focus';

export const dynamic = 'force-dynamic';

export default async function GeneralPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const hoja = Array.isArray(sp.hoja) ? sp.hoja[0] : sp.hoja;
  redirect(conLaQuery('/dashboard', { ...sp, hoja: hojaDesdeGeneral(hoja) }));
}
