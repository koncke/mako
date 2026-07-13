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

import { useEffect, useId, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Dropdown } from '../components/Dropdown';
import { MakoStar, MakoWord } from '../_components/MakoBrand';
import type { SenalRecon } from '@/lib/queries';
import {
  type CampaignSpec, type AdSpec, type Creative, type Targeting, type Objective, type AudienceRef,
  objetivoDef, CTA_OPCIONES,
} from '@/lib/campaign-types';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
// Chispa de MaKo (misma que MakoBrand) para el loader animado de "armando"/"publicando".
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';

// Inversión SIEMPRE en USD; Meta cobra en la moneda de la cuenta (MXN) → convertimos.
const USD_MXN = 17.3; // espeja TIPO_DE_CAMBIO_USD_MXN
const usdToMxn = (usd: number) => Math.round(usd * USD_MXN);

// ── estilos ──
const btnDark: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14.5, cursor: 'pointer' };
const pregunta: CSSProperties = { fontSize: 25, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 };
const ayuda: CSSProperties = { fontSize: 14.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5, margin: '10px 0 0', maxWidth: 440 };

type Step = 'creativos' | 'inversion' | 'objetivo' | 'estrategia' | 'publico' | 'ubicaciones' | 'destino' | 'armando' | 'revision' | 'publicando' | 'listo';
type Estrategia = 'retargeting' | 'frio' | 'intereses';
type AudTipo = 'page' | 'ig' | 'video' | 'pixel';
type AudienceItem = AudienceRef & { count?: number | null };
type Destino = { lead_form_id?: string | null; lead_form_name?: string | null; url?: string; conv?: { pixel_event?: string; custom_conversion_id?: string; label?: string; pixel_id?: string } };
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
type Draft = { step: Step; tray: TrayItem[]; budgetUsd: number | null; objKey: ObjKey | null; estrategia: Estrategia | null; audiencias: AudienceRef[]; placements: string[] | null; destino: Destino; analisis: Analisis; spec: CampaignSpec | null; uso: Uso };
function loadDraft(): Draft {
  const vacio: Draft = { step: 'creativos', tray: [], budgetUsd: null, objKey: null, estrategia: null, audiencias: [], placements: null, destino: {}, analisis: [], spec: null, uso: null };
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
type ObjKey = 'lead_form' | 'lead_web' | 'traffic' | 'sales' | 'awareness';
const OBJ_KEYS: Record<ObjKey, { objective: Objective; optimization: string; needsForm: boolean; needsConv: boolean }> = {
  lead_form: { objective: 'OUTCOME_LEADS', optimization: 'LEAD_GENERATION', needsForm: true, needsConv: false },
  lead_web: { objective: 'OUTCOME_LEADS', optimization: 'OFFSITE_CONVERSIONS', needsForm: false, needsConv: true },
  traffic: { objective: 'OUTCOME_TRAFFIC', optimization: 'LANDING_PAGE_VIEWS', needsForm: false, needsConv: false },
  sales: { objective: 'OUTCOME_SALES', optimization: 'OFFSITE_CONVERSIONS', needsForm: false, needsConv: true },
  awareness: { objective: 'OUTCOME_AWARENESS', optimization: 'REACH', needsForm: false, needsConv: false },
};
const OBJETIVO_UI: Array<{ value: ObjKey; icon: string; label: string; desc: string }> = [
  { value: 'lead_form', icon: '🧲', label: 'Leads con formulario de Facebook', desc: 'Clientes potenciales con el formulario instantáneo DENTRO de Facebook/Instagram.' },
  { value: 'lead_web', icon: '📅', label: 'Leads / agendas en tu web', desc: 'Optimiza por una conversión en tu landing (agenda, registro, lead) con el pixel. Sin formulario de Facebook.' },
  { value: 'traffic', icon: '▶️', label: 'Tráfico a tu VSL / landing', desc: 'Llevar gente a tu página, sin optimizar por conversión.' },
  { value: 'sales', icon: '🛒', label: 'Ventas / compras', desc: 'Optimiza por compras medidas con el pixel.' },
  { value: 'awareness', icon: '📣', label: 'Reconocimiento / alcance', desc: 'Máximo alcance al menor costo.' },
];
// Conversiones estándar para "leads/agendas en tu web" + ventas.
// OJO: el valor es el ENUM de Meta (custom_event_type), no el nombre del evento.
// Redacción en OBJETIVO ("Que agenden"), NO en pasado: acá elegimos qué queremos
// que la gente HAGA, no un público de quienes ya lo hicieron (eso es EVENTOS_PIXEL).
const EVENTOS_CONV: Array<{ value: string; label: string }> = [
  { value: 'LEAD', label: 'Que dejen sus datos (Lead)' },
  { value: 'SCHEDULE', label: 'Que agenden (Schedule)' },
  { value: 'COMPLETE_REGISTRATION', label: 'Que se registren' },
  { value: 'CONTENT_VIEW', label: 'Que vean el contenido / VSL' },
  { value: 'CONTACT', label: 'Que te contacten' },
  { value: 'PURCHASE', label: 'Que compren' },
];
// Nombre del evento del pixel (como lo reporta Meta en /stats) → ENUM de optimización
// (custom_event_type) + etiqueta amigable (en objetivo, "Que…"). Solo mapeamos los
// estándar de conversión.
const STD_EVENTS: Record<string, { enum: string; label: string }> = {
  Lead: { enum: 'LEAD', label: 'Que dejen sus datos (Lead)' },
  Schedule: { enum: 'SCHEDULE', label: 'Que agenden (Schedule)' },
  CompleteRegistration: { enum: 'COMPLETE_REGISTRATION', label: 'Que se registren' },
  ViewContent: { enum: 'CONTENT_VIEW', label: 'Que vean el contenido / VSL' },
  Contact: { enum: 'CONTACT', label: 'Que te contacten' },
  Purchase: { enum: 'PURCHASE', label: 'Que compren' },
  Search: { enum: 'SEARCH', label: 'Que busquen' },
  AddToCart: { enum: 'ADD_TO_CART', label: 'Que agreguen al carrito' },
  InitiateCheckout: { enum: 'INITIATED_CHECKOUT', label: 'Que inicien el checkout' },
  AddPaymentInfo: { enum: 'ADD_PAYMENT_INFO', label: 'Que carguen datos de pago' },
  Subscribe: { enum: 'SUBSCRIBE', label: 'Que se suscriban' },
  StartTrial: { enum: 'START_TRIAL', label: 'Que inicien una prueba' },
  SubmitApplication: { enum: 'SUBMIT_APPLICATION', label: 'Que envíen una solicitud' },
  AddToWishlist: { enum: 'ADD_TO_WISHLIST', label: 'Que agreguen a deseos' },
};

export function NuevaCampanaModal({ senales, campaignCount, onClose, onPublished }: { senales: SenalRecon[]; campaignCount: number; onClose: () => void; onPublished: () => void }) {
  const [d0] = useState(loadDraft);
  const [step, setStep] = useState<Step>(d0.step);
  const [tray, setTray] = useState<TrayItem[]>(d0.tray);
  const [budgetUsd, setBudgetUsd] = useState<number | null>(d0.budgetUsd);
  const [objKey, setObjKey] = useState<ObjKey | null>(d0.objKey);
  const [estrategia, setEstrategia] = useState<Estrategia | null>(d0.estrategia);
  const obj = objKey ? OBJ_KEYS[objKey] : null;
  const [audiencias, setAudiencias] = useState<AudienceRef[]>(d0.audiencias);
  // Ubicaciones: null = automáticas (Advantage+, incluye IG/Threads); array = publisher_platforms manuales.
  const [placements, setPlacements] = useState<string[] | null>(d0.placements);
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
  const [audiencesAll, setAudiencesAll] = useState<AudienceItem[] | null>(null);
  const [leadForms, setLeadForms] = useState<Array<{ id: string; name: string }> | null>(null);
  const [convs, setConvs] = useState<Array<{ id: string; name: string; event?: string; pixel_id?: string }> | null>(null);
  const [pixels, setPixels] = useState<Array<{ id: string; name: string }> | null>(null);
  // Eventos ACTIVOS del pixel elegido (null = sin cargar). Elegir uno inactivo arruina la entrega.
  const [pixelEvents, setPixelEvents] = useState<string[] | null>(null);
  const [creandoPublico, setCreandoPublico] = useState(false);
  // cache:'no-store' clave: sin esto el navegador cachea la 1ra respuesta (vacía) y
  // los públicos nunca aparecen aunque existan en la cuenta.
  const cargarPublicos = () => { setAudiencesAll(null); return fetch('/api/ads-manager/targeting?kind=audiences', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.ok) setAudiencesAll(j.items); else { setAudiencesAll([]); setErr(`No pude traer tus públicos: ${j.error}`); } }).catch((e) => { setAudiencesAll([]); setErr(`No pude traer tus públicos: ${String(e)}`); }); };
  useEffect(() => { cargarPublicos(); }, []);
  useEffect(() => { if (objKey === 'lead_form' && leadForms === null) fetch('/api/ads-manager/targeting?kind=leadforms', { cache: 'no-store' }).then((r) => r.json()).then((j) => setLeadForms(j.ok ? j.items : [])).catch(() => setLeadForms([])); }, [objKey, leadForms]);
  useEffect(() => { if ((objKey === 'lead_web' || objKey === 'sales') && convs === null) fetch('/api/ads-manager/targeting?kind=conversions', { cache: 'no-store' }).then((r) => r.json()).then((j) => setConvs(j.ok ? j.items : [])).catch(() => setConvs([])); }, [objKey, convs]);
  useEffect(() => { if ((objKey === 'lead_web' || objKey === 'sales') && pixels === null) fetch('/api/ads-manager/targeting?kind=pixels', { cache: 'no-store' }).then((r) => r.json()).then((j) => setPixels(j.ok ? j.items : [])).catch(() => setPixels([])); }, [objKey, pixels]);
  // Si hay UN solo pixel, lo elegimos solos (el usuario igual lo ve, pero no tiene que tocar).
  useEffect(() => { if (obj?.needsConv && pixels && pixels.length === 1 && !destino.conv?.pixel_id) setDestino((d) => ({ ...d, conv: { ...d.conv, pixel_id: pixels[0].id } })); }, [obj?.needsConv, pixels, destino.conv?.pixel_id]);
  // Al elegir un pixel, traemos SUS eventos activos (los que Meta recibe de verdad).
  const pixelSel = destino.conv?.pixel_id ?? '';
  useEffect(() => {
    if (!obj?.needsConv || !pixelSel) { setPixelEvents(null); return; }
    setPixelEvents(null);
    let cancel = false;
    fetch(`/api/ads-manager/targeting?kind=pixelevents&pixel=${encodeURIComponent(pixelSel)}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => { if (!cancel) setPixelEvents(j.ok && Array.isArray(j.items) ? j.items : []); })
      .catch(() => { if (!cancel) setPixelEvents([]); });
    return () => { cancel = true; };
  }, [obj?.needsConv, pixelSel]);

  // guardar borrador
  useEffect(() => {
    try {
      if (step === 'listo') return;
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, tray, budgetUsd, objKey, estrategia, audiencias, placements, destino, analisis, spec, uso }));
    } catch { /* quota */ }
  }, [step, tray, budgetUsd, objKey, estrategia, audiencias, placements, destino, analisis, spec, uso]);

  const usables = () => tray.filter((t) => !t.processing && (t.image_hash || t.video_id || t.source_ad_id));

  // ── flujo / navegación ──
  const flow: Step[] = ['creativos', 'inversion', 'objetivo', 'estrategia', ...(estrategia === 'retargeting' ? ['publico' as Step] : []), 'ubicaciones', 'destino'];
  const idx = flow.indexOf(step);
  const puedeAvanzar = (): boolean => {
    switch (step) {
      case 'creativos': return usables().length > 0;
      case 'inversion': return !!budgetUsd && budgetUsd > 0;
      case 'objetivo': return !!objKey;
      case 'estrategia': return !!estrategia;
      case 'publico': return audiencias.length > 0;
      case 'ubicaciones': return placements === null || placements.length > 0;
      case 'destino':
        if (obj?.needsForm) return !!destino.lead_form_id;
        if (obj?.needsConv) return !!destino.url?.trim() && !!destino.conv?.pixel_id && !!(destino.conv?.pixel_event || destino.conv?.custom_conversion_id);
        return !!destino.url?.trim();
      default: return false;
    }
  };
  const avanzar = () => {
    if (!puedeAvanzar()) return;
    if (step === 'destino') return armar();
    const next = flow[idx + 1];
    if (next) setStep(next);
  };
  const retroceder = () => { if (step === 'revision') { setStep('destino'); return; } if (idx > 0) setStep(flow[idx - 1]); else onClose(); };

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
  async function crearPublico(tipo: AudTipo, dias: number, evento?: string) {
    setCreandoPublico(true); setErr(null);
    try {
      const r = await fetch('/api/ads-manager/audience-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, dias, evento }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo crear el público');
      const a = j.audience as AudienceRef;
      setAudiencesAll((prev) => [a, ...(prev ?? [])]);
      setAudiencias((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]));
    } catch (e) {
      let msg = e instanceof Error ? e.message : String(e);
      if (/terms of service|customaudiences\/app\/tos/i.test(msg)) {
        const url = (msg.match(/https?:\/\/\S+/) || [''])[0];
        msg = `Falta aceptar UNA vez los Términos de Públicos Personalizados de Meta (un clic; después funcionan todos): ${url}`;
      }
      setErr(msg);
    }
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
    const objLabel = OBJETIVO_UI.find((o) => o.value === objKey)?.label ?? objKey;
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
    const k = objKey ?? 'lead_form';
    const conf = OBJ_KEYS[k];
    const objective = conf.objective;
    const def = objetivoDef(objective);
    const copies = mako ? mako.adsets.flatMap((s) => s.ads).map((a) => a.creative) : [];
    const u = usables();
    const targeting: Targeting = estrategia === 'retargeting'
      ? { geo_locations: { countries: ['MX'] }, custom_audiences: audiencias.map((x) => ({ id: x.id, name: x.name })), advantage_audience: 0 }
      : estrategia === 'intereses'
        // Si MaKo encontró intereses → afinamos (adv 0). Si no encontró ninguno, NO
        // mandamos un público vacío con Advantage+ apagado (entrega peor): dejamos que
        // Meta optimice el amplio (adv 1).
        ? { geo_locations: { countries: ['MX'] }, advantage_audience: mako?.adsets?.[0]?.targeting?.flexible_spec?.some((g) => g.interests?.length) ? 0 : 1, flexible_spec: mako?.adsets?.[0]?.targeting?.flexible_spec }
        : { geo_locations: { countries: ['MX'] }, advantage_audience: 1 };
    // Ubicaciones: null = automáticas (Advantage+, todas). Array = manuales.
    if (placements && placements.length) targeting.publisher_platforms = placements;
    const ads: AdSpec[] = u.map((t, i) => {
      const cp = copies[i] ?? copies[0] ?? ({} as Creative);
      const creative: Creative = {
        source: t.kind === 'existing' ? 'existing' : 'upload',
        source_ad_id: t.kind === 'existing' ? t.source_ad_id ?? null : null,
        media_type: t.media_type, image_hash: t.image_hash ?? null, video_id: t.video_id ?? null, thumbnail_url: t.thumbnail_url ?? null,
        primary_text: cp.primary_text ?? '', headline: cp.headline ?? '', description: cp.description ?? '',
        cta_type: cp.cta_type ?? (conf.needsForm ? 'SIGN_UP' : 'LEARN_MORE'),
      };
      if (conf.needsForm) { creative.lead_form_id = destino.lead_form_id ?? null; creative.lead_form_name = destino.lead_form_name ?? null; }
      else creative.destination_url = destino.url ?? '';
      return { name: `Anuncio ${i + 1}`, creative };
    });
    const estrTag = estrategia === 'retargeting' ? 'Retargeting' : estrategia === 'intereses' ? 'Intereses' : 'Adquisición';
    const base: CampaignSpec = {
      name: mako?.name || `${estrTag} — ${OBJETIVO_UI.find((o) => o.value === k)?.label ?? ''}`.trim(),
      objective, special_ad_categories: [], budget_level: 'campaign', daily_budget_mxn: usdToMxn(budgetUsd ?? 0),
      adsets: [{ name: `${estrTag}`, daily_budget_mxn: null, optimization_goal: conf.optimization, billing_event: def.billing_event, bid_strategy: 'LOWEST_COST_WITHOUT_CAP', targeting, ads, conversion: conf.optimization === 'OFFSITE_CONVERSIONS' ? { pixel_event: destino.conv?.pixel_event, custom_conversion_id: destino.conv?.custom_conversion_id, pixel_id: destino.conv?.pixel_id } : undefined }],
      rationale: mako?.rationale ?? '',
    };
    // Nomenclatura SIEMPRE (001 / 001.01 / 001.01.a), sin botón.
    return aplicarNomenclatura(base, campaignCount + 1);
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
  if (objKey) resumen.push(OBJETIVO_UI.find((o) => o.value === objKey)?.label ?? '');
  if (estrategia) resumen.push(ESTRATEGIAS.find((e) => e.value === estrategia)?.label ?? '');
  if (placements && placements.length) resumen.push(`Ubicaciones: ${placements.length}`);

  const enWizard = step === 'creativos' || step === 'inversion' || step === 'objetivo' || step === 'estrategia' || step === 'publico' || step === 'ubicaciones' || step === 'destino';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 18px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: step === 'revision' ? 640 : 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 30px 80px rgba(18,21,27,.4)', overflow: 'hidden' }}>
        {/* barra superior minimalista: marca + progreso + cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>
            <MakoStar size={12} /> <MakoWord base="var(--accent)">MaKo</MakoWord>
          </div>
          {enWizard && (
            <div style={{ display: 'flex', gap: 6, margin: '0 auto' }}>
              {flow.map((s, i) => <span key={s} style={{ width: i === idx ? 22 : 7, height: 7, borderRadius: 999, background: i <= idx ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />)}
            </div>
          )}
          <button aria-label="Cerrar" onClick={onClose} style={{ marginLeft: enWizard ? 0 : 'auto', width: 32, height: 32, flex: 'none', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer' }}>✕</button>
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
              <Opciones items={OBJETIVO_UI} value={objKey} onPick={(v) => { setObjKey(v as ObjKey); setDestino({}); setStep(flow[flow.indexOf('objetivo') + 1]); }} />
            </Paso>
          )}

          {step === 'estrategia' && (
            <Paso titulo="¿Qué querés hacer con estos creativos?" sub={analisisResumen(analisis)}>
              <Opciones items={ESTRATEGIAS} value={estrategia} onPick={(v) => { setEstrategia(v as Estrategia); const f: Step[] = ['creativos', 'inversion', 'objetivo', 'estrategia', ...((v as Estrategia) === 'retargeting' ? ['publico' as Step] : []), 'ubicaciones', 'destino']; setStep(f[f.indexOf('estrategia') + 1]); }} />
            </Paso>
          )}

          {step === 'publico' && (
            <Paso titulo="¿A qué público lo mostramos?" sub="Tus públicos personalizados (video viewers, visitantes, leads abiertos…). MaKo no los inventa.">
              <PublicoPicker audiencesAll={audiencesAll} audiencias={audiencias} setAudiencias={setAudiencias} onCrear={crearPublico} creando={creandoPublico} onRefresh={cargarPublicos} />
            </Paso>
          )}

          {step === 'ubicaciones' && (
            <Paso titulo="¿Dónde se muestra?" sub="Las automáticas (Advantage+) reparten en Facebook, Instagram y Threads donde mejor rinde. Es lo recomendado.">
              <UbicacionesPicker placements={placements} setPlacements={setPlacements} />
            </Paso>
          )}

          {step === 'destino' && (
            <Paso titulo={obj?.needsForm ? '¿Qué formulario instantáneo usás?' : obj?.needsConv ? '¿Dónde captás la conversión?' : '¿A qué página llevamos a la gente?'}
              sub={obj?.needsForm ? 'Elegí un formulario que ya tengas en la página.' : obj?.needsConv ? 'Tu landing/VSL + por qué conversión del pixel optimizamos (tu agenda, lead, registro…).' : 'La URL de tu VSL o landing.'}>
              {obj?.needsForm ? (
                <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                  <Dropdown value={destino.lead_form_id ?? ''} placeholder={leadForms === null ? 'Cargando formularios…' : leadForms.length ? 'Elegí un formulario…' : 'No tenés formularios instantáneos'}
                    options={(leadForms ?? []).map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => setDestino((d) => ({ ...d, lead_form_id: v, lead_form_name: leadForms?.find((f) => f.id === v)?.name ?? null }))} width="100%" />
                  {leadForms !== null && leadForms.length === 0 && (
                    <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>No hay formularios instantáneos en la página. Tocá <b>← Atrás</b> y elegí <b>“Leads / agendas en tu web”</b> para captar el lead en tu landing.</p>
                  )}
                </div>
              ) : (
                <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                  <input value={destino.url ?? ''} onChange={(e) => setDestino((d) => ({ ...d, url: e.target.value }))} placeholder="https://tu-landing/vsl" autoFocus
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 13, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 16, outline: 'none', textAlign: 'center' }} />
                  {obj?.needsConv && (
                    <ConversionPicker pixels={pixels} convs={convs} pixelEvents={pixelEvents} destino={destino} setDestino={setDestino} />
                  )}
                </div>
              )}
            </Paso>
          )}

          {step === 'armando' && (
            <MakoLoading pasos={['Mirando tus creativos…', 'Entendiendo tu objetivo y estrategia…', 'Escribiendo el copy de cada anuncio…', 'Armando la estructura de la campaña…']} />
          )}

          {step === 'revision' && spec && (
            <Revision spec={spec} budgetUsd={budgetUsd} tray={tray} setSpec={setSpec} />
          )}

          {step === 'publicando' && (
            <MakoLoading pasos={['Creando la campaña…', 'Configurando el conjunto de anuncios…', obj?.needsConv ? 'Conectando el pixel y la conversión…' : estrategia === 'retargeting' ? 'Cargando tu público…' : 'Configurando el público…', 'Subiendo los anuncios y aplicando UTMs…', 'Publicando en Meta, en pausa…']} />
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
            {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', textAlign: 'center', padding: '8px 20px 0', lineHeight: 1.5 }}>{linkify(err)}</div>}
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
            style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' }}
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
        {[20, 50, 100, 200].map((v) => <button key={v} type="button" onClick={() => onChange(v)} style={{ padding: '8px 16px', borderRadius: 999, border: `1px solid ${value === v ? 'var(--primary)' : 'var(--border-strong)'}`, background: value === v ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: value === v ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>${v}</button>)}
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
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(18,21,27,.62)', padding: '4px 5px 5px' }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(243,245,248,.25)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${t.progress ?? 0}%`, background: 'var(--primary)', transition: 'width .2s' }} /></div>
                  <div style={{ fontSize: 8.5, color: '#F3F5F8', fontFamily: MONO, textAlign: 'center', marginTop: 2 }}>{(t.progress ?? 0) < 100 ? `${t.progress ?? 0}%` : 'Procesando'}</div>
                </div>
              )}
              {t.kind === 'existing' && <span style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '0 4px' }}>★</span>}
              <button type="button" aria-label="Quitar" onClick={() => onQuitar(t.id)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 6, border: 'none', background: 'rgba(18,21,27,.7)', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>✕</button>
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
                  <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, fontFamily: MONO, background: 'rgba(18,21,27,.7)', color: '#fff', padding: '1px 2px' }}>{s.leads}L</span>
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
const EVENTOS_PIXEL = [
  { value: 'PageView', label: 'Visitó la página' },
  { value: 'ViewContent', label: 'Vio el contenido / VSL' },
  { value: 'Lead', label: 'Dejó sus datos (Lead)' },
  { value: 'CompleteRegistration', label: 'Se registró' },
  { value: 'Schedule', label: 'Agendó' },
  { value: 'InitiateCheckout', label: 'Inició checkout' },
  { value: 'Purchase', label: 'Compró' },
  { value: '__custom__', label: 'Otro evento (escribir)…' },
];

