// =============================================================================
// graficos-bloques — los bloques del Dashboard: lo de las tabs viejas que no entra en el agregador
// =============================================================================
// Martín, 11/10/2026 (punto 5): «En Comercial está diferente la parte de "A quién cobrarle", antes era
// un desplegable... Estoy seguro de que había otro dato de lo cobrado total... Y con las opciones de
// "Marcar como cobrada"». Un bloque no pasa por `agregar` (lib/graficos-agregar.ts) porque el agregador
// agrupa por TEXTO y pierde el `lead_id` y el `pago_id`: sin ellos no hay desglose por lead ni «Marcar
// cobrado». Cada pedido devuelve un payload propio de su bloque (los tipos, en
// app/dashboard/bloques/datos-comercial.ts) y lo dibuja app/dashboard/bloques/CuerpoBloque.tsx.
//
// ⚠️ LAS LECTURAS SON LAS DE SIEMPRE. Las mismas funciones que usaba la tab vieja de Comercial
//    (app/comercial/page.tsx hasta 7527b8c2) y que leen los runners de MaKo
//    (lib/api-mako/areas/metricas.run.ts): así la pantalla, WhatsApp y la API no pueden contar
//    distinto. Acá no se escribe ninguna consulta; si un número está mal, se arregla allá.
//
// ⚠️ Los bloques que NO son de Comercial (los de las tabs de Analysts, BLOQUES_EXTRA) se delegan
//    ENTEROS a `datosDeBloquesExtra` (lib/graficos-bloques-extra.ts), que es de otra corrida.
//
// Lo que cada bloque lee (y la cuenta que la tab vieja hacía con eso):
//   revenue        → getRevenuePeriod + getRevenueBreakdowns (Sold y Cash hasta hoy) + getOutstandingDetalle
//                    (con la ventana del Outstanding) + getMrrActivo
//   cobranza       → getOutstandingDetalle (la misma lectura que el Outstanding de revenue)
//   funnel_maduro  → getResumenComercialMaduras + getFunnelMadurasLeads (cuadran exacto) + getCACAcumulado
//   scl            → getSCL + getTramosSCL + getSCLLeads (todo el histórico, como la vieja)
//   cohortes_*     → listCohortesMensuales / listCohortesSemanales + getJ1Leads (para el «ver leads»)

import 'server-only';
import type { BloqueId } from './graficos-catalogo';
import { datosDeBloquesExtra } from './graficos-bloques-extra';
import { getOutstandingDetalle, getRevenueBreakdowns } from './pagos';
import {
  getCACAcumulado, getFunnelMadurasLeads, getJ1Leads, getMrrActivo, getResumenComercialMaduras,
  getRevenuePeriod, getSCL, getSCLLeads, getTramosSCL, listCohortesMensuales, listCohortesSemanales,
} from './queries';
import { getWorkspaceActual } from './workspace';
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import { hoyEnTz } from './date-utils';
import {
  agruparLeadsPorCohorte, armarCobranza, cohortesDelPeriodo, hastaHoy, inicioDe, repartirPedidos, ventanaOutstanding,
  type BloqueComercial, type Cohorte, type DatosCobranza, type DatosCohortes, type DatosComercial, type DatosFunnel,
  type DatosRevenue, type DatosScl,
} from '@/app/dashboard/bloques/datos-comercial';

export type PedidoBloque = { id: string; bloque: BloqueId; desde: string; hasta: string };
export type DatosBloque = { ok: true; datos: unknown } | { ok: false; error: string };

/**
 * Cuántas cohortes se leen de la vista ANTES de recortar al período. La vieja leía las últimas 6/8 y
 * después filtraba, así que un período pasado («El año pasado») quedaba siempre vacío. Se leen más
 * (≈3 años) y se dibujan las 6/8 más recientes DEL período (`cohortesDelPeriodo`).
 */
const LECTURA_COHORTES = { mes: 36, semana: 156 } as const;

/** Lo que comparten los pedidos de una misma corrida: el hoy del negocio y las lecturas ya hechas. */
type Ctx = { hoy: string; tz: string; una: <T>(clave: string, leer: () => Promise<T>) => Promise<T> };

async function contexto(): Promise<Ctx> {
  // El «hoy» es el del NEGOCIO, no el de Tijuana: decide qué cuota está vencida y hasta dónde se mide lo
  // cobrado. Si la zona no se puede averiguar, la de por default (lo mismo que hace el resto de la app).
  const ws = await getWorkspaceActual();
  const tz = ws != null ? await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) : TZ_DEFAULT;
  // Una lectura por clave y por corrida: Revenue y «A quién cobrarle» con el mismo período comparten la
  // de getOutstandingDetalle, así el total de arriba y la tabla de abajo salen del MISMO resultado.
  const memo = new Map<string, Promise<unknown>>();
  const una = <T,>(clave: string, leer: () => Promise<T>): Promise<T> => {
    if (!memo.has(clave)) memo.set(clave, leer());
    return memo.get(clave) as Promise<T>;
  };
  return { hoy: hoyEnTz(tz), tz, una };
}

