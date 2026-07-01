'use client';

// =============================================================================
// NotificationBell — campanita + panel del centro de notificaciones
// =============================================================================
// Vive en el sidebar (plegable). Pollea /api/notificaciones cada 20s para el
// badge de no leídas y muestra el feed en un popover que se abre AL COSTADO (por
// portal, para que el sidebar plegado no lo recorte). Independiente del
// NotificationsProvider (que maneja el polling de WhatsApp).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from './icons';

const MONO = "'Geist Mono', monospace";

type Notif = {
  id: number;
  tipo: string;
  severidad: 'info' | 'ok' | 'warn' | 'urgente';
  titulo: string;
  descripcion: string | null;
  link: string | null;
  leido: boolean;
  createdAt: string;
};

const colorSev: Record<Notif['severidad'], string> = {
  urgente: 'var(--bad)',
  warn: 'var(--warn)',
  ok: 'var(--good)',
  info: 'var(--accent-soft)',
};

function haceCuanto(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'ahora';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.round(h / 24)}d`;
}

export function NotificationBell({ collapsed = false, onOpenChange }: { collapsed?: boolean; onOpenChange?: (v: boolean) => void }) {
  const router = useRouter();
  const [open, setOpenState] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(true);

  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(v); };

  const cargar = async () => {
    try {
      const j = await (await fetch('/api/notificaciones?limit=20')).json();
      if (!alive.current || !j.ok) return;
      setItems(j.items as Notif[]);
      setUnread(j.unread as number);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    alive.current = true;
    cargar();
    const iv = setInterval(cargar, 20000);
    return () => { alive.current = false; clearInterval(iv); };
  }, []);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
  };
  const toggle = () => { if (!open) { place(); cargar(); } setOpen(!open); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById('notif-menu')?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const marcar = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, leido: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch('/api/notificaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'marcar', id }) }).catch(() => {});
  };
  const marcarTodas = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, leido: true })));
    setUnread(0);
    await fetch('/api/notificaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'marcar_todas' }) }).catch(() => {});
  };
  const abrir = (n: Notif) => { if (!n.leido) marcar(n.id); setOpen(false); if (n.link) router.push(n.link); };

  const btn: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    justifyContent: collapsed ? 'center' : 'flex-start',
    padding: collapsed ? '10px 0' : '9px 11px', borderRadius: 11,
    border: 'none', background: open ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer', marginBottom: 6,
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle} style={btn} title={collapsed ? 'Notificaciones' : undefined}>
        <span style={{ position: 'relative', display: 'flex', color: 'var(--sidebar-text)' }}>
          <Icon name="bell" size={21} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -6, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, background: 'var(--bad)', color: '#fff', fontFamily: MONO, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--sidebar)' }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </span>
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--on-sidebar)', lineHeight: 1.1 }}>Notificaciones</div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 3 }}>{unread > 0 ? `${unread} sin leer` : 'al día'}</div>
          </div>
        )}
      </button>

      {open && pos && createPortal(
        <div id="notif-menu" style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, zIndex: 2000, width: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.32)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Notificaciones</span>
            {items.some((n) => !n.leido) && (
              <button type="button" onClick={marcarTodas} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Marcar todas</button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Sin novedades por ahora.</div>
            ) : items.map((n) => (
              <button key={n.id} type="button" onClick={() => abrir(n)}
                style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: n.leido ? 'transparent' : 'var(--surface-2)', cursor: 'pointer' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', marginTop: 5, background: colorSev[n.severidad] }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: n.leido ? 500 : 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.titulo}</span>
                  {n.descripcion && <span style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as CSSProperties}>{n.descripcion}</span>}
                  <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>{haceCuanto(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