function PublicoPicker({ audiencesAll, audiencias, setAudiencias, onCrear, creando, onRefresh }: { audiencesAll: AudienceItem[] | null; audiencias: AudienceRef[]; setAudiencias: (a: AudienceRef[]) => void; onCrear: (tipo: AudTipo, dias: number, evento?: string) => void; creando: boolean; onRefresh: () => void }) {
  const [dias, setDias] = useState(180);
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [evento, setEvento] = useState('PageView');
  const [eventoCustom, setEventoCustom] = useState('');
  const countById = new Map((audiencesAll ?? []).map((a) => [a.id, a.count ?? null] as const));
  const fmtC = (c: number | null | undefined) => (c == null ? '' : ` · ~${c.toLocaleString('es-MX')}`);
  const opts = (audiencesAll ?? []).filter((a) => !audiencias.some((x) => x.id === a.id)).map((a) => ({ value: a.id, label: `${a.name ?? a.id}${fmtC(a.count)}` }));
  const chipDia = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 12, cursor: 'pointer' });
  const TIPO_OPCIONES = [
    { value: 'page', label: 'Interactuaron con tu Facebook (anuncios, posts, videos)' },
    { value: 'video', label: 'Vieron tus videos / anuncios en video' },
    { value: 'ig', label: 'Interactuaron con tu Instagram' },
    { value: 'pixel', label: 'Visitaron tu web / landing' },
  ];
  // Advertencia de tamaño: retargeting con público chico no entrega bien.
  const counts = audiencias.map((a) => countById.get(a.id)).filter((c): c is number => typeof c === 'number');
  const maxCount = counts.length ? Math.max(...counts) : null;
  const chico = audiencias.length > 0 && counts.length === audiencias.length && maxCount != null && maxCount < 1000;
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', width: '100%' }}>
        <Dropdown value="" placeholder={audiencesAll === null ? 'Cargando públicos…' : audiencesAll.length ? 'Elegí un público (podés sumar varios)…' : 'No tenés públicos todavía'} resetAfterSelect
          options={opts} onChange={(v) => { const a = (audiencesAll ?? []).find((x) => x.id === v); if (a) setAudiencias([...audiencias, { id: a.id, name: a.name }]); }} width="100%" />
        <button type="button" onClick={onRefresh} title="Recargar públicos" style={{ ...btnGhost, padding: '0 13px', flex: 'none' }}>↻</button>
      </div>
      {audiencias.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {audiencias.map((a) => { const c = countById.get(a.id); return <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)' }}>{a.name ?? a.id}{c != null ? <span style={{ color: 'var(--faint)', fontFamily: MONO, fontSize: 11 }}>~{c.toLocaleString('es-MX')}</span> : null}<button type="button" onClick={() => setAudiencias(audiencias.filter((x) => x.id !== a.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--faint)', fontSize: 13, padding: 0 }}>✕</button></span>; })}
        </div>
      )}
      {chico && <div style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', lineHeight: 1.45 }}>⚠ Público chico (~{maxCount?.toLocaleString('es-MX')} personas). Por debajo de ~1.000 Meta puede no entregar bien: sumá otro público o ampliá la ventana de días.</div>}
      {audiencias.length > 1 && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>Se combinan (cualquiera de los {audiencias.length}).</span>}

      {/* crear público sin entrar a Meta — desplegable + ventana + crear */}
      <div style={{ width: '100%', borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <p style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', margin: 0 }}>¿No está el que querés? Creá uno acá, sin entrar a Meta. Podés crear varios y se combinan.</p>
        <Dropdown value={nuevoTipo} placeholder="¿Qué público querés crear?" options={TIPO_OPCIONES} onChange={setNuevoTipo} width="100%" />
        {nuevoTipo === 'pixel' && (
          <>
            <Dropdown value={evento} options={EVENTOS_PIXEL} onChange={setEvento} width="100%" />
            {evento === '__custom__' && <input value={eventoCustom} onChange={(e) => setEventoCustom(e.target.value)} placeholder="Nombre EXACTO del evento del pixel (ej. AgendoLlamada)" style={{ width: '100%', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, outline: 'none' }} />}
          </>
        )}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[30, 90, 180, 365].map((dd) => <button key={dd} type="button" onClick={() => setDias(dd)} style={chipDia(dias === dd)}>{dd} días</button>)}
        </div>
        <button type="button" disabled={creando || !nuevoTipo || (nuevoTipo === 'pixel' && evento === '__custom__' && !eventoCustom.trim())}
          onClick={() => onCrear(nuevoTipo as AudTipo, dias, nuevoTipo === 'pixel' ? (evento === '__custom__' ? eventoCustom.trim() : evento) : undefined)}
          style={{ ...btnDark, fontSize: 13.5, padding: '10px 18px', opacity: creando || !nuevoTipo ? 0.4 : 1, cursor: creando || !nuevoTipo ? 'not-allowed' : 'pointer' }}>
          {creando ? 'Creando en Meta…' : '+ Crear público'}
        </button>
      </div>
    </div>
  );
}

