// =============================================================================
// Definición de la navegación del sidebar (rediseño Marketing OS)
// =============================================================================
// Estructura: items sueltos arriba (General, CRM, Graphics, Experiments, MaKo) +
// grupos colapsables (Analytics, Tools, Chats, Customer Success). `match` decide
// el estado activo; `icon` es la clave para <Icon /> (icons.tsx). Las features
// que todavía no existen apuntan a su ruta con comingSoon=true (view "coming
// soon").

import type { RolWorkspace } from '@/lib/auth-session';

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  badge?: boolean;
  comingSoon?: boolean;
  /** Solo visible para rol admin de AGENCIA (el Sidebar filtra con /api/auth/me). */
  adminOnly?: boolean;
  /**
   * Roles DENTRO del negocio que ven esta tab. El admin-cliente (rol_ws='admin')
   * ve TODO igual; esto solo habilita tabs a closer/setter. Ausente = solo
   * admin-cliente (y agencia). El enforcement real es server-side (lib/tab-access).
   */
  rolesWs?: RolWorkspace[];
  /** Abre en pestaña nueva (rutas que sirven HTML directo, ej. el grafo). */
  newTab?: boolean;
  /**
   * Solo en el shell de admin: al clickear, el admin ENTRA COMO el workspace
   * dueño (ws1) y navega. Sirve para tabs por-workspace (WhatsApp/Email) que el
   * admin sin impersonar no puede usar (ws=null, fail-closed). Reusa la
   * impersonación firmada de /api/admin/impersonate.
   */
  entrarComoDueno?: boolean;
  match: (pathname: string) => boolean;
};

export type NavGroup = { key: string; label: string; icon: string; items: NavItem[] };

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

