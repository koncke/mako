// =============================================================================
// MaKo Mobile — los destinos de la barra, las secciones de More y el mapa escritorio → móvil
// =============================================================================
// Una cosa, un lugar: QUÉ destinos tiene la app móvil, QUÉ secciones viven en More, QUIÉN ve
// cada una y A DÓNDE cae en el teléfono un link de escritorio viven acá. Lo leen el layout de
// /m (la barra), /m/mas, los guards de cada página, los links de los Web Push y el foco de
// «Today».
//
// SIN `server-only` a propósito: lo importan componentes cliente (la barra) y los tests. Sólo
// depende de módulos puros (nav.ts, capas.ts y ruta-automations.ts).
//
// ⚠️ EL PREFIJO ES `/m/` CON BARRA, NUNCA `startsWith('/m')`: eso atrapa /mako, /marketing,
// /mensajes, /metodo, /mi-curso, /modelos-ia y —el caro— la ruta PÚBLICA /m.js (el cargador
// del Pixel que los clientes pegan en su landing). Toda pregunta «¿es móvil?» pasa por
// `esRutaMovil`.
//
// ⚠️ LA HOME ES /m/hoy, NO /m: Next redirige /m/ → /m (trailingSlash false), así que la URL
// pelada no queda dentro de un scope '/m/'. /m sólo reparte.
//
// v2 (docs/diseno-mako-mobile-v2.md, «La barra inferior»): la barra es Today · CRM · Inbox ·
// Plan · More, y MaKo dejó de ser destino: vive en More con Dashboard, Ads Manager, Customer
// Success, Automations, Video Generator y Landing Generator. Si a un rol le falta uno de los
// cuatro primeros, su lugar lo toma la PRIMERA sección de More que sí vea (`barraMovil`).
// =============================================================================

import { TODOS_LOS_ITEMS, USER_NAV } from '@/app/_components/nav';
import { tabEnCapa } from './capas';
import { capaDeHojaDeRol } from './graficos-roles';
import { RUTA_AUTOMATIONS, RUTAS_VIEJAS_AUTOMATIONS } from './ruta-automations';

/** Los cinco destinos FIJOS de la barra. */
export type DestinoMovil = 'hoy' | 'crm' | 'inbox' | 'plan' | 'mas';
/** Las secciones que viven en More. */
export type IdSeccionMas = 'dashboard' | 'ads' | 'cs' | 'automations' | 'video' | 'landing' | 'mako';
/** Lo que puede ocupar un lugar de la barra: un destino fijo o una sección de More que subió. */
export type IdBarra = DestinoMovil | IdSeccionMas;

export type DefDestino = {
  id: DestinoMovil;
  /** Nombre en inglés, como el escritorio (regla de la casa: los NOMBRES van en inglés). */
  label: string;
  href: string;
  /** Nombre del ícono de `app/_components/icons.tsx` (uno inexistente dibuja un punto). */
  icon: string;
  /**
   * La key de `app/_components/nav.ts` cuya regla de visibilidad hereda (rolesWs + capa).
   * `null` = lo ve cualquiera con sesión: «Today» e «Inbox» se COMPONEN por rol con lo que
   * cada uno puede ver, y «More» se arma con lo que el rol ve.
   */
  navKey: string | null;
};

export type DefSeccionMas = {
  id: IdSeccionMas;
  label: string;
  href: string;
  /** Ícono de `app/_components/icons.tsx`. MaKo no lo usa: su fila lleva el logo real. */
  icon: string;
  /** La key de nav.ts que la gatea (la MISMA que pide `requireMovil({ navKey })` en su page). */
  navKey: string;
  /** El grupo de la lista de More (cada grupo es una caja): 1 operación, 2 contenido, 3 MaKo. */
  grupo: 1 | 2 | 3;
};

export const HOME_MOVIL = '/m/hoy';
export const RUTA_MAS = '/m/mas';

export const DESTINOS_MOVIL: readonly DefDestino[] = [
  { id: 'hoy', label: 'Today', href: HOME_MOVIL, icon: 'general', navKey: null },
  { id: 'crm', label: 'CRM', href: '/m/crm', icon: 'crm', navKey: 'crm' },
  // Inbox al CENTRO: es la cola de lo que espera una decisión, y ahí llega el pulgar.
  { id: 'inbox', label: 'Inbox', href: '/m/inbox', icon: 'bandeja', navKey: null },
  { id: 'plan', label: 'Plan', href: '/m/plan', icon: 'todo', navKey: 'todo' },
  { id: 'mas', label: 'More', href: RUTA_MAS, icon: 'mas', navKey: null },
];