async function leerRevenue(p: PedidoBloque, c: Ctx): Promise<DatosRevenue> {
  const hasta = hastaHoy(p.desde, p.hasta, c.hoy);
  const ventana = ventanaOutstanding(p.desde, p.hasta);
  const [rev, desglose, out, mrr] = await Promise.all([
    c.una(`rev|${p.desde}|${hasta}`, () => getRevenuePeriod(p.desde, hasta)),
    c.una(`desglose|${p.desde}|${hasta}`, () => getRevenueBreakdowns(p.desde, hasta)),
    c.una(`out|${ventana.desde}|${ventana.hasta}`, () => getOutstandingDetalle(c.hoy, ventana.desde, ventana.hasta)),
    c.una('mrr', () => getMrrActivo(c.hoy)),
  ]);
  return {
    bloque: 'revenue',
    periodo: { desde: p.desde, hasta },
    sold: rev.sold_revenue_usd,
    cash: rev.cash_collected_usd,
    // El Outstanding NO es el `outstanding_usd` de getRevenuePeriod (todo lo no pagado desde el inicio,
    // sin tope): es el de getOutstandingDetalle con la ventana, el mismo que suma «A quién cobrarle».
    outstanding: out.total,
    ventana,
    cierres: rev.cierres_en_periodo,
    primerosPagos: rev.primeros_pagos_en_periodo,
    soldItems: desglose.sold,
    cashItems: desglose.cash,
    outItems: out.cuotas,
    mrr,
  };
}

async function leerCobranza(p: PedidoBloque, c: Ctx): Promise<DatosCobranza> {
  const ventana = ventanaOutstanding(p.desde, p.hasta);
  const out = await c.una(`out|${ventana.desde}|${ventana.hasta}`, () => getOutstandingDetalle(c.hoy, ventana.desde, ventana.hasta));
  const { filas, total } = armarCobranza(out.items, c.hoy);
  return { bloque: 'cobranza', filas, total, ventana, tz: c.tz };
}

async function leerFunnel(p: PedidoBloque, c: Ctx): Promise<DatosFunnel> {
  const [maduras, leads, cac] = await Promise.all([
    c.una(`maduras|${p.desde}|${p.hasta}`, () => getResumenComercialMaduras(p.desde, p.hasta)),
    c.una(`maduras-leads|${p.desde}|${p.hasta}`, () => getFunnelMadurasLeads(p.desde, p.hasta)),
    // El CAC lee TODO el gasto de Meta: si eso falla, el embudo se dibuja igual y la KPI dice que no pudo.
    c.una('cac', () => getCACAcumulado()).catch((e) => {
      console.error(`[graficos-bloques] cac: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }),
  ]);
  return { bloque: 'funnel_maduro', maduras, leads, cac };
}

async function leerScl(c: Ctx): Promise<DatosScl> {
  // Sin período, como la vieja: el ciclo se promedia sobre todo el histórico (con <3 casos, getSCL da null).
  const [scl, tramos, leads] = await Promise.all([
    c.una('scl', () => getSCL()),
    c.una('scl-tramos', () => getTramosSCL()),
    c.una('scl-leads', () => getSCLLeads()),
  ]);
  return { bloque: 'scl', scl, tramos, leads };
}

async function leerCohortes(p: PedidoBloque, bloque: 'cohortes_mes' | 'cohortes_semana', c: Ctx): Promise<DatosCohortes> {
  const tipo = bloque === 'cohortes_mes' ? 'mes' : 'semana';
  const cohortes: Cohorte[] = tipo === 'mes'
    ? cohortesDelPeriodo(await c.una('cohortes-mes', () => listCohortesMensuales(LECTURA_COHORTES.mes)), tipo, p.desde, p.hasta)
    : cohortesDelPeriodo(await c.una('cohortes-semana', () => listCohortesSemanales(LECTURA_COHORTES.semana)), tipo, p.desde, p.hasta);
  if (!cohortes.length) return { bloque, cohortes, leads: {} };
  // Los leads se leen desde la cohorte más vieja que se dibuja (la vieja leía siempre 370 días).
  const desde = cohortes.map(inicioDe).sort()[0];
  const j1 = await c.una(`j1|${desde}`, () => getJ1Leads(desde));
  return { bloque, cohortes, leads: agruparLeadsPorCohorte(j1, cohortes, tipo) };
}

function leerBloque(p: PedidoBloque, bloque: BloqueComercial, c: Ctx): Promise<DatosComercial> {
  switch (bloque) {
    case 'revenue': return leerRevenue(p, c);
    case 'cobranza': return leerCobranza(p, c);
    case 'funnel_maduro': return leerFunnel(p, c);
    case 'scl': return leerScl(c);
    case 'cohortes_mes':
    case 'cohortes_semana': return leerCohortes(p, bloque, c);
  }
}

export async function datosDeBloques(pedidos: PedidoBloque[]): Promise<Record<string, DatosBloque>> {
  const out: Record<string, DatosBloque> = {};
  const { propios, extra } = repartirPedidos(pedidos);

  const delegados = extra.length
    ? datosDeBloquesExtra(extra).then(
      (r) => {
        for (const p of extra) out[p.id] = r[p.id] ?? { ok: false, error: 'No pude leer los datos' };
      },
      (e) => {
        console.error(`[graficos-bloques] extra: ${e instanceof Error ? e.message : String(e)}`);
        for (const p of extra) out[p.id] = { ok: false, error: 'No pude leer los datos' };
      },
    )
    : Promise.resolve();

  const ctx = propios.length ? await contexto() : null;
  const nuestros = propios.map(async (p) => {
    try {
      out[p.id] = { ok: true, datos: await leerBloque(p, p.bloque as BloqueComercial, ctx!) };
    } catch (e) {
      // El mensaje de la base no es para la pantalla: va al log, y la tarjeta dice que no pudo.
      console.error(`[graficos-bloques] ${p.bloque}: ${e instanceof Error ? e.message : String(e)}`);
      out[p.id] = { ok: false, error: 'No pude leer los datos' };
    }
  });

  await Promise.all([delegados, ...nuestros]);
  return out;
}
