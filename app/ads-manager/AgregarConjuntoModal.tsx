'use client';

// =============================================================================
// AgregarConjuntoModal — sumar un conjunto (con 1 anuncio) a una campaña (PAUSA)
// =============================================================================
// El objetivo/optimización + la conversión se heredan de la campaña. El usuario
// define público + ubicaciones (+ presupuesto si la campaña es ABO) y un anuncio.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import { subirCreativo, makeThumb, type SubidoCreativo } from './creativeUpload';
import { CTA_OPCIONES, type Creative, type AdSetSpec, type AudienceRef } from '@/lib/campaign-types';
import type { SenalRecon } from '@/lib/queries';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const USD_MXN = 17.3;
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6, display: 'block' };
const btnDark: CSSProperties = { padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };
const chipS = (on: boolean): CSSProperties => ({ padding: '7px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' });
const PLACEMENTS = [{ value: 'facebook', label: 'Facebook' }, { value: 'instagram', label: 'Instagram' }, { value: 'audience_network', label: 'Audience Network' }, { value: 'messenger', label: 'Messenger' }];

type Basics = { objective: string; budgetLevel: 'campaign' | 'adset'; optimization: string; needsForm: boolean; needsConv: boolean; conversion?: AdSetSpec['conversion'] };
type Tray = { kind: 'upload' | 'existing'; media_type?: 'image' | 'video'; image_hash?: string | null; video_id?: string | null; thumbnail_url?: string | null; source_ad_id?: string | null; processing?: boolean; progress?: number };
type AudItem = AudienceRef & { count?: number | null };

