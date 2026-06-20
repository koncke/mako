// GET /api/lead-plan?leadId= — plan + cuotas + contrato del lead (modo "ver").
import type { NextRequest } from 'next/server';
import { getLeadPlan } from '@/lib/pagos';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const leadId = Number(req.nextUrl.searchParams.get('leadId'));
  if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'leadId inválido' }, { status: 400 });
  try {
    return Response.json(await getLeadPlan(leadId));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
