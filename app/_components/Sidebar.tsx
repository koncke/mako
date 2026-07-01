'use client';

// =============================================================================
// Sidebar plegable (rediseño Marketing OS) — rail de íconos + hover para expandir
// =============================================================================
// Por defecto queda plegado mostrando solo los íconos (como Meta). Al pasar el
// cursor se despliega (overlay, sin correr el contenido). El menú de la foto de
// perfil sale AL COSTADO desde la base (portal). El badge del CRM ("datos sin
// marcar") y el de WhatsApp ("sin leer") se muestran en pill (expandido) o punto
// (plegado).

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { MAIN_NAV, TOOLS_NAV, USER_NAV, type NavItem } from './nav';
import { MakoLogo, MakoWord } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { NotificationBell } from './NotificationBell';
import { Icon } from './icons';

const MONO = "'Geist Mono', monospace";
const RAIL = 74;
const FULL = 250;

function NavLink({ item, active, badge, query, expanded }: { item: NavItem; active: boolean; badge: number; query: string; expanded: boolean }) {
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13,
    justifyContent: expanded ? 'flex-start' : 'center',
    padding: expanded ? '11px 12px' : '11px 0', borderRadius: 10,
    textDecoration: 'none', fontSize: 15,
    color: active ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap', overflow: 'hidden',
    ...(active ? { background: 'var(--sidebar-2)', boxShadow: expanded ? 'inset 3px 0 0 var(--accent-soft)' : 'none' } : {}),
  };
  return (
    <Link href={item.href + query} style={base} title={expanded ? undefined : item.label}>
      <span style={{ position: 'relative', display: 'flex', color: active ? 'var(--accent-soft)' : 'var(--sidebar-text)' }}>
        <Icon name={item.icon} size={21} />
        {!expanded && item.badge && badge > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -6, width: 9, height: 9, borderRadius: '50%', background: item.key === 'whatsapp' ? 'var(--good)' : 'var(--bad)', border: '2px solid var(--sidebar)' }} />
        )}
      </span>
      {expanded && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {expanded && item.badge && badge > 0 && (
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: item.key === 'whatsapp' ? 'var(--good)' : 'var(--bad)', color: '#fff', ...(item.key === 'whatsapp' ? {} : { animation: 'pulseRed 1.6s infinite' }) }}>{badge}</span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [badge, setBadge] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [perfilNombre, setPerfilNombre] = useState('Mauricio Bustos');
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const { unreadTotal } = useNotifications();

  const iniciales = perfilNombre.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'MB';
  const badgeFor = (item: NavItem) => (item.key === 'whatsapp' ? unreadTotal : item.key === 'crm' ? badge : 0);

  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  const open = expanded || userOpen || bellOpen;

  useEffect(() => {
    let alive = true;
    fetch('/api/datos-sin-marcar-count')
      .then((r) => r.json())
      .then((d) => { if (alive && typeof d?.total === 'number') setBadge(d.total); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    fetch('/api/perfil')
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.perfil?.nombre) setPerfilNombre(j.perfil.nombre as string); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const toggleUser = () => {
    if (!userOpen) {
      const r = userBtnRef.current?.getBoundingClientRect();
      if (r) setMenuPos({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
    }
    setUserOpen((v) => !v);
  };

  const groupHeader: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)', opacity: 0.55, margin: '16px 6px 8px' };

  return (
    <aside style={{ width: RAIL, flex: 'none', alignSelf: 'stretch', position: 'sticky', top: 0, height: '100vh', overflow: 'visible', zIndex: 60 }}>
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => { setExpanded(false); setUserOpen(false); }}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: open ? FULL : RAIL,
          background: 'var(--sidebar)', display: 'flex', flexDirection: 'column',
          padding: open ? '24px 16px' : '24px 12px', overflowY: 'auto', overflowX: 'hidden',
          transition: 'width .18s ease, padding .18s ease',
          boxShadow: open ? '6px 0 30px rgba(23,21,17,.24)' : 'none',
        }}
      >
        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: open ? '2px 6px 24px' : '2px 0 24px', justifyContent: open ? 'flex-start' : 'center' }}>
          <MakoLogo size={40} />
          {open && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}><MakoWord base="#F3F0E7">MaKo</MakoWord></div>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 6 }}>Marketing OS</div>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {MAIN_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} expanded={open} />
          ))}
          {open ? <div style={groupHeader}>Herramientas</div> : <div style={{ height: 1, background: 'var(--sidebar-2)', margin: '14px 10px' }} />}
          {TOOLS_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} expanded={open} />
          ))}
        </nav>

        {/* Campanita + Usuario (abajo) */}
        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <NotificationBell collapsed={!open} onOpenChange={setBellOpen} />
          <button ref={userBtnRef} type="button" onClick={toggleUser} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: open ? 9 : '9px 0', justifyContent: open ? 'flex-start' : 'center', borderRadius: 11, border: 'none', background: userOpen ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#171511' }}>{iniciales}</div>
            {open && (
              <>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--on-sidebar)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{perfilNombre}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 3 }}>Cuenta</div>
                </div>
                <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>▸</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Menú de la foto de perfil: al costado, desde la base (portal). */}
      {userOpen && menuPos && createPortal(
        <>
          <div onClick={() => setUserOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} aria-hidden />
          <div style={{ position: 'fixed', left: menuPos.left, bottom: menuPos.bottom, zIndex: 2000, width: 226, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.32)', overflow: 'hidden', padding: '5px 0' }}>
            {USER_NAV.map((it) => {
              const on = it.match(pathname);
              return (
                <Link key={it.key} href={it.href + dateQuery} onClick={() => setUserOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px', fontSize: 14, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', textDecoration: 'none' }}>
                  <span style={{ display: 'flex', color: on ? 'var(--accent)' : 'var(--faint)' }}><Icon name={it.icon} size={18} /></span>
                  {it.label}
                </Link>
              );
            })}
            <button type="button"
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px', fontSize: 14, fontWeight: 500, color: 'var(--dim)', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
              <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name="logout" size={18} /></span>
              Cerrar sesión
            </button>
          </div>
        </>,
        document.body,
      )}
    </aside>
  );
}
