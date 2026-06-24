'use client';

// =============================================================================
// CampanasBrowser — navegador estilo Meta (Campañas · Conjuntos · Anuncios).
// =============================================================================
// Estado de entrega EN VIVO (/api/meta-health) cruzado con rendimiento
// almacenado (senales) + CRM (cierres/cash). Seleccionar una campaña filtra sus
// conjuntos; seleccionar un conjunto filtra sus anuncios — igual que Meta.
//   - fila de anuncio  → modal AdDetalle (el pop-up que ya existía).
//   - fila de campaña/conjunto → modal EntityDetalle (gráficos + Analizar MaKo).

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Dropdown } from '../../components/Dropdown';
import type { SenalRecon } from '@/lib/queries';
import type { ReconVeredicto, RitmoEstado } from '@/lib/queries';
import { colorDeSemaforo, bgDeSemaforo, type MetaHealth, type NodoEstado, type Semaforo } from '@/lib/meta-health';
import type { CrossData } from './EntityDetalle';

const AdDetalle = dynamic(() => import('../ad-charts').then((m) => m.AdDetalle), { ssr: false });
const EntityDetalle = dynamic(() => import('./EntityDetalle').then((m) => m.EntityDetalle), { ssr: false });

const MONO = "'Geist Mono', monospace";

// ── formato ──
const fmtUSD = (n: number | null | undefined, d?: number) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = d ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
};
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtMXN0 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n));

// ── perf agregada ──
type Perf = { spend_usd: number; impressions: number; link_clicks: number; leads: number; agendas: number; cierres: number; cash_usd: number };
const emptyPerf = (): Perf => ({ spend_usd: 0, impressions: 0, link_clicks: 0, leads: 0, agendas: 0, cierres: 0, cash_usd: 0 });
function addPerf(a: Perf, s: SenalRecon) {
  a.spend_usd += s.spend_usd; a.impressions += s.impressions; a.link_clicks += s.link_clicks;
  a.leads += s.leads; a.agendas += s.agendas; a.cierres += s.cierres; a.cash_usd += s.cash_usd;
}
const costoRes = (p: Perf) => (p.agendas > 0 ? p.spend_usd / p.agendas : null);

type Tab = 'campanas' | 'conjuntos' | 'anuncios';
type EstadoFiltro = 'all' | 'verde' | 'ambar' | 'gris' | 'rojo';
const ESTADO_OPCIONES = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'rojo', label: 'Rechazados / con problemas', color: 'var(--bad)' },
  { value: 'ambar', label: 'En revisión / aprendizaje', color: 'var(--warn-fill)' },
  { value: 'verde', label: 'Activos', color: 'var(--good)' },
  { value: 'gris', label: 'Pausados', color: 'var(--dim)' },
];

function Pill({ semaforo, label }: { semaforo: Semaforo; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: colorDeSemaforo(semaforo), background: bgDeSemaforo(semaforo), whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorDeSemaforo(semaforo) }} />{label}
    </span>
  );
}

// Senal sintética para abrir AdDetalle en anuncios sin gasto en el rango.
function synthSenal(node: NodoEstado, campana: string | null, adset: string | null): SenalRecon {
  return {
    ad_id: node.id, ad_name: node.name, campana, adset_name: adset,
    spend_usd: 0, leads: 0, meta_leads: 0, dias_corriendo: 0,
    ritmo: 'sin_datos' as RitmoEstado, ritmo_dias: [], veredicto: 'explorando' as ReconVeredicto,
    agendas: 0, cierres: 0, cash_usd: 0, hook_rate: null, hold_rate: null, ctr_link: null,
    cpl_usd: null, frequency: null, impressions: 0, link_clicks: 0, cpm_usd: null, cpc_usd: null,
    ad_thumbnail_url: null, ad_permalink: null, ad_creative_sin_enlace: true,
  };
}

