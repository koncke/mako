'use client';

// =============================================================================
// NuevaCampanaModal — crear una campaña con MaKo (Ads Manager · "Nueva campaña")
// =============================================================================
// Flujo: BRIEF (describís la campaña a MaKo + adjuntás creativos: subís archivos
// o elegís un anuncio ganador) → MaKo propone una estructura aterrizada en tu
// funnel/KPIs → REVISÁS y editás todo (objetivo, presupuesto, segmentación
// completa, copy, creativo) con ayuda de MaKo ("ajustá…") y previsualizás →
// PUBLICÁS. Todo se crea en Meta en PAUSA; se activa después con el toggle de la
// tabla. Escrituras: /api/ads-manager/campaign-{suggest,create,preview}, creative-upload, targeting.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import type { SenalRecon } from '@/lib/queries';
import {
  type CampaignSpec, type AdSetSpec, type AdSpec, type Creative, type Targeting,
  type Objective, type CTAType, type AudienceRef, type InterestSpec,
  OBJETIVOS, objetivoDef, GENEROS, PLACEMENTS, CTA_OPCIONES,
} from '@/lib/campaign-types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── estilos compartidos ──
const inp: CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', display: 'block', marginBottom: 5 };
const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 12.5, color: 'var(--ink)' };
const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' };

type Phase = 'brief' | 'loading' | 'review' | 'publishing' | 'done';
type Uso = { tokens: number; costUsd: number } | null;

// Creativo disponible (en la bandeja): subido nuevo o un anuncio ganador.
type TrayItem = {
  id: string;
  kind: 'upload' | 'existing';
  media_type?: 'image' | 'video';
  image_hash?: string | null;
  video_id?: string | null;
  thumbnail_url?: string | null;
  source_ad_id?: string | null;
  label: string;
  processing?: boolean;
  progress?: number; // 0..100 mientras sube al storage; 100 = procesando en Meta
};

const fmtUso = (u: Uso) => (!u ? '' : `✦ ${u.tokens >= 1000 ? `${(u.tokens / 1000).toFixed(1)}k` : u.tokens} tok · $${u.costUsd >= 1 ? u.costUsd.toFixed(2) : u.costUsd.toFixed(3)}`);

// PUT del archivo a la URL firmada de Supabase, con progreso (fetch no expone
// progreso de subida → XHR). Supabase espera multipart: el archivo bajo el
// campo '' + un campo cacheControl (así lo arma su propio SDK).
function putWithProgress(url: string, file: File, apikey: string | null, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('x-upsert', 'true');
    if (apikey) xhr.setRequestHeader('apikey', apikey);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`No se pudo subir el archivo (HTTP ${xhr.status})`)); };
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo.'));
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', file);
    xhr.send(fd);
  });
}

