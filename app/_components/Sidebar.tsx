'use client';

// =============================================================================
// Sidebar — navegación por intención (rail de iconos ⇄ familias con sus ítems)
// =============================================================================
// Plegado: un rail con los íconos de los destinos, las familias separadas por una línea.
// Expandido (al pasar el cursor): arriba Ops Center y Second Brain con sus criaturas, y las familias abiertas, cada una
// plegable sola (17/10/2026, copiado de Linear, Notion y Attio: docs/diseno-sidebar.md).
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
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FAMILIAS, arribaDe, USER_NAV, SUPERADMIN_MENU, PRONTO, SIN_FILA, ADMIN_FAMILIAS, SECCIONES_ADMIN, itemsDe, fuenteContador, sumaDeContadores, type FuenteContador, type NavItem, type NavGrupo } from './nav';
import { puedeVerItem, resolverTab, seccionesVisibles } from '@/lib/nav-visibilidad';
import { ROTULO_PASAR_A_PRO, esNavSoloPro } from '@/lib/plan-esencial-reglas';
import { BuscadorNav, type Destino } from './BuscadorNav';
import { MakoLogo, MakoWord, MakoStar } from './MakoBrand';
import { useNotifications } from './NotificationsProvider';
import { Icon } from './icons';
import { Criatura } from './Criatura';
import { EstrellaDeLaApp } from '@/app/_chat/EstrellaDeLaApp';
import { SaldoMaKo } from './SaldoMaKo';
import { CampanitaAvisos, ID_PANEL_AVISOS } from './CampanitaAvisos';
import { InterruptorModo } from './InterruptorModo';
import { useMakoAbierto } from '@/app/_chat/mako-abierto';
import { iniciales } from '@/lib/unicode-seguro';
import { CartelPrueba } from './CartelPrueba';
import { MedidorDeUso } from './MedidorDeUso';

const MONO = "'Geist Mono', monospace";
export const RAIL = 68;
export const FULL = 244;
const ICO = 19;
/** Los destinos de adentro de una familia, un punto más chicos: eso solo ya
 *  dice «esto cuelga de aquello», sin necesidad de una línea que lo diga. */
const ICO_HIJO = 17;

