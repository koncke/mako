'use client';

// =============================================================================
// Sidebar compartido (rediseño Marketing OS) — réplica fiel del prototipo
// =============================================================================
// Estado activo por pathname. El badge rojo "datos sin marcar" del CRM se
// alimenta de /api/pendientes-count (si falla, no aparece).

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { MAIN_NAV, TOOLS_NAV, type NavItem } from './nav';

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
            background: 'var(--bad)',
            color: '#fff',
            animation: 'pulseRed 1.6s infinite',
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
      {/* Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px 28px' }}>
        <div
          style={{
            width: 40,
            height: 40,
            flex: 'none',
            borderRadius: 11,
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 17,
            color: '#171511',
          }}
        >
          MB
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15.5,
              color: 'var(--on-sidebar)',
              lineHeight: 1.1,
            }}
          >
            Mauricio Bustos
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--sidebar-text)',
              marginTop: 3,
            }}
          >
            Marketing OS
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badge} query={dateQuery} />
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
          <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badge} query={dateQuery} />
        ))}
      </nav>

      {/* Fuentes en vivo */}
      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10.5,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--sidebar-text)',
            opacity: 0.7,
            marginBottom: 13,
            padding: '0 6px',
          }}
        >
          Fuentes · live
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 6px' }}>
          {['Meta Ads', 'Calendly', 'Cobranza'].map((s) => (
            <span
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                fontSize: 13,
                color: 'var(--sidebar-text)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--good)',
                  boxShadow: '0 0 0 3px rgba(28,138,84,.18)',
                }}
              />
              {s}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
