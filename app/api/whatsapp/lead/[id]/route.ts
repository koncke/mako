// =============================================================================
// API interna: ficha resumida de un lead para el pop-up de la tab /whatsapp
// =============================================================================
// GET /api/whatsapp/lead/:id → datos clave + comportamiento VSL (sin abrir el
// CRM completo). Liviano: getLead + getVslEngagement, nada de pagos ni auditoría.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  getLead,
  getVslEngagement,
  estadoMadurezLead,
  labelMadurez,
  textoCohorteJ1,
} from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) {
    return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  }
  try {
    const lead = await getLead(idNum);
    if (!lead) return Response.json({ ok: false, error: 'lead no encontrado' }, { status: 404 });

    const vsl = await getVslEngagement(lead.visitor_id);
    const { emoji, label, color } = labelMadurez(estadoMadurezLead(lead));
    const vio = vsl.plays > 0;
    const agendoSinVerVsl = lead.fecha_agenda !== null && lead.visitor_id !== null && !vio;

    return Response.json({
      ok: true,
      ficha: {
        id: lead.id,
        nombre: lead.nombre,
        empresa: lead.empresa,
        email: lead.email,
        telefono: lead.telefono,
        estado: { emoji, label, color },
        textoJ1: textoCohorteJ1(lead.fecha_junta_1),
        estado_lead: lead.estado_lead,
        calificado: lead.calificado,
        cerro: lead.cerro,
        asistio_j1: lead.asistio_j1,
        asistio_j2: lead.asistio_j2,
        monto_cierre_usd: lead.monto_cierre_usd,
        origen: {
          origen_lead: lead.origen_lead,
          campana: lead.meta_campaign_name ?? lead.utm_campaign,
          adset: lead.meta_adset_name,
          anuncio: lead.meta_ad_name,
          utm_source: lead.utm_source,
        },
        comportamiento: {
          sin_datos: vsl.sin_datos,
          plays: vsl.plays,
          max_pct: vsl.max_pct,
          agendoSinVerVsl,
        },
        fechas: {
          created_at: lead.created_at,
          fecha_agenda: lead.fecha_agenda,
          fecha_junta_1: lead.fecha_junta_1,
          fecha_junta_2: lead.fecha_junta_2,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/lead] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
