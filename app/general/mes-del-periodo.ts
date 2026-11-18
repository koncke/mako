// =============================================================================
// mes-del-periodo — «El mes» de General armado para un período cualquiera, y los desgloses de sus cuatro números
// =============================================================================
// El bloque «El mes» con el PERÍODO de la hoja (./periodo-de-la-hoja.ts explica qué bloque lo sigue y por qué). Lo que se
// lee es lo mismo que el mes a la fecha de siempre (`getResumenComparativo` y sus desgloses, lib/queries.ts y
// lib/pagos.ts), sobre el período elegido y su anterior del mismo largo.
//
// ⚠️ LAS LECTURAS SE PASAN POR PARÁMETRO (`LecturasDelMes`): el servidor pone las de verdad
//    (./mes-del-periodo-server.ts) y el test unas sobre filas de prueba. Así lo que decide qué rango se lee y qué número
//    sale se EJECUTA en un test, sin una base.
// ⚠️ CADA PARTE FALLA SOLA, como hasta ahora: sin el resumen el bloque dice «No pude leer…»; sin los desgloses, los
//    números se ven igual y no se abren.
// ⚠️ SIN PROYECCIÓN: un período cualquiera no se proyecta a fin de mes (el bloque no la dibuja; «La proyección no
//    vuelve», ./bloques/Negocio.tsx). Va en 0.
// Puro y sin `server-only`: los tipos de lib/queries y lib/pagos entran con `import type`.
// =============================================================================

import { fmtUSD } from '@/lib/format';
import type { AgendaItem, ResumenComparativo, SenalRecon } from '@/lib/queries';
import type { RevItem, RevenueBreakdowns } from '@/lib/pagos';
import type { DesgloseData, DesgloseItem } from '../_components/Desglose';
import { rangoDelResumen } from './periodo-de-la-hoja';

/** Lo que dibuja «El mes»: el resumen contra el anterior (null = no se pudo leer) y el desglose de cada número. */
export type MesDeGeneral = { comparativo: ResumenComparativo | null; desgloses: Record<string, DesgloseData> };

/** «El mes» de UN período: el pedido (la clave con que lo guarda el navegador) y lo que se leyó. */
export type MesDelPeriodo = { desde: string; hasta: string; mes: MesDeGeneral };

