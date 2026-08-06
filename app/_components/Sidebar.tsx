'use client';

// =============================================================================
// Sidebar — navegación por intención (rail de iconos ⇄ familias con sus ítems)
// =============================================================================
// Plegado: un rail con el icono de cada FAMILIA y su pregunta como tooltip.
// Expandido (al pasar el cursor): las cuatro familias con sus ítems adentro.
//
// El cambio de fondo respecto de la versión anterior no es cosmético. Antes los
// grupos (Analytics, Tools, Chats, CS) abrían un FLYOUT hacia la derecha, y ahí
// adentro vivían WhatsApp y Chat Agent — funciones de todos los días detrás de
// un hover y un segundo nivel. El documento lo prohíbe explícito: «los grupos no
// deben esconder funciones de uso diario en flyouts difíciles de descubrir» y
// «las funciones de uso diario nunca se esconden en un tercer nivel de menú».
// Ahora los ítems están a la vista dentro de su familia, sin flyout.
//
// Las tres señales del estado activo, y ninguna de ellas es el dorado (§6.1 del
// anexo de arquitectura): contraste de superficie + indicador lateral + peso
// tipográfico. El dorado quedó reservado para MaKo.
//
// Los contadores solo existen en Focus y Operate — «son los 2 únicos que
// notifican». En el resto un badge sería ruido.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FAMILIAS, MAKO_NAV, USER_NAV, ADMIN_NAV, type NavItem, type NavFamilia } from './nav';
import { tabEnCapa } from '@/lib/capas';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { Icon } from './icons';
import { SaldoMaKo } from './SaldoMaKo';

const MONO = "'Geist Mono', monospace";
const RAIL = 74;
const FULL = 252;

function ItemIcon({ item, active }: { item: NavItem; active: boolean }) {
  if (item.icon === 'mako') return <MakoStar size={21} color="var(--mako)" />;
  const color = active ? 'var(--on-sidebar)' : 'var(--sidebar-text)';
  return <span style={{ color, display: 'flex' }}><Icon name={item.icon} size={21} /></span>;
}

