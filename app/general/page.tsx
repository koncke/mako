// =============================================================================
// /general — Vista General (rediseño Marketing OS)
// =============================================================================
// Hero "Camino a los N cierres" + Resumen del mes + Semáforo + Pendientes.
// Cableado a las queries existentes (objetivo, comparativo MTD, pendientes,
// señales para el semáforo).

import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  getResumenComparativo,
  getPendientesDeMarcar,
  getObjetivoProgreso,
  getResumenComercialMaduras,
  getFatigaAdsets,
  getTramoJ1J2Reciente,
  getAgendasBreakdown,
  getSenalesRecon,
  compareMTD,
  type ResumenComparativo,
  type Pendientes,
  type ObjetivoProgreso,
  type MetricaMTD,
  type AgendaItem,
  type SenalRecon,
} from '@/lib/queries';
import { fmtUSD, fmtNum } from '@/lib/format';
import { DIAS_J1_J2_ALERTA } from '@/lib/config';
import { getCuotasPendientes, getRevenueBreakdowns, type RevItem, type RevenueBreakdowns } from '@/lib/pagos';
import { getMetaAccountHealth } from '@/lib/meta-health';
import { hoyEnTijuana, ayerEnTijuana } from '@/lib/date-utils';
import { EditarMeta } from './EditarMeta';
import { DesgloseTrigger, type DesgloseItem, type DesgloseData } from '../_components/Desglose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";
function fmtDMY(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
function revItemsToDesglose(items: RevItem[], fechaLabel: string, focus = 'plan-pagos'): DesgloseItem[] {
  return items.map((it) => ({
    nombre: it.nombre,
    valor: fmtUSD(it.monto),
    detalle: `${it.detalle ? `${it.detalle} · ` : ''}${fechaLabel} ${fmtDMY(it.fecha)}`,
    leadId: it.leadId,
    focus,
  }));
}

type Nivel = 'rojo' | 'ambar' | 'verde';
type Alerta = { nivel: Nivel; titulo: string; detalle: string; href: string; hrefLabel: string; desglose?: DesgloseData };

export default async function GeneralPage() {
  const hoy = hoyEnTijuana();
  const ayer = ayerEnTijuana();

  const [objR, compR, pendR, madR, fatR, tramoR, cuotasR, saludR] = await Promise.allSettled([
    getObjetivoProgreso(hoy),
    getResumenComparativo(ayer),
    getPendientesDeMarcar(hoy),
    getResumenComercialMaduras(),
    getFatigaAdsets(hoy),
    getTramoJ1J2Reciente(hoy, 60),
    getCuotasPendientes(hoy),
    getMetaAccountHealth(),
  ]);

  const objetivo = objR.status === 'fulfilled' ? objR.value : null;
  const comparativo = compR.status === 'fulfilled' ? compR.value : null;
  const pendientes: Pendientes = pendR.status === 'fulfilled' ? pendR.value : { items: [], total: 0, porTipo: { A: 0, B: 0, C: 0, M: 0 } };
  const maduras = madR.status === 'fulfilled' ? madR.value : null;
  const fatiga = fatR.status === 'fulfilled' ? fatR.value : [];
  const tramo = tramoR.status === 'fulfilled' ? tramoR.value : { promedio: null, n: 0 };
  const cuotas = cuotasR.status === 'fulfilled' ? cuotasR.value : { vencidas: [], porVencer: [] };
  const saludMeta = saludR.status === 'fulfilled' ? saludR.value : null;

  // Desgloses (una sola ola paralela):
  //  - Hero del objetivo: breakdowns en [objetivo.desde, hoy] (.sold cierres, .cash pagos).
  //  - Resumen del mes: misma ventana MTD que getResumenComparativo(ayer).
  const mtd = compareMTD(ayer);
  let breakdowns: RevenueBreakdowns = { sold: [], cash: [], outstanding: [] };
  let mtdBreak: RevenueBreakdowns = { sold: [], cash: [], outstanding: [] };
  let agendasMTD: AgendaItem[] = [];
  let senalesMTD: SenalRecon[] = [];
  try {
    const [objBreak, mtdB, agMTD, senMTD] = await Promise.all([
      objetivo ? getRevenueBreakdowns(objetivo.desde, hoy) : Promise.resolve(breakdowns),
      getRevenueBreakdowns(mtd.actualInicio, mtd.actualFin),
      getAgendasBreakdown(mtd.actualInicio, mtd.actualFin),
      getSenalesRecon(mtd.actualInicio, mtd.actualFin),
    ]);
    breakdowns = objBreak;
    mtdBreak = mtdB;
    agendasMTD = agMTD;
    senalesMTD = senMTD;
  } catch {
    // degradación elegante: si falla, las cards muestran los números sin desglose.
  }

  // ── Semáforo: alertas accionables (compacto) ──
  const alertas: Alerta[] = [];
  // Salud de la cuenta de Meta (live). UNSETTLED/DISABLED/saldo impago → la cuenta
  // no entrega aunque las campañas figuren ACTIVAS: urgencia roja al tope.
  if (saludMeta && saludMeta.severidad !== 'verde') {
    const esRojo = saludMeta.severidad === 'rojo';
    const saldo = saludMeta.balanceMxn > 0
      ? `Adeudo ~${saludMeta.balanceMxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN${saludMeta.fundingCard ? ` (${saludMeta.fundingCard})` : ''}. `
      : '';
    alertas.push({
      nivel: esRojo ? 'rojo' : 'ambar',
      titulo: esRojo
        ? `Cuenta de Meta: ${saludMeta.statusLabel} — entrega frenada`
        : `Cuenta de Meta: ${saludMeta.statusLabel} — vigilar`,
      detalle: esRojo
        ? `${saldo}Los anuncios figuran ACTIVOS pero la cuenta no está entregando${saludMeta.disableReasonLabel ? ` (${saludMeta.disableReasonLabel})` : ''}. Regularizá el pago en Meta cuanto antes.`
        : `Estado de cuenta "${saludMeta.statusLabel}". La entrega puede estar limitada — revisá el Business Manager.`,
      href: '/marketing/salud', hrefLabel: 'Estado de Meta',
    });
  }
  // Desglose de cuotas (lead · monto · vence · días) con botón Editar lead.
  const cuotaItems = (arr: typeof cuotas.vencidas): DesgloseItem[] => arr.map((c) => ({
    nombre: c.lead_nombre,
    valor: fmtUSD(c.monto_usd),
    detalle: `cuota ${c.numero === 0 ? 'inicial' : c.numero} · vence ${fmtDMY(c.fecha_esperada)} · ${c.dias < 0 ? `${Math.abs(c.dias)}d vencida` : c.dias === 0 ? 'vence hoy' : `en ${c.dias}d`}`,
    leadId: c.lead_id,
    focus: 'plan-pagos',
  }));
  // Cuotas vencidas → URGENTE (rojo); por vencer → vigilar (ámbar).
  if (cuotas.vencidas.length > 0) {
    const tot = cuotas.vencidas.reduce((s, c) => s + c.monto_usd, 0);
    const n = cuotas.vencidas.length;
    alertas.push({
      nivel: 'rojo',
      titulo: `${n} cuota${n === 1 ? '' : 's'} VENCIDA${n === 1 ? '' : 'S'} — cobrar URGENTE (${fmtUSD(tot)})`,
      detalle: `Pagos vencidos sin cobrar (ej: ${cuotas.vencidas[0].lead_nombre}, ${Math.abs(cuotas.vencidas[0].dias)}d de atraso). Cobralos cuanto antes.`,
      href: '/comercial', hrefLabel: 'Comercial',
      desglose: { label: 'Cuotas vencidas', value: fmtUSD(tot), color: 'var(--bad)', items: cuotaItems(cuotas.vencidas), emptyText: 'Sin cuotas vencidas.' },
    });
  }
  if (cuotas.porVencer.length > 0) {
    const n = cuotas.porVencer.length;
    const tot = cuotas.porVencer.reduce((s, c) => s + c.monto_usd, 0);
    alertas.push({
      nivel: 'ambar',
      titulo: `${n} cuota${n === 1 ? '' : 's'} por cobrar pronto`,
      detalle: `Vencen en los próximos días (ej: ${cuotas.porVencer[0].lead_nombre}, en ${cuotas.porVencer[0].dias}d). Tené listo el seguimiento de cobro.`,
      href: '/comercial', hrefLabel: 'Comercial',
      desglose: { label: 'Cuotas por vencer', value: fmtUSD(tot), color: 'var(--warn-fill)', items: cuotaItems(cuotas.porVencer), emptyText: 'Sin cuotas por vencer.' },
    });
  }
  if (tramo.n >= 3 && tramo.promedio !== null && tramo.promedio > DIAS_J1_J2_ALERTA) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Los deals se enfrían entre R1 y R2 (${tramo.promedio.toFixed(1)} días prom.)`,
      detalle: 'Cuanto más tarda la R2, más cae la intención. Agendá la R2 en la misma R1, en vivo.',
      href: '/comercial', hrefLabel: 'Comercial',
    });
  }
  for (const a of fatiga) {
    alertas.push({
      nivel: 'ambar',
      titulo: `Posible fatiga de creativo · ${a.adset_name}`,
      detalle: `Frecuencia 7d ${a.frequency_7d.toFixed(1)} y el costo por lead subió (${fmtUSD(a.cpl_7d_usd)} vs ${fmtUSD(a.cpl_28d_usd)} a 28 días). Rotá el creativo.`,
      href: '/marketing', hrefLabel: 'Marketing',
    });
  }
  if (maduras && maduras.tasa_cierre_madura !== null && maduras.limpias >= 3) {
    if (maduras.tasa_cierre_madura >= 30) {
      alertas.push({
        nivel: 'verde',
        titulo: 'El sistema de venta está sano',
        detalle: 'El ratio de cierre maduro es saludable. Para más cierres, el foco es marketing: más volumen o mejor calidad.',
        href: '/comercial', hrefLabel: 'Comercial',
      });
    } else if (maduras.tasa_cierre_madura < 20) {
      alertas.push({
        nivel: 'rojo',
        titulo: `Tasa de cierre baja: ${maduras.tasa_cierre_madura.toFixed(0)}% en cohortes maduras`,
        detalle: 'Califican pero no cierran. Revisá la oferta y el manejo de objeciones en la R2.',
        href: '/comercial', hrefLabel: 'Comercial',
      });
    }
  }
  const peso: Record<Nivel, number> = { rojo: 0, ambar: 1, verde: 2 };
  alertas.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  const urgentes = alertas.filter((a) => a.nivel === 'rojo').length;
  const vigilar = alertas.filter((a) => a.nivel === 'ambar').length;
  const enOrden = alertas.filter((a) => a.nivel === 'verde').length;

  const meta = objetivo?.cierres_meta ?? 20;
  const actual = objetivo?.cierres_actual ?? 0;
  const faltan = Math.max(meta - actual, 0);
  const cashActual = objetivo?.cash_actual ?? 0;
  const cashMeta = objetivo?.cash_meta ?? 0;
  const cashPct = cashMeta > 0 ? Math.min(100, (cashActual / cashMeta) * 100) : 0;
  const sold = objetivo?.sold_actual ?? 0;

  // Desgloses del "Resumen del mes": inversión (por anuncio) + cierres/cash/agendas (por lead).
  const inversionMTDItems: DesgloseItem[] = senalesMTD
    .filter((s) => s.spend_usd > 0)
    .sort((a, b) => b.spend_usd - a.spend_usd)
    .map((s) => ({
      nombre: s.ad_name,
      valor: fmtUSD(s.spend_usd),
      detalle: [s.campana, s.adset_name].filter(Boolean).join(' · ') || undefined,
    }));
  const mtdDesgloses: Record<string, DesgloseData> = {
    'Ad Spend': {
      label: 'Ad Spend del mes · por anuncio',
      value: fmtUSD(senalesMTD.reduce((s, a) => s + a.spend_usd, 0)),
      color: 'var(--ink)',
      items: inversionMTDItems,
      emptyText: 'Sin gasto a nivel anuncio este mes.',
    },
    Cierres: {
      label: 'Cierres del mes',
      value: String(mtdBreak.sold.length),
      color: 'var(--ink)',
      items: revItemsToDesglose(mtdBreak.sold, 'cierre', 'plan-pagos'),
      emptyText: 'Sin cierres este mes.',
    },
    'Cash Collected': {
      label: 'Cash Collected del mes',
      value: fmtUSD(mtdBreak.cash.reduce((s, i) => s + i.monto, 0)),
      color: 'var(--good)',
      items: revItemsToDesglose(mtdBreak.cash, 'pago', 'plan-pagos'),
      emptyText: 'Sin cobros este mes.',
    },
    Agendas: {
      label: 'Agendas del mes · R1 en el período (CRM)',
      value: String(agendasMTD.length),
      color: 'var(--ink)',
      items: agendasMTD.map((a) => ({
        nombre: a.nombre,
        valor: fmtDMY(a.fecha),
        detalle: a.empresa ?? undefined,
        leadId: a.leadId,
        focus: 'datos-comerciales',
      })),
      emptyText: 'Sin agendas este mes.',
    },
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
        <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Vista General</h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
        <HeroGoal meta={meta} actual={actual} faltan={faltan} cierres30={objetivo?.cierres_30d ?? 0} semanas={objetivo?.semanas_estimadas ?? null} cashActual={cashActual} cashMeta={cashMeta} cashPct={cashPct} sold={sold} cierresMetaRaw={objetivo?.cierres_meta ?? null} cashMetaRaw={objetivo?.cash_meta ?? null} desde={objetivo?.desde ?? ''} cierresItems={revItemsToDesglose(breakdowns.sold, 'cierre')} cashItems={revItemsToDesglose(breakdowns.cash, 'pago')} />

        {comparativo && <ResumenMes c={comparativo} desgloses={mtdDesgloses} />}

        <Semaforo alertas={alertas} urgentes={urgentes} vigilar={vigilar} enOrden={enOrden} />

        <PendientesCard pendientes={pendientes} />

        <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6 }}>
          Datos automáticos · Meta · Calendly · Cobranza. Montos en USD.
        </footer>
      </div>
    </main>
  );
}

function HeroGoal({ meta, actual, faltan, cierres30, semanas, cashActual, cashMeta, cashPct, sold, cierresMetaRaw, cashMetaRaw, desde, cierresItems, cashItems }: {
  meta: number; actual: number; faltan: number; cierres30: number; semanas: number | null;
  cashActual: number; cashMeta: number; cashPct: number; sold: number;
  cierresMetaRaw: number | null; cashMetaRaw: number | null; desde: string;
  cierresItems: DesgloseItem[]; cashItems: DesgloseItem[];
}) {
  const blocks = Math.min(meta, 40);
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--sidebar)', border: '1px solid var(--sidebar-2)', borderRadius: 22, padding: '38px 40px', color: 'var(--on-sidebar)' }}>
      <div style={{ position: 'absolute', top: -140, right: -90, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle,rgba(240,198,10,.20),transparent 68%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -180, left: '30%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,135,12,.10),transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent-soft)', marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-soft)', boxShadow: '0 0 10px var(--accent-soft)' }} />El norte del negocio
            </div>
            <h2 style={{ fontWeight: 700, fontSize: 46, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, color: 'var(--on-sidebar)' }}>Camino a los {meta} cierres</h2>
          </div>
          <EditarMeta cierresMeta={cierresMetaRaw} cashMeta={cashMetaRaw} desde={desde} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', margin: '34px 0 18px' }}>
          <DesgloseTrigger
            data={{ label: 'Cierres hacia la meta', value: `${actual} / ${meta}`, color: 'var(--accent)', items: cierresItems, emptyText: 'Aún no hay cierres en este objetivo.' }}
            style={{ width: 'auto', display: 'inline-block' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 108, lineHeight: 0.78, letterSpacing: '-0.05em', color: 'var(--accent-soft)', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 40px rgba(240,198,10,.35)' }}>{actual}</span>
              <span style={{ fontWeight: 600, fontSize: 40, letterSpacing: '-0.03em', color: 'rgba(243,245,248,.45)' }}>/{meta}</span>
            </div>
            <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--accent-soft)', marginTop: 8 }}>ver los {actual} cierres →</span>
          </DesgloseTrigger>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', fontWeight: 600, fontSize: 14, padding: '6px 13px', borderRadius: 999, background: 'rgba(240,198,10,.14)', color: 'var(--accent-soft)', border: '1px solid rgba(240,198,10,.25)' }}>▲ +{cierres30} en los últimos 30 días</span>
            <span style={{ fontSize: 15, color: 'var(--sidebar-text)' }}>Faltan <strong style={{ color: 'var(--on-sidebar)' }}>{faltan} cierres</strong>{semanas ? <> · a este ritmo llegás en <strong style={{ color: 'var(--on-sidebar)' }}>~{semanas} semanas</strong></> : null}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {Array.from({ length: blocks }).map((_, i) => {
            const filled = i < actual;
            const isFlag = i === blocks - 1;
            return (
              <div key={i} style={{
                flex: 1, height: 46, borderRadius: 6,
                ...(filled
                  ? { background: 'linear-gradient(180deg,var(--accent-soft),var(--accent))', boxShadow: '0 0 14px rgba(240,198,10,.30)' }
                  : { background: 'rgba(243,245,248,.07)', border: '1px solid rgba(243,245,248,.08)' }),
                ...(isFlag && !filled ? { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 } : {}),
              }}>{isFlag && !filled ? '🏁' : ''}</div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', color: 'var(--sidebar-text)', marginBottom: 30 }}>
          <span>1 bloque = 1 cierre</span><span>META · {meta}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          <DesgloseTrigger
            data={{ label: 'Cash Collected hacia la meta', value: fmtUSD(cashActual), color: 'var(--good)', items: cashItems, emptyText: 'Aún no hay cash cobrado en este objetivo.' }}
          >
            <div style={{ background: 'rgba(243,245,248,.05)', border: '1px solid rgba(243,245,248,.10)', borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--on-sidebar)' }}>Cash Collected hacia la meta</span>
                <span style={{ fontSize: 13.5, color: 'var(--sidebar-text)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(cashActual)} / {fmtUSD(cashMeta)}{cashMeta > 0 ? ` · faltan ${fmtUSD(Math.max(cashMeta - cashActual, 0))}` : ''}</span>
              </div>
              <div style={{ width: '100%', height: 12, borderRadius: 999, background: 'rgba(243,245,248,.08)', overflow: 'hidden' }}>
                <div style={{ width: `${cashPct}%`, height: '100%', borderRadius: 999, background: 'var(--good)', boxShadow: '0 0 12px rgba(28,138,84,.45)' }} />
              </div>
              <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--accent-soft)', marginTop: 12 }}>ver desglose por lead →</span>
            </div>
          </DesgloseTrigger>
          <div style={{ background: 'rgba(243,245,248,.05)', border: '1px solid rgba(243,245,248,.10)', borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)' }}>Sold Revenue (firmado)</span>
              <span style={{ fontWeight: 700, fontSize: 26, color: 'var(--on-sidebar)', fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(sold)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--sidebar-text)', opacity: 0.8, marginTop: 6 }}>Comprometido en contratos — aún no cobrado.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arrow({ m, invertir = false }: { m: MetricaMTD; invertir?: boolean }) {
  if (m.actual === m.anterior) return <span style={{ color: 'var(--faint)', fontSize: 20 }}>→</span>;
  const sube = m.actual > m.anterior;
  const color = invertir ? 'var(--dim)' : sube ? 'var(--good)' : 'var(--bad)';
  return <span style={{ color, fontSize: 20 }}>{sube ? '↑' : '↓'}</span>;
}

function ResumenMes({ c, desgloses }: { c: ResumenComparativo; desgloses: Record<string, DesgloseData> }) {
  const items: Array<{ label: string; m: MetricaMTD; f: (n: number) => string; invertir?: boolean }> = [
    { label: 'Ad Spend', m: c.inversion_usd, f: fmtUSD, invertir: true },
    { label: 'Agendas', m: c.agendas, f: fmtNum },
    { label: 'Cierres', m: c.cierres, f: fmtNum },
    { label: 'Cash Collected', m: c.cash_usd, f: fmtUSD },
  ];
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: '0 0 22px', color: 'var(--ink)' }}>Resumen del mes</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {items.map((it) => {
          const dg = desgloses[it.label];
          const inner = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{it.label}</span>
                {dg && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>ver detalle →</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 28, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{it.f(it.m.actual)}</span>
                <Arrow m={it.m} invertir={it.invertir} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8 }}>{c.etiqueta_anterior}: {it.f(it.m.anterior)}</div>
              <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>proyección: {it.f(it.m.proyeccion)}</div>
            </>
          );
          const cardStyle: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' };
          return dg ? (
            <DesgloseTrigger key={it.label} data={dg} style={cardStyle}>{inner}</DesgloseTrigger>
          ) : (
            <div key={it.label} style={cardStyle}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

function Semaforo({ alertas, urgentes, vigilar, enOrden }: { alertas: Alerta[]; urgentes: number; vigilar: number; enOrden: number }) {
  const lampOn: CSSProperties = { width: 48, height: 48, borderRadius: '50%' };
  const veredicto = urgentes > 0
    ? { title: 'Hay algo urgente que atender', sub: 'Resolvé los focos rojos primero.', color: 'var(--bad)', bg: 'var(--bad-bg)', fill: 'var(--bad)' }
    : vigilar > 0
    ? { title: 'En general bien — hay cosas que vigilar', sub: 'El negocio avanza. Ningún incendio, pero hay focos amarillos que te están costando cierres.', color: 'var(--warn)', bg: 'var(--warn-bg)', fill: 'var(--warn-fill)' }
    : { title: 'El negocio está sano', sub: 'Sin focos activos. Buen momento para empujar volumen.', color: 'var(--good)', bg: 'var(--good-bg)', fill: 'var(--good)' };

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Semáforo del negocio</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--dim)', padding: '6px 11px', borderRadius: 999, background: 'var(--bad-bg)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--bad)' }} /><strong style={{ color: 'var(--ink)' }}>{urgentes}</strong> urgente</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--dim)', padding: '6px 11px', borderRadius: 999, background: 'var(--warn-bg)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--warn-fill)' }} /><strong style={{ color: 'var(--ink)' }}>{vigilar}</strong> vigilar</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--dim)', padding: '6px 11px', borderRadius: 999, background: 'var(--good-bg)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--good)' }} /><strong style={{ color: 'var(--ink)' }}>{enOrden}</strong> en orden</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: '#14161B', borderRadius: 20, padding: '18px 16px', width: 88, alignSelf: 'stretch', justifyContent: 'center' }}>
          <div style={{ ...lampOn, background: 'var(--bad)', ...(urgentes > 0 ? { boxShadow: '0 0 24px 4px rgba(207,78,41,.6)' } : { opacity: 0.18 }) }} />
          <div style={{ ...lampOn, background: 'var(--warn-fill)', ...(urgentes === 0 && vigilar > 0 ? { boxShadow: '0 0 24px 4px rgba(232,179,11,.6)' } : { opacity: 0.18 }) }} />
          <div style={{ ...lampOn, background: 'var(--good)', ...(urgentes === 0 && vigilar === 0 ? { boxShadow: '0 0 24px 4px rgba(28,138,84,.6)' } : { opacity: 0.2 }) }} />
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: veredicto.bg, border: `1px solid ${veredicto.fill}`, borderRadius: 14, padding: '18px 20px' }}>
            <h3 style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', margin: 0, color: veredicto.color }}>{veredicto.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--dim)', margin: '6px 0 0' }}>{veredicto.sub}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertas.length === 0 && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: '4px solid var(--good)', borderRadius: 12, padding: '15px 18px', fontSize: 14, color: 'var(--dim)' }}>Sin alertas activas — todo en orden.</div>
            )}
            {alertas.map((a, i) => {
              const c = a.nivel === 'rojo' ? 'var(--bad)' : a.nivel === 'ambar' ? 'var(--warn-fill)' : 'var(--good)';
              const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `4px solid ${c}`, borderRadius: 12, padding: '15px 18px' };
              const inner = (
                <>
                  <span style={{ flex: 'none', width: 11, height: 11, borderRadius: '50%', background: c }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{a.titulo}</span>
                    <span style={{ display: 'block', fontSize: 13.5, color: 'var(--dim)', marginTop: 2 }}>{a.detalle}</span>
                  </span>
                  <span style={{ flex: 'none', color: 'var(--dim)', fontSize: 14 }}>{a.desglose ? 'ver detalle →' : `${a.hrefLabel} →`}</span>
                </>
              );
              return a.desglose ? (
                <DesgloseTrigger key={i} data={a.desglose} style={rowStyle}>{inner}</DesgloseTrigger>
              ) : (
                <Link key={i} href={a.href} style={rowStyle}>{inner}</Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PendientesCard({ pendientes }: { pendientes: Pendientes }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 34, letterSpacing: '-0.03em', color: pendientes.total > 0 ? 'var(--bad)' : 'var(--good)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{pendientes.total}</span>
            <h2 style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{pendientes.total > 0 ? 'leads sin marcar bloquean la confiabilidad' : 'datos al día — el tablero es confiable'}</h2>
          </div>
        </div>
        {pendientes.total > 0 && (
          <Link href="/pendientes" style={{ flex: 'none', alignSelf: 'center', padding: '12px 20px', borderRadius: 11, background: 'var(--bad)', color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>Marcar pendientes →</Link>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 22 }}>
        {[
          { n: pendientes.porTipo.A, l: 'sin asistencia a R1' },
          { n: pendientes.porTipo.B, l: 'sin R2 ni resolución' },
          { n: pendientes.porTipo.C, l: 'sin asistencia a R2' },
          { n: pendientes.porTipo.M, l: 'nutrición manual vencida' },
        ].map((x) => (
          <div key={x.l} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontWeight: 600, fontSize: 24, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{x.n}</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>{x.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
