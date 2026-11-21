// =============================================================================
// GET /api/cron/binance-pagos — lee los pagos recibidos por Binance Pay DESDE SÃO PAULO (20/11/2026)
// =============================================================================
// El proyecto corre en `pdx1` (vercel.json) y desde EE. UU. Binance contesta 451 «Service unavailable from a restricted location»: en
// producción nada se verificaba (lib/binance-pay-region.ts). Esta función corre en `gru1` y lee la cuenta DIRECTO
// (`leerDeBinanceDirecto`, la clave de SÓLO LECTURA: un GET a `/sapi/v1/pay/transactions`). La llaman lib/binance-pay.ts desde las otras
// regiones (la captura del grupo, la espera y el pago sin captura del cron de cobros) y quien verifica a mano, con el secreto del cron.
// No la agenda Vercel (tests/cron-registrado.test.ts, `SIN_AGENDA`). `?desde=&hasta=` en ms; la respuesta dice la región donde corrió.
// ⚠️ NO MUEVE PLATA: sólo GET, y adentro un solo GET de lectura a Binance (tests/binance-pay-region.test.ts).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { leerDeBinanceDirecto } from '@/lib/binance-pay-directo';

// ⚠️ LA REGIÓN LA PONE vercel.json (`functions["app/api/cron/binance-pagos/route.ts"].regions = ["gru1"]`), NO un export de este archivo:
// la primera versión la pedía con el export de Next y Vercel la IGNORÓ (medido el 21/11 en los request-logs: los crons de las 00:17 y las
// 00:47 UTC corrieron esta ruta en pdx1 y Binance contestó 451). Es la ÚNICA función fuera de pdx1 (tests/region-funciones.test.ts,
// EXCEPCIONES): las demás corren al lado de la base. Ésta no toca la base: carga sólo el secreto del cron y lib/binance-pay-directo.ts
// (tests/binance-pay-region.test.ts lo fija).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Binance guarda 90 días; más atrás no hay nada que pedir. */
const TOPE_MS = 90 * 86_400_000;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const region = process.env.VERCEL_REGION ?? null;
  const u = new URL(req.url);
  const ahora = Date.now();
  const hasta = Number(u.searchParams.get('hasta') ?? ahora);
  const desde = Number(u.searchParams.get('desde') ?? hasta - 89 * 86_400_000);
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || desde >= hasta || hasta - desde > TOPE_MS) {
    return Response.json({ ok: false, region, error: '`desde` y `hasta` van en milisegundos, desde antes que hasta, y como mucho 90 días' }, { status: 400 });
  }
  const r = await leerDeBinanceDirecto(desde, hasta);
  if (!r.ok) console.warn(`[cron:binance-pagos] desde ${region ?? 'sin región'}: ${r.error}`);
  return Response.json({ ...r, region }, { headers: { 'cache-control': 'no-store' } });
}
