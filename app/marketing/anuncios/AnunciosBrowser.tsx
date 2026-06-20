'use client';

// =============================================================================
// AnunciosBrowser — filtro/orden por campaña y adset + modal de detalle
// =============================================================================
// El detalle (gráficos recharts + mapa d3-geo) vive en ../ad-charts y se carga
// on-demand al abrir un anuncio (next/dynamic), para no pesar el bundle inicial.

import { useMemo, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { SenalRecon } from '@/lib/queries';
import { AnuncioCard, compararCombo } from '../AnuncioCard';

const AdDetalle = dynamic(() => import('../ad-charts').then((m) => m.AdDetalle), { ssr: false });

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Orden = 'agendas' | 'spend' | 'leads' | 'cierres';
const ORDENES: Array<{ key: Orden; label: string }> = [
  { key: 'agendas', label: 'Agendas (Meta)' }, { key: 'spend', label: 'Gasto' },
  { key: 'leads', label: 'Leads' }, { key: 'cierres', label: 'Cierres' },
];

const selStyle: CSSProperties = { padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer', outline: 'none', maxWidth: 280 };
const lblStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };

export function AnunciosBrowser({ senales, desde, hasta }: { senales: SenalRecon[]; desde: string; hasta: string }) {
  const [campana, setCampana] = useState('all');
  const [adset, setAdset] = useState('all');
  const [orden, setOrden] = useState<Orden>('agendas');
  const [sel, setSel] = useState<SenalRecon | null>(null);

  const campanas = useMemo(() => [...new Set(senales.map((s) => s.campana ?? 'Sin campaña'))].sort((a, b) => a.localeCompare(b)), [senales]);
  const adsets = useMemo(() => {
    const pool = campana === 'all' ? senales : senales.filter((s) => (s.campana ?? 'Sin campaña') === campana);
    return [...new Set(pool.map((s) => s.adset_name ?? 'Sin adset'))].sort((a, b) => a.localeCompare(b));
  }, [senales, campana]);

  const lista = useMemo(() => {
    let l = senales;
    if (campana !== 'all') l = l.filter((s) => (s.campana ?? 'Sin campaña') === campana);
    if (adset !== 'all') l = l.filter((s) => (s.adset_name ?? 'Sin adset') === adset);
    const cmp: Record<Orden, (a: SenalRecon, b: SenalRecon) => number> = {
      agendas: (a, b) => b.agendas - a.agendas || compararCombo(a, b),
      spend: (a, b) => b.spend_usd - a.spend_usd,
      leads: (a, b) => b.leads - a.leads,
      cierres: (a, b) => b.cierres - a.cierres || b.agendas - a.agendas,
    };
    return [...l].sort(cmp[orden]);
  }, [senales, campana, adset, orden]);

  const onCampana = (val: string) => { setCampana(val); setAdset('all'); };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <label style={lblStyle}>Campaña</label>
          <select value={campana} onChange={(e) => onCampana(e.target.value)} style={selStyle}>
            <option value="all">Todas las campañas</option>
            {campanas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lblStyle}>Adset</label>
          <select value={adset} onChange={(e) => setAdset(e.target.value)} style={selStyle}>
            <option value="all">Todos los adsets</option>
            {adsets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label style={lblStyle}>Ordenar por</label>
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} style={selStyle}>
            {ORDENES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>{lista.length} anuncio{lista.length === 1 ? '' : 's'}</div>
        {(campana !== 'all' || adset !== 'all') && (
          <button type="button" onClick={() => { setCampana('all'); setAdset('all'); }} style={{ padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>✕ Limpiar</button>
        )}
      </div>

      {lista.length === 0 ? (
        <p style={{ fontSize: 14.5, color: 'var(--faint)' }}>Sin anuncios para este filtro.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {lista.map((s, i) => (
            <div key={s.ad_id} onClick={() => setSel(s)} style={{ cursor: 'pointer' }}>
              <AnuncioCard s={s} rank={i + 1} disableLink />
            </div>
          ))}
        </div>
      )}

      {sel && <AdDetalle s={sel} desde={desde} hasta={hasta} onClose={() => setSel(null)} />}
    </>
  );
}
