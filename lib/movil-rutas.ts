// =============================================================================
// MaKo Mobile — los destinos de la barra inferior y el mapa escritorio → móvil
// =============================================================================
// Una cosa, un lugar: QUÉ destinos tiene la app móvil, QUIÉN ve cada uno y A DÓNDE
// cae en el teléfono un link de escritorio viven acá. Lo leen el layout de /m (la
// barra), los guards de cada página, los links de los Web Push y el foco de «Today».
//
// SIN `server-only` a propósito: lo importan componentes cliente (la barra) y los
// tests. Sólo depende de módulos puros (nav.ts y capas.ts).
//
// ⚠️ EL PREFIJO ES `/m/` CON BARRA, NUNCA `startsWith('/m')`: eso atrapa /mako,
// /marketing, /mensajes, /metodo, /mi-curso, /modelos-ia y —el caro— la ruta
// PÚBLICA /m.js (el cargador del Pixel que los clientes pegan en su landing). Toda
// pregunta «¿es móvil?» pasa por `esRutaMovil`.
//
// ⚠️ LA HOME ES /m/hoy, NO /m: Next redirige /m/ → /m (trailingSlash false), así que
// la URL pelada no queda dentro de un scope '/m/'. /m sólo reparte.
// =============================================================================

import { TODOS_LOS_ITEMS, USER_NAV } from '@/app/_components/nav';
import { tabEnCapa } from './capas';

export type DestinoMovil = 'hoy' | 'inbox' | 'mako' | 'crm' | 'plan';

export type DefDestino = {
  id: DestinoMovil;
  /** Nombre en inglés, como el escritorio (regla de la casa: los NOMBRES van en inglés). */
  label: string;
  href: string;
  /** Nombre del ícono de `app/_components/icons.tsx`. */
  icon: string;
  /**
   * La key de `app/_components/nav.ts` cuya regla de visibilidad hereda (rolesWs + capa).
   * `null` = lo ve cualquiera con sesión: «Today» y «Inbox» se COMPONEN por rol con lo
   * que cada uno puede ver, así que no tienen una tab de escritorio que los gatee.
   */
  navKey: string | null;
};

export const HOME_MOVIL = '/m/hoy';

export const DESTINOS_MOVIL: readonly DefDestino[] = [
  { id: 'hoy', label: 'Today', href: '/m/hoy', icon: 'general', navKey: null },
  { id: 'inbox', label: 'Inbox', href: '/m/inbox', icon: 'bell', navKey: null },
  { id: 'mako', label: 'MaKo', href: '/m/mako', icon: 'mako', navKey: 'mako' },
  { id: 'crm', label: 'CRM', href: '/m/crm', icon: 'crm', navKey: 'crm' },
  { id: 'plan', label: 'Plan', href: '/m/plan', icon: 'todo', navKey: 'todo' },
];

export type RolMovil = 'admin' | 'closer' | 'setter' | null;

/** ¿La ruta es de MaKo Mobile? `/m` o `/m/...`, nunca `/m.js` ni `/mako`. */
export function esRutaMovil(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  return p === '/m' || p.startsWith('/m/');
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

/** Los destinos de la barra para este rol y esta capa, en el orden de la barra. */
export function destinosVisibles(rol: RolMovil, capa: string | null | undefined): DefDestino[] {
  return DESTINOS_MOVIL.filter((d) => d.navKey === null || puedeVerKey(d.navKey, rol, capa));
}

/** Qué destino de la barra está activo para esta ruta (null fuera de /m). */
export function destinoActivo(pathname: string | null | undefined): DestinoMovil | null {
  const p = pathname ?? '';
  if (!esRutaMovil(p)) return null;
  for (const d of DESTINOS_MOVIL) if (p === d.href || p.startsWith(d.href + '/')) return d.id;
  return null;
}

/**
 * El equivalente MÓVIL de un link de escritorio, o null si esa pantalla no va al teléfono.
 * Recibe el path con o sin query; devuelve SÓLO el path (el `?ws=` lo pone quien navega:
 * `conWs`, `rutaConWs` o `linkApp`). Una URL absoluta se recorta a su path.
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

  if (esRutaMovil(p)) return p;
  if (p === '/general' || p === '/focus' || p === '/inicio') return HOME_MOVIL;
  if (p === '/mako/pendientes' || p.startsWith('/mako/revisar') || p.startsWith('/crm/revisar') || p.startsWith('/plan/revisar')) return '/m/inbox';
  if (p === '/mako' || p === '/mako-doer') return '/m/mako';
  const lead = p.match(/^\/crm\/(\d+)(?:\/resumen)?$/);
  if (lead) return `/m/crm/${lead[1]}`;
  if (p === '/crm') return '/m/crm';
  if (p === '/plan' || p === '/plan/agencia' || p === '/todo') return '/m/plan';
  if (p === '/perfil' || (p === '/configuraciones' && q.get('tab') === 'notif')) return '/m/cuenta';
  return null;
}

/** Para un link que SALE (un Web Push): el equivalente móvil o, si no hay, la home. */
export function rutaMovilOHome(href: string | null | undefined): string {
  return rutaMovil(href) ?? HOME_MOVIL;
}