function ItemIcon({ item, size = ICO }: { item: NavItem; size?: number }) {
  // Las dos entradas «Ops Center» (la del super admin y, desde el 18/10/2026, la de cada negocio) llevan la estrella de MaKo.
  if (item.criatura) return <Criatura nombre={item.criatura} estrella={!!item.estrella} size={size} />;
  if (item.icon === 'mako') return <MakoStar size={size} color="var(--mako)" />;
  // El color lo hereda de la fila (currentColor): así el hover lo pinta también,
  // sin que el ícono se quede apagado cuando el texto ya se encendió.
  // El tinte de la SECCIÓN (17/10/2026 noche, prototipo de coherencia: «un color, un significado»): sólo el ícono, sin
  // chip; la familia lo deja en --tinte. Sin familia (menú de la foto, desplegables), el color de la fila.
  return <span className="mk-ico-tinte" style={{ display: 'flex' }}><Icon name={item.icon} size={size} /></span>;
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
 * Las familias que el usuario plegó, en el navegador (17/10/2026). Es una comodidad de esta persona en esta
 * computadora, no un dato: si el almacenamiento no está (ventana privada, bloqueado), todas abiertas.
 */

/**
 * Lo plegado se recuerda en el navegador. La clave cambió el 20/10/2026 (feedback del 18/10, pt 10; Martín: «quiero que
 * por defecto estén todas desplegadas»): con la vieja, quien ya había tocado una sección la guardaba junto con
 * Marketing y Create plegadas (el default del 17/10), y no habría visto el cambio nunca.
 */
const PLEGADAS = 'mk-nav-plegadas-v2';
/** Sin nada guardado: TODAS desplegadas (20/10/2026). */
export const PLEGADAS_DE_ENTRADA: readonly string[] = [];
function leerPlegadas(): ReadonlySet<string> {
  try {
    const crudo = window.localStorage.getItem(PLEGADAS);
    if (crudo == null) return new Set(PLEGADAS_DE_ENTRADA);
    const v: unknown = JSON.parse(crudo);
    return new Set(Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : []);
  } catch { return new Set(PLEGADAS_DE_ENTRADA); }
}

/**
 * ¿La barra va ABIERTA Y FIJA? (17/10/2026 noche, el prototipo: «abierta y fija, 244 px, con los nombres; la flecha la
 * pliega al rail», como Linear, Notion, Attio y HubSpot). Plegada, es el rail que se abre con el cursor.
 * PLEGADA POR DEFECTO EN TODAS LAS TABS (24/10/2026, Martín: «en web generator, como en todas las tabs, haz que por defecto al
 * entrar se pliegue la sidebar principal, pero no impidas que se vuelva a desplegar si el usuario le da click en desplegar»).
 * Sin nada guardado, el rail; la flecha «›» la deja abierta y fija, y ESO se recuerda (en todas las tabs, como siempre).
 * ⚠️ LA CLAVE CAMBIÓ (`-v2`), como la de las secciones el 20/10: la vieja guardaba «si» para quien alguna vez la volvió a abrir,
 *    y esas personas (Martín entre ellas) no habrían visto el cambio nunca. Arrancan todas plegadas una vez.
 */
const FIJA = 'mk-nav-fija-v2';
/** Exportada para el test (tests/sidebar-plegada-por-defecto.test.ts). */
export function leerFija(): boolean {
  try { return window.localStorage.getItem(FIJA) === 'si'; } catch { return false; }
}
/**
 * Las pantallas que pliegan la barra al entrar: las del Ops Center, que traen su propia barra de chats (20/10/2026), y
 * Automations (23/10/2026; Martín: «al entrar a Automations, por defecto la sidebar principal esté plegada»): su panel
 * flotante (la lista y el chat con MaKo) y el lienzo necesitan el ancho. Es el mismo mecanismo: «por defecto», la flecha
 * la abre ahí sin tocar lo guardado, y al salir vuelve lo que la persona tenía.
 */
export const RUTAS_QUE_PLIEGAN: readonly string[] = ['/second-brain', '/admin/operaciones', '/automations'];
/**
 * Y Admin (6/11/2026, punto 37 de docs/admin/revision-cerebro-6-11.md): la copia de Polar trae su propia barra, y con la de
 * MaKo fija las dos se comían 468 px (a 1440, Events con el detalle abierto cortaba el monto). Pliega /admin exacto y sus
 * secciones (`SECCIONES_ADMIN`, nav.ts), sin atrapar las otras tabs del super admin que viven bajo /admin (/admin/dev,
 * /admin/ui, /admin/approvals…). La flecha la vuelve a abrir, como en el Ops Center.
 */
export function pliegaLaBarra(pathname: string): boolean {
  const enAdmin = pathname === '/admin' || SECCIONES_ADMIN.some((s) => pathname === `/admin/${s}` || pathname.startsWith(`/admin/${s}/`));
  return enAdmin || RUTAS_QUE_PLIEGAN.some((r) => pathname === r || pathname.startsWith(r + '/'));
}
/**
 * LA VENTANA CHICA (21/10/2026). Martín: MaKo se rompía apenas la ventana era un poco más angosta que la pantalla
 * completa (su caso: 60 % de 1920×1080 con escala 125 %, 934×639 de CSS). La barra fija se comía 244 px y todo lo
 * de la derecha quedaba apretado. Medido en producción, contando textos fuera de la ventana, pisados y cortados: a 934
 * /integraciones scrolleaba 38 px de costado con 5 textos afuera (0 con la barra plegada), y a 1027 el Dashboard pisaba
 * un título y el CRM scrolleaba 1 px (0 y 0 plegada). A 1283, con la barra abierta, ya no hacía falta.
 * Por debajo de este ancho la barra ARRANCA plegada a íconos (y se abre encima al pasar el cursor, como siempre); la
 * flecha la fija abierta ahí, sin tocar lo que la persona eligió para una ventana grande. La barra no scrollea nunca.
 */
export const ANCHO_BARRA_PLEGADA = 1200;
const MQ_ANGOSTA = `(max-width: ${ANCHO_BARRA_PLEGADA - 0.02}px)`;
function useVentanaAngosta(): boolean {
  return useSyncExternalStore(
    (avisar) => { const mq = window.matchMedia(MQ_ANGOSTA); mq.addEventListener('change', avisar); return () => mq.removeEventListener('change', avisar); },
    () => window.matchMedia(MQ_ANGOSTA).matches,
    () => false,
  );
}
/**
 * ¿La barra va abierta y fija? (25/10/2026, la regresión del 24/10). Donde se pliega SOLA (`plegadaAca`: el Ops Center,
 * Automations, la ventana chica, MaKo abierto) manda lo que la flecha hizo EN ESA VISITA; en el resto, lo guardado.
 * ⚠️ Era `guardada && (!plegadaAca || abiertaAca)`: cuando la guardada era «si» por defecto andaba, pero desde que la barra
 *    arranca plegada (`mk-nav-fija-v2`, 24/10) la guardada es «no» para casi todos, y la flecha en esas pantallas abría la
 *    barra en `abiertaAca` sin que `fija` se enterara: se desplegaba con el cursor encima y se volvía a plegar al salir.
 *    Martín: «La sidebar principal en muchas tabs no funciona el botón de "desplegar" para mantenerla desplegada».
 */
export function barraFija(guardada: boolean, plegadaAca: boolean, abiertaAca: boolean): boolean {
  return plegadaAca ? abiertaAca : guardada;
}
/**
 * Qué guarda la flecha (`null`: nada). DESPLEGARLA SE RECUERDA SIEMPRE, también donde la barra se pliega sola: así la
 * próxima tab la encuentra abierta. Plegarla en una de esas pantallas es de ese rato y no se guarda (22/10: «si antes la tenía
 * desplegada y fija, al cerrar MaKo debe volver a su lugar»).
 */
export function loQueGuardaLaFlecha(v: boolean, plegadaAca: boolean): boolean | null {
  if (v) return true;
  return plegadaAca ? null : false;
}
function guardarFija(v: boolean) {
  try { window.localStorage.setItem(FIJA, v ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
}
function guardarPlegadas(s: ReadonlySet<string>) {
  try { window.localStorage.setItem(PLEGADAS, JSON.stringify([...s])); } catch { /* sin almacenamiento: no se recuerda */ }
}

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
 *
 * ⚠️ EL LINK MIDE LO QUE MIDE EL LOGO, y el aire de abajo es MARGEN, no padding (12/10/2026, la
 * prueba con Fiesta Music: «cuando alguien da clic en Operate... se lo lleva a General»). Tenía
 * `padding-bottom: 20px` y, como hijo de una columna flex, se estiraba a todo el ancho: los 20 px
 * entre el logo y el rótulo OPERATE eran link a /general, y un clic «un poco arriba» de OPERATE
 * cambiaba de pantalla. Con `alignSelf` deja de estirarse y con `marginBottom` el aire no es
 * clicable. El dibujo no cambia: 2 + 18 = los 20 de antes. Lo fija tests/barra-clic-operate.test.ts.
 */
// ⚠️ Y DESDE EL 14/10/2026 NO ES UN LINK (Martín: «Cuando clickeo en MaKo en la sidebar, me redirecciona a general, que no
// pase eso, que si clickeo MaKo no pase nada»): es la marca, un `<span>`. La geometría de arriba se queda (el margen
// sigue poniendo el aire hasta OPERATE) y la animación al pasar el cursor también.
export function Marca({ open }: { open: boolean }) {
  return (
    <span className="mk-marca"
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: open ? '2px 6px 2px' : '2px 0 2px', marginBottom: 18, alignSelf: open ? 'flex-start' : 'center', justifyContent: open ? 'flex-start' : 'center', flex: 'none', textDecoration: 'none' }}>
      <span className="mk-marca__logo" style={{ display: 'flex', flex: 'none' }}><MakoLogo size={32} /></span>
      {open && (
        <span className="mk-marca__word" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>
          <MakoWord base="var(--on-sidebar)">MaKo</MakoWord>
        </span>
      )}
    </span>
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
  const ini = iniciales(nombre, 2, '');
  return (
    <>
      {/* Las iniciales van sobre AZUL, no sobre el dorado: una foto de perfil
          es identidad, no una intervención de MaKo. */}
      <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 9, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13.5, color: '#fff', overflow: 'hidden' }}>
        {avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : ini}
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

/** El candado de una tab de MaKo Pro en el Esencial (23/10/2026): se ve, y al entrar dice «Pasar a Pro». */
function Candado() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', opacity: 0.7 }}>
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function NavLink({ item, active, expanded, tema = 'oscuro', size, badge = 0, onClick, pro = false }: {
  item: NavItem; active: boolean; expanded: boolean; tema?: Tema; size?: number; badge?: number; onClick?: () => void;
  /** Una tab de MaKo Pro y el negocio paga el Esencial: el candado, y «Pasar a Pro» al pasar el mouse. `agencia`: el cliente de
   *  una agencia (29/10/2026): el candado y «De MaKo Pro», sin «Pasar a Pro» (su plan lo cambia su agencia). */
  pro?: boolean | 'agencia';
}) {
  const base = filaStyle(expanded);
  const cls = `mk-navrow${tema === 'claro' ? ' mk-navrow--claro' : ''}${active ? ' is-activo' : ''}`;
  const content = (
    <>
      <span style={{ position: 'relative', display: 'flex', flex: 'none' }}>
        <ItemIcon item={item} size={size} />
        {!expanded && <Contador n={badge} compacto />}
      </span>
      {expanded && !item.bajada && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      {expanded && item.bajada && (
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          <span className="mk-navrow__bajada">{item.bajada}</span>
        </span>
      )}
      {expanded && <Contador n={badge} />}
      {expanded && pro && <Candado />}
      {expanded && item.comingSoon && (
        <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'currentColor', border: '1px solid currentColor', borderRadius: 5, padding: '1px 5px', opacity: 0.5 }}>pronto</span>
      )}
    </>
  );
  const nombre = item.bajada ? `${item.label} · ${item.bajada}` : item.label;
  const props = { className: cls, style: base, title: pro ? `${item.label} · ${pro === 'agencia' ? 'De MaKo Pro' : ROTULO_PASAR_A_PRO}` : expanded ? undefined : nombre, ...(pro ? { 'data-pro': '' } : {}) };
  if (item.entrarComoDueno) return <button type="button" onClick={onClick} {...props}>{content}</button>;
  if (item.newTab) return <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClick} {...props}>{content}</a>;
  return <Link href={item.href} onClick={onClick} {...props}>{content}</Link>;
}

