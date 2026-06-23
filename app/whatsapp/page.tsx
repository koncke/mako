'use client';

// =============================================================================
// WhatsApp — Inbox real (Chatwoot, agrupado por contacto) + Secuencias
// =============================================================================
//  - Conversaciones: un hilo por persona (junta las conversaciones que Chatwoot
//    haya creado para ese contacto), con todos los mensajes incl. respuestas.
//    Responder = texto libre (solo entra dentro de la ventana de 24h del lead).
//    Cada contacto muestra su etapa del funnel; se puede filtrar por etapa.
//  - Secuencias: las 13 etapas reales de nutricion_secuencias (activar/pausar).
//    El cuerpo de cada paso es una plantilla aprobada de Meta (solo lectura).
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Dropdown } from '../components/Dropdown';
import { EmojiPicker } from './EmojiPicker';

// Modal de detalle/edición del lead — el MISMO del CRM (LeadDetail vía wrapper).
// Se carga on-demand (ssr:false) igual que en app/_components/Desglose.tsx.
const LeadEditModal = dynamic(() => import('../leads/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface Contacto {
  id: string;                 // clave de grupo (por teléfono) — junta duplicados
  convIds: number[];          // todas las conversaciones de esa persona
  sendContactId: number;      // contacto al que se le manda (el de la conv más reciente)
  contacto: string;
  telefono: string | null;
  avatar: string | null;      // foto de perfil del contacto (Chatwoot)
  ultimoMensaje: string | null;
  ultimaActividad: number;
  sinLeer: number;
  ventanaAbierta: boolean;
  leadId: number | null;
  empresa: string | null;
  estadoLead: string | null;
  etapaKey: string | null;
  etapaLabel: string | null;
}

interface Adjunto {
  tipo: string;
  url: string;
}

interface Mensaje {
  id: number;
  texto: string | null;
  saliente: boolean;
  fecha: number | null;
  template: string | null;
  status: string | null;
  error: string | null;
  adjuntos?: Adjunto[];
}

interface Template {
  name: string;
  category: string;
  language: string;
  params: string[];
  body: string;
}

interface Paso {
  orden: number;
  canal: string;
  delay_horas: number;
  asunto: string | null;
  cuerpo: string;
  template_wa: string | null;
  template_categoria?: string;
  template_idioma?: string;
  template_param?: string;
}

interface Secuencia {
  id: number;
  clave: string;
  nombre: string;
  etapa: string;
  trigger_tipo: string;
  activa: boolean;
  pasos: Paso[];
  inscriptos: number;
  enviados: number;
}

type View = 'chats' | 'sequences';

const QUICK = ['Reagendar tu Diagnóstico', 'Te paso el link de pago', 'Te comparto el video de nuevo'];

const ETAPA_COLOR: Record<string, string> = {
  cliente: '#1D9E75', 'por-cobrar': '#C7417B', 'no-show': '#B5630A', j2: '#4F5BD5',
  'post-j1': '#6A4BD8', agendo: '#9D4EDD', 'vio-vsl': '#185FA5', form: '#888780', abierto: '#888780',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}

function fmtTime(unixSec: number | null): string {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString()
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
}

function fmtDelay(horas: number): string {
  if (horas < 1) return 'inmediato';
  if (horas < 24) return `${Math.round(horas)} h`;
  return `día ${Math.round(horas / 24)}`;
}


const avatarStyle: CSSProperties = {
  width: '40px', height: '40px', flex: 'none', borderRadius: '50%',
  background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border-strong)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px',
};

// Foto de perfil del contacto (Chatwoot) con fallback a iniciales si no hay
// URL o si la imagen no carga.
function Avatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} onError={() => setFailed(true)} style={{ ...avatarStyle, objectFit: 'cover' }} />
    );
  }
  return <div style={avatarStyle}>{initials(name)}</div>;
}

// Tildes de estado tipo WhatsApp: ✓ enviado (gris), ✓✓ entregado (gris),
// ✓✓ leído (azul), ! falló (rojo, con el motivo en el tooltip).
function Ticks({ status, error }: { status: string | null; error: string | null }) {
  if (status === 'failed') {
    return <span title={error ?? 'No se entregó'} style={{ color: 'var(--bad)', fontWeight: 700, fontSize: '11.5px', lineHeight: 1 }}>!</span>;
  }
  if (status === 'sending' || status === 'progress' || status === 'pending') {
    return <span title="Pendiente" style={{ color: 'var(--faint)', fontSize: '11px', lineHeight: 1 }}>🕓</span>;
  }
  const color = status === 'read' ? '#53bdeb' : 'var(--faint)';
  const props = { stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (status === 'delivered' || status === 'read') {
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" aria-label={status === 'read' ? 'leído' : 'entregado'} style={{ flex: 'none' }}>
        <path d="M1 6 L4 9 L9.5 2.5" {...props} />
        <path d="M5.5 6 L8.5 9 L14 2.5" {...props} />
      </svg>
    );
  }
  // 'sent', null o desconocido → un solo tick (nunca afirmamos "entregado" de más).
  return <svg width="13" height="11" viewBox="0 0 13 11" aria-label="enviado" style={{ flex: 'none' }}><path d="M2 6 L5 9 L11 2.5" {...props} /></svg>;
}

