// =============================================================================
// /api/meta-write — escrituras a Meta Ads (pausar/activar, presupuesto y nombre)
// =============================================================================
// Un endpoint para mutar status (ACTIVE/PAUSED), presupuesto diario (CBO en la
// campaña / ABO en el conjunto) y NOMBRE (campaña/adset/anuncio). El budget va en
// CENTAVOS de MXN. Renombrar = POST /{id} con name=... (mismo edge para los 3).
//
// CRÍTICO: Meta puede devolver un error (p.ej. subcode 4841013 "Permissions
// error") con HTTP 200. Por eso SIEMPRE inspeccionamos body.error, nunca el
// status HTTP. Requiere un token con ads_management sobre la cuenta.

import type { NextRequest } from 'next/server';
import { updateTag } from 'next/cache';
import { esWorkspaceDueno, getTenantDb } from '@/lib/workspace';
import { TAG } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';

type Body =
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'status'; status: 'ACTIVE' | 'PAUSED' }
  | { level: 'campaign' | 'adset'; id: string; op: 'budget'; dailyBudgetMxn: number }
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'name'; name: string }
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'delete' };

export async function POST(req: NextRequest) {
  // Fase 1: escribir a Meta (pausar/activar, presupuesto, nombre, borrar) es una
  // acción sobre la cuenta global del dueño. Solo el dueño puede mutarla.
  if (!(await esWorkspaceDueno())) {
    return Response.json({ ok: false, error: 'Esta acción solo está disponible en el workspace principal por ahora.' }, { status: 403 });
  }

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

  // Eliminar (DELETE /{id}). El cliente restringe a entidades PAUSADAS y confirma.
  // Borrar una campaña cascadea a sus conjuntos y anuncios.
  if (body.op === 'delete') {
    try {
      const res = await fetch(`${GRAPH}/${ver}/${body.id}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data && data.error) {
        const e = data.error as { code?: number; error_subcode?: number; message?: string };
        const status = e.error_subcode === 4841013 || e.code === 200 ? 403 : 502;
        return Response.json({ ok: false, code: e.code, error_subcode: e.error_subcode, message: e.message ?? 'Meta rechazó el borrado' }, { status });
      }
      return Response.json({ ok: true, id: body.id, applied: { deleted: true } });
    } catch (err) {
      return Response.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
  }

  const params = new URLSearchParams();
  const applied: { status?: string; dailyBudgetMxn?: number; name?: string } = {};

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
  } else if (body.op === 'name') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return Response.json({ ok: false, message: 'nombre vacío' }, { status: 400 });
    if (name.length > 400) return Response.json({ ok: false, message: 'nombre demasiado largo' }, { status: 400 });
    params.set('name', name);
    applied.name = name;
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
    // Propagar el rename a NUESTROS datos en el acto: si no, el lead sigue
    // mostrando el nombre viejo del anuncio hasta que las métricas re-sincronicen
    // (la campaña ya se resolvía por id; el ad quedaba denormalizado y viejo).
    if (body.op === 'name' && applied.name) {
      try {
        const db = await getTenantDb();
        const nombre = applied.name;
        if (body.level === 'ad') {
          await db.from('leads').update({ meta_ad_name: nombre }).eq('meta_ad_id', body.id);
          await db.from('marketing_metrics_daily').update({ ad_name: nombre }).eq('ad_id', body.id);
        } else if (body.level === 'campaign') {
          await db.from('leads').update({ meta_campaign_name: nombre }).eq('utm_campaign', body.id);
          await db.from('marketing_metrics_daily').update({ campaign_name: nombre }).eq('campaign_id', body.id);
        } else if (body.level === 'adset') {
          // Los leads no guardan meta_adset_id → solo se propaga a las métricas.
          await db.from('marketing_metrics_daily').update({ adset_name: nombre }).eq('adset_id', body.id);
        }
        try { updateTag(TAG.leads); updateTag(TAG.marketing); } catch { /* la caché vence sola por TTL */ }
      } catch (e) {
        console.error('[meta-write] propagar rename a leads/métricas falló:', e instanceof Error ? e.message : String(e));
      }
    }
    return Response.json({ ok: true, id: body.id, applied });
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