/** Una familia ya filtrada por rol y capa (lo que el Sidebar arma para pintar). */
export type FamiliaVista = { key: string; label: string; pregunta: string; icon: string; notifica?: boolean; sinRotulo?: boolean; color?: string; bloques: NavItem[][]; grupos: NavGrupo[] };

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
 * Una familia: su rótulo y, si no está plegada, sus destinos.
 *
 * DESDE EL 17/10/2026, COMO LINEAR, NOTION Y ATTIO (docs/diseno-sidebar.md, «Lo que se copió»): el rótulo es un
 * LETRERO chico y tenue, sin fondo y sin ícono, con el chevron al lado; los destinos van sueltos, sin la caja que los
 * englobaba. Con dos familias (Operate y Sales Machine) la caja ya no separa nada: la separa el rótulo, y la barra se lee
 * de un vistazo en vez de como cajas apiladas. Las familias NO son un acordeón: todas abiertas de entrada, y cada una se
 * pliega sola (se recuerda en el navegador). Es lo que hacen las tres: el acordeón te obligaba a abrir Sales Machine para
 * ver Automations y te cerraba Operate.
 *
 * El rótulo sigue sin superficie propia (el intento anterior con fondo hacía que la sección pareciera la tab
 * seleccionada): lo único con superficie, borde e indicador son los destinos. Lo que orienta retrocede, lo que se toca
 * manda.
 *
 * Plegada la BARRA (el rail de íconos), el rótulo es una línea fina: los íconos de los destinos trabajan solos. Una
 * familia plegada por el usuario muestra su ícono, que la despliega, y su contador.
 */