const btnSeqBase: CSSProperties = {
  flex: 'none', padding: '9px 14px', borderRadius: '10px', cursor: 'pointer',
  fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600,
};
const btnGhost: CSSProperties = { ...btnSeqBase, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)' };
const btnPrimary: CSSProperties = { ...btnSeqBase, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)' };
const iconBtn: CSSProperties = {
  width: '28px', height: '28px', flex: 'none', borderRadius: '8px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
};
const numInput: CSSProperties = {
  width: '78px', padding: '7px 10px', borderRadius: '9px', border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", fontSize: '13px',
};

// Botón redondo del compositor (emoji / adjuntar), estilo WhatsApp.
const iconComposer: CSSProperties = {
  flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none',
  background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', fontSize: '20px', lineHeight: 1,
};
// Animación de la onda de grabación + parpadeo del punto rojo.
const WAVE_CSS = '@keyframes mako-wave{0%{transform:scaleY(.28)}100%{transform:scaleY(1)}}@keyframes mako-blink{0%,49%{opacity:1}50%,100%{opacity:.25}}';
// Íconos de línea estilo WhatsApp (heredan color por currentColor).
function SendArrow() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 L21 12 L3 3.5 L3 10 L15 12 L3 14 Z" fill="currentColor" /></svg>;
}
const strokeProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function IconSmiley() {
  return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" {...strokeProps} /><path d="M8.5 14.5a4.2 4.2 0 0 0 7 0" {...strokeProps} /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /></svg>;
}
function IconClip() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5l-8.6 8.6a4.6 4.6 0 0 1-6.5-6.5l8.7-8.7a3.1 3.1 0 0 1 4.3 4.3l-8.7 8.7a1.55 1.55 0 0 1-2.2-2.2l7.9-7.9" {...strokeProps} /></svg>;
}
function IconMic() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" {...strokeProps} /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" {...strokeProps} /><path d="M12 17.5V21" {...strokeProps} /></svg>;
}
function IconTrash() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6h17M8 6V4h8v2M6.5 6l1 14h9l1-14M10 10.5v6M14 10.5v6" {...strokeProps} /></svg>;
}
function IconPause() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>;
}
function IconPlay() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor" /></svg>;
}

// Beep de notificación reutilizando un único AudioContext (no acumula contextos;
// el navegador limita ~6). Se reanuda si quedó suspendido por la política de autoplay.
let _audioCtx: AudioContext | null = null;
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch { /* sin audio */ }
}

