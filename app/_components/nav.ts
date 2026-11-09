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
//   · `grupos` — colecciones que se consultan de a una (los canales de chat, los
//     writers). Abren un desplegable al costado. Sin esto, la barra se volvía una
//     lista de todo. (Los Analysts eran el primero, y se fueron el 12/10/2026:
//     son hojas del Dashboard. Ver la familia Analyze.)
//
// Dos parejas que conviene no confundir, porque son la razón del reparto:
//   · Ads Manager (Operate) EJECUTA · el Dashboard (Analyze, la hoja «Ads Analyst») COMPRENDE.
//   · Automations (Create) se configura y se entrena · WhatsApp/Email (Operate)
//     es la conversación de todos los días.
//
// ⚠️ DESDE EL 17/10/2026 LA BARRA ES OTRA (docs/diseno-sidebar.md, el mapa de cada tab de antes a dónde fue).
// Martín: «"Ops Center" debería estar donde "Second Brain", con una criatura… Dashboard debería estar dentro de
// "Operate"… elimina "Content Machine" y que todo esté dentro de "Sales Machine"… eliminar todas las tabs de la
// sidebar de "Admin"… siempre todo en inglés los nombres de las tabs». Quedan:
//   · ARRIBA, sin rótulo: Ops Center (sólo el super admin) y Second Brain, cada uno con su criatura (`criatura`).
//     Es el lugar de «Home / Inbox / Notion AI» en Linear, Notion y Attio: lo tuyo y tu IA, antes que el producto.
//   · OPERATE: lo de todos los días, Dashboard y Clients incluidos (Analyze y Customer Success se fueron).
//   · SALES MACHINE: lo que construye la venta, con Video, Image y Copywriting (Content Machine se fue).
//   · Las herramientas del super admin (lo que era la familia Admin) viven en las tabs que ya hacen su trabajo y,
//     las que no tienen otra casa, en el menú de la foto (`SUPERADMIN_NAV`). Ninguna ruta cambió.
// Lo que sigue de este comentario es la historia de la barra por intención; las familias que nombra ya no son
// todas.
//
// ⚠️ Las `key` son contrato: `tabEnCapa()` (lib/capas.ts) y el estado del
// onboarding por tab las tienen escritas en la base. Cambiar una key apaga la
// tab en los clientes que la contrataron. Se puede mover de familia y cambiar
// el `label`; la key no.

import type { RolWorkspace } from '@/lib/auth-session';
import { RUTA_AUTOMATIONS, RUTAS_VIEJAS_AUTOMATIONS } from '@/lib/ruta-automations';
import { RUTA_WEB_GENERATOR, RUTAS_VIEJAS_WEB_GENERATOR } from '@/lib/ruta-web-generator';

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  comingSoon?: boolean;
  /**
   * Solo visible para el super admin en SU barra (rol admin de agencia sin mirar como cliente). El Sidebar lo
   * filtra en `puedeVer`, así que vale para las familias de producto, el buscador y el menú del perfil.
   */
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
   * No va en el menú de la foto: es una SECCIÓN de otro lugar (15/10/2026, Integraciones vive en
   * «Configuración del negocio»). El ítem se queda para el título de la pestaña, los permisos por capa
   * y el celular, que lo buscan por su key.
   */
  soloSeccion?: boolean;
  /**
   * No se DIBUJA en la barra, pero el ítem existe. Distinto de `soloSeccion`, que sólo lo saca del
   * menú de la foto: esto lo saca de la barra y del móvil.
   *
   * ⚠️ EXISTE PARA NO BORRAR UNA KEY. La key de una tab es contrato con la base: la nombran los
   * permisos por capa (`navKeys`, lib/capas.ts), el onboarding por tab, el móvil y el catálogo de la
   * API, y todos la resuelven con `itemNav(<key>)`. Borrar la entrada devuelve `undefined` en todos
   * esos lugares, y el daño no es que falte un renglón: es un negocio que pierde el permiso de una
   * tab porque su key dejó de existir.
   *
   * Lo usa Offer desde el 2/11/2026 (Martín: «la de offer no la quiero»). La pantalla sigue viva y
   * se llega desde el Ops Center.
   */
  fueraDeLaBarra?: boolean;
  /**
   * Solo en el shell de admin: al clickear, el admin ENTRA COMO el workspace
   * dueño (ws1) y navega. Sirve para tabs por-workspace (WhatsApp/Email) que el
   * admin sin impersonar no puede usar (ws=null, fail-closed). Reusa la
   * impersonación firmada de /api/admin/impersonate.
   */
  entrarComoDueno?: boolean;
  match: (pathname: string) => boolean;
  /**
   * Una TAB UNIFICADA (Video, Image, Copywriting, 12/10/2026): agrupa herramientas que
   * antes eran tabs sueltas. Cada sección es el ítem de siempre, con su key, su ruta y su
   * `adminOnly`: los guards de cada page no cambian. La tab se ve si se ve alguna sección
   * (`puedeVerItem`) y lleva a la primera visible; arriba de cada sección, la barra de
   * secciones (app/_components/SeccionesTab.tsx) deja saltar entre ellas.
   */
  secciones?: NavItem[];
  /** El rótulo de este ítem en la barra de secciones de su tab («Crear con IA»). */
  seccion?: string;
  /**
   * Sólo lo ve el ADMIN de un workspace de estas capas (y el super admin): «MaKo Partners», que es de las agencias
   * (17/10/2026). Una capa con `navKeys: null` (completo, agencia) ve todas las keys, así que la capa sola no alcanza.
   * Cosmético, como todo acá: la puerta real es la página.
   */
  soloCapas?: readonly string[];
  /**
   * NO se dibuja en la barra del super admin (su shell, sin mirar a un cliente); los negocios la ven como siempre (26/10/2026,
   * Martín: «Yo como SuperAdmin, no necesito "Agency" o "Partners" en la sidebar»). Lo que él mira de esos programas está en
   * Customers. Cosmético, como todo acá: la ruta sigue abriendo.
   */
  noEnPlataforma?: true;
  /** No lo ve la cuenta de un cliente de una AGENCIA (29/10/2026): MaKo Partners. Lo decide lib/nav-visibilidad.ts. */
  noParaClienteDeAgencia?: true;
  /**
   * El ícono es una CRIATURA del Ops Center (app/admin/operaciones/Muneco.tsx), no un dibujo de icons.tsx: el nombre
   * del empleado cuyo muñeco se dibuja («Ops Center», «Second Brain»). Es el mismo muñeco que tiene ese chat en el
   * Centro, porque el aspecto sale del nombre (lib/centro-munecos.ts → aspectoDe). Se mueve: flota y parpadea.
   */
  criatura?: string;
  /**
   * La criatura es la ESTRELLA de MaKo (`ASPECTO_MAKO`) y no la que sale del nombre (app/_components/Criatura.tsx). La
   * llevan las dos entradas «Ops Center»: la del super admin y la de cada negocio (Martín, 18/10/2026).
   */
  estrella?: boolean;
  /**
   * El nombre de su chat JEFE en el Ops Center, cuando no es el de la fila. El Second Brain de cada negocio se llama «Ops
   * Center» desde el 18/10/2026, pero su jefe sigue siendo «Second Brain»; sin esto, `rutaDeLaTab` (lib/centro-chats.ts)
   * mandaba el «Revisar» de los chats «Ops Center» a /second-brain y el jefe «Second Brain» se quedaba sin tab.
   */
  jefe?: string;
  /**
   * Una línea chica debajo del nombre, con la barra abierta: lo que hay ADENTRO cuando el nombre no lo dice (25/10/2026, la
   * llamada con Leandro, f31: «no encuentro la sección de curso... Yo pensé que Clients era algo más CRM»). El buscador
   * también la lee.
   */
  bajada?: string;
  /**
   * Las keys de SIN_FILA que son pantallas de adentro de esta tab sin barra de secciones (Classroom y Community, sub-tabs de
   * Clients): el buscador las encuentra con el nombre de la tab al lado.
   */
  adentro?: readonly string[];
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
  /** Sin rótulo (la zona de lo diario, arriba): sus filas van sueltas. */
  sinRotulo?: boolean;
  /** El color de la SECCIÓN (un token de app/globals.css): sólo tiñe el ícono de sus filas (prototipo de coherencia). */
  color?: string;
  icon: string;
  notifica?: boolean;
  /** Los destinos, en bloques separados visualmente. Siempre a la vista. */
  bloques: NavBloque[];
  /** Colecciones que se consultan de a una: abren desplegable al costado. */
  grupos?: NavGrupo[];
  /**
   * Fuera de la barra del super admin, los ítems visibles de sus `grupos` se muestran sueltos (un bloque más) y no
   * como desplegables. Lo aplica el Sidebar al filtrar; el super admin ve los grupos como siempre.
   */
  planaParaCliente?: boolean;
};

