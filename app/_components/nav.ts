// =============================================================================
// La navegación, organizada por INTENCIÓN (no por inventario de módulos)
// =============================================================================
// Antes esto era el catálogo de lo que existe: General, CRM, Dashboard,
// Experiments y Plan competían al mismo nivel, con grupos llamados «Analytics»,
// «Tools», «Chats» y «Customer Success» — que describen qué ES cada cosa, no
// para qué la abrís.
//
// Ahora son cinco familias, y cada una responde UNA pregunta (documento
// «Arquitectura de Información + App Shell», MaKo · Fase 1 · v1):
//
//   FOCUS    ¿qué es lo más importante que debo hacer ahora?
//   OPERATE  ¿qué tengo que ejecutar hoy?
//   ANALYZE  ¿qué está pasando y por qué?
//   CREATE   ¿qué quiero construir o automatizar?
//   (Profile, abajo)  ¿cómo configuro el contexto y la cuenta?
//
// Los nombres de familia van en INGLÉS por decisión del documento («cortos y
// comprensibles»); los ítems conservan su nombre.
//
// Dos parejas que conviene no confundir, porque son la razón del reparto:
//   · Ads Manager (Operate) EJECUTA · Ads Analyst (Analyze) COMPRENDE.
//   · Chat Agent (Create) se configura y se entrena · WhatsApp/Email (Operate)
//     es la conversación de todos los días.
//
// ⚠️ Las `key` son contrato: `tabEnCapa()` (lib/capas.ts) y el estado del
// onboarding por tab las tienen escritas en la base. Cambiar una key apaga la
// tab en los clientes que la contrataron. Se puede mover de familia y cambiar
// el `label`; la key no.

import type { RolWorkspace } from '@/lib/auth-session';

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
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

/**
 * Una familia de intención.
 *
 * `notifica` es la regla dura de los contadores: SOLO Focus y Operate llevan
 * número, «ya que son los 2 únicos que notifican». En el resto, un badge sería
 * ruido — y si todo tiene badge, nada tiene badge.
 */
export type NavFamilia = {
  key: 'focus' | 'operate' | 'analyze' | 'create';
  label: string;
  /** La pregunta que responde. Se muestra como tooltip del rail. */
  pregunta: string;
  icon: string;
  notifica?: boolean;
  items: NavItem[];
};

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

