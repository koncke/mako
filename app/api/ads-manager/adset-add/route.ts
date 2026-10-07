// =============================================================================
// /api/ads-manager/adset-add — agregar un conjunto a una campaña (todo en PAUSA)
// =============================================================================
// GET  ?campaign_id=<id>           → { objective, budgetLevel, optimization, needsForm, needsConv }
// POST { campaign_id, adset, idem_key? } → crea el conjunto + sus anuncios (PAUSED)
// El objetivo/nivel de presupuesto se derivan de la campaña (no del cliente).
//
// ⚠️ Esta ruta no hace rollback de lo que ya tiene anuncios: si Meta rechaza el segundo,
// el conjunto queda creado (en pausa) con el primero. Un conjunto que quedó VACÍO sí se
// borra (revisión de la #59). Hasta la tarea #59 tampoco dejaba registro, así que un
// corte y un segundo clic dejaban DOS conjuntos y nadie podía saberlo. Ahora deja su fila
// en meta_campaign_drafts, anota el conjunto apenas existe, y con `idem_key` una clave ya
// usada contesta desde esa fila (regla del LOTE, contando conjuntos creados).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getCampaignBasics, addAdsetToCampaign, deleteEntity, metaErrorEnvelope, videosSinProcesar } from '@/lib/meta-ads-create';
import { guardAdsWs } from '@/lib/ads-guard';
import type { AdSetSpec } from '@/lib/campaign-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { motivoVideos, videosDeConjunto } from '@/lib/campana-videos';
import { abrirRegistro, claveIdemDe, decidirReintentoLote, salidaAMedias, salidaEsperar, type Decision, type FilaPublicacion, type Salida } from '@/lib/meta-idempotencia';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Un conjunto ya creado con esta clave NO se vuelve a crear: o se devuelve (publicado), o
 *  se avisa que quedó a medias (existe en Meta, en pausa, quizás sin todos sus anuncios). */
function responderConjunto(d: Decision, fila: FilaPublicacion): Salida {
  if (d.tipo === 'devolver') return { status: 200, cuerpo: { ok: true, repetida: true, adset_id: fila.meta_adset_ids[0] ?? null, ad_ids: fila.meta_ad_ids, creative_ids: fila.meta_creative_ids } };
  if (d.tipo === 'a-medias') return salidaAMedias({ adset_id: fila.meta_adset_ids[0] ?? null });
  return salidaEsperar();
}
const decidirConjunto = (fila: FilaPublicacion, ahoraMs: number): Decision => decidirReintentoLote(fila, ahoraMs, 'meta_adset_ids');

