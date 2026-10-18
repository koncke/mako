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
   * El ícono es una CRIATURA del Ops Center (app/admin/operaciones/Muneco.tsx), no un dibujo de icons.tsx: el nombre
   * del empleado cuyo muñeco se dibuja («Ops Center», «Second Brain»). Es el mismo muñeco que tiene ese chat en el
   * Centro, porque el aspecto sale del nombre (lib/centro-munecos.ts → aspectoDe). Se mueve: flota y parpadea.
   */
  criatura?: string;
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
 *   · el método de redacción → Copywriting
 *   · Ops Center arriba de todo (con la Ticketera adentro) · Cobros, el agente de los clientes, Contexto, Modelos IA,
 *     Conocimientos y Dev → menú de la foto (Cobros y Agents iban en Clients; su jefe las mandó acá: viven fuera de
 *     /clients y son de la plataforma, no de los clientes del negocio).
 * El porqué de cada una, en docs/diseno-sidebar.md. NINGUNA RUTA CAMBIÓ: cada página conserva su guard
 * (getSesionAdmin, puedeOperar) y `adminOnly` sigue siendo cosmético.
 *
 * ⚠️ Las keys no llevan el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros), y ninguna repite la de una
 * tab del producto: la del método de redacción era `copywriting`, la MISMA que la tab Copywriting, y colgada como su
 * sección habría escondido a la tab en el teléfono (lib/movil-rutas.ts la busca por key). Por eso es `admin-copywriting`.
 */
const HERRAMIENTAS = {
  // El cerebro de redacción de MaKo (la metodología y el swipe de ejemplos con que redacta). Era la tercera sub-tab de
  // /admin y tiene ruta propia desde el 27/09. Su casa: Copywriting, la tab donde se escribe.
  copywriting: { key: 'admin-copywriting', label: 'Copy Method', seccion: 'Method', href: '/admin/copywriting', icon: 'escribir', adminOnly: true, match: starts('/admin/copywriting') },
  // Canal propio de MaKo: su línea de WhatsApp por QR y sus grupos. NO es preview de ningún cliente. Su casa: Chats,
  // donde se conversa (el WhatsApp de cada cliente se ve en SU Chats).
  agencia: { key: 'agencia', label: 'MaKo WhatsApp', seccion: 'MaKo WhatsApp', href: '/agencia', icon: 'whatsapp', adminOnly: true, match: starts('/agencia') },
  // Los ~48 mensajes que MaKo le puede mandar al dueño: se ven como llegan, se editan y se prenden/apagan. Su casa:
  // Automations (AGENTS.md → «Un Mensaje de MaKo ES una automatización»). «Plantillas» a secas no se entiende solo.
  mensajes: { key: 'mensajes', label: 'MaKo Messages', seccion: 'MaKo Messages', href: '/mensajes', icon: 'mako', adminOnly: true, match: starts('/mensajes') },
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
  // Con qué sabe y con qué piensa MaKo, y la formación del equipo: la configuración de la PLATAFORMA. Van al menú de la
  // foto del super admin (`SUPERADMIN_MENU`).
  contexto: { key: 'contexto', label: 'MaKo Context', href: '/contexto', icon: 'contexto', adminOnly: true, match: starts('/contexto') },
  modelosIa: { key: 'modelos-ia', label: 'AI Models', href: '/modelos-ia', icon: 'mako', adminOnly: true, match: starts('/modelos-ia') },
  // Portal de formación interna (curso AVATARHYPE) — capa oscura autocontenida.
  conocimientos: { key: 'conocimientos', label: 'Knowledge', href: '/conocimientos', icon: 'contexto', adminOnly: true, match: starts('/conocimientos') },
  // Dev es un MODO, no una carpeta: este link te lleva y allá la barra se reemplaza entera por la de desarrollo
  // (Sidebar → familiasDev). Era la única puerta de la interfaz al modo: por eso va al menú de la foto.
  dev: { key: 'dev-entrar', label: 'Dev', href: '/admin/dev', icon: 'config', adminOnly: true, match: starts('/admin/dev') },
} satisfies Record<string, NavItem>;

