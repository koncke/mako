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

import Link from '@/app/_ui/Link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FAMILIAS, MAKO_NAV, USER_NAV, ADMIN_FAMILIAS, itemsDe, type NavItem, type NavGrupo } from './nav';
import { tabEnCapa } from '@/lib/capas';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { Icon } from './icons';
import { SaldoMaKo } from './SaldoMaKo';

const MONO = "'Geist Mono', monospace";
export const RAIL = 68;
export const FULL = 244;
const ICO = 19;
/** Los destinos de adentro de una familia, un punto más chicos: eso solo ya
 *  dice «esto cuelga de aquello», sin necesidad de una línea que lo diga. */
const ICO_HIJO = 17;

function ItemIcon({ item, size = ICO }: { item: NavItem; size?: number }) {
  if (item.icon === 'mako') return <MakoStar size={size} color="var(--mako)" />;
  // El color lo hereda de la fila (currentColor): así el hover lo pinta también,
  // sin que el ícono se quede apagado cuando el texto ya se encendió.
  return <span style={{ display: 'flex', color: 'inherit' }}><Icon name={item.icon} size={size} /></span>;
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

type Tema = 'oscuro' | 'claro';

/**
 * El estilo de UNA fila, compartido por familias, ítems, grupos, desplegables y
 * el shell de admin. Una sola función para que las cinco clases de fila no se
 * desalineen entre sí — que es de dónde salía la sensación de ruido.
 *
 * El hover y el foco NO están acá: viven en `.mk-navrow` (ui.css), porque un
 * `style` en línea no los tiene. Sin ellos la barra no se siente navegable.
 */
export function filaStyle(expandido: boolean): CSSProperties {
  // Solo GEOMETRÍA. El color, el fondo, el peso y el indicador del activo viven
  // en `.mk-navrow` (ui.css) porque un estilo en línea le gana a cualquier regla
  // de hoja: mientras acá decía `background: transparent`, el `:hover` de la
  // clase no se veía nunca y las tabs parecían muertas.
  return {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    justifyContent: expandido ? 'flex-start' : 'center',
    padding: expandido ? '7px 10px' : '8px 0',
    borderRadius: 'var(--r-sm)',
    border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left', textDecoration: 'none',
    fontSize: 'var(--fs-sm)',
    whiteSpace: 'nowrap', overflow: 'hidden',
  };
}

/**
 * La caja oscura que se ensancha. La comparten la barra de verdad y su vista
 * previa en /admin/ui: si el aire o el color cambian acá, cambian en las dos.
 * Lo que NO está en esta función es el `transition` y la sombra, que dependen de
 * si la barra se puede mover — la vista previa no se mueve.
 */
export function panelStyle(open: boolean): CSSProperties {
  return {
    width: open ? FULL : RAIL,
    background: 'var(--sidebar)', display: 'flex', flexDirection: 'column',
    padding: open ? '20px 14px' : '20px 10px', overflow: 'hidden',
  };
}

/**
 * La marca. Es un LINK a la pantalla de entrada, que es lo que todo el mundo
 * espera del logo de una app — y de paso le da al bloque una razón de ser:
 * antes eran dos cosas puestas ahí, sin función y sin reaccionar a nada.
 * El movimiento vive en `.mk-marca` y solo pasa al pasar el cursor: la insignia
 * se levanta apenas y la palabra se enciende. Nada permanente, que es la regla
 * del documento para los destellos de marca.
 */
export function Marca({ open }: { open: boolean }) {
  return (
    <Link href="/general" className="mk-marca" title="Ir a General"
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: open ? '2px 6px 20px' : '2px 0 20px', justifyContent: open ? 'flex-start' : 'center', flex: 'none', textDecoration: 'none' }}>
      <span className="mk-marca__logo" style={{ display: 'flex', flex: 'none' }}><MakoLogo size={32} /></span>
      {open && (
        <span className="mk-marca__word" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>
          <MakoWord base="#F3F0E7">MaKo</MakoWord>
        </span>
      )}
    </Link>
  );
}