export function Familia({ f, primera, open, pathname, abiertaEsta, contadorFamilia, contadorItem, onToggle, flyoutKey, onAbrirFlyout, onCerrarFlyout, onEntrarComoDueno, esPro = () => false }: {
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
  /** ¿Esta tab lleva el candado de MaKo Pro? (el Esencial por la pasarela, lib/plan-esencial-reglas.ts) */
  esPro?: (key: string) => boolean | 'agencia';
}) {
  const activa = [...f.bloques.flat(), ...f.grupos.flatMap((g) => g.items)].some((i) => i.match(pathname));
  // SIN RÓTULO (17/10/2026 noche): la zona de lo diario, y toda familia a la que le queda UNA fila visible (el prototipo:
  // «el closer ve CRM suelta, sin carpeta»). Una carpeta con una cosa adentro es una fila de más.
  const filas = f.bloques.flat().length + f.grupos.length;
  if (f.sinRotulo || filas === 1) {
    return (
      <div style={{ marginTop: primera ? 0 : 14, display: 'flex', flexDirection: 'column', gap: 1, ...(f.color ? { ['--tinte' as string]: `var(${f.color})` } : {}) }}>
        {f.bloques.flat().map((it) => (
          <NavLink key={it.key} item={it} active={it.match(pathname)} expanded={open} badge={contadorItem(it.key)} pro={esPro(it.key)}
            onClick={it.entrarComoDueno ? () => onEntrarComoDueno?.(it.href) : undefined} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ marginTop: primera ? 0 : 14, ...(f.color ? { ['--tinte' as string]: `var(${f.color})` } : {}) }}>
      {open ? (
        <button type="button" className="mk-seccion"
          onClick={() => onToggle(f.key)}
          title={f.pregunta}
          aria-expanded={abiertaEsta}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '0 10px 6px',
            // Sin esto, durante los 200 ms en que la barra se abre o se pliega, un rótulo de dos
            // palabras («Sales Machine») baja de renglón y la barra salta: el clic que iba a un
            // destino cae en otra cosa. Lo fija tests/barra-clic-operate.test.ts.
            whiteSpace: 'nowrap',
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: MONO, fontSize: 10.5, letterSpacing: '.15em',
            textTransform: 'uppercase', fontWeight: 600,
            color: 'var(--sidebar-text)',
            opacity: activa ? 1 : 0.85,
          }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
          <span className="mk-seccion__chev" aria-hidden style={{ flex: 'none', fontSize: 10, transform: abiertaEsta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
          <span style={{ flex: 1 }} />
          {/* El número vive en la familia SOLO mientras está plegada. Abierta, baja a la tab que lo debe: si no, te
              dice que hay 14 cosas pendientes pero no cuál de las filas las tiene. */}
          {!abiertaEsta && <Contador n={contadorFamilia} />}
        </button>
      ) : abiertaEsta ? (
        <div aria-hidden style={{ height: 1, background: 'var(--sidebar-line)', opacity: 0.7, margin: '2px 14px 8px' }} />
      ) : (
        <button type="button" className="mk-navrow" onClick={() => onToggle(f.key)} title={`${f.label} · ${f.pregunta}`} aria-expanded={false} style={filaStyle(false)}>
          <span style={{ position: 'relative', display: 'flex', flex: 'none', color: 'inherit' }}>
            <Icon name={f.icon} size={ICO_HIJO} />
            <Contador n={contadorFamilia} compacto />
          </span>
        </button>
      )}
      {abiertaEsta && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {f.bloques.map((bloque, i) => (
            // Los bloques de adentro de una familia se separan con AIRE, no con una línea: sin la caja, una línea entre
            // filas sueltas se lee como el final de la sección.
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, ...(i > 0 ? { marginTop: 7 } : {}) }}>
              {bloque.map((it) => (
                <NavLink key={it.key} item={it} active={it.match(pathname)} expanded={open} badge={contadorItem(it.key)} pro={esPro(it.key)}
                  onClick={it.entrarComoDueno ? () => onEntrarComoDueno?.(it.href) : undefined} />
              ))}
            </div>
          ))}
          {f.grupos.map((g) => (
            <div key={g.key} style={{ marginTop: f.bloques.length ? 7 : 0 }}>
              <GrupoFila g={g} open={open} pathname={pathname} abierto={flyoutKey === g.key}
                onAbrir={onAbrirFlyout} onCerrar={onCerrarFlyout} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Quién es y a quién mira, como lo sabe el server al dibujar (app/layout.tsx). Es el PRIMER cuadro: después
 * lo confirman `/api/perfil` y `/api/auth/me` como siempre. `clienteNombre` = se está mirando a ese cliente.
 */
export type SidebarInicial = { nombre: string; rol: string; clienteNombre: string | null };

export function Sidebar({ inicial }: { inicial?: SidebarInicial }) {
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
  // #881: nacía con 'Mauricio Bustos' (de cuando la app era de una sola cuenta) y sin saber que se inspeccionaba,
  // así que al entrar a un cliente el primer cuadro mostraba a Mauricio. Ahora nace con lo que dijo el server.
  const [perfilNombre, setPerfilNombre] = useState(inicial?.nombre ?? '');
  const [perfilAvatar, setPerfilAvatar] = useState('');
  const [rol, setRol] = useState<string>(inicial?.rol ?? '');
  const [verPronto, setVerPronto] = useState(false);
  // «Platform» del menú de la foto, plegado: un ítem, y adentro lo de la plataforma (25/10/2026).
  const [verPlataforma, setVerPlataforma] = useState(false);
  const [rolWs, setRolWs] = useState<string>('');
  const [capa, setCapa] = useState<string>('');
  const [clienteDeAgencia, setClienteDeAgencia] = useState(false);
  // MaKo Esencial por la pasarela (/api/auth/me): las tabs de Pro con candado (23/10/2026).
  const [planEsencial, setPlanEsencial] = useState(false);
  const esPro = (key: string): boolean | 'agencia' => (planEsencial && esNavSoloPro(key) ? (clienteDeAgencia ? 'agencia' : true) : false);
  const [impersonando, setImpersonando] = useState(inicial?.clienteNombre != null);
  const [clienteNombre, setClienteNombre] = useState(inicial?.clienteNombre ?? '');
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

  // Arranca plegada (lo de casi todos, 24/10/2026): sin esto el primer cuadro dibujaba la barra abierta y se plegaba al montar.
  const [fijaGuardada, setFijaEstado] = useState(false);
  useEffect(() => { setFijaEstado(leerFija()); }, []);
  /**
   * AL ENTRAR AL OPS CENTER (el Second Brain de cada negocio, /second-brain, y el del super admin, /admin/operaciones)
   * LA BARRA SE PLIEGA (20/10/2026, feedback del 18/10 pt 4; Martín: «por defecto en todos los ws, si entro al second
   * brain que la sidebar principal de todas las tabs se colapse»). Esa pantalla trae su propia barra de chats y las dos
   * juntas se comían el ancho. Es «por defecto»: la flecha la vuelve a abrir ahí, sin tocar lo que la persona eligió
   * para el resto de las tabs, y al salir vuelve lo suyo.
   */
  const enOpsCenter = pliegaLaBarra(pathname);
  // Y en una ventana chica (21/10/2026, `ANCHO_BARRA_PLEGADA`): la misma regla, plegada por defecto y la flecha la abre.
  const angosta = useVentanaAngosta();
  // Y mientras el panel de MaKo de una tab está abierto (22/10/2026, Martín: «si abro a MaKo, se debería plegar la sidebar
  // principal, para optimizar espacios. Si antes la tenía desplegada y fija, al cerrar MaKo debe volver a su lugar»): lo marca
  // la estrella (app/_chat/mako-abierto.ts). Temporal como las otras: al cerrar, `fija` vuelve a ser la guardada.
  const makoAbierto = useMakoAbierto();
  const plegadaAca = enOpsCenter || angosta || makoAbierto;
  const [abiertaAca, setAbiertaAca] = useState(false);
  useEffect(() => { setAbiertaAca(false); }, [plegadaAca]);
  const fija = barraFija(fijaGuardada, plegadaAca, abiertaAca);
  const setFija = (v: boolean) => {
    const guardar = loQueGuardaLaFlecha(v, plegadaAca);
    if (guardar != null) { setFijaEstado(guardar); guardarFija(guardar); }
    if (plegadaAca) setAbiertaAca(v);
    if (!v) setExpanded(false);
  };
  const open = fija || expanded || userOpen || !!flyout;

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
        setClienteDeAgencia(j.clienteDeAgencia === true);
        setPlanEsencial(j.planEsencial === true);
        setImpersonando(Boolean(j.impersonando));
        setClienteNombre((j.clienteNombre as string) || '');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  const adminShell = rol === 'admin' && !impersonando;
  /** La campanita de avisos: sólo quien administra el negocio (la ruta le devuelve vacío a un closer o setter). */
  const veAvisos = rolWs === 'admin' || adminShell;

  // Filtro de tabs, dos ejes independientes:
  //  · ROL  — closer/setter solo ven las tabs anotadas con su rol en nav.ts.
  //  · CAPA — qué compró el cliente (lib/capas.ts). Aplica a TODOS, incluido el
  //           admin-cliente: no es un permiso, es lo que contrató.
  // Y `adminOnly` en una tab de PRODUCTO (el Video Editor mientras se valida): sólo
  // el super admin, también mirando un cliente con `?ws=`, que es donde la prueba.
  // Antes `adminOnly` sólo lo leía el menú de la foto (USER_NAV): puesto en una
  // familia no escondía nada. Es cosmético; el cierre real es el guard de la page.
  //  · SUPER ADMIN — `adminOnly` (las tabs «pronto» de Sales Machine): sólo en la barra del super admin, no
  //           mirando como cliente. Va acá y no en cada familia: `puedeVer` es por donde pasan la barra y el buscador.
  // La regla vive en lib/nav-visibilidad.ts: la usa también la barra de secciones de las tabs unificadas.
  const rolCliente = rolWs === 'closer' || rolWs === 'setter';
  const vistaNav = { adminShell, rolWs, capa, clienteDeAgencia };
  const puedeVer = (it: NavItem) => puedeVerItem(it, vistaNav);
  /**
   * Lo de ARRIBA de todo (17/10/2026): Ops Center sólo en la barra del super admin (`adminOnly`) y Second Brain para los demás.
   * El super admin NO ve Second Brain acá: vive dentro del Ops Center (nav.ts → `arribaDe`).
   */
  const arriba = arribaDe(adminShell, puedeVer);

  const familiasProducto = FAMILIAS
    .map((f) => {
      // Una tab unificada (Video, Image, Copywriting) se resuelve por sus secciones.
      const bloques = f.bloques
        .map((b) => b.map((it) => resolverTab(it, vistaNav)).filter((it): it is NavItem => it !== null))
        .filter((b) => b.length > 0);
      const grupos = (f.grupos ?? []).map((g) => ({ ...g, items: g.items.filter(puedeVer) })).filter((g) => g.items.length > 0);
      // `planaParaCliente` (Content Machine, 12/10/2026): fuera de la barra del super admin, lo que quedó en los
      // desplegables va suelto, en un bloque más. El super admin los sigue viendo como desplegables.
      if (f.planaParaCliente && !adminShell) {
        const sueltos = grupos.flatMap((g) => g.items);
        return { ...f, bloques: sueltos.length ? [...bloques, sueltos] : bloques, grupos: [] };
      }
      // El Ops Center (el del super admin o el de cada negocio, `arribaDe`) va PRIMERO adentro de lo diario desde el
      // 20/10/2026 (feedback del 18/10, pt 10): «quiero que Ops center esté dentro de la sección de «Plan, chats y
      // dashboard»». Hasta ese día iba suelto arriba de todo, fuera de las secciones.
      if (f.key === 'diario' && arriba.length) {
        const [primero = [], ...resto] = bloques;
        return { ...f, bloques: [[...arriba, ...primero], ...resto], grupos };
      }
      return { ...f, bloques, grupos };
    })
    .filter((f) => f.bloques.length > 0 || f.grupos.length > 0);

  /**
   * El super admin ve LAS MISMAS familias de producto que un cliente. Hasta el 17/10/2026 veía además «Admin» al
   * final; sus herramientas se repartieron en las tabs que hacen su trabajo (secciones `adminOnly`), el Ops Center
   * subió arriba de todo y lo que es configuración de la plataforma está en el menú de la foto (nav.ts → HERRAMIENTAS).
   */
  /**
   * El MODO DEV (/admin/dev cambiaba la barra entera por el mapa de las 122 áreas) se fue el 25/10/2026 (Martín: «Elimina
   * "dev", ya no lo necesitamos»). La familia `dev` de ADMIN_FAMILIAS sigue exportada con Docs, UX/UI y el Grafo: es de
   * donde `ADMIN_NAV` saca sus keys y `lib/titulo-tab.ts` el título de esas rutas, que otras pantallas enlazan.
   */
  const familias = familiasProducto;

  const todosDe = (f: typeof familias[number]) => [...f.bloques.flat(), ...f.grupos.flatMap((g) => g.items)];

  /**
   * Lo que cada tab te debe. Son obligaciones concretas —mensajes sin leer,
   * datos del CRM sin marcar—, no novedades: es lo único que el documento
   * acepta como badge. Qué tab cuenta qué lo dice `fuenteContador` (nav.ts): Chats
   * y WhatsApp muestran el MISMO número (14/10/2026), el de los mensajes sin leer.
   */
  const valorDe = (f: FuenteContador) => (f === 'mensajes' ? unreadTotal : sinMarcar);
  const contadorItem = (key: string) => {
    const f = fuenteContador(key);
    return f ? valorDe(f) : 0;
  };

  /**
   * El de la familia es la SUMA de los de adentro, y solo se muestra cuando la
   * sección está cerrada: es un resumen de lo que no estás viendo. Con la
   * sección abierta el número tiene que estar en la tab que lo debe — si no,
   * te dice que hay 14 cosas pero no cuál de las siete filas las tiene.
   * ⚠️ Suma FUENTES, no tabs: Chats y WhatsApp juntos no son el doble de mensajes.
   */
  const contadorDe = (f: typeof familias[number]) =>
    f.notifica ? sumaDeContadores(todosDe(f).map((i) => i.key), valorDe) : 0;

  /**
   * QUÉ FAMILIAS ESTÁN PLEGADAS (17/10/2026). Las de producto van TODAS abiertas y cada una se pliega sola, como las
   * secciones de Linear y Notion; lo plegado se recuerda en el navegador (`PLEGADAS`). En el MODO DEV sigue el acordeón
   * de antes —una sola abierta—, porque allá son ocho familias y 122 áreas y abiertas todas no entran.
   *
   * Es estado, no algo derivado del cursor: si se recalculara en cada render, mover el mouse la cerraba. Lo único que
   * pisa la elección del usuario es navegar a una tab de una familia plegada: se abre la familia donde estás parado.
   * Es el patrón de React de «ajustar estado cuando cambia una prop», hecho en render y no en un efecto (un efecto
   * pintaría un frame con la familia equivocada).
   */
  // Busca en TODAS las familias, no solo en las de producto: si no, un super admin parado en /admin/docs no abría
  // ninguna sección en el modo Dev.
  const familiaDeRuta = [...FAMILIAS, ...ADMIN_FAMILIAS].find((f) => itemsDe(f).some((i) => i.match(pathname)))?.key ?? null;
  const [rutaVista, setRutaVista] = useState(familiaDeRuta);
  const [plegadas, setPlegadas] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => { setPlegadas(leerPlegadas()); }, []);
  if (familiaDeRuta && familiaDeRuta !== rutaVista) {
    setRutaVista(familiaDeRuta);
    if (plegadas.has(familiaDeRuta)) {
      const sinEsa = new Set(plegadas);
      sinEsa.delete(familiaDeRuta);
      setPlegadas(sinEsa);
    }
  }
  const estaAbierta = (k: string) => !plegadas.has(k);
  const alternarFamilia = (k: string) => {
    setExpanded(true);
    setPlegadas((prev) => {
      const n = new Set(prev);
      // Plegada la barra (el rail), el ícono de una familia plegada sólo la despliega: no se pliega lo que no se ve.
      if (n.has(k)) n.delete(k); else if (open) n.add(k);
      guardarPlegadas(n);
      return n;
    });
  };

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

  const onEnter = () => { if (fija) return; if (collapseTimer.current) clearTimeout(collapseTimer.current); setExpanded(true); };

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
        || document.getElementById('user-menu')?.matches(':hover')
        || document.getElementById(ID_PANEL_AVISOS)?.matches(':hover');
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

  /** Una fila del menú de la foto. */
  const FILA_QUE_ABRE: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', borderRadius: 0, fontSize: 'var(--fs-md)', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' };
  const filaMenu = (it: NavItem) => {
    const on = it.match(pathname);
    return (
      <Link key={it.key} href={it.href + dateQuery} onClick={() => setUserOpen(false)}
        className="mk-navrow mk-navrow--claro" data-activo={on}
        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', borderRadius: 0, fontSize: 'var(--fs-md)', fontWeight: on ? 600 : 500, textDecoration: 'none' }}>
        <span style={{ display: 'flex', color: on ? 'var(--primary)' : 'var(--faint)' }}><Icon name={it.icon} size={17} /></span>
        {it.label}
      </Link>
    );
  };

  return (
    <>
    {/* Admin › Activity (5/11/2026): cuenta pantallas y acciones por tab, por lotes. Sólo con sesión. Va ARRIBA de la
        estrella: tests/estrella-en-toda-tab.test.ts la quiere pegada al <aside>. */}
    {!!rol && <MedidorDeUso />}
    {/* La estrella flotante, en toda tab que no tenga la suya (1/11/2026). Afuera del <aside>: su z-index la encerraría. */}
    {!!rol && arriba.length > 0 && <EstrellaDeLaApp />}
    <aside data-sidebar data-fija={fija ? 'si' : 'no'} style={{ width: fija ? FULL : RAIL, flex: 'none', alignSelf: 'stretch', position: 'sticky', top: 0, height: '100vh', overflow: 'visible', zIndex: 60 }}>
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
          // La sombra es de la barra que se abre ENCIMA al pasar el cursor; fija está acoplada y no flota.
          boxShadow: open && !fija ? '6px 0 30px rgba(23,21,17,.24)' : 'none',
        }}
      >
        {/* Plegada, la marca va CENTRADA como los íconos de abajo (20/10/2026, feedback del 18/10 pt 10: «cuando está
            plegada el logo de MaKo está desalineado al resto de iconos»): con `space-between` y la flecha escondida, quedaba
            pegada a la izquierda. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: open ? 'space-between' : 'center', flex: 'none' }}>
          <Marca open={open} />
          {/* La flecha (17/10/2026 noche): pliega la barra al rail o la deja fija. Sólo con la barra abierta. */}
          {open && (
            <button type="button" className="mk-navrow" onClick={() => setFija(!fija)}
              title={fija ? 'Collapse sidebar' : 'Keep sidebar open'} aria-label={fija ? 'Collapse sidebar' : 'Keep sidebar open'}
              style={{ ...filaStyle(false), width: 28, height: 28, padding: 0, marginTop: 4, flex: 'none', fontSize: 15 }}>
              {fija ? '‹' : '›'}
            </button>
          )}
        </div>

        {/* EL BUSCADOR (17/10/2026 noche, Ctrl K): tabs, pantallas de adentro, ajustes y Platform, de lo que ESTA persona ve. */}
        {(
          <div style={{ flex: 'none', marginBottom: 12 }}>
            <BuscadorNav abierta={open} onAbrir={() => setExpanded(true)} destinos={[
              ...familiasProducto.flatMap((f) => f.bloques.flat().flatMap((t): Destino[] => [
                { item: t, donde: f.sinRotulo ? null : f.label },
                ...(t.secciones ? seccionesVisibles(t, vistaNav).filter((x) => x.href !== t.href).map((item) => ({ item, donde: t.label })) : []),
                ...(t.adentro ?? []).map((k) => SIN_FILA.find((x) => x.key === k)).filter((x): x is NavItem => !!x && puedeVer(x)).map((item) => ({ item, donde: t.label })),
              ])),
              ...USER_NAV.filter((it) => (!it.adminOnly || adminShell) && puedeVer(it)).map((item): Destino => ({ item, donde: 'Settings' })),
              ...(adminShell ? [...SUPERADMIN_MENU, ...PRONTO].map((item): Destino => ({ item, donde: 'Platform' })) : []),
            ]} />
          </div>
        )}


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
              abiertaEsta={estaAbierta(f.key)}
              contadorFamilia={contadorDe(f)} contadorItem={contadorItem} esPro={esPro}
              onToggle={alternarFamilia}
              flyoutKey={flyout?.key ?? null}
              onAbrirFlyout={abrirFlyout} onCerrarFlyout={cerrarFlyout}
              onEntrarComoDueno={entrarComoDuenoYNavegar} />
          ))}
        </nav>

        {/* El perfil. Second Brain vivía acá abajo hasta el 17/10/2026: subió arriba de todo, con su criatura. */}
        <div style={{ marginTop: 'auto', paddingTop: 12, flex: 'none' }}>
          {/* LA VERSIÓN DE PRUEBA (25/10/2026, copiada de Madgicx): fija al pie, en todas las pantallas, mientras dura la prueba. */}
          <CartelPrueba open={open} />
          <div style={{ height: 1, background: 'var(--sidebar-2)', margin: open ? '0 6px 8px' : '0 4px 8px' }} />
          {/* LA CAMPANITA (17/10/2026, app/_components/CampanitaAvisos.tsx) va en la fila de la identidad y no en una propia:
              la columna ya scrollea en 1024×768. Plegada, un punto sobre la foto. Sólo el admin: los avisos son del negocio. */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
            <button ref={userBtnRef} type="button" onClick={openUserMenu} onMouseEnter={openUserMenu} onMouseLeave={scheduleCloseUser}
              style={{ ...identidadStyle(open, userOpen), flex: 1, minWidth: 0, width: 'auto' }}>
              <Identidad open={open} nombre={nombreVisible} avatar={avatarVisible} subrotulo={impersonando ? 'Cliente' : 'Cuenta'} />
            </button>
            {veAvisos && <CampanitaAvisos open={open} pathname={pathname} onAbrir={() => { setUserOpen(false); setFlyout(null); }} />}
            {/* EL CLARO/OSCURO DE CADA PERSONA (17/10/2026, tarjeta #883): el interruptor de nordtheme, al lado de la foto,
                donde vivía. Sólo con la barra abierta: plegada no entra en la fila. Claro por defecto (ModoArranque). */}
            {open && <InterruptorModo compacto />}
          </div>
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
              <NavLink key={it.key} item={it} active={it.match(pathname)} expanded tema="claro" onClick={() => setFlyout(null)} pro={esPro(it.key)} />
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

            {/* SIN LA CARA (25/10/2026, Martín: «no me gusta que en general el desplegable del perfil, antes de "settings" tenga
                nuevamente mi foto de perfil, que esté solo settings»): la foto y el nombre ya están en el botón que abre este menú.
                Hasta ese día iban acá arriba (17/10, la cara del prototipo), y la fila llevaba a Settings dos veces. */}
            {/* «Settings» PRIMERO (24/10/2026), con la TUERCA (25/10/2026): es la key `perfil`, que va primera en USER_NAV. */}
            {USER_NAV.filter((it) => !it.soloSeccion && (!it.adminOnly || (rol === 'admin' && !impersonando)) && puedeVer(it)).map(filaMenu)}
            {/* PLATFORM, UN ÍTEM (25/10/2026, Martín: «No me gusta para nada que en el desplegable de super admin me aparezcan tantas
                cosas, de ultima engloba todas esas tabs extras en un solo desplegable que a su vez tenga otro desplegable»): lo de la
                plataforma (lo que era la familia Admin) se abre ACÁ, en el mismo menú, y adentro «Coming soon» se abre igual. Sólo el
                super admin sin mirar un cliente. Nada de modales ni de un menú al costado. */}
            {adminShell && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
                <button type="button" className="mk-navrow mk-navrow--claro" aria-expanded={verPlataforma} onClick={() => setVerPlataforma((v) => !v)}
                  style={FILA_QUE_ABRE}>
                  <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name="admin" size={17} /></span>
                  <span style={{ flex: 1 }}>Platform</span>
                  <span style={{ fontSize: 10, transform: verPlataforma ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
                </button>
                {verPlataforma && (
                  <div role="group" aria-label="Platform" style={{ paddingLeft: 14 }}>
                    {SUPERADMIN_MENU.map(filaMenu)}
                    <button type="button" className="mk-navrow mk-navrow--claro" aria-expanded={verPronto} onClick={() => setVerPronto((v) => !v)}
                      style={FILA_QUE_ABRE}>
                      <span style={{ display: 'flex', color: 'var(--faint)' }}><Icon name="reloj" size={17} /></span>
                      <span style={{ flex: 1 }}>Coming soon</span>
                      <span style={{ fontSize: 10, transform: verPronto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
                    </button>
                    {verPronto && <div role="group" aria-label="Coming soon" style={{ paddingLeft: 14 }}>{PRONTO.map(filaMenu)}</div>}
                  </div>
                )}
              </>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '5px 0 0' }} />
            <button type="button" className="mk-salir"
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 15px', fontSize: 'var(--fs-md)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', color: 'currentColor' }}><Icon name="logout" size={17} /></span>
              Log out
            </button>
        </div>,
        document.body,
      )}
    </aside>
    </>
  );
}