// ── ubicaciones (placements): automáticas (Advantage+, incluye IG/Threads) o manuales ──
const PLACEMENT_OPCIONES = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'audience_network', label: 'Audience Network' },
  { value: 'messenger', label: 'Messenger' },
];
function UbicacionesPicker({ placements, setPlacements }: { placements: string[] | null; setPlacements: (p: string[] | null) => void }) {
  const auto = placements === null;
  const sel = placements ?? [];
  const toggle = (v: string) => setPlacements(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  const card = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '15px 17px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', cursor: 'pointer', transition: 'border-color .15s' });
  const chip = (on: boolean): CSSProperties => ({ padding: '7px 14px', borderRadius: 999, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'rgba(47,111,237,.10)' : 'var(--surface)', color: on ? 'var(--primary-strong)' : 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' });
  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={() => setPlacements(null)} style={card(auto)}>
          <span style={{ fontSize: 24, flex: 'none' }}>✨</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Automáticas (Advantage+)</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 1 }}>Meta reparte donde mejor rinde: Facebook, Instagram, <b>Threads</b>, Reels, Stories… Recomendado.</span>
          </span>
        </button>
        <button type="button" onClick={() => setPlacements(sel.length ? sel : ['facebook', 'instagram'])} style={card(!auto)}>
          <span style={{ fontSize: 24, flex: 'none' }}>🎛️</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Elegir manualmente</span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', marginTop: 1 }}>Vos decidís en qué plataformas se muestra.</span>
          </span>
        </button>
      </div>
      {!auto && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PLACEMENT_OPCIONES.map((p) => { const on = sel.includes(p.value); return <button key={p.value} type="button" onClick={() => toggle(p.value)} style={chip(on)}>{on ? '✓ ' : ''}{p.label}</button>; })}
          </div>
          {sel.length === 0 && <span style={{ fontSize: 12, color: 'var(--warn)' }}>Elegí al menos una plataforma.</span>}
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.5 }}>Threads viaja con la identidad de Instagram: para incluirlo, conviene dejar <b>Automáticas</b>.</span>
        </>
      )}
    </div>
  );
}

