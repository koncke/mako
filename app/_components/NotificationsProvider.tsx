'use client';

// =============================================================================
// Notificaciones globales de WhatsApp — corren en TODA la app (montado en el
// layout). Hace UN solo polling de Chatwoot: alimenta el badge del sidebar, el
// sonido y el pop-up, y expone los contactos para que la tab /whatsapp los use
// (sin duplicar el polling). Si llega un mensaje navegando por cualquier lado de
// la app, suena + salta el pop-up para ir directo al chat.
// =============================================================================

import {
  createContext, useContext, useEffect, useRef, useState,
  type Dispatch, type SetStateAction, type MutableRefObject, type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isPublicLandingPath } from './PublicRouteGate';
import { inAppActivo, type NotifInApp } from '@/lib/notif-catalogo';

/**
 * Aviso de que alguien acaba de guardar sus preferencias en Configuraciones ›
 * Notificaciones. Sin esto habría que recargar para que el cambio se note, y
 * apagar un sonido que sigue sonando parece que no funcionó.
 */
export const EVENTO_PREFS_IN_APP = 'mako:notif-inapp';

export interface Contacto {
  id: string;
  convIds: number[];
  sendContactId: number;
  contacto: string;
  telefono: string | null;
  avatar: string | null;
  bloqueado: boolean;
  ultimoMensaje: string | null;
  ultimaActividad: number;
  sinLeer: number;            // sintético: 1 = tiene mensaje nuevo sin leer, 0 = leído
  ultimoEntrante: boolean;    // el último mensaje es del lead (entrante)
  ventanaAbierta: boolean;
  ventanaVenceAt: number | null; // unix secs cuando vence la ventana de 24h (o null)
  leadId: number | null;
  empresa: string | null;
  estadoLead: string | null;
  etapaKey: string | null;
  etapaLabel: string | null;
  /** Lead del CRM que todavía NO tiene chat en Chatwoot: aparece en la lista,
      pero el contacto se crea recién al escribirle (no ensuciamos el inbox). */
  sinChat?: boolean;
}

interface NotifCtx {
  contactos: Contacto[];
  setContactos: Dispatch<SetStateAction<Contacto[]>>;
  unreadTotal: number;
  loadingConvs: boolean;
  openChatRef: MutableRefObject<string | null>;
  setOpenChat: (id: string | null) => void;
  marcarLeido: (gid: string, sendContactId: number) => void;
  goToChat: (gid: string) => void;
  // Canal NO oficial (Evolution):
  noOficialUnread: number;
  marcarLeidoNoOficial: (chatJid: string) => void;
  setOpenChatNoOficial: (chatJid: string | null) => void;
  /** Preferencias de pop-up/sonido de esta persona (null = todavía cargando). */
  inApp: NotifInApp | null;
}

const Ctx = createContext<NotifCtx | null>(null);
export function useNotifications(): NotifCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNotifications fuera del NotificationsProvider');
  return c;
}

// ── Sonido de notificación ────────────────────────────────────────────────────
// Un único AudioContext (se reanuda en el primer gesto del usuario por la autoplay
// policy) y el mp3 de /notif.mp3 precargado a un AudioBuffer, así suena al instante
// y aun estando en otra pestaña/sección de la app. Si falla, cae a un beep simple.
let _audioCtx: AudioContext | null = null;
let _notifBuf: AudioBuffer | null = null;
let _notifLoading = false;

function ctxOf(): AudioContext | null {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    if (!_audioCtx) _audioCtx = new C();
    return _audioCtx;
  } catch { return null; }
}
function loadNotif() {
  const ctx = ctxOf();
  if (!ctx || _notifBuf || _notifLoading) return;
  _notifLoading = true;
  void fetch('/notif.mp3')
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => { _notifBuf = buf; })
    .catch(() => {})
    .finally(() => { _notifLoading = false; });
}
function unlockAudio() {
  const ctx = ctxOf();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  loadNotif(); // precargar el sample tras el primer gesto
}
function playBeep() {
  const ctx = ctxOf();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  if (_notifBuf) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = _notifBuf;
      const gain = ctx.createGain();
      gain.gain.value = 0.9;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return;
    } catch { /* cae al beep */ }
  } else {
    loadNotif(); // por si todavía no se cargó
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch { /* sin audio */ }
}

