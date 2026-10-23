// =============================================================================
// GET /api/flujos/misma-persona?secuencia=<id> — «Misma persona» de WhatsApp de UNA automatización, en minutos (23/10/2026)
// =============================================================================
// Lo pide el lienzo de Automations para decir en la tarjeta de un WhatsApp que sigue a otro con menos espera que «Misma
// persona» cuándo sale de verdad (Martín, por el Cerebro: «Los pasos de una misma automatización hacia el mismo lead no
// pueden quedar trabados por ese tope, o hay que avisarlo claro en la tarjeta del paso»). La suya, o la del negocio si no
// tiene (`personaHorasDeLaAutomatizacion`); 0 = apagada. Sólo lectura: la ve quien ve el lienzo.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getSettingEstricto } from '@/lib/settings';
import { KEY_LIMITES_ENVIO, limitesDeFabrica, limitesVigentes } from '@/lib/limites-envio';
import { leerConfigAutomatizacion } from '@/lib/config-automatizacion-db';
import { personaHorasDeLaAutomatizacion } from '@/lib/config-automatizacion';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || !rol) return Response.json({ ok: false, error: 'Entra al workspace de un cliente.' }, { status: 400 });
  const id = Number(new URL(req.url).searchParams.get('secuencia'));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta la automatización.' }, { status: 400 });
  try {
    const [config, raw] = await Promise.all([leerConfigAutomatizacion(id), getSettingEstricto(KEY_LIMITES_ENVIO)]);
    const horas = personaHorasDeLaAutomatizacion(config, limitesVigentes(raw, limitesDeFabrica(process.env))).whatsapp;
    return Response.json({ ok: true, minutos: horas * 60 });
  } catch (e) {
    console.error('[api/flujos/misma-persona]', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'No pude leerlo.' }, { status: 500 });
  }
}
