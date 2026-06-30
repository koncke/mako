'use client';

// =============================================================================
// NuevaCampanaModal — crear una campaña con MaKo (Ads Manager · "Nueva campaña")
// =============================================================================
// Flujo: BRIEF (describís la campaña + adjuntás creativos: subís archivos o elegís
// un anuncio ganador) → MaKo propone una estructura aterrizada en tu funnel/KPIs →
// REVISÁS en dos paneles: a la IZQUIERDA chateás con MaKo (todo se configura por
// prompts + botones, sin formularios manuales) y a la DERECHA ves la PREVIA en vivo
// de cómo va quedando la campaña → PUBLICÁS. Todo se crea en Meta en PAUSA; se
// activa después con el toggle de la tabla.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import type { SenalRecon } from '@/lib/queries';
import {
  type CampaignSpec, type AdSetSpec, type AdSpec, type Creative, type Targeting,
  type AudienceRef,
  OBJETIVOS, CTA_OPCIONES,
} from '@/lib/campaign-types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// ── estilos compartidos ──
const inp: CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' };
const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--dim)', display: 'block', marginBottom: 5 };
const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 12, color: 'var(--ink)' };
const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' };

type Phase = 'brief' | 'loading' | 'review' | 'publishing' | 'done';
type Uso = { tokens: number; costUsd: number } | null;
type ChatMsg = { role: 'mako' | 'user'; text: string };

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
// progreso de subida → XHR). Supabase espera multipart: el archivo bajo el campo
// '' + un campo cacheControl, y apikey + Authorization (igual que su SDK).
function putWithProgress(url: string, file: File, apikey: string | null, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('x-upsert', 'true');
    if (apikey) { xhr.setRequestHeader('apikey', apikey); xhr.setRequestHeader('authorization', `Bearer ${apikey}`); }
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detalle = (xhr.responseText || '').replace(/\s+/g, ' ').slice(0, 200);
      try { const j = JSON.parse(xhr.responseText); detalle = String(j.message || j.error || detalle); } catch { /* texto plano */ }
      if (xhr.status === 413 || /too large|maximum allowed size|exceeded/i.test(detalle)) {
        return reject(new Error('El archivo supera el límite de tamaño de Supabase Storage. Subilo en Supabase → Storage → Settings → "Upload file size limit" (p. ej. 500 MB para videos), o usá un archivo más chico.'));
      }
      reject(new Error(`No se pudo subir el archivo (HTTP ${xhr.status})${detalle ? ` — ${detalle}` : ''}`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo.'));
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', file);
    xhr.send(fd);
  });
}