/** El contador de una familia. Solo Focus y Operate lo tienen. */
function Contador({ n, compacto }: { n: number; compacto?: boolean }) {
  if (n <= 0) return null;
  if (compacto) {
    return <span style={{ position: 'absolute', top: -4, right: -6, width: 9, height: 9, borderRadius: '50%', background: 'var(--bad)', border: '2px solid var(--sidebar)' }} />;
  }
  return (
    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--bad)', color: '#fff', flex: 'none' }}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

function NavLink({ item, active, expanded, nested, onClick }: {
  item: NavItem; active: boolean; expanded: boolean; nested?: boolean; onClick?: () => void;
}) {
  const base: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13,
    justifyContent: expanded ? 'flex-start' : 'center',
    padding: expanded ? (nested ? '9px 12px 9px 14px' : '11px 12px') : '10px 0',
    borderRadius: 'var(--r-sm)',
    textDecoration: 'none', fontSize: nested ? 'var(--fs-sm)' : 'var(--fs-md)',
    color: active ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
    fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden',
    ...(active ? { background: 'var(--sidebar-2)', boxShadow: 'inset 3px 0 0 var(--on-sidebar)' } : {}),
  };
  const content = (
    <>
      {(!nested || !expanded) && (
        <span style={{ position: 'relative', display: 'flex' }}><ItemIcon item={item} active={active} /></span>
      )}
      {expanded && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {expanded && item.comingSoon && (
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--sidebar-text)', border: '1px solid var(--sidebar-2)', borderRadius: 5, padding: '1px 5px', opacity: 0.7 }}>pronto</span>
      )}
    </>
  );
  if (item.entrarComoDueno) {
    return (
      <button type="button" onClick={onClick} title={expanded ? undefined : item.label}
        style={{ ...base, border: 'none', cursor: 'pointer', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}>
        {content}
      </button>
    );
  }
  if (item.newTab) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer" style={base} title={expanded ? undefined : item.label} onClick={onClick}>{content}</a>;
  }
  return <Link href={item.href} style={base} title={expanded ? undefined : item.label} onClick={onClick}>{content}</Link>;
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [sinMarcar, setSinMarcar] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [perfilNombre, setPerfilNombre] = useState('Mauricio Bustos');
  const [perfilAvatar, setPerfilAvatar] = useState('');
  const [rol, setRol] = useState<string>('');
  const [rolWs, setRolWs] = useState<string>('');
  const [capa, setCapa] = useState<string>('');
  const [impersonando, setImpersonando] = useState(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { unreadTotal } = useNotifications();

  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  const open = expanded || userOpen;

  useEffect(() => {
    let alive = true;
    fetch('/api/datos-sin-marcar-count').then((r) => r.json())
      .then((d) => { if (alive && typeof d?.total === 'number') setSinMarcar(d.total); })
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

  // Viendo como cliente, la identidad de abajo es la DEL CLIENTE. Ver la foto y
  // el nombre del admin adentro de la cuenta ajena rompe la ilusión y, peor,
  // hace dudar de en qué workspace se está parado.
  const nombreVisible = impersonando ? (clienteNombre || 'Cliente') : perfilNombre;
  const avatarVisible = impersonando ? '' : perfilAvatar;
  const iniciales = nombreVisible.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'MB';

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !j.autenticado) return;
        setRol((j.rol as string) || '');
        setRolWs((j.rolWs as string) || '');
        setCapa((j.capa as string) || '');
        setImpersonando(Boolean(j.impersonando));
        setClienteNombre((j.clienteNombre as string) || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  const adminShell = rol === 'admin' && !impersonando;

  // Filtro de tabs, dos ejes independientes:
  //  · ROL  — closer/setter solo ven las tabs anotadas con su rol en nav.ts.
  //  · CAPA — qué compró el cliente (lib/capas.ts). Aplica a TODOS, incluido el
  //           admin-cliente: no es un permiso, es lo que contrató.
  const rolCliente = rolWs === 'closer' || rolWs === 'setter';
  const puedeVer = (it: NavItem) =>
    (!rolCliente || (it.rolesWs as string[] | undefined)?.includes(rolWs) === true)
    && tabEnCapa(it.key, capa || undefined);

  const familias = FAMILIAS
    .map((f) => ({ ...f, items: f.items.filter(puedeVer) }))
    .filter((f) => f.items.length > 0);

  /**
   * El contador de cada familia. Hoy solo Operate tiene de dónde sacarlo: los
   * mensajes sin leer de WhatsApp y los datos del CRM sin marcar. Focus va a
   * contar la actividad del Perro Guardián cuando exista la pantalla Focus
   * (tarea #523) — hasta entonces devuelve 0 en vez de inventar un número.
   */
  const contadorDe = (f: NavFamilia) => {
    if (f.key === 'operate') {
      const wa = f.items.some((i) => i.key === 'whatsapp') ? unreadTotal : 0;
      const crm = f.items.some((i) => i.key === 'crm') ? sinMarcar : 0;
      return wa + crm;
    }
    return 0;
  };

  // La familia que se muestra desplegada. Por defecto, la que contiene la ruta
  // actual: entrar a la barra y ver dónde estás parado sin tener que abrir nada.
  const familiaActiva = familias.find((f) => f.items.some((i) => i.match(pathname)))?.key ?? null;
  const desplegada = abierta ?? familiaActiva;

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
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => { setExpanded(false); setAbierta(null); }, 340);
  };
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); if (userTimer.current) clearTimeout(userTimer.current); }, []);

  const openUserMenu = () => {
    if (userTimer.current) clearTimeout(userTimer.current);
    const r = userBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
    setUserOpen(true);
  };
  const scheduleCloseUser = () => {
    if (userTimer.current) clearTimeout(userTimer.current);
    userTimer.current = setTimeout(() => setUserOpen(false), 220);
  };

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

  /** La cabecera de una familia: su icono, su nombre y su contador. */
  const Familia = ({ f }: { f: NavFamilia }) => {
    const activa = f.items.some((i) => i.match(pathname));
    const abiertaEsta = desplegada === f.key;
    const n = f.notifica ? contadorDe(f) : 0;
    return (
      <div>
        <button type="button"
          onClick={() => { setAbierta(abiertaEsta && open ? null : f.key); setExpanded(true); }}
          title={open ? undefined : `${f.label} · ${f.pregunta}`}
          aria-expanded={abiertaEsta}
          style={{
            display: 'flex', alignItems: 'center', gap: 13, width: '100%',
            justifyContent: open ? 'flex-start' : 'center',
            padding: open ? '11px 12px' : '10px 0', borderRadius: 'var(--r-sm)',
            border: 'none', background: (!open && activa) ? 'var(--sidebar-2)' : 'transparent',
            cursor: 'pointer', color: activa ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
            fontWeight: activa ? 600 : 500, fontSize: 'var(--fs-md)', fontFamily: 'inherit',
          }}>
          <span style={{ position: 'relative', display: 'flex', color: activa ? 'var(--on-sidebar)' : 'var(--sidebar-text)' }}>
            <Icon name={f.icon} size={21} />
            {!open && <Contador n={n} compacto />}
          </span>
          {open && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>}
          {open && <Contador n={n} />}
          {open && (
            <span style={{ flex: 'none', fontSize: 10, color: 'var(--sidebar-text)', transform: abiertaEsta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
          )}
        </button>
        {open && abiertaEsta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, margin: '2px 0 6px', paddingLeft: 16, borderLeft: '1px solid var(--sidebar-2)', marginLeft: 21 }}>
            {f.items.map((it) => (
              <NavLink key={it.key} item={it} active={it.match(pathname)} expanded nested />
            ))}
          </div>
        )}
      </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: open ? '2px 6px 22px' : '2px 0 22px', justifyContent: open ? 'flex-start' : 'center', flex: 'none' }}>
          <MakoLogo size={40} />
          {open && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}><MakoWord base="#F3F0E7">MaKo</MakoWord></div>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 6 }}>Marketing OS</div>
            </div>
          )}
        </div>

        {/* Navegación. Con una familia abierta puede pasarse de alto en pantallas
            bajas: scrollea acá adentro, nunca corta. */}
        <nav className="mk-scroll-x" style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {adminShell ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)', opacity: 0.6, padding: open ? '4px 12px 8px' : '4px 0 8px', textAlign: open ? 'left' : 'center' }}>{open ? 'Administración' : '·'}</div>
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.key} item={item} active={item.match(pathname)} expanded={open}
                  onClick={item.entrarComoDueno ? () => entrarComoDuenoYNavegar(item.href) : undefined} />
              ))}
            </>
          ) : (
            familias.map((f) => <Familia key={f.key} f={f} />)
          )}
        </nav>

        {/* MaKo (capacidad global) + Saldo IA + Perfil */}
        <div style={{ marginTop: 'auto', paddingTop: 14, flex: 'none' }}>
          {open && !rolCliente && <div style={{ padding: '0 6px' }}><SaldoMaKo /></div>}
          <div style={{ height: 1, background: 'var(--sidebar-2)', margin: open ? '0 8px 8px' : '0 6px 8px' }} />
          {!adminShell && MAKO_NAV.filter(puedeVer).map((it) => (
            <NavLink key={it.key} item={it} active={it.match(pathname)} expanded={open} />
          ))}
          <button ref={userBtnRef} type="button" onClick={openUserMenu} onMouseEnter={openUserMenu} onMouseLeave={scheduleCloseUser} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, marginTop: 6, padding: open ? 9 : '9px 0', justifyContent: open ? 'flex-start' : 'center', borderRadius: 'var(--r-md)', border: 'none', background: userOpen ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
            {/* Las iniciales van sobre AZUL, no sobre el dorado: una foto de
                perfil es identidad, no una intervención de MaKo. */}
            <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff', overflow: 'hidden' }}>
              {avatarVisible
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarVisible} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : iniciales}
            </div>
            {open && (
              <>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--on-sidebar)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreVisible}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 3 }}>{impersonando ? 'Cliente' : 'Cuenta'}</div>
                </div>
                <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>›</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Menú del perfil: la quinta familia (Admin) vive acá, no en la barra. */}
      {userOpen && menuPos && createPortal(
        <div id="user-menu"
          onMouseEnter={() => { if (userTimer.current) clearTimeout(userTimer.current); }}
          onMouseLeave={scheduleCloseUser}
          style={{ position: 'fixed', left: menuPos.left, bottom: menuPos.bottom, zIndex: 2000, width: 226, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.32)', overflow: 'hidden', padding: '5px 0' }}>
            {USER_NAV.filter((it) => (!it.adminOnly || (rol === 'admin' && !impersonando)) && puedeVer(it)).map((it) => {
              const on = it.match(pathname);
              return (
                <Link key={it.key} href={it.href + dateQuery} onClick={() => setUserOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px', fontSize: 'var(--fs-md)', fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', textDecoration: 'none' }}>
                  <span style={{ display: 'flex', color: on ? 'var(--primary)' : 'var(--faint)' }}><Icon name={it.icon} size={18} /></span>
                  {it.label}
                </Link>
              );
            })}
            <button type="button"
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px', fontSize: 'var(--fs-md)', fontWeight: 500, color: 'var(--dim)', background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
              <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name="logout" size={18} /></span>
              Cerrar sesión
            </button>
        </div>,
        document.body,
      )}
    </aside>
  );
}