export function AgregarConjuntoModal({ campaignId, defaultAdsetName, senales, onClose, onSaved }: { campaignId: string; defaultAdsetName: string; senales: SenalRecon[]; onClose: () => void; onSaved: () => void }) {
  const [b, setB] = useState<Basics | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [audiencesAll, setAudiencesAll] = useState<AudItem[] | null>(null);
  const [leadForms, setLeadForms] = useState<Array<{ id: string; name: string }> | null>(null);
  // público
  const [advantage, setAdvantage] = useState<0 | 1>(1);
  const [auds, setAuds] = useState<AudienceRef[]>([]);
  const [placements, setPlacements] = useState<string[] | null>(null);
  const [budgetUsd, setBudgetUsd] = useState<number | null>(50);
  // anuncio
  const [tray, setTray] = useState<Tray | null>(null);
  const [verGan, setVerGan] = useState(false);
  const [primary, setPrimary] = useState(''); const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState('LEARN_MORE'); const [url, setUrl] = useState(''); const [leadFormId, setLeadFormId] = useState('');
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/ads-manager/adset-add?campaign_id=${encodeURIComponent(campaignId)}`, { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (j.ok) setB(j.campaign); else setLoadErr(j.error || 'No se pudo cargar la campaña'); })
      .catch((e) => setLoadErr(String(e)));
  }, [campaignId]);
  useEffect(() => { fetch('/api/ads-manager/targeting?kind=audiences', { cache: 'no-store' }).then((r) => r.json()).then((j) => setAudiencesAll(j.ok ? j.items : [])).catch(() => setAudiencesAll([])); }, []);
  useEffect(() => { if (b?.needsForm && leadForms === null) fetch('/api/ads-manager/targeting?kind=leadforms', { cache: 'no-store' }).then((r) => r.json()).then((j) => setLeadForms(j.ok ? j.items : [])).catch(() => setLeadForms([])); }, [b, leadForms]);

  const opts = (audiencesAll ?? []).filter((a) => !auds.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: `${a.name ?? a.id}${a.count != null ? ` · ~${a.count.toLocaleString('es-MX')}` : ''}` }));
  const ganadores = [...senales].filter((s) => s.ad_thumbnail_url).sort((a, b2) => b2.leads - a.leads || b2.spend_usd - a.spend_usd).slice(0, 12);

  async function subir(file: File) {
    setErr(null);
    setTray({ kind: 'upload', media_type: file.type.startsWith('video') ? 'video' : 'image', processing: true, progress: 0, thumbnail_url: null });
    makeThumb(file).then((dt) => { if (dt) setTray((t) => (t ? { ...t, thumbnail_url: t.thumbnail_url ?? dt } : t)); });
    try { const r: SubidoCreativo = await subirCreativo(file, (pct) => setTray((t) => (t ? { ...t, progress: pct } : t))); setTray((t) => (t ? { ...t, media_type: r.media_type, image_hash: r.image_hash, video_id: r.video_id, thumbnail_url: t.thumbnail_url ?? r.thumbnail_url ?? null, processing: false, progress: undefined } : t)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); setTray(null); }
  }

  const convFaltante = !!b?.needsConv && !b.conversion;
  const creativoListo = !!tray && !tray.processing && (!!tray.image_hash || !!tray.video_id || !!tray.source_ad_id);
  const adOk = creativoListo && (tray!.kind === 'existing' || (b ? (b.needsForm ? !!leadFormId : !!url.trim()) : false));
  const puede = !!b && !convFaltante && adOk && (b.budgetLevel === 'campaign' || (!!budgetUsd && budgetUsd > 0));

  const guardar = async () => {
    if (!b || !tray) return;
    setSaving(true); setErr(null);
    const code = defaultAdsetName.split(' ')[0];
    const creative: Creative = tray.kind === 'existing'
      ? { source: 'existing', source_ad_id: tray.source_ad_id ?? null }
      : { source: 'upload', media_type: tray.media_type, image_hash: tray.image_hash ?? null, video_id: tray.video_id ?? null, thumbnail_url: tray.thumbnail_url ?? null, primary_text: primary, headline, cta_type: (cta || (b.needsForm ? 'SIGN_UP' : 'LEARN_MORE')) as Creative['cta_type'], ...(b.needsForm ? { lead_form_id: leadFormId } : { destination_url: url }) };
    const adset: AdSetSpec = {
      name: defaultAdsetName,
      daily_budget_mxn: b.budgetLevel === 'adset' ? Math.round((budgetUsd ?? 0) * USD_MXN) : null,
      optimization_goal: b.optimization, billing_event: 'IMPRESSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: { geo_locations: { countries: ['MX'] }, custom_audiences: auds.length ? auds.map((a) => ({ id: a.id })) : undefined, publisher_platforms: placements && placements.length ? placements : undefined, advantage_audience: advantage },
      ads: [{ name: `${code}.a Anuncio 1`, creative }],
      conversion: b.needsConv ? b.conversion : undefined,
    };
    try {
      const r = await fetch('/api/ads-manager/adset-add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: campaignId, adset }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo agregar el conjunto');
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}><MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord></div>
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 auto' }}>Agregar conjunto</span>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadErr && <div style={{ fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{loadErr}</div>}
          {!b && !loadErr && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>Cargando la campaña…</div>}
          {convFaltante && <div style={{ fontSize: 12.5, color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 12px' }}>Esta campaña optimiza por una conversión web y no pudimos heredarla de un conjunto existente. Agrega el conjunto desde Meta, o usa una campaña de leads/tráfico.</div>}
          {b && !convFaltante && (
            <>
              <div>
                <span style={lbl}>Optimización de audiencia</span>
                <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => setAdvantage(1)} style={chipS(advantage === 1)}>Amplio (Advantage+)</button><button type="button" onClick={() => setAdvantage(0)} style={chipS(advantage === 0)}>Segmentación fina</button></div>
              </div>
              <div>
                <span style={lbl}>Públicos personalizados (opcional)</span>
                <Dropdown value="" resetAfterSelect placeholder={audiencesAll === null ? 'Cargando…' : opts.length ? 'Sumar un público…' : 'Sin públicos'} options={opts} onChange={(v) => { const a = (audiencesAll ?? []).find((x) => x.id === v); if (a) setAuds([...auds, { id: a.id, name: a.name }]); }} width="100%" />
                {auds.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>{auds.map((a) => <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', fontSize: 13 }}>{a.name ?? a.id}<button type="button" onClick={() => setAuds(auds.filter((x) => x.id !== a.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', padding: 0 }}>✕</button></span>)}</div>}
              </div>
              <div>
                <span style={lbl}>Ubicaciones</span>
                <div style={{ display: 'flex', gap: 8, marginBottom: placements ? 8 : 0 }}><button type="button" onClick={() => setPlacements(null)} style={chipS(placements === null)}>Automáticas</button><button type="button" onClick={() => setPlacements(placements ?? ['facebook', 'instagram'])} style={chipS(placements !== null)}>Manual</button></div>
                {placements !== null && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{PLACEMENTS.map((p) => { const on = placements.includes(p.value); return <button key={p.value} type="button" onClick={() => setPlacements(on ? placements.filter((x) => x !== p.value) : [...placements, p.value])} style={chipS(on)}>{on ? '✓ ' : ''}{p.label}</button>; })}</div>}
              </div>
              {b.budgetLevel === 'adset' && (
                <div><span style={lbl}>Presupuesto diario (USD)</span><input value={budgetUsd ?? ''} inputMode="numeric" onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); setBudgetUsd(n > 0 ? n : null); }} style={{ ...field, width: 120 }} /></div>
              )}

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
                <span style={lbl}>Anuncio</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                  <div style={{ width: 64, height: 84, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {tray?.thumbnail_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={tray.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: tray.processing ? 0.6 : 1 }} />
                      : <span style={{ fontSize: 20, color: 'var(--faint)' }}>{tray?.media_type === 'video' ? '🎬' : '🖼️'}</span>}
                    {tray?.processing && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, textAlign: 'center', background: 'rgba(18,21,27,.7)', color: '#fff', fontFamily: MONO, padding: '2px 0' }}>{(tray.progress ?? 0) < 100 ? `${tray.progress ?? 0}%` : 'Procesando'}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button type="button" onClick={() => fileRef.current?.click()} style={btnDark}>⬆ Subir creativo</button>
                    <button type="button" onClick={() => setVerGan((v) => !v)} style={btnGhost}>★ Usar un ganador</button>
                  </div>
                </div>
                {verGan && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto', marginTop: 10 }}>
                    {ganadores.map((s) => (
                      <button key={s.ad_id} type="button" onClick={() => { setTray({ kind: 'existing', source_ad_id: s.ad_id, thumbnail_url: s.ad_thumbnail_url }); setVerGan(false); }} style={{ width: 50, height: 66, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', cursor: 'pointer', padding: 0, flex: 'none' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.ad_thumbnail_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                )}
                {tray?.kind === 'upload' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    <label><span style={lbl}>Texto principal</span><textarea value={primary} onChange={(e) => setPrimary(e.target.value)} rows={3} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} placeholder="Texto del anuncio…" /></label>
                    <label><span style={lbl}>Título</span><input value={headline} onChange={(e) => setHeadline(e.target.value)} style={field} /></label>
                    <div><span style={lbl}>Botón (CTA)</span><Dropdown value={cta} options={CTA_OPCIONES.map((o) => ({ value: o.value as string, label: o.label }))} onChange={setCta} width="100%" /></div>
                    {b.needsForm ? <div><span style={lbl}>Formulario</span><Dropdown value={leadFormId} placeholder={leadForms === null ? 'Cargando…' : 'Elige un formulario…'} options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={setLeadFormId} width="100%" /></div>
                      : <label><span style={lbl}>Destino (URL)</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-landing/vsl" style={field} /></label>}
                  </div>
                )}
                {tray?.kind === 'existing' && <p style={{ fontSize: 12, color: 'var(--dim)', margin: '10px 0 0' }}>Se reusa el ganador tal cual.</p>}
              </div>
            </>
          )}
        </div>

        {b && !convFaltante && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {err && <span style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.4, marginRight: 'auto' }}>{err}</span>}
            <button aria-label="Cerrar" onClick={onClose} style={btnGhost}>Cancelar</button>
            <button onClick={guardar} disabled={!puede || saving} style={{ ...btnDark, opacity: !puede || saving ? 0.5 : 1, cursor: !puede || saving ? 'default' : 'pointer' }}>{saving ? 'Creando…' : 'Agregar en pausa'}</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}
