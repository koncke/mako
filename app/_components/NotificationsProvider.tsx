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
  sinLeer: number;
  ventanaAbierta: boolean;
  leadId: number | null;
  empresa: string | null;
  estadoLead: string | null;
  etapaKey: string | null;
  etapaLabel: string | null;
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
}

const Ctx = createContext<NotifCtx | null>(null);
export function useNotifications(): NotifCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNotifications fuera del NotificationsProvider');
  return c;
}

// ── Sonido (un único AudioContext; se reanuda en el primer gesto del usuario) ──
let _audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    if (!_audioCtx) _audioCtx = new C();
    if (_audioCtx.state === 'suspended') void _audioCtx.resume();
  } catch { /* sin audio */ }
}
function playBeep() {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    if (!_audioCtx) _audioCtx = new C();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
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

function initials(name: string): string {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '·';
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [toast, setToast] = useState<{ gid: string; nombre: string; avatar: string | null } | null>(null);

  const openChatRef = useRef<string | null>(null);
  const activitySnapRef = useRef<Map<string, number>>(new Map());
  const readGroupsRef = useRef<Map<string, number>>(new Map());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineReadyRef = useRef(false); // no notificar hasta tener la línea base
  const tickRef = useRef(0);               // cada N ticks, resync de la lista completa
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const unreadTotal = contactos.reduce((s, c) => s + c.sinLeer, 0);

  const setOpenChat = (id: string | null) => { openChatRef.current = id; };
  const marcarLeido = (gid: string, sendContactId: number) => {
    const g = contactos.find((c) => c.id === gid);
    if (g) readGroupsRef.current.set(gid, g.ultimaActividad);
    setContactos((prev) => prev.map((c) => (c.id === gid ? { ...c, sinLeer: 0 } : c)));
    void fetch(`/api/whatsapp/contacts/${sendContactId}/read`, { method: 'POST' }).catch(() => {});
  };
  const goToChat = (gid: string) => {
    setToast(null);
    // nonce → reabrir el MISMO chat (clic al pop-up otra vez) igual dispara la selección.
    router.push(`/whatsapp?chat=${encodeURIComponent(gid)}&n=${Date.now()}`);
  };

  // Carga inicial (lista completa) + baseline del snapshot. En /login no corre.
  useEffect(() => {
    if (pathname.startsWith('/login')) { setLoadingConvs(false); return; }
    let alive = true;
    void (async () => {
      try {
        const r = await fetch('/api/whatsapp/conversations');
        const j = await r.json();
        const list: Contacto[] = j.ok ? j.contactos : [];
        if (!alive) return;
        setContactos(list);
        for (const c of list) activitySnapRef.current.set(c.id, c.ultimaActividad);
        baselineReadyRef.current = true; // recién acá empezamos a NOTIFICAR
      } finally {
        if (alive) setLoadingConvs(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desbloquear el audio en el primer gesto del usuario (autoplay policy).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Polling GLOBAL cada 6s (sólo página 1: las novedades suben ahí).
  useEffect(() => {
    const tick = async () => {
      if (pathRef.current.startsWith('/login')) return; // sin sesión no polleamos
      try {
        tickRef.current += 1;
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
          // mensaje nuevo del lead (unread del server subió) en un chat que NO es el abierto
          if (detectar && subio && c.id !== openId && c.sinLeer > 0) {
            if (!entrante || c.ultimaActividad > entrante.ultimaActividad) entrante = c;
          }
        }
        if (entrante) {
          const e = entrante as Contacto;
          playBeep();
          setToast({ gid: e.id, nombre: e.contacto, avatar: e.avatar });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToast(null), 5000);
        }

        // Merge en la lista (preserva los que no vienen en página 1) + corrige badge.
        setContactos((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const c of recientes) {
            let corr = c;
            if (c.id === openId) corr = { ...c, sinLeer: 0 };
            else {
              const readAt = readGroupsRef.current.get(c.id);
              if (readAt != null) {
                if (c.ultimaActividad <= readAt) corr = { ...c, sinLeer: 0 };
                else readGroupsRef.current.delete(c.id);
              }
            }
            byId.set(c.id, corr);
          }
          return [...byId.values()].sort((a, b) => b.ultimaActividad - a.ultimaActividad);
        });
      } catch { /* ignore */ }
    };
    const iv = setInterval(() => void tick(), 6000);
    return () => clearInterval(iv);
  }, []);

  return (
    <Ctx.Provider value={{ contactos, setContactos, unreadTotal, loadingConvs, openChatRef, setOpenChat, marcarLeido, goToChat }}>
      {children}
      {toast && (
        <button
          onClick={() => goToChat(toast.gid)}
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
    </Ctx.Provider>
  );
}