/**
 * Todos los destinos de una familia, incluidos los de sus colecciones. Una tab unificada
 * se abre en sus SECCIONES (y ella no figura): títulos, capas, el mapa de /admin/dev y los
 * tests siguen viendo los mismos ítems con las mismas keys que antes de unificar.
 */
export const itemsDe = (f: NavFamilia): NavItem[] =>
  [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)].flatMap((it) => it.secciones ?? [it]);

const starts = (p: string) => (pathname: string) =>
  pathname === p || pathname.startsWith(p + '/');

/**
 * Las secciones de Admin (la copia del dashboard de Polar, app/admin/(polar)): marcan la tab Admin de la barra, y con ellas
 * (y /admin) la barra de MaKo se pliega al entrar, porque Admin trae la suya (`pliegaLaBarra`, Sidebar.tsx).
 */
export const SECCIONES_ADMIN = ['customers', 'analytics', 'sales', 'products', 'finance', 'settings'] as const;

/**
 * De dónde sale el número (el badge) de una tab. Son obligaciones concretas, no novedades: los
 * mensajes sin leer y los datos del CRM sin marcar.
 *
 * ⚠️ Chats y WhatsApp cuentan LO MISMO (14/10/2026): los chats sin leer del número de empresa que
 * sondea NotificationsProvider. Dos tabs, UNA fuente, mientras convivan en la barra (plano §6.1). Por
 * eso la suma de una familia cuenta cada FUENTE una vez y no cada tab: sumando tabs, la familia
 * Operate cerrada decía el doble de mensajes de los que había. Instagram y Messenger todavía no
 * cuentan: el sondeo es sólo del WhatsApp.
 */
export type FuenteContador = 'mensajes' | 'crm';
// Desde el 17/10/2026 WhatsApp ya no es tab y Chats es una tab unificada: el número lo lleva la tab (`bandeja`) en la
// barra y la sección (`chats`) donde se busque por key. Los tres cuentan la misma fuente, así que la suma no se duplica.
const FUENTE_CONTADOR: ReadonlyMap<string, FuenteContador> = new Map<string, FuenteContador>([['bandeja', 'mensajes'], ['chats', 'mensajes'], ['whatsapp', 'mensajes'], ['crm', 'crm']]);
export const fuenteContador = (key: string): FuenteContador | null => FUENTE_CONTADOR.get(key) ?? null;

/** La suma de los badges de varias tabs (una familia), con cada fuente contada UNA vez. */
export function sumaDeContadores(keys: readonly string[], valor: (f: FuenteContador) => number): number {
  const vistas = new Set<FuenteContador>();
  let total = 0;
  for (const k of keys) {
    const f = fuenteContador(k);
    if (!f || vistas.has(f)) continue;
    vistas.add(f);
    total += valor(f);
  }
  return total;
}

/**
 * Las páginas de los CANALES de Chats (17/10/2026): /whatsapp y /email dejaron de ser tabs (Martín: «eliminar las tabs
 * de "Email y WhatsApp" y unificarlo todo en "Chats"»). Lo que queda en ellas es CONFIGURAR el canal —conectar un número
 * por QR, el dominio y las secuencias de email—, y se entra desde Chats; estando ahí, la barra marca Chats.
 * Ver docs/diseno-sidebar.md §Chats.
 */
export const RUTAS_DE_CHATS = ['/whatsapp', '/email'] as const;

/**
 * LAS HERRAMIENTAS DEL SUPER ADMIN — lo que era la familia «Admin» de la barra, hasta el 17/10/2026.
 *
 * Martín (17/10/2026): «quiero eliminar todas las tabs de la sidebar de "Admin": estoy seguro de que la mayoría ya tienen
 * lugares donde podrían vivir, tabs completamente funcionales que las reemplazan o las toman». Cada una se define UNA
 * vez acá y se cuelga como SECCIÓN `adminOnly` de la tab que hace su trabajo (la barra de secciones de arriba de la
 * pantalla, app/_components/SeccionesTab.tsx, la ofrece sólo al super admin):
 *   · WhatsApp de MaKo → Chats · Mensajes de MaKo → Automations · Strategy y Offer Playbook → Offer
 *   · el método de redacción y las bibliotecas de guiones: SIN fila ni mención desde el 29/10/2026 (Martín: «Elimina esto
 *     "Copy…", no quiero ninguna mención en todo MaKo»). Sus rutas redirigen a /copywriter; lo que la IA lee de ellas
 *     (la metodología, el swipe, los ángulos y las estructuras, con sus overrides) sigue igual.
 *   · Ops Center arriba de todo (con la Ticketera adentro) · Cobros, el agente de los clientes, Contexto, Modelos IA,
 *     Conocimientos → menú de la foto (Cobros y Agents iban en Clients; su jefe las mandó acá: viven fuera de
 *     /clients y son de la plataforma, no de los clientes del negocio). Contexto, Modelos IA y Dev se fueron el 25/10/2026.
 * El porqué de cada una, en docs/diseno-sidebar.md. NINGUNA RUTA CAMBIÓ: cada página conserva su guard
 * (getSesionAdmin, puedeOperar) y `adminOnly` sigue siendo cosmético.
 *
 * ⚠️ Las keys no llevan el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros), y ninguna repite la de una
 * tab del producto (colgada como su sección, escondería a la tab en el teléfono: lib/movil-rutas.ts la busca por key).
 */