export async function GET(req: NextRequest) {
  const no = await guardAdsWs(); if (no) return no;
  const campaignId = req.nextUrl.searchParams.get('campaign_id') ?? '';
  if (!/^\d+$/.test(campaignId)) return Response.json({ ok: false, error: 'campaign_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, campaign: await getCampaignBasics(campaignId) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:adset-add GET] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

export async function POST(req: NextRequest) {
  const no = await guardAdsWs(); if (no) return no;
  let body: { campaign_id?: string; adset?: AdSetSpec; idem_key?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const campaignId = String(body.campaign_id ?? '');
  if (!/^\d+$/.test(campaignId)) return Response.json({ ok: false, error: 'campaign_id inválido' }, { status: 400 });
  const adset = body.adset;
  if (!adset || !Array.isArray(adset.ads) || adset.ads.length === 0) return Response.json({ ok: false, error: 'el conjunto necesita al menos un anuncio' }, { status: 400 });
  const idem = claveIdemDe(body.idem_key);
  if (!idem.ok) return Response.json({ ok: false, error: 'idem_key inválida' }, { status: 400 });

  // Los videos, ANTES de crear el conjunto (tarea #59): sin procesar, Meta rechaza el
  // creativo con el conjunto ya creado, y esta ruta no lo borra.
  const motivo = motivoVideos(await videosSinProcesar(videosDeConjunto(adset)).catch(() => null));
  if (motivo) return Response.json({ ok: false, estado: 'videos', error: motivo }, { status: 409 });

  // La campaña se lee ANTES de abrir el registro (revisión de la #59): la fila nacía con el
  // objetivo por default de la tabla ('OUTCOME_LEADS') y sólo se corregía si esta lectura
  // contestaba — con la lectura caída quedaba una fila 'error' afirmando Leads. Si falla
  // acá, no se creó nada y no hace falta fila.
  let basics: Awaited<ReturnType<typeof getCampaignBasics>>;
  try { basics = await getCampaignBasics(campaignId); } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:adset-add POST] no pude leer la campaña: ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }

  let supabase: SupabaseClient | null = null;
  try { supabase = getSupabaseServer(); } catch { supabase = null; }
// ⚠️ meta_campaign_drafts es POR CLIENTE (mig 0157) y la columna no tiene default a
// propósito: se escribe el workspace explícito, el MISMO sobre cuya cuenta de Meta
// crea lib/meta-ads-create.ts (`getWorkspaceActual() ?? OWNER_WS`).
  const wsDraft = (await getWorkspaceActual()) ?? OWNER_WS;
  const nombre = `${adset.name || 'Conjunto nuevo'} — +1 conjunto`;
  const apertura = await abrirRegistro({
    db: supabase, ws: wsDraft, clave: idem.clave, decidir: decidirConjunto, responder: responderConjunto,
    insertar: (db, conClave) => db.from('meta_campaign_drafts').insert({
      workspace_id: wsDraft,
      name: nombre, status: 'creando', objective: basics.objective,
      spec: { adsets: [adset] },
      meta_campaign_id: campaignId,
      ...(conClave ? { idem_key: idem.clave } : {}),
    }).select('id').single(),
    reclamo: { name: nombre, objective: basics.objective, spec: { adsets: [adset] }, meta_adset_ids: [], meta_ad_ids: [], meta_creative_ids: [] },
  });
  if ('salida' in apertura) return Response.json(apertura.salida.cuerpo, { status: apertura.salida.status });
  const draftId = apertura.registro.draftId;
  const persist = async (patch: Record<string, unknown>) => {
    if (!supabase || draftId == null) return;
    try { await supabase.from('meta_campaign_drafts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', draftId).eq('workspace_id', wsDraft); } catch { /* noop */ }
  };

  // Lo creado hasta ahora, en MEMORIA de la ruta (revisión de la #59): el persist de cada
  // avance traga su error, y el id del conjunto vivía sólo ahí. Con ese persist perdido y
  // un anuncio rechazado después, la fila quedaba en 'error' sin conjunto y el reintento
  // creaba un segundo conjunto con presupuesto. Los terminales reescriben esto entero.
  let creado: { adset_id: string; ad_ids: string[]; creative_ids: string[] } | null = null;
  const ids = () => (creado ? { meta_adset_ids: [creado.adset_id], meta_ad_ids: [...creado.ad_ids], meta_creative_ids: [...creado.creative_ids] } : { meta_adset_ids: [], meta_ad_ids: [], meta_creative_ids: [] });

  try {
    // Cada paso se anota apenas existe en Meta: es lo que un reintento lee para saber que
    // el conjunto ya está (y no crear otro).
    const r = await addAdsetToCampaign(campaignId, basics.objective, basics.budgetLevel, adset, (p) => {
      creado = p;
      return persist(ids());
    });
    creado = r;
    await persist({ status: 'publicada', error: null, ...ids() });
    return Response.json({ ok: true, ...r });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    // ⚠️ Un conjunto SIN anuncios se borra (revisión de la #59): no le sirve a nadie, y
    // dejarlo dejaba la clave «a medias» para siempre — el reintento que el mensaje pedía
    // contestaba 409, y la única salida era tocar un campo, que creaba un SEGUNDO conjunto.
    // Sólo cuenta como borrado si Meta lo confirma; si no, la fila lo sigue nombrando.
    // Con anuncios adentro no se toca: eso es «a medias» de verdad, como en un lote.
    const hecho = creado as { adset_id: string; ad_ids: string[]; creative_ids: string[] } | null;
    let revertido = false;
    if (hecho && hecho.ad_ids.length === 0) {
      revertido = await deleteEntity(hecho.adset_id).catch(() => false);
      if (revertido) {
        for (const cid of hecho.creative_ids) await deleteEntity(cid).catch(() => false);
        creado = null;
      }
    }
    await persist({ status: 'error', error: env.message + (revertido ? ' (revertido)' : ''), ...ids() });
    console.error(`[ads-manager:adset-add POST] ${env.message}${revertido ? ' (conjunto vacío borrado)' : ''}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode, rolledBack: revertido }, { status: env.status });
  }
}
