// =============================================================================
// /api/ads-manager/ad-add — agregar anuncios a un conjunto existente (PAUSA)
// =============================================================================
// GET  ?adset_id=<id>              → { name, optimization_goal, needsForm }
// POST { adset_id, creative, name, campaign_id?, campaign_objective?, idem_key? }
//   → crea el creativo + el anuncio (PAUSED)
// POST { adset_id, ads: [{name, creative}], campaign_id?, campaign_name?,
//        adset_name?, prompt?, uso?, idem_key? }
//   → lote del wizard "Subir creativos a una campaña": crea los anuncios en orden
//     (PAUSED) y persiste el registro en meta_campaign_drafts vinculado a la
//     campaña (meta_campaign_id). Si Meta rechaza a mitad de camino NO se revierte
//     (los ya creados están en pausa y no gastan): se devuelve `created` con
//     cuántos entraron para que la UI lo diga tal cual.
//
// IDEMPOTENCIA (tarea #59), en los DOS modos: con `idem_key`, una clave ya usada
// contesta desde su fila en vez de volver a crear. La regla es la del LOTE
// (lib/meta-idempotencia.ts): acá `meta_campaign_id` es la campaña que ya existía, así
// que lo que cuenta es cuántos anuncios entraron. El modo simple no dejaba ningún
// registro; ahora deja uno, como el lote.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getAdsetForAdd, addAdToAdset, metaErrorEnvelope, videosSinProcesar } from '@/lib/meta-ads-create';
import { explicarRechazoPublicacion } from '@/lib/meta-publicar-errores';
import { guardAdsWs } from '@/lib/ads-guard';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import type { Creative } from '@/lib/campaign-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { motivoVideos, videosDeCreativos } from '@/lib/campana-videos';
import { abrirRegistro, claveIdemDe, decidirReintentoLote, salidaAMedias, salidaEsperar, type Decision, type FilaPublicacion, type Salida } from '@/lib/meta-idempotencia';

/**
 * El rechazo de Meta explicado (lib/meta-publicar-errores.ts): la misma traducción que
 * campaign-create. Agregar anuncios a una campaña existente choca con los mismos tres
 * rechazos — post de otra página, app del token en modo desarrollo, ganador sin formulario.
 */
async function mensajeDe(env: { message: string; error_subcode?: number }, creativos: Array<{ source?: string } | undefined>): Promise<string> {
  const reusaGanador = creativos.some((c) => c?.source === 'existing');
  return explicarRechazoPublicacion(env.error_subcode, { reusaGanador }) ?? env.message;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const no = await guardAdsWs(); if (no) return no;
  const adsetId = req.nextUrl.searchParams.get('adset_id') ?? '';
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });
  try {
    return Response.json({ ok: true, adset: await getAdsetForAdd(adsetId) });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:ad-add GET] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

type BatchAd = { name?: string; creative?: Creative };
type Body = {
  adset_id?: string;
  // modo simple (AgregarAnuncioModal): un anuncio (campaign_id y campaign_objective, compartidos)
  creative?: Creative; name?: string;
  // modo lote (wizard "Subir creativos a una campaña")
  ads?: BatchAd[]; campaign_id?: string | null; campaign_name?: string | null; campaign_objective?: string | null; adset_name?: string | null;
  prompt?: string; uso?: unknown;
  idem_key?: unknown;
};

// Un ganador reusado viaja con su ad id; validarlo acá evita que un id armado
// (p.ej. "act_x/campaigns?…") se interpole crudo en el path de la Graph API.
function creativoInvalido(c: Creative): string | null {
  if (c.source === 'existing') {
    if (!/^\d+$/.test(String(c.source_ad_id ?? ''))) return 'source_ad_id inválido';
  }
  return null;
}

/** El modo simple es UN anuncio: si la fila ya tiene su anuncio, ése es el resultado
 *  (aunque haya quedado en 'error' por un corte después de crearlo). */
function responderSimple(d: Decision, fila: FilaPublicacion): Salida {
  if (d.tipo === 'devolver' || (d.tipo === 'a-medias' && fila.meta_ad_ids.length > 0)) {
    return { status: 200, cuerpo: { ok: true, repetida: true, ad_id: fila.meta_ad_ids[0] ?? null, creative_id: fila.meta_creative_ids[0] ?? null } };
  }
  if (d.tipo === 'a-medias') return salidaAMedias();
  return salidaEsperar();
}

/** El lote: 'a-medias' con la misma forma que un parcial con respuesta (`created`), así el
 *  cliente recorta los que entraron y reintenta sólo el resto — con otra clave. */
function responderLote(d: Decision, fila: FilaPublicacion): Salida {
  if (d.tipo === 'devolver') return { status: 200, cuerpo: { ok: true, repetida: true, ad_ids: fila.meta_ad_ids, creative_ids: fila.meta_creative_ids } };
  if (d.tipo === 'a-medias') {
    return d.creados > 0
      ? salidaAMedias({ error: 'Se cortó a mitad del lote.', created: d.creados, ad_ids: fila.meta_ad_ids, creative_ids: fila.meta_creative_ids })
      : salidaAMedias();
  }
  return salidaEsperar();
}