/** En el orden de la lista de More (y en el que suben a la barra si falta un destino). */
export const SECCIONES_MAS: readonly DefSeccionMas[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/m/dashboard', icon: 'graphics', navKey: 'graphics', grupo: 1 },
  { id: 'ads', label: 'Ads Manager', href: '/m/ads', icon: 'grid', navKey: 'ads-manager', grupo: 1 },
  { id: 'cs', label: 'Customer Success', href: '/m/cs', icon: 'cs', navKey: 'customer-success', grupo: 1 },
  { id: 'automations', label: 'Automations', href: '/m/automations', icon: 'chatbot', navKey: 'setting', grupo: 1 },
  { id: 'video', label: 'Video Generator', href: '/m/video', icon: 'videogen', navKey: 'video-generator', grupo: 2 },
  { id: 'landing', label: 'Landing Generator', href: '/m/landing', icon: 'web', navKey: 'landing-writer', grupo: 2 },
  { id: 'mako', label: 'MaKo', href: '/m/mako', icon: 'mako', navKey: 'mako', grupo: 3 },
];

export type RolMovil = 'admin' | 'closer' | 'setter' | null;

/** Un lugar de la barra: un destino fijo o una sección de More que subió a ocupar un hueco. */
export type ItemBarra = { id: IdBarra; label: string; href: string; icon: string };

/** ¿La ruta es de MaKo Mobile? `/m` o `/m/...`, nunca `/m.js` ni `/mako`. */
export function esRutaMovil(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  return p === '/m' || p.startsWith('/m/');
}

/** `p` es `base` o algo debajo de `base` (con barra: «/m/crm» no atrapa «/m/crmx»). */
function dentro(p: string, base: string): boolean {
  return p === base || p.startsWith(base + '/');
}

/** ¿Este rol, en esta capa, ve la tab de escritorio `key`? La MISMA regla del Sidebar. */
export function puedeVerKey(key: string, rol: RolMovil, capa: string | null | undefined): boolean {
  const item = TODOS_LOS_ITEMS.find((i) => i.key === key) ?? USER_NAV.find((i) => i.key === key);
  if (!item) return false;
  // null = sin rol resuelto (sin sesión): no ve nada gateado. El guard de la página ya lo
  // manda a /login; acá no se adivina a favor.
  const porRol = rol === 'admin' ? true : rol ? (item.rolesWs ?? []).includes(rol) : false;
  return porRol && tabEnCapa(key, capa);
}

/** Los destinos FIJOS que este rol y esta capa ven, en el orden de la barra. */
export function destinosVisibles(rol: RolMovil, capa: string | null | undefined): DefDestino[] {
  return DESTINOS_MOVIL.filter((d) => d.navKey === null || puedeVerKey(d.navKey, rol, capa));
}

/**
 * ¿Este rol ve esta sección de More? La regla del Sidebar (`puedeVerKey`) y UNA excepción que
 * escritorio aplica en la página y no en el nav: el closer y el setter entran al Dashboard sólo para
 * ver SU hoja (Closing y Chat Analyst, `HOJA_DE_ROL`), y si su negocio no tiene la tab de esa hoja
 * los saca (app/dashboard/page.tsx). Sin esto, More le
 * mostraba la fila y /m/dashboard lo devolvía a Today.
 */
function veSeccion(s: DefSeccionMas, rol: RolMovil, capa: string | null | undefined): boolean {
  if (!puedeVerKey(s.navKey, rol, capa)) return false;
  const capaRol = s.id === 'dashboard' ? capaDeHojaDeRol(rol) : null;
  if (capaRol && !tabEnCapa(capaRol, capa)) return false;
  return true;
}

/** Las secciones de More que este rol y esta capa ven, en orden. */
export function seccionesMasVisibles(rol: RolMovil, capa: string | null | undefined): DefSeccionMas[] {
  return SECCIONES_MAS.filter((s) => veSeccion(s, rol, capa));
}

/**
 * La barra de ESTE rol: cinco lugares, More siempre al final. Si el rol no ve uno de los
 * cuatro primeros (un setter sin Plan, la capa pm sin CRM), ese lugar lo toma la primera
 * sección de More que sí vea y que no esté ya en la barra. Si no queda ninguna, la barra
 * tiene menos de cinco (nunca un destino que la persona no puede abrir).
 */
