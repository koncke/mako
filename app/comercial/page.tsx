// =============================================================================
// /comercial — Dashboard Comercial (rediseño Marketing OS)
// =============================================================================
// Reskin que reproduce el prototipo `Dashboard Comercial.dc.html` manteniendo
// el cableado real a Supabase vía @/lib/queries:
//   - Revenue (Sold / Cash / Outstanding + a quién cobrarle)  → getRevenuePeriod,
//                                                                getOutstandingDetalle
//   - Salud del Funnel comercial (Agenda→Asistió→Calificado→Cierre + KPIs)
//                                                              → getResumenComercialMaduras,
//                                                                getCACAcumulado
//   - SCL — ciclo de venta (timeline SVG)                     → getSCL, getTramosSCL
//   - Cohortes mensuales / semanales (tablas con madurez)     → listCohortes*
// Server Component (force-dynamic). Presentación nueva, datos intactos.

import {
  listCohortesSemanales,
  listCohortesMensuales,
  getSCL,
  getResumenComercialMaduras,
  getTramosSCL,
  getRevenuePeriod,
  getCACAcumulado,
  getFunnelMadurasLeads,
  getJ1Leads,
  getSCLLeads,
  type CohorteSemana,
  type CohorteMes,
  type EstadoMadurezCohorte,
  type SCL,
  type ResumenComercialMaduras,
  type TramosSCL,
  type RevenuePeriod,
  type CACAcumulado,
  type FunnelMadurasLeads,
  type FunnelLeadItem,
  type SCLLeadItem,
} from '@/lib/queries';
import { getOutstandingDetalle, getRevenueBreakdowns, type OutstandingLead, type RevenueBreakdowns } from '@/lib/pagos';
import { RevenueKpis, type RevCard } from './RevenueKpis';
import { DesgloseTrigger, type DesgloseData, type DesgloseItem } from '../_components/Desglose';
import {
  ayerEnTijuana,
  hoyEnTijuana,
  esFechaValida,
  primerDiaDelMesDeFecha,
  lunesDeFecha,
  fmtDDMMYYYY,
  diasAntes,
} from '@/lib/date-utils';
import { FechaFiltro } from '../_components/FechaFiltro';
import { CobrarTable } from './CobrarTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-MX').format(Math.round(n));
}

