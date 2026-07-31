'use client';

// =============================================================================
// WhatsApp — Inbox real (Chatwoot) + Secuencias. Client component; el server
// wrapper (page.tsx) aplica el guard de onboarding.
// =============================================================================
//  - Conversaciones: un hilo por persona (junta las conversaciones que Chatwoot
//    haya creado para ese contacto), con todos los mensajes incl. respuestas.
//    Responder = texto libre (solo entra dentro de la ventana de 24h del lead).
//    Cada contacto muestra su etapa del funnel; se puede filtrar por etapa.
//  - Secuencias: las 13 etapas reales de nutricion_secuencias (activar/pausar).
//    El cuerpo de cada paso es una plantilla aprobada de Meta (solo lectura).
// =============================================================================

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Dropdown } from '../components/Dropdown';
import { EmojiPicker } from './EmojiPicker';
import { MakoChat } from '../_components/MakoChat';
import { Icon } from '../_components/icons';
import { PlantillasPanel } from './PlantillasPanel';
import { WhatsAppAdvisor } from './WhatsAppAdvisor';
import { EvolutionConnect } from './EvolutionConnect';
import { NutricionGenerar } from '@/app/_components/NutricionGenerar';
import { EmpresaInbox } from './EmpresaInbox';
import { useNotifications, type Contacto } from '../_components/NotificationsProvider';

