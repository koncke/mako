// =============================================================================
// /api/admin/fathom-auto — engancha AHORA las grabaciones de Fathom pendientes
// =============================================================================
// Solo admin. Corre adjuntarFathomAuto() en el workspace dueño: busca las
// reuniones ya pasadas sin grabación y les engancha la de Fathom (self-contained,
// no depende del cron). Para probarlo / resolver de una.

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { OWNER_WS, runWithWorkspace } from '@/lib/workspace';
import { adjuntarFathomAuto } from '@/lib/fathom-auto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    const res = await runWithWorkspace(OWNER_WS, () => adjuntarFathomAuto({ diasAtras: 30, maxLeads: 200 }));
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