function fmtDMY(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Un lead de cohorte → fila del desglose (asistió / calificado / cerró / monto).
function cohorteLeadItem(l: FunnelLeadItem): DesgloseItem {
  const asis = l.asistioJ1 === true ? '✓ asistió' : l.asistioJ1 === false ? '✗ no asistió' : '· s/d';
  const cal = l.calificado === true ? ' · calificado' : '';
  return {
    nombre: l.nombre,
    valor: l.cerro ? fmtUSD(l.monto) : asis,
    detalle: `${l.empresa ? `${l.empresa} · ` : ''}J1 ${fmtDMY(l.fechaJ1)}${cal}${l.cerro ? ' · cerró' : ''}`,
    leadId: l.leadId,
    focus: l.cerro ? 'plan-pagos' : 'datos-comerciales',
  };
}

// FunnelLeadItem[] → filas del desglose, con su valor según la etapa.
function funnelItems(
  arr: FunnelLeadItem[],
  valorFn: (l: FunnelLeadItem) => string,
  focus = 'datos-comerciales',
): DesgloseItem[] {
  return arr.map((l) => ({
    nombre: l.nombre,
    valor: valorFn(l),
    detalle: `${l.empresa ? `${l.empresa} · ` : ''}J1 ${fmtDMY(l.fechaJ1)}`,
    leadId: l.leadId,
    focus,
  }));
}

function fmtSemana(yyyy_mm_dd: string): string {
  // Semana de inicio (fecha específica) → dd/mm/aaaa.
  return fmtDDMMYYYY(yyyy_mm_dd);
}

function fmtMes(yyyy_mm_dd: string): string {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function emojiMadurez(e: EstadoMadurezCohorte): string {
  return e === 'madura' ? '🟢' : e === 'madurando' ? '🟡' : '⚪';
}

function etiquetaMadurez(e: EstadoMadurezCohorte): string {
  return e === 'madura' ? 'madura' : e === 'madurando' ? 'madurando' : 'reciente';
}

function tasaCierre(cierres: number, limpias: number): number | null {
  if (limpias <= 0) return null;
  return (cierres / limpias) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function ComercialPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const hoyReal = hoyEnTijuana();
  const ayerReal = ayerEnTijuana();

  // Filtro global (Fase C): el rango acota las cohortes y el período de Revenue.
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
  const rangoDesde = filtroActivo ? desdeParam! : null;
  const rangoHasta = filtroActivo ? hastaParam! : null;

  // Período de Revenue: rango elegido o mes en curso (mismo patrón que /revenue).
  const revDesde = filtroActivo ? desdeParam! : primerDiaDelMesDeFecha(ayerReal);
  const revHasta = filtroActivo ? hastaParam! : ayerReal;

  let semanales: CohorteSemana[] = [];
  let mensuales: CohorteMes[] = [];
  let scl: SCL | null = null;
  let maduras: ResumenComercialMaduras | null = null;
  let tramos: TramosSCL | null = null;
  let revenue: RevenuePeriod | null = null;
  let outstanding: { items: OutstandingLead[]; total: number } = { items: [], total: 0 };
  let cac: CACAcumulado | null = null;
  let breakdowns: RevenueBreakdowns = { sold: [], cash: [], outstanding: [] };
  let funnelLeads: FunnelMadurasLeads | null = null;
  let j1Leads: FunnelLeadItem[] = [];
  let sclLeads: SCLLeadItem[] = [];
  let errorMsg: string | null = null;

  try {
    [semanales, mensuales, scl, maduras, tramos, revenue, outstanding, cac, breakdowns, funnelLeads, j1Leads, sclLeads] = await Promise.all([
      listCohortesSemanales(8),
      listCohortesMensuales(6),
      getSCL(),
      getResumenComercialMaduras(),
      getTramosSCL(),
      getRevenuePeriod(revDesde, revHasta),
      getOutstandingDetalle(hoyReal),
      getCACAcumulado(),
      getRevenueBreakdowns(revDesde, revHasta),
      getFunnelMadurasLeads(),
      // Acotado a ~1 año: cubre con margen las 8 semanas / 6 meses que se renderizan
      // (evita escanear todo el histórico de leads en cada carga).
      getJ1Leads(diasAntes(hoyReal, 370)),
      getSCLLeads(),
    ]);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // Cohortes dentro del rango activo (intersección de su período de J1).
  const enRango = (c: CohorteSemana | CohorteMes): boolean => {
    if (!rangoDesde || !rangoHasta) return true;
    const inicio = 'semana_inicio' in c ? c.semana_inicio : c.mes_inicio;
    return inicio <= rangoHasta && inicio >= rangoDesde.slice(0, 7) + '-01';
  };
  const semanalesVis = filtroActivo ? semanales.filter(enRango) : semanales;
  const mensualesVis = filtroActivo ? mensuales.filter(enRango) : mensuales;
  const hayDatos = semanales.length > 0 || mensuales.length > 0;

  // Leads por cohorte (semana=lunes, mes=YYYY-MM) para el desglose de cada fila.
  const semanaLeads = new Map<string, FunnelLeadItem[]>();
  const mesLeads = new Map<string, FunnelLeadItem[]>();
  for (const l of j1Leads) {
    if (!l.fechaJ1) continue;
    const fk = l.fechaJ1.slice(0, 10);
    const wk = lunesDeFecha(fk);
    const mk = fk.slice(0, 7);
    (semanaLeads.get(wk) ?? semanaLeads.set(wk, []).get(wk)!).push(l);
    (mesLeads.get(mk) ?? mesLeads.set(mk, []).get(mk)!).push(l);
  }
  const desgloseSemana = (c: CohorteSemana | CohorteMes): DesgloseData | undefined => {
    const inicio = 'semana_inicio' in c ? c.semana_inicio : c.mes_inicio;
    const leads = ('semana_inicio' in c ? semanaLeads.get(inicio) : mesLeads.get(inicio.slice(0, 7))) ?? [];
    if (leads.length === 0) return undefined;
    return {
      label: `Cohorte · ${'semana_inicio' in c ? fmtSemana(inicio) : fmtMes(inicio)}`,
      value: `${leads.filter((l) => l.cerro).length}/${leads.length} cerraron`,
      color: 'var(--ink)',
      items: leads.map(cohorteLeadItem),
    };
  };

  // SCL: leads con su ciclo completo (agenda→pago) y duración.
  const sclDesglose: DesgloseData | undefined = sclLeads.length > 0 ? {
    label: 'Ciclo de venta · agenda → pago',
    value: `${sclLeads.length} leads`,
    color: 'var(--ink)',
    items: sclLeads.map((l) => ({
      nombre: l.nombre,
      valor: `${l.dias} d`,
      detalle: `agenda ${fmtDMY(l.agenda)} → J2 ${fmtDMY(l.j2)} → conf. ${fmtDMY(l.confirmacion)} → pago ${fmtDMY(l.pago)}`,
      leadId: l.leadId,
      focus: 'plan-pagos',
    })),
  } : undefined;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 30,
        }}
      >
        <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
          Comercial
        </h1>
        <FechaFiltro hoyReal={hoyReal} />
      </header>

      {errorMsg ? (
        <ErrorCard message={errorMsg} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
          {revenue && <RevenueSection revenue={revenue} outstanding={outstanding} breakdowns={breakdowns} />}

          {maduras && <SaludFunnel maduras={maduras} cac={cac} funnelLeads={funnelLeads} />}

          <SCLTimeline scl={scl} tramos={tramos} sclDesglose={sclDesglose} />

          {hayDatos ? (
            <>
              <CohortesTable
                title="Cohortes mensuales"
                cohortes={mensualesVis}
                fechaColLabel="Mes"
                fechaFormat={fmtMes}
                showCiclo
                open
                minWidth={820}
                desgloseFor={desgloseSemana}
              />
              <CohortesTable
                title="Cohortes semanales"
                cohortes={semanalesVis}
                fechaColLabel="Semana de"
                fechaFormat={fmtSemana}
                showCiclo={false}
                open={false}
                minWidth={700}
                desgloseFor={desgloseSemana}
              />
            </>
          ) : (
            <EmptyState />
          )}

          <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 6 }}>
            Datos automáticos · Calendly · Cobranza. Montos en USD.
          </footer>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue
// ─────────────────────────────────────────────────────────────────────────────

function RevenueSection({
  revenue,
  outstanding,
  breakdowns,
}: {
  revenue: RevenuePeriod;
  outstanding: { items: OutstandingLead[]; total: number };
  breakdowns: RevenueBreakdowns;
}) {
  const cash = revenue.cash_collected_usd;
  const out = revenue.outstanding_usd;
  const totalRef = cash + out;
  const pctCash = totalRef > 0 ? Math.round((cash / totalRef) * 100) : 0;
  const pctOut = 100 - pctCash;
  const hoyISO = hoyEnTijuana();

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: '0 0 22px', color: 'var(--ink)' }}>Revenue</h2>

      {/* Barra cobrado / pendiente */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', width: '100%', height: 42, borderRadius: 11, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${pctCash}%`, background: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>
            {pctCash > 6 ? `${pctCash}%` : ''}
          </div>
          <div style={{ width: `${pctOut}%`, background: 'var(--bad)', opacity: 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>
            {pctOut > 6 ? `${pctOut}%` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 13, color: 'var(--dim)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--good)' }} />cobrado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--bad)' }} />pendiente del pipeline
          </span>
        </div>
      </div>

      {/* KPIs de revenue (clickeables → desglose por lead) */}
      <RevenueKpis
        cards={[
          { key: 'sold', label: 'Sold Revenue', value: fmtUSD(revenue.sold_revenue_usd), color: 'var(--accent)', sub: `${revenue.cierres_en_periodo} cierre${revenue.cierres_en_periodo === 1 ? '' : 's'} en el período`, fechaLabel: 'cierre', items: breakdowns.sold },
          { key: 'cash', label: 'Cash Collected', value: fmtUSD(cash), color: 'var(--good)', sub: `incluye cuotas previas · ${revenue.primeros_pagos_en_periodo} primeros pagos`, fechaLabel: 'pago', items: breakdowns.cash },
          { key: 'out', label: 'Outstanding', value: fmtUSD(out), color: 'var(--bad)', sub: 'cuotas por cobrar (vencen desde el inicio del rango)', fechaLabel: 'vence', items: breakdowns.outstanding },
        ] satisfies RevCard[]}
      />

      {/* A quién cobrarle */}
      {outstanding.items.length > 0 && (
        <CobrarTable items={outstanding.items} total={outstanding.total} hoyISO={hoyISO} />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Salud del Funnel — Comercial (embudo + KPIs)
// ─────────────────────────────────────────────────────────────────────────────

function SaludFunnel({ maduras, cac, funnelLeads }: { maduras: ResumenComercialMaduras; cac: CACAcumulado | null; funnelLeads: FunnelMadurasLeads | null }) {
  const noShow =
    maduras.total_j1 > 0 ? ((maduras.total_j1 - maduras.asistencias) / maduras.total_j1) * 100 : null;
  const tasa = maduras.tasa_cierre_madura;

  // Conversiones entre etapas del embudo (sobre cohortes maduras).
  const pctAsisten = maduras.total_j1 > 0 ? (maduras.asistencias / maduras.total_j1) * 100 : null;
  const pctCalifican = maduras.asistencias > 0 ? (maduras.limpias / maduras.asistencias) * 100 : null;
  const pctCierran = maduras.limpias > 0 ? (maduras.cierres / maduras.limpias) * 100 : null;

  const fl = funnelLeads;
  // Desgloses por etapa (cuadran con los conteos del embudo).
  const dgAgenda: DesgloseData | undefined = fl ? { label: 'Agenda · J1 de cohortes maduras', value: fmtNum(maduras.total_j1), color: 'var(--ink)', items: funnelItems(fl.agenda, (l) => fmtDMY(l.fechaJ1)), emptyText: 'Sin agendas maduras.' } : undefined;
  const dgAsistio: DesgloseData | undefined = fl ? { label: 'Asistió a J1', value: fmtNum(maduras.asistencias), color: 'var(--good)', items: funnelItems(fl.asistio, () => '✓ asistió'), emptyText: 'Nadie asistió aún.' } : undefined;
  const dgNoShow: DesgloseData | undefined = fl ? { label: 'No-show · no asistió a J1', value: fmtNum(maduras.total_j1 - maduras.asistencias), color: 'var(--bad)', items: funnelItems(fl.noShow, () => '✗ no asistió'), emptyText: 'Sin no-shows.' } : undefined;
  const dgCalificado: DesgloseData | undefined = fl ? { label: 'Calificados', value: fmtNum(maduras.limpias), color: 'var(--ink)', items: funnelItems(fl.calificado, () => '✓ calificado'), emptyText: 'Sin calificados.' } : undefined;
  const dgCierre: DesgloseData | undefined = fl ? { label: 'Cierres maduros', value: fmtNum(maduras.cierres), color: 'var(--good)', items: funnelItems(fl.cierre, (l) => fmtUSD(l.monto), 'plan-pagos'), emptyText: 'Sin cierres maduros.' } : undefined;

  const etapas: Array<{ label: string; valor: number; bg: string; dg?: DesgloseData }> = [
    { label: 'Agenda', valor: maduras.total_j1, bg: '#FBF4DC', dg: dgAgenda },
    { label: 'Asistió', valor: maduras.asistencias, bg: '#F6EAC6', dg: dgAsistio },
    { label: 'Calificado', valor: maduras.limpias, bg: '#EFDDAB', dg: dgCalificado },
    { label: 'Cierre', valor: maduras.cierres, bg: '#E7CF8E', dg: dgCierre },
  ];
  // clip-paths del embudo (de ancho a angosto), idénticos al prototipo.
  const clips = [
    'polygon(0% 0, 100% 0, 84% 100%, 16% 100%)',
    'polygon(16% 0, 84% 0, 74% 100%, 26% 100%)',
    'polygon(26% 0, 74% 0, 65% 100%, 35% 100%)',
    'polygon(35% 0, 65% 0, 58% 100%, 42% 100%)',
  ];
  const conectores: Array<{ pct: number | null; nota: string; verde: boolean }> = [
    { pct: pctAsisten, nota: 'asisten a J1', verde: true },
    { pct: pctCalifican, nota: 'califican', verde: false },
    { pct: pctCierran, nota: 'cierran', verde: false },
  ];

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: '0 0 22px', color: 'var(--ink)' }}>Salud del Funnel — Comercial</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 34, alignItems: 'stretch' }}>
        {/* Embudo */}
        <div>
          {etapas.map((e, i) => (
            <div key={e.label}>
              {(() => {
                const box = (
                  <div style={{ height: 78, background: '#D8C58C', clipPath: clips[i], padding: 2 }}>
                    <div
                      style={{
                        height: '100%',
                        background: e.bg,
                        clipPath: clips[i],
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--dim)', marginBottom: 5 }}>{e.label}</span>
                      <span style={{ fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(e.valor)}</span>
                    </div>
                  </div>
                );
                return e.dg ? <DesgloseTrigger data={e.dg}>{box}</DesgloseTrigger> : box;
              })()}
              {i < conectores.length && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '6px 0' }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 600,
                      color: conectores[i].verde ? 'var(--good)' : 'var(--dim)',
                      background: conectores[i].verde ? 'var(--good-bg)' : 'var(--surface-2)',
                      padding: '2px 9px',
                      borderRadius: 7,
                    }}
                  >
                    {conectores[i].pct !== null ? `${Math.round(conectores[i].pct!)}%` : '—'}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{conectores[i].nota}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* KPIs a la derecha */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gridTemplateRows: '1fr 1fr', gap: 14 }}>
          <FunnelKPI
            label="Ratio de cierre"
            value={maduras.limpias < 3 ? `${maduras.cierres} de ${maduras.limpias}` : tasa !== null ? `${Math.round(tasa)}%` : '—'}
            valueColor={tasa !== null && maduras.limpias >= 3 && tasa >= 30 ? 'var(--good)' : 'var(--ink)'}
            sub={`${maduras.cierres} ÷ ${maduras.limpias} calificadas`}
            topColor="var(--good)"
            desglose={dgCierre}
          />
          <FunnelKPI
            label="No-show rate"
            value={maduras.total_j1 < 3 ? `${maduras.total_j1 - maduras.asistencias} de ${maduras.total_j1}` : noShow !== null ? `${Math.round(noShow)}%` : '—'}
            valueColor={noShow !== null && noShow > 35 ? 'var(--bad)' : 'var(--good)'}
            sub={`${maduras.total_j1 - maduras.asistencias} de ${maduras.total_j1} · maduras`}
            topColor="var(--border-strong)"
            desglose={dgNoShow}
          />
          <FunnelKPI
            label="Cierres maduros"
            value={fmtNum(maduras.cierres)}
            valueColor="var(--ink)"
            sub={`${maduras.cohortes_maduras_count} cohortes maduras`}
            topColor="var(--border-strong)"
            desglose={dgCierre}
          />
          <FunnelKPI
            label="CAC acumulado"
            value={cac && cac.cac_usd !== null ? fmtUSD(cac.cac_usd) : '—'}
            valueColor="var(--ink)"
            sub="Spend ÷ cierres"
            topColor="var(--border-strong)"
          />
        </div>
      </div>
    </section>
  );
}

