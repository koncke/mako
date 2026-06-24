'use client';

// =============================================================================
// Sidebar compartido (rediseño Marketing OS) — réplica fiel del prototipo
// =============================================================================
// Estado activo por pathname. El badge rojo "datos sin marcar" del CRM se
// alimenta de /api/pendientes-count (si falla, no aparece).

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { MAIN_NAV, TOOLS_NAV, USER_NAV, type NavItem } from './nav';
import { MakoLogo, MakoWord } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';

const MONO = "'Geist Mono', monospace";

const asideStyle: CSSProperties = {
  width: 244,
  flex: 'none',
  alignSelf: 'stretch',
  position: 'sticky',
  top: 0,
  minHeight: '100vh',
  height: '100vh',
  background: 'var(--sidebar)',
  display: 'flex',
  flexDirection: 'column',
  padding: '28px 18px',
  overflowY: 'auto',
};

function NavLink({
  item,
  active,
  badge,
  query,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  query: string;
}) {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: item.badge ? 'space-between' : undefined,
    gap: 12,
    padding: 12,
    borderRadius: 10,
    textDecoration: 'none',
    fontSize: 15,
    color: active ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
    fontWeight: active ? 600 : 500,
    ...(active
      ? { background: 'var(--sidebar-2)', boxShadow: 'inset 3px 0 0 var(--accent-soft)' }
      : {}),
  };

  const marker = item.glyph ? (
    <span
      style={{
        width: 15,
        flex: 'none',
        textAlign: 'center',
        color: 'var(--accent-soft)',
        fontSize: 13,
      }}
    >
      {item.glyph}
    </span>
  ) : (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 2,
        flex: 'none',
        background: active ? 'var(--accent-soft)' : 'var(--sidebar-text)',
        opacity: active ? 1 : 0.5,
      }}
    />
  );

  return (
    <Link href={item.href + query} style={base}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {marker}
        {item.label}
      </span>
      {item.badge && badge > 0 && (
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11.5,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 999,
            background: item.key === 'whatsapp' ? 'var(--good)' : 'var(--bad)',
            color: '#fff',
            ...(item.key === 'whatsapp' ? {} : { animation: 'pulseRed 1.6s infinite' }),
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [badge, setBadge] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const { unreadTotal } = useNotifications();
  // Cuenta a mostrar por item: CRM = datos sin marcar, WhatsApp = mensajes sin leer.
  const badgeFor = (item: NavItem) => (item.key === 'whatsapp' ? unreadTotal : item.key === 'crm' ? badge : 0);

  // Mantener el filtro de fecha global (?desde&hasta) al navegar entre secciones.
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  useEffect(() => {
    let alive = true;
    fetch('/api/datos-sin-marcar-count')
      .then((r) => r.json())
      .then((d) => {
        if (alive && typeof d?.total === 'number') setBadge(d.total);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <aside style={asideStyle}>
      {/* Marca — MaKo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 6px 28px' }}>
        <MakoLogo size={42} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
            <MakoWord base="#F3F0E7">MaKo</MakoWord>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 6 }}>Marketing OS</div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} />
        ))}

        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--sidebar-text)',
            opacity: 0.55,
            margin: '16px 6px 8px',
          }}
        >
          Herramientas
        </div>

        {TOOLS_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} />
        ))}
      </nav>

      {/* Usuario (abajo) — abre el menú con la config de MaKo */}
      <div style={{ marginTop: 'auto', paddingTop: 20, position: 'relative' }}>
        {userOpen && (
          <>
            <div onClick={() => setUserOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 41, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.32)', overflow: 'hidden', padding: '5px 0' }}>
              {USER_NAV.map((it) => (
                <Link key={it.key} href={it.href + dateQuery} onClick={() => setUserOpen(false)} style={{ display: 'block', padding: '10px 15px', fontSize: 14, fontWeight: it.match(pathname) ? 600 : 500, color: it.match(pathname) ? 'var(--ink)' : 'var(--dim)', textDecoration: 'none' }}>{it.label}</Link>
              ))}
              <button
                type="button"
                onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
                style={{ width: '100%', textAlign: 'left', display: 'block', padding: '10px 15px', fontSize: 14, fontWeight: 500, color: 'var(--dim)', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
              >
                Cerrar sesión
              </button>
            </div>
          </>
        )}
        <button type="button" onClick={() => setUserOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: 9, borderRadius: 11, border: 'none', background: userOpen ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#171511' }}>MB</div>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--on-sidebar)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mauricio Bustos</div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 3 }}>Cuenta</div>
          </div>
          <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>▴</span>
        </button>
      </div>
    </aside>
  );
}