const HERRAMIENTAS = {
  // ⚠️ «MaKo WhatsApp» (/agencia) YA NO ES UNA SECCIÓN (24/10/2026, Martín: «En SuperAdmin no deben haber 3 tabs allí, debe
  // ser igual que el resto. Y que simplemente pueda cambiar entre mi número y el de MaKo y ver entre los chats los
  // grupos»). El número de MaKo es una línea más del chip «Canales» de Chats para el super admin (docs/diseno-chats.md
  // §8.5); /agencia sigue respondiendo para sus links (`?canal=1`, la alerta de la voz caída) y marca Chats en la barra.
  // ⚠️ «MaKo Messages» (/mensajes) YA NO ES UNA SECCIÓN (26/10/2026, Martín: «En Automations de Super Admin tengo "MaKo
  // Messages" elimina eso»). Era el editor de la BASE de los avisos al dueño, y la base no existe en producción (medido:
  // ninguna fila `mako.plantillas.base`): desde el 10/10 no le cambiaba nada a nadie. Los avisos siguen saliendo con lo que
  // tiene cada negocio (lib/avisos.ts lee su store; de una pantalla, sólo lo toca el detalle de la bandeja de correo:
  // docs/hallazgos-comunicacion.md, «Nueve avisos de Notificaciones no le salen a nadie»), y los
  // mensajes de la plataforma son automatizaciones (AGENTS.md → «Un Mensaje de MaKo ES una automatización»). /mensajes y
  // /m/mensajes redirigen a Automations.
  // En qué trabaja cada cliente en SU Claude Code. Es información de CLIENTES: su casa es Clients.
  agente: { key: 'admin-agente', label: 'Client Agents', seccion: 'Agents', href: '/admin/agente', icon: 'mako', adminOnly: true, match: starts('/admin/agente') },
  // La estrategia de MaKo en UNA pantalla (10/10/2026): la oferta, a dónde va cada dólar, el CAC, la adquisición, la
  // proyección y los referidos. Su casa: Offer, porque empieza por la oferta y de ella sale la grilla de precios.
  estrategia: { key: 'admin-estrategia', label: 'Strategy', href: '/admin/estrategia', icon: 'analytics', adminOnly: true, match: starts('/admin/estrategia') },
  // Martín vendiendo MaKo (11/10/2026): el link de pago de un plan y lo que se cobró, con el alta de cada cuenta. Su
  // casa: Clients, donde están las cuentas que ese cobro da de alta.
  cobros: { key: 'admin-cobros', label: 'Billing', href: '/admin/cobros', icon: 'tag', adminOnly: true, match: starts('/admin/cobros') },
  // El criterio de la tab Offer y lo que se concluyó de cada curso de oferta (11/10/2026). Su casa: Offer.
  offerPlaybook: { key: 'admin-offer-playbook', label: 'Offer Playbook', seccion: 'Playbook', href: '/admin/offer-playbook', icon: 'tag', adminOnly: true, match: starts('/admin/offer-playbook') },
  // La Ticketera vive ADENTRO del Ops Center desde el 16/10/2026 (`?ticketera=`); este ítem no se dibuja: queda para el
  // título de /tickets/decisiones y para que «Ticketera» siga siendo el nombre de una tab (app/admin/operaciones/tabs.ts).
  // Desde el 17/10/2026 abre los tickets de los USUARIOS (`?ticketera=tickets`, docs/diseno-ticketera-usuarios.md).
  ticketera: { key: 'admin-ticketera', label: 'Ticketera', href: '/admin/operaciones?ticketera=tickets', icon: 'soporte', adminOnly: true, match: starts('/tickets/decisiones') },
  // ⚠️ «MaKo Context» (/contexto), «AI Models» (/modelos-ia) y «Dev» (/admin/dev) SALIERON el 25/10/2026 (Martín, puntos
  // 13 a 15: «Elimina /contexto... Elimina /modelos-ia, eso ya lo configura el usuario y el propio Ops Center de manera
  // automática... Elimina "dev", ya no lo necesitamos»). Lo que sabe MaKo (el Conocimiento) está en Classroom › Methodology,
  // sólo para el super admin; los prompts, en Settings › Prompts. Las rutas viejas redirigen (next.config.ts).
  // Portal de formación interna (curso AVATARHYPE) — capa oscura autocontenida.
  conocimientos: { key: 'conocimientos', label: 'Knowledge', href: '/conocimientos', icon: 'contexto', adminOnly: true, match: starts('/conocimientos') },
  // Approvals (5/11/2026, Martín: «todo deberías poder revisarlo tú»): en qué está cada aprobación que MaKo espera de otra
  // empresa (App Store, Google Play, la Chrome Web Store, Meta, Google, Resend, Creem, SSL.com). Lee lo que guardó el vigía
  // (lib/vigia-aprobaciones.ts); no le pregunta nada a las tiendas al abrirse. Su casa: el menú de la foto.
  aprobaciones: { key: 'admin-approvals', label: 'Approvals', href: '/admin/approvals', icon: 'check', adminOnly: true, match: starts('/admin/approvals') },
} satisfies Record<string, NavItem>;