export function NuevaCampanaModal({ senales, campaignCount, onClose, onPublished }: { senales: SenalRecon[]; campaignCount: number; onClose: () => void; onPublished: () => void }) {
  const [phase, setPhase] = useState<Phase>('brief');
  const [prompt, setPrompt] = useState('');
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [spec, setSpec] = useState<CampaignSpec | null>(null);
  const [uso, setUso] = useState<Uso>(null);
  const [err, setErr] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ campaign_id: string; ads: number } | null>(null);
  const trayCounter = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Públicos personalizados de la cuenta (para retargeting). Carga perezosa 1 vez.
  const [audiences, setAudiences] = useState<AudienceRef[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/ads-manager/targeting?kind=audiences').then((r) => r.json())
      .then((j) => { if (alive && j.ok) setAudiences(j.items); }).catch(() => { if (alive) setAudiences([]); });
    return () => { alive = false; };
  }, []);

  // ── update helpers (inmutables; las usan la nomenclatura y los pickers) ──
  const update = (fn: (s: CampaignSpec) => CampaignSpec) => setSpec((p) => (p ? fn(p) : p));
  const patchTargeting = (i: number, patch: Partial<Targeting>) => update((s) => ({ ...s, adsets: s.adsets.map((a, idx) => (idx === i ? { ...a, targeting: { ...a.targeting, ...patch } } : a)) }));
  const patchCreative = (ai: number, di: number, patch: Partial<Creative>) => update((s) => ({ ...s, adsets: s.adsets.map((a, i) => (i === ai ? { ...a, ads: a.ads.map((ad, j) => (j === di ? { ...ad, creative: { ...ad.creative, ...patch } } : ad)) } : a)) }));

  // ── MaKo: proponer (primera vez) ──
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
      const s = autobind(j.spec as CampaignSpec, tray);
      setSpec(s);
      setUso(j.uso ?? null);
      setMessages([{ role: 'mako', text: s.rationale || 'Te armé una primera versión. Pedime los cambios que quieras o tocá un botón.' }]);
      setPhase('review');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setPhase('brief'); }
  }

  // ── MaKo: ajustar por chat / botón (conserva los creativos ya asignados) ──
  async function enviarChat(text: string) {
    const t = text.trim();
    if (!t || !spec || sending) return;
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setSending(true); setErr(null);
    try {
      const r = await fetch('/api/ads-manager/campaign-suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'adjust', specActual: spec, instruccion: t }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'MaKo no pudo ajustar');
      setSpec((prev) => (prev ? mergeCreatives(prev, j.spec as CampaignSpec, tray) : autobind(j.spec as CampaignSpec, tray)));
      setUso(j.uso ?? null);
      setMessages((m) => [...m, { role: 'mako', text: (j.spec as CampaignSpec).rationale || 'Listo, lo ajusté. Mirá la previa a la derecha.' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: 'mako', text: `No pude aplicar el cambio: ${msg}` }]);
    } finally { setSending(false); }
  }

  // ── subir creativo (directo a storage → Meta, esquiva el límite del serverless) ──
  async function subir(file: File) {
    const esVideo = file.type.startsWith('video');
    const maxMb = esVideo ? 512 : 30;
    if (file.size > maxMb * 1024 * 1024) { setErr(`"${file.name}" supera el máximo (${maxMb} MB).`); return; }
    const id = `up-${++trayCounter.current}`;
    const localUrl = esVideo ? null : URL.createObjectURL(file);
    const pend: TrayItem = { id, kind: 'upload', media_type: esVideo ? 'video' : 'image', label: file.name, processing: true, progress: 0, thumbnail_url: localUrl };
    setTray((t) => [...t, pend]);
    try {
      const s = await fetch('/api/ads-manager/creative-signurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content_type: file.type }) });
      const sj = await s.json();
      if (!sj.ok) throw new Error(sj.error || 'No se pudo preparar la subida');
      await putWithProgress(sj.signedUrl, file, sj.apikey ?? null, (pct) => setTray((t) => t.map((x) => x.id === id ? { ...x, progress: pct } : x)));
      setTray((t) => t.map((x) => x.id === id ? { ...x, progress: 100 } : x));
      const r = await fetch('/api/ads-manager/creative-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: sj.path, content_type: file.type, filename: file.name }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo procesar el creativo');
      setTray((t) => t.map((x) => x.id === id ? { ...x, media_type: j.media_type, image_hash: j.image_hash ?? null, video_id: j.video_id ?? null, thumbnail_url: x.thumbnail_url ?? j.thumbnail_url ?? null, processing: false, progress: undefined } : x));
      // Auto-asigna el creativo nuevo a algún anuncio sin media.
      setSpec((prev) => (prev ? autobind(prev, [...tray, { ...pend, image_hash: j.image_hash ?? null, video_id: j.video_id ?? null, media_type: j.media_type, processing: false }]) : prev));
    } catch (e) {
      if (localUrl) URL.revokeObjectURL(localUrl);
      setErr(e instanceof Error ? e.message : String(e));
      setTray((t) => t.filter((x) => x.id !== id));
    }
  }

  function agregarGanador(s: SenalRecon) {
    if (tray.some((t) => t.source_ad_id === s.ad_id)) return;
    const item: TrayItem = { id: `win-${s.ad_id}`, kind: 'existing', source_ad_id: s.ad_id, thumbnail_url: s.ad_thumbnail_url, label: s.ad_name };
    setTray((t) => [...t, item]);
    setSpec((prev) => (prev ? autobind(prev, [...tray, item]) : prev));
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

  const wide = phase === 'review' || phase === 'publishing';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '34px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: wide ? 1120 : 880, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(23,21,17,.4)', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>
              <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord> · Nueva campaña
            </div>
            <h2 style={{ fontWeight: 600, fontSize: 21, margin: '3px 0 0', color: 'var(--ink)' }}>
              {phase === 'brief' || phase === 'loading' ? 'Contale tu campaña a MaKo' : phase === 'done' ? 'Campaña creada (en pausa)' : 'Ajustá con MaKo y revisá la previa'}
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
          <>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" style={{ display: 'none' }}
              onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => subir(f)); e.target.value = ''; }} />
            <div style={{ display: 'flex', minHeight: 0, height: 'min(72vh, 680px)' }}>
              {/* IZQUIERDA — chat MaKo */}
              <ChatPane
                messages={messages} sending={sending}
                onSend={enviarChat}
                onNomen={() => update((s) => aplicarNomenclatura(s, campaignCount + 1))}
                onSubir={() => fileRef.current?.click()}
                nnn={pad(campaignCount + 1, 3)}
              />
              {/* DERECHA — previa en vivo */}
              <PreviewPane
                spec={spec} tray={tray} audiences={audiences}
                patchTargeting={patchTargeting} patchCreative={patchCreative}
                senales={senales} onGanador={agregarGanador} onSubir={() => fileRef.current?.click()} onQuitarTray={quitarTray}
              />
            </div>

            {/* footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 24px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <button onClick={() => setPhase('brief')} style={btnGhost}>← Volver</button>
                {uso && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{fmtUso(uso)}</span>}
                {err && <span style={{ fontSize: 12.5, color: 'var(--bad)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err}</span>}
              </div>
              <button onClick={publicar} disabled={phase === 'publishing'} style={{ ...btnDark, background: 'var(--good)', opacity: phase === 'publishing' ? 0.6 : 1, cursor: phase === 'publishing' ? 'wait' : 'pointer' }}>
                {phase === 'publishing' ? 'Publicando en Meta…' : 'Publicar en pausa'}
              </button>
            </div>
          </>
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
        Describí qué querés lograr (objetivo, oferta, a quién apuntás, presupuesto). MaKo mira tu <b>funnel</b>, tus <b>KPIs</b> y tus <b>anuncios ganadores</b> y propone una estructura completa que después ajustás charlando. Se crea en <b>pausa</b>.
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
    <div style={{ ...card, padding: compact ? 12 : 14 }}>
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
            <div key={t.id} style={{ position: 'relative', width: 52, height: 70, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', flex: 'none' }} title={t.label}>
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
                  style={{ position: 'relative', width: 48, height: 64, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', cursor: 'pointer', padding: 0, flex: 'none' }}>
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

// ── IZQUIERDA: chat de MaKo (todo se configura por prompts + botones) ──────────
const QUICK: Array<{ label: string; send: string }> = [
  { label: '⬆ Más presupuesto', send: 'Subí el presupuesto diario alrededor de un 20%.' },
  { label: '⬇ Menos presupuesto', send: 'Bajá el presupuesto diario alrededor de un 20%.' },
  { label: '➕ Sumar retargeting', send: 'Agregá un conjunto de retargeting (visitantes de la landing y engagers de IG/FB de los últimos 30-90 días), excluyendo a quienes ya dejaron sus datos.' },
  { label: '🌐 Más amplio', send: 'Hacé la segmentación más amplia: activá Advantage+ y sacá restricciones finas.' },
  { label: '🎯 Más fino', send: 'Segmentá más fino con intereses y rangos de edad acordes al avatar.' },
  { label: '✍️ Otro copy', send: 'Reescribí el copy de los anuncios con otra variación, mismo ángulo y oferta.' },
];

function ChatPane({ messages, sending, onSend, onNomen, onSubir, nnn }: {
  messages: ChatMsg[]; sending: boolean; onSend: (t: string) => void; onNomen: () => void; onSubir: () => void; nnn: string;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, sending]);
  const enviar = (t?: string) => { const v = (t ?? input).trim(); if (!v || sending) return; onSend(v); if (!t) setInput(''); };

  return (
    <div style={{ width: '42%', minWidth: 340, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border)', background: 'linear-gradient(180deg, rgba(200,135,12,.06), rgba(200,135,12,.02))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        <MakoStar size={14} /> <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Charlá con <MakoWord base="var(--accent)">MaKo</MakoWord></span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'mako' && <span style={{ flex: 'none', marginTop: 2 }}><MakoStar size={13} /></span>}
            <div style={{ background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface)', color: m.role === 'user' ? '#171511' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderRadius: 13, padding: '10px 13px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}><MakoStar size={12} /> MaKo está ajustando…</div>}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', flex: 'none' }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap', overflowX: 'auto', padding: '10px 14px 0' }}>
          <button type="button" onClick={onSubir} style={quickChip}>⬆ Subir creativo</button>
          <button type="button" onClick={onNomen} style={quickChip} title={`Numera con tu sistema: ${nnn} · ${nnn}.01 · ${nnn}.01.a`}># Nomenclatura</button>
          {QUICK.map((q) => <button key={q.label} type="button" onClick={() => enviar(q.send)} disabled={sending} style={{ ...quickChip, opacity: sending ? 0.5 : 1 }}>{q.label}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '10px 14px 12px' }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} rows={1}
            placeholder="Pedile un cambio a MaKo…  (ej: la landing es https://… · apuntá 30-50 · sumá un anuncio)" disabled={sending}
            style={{ flex: 1, padding: '10px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none', resize: 'none', minHeight: 42, maxHeight: 150, lineHeight: 1.4 }} />
          <button type="button" onClick={() => enviar()} disabled={sending || !input.trim()} style={{ padding: '10px 16px', borderRadius: 11, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: sending || !input.trim() ? 'default' : 'pointer', opacity: sending || !input.trim() ? 0.55 : 1 }}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
const quickChip: CSSProperties = { flex: 'none', whiteSpace: 'nowrap', padding: '6px 11px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, cursor: 'pointer' };

// ── DERECHA: previa en vivo de la campaña ──────────────────────────────────────
function PreviewPane({ spec, tray, audiences, patchTargeting, patchCreative, senales, onGanador, onSubir, onQuitarTray }: {
  spec: CampaignSpec; tray: TrayItem[]; audiences: AudienceRef[] | null;
  patchTargeting: (i: number, patch: Partial<Targeting>) => void; patchCreative: (ai: number, di: number, patch: Partial<Creative>) => void;
  senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; onSubir: (f: File) => void; onQuitarTray: (id: string) => void;
}) {
  const objLabel = OBJETIVOS.find((o) => o.value === spec.objective)?.label ?? spec.objective;
  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface)' }}>
      <CreativeTray tray={tray} onSubir={onSubir} onQuitar={onQuitarTray} senales={senales} onGanador={onGanador} compact />

      {/* Campaña */}
      <div style={{ ...card, padding: '12px 14px' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Campaña</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{spec.name}</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ ...chip, background: 'var(--surface-2)' }}>🎯 {objLabel}</span>
          <span style={{ ...chip, background: 'var(--surface-2)' }}>💰 {spec.budget_level === 'campaign' ? `Campaña (CBO) · ${spec.daily_budget_mxn ? `$${Math.round(spec.daily_budget_mxn).toLocaleString('es-MX')} MXN/día` : '—'}` : 'Por conjunto (ABO)'}</span>
        </div>
      </div>

      {spec.adsets.map((adset, ai) => (
        <ConjuntoPreview key={ai} ai={ai} adset={adset} spec={spec} tray={tray} audiences={audiences} patchTargeting={patchTargeting} patchCreative={patchCreative} />
      ))}
      <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '2px 2px 0', lineHeight: 1.5 }}>Todo lo de acá lo ajustás charlando con MaKo a la izquierda. Se publica en <b>pausa</b>; la activás desde la tabla.</p>
    </div>
  );
}

