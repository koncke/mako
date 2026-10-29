// =============================================================================
// Cron: borra para siempre lo que lleva más de 30 días en la papelera del CRM (diario)
// =============================================================================
// «Eliminar» un lead lo manda a la papelera (mig 0340, lib/leads-papelera.ts): el lead ya se borró y queda su foto, con la
// que se recupera igual. Pasados `DIAS_PAPELERA_LEADS` días (`purgar_at`, lo escribe la base al mandarlo), la foto se borra y
// el lead ya no vuelve. Es la promesa de la pregunta («durante 30 días los recuperas; después se borran para siempre»).
//
// ⚠️ NO ITERA WORKSPACES: la función purga los de todos con una sola consulta, por la fecha de cada fila. Sin la migración
// contesta 0 (no hay nada que purgar). Contesta 500 si la base falló, para que el monitoreo del cron lo vea.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { purgarPapeleraDeLeads } from '@/lib/leads-papelera';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  try {
    const purgados = await purgarPapeleraDeLeads();
    return Response.json({ ok: true, purgados });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
