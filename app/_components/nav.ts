// =============================================================================
// La navegación, organizada por INTENCIÓN (no por inventario de módulos)
// =============================================================================
// Antes esto era el catálogo de lo que existe: General, CRM, Dashboard,
// Experiments y Plan competían al mismo nivel, con grupos llamados «Analytics»,
// «Tools», «Chats» y «Customer Success» — que describen qué ES cada cosa, no
// para qué la abrís.
//
// Ahora son familias, y cada una responde UNA pregunta (documento
// «Arquitectura de Información + App Shell», MaKo · Fase 1 · v1):
//
//   OPERATE  ¿qué tengo que hacer y ejecutar hoy?
//   ANALYZE  ¿qué está pasando y por qué?
//   CREATE   ¿qué quiero construir o automatizar?
//   (Profile, abajo)  ¿cómo configuro el contexto y la cuenta?
//
// El documento proponía además una familia FOCUS con un solo ítem. Martín la
// sacó: «Hoy» es lo primero de Operate y punto — una familia entera para una
// sola pantalla es una carpeta con un archivo adentro.
//
// Los nombres de familia van en INGLÉS por decisión del documento («cortos y
// comprensibles»); los ítems conservan su nombre.
//
// Dentro de una familia hay dos niveles, y la diferencia importa:
//   · `items`  — lo que se abre TODOS LOS DÍAS. Siempre a la vista.
//   · `grupos` — colecciones que se consultan de a una (los siete Analysts, los
//     tres canales de chat, los writers). Abren un desplegable al costado. Sin
//     esto, Analyze eran nueve filas y la barra se volvía una lista de todo.
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

/** Una colección dentro de una familia. Abre un desplegable al costado. */
export type NavGrupo = { key: string; label: string; icon: string; items: NavItem[] };

/**
 * Un bloque de destinos dentro de una familia. Se separan entre sí con aire y
 * una línea fina, porque adentro de una familia igual hay AGRUPACIONES: en
 * Operate, «lo mío» (General, Plan) no es lo mismo que «la máquina» (CRM, Ads
 * Manager) ni que «las conversaciones». Sin la separación, seis filas seguidas
 * vuelven a ser una lista.
 */
export type NavBloque = NavItem[];

/**
 * Una familia de intención.
 *
 * `notifica` es la regla dura de los contadores: solo la familia que notifica
 * lleva número. En el resto, un badge sería ruido — y si todo tiene badge, nada
 * tiene badge.
 */
export type NavFamilia = {
  key: 'operate' | 'analyze' | 'create' | 'content';
  label: string;
  /** La pregunta que responde. Se muestra como tooltip del rail. */
  pregunta: string;
  icon: string;
  notifica?: boolean;
  /** Los destinos, en bloques separados visualmente. Siempre a la vista. */
  bloques: NavBloque[];
  /** Colecciones que se consultan de a una: abren desplegable al costado. */
  grupos?: NavGrupo[];
};

/** Todos los destinos de una familia, incluidos los de sus colecciones. */
export const itemsDe = (f: NavFamilia): NavItem[] =>
  [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)];

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