/** El botón de identidad del pie. Geometría compartida con la vista previa. */
export function identidadStyle(open: boolean, activo: boolean): CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginTop: 4,
    padding: open ? '7px 8px' : '7px 0',
    justifyContent: open ? 'flex-start' : 'center',
    borderRadius: 'var(--r-md)', border: 'none',
    background: activo ? 'var(--sidebar-2)' : 'transparent', cursor: 'pointer',
  };
}

/** Lo que va ADENTRO de ese botón: la foto (o las iniciales) y el nombre. */
export function Identidad({ open, nombre, avatar, subrotulo }: {
  open: boolean; nombre: string; avatar?: string; subrotulo: string;
}) {
  const iniciales = nombre.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || 'MB';
  return (
    <>
      {/* Las iniciales van sobre AZUL, no sobre el dorado: una foto de perfil
          es identidad, no una intervención de MaKo. */}
      <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13.5, color: '#fff', overflow: 'hidden' }}>
        {avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : iniciales}
      </div>
      {open && (
        <>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--on-sidebar)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-text)', marginTop: 2 }}>{subrotulo}</div>
          </div>
          <span style={{ color: 'var(--sidebar-text)', fontSize: 11, flex: 'none' }}>›</span>
        </>
      )}
    </>
  );
}

export function NavLink({ item, active, expanded, tema = 'oscuro', size, badge = 0, onClick }: {
  item: NavItem; active: boolean; expanded: boolean; tema?: Tema; size?: number; badge?: number; onClick?: () => void;
}) {
  const base = filaStyle(expanded);
  const cls = `mk-navrow${tema === 'claro' ? ' mk-navrow--claro' : ''}${active ? ' is-activo' : ''}`;
  const content = (
    <>
      <span style={{ position: 'relative', display: 'flex', flex: 'none' }}>
        <ItemIcon item={item} size={size} />
        {!expanded && <Contador n={badge} compacto />}
      </span>
      {expanded && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {expanded && <Contador n={badge} />}
      {expanded && item.comingSoon && (
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'currentColor', border: '1px solid currentColor', borderRadius: 5, padding: '1px 5px', opacity: 0.5 }}>pronto</span>
      )}
    </>
  );
  const props = { className: cls, style: base, title: expanded ? undefined : item.label };
  if (item.entrarComoDueno) return <button type="button" onClick={onClick} {...props}>{content}</button>;
  if (item.newTab) return <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClick} {...props}>{content}</a>;
  return <Link href={item.href} onClick={onClick} {...props}>{content}</Link>;
}

/** Una familia ya filtrada por rol y capa (lo que el Sidebar arma para pintar). */
export type FamiliaVista = { key: string; label: string; pregunta: string; icon: string; notifica?: boolean; bloques: NavItem[][]; grupos: NavGrupo[] };

/** La fila de una colección: abre su desplegable al costado. */
function GrupoFila({ g, open, pathname, abierto, onAbrir, onCerrar }: {
  g: NavGrupo; open: boolean; pathname: string; abierto: boolean;
  onAbrir: (key: string, el: HTMLElement, largo: number) => void; onCerrar: () => void;
}) {
  const activo = g.items.some((i) => i.match(pathname));
  const cls = `mk-navrow${activo ? ' is-activo' : abierto ? ' is-abierto' : ''}`;
  return (
    <button type="button" className={cls}
      onClick={(e) => onAbrir(g.key, e.currentTarget, g.items.length)}
      onMouseEnter={(e) => onAbrir(g.key, e.currentTarget, g.items.length)}
      onMouseLeave={onCerrar}
      title={open ? undefined : g.label}
      style={filaStyle(open)}>
      <span style={{ display: 'flex', flex: 'none', color: 'inherit' }}>
        <Icon name={g.icon} size={open ? ICO : ICO_HIJO} />
      </span>
      {open && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>}
      {open && <span style={{ flex: 'none', fontSize: 10, opacity: 0.7 }}>›</span>}
    </button>
  );
}