const th: CSSProperties = { textAlign: 'right', padding: '11px 14px', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
const thL: CSSProperties = { ...th, textAlign: 'left' };
const td: CSSProperties = { textAlign: 'right', padding: '13px 14px', fontSize: 13.5, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
const tdL: CSSProperties = { ...td, textAlign: 'left' };

export function CampanasBrowser({ senales, desde, hasta }: { senales: SenalRecon[]; desde: string; hasta: string }) {
  const [health, setHealth] = useState<MetaHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('campanas');
  const [selCampaign, setSelCampaign] = useState<string | null>(null);
  const [selAdset, setSelAdset] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoFiltro>('all');

  const [adSel, setAdSel] = useState<SenalRecon | null>(null);
  const [entSel, setEntSel] = useState<{ node: NodoEstado; level: 'campaign' | 'adset'; cross: CrossData } | null>(null);

  const cargar = () => {
    setLoading(true); setError(null);
    fetch('/api/meta-health')
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setHealth(j); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ── merges senales → perf por nivel ──
  const { byAd, byCamp, byAdset } = useMemo(() => {
    const byAd = new Map<string, SenalRecon>();
    const byCamp = new Map<string, Perf>();
    const byAdset = new Map<string, Perf>();
    for (const s of senales) {
      byAd.set(s.ad_id, s);
      const ck = s.campana ?? '—';
      const cp = byCamp.get(ck) ?? emptyPerf(); addPerf(cp, s); byCamp.set(ck, cp);
      const ak = `${s.campana ?? '—'}||${s.adset_name ?? '—'}`;
      const ap = byAdset.get(ak) ?? emptyPerf(); addPerf(ap, s); byAdset.set(ak, ap);
    }
    return { byAd, byCamp, byAdset };
  }, [senales]);

  const campaignsById = useMemo(() => new Map((health?.campaigns ?? []).map((c) => [c.id, c])), [health]);
  const adsetsById = useMemo(() => new Map((health?.adsets ?? []).map((a) => [a.id, a])), [health]);

  const campName = (id: string | null) => (id ? campaignsById.get(id)?.name ?? null : null);
  const adsetCampId = (adsetId: string | null) => (adsetId ? adsetsById.get(adsetId)?.parentId ?? null : null);

  const matchEstado = (n: NodoEstado) => estado === 'all' || n.semaforo === estado;

  // filas
  const campRows = useMemo(() => (health?.campaigns ?? [])
    .filter(matchEstado)
    .map((node) => ({ node, perf: byCamp.get(node.name) ?? emptyPerf() }))
    .sort((a, b) => b.perf.spend_usd - a.perf.spend_usd), [health, byCamp, estado]);

  const adsetRows = useMemo(() => (health?.adsets ?? [])
    .filter((a) => !selCampaign || a.parentId === selCampaign)
    .filter(matchEstado)
    .map((node) => {
      const cn = campName(node.parentId);
      const perf = byAdset.get(`${cn ?? '—'}||${node.name}`) ?? emptyPerf();
      return { node, perf, campName: cn };
    })
    .sort((a, b) => b.perf.spend_usd - a.perf.spend_usd), [health, byAdset, selCampaign, estado]);

  const adRows = useMemo(() => (health?.ads ?? [])
    .filter((ad) => {
      if (selAdset) return ad.parentId === selAdset;
      if (selCampaign) return adsetCampId(ad.parentId) === selCampaign;
      return true;
    })
    .filter(matchEstado)
    .map((node) => {
      const senal = byAd.get(node.id) ?? null;
      const cn = campName(adsetCampId(node.parentId));
      const an = node.parentId ? adsetsById.get(node.parentId)?.name ?? null : null;
      return { node, senal, campName: cn, adsetName: an };
    })
    .sort((a, b) => (b.senal?.spend_usd ?? 0) - (a.senal?.spend_usd ?? 0)), [health, byAd, selCampaign, selAdset, estado]);

  const abrirCampaign = (node: NodoEstado) => {
    const p = byCamp.get(node.name) ?? emptyPerf();
    setEntSel({ node, level: 'campaign', cross: { cierres: p.cierres, cash_usd: p.cash_usd, agendasCrm: p.agendas } });
  };
  const abrirAdset = (node: NodoEstado) => {
    const cn = campName(node.parentId);
    const p = byAdset.get(`${cn ?? '—'}||${node.name}`) ?? emptyPerf();
    setEntSel({ node, level: 'adset', cross: { cierres: p.cierres, cash_usd: p.cash_usd, agendasCrm: p.agendas } });
  };
  const abrirAd = (node: NodoEstado, senal: SenalRecon | null, cn: string | null, an: string | null) => {
    setAdSel(senal ?? synthSenal(node, cn, an));
  };

  const drillCampaign = (id: string) => { setSelCampaign(id); setSelAdset(null); setTab('conjuntos'); };
  const drillAdset = (id: string) => { setSelAdset(id); setTab('anuncios'); };

  const tabs: Array<{ key: Tab; label: string; n: number }> = [
    { key: 'campanas', label: 'Campañas', n: health?.campaigns.length ?? 0 },
    { key: 'conjuntos', label: selCampaign ? 'Conjuntos · 1 campaña' : 'Conjuntos', n: adsetRows.length },
    { key: 'anuncios', label: selAdset ? 'Anuncios · 1 conjunto' : selCampaign ? 'Anuncios · 1 campaña' : 'Anuncios', n: adRows.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* sub-tabs estilo Meta */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`, background: 'transparent', cursor: 'pointer', fontSize: 15, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)' }}>
              {t.label}
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', background: 'var(--surface-2)', borderRadius: 999, padding: '1px 8px' }}>{t.n}</span>
            </button>
          );
        })}
      </div>

      {/* barra de filtros + drill chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Dropdown value={estado} options={ESTADO_OPCIONES} onChange={(v) => setEstado(v as EstadoFiltro)} ariaLabel="Filtrar por estado" width={230} />
        {selCampaign && (
          <Chip label={`Campaña: ${campName(selCampaign) ?? '—'}`} onClear={() => { setSelCampaign(null); setSelAdset(null); }} />
        )}
        {selAdset && (
          <Chip label={`Conjunto: ${adsetsById.get(selAdset)?.name ?? '—'}`} onClear={() => setSelAdset(null)} />
        )}
        <button type="button" onClick={cargar} style={{ marginLeft: 'auto', padding: '9px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--dim)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>↻ Actualizar estado</button>
      </div>

      {loading && <div style={{ fontSize: 14, color: 'var(--faint)', padding: '20px 4px' }}>Cargando estado de Meta…</div>}
      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 14, padding: '18px 22px' }}>
          <p style={{ fontWeight: 600, color: 'var(--bad)', margin: '0 0 4px' }}>No se pudo leer el estado de Meta</p>
          <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--dim)', margin: 0 }}>{error}</p>
        </div>
      )}

      {health && !loading && (
        <>
          {health.account.severidad !== 'verde' && (
            <Link href="/marketing/salud" style={{ display: 'block', textDecoration: 'none', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--bad)' }}>Cuenta: {health.account.statusLabel}.</span>
              <span style={{ fontSize: 13.5, color: 'var(--dim)' }}> La entrega puede estar frenada pese a campañas activas — ver Estado de Meta →</span>
            </Link>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              {tab === 'campanas' && <TablaCampanas rows={campRows} onOpen={abrirCampaign} onDrill={drillCampaign} />}
              {tab === 'conjuntos' && <TablaConjuntos rows={adsetRows} onOpen={abrirAdset} onDrill={drillAdset} />}
              {tab === 'anuncios' && <TablaAnuncios rows={adRows} onOpen={abrirAd} />}
            </div>
          </div>
        </>
      )}

      <footer style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', paddingTop: 4 }}>
        Estado en vivo de Meta + rendimiento del rango (Meta) cruzado con cierres/cash del CRM. Montos en USD; presupuesto en MXN (como Meta).
      </footer>

      {adSel && <AdDetalle s={adSel} desde={desde} hasta={hasta} onClose={() => setAdSel(null)} />}
      {entSel && (
        <EntityDetalle
          id={entSel.node.id} level={entSel.level} name={entSel.node.name}
          statusLabel={entSel.node.statusLabel} semaforo={entSel.node.semaforo}
          desde={desde} hasta={hasta} cross={entSel.cross} recosMeta={entSel.node.recosMeta}
          presupuestoMxn={entSel.node.dailyBudgetMxn ?? null}
          onClose={() => setEntSel(null)}
        />
      )}
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '7px 13px' }}>
      {label}
      <button type="button" onClick={onClear} style={{ border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
    </span>
  );
}

// ── tablas ──
function TablaCampanas({ rows, onOpen, onDrill }: { rows: Array<{ node: NodoEstado; perf: Perf }>; onOpen: (n: NodoEstado) => void; onDrill: (id: string) => void }) {
  if (rows.length === 0) return <Vacio texto="Sin campañas para este filtro." />;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
      <thead><tr>
        <th style={thL}>Campaña</th><th style={thL}>Entrega</th><th style={th}>Presupuesto</th><th style={th}>Gastado</th>
        <th style={th}>Agendas</th><th style={th}>Costo/agenda</th><th style={th}>Cierres</th><th style={th}>Cash</th><th style={th}>Impresiones</th><th style={th}></th>
      </tr></thead>
      <tbody>
        {rows.map(({ node, perf }) => (
          <tr key={node.id} onClick={() => onOpen(node)} style={{ cursor: 'pointer' }} className="rowHover">
            <td style={{ ...tdL, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{node.name}</td>
            <td style={tdL}><Pill semaforo={node.semaforo} label={node.statusLabel} /></td>
            <td style={td}>{node.dailyBudgetMxn ? `${fmtMXN0(node.dailyBudgetMxn)}/día` : '—'}</td>
            <td style={td}>{fmtUSD(perf.spend_usd, 0)}</td>
            <td style={td}>{perf.agendas > 0 ? fmtNum(perf.agendas) : '—'}</td>
            <td style={td}>{fmtUSD(costoRes(perf))}</td>
            <td style={{ ...td, color: perf.cierres > 0 ? 'var(--good)' : 'var(--ink)' }}>{perf.cierres > 0 ? fmtNum(perf.cierres) : '—'}</td>
            <td style={td}>{perf.cash_usd > 0 ? fmtUSD(perf.cash_usd, 0) : '—'}</td>
            <td style={td}>{fmtNum(perf.impressions)}</td>
            <td style={td}><button type="button" onClick={(e) => { e.stopPropagation(); onDrill(node.id); }} style={drillBtn}>conjuntos →</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaConjuntos({ rows, onOpen, onDrill }: { rows: Array<{ node: NodoEstado; perf: Perf; campName: string | null }>; onOpen: (n: NodoEstado) => void; onDrill: (id: string) => void }) {
  if (rows.length === 0) return <Vacio texto="Sin conjuntos para este filtro." />;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
      <thead><tr>
        <th style={thL}>Conjunto</th><th style={thL}>Entrega</th><th style={thL}>Aprendizaje</th><th style={th}>Presupuesto</th><th style={th}>Gastado</th>
        <th style={th}>Agendas</th><th style={th}>Costo/agenda</th><th style={th}>Cierres</th><th style={th}>Impresiones</th><th style={th}></th>
      </tr></thead>
      <tbody>
        {rows.map(({ node, perf }) => (
          <tr key={node.id} onClick={() => onOpen(node)} style={{ cursor: 'pointer' }} className="rowHover">
            <td style={{ ...tdL, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{node.name}</td>
            <td style={tdL}><Pill semaforo={node.semaforo} label={node.statusLabel} /></td>
            <td style={tdL}>{node.learning ? <Pill semaforo={node.learning.semaforo} label={node.learning.label} /> : '—'}</td>
            <td style={td}>{node.dailyBudgetMxn ? `${fmtMXN0(node.dailyBudgetMxn)}/día` : '—'}</td>
            <td style={td}>{fmtUSD(perf.spend_usd, 0)}</td>
            <td style={td}>{perf.agendas > 0 ? fmtNum(perf.agendas) : '—'}</td>
            <td style={td}>{fmtUSD(costoRes(perf))}</td>
            <td style={{ ...td, color: perf.cierres > 0 ? 'var(--good)' : 'var(--ink)' }}>{perf.cierres > 0 ? fmtNum(perf.cierres) : '—'}</td>
            <td style={td}>{fmtNum(perf.impressions)}</td>
            <td style={td}><button type="button" onClick={(e) => { e.stopPropagation(); onDrill(node.id); }} style={drillBtn}>anuncios →</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaAnuncios({ rows, onOpen }: { rows: Array<{ node: NodoEstado; senal: SenalRecon | null; campName: string | null; adsetName: string | null }>; onOpen: (n: NodoEstado, s: SenalRecon | null, cn: string | null, an: string | null) => void }) {
  if (rows.length === 0) return <Vacio texto="Sin anuncios para este filtro." />;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
      <thead><tr>
        <th style={thL}>Anuncio</th><th style={thL}>Entrega</th><th style={th}>Gastado</th><th style={th}>Leads</th>
        <th style={th}>Agendas</th><th style={th}>Cierres</th><th style={th}>Cash</th><th style={th}>Impresiones</th><th style={thL}>Problemas</th>
      </tr></thead>
      <tbody>
        {rows.map(({ node, senal, campName, adsetName }) => (
          <tr key={node.id} onClick={() => onOpen(node, senal, campName, adsetName)} style={{ cursor: 'pointer' }} className="rowHover">
            <td style={{ ...tdL, maxWidth: 320 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {senal?.ad_thumbnail_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={senal.ad_thumbnail_url} alt="" style={{ width: 30, height: 40, borderRadius: 5, objectFit: 'cover', flex: 'none', border: '1px solid var(--border)' }} />
                  : <span style={{ width: 30, height: 40, borderRadius: 5, flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)' }} />}
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
              </span>
            </td>
            <td style={tdL}><Pill semaforo={node.semaforo} label={node.statusLabel} /></td>
            <td style={td}>{senal ? fmtUSD(senal.spend_usd, 0) : '—'}</td>
            <td style={td}>{senal && senal.leads > 0 ? fmtNum(senal.leads) : '—'}</td>
            <td style={td}>{senal && senal.agendas > 0 ? fmtNum(senal.agendas) : '—'}</td>
            <td style={{ ...td, color: senal && senal.cierres > 0 ? 'var(--good)' : 'var(--ink)' }}>{senal && senal.cierres > 0 ? fmtNum(senal.cierres) : '—'}</td>
            <td style={td}>{senal && senal.cash_usd > 0 ? fmtUSD(senal.cash_usd, 0) : '—'}</td>
            <td style={td}>{senal ? fmtNum(senal.impressions) : '—'}</td>
            <td style={{ ...tdL, maxWidth: 240, whiteSpace: 'normal' }}>{node.issues && node.issues.length > 0 ? <span style={{ fontSize: 12, color: 'var(--bad)' }}>{node.issues[0].resumen}</span> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const drillBtn: CSSProperties = { padding: '5px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' };

function Vacio({ texto }: { texto: string }) {
  return <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0, padding: '26px 18px' }}>{texto}</p>;
}
