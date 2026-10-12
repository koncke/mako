'use client';

// =============================================================================
// Notificaciones globales de WhatsApp — corren en TODA la app (montado en el
// layout). Hace UN solo polling del número de WhatsApp del negocio (Evolution):
// alimenta el badge del sidebar y el pop-up. Si llega un mensaje navegando por
// cualquier lado de la app, salta el pop-up para ir directo al chat.
//
// ⛔ Hasta el 09/10/2026 había un SEGUNDO polling, el de la bandeja oficial (Chatwoot),
// que además le pasaba sus contactos a /whatsapp. Chatwoot se borró (decisión de Martín:
// «que no exista más»); el código quedó en la etiqueta de git `archivo/chatwoot-2026-10-09`.
// =============================================================================

import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { isPublicLandingPath } from './PublicRouteGate';
import { esRutaMovil } from '@/lib/movil-rutas';
import { inAppActivo, type NotifInApp } from '@/lib/notif-catalogo';

/**
 * Aviso de que alguien acaba de guardar sus preferencias en Configuraciones ›
 * Notificaciones. Sin esto habría que recargar para que el cambio se note, y
 * apagar un sonido que sigue sonando parece que no funcionó.
 */
export const EVENTO_PREFS_IN_APP = 'mako:notif-inapp';