export function barraMovil(rol: RolMovil, capa: string | null | undefined): ItemBarra[] {
  const visibles = new Set(destinosVisibles(rol, capa).map((d) => d.id));
  const reserva = seccionesMasVisibles(rol, capa).slice();
  const out: ItemBarra[] = [];
  for (const d of DESTINOS_MOVIL) {
    if (d.id === 'mas') continue;
    if (visibles.has(d.id)) { out.push({ id: d.id, label: d.label, href: d.href, icon: d.icon }); continue; }
    const s = reserva.shift();
    if (s) out.push({ id: s.id, label: s.label, href: s.href, icon: s.icon });
  }
  const mas = DESTINOS_MOVIL.find((d) => d.id === 'mas')!;
  out.push({ id: mas.id, label: mas.label, href: mas.href, icon: mas.icon });
  return out;
}

/**
 * Las secciones que /m/mas lista para este rol, SIN las que subieron a la barra (una cosa
 * en un solo lugar, como el «More» de iOS). Agrupadas: cada grupo es una caja de la lista.
 */
export function gruposMas(rol: RolMovil, capa: string | null | undefined): DefSeccionMas[][] {
  const enBarra = new Set<string>(barraMovil(rol, capa).map((b) => b.id));
  const lista = seccionesMasVisibles(rol, capa).filter((s) => !enBarra.has(s.id));
  const grupos: DefSeccionMas[][] = [];
  for (const g of [1, 2, 3] as const) {
    const xs = lista.filter((s) => s.grupo === g);
    if (xs.length) grupos.push(xs);
  }
  return grupos;
}

/** La sección de More dueña de esta ruta (`/m/ads/123` → Ads Manager), o null. */
export function seccionDeRuta(pathname: string | null | undefined): DefSeccionMas | null {
  const p = pathname ?? '';
  if (!esRutaMovil(p)) return null;
  return SECCIONES_MAS.find((s) => dentro(p, s.href)) ?? null;
}

/**
 * Qué lugar de la barra está activo para esta ruta (null fuera de /m o en una ruta suelta
 * como /m/configurar). Con la barra del rol (`barraMovil`), una sección que subió a la barra
 * se marca a sí misma; si no, cualquier ruta de una sección de More (y la cuenta, que es la
 * primera fila de More) marca More.
 */
export function destinoActivo(
  pathname: string | null | undefined,
  barra: ReadonlyArray<{ id: IdBarra; href: string }> = DESTINOS_MOVIL,
): IdBarra | null {
  const p = (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '');
  if (!esRutaMovil(p)) return null;
  for (const d of barra) if (dentro(p, d.href)) return d.id;
  if (seccionDeRuta(p) || dentro(p, '/m/cuenta')) return 'mas';
  return null;
}

/** El id de un plan de video (`crypto.randomUUID()`, app/video-generator/actions.ts). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El equivalente MÓVIL de un link de escritorio, o null si esa pantalla no va al teléfono.
 * Recibe el path con o sin query. Devuelve el path, y una query SÓLO donde la pantalla del
 * teléfono la lee (`/m/dashboard?hoja=comercial`, o la de un link que ya es de /m, como
 * `/m/inbox?vista=avisos`). El `?ws=` NUNCA viaja: lo pone quien navega (`conWs`,
 * `rutaConWs` o `linkApp`), y uno viejo pegado en el link ganaría (conWs no pisa el que ya
 * está). Una URL absoluta se recorta a su path.
 */
