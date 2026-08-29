// =============================================================================
// /api/ads-manager/ad-aprobacion — ¿Meta retuvo estos anuncios esperando el OK?
// =============================================================================
// GET ?ids=<id1,id2,…>[&campana=<nombre>] → { pendientes, leidos, accountId }
//
// Meta tiene un control de seguridad ("aprobación de pares") que retiene los
// anuncios recién publicados hasta que un usuario de confianza o un admin del
// portfolio dueño los apruebe A MANO en Ads Manager (issues_info error_code
// 2446984). NO se puede aprobar por API — los edges /confirm, /approve, /review
// y /appeal no existen en la Graph API. Por eso esta ruta solo LEE de Meta: sirve
// para que, al terminar de publicar, la app no cante "listo" cuando en realidad
// el anuncio no va a entregar hasta que el dueño entre a Meta.
//
// Además AVISA por WhatsApp (emitirAviso) con el link exacto: el dueño puede
// cerrar la pestaña y enterarse recién días después de que nada entregó. El
// dedup corto evita repetir el aviso en los reintentos del wizard.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAdsAprobacionPendiente, getAdAccountId, metaErrorEnvelope } from '@/lib/meta-ads-create';
import { guardAdsDueno } from '@/lib/ads-guard';
import { emitirAviso } from '@/lib/avisos';
import { linkAprobarEnMeta } from '@/lib/meta-health-ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const no = await guardAdsDueno(); if (no) return no;
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return Response.json({ ok: false, error: 'faltan ids' }, { status: 400 });
  if (ids.some((id) => !/^\d+$/.test(id))) return Response.json({ ok: false, error: 'ids inválidos' }, { status: 400 });
  const campana = (req.nextUrl.searchParams.get('campana') ?? '').trim().slice(0, 120);
  try {
    const [r, accountId] = await Promise.all([getAdsAprobacionPendiente(ids), getAdAccountId()]);
    if (r.pendientes.length > 0) await avisarPorWhatsApp(r.pendientes, accountId, campana);
    return Response.json({ ok: true, ...r, accountId });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:ad-aprobacion] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

/** Aviso al dueño con el link exacto. Best-effort: emitirAviso nunca lanza, y si
 * WhatsApp está caído igual queda en el feed in-app. El dedup de 10 min cubre los
 * reintentos del wizard (que consulta 3 veces en ~7 segundos) sin tapar una
 * publicación posterior de verdad. */
async function avisarPorWhatsApp(
  pendientes: Array<{ id: string; name: string }>,
  accountId: string,
  campana: string,
): Promise<void> {
  const n = pendientes.length;
  const link = linkAprobarEnMeta(accountId, pendientes[0]?.id);
  const donde = campana ? ` en "${campana}"` : '';
  const cuales = n === 1 ? `el anuncio "${pendientes[0].name}"` : `*${n} anuncios*`;
  const texto =
    `🟡 Publiqué ${cuales}${donde} pero *Meta los retuvo*: por seguridad pide que un admin de la cuenta los apruebe a mano antes de que empiecen a correr.\n\n` +
    `No lo puedo hacer yo — Meta no lo permite por API. Son 30 segundos:\n\n👉 ${link}\n\n` +
    `Entras, tocas *Revisar y publicar* y confirmas. Si no, quedan sin entregar. — MaKo`;
  await emitirAviso({
    tipo: 'meta-anuncio-espera-aprobacion',
    titulo: n === 1 ? 'Meta espera que apruebes 1 anuncio' : `Meta espera que apruebes ${n} anuncios`,
    texto,
    categoria: 'aviso',
    semaforo: 'amarillo',
    link: '/ads-manager',
    dedupTtlMin: 10,
  });
}