export const FAMILIAS: NavFamilia[] = [
  {
    key: 'focus',
    label: 'Focus',
    pregunta: '¿Qué es lo más importante que debo hacer ahora?',
    icon: 'general',
    notifica: true,
    items: [
      // Hoy es /general. Cuando exista la pantalla Focus con sus seis campos
      // (prioridad, razón, resultado esperado, responsable, progreso y próxima
      // revisión), este item pasa a ser ella; la key `general` se queda.
      { key: 'general', label: 'Hoy', href: '/general', icon: 'general', match: (p) => starts('/general')(p) || starts('/focus')(p) },
    ],
  },
  {
    key: 'operate',
    label: 'Operate',
    pregunta: '¿Qué tengo que ejecutar hoy?',
    icon: 'crm',
    notifica: true,
    items: [
      { key: 'crm', label: 'CRM', href: '/crm', icon: 'crm', rolesWs: ['closer', 'setter'], match: starts('/crm') },
      { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
      { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
      { key: 'instagram', label: 'Instagram', href: '/instagram', icon: 'instagram', comingSoon: true, match: starts('/instagram') },
      { key: 'todo', label: 'Plan', href: '/plan', icon: 'todo', rolesWs: ['closer', 'setter'], match: (p) => starts('/plan')(p) || starts('/todo')(p) },
      { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: 'grid', match: starts('/ads-manager') },
    ],
  },
  {
    key: 'analyze',
    label: 'Analyze',
    pregunta: '¿Qué está pasando y por qué?',
    icon: 'analytics',
    items: [
      { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', match: (p) => starts('/dashboard')(p) || starts('/marketing')(p) || starts('/comercial')(p) },
      // Second Brain todavía no existe como ruta propia: vive dentro de
      // Experiments, que es donde están la Retro y las conclusiones. Cuando se
      // separe, entra acá arriba (es el hero de esta familia).
      { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: starts('/experimentos') },
      { key: 'closing', label: 'Closing Analyst', href: '/closing', icon: 'closing', rolesWs: ['closer'], match: starts('/closing') },
      { key: 'script', label: 'Ads Analyst', href: '/ads-analyst', icon: 'notepencil', match: starts('/ads-analyst') },
      { key: 'landing-an', label: 'Landing Analyst', href: '/landing-analyst', icon: 'web', match: starts('/landing-analyst') },
      { key: 'offer', label: 'Offer Analyst', href: '/offer-analyst', icon: 'tag', comingSoon: true, match: starts('/offer-analyst') },
      { key: 'vsl-an', label: 'VSL Analyst', href: '/vsl-analyst', icon: 'video', comingSoon: true, match: starts('/vsl-analyst') },
      { key: 'market-an', label: 'Market Analyst', href: '/market-analyst', icon: 'search', comingSoon: true, match: starts('/market-analyst') },
      { key: 'cs-analyst', label: 'CS Analyst', href: '/cs-analyst', icon: 'cs', comingSoon: true, match: starts('/cs-analyst') },
    ],
  },
  {
    key: 'create',
    label: 'Create',
    pregunta: '¿Qué quiero construir o automatizar?',
    icon: 'tools',
    items: [
      // La key sigue siendo 'setting': es la que está escrita en la base (estado
      // del onboarding de la tab, capas). Lo que cambia es dónde vive y cómo se
      // llama. Está PRIMERO porque es el hero de esta familia: no es un bot de
      // plantillas, es el experto duplicado.
      { key: 'setting', label: 'Chat Agent', href: '/chat-agent', icon: 'tag', rolesWs: ['setter'], match: starts('/chat-agent') },
      { key: 'ads-writer', label: 'Ads Writer', href: '/ads-writer', icon: 'pen', match: starts('/ads-writer') },
      { key: 'landing-writer', label: 'Landing Generator', href: '/landing-writer', icon: 'pen', match: starts('/landing-writer') },
      { key: 'vsl-writer', label: 'VSL Writer', href: '/vsl-writer', icon: 'pen', comingSoon: true, match: starts('/vsl-writer') },
      { key: 'dm-writer', label: 'DM Writer', href: '/dm-writer', icon: 'pen', comingSoon: true, match: starts('/dm-writer') },
    ],
  },
];

/**
 * La zona de MaKo, abajo del todo y fuera de las familias: es una CAPACIDAD
 * GLOBAL, no un módulo más. El documento lo pide explícito — «Pregúntale a MaKo
 * debe entenderse como capacidad global, no solamente como una tab aislada».
 */
export const MAKO_NAV: NavItem[] = [
  { key: 'mako', label: 'Preguntale a MaKo', href: '/mako', icon: 'mako', rolesWs: ['closer', 'setter'], match: starts('/mako') },
  { key: 'mako-doer', label: 'MaKo Doer', href: '/mako-doer', icon: 'mako', rolesWs: ['closer', 'setter'], match: starts('/mako-doer') },
];

// Shell de administración: lo ve un admin que NO está impersonando. Sin tabs de
// marketing — solo gestión de clientes e integraciones. Es un shell aparte a
// propósito: «las rutas administrativas y de producto no deben mezclarse
// visualmente cuando el usuario está operando un negocio».
export const ADMIN_NAV: NavItem[] = [
  // /admin/guiones tiene su propio item — que "Clientes" no se marque también.
  { key: 'admin', label: 'Clientes', href: '/admin', icon: 'admin', match: (p) => starts('/admin')(p) && !starts('/admin/guiones')(p) && !starts('/admin/ui')(p) },
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
  // El catálogo vivo del sistema de diseño (app/_ui). Herramienta de
  // construcción, no producto.
  { key: 'ui', label: 'Sistema de diseño', href: '/admin/ui', icon: 'config', match: starts('/admin/ui') },
  // Portal de formación interna (curso AVATARHYPE) — capa oscura autocontenida.
  { key: 'conocimientos', label: 'Conocimientos', href: '/conocimientos', icon: 'contexto', match: starts('/conocimientos') },
];

/**
 * El menú de la foto de perfil: la quinta familia (ADMIN) del documento, que
 * por decisión de Martín no ocupa un lugar en la barra sino que vive detrás del
 * avatar — «Profile debe reemplazar Admin en la sidebar, la foto y al pasar el
 * cursor el desplegable con las tabs».
 *
 * Funnel, Onboarding y Método viven DENTRO de Configuraciones (sub-tabs), por
 * eso el item Configuraciones también matchea esas rutas.
 */
export const USER_NAV: NavItem[] = [
  { key: 'perfil', label: 'Perfil', href: '/perfil', icon: 'perfil', rolesWs: ['closer', 'setter'], match: starts('/perfil') },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: 'integraciones', match: (p) => starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  { key: 'contexto', label: 'Contexto de MaKo', href: '/contexto', icon: 'contexto', adminOnly: true, match: starts('/contexto') },
  { key: 'onboarding', label: 'Onboarding', href: '/onboarding', icon: 'contexto', match: (p) => starts('/onboarding')(p) || starts('/funnel')(p) },
  { key: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', icon: 'config', match: (p) => starts('/configuraciones')(p) || starts('/metodo')(p) || starts('/equipo')(p) },
  { key: 'admin', label: 'Admin', href: '/admin', icon: 'admin', adminOnly: true, match: starts('/admin') },
];

/** Todos los ítems de producto, aplanados (para buscar por key o por ruta). */
export const TODOS_LOS_ITEMS: NavItem[] = [...FAMILIAS.flatMap((f) => f.items), ...MAKO_NAV];
