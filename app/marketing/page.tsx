// =============================================================================
// /marketing — Marketing (rediseño Marketing OS)
// =============================================================================
// KPIs estrella + Salud del Funnel (trapezoides) + Tendencia + Anuncios
// ganadores. Cableado a las queries existentes de Supabase (getMarketingWindow,
// getFunnelEtapas, getFunnelSeries, getSenalesRecon, getTendencias,
// getResumenComparativo). Solo cambia la PRESENTACIÓN — los datos son reales.

import type { CSSProperties } from 'react';
import {
  getMarketingWindow,
  getFunnelEtapas,
  getFunnelSeries,
  getTendencias,
  getSenalesRecon,
  getResumenComparativo,
  getRevenuePeriod,
  type RevenuePeriod,
  type MarketingWindow,
  type FunnelMes,
  type FunnelSeries,
  type Tendencias,
  type SenalRecon,
  type ResumenComparativo,
} from '@/lib/queries';
import {
  ayerEnTijuana,
  hoyEnTijuana,
  esFechaValida,
  primerDiaDelMesDeFecha,
  fmtDDMMYYYY,
} from '@/lib/date-utils';
import { getDataSources, sourcesToMap } from '@/lib/sources';
import Link from 'next/link';
import { FechaFiltro } from '../_components/FechaFiltro';
import { TendenciasSection } from '../_components/TendenciasSection';
import { MakoButton } from '../_components/ChartIA';
import { DesgloseTrigger, type DesgloseItem, type DesgloseData } from '../_components/Desglose';
import { ResumenCreativos } from './ResumenCreativos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-MX').format(Math.round(n));
}

function fmtUSD(n: number | null | undefined, decimals?: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = decimals ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  }).format(n);
}

