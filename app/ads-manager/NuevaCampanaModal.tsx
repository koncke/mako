'use client';

// =============================================================================
// NuevaCampanaModal — crear una campaña con MaKo, en UN solo pop-up minimalista
// =============================================================================
// Wizard de una pregunta por pantalla (sin formularios densos): creativos →
// inversión (SIEMPRE en USD) → objetivo → estrategia (MaKo mira los creativos con
// OpenAI) → público/destino → MaKo arma → revisión → publicar. Las RESPUESTAS son
// la fuente de verdad; el CampaignSpec se deriva de ellas (MaKo solo escribe el
// copy), así nada se pierde. Se crea en Meta SIEMPRE en PAUSA. El borrador se
// conserva al cerrar.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import type { SenalRecon } from '@/lib/queries';
import {
  type CampaignSpec, type AdSpec, type Creative, type Targeting, type Objective, type AudienceRef,
  objetivoDef, CTA_OPCIONES,
} from '@/lib/campaign-types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// Inversión SIEMPRE en USD; Meta cobra en la moneda de la cuenta (MXN) → convertimos.
const USD_MXN = 17.3; // espeja TIPO_DE_CAMBIO_USD_MXN
const usdToMxn = (usd: number) => Math.round(usd * USD_MXN);

// ── estilos ──
const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14.5, cursor: 'pointer' };
const pregunta: CSSProperties = { fontSize: 25, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 };
const ayuda: CSSProperties = { fontSize: 14.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5, margin: '10px 0 0', maxWidth: 440 };

type Step = 'creativos' | 'inversion' | 'objetivo' | 'estrategia' | 'publico' | 'destino' | 'armando' | 'revision' | 'publicando' | 'listo';
type Estrategia = 'retargeting' | 'frio' | 'intereses';
type AudTipo = 'page' | 'ig' | 'lead' | 'pixel';
type Destino = { lead_form_id?: string | null; lead_form_name?: string | null; url?: string };
type Analisis = Array<{ descripcion: string; angulo: string }>;
type Uso = { tokens: number; costUsd: number } | null;

type TrayItem = {
  id: string; kind: 'upload' | 'existing'; media_type?: 'image' | 'video';
  image_hash?: string | null; video_id?: string | null; thumbnail_url?: string | null;
  source_ad_id?: string | null; label: string; processing?: boolean; progress?: number;
};

const fmtUso = (u: Uso) => (!u ? '' : `✦ ${u.tokens >= 1000 ? `${(u.tokens / 1000).toFixed(1)}k` : u.tokens} tok · $${u.costUsd >= 1 ? u.costUsd.toFixed(2) : u.costUsd.toFixed(3)}`);

// PUT del archivo a la URL firmada de Supabase con progreso (multipart + apikey).
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
        return reject(new Error('El archivo supera el límite de Supabase Storage. Subilo en Supabase → Storage → Settings → "Upload file size limit".'));
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

// Miniatura local (dataURL) de imagen o de un frame del video (para previa + MaKo visión + persistencia).
function fitCanvas(w: number, h: number) {
  const max = 240; const scale = Math.min(1, max / Math.max(w || max, h || max));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((w || max) * scale));
  canvas.height = Math.max(1, Math.round((h || max) * scale));
  return { canvas, ctx: canvas.getContext('2d') };
}
function makeThumb(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (file.type.startsWith('image')) {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => { const { canvas, ctx } = fitCanvas(img.width, img.height); if (!ctx) { URL.revokeObjectURL(url); return resolve(null); } ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); try { resolve(canvas.toDataURL('image/jpeg', 0.72)); } catch { resolve(null); } };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      } else if (file.type.startsWith('video')) {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.muted = true; v.preload = 'metadata'; v.playsInline = true;
        v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch { /* */ } };
        v.onseeked = () => { const { canvas, ctx } = fitCanvas(v.videoWidth, v.videoHeight); if (!ctx) { URL.revokeObjectURL(url); return resolve(null); } ctx.drawImage(v, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); try { resolve(canvas.toDataURL('image/jpeg', 0.72)); } catch { resolve(null); } };
        v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        v.src = url;
      } else resolve(null);
    } catch { resolve(null); }
  });
}