export const FAMILIAS: NavFamilia[] = [
  {
    // LO DE TODOS LOS DÍAS (sin rótulo hasta el 20/10/2026; 17/10/2026 noche, prototipo docs/prototipos/sidebar-nueva-1710.html; Martín: «la
    // sidebar es confusa, copiá otras apps»). Es la zona que Linear y Notion ponen arriba de las secciones: Plan, Chats
    // (con el contador) y Dashboard. «Home» (/general) salió de la barra el mismo día (docs/prototipos/coherencia-1710.md,
    // pedido 3): el Dashboard abre en la hoja fija «Focus», que es lo que era /general, y /general redirige ahí.
    // ⚠️ 20/10/2026 (feedback del 18/10, pt 10; Martín: «quiero que Ops center esté dentro de la sección de «Plan, chats y
    // dashboard» y que esa sección también se pueda plegar como las otras»): lleva rótulo y se pliega, y el Sidebar le
    // pone ARRIBA el Ops Center (`arribaDe`: el del super admin o el de cada negocio). ARRIBA sigue siendo su propia
    // lista porque el teléfono y los tests la usan; la barra la dibuja acá adentro.
    key: 'diario',
    label: 'Today',
    pregunta: 'Lo de todos los días',
    icon: 'rayo',
    color: '--sec-diario',
    notifica: true,
    bloques: [
      [
        { key: 'todo', label: 'Plan', href: '/plan', icon: 'todo', rolesWs: ['closer', 'setter'], match: (p) => starts('/plan')(p) || starts('/todo')(p) },
        {
          key: 'bandeja', label: 'Chats', href: '/chats', icon: 'chats',
          match: (p) => starts('/chats')(p) || RUTAS_DE_CHATS.some((r) => starts(r)(p)) || starts('/agencia')(p),
          secciones: [
            { key: 'chats', label: 'Chats', seccion: 'Chats', href: '/chats', icon: 'chats', rolesWs: ['closer', 'setter'], match: (p) => starts('/chats')(p) || RUTAS_DE_CHATS.some((r) => starts(r)(p)) },
          ],
        },
        { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', rolesWs: ['closer', 'setter'], match: (p) => starts('/dashboard')(p) || starts('/general')(p) || starts('/focus')(p) || starts('/marketing')(p) || starts('/comercial')(p) || starts('/graficos')(p) || starts('/analisis')(p) },
      ],
    ],
  },
  {
    // SALES: a quién le vendo y cómo va (HubSpot junta CRM y ventas; GoHighLevel pone Calendars y Automation al lado del
    // CRM; Attio trata a los clientes como registros del mismo CRM).
    key: 'sales',
    label: 'Sales',
    pregunta: '¿A quién le vendo y cómo va?',
    icon: 'crm',
    color: '--sec-sales',
    notifica: true,
    bloques: [
      [
        { key: 'crm', label: 'CRM', href: '/crm', icon: 'crm', rolesWs: ['closer', 'setter'], match: starts('/crm') },
        // Closers y setters entran SÓLO a «Llamadas», con las suyas (6/11/2026, las reuniones del equipo: app/calendario/page.tsx).
        { key: 'calendario', label: 'Calendar', href: '/calendario', icon: 'calendario', rolesWs: ['closer', 'setter'], match: starts('/calendario') },
        {
          key: 'automatizaciones', label: 'Automations', href: RUTA_AUTOMATIONS, icon: 'flujo',
          match: (p) => starts(RUTA_AUTOMATIONS)(p) || RUTAS_VIEJAS_AUTOMATIONS.some((r) => starts(r)(p)),
          // Una sola sección desde el 26/10/2026 (salió «MaKo Messages»): queda por la llave `setting` del setter.
          secciones: [
            { key: 'setting', label: 'Automations', seccion: 'Automations', href: RUTA_AUTOMATIONS, icon: 'flujo', rolesWs: ['setter'], match: (p) => starts(RUTA_AUTOMATIONS)(p) || RUTAS_VIEJAS_AUTOMATIONS.some((r) => starts(r)(p)) },
          ],
        },
        // «Classroom» desde el 25/10/2026 (Martín: «La tab de "clients" pasa a llamarse "Classroom". También su ruta.»): abre
        // en el curso; el kanban de la entrega es su sub-tab Clients. /clients redirige (next.config.ts) y sigue marcando acá.
        { key: 'customer-success', label: 'Classroom', bajada: 'Curso, comunidad y clientes', adentro: ['cs-curso', 'cs-comunidad'], href: '/classroom', icon: 'users', match: (p) => starts('/classroom')(p) || starts('/clients')(p) || starts('/customer-success')(p) },
        // Admin (5/11/2026; era Customers, 25/10/2026): la tab del super admin. Desde el 6/11/2026 es la copia del dashboard
        // de Polar (app/admin/(polar)): Overview, Customers, Analytics, Sales, Products, Finance y Settings, cada una su ruta.
        // Martín: «la tab que hoy en día se llama Customer dentro de Super Admin, que se llame Admin directamente». La KEY no
        // cambia (es contrato: capas, teléfono, API). El `match` es /admin EXACTO más las secciones de Polar: las otras
        // subrutas (/admin/dev, /admin/ui…) son otras tabs. /customers, /admin/cobros y /admin/agente redirigen acá.
        { key: 'admin-customers', label: 'Admin', href: '/admin', icon: 'cs', adminOnly: true, match: (p) => p === '/admin' || SECCIONES_ADMIN.some((s) => starts(`/admin/${s}`)(p)) || starts('/customers')(p) || starts('/admin/cobros')(p) || starts('/admin/agente')(p) },
      ],
    ],
  },
  {
    // MARKETING: lo que atrae a la gente (HubSpot: la oferta, el sitio y los anuncios bajo Marketing).
    key: 'marketing',
    label: 'Marketing',
    pregunta: '¿Qué atrae a la gente?',
    icon: 'ads',
    color: '--sec-marketing',
    bloques: [
      [
        // Offer SIN pestañas desde el 29/10/2026 (Martín: «También en offer pon el mismo sistema de la sidebar... Y sin otras
        // tabs, incluso en SuperAdmin»): la pantalla de Create (app/_crear/PantallaCrear.tsx). Lleva la key de la que era su
        // sección, 'offer' (la miran las capas, la API y el teléfono). Strategy y Offer Playbook, del super admin, van al pie de
        // la lista de ofertas (app/offer/OfferApp.tsx) y siguen en ADMIN_NAV por su key; la barra las marca en Offer.
        // ⚠️ OFFER Y ADS MANAGER VUELVEN A LA BARRA, y no porque Martín cambiara de idea: sacarlos
        // rompe SEIS tests porque esas keys no viven sólo acá. El catálogo de funciones de la API
        // (`tests/funciones-mako.test.ts`: «ninguna función nombra una key que no existe»), las
        // rutas del móvil, los módulos de Knowledge, Create y Estrategia las nombran. Sacarlas es
        // un trabajo propio —hay que mudar cada consumidor—, no una línea de menos acá, y tenerlas
        // afuera a medias dejaba 12 commits buenos sin poder desplegarse.
        // ⚠️ OFFER NO SE VE EN LA BARRA, PERO EL ÍTEM SE QUEDA. Martín, 2/11/2026: «elimina las tabs
        // de offer… la de offer no la quiero». La pantalla sigue viva en /offer (la abren el CRM, una
        // apertura o un link guardado); en el Ops Center la oferta la trabaja el Funnel Coach, el único
        // coach desde el 4/11/2026, con las conversaciones de oferta colgando de él. Lo que se saca es el
        // renglón, no la función.
        //
        // ⚠️ POR QUÉ `fueraDeLaBarra` Y NO BORRAR LA ENTRADA: la key es CONTRATO CON LA BASE. La
        // nombran los permisos por capa (`navKeys`, lib/capas.ts), el onboarding por tab, el móvil y
        // el catálogo de la API, y todos la resuelven con `itemNav('offer')`. Borrarla devuelve
        // `undefined` en todos esos lugares —seis tests lo cazaron el 2/11— y el daño no es la barra:
        // es un negocio que pierde el permiso de una tab porque su key dejó de existir.
        // ⚠️ EL `match` NO SE RECORTA aunque el ítem no se dibuje: lo usan el título de la pestaña y
        // las rutas viejas. Al reescribir esta línea perdí `/admin/offer-playbook` y el run salió
        // rojo con razón — `tests/offer-en-create.test.ts` lo exige.
        { key: 'offer', label: 'Offer', href: '/offer', icon: 'tag', fueraDeLaBarra: true, match: (p) => starts('/offer')(p) || starts('/offer-analyst')(p) || starts('/admin/estrategia')(p) || starts('/admin/offer-playbook')(p) },
        // 6/11/2026, Martín: «quiero que la tab se llame "Marketing CoPilot", porque la idea no es que sólo haga anuncios… y debería tener
        // otro icono». LA KEY Y LA RUTA NO CAMBIAN: `ads-manager` es contrato con la base (capas, permisos, onboarding, API, móvil) y
        // `/ads-manager` lo abren links guardados; lo que cambia es el rótulo y el ícono. Ver docs/relevo/nube-marketing-copilot.md.
        { key: 'ads-manager', label: 'Marketing CoPilot', href: '/ads-manager', icon: 'copiloto', match: starts('/ads-manager') },
        // Competitor Spy: vino de Analyze el 17/10/2026 y estuvo en PRONTO hasta el 31/10/2026, cuando dejó de ser
        // ComingSoon (la Etapa 1 de docs/diseno-competitors-spy.md: lista, ficha por bloques y onboarding). Marketing es
        // la casa que el comentario de PRONTO ya le había asignado. Sigue `adminOnly` desde el 12/10/2026 (Martín:
        // «Elimina "Competitors Spy" y que solo se vea en super admin»): vigila lo que hacen los demás.
        { key: 'market-an', label: 'Competitor Spy', href: '/competitor-spy', icon: 'spy', match: (p) => starts('/competitor-spy')(p) || starts('/market-analyst')(p) },
      ],
    ],
  },
  {
    // CREATE: las piezas (lo que se produce, separado de lo que se ejecuta). AI Avatar, sólo el super admin.
    // ⚠️ SIN `secciones` (29/10/2026, Martín: «para todas las secciones de "create" no quiero otras tabs… prefiero deprecar antes
    //    que conservar»): cada tab es UNA pantalla, la de app/_crear/PantallaCrear.tsx (el chat de MaKo a la izquierda con sus
    //    proyectos y «Nuevo …» con las plantillas). Cada ítem lleva la key de la que era su sección principal ('video-editor',
    //    'image-editor'): con esa key la miran las capas (lib/capas.ts), la API (`gating.tab`) y el acceso de la página.
    //    Se fueron: Reels (sus guiones son una plantilla del Copywriter), Carousels (el texto es del Copywriter y el diseño, un
    //    tamaño de Image), Image Generator y Thumbnails (nunca pasaron de «pronto»).
    key: 'create',
    label: 'Create',
    pregunta: '¿Qué pieza necesito hacer?',
    icon: 'creativos',
    color: '--sec-create',
    bloques: [
      [
        // La copia de CapCut. Abierta a todos desde el 12/10/2026; quién entra lo decide app/video-editor/acceso.ts (la misma
        // pregunta que toda tab: rol y capa). El Video Generator (Flow) es una plantilla de «Nuevo video», no una pestaña.
        { key: 'video-editor', label: 'Video', href: '/video-editor', icon: 'videogen', match: (p) => starts('/video-editor')(p) || starts('/video-generator')(p) },
        // La copia de Canva (14/10/2026): Doory portado y re-vestido. Abierta a todos los workspaces el 15/10/2026, como el Video
        // Editor el 12/10: quién entra lo decide app/image-editor/acceso.ts con la pregunta de toda tab (rol y capa).
        { key: 'image-editor', label: 'Image', href: '/image-editor', icon: 'imagegen', match: starts('/image-editor') },
        // Copywriting ES el Copywriter desde el 29/10/2026 (Martín: «quiero que sea una réplica de Notion… con la barra lateral
        // de MaKo… y NO quiero otras tabs internas que hoy aparecen en la topbar ni nada de ONBOARDING»): UNA pantalla, sin
        // `secciones`, con la key de su pantalla ('copywriter': la piden la página, el teléfono y la API). Ads Writer, Stories y
        // YouTube Writer dejan la barra; sus keys siguen en SIN_FILA (sus rutas, la API y las capas las piden). El método de
        // redacción y la biblioteca de guiones no tienen fila ni mención desde el 29/10/2026 (D15): sus rutas redirigen acá.
        // docs/diseno-copywriter.md, D11.
        {
          key: 'copywriter', label: 'Copywriting', href: '/copywriter', icon: 'escribir',
          match: (p) => starts('/copywriter')(p) || starts('/ideas')(p) || starts('/ads-writer')(p) || starts('/content-machine')(p) || starts('/youtube-writer')(p) || starts('/stories')(p),
        },
        // 6/11/2026, Martín: «Web Generator debería estar en la sección de "Create"». Es una pieza que se produce (la web), no algo que se ejecuta.
        { key: 'landing-writer', label: 'Web Generator', href: RUTA_WEB_GENERATOR, icon: 'web', match: (p) => starts(RUTA_WEB_GENERATOR)(p) || RUTAS_VIEJAS_WEB_GENERATOR.some((r) => starts(r)(p)) },
        {
          // 5/11/2026: sale de «Coming soon» a su casa futura (Create), con el diseño único de Create (app/_crear/PantallaCrear.tsx):
          // plantillas de guía, checklist, prompts, planilla y clase grabada que crean la pieza en su herramienta (lib/lead-magnets/).
          // `adminOnly` y su puerta (app/lead-magnet-generator/puerta.ts): sólo la plataforma, hasta que Martín la abra a los clientes.
          key: 'lead-magnet-generator', adminOnly: true, label: 'Lead Magnet', href: '/lead-magnet-generator', icon: 'leadmagnet',
          match: starts('/lead-magnet-generator'),
        },
      ],
    ],
  },
];

/**
 * LAS «PRONTO» del super admin (17/10/2026 noche): salieron de la barra al menú de la foto › Platform › Coming soon
 * (prototipo: «lo poco usado detrás de "More", no en la lista», como Linear). Cada una con su casa futura: VSL Generator
 * → Create; Sales Email, Newsletters y Competitor Spy → Marketing; Closing Script y Sales Roleplay → Sales. Lead Magnet ya
 * está en Create desde el 5/11/2026.
 * Todas `adminOnly` desde el 11/10/2026.
 */
export const PRONTO: NavItem[] = [
  { key: 'vsl-writer', adminOnly: true, label: 'VSL Generator', href: '/vsl-generator', icon: 'video', comingSoon: true, match: (p) => starts('/vsl-generator')(p) || starts('/vsl-writer')(p) },
  { key: 'sales-email', adminOnly: true, label: 'Sales Email', href: '/sales-email', icon: 'salesemail', comingSoon: true, match: starts('/sales-email') },
  { key: 'newsletters', adminOnly: true, label: 'Newsletters', href: '/newsletters', icon: 'newsletter', comingSoon: true, match: starts('/newsletters') },
  { key: 'closing-script', adminOnly: true, label: 'Closing Script', href: '/closing-script', icon: 'closingscript', comingSoon: true, rolesWs: ['closer'], match: starts('/closing-script') },
  { key: 'sales-roleplay', adminOnly: true, label: 'Sales Roleplay', href: '/sales-roleplay', icon: 'roleplay', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/sales-roleplay') },
];

/**
 * ARRIBA DE TODO, SIN RÓTULO (17/10/2026): Ops Center y Second Brain, cada uno con su criatura.
 *
 * Martín: «"Ops Center" no debería estar en la sección de Admin en la sidebar: debería estar donde "Second Brain", con
 * una criatura tipo ícono, moviéndose como siempre... Lo mismo para los otros workspaces, ya que Second Brain sigue
 * estando en la sección de "analize" y no debería». Es el lugar que Linear le da a Inbox y My issues, Notion a Home y
 * Notion AI (con su carita), y Attio a Notifications y Tasks: lo tuyo y tu IA, antes que las secciones del producto.
 *
 * ⚠️ UNA ENTRADA DE SECOND BRAIN POR PERSONA. Hasta el 17/10 había dos: «Second Brain» en Analyze (key `second-brain`,
 * el Mapa para el admin) y la de abajo del todo (key `mako`, el chat, para todos). Quedó la de `mako`, que es la que pide
 * el guard de la página (`requireRolWs(…, { nav: 'mako' })`); la key `second-brain` sigue en las capas y la usa la
 * página para decidir quién ve el Mapa (`esAdminDeTab('second-brain')`): no es un ítem de la barra.
 */
/*
 * ⚠️ DESDE EL 16/10/2026 SE LLAMA «SECOND BRAIN» Y LLEVA A /second-brain (etapa 2 de docs/diseno-mako-ai-native.md):
 * el chat con MaKo es la puerta del Second Brain. LA CLAVE SIGUE SIENDO `mako`: de ella cuelgan el chat del teléfono,
 * la bandeja (/mako/pendientes), Inbox y la puerta del chat (`puedeVerKey('mako')`); cambiarla los apagaba a todos.
 * Es UNA sola entrada: /mako-doer existe como ruta pero salió de la barra (monta el MISMO MakoChat contra otro endpoint).
 */
/*
 * ⚠️ DESDE EL 18/10/2026 SE LLAMA «OPS CENTER», CON LA ESTRELLA (Martín: «En todos los clientes también debe llamarse la
 * tab «Ops Center» en lugar de «Second Brain» y tener la criatura de estrella»). Cambian el nombre y la criatura; la ruta
 * (/second-brain), la key `mako` y la pantalla, no. El super admin no la ve (`arribaDe`): tiene SU Ops Center
 * (/admin/operaciones), así que nadie ve dos. Ctrl K sigue llevando acá con «second brain» o «cerebro» (lib/buscador-nav.ts).
 */
export const MAKO_NAV: NavItem[] = [
  { key: 'mako', label: 'Ops Center', jefe: 'Second Brain', href: '/second-brain', icon: 'cerebro', criatura: 'Ops Center', estrella: true, rolesWs: ['closer', 'setter'], match: (p) => starts('/second-brain')(p) || starts('/mako')(p) || starts('/mako-doer')(p) },
];

/**
 * El Centro de Operaciones (15/10/2026): pedidos firmados para los chats de Claude de la PC de Martín. «Ops Center»
 * (Martín, 17/10/2026: «Me gustaría que quede el nombre de "Ops Center"»): la misma pantalla que /second-brain para el
 * super admin (app/second-brain/pagina.tsx), con la Ticketera adentro (`?ticketera=`). Por eso también marca
 * /tickets/decisiones, la ruta vieja de la Ticketera, que redirige acá. `adminOnly` es cosmético: la puerta real es
 * `puedeOperar` en la página. La key no lleva el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros).
 */
export const OPS_CENTER: NavItem = {
  key: 'admin-operaciones', label: 'Ops Center', href: '/admin/operaciones', icon: 'config', criatura: 'Ops Center', estrella: true, adminOnly: true,
  match: (p) => starts('/admin/operaciones')(p) || starts('/tickets/decisiones')(p),
};

/** Lo de arriba de todo, en orden: lo que el Sidebar dibuja antes de las familias. */
export const ARRIBA: NavItem[] = [OPS_CENTER, ...MAKO_NAV];

/**
 * Lo de arriba de todo PARA QUIEN MIRA (17/10/2026, Martín: «Me sigue apareciendo una tab de "ops center" y otra de "Second
 * brain"... Elimina la de second brain, el second brain vive dentro de ops center y es el grafo, no otro chat»).
 *
 *   · el super admin ve SÓLO el Ops Center: el Second Brain se abre desde adentro (la sub-tab de debajo de la Ticketera, que
 *     abre el grafo: `/admin/operaciones?panel=mapa`), y un `/second-brain` guardado lo lleva ahí (app/second-brain/page.tsx);
 *   · los demás (el cliente, su setter y closer, y el super admin MIRANDO a un cliente) siguen con «Second Brain», que para
 *     ellos es el chat con MaKo y no tienen otro lugar donde abrirlo.
 *
 * `puedeVer` es la regla de la barra de quien mira (lib/nav-visibilidad.ts). El teléfono hace lo mismo en More
 * (lib/movil-rutas.ts → masCompleto).
 */
export function arribaDe(adminShell: boolean, puedeVer: (it: NavItem) => boolean): NavItem[] {
  return ARRIBA.filter((it) => (it.adminOnly ? adminShell : !adminShell && puedeVer(it)));
}

/**
 * El menú de la foto, sólo para el super admin (17/10/2026): las herramientas de la ex familia Admin que no son el
 * trabajo de ninguna tab del producto. Son la CONFIGURACIÓN de MaKo como plataforma —con qué sabe y con qué modelos
 * piensa— más la formación del equipo y el modo Dev: el lugar donde Linear y Notion ponen «Settings», al lado de
 * «Configuración del negocio». Ver docs/diseno-sidebar.md, «Admin: dónde fue cada una».
 */
export const SUPERADMIN_MENU: NavItem[] = [
  // Billing y Client Agents salieron el 25/10/2026: viven en Customers (las pestañas Billing y Agents). Sus entradas de
  // HERRAMIENTAS quedan (el teléfono las abre por key, lib/movil-rutas.ts) y sus rutas redirigen. MaKo Context, AI Models
  // y Dev se fueron el mismo día (Classroom › Methodology, Settings › Prompts; las rutas redirigen, next.config.ts).
  HERRAMIENTAS.conocimientos,
  HERRAMIENTAS.aprobaciones,
];

/**
 * LA FAMILIA QUE SOLO EXISTE EN EL SHELL DE SUPER ADMIN: Dev.
 *
 * ⚠️ HASTA EL 17/10/2026 ERAN DOS: «Admin» y «Dev». Admin salió de la barra (Martín: «eliminar todas las tabs de la
 * sidebar de "Admin": estoy seguro de que la mayoría ya tienen lugares donde podrían vivir») y sus herramientas viven
 * en `HERRAMIENTAS` (arriba), repartidas en las tabs que hacen su trabajo. Dev nunca se dibujó como carpeta: es un MODO
 * (`/admin/dev` reemplaza la barra entera, Sidebar → familiasDev) y se exporta porque de acá sacan `ADMIN_NAV` sus keys
 * y `lib/titulo-tab.ts` el título de esas rutas.
 */
export const ADMIN_FAMILIAS: NavFamilia[] = [
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
    ],
    // ⚠️ SIN «Áreas del producto» NI LOS REGISTROS desde el 25/10/2026 (Martín: «Elimina "dev", ya no lo necesitamos»): sus
    // pantallas (/admin/dev y /admin/dev/<área>) se fueron. Las bitácoras se QUEDAN (app/admin/dev/*/bitacora.ts y
    // registros.ts): de ellas cuelgan el cierre de los tickets (`tickets: [n]`), el Progreso y el Cerebro.
  },
];