function FunnelKPI({ label, value, valueColor, sub, topColor, desglose }: { label: string; value: string; valueColor: string; sub: string; topColor: string; desglose?: DesgloseData }) {
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderTop: `3px solid ${topColor}`,
    borderRadius: 14,
    padding: '18px 18px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)' }}>{label}</span>
        {desglose && <span style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600 }}>ver →</span>}
      </div>
      <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: valueColor, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 8 }}>{sub}</div>
    </>
  );
  return desglose ? (
    <DesgloseTrigger data={desglose} style={cardStyle}>{inner}</DesgloseTrigger>
  ) : (
    <div style={cardStyle}>{inner}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCL — línea de tiempo del ciclo de venta (SVG)
// ─────────────────────────────────────────────────────────────────────────────

const NODO_NICE: Record<string, string> = {
  Formulario: 'Formulario',
  Agenda: 'Agenda J1',
};

function SCLTimeline({ scl, tramos, sclDesglose }: { scl: SCL | null; tramos: TramosSCL | null; sclDesglose?: DesgloseData }) {
  const tramoList = tramos?.tramos ?? [];
  const masLento = tramos?.tramo_mas_lento ?? null;

  // Nodos = origen del primer tramo + destino de cada tramo.
  const nodos: string[] =
    tramoList.length > 0
      ? [tramoList[0].label.split('→')[0].trim(), ...tramoList.map((t) => t.label.split('→')[1].trim())]
      : [];

  // Geometría (scroll horizontal si no entra).
  const segW = 220;
  const padX = 100;
  const baseY = 104;
  const W = padX * 2 + Math.max(nodos.length - 1, 1) * segW;
  const H = 200;
  const nodeX = (i: number) => padX + i * segW;

  const sclProm = scl && scl.avg_dias !== null ? `${scl.avg_dias.toFixed(1)} días` : '—';
  const p90 = scl && scl.p90_dias !== null ? `${scl.p90_dias}d` : '—';

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>SCL — ciclo de venta</h2>
        {(() => {
          const box = (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '11px 18px', textAlign: 'right' }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>SCL promedio</div>
              <div style={{ fontWeight: 600, fontSize: 25, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{sclProm}</div>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>agenda → pago · P90: {p90}{sclDesglose ? ' · ver leads →' : ''}</div>
            </div>
          );
          return sclDesglose ? <DesgloseTrigger data={sclDesglose} style={{ width: 'auto', display: 'inline-block' }}>{box}</DesgloseTrigger> : box;
        })()}
      </div>

      {nodos.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--faint)', margin: '14px 0 0' }}>Sin datos de ciclo todavía.</p>
      ) : (
        <div style={{ overflowX: 'auto', padding: '18px 0 4px' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', minWidth: 760, height: 'auto', display: 'block', overflow: 'visible' }}
            role="img"
            aria-label="Línea de tiempo del ciclo de venta"
          >
            <line x1={nodeX(0)} y1={baseY} x2={nodeX(nodos.length - 1)} y2={baseY} stroke="var(--border-strong)" strokeWidth={2} />

            {/* Tramos */}
            {tramoList.map((t, i) => {
              const x1 = nodeX(i);
              const x2 = nodeX(i + 1);
              const mid = (x1 + x2) / 2;
              const tieneDato = t.dias_promedio !== null;
              const esLento = masLento === t.label && tieneDato;
              return (
                <g key={`tramo-${t.label}`}>
                  {esLento && <line x1={x1} y1={baseY} x2={x2} y2={baseY} stroke="var(--bad)" strokeWidth={4} strokeLinecap="round" />}
                  <text
                    x={mid}
                    y={86}
                    textAnchor="middle"
                    fontSize={16}
                    fontWeight={esLento ? 700 : 600}
                    fill={tieneDato ? (esLento ? 'var(--bad)' : 'var(--ink)') : 'var(--faint)'}
                    fontFamily="Geist Mono, monospace"
                  >
                    {tieneDato ? `+${t.dias_promedio!.toFixed(1)} d` : 's/d'}
                  </text>
                  <text x={mid} y={130} textAnchor="middle" fontSize={12} fill="var(--faint)" fontFamily="Geist Mono, monospace">
                    n={t.n}{esLento ? ' · lento' : ''}
                  </text>
                </g>
              );
            })}

            {/* Nodos */}
            {nodos.map((raw, i) => {
              const x = nodeX(i);
              const arriba = i % 2 === 0;
              const incoming = i === 0 ? null : tramoList[i - 1];
              const activo = i === 0 || (incoming?.dias_promedio ?? null) !== null;
              const fill = i === 0 ? 'var(--accent-soft)' : activo ? 'var(--good)' : 'var(--border-strong)';
              const label = NODO_NICE[raw] ?? raw;
              const tickY1 = arriba ? 96 : 112;
              const tickY2 = arriba ? 74 : 140;
              const labelY = arriba ? 62 : 162;
              return (
                <g key={`nodo-${i}`}>
                  <line x1={x} y1={tickY1} x2={x} y2={tickY2} stroke="var(--border-strong)" strokeWidth={1} />
                  <circle cx={x} cy={baseY} r={8} fill={fill} stroke="var(--surface)" strokeWidth={3} />
                  <text x={x} y={labelY} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--ink)" fontFamily="Geist, sans-serif">
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablas de cohortes (mensual / semanal) con grupos por madurez
// ─────────────────────────────────────────────────────────────────────────────

function renderTasa(tasa: number | null, estado: EstadoMadurezCohorte): React.ReactNode {
  if (tasa === null || estado === 'reciente') return <span style={{ color: 'var(--faint)' }}>—</span>;
  const txt = `${Math.round(tasa)}%`;
  if (estado === 'madurando') {
    return (
      <span style={{ color: 'var(--dim)' }}>
        {txt} <span style={{ fontSize: 12 }}>(parcial)</span>
      </span>
    );
  }
  return <span style={{ color: 'var(--good)' }}>{txt}</span>;
}

function renderNoShow(total_j1: number, asistencias: number): React.ReactNode {
  if (total_j1 === 0) return <span style={{ color: 'var(--faint)' }}>—</span>;
  const noShow = ((total_j1 - asistencias) / total_j1) * 100;
  const color = noShow > 35 ? 'var(--bad)' : 'var(--dim)';
  return <span style={{ color }}>{Math.round(noShow)}%</span>;
}

function CohortesTable({
  title,
  cohortes,
  fechaColLabel,
  fechaFormat,
  showCiclo,
  open,
  minWidth,
  desgloseFor,
}: {
  title: string;
  cohortes: Array<CohorteSemana | CohorteMes>;
  fechaColLabel: string;
  fechaFormat: (s: string) => string;
  showCiclo: boolean;
  open: boolean;
  minWidth: number;
  desgloseFor?: (c: CohorteSemana | CohorteMes) => DesgloseData | undefined;
}) {
  const maduras = cohortes.filter((c) => c.estado_madurez === 'madura');
  const inmaduras = cohortes.filter((c) => c.estado_madurez !== 'madura');
  const nCols = (showCiclo ? 10 : 9) + 1;

  const th: React.CSSProperties = {
    padding: showCiclo ? '13px 20px' : '12px 18px',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: 'var(--dim)',
    fontWeight: 600,
  };
  const thRight: React.CSSProperties = { ...th, padding: '13px 12px', textAlign: 'right' };
  const thRightSm: React.CSSProperties = { ...thRight, padding: '12px 12px' };
  const banner = (texto: string, color: string, bg: string): React.ReactNode => (
    <tr>
      <td colSpan={nCols} style={{ padding: '8px 20px', background: bg, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
        {texto}
      </td>
    </tr>
  );

  return (
    <details open={open} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{title}</h2>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', flex: 'none' }}>ver ▾</span>
      </summary>

      {cohortes.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--faint)', margin: '18px 0 0' }}>Sin cohortes en este rango.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 18, border: '1px solid var(--border)', borderRadius: 13 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: showCiclo ? 14.5 : 14, minWidth }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                <th style={th}>{fechaColLabel}</th>
                <th style={showCiclo ? thRight : thRightSm}>J1</th>
                <th style={showCiclo ? thRight : thRightSm}>Asistió</th>
                <th style={showCiclo ? thRight : thRightSm}>No-show</th>
                <th style={showCiclo ? thRight : thRightSm}>Calificadas</th>
                <th style={showCiclo ? thRight : thRightSm}>Cierres</th>
                <th style={showCiclo ? thRight : thRightSm}>{showCiclo ? 'Tasa cierre' : 'Tasa'}</th>
                {showCiclo && <th style={thRight}>Ciclo (d)</th>}
                <th style={showCiclo ? thRight : thRightSm}>Ventas</th>
                <th style={{ ...th, padding: showCiclo ? '13px 20px' : '12px 18px' }}>Estado</th>
                <th style={{ ...th, padding: showCiclo ? '13px 20px' : '12px 18px' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {maduras.length > 0 && banner('Maduras · tasa confiable', 'var(--good)', 'var(--good-bg)')}
              {maduras.map((c) => (
                <CohorteRow key={'semana_inicio' in c ? c.semana_inicio : c.mes_inicio} c={c} fechaFormat={fechaFormat} showCiclo={showCiclo} atenuada={false} desglose={desgloseFor?.(c)} />
              ))}
              {inmaduras.length > 0 && banner('Aún madurando · tasa parcial', 'var(--warn)', 'var(--surface-2)')}
              {inmaduras.map((c) => (
                <CohorteRow key={'semana_inicio' in c ? c.semana_inicio : c.mes_inicio} c={c} fechaFormat={fechaFormat} showCiclo={showCiclo} atenuada desglose={desgloseFor?.(c)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function CohorteRow({
  c,
  fechaFormat,
  showCiclo,
  atenuada,
  desglose,
}: {
  c: CohorteSemana | CohorteMes;
  fechaFormat: (s: string) => string;
  showCiclo: boolean;
  atenuada: boolean;
  desglose?: DesgloseData;
}) {
  const fechaInicio = 'semana_inicio' in c ? c.semana_inicio : c.mes_inicio;
  const tasa = tasaCierre(c.cierres, c.limpias);
  const pad = showCiclo ? '14px' : '12px';
  const tdNum: React.CSSProperties = { padding: `${pad} 12px`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const ciclo = c.dias_promedio_ciclo;

  return (
    <tr style={{ borderTop: '1px solid var(--border)', opacity: atenuada ? 0.62 : 1 }}>
      <td style={{ padding: showCiclo ? '14px 20px' : '12px 18px', fontWeight: 500, color: 'var(--ink)' }}>{fechaFormat(fechaInicio)}</td>
      <td style={tdNum}>{fmtNum(c.total_j1)}</td>
      <td style={tdNum}>{fmtNum(c.asistencias)}</td>
      <td style={tdNum}>{renderNoShow(c.total_j1, c.asistencias)}</td>
      <td style={tdNum}>{fmtNum(c.limpias)}</td>
      <td style={tdNum}>{fmtNum(c.cierres)}</td>
      <td style={tdNum}>{renderTasa(tasa, c.estado_madurez)}</td>
      {showCiclo && (
        <td style={{ ...tdNum, color: ciclo !== null && ciclo !== undefined ? 'var(--dim)' : 'var(--faint)' }}>
          {ciclo !== null && ciclo !== undefined ? Number(ciclo).toFixed(1) : '—'}
        </td>
      )}
      <td style={{ ...tdNum, color: c.cierres > 0 ? 'var(--good)' : 'var(--faint)' }}>{c.cierres > 0 ? fmtUSD(c.ingreso_total_usd) : '—'}</td>
      <td style={{ padding: showCiclo ? '14px 20px' : '12px 18px', color: 'var(--dim)' }}>
        {emojiMadurez(c.estado_madurez)} {etiquetaMadurez(c.estado_madurez)}
      </td>
      <td style={{ padding: showCiclo ? '14px 20px' : '12px 18px' }}>
        {desglose ? (
          <DesgloseTrigger data={desglose} style={{ width: 'auto', display: 'inline-block', color: 'var(--accent)', fontSize: 12.5, fontWeight: 600 }}>ver leads →</DesgloseTrigger>
        ) : (
          <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty + Error
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)', textAlign: 'center' }}>
      <p style={{ fontSize: 18, color: 'var(--dim)', margin: '0 0 8px' }}>Aún no hay leads con fecha de Junta 1.</p>
      <p style={{ fontSize: 14.5, color: 'var(--faint)', margin: 0 }}>
        Cuando alguien agende vía Calendly o crees uno manual en /leads y le pongas fecha de J1, aparecerá agrupado en cohortes aquí.
      </p>
    </section>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <section style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px', color: 'var(--bad)' }}>Error consultando Supabase</p>
      <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--dim)', margin: 0 }}>{message}</p>
    </section>
  );
}
