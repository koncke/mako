// =============================================================================
// /api/meta-write — escrituras a Meta Ads (pausar/activar y presupuesto)
// =============================================================================
// Un endpoint para mutar status (ACTIVE/PAUSED) y presupuesto diario (CBO en la
// campaña / ABO en el conjunto). El budget va en CENTAVOS de MXN.
//
// CRÍTICO: Meta puede devolver un error (p.ej. subcode 4841013 "Permissions
// error") con HTTP 200. Por eso SIEMPRE inspeccionamos body.error, nunca el
// status HTTP. Hoy, con el token de tipo PÁGINA, toda escritura devuelve 4841013;
// el día que se use un System User token con ads_management, funciona sin tocar
// este código.

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';

type Body =
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'status'; status: 'ACTIVE' | 'PAUSED' }
  | { level: 'campaign' | 'adset'; id: string; op: 'budget'; dailyBudgetMxn: number };

export async function POST(req: NextRequest) {
  const ver = process.env.META_API_VERSION;
  const token = process.env.META_ACCESS_TOKEN;
  if (!ver || !token) return Response.json({ ok: false, message: 'Meta no configurado' }, { status: 500 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, message: 'body inválido' }, { status: 400 });
  }

  if (!body || typeof body.id !== 'string' || !/^\d+$/.test(body.id)) {
    return Response.json({ ok: false, message: 'id inválido' }, { status: 400 });
  }

  const params = new URLSearchParams();
  const applied: { status?: string; dailyBudgetMxn?: number } = {};

  if (body.op === 'status') {
    if (body.status !== 'ACTIVE' && body.status !== 'PAUSED') {
      return Response.json({ ok: false, message: 'status inválido' }, { status: 400 });
    }
    params.set('status', body.status);
    applied.status = body.status;
  } else if (body.op === 'budget') {
    if ((body.level as string) === 'ad') return Response.json({ ok: false, message: 'un anuncio no tiene presupuesto' }, { status: 400 });
    const mxn = Number(body.dailyBudgetMxn);
    if (!Number.isFinite(mxn) || mxn <= 0) return Response.json({ ok: false, message: 'presupuesto inválido' }, { status: 400 });
    // daily_budget va en centavos de la moneda de la cuenta (MXN).
    params.set('daily_budget', String(Math.round(mxn * 100)));
    applied.dailyBudgetMxn = mxn;
  } else {
    return Response.json({ ok: false, message: 'op inválida' }, { status: 400 });
  }
  params.set('access_token', token);

  try {
    const res = await fetch(`${GRAPH}/${ver}/${body.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    // Meta manda errores (incl. 4841013) con HTTP 200 → mirar body.error.
    if (data && data.error) {
      const e = data.error as { code?: number; error_subcode?: number; message?: string };
      const status = e.error_subcode === 4841013 || e.code === 200 ? 403 : 502;
      return Response.json(
        { ok: false, code: e.code, error_subcode: e.error_subcode, message: e.message ?? 'Meta rechazó la escritura' },
        { status },
      );
    }
    return Response.json({ ok: true, id: body.id, applied });
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
