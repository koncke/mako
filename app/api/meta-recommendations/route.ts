// =============================================================================
// /api/meta-recommendations — espejo HONESTO de las recomendaciones de Meta
// =============================================================================
// Llama directo al edge real act_<id>/recommendations + el opportunity_score de
// la cuenta. SIN intervención de MaKo: si Meta no devuelve nada, devolvemos
// empty:true con el motivo probable (no inventamos recomendaciones).
//
// ⚠️ DOS BUGS VIVIERON ACÁ, y los dos hacían que la pantalla mintiera. Medidos y
// cerrados el 2026-09-08:
//
// 1) La forma. El edge de CUENTA devuelve `data[].recommendations[]` con
//    `recommendation_content.body`, no `data[]` con `title`/`message`/`importance`
//    (esa es la forma del campo `recommendations` de un NODO). Con la cuenta del
//    dueño Meta devolvía 5 recomendaciones y score 81, y el modal pintaba UNA
//    tarjeta vacía. El parser real vive en lib/meta-recos-cuenta.ts.
//
// 2) El motivo. Cuando venía vacío, la respuesta traía un párrafo FIJO que
//    culpaba al token de página, a la cuenta impaga (account_status=3) y a la 2FA
//    — cosas ciertas para la cuenta del dueño en junio y falsas para todas las
//    demás. La cuenta de Código Inmobiliario (ws13) está account_status=1, con
//    ads_management + ads_read + business_management concedidos, y aun así leía
//    "resolvé el pago y la 2FA". El motivo AHORA se arma con el estado real que
//    Meta acaba de contestar. Nunca vuelvas a hardcodear un diagnóstico acá:
//    si el motivo no sale de la respuesta, es una adivinanza con cara de dato.

import { credWs, integracionConectada } from '@/lib/credenciales';
import { accountStatusLabel, disableReasonLabel } from '@/lib/meta-health';
import { parseRecosCuenta, type RecoCuenta } from '@/lib/meta-recos-cuenta';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com';

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Por qué Meta no devolvió nada, según lo que Meta MISMO acaba de decir de la
 * cuenta. Tres ramas y ninguna inventada:
 *   · cuenta frenada  → el estado real + el disable_reason, con su etiqueta;
 *   · cuenta activa   → no hay nada que reportar, y se dice así de claro;
 *   · sin datos de cuenta → se admite que no se pudo leer, no se rellena.
 */
function motivoVacio(acc: Record<string, unknown> | null): string {
  const status = num(acc?.account_status);
  if (status == null) {
    return 'Meta no devolvió recomendaciones y tampoco pudimos leer el estado de la cuenta para explicar por qué. Reintenta en un minuto; si sigue igual, revisa el token en Integraciones → Meta Ads.';
  }
  if (status !== 1) {
    const razon = disableReasonLabel(num(acc?.disable_reason) ?? 0);
    return `Tu cuenta publicitaria está "${accountStatusLabel(status)}"${razon ? ` (${razon})` : ''}. Mientras la cuenta no entrega, Meta deja de generar recomendaciones. Resuélvelo en el Administrador de Anuncios y vuelve a analizar.`;
  }
  return 'Tu cuenta está activa y el token tiene los permisos necesarios: no es un problema de configuración. Meta simplemente no tiene recomendaciones para esta cuenta ahora mismo — las genera a partir de campañas corriendo con gasto suficiente, así que en cuentas nuevas o con poca actividad la lista viene vacía. Vuelve a analizar cuando lleves unos días entregando.';
}

export async function GET() {
  // Fase 1: Meta es la integración global del dueño. Otros workspaces reciben el
  // shape de éxito "sin datos" — pero CON motivo: sin él el modal pintaba el
  // recuadro de advertencia con el párrafo en blanco.
  if (!(await integracionConectada('meta'))) {
    return Response.json({
      ok: true, opportunityScore: null, recomendaciones: [], empty: true,
      reason: 'Todavía no está conectada tu cuenta de Meta en este espacio de trabajo. Cárgala en Integraciones → Meta Ads y vuelve a analizar.',
    });
  }

  const ver = process.env.META_API_VERSION;
  const token = await credWs('META_ACCESS_TOKEN'); // por-workspace
  const acct = await credWs('META_AD_ACCOUNT_ID'); // por-workspace
  if (!ver || !token || !acct) return Response.json({ ok: false, message: 'Meta no configurado' }, { status: 500 });

  async function get(url: string) {
    const r = await fetch(url, { cache: 'no-store' });
    return r.json().catch(() => ({}));
  }

  try {
    const recoUrl = new URL(`${GRAPH}/${ver}/${acct}/recommendations`);
    recoUrl.searchParams.set('locale', 'es_MX');
    recoUrl.searchParams.set('access_token', token);

    // account_status + disable_reason viajan acá para poder EXPLICAR un vacío.
    // Sin ellos, el "por qué" solo puede ser un párrafo escrito de antemano.
    const accUrl = new URL(`${GRAPH}/${ver}/${acct}`);
    accUrl.searchParams.set('fields', 'opportunity_score,account_status,disable_reason');
    accUrl.searchParams.set('access_token', token);

    const [recoRes, accRes] = await Promise.all([get(recoUrl.toString()), get(accUrl.toString())]);

    if (recoRes && recoRes.error) {
      const e = recoRes.error as { code?: number; error_subcode?: number; message?: string };
      return Response.json({ ok: false, code: e.code, error_subcode: e.error_subcode, message: e.message }, { status: 502 });
    }

    const recomendaciones: RecoCuenta[] = parseRecosCuenta(recoRes);
    const opportunityScore = num(accRes?.opportunity_score);
    // El estado solo se toma si Meta lo contestó de verdad: un error en esa
    // llamada no puede convertirse en "no pudimos leer" Y en un diagnóstico.
    const acc = accRes && !accRes.error ? (accRes as Record<string, unknown>) : null;

    const empty = recomendaciones.length === 0 && opportunityScore === null;
    return Response.json({
      ok: true,
      opportunityScore,
      recomendaciones,
      empty,
      ...(empty ? { reason: motivoVacio(acc) } : {}),
    });
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