// Acorde de varias notas (para sonidos distintos al del mensaje).
function playChord(notas: Array<[number, number]>, tipo: OscillatorType = 'triangle') {
  const ctx = ctxOf();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  try {
    for (const [freq, t] of notas) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tipo;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + t;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.26, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      osc.start(start);
      osc.stop(start + 0.22);
    }
  } catch { /* sin audio */ }
}
// Aprobada: chime ascendente alegre (do-mi-sol). Rechazada: dos notas descendentes.
function playApproval() { playChord([[660, 0], [880, 0.12], [1175, 0.24]]); }
function playRejected() { playChord([[440, 0], [311, 0.18]], 'sine'); }

function initials(name: string): string {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}

// ── Estado de "leído" propio ──────────────────────────────────────────────────
// El unread_count de Chatwoot viene SIEMPRE en 0 en este WABA (el agent_last_seen
// se mantiene al día desde el dashboard/la app), así que es inservible para saber
// qué está sin leer. Lo resolvemos del lado del cliente: por cada chat guardamos
// hasta qué `last_activity_at` ya leímos. Un chat está SIN LEER si su último
// mensaje es entrante y su actividad supera ese marcador. Persistimos en
// localStorage para que sobreviva recargas.
const LEIDO_KEY = 'mako-wa-leido';
function cargarLeido(): Map<string, number> {
  try {
    const raw = localStorage.getItem(LEIDO_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, number>));
  } catch { return new Map(); }
}
function guardarLeido(m: Map<string, number>) {
  try { localStorage.setItem(LEIDO_KEY, JSON.stringify(Object.fromEntries(m))); } catch { /* sin storage */ }
}
function tieneSinLeer(c: Contacto, leido: Map<string, number>): boolean {
  return c.ultimoEntrante && c.ultimaActividad > (leido.get(c.id) ?? 0);
}

