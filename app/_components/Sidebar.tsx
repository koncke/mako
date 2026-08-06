'use client';

// =============================================================================
// Sidebar — navegación por intención (rail de iconos ⇄ familias con sus ítems)
// =============================================================================
// Plegado: un rail con el icono de cada FAMILIA y su pregunta como tooltip.
// Expandido (al pasar el cursor): las familias, con la de tu ruta desplegada.
//
// DOS NIVELES, y la diferencia es la que hace que la barra no sea una lista de
// todo:
//   · los ítems de uso diario están a la vista dentro de su familia;
//   · las COLECCIONES (los siete Analysts, los tres canales de chat, los
//     writers) viven en un desplegable al costado. Ver nueve Analysts abiertos
//     para entrar a uno es exactamente el inventario que el rediseño saca.
//
// Todos los ítems llevan su icono, también los anidados: el dibujo es lo que
// hace que la fila se reconozca sin leerla.
//
// Las tres señales del estado activo, y ninguna es el dorado (§6.1 del anexo de
// arquitectura): contraste de superficie + indicador lateral + peso tipográfico.
// El dorado quedó reservado para MaKo.
//
// El contador vive en la FAMILIA y solo en la que notifica. El saldo de IA se
// fue al desplegable del perfil: es «visible, nunca protagonista», y al lado de
// las tabs competía todo el tiempo por algo que se mira una vez por semana.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FAMILIAS, MAKO_NAV, USER_NAV, ADMIN_NAV, type NavItem, type NavFamilia, type NavGrupo } from './nav';
import { tabEnCapa } from '@/lib/capas';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { Icon } from './icons';
import { SaldoMaKo } from './SaldoMaKo';

const MONO = "'Geist Mono', monospace";
const RAIL = 68;
const FULL = 244;
const ICO = 19;

function ItemIcon({ item, active }: { item: NavItem; active: boolean }) {
  if (item.icon === 'mako') return <MakoStar size={ICO} color="var(--mako)" />;
  return (
    <span style={{ display: 'flex', color: active ? 'var(--on-sidebar)' : 'var(--sidebar-text)' }}>
      <Icon name={item.icon} size={ICO} />
    </span>
  );
}

/** El contador de una familia. Solo la que notifica lo tiene. */
function Contador({ n, compacto }: { n: number; compacto?: boolean }) {
  if (n <= 0) return null;
  if (compacto) {
    return <span style={{ position: 'absolute', top: -3, right: -5, width: 8, height: 8, borderRadius: '50%', background: 'var(--bad)', border: '2px solid var(--sidebar)' }} />;
  }
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'var(--bad)', color: '#fff', flex: 'none' }}>
      {n > 99 ? '99+' : n}
    </span>
  );
}

/**
 * El estilo de UNA fila de la barra, compartido por familias, ítems, grupos y
 * el shell de admin. `nivel` cambia densidad y tamaño de texto; el color lo
 * decide `activo` y nada más. Una sola función para que las cuatro clases de
 * fila no se desalineen entre sí — que es de dónde salía la sensación de ruido.
 */
function filaStyle(activo: boolean, nivel: 'familia' | 'item', expandido: boolean): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    justifyContent: expandido ? 'flex-start' : 'center',
    padding: expandido ? (nivel === 'familia' ? '9px 10px' : '7px 10px') : '9px 0',
    borderRadius: 'var(--r-sm)',
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left', textDecoration: 'none',
    fontSize: nivel === 'familia' ? 'var(--fs-md)' : 'var(--fs-sm)',
    color: activo ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
    fontWeight: activo ? 600 : 500,
    whiteSpace: 'nowrap', overflow: 'hidden',
    ...(activo ? { background: 'var(--sidebar-2)', boxShadow: 'inset 3px 0 0 var(--on-sidebar)' } : {}),
  };
}

