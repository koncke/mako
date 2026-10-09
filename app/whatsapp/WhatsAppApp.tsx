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
import Link from '@/app/_ui/Link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dropdown } from '../components/Dropdown';
import { EmojiPicker } from './EmojiPicker';
import { Icon } from '../_components/icons';
import { WhatsAppAdvisor } from './WhatsAppAdvisor';
import { EvolutionConnect } from './EvolutionConnect';
import { ChatwootWebhookChip } from './ChatwootWebhookChip';
import { EmpresaInbox } from './EmpresaInbox';
import { crearLeadDesdeWhatsappAction } from '../crm/actions';
import { BotonAgregarAlCrm } from './_shared/BotonAgregarAlCrm';
import { Toast, useToast } from '@/app/_ui/Toast';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';
import { useNotifications, type Contacto } from '../_components/NotificationsProvider';
import { AudioPlay } from './_shared/AudioPlay';
import { PanelBorradores } from './_shared/PanelBorradores';

// Modal de detalle/edición del lead — el MISMO del CRM (LeadDetail vía wrapper).
// Se carga on-demand (ssr:false) igual que en app/_components/Desglose.tsx.
const LeadEditModal = dynamic(() => import('../crm/LeadEditModal').then((m) => m.LeadEditModal), { ssr: false });

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

/**
 * ⚠️ `productos` ES OBLIGATORIO, y no por prolijidad: son los productos del «+ Agregar al CRM»
 * (`null` = no se pudieron leer). La bandeja se monta desde DOS lugares —page.tsx y el cierre
 * del wizard, OnboardingCanalWhatsApp.tsx— y con la prop opcional el segundo la dejaba caer
 * sin que nada fallara: el botón volvía al clic único y el lead nacía en el principal.
 */
export function WhatsAppApp({ puedeChatbot = true, mostrarOficial = true, puedeAgregarLinea = false, productos }: { puedeChatbot?: boolean; mostrarOficial?: boolean; puedeAgregarLinea?: boolean; productos: ProductoParaAlta[] | null }) {
  // useSearchParams (deep-link ?chat=) exige un boundary de Suspense en la página.
  return (
    <Suspense fallback={null}>
      <WhatsAppInner puedeChatbot={puedeChatbot} mostrarOficial={mostrarOficial} puedeAgregarLinea={puedeAgregarLinea} productos={productos} />
    </Suspense>
  );
}

/** Una línea del no oficial, tal como la dibuja el desplegable. */
type LineaWa = { linea: string; rotulo: string; estado: string; esDefault: boolean };
const AGREGAR_LINEA = '__agregar_linea__';