function fmtX(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}x`;
}

function fmtPeriodoLabel(desde: string, hasta: string): string {
  // Convención del proyecto: fechas en pantalla → dd/mm/aaaa.
  return `${fmtDDMMYYYY(desde)} – ${fmtDDMMYYYY(hasta)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const ayerReal = ayerEnTijuana();
  const hoyReal = hoyEnTijuana();
  const params = await searchParams;
  const desdeParam = params.desde;
  const hastaParam = params.hasta;
  const filtroActivo =
    !!desdeParam &&
    !!hastaParam &&
    esFechaValida(desdeParam) &&
    esFechaValida(hastaParam) &&
    desdeParam <= hastaParam &&
    hastaParam <= hoyReal;

  const rangoDesde = filtroActivo ? desdeParam! : primerDiaDelMesDeFecha(ayerReal);
  const rangoHasta = filtroActivo ? hastaParam! : ayerReal;

  let mkt: MarketingWindow | null = null;
  let funnel: FunnelMes | null = null;
  let funnelSeries: FunnelSeries = {};
  let senales: SenalRecon[] = [];
  let tendencias: Tendencias | null = null;
  let comparativo: ResumenComparativo | null = null;
  let revenue: RevenuePeriod | null = null;
  let errorMsg: string | null = null;

  try {
    // getDataSources ya no serializa al frente: va en la misma ola. getFunnelEtapas
    // necesita el sourceMap, así que corre en una micro-ola posterior — y reusa el
    // getMarketingWindow ya cacheado por-request (cache hit, sin queries extra).
    const [mktR, funnelSeriesR, senalesR, tendenciasR, comparativoR, revenueR, sourceRaw] = await Promise.all([
      getMarketingWindow(rangoDesde, rangoHasta),
      getFunnelSeries(rangoHasta, 12),
      // Anuncios ganadores respeta el filtro global de fecha (antes: 14 días fijos).
      getSenalesRecon(rangoDesde, rangoHasta),
      getTendencias(rangoDesde, rangoHasta),
      filtroActivo ? Promise.resolve(null) : getResumenComparativo(ayerReal),
      getRevenuePeriod(rangoDesde, rangoHasta),
      getDataSources(),
    ]);
    mkt = mktR; funnelSeries = funnelSeriesR; senales = senalesR; tendencias = tendenciasR; comparativo = comparativoR; revenue = revenueR;
    funnel = await getFunnelEtapas(rangoDesde, rangoHasta, sourcesToMap(sourceRaw));
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const periodoLabel = fmtPeriodoLabel(rangoDesde, rangoHasta);

  // Contexto de Tendencias para MaKo.
  const ctxTendencias = tendencias
    ? [
        `Tendencias por período (${periodoLabel}). Períodos: ${tendencias.periodos.join(', ')}.`,
        ...[...tendencias.marketing, ...tendencias.comercial].map((s) => `${s.label} (${s.formato}): ${s.valores.map((v) => (v ?? '—')).join(', ')}`),
      ].join('\n')
    : '';

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
            Performance · {periodoLabel}
          </div>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Marketing</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <Link href="/ads-manager" style={{ padding: '9px 16px', border: '1px solid var(--border-strong)', borderRadius: 11, background: 'transparent', color: 'var(--dim)', fontSize: 14, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap' }}>◫ Ads Manager →</Link>
          <FechaFiltro hoyReal={hoyReal} />
        </div>
      </header>

      {errorMsg || !mkt || !funnel ? (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 16, padding: '24px 28px' }}>
          <p style={{ fontWeight: 600, fontSize: 18, margin: '0 0 4px', color: 'var(--bad)' }}>Error consultando datos</p>
          <p style={{ fontFamily: MONO, fontSize: 14, margin: 0, color: 'var(--dim)' }}>{errorMsg ?? 'Sin datos'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
          <KpisEstrella mkt={mkt} comparativo={comparativo} revenue={revenue} filtroActivo={filtroActivo} senales={senales} />

          <SaludDelFunnel mkt={mkt} funnel={funnel} senales={senales} />

          {tendencias && <TendenciasSection tendencias={tendencias} accion={<MakoButton chartKey="marketing-tendencias" titulo="Tendencias" contexto={ctxTendencias} sugerencias={['¿Qué tendencia ves?', '¿Esto es bueno o malo?', '¿Qué cambió y por qué?', '¿Qué hago al respecto?']} chart={<TendenciasSection tendencias={tendencias} />} />} />}

          <ResumenCreativos desde={rangoDesde} hasta={rangoHasta} />

          <CampanasEntry senales={senales} filtroActivo={filtroActivo} desde={rangoDesde} hasta={rangoHasta} />

          <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6 }}>
            Datos automáticos · Meta · YouTube · Calendly · Meta Lead Ads. Montos en USD.
          </footer>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — KPIs estrella
// ─────────────────────────────────────────────────────────────────────────────

function KpisEstrella({
  mkt,
  comparativo,
  revenue,
  filtroActivo,
  senales,
}: {
  mkt: MarketingWindow;
  comparativo: ResumenComparativo | null;
  revenue: RevenuePeriod | null;
  filtroActivo: boolean;
  senales: SenalRecon[];
}) {
  // Inversión: spend del rango. Delta = factor vs mismo período del mes anterior.
  const spend = mkt.spend_usd;

  // Desglose de la inversión por anuncio (los que gastaron en el rango).
  const inversionItems: DesgloseItem[] = senales
    .filter((s) => s.spend_usd > 0)
    .sort((a, b) => b.spend_usd - a.spend_usd)
    .map((s) => ({
      nombre: s.ad_name,
      valor: fmtUSD(s.spend_usd, 0),
      detalle: [s.campana, s.adset_name].filter(Boolean).join(' · ') || undefined,
    }));
  const spendAnt = comparativo?.inversion_usd.anterior ?? null;
  let invFactor: string | null = null;
  if (spendAnt !== null && spendAnt > 0 && Number.isFinite(spend)) {
    const factor = spend / spendAnt;
    invFactor = factor >= 1 ? `↑ ${factor.toFixed(1)}×` : `↓ ${factor.toFixed(1)}×`;
  }
  const etiquetaAnt = comparativo?.etiqueta_anterior ?? null;

  // CAC real y ROAS: los toma getRevenuePeriod, que calcula sold/cash/spend del
  // MISMO rango (con o sin filtro) — así dejan de quedar en '—' al filtrar.
  const cacReal = revenue?.cac_usd ?? mkt.cac;
  const roasCash = revenue?.roas_cash ?? null;
  const roasSold = revenue?.roas_sold ?? null;

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      <DesgloseTrigger
        data={{ label: 'Ad Spend · por anuncio', value: fmtUSD(spend, 0), color: 'var(--ink)', items: inversionItems, emptyText: 'Sin gasto a nivel anuncio en el rango.' }}
      >
        <KpiCard
          topColor="var(--border-strong)"
          label="Ad Spend"
          valor={fmtUSD(spend, 0)}
          valorColor="var(--ink)"
          chip={invFactor}
          sub={inversionItems.length > 0 ? `ver detalle · ${inversionItems.length} anuncio${inversionItems.length === 1 ? '' : 's'} →` : (spendAnt !== null ? `previo · ${fmtUSD(spendAnt, 0)}` : 'sin comparativo')}
        />
      </DesgloseTrigger>
      <KpiCard
        topColor="var(--border-strong)"
        label="CAC real"
        valor={cacReal !== null ? fmtUSD(cacReal, 0) : '—'}
        valorColor="var(--ink)"
        sub="Spend ÷ cierres del período"
      />
      <KpiCard
        topColor={roasCash !== null ? 'var(--good)' : 'var(--border-strong)'}
        label="ROAS cash"
        valor={fmtX(roasCash)}
        valorColor={roasCash !== null ? 'var(--good)' : 'var(--ink)'}
        sub="Cash ÷ Spend · lo que entró"
      />
      <KpiCard
        topColor="var(--border-strong)"
        label="ROAS sold"
        valor={fmtX(roasSold)}
        valorColor="var(--ink)"
        sub="Sold ÷ Spend · comprometido"
      />
    </section>
  );
}

function KpiCard({
  topColor,
  label,
  valor,
  valorColor,
  chip,
  sub,
}: {
  topColor: string;
  label: string;
  valor: string;
  valorColor: string;
  chip?: string | null;
  sub: string;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'var(--card-pad)', borderTop: `3px solid ${topColor}` }}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 18 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 44, lineHeight: 0.9, letterSpacing: '-0.03em', color: valorColor, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
        {chip && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--dim)' }}>{chip}</span>
        )}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--faint)', marginTop: 16 }}>{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — Salud del Funnel (trapezoides verticales + cards de eficiencia)