// Items sueltos (arriba del divider).
export const TOP_NAV: NavItem[] = [
  { key: 'general', label: 'General', href: '/general', icon: 'general', match: starts('/general') },
  { key: 'crm', label: 'CRM', href: '/leads', icon: 'crm', badge: true, rolesWs: ['closer', 'setter'], match: starts('/leads') },
  { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', match: (p) => starts('/dashboard')(p) || starts('/marketing')(p) || starts('/comercial')(p) },
  { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: starts('/experimentos') },
  { key: 'todo', label: 'Plan', href: '/plan', icon: 'todo', rolesWs: ['closer', 'setter'], match: (p) => starts('/plan')(p) || starts('/todo')(p) },
];

// Ads Manager va DEBAJO del divider, arriba de los grupos.
export const ADS_MANAGER_ITEM: NavItem = { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: 'grid', match: starts('/ads-manager') };

// MaKo va aparte, abajo del todo (arriba del perfil), siempre con su estrella dorada.
export const MAKO_ITEM: NavItem = { key: 'mako', label: 'Preguntale a MaKo', href: '/mako', icon: 'mako', rolesWs: ['closer', 'setter'], match: starts('/mako') };

// Shell de administración: lo ve un admin que NO está impersonando. Sin tabs de
// marketing — solo gestión de clientes e integraciones.
export const ADMIN_NAV: NavItem[] = [
  // /admin/guiones tiene su propio item — que "Clientes" no se marque también.
  { key: 'admin', label: 'Clientes', href: '/admin', icon: 'admin', match: (p) => starts('/admin')(p) && !starts('/admin/guiones')(p) },
  { key: 'plan', label: 'Plan', href: '/plan', icon: 'todo', match: (p) => starts('/plan')(p) || starts('/todo')(p) },
  // Canal propio de MaKo (SuperAdmin): WhatsApp del admin (canal + chat de grupos
  // + plantillas). NO es preview de ningún cliente. Su propia línea por QR.
  { key: 'agencia', label: 'WhatsApp de MaKo', href: '/agencia', icon: 'whatsapp', match: starts('/agencia') },
  { key: 'mako-admin', label: 'MaKo', href: '/admin?tab=copy', icon: 'mako', match: () => false },
  // La fábrica de guiones: biblioteca de ÁNGULOS y ESTRUCTURAS que ven todos los
  // clientes al crear un guion en la Matriz. Editable solo por el super-admin.
  { key: 'guiones-admin', label: 'Guiones', href: '/admin/guiones', icon: 'graphics', match: starts('/admin/guiones') },
  { key: 'grafo', label: 'Grafo', href: '/api/admin/graph', icon: 'graphics', newTab: true, match: () => false },
  { key: 'metodo-admin', label: 'Integraciones', href: '/metodo', icon: 'integraciones', match: starts('/metodo') },
  { key: 'modelos-ia', label: 'Modelos IA', href: '/modelos-ia', icon: 'mako', match: starts('/modelos-ia') },
  // Portal de formación interna (curso AVATARHYPE) — capa oscura autocontenida.
  { key: 'conocimientos', label: 'Conocimientos', href: '/conocimientos', icon: 'contexto', match: starts('/conocimientos') },
];

// Grupos colapsables.
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'analytics', label: 'Analytics', icon: 'analytics', items: [
      { key: 'closing', label: 'Closing Analyst', href: '/closing', icon: 'closing', rolesWs: ['closer'], match: starts('/closing') },
      { key: 'script', label: 'Ads Analyst', href: '/ads-analyst', icon: 'notepencil', match: starts('/ads-analyst') },
      { key: 'offer', label: 'Offer Analyst', href: '/offer-analyst', icon: 'tag', comingSoon: true, match: starts('/offer-analyst') },
      { key: 'landing-an', label: 'Landing Analyst', href: '/landing-analyst', icon: 'web', comingSoon: true, match: starts('/landing-analyst') },
      { key: 'vsl-an', label: 'VSL Analyst', href: '/vsl-analyst', icon: 'video', comingSoon: true, match: starts('/vsl-analyst') },
      { key: 'market-an', label: 'Market Analyst', href: '/market-analyst', icon: 'search', comingSoon: true, match: starts('/market-analyst') },
    ],
  },
  {
    key: 'tools', label: 'Tools', icon: 'tools', items: [
      { key: 'mako-doer', label: 'MaKo Doer', href: '/mako-doer', icon: 'mako', rolesWs: ['closer', 'setter'], match: starts('/mako-doer') },
      { key: 'ads-writer', label: 'Ads Writer', href: '/ads-writer', icon: 'pen', match: starts('/ads-writer') },
      { key: 'vsl-writer', label: 'VSL Writer', href: '/vsl-writer', icon: 'pen', comingSoon: true, match: starts('/vsl-writer') },
      { key: 'landing-writer', label: 'Landing Writer', href: '/landing-writer', icon: 'pen', comingSoon: true, match: starts('/landing-writer') },
      { key: 'dm-writer', label: 'DM Writer', href: '/dm-writer', icon: 'pen', comingSoon: true, match: starts('/dm-writer') },
    ],
  },
  {
    key: 'chats', label: 'Chats', icon: 'chats', items: [
      // Setting = el cockpit del proceso (jugadas + métricas); WhatsApp/Email son los canales.
      { key: 'setting', label: 'Setting', href: '/setting', icon: 'tag', rolesWs: ['setter'], match: starts('/setting') },
      { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', badge: true, rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
      { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
      { key: 'instagram', label: 'Instagram', href: '/instagram', icon: 'instagram', comingSoon: true, match: starts('/instagram') },
    ],
  },
  {
    key: 'cs', label: 'Customer Success', icon: 'cs', items: [
      { key: 'cs-analyst', label: 'CS Analyst', href: '/cs-analyst', icon: 'cs', comingSoon: true, match: starts('/cs-analyst') },
    ],
  },
];

// Menú del usuario (dropdown de la foto de perfil, abajo del sidebar).
// Funnel, Onboarding y Método viven DENTRO de Configuraciones (sub-tabs), por
// eso el item Configuraciones también matchea esas rutas. Admin solo lo ven
// los usuarios con rol admin.
export const USER_NAV: NavItem[] = [
  { key: 'perfil', label: 'Perfil', href: '/perfil', icon: 'perfil', rolesWs: ['closer', 'setter'], match: starts('/perfil') },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: 'integraciones', match: (p) => starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  { key: 'contexto', label: 'Contexto de MaKo', href: '/contexto', icon: 'contexto', adminOnly: true, match: starts('/contexto') },
  { key: 'onboarding', label: 'Onboarding', href: '/onboarding', icon: 'contexto', match: (p) => starts('/onboarding')(p) || starts('/funnel')(p) },
  { key: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', icon: 'config', match: (p) => starts('/configuraciones')(p) || starts('/metodo')(p) || starts('/equipo')(p) },
  { key: 'admin', label: 'Admin', href: '/admin', icon: 'admin', adminOnly: true, match: starts('/admin') },
];