// ── revisión minimalista — los textos se editan EN LÍNEA (tocás y escribís) ──
function Revision({ spec, budgetUsd, tray, setSpec }: { spec: CampaignSpec; budgetUsd: number | null; tray: TrayItem[]; setSpec: (s: CampaignSpec) => void }) {
  const opt = spec.adsets[0]?.optimization_goal;
  const objLabel = opt === 'LEAD_GENERATION' ? 'Leads (formulario FB)' : opt === 'OFFSITE_CONVERSIONS' ? 'Leads / ventas en tu web' : opt === 'LANDING_PAGE_VIEWS' ? 'Tráfico a la landing' : opt === 'REACH' ? 'Reconocimiento' : spec.objective;
  const patchCreative = (ai: number, di: number, patch: Partial<Creative>) => setSpec({ ...spec, adsets: spec.adsets.map((a, i) => (i === ai ? { ...a, ads: a.ads.map((ad, j) => (j === di ? { ...ad, creative: { ...ad.creative, ...patch } } : ad)) } : a)) });
  const [verPorque, setVerPorque] = useState(false);
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
      {spec.rationale && (
        <div style={{ textAlign: 'center' }}>
          <button type="button" onClick={() => setVerPorque((v) => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.05em', padding: 2 }}>
            {verPorque ? '▴ Ocultar' : '▾ ¿Por qué MaKo lo armó así?'}
          </button>
          {verPorque && <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, margin: '6px 0 0', textAlign: 'center' }}>{spec.rationale}</p>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spec.adsets.map((adset, ai) => adset.ads.map((ad, di) => {
          const key = `${ai}-${di}`;
          const t = ad.creative.source === 'existing' ? tray.find((x) => x.source_ad_id === ad.creative.source_ad_id) : tray.find((x) => (ad.creative.image_hash && x.image_hash === ad.creative.image_hash) || (ad.creative.video_id && x.video_id === ad.creative.video_id));
          const thumb = t?.thumbnail_url ?? ad.creative.thumbnail_url ?? null;
          return (
            <div key={key} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ width: 64, flex: 'none', aspectRatio: '9 / 16', maxHeight: 110, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border-strong)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 18 }}>{ad.creative.media_type === 'video' ? '🎬' : '🖼️'}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <InlineCopy value={ad.creative.primary_text ?? ''} onChange={(v) => patchCreative(ai, di, { primary_text: v })} placeholder="Escribí el texto del anuncio…" multiline fontSize={13.5} />
                <InlineCopy value={ad.creative.headline ?? ''} onChange={(v) => patchCreative(ai, di, { headline: v })} placeholder="Título (opcional)" fontSize={12.5} bold />
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', marginTop: 4, padding: '0 7px' }}>▸ {CTA_OPCIONES.find((o) => o.value === (ad.creative.cta_type ?? 'LEARN_MORE'))?.label}{ad.creative.destination_url ? ` · ${ad.creative.destination_url}` : ad.creative.lead_form_name ? ` · ${ad.creative.lead_form_name}` : ''}</div>
              </div>
            </div>
          );
        }))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>Tocá cualquier texto para editarlo. Se crea en <b>pausa</b>: la activás cuando quieras.</p>
    </div>
  );
}