interface NotifCtx {
  unreadTotal: number;
  // El número de WhatsApp del negocio (Evolution):
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
// Un único AudioContext, que se reanuda en el primer gesto del usuario (autoplay
// policy).
//
// ⚠️ ACÁ ESTABA EL SAMPLE DE /notif.mp3, con su precarga a un AudioBuffer y su beep
// de respaldo. Lo usaba SOLO el aviso de mensaje nuevo de WhatsApp, que desde el
// 27/09/2026 no suena (tanda 3 de la fricción del CRM), así que se fue con él: era
// un fetch y un decode de audio en cada carga de la app para algo que ya no se
// reproduce. El .mp3 sigue en `public/` y no lo pide nadie.
//
// Lo que SÍ suena es la plantilla de WhatsApp resuelta (aprobada o rechazada), con
// los acordes de `playChord`: es un evento puntual que se espera, no uno que se
// repite con cada mensaje que entra.
let _audioCtx: AudioContext | null = null;

function ctxOf(): AudioContext | null {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    if (!_audioCtx) _audioCtx = new C();
    return _audioCtx;
  } catch { return null; }
}
function unlockAudio() {
  const ctx = ctxOf();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
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
// Por cada chat guardamos hasta qué fecha ya leímos. Un chat está SIN LEER si su último
// mensaje es entrante y su actividad supera ese marcador. Persistimos en localStorage para
// que sobreviva recargas.
// "Leído hasta" por chatJid (la actividad es un ms de Date.parse de la última fecha del
// chat). La key conserva el nombre de cuando convivía con la del oficial: cambiarla le
// volvería a marcar como no leídos los chats a quien ya los leyó.
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
type ConvNoOf = { chatJid: string; nombre: string; ultimaFecha: string | null; ultimoEntrante: boolean; linea?: string | null };

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [toast, setToast] = useState<{ gid: string; nombre: string } | null>(null);
  const [tplToast, setTplToast] = useState<{ tipo: 'ok' | 'rej'; name: string; motivo?: string } | null>(null);
  const [noOficialUnread, setNoOficialUnread] = useState(0);
  const [inApp, setInApp] = useState<NotifInApp | null>(null);
  // Los pollings se montan una sola vez (deps []); leen las preferencias por ref
  // para no reiniciarse cada vez que alguien las cambia.
  const inAppRef = useRef<NotifInApp | null>(null);
  inAppRef.current = inApp;
  const prefsPedidasRef = useRef(false);
  const dejaVer = (id: string) => inAppActivo(inAppRef.current, id, 'popup');
  const dejaSonar = (id: string) => inAppActivo(inAppRef.current, id, 'sonido');
  const noOfSnapRef = useRef<Map<string, number>>(new Map());   // chatJid → última actividad (ms) vista
  const noOfLeidoRef = useRef<Map<string, number>>(new Map());  // chatJid → leído hasta (ms)
  const noOfConvsRef = useRef<ConvNoOf[]>([]);                  // última lista (para recomputar unread)
  const noOfOpenRef = useRef<string | null>(null);             // chat abierto (no notificar ni contar)
  const noOfBaselineRef = useRef(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef(0);
  // Estado de plantillas en Meta: para avisar cuando una se aprueba/rechaza.
  const approvedSnapRef = useRef<Set<string>>(new Set());
  const rejectedSnapRef = useRef<Set<string>>(new Set());
  const tplBaselineRef = useRef(false);
  const tplToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const unreadTotal = noOficialUnread;

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
  // EmpresaInbox nos dice qué chat está abierto → no notificamos ese chat y lo damos por
  // leído.
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
    // Con varias líneas, a la bandeja del número por el que ENTRÓ y con ese chat abierto. Sin la
    // línea abría la de por default, donde ese contacto no está, con el mensaje ya marcado leído.
    const linea = noOfConvsRef.current.find((c) => c.chatJid === chatJid)?.linea ?? null;
    const extra = `${linea ? `&linea=${encodeURIComponent(linea)}` : ''}&chat=${encodeURIComponent(chatJid)}`;
    router.push(`/whatsapp?canal=no-oficial${extra}&n=${Date.now()}`);
  };

  const goToPlantilla = (name: string) => {
    setTplToast(null);
    router.push(`/automations?stab=plantillas&tpl=${encodeURIComponent(name)}&n=${Date.now()}`);
  };

  // Preferencias de pop-up/sonido de esta persona. Se recargan cuando las guarda
  // (evento del panel de Configuraciones) para que el cambio se note al instante.
  //
  // Depende de `pathname` y no de []: el provider vive en el layout raíz y no se
  // desmonta nunca, así que con [] el efecto corría UNA vez y se quedaba con el
  // pathname del arranque. Quien entraba por /login (o por la landing) se llevaba
  // el `return` de la guarda y no volvía a intentarlo jamás: ya adentro de la app,
  // `inApp` seguía en null y todo sonaba, hubiera apagado lo que hubiera apagado.
  // El ref evita repetir el GET en cada navegación.
  useEffect(() => {
    if (pathname.startsWith('/login') || isPublicLandingPath(pathname) || esRutaMovil(pathname)) return;
    let alive = true;
    const cargar = (forzar: boolean) => {
      if (!forzar && prefsPedidasRef.current) return;
      prefsPedidasRef.current = true;
      void fetch('/api/perfil/notif-inapp')
        .then((r) => r.json())
        .then((j) => { if (alive && j?.ok && j.inApp) setInApp(j.inApp as NotifInApp); })
        .catch(() => { if (alive) prefsPedidasRef.current = false; }); // que un fallo de red no lo deje mudo para siempre
    };
    const recargar = () => cargar(true);
    cargar(false);
    window.addEventListener(EVENTO_PREFS_IN_APP, recargar);
    return () => { alive = false; window.removeEventListener(EVENTO_PREFS_IN_APP, recargar); };
  }, [pathname]);

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

  // Status de las plantillas de Meta: siembra al montar y después ~cada 30s.
  // ⚠️ Pendiente de la segunda tanda del retiro de Chatwoot: las plantillas leen la cuenta de
  // WhatsApp Business del inbox de Chatwoot (lib/meta-templates.ts → getWabaConfig), así que
  // con Chatwoot fuera esta ruta contesta vacío. Se va con las plantillas.
  useEffect(() => {
    const tick = () => {
      if (pathRef.current.startsWith('/login') || isPublicLandingPath(pathRef.current)) return; // sin sesión / landing pública: no polleamos
      // ⚠️ En MaKo Mobile (/m) tampoco: el teléfono no tiene a dónde llevar el aviso
      // (las plantillas viven en Automations, que es de escritorio), y un poll cada 6 s
      // es batería y datos móviles para nada. Lo que importa allá llega por el Inbox y
      // por push. Por `esRutaMovil`, nunca `startsWith('/m')` (atrapa /mako y /marketing).
      if (esRutaMovil(pathRef.current)) return;
      tickRef.current += 1;
      if (tickRef.current === 1 || tickRef.current % 5 === 0) void checkTemplates();
    };
    const iv = setInterval(tick, 6000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling del número de WhatsApp (Evolution) cada 12s: toast + badge para mensajes
  // nuevos entrantes.
  useEffect(() => {
    const tick = async () => {
      if (pathRef.current.startsWith('/login') || isPublicLandingPath(pathRef.current)) return;
      // En /m no: el contador alimenta el badge del Sidebar y el pop-up que lleva a
      // /whatsapp de escritorio — ninguno de los dos existe en el teléfono.
      if (esRutaMovil(pathRef.current)) return;
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
          // ⚠️ SIN SONIDO desde el 27/09/2026 (tanda 3 de la fricción del CRM). El
          // aviso visual se queda —sacarlo sí costaría algo: un mensaje no se vería
          // hasta abrir la tab— pero el beep no se puede ignorar, sonaba con CADA
          // mensaje entrante mientras la persona miraba otra pantalla. Un aviso que
          // interrumpe con audio tiene que ser algo que no puede esperar, y un mensaje
          // de WhatsApp espera: ya está el contador rojo en la tab de la sidebar.
          if (dejaVer('wa-mensaje')) {
            setToast({ gid: entrante.chatJid, nombre: entrante.nombre });
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
    <Ctx.Provider value={{ unreadTotal, noOficialUnread, marcarLeidoNoOficial, setOpenChatNoOficial, inApp }}>
      {children}
      {!isPublicLandingPath(pathname) && !esRutaMovil(pathname) && toast && (
        <button
          onClick={() => goToChatNoOficial(toast.gid)}
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
            {initials(toast.nombre)}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.nombre}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)' }}>Te envió un mensaje · abrir chat →</span>
          </span>
        </button>
      )}
      {!isPublicLandingPath(pathname) && !esRutaMovil(pathname) && tplToast && (
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
