// =============================================================================
// Definición de la navegación del sidebar (rediseño Marketing OS)
// =============================================================================
// Una sola fuente de verdad para el sidebar compartido. `match` decide el
// estado activo a partir del pathname.

export type NavItem = {
  key: string;
  label: string;
  href: string;
  /** glifo a la izquierda (Koncke usa ✦); si no, se usa el cuadrito de color */
  glyph?: string;
  /** muestra el badge rojo de "datos sin marcar" (solo CRM) */
  badge?: boolean;
  /** prefijos de ruta que marcan este item como activo */
  match: (pathname: string) => boolean;
};

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

export const MAIN_NAV: NavItem[] = [
  { key: 'general', label: 'Vista General', href: '/general', match: starts('/general') },
  { key: 'crm', label: 'CRM', href: '/leads', badge: true, match: starts('/leads') },
  { key: 'funnel', label: 'Funnel', href: '/funnel', glyph: '⤳', match: starts('/funnel') },
  { key: 'marketing', label: 'Marketing', href: '/marketing', match: (p) => starts('/marketing')(p) && !starts('/marketing/salud')(p) },
  { key: 'comercial', label: 'Comercial', href: '/comercial', match: starts('/comercial') },
];

export const TOOLS_NAV: NavItem[] = [
  { key: 'closing', label: 'Closing Analysis', href: '/closing', match: starts('/closing') },
  { key: 'script-analyst', label: 'Script Analyst', href: '/script-analyst', match: starts('/script-analyst') },
  { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', badge: true, match: starts('/whatsapp') },
  { key: 'email', label: 'Email Marketing', href: '/email', match: starts('/email') },
  {
    key: 'mako',
    label: 'Preguntale a MaKo',
    href: '/mako',
    glyph: '✨',
    match: starts('/mako'),
  },
];

// Opciones del menú del usuario (abajo del sidebar): config de MaKo.
export const USER_NAV: NavItem[] = [
  { key: 'estado-meta', label: 'Estado de Meta', href: '/marketing/salud', match: starts('/marketing/salud') },
  { key: 'contexto', label: 'Contexto de MaKo', href: '/contexto', match: starts('/contexto') },
  { key: 'onboarding', label: 'Onboarding', href: '/onboarding', match: starts('/onboarding') },
];