function ConjuntoPreview({ ai, adset, spec, tray, audiences, patchTargeting, patchCreative }: {
  ai: number; adset: AdSetSpec; spec: CampaignSpec; tray: TrayItem[]; audiences: AudienceRef[] | null;
  patchTargeting: (i: number, patch: Partial<Targeting>) => void; patchCreative: (ai: number, di: number, patch: Partial<Creative>) => void;
}) {
  const t = adset.targeting;
  const inc = t.custom_audiences ?? [];
  const exc = t.excluded_custom_audiences ?? [];
  const audOpts = (excludeFrom: AudienceRef[]) => (audiences ?? []).filter((a) => !excludeFrom.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: a.name ?? a.id }));
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '9px 13px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--accent)' }}>CONJUNTO {ai + 1}</span>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{adset.name}</div>
      </div>
      <div style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {/* targeting (read-only, lo cambia MaKo) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={chip}>⚙ {OPT_LABEL[adset.optimization_goal] ?? adset.optimization_goal}</span>
          {spec.budget_level === 'adset' && <span style={chip}>💰 {adset.daily_budget_mxn ? `$${Math.round(adset.daily_budget_mxn).toLocaleString('es-MX')} MXN/día` : '—'}</span>}
          {targetingResumen(t).map((c, i) => <span key={i} style={chip}>{c}</span>)}
        </div>

        {/* Públicos personalizados (retargeting) — picker, MaKo no inventa IDs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <span style={lbl}>Incluir público</span>
            <Dropdown value="" placeholder={audiences === null ? 'Cargando…' : 'Agregar…'} resetAfterSelect
              options={audOpts(exc).map((o) => ({ ...o, disabled: inc.some((x) => x.id === o.value) }))}
              onChange={(v) => { const a = (audiences ?? []).find((x) => x.id === v); if (a && !inc.some((x) => x.id === v)) patchTargeting(ai, { custom_audiences: [...inc, { id: a.id, name: a.name }] }); }} width="100%" />
            <ChipRow refs={inc} onDel={(id) => patchTargeting(ai, { custom_audiences: inc.filter((x) => x.id !== id) })} />
          </div>
          <div>
            <span style={lbl}>Excluir público</span>
            <Dropdown value="" placeholder={audiences === null ? 'Cargando…' : 'Excluir…'} resetAfterSelect
              options={audOpts(inc).map((o) => ({ ...o, disabled: exc.some((x) => x.id === o.value) }))}
              onChange={(v) => { const a = (audiences ?? []).find((x) => x.id === v); if (a && !exc.some((x) => x.id === v)) patchTargeting(ai, { excluded_custom_audiences: [...exc, { id: a.id, name: a.name }] }); }} width="100%" />
            <ChipRow refs={exc} onDel={(id) => patchTargeting(ai, { excluded_custom_audiences: exc.filter((x) => x.id !== id) })} />
          </div>
        </div>

        {adset.ads.map((ad, di) => (
          <AdPreview key={di} ai={ai} di={di} ad={ad} adset={adset} tray={tray} patchCreative={patchCreative} />
        ))}
      </div>
    </div>
  );
}

function ChipRow({ refs, onDel }: { refs: AudienceRef[]; onDel: (id: string) => void }) {
  if (!refs.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
      {refs.map((a) => <span key={a.id} style={chip}>{a.name ?? a.id}<button type="button" onClick={() => onDel(a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 12, padding: 0 }}>✕</button></span>)}
    </div>
  );
}

function AdPreview({ ai, di, ad, adset, tray, patchCreative }: {
  ai: number; di: number; ad: AdSpec; adset: AdSetSpec; tray: TrayItem[]; patchCreative: (ai: number, di: number, patch: Partial<Creative>) => void;
}) {
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

  const thumbItem = c.source === 'existing' ? tray.find((x) => x.source_ad_id === c.source_ad_id) : tray.find((x) => (c.image_hash && x.image_hash === c.image_hash) || (c.video_id && x.video_id === c.video_id));
  const thumb = thumbItem?.thumbnail_url ?? c.thumbnail_url ?? null;
  const asignado = thumbItem?.id ?? '';
  const trayOpts = [{ value: '', label: 'Sin creativo' }, ...tray.map((x) => ({ value: x.id, label: `${x.kind === 'existing' ? '★ ' : ''}${x.label}${x.processing ? ' (subiendo…)' : ''}`, disabled: x.processing }))];
  const asignar = (id: string) => {
    const x = tray.find((y) => y.id === id);
    if (!x) return patchCreative(ai, di, { source: 'upload', image_hash: null, video_id: null, source_ad_id: null });
    if (x.kind === 'existing') patchCreative(ai, di, { source: 'existing', source_ad_id: x.source_ad_id ?? null, image_hash: null, video_id: null });
    else patchCreative(ai, di, { source: 'upload', media_type: x.media_type, image_hash: x.image_hash ?? null, video_id: x.video_id ?? null, source_ad_id: null });
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

  const ctaLabel = CTA_OPCIONES.find((o) => o.value === (c.cta_type ?? 'LEARN_MORE'))?.label ?? c.cta_type;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 11, background: 'var(--surface-2)', display: 'flex', gap: 12 }}>
      {/* creativo */}
      <div style={{ width: 92, flex: 'none' }}>
        <div style={{ width: '100%', aspectRatio: '9 / 16', maxHeight: 130, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
          {thumb
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'center', padding: 5 }}>{c.media_type === 'video' ? '🎬' : '🖼️'} sin asignar</span>}
        </div>
        <Dropdown value={asignado} options={trayOpts} onChange={asignar} width="100%" buttonStyle={{ fontSize: 11.5, padding: '5px 8px' }} />
      </div>
      {/* copy + destino */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: 'var(--dim)' }}>ANUNCIO {di + 1} · {ad.name}</span>
        {c.primary_text ? <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>{c.primary_text}</div> : <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Pedile el copy a MaKo…</div>}
        {c.headline && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{c.headline}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...chip, fontSize: 11 }}>▸ {ctaLabel}</span>
          {esLead ? (
            <div style={{ minWidth: 200 }}>
              <Dropdown value={c.lead_form_id ?? ''} placeholder={leadForms === null ? 'Cargando formularios…' : leadForms.length ? 'Elegí formulario instantáneo…' : 'Sin formularios en la página'}
                options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => patchCreative(ai, di, { lead_form_id: v, lead_form_name: leadForms?.find((f) => f.id === v)?.name ?? null })} width="100%" buttonStyle={{ fontSize: 11.5, padding: '5px 9px' }} />
            </div>
          ) : (
            <input value={c.destination_url ?? ''} onChange={(e) => patchCreative(ai, di, { destination_url: e.target.value })} placeholder="URL de la landing/VSL" style={{ ...inp, flex: 1, minWidth: 160, padding: '5px 9px', fontSize: 11.5 }} />
          )}
          <button type="button" onClick={previsualizar} disabled={cargandoPrevia} style={{ ...btnGhost, fontSize: 11.5, padding: '5px 9px' }}>{cargandoPrevia ? 'Previa…' : '👁 Previa Meta'}</button>
        </div>
        {previaErr && <span style={{ fontSize: 11, color: 'var(--bad)' }}>{previaErr}</span>}
        {previa && previa.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
            {previa.map((pv, i) => <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', width: 300, height: 380 }} dangerouslySetInnerHTML={{ __html: pv.body }} />)}
          </div>
        )}
        {previa && previa.length === 0 && !previaErr && <span style={{ fontSize: 11, color: 'var(--faint)' }}>Meta no devolvió previa (asigná un creativo y un destino).</span>}
      </div>
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
const OPT_LABEL: Record<string, string> = {
  LEAD_GENERATION: 'Leads (formulario)', OFFSITE_CONVERSIONS: 'Conversiones (pixel)', LANDING_PAGE_VIEWS: 'Vistas de landing',
  LINK_CLICKS: 'Clics', REACH: 'Alcance', THRUPLAY: 'Reproducciones', IMPRESSIONS: 'Impresiones', POST_ENGAGEMENT: 'Interacción',
};

function targetingResumen(t: Targeting): string[] {
  const out: string[] = [];
  out.push(`📍 ${(t.geo_locations?.countries ?? ['MX']).join(', ') || 'MX'}`);
  if (t.age_min || t.age_max) out.push(`🎂 ${t.age_min ?? 18}-${t.age_max ?? 65}`);
  const g = !t.genders?.length ? 'Todos' : t.genders.includes(1) && !t.genders.includes(2) ? 'Hombres' : t.genders.includes(2) && !t.genders.includes(1) ? 'Mujeres' : 'Todos';
  out.push(`👤 ${g}`);
  if (t.advantage_audience === 1) out.push('⚡ Advantage+');
  const interes = t.flexible_spec?.[0]?.interests ?? [];
  if (interes.length) out.push(`🎯 ${interes.map((i) => i.name).slice(0, 3).join(', ')}${interes.length > 3 ? '…' : ''}`);
  const pl = t.publisher_platforms; if (pl?.length) out.push(`📱 ${pl.join(', ')}`);
  return out;
}

// ── Nomenclatura jerárquica (mismo sistema que "Ordenar nombres": 001 / 001.02 / 001.02.a) ──
function pad(n: number, w: number): string { return String(Math.max(0, Math.floor(n))).padStart(w, '0'); }
function letra(n: number): string { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
const stripNomenCode = (name: string): string => name.replace(/^\s*[0-9]+(?:\.[0-9]+)*(?:\.[a-zA-Z]+)?\s*[.\-)·]?\s*/, '').trim();
function aplicarNomenclatura(spec: CampaignSpec, nextNumber: number): CampaignSpec {
  const nnn = pad(nextNumber, 3);
  return {
    ...spec,
    name: `${nnn}. ${stripNomenCode(spec.name)}`.trim(),
    adsets: spec.adsets.map((a, i) => {
      const code = `${nnn}.${pad(i + 1, 2)}`;
      return {
        ...a,
        name: `${code} ${stripNomenCode(a.name)}`.trim(),
        ads: a.ads.map((ad, j) => ({ ...ad, name: `${code}.${letra(j + 1)} ${stripNomenCode(ad.name)}`.trim() })),
      };
    }),
  };
}

function traySummary(tray: TrayItem[]): string {
  if (!tray.length) return 'Ninguno especificado todavía.';
  return tray.map((t, i) => `${i + 1}. ${t.kind === 'existing' ? `ganador ad_id=${t.source_ad_id}` : `${t.media_type ?? 'archivo'} subido: ${t.label}`}`).join('\n');
}

// Asigna creativos de la bandeja a los anuncios que no tengan media (en orden).
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

// Conserva los creativos ya asignados (por posición) al traer un spec ajustado de MaKo.
function mergeCreatives(prev: CampaignSpec, next: CampaignSpec, tray: TrayItem[]): CampaignSpec {
  const merged: CampaignSpec = {
    ...next,
    adsets: next.adsets.map((a, i) => ({
      ...a,
      ads: a.ads.map((ad, j) => {
        const pc = prev.adsets[i]?.ads[j]?.creative;
        const tieneMedia = pc && (pc.image_hash || pc.video_id || (pc.source === 'existing' && pc.source_ad_id));
        if (!tieneMedia) return ad;
        return { ...ad, creative: { ...ad.creative, source: pc!.source, media_type: pc!.media_type, image_hash: pc!.image_hash ?? null, video_id: pc!.video_id ?? null, source_ad_id: pc!.source_ad_id ?? null, thumbnail_url: pc!.thumbnail_url ?? ad.creative.thumbnail_url } };
      }),
    })),
  };
  return autobind(merged, tray);
}

function validar(spec: CampaignSpec): string | null {
  if (!spec.name.trim()) return 'La campaña necesita un nombre (pedíselo a MaKo).';
  if (spec.budget_level === 'campaign' && !(spec.daily_budget_mxn && spec.daily_budget_mxn > 0)) return 'Falta el presupuesto diario (pedíselo a MaKo).';
  for (const [ai, a] of spec.adsets.entries()) {
    if (spec.budget_level === 'adset' && !(a.daily_budget_mxn && a.daily_budget_mxn > 0)) return `Falta el presupuesto del conjunto ${ai + 1}.`;
    for (const ad of a.ads) {
      const c = ad.creative;
      const hasMedia = c.source === 'existing' ? !!c.source_ad_id : !!(c.image_hash || c.video_id);
      if (!hasMedia) return `Asigná un creativo al anuncio "${ad.name}" (subí uno o elegí un ganador).`;
      if (a.optimization_goal === 'LEAD_GENERATION') { if (!c.lead_form_id) return `El anuncio "${ad.name}" optimiza por formulario: elegí un formulario instantáneo.`; }
      else if (c.source !== 'existing' && !c.destination_url?.trim()) return `Falta la URL de destino del anuncio "${ad.name}".`;
    }
  }
  return null;
}
