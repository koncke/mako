// =============================================================================
// GET /api/cron/dolar-blue — el precio en pesos de los planes, al dólar blue del día (16/11/2026)
// =============================================================================
// Schedule (vercel.json): «5 21 * * *» (18:05 en Argentina, después del cierre: el blue de ESE día). Martín: «la automatización
// debería estar creada… para actualizar diariamente al dólar blue del día». Lo hace lib/dolar-blue.ts (`actualizarPesosAlBlue`):
// lee el blue (dolarapi.com o bluelytics; Mercado Pago no lo publica), calcula el precio en pesos de cada plan que ya lo tiene
// (dólares × venta, hacia arriba al millar) y escribe SÓLO eso en el setting `planes.mako`. Con frenos: si la cotización no
// llega, es vieja, o salta más de un 15 % contra los precios en vigor sin que los dos servicios coincidan, no toca nada y deja el
// aviso; un salto grande confirmado se aplica y también se avisa (lib/dolar-blue-reglas.ts). Los links de pago ya emitidos no
// cambian: guardan su monto.
// `?seco=1` dice lo que haría, sin escribir ni avisar.
// Auth: Bearer ${CRON_SECRET} (lib/cron-auth.ts).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { actualizarPesosAlBlue, depsDeProduccion } from '@/lib/dolar-blue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (auth) return auth;
  const enSeco = req.nextUrl.searchParams.get('seco') === '1';
  try {
    const r = await actualizarPesosAlBlue(depsDeProduccion(), { enSeco });
    const que = r.cambios.map((c) => `${c.id} ${c.antes}→${c.despues}`).join(', ');
    console.log(`[cron:dolar-blue] ${r.estado}${r.cotizacion ? ` · blue ${r.cotizacion.venta} (${r.cotizacion.fuente}, ${r.cotizacion.fecha.slice(0, 10)})` : ''}${que ? ` · ${que}` : ''}${r.motivo ? ` · ${r.motivo}` : ''}`);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[cron:dolar-blue]', error);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
