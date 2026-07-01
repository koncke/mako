'use client';

// =============================================================================
// Sidebar compartido (rediseño Marketing OS) — barra densa estilo Meta
// =============================================================================
// Estado activo por pathname. Filas compactas con icono + label, activo en azul
// (barra izquierda + tinte), para que TODAS las tabs entren sin scroll. El badge
// rojo "datos sin marcar" (CRM) y el verde de WhatsApp sin leer siguen igual.
// El item de MaKo usa la chispa dorada de marca.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { MAIN_NAV, TOOLS_NAV, USER_NAV, type NavItem } from './nav';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { SaldoMaKo } from './SaldoMaKo';
import { useNotifications } from './NotificationsProvider';

const MONO = "'Geist Mono', monospace";

const asideStyle: CSSProperties = {
  width: 240,
  flex: 'none',
  alignSelf: 'stretch',
  position: 'sticky',
  top: 0,
  minHeight: '100vh',
  height: '100vh',
  background: 'var(--sidebar)',
  display: 'flex',
  flexDirection: 'column',
  padding: '20px 14px',
  overflowY: 'auto',
};

function NavIcon({ svg }: { svg: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

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
  // Base (color/hover) vive en .mako-navlink (globals.css). Los inline solo
  // pintan el estado ACTIVO, para que el :hover pueda ganarle a los inactivos.
  const base: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '8px 11px',
    borderRadius: 9,
    textDecoration: 'none',
    fontSize: 14,
    ...(active
      ? { background: 'rgba(47,111,237,.16)', color: 'var(--on-sidebar)', fontWeight: 600 }
      : { fontWeight: 500 }),
  };

  return (
    <Link href={item.href + query} style={base} className="mako-navlink">
      {active && (
        <span
          aria-hidden
          style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 3, borderRadius: '0 3px 3px 0', background: 'var(--primary)' }}
        />
      )}
      <span style={{ width: 18, height: 18, flex: 'none', display: 'grid', placeItems: 'center', color: 'inherit' }}>
        {item.key === 'mako' ? (
          <MakoStar size={17} color="var(--accent-soft)" />
        ) : item.icon ? (
          <NavIcon svg={item.icon} />
        ) : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.label}
      </span>
      {item.badge && badge > 0 && (
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10.5,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 999,
            flex: 'none',
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
  const [perfilNombre, setPerfilNombre] = useState('Mauricio Bustos');
  const { unreadTotal } = useNotifications();
  const iniciales = perfilNombre.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'MB';
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

  // Nombre del perfil para el pie del sidebar (editable en /perfil).
  useEffect(() => {
    let alive = true;
    fetch('/api/perfil')
      .then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.perfil?.nombre) setPerfilNombre(j.perfil.nombre as string); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <aside style={asideStyle}>
      {/* Marca — MaKo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '2px 6px 16px' }}>
        <MakoLogo size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
            <MakoWord base="#F3F5F8">MaKo</MakoWord>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 5 }}>Marketing OS</div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} />
        ))}

        <div
          style={{
            fontFamily: MONO,
            fontSize: 9.5,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--sidebar-text)',
            opacity: 0.55,
            margin: '14px 8px 6px',
          }}
        >
          Herramientas
        </div>

        {TOOLS_NAV.map((item) => (
          <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} />
        ))}
      </nav>

      {/* Saldo / uso de IA + Usuario (abajo) */}
      <div style={{ marginTop: 'auto', paddingTop: 14, position: 'relative' }}>
        <SaldoMaKo />
        {userOpen && (
          <>
            <div onClick={() => setUserOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 41, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(18,21,27,.28)', overflow: 'hidden', padding: '5px 0' }}>
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
        <button type="button" onClick={() => setUserOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: 8, borderRadius: 11, border: 'none', background: userOpen ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
          <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#171511' }}>{iniciales}</div>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--on-sidebar)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{perfilNombre}</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 3 }}>Cuenta</div>
          </div>
          <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>▴</span>
        </button>
      </div>
    </aside>
  );
}
