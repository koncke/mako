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
//   · `grupos` — colecciones que se consultan de a una (los Analysts, los
//     tres canales de chat, los writers). Abren un desplegable al costado. Sin
//     esto, Analyze eran nueve filas y la barra se volvía una lista de todo.
//
// Dos parejas que conviene no confundir, porque son la razón del reparto:
//   · Ads Manager (Operate) EJECUTA · Ads Analyst (Analyze) COMPRENDE.
//   · Automations (Create) se configura y se entrena · WhatsApp/Email (Operate)
//     es la conversación de todos los días.
//
// ⚠️ Las `key` son contrato: `tabEnCapa()` (lib/capas.ts) y el estado del
// onboarding por tab las tienen escritas en la base. Cambiar una key apaga la
// tab en los clientes que la contrataron. Se puede mover de familia y cambiar
// el `label`; la key no.

import type { RolWorkspace } from '@/lib/auth-session';
import { RUTA_AUTOMATIONS, RUTAS_VIEJAS_AUTOMATIONS } from '@/lib/ruta-automations';

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
  // `admin` y `dev` existen SOLO en el shell de super admin, y son familias de
  // pleno derecho —no una lista aparte— justamente para que se vean y se
  // comporten igual que las demás. Antes eran otra estructura y por eso la barra
  // de admin no tenía desplegables: no era el mismo componente.
  //
  // La key de una FAMILIA no es contrato con la base —solo identifica el plegado
  // y el flyout— así que es `string`. La advertencia de arriba es sobre las keys
  // de ÍTEM, que `tabEnCapa()` sí tiene escritas. Las seis de la barra real son
  // 'operate' | 'analyze' | 'create' | 'content' | 'admin' | 'dev'; el mapa de
  // /admin/dev arma las suyas para previsualizar una barra que todavía no existe.
  key: string;
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
      // Las conversaciones. Sin desplegable: son dos, y son de todos los días.
      // Instagram salió el 06/10/2026 (decisión de Martín: 0 DMs en su historia):
      // /instagram redirige a /automations y tests/sin-instagram.test.ts cuida que no vuelva.
      [
        { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
        { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
      ],
    ],
    grupos: [
      {
        // Después de la venta. Va en Operate y no en Analyze porque contesta «¿qué
        // tengo que hacer hoy con mis clientes?», no «¿qué pasó?».
        //
        // ⚠️ VOLVIÓ A SER UN DESPLEGABLE DE DOS (06/10/2026). Del 26/09 al 06/10 fue una
        // fila sola: el segundo destino era `/customer-success/programa`, el temario de 44
        // clases de Mauricio escrito en código, y se borró al rearmar la tab para cualquier
        // workspace. Volvió el curso —ahora en la base, colgado de las etapas de entrega de
        // cada producto (mig 0202)— y con dos destinos que se consultan de a uno (la
        // cartera es lo de todos los días, el curso se toca cuando se arma) el criterio de
        // `NavGrupo` vuelve a pedir el desplegable.
        //
        // La key del GRUPO no es contrato (sólo identifica el desplegable); la de los
        // ítems sí, y por eso el grupo NO se llama `customer-success`: ese nombre es de la
        // fila de Clientes y dos cosas con la misma key en la barra son dos cosas que se
        // pisan en cualquier mapa por key.
        key: 'cs-grupo', label: 'Customer Success', icon: 'cs',
        items: [
          // ⚠️ LA KEY ES `customer-success`, que es la que pide el guard de las dos páginas
          // (`requireCapa('customer-success')` → `tabEnCapa`) y la que nombran las capas en
          // lib/capas.ts. Cambiarla acá deja a la barra preguntando por otra cosa que la
          // página: la fila se esconde donde la página abre, o al revés.
          //
          // Y el `match` es IGUALDAD, no `starts`: con `starts` se encendería también
          // estando en /customer-success/curso, y la barra marcaría dos destinos a la vez.
          { key: 'customer-success', label: 'Clientes', href: '/customer-success', icon: 'users', match: (p) => p === '/customer-success' },
          // El curso: las clases de cada producto y el avance de cada cliente. Su página pide
          // `customer-success` (no tiene capa propia); que este destino se VEA en cada capa
          // donde esa página deja entrar lo persigue tests/curso-admin.test.ts.
          { key: 'cs-curso', label: 'Curso', href: '/customer-success/curso', icon: 'video', match: starts('/customer-success/curso') },
          // La comunidad tipo Skool de cada producto (07/10/2026, D8 de docs/diseno-curso-skool.md).
          // Como el curso, su página pide `customer-success` (no tiene capa propia), y que el destino
          // se VEA en cada capa donde esa página deja entrar lo persigue tests/comunidad-nav.test.ts.
          { key: 'cs-comunidad', label: 'Comunidad', href: '/customer-success/comunidad', icon: 'comunidad', match: starts('/customer-success/comunidad') },
        ],
      },
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
        // OFFER va SUELTA, en el lugar que dejó Análisis, y no adentro de los Analysts. Desde el
        // 11/10/2026 une Offer Analyst y Offer Generator en UNA tab (pedido de Martín: «todo en
        // una misma tab que se llame "Offer"»): es un chat que diagnostica la oferta Y ADEMÁS la
        // ESCRIBE de nuevo (con su PDF), así que ya no es «un analista más» — y la oferta es
        // anterior a todo lo demás que se analiza (el anuncio, la landing y la llamada venden
        // ESA oferta). Ocupar el hueco de Análisis hace que la barra no crezca: «La sidebar se
        // puede scrollear, eso NO debe ser posible NUNCA» (AGENTS.md).
        //
        // ⚠️ La key 'offer' es la de siempre (contrato con la base: capas y onboarding). El
        // match acepta /offer-analyst porque esa ruta vieja redirige acá y sigue escrita en
        // links que ya salieron.
        { key: 'offer', label: 'Offer', href: '/offer', icon: 'tag', match: (p) => starts('/offer')(p) || starts('/offer-analyst')(p) },
        // Análisis ya no es un ítem: el 11/10/2026 se mudó ADENTRO de Experiments, como su cuarta
        // tab (/experimentos?tab=analisis). /analisis redirige ahí con su query, y
        // /analisis/trimestre —el informe congelado, que se mandó por WhatsApp— vive donde
        // estaba: por eso el match de Experiments acepta las dos rutas, para que la barra marque
        // la tab y el título de la pestaña no caiga a «MaKo - Analisis» sin tilde.
        { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', match: (p) => starts('/dashboard')(p) || starts('/marketing')(p) || starts('/comercial')(p) || starts('/graficos')(p) },
        // Salió de los Analysts: los demás analizan un activo PROPIO (un anuncio,
        // una landing, una llamada); éste vigila lo que hacen los demás.
        { key: 'market-an', label: 'Competitor Spy', href: '/competitor-spy', icon: 'spy', comingSoon: true, match: (p) => starts('/competitor-spy')(p) || starts('/market-analyst')(p) },
        { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: (p) => starts('/experimentos')(p) || starts('/analisis')(p) },
      ],
    ],
    grupos: [
      {
        // Ordenados por el CAMINO del negocio, no alfabético ni por antigüedad:
        // primero lo que trae a la gente (anuncio → landing → VSL) y al final lo
        // que pasa con la persona (la conversación, la llamada, el cliente). La
        // oferta, que iba primera, salió el 11/10/2026 a su propia tab suelta
        // («Offer», arriba): ya no sólo analiza, también la escribe.
        key: 'analysts', label: 'Analysts', icon: 'search',
        items: [
          { key: 'script', label: 'Ads Analyst', href: '/ads-analyst', icon: 'notepencil', match: starts('/ads-analyst') },
          { key: 'landing-an', label: 'Landing Analyst', href: '/landing-analyst', icon: 'web', match: starts('/landing-analyst') },
          { key: 'vsl-an', label: 'VSL Analyst', href: '/vsl-analyst', icon: 'video', comingSoon: true, match: starts('/vsl-analyst') },
          // Va antes que Closing porque ése es el orden del embudo: primero la
          // conversación que califica, después la llamada que cierra.
          { key: 'chat-analyst', label: 'Chat Analyst', href: '/chat-analyst', icon: 'chats', comingSoon: true, rolesWs: ['setter'], match: starts('/chat-analyst') },
          { key: 'closing', label: 'Closing Analyst', href: '/closing', icon: 'closing', rolesWs: ['closer'], match: starts('/closing') },
          { key: 'cs-analyst', label: 'CS Analyst', href: '/cs-analyst', icon: 'cs', comingSoon: true, match: starts('/cs-analyst') },
          // Productivity Analyst SALIÓ de acá el 11/10/2026 (Martín: «elimina las tabs que ya hayas
          // puesto como template de la sidebar»): es todo análisis y vive entera en la plantilla
          // «Productividad» del Dashboard. Su ruta redirige (app/productivity-analyst/page.tsx). Ads,
          // Landing y Closing siguen acá hasta que sus TAREAS se muden a otras tabs.
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
        // «Automations» desde el 09/10/2026 (Martín: «Cambia el nombre de la tab "Chatbot" por
        // "Automations", el nombre en la sidebar, la ruta, todo»). La KEY sigue siendo `setting`
        // y el ícono `chatbot`: están escritos en la base (capas, roles, onboarding.tab.setting).
        // Las URLs viejas (/chatbot, /chat-bot, /chat-agent) redirigen y siguen marcando la tab:
        // salen de UNA lista, la misma que cuida tests/ruta-automations.test.ts.
        { key: 'setting', label: 'Automations', href: RUTA_AUTOMATIONS, icon: 'chatbot', rolesWs: ['setter'], match: (p) => starts(RUTA_AUTOMATIONS)(p) || RUTAS_VIEJAS_AUTOMATIONS.some((r) => starts(r)(p)) },
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
          { key: 'video-generator', label: 'Video Generator', href: '/video-generator', icon: 'videogen', match: starts('/video-generator') },
        ],
      },
      {
        key: 'ig-formatos', label: 'Instagram', icon: 'instagram',
        items: [
          { key: 'reels', label: 'Reels', href: '/reels', icon: 'videogen', match: starts('/reels') },
          { key: 'carousels', label: 'Carousels', href: '/carousels', icon: 'carousel', match: starts('/carousels') },
          { key: 'stories', label: 'Stories', href: '/stories', icon: 'stories', match: starts('/stories') },
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
  { key: 'mako', label: 'Pregúntale a MaKo', href: '/mako', icon: 'mako', rolesWs: ['closer', 'setter'], match: (p) => starts('/mako')(p) || starts('/mako-doer')(p) },
];

/**
 * Las DOS familias que solo existen en el shell de super admin.
 *
 * ⚠️ Antes esto era `ADMIN_SECCIONES`, otra estructura (`{titulo, items}`) que el
 * Sidebar pintaba con su propio bloque de JSX: un rótulo estático y una lista
 * plana. De ahí salía la queja: la barra de admin no se parecía a la de un
 * workspace y las secciones no se desplegaban — no era que estuviera mal
 * estilada, es que **no era el mismo componente**. Ahora son `NavFamilia` como
 * cualquier otra y las pinta `<Familia>`, así que heredan gratis el desplegable,
 * el chevron, la caja, el rail plegado y cualquier cosa que se le agregue después.
 *
 * Y el super admin ve ADEMÁS las cuatro familias de producto (`FAMILIAS`): vamos
 * a vender MaKo usándolo. Eso funciona sin impersonar porque un admin cae en su
 * propio workspace (lib/workspace.ts, `resolverDesdeCookies`); si el usuario
 * admin no tiene workspace asignado, esas tabs responden 403 y hay que entrar
 * como un cliente.
 */
export const ADMIN_FAMILIAS: NavFamilia[] = [
  {
    key: 'admin',
    label: 'Admin',
    pregunta: '¿Cómo está la agencia y sus clientes?',
    icon: 'admin',
    bloques: [
      [
        // ⛔ ACA VIVIA «Clientes» apuntando a /admin, y se fue el 28/09/2026: esa
        // pantalla ahora ES la tab Customer Success. Dos items sobre la misma ruta se
        // prenden LOS DOS y el segundo nunca es el destino activo — el propio repo lo
        // pago con «Mensajes de MaKo», que tuvo que salir de /agencia?tab= por esto.
        // El cerebro de redacción de MaKo. Era la tercera sub-tab de /admin y se fue a
        // su ruta el 27/09 («ponlo como otra tab en la sección de admin en la sidebar»).
        // Ruta propia y no `?tab=`: el match de un item ve SOLO el pathname, así que dos
        // items sobre /admin se prenderían los dos — es el mismo motivo por el que
        // «Mensajes de MaKo» tuvo que salir de /agencia?tab=plantillas.
        { key: 'copywriting', label: 'Copywriting', href: '/admin/copywriting', icon: 'escribir', match: starts('/admin/copywriting') },
        // Canal propio de MaKo: WhatsApp del admin (canal + grupos + plantillas).
        // NO es preview de ningún cliente. Su propia línea por QR. Por eso NO es
        // el /whatsapp de Operate y sigue viviendo acá.
        { key: 'agencia', label: 'WhatsApp de MaKo', href: '/agencia', icon: 'whatsapp', match: starts('/agencia') },
        // Los ~48 mensajes que MaKo le puede mandar al dueño: se ven como llegan,
        // se editan y se prenden/apagan. Vivía adentro de /agencia como una tab
        // (`?tab=plantillas`) y por eso no se podía nombrar acá: el `match` de un
        // item ve SOLO el pathname, así que dos items sobre /agencia se prenden
        // los dos y el segundo nunca es el destino activo. Por eso tiene ruta
        // propia. «Plantillas» a secas no pasa el test de entenderse solo —
        // también se llaman así las de Meta—, así que va con su objeto.
        { key: 'mensajes', label: 'Mensajes de MaKo', href: '/mensajes', icon: 'mako', match: starts('/mensajes') },
        // Dev es un MODO, no una carpeta: este link te lleva y allá la barra se
        // reemplaza entera por la de desarrollo (ver Sidebar → familiasDev). Por
        // eso es una fila y no un desplegable — un desplegable te deja mirando
        // 122 áreas desde afuera; el modo te mete adentro.
        { key: 'dev-entrar', label: 'Dev', href: '/admin/dev', icon: 'config', match: starts('/admin/dev') },
        // En qué trabaja cada cliente en SU Claude Code. Va en este bloque y no en el
        // del cerebro de MaKo porque es información de CLIENTES, no configuración de
        // la IA: se lee al lado de «Clientes», que es la pregunta que contesta.
        { key: 'admin-agente', label: 'Agente de los clientes', href: '/admin/agente', icon: 'mako', match: starts('/admin/agente') },
        // La estrategia de MaKo en UNA pantalla (10/10/2026, pedido de Martín: «tenemos
        // runway, tenemos una de análisis de costos, y mucha info desparramada»): la
        // oferta, a dónde va cada dólar, el CAC, la adquisición, la proyección y los
        // referidos. Sólo super admin: vive bajo /admin y abre con getSesionAdmin. La key
        // NO lleva el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros).
        { key: 'admin-estrategia', label: 'Strategy', href: '/admin/estrategia', icon: 'analytics', match: starts('/admin/estrategia') },
      ],
      // El cerebro de MaKo y la formación: con qué sabe, con qué piensa, y de
      // dónde se entrena el equipo. «Contexto de MaKo» estaba detrás del avatar
      // y no es configuración de tu cuenta: es lo que la agencia le carga a la
      // IA, así que pertenece acá.
      [
        { key: 'contexto', label: 'Contexto de MaKo', href: '/contexto', icon: 'contexto', match: starts('/contexto') },
        { key: 'modelos-ia', label: 'Modelos IA', href: '/modelos-ia', icon: 'mako', match: starts('/modelos-ia') },
        // Portal de formación interna (curso AVATARHYPE) — capa oscura autocontenida.
        { key: 'conocimientos', label: 'Conocimientos', href: '/conocimientos', icon: 'contexto', match: starts('/conocimientos') },
      ],
    ],
  },

  /**
   * «Dev» son las herramientas de construcción y los REGISTROS por área: qué se
   * decidió en cada tab, qué se rompió y qué falta. Es lo que hace que cambiar o
   * debuguear una tab no arranque de cero cada vez.
   */
  {
    key: 'dev',
    label: 'Dev',
    pregunta: '¿Qué se decidió y qué falta en cada tab?',
    icon: 'config',
    bloques: [
      // Las herramientas: miran TODO el repo, no un área.
      [
        { key: 'grafo', label: 'Grafo', href: '/api/admin/graph', icon: 'graphics', newTab: true, match: () => false },
        // AGENTS.md + docs/*.md renderizados desde el REPO, no copiados: la
        // fuente única sigue siendo el archivo.
        { key: 'docs', label: 'Documentación', href: '/admin/docs', icon: 'contexto', match: starts('/admin/docs') },
        // El catálogo vivo de app/_ui Y el registro del rediseño, con sub-tabs.
        // OJO: la key sigue siendo 'ui' aunque el label cambió — las keys de
        // nav.ts son contrato con la base.
        { key: 'ui', label: 'MaKo UX/UI', href: '/admin/ui', icon: 'config', match: (p) => starts('/admin/ui')(p) || starts('/admin/rediseno')(p) },
      ],
      // El MAPA de las 122 áreas. Va suelto y no adentro de «Registros» porque es
      // la PUERTA: las que tienen registro escrito entran en la colección de
      // abajo, y las otras ~113 solo se alcanzan desde acá.
      [
        { key: 'dev-areas', label: 'Áreas del producto', href: '/admin/dev', icon: 'graphics', match: (p) => p === '/admin/dev' },
      ],
    ],
    // ⚠️ LOS REGISTROS VAN EN UNA COLECCIÓN, NO EN FILAS SUELTAS, y el motivo es
    // una regla del dueño que ya estaba escrita desde el 1/7: «La sidebar se
    // puede scrollear, eso NO debe ser posible NUNCA» (docs/hallazgos-ui.md).
    // Con una fila por registro, Dev llegó a TRECE y la columna desbordó — se
    // agregaron tres en 24 horas y va a seguir creciendo con cada área nueva.
    // Una colección cuesta UNA fila y abre al costado, igual que «Analysts», que
    // esconde siete destinos por exactamente la misma razón (ver el comentario
    // del tipo NavFamilia arriba: «sin esto, Analyze eran nueve filas y la barra
    // se volvía una lista de todo»).
    //
    // Esto NO es esconder destinos: la fila lleva rótulo, ícono y chevron, y
    // abre por hover y por click. Lo que la regla de la casa prohíbe es esconder
    // SIN pista — el caso de las tabs de la ficha del lead.
    //
    // ⚠️ ESTA LISTA Y `registros.ts` TIENEN QUE COINCIDIR, y no se puede derivar
    // una de la otra: `registros.ts` importa las nueve bitácoras enteras (~1.700
    // líneas de prosa) y `nav.ts` lo consume el Sidebar, que es cliente — meterlas
    // al bundle de cada página para armar nueve links no vale la pena.
    // La coincidencia la fija `tests/dev-areas.test.ts`: un área con bitácora y sin
    // fila acá no es un error visible, es una tab que existe y NO SE VE. Pasó con
    // `pricing`, que estuvo días con registro y sin entrada, y se descubrió recién
    // cuando el dueño dijo «no veo la tab en la sidebar» de otra. El test sigue
    // valiendo dentro del grupo: `itemsDe()` incluye los items de las colecciones.
    grupos: [
      {
        key: 'dev-registros', label: 'Registros', icon: 'config',
        items: [
          // Va primero porque es el shell donde vive todo lo demás.
          { key: 'dev-admin', label: 'Admin', href: '/admin/dev/admin', icon: 'admin', match: starts('/admin/dev/admin') },
          { key: 'dev-onboarding', label: 'Onboarding', href: '/admin/dev/onboarding', icon: 'config', match: starts('/admin/dev/onboarding') },
          { key: 'dev-general', label: 'General', href: '/admin/dev/general', icon: 'config', match: starts('/admin/dev/general') },
          { key: 'dev-dashboard', label: 'Dashboard', href: '/admin/dev/dashboard', icon: 'graphics', match: starts('/admin/dev/dashboard') },
          // El área se llama como la tab (Automations, desde el 09/10/2026); la key y la ruta
          // /admin/dev/chatbot siguen: son el slug del registro y su historia.
          { key: 'dev-chatbot', label: 'Automations', href: '/admin/dev/chatbot', icon: 'config', match: starts('/admin/dev/chatbot') },
          // Se llama como la FEATURE (/ads-writer), no «Ads Generator» ni
          // «Guiones»: adentro viven su roadmap, su historial y las dos
          // bibliotecas globales (Ángulos y Estructuras) que antes colgaban
          // sueltas de /admin/guiones con un nombre que no se entendía.
          { key: 'dev-ads-writer', label: 'Ads Writer', href: '/admin/dev/ads-writer', icon: 'escribir', match: (p) => starts('/admin/dev/ads-writer')(p) || starts('/admin/dev/ads-generator')(p) || starts('/admin/guiones')(p) },
          { key: 'dev-ads-manager', label: 'Ads Manager', href: '/admin/dev/ads-manager', icon: 'grid', match: starts('/admin/dev/ads-manager') },
          { key: 'dev-semaforo', label: 'El semáforo', href: '/admin/dev/semaforo', icon: 'graphics', match: starts('/admin/dev/semaforo') },
          { key: 'dev-products-offers', label: 'Products & Offers', href: '/admin/dev/products-offers', icon: 'crm', match: starts('/admin/dev/products-offers') },
          { key: 'dev-pricing', label: 'Pricing', href: '/admin/dev/pricing', icon: 'tag', match: starts('/admin/dev/pricing') },
          // Va pegada a Pricing y no es lo mismo: aquélla decide QUÉ SE COBRA,
          // ésta es el INSTRUMENTO que mide lo que se gastó (y si el número es
          // cierto). Las dos leen la misma tabla, y confundirlas ya costó una
          // premisa de pricing entera («el 99,9% del gasto es del ws1»).
          { key: 'dev-ai-spend-cuotas', label: 'AI Spend & Cuotas', href: '/admin/dev/ai-spend-cuotas', icon: 'tag', match: starts('/admin/dev/ai-spend-cuotas') },
          // Se llamaba «cs-analyst» y era la mitad del asunto: el analista de riesgo
          // es UNA pieza de Customer Success. La ruta vieja redirige (ver
          // app/admin/dev/[area]/page.tsx), así que sigue matcheando.
          { key: 'dev-customer-success', label: 'Customer Success', href: '/admin/dev/customer-success', icon: 'cs', match: (p) => starts('/admin/dev/customer-success')(p) || starts('/admin/dev/cs-analyst')(p) },
          { key: 'dev-build-deploy', label: 'Build & Deploy', href: '/admin/dev/build-deploy', icon: 'rayo', match: starts('/admin/dev/build-deploy') },
          // Va pegada a Build & Deploy y es su otra punta: aquélla es cómo llega
          // el código a producción, ésta es la máquina donde se escribe — el clon
          // compartido por dos cuentas, el dev server, y lo que los agentes leen.
          { key: 'dev-local-dev-environment', label: 'Local Dev Environment', href: '/admin/dev/local-dev-environment', icon: 'config', match: starts('/admin/dev/local-dev-environment') },
          // La tercera punta de la misma familia: qué red hay entre lo que se
          // escribe acá y lo que llega allá. Hoy esa red es un hook que vive en
          // .git y que un reclon se lleva en silencio.
          { key: 'dev-tests-qa', label: 'Tests & QA', href: '/admin/dev/tests-qa', icon: 'check', match: starts('/admin/dev/tests-qa') },
          { key: 'dev-ai-runtime-cascada', label: "AI Runtime & Cascada", href: '/admin/dev/ai-runtime-cascada', icon: 'config', match: starts('/admin/dev/ai-runtime-cascada') },
          { key: 'dev-carousels', label: "Carousels", href: '/admin/dev/carousels', icon: 'config', match: starts('/admin/dev/carousels') },
          { key: 'dev-configuraciones', label: 'Configuraciones', href: '/admin/dev/configuraciones', icon: 'config', match: starts('/admin/dev/configuraciones') },
          { key: 'dev-conocimientos', label: "Conocimientos", href: '/admin/dev/conocimientos', icon: 'config', match: starts('/admin/dev/conocimientos') },
          { key: 'dev-crm', label: "CRM", href: '/admin/dev/crm', icon: 'config', match: starts('/admin/dev/crm') },
          { key: 'dev-gtm-oferta-y-precios', label: "GTM: Oferta y precios", href: '/admin/dev/gtm-oferta-y-precios', icon: 'config', match: starts('/admin/dev/gtm-oferta-y-precios') },
          { key: 'dev-instagram', label: "Instagram", href: '/admin/dev/instagram', icon: 'config', match: starts('/admin/dev/instagram') },
          { key: 'dev-integraciones', label: "Integraciones", href: '/admin/dev/integraciones', icon: 'config', match: starts('/admin/dev/integraciones') },
          { key: 'dev-mako-doer', label: "MaKo Doer", href: '/admin/dev/mako-doer', icon: 'config', match: starts('/admin/dev/mako-doer') },
          { key: 'dev-meta-platform', label: 'Meta Platform', href: '/admin/dev/meta-platform', icon: 'config', match: starts('/admin/dev/meta-platform') },
          { key: 'dev-plan', label: 'Plan', href: '/admin/dev/plan', icon: 'todo', match: starts('/admin/dev/plan') },
          { key: 'dev-plans-entitlements', label: "Plans & Entitlements", href: '/admin/dev/plans-entitlements', icon: 'config', match: starts('/admin/dev/plans-entitlements') },
          { key: 'dev-rate-limiting', label: "Rate Limiting", href: '/admin/dev/rate-limiting', icon: 'config', match: starts('/admin/dev/rate-limiting') },
          { key: 'dev-reels', label: "Reels", href: '/admin/dev/reels', icon: 'config', match: starts('/admin/dev/reels') },
          { key: 'dev-self-healing-dev-agent', label: "Self-Healing Dev Agent", href: '/admin/dev/self-healing-dev-agent', icon: 'config', match: starts('/admin/dev/self-healing-dev-agent') },
          { key: 'dev-second-brain', label: 'Second Brain', href: '/admin/dev/second-brain', icon: 'cerebro', match: starts('/admin/dev/second-brain') },
          { key: 'dev-vsl-tracking', label: 'VSL Tracking', href: '/admin/dev/vsl-tracking', icon: 'graphics', match: starts('/admin/dev/vsl-tracking') },
          { key: 'dev-whatsapp-de-mako', label: 'WhatsApp de MaKo', href: '/admin/dev/whatsapp-de-mako', icon: 'config', match: starts('/admin/dev/whatsapp-de-mako') },
          { key: 'dev-webhook-gateway', label: 'Webhook Gateway', href: '/admin/dev/webhook-gateway', icon: 'config', match: starts('/admin/dev/webhook-gateway') },
          { key: 'dev-api-mako', label: 'API de MaKo', href: '/admin/dev/api-mako', icon: 'api', match: starts('/admin/dev/api-mako') },
          // Las dos capas del sistema visual, y van juntas y en este orden:
          // Design System son los tokens y la paleta (la capa de abajo), MaKo
          // UX/UI es el catálogo que los muestra montados (/admin/ui).
          { key: 'dev-design-system', label: 'Design System', href: '/admin/dev/design-system', icon: 'graphics', match: starts('/admin/dev/design-system') },
          { key: 'dev-mako-ux-ui', label: 'MaKo UX/UI', href: '/admin/dev/mako-ux-ui', icon: 'graphics', match: starts('/admin/dev/mako-ux-ui') },
          { key: 'dev-mako-mobile', label: 'MaKo Mobile', href: '/admin/dev/mako-mobile', icon: 'mako', match: starts('/admin/dev/mako-mobile') },
          // Va pegada a VSL Tracking porque son las dos puntas del mismo bucle:
          // aquélla MIDE dónde se cae la curva, ésta escribe el guion que se
          // reescribe con ese dato. Hoy la pantalla es un ComingSoon; el registro
          // existe igual, que es justamente para no volver a arrancar de cero.
          { key: 'dev-vsl-generator', label: 'VSL Generator', href: '/admin/dev/vsl-generator', icon: 'video', match: starts('/admin/dev/vsl-generator') },
          { key: 'dev-credentials-vault-byok', label: 'Credentials Vault (BYOK)', href: '/admin/dev/credentials-vault-byok', icon: 'config', match: starts('/admin/dev/credentials-vault-byok') },
          // Los dos formatos de Content Machine con registro escrito. Stories ya
          // está construida; Thumbnails sigue siendo un ComingSoon y su registro
          // existe justamente por eso: sin código propio, el Change History
          // automático solo muestra commits de nav.ts que no son del área.
          { key: 'dev-stories', label: 'Stories', href: '/admin/dev/stories', icon: 'instagram', match: starts('/admin/dev/stories') },
          { key: 'dev-thumbnails', label: 'Thumbnails', href: '/admin/dev/thumbnails', icon: 'youtube', match: starts('/admin/dev/thumbnails') },
          // Las tres de Sales Machine que todavía son ComingSoon. Sus registros
          // existen porque el trabajo del área SÍ pasó, en otro archivo: el lead
          // magnet se define en el paso «Entregable» del onboarding, y el email de
          // venta y el envío a la lista ya viven en /email. Sin la fila, el único
          // lugar donde eso está escrito no se alcanza desde ningún lado.
          { key: 'dev-lead-magnet-generator', label: 'Lead Magnet Generator', href: '/admin/dev/lead-magnet-generator', icon: 'leadmagnet', match: starts('/admin/dev/lead-magnet-generator') },
          { key: 'dev-sales-email', label: 'Sales Email', href: '/admin/dev/sales-email', icon: 'salesemail', match: starts('/admin/dev/sales-email') },
          { key: 'dev-newsletters', label: 'Newsletters', href: '/admin/dev/newsletters', icon: 'newsletter', match: starts('/admin/dev/newsletters') },
          // Las otras dos que todavía son ComingSoon y ya tienen registro escrito.
          // Mismo motivo que Thumbnails: su historia son DECISIONES —el lugar en el
          // embudo, el precio ya medido, las preguntas sin contestar— y ninguna vive
          // en el código, así que el Change History automático no la encuentra.
          { key: 'dev-closing-script', label: 'Closing Script', href: '/admin/dev/closing-script', icon: 'closingscript', match: starts('/admin/dev/closing-script') },
          { key: 'dev-youtube-writer', label: 'YouTube Writer', href: '/admin/dev/youtube-writer', icon: 'escribir', match: starts('/admin/dev/youtube-writer') },
        ],
      },
    ],
  },
];

/** Plano, para el título de la pestaña y cualquier búsqueda por key. */
export const ADMIN_NAV: NavItem[] = ADMIN_FAMILIAS.flatMap(itemsDe);

/**
 * El menú de la foto de perfil: la quinta familia (ADMIN) del documento, que
 * por decisión de Martín no ocupa un lugar en la barra sino que vive detrás del
 * avatar — «Profile debe reemplazar Admin en la sidebar, la foto y al pasar el
 * cursor el desplegable con las tabs».
 *
 * Onboarding y Método viven DENTRO de Configuraciones (sub-tabs), por eso el item
 * Configuraciones también matchea esas rutas. `/funnel` ya no: la ruta se retiró el
 * 28/09/2026 y hoy es un redirect a /crm.
 */
export const USER_NAV: NavItem[] = [
  { key: 'perfil', label: 'Perfil', href: '/perfil', icon: 'perfil', rolesWs: ['closer', 'setter'], match: starts('/perfil') },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: 'integraciones', match: (p) => starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  // La API de MaKo (08/10/2026): el catálogo, los tokens de cada integración y su uso.
  // Al lado de Integraciones porque es lo mismo visto desde afuera: con qué se conecta
  // un tercero. Solo el admin (sin `rolesWs`): acá se acuñan credenciales.
  { key: 'api-mako', label: 'API', href: '/api-mako', icon: 'api', match: starts('/api-mako') },
  { key: 'onboarding', label: 'Onboarding', href: '/onboarding', icon: 'contexto', match: starts('/onboarding') },
  { key: 'configuraciones', label: 'Configuraciones', href: '/configuraciones', icon: 'config', match: (p) => starts('/configuraciones')(p) || starts('/metodo')(p) || starts('/equipo')(p) },
  // Acá NO va «Admin» ni «Contexto de MaKo». Los dos eran `adminOnly`, o sea que
  // solo los veía el super admin — que ahora tiene su propia familia Admin en la
  // barra, con Clientes adentro. Repetirlos detrás del avatar era darle dos
  // puertas a lo mismo, y este menú es la cuenta de QUIEN sos, no las
  // herramientas de la agencia.
  // Reportar un problema vive acá y no en la barra: no es un destino de trabajo,
  // es a dónde vas cuando algo se rompió. Al lado de las tabs competiría todo el
  // día con lo que sí estás haciendo; en el menú del perfil está donde todo el
  // mundo lo busca, junto a la cuenta y arriba de «Cerrar sesión».
  { key: 'tickets', label: 'Reportar problema', href: '/tickets', icon: 'soporte', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/tickets') },
];

/** Todos los ítems de producto, aplanados (para buscar por key o por ruta). */
export const TODOS_LOS_ITEMS: NavItem[] = [...FAMILIAS.flatMap(itemsDe), ...MAKO_NAV];
