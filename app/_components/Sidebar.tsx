'use client';

// =============================================================================
// Sidebar plegable (rediseño Marketing OS) — rail de íconos + hover para expandir
// =============================================================================
// Plegado a íconos por defecto; se despliega al pasar el cursor (overlay, sin
// correr el contenido) y se pliega con un pequeño delay al salir. NUNCA hace
// scroll. Grupos colapsables (Analytics/Tools/Chats/Customer Success) en
// acordeón de apertura única. El menú de la foto de perfil sale AL COSTADO desde
// la base (portal).

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { TOP_NAV, NAV_GROUPS, USER_NAV, type NavItem, type NavGroup } from './nav';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { Icon } from './icons';

const MONO = "'Geist Mono', monospace";
const RAIL = 74;
const FULL = 252;

function ItemIcon({ item, active }: { item: NavItem; active: boolean }) {
  const color = active ? 'var(--accent-soft)' : 'var(--sidebar-text)';
  if (item.icon === 'mako') return <MakoStar size={21} color={color} />;
  return <span style={{ color, display: 'flex' }}><Icon name={item.icon} size={21} /></span>;
}

function NavLink({ item, active, badge, query, expanded, nested }: { item: NavItem; active: boolean; badge: number; query: string; expanded: boolean; nested?: boolean }) {
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13,
    justifyContent: expanded ? 'flex-start' : 'center',
    padding: expanded ? (nested ? '9px 12px 9px 16px' : '11px 12px') : '10px 0', borderRadius: 10,
    textDecoration: 'none', fontSize: nested ? 14 : 15,
    color: active ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
    fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden',
    ...(active ? { background: 'var(--sidebar-2)', boxShadow: expanded ? 'inset 3px 0 0 var(--accent-soft)' : 'none' } : {}),
  };
  return (
    <Link href={item.href + query} style={base} title={expanded ? undefined : item.label}>
      <span style={{ position: 'relative', display: 'flex' }}>
        <ItemIcon item={item} active={active} />
        {!expanded && item.badge && badge > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -6, width: 9, height: 9, borderRadius: '50%', background: item.key === 'whatsapp' ? 'var(--good)' : 'var(--bad)', border: '2px solid var(--sidebar)' }} />
        )}
      </span>
      {expanded && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {expanded && item.comingSoon && <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--sidebar-text)', border: '1px solid var(--sidebar-2)', borderRadius: 5, padding: '1px 5px', opacity: 0.7 }}>pronto</span>}
      {expanded && item.badge && badge > 0 && (
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: item.key === 'whatsapp' ? 'var(--good)' : 'var(--bad)', color: '#fff', ...(item.key === 'whatsapp' ? {} : { animation: 'pulseRed 1.6s infinite' }) }}>{badge}</span>
      )}
    </Link>
  );
}

function Group({ g, expanded, isOpen, onToggle, pathname, query, badgeFor }: { g: NavGroup; expanded: boolean; isOpen: boolean; onToggle: () => void; pathname: string; query: string; badgeFor: (i: NavItem) => number }) {
  const someActive = g.items.some((i) => i.match(pathname));
  const header: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13, width: '100%',
    justifyContent: expanded ? 'flex-start' : 'center',
    padding: expanded ? '11px 12px' : '10px 0', borderRadius: 10, border: 'none',
    background: (!expanded && someActive) ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer',
    color: someActive ? 'var(--on-sidebar)' : 'var(--sidebar-text)', fontWeight: someActive ? 600 : 500,
    fontSize: 15, fontFamily: 'inherit',
  };
  return (
    <div>
      <button type="button" onClick={onToggle} style={header} title={expanded ? undefined : g.label}>
        <span style={{ position: 'relative', display: 'flex', color: someActive ? 'var(--accent-soft)' : 'var(--sidebar-text)' }}>
          <Icon name={g.icon} size={21} />
          {!expanded && someActive && <span style={{ position: 'absolute', top: -4, right: -6, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-soft)' }} />}
        </span>
        {expanded && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>}
        {expanded && <span style={{ flex: 'none', fontSize: 10, color: 'var(--sidebar-text)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▸</span>}
      </button>
      {expanded && isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '2px 0 4px' }}>
          {g.items.map((it) => <NavLink key={it.key} item={it} active={it.match(pathname)} badge={badgeFor(it)} query={query} expanded nested />)}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [badge, setBadge] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [perfilNombre, setPerfilNombre] = useState('Mauricio Bustos');
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { unreadTotal } = useNotifications();

  const iniciales = perfilNombre.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'MB';
  const badgeFor = (item: NavItem) => (item.key === 'whatsapp' ? unreadTotal : item.key === 'crm' ? badge : 0);

  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  const open = expanded || userOpen;

  // Grupo abierto (acordeón de apertura única). openGroup: null = seguir el grupo
  // de la ruta activa; '' = todos cerrados; 'key' = ese grupo. Se deriva sin
  // effect para no forzar renders en cascada.
  const activeGroupKey = NAV_GROUPS.find((g) => g.items.some((i) => i.match(pathname)))?.key ?? null;
  const shownGroup = openGroup ?? activeGroupKey;

  useEffect(() => {
    let alive = true;
    fetch('/api/datos-sin-marcar-count').then((r) => r.json())
      .then((d) => { if (alive && typeof d?.total === 'number') setBadge(d.total); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    fetch('/api/perfil').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.perfil?.nombre) setPerfilNombre(j.perfil.nombre as string); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const onEnter = () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); setExpanded(true); };
  const onLeave = () => {
    // Delay al plegar (#13). NO cerramos el menú de perfil acá (bug #14): eso lo
    // maneja su propio overlay; si no, mover el cursor hacia el menú lo cerraba.
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), 340);
  };
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); }, []);

  const toggleUser = () => {
    if (!userOpen) {
      const r = userBtnRef.current?.getBoundingClientRect();
      if (r) setMenuPos({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
    }
    setUserOpen((v) => !v);
  };
  const toggleGroup = (key: string) => setOpenGroup(shownGroup === key ? '' : key);

  return (
    <aside style={{ width: RAIL, flex: 'none', alignSelf: 'stretch', position: 'sticky', top: 0, height: '100vh', overflow: 'visible', zIndex: 60 }}>
      <div
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: open ? FULL : RAIL,
          background: 'var(--sidebar)', display: 'flex', flexDirection: 'column',
          padding: open ? '24px 16px' : '24px 12px', overflow: 'hidden',
          transition: 'width .2s ease, padding .2s ease',
          boxShadow: open ? '6px 0 30px rgba(23,21,17,.24)' : 'none',
        }}
      >
        {/* Marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: open ? '2px 6px 22px' : '2px 0 22px', justifyContent: open ? 'flex-start' : 'center' }}>
          <MakoLogo size={40} />
          {open && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}><MakoWord base="#F3F0E7">MaKo</MakoWord></div>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 6 }}>Marketing OS</div>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
          {TOP_NAV.map((item) => (
            <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} expanded={open} />
          ))}
          {open && <div style={{ height: 1, background: 'var(--sidebar-2)', margin: '10px 8px' }} />}
          {NAV_GROUPS.map((g) => (
            <Group key={g.key} g={g} expanded={open} isOpen={shownGroup === g.key} onToggle={() => toggleGroup(g.key)} pathname={pathname} query={dateQuery} badgeFor={badgeFor} />
          ))}
        </nav>

        {/* Usuario (abajo) */}
        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
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
