// =============================================================================
// datos-comercial-server — lo que lee la hoja Comercial del TELÉFONO: Revenue y «A quién cobrarle»
// =============================================================================
// Hasta el 13/10/2026 esto era lib/graficos-bloques.ts: los datos de los seis BLOQUES de Comercial del
// Dashboard (Revenue, A quién cobrarle, el funnel maduro, el SCL y las cohortes) y el reparto de los de
// Analysts. Los bloques se fueron en v5 (lib/graficos-migrar-v5.ts los convierte en gráficos en el saneo)
// y el escritorio ya no pide ninguno; lo único que seguía leyendo por acá era el teléfono
// (app/m/dashboard/datos.ts, `hojaComercial`), con dos: Revenue y A quién cobrarle. Eso es lo que quedó.
//
// ⚠️ LAS LECTURAS SON LAS DE SIEMPRE. Las mismas funciones que usaba la tab vieja de Comercial
//    (app/comercial/page.tsx hasta 7527b8c2) y que leen los runners de MaKo
//    (lib/api-mako/areas/metricas.run.ts): así la pantalla, WhatsApp y la API no pueden contar
//    distinto. Acá no se escribe ninguna consulta; si un número está mal, se arregla allá.
//
// Lo que se lee (y la cuenta que la tab vieja hacía con eso):
//   revenue   → getRevenuePeriod + getRevenueBreakdowns (Cash hasta hoy, fila por fila) + getOutstandingDetalle
//               (con la ventana del Outstanding)
//   cobranza  → getOutstandingDetalle (la misma lectura que el Outstanding de revenue)

import 'server-only';
import { getOutstandingDetalle, getRevenueBreakdowns, type RevItem } from './pagos';
import { getRevenuePeriod } from './queries';
import { getWorkspaceActual } from './workspace';
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import { hoyEnTz } from './date-utils';
import { armarCobranza, hastaHoy, ventanaOutstanding, type FilaCobro } from './datos-comercial';

/** Lo leído, o por qué no: el mensaje de la base va al log, no a la pantalla. */
export type Leido<T> = { ok: true; datos: T } | { ok: false; error: string };

export type DatosRevenue = {
  /** El período de Sold y Cash (ya acotado a hoy). */
  periodo: { desde: string; hasta: string };
  sold: number;
  cash: number;
  /** El total de la MISMA lectura que «A quién cobrarle» (getOutstandingDetalle), con su ventana. */
  outstanding: number;
  cierres: number;
  /** Los pagos que suman el Cash, uno por fila: las barras del gráfico suman exactamente ese número. */
  cashItems: RevItem[];
};

export type DatosCobranza = {
  filas: FilaCobro[];
  /** La zona del negocio: la fecha de pago de «Marcar cobrado» es HOY en ella, calculado al hacer clic. */
  tz: string;
};

/** Lo que comparten las dos lecturas de una corrida: el hoy del negocio y las lecturas ya hechas. */
type Ctx = { hoy: string; tz: string; una: <T>(clave: string, leer: () => Promise<T>) => Promise<T> };

async function contexto(): Promise<Ctx> {
  // El «hoy» es el del NEGOCIO, no el de Tijuana: decide qué cuota está vencida y hasta dónde se mide lo
  // cobrado. Si la zona no se puede averiguar, la de por default (lo mismo que hace el resto de la app).
  const ws = await getWorkspaceActual();
  const tz = ws != null ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;
  // Una lectura por clave y por corrida: Revenue y «A quién cobrarle» con el mismo período comparten la
  // de getOutstandingDetalle, así el Outstanding y la lista salen del MISMO resultado.
  const memo = new Map<string, Promise<unknown>>();
  const una = <T,>(clave: string, leer: () => Promise<T>): Promise<T> => {
    if (!memo.has(clave)) memo.set(clave, leer());
    return memo.get(clave) as Promise<T>;
  };
  return { hoy: hoyEnTz(tz), tz, una };
}

async function leerRevenue(desde: string, hastaPedido: string, c: Ctx): Promise<DatosRevenue> {
  const hasta = hastaHoy(desde, hastaPedido, c.hoy);
  const ventana = ventanaOutstanding(desde, hastaPedido);
  const [rev, desglose, out] = await Promise.all([
    c.una(`rev|${desde}|${hasta}`, () => getRevenuePeriod(desde, hasta)),
    c.una(`desglose|${desde}|${hasta}`, () => getRevenueBreakdowns(desde, hasta)),
    c.una(`out|${ventana.desde}|${ventana.hasta}`, () => getOutstandingDetalle(c.hoy, ventana.desde, ventana.hasta)),
  ]);
  return {
    periodo: { desde, hasta },
    sold: rev.sold_revenue_usd,
    cash: rev.cash_collected_usd,
    // El Outstanding NO es el `outstanding_usd` de getRevenuePeriod (todo lo no pagado desde el inicio,
    // sin tope): es el de getOutstandingDetalle con la ventana, el mismo que suma «A quién cobrarle».
    outstanding: out.total,
    cierres: rev.cierres_en_periodo,
    cashItems: desglose.cash,
  };
}

async function leerCobranza(desde: string, hasta: string, c: Ctx): Promise<DatosCobranza> {
  const ventana = ventanaOutstanding(desde, hasta);
  const out = await c.una(`out|${ventana.desde}|${ventana.hasta}`, () => getOutstandingDetalle(c.hoy, ventana.desde, ventana.hasta));
  return { filas: armarCobranza(out.items, c.hoy).filas, tz: c.tz };
}

async function leido<T>(nombre: string, leer: () => Promise<T>): Promise<Leido<T>> {
  try {
    return { ok: true, datos: await leer() };
  } catch (e) {
    // El mensaje de la base no es para la pantalla: va al log, y la pantalla dice que no pudo.
    console.error(`[datos-comercial] ${nombre}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude leer los datos' };
  }
}

/**
 * Revenue y «A quién cobrarle» del MISMO período. Las fechas van SIN acotar a hoy: la ventana del
 * Outstanding mira hacia adelante (hasta el fin de mes del período, `ventanaOutstanding`); lo vendido y lo
 * cobrado se acotan adentro (`hastaHoy`). Si no se puede ni averiguar el negocio, rechaza.
 */
export async function leerComercial(desde: string, hasta: string): Promise<{ revenue: Leido<DatosRevenue>; cobranza: Leido<DatosCobranza> }> {
  const ctx = await contexto();
  const [revenue, cobranza] = await Promise.all([
    leido('revenue', () => leerRevenue(desde, hasta, ctx)),
    leido('cobranza', () => leerCobranza(desde, hasta, ctx)),
  ]);
  return { revenue, cobranza };
}