const sinProcesar = async (creativos: Array<Creative | undefined>): Promise<string | null> =>
  motivoVideos(await videosSinProcesar(videosDeCreativos(creativos)).catch(() => null));

/**
 * El objetivo de la campaña destino, como lo manda el navegador (sale del árbol de Meta que
 * la tabla ya tiene). ⚠️ Si no vino, la fila lo DICE: la columna tiene default
 * 'OUTCOME_LEADS' (mig 0157), y dejarlo caer ahí afirmaba «Leads» sobre una campaña de
 * Tráfico — `listar_publicaciones_mako_meta` se lo leía así al dueño (revisión de la #59).
 * Sin `export`: un route.ts sólo exporta sus métodos y su config.
 */
const OBJETIVO_DESCONOCIDO = 'DESCONOCIDO';
function objetivoDelBody(x: unknown): string {
  return typeof x === 'string' && /^[A-Z_]{3,40}$/.test(x) ? x : OBJETIVO_DESCONOCIDO;
}

export async function POST(req: NextRequest) {
  const no = await guardAdsWs(); if (no) return no;
  let body: Body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const adsetId = String(body.adset_id ?? '');
  if (!/^\d+$/.test(adsetId)) return Response.json({ ok: false, error: 'adset_id inválido' }, { status: 400 });
  const idem = claveIdemDe(body.idem_key);
  if (!idem.ok) return Response.json({ ok: false, error: 'idem_key inválida' }, { status: 400 });

  // Registro local (best-effort sin clave, estricto con clave, como campaign-create): la
  // campaña ya existe en Meta, acá solo se anota QUÉ anuncios le agregó MaKo.
  let supabase: SupabaseClient | null = null;
  try { supabase = getSupabaseServer(); } catch { supabase = null; }
// ⚠️ meta_campaign_drafts es POR CLIENTE (mig 0157) y la columna no tiene default a
// propósito: se escribe el workspace explícito, el MISMO sobre cuya cuenta de Meta
// crea lib/meta-ads-create.ts (`getWorkspaceActual() ?? OWNER_WS`). Sin esto el insert
// falla por not null — y como es best-effort, no quedaría ningún registro.
  const wsDraft = (await getWorkspaceActual()) ?? OWNER_WS;
  const campaignId = body.campaign_id && /^\d+$/.test(String(body.campaign_id)) ? String(body.campaign_id) : null;

  // ── modo simple (AgregarAnuncioModal: un creativo, un anuncio) ──
  if (!Array.isArray(body.ads)) {
    if (!body.creative || typeof body.creative !== 'object') return Response.json({ ok: false, error: 'falta el creativo' }, { status: 400 });
    const creative = body.creative;
    const inv = creativoInvalido(creative);
    if (inv) return Response.json({ ok: false, error: inv }, { status: 400 });
    const name = (body.name ?? '').trim() || 'Anuncio nuevo';
    // El video, ANTES de crear nada (tarea #59).
    const motivo = await sinProcesar([creative]);
    if (motivo) return Response.json({ ok: false, estado: 'videos', error: motivo }, { status: 409 });
    const apertura = await abrirRegistro({
      db: supabase, ws: wsDraft, clave: idem.clave, decidir: decidirReintentoLote, responder: responderSimple,
      insertar: (db, conClave) => db.from('meta_campaign_drafts').insert({
        workspace_id: wsDraft,
        name: `${name} — +1 anuncio`, status: 'creando', objective: objetivoDelBody(body.campaign_objective),
        spec: { adsets: [{ ads: [{ name, creative }] }] },
        meta_campaign_id: campaignId, meta_adset_ids: [adsetId],
        ...(conClave ? { idem_key: idem.clave } : {}),
      }).select('id').single(),
      reclamo: { name: `${name} — +1 anuncio`, spec: { adsets: [{ ads: [{ name, creative }] }] }, meta_ad_ids: [], meta_creative_ids: [] },
    });
    if ('salida' in apertura) return Response.json(apertura.salida.cuerpo, { status: apertura.salida.status });
    const draftId = apertura.registro.draftId;
    const persist = async (patch: Record<string, unknown>) => {
      if (!supabase || draftId == null) return;
      try { await supabase.from('meta_campaign_drafts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', draftId).eq('workspace_id', wsDraft); } catch { /* noop */ }
    };
    try {
      const r = await addAdToAdset(adsetId, creative, name);
      await persist({ status: 'publicada', error: null, meta_ad_ids: [r.ad_id], meta_creative_ids: [r.creative_id] });
      return Response.json({ ok: true, ...r });
    } catch (err) {
      const env = metaErrorEnvelope(err);
      const mensaje = await mensajeDe(env, [creative]);
      await persist({ status: 'error', error: mensaje });
      console.error(`[ads-manager:ad-add POST] ${env.message} (subcode ${env.error_subcode ?? '-'})`);
      return Response.json({ ok: false, error: mensaje, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
    }
  }

  // ── modo lote ──
  const ads = body.ads;
  if (ads.length === 0) return Response.json({ ok: false, error: 'sin anuncios para crear' }, { status: 400 });
  if (ads.length > 20) return Response.json({ ok: false, error: 'máximo 20 anuncios por lote (divídelo en tandas)' }, { status: 400 });
  if (ads.some((a) => !a.creative || typeof a.creative !== 'object')) return Response.json({ ok: false, error: 'cada anuncio necesita su creativo' }, { status: 400 });
  for (const a of ads) {
    const inv = creativoInvalido(a.creative as Creative);
    if (inv) return Response.json({ ok: false, error: inv }, { status: 400 });
  }
  // Los videos, ANTES de crear el primero (tarea #59): un lote no se revierte, así que un
  // video sin procesar en el puesto 4 dejaba tres anuncios creados y el resto afuera.
  const motivo = await sinProcesar(ads.map((a) => a.creative));
  if (motivo) return Response.json({ ok: false, estado: 'videos', error: motivo }, { status: 409 });

  const nombreLote = `${(body.campaign_name ?? '').trim() || 'Campaña existente'} — +${ads.length} anuncio${ads.length === 1 ? '' : 's'}`;
  const specLote = { name: body.campaign_name ?? null, adsets: [{ name: body.adset_name ?? null, ads }] };
  const apertura = await abrirRegistro({
    db: supabase, ws: wsDraft, clave: idem.clave, decidir: decidirReintentoLote, responder: responderLote,
    insertar: (db, conClave) => db.from('meta_campaign_drafts').insert({
      workspace_id: wsDraft,
      name: nombreLote,
      status: 'creando',
      // El objetivo real de la campaña destino; si no vino, «DESCONOCIDO», nunca el default
      // de la tabla (que afirmaba Leads).
      objective: objetivoDelBody(body.campaign_objective),
      spec: specLote,
      prompt: body.prompt ?? null, uso: body.uso ?? null,
      meta_campaign_id: campaignId, meta_adset_ids: [adsetId],
      ...(conClave ? { idem_key: idem.clave } : {}),
    }).select('id').single(),
    reclamo: { name: nombreLote, spec: specLote, prompt: body.prompt ?? null, uso: body.uso ?? null, meta_ad_ids: [], meta_creative_ids: [] },
  });
  if ('salida' in apertura) return Response.json(apertura.salida.cuerpo, { status: apertura.salida.status });
  const draftId = apertura.registro.draftId;
  const persist = async (patch: Record<string, unknown>) => {
    if (!supabase || draftId == null) return;
    try { await supabase.from('meta_campaign_drafts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', draftId).eq('workspace_id', wsDraft); } catch { /* noop */ }
  };

  const ad_ids: string[] = [];
  const creative_ids: string[] = [];
  try {
    // Secuencial a propósito: no chocar con el rate-limit de escritura de Meta. Y cada
    // anuncio se anota apenas entra: es lo que un reintento usa para saber cuántos hay.
    for (let i = 0; i < ads.length; i++) {
      const name = (ads[i].name ?? '').trim() || `Anuncio ${i + 1}`;
      const r = await addAdToAdset(adsetId, ads[i].creative as Creative, name);
      ad_ids.push(r.ad_id); creative_ids.push(r.creative_id);
      await persist({ meta_ad_ids: ad_ids, meta_creative_ids: creative_ids });
    }
    // ⚠️ Los terminales reescriben TODOS los ids que hay en memoria (revisión de la #59): el
    // persist de cada anuncio traga su error, y esta fila es lo único que lee un reintento.
    // Con un intermedio perdido, la fila decía «creados 2» sobre 4 y el reintento recortaba
    // 2 y volvía a crear el 3 y el 4.
    await persist({ status: 'publicada', error: null, meta_ad_ids: ad_ids, meta_creative_ids: creative_ids });
    return Response.json({ ok: true, ad_ids, creative_ids });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    const mensaje = await mensajeDe(env, ads.map((a) => a.creative as { source?: string } | undefined));
    await persist({ status: 'error', error: `${mensaje} (creados ${ad_ids.length}/${ads.length})`, meta_ad_ids: ad_ids, meta_creative_ids: creative_ids });
    console.error(`[ads-manager:ad-add POST lote] ${env.message} (creados ${ad_ids.length}/${ads.length})`);
    return Response.json(
      { ok: false, error: mensaje, code: env.code, error_subcode: env.error_subcode, created: ad_ids.length, ad_ids, creative_ids },
      { status: env.status },
    );
  }
}