export function fmtDMY(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function revItemsToDesglose(items: RevItem[], fechaLabel: string, focus = 'plan-pagos'): DesgloseItem[] {
  return items.map((it) => ({
    nombre: it.nombre,
    valor: fmtUSD(it.monto),
    detalle: `${it.detalle ? `${it.detalle} · ` : ''}${fechaLabel} ${fmtDMY(it.fecha)}`,
    leadId: it.leadId,
    focus,
  }));
}

/**
 * Los desgloses de las cuatro tarjetas (las claves son los rótulos de `ResumenMes`, ./bloques/Negocio.tsx). `cual`: de qué
 * hablan los textos, el mes a la fecha de siempre o el período de la hoja.
 */
export function desglosesDelMes(mtdBreak: RevenueBreakdowns, agendasMTD: AgendaItem[], senalesMTD: SenalRecon[], cual: 'mes' | 'periodo' = 'mes'): Record<string, DesgloseData> {
  const del = cual === 'mes' ? 'del mes' : 'del período';
  const en = cual === 'mes' ? 'este mes' : 'en el período';
  return {
    'Ad Spend': {
      label: `Ad Spend ${del} · por anuncio`,
      value: fmtUSD(senalesMTD.reduce((s, a) => s + a.spend_usd, 0)),
      color: 'var(--ink)',
      items: senalesMTD.filter((s) => s.spend_usd > 0).sort((a, b) => b.spend_usd - a.spend_usd).map((s) => ({
        nombre: s.ad_name,
        valor: fmtUSD(s.spend_usd),
        detalle: [s.campana, s.adset_name].filter(Boolean).join(' · ') || undefined,
      })),
      emptyText: `Sin gasto a nivel anuncio ${en}.`,
    },
    Cierres: {
      label: `Cierres ${del}`,
      value: String(mtdBreak.sold.length),
      color: 'var(--ink)',
      items: revItemsToDesglose(mtdBreak.sold, 'cierre', 'plan-pagos'),
      emptyText: `Sin cierres ${en}.`,
    },
    'Cash Collected': {
      label: `Cash Collected ${del}`,
      value: fmtUSD(mtdBreak.cash.reduce((s, i) => s + i.monto, 0)),
      color: 'var(--good)',
      items: revItemsToDesglose(mtdBreak.cash, 'pago', 'plan-pagos'),
      emptyText: `Sin cobros ${en}.`,
    },
    Agendas: {
      label: `Agendas ${del} · R1 en el período (CRM)`,
      value: String(agendasMTD.length),
      color: 'var(--ink)',
      items: agendasMTD.map((a) => ({
        nombre: a.nombre, valor: fmtDMY(a.fecha), detalle: a.empresa ?? undefined,
        leadId: a.leadId, focus: 'datos-comerciales',
      })),
      emptyText: `Sin agendas ${en}.`,
    },
  };
}

/** Las lecturas de «El mes» sobre un rango (las de `getResumenComparativo` y sus desgloses). */
export type LecturasDelMes = {
  /** Lo gastado en anuncios y las agendas del rango (`getMarketingWindow`). */
  marketing: (desde: string, hasta: string) => Promise<{ spend_usd: number; reuniones_en_ventana: number }>;
  /** Lo cobrado y los cierres del rango (`getRevenuePeriod`). */
  revenue: (desde: string, hasta: string) => Promise<{ cash_collected_usd: number; cierres_en_periodo: number }>;
  desglose: (desde: string, hasta: string) => Promise<RevenueBreakdowns>;
  agendas: (desde: string, hasta: string) => Promise<AgendaItem[]>;
  senales: (desde: string, hasta: string) => Promise<SenalRecon[]>;
};

const CERO_MARKETING = { spend_usd: 0, reuniones_en_ventana: 0 };
const CERO_REVENUE = { cash_collected_usd: 0, cierres_en_periodo: 0 };

/**
 * «El mes» del período pedido, con el `hoy` del NEGOCIO: el rango sale de `rangoDelResumen` (el de un gráfico de la misma
 * hoja). Sin período anterior («Todo»), los números de antes van en 0 y el bloque no compara.
 */
export async function armarMesDelPeriodo(l: LecturasDelMes, pedido: { desde: string; hasta: string }, hoy: string): Promise<MesDeGeneral> {
  const r = rangoDelResumen(pedido, hoy);
  const { desde, hasta } = r.actual;
  const ant = r.anterior;
  const [resumen, partes] = await Promise.all([
    Promise.all([
      l.marketing(desde, hasta),
      l.revenue(desde, hasta),
      ant ? l.marketing(ant.desde, ant.hasta) : Promise.resolve(CERO_MARKETING),
      ant ? l.revenue(ant.desde, ant.hasta) : Promise.resolve(CERO_REVENUE),
    ]).catch(() => null),
    Promise.all([l.desglose(desde, hasta), l.agendas(desde, hasta), l.senales(desde, hasta)]).catch(() => null),
  ]);
  let comparativo: ResumenComparativo | null = null;
  if (resumen) {
    const [mAct, rAct, mAnt, rAnt] = resumen;
    const m = (actual: number, anterior: number) => ({ actual, anterior, proyeccion: 0 });
    comparativo = {
      inversion_usd: m(mAct.spend_usd, mAnt.spend_usd),
      agendas: m(mAct.reuniones_en_ventana, mAnt.reuniones_en_ventana),
      cash_usd: m(rAct.cash_collected_usd, rAnt.cash_collected_usd),
      cierres: m(rAct.cierres_en_periodo, rAnt.cierres_en_periodo),
      etiqueta_anterior: r.etiqueta,
    };
  }
  const desgloses = partes ? desglosesDelMes(partes[0], partes[1], partes[2], 'periodo') : {};
  return { comparativo, desgloses };
}
