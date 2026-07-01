// =============================================================================
// Definición de la navegación del sidebar (rediseño Marketing OS)
// =============================================================================
// Una sola fuente de verdad para el sidebar plegable. `match` decide el estado
// activo a partir del pathname; `icon` es la clave para <Icon /> (icons.tsx).

export type NavItem = {
  key: string;
  label: string;
  href: string;
  /** clave del ícono en icons.tsx (rail plegado + item) */
  icon: string;
  /** muestra el badge de contador (CRM = datos sin marcar, WhatsApp = sin leer) */
  badge?: boolean;
  /** prefijos de ruta que marcan este item como activo */
  match: (pathname: string) => boolean;
};

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

// PRINCIPAL — lo que se mira todos los días.
export const MAIN_NAV: NavItem[] = [
  { key: 'general', label: 'General', href: '/general', icon: 'general', match: starts('/general') },
  { key: 'crm', label: 'CRM', href: '/leads', icon: 'crm', badge: true, match: starts('/leads') },
  { key: 'graphics', label: 'Graphics', href: '/graphics', icon: 'graphics', match: (p) => starts('/graphics')(p) || starts('/marketing')(p) || starts('/comercial')(p) },
];

// HERRAMIENTAS — features puntuales.
export const TOOLS_NAV: NavItem[] = [
  { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: 'ads', match: starts('/ads-manager') },
  { key: 'closing', label: 'Closing Analysis', href: '/closing', icon: 'closing', match: starts('/closing') },
  { key: 'script-analyst', label: 'Script Analyst', href: '/script-analyst', icon: 'script', match: starts('/script-analyst') },
  { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: starts('/experimentos') },
  { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', badge: true, match: starts('/whatsapp') },
  { key: 'email', label: 'Email Marketing', href: '/email', icon: 'email', match: starts('/email') },
  { key: 'mako', label: 'Preguntale a MaKo', href: '/mako', icon: 'mako', match: starts('/mako') },
];

// Menú del usuario (dropdown de la foto de perfil, abajo del sidebar).
// (Funnel y Onboarding se van a anidar dentro de Configuraciones en el próximo
// paso; por ahora viven acá para que sigan siendo alcanzables.)
export const USER_NAV: NavItem[] = [
  { key: 'perfil', label: 'Perfil', href: '/perfil', icon: 'perfil', match: starts('/perfil') },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: 'integraciones', match: (p) => starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  { key: 'contexto', label: 'Contexto de MaKo', href: '/contexto', icon: 'contexto', match: starts('/contexto') },
  { key: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', icon: 'config', match: starts('/configuraciones') },
  { key: 'funnel', label: 'Funnel', href: '/funnel', icon: 'funnel', match: starts('/funnel') },
  { key: 'onboarding', label: 'Onboarding', href: '/onboarding', icon: 'onboarding', match: starts('/onboarding') },
];