/** Plano, para el título de la pestaña y cualquier búsqueda por key. */
export const ADMIN_NAV: NavItem[] = [OPS_CENTER, ...Object.values(HERRAMIENTAS), ...ADMIN_FAMILIAS.flatMap(itemsDe)];

/**
 * El menú de la foto de perfil: la quinta familia (ADMIN) del documento, que
 * por decisión de Martín no ocupa un lugar en la barra sino que vive detrás del
 * avatar — «Profile debe reemplazar Admin en la sidebar, la foto y al pasar el
 * cursor el desplegable con las tabs».
 *
 * Equipo, Integraciones y Método son secciones de «Configuración del negocio» (15/10/2026), por eso
 * el ítem también matchea esas rutas. `/funnel` ya no: la ruta se retiró el
 * 28/09/2026 y hoy es un redirect a /crm.
 */
export const USER_NAV: NavItem[] = [
  // «Tu cuenta» y «Configuración del negocio» (15/10/2026, copiado de Google: dos lugares). Lo de la
  // PERSONA para todos los roles; lo del NEGOCIO sólo para quien lo administra. Las secciones de cada uno
  // viven en lib/ajustes-secciones.ts.
  // «SETTINGS», UN SOLO LUGAR Y PRIMERO (24/10/2026, Martín: «En el desplegable del perfil, quiero que juntes todo en "Settings",
  // que ya no sea "Business Setting", sólo "Settings", que esté primero en las opciones y que contenga todo junto»). Es la key
  // `perfil` (la ven todos los roles) con otro nombre: abre «Perfil», la primera sección, y se enciende en TODAS las de Settings.
  // «Business settings» e «Integrations» quedan como SECCIONES de Settings (`soloSeccion`): no se dibujan en el menú, y sus keys
  // siguen siendo la puerta de sus páginas (`requireRolWs([], { nav: 'configuraciones' })`, las capas).
  { key: 'perfil', label: 'Settings', href: '/perfil', icon: 'tuerca', rolesWs: ['closer', 'setter'], match: (p) => starts('/perfil')(p) || starts('/configuraciones')(p) || starts('/equipo')(p) || starts('/metodo')(p) || starts('/integraciones')(p) },
  // MaKo Partners (20/10/2026, feedback del 18/10 pt 10; Martín: «"MaKo Partners" debería ir dentro del desplegable del
  // perfil, no como una tab»). Desde el 24/10/2026 la ve el ADMIN de CUALQUIER negocio, no sólo el de una agencia
  // (Martín: «la tab de MaKo Partners para clientes»): cualquier negocio con plan recomienda MaKo, y era la única puerta
  // a su tablero (/partners/referidos) — con `soloCapas: ['agencia']` un cliente sólo llegaba tipeando la URL. Sin
  // `rolesWs`, el closer y el setter no la ven (`puedeVerItem`). La página reparte: la agencia, su cartera; el resto, sus
  // referidos (app/partners/page.tsx).
  { key: 'partners', label: 'MaKo Partners', href: '/partners', icon: 'comunidad', noEnPlataforma: true, noParaClienteDeAgencia: true, match: starts('/partners') },
  // Agency Dashboard (25/10/2026, docs/feedback-25-10-tarde.md punto 9: «otra tab abajo de "Partners"»): la landing para
  // sumarse como Agency (sólo con el plan Pro activo) y, ya sumada, las cuentas de MaKo de sus clientes. La cartera vivía
  // en /partners; Partners quedó para los referidos. Sin `rolesWs`: sólo el admin, como Partners (app/agency/page.tsx).
  // PARTNERS Y AGENCY, DEBAJO DE SETTINGS (6/11/2026, llamada con Leila del 5/11: «acceso más visible desde el menú de
  // perfil»). Agency iba cuarto, después de API, y una agencia no lo encontraba. Subió el PAR: Settings sigue primero (24/10)
  // y Agency sigue «abajo de Partners» (25/10, el pedido de arriba).
  { key: 'agency', label: 'Agency Dashboard', href: '/agency', icon: 'users', noEnPlataforma: true, match: starts('/agency') },
  { key: 'integraciones', label: 'Integrations', href: '/integraciones', icon: 'integraciones', soloSeccion: true, match: (p) => starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  // La API de MaKo (08/10/2026): el catálogo, los tokens de cada integración y su uso.
  // Al lado de Integraciones porque es lo mismo visto desde afuera: con qué se conecta
  // un tercero. Solo el admin (sin `rolesWs`): acá se acuñan credenciales.
  { key: 'api-mako', label: 'API', href: '/api-mako', icon: 'api', match: starts('/api-mako') },
  // «Onboarding» salió de acá el 15/10/2026: el hub de diez pestañas que abría se retiró y sus secciones se
  // editan en Second Brain (lib/secciones-negocio.ts), que ya está en la barra. /onboarding sigue siendo el
  // wizard del primer ingreso, y a ése no se entra desde un menú: lo manda lib/tab-access.ts.
  { key: 'configuraciones', label: 'Business settings', href: '/configuraciones', icon: 'tuerca', soloSeccion: true, match: (p) => starts('/configuraciones')(p) || starts('/metodo')(p) || starts('/equipo')(p) || starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  // Acá NO va «Admin» ni «Contexto de MaKo». Los dos eran `adminOnly`, o sea que
  // solo los veía el super admin — que ahora tiene su propia familia Admin en la
  // barra, con Clientes adentro. Repetirlos detrás del avatar era darle dos
  // puertas a lo mismo, y este menú es la cuenta de QUIEN sos, no las
  // herramientas de la agencia.
  // Reportar un problema vive acá y no en la barra: no es un destino de trabajo,
  // es a dónde vas cuando algo se rompió. Al lado de las tabs competiría todo el
  // día con lo que sí estás haciendo; en el menú del perfil está donde todo el
  // mundo lo busca, junto a la cuenta y arriba de «Cerrar sesión».
  // Desde el 17/10/2026 existe (docs/diseno-ticketera-usuarios.md): la ven TODOS los roles y todas las capas.
  { key: 'tickets', label: 'Report a problem', href: '/tickets', icon: 'soporte', rolesWs: ['closer', 'setter'], match: starts('/tickets') },
];

/** Todos los ítems de producto, aplanados (para buscar por key o por ruta). */
/**
 * PANTALLAS SIN FILA (17/10/2026): páginas VIVAS que dejaron de ser una fila de la barra, pero cuya key sigue siendo la
 * puerta de algo. No se dibujan (no están en ninguna familia); están acá para que lo que pregunta por su key o su ruta
 * conteste lo mismo que antes:
 *   · el teléfono abre /m/second-brain/mapa y /m/experimentos con `requireMovil({ navKey })`, que busca la key EN ESTA
 *     LISTA (lib/movil-rutas.ts → puedeVerKey): sin el ítem, la puerta se cierra para todos, sin error;
 *   · el título de la pestaña (lib/titulo-tab.ts) y las capacidades de la API de MaKo (lib/api-mako/areas/mako.run.ts)
 *     buscan el PRIMER ítem cuyo `match` acepta la ruta: por eso van ANTES que el resto, con el `match` de siempre, y
 *     /whatsapp sigue diciendo «WhatsApp» aunque la barra marque Chats.
 * Las de siempre: el Mapa del Second Brain (key `second-brain`, sólo el admin; antes la fila de Analyze), Experiments (se va
 * al chat de MaKo, lo lleva el jefe «Dashboard»), WhatsApp y Email (se configuran desde Chats); y desde el 29/10/2026 el Video Generator
 * (una plantilla de «Nuevo video»).
 */
export const SIN_FILA: NavItem[] = [
  // «Home» (/general) desde el 17/10/2026 noche: redirige al Dashboard, a su hoja fija «Focus». La key `general` queda
  // (capas, onboarding por tab); la barra marca Dashboard (su match acepta /general y /focus).
  { key: 'general', label: 'General', href: '/general', icon: 'general', match: (p) => starts('/general')(p) || starts('/focus')(p) },
  // «Ops Center» desde el 18/10/2026, como su fila (MAKO_NAV): es el PRIMER match de /second-brain, así que de acá sale el
  // título de la pestaña.
  { key: 'second-brain', label: 'Ops Center', jefe: 'Second Brain', href: '/second-brain', icon: 'cerebro', match: starts('/second-brain') },
  // Análisis vivía adentro de Experiments desde el 11/10/2026 (/experimentos?tab=analisis); /analisis redirige ahí.
  // Desde el 17/10/2026 /experimentos sólo redirige al Dashboard (y /analisis, el informe del trimestre incluido, es del
  // Dashboard): el ítem queda por la puerta de las dos redirecciones, que piden esta key.
  { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: starts('/experimentos') },
  // Curso y Comunidad: sub-tabs de Classroom (era Clients) desde el 17/10/2026. Sus pantallas del teléfono abren
  // con estas keys (`requireMovil({ navKey })`).
  { key: 'cs-curso', label: 'Classroom', href: '/classroom', icon: 'video', match: (p) => p === '/classroom' || starts('/classroom/preview')(p) || starts('/clients/classroom')(p) || starts('/customer-success/curso')(p) },
  { key: 'cs-comunidad', label: 'Community', href: '/classroom/community', icon: 'comunidad', match: (p) => starts('/classroom/community')(p) || starts('/clients/community')(p) || starts('/customer-success/comunidad')(p) },
  { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
  { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
  // El Video Generator (Flow) desde el 29/10/2026: ya no es una pestaña de Video («no quiero otras tabs»), es la plantilla
  // «Generar con IA» de «Nuevo video». La pantalla sigue viva y su key es la puerta de la API (`gating.tab`), de las
  // creaciones (`formato_video`) y del teléfono (/m/video).
  { key: 'video-generator', label: 'Video Generator', href: '/video-generator', icon: 'videogen', match: starts('/video-generator') },
  // AI Avatar desde el 9/11/2026 (Martín: «unificar las tabs… en UNA tab llamada Video»): deja de ser una fila de Create y su
  // estudio es «Tu personaje con IA», una plantilla de «Nuevo video» y el paso del personaje de una plantilla guiada
  // (docs/relevo/nube-tab-video.md §1). La key queda viva: la piden su pantalla (app/ai-avatar/acceso.ts), la API
  // (`ver_plantillas_avatar`), las capas y el teléfono. La historia de la fila: 17/10 HeyGen, 29/10 «replica a higgsfield tal
  // cual» para todos los planes.
  { key: 'ai-avatar', label: 'AI Avatar', href: '/ai-avatar', icon: 'perfil', match: starts('/ai-avatar') },
  // Las que eran secciones de Copywriting hasta el 29/10/2026 (ver la fila de Copywriting en FAMILIAS): sin fila, con su key
  // viva. El Ads Writer sigue andando por su ruta (la matriz, «Analizar guion» y los links de MaKo); Stories y YouTube
  // Writer redirigen al Copywriter. La API (`gating.tab: 'ads-writer'`) y las capas las siguen pidiendo.
  { key: 'ads-writer', label: 'Ads Writer', href: '/ads-writer', icon: 'escribir', match: (p) => starts('/ads-writer')(p) || starts('/content-machine')(p) },
  { key: 'stories', adminOnly: true, label: 'Stories', href: '/stories', icon: 'stories', match: starts('/stories') },
  // YouTube Writer e Ideas siguen «pronto» como keys: sus páginas las piden (`requireRolWs`) y el teléfono abre
  // /m/pronto/<key>. En la computadora /youtube-writer ya lleva al template de YouTube del Copywriter; /ideas sigue siendo
  // el «Coming soon» del super admin. Retirarlas del teléfono va con /m/stories (docs/relevo/copywriter.md).
  { key: 'youtube-writer', adminOnly: true, label: 'YouTube Writer', href: '/youtube-writer', icon: 'escribir', comingSoon: true, match: starts('/youtube-writer') },
  { key: 'ideas', adminOnly: true, label: 'Ideas', href: '/ideas', icon: 'idea', comingSoon: true, match: starts('/ideas') },
];

// ⚠️ Sin las herramientas del super admin aunque cuelguen como secciones de una tab: son de ADMIN_NAV, como antes del
// 17/10/2026. Así lo que pregunta por un ítem de producto (el teléfono, la API de MaKo) no cambia de respuesta.
const ES_HERRAMIENTA: ReadonlySet<NavItem> = new Set<NavItem>(Object.values(HERRAMIENTAS));
export const TODOS_LOS_ITEMS: NavItem[] = [...SIN_FILA, ...FAMILIAS.flatMap(itemsDe).filter((it) => !ES_HERRAMIENTA.has(it)), ...PRONTO, ...MAKO_NAV];
