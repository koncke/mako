// =============================================================================
// meta-write — escrituras a Meta Ads (nombre / presupuesto / estado / borrar)
// =============================================================================
// La lógica de mutar una entidad de Meta vive acá para que la puedan usar TANTO
// el route /api/meta-write (UI del Ads Manager) COMO el doer de MaKo (cuando el
// dueño confirma "renombrá la campaña X"). El GATE de permisos (esWorkspaceDueno)
// lo pone cada caller — esta función asume que ya se validó quién puede escribir.
//
// CRÍTICO: Meta devuelve errores (p.ej. subcode 4841013 "Permissions") con HTTP
// 200. Por eso SIEMPRE miramos body.error, nunca res.ok.

import 'server-only';
import { updateTag } from 'next/cache';
import { getTenantDb, runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { TAG } from '@/lib/cache';

const GRAPH = 'https://graph.facebook.com';

export type MetaWriteBody =
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'status'; status: 'ACTIVE' | 'PAUSED' }
  | { level: 'campaign' | 'adset'; id: string; op: 'budget'; dailyBudgetMxn: number }
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'name'; name: string }
  | { level: 'campaign' | 'adset' | 'ad'; id: string; op: 'delete' };

export type MetaWriteResult =
  // `propagadas` = filas de marketing_metrics_daily actualizadas al renombrar
  // (null = no aplica o falló). 0 con historia = escrito en Meta pero NO propagado.
  | { ok: true; id: string; applied: { status?: string; dailyBudgetMxn?: number; name?: string; deleted?: boolean }; status: 200; propagadas?: number | null }
  | { ok: false; code?: number; error_subcode?: number; message: string; status: number };

/** Muta una entidad de Meta. NO valida permisos (el caller ya gateó con esWorkspaceDueno). */
export async function metaWrite(body: MetaWriteBody): Promise<MetaWriteResult> {
  const ver = process.env.META_API_VERSION;
  const token = process.env.META_ACCESS_TOKEN;
  if (!ver || !token) return { ok: false, message: 'Meta no configurado', status: 500 };

  if (!body || typeof body.id !== 'string' || !/^\d+$/.test(body.id)) {
    return { ok: false, message: 'id inválido (debe ser el id numérico de Meta)', status: 400 };
  }

  // Eliminar (DELETE /{id}). Cascadea a conjuntos/anuncios — el caller restringe
  // a entidades PAUSADAS y confirma.
  if (body.op === 'delete') {
    try {
      const res = await fetch(`${GRAPH}/${ver}/${body.id}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data && data.error) return errorDeMeta(data.error, 'Meta rechazó el borrado');
      return { ok: true, id: body.id, applied: { deleted: true }, status: 200 };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err), status: 502 };
    }
  }

  const params = new URLSearchParams();
  const applied: { status?: string; dailyBudgetMxn?: number; name?: string } = {};

  if (body.op === 'status') {
    if (body.status !== 'ACTIVE' && body.status !== 'PAUSED') return { ok: false, message: 'status inválido', status: 400 };
    params.set('status', body.status);
    applied.status = body.status;
  } else if (body.op === 'budget') {
    if ((body.level as string) === 'ad') return { ok: false, message: 'un anuncio no tiene presupuesto', status: 400 };
    const mxn = Number(body.dailyBudgetMxn);
    if (!Number.isFinite(mxn) || mxn <= 0) return { ok: false, message: 'presupuesto inválido', status: 400 };
    // daily_budget va en centavos de la moneda de la cuenta (MXN).
    params.set('daily_budget', String(Math.round(mxn * 100)));
    applied.dailyBudgetMxn = mxn;
  } else if (body.op === 'name') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return { ok: false, message: 'nombre vacío', status: 400 };
    if (name.length > 400) return { ok: false, message: 'nombre demasiado largo', status: 400 };
    params.set('name', name);
    applied.name = name;
  } else {
    return { ok: false, message: 'op inválida', status: 400 };
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
    if (data && data.error) return errorDeMeta(data.error, 'Meta rechazó la escritura');

    // Propagar el rename a NUESTROS datos en el acto (si no, el lead sigue
    // mostrando el nombre viejo hasta la próxima sincronización de métricas).
    let propagadas: number | null = null;
    if (body.op === 'name' && applied.name) {
      propagadas = await propagarRename(body.level, body.id, applied.name);
    }
    return { ok: true, id: body.id, applied, status: 200, propagadas };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err), status: 502 };
  }
}

/**
 * Propaga el nombre nuevo a NUESTROS datos (leads + métricas). Sin esto el
 * histórico queda partido en dos: la tabla de Ads Manager agrupa el gasto por
 * NOMBRE, así que una campaña renombrada aparece dos veces y el rollup miente.
 *
 * OJO — por qué runWithWorkspace(OWNER_WS) y no getTenantDb() a secas: la cuenta
 * de Meta es la GLOBAL del dueño, pero getTenantDb() resuelve el workspace de la
 * SESIÓN. Un super-admin que no está impersonando cae a su propio workspace (o a
 * null → wsId -1), el UPDATE no matchea ninguna fila y devuelve ok igual (0 filas
 * no es error de Postgres). Resultado: fallaba en silencio. Se comprobó en la
 * base: las únicas filas con updated_at > created_at son de un solo día, y hay 4
 * campañas con dos nombres históricos que esconden ~MX$32.500 del rollup.
 *
 * Devuelve cuántas filas de métricas se tocaron (null si ni se intentó), para que
 * la UI pueda avisar "se renombró en Meta pero no se propagó" en vez de callarse.
 */
async function propagarRename(level: 'campaign' | 'adset' | 'ad', id: string, nombre: string): Promise<number | null> {
  try {
    return await runWithWorkspace(OWNER_WS, async () => {
      const db = await getTenantDb();
      let filas = 0;
      if (level === 'ad') {
        await db.from('leads').update({ meta_ad_name: nombre }).eq('meta_ad_id', id);
        const { count } = await db.from('marketing_metrics_daily').update({ ad_name: nombre }, { count: 'exact' }).eq('ad_id', id);
        filas = count ?? 0;
      } else if (level === 'campaign') {
        await db.from('leads').update({ meta_campaign_name: nombre }).eq('utm_campaign', id);
        const { count } = await db.from('marketing_metrics_daily').update({ campaign_name: nombre }, { count: 'exact' }).eq('campaign_id', id);
        filas = count ?? 0;
      } else {
        const { count } = await db.from('marketing_metrics_daily').update({ adset_name: nombre }, { count: 'exact' }).eq('adset_id', id);
        filas = count ?? 0;
      }
      try { updateTag(TAG.leads); updateTag(TAG.marketing); } catch { /* la caché vence sola por TTL */ }
      return filas;
    });
  } catch (e) {
    console.error('[meta-write] propagar rename a leads/métricas falló:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

function errorDeMeta(error: unknown, fallback: string): MetaWriteResult {
  const e = error as { code?: number; error_subcode?: number; message?: string };
  const status = e.error_subcode === 4841013 || e.code === 200 ? 403 : 502;
  return { ok: false, code: e.code, error_subcode: e.error_subcode, message: e.message ?? fallback, status };
}