// ── Borrador local ──
const DRAFT_KEY = 'mako.nuevaCampana.draft.v2';
type Draft = { step: Step; tray: TrayItem[]; budgetUsd: number | null; objetivo: Objective | null; estrategia: Estrategia | null; audiencias: AudienceRef[]; destino: Destino; analisis: Analisis; spec: CampaignSpec | null; uso: Uso };
function loadDraft(): Draft {
  const vacio: Draft = { step: 'creativos', tray: [], budgetUsd: null, objetivo: null, estrategia: null, audiencias: [], destino: {}, analisis: [], spec: null, uso: null };
  if (typeof window === 'undefined') return vacio;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return vacio;
    const d = JSON.parse(raw) as Partial<Draft>;
    const step = d.spec ? 'revision' : (d.step && d.step !== 'armando' && d.step !== 'publicando' && d.step !== 'listo' ? d.step : 'creativos');
    return { ...vacio, ...d, step };
  } catch { return vacio; }
}

const ESTRATEGIAS: Array<{ value: Estrategia; icon: string; label: string; desc: string }> = [
  { value: 'retargeting', icon: '🔁', label: 'Reenganchar (retargeting)', desc: 'Mostrárselo a gente que YA te vio o interactuó.' },
  { value: 'frio', icon: '❄️', label: 'Llegar a gente nueva', desc: 'Público amplio; Meta optimiza (Advantage+).' },
  { value: 'intereses', icon: '🎯', label: 'Por intereses', desc: 'MaKo elige intereses afines a tu avatar.' },
];
const OBJETIVO_UI: Array<{ value: Objective; icon: string; label: string; desc: string }> = [
  { value: 'OUTCOME_LEADS', icon: '🧲', label: 'Leads con formulario de Facebook', desc: 'Formulario instantáneo dentro de Facebook/Instagram.' },
  { value: 'OUTCOME_TRAFFIC', icon: '▶️', label: 'Tráfico a tu VSL / landing', desc: 'Mandás gente a tu página; ahí captás el lead o la venta.' },
  { value: 'OUTCOME_SALES', icon: '🛒', label: 'Conversiones / ventas', desc: 'Optimiza por conversiones medidas con el pixel.' },
  { value: 'OUTCOME_AWARENESS', icon: '📣', label: 'Reconocimiento / alcance', desc: 'Máximo alcance al menor costo.' },
];