// Modal de detalle/edición del lead — el MISMO del CRM (LeadDetail vía wrapper).
// Se carga on-demand (ssr:false) igual que en app/_components/Desglose.tsx.
const LeadEditModal = dynamic(() => import('../leads/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface Adjunto {
  tipo: string;
  url: string;
  ext?: string | null;
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
  proveedor?: 'oficial' | 'no_oficial'; // WhatsApp: oficial (plantilla Meta) | no_oficial (Evolution). Preservar en {...p}.
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

// Tiempo restante de la ventana de 24h (formato corto + flag de urgencia).
function fmtVentana(venceAt: number, nowSec: number): { txt: string; urgente: boolean; vencida: boolean } {
  const rem = venceAt - nowSec;
  if (rem <= 0) return { txt: 'vencida', urgente: true, vencida: true };
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  return { txt: h > 0 ? `${h}h ${m}m` : `${m}m`, urgente: rem < 3600, vencida: false };
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

// Foto de perfil del contacto: primero la de Chatwoot; si no hay o falla, la de
// WhatsApp (proxy del no oficial por teléfono); si tampoco, iniciales.
function Avatar({ src, name, telefono }: { src: string | null; name: string; telefono?: string | null }) {
  const digits = (telefono || '').replace(/\D/g, '');
  const candidatos = [src, digits ? `/api/whatsapp/evolution/mensajes?avatarimg=${digits}` : null].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const url = candidatos[idx] ?? null;
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} referrerPolicy="no-referrer" onError={() => setIdx((i) => i + 1)} style={{ ...avatarStyle, objectFit: 'cover' }} />
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

export function WhatsAppApp() {
  // useSearchParams (deep-link ?chat=) exige un boundary de Suspense en la página.
  return (
    <Suspense fallback={null}>
      <WhatsAppInner />
    </Suspense>
  );
}

function WhatsAppInner() {
  const [view, setView] = useState<View>('chats');
  // Canal del inbox de Conversaciones: 'oficial' (Chatwoot/Bot) o 'empresa'
  // (no oficial/Evolution, leído del espejo en nuestra DB).
  const [canal, setCanal] = useState<'oficial' | 'empresa'>('oficial');

  // Contactos + estado de no-leídos viven en el provider global (un solo poller,
  // corre en toda la app). Acá los consumimos.
  const { contactos, setContactos, loadingConvs, setOpenChat, marcarLeido, noOficialUnread } = useNotifications();
  const searchParamsWA = useSearchParams();
  const [search, setSearch] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<string>('todas');
  const [soloVentana, setSoloVentana] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const selIdRef = useRef<string | null>(null);
  // ?lead=<id> sin chat vinculado: aviso en vez de caer al primer chat de la
  // lista (antes abría el chat de OTRA persona, p.ej. el de Mauricio).
  const [leadSinChat, setLeadSinChat] = useState<number | null>(null);
  const msgScrollRef = useRef<HTMLDivElement | null>(null);
  const stickBottomRef = useRef(true);
  // Cache de mensajes por chat → reabrir un chat es instantáneo (no se ve el
  // chat anterior mientras carga; se refresca en segundo plano).
  const msgCacheRef = useRef<Map<string, Mensaje[]>>(new Map());
  // Actividad del hilo abierto en su última carga → refetchear sólo si cambió.
  const openActivityRef = useRef(0);
  const lastSearchRef = useRef(''); // último ?chat= aplicado (deep-link)
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
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState<number | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockMotivo, setBlockMotivo] = useState('');
  const [blockTarget, setBlockTarget] = useState<{ cid: number; gid: string; lid: number | null; nombre: string } | null>(null);
  const [audioFase, setAudioFase] = useState<string | null>(null); // "Procesando…" / "Enviando…"
  const [audioFaseGid, setAudioFaseGid] = useState<string | null>(null); // a qué chat pertenece
  const [lightbox, setLightbox] = useState<{ tipo: 'image' | 'pdf'; url: string } | null>(null); // preview de adjunto
  // Grabación de nota de voz (MediaRecorder → transcodifica a MP3, único formato
  // que este Chatwoot/WABA entrega; ogg/m4a dan 131053).
  const [recording, setRecording] = useState(false);
  const [recPaused, setRecPaused] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recActiveRef = useRef(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recCancelRef = useRef(false);

  const [secuencias, setSecuencias] = useState<Secuencia[]>([]);
  const [loadingSeqs, setLoadingSeqs] = useState(true);
  const [selSeqId, setSelSeqId] = useState<number | null>(null);
  const [editPasos, setEditPasos] = useState<Paso[] | null>(null);
  const [savingSeq, setSavingSeq] = useState(false);
  const [seqError, setSeqError] = useState<string | null>(null);
  // Sub-secciones de "Secuencias automáticas": secuencias · plantillas · MaKo.
  const [seqTab, setSeqTab] = useState<'secuencias' | 'plantillas' | 'mako'>('secuencias');
  const [seqEtapaFiltro, setSeqEtapaFiltro] = useState('todas');

  // Interruptor de envío real de WhatsApp del workspace (tarea #5). El estado
  // del flag lo ve cualquiera (viene en el GET de secuencias); el toggle solo
  // lo tiene el admin (/api/whatsapp/envio responde 403 al resto).
  const [envioWaOn, setEnvioWaOn] = useState<boolean | null>(null);
  const [envioAdmin, setEnvioAdmin] = useState(false);
  const [envioBusy, setEnvioBusy] = useState(false);
  const [envioErr, setEnvioErr] = useState<string | null>(null);
  const [plantillaTarget, setPlantillaTarget] = useState<string | null>(null); // deep-link desde el pop-up de aprobación
  const [plantillaSeed, setPlantillaSeed] = useState<{ objetivo: string; etapa: string } | null>(null); // pre-carga el redactor de MaKo desde el asesor
  const [now, setNow] = useState(0); // reloj para el contador de la ventana de 24h (tick cada 30s)

  const [detalleLeadId, setDetalleLeadId] = useState<number | null>(null);

  // Borrador y adjunto POR conversación: cambiar de chat conserva lo que no se
  // envió (y un adjunto queda atado a SU chat, nunca se manda al equivocado).
  const draft = selId ? (drafts[selId] ?? '') : '';
  const adjunto = selId ? (adjuntos[selId] ?? null) : null;
  const setDraft = (v: string) => {
    if (!selId) return;
    setDrafts((d) => {
      if (v === '') { const { [selId]: _omit, ...rest } = d; return rest; }
      return { ...d, [selId]: v };
    });
  };
  const appendDraft = (s: string) => { if (selId) setDrafts((d) => ({ ...d, [selId]: (d[selId] ?? '') + s })); };
  const setAdjunto = (f: File | null) => { if (selId) setAdjuntos((a) => ({ ...a, [selId]: f })); };

  const toggleEnvioWa = async () => {
    if (envioWaOn == null || envioBusy) return;
    setEnvioBusy(true); setEnvioErr(null);
    try {
      const r = await fetch('/api/whatsapp/envio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !envioWaOn }) });
      const j = await r.json();
      if (j.ok) setEnvioWaOn(Boolean(j.envioHabilitado));
      else setEnvioErr(j.error || 'No se pudo cambiar el envío real');
    } catch {
      setEnvioErr('Sin conexión — probá de nuevo');
    } finally {
      setEnvioBusy(false);
    }
  };

  // ── Carga inicial (secuencias + plantillas; los contactos vienen del provider) ──
  const reloadSecuencias = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/secuencias');
      const j = await r.json();
      const list: Secuencia[] = j.ok ? j.secuencias : [];
      setSecuencias(list);
      // seed-solo-si-null: /api/whatsapp/envio (GET/POST) es el único escritor
      // autoritativo del toggle; este GET llena el estado inicial (setter y
      // closer, cuyo GET /envio da 403 y no setea nada).
      if (j.ok && typeof j.envioWhatsapp === 'boolean') setEnvioWaOn((prev) => (prev == null ? j.envioWhatsapp : prev));
      setSelSeqId((prev) => (prev != null && list.some((s) => s.id === prev) ? prev : (list[0]?.id ?? null)));
      // El copy pudo cambiar por afuera (MaKo aplicó): un borrador de edición
      // abierto quedó viejo — se descarta para no pisar lo aprobado.
      setEditPasos(null);
    } finally {
      setLoadingSeqs(false);
    }
  }, []);
  useEffect(() => {
    void reloadSecuencias();
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/templates');
        const j = await r.json();
        setTemplates(j.ok ? j.templates : []);
      } catch {
        /* sin templates */
      }
    })();
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/envio');
        const j = await r.json();
        if (j.ok) { setEnvioAdmin(true); setEnvioWaOn(Boolean(j.envioHabilitado)); }
        // 403 = setter/closer: ven el estado pero sin toggle (config admin-only).
      } catch { /* sin toggle */ }
    })();
  }, [reloadSecuencias]);

  // Al salir de /whatsapp, ningún chat queda "abierto" → el provider vuelve a
  // notificar TODOS los contactos (sin esto, el último chat abierto se silencia).
  useEffect(() => () => setOpenChat(null), [setOpenChat]);

  // Deep-link ?canal=empresa (desde el pop-up del canal no oficial) → abrir el
  // inbox no oficial en la sección Conversaciones.
  useEffect(() => {
    if (searchParamsWA.get('canal') === 'empresa') { setView('chats'); setCanal('empresa'); }
  }, [searchParamsWA]);

  // Reloj para el contador de la ventana de 24h (cada 30s alcanza).
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const iv = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(iv);
  }, []);

  // ── Deep-link desde los pop-ups: ?chat= (chat) o ?stab=plantillas&tpl= (plantilla) ──
  useEffect(() => {
    const s = searchParamsWA.toString();
    if (s !== lastSearchRef.current) {
      const stab = searchParamsWA.get('stab');
      if (stab === 'plantillas') {
        lastSearchRef.current = s;
        setView('sequences');
        setSeqTab('plantillas');
        setPlantillaTarget(searchParamsWA.get('tpl') || null);
        return;
      }
      const target = searchParamsWA.get('chat');
      if (target && contactos.some((c) => c.id === target)) {
        lastSearchRef.current = s;
        setView('chats');
        setSelId(target);
        return;
      }
      // ?lead=<id>: abrir el chat del contacto matcheado a ese lead del CRM
      // (deep-link desde la ficha del lead).
      const leadParam = Number(searchParamsWA.get('lead'));
      if (Number.isFinite(leadParam) && leadParam > 0) {
        const c = contactos.find((x) => x.leadId === leadParam);
        if (c) {
          lastSearchRef.current = s;
          setView('chats');
          setSelId(c.id);
          setLeadSinChat(null);
          return;
        }
        // Sin chat vinculado: NO caer al primer chat (era el bug de abrir el
        // chat de otra persona) — mostrar el aviso y no seleccionar nada.
        if (contactos.length) {
          lastSearchRef.current = s;
          setView('chats');
          setLeadSinChat(leadParam);
          return;
        }
        return; // los contactos aún no cargaron: se reintenta cuando lleguen
      }
    }
    // Si el chat del lead aparece después (contacto recién creado), abrirlo.
    if (leadSinChat != null) {
      const c = contactos.find((x) => x.leadId === leadSinChat);
      if (c) { setLeadSinChat(null); setSelId(c.id); }
      return;
    }
    if (selId == null && contactos.length) setSelId(contactos[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactos, searchParamsWA]);

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

  // Al desmontar: cortar timer + grabación (cancelando, sin envío espurio) + micrófono.
  useEffect(() => () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recCancelRef.current = true;
    try { mediaRecRef.current?.stop(); } catch { /* noop */ }
    try { recStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
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

  // Fijar el ancla del divisor "no leídos" UNA sola vez al cargar el hilo
  // (clampeado a los entrantes realmente cargados → no se rompe ni se desplaza).
  useEffect(() => {
    if (unreadAnchorId !== null || unreadAtOpen <= 0 || mensajes.length === 0) return;
    // Conteo real de "no leídos" = la racha de entrantes al final del hilo (lo que
    // llegó nuevo desde tu último mensaje saliente). sinLeer es sólo el flag 1/0.
    let run = 0;
    for (let i = mensajes.length - 1; i >= 0; i--) { if (mensajes[i].saliente) break; run++; }
    if (run === 0) return;
    setUnreadAnchorId(mensajes[mensajes.length - run].id);
    if (run !== unreadAtOpen) setUnreadAtOpen(run); // mostrar el conteo real en el divisor
  }, [mensajes, unreadAtOpen, unreadAnchorId]);

  // ── Mensajes del contacto seleccionado (merge de sus conversaciones) ──
  useEffect(() => {
    selIdRef.current = selId;
    setOpenChat(selId); // el provider suprime el pop-up/sonido del chat que estás viendo
    stickBottomRef.current = true;
    setUnreadAnchorId(null);
    setSendError(null);
    setEmojiOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Cancelar cualquier grabación en curso (incluida pausada) al cambiar de chat.
    if (recActiveRef.current) {
      recCancelRef.current = true;
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      try { mediaRecRef.current?.stop(); } catch { /* noop */ }
      try { recStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      setRecording(false); setRecPaused(false); setRecSecs(0);
    }
    if (selId == null) { setMensajes([]); setUnreadAtOpen(0); openActivityRef.current = 0; return; }
    const grupo = contactos.find((c) => c.id === selId);
    const ids = grupo?.convIds ?? [];
    setUnreadAtOpen(grupo?.sinLeer ?? 0);
    openActivityRef.current = grupo?.ultimaActividad ?? 0;
    // Marcar leído (limpia el badge en Chatwoot + en el provider).
    if (grupo && grupo.sinLeer > 0) marcarLeido(grupo.id, grupo.sendContactId);
    if (!ids.length) { setMensajes([]); return; }
    // Instantáneo desde cache (no se ve el chat anterior); si no hay, vacío + spinner.
    const cached = msgCacheRef.current.get(selId);
    if (cached) { setMensajes(cached); setLoadingMsgs(false); }
    else { setMensajes([]); setLoadingMsgs(true); }
    setSendError(null);
    void (async () => {
      try {
        const r = await fetch(`/api/whatsapp/thread?ids=${ids.join(',')}`);
        const j = await r.json();
        const msgs: Mensaje[] = j.ok ? j.mensajes : [];
        cacheMsgs(selId, msgs);
        if (selIdRef.current === selId) setMensajes(msgs);
      } finally {
        if (selIdRef.current === selId) setLoadingMsgs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  // El provider global actualiza `contactos` cada 6s. Cuando sube la actividad del
  // chat ABIERTO, recargamos su hilo en vivo (mensajes nuevos) y lo marcamos leído.
  useEffect(() => {
    const g = selId ? contactos.find((c) => c.id === selId) : undefined;
    if (!g || g.ultimaActividad <= openActivityRef.current) return;
    openActivityRef.current = g.ultimaActividad;
    void (async () => {
      const rr = await fetch(`/api/whatsapp/thread?ids=${g.convIds.join(',')}`);
      const jj = await rr.json();
      const msgs: Mensaje[] = jj.ok ? jj.mensajes : [];
      cacheMsgs(g.id, msgs);
      if (selIdRef.current === g.id) setMensajes(msgs);
      if (g.sinLeer > 0) marcarLeido(g.id, g.sendContactId); // sólo si hay no-leídos
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactos, selId]);

  function cacheMsgs(id: string, msgs: Mensaje[]) {
    const m = msgCacheRef.current;
    if (m.has(id)) m.delete(id);   // mover al final (LRU)
    m.set(id, msgs);
    while (m.size > 40) { const oldest = m.keys().next().value; if (oldest === undefined) break; m.delete(oldest); }
  }

  async function refetchHilo(grupo: Contacto, extraConvId?: number) {
    // Prependear la conv donde se acaba de enviar garantiza que el thread (que
    // corta a las más recientes) la incluya y el mensaje no "desaparezca".
    const ids = extraConvId ? [extraConvId, ...grupo.convIds.filter((x) => x !== extraConvId)] : grupo.convIds;
    const rr = await fetch(`/api/whatsapp/thread?ids=${ids.join(',')}`);
    const jj = await rr.json();
    const msgs: Mensaje[] = jj.ok ? jj.mensajes : [];
    cacheMsgs(grupo.id, msgs);
    // Solo pintar si seguís en ese chat (evita pisar el hilo si cambiaste).
    if (selIdRef.current === grupo.id) setMensajes(msgs);
  }

  async function enviar() {
    const txt = draft.trim();
    const grupo = contactos.find((c) => c.id === selId);
    if (!txt || !grupo || sending) return;
    // Optimista: el mensaje aparece YA (con reloj de "pendiente"); no esperamos el
    // round-trip a Chatwoot (que tarda). El refetch lo reemplaza por el real.
    const tempId = -Date.now();
    const optimista: Mensaje = { id: tempId, texto: txt, saliente: true, fecha: Math.floor(Date.now() / 1000), template: null, status: 'sending', error: null, adjuntos: [] };
    setMensajes((m) => [...m, optimista]);
    setDraft('');
    setSending(true);
    setSendError(null);
    try {
      // Lead sin chat todavía: creamos el contacto en Chatwoot al escribirle (lazy).
      let sendCid = grupo.sendContactId;
      if (grupo.sinChat || !sendCid) {
        if (!grupo.leadId) { setMensajes((m) => m.filter((x) => x.id !== tempId)); setDraft(txt); setSendError('Este contacto no tiene lead vinculado.'); setSending(false); return; }
        const cr = await fetch(`/api/whatsapp/lead/${grupo.leadId}`, { method: 'POST' });
        const cj = await cr.json();
        if (!cj.ok || !cj.contactId) { setMensajes((m) => m.filter((x) => x.id !== tempId)); setDraft(txt); setSendError(cj.error || 'No se pudo iniciar el chat.'); setSending(false); return; }
        sendCid = cj.contactId;
        setContactos((prev) => prev.map((c) => (c.id === grupo.id ? { ...c, sendContactId: sendCid, sinChat: false } : c)));
      }
      const r = await fetch(`/api/whatsapp/contacts/${sendCid}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: txt }),
      });
      const j = await r.json();
      if (!j.ok) {
        setMensajes((m) => m.filter((x) => x.id !== tempId));
        setDraft(txt);
        setSendError(j.error || 'No se pudo enviar.');
      } else {
        // Dejamos el optimista como "enviado" (sin parpadeo); el poll del chat
        // abierto lo reconcilia con el mensaje real de Chatwoot en unos segundos.
        setMensajes((m) => m.map((x) => (x.id === tempId ? { ...x, status: 'sent' } : x)));
      }
    } catch (e) {
      setMensajes((m) => m.filter((x) => x.id !== tempId));
      setDraft(txt);
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  function toggleBloqueo() {
    if (!sel || blocking) return;
    const target = { cid: sel.sendContactId, gid: sel.id, lid: sel.leadId, nombre: sel.contacto };
    if (sel.bloqueado) { void aplicarBloqueo(false, '', target); }                          // desbloquear directo
    else { setBlockTarget(target); setBlockMotivo(''); setBlockModalOpen(true); }            // bloquear → pide motivo
  }

  async function aplicarBloqueo(nuevo: boolean, motivo: string, target: { cid: number; gid: string; lid: number | null }) {
    if (blocking) return;
    setBlocking(true);
    setSendError(null);
    try {
      const r = await fetch(`/api/whatsapp/contacts/${target.cid}/block`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: nuevo, leadId: target.lid, motivo }),
      });
      const j = await r.json();
      if (!j.ok) setSendError(j.error || 'No se pudo actualizar el bloqueo.');
      else { setContactos((prev) => prev.map((c) => (c.id === target.gid ? { ...c, bloqueado: nuevo } : c))); setBlockModalOpen(false); }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setBlocking(false);
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

  async function enviarAudio(blob: Blob, ext: string, grupo: Contacto) {
    const enEseChat = () => selIdRef.current === grupo.id;
    if (!blob.size) { if (enEseChat()) setSendError('La grabación quedó vacía, probá de nuevo.'); setAudioFase(null); setAudioFaseGid(null); return; }
    setSending(true);
    setAudioFase('Enviando audio…');
    setAudioFaseGid(grupo.id);
    setSendError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, `audio-${Date.now()}.${ext}`);
      const r = await fetch(`/api/whatsapp/contacts/${grupo.sendContactId}/attachments`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) { if (enEseChat()) setSendError(j.error || 'No se pudo enviar el audio.'); }
      else await refetchHilo(grupo);
    } catch (e) {
      if (enEseChat()) setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
      setAudioFase(null);
      setAudioFaseGid(null);
    }
  }

  async function startRec() {
    if (recording || sending || recActiveRef.current) return;
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
      rec = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setSendError('Tu navegador no permite grabar audio.');
      return;
    }
    const thisRec = rec;
    recStreamRef.current = stream;
    chunksRef.current = [];
    recCancelRef.current = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      recActiveRef.current = false;
      stream.getTracks().forEach((t) => t.stop()); // libera el micrófono
      if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
      // Cancelado si lo pidieron O si arrancó otra grabación (este stop quedó viejo).
      const cancelled = recCancelRef.current || mediaRecRef.current !== thisRec;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
      if (mediaRecRef.current === thisRec) mediaRecRef.current = null;
      setRecording(false);
      setRecPaused(false);
      setRecSecs(0);
      if (cancelled || !blob.size) { if (!cancelled) setSendError('La grabación quedó vacía, probá de nuevo.'); return; }
      // Transcodificar a MP3 (único formato que WhatsApp entrega acá) y enviar.
      setSending(true);
      setAudioFase('Procesando audio…');
      setAudioFaseGid(destGrupo.id);
      void (async () => {
        try {
          const { blobToMp3 } = await import('./audio');
          const mp3 = await blobToMp3(blob);
          await enviarAudio(mp3, 'mp3', destGrupo);
        } catch (err) {
          setSending(false);
          setAudioFase(null);
          setAudioFaseGid(null);
          if (selIdRef.current === destGrupo.id) setSendError('No se pudo procesar el audio (' + (err instanceof Error ? err.message : 'error') + ').');
        }
      })();
    };
    mediaRecRef.current = rec;
    recActiveRef.current = true;
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
    // Elegir una plantilla aprobada implica canal OFICIAL (Meta): fija proveedor
    // para no dejar un paso contradictorio (no_oficial + plantilla).
    patchPaso(i, {
      proveedor: 'oficial',
      template_wa: tpl.name,
      cuerpo: tpl.body,
      template_categoria: tpl.category,
      template_idioma: tpl.language,
    });
  }

  function addPaso() {
    setEditPasos((prev) => [
      ...(prev ?? []),
      { orden: (prev?.length ?? 0) + 1, canal: 'whatsapp', delay_horas: 24, asunto: null, cuerpo: '', proveedor: 'oficial', template_wa: null, template_param: 'nombre' },
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
  const filtrados = contactos
    .filter((c) => {
      if (filtroEtapa !== 'todas' && c.etapaKey !== filtroEtapa) return false;
      if (soloVentana && !c.ventanaAbierta) return false;
      if (q && !(c.contacto.toLowerCase().includes(q) || (c.empresa ?? '').toLowerCase().includes(q) || (c.telefono ?? '').includes(q))) return false;
      return true;
    })
    // Los chats con un borrador sin enviar van arriba (como WhatsApp).
    .sort((a, b) => {
      const da = (drafts[a.id] ?? '').trim() ? 1 : 0;
      const db = (drafts[b.id] ?? '').trim() ? 1 : 0;
      if (da !== db) return db - da;
      return b.ultimaActividad - a.ultimaActividad;
    });
  const sel = contactos.find((c) => c.id === selId) ?? null;
  const seqSel = secuencias.find((s) => s.id === selSeqId) ?? null;
  // Feature 5: filtro por etapa de las secuencias.
  const ETAPA_SEQ_LABEL: Record<string, string> = {
    nutri: 'Nutrición', postagenda: 'Post-agenda', noshow: 'No-show', nopaga: 'No paga', manual: 'Manual',
    // Stage keys del funnel derivado (secuencias funnel-agnósticas, trigger etapa_actual).
    noshow_r1: 'No Show R1', noshow_r2: 'No Show R2', noshow_r3: 'No Show R3',
    nocompro: 'No Compró', nutridiaria: 'Nutrición diaria', reactivacion: 'Reactivación',
    reunion_excepcional: 'Reunión excepcional',
  };
  const seqEtapasPresentes = [...new Set(secuencias.map((s) => s.etapa).filter(Boolean))];
  const seqFiltradas = seqEtapaFiltro === 'todas' ? secuencias : secuencias.filter((s) => s.etapa === seqEtapaFiltro);
  // ¿Cuántas secuencias siguen con texto de relleno del seed? ([tu problema]…;
  // los [tu link …] no cuentan: son placeholders del sistema). Dispara el banner
  // de arranque "MaKo te arma toda la nutrición" (#46).
  const seqConRelleno = secuencias.filter((s) =>
    s.pasos.some((p) => /\[(?!tu link)[^\]\n]{2,80}\]/i.test(p.cuerpo) || /\[(?!tu link)[^\]\n]{2,80}\]/i.test(p.asunto ?? '')),
  ).length;
  const ventanaAbierta = sel?.ventanaAbierta ?? false;
  // Vencimiento de la ventana del chat abierto: 24h tras el último mensaje ENTRANTE
  // del hilo (exacto, aun si respondimos último); si no hay hilo, el del provider.
  const ventanaVenceSel = (() => {
    if (!ventanaAbierta) return null;
    for (let i = mensajes.length - 1; i >= 0; i--) { if (!mensajes[i].saliente && mensajes[i].fecha) return mensajes[i].fecha! + 86400; }
    return sel?.ventanaVenceAt ?? null;
  })();
  const templatesInbox = templates.filter((t) => t.params.length <= 1); // autollenables con {{nombre}}

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-sidebar)' };
  const tabIdle: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 500, background: 'transparent', color: 'var(--dim)' };
  const oficialUnread = contactos.reduce((s, c) => s + c.sinLeer, 0);
  const badgeCanal: CSSProperties = { minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--bad)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
  const chipBtn = (active: boolean): CSSProperties => ({ padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 600, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border)'), background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100dvh', maxHeight: '100dvh', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="whatsapp" size={34} /></span>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>WhatsApp</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: '12.5px', fontWeight: 600 }} title="Número oficial (Cloud API de Meta) — recibe el tráfico frío de los anuncios">
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--good)' }}></span>API Oficial
            </span>
            <EvolutionConnect />
            {envioAdmin && envioWaOn != null && (
              <button onClick={() => void toggleEnvioWa()} disabled={envioBusy} aria-pressed={envioWaOn}
                title={envioWaOn ? 'El motor manda WhatsApps reales — clic para pausar' : 'Las secuencias no envían: los pasos quedan esperando — clic para activar'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, border: '1px solid ' + (envioWaOn ? 'var(--good)' : 'var(--border-strong)'), background: envioWaOn ? 'var(--good-bg)' : 'var(--surface)', color: envioWaOn ? 'var(--good)' : 'var(--dim)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: envioWaOn ? 'var(--good)' : 'var(--faint)' }} />
                Envío real: {envioWaOn ? 'ON' : 'OFF'}
              </button>
            )}
            {envioErr && <span style={{ fontSize: '12px', color: 'var(--bad)' }}>{envioErr}</span>}
          </div>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => setView('chats')} style={isChats ? tabActive : tabIdle}>Conversaciones</button>
          <button onClick={() => setView('sequences')} style={!isChats ? tabActive : tabIdle}>Secuencias automáticas</button>
        </div>
      </header>

      {/* Toggle de canal del inbox (oficial Chatwoot / empresa no-oficial) */}
      {isChats && (
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '11px', padding: '4px', gap: '4px', marginBottom: '14px' }}>
          <button onClick={() => setCanal('oficial')} style={{ ...(canal === 'oficial' ? tabActive : tabIdle), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>API Oficial{oficialUnread > 0 && <span style={badgeCanal}>{oficialUnread}</span>}</button>
          <button onClick={() => setCanal('empresa')} style={{ ...(canal === 'empresa' ? tabActive : tabIdle), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>API no Oficial{noOficialUnread > 0 && <span style={badgeCanal}>{noOficialUnread}</span>}</button>
        </div>
      )}

      {/* ============= CONVERSACIONES — EMPRESA (no oficial, espejo en DB) ============= */}
      {isChats && canal === 'empresa' && <EmpresaInbox />}

      {/* ============= CONVERSACIONES — BOT OFICIAL (Chatwoot) ============= */}
      {isChats && canal === 'oficial' && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '330px 1fr 344px', gap: '16px' }}>
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
                    <Avatar src={c.avatar} name={c.contacto} telefono={c.telefono} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.contacto}</span>
                        <span style={{ flex: 'none', fontSize: '11px', color: 'var(--faint)' }}>{fmtTime(c.ultimaActividad)}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: (drafts[c.id] ?? '').trim() ? 'var(--ink)' : 'var(--dim)' }}>{(drafts[c.id] ?? '').trim() ? (<><span style={{ color: 'var(--bad)', fontWeight: 600 }}>Borrador:</span> {drafts[c.id].trim()}</>) : (c.ultimoMensaje ?? '—')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px' }}>
                        {chip && <span style={chip.style}><span style={chip.dot}></span>{chip.label}</span>}
                        {now > 0 && c.ventanaVenceAt != null && (() => { const v = fmtVentana(c.ventanaVenceAt, now); return <span title="Tiempo restante de la ventana de 24h" style={{ flex: 'none', fontSize: '10.5px', fontWeight: 600, color: v.urgente ? 'var(--bad)' : 'var(--good)' }}>⏱ {v.vencida ? 'vencida' : v.txt}</span>; })()}
                        {c.sinLeer > 0 && <span title="Mensaje nuevo sin leer" style={{ marginLeft: 'auto', flex: 'none', width: '11px', height: '11px', borderRadius: '50%', background: 'var(--good)' }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HILO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {!sel && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: '14px', padding: '0 28px', textAlign: 'center', lineHeight: 1.5 }}>
                {leadSinChat != null
                  ? 'Este lead todavía no tiene chat de WhatsApp vinculado. Cuando tenga teléfono con conversación, se abre acá solo.'
                  : 'Elegí una conversación'}
              </div>
            )}
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
                    <Avatar src={sel.avatar} name={sel.contacto} telefono={sel.telefono} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '15.5px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.contacto}</div>
                      <div style={{ fontSize: '12px', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{sel.telefono ?? '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 'none' }}>
                    {now > 0 && ventanaVenceSel != null && (() => { const v = fmtVentana(ventanaVenceSel, now); return (
                      <span title="Tiempo restante de la ventana de 24h para escribirle texto libre" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, border: '1px solid ' + (v.urgente ? 'var(--bad)' : 'var(--good)'), color: v.urgente ? 'var(--bad)' : 'var(--good)', background: v.urgente ? 'var(--bad-bg)' : 'var(--good-bg)' }}>⏱ {v.vencida ? 'Ventana vencida' : `${v.txt} de ventana`}</span>
                    ); })()}
                    {etapaChip(sel.etapaKey, sel.etapaLabel) && (() => { const ch = etapaChip(sel.etapaKey, sel.etapaLabel)!; return <span style={ch.style}><span style={ch.dot}></span>{ch.label}</span>; })()}
                  </div>
                </div>
                <div ref={msgScrollRef} onScroll={() => { const el = msgScrollRef.current; if (el) stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150; }} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface-2)' }}>
                  {loadingMsgs && mensajes.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
                      <span style={{ width: '28px', height: '28px', border: '3px solid var(--border)', borderTopColor: 'var(--good)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
                    </div>
                  )}
                  {!loadingMsgs && mensajes.length === 0 && <div style={{ color: 'var(--faint)', fontSize: '13.5px' }}>Sin mensajes.</div>}
                  {mensajes.map((m) => {
                    const mine = m.saliente;
                    return (
                      <Fragment key={m.id}>
                        {m.id === unreadAnchorId && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '999px', padding: '3px 12px' }}>{unreadAtOpen} {unreadAtOpen === 1 ? 'mensaje no leído' : 'mensajes no leídos'}</span>
                          </div>
                        )}
                      <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.template ? 'var(--auto-bubble)' : (mine ? 'var(--wa-bubble)' : 'var(--surface)'), border: '1px solid ' + (m.template ? 'var(--warn-fill)' : (mine ? 'rgba(30,158,87,.30)' : 'var(--border)')), boxShadow: '0 1px 2px rgba(18,21,27,.04)' }}>
                          {m.template && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Geist Mono', monospace", fontSize: '10px', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: '5px' }}>⚡ Plantilla · {m.template}</div>}
                          {m.adjuntos && m.adjuntos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: m.texto ? '6px' : 0 }}>
                              {m.adjuntos.map((a, ai) => {
                                const esPdf = a.ext === 'pdf' || a.url.toLowerCase().includes('.pdf');
                                return a.tipo === 'image' ? (
                                  <button key={ai} onClick={() => setLightbox({ tipo: 'image', url: a.url })} title="Ver imagen" style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'block' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={a.url} alt="adjunto" style={{ maxWidth: '240px', maxHeight: '280px', borderRadius: '10px', display: 'block' }} />
                                  </button>
                                ) : a.tipo === 'audio' ? (
                                  <audio key={ai} controls src={a.url} style={{ width: '240px' }} />
                                ) : a.tipo === 'video' ? (
                                  <video key={ai} controls src={a.url} style={{ maxWidth: '240px', borderRadius: '10px' }} />
                                ) : esPdf ? (
                                  <button key={ai} onClick={() => setLightbox({ tipo: 'pdf', url: a.url })} title="Ver PDF" style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', maxWidth: '240px' }}>
                                    <span style={{ fontSize: '20px', flex: 'none' }}>📄</span>
                                    <span style={{ minWidth: 0, textAlign: 'left' }}>
                                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Documento PDF</span>
                                      <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--primary)' }}>Ver previsualización</span>
                                    </span>
                                  </button>
                                ) : (
                                  <a key={ai} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>📎 Abrir archivo</a>
                                );
                              })}
                            </div>
                          )}
                          {m.texto && <div style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: mine ? 'flex-end' : 'flex-start', gap: '5px', marginTop: '3px' }}>
                            <span style={{ fontSize: '10.5px', color: 'var(--faint)' }}>{fmtTime(m.fecha)}</span>
                            {mine && <Ticks status={m.status} error={m.error} />}
                          </div>
                        </div>
                      </div>
                      </Fragment>
                    );
                  })}
                </div>
                {audioFase && audioFaseGid === selId && (
                  <div style={{ padding: '8px 16px', background: 'var(--good-bg)', color: 'var(--good)', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
                    <span style={{ width: '13px', height: '13px', border: '2px solid var(--good)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
                    {audioFase} (puede tardar unos segundos)
                  </div>
                )}
                {sendError && <div style={{ padding: '8px 16px', background: 'var(--warn-fill)', color: 'var(--warn)', fontSize: '12.5px' }}>{sendError}</div>}
                {sel.bloqueado ? (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '13px', color: 'var(--dim)' }}>⛔ Contacto bloqueado. <button onClick={() => void toggleBloqueo()} disabled={blocking} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Desbloquear</button> para volver a escribir.</div>
                ) : recording ? (
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
                ) : ventanaAbierta ? (
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
                      <button onClick={() => setEmojiOpen((v) => !v)} title="Emojis" aria-label="Emojis" style={{ ...iconComposer, color: emojiOpen ? 'var(--primary)' : 'var(--dim)' }}><IconSmiley /></button>
                      <button onClick={() => fileInputRef.current?.click()} disabled={sending} title="Adjuntar archivo" aria-label="Adjuntar archivo" style={iconComposer}><IconClip /></button>
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarComposer(); } }} placeholder={adjunto ? 'Agregá un texto (opcional)…' : 'Escribí un mensaje…'} rows={1} style={{ flex: 1, minHeight: '40px', maxHeight: '120px', resize: 'none', padding: '9px 16px', borderRadius: '21px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.35, outline: 'none' }} />
                      {(draft.trim() || adjunto) ? (
                        <button onClick={enviarComposer} disabled={sending} title="Enviar" aria-label="Enviar" style={{ flex: 'none', width: '42px', height: '42px', borderRadius: '50%', border: 'none', background: 'var(--good)', color: '#fff', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SendArrow /></button>
                      ) : (
                        <button onClick={() => void startRec()} disabled={sending} title="Grabar nota de voz" aria-label="Grabar nota de voz" style={{ ...iconComposer, color: 'var(--dim)' }}><IconMic /></button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', marginBottom: '8px' }}>Ventana de 24h cerrada (el lead no escribió hace más de un día). Fuera de la ventana WhatsApp solo entrega <strong>plantillas aprobadas</strong>:</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Dropdown
                          value={selTpl}
                          onChange={setSelTpl}
                          placeholder="Elegí una plantilla…"
                          width="100%"
                          ariaLabel="Plantilla de WhatsApp"
                          buttonStyle={{ height: 44, padding: '0 12px', borderRadius: 12, background: 'var(--surface-2)', fontWeight: 400, fontSize: 14 }}
                          options={[
                            { value: '', label: 'Elegí una plantilla…' },
                            ...templatesInbox.map((t) => ({ value: t.name, label: `${t.name} (${t.category})` })),
                          ]}
                        />
                      </div>
                      <button onClick={() => void enviarTemplate()} disabled={sending || !selTpl} style={{ flex: 'none', height: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: 'var(--good)', color: '#fff', fontSize: '14.5px', fontWeight: 600, cursor: (sending || !selTpl) ? 'default' : 'pointer', opacity: (sending || !selTpl) ? 0.6 : 1, fontFamily: "'Geist', sans-serif" }}>{sending ? 'Enviando…' : 'Enviar plantilla'}</button>
                    </div>
                    {selTpl && (() => { const t = templatesInbox.find((x) => x.name === selTpl); if (!t) return null; const txt = t.params[0] ? t.body.split(`{{${t.params[0]}}}`).join(sel?.contacto ?? '') : t.body; return <div style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--faint)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{txt}</div>; })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* CONTEXTO */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '18px' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: '12px' }}>Lead</div>
            {sel?.leadId ? (
              <button onClick={() => setDetalleLeadId(sel.leadId!)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{sel?.contacto ?? '—'}</button>
            ) : (
              <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{sel?.contacto ?? '—'}</div>
            )}
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px' }}>{sel?.empresa ?? 'Sin empresa registrada'}</div>
            {sel && etapaChip(sel.etapaKey, sel.etapaLabel) && (() => { const ch = etapaChip(sel.etapaKey, sel.etapaLabel)!; return <div style={{ marginTop: '10px' }}><span style={ch.style}><span style={ch.dot}></span>{ch.label}</span></div>; })()}
            {sel?.leadId ? (
              <button onClick={() => setDetalleLeadId(sel.leadId!)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Ver detalle del lead →</button>
            ) : (
              <Link href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Buscar en CRM →</Link>
            )}
            {sel?.bloqueado && (
              <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--bad)' }}>⛔ Contacto bloqueado</div>
            )}
            {sel && (
              <button onClick={() => void toggleBloqueo()} disabled={blocking} style={{ marginTop: '12px', width: '100%', padding: '9px 12px', borderRadius: '10px', cursor: blocking ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, border: '1px solid ' + (sel.bloqueado ? 'var(--border-strong)' : 'var(--bad)'), background: 'var(--surface)', color: sel.bloqueado ? 'var(--dim)' : 'var(--bad)', opacity: blocking ? 0.6 : 1 }}>{blocking ? '…' : sel.bloqueado ? 'Desbloquear contacto' : 'Bloquear contacto'}</button>
            )}
            <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0', flex: 'none' }}></div>
            {sel ? (
              <WhatsAppAdvisor
                grupo={{ id: sel.id, contacto: sel.contacto, empresa: sel.empresa, etapaLabel: sel.etapaLabel }}
                mensajes={mensajes}
                ventanaAbierta={ventanaAbierta}
                onUsar={(t) => setDraft(draft.trim() ? `${draft.replace(/\s+$/, '')}\n\n${t}` : t)}
                onRedactarPlantilla={(seed) => { if (seed) setPlantillaSeed(seed); setView('sequences'); setSeqTab('plantillas'); }}
                quickTemplates={QUICK}
              />
            ) : (
              <div style={{ fontSize: '12.5px', color: 'var(--faint)', lineHeight: 1.5 }}>Elegí una conversación para que MaKo te sugiera qué escribir.</div>
            )}
          </div>
        </div>
      )}

      {/* ============= SECUENCIAS AUTOMÁTICAS (3 sub-secciones) ============= */}
      {!isChats && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {envioWaOn === false && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: 'var(--dim)' }}>
              El <strong style={{ color: 'var(--ink)' }}>envío real de WhatsApp está apagado</strong>: las secuencias no mandan nada y los pasos quedan esperando.
              {envioAdmin ? ' Se prende con el botón “Envío real” de arriba.' : ' Lo prende el admin del workspace.'}
            </div>
          )}
          {seqConRelleno > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: 'var(--dim)' }}>
              <span>
                <strong style={{ color: 'var(--ink)' }}>{seqConRelleno === 1 ? 'Una secuencia sigue' : `${seqConRelleno} secuencias siguen`} con texto de relleno</strong> — MaKo puede escribirlas todas en la voz de tu negocio y vos solo las aprobás (botón «✍️ Nutrición»).
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '11px', padding: '4px', gap: '4px' }}>
              <button onClick={() => setSeqTab('secuencias')} style={seqTab === 'secuencias' ? tabActive : tabIdle}>Secuencias</button>
              <button onClick={() => setSeqTab('plantillas')} style={seqTab === 'plantillas' ? tabActive : tabIdle}>Plantillas</button>
              <button onClick={() => setSeqTab('mako')} style={seqTab === 'mako' ? tabActive : tabIdle}>✨ Preguntá a MaKo</button>
            </div>
            <NutricionGenerar onAplicado={() => void reloadSecuencias()} />
          </div>

          {seqTab === 'plantillas' && <PlantillasPanel initialSelect={plantillaTarget} makoSeed={plantillaSeed} onMakoSeedApplied={() => setPlantillaSeed(null)} />}

          {seqTab === 'mako' && (
            <div style={{ flex: 1, minHeight: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
              <MakoChat
                chartKey="whatsapp-secuencias"
                titulo="Secuencias y plantillas de WhatsApp"
                sugerencias={['¿Esta secuencia tiene sentido para el funnel?', '¿Este mensaje lo aprobaría Meta?', '¿Qué plantilla me falta?', '¿Cómo reactivo a los que no agendaron?']}
              />
            </div>
          )}

          {seqTab === 'secuencias' && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Secuencias por etapa</div>
              <Dropdown
                value={seqEtapaFiltro}
                onChange={setSeqEtapaFiltro}
                width="100%"
                ariaLabel="Filtrar secuencias por etapa"
                buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
                options={[{ value: 'todas', label: 'Todas las etapas' }, ...seqEtapasPresentes.map((e) => ({ value: e, label: ETAPA_SEQ_LABEL[e] ?? e }))]}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingSeqs && <div style={{ padding: '14px', color: 'var(--dim)', fontSize: '13.5px' }}>Cargando…</div>}
              {!loadingSeqs && seqFiltradas.length === 0 && <div style={{ padding: '14px', color: 'var(--faint)', fontSize: '13.5px' }}>No hay secuencias en esta etapa.</div>}
              {seqFiltradas.map((s) => {
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
                              {st.canal === 'whatsapp' && st.proveedor === 'no_oficial' && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--dim)', fontSize: '11px', fontWeight: 600 }}>no oficial</span>}
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
        </div>
      )}

      {/* DETALLE DEL LEAD — el MISMO modal editable del CRM (LeadDetail) */}
      {detalleLeadId != null && (
        <LeadEditModal leadId={detalleLeadId} onClose={() => setDetalleLeadId(null)} />
      )}

      {/* CONFIRMAR BLOQUEO — pide motivo (se guarda en el lead como descalificado) */}
      {blockModalOpen && blockTarget && (
        <div onClick={() => !blocking && setBlockModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '22px', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
            <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--ink)' }}>Bloquear a {blockTarget.nombre}</div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '6px', lineHeight: 1.5 }}>No le van a llegar más mensajes y el lead pasa a <strong>Descalificado</strong>. El motivo se guarda en la ficha del lead.</div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', margin: '16px 0 5px' }}>Motivo del bloqueo</label>
            <textarea value={blockMotivo} onChange={(e) => setBlockMotivo(e.target.value)} placeholder="Ej: spam, no es el público objetivo, agresivo…" autoFocus rows={3} style={{ width: '100%', resize: 'none', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button onClick={() => setBlockModalOpen(false)} disabled={blocking} style={btnGhost}>Cancelar</button>
              <button onClick={() => void aplicarBloqueo(true, blockMotivo, blockTarget)} disabled={blocking || !blockMotivo.trim()} style={{ ...btnSeqBase, padding: '9px 16px', border: '1px solid var(--bad)', background: 'var(--bad)', color: '#fff', opacity: (blocking || !blockMotivo.trim()) ? 0.6 : 1 }}>{blocking ? 'Bloqueando…' : 'Bloquear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PREVISUALIZACIÓN de adjuntos (imagen / PDF) */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '24px' }}>
          <button onClick={() => setLightbox(null)} title="Cerrar" aria-label="Cerrar" style={{ position: 'fixed', top: 18, right: 22, width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: '18px', cursor: 'pointer', zIndex: 2501 }}>✕</button>
          {lightbox.tipo === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt="adjunto" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: '8px', objectFit: 'contain' }} />
          ) : (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', maxWidth: '900px', height: '88vh', background: 'var(--surface)', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* via proxy de nuestro origen: Railway bloquea el embed directo */}
              <iframe src={`/api/whatsapp/file?url=${encodeURIComponent(lightbox.url)}`} title="PDF" style={{ flex: 1, width: '100%', border: 'none' }} />
              <a href={lightbox.url} target="_blank" rel="noreferrer" style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}>Abrir / descargar en pestaña nueva →</a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
