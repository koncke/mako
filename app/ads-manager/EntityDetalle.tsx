'use client';

// =============================================================================
// EntityDetalle — modal de gráficos de UNA campaña o conjunto (como Meta).
// =============================================================================
// Pide /api/entity-insights (serie diaria + desgloses) y los muestra cruzados
// con datos del CRM (cierres/cash) que vienen del merge de senales. Incluye el
// botón "Analizar con MaKo" con el contexto de métricas + recos de Meta + CRM.
// En un conjunto, además, «Dónde se muestra»: los lugares en los que está SEGMENTADO
// (el desglose `regiones` de abajo dice dónde se GASTÓ, que es otra cosa).

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { BreakdownCharts, fmtUSD, type Demo, type BD } from '../marketing/ad-charts';
import { MakoButton } from '../_components/ChartIA';
import { colorDeSemaforo, bgDeSemaforo, type Semaforo, type Reco } from '@/lib/meta-health-ui';
import { lugaresDesdeMeta, type LecturaGeo } from '@/lib/meta-geo';
import { LugaresLectura } from './LugaresLectura';
import { montoCuenta } from '@/lib/presupuesto-cambio';

// «No pude leer» es un estado propio, no una lista vacía (#715).
type EstadoGeo = { estado: 'cargando' } | { estado: 'error'; error: string } | { estado: 'ok'; lectura: LecturaGeo };

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type EntityInsights = {
  period: { impressions: number; reach: number; frequency: number; clicks: number; link_clicks: number; ctr: number | null; spend_usd: number; spend_mxn: number; cpm_usd: number | null; cpc_usd: number | null; agendas: number; leads: number; landing_views: number };
  daily: Array<{ fecha: string; spend_usd: number; impressions: number; reach: number; clicks: number; link_clicks: number; agendas: number; leads: number; ctr: number; cpm_usd: number }>;
  demograficos: Demo[]; plataformas: BD[]; regiones: BD[];
};

// Datos del CRM/merge que NO vienen de Meta (la ventaja de la app).
export type CrossData = { cierres: number; cash_usd: number; agendasCrm?: number | null };

