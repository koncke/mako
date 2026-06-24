// =============================================================================
// /api/meta-recommendations — espejo HONESTO de las recomendaciones de Meta
// =============================================================================
// Llama directo al edge real act_<id>/recommendations + el opportunity_score de
// la cuenta. SIN intervención de MaKo: si Meta no devuelve nada, devolvemos
// empty:true con el motivo probable (no inventamos recomendaciones).
//
// Hoy devuelve vacío porque (1) la cuenta tiene error de pago (account_status=3)
// y (2) el token es de tipo PÁGINA. Con un User/System-User token y el pago al
// día, este mismo endpoint trae las recomendaciones + el opportunity score.

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';

type Reco = { titulo: string; detalle: string; importancia: string; codigo: string | null };

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const ver = process.env.META_API_VERSION;
  const token = process.env.META_ACCESS_TOKEN;
  const acct = process.env.META_AD_ACCOUNT_ID;
  if (!ver || !token || !acct) return Response.json({ ok: false, message: 'Meta no configurado' }, { status: 500 });

  async function get(url: string) {
    const r = await fetch(url, { cache: 'no-store' });
    return r.json().catch(() => ({}));
  }

  try {
    const recoUrl = new URL(`${GRAPH}/${ver}/${acct}/recommendations`);
    recoUrl.searchParams.set('locale', 'es_MX');
    recoUrl.searchParams.set('access_token', token);

    const accUrl = new URL(`${GRAPH}/${ver}/${acct}`);
    accUrl.searchParams.set('fields', 'opportunity_score');
    accUrl.searchParams.set('access_token', token);

    const [recoRes, accRes] = await Promise.all([get(recoUrl.toString()), get(accUrl.toString())]);

    if (recoRes && recoRes.error) {
      const e = recoRes.error as { code?: number; error_subcode?: number; message?: string };
      return Response.json({ ok: false, code: e.code, error_subcode: e.error_subcode, message: e.message }, { status: 502 });
    }

    const rows: Record<string, unknown>[] = Array.isArray(recoRes?.data) ? recoRes.data : [];
    const recomendaciones: Reco[] = rows.map((o) => ({
      titulo: String(o.title ?? 'Recomendación de Meta'),
      detalle: String(o.message ?? ''),
      importancia: String(o.importance ?? '').toUpperCase(),
      codigo: o.code != null ? String(o.code) : null,
    }));
    const opportunityScore = num(accRes?.opportunity_score);

    const empty = recomendaciones.length === 0 && opportunityScore === null;
    return Response.json({
      ok: true,
      opportunityScore,
      recomendaciones,
      empty,
      ...(empty
        ? { reason: 'Meta no devuelve recomendaciones por API para esta cuenta ahora mismo. Con el token correcto (System User + ads_management), el bloqueo restante suele ser la cuenta restringida por pago (account_status=3) y/o la 2FA obligatoria de la empresa. Al resolver el pago y la 2FA del admin, este endpoint trae las recomendaciones del Ads Manager.' }
        : {}),
    });
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