function etapaChip(key: string | null, label: string | null): { style: CSSProperties; dot: CSSProperties; label: string } | null {
  if (!key || !label) return null;
  const color = ETAPA_COLOR[key] ?? '#888780';
  return {
    label,
    dot: { width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: color },
    style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px', background: 'var(--surface-2)', color: 'var(--dim)', border: '1px solid var(--border)', whiteSpace: 'nowrap' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [view, setView] = useState<View>('chats');

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todas');
  const [soloVentana, setSoloVentana] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const totalSinLeerRef = useRef<number | null>(null);
  const selIdRef = useRef<string | null>(null);
  const msgScrollRef = useRef<HTMLDivElement | null>(null);
  const stickBottomRef = useRef(true);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try { const raw = localStorage.getItem('mako-wa-drafts'); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [adjuntos, setAdjuntos] = useState<Record<string, File | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selTpl, setSelTpl] = useState<string>('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Grabación de nota de voz
  const [recording, setRecording] = useState(false);
  const [recPaused, setRecPaused] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recCancelRef = useRef(false);

  const [secuencias, setSecuencias] = useState<Secuencia[]>([]);
  const [loadingSeqs, setLoadingSeqs] = useState(true);
  const [selSeqId, setSelSeqId] = useState<number | null>(null);
  const [editPasos, setEditPasos] = useState<Paso[] | null>(null);
  const [savingSeq, setSavingSeq] = useState(false);
  const [seqError, setSeqError] = useState<string | null>(null);

  const [detalleLeadId, setDetalleLeadId] = useState<number | null>(null);

  // Borrador y adjunto POR conversación: cambiar de chat conserva lo que no se
  // envió (y un adjunto queda atado a SU chat, nunca se manda al equivocado).
  const draft = selId ? (drafts[selId] ?? '') : '';
  const adjunto = selId ? (adjuntos[selId] ?? null) : null;
  const setDraft = (v: string) => { if (selId) setDrafts((d) => ({ ...d, [selId]: v })); };
  const appendDraft = (s: string) => { if (selId) setDrafts((d) => ({ ...d, [selId]: (d[selId] ?? '') + s })); };
  const setAdjunto = (f: File | null) => { if (selId) setAdjuntos((a) => ({ ...a, [selId]: f })); };

  // ── Carga inicial ──
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/conversations');
        const j = await r.json();
        const list: Contacto[] = j.ok ? j.contactos : [];
        setContactos(list);
        totalSinLeerRef.current = list.reduce((s, c) => s + c.sinLeer, 0);
        if (list[0]) setSelId(list[0].id);
      } finally {
        setLoadingConvs(false);
      }
    })();
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/secuencias');
        const j = await r.json();
        const list: Secuencia[] = j.ok ? j.secuencias : [];
        setSecuencias(list);
        if (list[0]) setSelSeqId(list[0].id);
      } finally {
        setLoadingSeqs(false);
      }
    })();
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/templates');
        const j = await r.json();
        setTemplates(j.ok ? j.templates : []);
      } catch {
        /* sin templates */
      }
    })();
  }, []);

  // ── Al cambiar de secuencia, descartar edición en curso ──
  useEffect(() => {
    setEditPasos(null);
    setSeqError(null);
  }, [selSeqId]);


  // ── Preview local del adjunto de imagen (revoca el object URL al cambiar) ──
  const adjuntoPreview = useMemo(
    () => (adjunto && adjunto.type.startsWith('image/') ? URL.createObjectURL(adjunto) : null),
    [adjunto],
  );
  useEffect(() => () => { if (adjuntoPreview) URL.revokeObjectURL(adjuntoPreview); }, [adjuntoPreview]);

  // Al desmontar: cortar timer + micrófono si quedó algo grabando.
  useEffect(() => () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    try { mediaRecRef.current?.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
  }, []);

  // Persistir borradores por chat → sobreviven a navegar / recargar.
  useEffect(() => {
    try { localStorage.setItem('mako-wa-drafts', JSON.stringify(drafts)); } catch { /* noop */ }
  }, [drafts]);

  // Mantener el hilo pegado al fondo (al abrir un chat y al llegar mensajes),
  // salvo que el usuario haya scrolleado hacia arriba a leer historial.
  useEffect(() => {
    const el = msgScrollRef.current;
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [mensajes]);

  // ── Mensajes del contacto seleccionado (merge de sus conversaciones) ──
  useEffect(() => {
    selIdRef.current = selId;
    stickBottomRef.current = true;
    setSendError(null);
    setEmojiOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Cancelar cualquier grabación en curso al cambiar de chat.
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      recCancelRef.current = true;
      try { mediaRecRef.current.stop(); } catch { /* noop */ }
    }
    if (selId == null) { setMensajes([]); return; }
    const grupo = contactos.find((c) => c.id === selId);
    const ids = grupo?.convIds ?? [];
    if (!ids.length) { setMensajes([]); return; }
    setLoadingMsgs(true);
    setSendError(null);
    void (async () => {
      try {
        const r = await fetch(`/api/whatsapp/thread?ids=${ids.join(',')}`);
        const j = await r.json();
        if (selIdRef.current === selId) setMensajes(j.ok ? j.mensajes : []);
      } finally {
        setLoadingMsgs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  // ── Notificación (con sonido) de mensajes entrantes — polling cada 20s ──
  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch('/api/whatsapp/conversations');
        const j = await r.json();
        if (!j.ok) return;
        const list: Contacto[] = j.contactos;
        const total = list.reduce((s, c) => s + c.sinLeer, 0);
        const prev = totalSinLeerRef.current;
        if (prev != null && total > prev) {
          const nuevo = [...list].sort((a, b) => b.ultimaActividad - a.ultimaActividad).find((c) => c.sinLeer > 0);
          setToast(`Nuevo mensaje${nuevo ? ` de ${nuevo.contacto}` : ''}`);
          playBeep();
          setTimeout(() => setToast(null), 6000);
        }
        totalSinLeerRef.current = total;
        setContactos(list);
        // Refrescar EN VIVO el hilo abierto (mensajes entrantes + cambios de tick).
        const openId = selIdRef.current;
        if (openId) {
          const g = list.find((c) => c.id === openId);
          if (g) {
            const rr = await fetch(`/api/whatsapp/thread?ids=${g.convIds.join(',')}`);
            const jj = await rr.json();
            if (selIdRef.current === openId) setMensajes(jj.ok ? jj.mensajes : []);
          }
        }
      } catch { /* ignore */ }
    };
    const iv = setInterval(() => void tick(), 20000);
    return () => clearInterval(iv);
  }, []);

  async function refetchHilo(grupo: Contacto) {
    const rr = await fetch(`/api/whatsapp/thread?ids=${grupo.convIds.join(',')}`);
    const jj = await rr.json();
    // Solo pintar si seguís en ese chat (evita pisar el hilo si cambiaste).
    if (selIdRef.current === grupo.id) setMensajes(jj.ok ? jj.mensajes : []);
  }

  async function enviar() {
    const txt = draft.trim();
    const grupo = contactos.find((c) => c.id === selId);
    if (!txt || !grupo || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: txt }),
      });
      const j = await r.json();
      if (!j.ok) {
        setSendError(j.error || 'No se pudo enviar.');
      } else {
        setDraft('');
        await refetchHilo(grupo);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function enviarAdjunto() {
    const grupo = contactos.find((c) => c.id === selId);
    if (!adjunto || !grupo || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const fd = new FormData();
      fd.append('file', adjunto);
      if (draft.trim()) fd.append('content', draft.trim());
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/attachments`, {
        method: 'POST', body: fd,
      });
      const j = await r.json();
      if (!j.ok) {
        setSendError(j.error || 'No se pudo enviar el archivo.');
      } else {
        setDraft('');
        setAdjunto(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await refetchHilo(grupo);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function enviarComposer() {
    if (adjunto) void enviarAdjunto();
    else void enviar();
  }

  function pickFile(f: File | null) {
    if (!f) return;
    setSendError(null);
    if (f.size > 16 * 1024 * 1024) {
      setSendError('El archivo supera el máximo de 16 MB.');
      return;
    }
    setAdjunto(f);
  }

  // ── Nota de voz ──
  function fmtDur(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function pickAudioMime(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const c of ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  }

  // Mapa MIME→extensión SOLO para formatos que WhatsApp acepta. Si el navegador
  // graba en otro (p.ej. webm de Chrome/Edge), no mandamos (Meta lo dropea).
  const AUDIO_EXT: Record<string, string> = {
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'audio/aac': 'aac', 'audio/amr': 'amr', 'audio/3gpp': '3gp',
  };

  async function enviarAudio(blob: Blob, ext: string, grupo: Contacto) {
    if (!blob.size) return;
    setSending(true);
    setSendError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, `audio-${Date.now()}.${ext}`);
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/attachments`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) setSendError(j.error || 'No se pudo enviar el audio.');
      else await refetchHilo(grupo);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function startRec() {
    if (recording || sending) return;
    const destGrupo = contactos.find((c) => c.id === selId);
    if (!destGrupo) return;
    setSendError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setSendError('No se pudo acceder al micrófono. Revisá los permisos.');
      return;
    }
    let rec: MediaRecorder;
    try {
      const mime = pickAudioMime();
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setSendError('Tu navegador no permite grabar audio.');
      return;
    }
    chunksRef.current = [];
    recCancelRef.current = false;
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      const cancelled = recCancelRef.current;
      const type = rec.mimeType || '';
      const blob = new Blob(chunksRef.current, { type });
      setRecording(false);
      setRecPaused(false);
      setRecSecs(0);
      if (cancelled) return;
      if (!blob.size) { setSendError('La grabación quedó vacía, probá de nuevo.'); return; }
      const ext = AUDIO_EXT[type.split(';')[0].trim()];
      if (!ext) {
        setSendError('Tu navegador graba en un formato que WhatsApp no acepta. Usá Firefox/Safari, o adjuntá un audio con 📎.');
        return;
      }
      void enviarAudio(blob, ext, destGrupo);
    };
    mediaRecRef.current = rec;
    rec.start();
    setRecording(true);
    setRecPaused(false);
    setRecSecs(0);
    recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
  }

  function stopRec(cancel: boolean) {
    recCancelRef.current = cancel;
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    try { mediaRecRef.current?.stop(); } catch { /* ya estaba parado */ }
  }

  function pauseRec() {
    try { mediaRecRef.current?.pause(); } catch { /* noop */ }
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setRecPaused(true);
  }

  function resumeRec() {
    try { mediaRecRef.current?.resume(); } catch { /* noop */ }
    if (!recTimerRef.current) recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    setRecPaused(false);
  }

  async function enviarTemplate() {
    const t = templates.find((x) => x.name === selTpl);
    const grupo = contactos.find((c) => c.id === selId);
    if (!t || !grupo || sending) return;
    setSending(true);
    setSendError(null);
    const param = t.params[0];
    const nombre = grupo.contacto ?? '';
    const bodyParams: Record<string, string> = param ? { [param]: nombre } : {};
    const content = param ? t.body.split(`{{${param}}}`).join(nombre) : t.body;
    try {
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName: t.name, category: t.category, language: t.language, bodyParams, content }),
      });
      const j = await r.json();
      if (!j.ok) {
        setSendError(j.error || 'No se pudo enviar la plantilla.');
      } else {
        await refetchHilo(grupo);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  async function toggleSeq(id: number, activa: boolean) {
    setSecuencias((prev) => prev.map((s) => (s.id === id ? { ...s, activa } : s)));
    await fetch('/api/whatsapp/secuencias', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, activa }),
    });
  }

  // ── Edición de pasos ──
  function startEditPasos() {
    if (!seqSel) return;
    setSeqError(null);
    setEditPasos(seqSel.pasos.map((p) => ({ ...p })));
  }

  function patchPaso(i: number, patch: Partial<Paso>) {
    setEditPasos((prev) => (prev ? prev.map((p, j) => (j === i ? { ...p, ...patch } : p)) : prev));
  }

  function pickTemplatePaso(i: number, name: string) {
    const tpl = templates.find((t) => t.name === name);
    if (!tpl) { patchPaso(i, { template_wa: name || null }); return; }
    patchPaso(i, {
      template_wa: tpl.name,
      cuerpo: tpl.body,
      template_categoria: tpl.category,
      template_idioma: tpl.language,
    });
  }

  function addPaso() {
    setEditPasos((prev) => [
      ...(prev ?? []),
      { orden: (prev?.length ?? 0) + 1, canal: 'whatsapp', delay_horas: 24, asunto: null, cuerpo: '', template_wa: null, template_param: 'nombre' },
    ]);
  }

  function removePaso(i: number) {
    setEditPasos((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
  }

  function movePaso(i: number, dir: -1 | 1) {
    setEditPasos((prev) => {
      if (!prev) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function saveSeqPasos() {
    if (!seqSel || !editPasos) return;
    setSavingSeq(true);
    setSeqError(null);
    try {
      const pasos = editPasos.map((p, i) => ({ ...p, orden: i + 1 }));
      const r = await fetch('/api/whatsapp/secuencias', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: seqSel.id, pasos }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setSecuencias((prev) => prev.map((s) => (s.id === seqSel.id ? { ...s, pasos } : s)));
      setEditPasos(null);
    } catch (e) {
      setSeqError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingSeq(false);
    }
  }


  // ── Derivados ──
  const isChats = view === 'chats';
  const q = search.trim().toLowerCase();
  const etapasPresentes = [...new Map(contactos.filter((c) => c.etapaKey).map((c) => [c.etapaKey, c.etapaLabel])).entries()];
  const filtrados = contactos.filter((c) => {
    if (filtroEtapa !== 'todas' && c.etapaKey !== filtroEtapa) return false;
    if (soloVentana && !c.ventanaAbierta) return false;
    if (q && !(c.contacto.toLowerCase().includes(q) || (c.empresa ?? '').toLowerCase().includes(q) || (c.telefono ?? '').includes(q))) return false;
    return true;
  });
  const sel = contactos.find((c) => c.id === selId) ?? null;
  const seqSel = secuencias.find((s) => s.id === selSeqId) ?? null;
  const ventanaAbierta = sel?.ventanaAbierta ?? false;
  const templatesInbox = templates.filter((t) => t.params.length <= 1); // autollenables con {{nombre}}

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 500, background: 'transparent', color: 'var(--dim)' };
  const chipBtn = (active: boolean): CSSProperties => ({ padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 600, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border)'), background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      {toast && (
        <div onClick={() => setToast(null)} style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: 'var(--ink)', color: 'var(--on-sidebar)', padding: '12px 16px', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.28)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>💬 {toast}</div>
      )}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>WhatsApp</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: '12.5px', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--good)' }}></span>Chatwoot conectado
            </span>
          </div>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => setView('chats')} style={isChats ? tabActive : tabIdle}>Conversaciones</button>
          <button onClick={() => setView('sequences')} style={!isChats ? tabActive : tabIdle}>Secuencias automáticas</button>
        </div>
      </header>

      {/* ============= CONVERSACIONES ============= */}
      {isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '330px 1fr 290px', gap: '16px' }}>
          {/* LISTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, empresa o teléfono…" style={{ width: '100%', padding: '10px 13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                <Dropdown
                  value={filtroEtapa}
                  onChange={setFiltroEtapa}
                  width={158}
                  ariaLabel="Filtrar por etapa"
                  buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
                  options={[{ value: 'todas', label: 'Todas las etapas' }, ...etapasPresentes.map(([k, label]) => ({ value: (k as string) ?? '', label: (label as string) ?? '', color: ETAPA_COLOR[(k as string) ?? ''] }))]}
                />
                <button onClick={() => setSoloVentana((v) => !v)} style={chipBtn(soloVentana)}>⏱ Ventana 24h</button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
              {loadingConvs && <div style={{ padding: '18px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
              {!loadingConvs && filtrados.length === 0 && <div style={{ padding: '18px', color: 'var(--faint)', fontSize: '13.5px' }}>Sin conversaciones.</div>}
              {filtrados.map((c) => {
                const active = c.id === selId;
                const chip = etapaChip(c.etapaKey, c.etapaLabel);
                return (
                  <div key={c.id} onClick={() => setSelId(c.id)} style={{ display: 'flex', gap: '11px', padding: '11px 12px', borderRadius: '12px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                    <Avatar src={c.avatar} name={c.contacto} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.contacto}</span>
                        <span style={{ flex: 'none', fontSize: '11px', color: 'var(--faint)' }}>{fmtTime(c.ultimaActividad)}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ultimoMensaje ?? '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px' }}>
                        {chip && <span style={chip.style}><span style={chip.dot}></span>{chip.label}</span>}
                        {c.sinLeer > 0 && <span style={{ marginLeft: 'auto', flex: 'none', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--good)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.sinLeer}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HILO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {!sel && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>Elegí una conversación</div>}
            {sel && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div
                    onClick={sel.leadId ? () => setDetalleLeadId(sel.leadId!) : undefined}
                    onKeyDown={sel.leadId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetalleLeadId(sel.leadId!); } } : undefined}
                    role={sel.leadId ? 'button' : undefined}
                    tabIndex={sel.leadId ? 0 : undefined}
                    title={sel.leadId ? 'Ver detalle del lead' : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, cursor: sel.leadId ? 'pointer' : 'default' }}
                  >
                    <Avatar src={sel.avatar} name={sel.contacto} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '15.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.contacto}</div>
                      <div style={{ fontSize: '12px', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{sel.telefono ?? '—'}</div>
                    </div>
                  </div>
                  {etapaChip(sel.etapaKey, sel.etapaLabel) && (() => { const ch = etapaChip(sel.etapaKey, sel.etapaLabel)!; return <span style={ch.style}><span style={ch.dot}></span>{ch.label}</span>; })()}
                </div>
                <div ref={msgScrollRef} onScroll={() => { const el = msgScrollRef.current; if (el) stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150; }} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface-2)' }}>
                  {loadingMsgs && <div style={{ color: 'var(--dim)', fontSize: '13.5px' }}>Cargando mensajes…</div>}
                  {!loadingMsgs && mensajes.length === 0 && <div style={{ color: 'var(--faint)', fontSize: '13.5px' }}>Sin mensajes.</div>}
                  {mensajes.map((m) => {
                    const mine = m.saliente;
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.template ? 'var(--auto-bubble)' : (mine ? 'var(--wa-bubble)' : 'var(--surface)'), border: '1px solid ' + (m.template ? 'var(--warn-fill)' : (mine ? 'rgba(28,138,84,.30)' : 'var(--border)')), boxShadow: '0 1px 2px rgba(23,21,17,.04)' }}>
                          {m.template && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: '5px' }}>⚡ Plantilla · {m.template}</div>}
                          {m.adjuntos && m.adjuntos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: m.texto ? '6px' : 0 }}>
                              {m.adjuntos.map((a, ai) => (
                                a.tipo === 'image' ? (
                                  <a key={ai} href={a.url} target="_blank" rel="noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={a.url} alt="adjunto" style={{ maxWidth: '240px', maxHeight: '280px', borderRadius: '10px', display: 'block' }} />
                                  </a>
                                ) : a.tipo === 'audio' ? (
                                  <audio key={ai} controls src={a.url} style={{ width: '240px' }} />
                                ) : a.tipo === 'video' ? (
                                  <video key={ai} controls src={a.url} style={{ maxWidth: '240px', borderRadius: '10px' }} />
                                ) : (
                                  <a key={ai} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>📎 Abrir archivo</a>
                                )
                              ))}
                            </div>
                          )}
                          {m.texto && <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: mine ? 'flex-end' : 'flex-start', gap: '5px', marginTop: '3px' }}>
                            <span style={{ fontSize: '10.5px', color: 'var(--faint)' }}>{fmtTime(m.fecha)}</span>
                            {mine && <Ticks status={m.status} error={m.error} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {sendError && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: '12.5px' }}>{sendError}</div>}
                {ventanaAbierta ? (
                  recording ? (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                      <style>{WAVE_CSS}</style>
                      <button onClick={() => stopRec(true)} title="Eliminar grabación" aria-label="Eliminar grabación" style={{ flex: 'none', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--bad)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconTrash /></button>
                      <span style={{ flex: 'none', width: '9px', height: '9px', borderRadius: '50%', background: '#e53935', animation: recPaused ? 'none' : 'mako-blink 1s steps(1) infinite', opacity: recPaused ? 0.4 : 1 }}></span>
                      <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: '14px', color: 'var(--ink)', minWidth: '42px', textAlign: 'right' }}>{fmtDur(recSecs)}</span>
                      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '2px', height: '24px', width: '120px', overflow: 'hidden' }}>
                        {Array.from({ length: 24 }).map((_, i) => (
                          <span key={i} style={{ flex: 'none', width: '3px', height: '20px', borderRadius: '2px', background: 'var(--good)', transformOrigin: 'center', animation: 'mako-wave .7s ease-in-out infinite alternate', animationDelay: `${(i % 11) * 0.06}s`, animationPlayState: recPaused ? 'paused' : 'running' }}></span>
                        ))}
                      </div>
                      <button onClick={recPaused ? resumeRec : pauseRec} title={recPaused ? 'Reanudar' : 'Pausar'} aria-label={recPaused ? 'Reanudar grabación' : 'Pausar grabación'} style={{ flex: 'none', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{recPaused ? <IconPlay /> : <IconPause />}</button>
                      <button onClick={() => stopRec(false)} disabled={sending} title="Enviar audio" aria-label="Enviar audio" style={{ flex: 'none', width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--good)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
                    </div>
                  ) : (
                  <div style={{ borderTop: '1px solid var(--border)', position: 'relative' }}>
                    {emojiOpen && <div onClick={() => setEmojiOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />}
                    {emojiOpen && (
                      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '10px', zIndex: 40 }}>
                        <EmojiPicker onPick={appendDraft} onClose={() => setEmojiOpen(false)} />
                      </div>
                    )}
                    {adjunto && (
                      <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {adjuntoPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={adjuntoPreview} alt={adjunto.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', flex: 'none', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{adjunto.type.startsWith('audio/') ? '🎵' : adjunto.type.startsWith('video/') ? '🎬' : '📄'}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adjunto.name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--faint)' }}>{(adjunto.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button onClick={() => { setAdjunto(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} title="Quitar adjunto" style={{ ...iconBtn, flex: 'none' }}>✕</button>
                      </div>
                    )}
                    <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-end', gap: '4px', position: 'relative', zIndex: 40 }}>
                      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                      <button onClick={() => setEmojiOpen((v) => !v)} title="Emojis" aria-label="Emojis" style={{ ...iconComposer, color: emojiOpen ? 'var(--accent)' : 'var(--dim)' }}><IconSmiley /></button>
                      <button onClick={() => fileInputRef.current?.click()} disabled={sending} title="Adjuntar archivo" aria-label="Adjuntar archivo" style={iconComposer}><IconClip /></button>
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarComposer(); } }} placeholder={adjunto ? 'Agregá un texto (opcional)…' : 'Escribí un mensaje…'} rows={1} style={{ flex: 1, minHeight: '40px', maxHeight: '120px', resize: 'none', padding: '9px 16px', borderRadius: '21px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.35, outline: 'none' }} />
                      {(draft.trim() || adjunto) ? (
                        <button onClick={enviarComposer} disabled={sending} title="Enviar" aria-label="Enviar" style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'var(--good)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
                      ) : (
                        <button onClick={() => void startRec()} disabled={sending} title="Grabar nota de voz" aria-label="Grabar nota de voz" style={{ ...iconComposer, color: 'var(--dim)' }}><IconMic /></button>
                      )}
                    </div>
                  </div>
                  )
                ) : (
                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Ventana de 24h cerrada (el lead no escribió hace más de un día). Fuera de la ventana WhatsApp solo entrega <strong>plantillas aprobadas</strong>:</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select value={selTpl} onChange={(e) => setSelTpl(e.target.value)} style={{ flex: 1, height: '44px', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', outline: 'none' }}>
                        <option value="">Elegí una plantilla…</option>
                        {templatesInbox.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category})</option>)}
                      </select>
                      <button onClick={() => void enviarTemplate()} disabled={sending || !selTpl} style={{ flex: 'none', height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: 'var(--good)', color: '#fff', fontSize: '14.5px', fontWeight: 600, cursor: (sending || !selTpl) ? 'default' : 'pointer', opacity: (sending || !selTpl) ? 0.6 : 1, fontFamily: "'Geist', sans-serif" }}>{sending ? 'Enviando…' : 'Enviar plantilla'}</button>
                    </div>
                    {selTpl && (() => { const t = templatesInbox.find((x) => x.name === selTpl); if (!t) return null; const txt = t.params[0] ? t.body.split(`{{${t.params[0]}}}`).join(sel?.contacto ?? '') : t.body; return <div style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--faint)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{txt}</div>; })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CONTEXTO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', padding: '18px' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Lead</div>
            {sel?.leadId ? (
              <button onClick={() => setDetalleLeadId(sel.leadId!)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{sel?.contacto ?? '—'}</button>
            ) : (
              <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{sel?.contacto ?? '—'}</div>
            )}
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>{sel?.empresa ?? 'Sin empresa registrada'}</div>
            {sel && etapaChip(sel.etapaKey, sel.etapaLabel) && (() => { const ch = etapaChip(sel.etapaKey, sel.etapaLabel)!; return <div style={{ marginTop: '10px' }}><span style={ch.style}><span style={ch.dot}></span>{ch.label}</span></div>; })()}
            {sel?.leadId ? (
              <button onClick={() => setDetalleLeadId(sel.leadId!)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Ver detalle del lead →</button>
            ) : (
              <Link href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>Buscar en CRM →</Link>
            )}
            <div style={{ height: '1px', background: 'var(--border)', margin: '18px 0' }}></div>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '11px' }}>Plantillas rápidas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {QUICK.map((t) => (
                <button key={t} onClick={() => setDraft(t)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '12px', lineHeight: 1.5 }}>El texto libre solo llega si el lead escribió en las últimas 24h. Para reactivar en frío, lo hace el motor de nutrición con plantillas aprobadas.</div>
          </div>
        </div>
      )}

      {/* ============= SECUENCIAS ============= */}
      {!isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Secuencias por etapa</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingSeqs && <div style={{ padding: '14px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
              {!loadingSeqs && secuencias.length === 0 && <div style={{ padding: '14px', color: 'var(--faint)', fontSize: '13.5px' }}>No hay secuencias todavía.</div>}
              {secuencias.map((s) => {
                const active = s.id === selSeqId;
                return (
                  <div key={s.id} onClick={() => setSelSeqId(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '11px', cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                    <span style={{ width: '8px', height: '8px', flex: 'none', borderRadius: '50%', background: s.activa ? 'var(--good)' : 'var(--faint)' }}></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--faint)', marginTop: '1px' }}>{s.pasos.length} pasos · {s.activa ? 'activa' : 'pausada'} · {s.inscriptos} inscriptos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {!seqSel && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px' }}>Elegí una secuencia</div>}
            {seqSel && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: seqSel.activa ? 'var(--good)' : 'var(--faint)' }}></span>
                      <span style={{ fontWeight: 600, fontSize: '19px', letterSpacing: '-0.01em', color: 'var(--ink)' }}>{seqSel.nombre}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '4px' }}>{seqSel.enviados} enviados · {seqSel.inscriptos} inscriptos · trigger: <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: '12px' }}>{seqSel.trigger_tipo}</code></div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flex: 'none' }}>
                    {editPasos ? (
                      <>
                        <button onClick={() => { setEditPasos(null); setSeqError(null); }} disabled={savingSeq} style={{ ...btnGhost, opacity: savingSeq ? 0.6 : 1 }}>Cancelar</button>
                        <button onClick={() => void saveSeqPasos()} disabled={savingSeq} style={{ ...btnPrimary, opacity: savingSeq ? 0.6 : 1 }}>{savingSeq ? 'Guardando…' : '✓ Guardar pasos'}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={startEditPasos} style={btnGhost}>✎ Editar pasos</button>
                        <button onClick={() => void toggleSeq(seqSel.id, !seqSel.activa)} style={{ ...btnSeqBase, padding: '9px 16px', border: '1px solid ' + (seqSel.activa ? 'var(--border-strong)' : 'var(--good)'), background: seqSel.activa ? 'var(--surface)' : 'var(--good-bg)', color: seqSel.activa ? 'var(--dim)' : 'var(--good)' }}>{seqSel.activa ? '⏸ Pausar' : '▶ Activar'}</button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px' }}>
                  {seqError && (
                    <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '13px' }}>{seqError}</div>
                  )}
                  {editPasos ? (
                    <>
                      {editPasos.map((st, i) => {
                        const tplOptions = [
                          { value: '', label: 'Sin plantilla' },
                          ...templates.map((t) => ({ value: t.name, label: t.name })),
                          ...(st.template_wa && !templates.some((t) => t.name === st.template_wa)
                            ? [{ value: st.template_wa, label: `${st.template_wa} (no aprobada)` }]
                            : []),
                        ];
                        return (
                          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '13px', padding: '14px', marginBottom: '12px', background: 'var(--surface-2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <span style={{ fontWeight: 700, fontFamily: "'Geist Mono', monospace", fontSize: '12.5px', color: 'var(--ink)' }}>Paso {i + 1}</span>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => movePaso(i, -1)} disabled={i === 0} title="Subir" style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                                <button onClick={() => movePaso(i, 1)} disabled={i === editPasos.length - 1} title="Bajar" style={{ ...iconBtn, opacity: i === editPasos.length - 1 ? 0.4 : 1 }}>↓</button>
                                <button onClick={() => removePaso(i)} title="Eliminar paso" style={{ ...iconBtn, color: 'var(--bad)' }}>✕</button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                              <label style={{ fontSize: '12px', color: 'var(--dim)' }}>Demora</label>
                              <input type="number" min={0} value={st.delay_horas} onChange={(e) => patchPaso(i, { delay_horas: Math.max(0, Number(e.target.value) || 0) })} style={numInput} />
                              <span style={{ fontSize: '12px', color: 'var(--faint)' }}>horas → {fmtDelay(st.delay_horas)}</span>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                              <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: '5px' }}>Plantilla de WhatsApp</label>
                              <Dropdown value={st.template_wa ?? ''} options={tplOptions} onChange={(v) => pickTemplatePaso(i, v)} placeholder="Elegí plantilla" width="100%" ariaLabel="Plantilla del paso" />
                            </div>
                            <div style={{ width: '100%', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', fontSize: '13.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{st.cuerpo || <span style={{ color: 'var(--faint)' }}>Elegí una plantilla aprobada para previsualizar el texto.</span>}</div>
                          </div>
                        );
                      })}
                      <button onClick={addPaso} style={{ width: '100%', padding: '11px', borderRadius: '11px', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600 }}>+ Agregar paso</button>
                      <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '12px', lineHeight: 1.5 }}>Editás la <strong>demora</strong>, la <strong>plantilla</strong> y el orden de cada paso. El texto sale de la plantilla aprobada de Meta. Variable disponible: <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 5px', fontFamily: "'Geist Mono', monospace" }}>{'{{nombre}}'}</code>.</div>
                    </>
                  ) : (
                    <>
                      {seqSel.pasos.map((st, i) => (
                        <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: '34px' }}>
                            <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--auto-bubble)', border: '1px solid var(--warn-fill)', color: 'var(--warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', fontFamily: "'Geist Mono', monospace" }}>{i + 1}</span>
                            {i < seqSel.pasos.length - 1 && <span style={{ width: '2px', flex: 1, minHeight: '30px', background: 'var(--border)' }}></span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingBottom: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                              <span style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", fontSize: '12px' }}>{fmtDelay(st.delay_horas)}</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--good)', fontWeight: 600 }}>⚡ {st.canal === 'whatsapp' ? 'WhatsApp' : st.canal}</span>
                              {st.template_wa && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11.5px', color: 'var(--dim)' }}>{st.template_wa}</span>}
                            </div>
                            <div style={{ width: '100%', padding: '12px 14px', borderRadius: '11px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{st.cuerpo}</div>
                          </div>
                        </div>
                      ))}
                      <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '8px', paddingLeft: '50px', lineHeight: 1.5 }}>El cuerpo de cada paso es una <strong>plantilla aprobada de Meta</strong> — se administra desde Meta/Chatwoot, no acá. Variable disponible: <code style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 5px', fontFamily: "'Geist Mono', monospace" }}>{'{{nombre}}'}</code>.</div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DETALLE DEL LEAD — el MISMO modal editable del CRM (LeadDetail) */}
      {detalleLeadId != null && (
        <LeadEditModal leadId={detalleLeadId} onClose={() => setDetalleLeadId(null)} />
      )}
    </main>
  );
}