// Igual, para el canal NO oficial (Evolution): "leído hasta" por chatJid, en su
// propia key (la actividad es un ms de Date.parse de la última fecha del chat).
const EMPRESA_LEIDO_KEY = 'mako-wa-empresa-leido';
function cargarLeidoEmpresa(): Map<string, number> {
  try {
    const raw = localStorage.getItem(EMPRESA_LEIDO_KEY);
    return raw ? new Map(Object.entries(JSON.parse(raw) as Record<string, number>)) : new Map();
  } catch { return new Map(); }
}
function guardarLeidoEmpresa(m: Map<string, number>) {
  try { localStorage.setItem(EMPRESA_LEIDO_KEY, JSON.stringify(Object.fromEntries(m))); } catch { /* sin storage */ }
}
type ConvNoOf = { chatJid: string; nombre: string; ultimaFecha: string | null; ultimoEntrante: boolean };

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [toast, setToast] = useState<{ gid: string; nombre: string; avatar: string | null; canal?: 'empresa' } | null>(null);
  const [tplToast, setTplToast] = useState<{ tipo: 'ok' | 'rej'; name: string; motivo?: string } | null>(null);
  const [noOficialUnread, setNoOficialUnread] = useState(0);
  const [inApp, setInApp] = useState<NotifInApp | null>(null);
  // Los pollings se montan una sola vez (deps []); leen las preferencias por ref
  // para no reiniciarse cada vez que alguien las cambia.
  const inAppRef = useRef<NotifInApp | null>(null);
  inAppRef.current = inApp;
  const dejaVer = (id: string) => inAppActivo(inAppRef.current, id, 'popup');
  const dejaSonar = (id: string) => inAppActivo(inAppRef.current, id, 'sonido');
  const noOfSnapRef = useRef<Map<string, number>>(new Map());   // chatJid → última actividad (ms) vista
  const noOfLeidoRef = useRef<Map<string, number>>(new Map());  // chatJid → leído hasta (ms)
  const noOfConvsRef = useRef<ConvNoOf[]>([]);                  // última lista (para recomputar unread)
  const noOfOpenRef = useRef<string | null>(null);             // chat no-oficial abierto (no notificar ni contar)
  const noOfBaselineRef = useRef(false);

  const openChatRef = useRef<string | null>(null);
  const activitySnapRef = useRef<Map<string, number>>(new Map());
  const leidoRef = useRef<Map<string, number>>(new Map()); // gid → last_activity ya leído
  const contactosRef = useRef<Contacto[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineReadyRef = useRef(false); // no notificar hasta tener la línea base
  const tickRef = useRef(0);               // cada N ticks, resync de la lista completa
  // Estado de plantillas en Meta: para avisar cuando una se aprueba/rechaza.
  const approvedSnapRef = useRef<Set<string>>(new Set());
  const rejectedSnapRef = useRef<Set<string>>(new Set());
  const tplBaselineRef = useRef(false);
  const tplToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  contactosRef.current = contactos;

  const unreadTotal = contactos.reduce((s, c) => s + c.sinLeer, 0) + noOficialUnread;

  const recomputeNoOf = () => {
    let u = 0;
    const open = noOfOpenRef.current;
    for (const c of noOfConvsRef.current) {
      if (c.chatJid === open) continue; // el chat abierto nunca cuenta como no leído
      const ts = c.ultimaFecha ? Date.parse(c.ultimaFecha) : 0;
      if (c.ultimoEntrante && ts > (noOfLeidoRef.current.get(c.chatJid) ?? 0)) u += 1;
    }
    setNoOficialUnread(u);
  };
  const marcarLeidoNoOficial = (chatJid: string) => {
    const ts = noOfSnapRef.current.get(chatJid) ?? Date.now();
    noOfLeidoRef.current.set(chatJid, ts);
    guardarLeidoEmpresa(noOfLeidoRef.current);
    recomputeNoOf();
  };
  // EmpresaInbox nos dice qué chat no-oficial está abierto → no notificamos ese
  // chat (ref propia, aislada del openChatRef del oficial) y lo damos por leído.
  const setOpenChatNoOficial = (chatJid: string | null) => {
    noOfOpenRef.current = chatJid;
    if (chatJid) {
      const ts = noOfSnapRef.current.get(chatJid) ?? Date.now();
      noOfLeidoRef.current.set(chatJid, ts);
      guardarLeidoEmpresa(noOfLeidoRef.current);
    }
    recomputeNoOf();
  };
  const goToChatNoOficial = (chatJid: string) => {
    setToast(null);
    noOfLeidoRef.current.set(chatJid, noOfSnapRef.current.get(chatJid) ?? Date.now());
    guardarLeidoEmpresa(noOfLeidoRef.current);
    router.push(`/whatsapp?canal=empresa&n=${Date.now()}`);
  };

  const setOpenChat = (id: string | null) => { openChatRef.current = id; };
  const marcarLeido = (gid: string, sendContactId: number) => {
    const g = contactosRef.current.find((c) => c.id === gid);
    // leído hasta la actividad actual del chat (o "ahora" si todavía no la tenemos).
    const hasta = g?.ultimaActividad ?? Math.floor(Date.now() / 1000);
    leidoRef.current.set(gid, hasta);
    guardarLeido(leidoRef.current);
    setContactos((prev) => prev.map((c) => (c.id === gid ? { ...c, sinLeer: 0 } : c)));
    void fetch(`/api/whatsapp/contacts/${sendContactId}/read`, { method: 'POST' }).catch(() => {});
  };
  const goToChat = (gid: string) => {
    setToast(null);
    // nonce → reabrir el MISMO chat (clic al pop-up otra vez) igual dispara la selección.
    router.push(`/whatsapp?chat=${encodeURIComponent(gid)}&n=${Date.now()}`);
  };
  const goToPlantilla = (name: string) => {
    setTplToast(null);
    router.push(`/whatsapp?stab=plantillas&tpl=${encodeURIComponent(name)}&n=${Date.now()}`);
  };

  // Carga inicial (lista completa) + baseline del snapshot. En /login y en la
  // landing pública /vsl no corre.
  useEffect(() => {
    if (pathname.startsWith('/login') || isPublicLandingPath(pathname)) { setLoadingConvs(false); return; }
    let alive = true;
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/conversations');
        const j = await r.json();
        const list: Contacto[] = j.ok ? j.contactos : [];
        if (!alive) return;
        const leido = cargarLeido();
        if (leido.size === 0) {
          // Primera vez en este navegador: tomamos TODO como leído (baseline) para no
          // spamear el badge con conversaciones viejas; sólo notificamos lo que llegue.
          for (const c of list) leido.set(c.id, c.ultimaActividad);
          guardarLeido(leido);
        }
        leidoRef.current = leido;
        setContactos(list.map((c) => ({ ...c, sinLeer: tieneSinLeer(c, leido) ? 1 : 0 })));
        for (const c of list) activitySnapRef.current.set(c.id, c.ultimaActividad);
        baselineReadyRef.current = true; // recién acá empezamos a NOTIFICAR
      } finally {
        if (alive) setLoadingConvs(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preferencias de pop-up/sonido de esta persona. Se recargan cuando las guarda
  // (evento del panel de Configuraciones) para que el cambio se note al instante.
  useEffect(() => {
    if (pathname.startsWith('/login') || isPublicLandingPath(pathname)) return;
    let alive = true;
    const cargar = () => {
      void fetch('/api/perfil/notif-inapp')
        .then((r) => r.json())
        .then((j) => { if (alive && j?.ok && j.inApp) setInApp(j.inApp as NotifInApp); })
        .catch(() => {});
    };
    cargar();
    window.addEventListener(EVENTO_PREFS_IN_APP, cargar);
    return () => { alive = false; window.removeEventListener(EVENTO_PREFS_IN_APP, cargar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desbloquear el audio en el primer gesto del usuario (autoplay policy).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Plantillas: detecta aprobaciones/rechazos en Meta y avisa (sonido + pop-up).
  const checkTemplates = async () => {
    try {
      const r = await fetch('/api/whatsapp/templates/status');
      const j = await r.json();
      if (!j.ok) return;
      const tpls = j.templates as Array<{ name: string; status: string; motivo?: string | null }>;
      const aprobadas = new Set(tpls.filter((t) => t.status === 'approved').map((t) => t.name));
      const rechazadas = new Set(tpls.filter((t) => t.status === 'rejected').map((t) => t.name));
      if (!tplBaselineRef.current) {
        approvedSnapRef.current = aprobadas;
        rejectedSnapRef.current = rechazadas;
        tplBaselineRef.current = true;
        return; // primera vez: sólo sembramos baseline, no notificamos
      }
      let nuevaOk: string | null = null;
      for (const n of aprobadas) if (!approvedSnapRef.current.has(n)) nuevaOk = n;
      let nuevaRej: string | null = null;
      for (const n of rechazadas) if (!rejectedSnapRef.current.has(n)) nuevaRej = n;
      approvedSnapRef.current = aprobadas;
      rejectedSnapRef.current = rechazadas;
      const mostrar = (tipo: 'ok' | 'rej', name: string, motivo?: string) => {
        setTplToast({ tipo, name, motivo });
        if (tplToastTimerRef.current) clearTimeout(tplToastTimerRef.current);
        // el rechazo se queda 9s (hay que leer el motivo); la aprobación 6s.
        tplToastTimerRef.current = setTimeout(() => setTplToast(null), tipo === 'rej' ? 9000 : 6000);
      };
      const suena = dejaSonar('wa-plantilla');
      const seVe = dejaVer('wa-plantilla');
      if (nuevaOk) { if (suena) playApproval(); if (seVe) mostrar('ok', nuevaOk); }
      else if (nuevaRej) {
        if (suena) playRejected();
        if (seVe) mostrar('rej', nuevaRej, tpls.find((t) => t.name === nuevaRej)?.motivo ?? undefined);
      }
    } catch { /* ignore */ }
  };

  // Polling GLOBAL cada 6s (sólo página 1: las novedades suben ahí).
  useEffect(() => {
    const tick = async () => {
      if (pathRef.current.startsWith('/login') || isPublicLandingPath(pathRef.current)) return; // sin sesión / landing pública: no polleamos
      try {
        tickRef.current += 1;
        // Status de plantillas: siembra al 1er tick, después ~cada 30s.
        if (tickRef.current === 1 || tickRef.current % 5 === 0) void checkTemplates();
        const full = tickRef.current % 10 === 0; // ~cada 60s resync de TODA la lista
        const r = await fetch(`/api/whatsapp/conversations${full ? '' : '?recent=1'}`);
        const j = await r.json();
        if (!j.ok) return;
        const recientes = j.contactos as Contacto[];
        const openId = openChatRef.current;
        const snap = activitySnapRef.current;
        const detectar = baselineReadyRef.current; // sólo notificar tras la línea base

        let entrante: Contacto | null = null;
        for (const c of recientes) {
          const prevAct = snap.get(c.id);
          const subio = prevAct != null && c.ultimaActividad > prevAct;
          snap.set(c.id, c.ultimaActividad);
          // mensaje NUEVO del lead = último mensaje entrante + actividad que subió,
          // en un chat que NO es el que estás viendo. (unread_count de Chatwoot no sirve.)
          if (detectar && subio && c.ultimoEntrante && c.id !== openId) {
            if (!entrante || c.ultimaActividad > entrante.ultimaActividad) entrante = c;
          }
        }
        if (entrante) {
          const e = entrante as Contacto;
          if (dejaSonar('wa-mensaje')) playBeep();
          if (dejaVer('wa-mensaje')) {
            setToast({ gid: e.id, nombre: e.contacto, avatar: e.avatar });
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToast(null), 5000);
          }
        }

        // Merge en la lista (preserva los que no vienen en página 1) y recalcula el
        // sinLeer sintético con NUESTRO marcador de leído (el server siempre da 0).
        setContactos((prev) => {
          const leido = leidoRef.current;
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const c of recientes) {
            const abierto = c.id === openId;
            if (abierto) { leido.set(c.id, c.ultimaActividad); guardarLeido(leido); }
            byId.set(c.id, { ...c, sinLeer: !abierto && tieneSinLeer(c, leido) ? 1 : 0 });
          }
          return [...byId.values()].sort((a, b) => b.ultimaActividad - a.ultimaActividad);
        });
      } catch { /* ignore */ }
    };
    const iv = setInterval(() => void tick(), 6000);
    return () => clearInterval(iv);
  }, []);

  // Polling del canal NO oficial (Evolution) cada 12s: mismo toast + sonido +
  // badge que el oficial, para mensajes nuevos entrantes. Aislado del poll oficial.
  useEffect(() => {
    const tick = async () => {
      if (pathRef.current.startsWith('/login') || isPublicLandingPath(pathRef.current)) return;
      try {
        const r = await fetch('/api/whatsapp/evolution/mensajes?resumen=1');
        const j = await r.json();
        if (!j.ok || !Array.isArray(j.conversaciones)) return;
        const convs = j.conversaciones as ConvNoOf[];
        noOfConvsRef.current = convs;
        const snap = noOfSnapRef.current;
        const leido = noOfLeidoRef.current;
        if (!noOfBaselineRef.current) {
          // Primera vez: sembrar snapshot + "todo leído" (no spamear chats viejos).
          const stored = cargarLeidoEmpresa();
          for (const c of convs) {
            const ts = c.ultimaFecha ? Date.parse(c.ultimaFecha) : 0;
            snap.set(c.chatJid, ts);
            if (!stored.has(c.chatJid)) stored.set(c.chatJid, ts);
          }
          noOfLeidoRef.current = stored;
          guardarLeidoEmpresa(stored);
          noOfBaselineRef.current = true;
          recomputeNoOf();
          return;
        }
        const openId = noOfOpenRef.current;
        let entrante: ConvNoOf | null = null;
        for (const c of convs) {
          const ts = c.ultimaFecha ? Date.parse(c.ultimaFecha) : 0;
          const prev = snap.get(c.chatJid);
          const subio = prev != null && ts > prev;
          snap.set(c.chatJid, ts);
          if (c.chatJid === openId) { leido.set(c.chatJid, ts); guardarLeidoEmpresa(leido); }
          if (subio && c.ultimoEntrante && c.chatJid !== openId) {
            if (!entrante || ts > (entrante.ultimaFecha ? Date.parse(entrante.ultimaFecha) : 0)) entrante = c;
          }
        }
        if (entrante) {
          if (dejaSonar('wa-mensaje-empresa')) playBeep();
          if (dejaVer('wa-mensaje-empresa')) {
            setToast({ gid: entrante.chatJid, nombre: entrante.nombre, avatar: null, canal: 'empresa' });
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToast(null), 5000);
          }
        }
        recomputeNoOf();
      } catch { /* ignore */ }
    };
    void tick();
    const iv = setInterval(() => void tick(), 12000);
    return () => clearInterval(iv);
  }, []);

  return (
    <Ctx.Provider value={{ contactos, setContactos, unreadTotal, loadingConvs, openChatRef, setOpenChat, marcarLeido, goToChat, noOficialUnread, marcarLeidoNoOficial, setOpenChatNoOficial, inApp }}>
      {children}
      {!isPublicLandingPath(pathname) && toast && (
        <button
          onClick={() => (toast.canal === 'empresa' ? goToChatNoOficial(toast.gid) : goToChat(toast.gid))}
          style={{
            position: 'fixed', top: 18, right: 18, zIndex: 2000, maxWidth: 340,
            display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
            borderRadius: 14, border: '1px solid var(--border-strong)', background: 'var(--surface)',
            boxShadow: '0 16px 44px rgba(23,21,17,.28)', cursor: 'pointer', textAlign: 'left',
            fontFamily: "'Geist', sans-serif", animation: 'mako-toast-in .22s ease-out',
          }}
        >
          <style>{'@keyframes mako-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}'}</style>
          <span style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
            {toast.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={toast.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(toast.nombre)}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.nombre}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)' }}>Te envió un mensaje · abrir chat →</span>
          </span>
        </button>
      )}
      {!isPublicLandingPath(pathname) && tplToast && (
        <button
          onClick={() => goToPlantilla(tplToast.name)}
          style={{
            position: 'fixed', top: toast ? 92 : 18, right: 18, zIndex: 2000, maxWidth: 340,
            display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 14,
            border: `1px solid ${tplToast.tipo === 'ok' ? 'var(--good)' : 'var(--bad)'}`, background: 'var(--surface)',
            boxShadow: '0 16px 44px rgba(23,21,17,.28)', cursor: 'pointer', textAlign: 'left',
            fontFamily: "'Geist', sans-serif", animation: 'mako-toast-in .22s ease-out',
          }}
        >
          <style>{'@keyframes mako-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}'}</style>
          <span style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, background: tplToast.tipo === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', color: tplToast.tipo === 'ok' ? 'var(--good)' : 'var(--bad)' }}>
            {tplToast.tipo === 'ok' ? '✓' : '✕'}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{tplToast.tipo === 'ok' ? 'Plantilla aprobada' : 'Plantilla rechazada'}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ink)', fontFamily: "'Geist Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 270 }}>{tplToast.name}</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 2, lineHeight: 1.35, maxWidth: 270 }}>{tplToast.tipo === 'rej' && tplToast.motivo ? tplToast.motivo : 'ver →'}</span>
          </span>
        </button>
      )}
    </Ctx.Provider>
  );
}