function WhatsAppInner({ puedeChatbot, mostrarOficial, puedeAgregarLinea, productos }: { puedeChatbot: boolean; mostrarOficial: boolean; puedeAgregarLinea: boolean; productos: ProductoParaAlta[] | null }) {
  // La tab es SOLO conversaciones: las secuencias viven en /chatbot, que lee las mismas
  // filas de `nutricion_secuencias`. Tener el mismo tablero en dos pantallas era la
  // forma mas facil de que una quedara vieja.
  const router = useRouter();
  // Modales de conexion de cada canal: los abre el boton de la tab cuando esta caido.
  const [modalNoOficial, setModalNoOficial] = useState(false);
  const [modalOficial, setModalOficial] = useState(false);
  // `null` = todavia no se sabe si el canal oficial tiene un problema.
  const [oficialProblema, setOficialProblema] = useState<boolean | null>(null);
  // Canal del inbox de Conversaciones: 'oficial' (Chatwoot/Bot) o 'empresa'
  // (no oficial/Evolution, leído del espejo en nuestra DB).
  // Sin canal oficial (lo normal desde la tarea #832), la tab ES el no oficial: arranca
  // ahí y el botón del oficial no se dibuja.
  const [canal, setCanal] = useState<'oficial' | 'empresa'>(mostrarOficial ? 'oficial' : 'empresa');

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


  // Interruptor de envío real de WhatsApp del workspace (tarea #5). El estado
  // del flag lo ve cualquiera (viene en el GET de secuencias); el toggle solo
  // lo tiene el admin (/api/whatsapp/envio responde 403 al resto).
  const [envioWaOn, setEnvioWaOn] = useState<boolean | null>(null);
  // Estado del número no oficial, que lo sabe el chip de al lado. `null` = no se
  // sabe todavía, y con `null` acá NO se acusa nada: es la misma regla de tres
  // estados que ese chip aplica adentro. Ver el ⚠️ del rótulo «Envío real».
  const [canalNoOficial, setCanalNoOficial] = useState<'desconectado' | 'conectando' | 'conectado' | 'error' | null>(null);

  // ── Las líneas del no oficial (06/10/2026: varios números por negocio) ──────────────
  // Pedido de Martín: «es la misma dinámica que "Productos" en el CRM… un desplegable que
  // cambiaría el chat». La línea vive en la URL (`?linea=`), como el producto en el CRM: así
  // el link que se copia abre el chat de ESE número. Sin `?linea=`, la de por default.
  const [lineas, setLineas] = useState<LineaWa[]>([]);
  const [agregando, setAgregando] = useState(false);
  const [avisoLineas, setAvisoLineas] = useState<string | null>(null);
  // ⚠️ LA BANDEJA ESPERA A LA LISTA. Sin línea, la bandeja lee el espejo ENTERO: con dos números
  // mostraría los dos mezclados y una respuesta saldría por la de por default. Así que siempre
  // recibe una línea explícita — y montarla antes de saber cuál la cargaría dos veces.
  const [lineasCargadas, setLineasCargadas] = useState(false);
  // ⚠️ «No pude leer la lista» no es «no hay líneas». Con dos números y la lista caída, la bandeja
  // se montaba SIN línea: leía el espejo entero (los dos números fundidos) y contestaba por la de
  // por default. Sin lista no hay bandeja: se dice y se ofrece reintentar.
  const [lineasError, setLineasError] = useState(false);
  const recargarLineas = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/evolution/mensajes?lineas=1', { cache: 'no-store' });
      const j = (await r.json()) as { ok: boolean; lineas?: LineaWa[] };
      if (j.ok) { setLineas(j.lineas ?? []); setLineasError(false); } else setLineasError(true);
    } catch { setLineasError(true); }
    finally { setLineasCargadas(true); }
  }, []);
  useEffect(() => { void recargarLineas(); }, [recargarLineas]);
  const [caidaNoOficial, setCaidaNoOficial] = useState<{ desvinculado: boolean; fecha: string | null } | null>(null);
  const onEstadoNoOficial = useCallback((e: 'desconectado' | 'conectando' | 'conectado' | 'error' | null, c?: { desvinculado: boolean; fecha: string | null }) => {
    setCanalNoOficial(e);
    setCaidaNoOficial(c ?? null);
  }, []);
  /**
   * UN SOLO predicado para «este número no manda nada», y lo usan el botón que titila y el
   * chip del interruptor. Estaban separados y se contradecían en pantalla: el botón en rojo
   * al lado del chip verde diciendo «Chatbot: ON».
   *
   * ⚠️ 'error' (no se pudo comprobar) NO acusa: es el `null` de la regla de tres estados. Un
   * 500 de nuestra propia API pintaba de rojo un canal sano. Y 'conectando' SÍ acusa cuando
   * WhatsApp desvinculó el dispositivo: esa sesión se queda en `conectando` para siempre.
   */
  const canalCaido = canalNoOficial === 'desconectado' || (canalNoOficial === 'conectando' && caidaNoOficial?.desvinculado === true);
  const [envioAdmin, setEnvioAdmin] = useState(false);
  const [envioBusy, setEnvioBusy] = useState(false);
  const [envioErr, setEnvioErr] = useState<string | null>(null);
  const [plantillaTarget, setPlantillaTarget] = useState<string | null>(null); // deep-link desde el pop-up de aprobación
  const [plantillaSeed, setPlantillaSeed] = useState<{ objetivo: string; etapa: string } | null>(null); // pre-carga el redactor de MaKo desde el asesor
  const [now, setNow] = useState(0); // reloj para el contador de la ventana de 24h (tick cada 30s)

  const [detalleLeadId, setDetalleLeadId] = useState<number | null>(null);
  // Plan #381: crear el lead en el CRM desde una conversación sin lead vinculado.
  const [creandoLead, setCreandoLead] = useState(false);
  // Los productos del alta. Arranca con los del server y el server los puede CORREGIR: si la
  // pantalla no los pudo leer (o quedó vieja) y hay dos o más, el alta no crea y devuelve la
  // lista (`elegir`), y desde ahí el botón pregunta.
  const [productosAlta, setProductosAlta] = useState(productos);
  const { toast: avisoAlta, show: mostrarAvisoAlta, clear: limpiarAvisoAlta } = useToast();

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
      setEnvioErr('Sin conexión — prueba de nuevo');
    } finally {
      setEnvioBusy(false);
    }
  };

  // ── Carga inicial: las plantillas de Meta (para responder fuera de la ventana de
  // 24 h) y el interruptor del chatbot. Las SECUENCIAS ya no se cargan acá: se
  // administran en /chatbot, que lee las mismas filas.
  useEffect(() => {
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
  }, []);

  // Al salir de /whatsapp, ningún chat queda "abierto" → el provider vuelve a
  // notificar TODOS los contactos (sin esto, el último chat abierto se silencia).
  useEffect(() => () => setOpenChat(null), [setOpenChat]);

  /**
   * El canal vive en la URL, y la URL se ACTUALIZA al cambiar de canal.
   *
   * Los dos inbox comparten la ruta /whatsapp, así que sin esto la barra de direcciones decía
   * lo mismo estando en uno o en el otro: copiar el link y mandárselo a alguien lo dejaba
   * siempre en el oficial. Ahora `?canal=oficial` / `?canal=no-oficial` es el link correcto.
   *
   * `empresa` se sigue aceptando: es el valor que usan los avisos y los links ya mandados.
   */
  useEffect(() => {
    const c = searchParamsWA.get('canal');
    if (c === 'empresa' || c === 'no-oficial' || c === 'no_oficial') setCanal('empresa');
    else if (c === 'oficial' && mostrarOficial) setCanal('oficial');
  }, [searchParamsWA]);

  const lineaPedida = searchParamsWA.get('linea');
  // ⚠️ Una `?linea=` que no está en la lista (otra cuenta, una línea que se fue) NO se usa: se
  // cae a la de por default. La lista sale de una lectura con el scope del workspace, y el
  // servidor vuelve a validar la línea en cada envío.
  const lineaActiva: LineaWa | null = lineas.find((l) => l.linea === lineaPedida)
    ?? lineas.find((l) => l.esDefault) ?? lineas[0] ?? null;
  const irALinea = useCallback((linea: string) => {
    const p = new URLSearchParams(searchParamsWA.toString());
    p.set('linea', linea);
    // Lo que se abre pertenece a la línea de la que se sale (misma regla que `irACanal`).
    p.delete('chat'); p.delete('lead'); p.delete('n');
    router.replace(`/whatsapp?${p.toString()}`, { scroll: false });
  }, [router, searchParamsWA]);
  // ⚠️ DOS PREGUNTAS DISTINTAS. El estado de la línea que se MIRA decide QR o bandeja; el de la
  // línea por la que MANDA el chatbot (la de por default) decide la alarma del botón y el chip
  // «Chatbot: ON». Juntas, mirar la línea 2 viva con la 1 caída dejaba el chip en verde sin que
  // saliera nada, y mirar una línea extra caída hacía titilar todo en rojo con el chatbot andando.
  // Mirando la de por default (o con un solo número) manda la sonda, que es lo medido; mirando
  // otra, la fila de la de por default.
  const lineaDefault = lineas.find((l) => l.esDefault) ?? lineas[0] ?? null;
  const viendoLaDefault = !lineaActiva || !lineaDefault || lineaActiva.linea === lineaDefault.linea;
  const caidoQueManda = viendoLaDefault ? canalCaido : (lineaDefault.estado !== 'conectado' && lineaDefault.estado !== 'conectando');
  const noOficialOk = !caidoQueManda;
  const onLineaCreada = useCallback((linea: string) => {
    setAgregando(false);
    void recargarLineas().then(() => irALinea(linea));
  }, [recargarLineas, irALinea]);
  const onLineasCambiaron = useCallback((movidas?: number) => {
    void recargarLineas();
    setAvisoLineas(movidas ? `${movidas} secuencia${movidas === 1 ? '' : 's'} pasan a la línea por default` : null);
  }, [recargarLineas]);

  const irACanal = useCallback((c: 'oficial' | 'empresa') => {
    setCanal(c);
    const p = new URLSearchParams(searchParamsWA.toString());
    p.set('canal', c === 'empresa' ? 'no-oficial' : 'oficial');
    // `chat`, `lead` y `tpl` son «abrí ESTO», y lo que se abre pertenece al canal del que se
    // está saliendo: arrastrarlos al otro canal reabriría una conversación que no está ahí.
    // `n` es el cache-buster de los avisos y no tiene por qué viajar en un link que se comparte.
    for (const k of ['chat', 'lead', 'tpl', 'stab', 'n']) p.delete(k);
    // `replace` y no `push`: alternar entre los dos canales no tiene que llenar el historial
    // de pasos que el botón «atrás» después hay que deshacer uno por uno.
    router.replace(`/whatsapp?${p.toString()}`, { scroll: false });
  }, [router, searchParamsWA]);

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
      // Las plantillas de Meta se mudaron a /chatbot con las secuencias. Los avisos
      // viejos siguen mandando a /whatsapp?stab=plantillas: se redirige en vez de
      // dejar al usuario en una pantalla que ya no tiene eso.
      if (searchParamsWA.get('stab') === 'plantillas') {
        lastSearchRef.current = s;
        const tpl = searchParamsWA.get('tpl');
        router.replace(`/chatbot?stab=plantillas${tpl ? `&tpl=${encodeURIComponent(tpl)}` : ''}`);
        return;
      }
      const target = searchParamsWA.get('chat');
      if (target && contactos.some((c) => c.id === target)) {
        lastSearchRef.current = s;
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
          setSelId(c.id);
          setLeadSinChat(null);
          return;
        }
        // Sin chat vinculado: NO caer al primer chat (era el bug de abrir el
        // chat de otra persona) — mostrar el aviso y no seleccionar nada.
        if (contactos.length) {
          lastSearchRef.current = s;
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
    if (!blob.size) { if (enEseChat()) setSendError('La grabación quedó vacía, prueba de nuevo.'); setAudioFase(null); setAudioFaseGid(null); return; }
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
      setSendError('No se pudo acceder al micrófono. Revisa los permisos.');
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
      if (cancelled || !blob.size) { if (!cancelled) setSendError('La grabación quedó vacía, prueba de nuevo.'); return; }
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

  // ── Derivados ──
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
  /**
   * El alta de la bandeja OFICIAL, con el producto (`null` = no se eligió: decide el server).
   * Es la misma respuesta que en la no oficial (EmpresaInbox.tsx, `agregarAlCrm`).
   */
  async function agregarAlCrmOficial(funnelId: number | null) {
    if (!sel?.telefono) return;
    setCreandoLead(true);
    try {
      const r = await crearLeadDesdeWhatsappAction(sel.contacto || 'Contacto', sel.telefono, funnelId);
      // Ya estaba en el CRM: con UN solo candidato se abre ÉSE —lo identifica
      // el teléfono, la misma llave con la que la conversación busca su lead—.
      // Con varios no se elige el primero: se dice con quién choca.
      if ('id' in r) { setDetalleLeadId(r.id); return; }
      if (r.elegir) { setProductosAlta(r.elegir); mostrarAvisoAlta('Elige el producto'); return; }
      const ya = r.coincidencias.length === 1 ? r.coincidencias[0] : null;
      if (!ya) { alert(r.error); return; }
      if (r.agregadoA) mostrarAvisoAlta(`Ya estaba · ahora en ${r.agregadoA}`);
      else if (r.errorAlAgregar) alert(r.errorAlAgregar);
      setDetalleLeadId(ya.id);
    } catch (e) {
      alert(`No se pudo agregar al CRM: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setCreandoLead(false);
    }
  }
  const ventanaAbierta = sel?.ventanaAbierta ?? false;
  // Vencimiento de la ventana del chat abierto: 24h tras el último mensaje ENTRANTE
  // del hilo (exacto, aun si respondimos último); si no hay hilo, el del provider.
  const ventanaVenceSel = (() => {
    if (!ventanaAbierta) return null;
    for (let i = mensajes.length - 1; i >= 0; i--) { if (!mensajes[i].saliente && mensajes[i].fecha) return mensajes[i].fecha! + 86400; }
    return sel?.ventanaVenceAt ?? null;
  })();
  const templatesInbox = templates.filter((t) => t.params.length <= 1); // autollenables con {{nombre}}

  const tabActive: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, background: 'var(--ink)', color: 'var(--on-ink)' };
  const tabIdle: CSSProperties = { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 500, background: 'transparent', color: 'var(--dim)' };
  const oficialUnread = contactos.reduce((s, c) => s + c.sinLeer, 0);
  // El boton ES el indicador. `blinkRed` ya es el tintineo de alarma del resto de la app
  // (cuotas vencidas, datos sin marcar): misma senal, mismo significado.
  // El aviso va por CLASE, no por `animation` inline: `blinkRed` anima la OPACIDAD y dejaba
  // la etiqueta en 1,75:1 sobre el fondo claro, y encima `prefers-reduced-motion` no lo
  // podia apagar. `mk-tab-alarma` late en el borde y la sombra, y con movimiento reducido
  // se queda quieta en rojo fijo — que sigue diciendo lo mismo.
  const avisoRojo: CSSProperties = { border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)' };
  const badgeCanal: CSSProperties = { minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--bad)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
  const chipBtn = (active: boolean): CSSProperties => ({ padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12px', fontWeight: 600, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border)'), background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100dvh', maxHeight: '100dvh', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '30px 36px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="whatsapp" size={34} /></span>
            <h1 style={{ fontWeight: 600, fontSize: '40px', letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>WhatsApp</h1>
            {/* Los dos canales ya no tienen chip: el aviso es el BOTON de su tab, que
                titila en rojo, y al entrar se abre su pantalla de conexion. Los
                componentes siguen montados porque aca viven el sondeo, el QR y la
                reparacion del espejo — sin ellos la tab no sabria si el canal esta vivo. */}
            {/* Sólo con el canal oficial: el sondeo le pega a Chatwoot, que está apagado
                desde el 09/10/2026 (lib/chatwoot.ts). */}
            {mostrarOficial && <ChatwootWebhookChip ocultarChip abierto={modalOficial} onAbierto={setModalOficial} onSalud={setOficialProblema} />}
            {envioAdmin && envioWaOn != null && (
              <button onClick={() => void toggleEnvioWa()} disabled={envioBusy} aria-pressed={envioWaOn}
                title={
                  !envioWaOn ? 'El chatbot no envía: los pasos de las secuencias quedan esperando — clic para activar'
                    : caidoQueManda ? 'El interruptor está encendido, pero tu WhatsApp no oficial está desconectado: no sale nada. Entra a la tab «No Oficial» para volver a vincularlo.'
                      : 'El chatbot manda WhatsApps reales — clic para pausar'
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px', borderRadius: '999px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, border: '1px solid ' + (envioWaOn ? (caidoQueManda ? 'var(--warn)' : 'var(--good)') : 'var(--border-strong)'), background: envioWaOn ? (caidoQueManda ? 'var(--warn-bg)' : 'var(--good-bg)') : 'var(--surface)', color: envioWaOn ? (caidoQueManda ? 'var(--warn)' : 'var(--good)') : 'var(--dim)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: envioWaOn ? (caidoQueManda ? 'var(--warn)' : 'var(--good)') : 'var(--faint)' }} />
                {/* ⚠️ «Envío real: ON» AFIRMABA LA MITAD BUENA DE UN PROCESO DE DOS
                    PASOS, que es la regla que este repo ya tiene escrita («llegó el
                    formulario ✓» sin decir si ENTRÓ). Para que salga un mensaje hacen
                    falta DOS cosas: el interruptor encendido Y el número conectado. El
                    chip mostraba sólo la primera, en verde, mientras la segunda estaba
                    caída hacía cinco días — y el dueño leyó la barra y dijo «acá me
                    dice que está todo conectado».
                    Ahora, con el canal caído, el mismo chip dice qué falta. No se
                    apaga: el interruptor SÍ está en ON, y mentir en la otra dirección
                    haría que lo prendiera de nuevo sin efecto. */}
                Chatbot: {envioWaOn ? (caidoQueManda ? 'ON, pero el número está caído' : 'ON') : 'OFF'}
              </button>
            )}
            {envioErr && <span style={{ fontSize: '12px', color: 'var(--bad)' }}>{envioErr}</span>}
          </div>
        </div>
        {/* Los dos canales, en el lugar donde antes estaban Conversaciones/Secuencias.
            El boton ES el indicador: titila en rojo cuando ese canal esta caido, y al
            entrar se abre su pantalla de conexion (el QR grande, en el no oficial). */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          {mostrarOficial && <button onClick={() => { if (canal === 'oficial' && oficialProblema) setModalOficial(true); else irACanal('oficial'); }}
            title={oficialProblema ? 'La detección de respuestas no está activa — toca para arreglarla' : 'Número oficial de Meta: el verificado, para el tráfico frío de los anuncios'}
            className={oficialProblema ? 'mk-tab-alarma' : undefined}
            style={{ ...(canal === 'oficial' ? tabActive : tabIdle), ...(oficialProblema ? avisoRojo : null), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            Oficial{oficialUnread > 0 && <span style={badgeCanal}>{oficialUnread}</span>}
          </button>}
          <button onClick={() => { if (canal === 'empresa' && canalNoOficial === 'conectado') setModalNoOficial(true); else irACanal('empresa'); }}
            title={noOficialOk ? 'El número que usa el chatbot. Tócalo de nuevo para sincronizar, desconectar o borrar el historial.' : 'Tu WhatsApp no oficial está desconectado: el chatbot no manda nada. Entra para volver a vincularlo.'}
            className={noOficialOk ? undefined : 'mk-tab-alarma'}
            style={{ ...(canal === 'empresa' ? tabActive : tabIdle), ...(noOficialOk ? null : avisoRojo), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            No Oficial{noOficialUnread > 0 && <span style={badgeCanal}>{noOficialUnread}</span>}
          </button>
        </div>
        {/* El número de la bandeja. Se dibuja con DOS líneas o más, o con una si quien mira
            puede agregar otra: ahí es la puerta a «Agregar otro número». Con una sola línea y
            sin permiso, un desplegable de una opción no elige nada. */}
        {canal === 'empresa' && lineaActiva && (lineas.length > 1 || puedeAgregarLinea) && (
          <Dropdown
            value={agregando ? AGREGAR_LINEA : lineaActiva.linea}
            width={200}
            ariaLabel="Número de WhatsApp de la bandeja"
            options={[
              // La que se está mirando primero, como el producto en el CRM.
              ...[lineaActiva, ...lineas.filter((l) => l.linea !== lineaActiva.linea)].map((l) => ({
                value: l.linea, label: l.rotulo,
                // El punto dice si esa línea puede mandar: el color nunca va solo, el rótulo
                // del desplegable de cerrado lo repite en el `title` del botón del canal.
                color: l.estado === 'conectado' ? 'var(--good)' : 'var(--warn)',
              })),
              ...(puedeAgregarLinea ? [{ value: AGREGAR_LINEA, label: 'Agregar otro número', crear: true }] : []),
            ]}
            onChange={(v) => {
              setAvisoLineas(null);
              // El modal de gestión es de la línea que se deja: abierto, se volvería a abrir solo
              // sobre la siguiente apenas cargue «conectado».
              setModalNoOficial(false);
              if (v === AGREGAR_LINEA) { setAgregando(true); return; }
              setAgregando(false);
              irALinea(v);
            }}
          />
        )}
        {avisoLineas && <span style={{ fontSize: '12px', color: 'var(--dim)' }}>{avisoLineas}</span>}
      </header>

      {/* ============= CONVERSACIONES — EMPRESA (no oficial, espejo en DB) ============= */}
      {/* Canal no oficial: o la bandeja, o la pantalla de conexión EN SU LUGAR. Nunca un
          pop-up encima de los chats: el que entra rápido lo cierra y se queda sin saber
          que el número no manda nada. El componente queda montado siempre —también con la
          otra tab a la vista— porque de él sale el estado que hace titilar el botón. */}
      {/* `key` por línea: cambiar de número es otro panel, sin el estado ni el QR del anterior. */}
      {lineasCargadas && <EvolutionConnect key={`conexion-${lineaActiva?.linea ?? 'default'}`} linea={lineaActiva?.linea ?? null}
        inline panelVisible={canal === 'empresa' && !agregando} abierto={modalNoOficial} onAbierto={setModalNoOficial} onEstado={onEstadoNoOficial}
        onLineasCambiaron={onLineasCambiaron} />}
      {/* «Agregar otro número»: el QR de una línea NUEVA en el lugar de los chats. Sin
          `onEstado`: su «todavía no conectada» no es el estado del número que manda, y si lo
          fuera el botón del canal titilaría en rojo mientras la persona escanea. */}
      {canal === 'empresa' && agregando && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <EvolutionConnect key="nueva-linea" nueva inline panelVisible onLineaCreada={onLineaCreada} />
          <button onClick={() => setAgregando(false)}
            style={{ alignSelf: 'center', background: 'none', border: 'none', color: 'var(--dim)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>Cancelar</button>
        </div>
      )}
      {/* La bandeja y el panel de conexión son excluyentes, y el corte es CONECTADO, no
          «no está caído»: con el número a medio vincular manda la pantalla del QR.
          Mientras no se sabe (null) se muestra la bandeja: el panel todavía no existe. */}
      {canal === 'empresa' && lineasError && !lineas.length && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--ink)', fontWeight: 600 }}>No pude cargar tus números</div>
          <button onClick={() => void recargarLineas()}
            style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}
      {canal === 'empresa' && lineasCargadas && !(lineasError && !lineas.length) && !agregando && (canalNoOficial == null || canalNoOficial === 'conectado') && (
        <EmpresaInbox key={`bandeja-${lineaActiva?.linea ?? 'default'}`} puedeChatbot={puedeChatbot} linea={lineaActiva?.linea ?? null} productos={productos} />
      )}

      {/* ============= CONVERSACIONES — BOT OFICIAL (Chatwoot) ============= */}
      {canal === 'oficial' && (
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
              {/* La cola de borradores también acá: antes vivía solo en el inbox del
                  número de empresa, así que en un workspace del canal oficial se
                  redactaba y no había dónde verla. El botón de enviar lo dibuja el
                  panel solo si el servidor dice que hay por dónde. */}
              <PanelBorradores onEnviado={() => { if (sel) void refetchHilo(sel); }} />
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
                  ? 'Este lead todavía no tiene chat de WhatsApp vinculado. Cuando tenga teléfono con conversación, se abre aquí solo.'
                  : 'Elige una conversación'}
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
                                  <AudioPlay key={ai} src={a.url} style={{ width: '240px' }} />
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
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarComposer(); } }} placeholder={adjunto ? 'Agrega un texto (opcional)…' : 'Escribe un mensaje…'} rows={1} style={{ flex: 1, minHeight: '40px', maxHeight: '120px', resize: 'none', padding: '9px 16px', borderRadius: '21px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '14px', lineHeight: 1.35, outline: 'none' }} />
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
                          placeholder="Elige una plantilla…"
                          width="100%"
                          ariaLabel="Plantilla de WhatsApp"
                          buttonStyle={{ height: 44, padding: '0 12px', borderRadius: 12, background: 'var(--surface-2)', fontWeight: 400, fontSize: 14 }}
                          options={[
                            { value: '', label: 'Elige una plantilla…' },
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
            ) : sel?.telefono ? (
              // Plan #381: el contacto no está en el CRM → alta directa con nombre + teléfono,
              // y con 2+ productos el mismo clic pregunta en cuál (pedido de Leila, 08/10/2026).
              <BotonAgregarAlCrm productos={productosAlta} creando={creandoLead} onAgregar={(fid) => void agregarAlCrmOficial(fid)} />
            ) : (
              <Link href="/crm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Buscar en CRM →</Link>
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
                grupo={{ id: sel.id, contacto: sel.contacto, empresa: sel.empresa, etapaLabel: sel.etapaLabel, leadId: sel.leadId }}
                mensajes={mensajes}
                ventanaAbierta={ventanaAbierta}
                onUsar={(t) => setDraft(draft.trim() ? `${draft.replace(/\s+$/, '')}\n\n${t}` : t)}
                onRedactarPlantilla={puedeChatbot ? (seed) => router.push(`/chatbot?stab=plantillas${seed ? `&obj=${encodeURIComponent(seed.objetivo)}&etapa=${encodeURIComponent(seed.etapa)}` : ''}`) : undefined}
                quickTemplates={QUICK}
              />
            ) : (
              <div style={{ fontSize: '12.5px', color: 'var(--faint)', lineHeight: 1.5 }}>Elige una conversación para que MaKo te sugiera qué escribir.</div>
            )}
          </div>
        </div>
      )}

      {/* Las SECUENCIAS y las PLANTILLAS de Meta se mudaron a /chatbot: son las mismas
          filas de `nutricion_secuencias` y tenerlas en dos pantallas garantizaba que una
          quedara vieja. Esta tab quedo con una sola cosa: las conversaciones. */}

      {/* DETALLE DEL LEAD — el MISMO modal editable del CRM (LeadDetail) */}
      {detalleLeadId != null && (
        <LeadEditModal leadId={detalleLeadId} onClose={() => setDetalleLeadId(null)} />
      )}
      {/* El acuse del alta («Ya estaba · ahora en X»): va por ENCIMA de la ficha (z 600 contra 80). */}
      <Toast state={avisoAlta} onClose={limpiarAvisoAlta} />

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