export function NuevaCampanaModal({ senales, onClose, onPublished }: { senales: SenalRecon[]; onClose: () => void; onPublished: () => void }) {
  const [phase, setPhase] = useState<Phase>('brief');
  const [prompt, setPrompt] = useState('');
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [spec, setSpec] = useState<CampaignSpec | null>(null);
  const [uso, setUso] = useState<Uso>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState('');
  const [ajustando, setAjustando] = useState(false);
  const [result, setResult] = useState<{ campaign_id: string; ads: number } | null>(null);
  const trayCounter = useRef(0);

  // Públicos personalizados de la cuenta (para retargeting). Carga perezosa 1 vez.
  const [audiences, setAudiences] = useState<AudienceRef[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/ads-manager/targeting?kind=audiences').then((r) => r.json())
      .then((j) => { if (alive && j.ok) setAudiences(j.items); }).catch(() => { if (alive) setAudiences([]); });
    return () => { alive = false; };
  }, []);

  // ── update helpers (inmutables) ──
  const update = (fn: (s: CampaignSpec) => CampaignSpec) => setSpec((p) => (p ? fn(p) : p));
  const setAdset = (i: number, fn: (a: AdSetSpec) => AdSetSpec) => update((s) => ({ ...s, adsets: s.adsets.map((a, idx) => (idx === i ? fn(a) : a)) }));
  const patchTargeting = (i: number, patch: Partial<Targeting>) => setAdset(i, (a) => ({ ...a, targeting: { ...a.targeting, ...patch } }));
  const setAd = (ai: number, di: number, fn: (ad: AdSpec) => AdSpec) => setAdset(ai, (a) => ({ ...a, ads: a.ads.map((ad, idx) => (idx === di ? fn(ad) : ad)) }));
  const patchCreative = (ai: number, di: number, patch: Partial<Creative>) => setAd(ai, di, (ad) => ({ ...ad, creative: { ...ad.creative, ...patch } }));

  // ── MaKo: proponer ──
  async function generar() {
    if (!prompt.trim()) { setErr('Contale a MaKo qué campaña querés.'); return; }
    setErr(null); setPhase('loading');
    try {
      const r = await fetch('/api/ads-manager/campaign-suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'suggest', prompt: prompt.trim(), creativos: traySummary(tray) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'MaKo no pudo proponer');
      setSpec(autobind(j.spec as CampaignSpec, tray));
      setUso(j.uso ?? null);
      setPhase('review');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase('brief'); }
  }

  // ── MaKo: ajustar el spec actual ──
  async function ajustar() {
    if (!ajuste.trim() || !spec) return;
    setAjustando(true); setErr(null);
    try {
      const r = await fetch('/api/ads-manager/campaign-suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'adjust', specActual: spec, instruccion: ajuste.trim() }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'MaKo no pudo ajustar');
      setSpec(autobind(j.spec as CampaignSpec, tray));
      setUso(j.uso ?? null); setAjuste('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setAjustando(false); }
  }

  // ── subir creativo (directo a storage → Meta, esquiva el límite del serverless) ──
  async function subir(file: File) {
    const esVideo = file.type.startsWith('video');
    const maxMb = esVideo ? 512 : 30;
    if (file.size > maxMb * 1024 * 1024) { setErr(`"${file.name}" supera el máximo (${maxMb} MB).`); return; }
    const id = `up-${++trayCounter.current}`;
    // Previa local inmediata para imágenes (el video queda con ícono).
    const localUrl = esVideo ? null : URL.createObjectURL(file);
    const pend: TrayItem = { id, kind: 'upload', media_type: esVideo ? 'video' : 'image', label: file.name, processing: true, progress: 0, thumbnail_url: localUrl };
    setTray((t) => [...t, pend]);
    try {
      // 1) URL firmada para subir directo a Supabase Storage.
      const s = await fetch('/api/ads-manager/creative-signurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content_type: file.type }) });
      const sj = await s.json();
      if (!sj.ok) throw new Error(sj.error || 'No se pudo preparar la subida');
      // 2) Subida directa del archivo con progreso (no pasa por la función → sin tope de body).
      await putWithProgress(sj.signedUrl, file, sj.apikey ?? null, (pct) => setTray((t) => t.map((x) => x.id === id ? { ...x, progress: pct } : x)));
      setTray((t) => t.map((x) => x.id === id ? { ...x, progress: 100 } : x)); // ahora procesa Meta
      // 3) El servidor lo empuja a Meta desde el storage.
      const r = await fetch('/api/ads-manager/creative-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: sj.path, content_type: file.type, filename: file.name }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo procesar el creativo');
      setTray((t) => t.map((x) => x.id === id ? { ...x, media_type: j.media_type, image_hash: j.image_hash ?? null, video_id: j.video_id ?? null, thumbnail_url: x.thumbnail_url ?? j.thumbnail_url ?? null, processing: false, progress: undefined } : x));
    } catch (e) {
      if (localUrl) URL.revokeObjectURL(localUrl);
      setErr(e instanceof Error ? e.message : String(e));
      setTray((t) => t.filter((x) => x.id !== id));
    }
  }

  function agregarGanador(s: SenalRecon) {
    if (tray.some((t) => t.source_ad_id === s.ad_id)) return;
    setTray((t) => [...t, { id: `win-${s.ad_id}`, kind: 'existing', source_ad_id: s.ad_id, thumbnail_url: s.ad_thumbnail_url, label: s.ad_name }]);
  }
  const quitarTray = (id: string) => setTray((t) => t.filter((x) => x.id !== id));

  // ── publicar ──
  async function publicar() {
    if (!spec) return;
    const v = validar(spec);
    if (v) { setErr(v); return; }
    setErr(null); setPhase('publishing');
    try {
      const r = await fetch('/api/ads-manager/campaign-create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec, prompt: prompt.trim(), uso }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo publicar');
      setResult({ campaign_id: j.campaign_id, ads: (j.ad_ids ?? []).length });
      setPhase('done');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase('review'); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(23,21,17,.4)', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>
              <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord> · Nueva campaña
            </div>
            <h2 style={{ fontWeight: 600, fontSize: 21, margin: '3px 0 0', color: 'var(--ink)' }}>
              {phase === 'brief' || phase === 'loading' ? 'Contale tu campaña a MaKo' : phase === 'done' ? 'Campaña creada (en pausa)' : spec?.name || 'Revisá la propuesta'}
            </h2>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {/* body */}
        {phase === 'brief' || phase === 'loading' ? (
          <BriefStep
            prompt={prompt} setPrompt={setPrompt} tray={tray} onSubir={subir} onQuitar={quitarTray}
            senales={senales} onGanador={agregarGanador} loading={phase === 'loading'} err={err} onGenerar={generar} onClose={onClose}
          />
        ) : phase === 'done' && result ? (
          <DoneStep result={result} onClose={() => { onPublished(); onClose(); }} />
        ) : spec ? (
          <ReviewStep
            spec={spec} update={update} setAdset={setAdset} patchTargeting={patchTargeting} setAd={setAd} patchCreative={patchCreative}
            tray={tray} onSubir={subir} senales={senales} onGanador={agregarGanador} onQuitarTray={quitarTray}
            audiences={audiences} uso={uso} err={err}
            ajuste={ajuste} setAjuste={setAjuste} ajustando={ajustando} onAjustar={ajustar}
            publishing={phase === 'publishing'} onPublicar={publicar} onVolver={() => setPhase('brief')}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── BRIEF ─────────────────────────────────────────────────────────────────────
function BriefStep({ prompt, setPrompt, tray, onSubir, onQuitar, senales, onGanador, loading, err, onGenerar, onClose }: {
  prompt: string; setPrompt: (v: string) => void; tray: TrayItem[]; onSubir: (f: File) => void; onQuitar: (id: string) => void;
  senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; loading: boolean; err: string | null; onGenerar: () => void; onClose: () => void;
}) {
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, margin: 0 }}>
        Describí qué querés lograr (objetivo, oferta, a quién apuntás, presupuesto). MaKo mira tu <b>funnel</b>, tus <b>KPIs</b> y tus <b>anuncios ganadores</b> y propone una estructura completa que después editás y publicás. Se crea en <b>pausa</b>.
      </p>
      <div>
        <span style={lbl}>Tu pedido a MaKo</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} autoFocus
          placeholder="Ej: Campaña de adquisición para el VSL, presupuesto ~$300/día, apuntando a dueños de negocio en México. Replicá el ángulo del anuncio que mejor anda."
          style={{ ...inp, resize: 'vertical', minHeight: 96 }} />
      </div>
      <CreativeTray tray={tray} onSubir={onSubir} onQuitar={onQuitar} senales={senales} onGanador={onGanador} />
      {err && <div style={{ fontSize: 13, color: 'var(--bad)' }}>Error: {err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={onGenerar} disabled={loading || !prompt.trim()} style={{ ...btnDark, opacity: loading || !prompt.trim() ? 0.5 : 1, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'MaKo está armando…' : <><MakoStar size={13} color="var(--surface)" /> Generar con MaKo</>}
        </button>
      </div>
    </div>
  );
}

// Bandeja de creativos: subir archivos + elegir ganadores.
function CreativeTray({ tray, onSubir, onQuitar, senales, onGanador, compact }: {
  tray: TrayItem[]; onSubir: (f: File) => void; onQuitar: (id: string) => void; senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [verGanadores, setVerGanadores] = useState(false);
  const ganadores = [...senales].filter((s) => s.ad_thumbnail_url).sort((a, b) => b.leads - a.leads || b.spend_usd - a.spend_usd).slice(0, 12);
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: tray.length ? 10 : 0 }}>
        <span style={{ ...lbl, marginBottom: 0 }}>Creativos {compact ? '' : '(subí imagen/video o reusá un ganador)'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" style={{ display: 'none' }}
            onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => onSubir(f)); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12.5 }}>⬆ Subir</button>
          <button type="button" onClick={() => setVerGanadores((v) => !v)} style={{ ...btnGhost, padding: '6px 11px', fontSize: 12.5 }}>★ Ganadores</button>
        </div>
      </div>

      {tray.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tray.map((t) => (
            <div key={t.id} style={{ position: 'relative', width: 56, height: 76, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', flex: 'none' }} title={t.label}>
              {t.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: t.processing ? 0.7 : 1 }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 18 }}>{t.media_type === 'video' ? '🎬' : '🖼️'}</div>}
              {t.processing && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(23,21,17,.62)', padding: '3px 4px 4px' }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(243,240,231,.25)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${t.progress ?? 0}%`, background: 'var(--accent-soft)', transition: 'width .2s' }} />
                  </div>
                  <div style={{ fontSize: 8, lineHeight: 1.2, color: '#F3F0E7', fontFamily: MONO, textAlign: 'center', marginTop: 2 }}>{(t.progress ?? 0) < 100 ? `${t.progress ?? 0}%` : 'Meta…'}</div>
                </div>
              )}
              {t.kind === 'existing' && <span style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 9, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '0 3px' }}>★</span>}
              <button type="button" onClick={() => onQuitar(t.id)} style={{ position: 'absolute', top: 1, right: 1, width: 16, height: 16, borderRadius: 5, border: 'none', background: 'rgba(23,21,17,.7)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {verGanadores && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {ganadores.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--faint)', margin: 0 }}>Sin anuncios con creativo en el rango.</p> : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 180, overflowY: 'auto' }}>
              {ganadores.map((s) => (
                <button key={s.ad_id} type="button" onClick={() => onGanador(s)} title={`${s.ad_name} · ${s.leads} leads`}
                  style={{ position: 'relative', width: 50, height: 68, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', cursor: 'pointer', padding: 0, flex: 'none' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.ad_thumbnail_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, fontFamily: MONO, background: 'rgba(23,21,17,.7)', color: '#fff', padding: '1px 2px' }}>{s.leads}L</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── REVIEW ──────────────────────────────────────────────────────────────────
function ReviewStep(p: {
  spec: CampaignSpec; update: (fn: (s: CampaignSpec) => CampaignSpec) => void; setAdset: (i: number, fn: (a: AdSetSpec) => AdSetSpec) => void;
  patchTargeting: (i: number, patch: Partial<Targeting>) => void; setAd: (ai: number, di: number, fn: (ad: AdSpec) => AdSpec) => void; patchCreative: (ai: number, di: number, patch: Partial<Creative>) => void;
  tray: TrayItem[]; onSubir: (f: File) => void; senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; onQuitarTray: (id: string) => void;
  audiences: AudienceRef[] | null; uso: Uso; err: string | null;
  ajuste: string; setAjuste: (v: string) => void; ajustando: boolean; onAjustar: () => void;
  publishing: boolean; onPublicar: () => void; onVolver: () => void;
}) {
  const { spec } = p;
  const objDef = objetivoDef(spec.objective);
  return (
    <>
      <div style={{ padding: '16px 24px', maxHeight: '64vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {spec.rationale && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(200,135,12,.07)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
            <MakoStar size={14} />
            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>{spec.rationale}</p>
          </div>
        )}

        {/* Campaña */}
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>Nombre de la campaña</span>
              <input value={spec.name} onChange={(e) => p.update((s) => ({ ...s, name: e.target.value }))} style={inp} maxLength={300} />
            </div>
            <div>
              <span style={lbl}>Objetivo (MaKo lo eligió por tu funnel)</span>
              <Dropdown value={spec.objective} options={OBJETIVOS.map((o) => ({ value: o.value, label: o.label, sub: o.hint }))} onChange={(v) => p.update((s) => ({ ...s, objective: v as Objective }))} width="100%" />
            </div>
            <div>
              <span style={lbl}>Presupuesto</span>
              <Dropdown value={spec.budget_level} options={[{ value: 'campaign', label: 'A nivel campaña (CBO)', sub: 'Meta reparte entre conjuntos' }, { value: 'adset', label: 'A nivel conjunto (ABO)', sub: 'Vos fijás el de cada conjunto' }]} onChange={(v) => p.update((s) => ({ ...s, budget_level: v as 'campaign' | 'adset' }))} width="100%" />
            </div>
            {spec.budget_level === 'campaign' && (
              <div>
                <span style={lbl}>Presupuesto diario (MXN)</span>
                <input value={spec.daily_budget_mxn ?? ''} inputMode="numeric" onChange={(e) => p.update((s) => ({ ...s, daily_budget_mxn: e.target.value ? Number(e.target.value.replace(/[^\d]/g, '')) : null }))} style={inp} placeholder="300" />
              </div>
            )}
          </div>
        </div>

        {/* Conjuntos */}
        {spec.adsets.map((adset, ai) => (
          <AdsetEditor key={ai} ai={ai} adset={adset} spec={spec} objDef={objDef}
            setAdset={p.setAdset} patchTargeting={p.patchTargeting} setAd={p.setAd} patchCreative={p.patchCreative}
            tray={p.tray} onSubir={p.onSubir} senales={p.senales} onGanador={p.onGanador} onQuitarTray={p.onQuitarTray} audiences={p.audiences}
            onRemove={spec.adsets.length > 1 ? () => p.update((s) => ({ ...s, adsets: s.adsets.filter((_, i) => i !== ai) })) : undefined} />
        ))}
        <button type="button" onClick={() => p.update((s) => ({ ...s, adsets: [...s.adsets, nuevoConjunto(s, s.adsets.length)] }))} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Agregar conjunto</button>

        {/* Ajustar con MaKo */}
        <div style={{ ...card, background: 'var(--surface)' }}>
          <span style={lbl}><MakoWord base="var(--accent)">MaKo</MakoWord> — ajustá lo que quieras en lenguaje natural</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={p.ajuste} onChange={(e) => p.setAjuste(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') p.onAjustar(); }}
              placeholder="Ej: sumá un conjunto de retargeting, subí el presupuesto a $500, apuntá 30-50 años…" style={{ ...inp, flex: 1 }} />
            <button type="button" onClick={p.onAjustar} disabled={p.ajustando || !p.ajuste.trim()} style={{ ...btnDark, padding: '9px 14px', opacity: p.ajustando || !p.ajuste.trim() ? 0.5 : 1 }}>{p.ajustando ? '…' : 'Ajustar'}</button>
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={p.onVolver} style={btnGhost}>← Volver</button>
          {p.uso && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtUso(p.uso)}</span>}
          {p.err && <span style={{ fontSize: 12.5, color: 'var(--bad)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.err}</span>}
        </div>
        <button onClick={p.onPublicar} disabled={p.publishing} style={{ ...btnDark, background: 'var(--good)', opacity: p.publishing ? 0.6 : 1, cursor: p.publishing ? 'wait' : 'pointer' }}>
          {p.publishing ? 'Publicando en Meta…' : 'Publicar en pausa'}
        </button>
      </div>
    </>
  );
}

function AdsetEditor(p: {
  ai: number; adset: AdSetSpec; spec: CampaignSpec; objDef: ReturnType<typeof objetivoDef>;
  setAdset: (i: number, fn: (a: AdSetSpec) => AdSetSpec) => void; patchTargeting: (i: number, patch: Partial<Targeting>) => void;
  setAd: (ai: number, di: number, fn: (ad: AdSpec) => AdSpec) => void; patchCreative: (ai: number, di: number, patch: Partial<Creative>) => void;
  tray: TrayItem[]; onSubir: (f: File) => void; senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; onQuitarTray: (id: string) => void;
  audiences: AudienceRef[] | null; onRemove?: () => void;
}) {
  const { ai, adset, spec } = p;
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--accent)' }}>CONJUNTO {ai + 1}</span>
        <input value={adset.name} onChange={(e) => p.setAdset(ai, (a) => ({ ...a, name: e.target.value }))} style={{ ...inp, flex: 1, fontWeight: 600 }} />
        {p.onRemove && <button type="button" onClick={p.onRemove} title="Quitar conjunto" style={{ ...btnGhost, padding: '6px 9px' }}>🗑</button>}
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* meta de optimización + presupuesto del conjunto (ABO) */}
        <div style={{ display: 'grid', gridTemplateColumns: spec.budget_level === 'adset' ? '1fr 1fr' : '1fr', gap: 12 }}>
          <div>
            <span style={lbl}>Optimizar por</span>
            <Dropdown value={adset.optimization_goal} options={OPT_GOALS.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => p.setAdset(ai, (a) => ({ ...a, optimization_goal: v }))} width="100%" />
          </div>
          {spec.budget_level === 'adset' && (
            <div>
              <span style={lbl}>Presupuesto diario (MXN)</span>
              <input value={adset.daily_budget_mxn ?? ''} inputMode="numeric" onChange={(e) => p.setAdset(ai, (a) => ({ ...a, daily_budget_mxn: e.target.value ? Number(e.target.value.replace(/[^\d]/g, '')) : null }))} style={inp} placeholder="200" />
            </div>
          )}
        </div>

        <TargetingEditor t={adset.targeting} patch={(patch) => p.patchTargeting(ai, patch)} audiences={p.audiences} />

        {/* Anuncios */}
        {adset.ads.map((ad, di) => (
          <AdEditor key={di} ai={ai} di={di} ad={ad} adset={adset}
            setAd={p.setAd} patchCreative={p.patchCreative} tray={p.tray} onSubir={p.onSubir} senales={p.senales} onGanador={p.onGanador} onQuitarTray={p.onQuitarTray}
            onRemove={adset.ads.length > 1 ? () => p.setAdset(ai, (a) => ({ ...a, ads: a.ads.filter((_, i) => i !== di) })) : undefined} />
        ))}
        <button type="button" onClick={() => p.setAdset(ai, (a) => ({ ...a, ads: [...a.ads, nuevoAnuncio(a.ads.length, spec.objective)] }))} style={{ ...btnGhost, alignSelf: 'flex-start', fontSize: 12.5, padding: '6px 11px' }}>+ Agregar anuncio</button>
      </div>
    </div>
  );
}

// Editor de segmentación COMPLETO (geo, edad, género, Advantage+, placements, intereses, retargeting).
function TargetingEditor({ t, patch, audiences }: { t: Targeting; patch: (p: Partial<Targeting>) => void; audiences: AudienceRef[] | null }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<InterestSpec[]>([]);
  const [searching, setSearching] = useState(false);
  const generoVal = !t.genders?.length ? 'all' : t.genders.includes(1) && !t.genders.includes(2) ? 'h' : t.genders.includes(2) && !t.genders.includes(1) ? 'm' : 'all';
  const platforms = t.publisher_platforms ?? [];
  const togglePlatform = (v: string) => patch({ publisher_platforms: platforms.includes(v) ? platforms.filter((x) => x !== v) : [...platforms, v] });

  async function buscarInteres() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/ads-manager/targeting?kind=interests&q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      setResults(j.ok ? (j.items as InterestSpec[]) : []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }
  const intereses = t.flexible_spec?.[0]?.interests ?? [];
  const addInteres = (i: InterestSpec) => { if (intereses.some((x) => x.id === i.id || x.name === i.name)) return; patch({ flexible_spec: [{ interests: [...intereses, { id: i.id, name: i.name }] }] }); setResults([]); setQ(''); };
  const delInteres = (name: string) => patch({ flexible_spec: [{ interests: intereses.filter((x) => x.name !== name) }] });

  const incAud = t.custom_audiences ?? [];
  const excAud = t.excluded_custom_audiences ?? [];
  const audOpts = (exclude: AudienceRef[]) => (audiences ?? []).filter((a) => !exclude.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: a.name ?? a.id }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px dashed var(--border-strong)', borderRadius: 10, padding: 12 }}>
      <span style={{ ...lbl, marginBottom: -2 }}>Segmentación</span>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
        <div>
          <span style={lbl}>Países (ISO-2)</span>
          <input value={(t.geo_locations?.countries ?? ['MX']).join(', ')} onChange={(e) => patch({ geo_locations: { ...t.geo_locations, countries: e.target.value.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) } })} style={inp} placeholder="MX" />
        </div>
        <div>
          <span style={lbl}>Edad</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input value={t.age_min ?? ''} inputMode="numeric" onChange={(e) => patch({ age_min: e.target.value ? Number(e.target.value.replace(/[^\d]/g, '')) : undefined })} style={{ ...inp, width: 56, textAlign: 'center' }} placeholder="18" />
            <span style={{ color: 'var(--faint)' }}>–</span>
            <input value={t.age_max ?? ''} inputMode="numeric" onChange={(e) => patch({ age_max: e.target.value ? Number(e.target.value.replace(/[^\d]/g, '')) : undefined })} style={{ ...inp, width: 56, textAlign: 'center' }} placeholder="65" />
          </div>
        </div>
        <div>
          <span style={lbl}>Género</span>
          <Dropdown value={generoVal} options={GENEROS.map((g) => ({ value: g.value, label: g.label }))} onChange={(v) => patch({ genders: GENEROS.find((g) => g.value === v)?.genders ?? [] })} width="100%" />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={t.advantage_audience === 1} onChange={(e) => patch({ advantage_audience: e.target.checked ? 1 : 0 })} />
          Advantage+ (público amplio, Meta optimiza)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Plataformas:</span>
          {PLACEMENTS.map((pl) => (
            <label key={pl.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: platforms.length === 0 || platforms.includes(pl.value) ? 'var(--ink)' : 'var(--faint)', cursor: 'pointer' }}>
              <input type="checkbox" checked={platforms.includes(pl.value)} onChange={() => togglePlatform(pl.value)} />{pl.label}
            </label>
          ))}
        </div>
      </div>

      {/* Intereses */}
      <div>
        <span style={lbl}>Intereses</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: intereses.length ? 8 : 0 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarInteres(); } }} placeholder="Buscar interés (ej. emprendedores)…" style={{ ...inp, flex: 1 }} />
          <button type="button" onClick={buscarInteres} disabled={searching || !q.trim()} style={{ ...btnGhost, opacity: searching || !q.trim() ? 0.5 : 1 }}>{searching ? '…' : 'Buscar'}</button>
        </div>
        {results.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {results.map((r) => <button key={r.id} type="button" onClick={() => addInteres(r)} style={{ ...chip, cursor: 'pointer', borderColor: 'var(--accent)' }}>+ {r.name}</button>)}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {intereses.map((i) => (
            <span key={i.name} style={{ ...chip, ...(i.id ? {} : { borderStyle: 'dashed', color: 'var(--dim)' }) }} title={i.id ? '' : 'Sugerencia de MaKo — buscala arriba para confirmar el interés real'}>
              {i.name}{!i.id && ' ⚠'}<button type="button" onClick={() => delInteres(i.name)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 12, padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* Retargeting / públicos personalizados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <span style={lbl}>Incluir públicos (retargeting)</span>
          <Dropdown value="" placeholder={audiences === null ? 'Cargando…' : 'Agregar público…'} resetAfterSelect
            options={audOpts(excAud).map((o) => ({ ...o, disabled: incAud.some((x) => x.id === o.value) }))}
            onChange={(v) => { const a = (audiences ?? []).find((x) => x.id === v); if (a && !incAud.some((x) => x.id === v)) patch({ custom_audiences: [...incAud, { id: a.id, name: a.name }] }); }} width="100%" />
          <ChipRow refs={incAud} onDel={(id) => patch({ custom_audiences: incAud.filter((x) => x.id !== id) })} />
        </div>
        <div>
          <span style={lbl}>Excluir públicos</span>
          <Dropdown value="" placeholder={audiences === null ? 'Cargando…' : 'Excluir público…'} resetAfterSelect
            options={audOpts(incAud).map((o) => ({ ...o, disabled: excAud.some((x) => x.id === o.value) }))}
            onChange={(v) => { const a = (audiences ?? []).find((x) => x.id === v); if (a && !excAud.some((x) => x.id === v)) patch({ excluded_custom_audiences: [...excAud, { id: a.id, name: a.name }] }); }} width="100%" />
          <ChipRow refs={excAud} onDel={(id) => patch({ excluded_custom_audiences: excAud.filter((x) => x.id !== id) })} />
        </div>
      </div>
    </div>
  );
}

function ChipRow({ refs, onDel }: { refs: AudienceRef[]; onDel: (id: string) => void }) {
  if (!refs.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {refs.map((a) => <span key={a.id} style={chip}>{a.name ?? a.id}<button type="button" onClick={() => onDel(a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 12, padding: 0 }}>✕</button></span>)}
    </div>
  );
}

// Editor de un anuncio: creativo (asignar bandeja / ganador) + copy + CTA + URL + lead form + previa.
function AdEditor(p: {
  ai: number; di: number; ad: AdSpec; adset: AdSetSpec;
  setAd: (ai: number, di: number, fn: (ad: AdSpec) => AdSpec) => void; patchCreative: (ai: number, di: number, patch: Partial<Creative>) => void;
  tray: TrayItem[]; onSubir: (f: File) => void; senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; onQuitarTray: (id: string) => void; onRemove?: () => void;
}) {
  const { ai, di, ad, adset } = p;
  const c = ad.creative;
  const esLead = adset.optimization_goal === 'LEAD_GENERATION';
  const [leadForms, setLeadForms] = useState<Array<{ id: string; name: string }> | null>(null);
  const [previa, setPrevia] = useState<{ ad_format: string; body: string }[] | null>(null);
  const [cargandoPrevia, setCargandoPrevia] = useState(false);
  const [previaErr, setPreviaErr] = useState<string | null>(null);

  useEffect(() => {
    if (!esLead || leadForms !== null) return;
    fetch('/api/ads-manager/targeting?kind=leadforms').then((r) => r.json()).then((j) => setLeadForms(j.ok ? j.items : [])).catch(() => setLeadForms([]));
  }, [esLead, leadForms]);

  // Bandeja asignable a este anuncio.
  const asignado = c.source === 'existing' ? `win-${c.source_ad_id}` : (c.image_hash ? p.tray.find((t) => t.image_hash === c.image_hash)?.id : c.video_id ? p.tray.find((t) => t.video_id === c.video_id)?.id : '') ?? '';
  const asignar = (id: string) => {
    const t = p.tray.find((x) => x.id === id);
    if (!t) { p.patchCreative(ai, di, { source: 'upload', image_hash: null, video_id: null, source_ad_id: null }); return; }
    if (t.kind === 'existing') p.patchCreative(ai, di, { source: 'existing', source_ad_id: t.source_ad_id ?? null, image_hash: null, video_id: null });
    else p.patchCreative(ai, di, { source: 'upload', media_type: t.media_type, image_hash: t.image_hash ?? null, video_id: t.video_id ?? null, source_ad_id: null });
  };

  async function previsualizar() {
    setCargandoPrevia(true); setPreviaErr(null);
    try {
      const r = await fetch('/api/ads-manager/campaign-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creative: c }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo previsualizar');
      setPrevia(j.previews ?? []);
    } catch (e) { setPreviaErr(e instanceof Error ? e.message : String(e)); }
    finally { setCargandoPrevia(false); }
  }

  const trayOpts = [{ value: '', label: 'Sin asignar' }, ...p.tray.map((t) => ({ value: t.id, label: `${t.kind === 'existing' ? '★ ' : ''}${t.label}${t.processing ? ' (procesando…)' : ''}`, disabled: t.processing }))];

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--dim)' }}>ANUNCIO {di + 1}</span>
        <input value={ad.name} onChange={(e) => p.setAd(ai, di, (a) => ({ ...a, name: e.target.value }))} style={{ ...inp, flex: 1, padding: '6px 9px' }} />
        {p.onRemove && <button type="button" onClick={p.onRemove} title="Quitar anuncio" style={{ ...btnGhost, padding: '5px 8px' }}>🗑</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
        {/* creativo */}
        <div>
          <span style={lbl}>Creativo</span>
          <Dropdown value={asignado} options={trayOpts} onChange={asignar} width="100%" />
          <div style={{ marginTop: 8 }}>
            <CreativePreviewThumb creative={c} tray={p.tray} />
          </div>
        </div>
        {/* copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea value={c.primary_text ?? ''} onChange={(e) => p.patchCreative(ai, di, { primary_text: e.target.value })} rows={2} placeholder="Texto principal del anuncio" style={{ ...inp, resize: 'vertical' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={c.headline ?? ''} onChange={(e) => p.patchCreative(ai, di, { headline: e.target.value })} placeholder="Título" style={inp} />
            <Dropdown value={c.cta_type ?? 'LEARN_MORE'} options={CTA_OPCIONES.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => p.patchCreative(ai, di, { cta_type: v as CTAType })} width="100%" />
          </div>
          {esLead ? (
            <div>
              <span style={lbl}>Formulario instantáneo</span>
              <Dropdown value={c.lead_form_id ?? ''} placeholder={leadForms === null ? 'Cargando…' : leadForms.length ? 'Elegí un formulario…' : 'No hay formularios en la página'}
                options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => p.patchCreative(ai, di, { lead_form_id: v, lead_form_name: leadForms?.find((f) => f.id === v)?.name ?? null })} width="100%" />
            </div>
          ) : (
            <input value={c.destination_url ?? ''} onChange={(e) => p.patchCreative(ai, di, { destination_url: e.target.value })} placeholder="https://tu-landing/vsl" style={inp} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={previsualizar} disabled={cargandoPrevia} style={{ ...btnGhost, fontSize: 12.5, padding: '6px 11px' }}>{cargandoPrevia ? 'Generando previa…' : '👁 Previsualizar'}</button>
        {previaErr && <span style={{ fontSize: 12, color: 'var(--bad)' }}>{previaErr}</span>}
      </div>
      {previa && previa.length > 0 && <PreviewFrames previews={previa} />}
      {previa && previa.length === 0 && !previaErr && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Meta no devolvió previa para este creativo (probá asignando un creativo y un destino).</span>}
    </div>
  );
}

function CreativePreviewThumb({ creative, tray }: { creative: Creative; tray: TrayItem[] }) {
  const t = creative.source === 'existing' ? tray.find((x) => x.source_ad_id === creative.source_ad_id) : tray.find((x) => (creative.image_hash && x.image_hash === creative.image_hash) || (creative.video_id && x.video_id === creative.video_id));
  const thumb = t?.thumbnail_url ?? creative.thumbnail_url ?? null;
  return (
    <div style={{ width: '100%', aspectRatio: '9 / 16', maxHeight: 150, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {thumb
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', padding: 6 }}>{creative.media_type === 'video' ? '🎬' : '🖼️'} sin asignar</span>}
    </div>
  );
}

// Renderiza los <iframe> que devuelve Meta (generatepreviews), escalados.
function PreviewFrames({ previews }: { previews: { ad_format: string; body: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
      {previews.map((pv, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface-2)' }}>
          <div style={{ width: 320, height: 420, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: pv.body }} />
        </div>
      ))}
    </div>
  );
}

// ── DONE ──────────────────────────────────────────────────────────────────────
function DoneStep({ result, onClose }: { result: { campaign_id: string; ads: number }; onClose: () => void }) {
  return (
    <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✓</div>
      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}>Campaña creada en pausa</h3>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)', maxWidth: 460, lineHeight: 1.55 }}>
        Se creó la campaña (id <code style={{ fontFamily: MONO, fontSize: 12 }}>{result.campaign_id}</code>) con {result.ads} anuncio{result.ads === 1 ? '' : 's'}, todo en <b>PAUSA</b>. Revisala en la tabla y, cuando quieras, <b>activala con el toggle</b> de cada fila para que empiece a entregar.
      </p>
      <button onClick={onClose} style={btnDark}>Ver en la tabla</button>
    </div>
  );
}

// ── helpers de datos ──────────────────────────────────────────────────────────
const OPT_GOALS: Array<{ value: string; label: string }> = [
  { value: 'LEAD_GENERATION', label: 'Leads (formulario instantáneo)' },
  { value: 'OFFSITE_CONVERSIONS', label: 'Conversiones (pixel en la web)' },
  { value: 'LANDING_PAGE_VIEWS', label: 'Vistas de la landing/VSL' },
  { value: 'LINK_CLICKS', label: 'Clics en el enlace' },
  { value: 'REACH', label: 'Alcance' },
  { value: 'THRUPLAY', label: 'Reproducciones de video' },
];

function traySummary(tray: TrayItem[]): string {
  if (!tray.length) return 'Ninguno especificado todavía.';
  return tray.map((t, i) => `${i + 1}. ${t.kind === 'existing' ? `ganador ad_id=${t.source_ad_id}` : `${t.media_type ?? 'archivo'} subido: ${t.label}`}`).join('\n');
}

// Asigna automáticamente los creativos de la bandeja a los anuncios que MaKo dejó sin media.
function autobind(spec: CampaignSpec, tray: TrayItem[]): CampaignSpec {
  const usables = tray.filter((t) => !t.processing && (t.image_hash || t.video_id || t.source_ad_id));
  let idx = 0;
  return {
    ...spec,
    adsets: spec.adsets.map((a) => ({
      ...a,
      ads: a.ads.map((ad) => {
        const c = ad.creative;
        const yaTiene = c.source === 'existing' ? !!c.source_ad_id : !!(c.image_hash || c.video_id);
        if (yaTiene || idx >= usables.length) return ad;
        const t = usables[idx++];
        const creative: Creative = t.kind === 'existing'
          ? { ...c, source: 'existing', source_ad_id: t.source_ad_id ?? null, image_hash: null, video_id: null }
          : { ...c, source: 'upload', media_type: t.media_type, image_hash: t.image_hash ?? null, video_id: t.video_id ?? null, source_ad_id: null };
        return { ...ad, creative };
      }),
    })),
  };
}

function nuevoConjunto(spec: CampaignSpec, idx: number): AdSetSpec {
  const def = objetivoDef(spec.objective);
  return { name: `Conjunto ${idx + 1}`, daily_budget_mxn: spec.budget_level === 'adset' ? 200 : null, optimization_goal: def.optimization_goal, billing_event: def.billing_event, bid_strategy: 'LOWEST_COST_WITHOUT_CAP', targeting: { geo_locations: { countries: ['MX'] }, advantage_audience: 1 }, ads: [nuevoAnuncio(0, spec.objective)] };
}
function nuevoAnuncio(idx: number, objective: Objective): AdSpec {
  return { name: `Anuncio ${idx + 1}`, creative: { source: 'upload', media_type: 'image', cta_type: objective === 'OUTCOME_LEADS' ? 'SIGN_UP' : 'LEARN_MORE', primary_text: '', headline: '', destination_url: '', image_hash: null, video_id: null } };
}

function validar(spec: CampaignSpec): string | null {
  if (!spec.name.trim()) return 'Ponele nombre a la campaña.';
  if (spec.budget_level === 'campaign' && !(spec.daily_budget_mxn && spec.daily_budget_mxn > 0)) return 'Definí el presupuesto diario de la campaña.';
  for (const [ai, a] of spec.adsets.entries()) {
    if (spec.budget_level === 'adset' && !(a.daily_budget_mxn && a.daily_budget_mxn > 0)) return `Definí el presupuesto del conjunto ${ai + 1}.`;
    for (const ad of a.ads) {
      const c = ad.creative;
      const hasMedia = c.source === 'existing' ? !!c.source_ad_id : !!(c.image_hash || c.video_id);
      if (!hasMedia) return `Asigná un creativo (subido o ganador) al anuncio "${ad.name}".`;
      if (a.optimization_goal === 'LEAD_GENERATION') { if (!c.lead_form_id) return `El anuncio "${ad.name}" optimiza por formulario: elegí un formulario instantáneo.`; }
      else if (c.source !== 'existing' && !c.destination_url?.trim()) return `Poné la URL de destino del anuncio "${ad.name}".`;
    }
  }
  return null;
}