export function NuevaCampanaModal({ senales, campaignCount, onClose, onPublished }: { senales: SenalRecon[]; campaignCount: number; onClose: () => void; onPublished: () => void }) {
  const [d0] = useState(loadDraft);
  const [step, setStep] = useState<Step>(d0.step);
  const [tray, setTray] = useState<TrayItem[]>(d0.tray);
  const [budgetUsd, setBudgetUsd] = useState<number | null>(d0.budgetUsd);
  const [objetivo, setObjetivo] = useState<Objective | null>(d0.objetivo);
  const [estrategia, setEstrategia] = useState<Estrategia | null>(d0.estrategia);
  const [audiencias, setAudiencias] = useState<AudienceRef[]>(d0.audiencias);
  const [destino, setDestino] = useState<Destino>(d0.destino);
  const [analisis, setAnalisis] = useState<Analisis>(d0.analisis);
  const [spec, setSpec] = useState<CampaignSpec | null>(d0.spec);
  const [uso, setUso] = useState<Uso>(d0.uso);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ campaign_id: string; ads: number } | null>(null);
  const trayCounter = useRef(d0.tray.reduce((mx, t) => { const m = /^up-(\d+)$/.exec(t.id); return m ? Math.max(mx, Number(m[1])) : mx; }, 0));
  const publishingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // públicos personalizados (retargeting) + formularios — carga perezosa.
  const [audiencesAll, setAudiencesAll] = useState<AudienceRef[] | null>(null);
  const [leadForms, setLeadForms] = useState<Array<{ id: string; name: string }> | null>(null);
  const [creandoPublico, setCreandoPublico] = useState(false);
  useEffect(() => { fetch('/api/ads-manager/targeting?kind=audiences').then((r) => r.json()).then((j) => setAudiencesAll(j.ok ? j.items : [])).catch(() => setAudiencesAll([])); }, []);
  useEffect(() => { if (objetivo === 'OUTCOME_LEADS' && leadForms === null) fetch('/api/ads-manager/targeting?kind=leadforms').then((r) => r.json()).then((j) => setLeadForms(j.ok ? j.items : [])).catch(() => setLeadForms([])); }, [objetivo, leadForms]);

  // guardar borrador
  useEffect(() => {
    try {
      if (step === 'listo') return;
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, tray, budgetUsd, objetivo, estrategia, audiencias, destino, analisis, spec, uso }));
    } catch { /* quota */ }
  }, [step, tray, budgetUsd, objetivo, estrategia, audiencias, destino, analisis, spec, uso]);

  const usables = () => tray.filter((t) => !t.processing && (t.image_hash || t.video_id || t.source_ad_id));

  // ── flujo / navegación ──
  const flow: Step[] = ['creativos', 'inversion', 'objetivo', 'estrategia', ...(estrategia === 'retargeting' ? ['publico' as Step] : []), 'destino'];
  const idx = flow.indexOf(step);
  const puedeAvanzar = (): boolean => {
    switch (step) {
      case 'creativos': return usables().length > 0;
      case 'inversion': return !!budgetUsd && budgetUsd > 0;
      case 'objetivo': return !!objetivo;
      case 'estrategia': return !!estrategia;
      case 'publico': return audiencias.length > 0;
      case 'destino': return objetivo === 'OUTCOME_LEADS' ? !!destino.lead_form_id : !!destino.url?.trim();
      default: return false;
    }
  };
  const avanzar = () => {
    if (!puedeAvanzar()) return;
    if (step === 'destino') return armar();
    const next = flow[idx + 1];
    if (next) setStep(next);
  };
  const retroceder = () => { if (idx > 0) setStep(flow[idx - 1]); else onClose(); };

  // ── subir creativo ──
  async function subir(file: File) {
    const esVideo = file.type.startsWith('video');
    const maxMb = esVideo ? 512 : 30;
    if (file.size > maxMb * 1024 * 1024) { setErr(`"${file.name}" supera el máximo (${maxMb} MB).`); return; }
    const id = `up-${++trayCounter.current}`;
    const pend: TrayItem = { id, kind: 'upload', media_type: esVideo ? 'video' : 'image', label: file.name, processing: true, progress: 0, thumbnail_url: null };
    setTray((t) => [...t, pend]);
    makeThumb(file).then((dt) => { if (dt) setTray((t) => t.map((x) => x.id === id ? { ...x, thumbnail_url: x.thumbnail_url ?? dt } : x)); });
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
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setTray((t) => t.filter((x) => x.id !== id)); }
  }
  function agregarGanador(s: SenalRecon) {
    if (tray.some((t) => t.source_ad_id === s.ad_id)) return;
    setTray((t) => [...t, { id: `win-${s.ad_id}`, kind: 'existing', source_ad_id: s.ad_id, thumbnail_url: s.ad_thumbnail_url, label: s.ad_name }]);
  }
  const quitar = (id: string) => setTray((t) => t.filter((x) => x.id !== id));

  // ── crear un público personalizado sin salir de la app ──
  async function crearPublico(tipo: AudTipo, dias: number) {
    setCreandoPublico(true); setErr(null);
    try {
      const r = await fetch('/api/ads-manager/audience-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, dias }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo crear el público');
      const a = j.audience as AudienceRef;
      setAudiencesAll((prev) => [a, ...(prev ?? [])]);
      setAudiencias((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCreandoPublico(false); }
  }

  // ── MaKo arma la campaña a partir de las respuestas ──
  async function armar() {
    setStep('armando'); setErr(null);
    try {
      // 1) MaKo mira los creativos (solo los que tienen miniatura dataURL).
      let an = analisis;
      const paraVer = usables().filter((t) => t.thumbnail_url?.startsWith('data:')).map((t) => ({ thumbnail: t.thumbnail_url, media_type: t.media_type }));
      if (paraVer.length) {
        try { const ar = await fetch('/api/ads-manager/analyze-creatives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creatives: paraVer }) }); const aj = await ar.json(); if (aj.ok && Array.isArray(aj.items)) { an = aj.items; setAnalisis(an); } } catch { /* best-effort */ }
      }
      // 2) MaKo escribe el copy alineado al objetivo + estrategia.
      const r = await fetch('/api/ads-manager/campaign-suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'suggest', prompt: promptDeRespuestas(an) }) });
      const j = await r.json();
      if (j.uso) setUso(j.uso);
      const makoSpec: CampaignSpec | null = j.ok ? j.spec : null;
      // 3) construir el spec determinístico (respuestas = verdad; copy de MaKo).
      setSpec(construirSpec(makoSpec));
      setStep('revision');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setStep('destino'); }
  }

  function promptDeRespuestas(an: Analisis): string {
    const objLabel = OBJETIVO_UI.find((o) => o.value === objetivo)?.label ?? objetivo;
    const estrLabel = ESTRATEGIAS.find((e) => e.value === estrategia)?.label ?? estrategia;
    const u = usables();
    const desc = u.map((t, i) => `Creativo ${i + 1} (${t.media_type ?? 'archivo'}${t.kind === 'existing' ? ', ganador' : ''}): ${an[i]?.descripcion || '(sin descripción)'}${an[i]?.angulo ? ` [ángulo: ${an[i].angulo}]` : ''}`).join('\n');
    return `El usuario ya decidió estos parámetros (NO los cambies, respetalos):
- Objetivo: ${objLabel}
- Estrategia/audiencia: ${estrLabel}
- Inversión: ${budgetUsd} USD/día
- Creativos (${u.length}):
${desc}

Tu tarea PRINCIPAL: escribí el COPY de UN anuncio por cada creativo (texto principal potente, título corto y CTA), en la voz de la marca, alineado al objetivo y la estrategia, usando la descripción de cada creativo. Devolvé el JSON de la campaña con un conjunto y un anuncio por creativo (en el mismo orden de los creativos).`;
  }

  function construirSpec(mako: CampaignSpec | null): CampaignSpec {
    const obj = objetivo ?? 'OUTCOME_LEADS';
    const def = objetivoDef(obj);
    const copies = mako ? mako.adsets.flatMap((s) => s.ads).map((a) => a.creative) : [];
    const u = usables();
    const targeting: Targeting = estrategia === 'retargeting'
      ? { geo_locations: { countries: ['MX'] }, custom_audiences: audiencias.map((x) => ({ id: x.id, name: x.name })), advantage_audience: 0 }
      : estrategia === 'intereses'
        ? { geo_locations: { countries: ['MX'] }, advantage_audience: 0, flexible_spec: mako?.adsets?.[0]?.targeting?.flexible_spec }
        : { geo_locations: { countries: ['MX'] }, advantage_audience: 1 };
    const ads: AdSpec[] = u.map((t, i) => {
      const cp = copies[i] ?? copies[0] ?? ({} as Creative);
      const creative: Creative = {
        source: t.kind === 'existing' ? 'existing' : 'upload',
        source_ad_id: t.kind === 'existing' ? t.source_ad_id ?? null : null,
        media_type: t.media_type, image_hash: t.image_hash ?? null, video_id: t.video_id ?? null, thumbnail_url: t.thumbnail_url ?? null,
        primary_text: cp.primary_text ?? '', headline: cp.headline ?? '', description: cp.description ?? '',
        cta_type: cp.cta_type ?? (obj === 'OUTCOME_LEADS' ? 'SIGN_UP' : 'LEARN_MORE'),
      };
      if (def.optimization_goal === 'LEAD_GENERATION') { creative.lead_form_id = destino.lead_form_id ?? null; creative.lead_form_name = destino.lead_form_name ?? null; }
      else creative.destination_url = destino.url ?? '';
      return { name: `Anuncio ${i + 1}`, creative };
    });
    const estrTag = estrategia === 'retargeting' ? 'Retargeting' : estrategia === 'intereses' ? 'Intereses' : 'Adquisición';
    return {
      name: mako?.name || `${estrTag} — ${OBJETIVO_UI.find((o) => o.value === obj)?.label ?? ''}`.trim(),
      objective: obj, special_ad_categories: [], budget_level: 'campaign', daily_budget_mxn: usdToMxn(budgetUsd ?? 0),
      adsets: [{ name: `${estrTag}`, daily_budget_mxn: null, optimization_goal: def.optimization_goal, billing_event: def.billing_event, bid_strategy: 'LOWEST_COST_WITHOUT_CAP', targeting, ads }],
      rationale: mako?.rationale ?? '',
    };
  }

  // ── publicar ──
  async function publicar() {
    if (!spec || publishingRef.current) return;
    publishingRef.current = true;
    setErr(null); setStep('publicando');
    try {
      const r = await fetch('/api/ads-manager/campaign-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec, prompt: promptDeRespuestas(analisis), uso }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo publicar');
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
      setResult({ campaign_id: j.campaign_id, ads: (j.ad_ids ?? []).length });
      setStep('listo');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setStep('revision'); }
    finally { publishingRef.current = false; }
  }

  // ── resumen vivo (chips) ──
  const resumen: string[] = [];
  if (usables().length) resumen.push(`${usables().length} creativo${usables().length === 1 ? '' : 's'}`);
  if (budgetUsd) resumen.push(`$${budgetUsd}/día`);
  if (objetivo) resumen.push(OBJETIVO_UI.find((o) => o.value === objetivo)?.label ?? '');
  if (estrategia) resumen.push(ESTRATEGIAS.find((e) => e.value === estrategia)?.label ?? '');

  const enWizard = step === 'creativos' || step === 'inversion' || step === 'objetivo' || step === 'estrategia' || step === 'publico' || step === 'destino';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,21,17,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: step === 'revision' ? 640 : 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(23,21,17,.4)', overflow: 'hidden' }}>
        {/* barra superior minimalista: marca + progreso + cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord>
          </div>
          {enWizard && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {flow.map((s, i) => <span key={s} style={{ width: i === idx ? 22 : 7, height: 7, borderRadius: 999, background: i <= idx ? 'var(--accent)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          <button onClick={onClose} style={{ marginLeft: enWizard ? 0 : 'auto', width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {step === 'creativos' && (
            <Paso titulo="¿Qué vas a promocionar?" sub="Subí tus imágenes o videos, o reusá un anuncio que ya te funciona. Podés cargar varios.">
              <CreativosPicker tray={tray} onQuitar={quitar} senales={senales} onGanador={agregarGanador} fileRef={fileRef} />
            </Paso>
          )}

          {step === 'inversion' && (
            <Paso titulo="¿Cuánto querés invertir por día?" sub="Siempre en dólares. Lo convertimos a la moneda de tu cuenta automáticamente.">
              <Inversion value={budgetUsd} onChange={setBudgetUsd} />
            </Paso>
          )}

          {step === 'objetivo' && (
            <Paso titulo="¿Qué buscás con esta campaña?">
              <Opciones items={OBJETIVO_UI} value={objetivo} onPick={(v) => { setObjetivo(v as Objective); setStep(flow[flow.indexOf('objetivo') + 1]); }} />
            </Paso>
          )}

          {step === 'estrategia' && (
            <Paso titulo="¿Qué querés hacer con estos creativos?" sub={analisisResumen(analisis)}>
              <Opciones items={ESTRATEGIAS} value={estrategia} onPick={(v) => { setEstrategia(v as Estrategia); const f: Step[] = ['creativos', 'inversion', 'objetivo', 'estrategia', ...((v as Estrategia) === 'retargeting' ? ['publico' as Step] : []), 'destino']; setStep(f[f.indexOf('estrategia') + 1]); }} />
            </Paso>
          )}

          {step === 'publico' && (
            <Paso titulo="¿A qué público lo mostramos?" sub="Tus públicos personalizados (video viewers, visitantes, leads abiertos…). MaKo no los inventa.">
              <PublicoPicker audiencesAll={audiencesAll} audiencias={audiencias} setAudiencias={setAudiencias} onCrear={crearPublico} creando={creandoPublico} />
            </Paso>
          )}

          {step === 'destino' && (
            <Paso titulo={objetivo === 'OUTCOME_LEADS' ? '¿Qué formulario instantáneo usás?' : '¿A qué página llevamos a la gente?'} sub={objetivo === 'OUTCOME_LEADS' ? 'Elegí un formulario que ya tengas en la página.' : 'La URL de tu VSL o landing.'}>
              {objetivo === 'OUTCOME_LEADS' ? (
                <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <Dropdown value={destino.lead_form_id ?? ''} placeholder={leadForms === null ? 'Cargando formularios…' : leadForms.length ? 'Elegí un formulario…' : 'No tenés formularios instantáneos'}
                    options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => setDestino({ lead_form_id: v, lead_form_name: leadForms?.find((f) => f.id === v)?.name ?? null })} width="100%" />
                  {leadForms !== null && leadForms.length === 0 && (
                    <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>No hay formularios instantáneos en la página. Tocá <b>← Atrás</b> y elegí <b>“Tráfico a tu VSL / landing”</b> para captar el lead en tu página, o creá el formulario en Meta y volvé.</p>
                  )}
                </div>
              ) : (
                <input value={destino.url ?? ''} onChange={(e) => setDestino({ url: e.target.value })} placeholder="https://tu-landing/vsl" autoFocus
                  style={{ width: '100%', maxWidth: 460, padding: '14px 16px', borderRadius: 13, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, outline: 'none', textAlign: 'center' }} />
              )}
            </Paso>
          )}

          {step === 'armando' && (
            <div style={{ padding: '64px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <MakoStar size={30} />
              <h3 style={pregunta}>MaKo está mirando tus creativos y armando la campaña…</h3>
              <p style={ayuda}>Escribe el copy de cada anuncio según tu objetivo y estrategia.</p>
            </div>
          )}

          {step === 'revision' && spec && (
            <Revision spec={spec} budgetUsd={budgetUsd} tray={tray} campaignCount={campaignCount} setSpec={setSpec} err={err} />
          )}

          {step === 'publicando' && (
            <div style={{ padding: '64px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <MakoStar size={30} />
              <h3 style={pregunta}>Publicando en Meta (en pausa)…</h3>
            </div>
          )}

          {step === 'listo' && result && (
            <div style={{ padding: '52px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--good-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>✓</div>
              <h3 style={pregunta}>Campaña creada en pausa</h3>
              <p style={ayuda}>Se creó con {result.ads} anuncio{result.ads === 1 ? '' : 's'}, todo en <b>PAUSA</b>. Activala con el toggle de la tabla cuando quieras.</p>
              <button onClick={() => { onPublished(); onClose(); }} style={btnDark}>Ver en la tabla</button>
            </div>
          )}
        </div>

        {/* pie: navegación + resumen vivo */}
        {(enWizard || step === 'revision') && (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            {resumen.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '10px 20px 0', justifyContent: 'center' }}>
                {resumen.map((c, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{i > 0 ? '·' : ''} {c}</span>)}
              </div>
            )}
            {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', padding: '8px 20px 0' }}>{err}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px' }}>
              <button onClick={retroceder} style={btnGhost}>← {idx <= 0 && enWizard ? 'Cancelar' : 'Atrás'}</button>
              {step === 'revision' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {uso && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{fmtUso(uso)}</span>}
                  <button onClick={armar} style={btnGhost}>↻ Regenerar</button>
                  <button onClick={publicar} style={{ ...btnDark, background: 'var(--good)' }}>Publicar en pausa</button>
                </div>
              ) : (
                step !== 'objetivo' && step !== 'estrategia' && <button onClick={avanzar} disabled={!puedeAvanzar()} style={{ ...btnDark, opacity: puedeAvanzar() ? 1 : 0.4, cursor: puedeAvanzar() ? 'pointer' : 'not-allowed' }}>Siguiente →</button>
              )}
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" style={{ display: 'none' }}
          onChange={(e) => { const files = e.target.files; if (files) Array.from(files).forEach((f) => subir(f)); e.target.value = ''; }} />
      </div>
    </div>
  );
}

// ── wrapper de cada paso (centrado, aireado) ──
function Paso({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ padding: '34px 30px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={pregunta}>{titulo}</h2>
        {sub && <p style={ayuda}>{sub}</p>}
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>{children}</div>
    </div>
  );
}

// ── opciones tipo tarjeta (objetivo / estrategia) ──
function Opciones<T extends string>({ items, value, onPick }: { items: Array<{ value: T; icon: string; label: string; desc: string }>; value: T | null; onPick: (v: T) => void }) {
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => {
        const on = value === it.value;
        return (
          <button key={it.value} type="button" onClick={() => onPick(it.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(200,135,12,.06)' : 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.borderColor = 'var(--border-strong)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <span style={{ fontSize: 24, flex: 'none' }}>{it.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{it.label}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 1 }}>{it.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── inversión (USD) ──
function Inversion({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--border-strong)', borderRadius: 16, padding: '14px 22px', background: 'var(--surface-2)' }}>
        <span style={{ fontSize: 30, fontWeight: 600, color: 'var(--dim)' }}>$</span>
        <input value={value ?? ''} inputMode="numeric" autoFocus onChange={(e) => { const n = Number(e.target.value.replace(/[^\d]/g, '')); onChange(n > 0 ? n : null); }}
          placeholder="50" style={{ width: 130, border: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 40, fontWeight: 700, outline: 'none', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ fontSize: 16, color: 'var(--dim)', fontWeight: 500 }}>USD/día</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[20, 50, 100, 200].map((v) => <button key={v} type="button" onClick={() => onChange(v)} style={{ padding: '8px 16px', borderRadius: 999, border: `1px solid ${value === v ? 'var(--accent)' : 'var(--border-strong)'}`, background: value === v ? 'rgba(200,135,12,.08)' : 'var(--surface)', color: value === v ? '#9A6A09' : 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>${v}</button>)}
      </div>
      {value ? <span style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>≈ ${usdToMxn(value).toLocaleString('es-MX')} MXN/día en tu cuenta</span> : null}
    </div>
  );
}

// ── creativos ──
function CreativosPicker({ tray, onQuitar, senales, onGanador, fileRef }: { tray: TrayItem[]; onQuitar: (id: string) => void; senales: SenalRecon[]; onGanador: (s: SenalRecon) => void; fileRef: React.RefObject<HTMLInputElement | null> }) {
  const [verGanadores, setVerGanadores] = useState(false);
  const ganadores = [...senales].filter((s) => s.ad_thumbnail_url).sort((a, b) => b.leads - a.leads || b.spend_usd - a.spend_usd).slice(0, 12);
  return (
    <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {tray.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {tray.map((t) => (
            <div key={t.id} style={{ position: 'relative', width: 78, height: 104, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', flex: 'none' }} title={t.label}>
              {t.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: t.processing ? 0.7 : 1 }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>{t.media_type === 'video' ? '🎬' : '🖼️'}</div>}
              {t.processing && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(23,21,17,.62)', padding: '4px 5px 5px' }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(243,240,231,.25)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${t.progress ?? 0}%`, background: 'var(--accent-soft)', transition: 'width .2s' }} /></div>
                  <div style={{ fontSize: 8.5, color: '#F3F0E7', fontFamily: MONO, textAlign: 'center', marginTop: 2 }}>{(t.progress ?? 0) < 100 ? `${t.progress ?? 0}%` : 'Procesando'}</div>
                </div>
              )}
              {t.kind === 'existing' && <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '0 4px' }}>★</span>}
              <button type="button" onClick={() => onQuitar(t.id)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 6, border: 'none', background: 'rgba(23,21,17,.7)', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => fileRef.current?.click()} style={btnDark}>⬆ Subir creativo</button>
        <button type="button" onClick={() => setVerGanadores((v) => !v)} style={btnGhost}>★ Usar un ganador</button>
      </div>
      {verGanadores && (
        <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {ganadores.length === 0 ? <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', margin: 0 }}>Sin anuncios con creativo para reusar.</p> : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxHeight: 200, overflowY: 'auto' }}>
              {ganadores.map((s) => (
                <button key={s.ad_id} type="button" onClick={() => onGanador(s)} title={`${s.ad_name} · ${s.leads} leads`} style={{ position: 'relative', width: 56, height: 74, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', cursor: 'pointer', padding: 0, flex: 'none' }}>
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

// ── público (retargeting) — elegir uno existente o CREAR uno sin entrar a Meta ──
function PublicoPicker({ audiencesAll, audiencias, setAudiencias, onCrear, creando }: { audiencesAll: AudienceRef[] | null; audiencias: AudienceRef[]; setAudiencias: (a: AudienceRef[]) => void; onCrear: (tipo: AudTipo, dias: number) => void; creando: boolean }) {
  const [dias, setDias] = useState(90);
  const opts = (audiencesAll ?? []).filter((a) => !audiencias.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: a.name ?? a.id }));
  const chipDia = (on: boolean): CSSProperties => ({ padding: '5px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}`, background: on ? 'rgba(200,135,12,.08)' : 'var(--surface)', color: on ? '#9A6A09' : 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' });
  const btnCrear: CSSProperties = { ...btnGhost, fontSize: 12.5, padding: '8px 12px', opacity: creando ? 0.5 : 1 };
  const presets: Array<{ tipo: AudTipo; label: string }> = [
    { tipo: 'page', label: '👍 Facebook' },
    { tipo: 'ig', label: '📸 Instagram' },
    { tipo: 'lead', label: '📝 Abrieron tu form' },
    { tipo: 'pixel', label: '🌐 Tu web' },
  ];
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <Dropdown value="" placeholder={audiencesAll === null ? 'Cargando públicos…' : audiencesAll.length ? 'Elegí un público (podés sumar varios)…' : 'No tenés públicos todavía'} resetAfterSelect
        options={opts} onChange={(v) => { const a = (audiencesAll ?? []).find((x) => x.id === v); if (a) setAudiencias([...audiencias, { id: a.id, name: a.name }]); }} width="100%" />
      {audiencias.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {audiencias.map((a) => <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', fontSize: 13.5, color: 'var(--ink)' }}>{a.name ?? a.id}<button type="button" onClick={() => setAudiencias(audiencias.filter((x) => x.id !== a.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 13, padding: 0 }}>✕</button></span>)}
        </div>
      )}
      {audiencias.length > 1 && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>Se combinan (cualquiera de los {audiencias.length}).</span>}

      {/* crear público sin entrar a Meta */}
      <div style={{ width: '100%', borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 4 }}>
        <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: '0 0 10px' }}>¿No está el que querés? Creá uno acá, sin entrar a Meta. Podés crear varios y se combinan.</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
          {[30, 90, 180].map((dd) => <button key={dd} type="button" onClick={() => setDias(dd)} style={chipDia(dias === dd)}>{dd} días</button>)}
        </div>
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap' }}>
          {presets.map((p) => <button key={p.tipo} type="button" disabled={creando} onClick={() => onCrear(p.tipo, dias)} style={btnCrear}>{p.label}</button>)}
        </div>
        {creando && <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', marginTop: 8 }}>Creando el público en Meta…</p>}
      </div>
    </div>
  );
}

// ── revisión minimalista ──
function Revision({ spec, budgetUsd, tray, campaignCount, setSpec, err }: { spec: CampaignSpec; budgetUsd: number | null; tray: TrayItem[]; campaignCount: number; setSpec: (s: CampaignSpec) => void; err: string | null }) {
  const objLabel = OBJETIVO_UI.find((o) => o.value === spec.objective)?.label ?? spec.objective;
  const ads = spec.adsets.flatMap((s) => s.ads);
  return (
    <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <input value={spec.name} onChange={(e) => setSpec({ ...spec, name: e.target.value })} style={{ width: '100%', border: 'none', borderBottom: '1px solid transparent', background: 'transparent', textAlign: 'center', fontFamily: SANS, fontSize: 20, fontWeight: 600, color: 'var(--ink)', outline: 'none', padding: '2px 0' }}
          onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }} onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          {[`🎯 ${objLabel}`, `💰 $${budgetUsd}/día`, ...spec.adsets.map((a) => `👥 ${a.name}`)].map((c, i) => (
            <span key={i} style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 11px' }}>{c}</span>
          ))}
        </div>
      </div>
      {spec.rationale && <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, margin: 0, textAlign: 'center' }}>{spec.rationale}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ads.map((ad, i) => {
          const t = ad.creative.source === 'existing' ? tray.find((x) => x.source_ad_id === ad.creative.source_ad_id) : tray.find((x) => (ad.creative.image_hash && x.image_hash === ad.creative.image_hash) || (ad.creative.video_id && x.video_id === ad.creative.video_id));
          const thumb = t?.thumbnail_url ?? ad.creative.thumbnail_url ?? null;
          return (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ width: 64, flex: 'none', aspectRatio: '9 / 16', maxHeight: 110, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 18 }}>{ad.creative.media_type === 'video' ? '🎬' : '🖼️'}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ad.creative.primary_text ? <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45 }}>{ad.creative.primary_text}</div> : <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>Sin copy.</div>}
                {ad.creative.headline && <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>{ad.creative.headline}</div>}
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 5 }}>▸ {CTA_OPCIONES.find((o) => o.value === (ad.creative.cta_type ?? 'LEARN_MORE'))?.label}{ad.creative.destination_url ? ` · ${ad.creative.destination_url}` : ad.creative.lead_form_name ? ` · ${ad.creative.lead_form_name}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <button type="button" onClick={() => setSpec(aplicarNomenclatura(spec, campaignCount + 1))} style={{ ...btnGhost, fontSize: 12.5, padding: '7px 13px' }}># Aplicar nomenclatura</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Se crea en <b>pausa</b>. ¿Querés cambios? Tocá <b>Atrás</b> para ajustar tus respuestas, o <b>Regenerar</b> el copy.{err ? ` — ${err}` : ''}</p>
    </div>
  );
}

// ── helpers ──
function analisisResumen(an: Analisis): string | undefined {
  const con = an.filter((x) => x.angulo || x.descripcion);
  if (!con.length) return 'MaKo mira tus creativos para sugerirte mejor.';
  const angulos = [...new Set(con.map((x) => x.angulo).filter(Boolean))].slice(0, 3);
  return angulos.length ? `MaKo vio tus creativos (${angulos.join(', ')}). Elegí la estrategia.` : undefined;
}

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
      return { ...a, name: `${code} ${stripNomenCode(a.name)}`.trim(), ads: a.ads.map((ad, j) => ({ ...ad, name: `${code}.${letra(j + 1)} ${stripNomenCode(ad.name)}`.trim() })) };
    }),
  };
}