// ─────────────────────────────────────────────────────────────────────────────

function pctEntreEtapas(funnel: FunnelMes, key: string): number | null {
  const e = funnel.etapas.find((x) => x.key === key);
  return e && e.pct !== null && !e.fuente_pendiente && !e.muestra_chica ? e.pct : null;
}

function deltaChip(pct: number | null, bueno: boolean): { text: string; fg: string; bg: string } {
  if (pct === null) return { text: '—', fg: 'var(--dim)', bg: 'var(--surface-2)' };
  const text = `↓ ${pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
  return bueno
    ? { text, fg: 'var(--good)', bg: 'var(--good-bg)' }
    : { text, fg: 'var(--dim)', bg: 'var(--surface-2)' };
}

function SaludDelFunnel({ mkt, funnel, senales }: { mkt: MarketingWindow; funnel: FunnelMes; senales: SenalRecon[] }) {
  // Cuatro etapas verticales: Impresión → Click → Landing → VSL.
  const stages: Array<{ label: string; value: number | null; outer: string; inner: string }> = [
    { label: 'Impresión', value: mkt.impressions, outer: '#D8C58C', inner: '#FBF4DC' },
    { label: 'Click', value: mkt.link_clicks, outer: '#D8C58C', inner: '#F6EAC6' },
    { label: 'Landing', value: mkt.landing_page_views, outer: '#D8C58C', inner: '#EFDDAB' },
    { label: 'VSL', value: mkt.vsl_views, outer: '#D8C58C', inner: '#E7CF8E' },
  ];

  // clip-paths para cada nivel del embudo (más angosto hacia abajo).
  const clips = [
    'polygon(0% 0, 100% 0, 84% 100%, 16% 100%)',
    'polygon(16% 0, 84% 0, 74% 100%, 26% 100%)',
    'polygon(26% 0, 74% 0, 65% 100%, 35% 100%)',
    'polygon(35% 0, 65% 0, 58% 100%, 42% 100%)',
  ];

  // Conectores entre etapas (caída real de la query del funnel).
  const ctrLink = pctEntreEtapas(funnel, 'imp_click'); // Impresión → Click
  const clickLanding = pctEntreEtapas(funnel, 'click_landing'); // Click → Landing
  const landingVsl = pctEntreEtapas(funnel, 'landing_vsl'); // Landing → VSL
  const connectors = [
    { chip: deltaChip(ctrLink, true), texto: 'CTR de link' },
    { chip: deltaChip(clickLanding, false), texto: 'llega a la landing' },
    { chip: deltaChip(landingVsl, false), texto: 've el video' },
  ];

  // Cards de eficiencia (todas reales de getMarketingWindow).
  const costoVsl = mkt.vsl_views && mkt.vsl_views > 0 ? mkt.spend_usd / mkt.vsl_views : null;
  // Desgloses por anuncio (CPM / CPC) desde getSenalesRecon.
  const adsConSpend = senales.filter((s) => s.spend_usd > 0);
  const cpmItems: DesgloseItem[] = adsConSpend
    .filter((s) => s.cpm_usd !== null)
    .sort((a, b) => (b.cpm_usd ?? 0) - (a.cpm_usd ?? 0))
    .map((s) => ({ nombre: s.ad_name, valor: fmtUSD(s.cpm_usd, 2), detalle: `${fmtNum(s.impressions)} impresiones · ${fmtUSD(s.spend_usd, 0)} gastados` }));
  const cpcItems: DesgloseItem[] = adsConSpend
    .filter((s) => s.cpc_usd !== null)
    .sort((a, b) => (b.cpc_usd ?? 0) - (a.cpc_usd ?? 0))
    .map((s) => ({ nombre: s.ad_name, valor: fmtUSD(s.cpc_usd, 2), detalle: `${fmtNum(s.link_clicks)} clicks · ${fmtUSD(s.spend_usd, 0)} gastados` }));
  const effCards: Array<{ label: string; valor: string; sub: string; desglose?: DesgloseData }> = [
    { label: 'CPM', valor: fmtUSD(mkt.cpm_global, 2), sub: cpmItems.length > 0 ? 'por 1,000 impresiones · ver →' : 'por 1,000 impresiones', desglose: cpmItems.length > 0 ? { label: 'CPM por anuncio', value: fmtUSD(mkt.cpm_global, 2), color: 'var(--ink)', items: cpmItems } : undefined },
    { label: 'CPC', valor: fmtUSD(mkt.cpc_global, 2), sub: cpcItems.length > 0 ? 'por click · ver →' : 'por click', desglose: cpcItems.length > 0 ? { label: 'CPC por anuncio', value: fmtUSD(mkt.cpc_global, 2), color: 'var(--ink)', items: cpcItems } : undefined },
    { label: 'Costo / Landing View', valor: fmtUSD(mkt.cpl_global, 2), sub: 'por vista de landing' },
    { label: 'Costo / VSL View', valor: fmtUSD(costoVsl, 2), sub: 'por play del VSL' },
  ];

  const ctxFunnelMkt = [
    'Funnel de marketing (Meta) del período.',
    `Impresión: ${fmtNum(mkt.impressions)} | Click: ${fmtNum(mkt.link_clicks)} | Landing: ${fmtNum(mkt.landing_page_views)} | VSL: ${fmtNum(mkt.vsl_views)}`,
    `CTR de link: ${ctrLink !== null ? ctrLink.toFixed(1) : '—'}% | llega a landing: ${clickLanding !== null ? clickLanding.toFixed(1) : '—'}% | ve el video: ${landingVsl !== null ? landingVsl.toFixed(1) : '—'}%`,
    `CPM: ${fmtUSD(mkt.cpm_global, 2)} | CPC: ${fmtUSD(mkt.cpc_global, 2)} | Costo/Landing: ${fmtUSD(mkt.cpl_global, 2)} | Costo/VSL: ${fmtUSD(costoVsl, 2)} | Ad Spend: ${fmtUSD(mkt.spend_usd, 0)}`,
  ].join('\n');

  const grafico = (
    <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 34, alignItems: 'stretch' }}>
      {/* funnel chart · trapezoides con borde */}
      <div>
        {stages.map((s, i) => (
          <div key={s.label}>
            <div style={{ height: 78, background: s.outer, clipPath: clips[i], padding: 2 }}>
              <div style={{ height: '100%', background: s.inner, clipPath: clips[i], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--dim)', marginBottom: 5 }}>{s.label}</span>
                <span style={{ fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(s.value)}</span>
              </div>
            </div>
            {i < connectors.length && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '6px 0' }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: connectors[i].chip.fg, background: connectors[i].chip.bg, padding: '2px 9px', borderRadius: 7 }}>{connectors[i].chip.text}</span>
                <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{connectors[i].texto}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* cards de eficiencia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gridTemplateRows: '1fr 1fr', gap: 14 }}>
        {effCards.map((c) => {
          const cardStyle: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderTop: '3px solid var(--border-strong)', borderRadius: 14, padding: '18px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
          const inner = (
            <>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 11 }}>{c.label}</div>
              <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{c.valor}</div>
              <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>{c.sub}</div>
            </>
          );
          return c.desglose ? (
            <DesgloseTrigger key={c.label} data={c.desglose} style={cardStyle}>{inner}</DesgloseTrigger>
          ) : (
            <div key={c.label} style={cardStyle}>{inner}</div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Salud del Funnel — Marketing</h2>
        <MakoButton chartKey="marketing-funnel" titulo="Salud del Funnel — Marketing" contexto={ctxFunnelMkt} sugerencias={['¿Dónde pierdo más gente?', '¿El CPM/CPC está caro?', '¿La landing convierte?', '¿En qué enfoco el presupuesto?']} chart={grafico} />
      </div>

      {grafico}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — Tendencia (gráfico de área grande, server-rendered)
// ─────────────────────────────────────────────────────────────────────────────
// El prototipo trae selector de métrica + hover (JS). Como esta página es un
// Server Component y no podemos tocar los componentes cliente compartidos,
// renderizamos la métrica por defecto (primera de marketing, p.ej. Impresiones)
// con su línea/área calculadas en el servidor. Los chips se muestran como en el
// diseño, con la métrica activa resaltada.


// ─────────────────────────────────────────────────────────────────────────────
// 4 — Anuncios ganadores (cards desde getSenalesRecon)
// ─────────────────────────────────────────────────────────────────────────────


function CampanasEntry({ senales, filtroActivo, desde, hasta }: { senales: SenalRecon[]; filtroActivo: boolean; desde: string; hasta: string }) {
  const conGasto = senales.filter((s) => s.spend_usd > 0).length;
  const href = filtroActivo ? `/ads-manager?desde=${desde}&hasta=${hasta}` : '/ads-manager';
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: '0 0 6px', color: 'var(--ink)' }}>Ads Manager</h2>
        <p style={{ fontSize: 14, color: 'var(--dim)', margin: 0, maxWidth: 580 }}>Estado de entrega en vivo (activo · aprendizaje · pausado · rechazado) cruzado con el rendimiento del rango y los cierres del CRM. {conGasto} anuncio{conGasto === 1 ? '' : 's'} con gasto en el período.</p>
      </div>
      <Link href={href} style={{ flex: 'none', padding: '12px 20px', borderRadius: 11, background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>Abrir Ads Manager →</Link>
    </section>
  );
}