export const FAMILIAS: NavFamilia[] = [
  {
    key: 'operate',
    label: 'Operate',
    pregunta: '¿Qué tengo que hacer y ejecutar hoy?',
    // Rayo = ejecutar. Los íconos de familia tienen que distinguirse en el rail plegado, donde trabajan solos.
    icon: 'rayo',
    notifica: true,
    bloques: [
      // Lo tuyo: dónde estás parado, qué te toca y cómo viene.
      [
        // Cuando exista la pantalla con sus seis campos (prioridad, razón,
        // resultado esperado, responsable, progreso y próxima revisión, tarea
        // #523) este item pasa a ser ella; la key `general` se queda porque está
        // escrita en la base.
        { key: 'general', label: 'General', href: '/general', icon: 'general', match: (p) => starts('/general')(p) || starts('/focus')(p) },
        { key: 'todo', label: 'Plan', href: '/plan', icon: 'todo', rolesWs: ['closer', 'setter'], match: (p) => starts('/plan')(p) || starts('/todo')(p) },
        // El Calendario (13/10/2026, Martín: «que sea en otra tab, no en GENERAL»): publicaciones, llamadas, bloques
        // de trabajo, los deadlines del Plan y el Quarter. Sólo el admin: dibuja la agenda de Google del negocio.
        // «Calendar» desde el 17/10/2026 (Martín: «"Calendario" debería ser "Calendar": siempre todo en inglés los
        // nombres de las tabs»). La key `calendario` y la ruta /calendario NO cambian: la key está en las capas.
        { key: 'calendario', label: 'Calendar', href: '/calendario', icon: 'calendario', match: starts('/calendario') },
        // El Dashboard vino de Analyze el 17/10/2026 (Martín: «Dashboard debería estar dentro de la sección "Operate",
        // ya que se quedaría sola "analize", y la deprecamos»). Va al lado de General: es cómo viene lo tuyo.
        // El CLOSER lo ve desde el 11/10/2026 (decisión 6 de Martín): Closing Analyst se retiró y su
        // análisis, con la ficha de cada llamada y sus tareas, es la hoja «Closing» del Dashboard. Ve
        // SÓLO esa hoja y sin editar: lo pone app/dashboard/page.tsx (un informe en memoria) y lo
        // cierra /api/graficos (`puedePedir`, lib/graficos-plantillas.ts). Y el SETTER desde el 12/10/2026
        // (tanda v5): ve SÓLO la hoja «Chat Analyst», que reemplazó a /chat-analyst — la misma regla, en
        // `HOJA_DE_ROL`. La key sigue siendo `graphics`; las de Closing (`closing`) y WhatsApp (`whatsapp`)
        // son las de las capas que cada hoja pide.
        // ⚠️ Los Analysts se fueron el 11 y 12/10/2026, todos a hojas del Dashboard: Productivity (hoja «Productividad»),
        // Ads (key `script`), Landing (`landing-an`), Closing (`closing`), VSL (`vsl-an`), CS (`cs-analyst`) y Chat
        // (`chat-analyst`, la del setter; lib/graficos-plantillas-analysts.ts). Sus rutas REDIRIGEN a `/dashboard?hoja=<id>`
        // (hay links afuera que nadie puede editar) y que nadie vuelva a enlazarlas lo cuida tests/tabs-retiradas.test.ts.
        { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', rolesWs: ['closer', 'setter'], match: (p) => starts('/dashboard')(p) || starts('/marketing')(p) || starts('/comercial')(p) || starts('/graficos')(p) || starts('/analisis')(p) },
      ],
      // La máquina: lo que trae gente, le habla y la mueve.
      [
        { key: 'crm', label: 'CRM', href: '/crm', icon: 'crm', rolesWs: ['closer', 'setter'], match: starts('/crm') },
        // Chats (14/10/2026, Martín: «tener en UNA sola tab centralizado absolutamente todos los chats, WhatsApp,
        // Instagram, Messenger»): la bandeja copiada de respond.io (docs/diseno-chats.md).
        // ⚠️ DESDE EL 17/10/2026 ES LA ÚNICA TAB DE CONVERSACIONES (Martín: «eliminar las tabs de "Email y WhatsApp" y
        // unificarlo todo en "Chats"»). Las keys `whatsapp` y `email` siguen vivas en las capas y en el guard de sus
        // páginas (lo que configura cada canal: conectar un número, el dominio y las secuencias de email); dejaron de
        // ser tabs. Ver `RUTAS_DE_CHATS` abajo y docs/diseno-sidebar.md §Chats.
        // La TAB Instagram salió el 06/10/2026 (0 DMs en su historia) y no vuelve: /instagram redirige a /automations.
        // Lo que SÍ vuelve, el 14/10/2026, son sus DMs y los de Messenger, ADENTRO de Chats (tests/sin-instagram.test.ts).
        {
          key: 'bandeja', label: 'Chats', href: '/chats', icon: 'chats',
          match: (p) => starts('/chats')(p) || RUTAS_DE_CHATS.some((r) => starts(r)(p)) || starts('/agencia')(p),
          secciones: [
            { key: 'chats', label: 'Chats', seccion: 'Chats', href: '/chats', icon: 'chats', rolesWs: ['closer', 'setter'], match: (p) => starts('/chats')(p) || RUTAS_DE_CHATS.some((r) => starts(r)(p)) },
            HERRAMIENTAS.agencia,
          ],
        },
        { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: 'grid', match: starts('/ads-manager') },
      ],
      // Después de la venta: los clientes, su curso y su comunidad. Vino de la familia Customer Success el 17/10/2026
      // (una tab, «Clients», adentro de Operate; la arma el jefe «Clients»).
      [
        // «Clients» (17/10/2026, jefe «Clients»: docs/diseno-clients.md): UNA tab, con sus sub-tabs ADENTRO de la pantalla
        // (Clients · Community · Classroom · Calendar · Members · Leaderboards · About, app/clients/ClientsShell.tsx). Sin
        // `secciones` a propósito: SeccionesTab dibujaría una segunda barra debajo de la suya.
        // ⚠️ LA KEY ES `customer-success`, la que pide el guard (`requireCapa('customer-success')`) y nombran las capas.
        // Las rutas viejas (/customer-success, /curso, /comunidad) redirigen a /clients; el match las acepta.
        { key: 'customer-success', label: 'Clients', href: '/clients', icon: 'users', match: (p) => starts('/clients')(p) || starts('/customer-success')(p) },
        // «MaKo Partners» (17/10/2026): el programa de agencias. Sólo lo ve el ADMIN de un workspace AGENCIA (capa
        // 'agencia') y el super admin (`soloCapas`); la página se cuida sola en el server (lib/agencia.ts → esAgencia).
        { key: 'partners', label: 'MaKo Partners', href: '/partners', icon: 'comunidad', soloCapas: ['agencia'], match: starts('/partners') },
      ],
    ],
  },
  {
    // Todo lo que construye la máquina de VENDER: la oferta, lo que captura, lo que conversa y las piezas.
    // Desde el 17/10/2026 trae adentro lo que era Content Machine (Martín: «elimina "Content Machine" y que todo esté
    // dentro de "Sales Machine"»): Video, Image y Copywriting son las piezas que la venta necesita.
    key: 'create',
    label: 'Sales Machine',
    pregunta: '¿Qué necesito para vender?',
    icon: 'sales',
    bloques: [
      // La OFERTA va primero: es lo que todo lo de abajo vende. Vino de Analyze el 12/10/2026 (Martín: «Pon Offer en
      // Sales Machine»). Desde el 11/10 une Offer Analyst y Offer Generator en UNA tab: diagnostica la oferta y la
      // ESCRIBE de nuevo (con su PDF). ⚠️ La key 'offer' es la de siempre (contrato con la base: capas y
      // onboarding); el match acepta /offer-analyst porque esa ruta vieja redirige acá y sigue en links que salieron.
      [
        {
          key: 'oferta', label: 'Offer', href: '/offer', icon: 'tag',
          match: (p) => starts('/offer')(p) || starts('/offer-analyst')(p) || starts('/admin/estrategia')(p) || starts('/admin/offer-playbook')(p),
          secciones: [
            { key: 'offer', label: 'Offer', seccion: 'Offer', href: '/offer', icon: 'tag', match: (p) => starts('/offer')(p) || starts('/offer-analyst')(p) },
            HERRAMIENTAS.estrategia,
            HERRAMIENTAS.offerPlaybook,
          ],
        },
      ],
      // Capturar y conversar: lo que trae al lead y lo que le habla una vez que entró.
      [
        // Pedido de Martín (15/10/2026, feedback de la tanda 6, punto 1): «Quiero que todo se llame
        // ahora "Web Generator", la ruta, en la sidebar, todo...». La key sigue siendo
        // `landing-writer`; /landing-generator y /landing-writer redirigen y siguen marcando la tab
        // (salen de UNA lista, la que cuida tests/web-generator-renombre.test.ts).
        { key: 'landing-writer', label: 'Web Generator', href: RUTA_WEB_GENERATOR, icon: 'web', match: (p) => starts(RUTA_WEB_GENERATOR)(p) || RUTAS_VIEJAS_WEB_GENERATOR.some((r) => starts(r)(p)) },
        // «Automations» desde el 09/10/2026 (Martín: «Cambia el nombre de la tab "Chatbot" por
        // "Automations", el nombre en la sidebar, la ruta, todo»). La KEY sigue siendo `setting`
        // y el ícono `chatbot`: están escritos en la base (capas, roles, onboarding.tab.setting).
        // Las URLs viejas (/chatbot, /chat-bot, /chat-agent) redirigen y siguen marcando la tab:
        // salen de UNA lista, la misma que cuida tests/ruta-automations.test.ts.
        // Desde el 17/10/2026 también marca /mensajes (los Mensajes de MaKo, que SON automatizaciones del ws de la
        // plataforma: AGENTS.md → «Un Mensaje de MaKo ES una automatización»). Salieron de la familia Admin.
        {
          key: 'automatizaciones', label: 'Automations', href: RUTA_AUTOMATIONS, icon: 'chatbot',
          match: (p) => starts(RUTA_AUTOMATIONS)(p) || RUTAS_VIEJAS_AUTOMATIONS.some((r) => starts(r)(p)) || starts('/mensajes')(p),
          secciones: [
            { key: 'setting', label: 'Automations', seccion: 'Automations', href: RUTA_AUTOMATIONS, icon: 'chatbot', rolesWs: ['setter'], match: (p) => starts(RUTA_AUTOMATIONS)(p) || RUTAS_VIEJAS_AUTOMATIONS.some((r) => starts(r)(p)) },
            HERRAMIENTAS.mensajes,
          ],
        },
      ],
      // Las piezas (lo que era Content Machine). Son TABS UNIFICADAS (`secciones`, 12/10/2026, Martín: «Que sean
      // 3 tabs funcionales que todo mundo reconoce y MaKo le agrega generación con IA»): Video = el lienzo tipo CapCut
      // + crear con IA + Reels; Image = la copia de Canva + Image Generator + Thumbnails + Carousels; Copywriting =
      // Ideas + Ads Writer + YouTube Writer + Stories. Cada herramienta sigue con su key, su ruta y su `adminOnly`.
      [
        {
          key: 'video', label: 'Video', href: '/video-editor', icon: 'videogen',
          match: (p) => starts('/video-editor')(p) || starts('/video-generator')(p) || starts('/reels')(p),
          secciones: [
            // La copia de CapCut. Abierta a todos desde el 12/10/2026; quién entra lo decide
            // app/video-editor/acceso.ts (la misma pregunta que toda tab: rol y capa).
            { key: 'video-editor', label: 'Video Editor', seccion: 'Editor', href: '/video-editor', icon: 'tijera', match: starts('/video-editor') },
            { key: 'video-generator', label: 'Video Generator', seccion: 'Create with AI', href: '/video-generator', icon: 'videogen', match: starts('/video-generator') },
            { key: 'reels', adminOnly: true, label: 'Reels', href: '/reels', icon: 'videogen', match: starts('/reels') },
          ],
        },
        {
          // 17/10/2026, Martín: «implementes end-to-end la tab nueva de "AI Avatar"… algo como Heygen… una
          // "galería" de ejemplos o temas… en imagen, video y voz». Las cuatro secciones copian las de HeyGen.
          // La ve sólo el super admin hasta que la valide: `adminOnly` acá y la puerta en app/ai-avatar/acceso.ts. En Sales
          // Machine desde el día que nació (Content Machine se fue el mismo 17/10), y sus secciones en inglés, como toda tab.
          key: 'ai-avatar', adminOnly: true, label: 'AI Avatar', href: '/ai-avatar', icon: 'perfil',
          match: starts('/ai-avatar'),
          secciones: [
            { key: 'ai-avatar-crear', adminOnly: true, label: 'Create video', href: '/ai-avatar', icon: 'videogen', match: (p) => p === '/ai-avatar' || p === '/ai-avatar/' },
            { key: 'ai-avatar-avatares', adminOnly: true, label: 'Avatars', href: '/ai-avatar/avatares', icon: 'perfil', match: starts('/ai-avatar/avatares') },
            { key: 'ai-avatar-voces', adminOnly: true, label: 'Voices', href: '/ai-avatar/voces', icon: 'mic', match: starts('/ai-avatar/voces') },
            { key: 'ai-avatar-plantillas', adminOnly: true, label: 'Templates', href: '/ai-avatar/plantillas', icon: 'grid', match: starts('/ai-avatar/plantillas') },
          ],
        },
        {
          key: 'image', label: 'Image', href: '/image-editor', icon: 'imagegen',
          match: (p) => starts('/image-editor')(p) || starts('/image-generator')(p) || starts('/thumbnails')(p) || starts('/carousels')(p),
          secciones: [
            // La copia de Canva (14/10/2026): Doory portado y re-vestido como Canva. Abierta a todos
            // los workspaces el 15/10/2026 («Que Image aparezca en todos los workspace»), como el Video Editor el
            // 12/10: quién entra lo decide app/image-editor/acceso.ts con la pregunta de toda tab (rol y capa).
            // Image Generator y Thumbnails siguen `comingSoon`: se ven, con su «pronto», y abren «Próximamente».
            { key: 'image-editor', label: 'Image Editor', seccion: 'Editor', href: '/image-editor', icon: 'imagegen', match: starts('/image-editor') },
            { key: 'image-generator', label: 'Image Generator', seccion: 'Create with AI', href: '/image-generator', icon: 'imagegen', comingSoon: true, match: starts('/image-generator') },
            { key: 'thumbnails', label: 'Thumbnails', href: '/thumbnails', icon: 'thumbnail', comingSoon: true, match: starts('/thumbnails') },
            { key: 'carousels', label: 'Carousels', href: '/carousels', icon: 'carousel', match: starts('/carousels') },
          ],
        },
        {
          key: 'copywriting', label: 'Copywriting', href: '/ads-writer', icon: 'escribir',
          match: (p) => starts('/ideas')(p) || starts('/ads-writer')(p) || starts('/content-machine')(p) || starts('/youtube-writer')(p) || starts('/stories')(p) || starts('/admin/copywriting')(p),
          secciones: [
            { key: 'ideas', adminOnly: true, label: 'Ideas', href: '/ideas', icon: 'idea', comingSoon: true, match: starts('/ideas') },
            // ⚠️ «Ads Writer» sigue apuntando a /ads-writer: su propio código ya declara /content-machine como
            // destino. Cuando aterrice, esto es cambiar el href.
            { key: 'ads-writer', label: 'Ads Writer', href: '/ads-writer', icon: 'escribir', match: (p) => starts('/ads-writer')(p) || starts('/content-machine')(p) },
            { key: 'youtube-writer', adminOnly: true, label: 'YouTube Writer', href: '/youtube-writer', icon: 'escribir', comingSoon: true, match: starts('/youtube-writer') },
            { key: 'stories', adminOnly: true, label: 'Stories', href: '/stories', icon: 'stories', match: starts('/stories') },
            HERRAMIENTAS.copywriting,
          ],
        },
      ],
    ],
    // LAS «PRONTO», EN UN DESPLEGABLE (17/10/2026). Todas son `adminOnly` desde el 11/10/2026 (Martín: «elimina todas
    // las tabs con "pronto", que solo sean visibles en super admin»), así que un cliente no ve el desplegable (se filtra
    // vacío). El super admin las tenía sueltas en la barra, y con Content Machine y Competitor Spy adentro eran siete
    // filas de «pronto» entre las que se usan: la barra pasaba el alto de una pantalla de 768 px y scrolleaba (regla de
    // la casa: la sidebar NUNCA scrollea, docs/hallazgos-ui.md). En un desplegable cuestan una fila.
    grupos: [
      {
        key: 'pronto', label: 'Coming soon', icon: 'reloj',
        items: [
          { key: 'vsl-writer', adminOnly: true, label: 'VSL Generator', href: '/vsl-generator', icon: 'video', comingSoon: true, match: (p) => starts('/vsl-generator')(p) || starts('/vsl-writer')(p) },
          { key: 'lead-magnet-generator', adminOnly: true, label: 'Lead Magnet Generator', href: '/lead-magnet-generator', icon: 'leadmagnet', comingSoon: true, match: starts('/lead-magnet-generator') },
          { key: 'sales-email', adminOnly: true, label: 'Sales Email', href: '/sales-email', icon: 'salesemail', comingSoon: true, match: starts('/sales-email') },
          { key: 'newsletters', adminOnly: true, label: 'Newsletters', href: '/newsletters', icon: 'newsletter', comingSoon: true, match: starts('/newsletters') },
          { key: 'closing-script', adminOnly: true, label: 'Closing Script', href: '/closing-script', icon: 'closingscript', comingSoon: true, rolesWs: ['closer'], match: starts('/closing-script') },
          { key: 'sales-roleplay', adminOnly: true, label: 'Sales Roleplay', href: '/sales-roleplay', icon: 'roleplay', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/sales-roleplay') },
          // Vino de Analyze el 17/10/2026. Sólo el super admin desde el 12/10/2026 (Martín: «Elimina "Competitors
          // Spy" y que solo se vea en super admin»): vigila lo que hacen los demás.
          { key: 'market-an', adminOnly: true, label: 'Competitor Spy', href: '/competitor-spy', icon: 'spy', comingSoon: true, match: (p) => starts('/competitor-spy')(p) || starts('/market-analyst')(p) },
        ],
      },
    ],
  },
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
export const MAKO_NAV: NavItem[] = [
  { key: 'mako', label: 'Second Brain', href: '/second-brain', icon: 'cerebro', criatura: 'Second Brain', rolesWs: ['closer', 'setter'], match: (p) => starts('/second-brain')(p) || starts('/mako')(p) || starts('/mako-doer')(p) },
];

/**
 * El Centro de Operaciones (15/10/2026): pedidos firmados para los chats de Claude de la PC de Martín. «Ops Center»
 * (Martín, 17/10/2026: «Me gustaría que quede el nombre de "Ops Center"»): la misma pantalla que /second-brain para el
 * super admin (app/second-brain/pagina.tsx), con la Ticketera adentro (`?ticketera=`). Por eso también marca
 * /tickets/decisiones, la ruta vieja de la Ticketera, que redirige acá. `adminOnly` es cosmético: la puerta real es
 * `puedeOperar` en la página. La key no lleva el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros).
 */
export const OPS_CENTER: NavItem = {
  key: 'admin-operaciones', label: 'Ops Center', href: '/admin/operaciones', icon: 'config', criatura: 'Ops Center', adminOnly: true,
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
  HERRAMIENTAS.cobros, HERRAMIENTAS.agente,
  HERRAMIENTAS.contexto, HERRAMIENTAS.modelosIa, HERRAMIENTAS.conocimientos, HERRAMIENTAS.dev,
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
          { key: 'dev-calendario', label: 'Calendario', href: '/admin/dev/calendario', icon: 'calendario', match: starts('/admin/dev/calendario') },
          { key: 'dev-chats', label: 'Chats', href: '/admin/dev/chats', icon: 'chats', match: starts('/admin/dev/chats') },
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
          { key: 'dev-auth-session', label: 'Auth & Session', href: '/admin/dev/auth-session', icon: 'config', match: starts('/admin/dev/auth-session') },
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
          { key: 'dev-payment-gateway', label: 'Payment Gateway', href: '/admin/dev/payment-gateway', icon: 'tag', match: starts('/admin/dev/payment-gateway') },
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
          { key: 'dev-centro-operaciones', label: 'Centro de Operaciones', href: '/admin/dev/centro-operaciones', icon: 'config', match: starts('/admin/dev/centro-operaciones') },
          // Va pegada a VSL Tracking porque son las dos puntas del mismo bucle:
          // aquélla MIDE dónde se cae la curva, ésta escribe el guion que se
          // reescribe con ese dato. Hoy la pantalla es un ComingSoon; el registro
          // existe igual, que es justamente para no volver a arrancar de cero.
          { key: 'dev-vsl-generator', label: 'VSL Generator', href: '/admin/dev/vsl-generator', icon: 'video', match: starts('/admin/dev/vsl-generator') },
          // La copia de CapCut (11/10/2026): el pedido textual y las tandas del port.
          { key: 'dev-video-editor', label: 'Video Editor', href: '/admin/dev/video-editor', icon: 'tijera', match: starts('/admin/dev/video-editor') },
          { key: 'dev-image-editor', label: 'Image Editor', href: '/admin/dev/image-editor', icon: 'imagegen', match: starts('/admin/dev/image-editor') },
          { key: 'dev-puente-flow', label: 'Puente a Google Flow', href: '/admin/dev/puente-flow', icon: 'videogen', match: starts('/admin/dev/puente-flow') },
          { key: 'dev-ai-avatar', label: 'AI Avatar', href: '/admin/dev/ai-avatar', icon: 'perfil', match: starts('/admin/dev/ai-avatar') },
          // La Ticketera de los usuarios (17/10/2026): el área se llama como su jefe; el slug es el de «Reportar problema».
          { key: 'dev-reportar-problema', label: 'Ticketera', href: '/admin/dev/reportar-problema', icon: 'soporte', match: starts('/admin/dev/reportar-problema') },
          // El editor de landings copiado de Gamma (11/10/2026): su registro lleva el pedido literal
          // de Martín y lo que quedó sin hacer (app/admin/dev/landing-generator/bitacora.ts).
          { key: 'dev-landing-generator', label: 'Web Generator', href: '/admin/dev/landing-generator', icon: 'web', match: starts('/admin/dev/landing-generator') },
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
  { key: 'perfil', label: 'Tu cuenta', href: '/perfil', icon: 'perfil', rolesWs: ['closer', 'setter'], match: starts('/perfil') },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icon: 'integraciones', soloSeccion: true, match: (p) => starts('/integraciones')(p) || starts('/marketing/salud')(p) },
  // La API de MaKo (08/10/2026): el catálogo, los tokens de cada integración y su uso.
  // Al lado de Integraciones porque es lo mismo visto desde afuera: con qué se conecta
  // un tercero. Solo el admin (sin `rolesWs`): acá se acuñan credenciales.
  { key: 'api-mako', label: 'API', href: '/api-mako', icon: 'api', match: starts('/api-mako') },
  // «Onboarding» salió de acá el 15/10/2026: el hub de diez pestañas que abría se retiró y sus secciones se
  // editan en Second Brain (lib/secciones-negocio.ts), que ya está en la barra. /onboarding sigue siendo el
  // wizard del primer ingreso, y a ése no se entra desde un menú: lo manda lib/tab-access.ts.
  { key: 'configuraciones', label: 'Configuración del negocio', href: '/configuraciones', icon: 'config', match: (p) => starts('/configuraciones')(p) || starts('/metodo')(p) || starts('/equipo')(p) || starts('/integraciones')(p) || starts('/marketing/salud')(p) },
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
  { key: 'tickets', label: 'Reportar problema', href: '/tickets', icon: 'soporte', rolesWs: ['closer', 'setter'], match: starts('/tickets') },
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
 * Las cuatro: el Mapa del Second Brain (key `second-brain`, sólo el admin; antes la fila de Analyze), Experiments (se va
 * al chat de MaKo, lo lleva el jefe «Dashboard»), WhatsApp y Email (se configuran desde Chats).
 */
export const SIN_FILA: NavItem[] = [
  { key: 'second-brain', label: 'Second Brain', href: '/second-brain', icon: 'cerebro', match: starts('/second-brain') },
  // Análisis vivía adentro de Experiments desde el 11/10/2026 (/experimentos?tab=analisis); /analisis redirige ahí.
  // Desde el 17/10/2026 /experimentos sólo redirige al Dashboard (y /analisis, el informe del trimestre incluido, es del
  // Dashboard): el ítem queda por la puerta de las dos redirecciones, que piden esta key.
  { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: starts('/experimentos') },
  // Curso y Comunidad: sub-tabs de Clients (Classroom y Community) desde el 17/10/2026. Sus pantallas del teléfono abren
  // con estas keys (`requireMovil({ navKey })`).
  { key: 'cs-curso', label: 'Classroom', href: '/clients/classroom', icon: 'video', match: (p) => starts('/clients/classroom')(p) || starts('/customer-success/curso')(p) },
  { key: 'cs-comunidad', label: 'Community', href: '/clients/community', icon: 'comunidad', match: (p) => starts('/clients/community')(p) || starts('/customer-success/comunidad')(p) },
  { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
  { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
];

// ⚠️ Sin las herramientas del super admin aunque cuelguen como secciones de una tab: son de ADMIN_NAV, como antes del
// 17/10/2026. Así lo que pregunta por un ítem de producto (el teléfono, la API de MaKo) no cambia de respuesta.
const ES_HERRAMIENTA: ReadonlySet<NavItem> = new Set<NavItem>(Object.values(HERRAMIENTAS));
export const TODOS_LOS_ITEMS: NavItem[] = [...SIN_FILA, ...FAMILIAS.flatMap(itemsDe).filter((it) => !ES_HERRAMIENTA.has(it)), ...MAKO_NAV];