/**
 * Una familia: su rótulo y, si está desplegada, sus destinos.
 *
 * CÓMO SE DISTINGUE DE UNA TAB. El intento anterior le puso una superficie
 * propia al rótulo, y salió peor: una franja clara con texto es exactamente lo
 * que hace un item ACTIVO, así que la sección parecía la tab seleccionada.
 *
 * Ahora al revés, que es lo que hacen Linear, Notion y Attio: el rótulo no es
 * una fila, es un LETRERO. No tiene fondo, ni en reposo ni al pasar el cursor;
 * es chico, tenue y en versalitas; y una línea fina lo separa de la sección de
 * arriba. Los destinos son lo único con superficie, borde e indicador. La
 * jerarquía queda al derecho: lo que orienta retrocede, lo que se toca manda.
 *
 * Plegada vale lo mismo: el ícono de la familia va tenue y chico, los de las
 * tabs enteros, y la línea separa. Ninguna de las dos señales es el color.
 */
export function Familia({ f, primera, open, pathname, abiertaEsta, contadorFamilia, contadorItem, onToggle, flyoutKey, onAbrirFlyout, onCerrarFlyout, onEntrarComoDueno }: {
  f: FamiliaVista; primera: boolean; open: boolean; pathname: string; abiertaEsta: boolean;
  contadorFamilia: number; contadorItem: (key: string) => number;
  onToggle: (key: string) => void;
  flyoutKey: string | null;
  onAbrirFlyout: (key: string, el: HTMLElement, largo: number) => void; onCerrarFlyout: () => void;
  /**
   * Para los items marcados `entrarComoDueno`: impersonan ws1 y recién ahí
   * navegan. Sin esto, un item con ese flag renderiza un `<button>` con
   * `onClick` vacío —un botón que no hace nada— así que el prop viaja aunque hoy
   * ningún item lo use: el flag existe para el admin SIN workspace propio, que
   * es el único caso en que las tabs de producto le dan 403.
   */
  onEntrarComoDueno?: (href: string) => void;
}) {
  const activa = [...f.bloques.flat(), ...f.grupos.flatMap((g) => g.items)].some((i) => i.match(pathname));
  return (
    <div style={{ marginTop: primera ? 0 : 16 }}>
      {/* El rótulo va AFUERA de la caja y más grande que las tabs. Es la
          diferencia que faltaba: no es una fila más de la lista, es el título
          de lo que viene abajo. */}
      <button type="button" className="mk-seccion"
        onClick={() => onToggle(f.key)}
        title={open ? undefined : `${f.label} · ${f.pregunta}`}
        aria-expanded={abiertaEsta}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
          justifyContent: open ? 'flex-start' : 'center',
          padding: open ? '0 2px 7px' : '0 0 7px',
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontFamily: MONO, fontSize: 12, letterSpacing: '.17em',
          textTransform: 'uppercase', fontWeight: 700,
          // El rótulo va CLARO y las tabs tenues: al revés de lo que tenía
          // antes. Es el título de lo que viene abajo, no una fila apagada.
          color: 'var(--on-sidebar)',
          opacity: activa ? 1 : 0.78,
        }}>
        <span style={{ position: 'relative', display: 'flex', flex: 'none', color: 'inherit' }}>
          <Icon name={f.icon} size={open ? 15 : 17} />
          {/* Plegada, la sección igual avisa: es lo único que se ve de lo que
              no está desplegado. */}
          {!open && !abiertaEsta && <Contador n={contadorFamilia} compacto />}
        </span>
        {open && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>}
        {/* El número vive en la familia SOLO mientras está cerrada. Abierta, baja
            a la tab que lo debe: si no, te dice que hay 14 cosas pendientes pero
            no cuál de las siete filas las tiene. */}
        {open && !abiertaEsta && <Contador n={contadorFamilia} />}
        {open && <span style={{ flex: 'none', fontSize: 10, opacity: 0.75, transform: abiertaEsta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>}
      </button>
      {abiertaEsta && (
        // Y las tabs van ADENTRO de una caja. El rótulo afuera + la caja adentro
        // es lo que hace que se lean como dos cosas distintas sin depender del
        // tamaño del texto ni del color, que era lo que se confundía.
        // La caja tiene que VERSE. El 3,5% de blanco de antes era invisible
        // sobre el #14161B de la barra, así que el «englobar» no se leía. Con
        // fondo al 6% y un borde al 8% el bloque existe, y el rótulo de arriba
        // queda claramente afuera de él.
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 'var(--r-lg)',
          padding: open ? 5 : '5px 3px',
        }}>
          {f.bloques.map((bloque, i) => (
            // Los bloques de adentro de una familia se separan con una línea:
            // adentro de la caja no compite con nada.
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 1,
              ...(i > 0 ? { marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' } : {}),
            }}>
              {bloque.map((it) => (
                <NavLink key={it.key} item={it} active={it.match(pathname)} expanded={open} badge={contadorItem(it.key)}
                  onClick={it.entrarComoDueno ? () => onEntrarComoDueno?.(it.href) : undefined} />
              ))}
            </div>
          ))}
          {f.grupos.map((g) => (
            <div key={g.key} style={{ marginTop: f.bloques.length ? 6 : 0, paddingTop: f.bloques.length ? 6 : 0, borderTop: f.bloques.length ? '1px solid rgba(255,255,255,.06)' : undefined }}>
              <GrupoFila g={g} open={open} pathname={pathname} abierto={flyoutKey === g.key}
                onAbrir={onAbrirFlyout} onCerrar={onCerrarFlyout} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const [sinMarcar, setSinMarcar] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // El desplegable solo guarda QUÉ y a qué altura. El `left` NO se guarda: se
  // calcula al pintar, del ancho final de la barra. Guardarlo era el bug —
  // se medía con getBoundingClientRect() mientras el ancho estaba animándose
  // de 68 a 244, así que el menú quedaba clavado encima de la barra.
  const [flyout, setFlyout] = useState<{ key: string; top: number } | null>(null);
  const [perfilNombre, setPerfilNombre] = useState('Mauricio Bustos');
  const [perfilAvatar, setPerfilAvatar] = useState('');
  const [rol, setRol] = useState<string>('');
  const [rolWs, setRolWs] = useState<string>('');
  const [capa, setCapa] = useState<string>('');
  const [impersonando, setImpersonando] = useState(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  /** El panel que se ensancha. Se le consulta `:hover` antes de plegar. */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { unreadTotal } = useNotifications();

  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const dateQuery = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  const open = expanded || userOpen || !!flyout;

  /**
   * EN QUÉ ESTÁ LA BARRA. No alcanza con «abierta sí/no»: entre esos dos hay
   * 200 ms de animación de ancho, y varias cosas que se miden durante ese rato
   * salen mal —un desplegable posicionado a mitad de camino, un rect de 0 px—.
   * `moviendo` marca ese intervalo y lo que dependa de la geometría espera.
   */
  const [openVisto, setOpenVisto] = useState(open);
  const [moviendo, setMoviendo] = useState(false);
  if (open !== openVisto) { setOpenVisto(open); setMoviendo(true); }
  /** Quieta y con su ancho definitivo: recién acá se puede medir y desplegar. */
  const barraQuieta = !moviendo;

  // Red de seguridad del `transitionend`: ese evento NO llega si la animación se
  // interrumpe, si la pestaña está en segundo plano o si el usuario pidió menos
  // movimiento. Sin esto, `moviendo` se quedaba en true para siempre y los
  // desplegables no volvían a abrir nunca — un cuelgue silencioso.
  useEffect(() => {
    if (!moviendo) return;
    const t = setTimeout(() => setMoviendo(false), 260);
    return () => clearTimeout(t);
  }, [moviendo]);

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

  const familiasProducto = FAMILIAS
    .map((f) => ({
      ...f,
      bloques: f.bloques.map((b) => b.filter(puedeVer)).filter((b) => b.length > 0),
      grupos: (f.grupos ?? []).map((g) => ({ ...g, items: g.items.filter(puedeVer) })).filter((g) => g.items.length > 0),
    }))
    .filter((f) => f.bloques.length > 0 || f.grupos.length > 0);

  /**
   * El super admin ve LAS MISMAS familias de producto que un cliente, y además
   * Admin y Dev al final. Dos decisiones adentro de esta línea:
   *
   * · Van al FINAL y no al principio: el trabajo diario es el producto; Admin y
   *   Dev son a dónde vas cuando pasó otra cosa.
   * · A las dos de admin NO se les aplica `puedeVer`. El filtro por capa es «qué
   *   contrató este cliente», y la agencia no contrató nada: son sus
   *   herramientas. Pasarlas por el filtro sería atarlas a un catálogo comercial
   *   que no las contempla.
   */
  const familias = adminShell
    ? [...familiasProducto, ...ADMIN_FAMILIAS.map((f) => ({ ...f, grupos: f.grupos ?? [] }))]
    : familiasProducto;

  const todosDe = (f: typeof familias[number]) => [...f.bloques.flat(), ...f.grupos.flatMap((g) => g.items)];

  /**
   * Lo que cada tab te debe. Son obligaciones concretas —mensajes sin leer,
   * datos del CRM sin marcar—, no novedades: es lo único que el documento
   * acepta como badge.
   */
  const contadorItem = (key: string) =>
    key === 'whatsapp' ? unreadTotal : key === 'crm' ? sinMarcar : 0;

  /**
   * El de la familia es la SUMA de los de adentro, y solo se muestra cuando la
   * sección está cerrada: es un resumen de lo que no estás viendo. Con la
   * sección abierta el número tiene que estar en la tab que lo debe — si no,
   * te dice que hay 14 cosas pero no cuál de las siete filas las tiene.
   */
  const contadorDe = (f: typeof familias[number]) =>
    f.notifica ? todosDe(f).reduce((s, i) => s + contadorItem(i.key), 0) : 0;

  /**
   * QUÉ FAMILIA ESTÁ DESPLEGADA. Es estado, no algo derivado del cursor: si se
   * recalculara en cada render, abrir Analyze y mover el mouse la cerraba y
   * volvía a Operate — que era exactamente el bug.
   *
   * La elección del usuario MANDA y se queda. Lo único que la pisa es navegar a
   * una tab de otra familia: ahí se abre la familia donde estás parado, porque
   * ya te fuiste de la otra. Es el patrón de React de «ajustar estado cuando
   * cambia una prop», hecho en render y no en un efecto (un efecto pintaría un
   * frame con la familia equivocada).
   */
  // Busca en TODAS las familias visibles, no solo en las de producto: si no, un
  // super admin parado en /admin/docs no abría ninguna sección y la barra le
  // quedaba con Operate desplegada, que no es donde está.
  const familiaDeRuta = [...FAMILIAS, ...ADMIN_FAMILIAS].find((f) => itemsDe(f).some((i) => i.match(pathname)))?.key ?? null;
  const [rutaVista, setRutaVista] = useState(familiaDeRuta);
  const [abierta, setAbierta] = useState<string | null>(familiaDeRuta ?? 'operate');
  if (familiaDeRuta && familiaDeRuta !== rutaVista) {
    setRutaVista(familiaDeRuta);
    setAbierta(familiaDeRuta);
  }
  const desplegada = abierta;

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

  /**
   * PLEGAR, PERO SOLO SI EL CURSOR SE FUE DE VERDAD.
   *
   * El `onMouseLeave` de React no alcanza como única señal: cuando un hijo se
   * re-crea debajo del cursor, el navegador dispara un mouseout y React lo
   * traduce a un mouseleave aunque el puntero no se haya movido ni un píxel. Y
   * como después NO hay un mouseenter (nunca saliste), nada cancelaba el reloj
   * y la barra se cerraba sola mientras la estabas usando.
   *
   * Antes de plegar, entonces, se le pregunta al DOM: `:hover` es la verdad del
   * navegador y no depende de que los eventos hayan llegado bien. Si el cursor
   * sigue sobre la barra o sobre alguno de sus menús, se reprograma en vez de
   * cerrar.
   */
  const programarPlegado = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    const chequear = () => {
      const encima = panelRef.current?.matches(':hover')
        || document.getElementById('grp-flyout')?.matches(':hover')
        || document.getElementById('user-menu')?.matches(':hover');
      if (encima) { collapseTimer.current = setTimeout(chequear, 180); return; }
      setExpanded(false);
    };
    collapseTimer.current = setTimeout(chequear, 340);
  };
  const onLeave = programarPlegado;
  useEffect(() => () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    if (userTimer.current) clearTimeout(userTimer.current);
  }, []);

  const abrirFlyout = (key: string, el: HTMLElement, largo: number) => {
    // Mientras la barra se está abriendo NO se despliega nada: el ancho todavía
    // no es el final y el menú saldría en el lugar equivocado. Se abre cuando
    // la barra terminó de moverse.
    if (!barraQuieta) return;
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    // El desplegable vive en un portal, o sea FUERA del <aside>: llevar el
    // cursor hasta él dispara el onMouseLeave de la barra. Sin cancelar el
    // plegado, la barra se cerraba abajo del menú que acabás de abrir.
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    const r = el.getBoundingClientRect();
    const alto = 44 + largo * 38;
    setUserOpen(false);
    setFlyout({ key, top: Math.min(r.top, Math.max(12, window.innerHeight - alto - 12)) });
  };
  const cerrarFlyout = () => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current);
    // Al cerrarse el desplegable vuelve a correr el reloj del plegado. Si el
    // cursor volvió a la barra, su onMouseEnter lo cancela.
    flyoutTimer.current = setTimeout(() => { setFlyout(null); programarPlegado(); }, 220);
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

  return (
    <aside style={{ width: RAIL, flex: 'none', alignSelf: 'stretch', position: 'sticky', top: 0, height: '100vh', overflow: 'visible', zIndex: 60 }}>
      <div
        ref={panelRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        // Fin de la animación de ancho: recién acá la barra tiene su medida
        // final y lo que depende de la geometría (los desplegables) se habilita.
        onTransitionEnd={(e) => { if (e.propertyName === 'width') setMoviendo(false); }}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          ...panelStyle(open),
          transition: 'width .2s ease, padding .2s ease',
          boxShadow: open ? '6px 0 30px rgba(23,21,17,.24)' : 'none',
        }}
      >
        <Marca open={open} />

        {/* Navegación. Con una familia abierta puede pasarse de alto en pantallas
            bajas: scrollea acá adentro, nunca corta. */}
        {/* El separador entre familias es el ESPACIO (marginBottom de cada una),
            no una línea: el documento pide que la elevación y los bordes sean
            mínimos y que el aire y el contraste hagan el trabajo. */}
        {/* `.mk-scroll-oscuro`: la barra nativa de Windows es blanca y ancha, y
            sobre este rail queda como lo más brillante de la pantalla. Se
            adelgaza y se tiñe con --sidebar-line; NO se esconde — sería sacar la
            única señal de que abajo hay más destinos. Ver ui.css. */}
        <nav className="mk-scroll-oscuro" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* UNA sola rama para los dos shells. El admin tenía la suya —un
              rótulo estático y una lista plana— y por eso su barra no se parecía
              a la del producto ni se desplegaba. Mientras sean dos JSX distintos
              vuelven a divergir a la tercera edición. */}
          {familias.map((f, i) => (
            <Familia key={f.key} f={f} primera={i === 0} open={open} pathname={pathname}
              abiertaEsta={desplegada === f.key}
              contadorFamilia={contadorDe(f)} contadorItem={contadorItem}
              onToggle={(k) => { setExpanded(true); setAbierta((prev) => (prev === k && open ? null : k)); }}
              flyoutKey={flyout?.key ?? null}
              onAbrirFlyout={abrirFlyout} onCerrarFlyout={cerrarFlyout}
              onEntrarComoDueno={entrarComoDuenoYNavegar} />
          ))}
        </nav>

        {/* MaKo (capacidad global) + perfil */}
        <div style={{ marginTop: 'auto', paddingTop: 12, flex: 'none' }}>
          <div style={{ height: 1, background: 'var(--sidebar-2)', margin: open ? '0 6px 8px' : '0 4px 8px' }} />
          {/* MaKo también para el super admin: es una capacidad global, y si va a
              vender el producto usándolo, no puede ser lo único que le falte. */}
          {MAKO_NAV.filter((it) => adminShell || puedeVer(it)).map((it) => (
            <NavLink key={it.key} item={it} active={it.match(pathname)} expanded={open} />
          ))}
          <button ref={userBtnRef} type="button" onClick={openUserMenu} onMouseEnter={openUserMenu} onMouseLeave={scheduleCloseUser}
            style={identidadStyle(open, userOpen)}>
            <Identidad open={open} nombre={nombreVisible} avatar={avatarVisible} subrotulo={impersonando ? 'Cliente' : 'Cuenta'} />
          </button>
        </div>
      </div>

      {/* Desplegable de una colección (Chats, Analysts, Writers). BLANCO, como
          el del perfil y como el resto de los menús de la app: uno oscuro
          flotando sobre el contenido claro se leía como parte de la barra, y
          entonces no quedaba claro si te habías ido de la sección o no. */}
      {flyout && grupoFlyout && createPortal(
        <div id="grp-flyout"
          onMouseEnter={() => { if (flyoutTimer.current) clearTimeout(flyoutTimer.current); }}
          onMouseLeave={cerrarFlyout}
          // ⚠️ `maxHeight` + `overflowY`, o el desplegable hereda el problema que
          // vino a resolver. El `alto` que calcula `abrirFlyout` solo clampea el
          // `top`: si la colección crece más que la pantalla, el `overflow:
          // hidden` de acá le corta las últimas filas EN SILENCIO — sin barra,
          // sin degradado, sin nada. Y «Registros» es justo la que crece: sumó
          // tres áreas en 24 horas. La barra va con `.mk-scroll-oscuro`, que
          // adelgaza y tiñe pero NUNCA esconde.
          className="mk-scroll-oscuro"
          style={{ position: 'fixed', top: flyout.top, left: (open ? FULL : RAIL) + 8, zIndex: 2000, width: 226, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.28)', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', overflowX: 'hidden', padding: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', padding: '4px 10px 6px' }}>{grupoFlyout.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {grupoFlyout.items.map((it) => (
              <NavLink key={it.key} item={it} active={it.match(pathname)} expanded tema="claro" onClick={() => setFlyout(null)} />
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
          style={{ position: 'fixed', left: menuPos.left, bottom: menuPos.bottom, zIndex: 2000, width: 234, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: '0 18px 44px rgba(23,21,17,.28)', overflow: 'hidden', padding: '5px 0' }}>
            {/* El saldo va PRIMERO: es el único dato del menú, y un número que
                hay que ir a buscar al final se mira menos que uno que ya está. */}
            {!rolCliente && (
              <>
                <SaldoMaKo />
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
              </>
            )}
            {USER_NAV.filter((it) => (!it.adminOnly || (rol === 'admin' && !impersonando)) && puedeVer(it)).map((it) => {
              const on = it.match(pathname);
              return (
                <Link key={it.key} href={it.href + dateQuery} onClick={() => setUserOpen(false)}
                  className="mk-navrow mk-navrow--claro" data-activo={on}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', borderRadius: 0, fontSize: 'var(--fs-md)', fontWeight: on ? 600 : 500, textDecoration: 'none' }}>
                  <span style={{ display: 'flex', color: on ? 'var(--primary)' : 'var(--faint)' }}><Icon name={it.icon} size={17} /></span>
                  {it.label}
                </Link>
              );
            })}
            <div style={{ height: 1, background: 'var(--border)', margin: '5px 0 0' }} />
            <button type="button" className="mk-salir"
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', fontSize: 'var(--fs-md)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', color: 'currentColor' }}><Icon name="logout" size={17} /></span>
              Cerrar sesión
            </button>
        </div>,
        document.body,
      )}
    </aside>
  );
}