// Texto editable en línea: parece texto, al tocarlo se vuelve editable (sin "modo edición").
function InlineCopy({ value, onChange, placeholder, multiline, fontSize, bold }: { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; fontSize: number; bold?: boolean }) {
  const base: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid transparent', borderRadius: 8, background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize, fontWeight: bold ? 600 : 400, lineHeight: 1.45, padding: '5px 7px', outline: 'none', transition: 'border-color .12s, background .12s' };
  const onFocus = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)'; };
  const onBlur = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; };
  if (multiline) {
    return <textarea value={value} placeholder={placeholder} rows={1} onFocus={onFocus} onBlur={onBlur}
      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
      onChange={(e) => { onChange(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
      style={{ ...base, resize: 'none', overflow: 'hidden' }} />;
  }
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} style={base} />;
}

// ── helpers ──
// Convierte URLs del texto de error en un link clickable (ej. la ToS de Públicos).
function linkify(text: string): ReactNode {
  return text.split(/(https?:\/\/\S+)/g).map((p, i) => /^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>abrir en Meta ↗</a>
    : p);
}

// Etiqueta amigable a partir del ENUM de optimización (custom_event_type).
function labelDeEnum(enumValue: string): string | undefined {
  const std = Object.values(STD_EVENTS).find((s) => s.enum === enumValue);
  return std?.label ?? EVENTOS_CONV.find((e) => e.value === enumValue)?.label;
}

// ── conversión: PRIMERO el pixel, DESPUÉS el evento (solo los ACTIVOS de ese pixel) ──
// Optimizar por un evento inactivo arruina la entrega → solo ofrecemos los que el
// pixel recibe de verdad (+ tus conversiones personalizadas, que ya son activas).
function ConversionPicker({ pixels, convs, pixelEvents, destino, setDestino }: {
  pixels: Array<{ id: string; name: string }> | null;
  convs: Array<{ id: string; name: string; event?: string; pixel_id?: string }> | null;
  pixelEvents: string[] | null;
  destino: Destino;
  setDestino: Dispatch<SetStateAction<Destino>>;
}) {
  const pixelId = destino.conv?.pixel_id ?? '';
  const setPixel = (v: string) => setDestino((d) => ({ ...d, conv: { pixel_id: v } })); // cambiar de pixel resetea el evento
  const setEvento = (v: string) => setDestino((d) => {
    if (v.startsWith('cc:')) { const id = v.slice(3); const c = (convs ?? []).find((x) => x.id === id); return { ...d, conv: { pixel_id: d.conv?.pixel_id, custom_conversion_id: id, label: c?.name } }; }
    return { ...d, conv: { pixel_id: d.conv?.pixel_id, pixel_event: v, label: labelDeEnum(v) } };
  });
  const detectados = !!pixelEvents && pixelEvents.length > 0;
  // ENUMs de Meta que el pixel recibió de verdad (mapeados desde el nombre del evento).
  const activosSet = new Set((pixelEvents ?? []).map((n) => STD_EVENTS[n]?.enum).filter((e): e is string => !!e));
  // Solo las conversiones del pixel elegido (si no, se mezclan las de todos). Fail-open:
  // si a alguna no le pudimos resolver el pixel, la dejamos para no perder una válida.
  const custom = (convs ?? []).filter((c) => !c.pixel_id || c.pixel_id === pixelId).map((c) => ({ value: `cc:${c.id}`, label: `Tu conversión: ${c.name}`, sub: 'Conversión que ya medís' }));
  // Con detección: mostramos TODOS los eventos estándar como Meta (Active vs Inactive).
  // Activos arriba y habilitados; inactivos abajo, en gris y DESHABILITADOS (Dropdown
  // ya soporta `disabled`), para que el usuario VEA por qué no son opción y no elija
  // uno muerto. Sin detección: todos seleccionables con la advertencia.
  let eventOpts: Array<{ value: string; label: string; sub?: string; disabled?: boolean }>;
  if (detectados) {
    const activos = EVENTOS_CONV.filter((e) => activosSet.has(e.value)).map((e) => ({ value: e.value, label: e.label, sub: '✓ Activo en tu pixel' }));
    const inactivos = EVENTOS_CONV.filter((e) => !activosSet.has(e.value)).map((e) => ({ value: e.value, label: e.label, sub: 'Inactivo — sin datos en 30 días', disabled: true }));
    eventOpts = [...activos, ...custom, ...inactivos];
  } else {
    eventOpts = [...EVENTOS_CONV.map((e) => ({ value: e.value, label: e.label, sub: 'Verificá que esté activo' })), ...custom];
  }
  const eventValue = destino.conv?.custom_conversion_id ? `cc:${destino.conv.custom_conversion_id}` : (destino.conv?.pixel_event ?? '');
  const sinPixeles = pixels !== null && pixels.length === 0;
  const nota = !pixelId
    ? <>Primero elegí el <b>pixel</b>; después te muestro <b>sus</b> eventos.</>
    : pixelEvents === null
      ? <>Buscando los eventos <b>activos</b> de tu pixel…</>
      : detectados
        ? <>Los <b>activos</b> (✓) son los que tu pixel recibió en los últimos 30 días. Los <b>inactivos</b> van en gris y no se pueden elegir: Meta no podría optimizar por ellos.</>
        : <>No pudimos detectar los eventos activos. Elegí tu <b>conversión</b> (las que ya medís) o un evento estándar que sepas <b>activo</b> en tu pixel.</>;
  return (
    <>
      <Dropdown value={pixelId}
        placeholder={pixels === null ? 'Cargando tu pixel…' : sinPixeles ? 'No hay pixel en la cuenta' : 'Elegí tu pixel (dataset)…'}
        options={(pixels ?? []).map((p) => ({ value: p.id, label: p.name }))} onChange={setPixel} width="100%" />
      {pixelId && (
        <Dropdown value={eventValue} disabled={pixelEvents === null}
          placeholder={pixelEvents === null ? 'Buscando eventos activos…' : 'Elegí la conversión a optimizar…'}
          options={eventOpts} onChange={setEvento} width="100%" />
      )}
      <p style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>{nota}</p>
    </>
  );
}

// ── loader de MaKo con pasos que cambian (armando / publicando) ──
function MakoLoading({ pasos }: { pasos: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (pasos.length <= 1) return; const id = setInterval(() => setI((p) => (p + 1 < pasos.length ? p + 1 : p)), 1700); return () => clearInterval(id); }, [pasos.length]);
  const uid = `mkld${useId().replace(/[:]/g, '')}`;
  const cur = Math.min(i, pasos.length - 1);
  const css = `
    .${uid}-spark { transform-box: fill-box; transform-origin: center; animation: ${uid}-pulse 1.5s ease-in-out infinite; }
    @keyframes ${uid}-pulse { 0%,100% { transform: scale(.9); opacity: .85; } 50% { transform: scale(1.12); opacity: 1; } }
    .${uid}-ring { transform-box: fill-box; transform-origin: center; opacity: 0; animation: ${uid}-sonar 1.8s ease-out infinite; }
    .${uid}-ring2 { animation-delay: .9s; }
    @keyframes ${uid}-sonar { 0% { transform: scale(.5); opacity: .5; } 100% { transform: scale(2.3); opacity: 0; } }
    .${uid}-txt { animation: ${uid}-tin .4s ease; }
    @keyframes ${uid}-tin { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  `;
  return (
    <div style={{ padding: '60px 30px 66px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <svg width={66} height={66} viewBox="-33 -33 66 66" role="img" aria-label="MaKo trabajando">
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F6D365" /><stop offset="100%" stopColor="#EF9F27" /></linearGradient>
        </defs>
        <circle className={`${uid}-ring`} r="13" fill="none" stroke="#EF9F27" strokeWidth="1.5" strokeOpacity=".5" />
        <circle className={`${uid}-ring ${uid}-ring2`} r="13" fill="none" stroke="#F6D365" strokeWidth="1.5" strokeOpacity=".45" />
        <g transform="scale(1.5)"><path className={`${uid}-spark`} d={SPARK} fill={`url(#${uid}-g)`} /></g>
      </svg>
      <h3 key={cur} className={`${uid}-txt`} style={{ ...pregunta, fontSize: 21, minHeight: 26 }}>{pasos[cur]}</h3>
      <div style={{ display: 'flex', gap: 6 }}>
        {pasos.map((_, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: 999, background: k <= cur ? 'var(--primary)' : 'var(--border-strong)', transition: 'background .3s' }} />)}
      </div>
    </div>
  );
}

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