export function rutaMovil(href: string | null | undefined): string | null {
  if (!href) return null;
  let path = href;
  try {
    if (/^https?:\/\//i.test(href)) path = new URL(href).pathname + new URL(href).search;
  } catch { return null; }
  // El `#` se va ANTES de partir la query: `/crm/12#notas` no matcheaba la ficha y
  // el push caía en la home (AGENTS.md: un id que se saca de un link va sin `?` ni `#`).
  const [soloPath, query = ''] = path.split('#')[0].split('?');
  const p = soloPath.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(query);

  if (esRutaMovil(p)) {
    q.delete('ws');
    const resto = q.toString();
    return resto ? `${p}?${resto}` : p;
  }
  if (p === '/general' || p === '/focus' || p === '/inicio') return HOME_MOVIL;
  if (p === '/mako/pendientes' || p.startsWith('/mako/revisar') || p.startsWith('/crm/revisar') || p.startsWith('/plan/revisar')) return '/m/inbox';
  if (p === '/mako' || p === '/mako-doer') return '/m/mako';
  // El tablero de decisiones del super admin (14/10/2026): Martín lo lee desde el teléfono.
  if (p === '/admin/runway') return '/m/decisiones';
  // Las pantallas que SÓLO existen en el teléfono, con la URL que muestran (`SOLO_TELEFONO`).
  const chat = p.match(/^\/crm\/(\d+)\/chat$/);
  if (chat) return `/m/crm/${chat[1]}/chat`;
  if (p === '/mas') return RUTA_MAS;
  if (p === '/configurar') return '/m/configurar';
  if (p === '/perfil/instalar') return '/m/cuenta/instalar';
  const lead = p.match(/^\/crm\/(\d+)(?:\/resumen)?$/);
  if (lead) return `/m/crm/${lead[1]}`;
  if (p === '/crm') return '/m/crm';
  if (p === '/plan' || p === '/plan/agencia' || p === '/todo') return '/m/plan';
  if (p === '/perfil' || (p === '/configuraciones' && q.get('tab') === 'notif')) return '/m/cuenta';
  // Las secciones de More (v2). Cada una cae en su sección. Donde el id es EL MISMO en los dos
  // lados (el plan de un video, una landing de landing_docs), va a la pantalla de ESA cosa; un
  // anuncio de Meta no tiene pantalla propia en el teléfono y cae en la lista de Ads Manager.
  if (p === '/comercial') return '/m/dashboard?hoja=comercial';
  if (p === '/dashboard' || p === '/marketing' || dentro(p, '/graficos')) {
    // `?hoja=` de escritorio: «comercial» es la segunda pestaña del segmentado; otra hoja propia
    // abre /m/dashboard/<id> (si no existe o no entra en el teléfono, esa página vuelve sola).
    const hoja = q.get('hoja')?.trim();
    if (!hoja || hoja === 'marketing') return '/m/dashboard';
    if (hoja === 'comercial') return '/m/dashboard?hoja=comercial';
    return `/m/dashboard/${encodeURIComponent(hoja)}`;
  }
  if (dentro(p, '/ads-manager')) return '/m/ads';
  if (dentro(p, '/customer-success')) return '/m/cs';
  if (dentro(p, RUTA_AUTOMATIONS) || dentro(p, '/setting') || RUTAS_VIEJAS_AUTOMATIONS.some((r) => dentro(p, r))) return '/m/automations';
  if (dentro(p, '/video-generator')) {
    const plan = q.get('plan') ?? '';
    return UUID.test(plan) ? `/m/video/${plan}` : '/m/video';
  }
  const landing = p.match(/^\/landing-generator\/(\d+)$/);
  if (landing) return `/m/landing/${landing[1]}`;
  if (dentro(p, '/landing-generator') || dentro(p, '/landing-writer')) return '/m/landing';
  return null;
}

/** Para un link que SALE (un Web Push): el equivalente móvil o, si no hay, la home. */
export function rutaMovilOHome(href: string | null | undefined): string {
  return rutaMovil(href) ?? HOME_MOVIL;
}

// =============================================================================
// LAS MISMAS RUTAS (12/10/2026): /m es la carpeta INTERNA, nunca una URL
// =============================================================================
// Martín, mirando /m/hoy en su celular: «lo que esta mal es que funcione por rutas, eso no debe
// ser así... Las rutas deben ser las mismas, solo debe detectar si estoy en mobile». O sea: el
// teléfono abre /crm, /general, /plan… con la MISMA URL que la computadora, y el proxy le sirve la
// página de /m (`NextResponse.rewrite`, proxy.ts → `pedidoMovil` de lib/movil-desvio.ts).
//
// Adentro de /m todo sigue hablando de rutas /m (la cabecera, la barra, el nivel de una pantalla):
// es la representación interna. Hay DOS fronteras, una por sentido, y cada una es UNA función:
//   · al LEER la URL del navegador → `rutaInterna` (lo que /m sabe dibujar);
//   · al NAVEGAR → `rutaEscritorio`, que la aplica `conWs` (lib/ws-tab.ts), por donde pasan las
//     cinco formas de navegar (Link, router, redirect, window.location, linkApp). Un href '/m/…'
//     escrito en una pantalla sale como la ruta de escritorio sin que nadie se acuerde.
// tests/movil-rutas.test.ts fija la ida y vuelta de cada página de app/m.
// =============================================================================

/**
 * Las pantallas que existen SÓLO en el teléfono, con la URL que muestran y a dónde lleva esa URL
 * si la abre una computadora (o un teléfono con «Versión completa»): el proxy la redirige ahí.
 */
export const SOLO_TELEFONO: ReadonlyArray<{ url: RegExp; computadora: (m: RegExpMatchArray) => string }> = [
  { url: /^\/mas$/, computadora: () => '/general' },
  { url: /^\/configurar$/, computadora: () => '/onboarding' },
  { url: /^\/perfil\/instalar$/, computadora: () => '/perfil' },
  { url: /^\/crm\/(\d+)\/chat$/, computadora: (m) => `/crm/${m[1]}` },
];

/** Si `pathname` es una pantalla SÓLO del teléfono, a dónde va en la computadora; si no, null. */
export function respaldoEscritorio(pathname: string | null | undefined): string | null {
  const p = (pathname ?? '').replace(/\/+$/, '') || '/';
  for (const s of SOLO_TELEFONO) {
    const m = p.match(s.url);
    if (m) return s.computadora(m);
  }
  return null;
}

/**
 * La URL que se MUESTRA para una ruta interna de /m: la de escritorio, con la query y el `#`
 * intactos (el `?ws=` incluido). Lo que no es /m vuelve tal cual. Una ruta /m que no está en la
 * tabla también (va a dar 404 como antes, y el test de ida y vuelta la nombra).
 */
export function rutaEscritorio(href: string): string {
  // Barato a propósito: lo llama `conWs` en CADA navegación. Una URL que no arranca con «/m» no es
  // de /m (y la pregunta de verdad es `esRutaMovil`, más abajo: «/mako» también arranca así).
  if (!href || href.charCodeAt(0) !== 47 || href.charCodeAt(1) !== 109) return href;
  const [sinHash, hash] = href.split('#');
  const [crudo, query = ''] = sinHash.split('?');
  const p = crudo.replace(/\/+$/, '') || '/';
  if (!esRutaMovil(p)) return href;
  const q = new URLSearchParams(query);
  let destino: string | null = null;
  let m: RegExpMatchArray | null;
  if (p === '/m' || p === HOME_MOVIL) destino = '/general';
  else if ((m = p.match(/^\/m\/crm\/(\d+)\/chat$/))) destino = `/crm/${m[1]}/chat`;
  else if ((m = p.match(/^\/m\/crm\/([^/]+)$/))) destino = `/crm/${m[1]}`;
  else if (p === '/m/crm') destino = '/crm';
  else if (p === '/m/inbox') destino = '/mako/pendientes';
  else if (p === '/m/plan') destino = '/plan';
  else if (p === RUTA_MAS) destino = '/mas';
  else if (p === '/m/mako') destino = '/mako';
  else if (p === '/m/decisiones') destino = '/admin/runway';
  else if (p === '/m/cuenta/instalar') destino = '/perfil/instalar';
  else if (p === '/m/cuenta') destino = '/perfil';
  else if (p === '/m/configurar') destino = '/configurar';
  else if ((m = p.match(/^\/m\/dashboard\/([^/]+)$/))) {
    destino = '/dashboard';
    let hoja = m[1];
    try { hoja = decodeURIComponent(hoja); } catch { /* un % suelto: va tal cual */ }
    q.set('hoja', hoja);
  } else if (p === '/m/dashboard') destino = '/dashboard';
  else if (p === '/m/ads') destino = '/ads-manager';
  else if (p === '/m/cs') destino = '/customer-success';
  else if (p === '/m/automations') destino = RUTA_AUTOMATIONS;
  else if ((m = p.match(/^\/m\/video\/([^/]+)$/))) { destino = '/video-generator'; q.set('plan', m[1]); }
  else if (p === '/m/video') destino = '/video-generator';
  else if ((m = p.match(/^\/m\/landing\/([^/]+)$/))) destino = `/landing-generator/${m[1]}`;
  else if (p === '/m/landing') destino = '/landing-generator';
  if (!destino) return href;
  const resto = q.toString();
  return `${destino}${resto ? `?${resto}` : ''}${hash ? `#${hash}` : ''}`;
}

/**
 * La ruta INTERNA de /m que corresponde a la URL del navegador (sin query), o null si esa URL no
 * es una pantalla del teléfono. Con LAS MISMAS RUTAS el navegador muestra /crm/12 y el shell de /m
 * necesita saber que está en /m/crm/12 (la cabecera, la barra, el nivel de la animación). Acepta
 * también una URL que ya es /m (un link viejo antes del redirect del proxy).
 */
export function rutaInterna(pathname: string | null | undefined, search = ''): string | null {
  const p = (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (esRutaMovil(p)) return p;
  const s = search.replace(/^\?/, '');
  const r = rutaMovil(s ? `${p}?${s}` : p);
  return r ? r.split('?')[0] : null;
}
