'use client';

// =============================================================================
// Sidebar plegable (rediseño Marketing OS) — rail de íconos + hover para expandir
// =============================================================================
// Plegado a íconos por defecto; se despliega al pasar el cursor (overlay, sin
// correr el contenido) y se pliega con delay al salir. NUNCA hace scroll. Los
// grupos (Analytics/Tools/Chats/Customer Success) y el menú de la foto abren en
// FLYOUT hacia la DERECHA (portal), no hacia abajo. MaKo va aparte, abajo del
// todo, con su estrella dorada.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { TOP_NAV, NAV_GROUPS, USER_NAV, MAKO_ITEM, ADS_MANAGER_ITEM, ADMIN_NAV, type NavItem } from './nav';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { Icon } from './icons';

const MONO = "'Geist Mono', monospace";
const RAIL = 74;
const FULL = 252;

function ItemIcon({ item, active }: { item: NavItem; active: boolean }) {
  if (item.icon === 'mako') return <MakoStar size={21} color="var(--accent-soft)" />;
  const color = active ? 'var(--accent-soft)' : 'var(--sidebar-text)';
  return <span style={{ color, display: 'flex' }}><Icon name={item.icon} size={21} /></span>;
}

function NavLink({ item, active, badge, query, expanded, nested, onClick }: { item: NavItem; active: boolean; badge: number; query: string; expanded: boolean; nested?: boolean; onClick?: () => void }) {
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13,
    justifyContent: expanded ? 'flex-start' : 'center',
    padding: expanded ? (nested ? '10px 12px' : '11px 12px') : '10px 0', borderRadius: 10,
    textDecoration: 'none', fontSize: nested ? 14.5 : 15,
    color: active ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
    fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden',
    ...(active ? { background: 'var(--sidebar-2)', boxShadow: expanded ? 'inset 3px 0 0 var(--accent-soft)' : 'none' } : {}),
  };
  const content = (
    <>
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
    </>
  );
  // Tabs por-workspace en el shell de admin: entran como el dueño y navegan
  // (el onClick lo maneja el Sidebar). Se renderizan como botón, no como Link.
  if (item.entrarComoDueno) {
    return (
      <button type="button" onClick={onClick} title={expanded ? undefined : item.label}
        style={{ ...base, border: 'none', cursor: 'pointer', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}>
        {content}
      </button>
    );
  }
  // Rutas que sirven HTML directo (ej. el grafo) abren en pestaña nueva.
  if (item.newTab) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer" style={base} title={expanded ? undefined : item.label} onClick={onClick}>{content}</a>;
  }
  return (
    <Link href={item.href + query} style={base} title={expanded ? undefined : item.label} onClick={onClick}>{content}</Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [badge, setBadge] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [perfilNombre, setPerfilNombre] = useState('Mauricio Bustos');
  const [perfilAvatar, setPerfilAvatar] = useState('');
  const [rol, setRol] = useState<string>('');
  const [rolWs, setRolWs] = useState<string>('');
  const [impersonando, setImpersonando] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const [flyout, setFlyout] = useState<{ key: string; top: number; left: number } | null>(null);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { unreadTotal } = useNotifications();

  const iniciales = perfilNombre.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'MB';
  const badgeFor = (item: NavItem) => (item.key === 'whatsapp' ? unreadTotal : item.key === 'crm' ? badge : 0);

  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  const open = expanded || userOpen || !!flyout;
  const flyoutGroup = flyout ? NAV_GROUPS.find((g) => g.key === flyout.key) ?? null : null;

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
      .then((j) => {
        if (!alive || !j?.ok || !j.perfil) return;
        if (j.perfil.nombre) setPerfilNombre(j.perfil.nombre as string);
        setPerfilAvatar((j.perfil.avatarUrl as string) || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  // Rol + impersonación de la sesión: deciden qué shell mostrar (admin vs cliente).
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !j.autenticado) return;
        setRol((j.rol as string) || '');
        setRolWs((j.rolWs as string) || '');
        setImpersonando(Boolean(j.impersonando));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  // Un admin que NO está impersonando ve el shell de gestión (sin tabs de
  // marketing). Impersonando o siendo usuario, ve el dashboard normal.
  const adminShell = rol === 'admin' && !impersonando;

  // Filtro de tabs por rol-de-workspace. El admin-cliente (o mientras carga)
  // ve todo; closer/setter solo las tabs anotadas con su rol en nav.ts.
  const rolCliente = rolWs === 'closer' || rolWs === 'setter';
  const puedeVer = (it: NavItem) =>
    !rolCliente || (it.rolesWs as string[] | undefined)?.includes(rolWs) === true;

  // Shell de admin: entrar como el workspace dueño (ws1) y abrir la tab. Reusa la
  // impersonación firmada; el reload deja al Sidebar leer el nuevo estado.
  const entrarComoDuenoYNavegar = async (href: string) => {
    try {
      await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ws: 1 }), // OWNER_WS
      });
    } catch { /* si falla, igual navegamos: la tab mostrará el aviso de "elegí cliente" */ }
    window.location.href = href;
  };

  const onEnter = () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); setExpanded(true); };
  const onLeave = () => {
    // Delay al plegar (#13). No cerramos flyout/menú de perfil acá (sus overlays lo hacen).
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), 340);
  };
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); if (flyoutTimer.current) clearTimeout(flyoutTimer.current); if (userTimer.current) clearTimeout(userTimer.current); }, []);

  // El menú de la foto de perfil también abre AL PASAR EL CURSOR (además del clic).
  const openUserMenu = () => {
    if (userTimer.current) clearTimeout(userTimer.current);
    const r = userBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
    setFlyout(null);
    setUserOpen(true);
  };
  const scheduleCloseUser = () => {
    if (userTimer.current) clearTimeout(userTimer.current);
    userTimer.current = setTimeout(() => setUserOpen(false), 220);
  };

  // Los grupos abren su flyout AL PASAR EL CURSOR (hover). El menú de perfil, no
  // (ese sigue con clic).
  const openFlyout = (key: string, el: HTMLElement) => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    const r = el.getBoundingClientRect();
    const estimado = 60 + (NAV_GROUPS.find((g) => g.key === key)?.items.length ?? 3) * 46;
    const top = Math.min(r.top, Math.max(12, window.innerHeight - estimado - 12));
    setUserOpen(false);
    setFlyout({ key, top, left: r.right + 8 });
  };
  const scheduleCloseFlyout = () => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    flyoutTimer.current = setTimeout(() => setFlyout(null), 220);
  };

  // Cerrar el flyout si se hace clic afuera (para touch; en desktop cierra al salir).
  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: MouseEvent) => {
      if (document.getElementById('grp-flyout')?.contains(e.target as Node)) return;
      setFlyout(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [flyout]);

  // Cerrar el menú de perfil al hacer clic afuera.
  useEffect(() => {
    if (!userOpen) return;
    const onDown = (e: MouseEvent) => {
      if (document.getElementById('user-menu')?.contains(e.target as Node)) return;
      if (userBtnRef.current?.contains(e.target as Node)) return;
      setUserOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userOpen]);

  const GroupHeader = ({ gKey, label, icon }: { gKey: string; label: string; icon: string }) => {
    const g = NAV_GROUPS.find((x) => x.key === gKey)!;
    const someActive = g.items.some((i) => i.match(pathname));
    const isOpen = flyout?.key === gKey;
    return (
      <button type="button"
        onClick={(e) => openFlyout(gKey, e.currentTarget)}
        onMouseEnter={(e) => openFlyout(gKey, e.currentTarget)}
        onMouseLeave={scheduleCloseFlyout}
        title={open ? undefined : label}
        style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', justifyContent: open ? 'flex-start' : 'center', padding: open ? '11px 12px' : '10px 0', borderRadius: 10, border: 'none', background: (isOpen || (!open && someActive)) ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer', color: someActive ? 'var(--on-sidebar)' : 'var(--sidebar-text)', fontWeight: someActive ? 600 : 500, fontSize: 15, fontFamily: 'inherit' }}>
        <span style={{ position: 'relative', display: 'flex', color: someActive ? 'var(--accent-soft)' : 'var(--sidebar-text)' }}>
          <Icon name={icon} size={21} />
          {!open && someActive && <span style={{ position: 'absolute', top: -4, right: -6, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-soft)' }} />}
        </span>
        {open && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
        {open && <span style={{ flex: 'none', fontSize: 11, color: 'var(--sidebar-text)' }}>›</span>}
      </button>
    );
  };

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

        {/* Navegación — el admin (sin impersonar) ve el shell de gestión. */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
          {adminShell ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)', opacity: 0.6, padding: open ? '4px 12px 8px' : '4px 0 8px', textAlign: open ? 'left' : 'center' }}>{open ? 'Administración' : '·'}</div>
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.key} item={item} active={item.match(pathname)} badge={0} query="" expanded={open}
                  onClick={item.entrarComoDueno ? () => entrarComoDuenoYNavegar(item.href) : undefined} />
              ))}
            </>
          ) : (
            <>
              {TOP_NAV.filter(puedeVer).map((item) => (
                <NavLink key={item.key} item={item} active={item.match(pathname)} badge={badgeFor(item)} query={dateQuery} expanded={open} />
              ))}
              {puedeVer(ADS_MANAGER_ITEM) && (
                <>
                  <div style={{ height: 1, background: 'var(--sidebar-2)', margin: open ? '10px 8px' : '10px 12px' }} />
                  <NavLink item={ADS_MANAGER_ITEM} active={ADS_MANAGER_ITEM.match(pathname)} badge={0} query={dateQuery} expanded={open} />
                </>
              )}
              {NAV_GROUPS.filter((g) => g.items.some(puedeVer)).map((g) => (
                <GroupHeader key={g.key} gKey={g.key} label={g.label} icon={g.icon} />
              ))}
            </>
          )}
        </nav>

        {/* MaKo (aparte) + Usuario (abajo) */}
        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <div style={{ height: 1, background: 'var(--sidebar-2)', margin: open ? '0 8px 8px' : '0 6px 8px' }} />
          {!adminShell && puedeVer(MAKO_ITEM) && <NavLink item={MAKO_ITEM} active={MAKO_ITEM.match(pathname)} badge={0} query={dateQuery} expanded={open} />}
          <button ref={userBtnRef} type="button" onClick={openUserMenu} onMouseEnter={openUserMenu} onMouseLeave={scheduleCloseUser} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, marginTop: 6, padding: open ? 9 : '9px 0', justifyContent: open ? 'flex-start' : 'center', borderRadius: 11, border: 'none', background: userOpen ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
            <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#171511', overflow: 'hidden' }}>
              {perfilAvatar
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={perfilAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : iniciales}
            </div>
            {open && (
              <>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--on-sidebar)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{perfilNombre}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 3 }}>Cuenta</div>
                </div>
                <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>›</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Flyout de un grupo (a la derecha). */}
      {flyout && flyoutGroup && createPortal(
        <div id="grp-flyout"
          onMouseEnter={() => { if (flyoutTimer.current) clearTimeout(flyoutTimer.current); }}
          onMouseLeave={scheduleCloseFlyout}
          style={{ position: 'fixed', top: flyout.top, left: flyout.left, zIndex: 2000, width: 226, background: 'var(--sidebar)', border: '1px solid var(--sidebar-2)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.4)', overflow: 'hidden', padding: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)', opacity: 0.6, padding: '4px 10px 8px' }}>{flyoutGroup.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {flyoutGroup.items.filter(puedeVer).map((it) => (
              <NavLink key={it.key} item={it} active={it.match(pathname)} badge={badgeFor(it)} query={dateQuery} expanded nested onClick={() => setFlyout(null)} />
            ))}
          </div>
        </div>,
        document.body,
      )}

      {/* Menú de la foto de perfil: al costado, desde la base (portal). */}
      {userOpen && menuPos && createPortal(
        <div id="user-menu"
          onMouseEnter={() => { if (userTimer.current) clearTimeout(userTimer.current); }}
          onMouseLeave={scheduleCloseUser}
          style={{ position: 'fixed', left: menuPos.left, bottom: menuPos.bottom, zIndex: 2000, width: 226, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.32)', overflow: 'hidden', padding: '5px 0' }}>
            {USER_NAV.filter((it) => (!it.adminOnly || rol === 'admin') && puedeVer(it)).map((it) => {
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
        </div>,
        document.body,
      )}
    </aside>
  );
}
