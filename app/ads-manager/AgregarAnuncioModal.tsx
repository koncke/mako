'use client';

// =============================================================================
// AgregarAnuncioModal — sumar un anuncio a un conjunto existente (en PAUSA)
// =============================================================================
// Subís un creativo nuevo (o reusás un ganador), escribís el copy y se crea el
// anuncio dentro del conjunto. Si el conjunto es de formulario, pide el formulario;
// si no, la URL de destino.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import { subirCreativo, makeThumb, type SubidoCreativo } from './creativeUpload';
import { CTA_OPCIONES, type Creative } from '@/lib/campaign-types';
import type { SenalRecon } from '@/lib/queries';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5, display: 'block' };
const btnDark: CSSProperties = { padding: '11px 20px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '11px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };

type Tray = { kind: 'upload' | 'existing'; media_type?: 'image' | 'video'; image_hash?: string | null; video_id?: string | null; thumbnail_url?: string | null; source_ad_id?: string | null; label: string; processing?: boolean; progress?: number };

export function AgregarAnuncioModal({ adsetId, defaultName, senales, onClose, onSaved }: { adsetId: string; defaultName: string; senales: SenalRecon[]; onClose: () => void; onSaved: () => void }) {
  const [info, setInfo] = useState<{ needsForm: boolean } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tray, setTray] = useState<Tray | null>(null);
  const [verGanadores, setVerGanadores] = useState(false);
  const [primary, setPrimary] = useState(''); const [headline, setHeadline] = useState('');
  const [cta, setCta] = useState('LEARN_MORE'); const [url, setUrl] = useState('');
  const [leadForms, setLeadForms] = useState<Array<{ id: string; name: string }> | null>(null);
  const [leadFormId, setLeadFormId] = useState('');
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/ads-manager/ad-add?adset_id=${encodeURIComponent(adsetId)}`, { cache: 'no-store' }).then((r) => r.json())
      .then((j) => { if (j.ok) setInfo({ needsForm: !!j.adset.needsForm }); else setLoadErr(j.error || 'No se pudo cargar el conjunto'); })
      .catch((e) => setLoadErr(String(e)));
  }, [adsetId]);
  useEffect(() => { if (info?.needsForm && leadForms === null) fetch('/api/ads-manager/targeting?kind=leadforms', { cache: 'no-store' }).then((r) => r.json()).then((j) => setLeadForms(j.ok ? j.items : [])).catch(() => setLeadForms([])); }, [info, leadForms]);

  const ganadores = [...senales].filter((s) => s.ad_thumbnail_url).sort((a, b) => b.leads - a.leads || b.spend_usd - a.spend_usd).slice(0, 12);

  async function subir(file: File) {
    setErr(null);
    setTray({ kind: 'upload', media_type: file.type.startsWith('video') ? 'video' : 'image', label: file.name, processing: true, progress: 0, thumbnail_url: null });
    makeThumb(file).then((dt) => { if (dt) setTray((t) => (t ? { ...t, thumbnail_url: t.thumbnail_url ?? dt } : t)); });
    try {
      const r: SubidoCreativo = await subirCreativo(file, (pct) => setTray((t) => (t ? { ...t, progress: pct } : t)));
      setTray((t) => (t ? { ...t, media_type: r.media_type, image_hash: r.image_hash, video_id: r.video_id, thumbnail_url: t.thumbnail_url ?? r.thumbnail_url ?? null, processing: false, progress: undefined } : t));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setTray(null); }
  }

  const listo = !!tray && !tray.processing && (!!tray.image_hash || !!tray.video_id || !!tray.source_ad_id);
  const puede = listo && (tray!.kind === 'existing' || (info ? (info.needsForm ? !!leadFormId : !!url.trim()) : false));

  const guardar = async () => {
    if (!tray || !info) return;
    setSaving(true); setErr(null);
    const creative: Creative = tray.kind === 'existing'
      ? { source: 'existing', source_ad_id: tray.source_ad_id ?? null }
      : {
          source: 'upload', media_type: tray.media_type, image_hash: tray.image_hash ?? null, video_id: tray.video_id ?? null, thumbnail_url: tray.thumbnail_url ?? null,
          primary_text: primary, headline, cta_type: (cta || (info.needsForm ? 'SIGN_UP' : 'LEARN_MORE')) as Creative['cta_type'],
          ...(info.needsForm ? { lead_form_id: leadFormId } : { destination_url: url }),
        };
    try {
      const r = await fetch('/api/ads-manager/ad-add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adset_id: adsetId, creative, name: defaultName }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo agregar el anuncio');
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}><MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord></div>
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 auto' }}>Agregar anuncio</span>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loadErr && <div style={{ fontSize: 13, color: 'var(--bad)', textAlign: 'center' }}>{loadErr}</div>}
          {!info && !loadErr && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>Cargando…</div>}
          {info && (
            <>
              {/* creativo */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 70, height: 92, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {tray?.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={tray.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: tray.processing ? 0.6 : 1 }} />
                    : <span style={{ fontSize: 22, color: 'var(--faint)' }}>{tray?.media_type === 'video' ? '🎬' : '🖼️'}</span>}
                  {tray?.processing && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, textAlign: 'center', background: 'rgba(18,21,27,.7)', color: '#fff', fontFamily: MONO, padding: '2px 0' }}>{(tray.progress ?? 0) < 100 ? `${tray.progress ?? 0}%` : 'Procesando'}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={btnDark}>⬆ Subir creativo</button>
                  <button type="button" onClick={() => setVerGanadores((v) => !v)} style={btnGhost}>★ Usar un ganador</button>
                </div>
              </div>
              {verGanadores && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 160, overflowY: 'auto' }}>
                  {ganadores.length === 0 ? <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sin anuncios con creativo para reusar.</p> : ganadores.map((s) => (
                    <button key={s.ad_id} type="button" onClick={() => { setTray({ kind: 'existing', source_ad_id: s.ad_id, thumbnail_url: s.ad_thumbnail_url, label: s.ad_name }); setVerGanadores(false); }} title={`${s.ad_name} · ${s.leads} leads`} style={{ width: 52, height: 68, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', cursor: 'pointer', padding: 0, flex: 'none' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.ad_thumbnail_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}

              {/* copy — solo si es creativo subido (el ganador reusa su propio copy) */}
              {tray?.kind === 'upload' && (
                <>
                  <label><span style={lbl}>Texto principal</span><textarea value={primary} onChange={(e) => setPrimary(e.target.value)} rows={4} style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} placeholder="Escribe el texto del anuncio…" /></label>
                  <label><span style={lbl}>Título</span><input value={headline} onChange={(e) => setHeadline(e.target.value)} style={field} placeholder="Título corto" /></label>
                  <div><span style={lbl}>Botón (CTA)</span><Dropdown value={cta} options={CTA_OPCIONES.map((o) => ({ value: o.value as string, label: o.label }))} onChange={setCta} width="100%" /></div>
                  {info.needsForm ? (
                    <div><span style={lbl}>Formulario instantáneo</span><Dropdown value={leadFormId} placeholder={leadForms === null ? 'Cargando…' : leadForms.length ? 'Elige un formulario…' : 'Sin formularios'} options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={setLeadFormId} width="100%" /></div>
                  ) : (
                    <label><span style={lbl}>Destino (URL)</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tu-landing/vsl" style={field} /></label>
                  )}
                </>
              )}
              {tray?.kind === 'existing' && <p style={{ fontSize: 12.5, color: 'var(--dim)', margin: 0 }}>Se reusa el anuncio ganador tal cual (su copy y destino). Se crea en <b>pausa</b>.</p>}
            </>
          )}
        </div>

        {info && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {err && <span style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.4, marginRight: 'auto' }}>{err}</span>}
            <button aria-label="Cerrar" onClick={onClose} style={btnGhost}>Cancelar</button>
            <button onClick={guardar} disabled={!puede || saving} style={{ ...btnDark, opacity: !puede || saving ? 0.5 : 1, cursor: !puede || saving ? 'default' : 'pointer' }}>{saving ? 'Agregando…' : 'Agregar en pausa'}</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}