function NavLink({ item, active, expanded, nivel = 'item', onClick }: {
  item: NavItem; active: boolean; expanded: boolean; nivel?: 'familia' | 'item'; onClick?: () => void;
}) {
  const base = filaStyle(active, nivel, expanded);
  const content = (
    <>
      <span style={{ position: 'relative', display: 'flex', flex: 'none' }}><ItemIcon item={item} active={active} /></span>
      {expanded && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {expanded && item.comingSoon && (
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--sidebar-text)', border: '1px solid var(--sidebar-2)', borderRadius: 5, padding: '1px 5px', opacity: 0.65 }}>pronto</span>
      )}
    </>
  );
  if (item.entrarComoDueno) {
    return <button type="button" onClick={onClick} title={expanded ? undefined : item.label} style={base}>{content}</button>;
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
  const [flyout, setFlyout] = useState<{ key: string; top: number; left: number } | null>(null);
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
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { unreadTotal } = useNotifications();

  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  const open = expanded || userOpen || !!flyout;

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
    .map((f) => ({
      ...f,
      items: f.items.filter(puedeVer),
      grupos: (f.grupos ?? []).map((g) => ({ ...g, items: g.items.filter(puedeVer) })).filter((g) => g.items.length > 0),
    }))
    .filter((f) => f.items.length > 0 || f.grupos.length > 0);

  const todosDe = (f: NavFamilia) => [...f.items, ...(f.grupos ?? []).flatMap((g) => g.items)];

  /**
   * El contador de cada familia: los mensajes sin leer de WhatsApp más los datos
   * del CRM sin marcar. Son obligaciones concretas, no novedades — que es la
   * única cosa que el documento acepta como badge.
   */
  const contadorDe = (f: typeof familias[number]) => {
    if (!f.notifica) return 0;
    const claves = todosDe(f).map((i) => i.key);
    return (claves.includes('whatsapp') ? unreadTotal : 0) + (claves.includes('crm') ? sinMarcar : 0);
  };

  // La familia desplegada. La de tu ruta, y si no hay ninguna, Operate: entrar y
  // ver lo que se usa todos los días sin tener que abrir nada.
  const familiaActiva = familias.find((f) => todosDe(f).some((i) => i.match(pathname)))?.key ?? null;
  const desplegada = abierta ?? familiaActiva ?? 'operate';

  const grupoFlyout = flyout
    ? familias.flatMap((f) => f.grupos).find((g) => g.key === flyout.key) ?? null
    : null;

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
  useEffect(() => () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    if (userTimer.current) clearTimeout(userTimer.current);
  }, []);

  const abrirFlyout = (key: string, el: HTMLElement, largo: number) => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    const r = el.getBoundingClientRect();
    const alto = 44 + largo * 38;
    setUserOpen(false);
    setFlyout({ key, top: Math.min(r.top, Math.max(12, window.innerHeight - alto - 12)), left: r.right + 8 });
  };
  const cerrarFlyout = () => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    flyoutTimer.current = setTimeout(() => setFlyout(null), 220);
  };

  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: MouseEvent) => {
      if (document.getElementById('grp-flyout')?.contains(e.target as Node)) return;
      setFlyout(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [flyout]);

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

  /** La fila de una colección: abre su desplegable al costado. */
  const GrupoFila = ({ g }: { g: NavGrupo }) => {
    const activo = g.items.some((i) => i.match(pathname));
    const abierto = flyout?.key === g.key;
    return (
      <button type="button"
        onClick={(e) => abrirFlyout(g.key, e.currentTarget, g.items.length)}
        onMouseEnter={(e) => abrirFlyout(g.key, e.currentTarget, g.items.length)}
        onMouseLeave={cerrarFlyout}
        title={open ? undefined : g.label}
        style={{ ...filaStyle(activo, 'item', open), ...(abierto && !activo ? { background: 'var(--sidebar-2)' } : {}) }}>
        <span style={{ display: 'flex', flex: 'none', color: activo ? 'var(--on-sidebar)' : 'var(--sidebar-text)' }}>
          <Icon name={g.icon} size={ICO} />
        </span>
        {open && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>}
        {open && <span style={{ flex: 'none', fontSize: 10, color: 'var(--sidebar-text)' }}>›</span>}
      </button>
    );
  };

  /** La cabecera de una familia: su icono, su nombre y su contador. */
  const Familia = ({ f }: { f: typeof familias[number] }) => {
    const activa = todosDe(f).some((i) => i.match(pathname));
    const abiertaEsta = desplegada === f.key;
    const n = contadorDe(f);
    return (
      <div>
        <button type="button"
          onClick={() => { setAbierta(abiertaEsta && open ? null : f.key); setExpanded(true); }}
          title={open ? undefined : `${f.label} · ${f.pregunta}`}
          aria-expanded={abiertaEsta}
          style={{
            ...filaStyle(false, 'familia', open),
            background: (!open && activa) ? 'var(--sidebar-2)' : 'transparent',
            color: activa ? 'var(--on-sidebar)' : 'var(--sidebar-text)',
            fontWeight: activa ? 600 : 500,
          }}>
          <span style={{ position: 'relative', display: 'flex', flex: 'none', color: activa ? 'var(--on-sidebar)' : 'var(--sidebar-text)' }}>
            <Icon name={f.icon} size={ICO} />
            {!open && <Contador n={n} compacto />}
          </span>
          {open && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>}
          {open && <Contador n={n} />}
          {open && (
            <span style={{ flex: 'none', fontSize: 10, color: 'var(--sidebar-text)', transform: abiertaEsta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
          )}
        </button>
        {open && abiertaEsta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, margin: '1px 0 4px', paddingLeft: 10, marginLeft: 19, borderLeft: '1px solid var(--sidebar-2)' }}>
            {f.items.map((it) => <NavLink key={it.key} item={it} active={it.match(pathname)} expanded />)}
            {f.grupos.map((g) => <GrupoFila key={g.key} g={g} />)}
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
          padding: open ? '20px 14px' : '20px 10px', overflow: 'hidden',
          transition: 'width .2s ease, padding .2s ease',
          boxShadow: open ? '6px 0 30px rgba(23,21,17,.24)' : 'none',
        }}
      >
        {/* Marca: el logo y la palabra, alineados entre sí y nada más. El
            «Marketing OS» de abajo era una bajada que nadie lee y que
            desalineaba el bloque. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: open ? '0 4px 18px' : '0 0 18px', justifyContent: open ? 'flex-start' : 'center', flex: 'none' }}>
          <MakoLogo size={34} />
          {open && (
            <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
              <MakoWord base="#F3F0E7">MaKo</MakoWord>
            </div>
          )}
        </div>

        {/* Navegación. Con una familia abierta puede pasarse de alto en pantallas
            bajas: scrollea acá adentro, nunca corta. */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {adminShell ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', opacity: 0.55, padding: open ? '2px 10px 6px' : '2px 0 6px', textAlign: open ? 'left' : 'center' }}>{open ? 'Administración' : '·'}</div>
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.key} item={item} active={item.match(pathname)} expanded={open}
                  onClick={item.entrarComoDueno ? () => entrarComoDuenoYNavegar(item.href) : undefined} />
              ))}
            </>
          ) : (
            familias.map((f) => <Familia key={f.key} f={f} />)
          )}
        </nav>

        {/* MaKo (capacidad global) + perfil */}
        <div style={{ marginTop: 'auto', paddingTop: 12, flex: 'none' }}>
          <div style={{ height: 1, background: 'var(--sidebar-2)', margin: open ? '0 6px 8px' : '0 4px 8px' }} />
          {!adminShell && MAKO_NAV.filter(puedeVer).map((it) => (
            <NavLink key={it.key} item={it} active={it.match(pathname)} expanded={open} />
          ))}
          <button ref={userBtnRef} type="button" onClick={openUserMenu} onMouseEnter={openUserMenu} onMouseLeave={scheduleCloseUser}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: open ? '7px 8px' : '7px 0', justifyContent: open ? 'flex-start' : 'center', borderRadius: 'var(--r-md)', border: 'none', background: userOpen ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer' }}>
            {/* Las iniciales van sobre AZUL, no sobre el dorado: una foto de
                perfil es identidad, no una intervención de MaKo. */}
            <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13.5, color: '#fff', overflow: 'hidden' }}>
              {avatarVisible
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarVisible} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : iniciales}
            </div>
            {open && (
              <>
                <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--on-sidebar)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreVisible}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 2 }}>{impersonando ? 'Cliente' : 'Cuenta'}</div>
                </div>
                <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>›</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Desplegable de una colección (Chats, Analysts, Writers). */}
      {flyout && grupoFlyout && createPortal(
        <div id="grp-flyout"
          onMouseEnter={() => { if (flyoutTimer.current) clearTimeout(flyoutTimer.current); }}
          onMouseLeave={cerrarFlyout}
          style={{ position: 'fixed', top: flyout.top, left: flyout.left, zIndex: 2000, width: 218, background: 'var(--sidebar)', border: '1px solid var(--sidebar-2)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.4)', overflow: 'hidden', padding: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sidebar-text)', opacity: 0.55, padding: '4px 10px 6px' }}>{grupoFlyout.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {grupoFlyout.items.map((it) => (
              <NavLink key={it.key} item={it} active={it.match(pathname)} expanded onClick={() => setFlyout(null)} />
            ))}
          </div>
        </div>,
        document.body,
      )}

      {/* Menú del perfil: la quinta familia (Admin) vive acá, no en la barra.
          Y el saldo de IA también — visible, nunca protagonista. */}
      {userOpen && menuPos && createPortal(
        <div id="user-menu"
          onMouseEnter={() => { if (userTimer.current) clearTimeout(userTimer.current); }}
          onMouseLeave={scheduleCloseUser}
          style={{ position: 'fixed', left: menuPos.left, bottom: menuPos.bottom, zIndex: 2000, width: 230, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.32)', overflow: 'hidden', padding: '5px 0' }}>
            {USER_NAV.filter((it) => (!it.adminOnly || (rol === 'admin' && !impersonando)) && puedeVer(it)).map((it) => {
              const on = it.match(pathname);
              return (
                <Link key={it.key} href={it.href + dateQuery} onClick={() => setUserOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', fontSize: 'var(--fs-md)', fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', textDecoration: 'none' }}>
                  <span style={{ display: 'flex', color: on ? 'var(--primary)' : 'var(--faint)' }}><Icon name={it.icon} size={17} /></span>
                  {it.label}
                </Link>
              );
            })}
            {!rolCliente && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                <SaldoMaKo />
              </>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '5px 0 0' }} />
            <button type="button"
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', fontSize: 'var(--fs-md)', fontWeight: 500, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name="logout" size={17} /></span>
              Cerrar sesión
            </button>
        </div>,
        document.body,
      )}
    </aside>
  );
}
