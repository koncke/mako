// =============================================================================
// Definición de la navegación del sidebar (rediseño Marketing OS)
// =============================================================================
// Una sola fuente de verdad para el sidebar compartido. `match` decide el
// estado activo a partir del pathname. Cada item trae un `icon` (SVG interno,
// trazo 24×24) al estilo Meta Business Suite: barra densa, con iconos, sin
// scroll. El item de MaKo usa la chispa dorada de marca (se pinta aparte).

export type NavItem = {
  key: string;
  label: string;
  href: string;
  /** SVG interno (paths con stroke=currentColor) del icono 24×24 */
  icon?: string;
  /** muestra el badge rojo de "datos sin marcar" (solo CRM) */
  badge?: boolean;
  /** prefijos de ruta que marcan este item como activo */
  match: (pathname: string) => boolean;
};

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

// Iconos (Lucide-style, viewBox 24×24, trazo). currentColor hereda del row.
const ICON = {
  general:
    '<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="13.5" y="12" width="7.5" height="9" rx="1.5"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5"/>',
  crm:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  funnel: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  marketing:
    '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  comercial:
    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  ads:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  closing:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  script:
    '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  experimentos:
    '<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A1 1 0 0 0 5.4 20h13.2a1 1 0 0 0 .9-1.5L14 9V3"/><path d="M7 14h10"/>',
  whatsapp: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  email:
    '<rect x="2" y="4.5" width="20" height="15" rx="2.5"/><path d="m3 7 9 6 9-6"/>',
} as const;

export const MAIN_NAV: NavItem[] = [
  { key: 'general', label: 'Vista General', href: '/general', icon: ICON.general, match: starts('/general') },
  { key: 'crm', label: 'CRM', href: '/leads', icon: ICON.crm, badge: true, match: starts('/leads') },
  { key: 'funnel', label: 'Funnel', href: '/funnel', icon: ICON.funnel, match: starts('/funnel') },
  { key: 'marketing', label: 'Marketing', href: '/marketing', icon: ICON.marketing, match: (p) => starts('/marketing')(p) && !starts('/marketing/salud')(p) },
  { key: 'comercial', label: 'Comercial', href: '/comercial', icon: ICON.comercial, match: starts('/comercial') },
];

export const TOOLS_NAV: NavItem[] = [
  { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: ICON.ads, match: starts('/ads-manager') },
  { key: 'closing', label: 'Closing Analysis', href: '/closing', icon: ICON.closing, match: starts('/closing') },
  { key: 'script-analyst', label: 'Script Analyst', href: '/script-analyst', icon: ICON.script, match: starts('/script-analyst') },
  { key: 'experimentos', label: 'Experimentos', href: '/experimentos', icon: ICON.experimentos, match: starts('/experimentos') },
  { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: ICON.whatsapp, badge: true, match: starts('/whatsapp') },
  { key: 'email', label: 'Email Marketing', href: '/email', icon: ICON.email, match: starts('/email') },
  {
    key: 'mako',
    label: 'Preguntale a MaKo',
    href: '/mako',
    // sin icon: el sidebar dibuja la chispa dorada de marca (MakoStar).
    match: starts('/mako'),
  },
];

// Opciones del menú del usuario (abajo del sidebar): config de MaKo.
export const USER_NAV: NavItem[] = [
  { key: 'perfil', label: 'Perfil', href: '/perfil', match: starts('/perfil') },
  { key: 'estado-meta', label: 'Estado de Meta', href: '/marketing/salud', match: starts('/marketing/salud') },
  { key: 'conocimiento', label: 'Conocimiento', href: '/conocimiento', match: starts('/conocimiento') },
  { key: 'contexto', label: 'Contexto de MaKo', href: '/contexto', match: starts('/contexto') },
  { key: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', match: starts('/configuraciones') },
  { key: 'onboarding', label: 'Onboarding', href: '/onboarding', match: starts('/onboarding') },
];