export const FAMILIAS: NavFamilia[] = [
  {
    key: 'operate',
    label: 'Operate',
    pregunta: '¿Qué tengo que hacer y ejecutar hoy?',
    // Rayo = ejecutar. Los tres íconos de familia tienen que distinguirse en el
    // rail plegado, donde trabajan solos y sin etiqueta: rayo · gráfico · llave.
    icon: 'rayo',
    notifica: true,
    bloques: [
      // Lo tuyo: dónde estás parado y qué te toca.
      [
        // Cuando exista la pantalla con sus seis campos (prioridad, razón,
        // resultado esperado, responsable, progreso y próxima revisión, tarea
        // #523) este item pasa a ser ella; la key `general` se queda porque está
        // escrita en la base.
        { key: 'general', label: 'General', href: '/general', icon: 'general', match: (p) => starts('/general')(p) || starts('/focus')(p) },
        { key: 'todo', label: 'Plan', href: '/plan', icon: 'todo', rolesWs: ['closer', 'setter'], match: (p) => starts('/plan')(p) || starts('/todo')(p) },
      ],
      // La máquina: lo que trae gente y lo que la mueve.
      [
        { key: 'crm', label: 'CRM', href: '/crm', icon: 'crm', rolesWs: ['closer', 'setter'], match: starts('/crm') },
        { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: 'grid', match: starts('/ads-manager') },
      ],
      // Las conversaciones. Sin desplegable: son tres, y son de todos los días.
      [
        { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
        { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
        { key: 'instagram', label: 'Instagram', href: '/instagram', icon: 'instagram', comingSoon: true, match: starts('/instagram') },
      ],
    ],
  },
  {
    key: 'analyze',
    label: 'Analyze',
    pregunta: '¿Qué está pasando y por qué?',
    icon: 'analytics',
    bloques: [
      [
        // El hero de la familia: «analiza todo tu negocio, conecta las señales y
        // encuentra qué mover». Va primero porque es de donde sale el criterio
        // con el que se leen los otros tres.
        { key: 'second-brain', label: 'Second Brain', href: '/second-brain', icon: 'cerebro', match: starts('/second-brain') },
        { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', match: (p) => starts('/dashboard')(p) || starts('/marketing')(p) || starts('/comercial')(p) },
        // Salió de los Analysts: los otros seis analizan un activo PROPIO (una
        // oferta, un anuncio, una landing); éste vigila lo que hacen los demás.
        { key: 'market-an', label: 'Competitor Spy', href: '/competitor-spy', icon: 'spy', comingSoon: true, match: (p) => starts('/competitor-spy')(p) || starts('/market-analyst')(p) },
        { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: starts('/experimentos') },
      ],
    ],
    grupos: [
      {
        // Ordenados por el CAMINO del negocio, no alfabético ni por antigüedad:
        // primero la oferta, después lo que la trae (anuncio → landing → VSL) y
        // al final lo que pasa con la persona (la llamada, el cliente).
        key: 'analysts', label: 'Analysts', icon: 'search',
        items: [
          { key: 'offer', label: 'Offer Analyst', href: '/offer-analyst', icon: 'tag', comingSoon: true, match: starts('/offer-analyst') },
          { key: 'script', label: 'Ads Analyst', href: '/ads-analyst', icon: 'notepencil', match: starts('/ads-analyst') },
          { key: 'landing-an', label: 'Landing Analyst', href: '/landing-analyst', icon: 'web', match: starts('/landing-analyst') },
          { key: 'vsl-an', label: 'VSL Analyst', href: '/vsl-analyst', icon: 'video', comingSoon: true, match: starts('/vsl-analyst') },
          // Va antes que Closing porque ése es el orden del embudo: primero la
          // conversación que califica, después la llamada que cierra.
          { key: 'chat-analyst', label: 'Chat Analyst', href: '/chat-analyst', icon: 'chats', comingSoon: true, rolesWs: ['setter'], match: starts('/chat-analyst') },
          { key: 'closing', label: 'Closing Analyst', href: '/closing', icon: 'closing', rolesWs: ['closer'], match: starts('/closing') },
          { key: 'cs-analyst', label: 'CS Analyst', href: '/cs-analyst', icon: 'cs', comingSoon: true, match: starts('/cs-analyst') },
        ],
      },
    ],
  },
  {
    // Todo lo que construye la máquina de VENDER, en el orden del embudo: lo que
    // captura · lo que conversa · lo que cierra. Los tres bloques son esas tres
    // etapas, y por eso van separados.
    key: 'create',
    label: 'Sales Machine',
    pregunta: '¿Qué necesito para vender?',
    icon: 'sales',
    bloques: [
      // Capturar: las piezas que traen y convierten al lead.
      [
        // Las keys NO cambiaron (están escritas en la base: capas y estado del
        // onboarding por tab). Lo que cambió es el nombre y la RUTA, para que
        // digan lo mismo. Las rutas viejas redirigen.
        { key: 'landing-writer', label: 'Landing Generator', href: '/landing-generator', icon: 'web', match: (p) => starts('/landing-generator')(p) || starts('/landing-writer')(p) },
        { key: 'vsl-writer', label: 'VSL Generator', href: '/vsl-generator', icon: 'video', comingSoon: true, match: (p) => starts('/vsl-generator')(p) || starts('/vsl-writer')(p) },
        { key: 'lead-magnet-generator', label: 'Lead Magnet Generator', href: '/lead-magnet-generator', icon: 'leadmagnet', comingSoon: true, match: starts('/lead-magnet-generator') },
      ],
      // Conversar: lo que le habla al lead una vez que entró.
      [
        { key: 'setting', label: 'Chatbot', href: '/chatbot', icon: 'chatbot', rolesWs: ['setter'], match: (p) => starts('/chatbot')(p) || starts('/chat-bot')(p) || starts('/chat-agent')(p) },
        { key: 'sales-email', label: 'Sales Email', href: '/sales-email', icon: 'salesemail', comingSoon: true, match: starts('/sales-email') },
        { key: 'newsletters', label: 'Newsletters', href: '/newsletters', icon: 'newsletter', comingSoon: true, match: starts('/newsletters') },
      ],
      // Cerrar: lo que usa la persona que atiende la llamada.
      [
        { key: 'closing-script', label: 'Closing Script', href: '/closing-script', icon: 'closingscript', comingSoon: true, rolesWs: ['closer'], match: starts('/closing-script') },
        { key: 'sales-roleplay', label: 'Sales Roleplay', href: '/sales-roleplay', icon: 'roleplay', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/sales-roleplay') },
      ],
    ],
  },
  {
    // La fábrica de piezas. Es familia propia y no un item de Create porque no
    // es UNA herramienta: es un taller con secciones por canal, y cada canal
    // tiene sus formatos. Metida adentro de Create habría sido una fila con
    // ocho cosas colgando.
    key: 'content',
    label: 'Content Machine',
    pregunta: '¿Qué pieza necesito hacer?',
    icon: 'creativos',
    bloques: [
      // Antes de la pieza está de qué hablar. Por eso Ideas va suelto arriba y
      // no adentro de un canal: no es de Meta ni de Instagram ni de YouTube.
      [{ key: 'ideas', label: 'Ideas', href: '/ideas', icon: 'idea', comingSoon: true, match: starts('/ideas') }],
    ],
    grupos: [
      {
        // ⚠️ «Ads Writer» sigue apuntando a /ads-writer: ese módulo se está
        // reescribiendo AHORA en otra sesión y su propio código ya declara
        // /content-machine como destino. Cuando aterrice, esto es cambiar el href.
        key: 'ads', label: 'Ads', icon: 'meta',
        items: [
          { key: 'ads-writer', label: 'Ads Writer', href: '/ads-writer', icon: 'escribir', match: (p) => starts('/ads-writer')(p) || starts('/content-machine')(p) },
          { key: 'image-generator', label: 'Image Generator', href: '/image-generator', icon: 'imagegen', comingSoon: true, match: starts('/image-generator') },
          { key: 'video-generator', label: 'Video Generator', href: '/video-generator', icon: 'videogen', comingSoon: true, match: starts('/video-generator') },
        ],
      },
      {
        key: 'ig-formatos', label: 'Instagram', icon: 'instagram',
        items: [
          { key: 'reels', label: 'Reels', href: '/reels', icon: 'videogen', comingSoon: true, match: starts('/reels') },
          { key: 'carousels', label: 'Carousels', href: '/carousels', icon: 'carousel', comingSoon: true, match: starts('/carousels') },
          { key: 'stories', label: 'Stories', href: '/stories', icon: 'stories', comingSoon: true, match: starts('/stories') },
        ],
      },
      {
        key: 'yt-formatos', label: 'YouTube', icon: 'youtube',
        items: [
          { key: 'youtube-writer', label: 'YouTube Writer', href: '/youtube-writer', icon: 'escribir', comingSoon: true, match: starts('/youtube-writer') },
          { key: 'thumbnails', label: 'Thumbnails', href: '/thumbnails', icon: 'thumbnail', comingSoon: true, match: starts('/thumbnails') },
        ],
      },
    ],
  },
];

/**
 * MaKo, abajo del todo y fuera de las familias: es una CAPACIDAD GLOBAL, no un
 * módulo más. El documento lo pide explícito — «Pregúntale a MaKo debe
 * entenderse como capacidad global, no solamente como una tab aislada».
 *
 * Es UNA sola entrada. /mako-doer existe como ruta pero salió de la barra:
 * monta el MISMO MakoChat contra otro endpoint, así que para el usuario eran
 * dos tabs que hacen lo mismo.
 */
export const MAKO_NAV: NavItem[] = [
  { key: 'mako', label: 'Preguntale a MaKo', href: '/mako', icon: 'mako', rolesWs: ['closer', 'setter'], match: (p) => starts('/mako')(p) || starts('/mako-doer')(p) },
];

// Shell de administración: lo ve un admin que NO está impersonando. Sin tabs de
// marketing — solo gestión de clientes e integraciones. Es un shell aparte a
// propósito: «las rutas administrativas y de producto no deben mezclarse
// visualmente cuando el usuario está operando un negocio».
/**
 * El shell de administración, en dos secciones.
 *
 * «Dev» son los REGISTROS de construcción: por cada área del producto, qué se
 * decidió, qué se rompió y qué falta. El de UX/UI es el que ya existe y sirve de
 * molde; los otros nacen vacíos a propósito y se llenan igual que aquél, a
 * medida que se trabaja cada tab. Es lo que hace que cambiar, mejorar o
 * debuguear una tab no arranque de cero cada vez.
 */
export const ADMIN_SECCIONES: { titulo: string; items: NavItem[] }[] = [
  { titulo: 'Administración', items: [
  // /admin/guiones tiene su propio item — que "Clientes" no se marque también.
  { key: 'admin', label: 'Clientes', href: '/admin', icon: 'admin', match: (p) => starts('/admin')(p) && !starts('/admin/guiones')(p) && !starts('/admin/ui')(p) && !starts('/admin/docs')(p) && !starts('/admin/dev')(p) },
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
  ] },

  { titulo: 'Dev', items: [
    // AGENTS.md + docs/*.md renderizados desde el REPO, no copiados: la fuente
    // única sigue siendo el archivo.
    { key: 'docs', label: 'Documentación', href: '/admin/docs', icon: 'contexto', match: starts('/admin/docs') },
    // El catálogo vivo de app/_ui Y el registro del rediseño, en una sola tab
    // con sub-tabs. OJO: la key sigue siendo 'ui' aunque el label cambió a
    // «MaKo UX/UI» — las keys de nav.ts son contrato con la base.
    { key: 'ui', label: 'MaKo UX/UI', href: '/admin/ui', icon: 'config', match: (p) => starts('/admin/ui')(p) || starts('/admin/rediseno')(p) },
    { key: 'dev-onboarding', label: 'Onboarding', href: '/admin/dev/onboarding', icon: 'config', match: starts('/admin/dev/onboarding') },
    { key: 'dev-general', label: 'General', href: '/admin/dev/general', icon: 'config', match: starts('/admin/dev/general') },
    { key: 'dev-chatbot', label: 'Chatbot', href: '/admin/dev/chatbot', icon: 'config', match: starts('/admin/dev/chatbot') },
    { key: 'dev-ads-generator', label: 'Ads Generator', href: '/admin/dev/ads-generator', icon: 'config', match: starts('/admin/dev/ads-generator') },
  ] },
];

/** Plano, para el título de la pestaña y cualquier búsqueda por key. */
export const ADMIN_NAV: NavItem[] = ADMIN_SECCIONES.flatMap((s) => s.items);

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
  // Reportar un problema vive acá y no en la barra: no es un destino de trabajo,
  // es a dónde vas cuando algo se rompió. Al lado de las tabs competiría todo el
  // día con lo que sí estás haciendo; en el menú del perfil está donde todo el
  // mundo lo busca, junto a la cuenta y arriba de «Cerrar sesión».
  { key: 'tickets', label: 'Reportar problema', href: '/tickets', icon: 'soporte', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/tickets') },
];

/** Todos los ítems de producto, aplanados (para buscar por key o por ruta). */
export const TODOS_LOS_ITEMS: NavItem[] = [...FAMILIAS.flatMap(itemsDe), ...MAKO_NAV];
