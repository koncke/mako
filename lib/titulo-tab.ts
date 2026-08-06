// =============================================================================
// titulo-tab — de una ruta al título de la pestaña del navegador
// =============================================================================
// "MaKo - CRM" en vez de "MaKo" a secas en las 45 pantallas: con varias pestañas
// abiertas eran todas iguales y había que entrar a cada una para encontrar la
// buena.
//
// Los nombres NO se escriben acá: salen de nav.ts, el mismo lugar del que sale el
// sidebar. Si mañana una tab se renombra en el menú, la pestaña la sigue sola.
//
// Lógica pura y aparte del componente para poder probarla (tests/titulo-tab).

import { TOP_NAV, NAV_GROUPS, ADMIN_NAV, USER_NAV, ADS_MANAGER_ITEM, MAKO_ITEM, type NavItem } from '@/app/_components/nav';

export const MARCA = 'MaKo';

// Rutas que nav.ts no nombra bien por sí solo. Se consultan ANTES que los
// matchers: /metodo, por ejemplo, matchea con "Configuraciones" (es su sub-tab)
// pero en el sidebar se llama Integraciones, que es lo que se espera leer en la
// pestaña. Se prueban de la clave más larga a la más corta, así /marketing/salud
// gana sobre /marketing.
const EXTRA: Record<string, string> = {
  '/marketing/salud': 'Salud de Meta',
  '/martinkoncke': 'Plan',
  '/conocimiento': 'Conocimiento',
  '/integraciones': 'Integraciones',
  '/comercial': 'Dashboard',
  '/marketing': 'Dashboard',
  '/setting': 'Chat Agent',
  '/metodo': 'Integraciones',
  '/anuncio': 'Anuncio',
  '/equipo': 'Equipo',
  '/funnel': 'Funnel',
  '/inicio': 'Inicio',
};
const EXTRA_KEYS = Object.keys(EXTRA).sort((a, b) => b.length - a.length);

// Donde dos entradas matchean la misma ruta gana la primera, así que van antes
// las del menú principal.
const TODOS: NavItem[] = [
  ...TOP_NAV,
  ...NAV_GROUPS.flatMap((g) => g.items),
  ADS_MANAGER_ITEM,
  MAKO_ITEM,
  ...USER_NAV,
  ...ADMIN_NAV,
];

/** "ads-manager" → "Ads manager". Red de seguridad para una ruta sin entrada. */
function desdeLaRuta(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  const limpio = seg.replace(/-/g, ' ');
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function tituloDe(pathname: string): string {
  if (pathname === '/login') return MARCA;
  for (const k of EXTRA_KEYS) if (pathname === k || pathname.startsWith(k + '/')) return `${MARCA} - ${EXTRA[k]}`;
  const item = TODOS.find((i) => i.match(pathname));
  const label = item?.label ?? desdeLaRuta(pathname);
  return label ? `${MARCA} - ${label}` : MARCA;
}