const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n < 10 ? n.toFixed(1) : n.toFixed(0)}%`);
const fmtFecha = (iso: string) => fmtDDMMYYYY(iso);

type MetKey = 'spend_usd' | 'impressions' | 'reach' | 'link_clicks' | 'agendas' | 'leads' | 'ctr' | 'cpm_usd';
const METRICAS: Array<{ key: MetKey; label: string; fmt: (n: number | null) => string; sum: boolean }> = [
  { key: 'spend_usd', label: 'Gasto', fmt: (n) => fmtUSD(n, 0), sum: true },
  { key: 'impressions', label: 'Impresiones', fmt: fmtNum, sum: true },
  { key: 'reach', label: 'Alcance', fmt: fmtNum, sum: false },
  { key: 'link_clicks', label: 'Clics enlace', fmt: fmtNum, sum: true },
  { key: 'agendas', label: 'Agendas', fmt: fmtNum, sum: true },
  { key: 'leads', label: 'Leads', fmt: fmtNum, sum: true },
  { key: 'ctr', label: 'CTR', fmt: fmtPct, sum: false },
  { key: 'cpm_usd', label: 'CPM', fmt: (n) => fmtUSD(n), sum: false },
];

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--ink)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

export function EntityDetalle({ id, level, name, statusLabel, semaforo, desde, hasta, cross, recosMeta, presupuestoCuenta, moneda, onClose, onCambiarLugar, versionGeo = 0 }: {
  id: string; level: 'campaign' | 'adset'; name: string; statusLabel: string; semaforo: Semaforo;
  desde: string; hasta: string; cross: CrossData; recosMeta?: Reco[];
  /** El presupuesto diario en la MONEDA DE LA CUENTA (`moneda`), que es lo que guarda Meta. */
  presupuestoCuenta?: number | null; moneda: string; onClose: () => void;
  /** Sólo conjuntos: abre el editor de público (EditarPublicoModal), la misma puerta que «Público» de la fila. */
  onCambiarLugar?: () => void;
  /** Sube cuando se guardaron lugares: relee SÓLO «Dónde se muestra». */
  versionGeo?: number;
}) {
  const [data, setData] = useState<EntityInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [met, setMet] = useState<MetKey>('spend_usd');
  const [geo, setGeo] = useState<EstadoGeo | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null);
    fetch(`/api/entity-insights?id=${encodeURIComponent(id)}&desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setData(j); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [id, desde, hasta]);

  // «Dónde se muestra» (#715): una lectura PROPIA, aparte de las métricas — si falla no
  // las tumba, y si fallan ellas esto se ve igual. Es la misma lectura que hace el editor
  // de público al abrirse (una llamada a Meta por conjunto abierto, contra la cuota de la
  // cuenta del cliente). Se relee con `versionGeo` y NO con un `key` en el padre: el key
  // remontaba el modal entero, volvía a pedir /api/entity-insights y perdía la métrica
  // elegida.
  useEffect(() => {
    if (level !== 'adset') { setGeo(null); return; }
    let alive = true;
    setGeo({ estado: 'cargando' });
    fetch(`/api/ads-manager/adset-targeting?adset_id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (!j.ok) { setGeo({ estado: 'error', error: String(j.error || 'error desconocido') }); return; }
        const t = (j.adset?.targeting ?? {}) as Record<string, unknown>;
        setGeo({ estado: 'ok', lectura: lugaresDesdeMeta(t.geo_locations, t.excluded_geo_locations) });
      })
      .catch((e) => { if (alive) setGeo({ estado: 'error', error: String(e) }); });
    return () => { alive = false; };
  }, [id, level, versionGeo]);

  const p = data?.period;
  const metricaActiva = METRICAS.find((m) => m.key === met)!;
  const total = useMemo(() => {
    if (!data || !p) return null;
    if (!metricaActiva.sum) return (p as Record<string, number | null>)[met] ?? null;
    return data.daily.reduce((acc, d) => acc + (d[met] as number), 0);
  }, [data, p, met, metricaActiva]);

  const nivelLabel = level === 'campaign' ? 'Campaña' : 'Conjunto';
  const cpa = p && p.agendas > 0 ? p.spend_usd / p.agendas : null;
  const cpl = p && p.leads > 0 ? p.spend_usd / p.leads : null;
  const roasCash = p && p.spend_usd > 0 && cross.cash_usd > 0 ? cross.cash_usd / p.spend_usd : null;

  const ctx = data && p ? [
    `Detalle de ${nivelLabel.toLowerCase()} "${name}" (Meta). Período ${fmtFecha(desde)} → ${fmtFecha(hasta)}. Estado de entrega: ${statusLabel}.`,
    // La moneda de la cuenta y no «MXN» a mano: para una cuenta en dólares MaKo leía un
    // monto con la moneda equivocada (relevo del Ads Manager, 10/10/2026).
    presupuestoCuenta ? `Presupuesto diario: ${montoCuenta(presupuestoCuenta, moneda)}.` : '',
    `Gasto ${fmtUSD(p.spend_usd, 0)} · Impresiones ${fmtNum(p.impressions)} · Alcance ${fmtNum(p.reach)} · Frecuencia ${p.frequency ? p.frequency.toFixed(2) : '—'}`,
    `Clics enlace ${fmtNum(p.link_clicks)} · CTR ${fmtPct(p.ctr)} · CPC ${fmtUSD(p.cpc_usd)} · CPM ${fmtUSD(p.cpm_usd)}`,
    `Leads ${fmtNum(p.leads)} · Agendas ${fmtNum(p.agendas)} · Vistas landing ${fmtNum(p.landing_views)} · CPL ${fmtUSD(cpl)} · Costo/agenda ${fmtUSD(cpa)}`,
    `CRM (Meta no ve esto) — Cierres ${cross.cierres} · Cash ${fmtUSD(cross.cash_usd, 0)} · ROAS cash ${roasCash !== null ? roasCash.toFixed(2) + 'x' : '—'}`,
    recosMeta && recosMeta.length ? `Recomendaciones de Meta para este nivel:\n${recosMeta.map((r) => `- [${r.prioridad}] ${r.titulo}: ${r.detalle}`).join('\n')}` : 'Meta no devolvió recomendaciones nativas para este nivel por API.',
  ].filter(Boolean).join('\n') : '';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(18,21,27,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1040, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>{nivelLabel}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: colorDeSemaforo(semaforo), background: bgDeSemaforo(semaforo) }}>{statusLabel}</span>
            </div>
            <h2 style={{ fontWeight: 600, fontSize: 23, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.15 }}>{name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
            {data && p && <MakoButton chartKey={`mkt-${level}-${id}`} titulo={name} contexto={ctx} sugerencias={['¿Escalo o pauso este nivel?', '¿Dónde se cae el rendimiento?', '¿El presupuesto está bien asignado?', '¿Qué dicen los números vs los cierres?']} />}
            <button aria-label="Cerrar" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 17, cursor: 'pointer', fontFamily: SANS }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {err && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', color: 'var(--bad)', fontSize: 13 }}>No se pudo cargar de Meta: {err}</div>}
          {!data && !err && <div style={{ fontSize: 13.5, color: 'var(--faint)', padding: '8px 0' }}>Cargando datos de Meta…</div>}

          {data && p && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              <Stat label="Gasto" value={fmtUSD(p.spend_usd, 0)} />
              <Stat label="Agendas" value={fmtNum(p.agendas)} color={p.agendas > 0 ? 'var(--good)' : undefined} />
              <Stat label="Costo / agenda" value={fmtUSD(cpa)} />
              <Stat label="Cierres (CRM)" value={fmtNum(cross.cierres)} color={cross.cierres > 0 ? 'var(--good)' : undefined} />
              <Stat label="Cash (CRM)" value={fmtUSD(cross.cash_usd, 0)} color={cross.cash_usd > 0 ? 'var(--good)' : undefined} />
              <Stat label="ROAS cash" value={roasCash !== null ? `${roasCash.toFixed(2)}x` : '—'} />
              <Stat label="Leads" value={fmtNum(p.leads)} />
              <Stat label="CPL" value={fmtUSD(cpl)} />
            </div>
          )}

          {/* Fuera del bloque de métricas a propósito: se ve aunque Meta no devuelva insights. */}
          {geo && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Dónde se muestra</span>
                {/* Sólo si se pueden cambiar de verdad: con algo que MaKo no entiende, el
                    editor los deja en sólo lectura y el botón prometería otra cosa. */}
                {onCambiarLugar && geo.estado === 'ok' && !geo.lectura.noEntiendo.length && (
                  <button type="button" onClick={onCambiarLugar} style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>Cambiar lugares</button>
                )}
              </div>
              {geo.estado === 'cargando' && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Leyendo en Meta…</span>}
              {geo.estado === 'error' && <span style={{ fontSize: 12.5, color: 'var(--bad)' }}>No pude leer la ubicación: {geo.error}</span>}
              {geo.estado === 'ok' && <LugaresLectura lectura={geo.lectura} />}
            </div>
          )}

          {data && p && (
            <>
              {data.daily.length > 0 && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {METRICAS.map((m) => {
                      const on = m.key === met;
                      return <button key={m.key} type="button" onClick={() => setMet(m.key)} style={{ padding: '6px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: on ? 600 : 500, border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'), background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)' }}>{m.label}</button>;
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 28, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{metricaActiva.fmt(total)}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{metricaActiva.label} {metricaActiva.sum ? 'total' : 'del período'}</span>
                  </div>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <AreaChart data={data.daily} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <defs><linearGradient id="entMet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2F6FED" stopOpacity={0.32} /><stop offset="100%" stopColor="#2F6FED" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                        <XAxis dataKey="fecha" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickFormatter={fmtFecha} interval="preserveStartEnd" minTickGap={28} />
                        <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} width={50} tickFormatter={(n: number) => metricaActiva.fmt(n)} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }} labelFormatter={(l) => fmtFecha(String(l))} formatter={(val) => [metricaActiva.fmt(typeof val === 'number' ? val : null), metricaActiva.label] as [string, string]} />
                        <Area type="monotone" dataKey={met} stroke="#2F6FED" strokeWidth={2.2} fill="url(#entMet)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <BreakdownCharts demograficos={data.demograficos} plataformas={data.plataformas} regiones={data.regiones} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
