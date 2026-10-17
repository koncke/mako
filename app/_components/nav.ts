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
const FUENTE_CONTADOR: ReadonlyMap<string, FuenteContador> = new Map<string, FuenteContador>([['chats', 'mensajes'], ['whatsapp', 'mensajes'], ['crm', 'crm']]);
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
        // El Calendario (13/10/2026, Martín: «que sea en otra tab, no en GENERAL»): publicaciones, llamadas, bloques
        // de trabajo, los deadlines del Plan y el Quarter. Sólo el admin: dibuja la agenda de Google del negocio.
        { key: 'calendario', label: 'Calendario', href: '/calendario', icon: 'calendario', match: starts('/calendario') },
      ],
      // La máquina: lo que trae gente y lo que la mueve.
      [
        { key: 'crm', label: 'CRM', href: '/crm', icon: 'crm', rolesWs: ['closer', 'setter'], match: starts('/crm') },
        { key: 'ads-manager', label: 'Ads Manager', href: '/ads-manager', icon: 'grid', match: starts('/ads-manager') },
      ],
      // Las conversaciones. Sin desplegable: son de todos los días.
      // La TAB Instagram salió el 06/10/2026 (decisión de Martín: 0 DMs en su historia) y no vuelve:
      // /instagram redirige a /automations. Lo que SÍ vuelve, el 14/10/2026, son sus DMs y los de
      // Messenger, ADENTRO de Chats: la bandeja unificada (tests/sin-instagram.test.ts cuida las dos cosas).
      [
        // Chats (14/10/2026, Martín: «tener en UNA sola tab centralizado absolutamente todos los chats,
        // WhatsApp, Instagram, Messenger»): la bandeja copiada de respond.io (docs/diseno-chats.md). Va
        // PRIMERO porque es la que se usa todos los días; los mismos roles que WhatsApp, porque es el mismo
        // trabajo del setter. ⚠️ WhatsApp SIGUE abajo hasta que Martín valide que Chats lo reemplaza (plano
        // §6.1): después /whatsapp queda sólo para conectar números (QR, líneas, Chatbot) y sale del menú.
        { key: 'chats', label: 'Chats', href: '/chats', icon: 'chats', rolesWs: ['closer', 'setter'], match: starts('/chats') },
        { key: 'whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'whatsapp', rolesWs: ['closer', 'setter'], match: starts('/whatsapp') },
        { key: 'email', label: 'Email', href: '/email', icon: 'email', rolesWs: ['setter'], match: starts('/email') },
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
        // Análisis ya no es un ítem: el 11/10/2026 se mudó ADENTRO de Experiments, como su cuarta
        // tab (/experimentos?tab=analisis). /analisis redirige ahí con su query, y
        // /analisis/trimestre —el informe congelado, que se mandó por WhatsApp— vive donde
        // estaba: por eso el match de Experiments acepta las dos rutas, para que la barra marque
        // la tab y el título de la pestaña no caiga a «MaKo - Analisis» sin tilde.
        // El CLOSER lo ve desde el 11/10/2026 (decisión 6 de Martín): Closing Analyst se retiró y su
        // análisis, con la ficha de cada llamada y sus tareas, es la hoja «Closing» del Dashboard. Ve
        // SÓLO esa hoja y sin editar: lo pone app/dashboard/page.tsx (un informe en memoria) y lo
        // cierra /api/graficos (`puedePedir`, lib/graficos-plantillas.ts). Y el SETTER desde el 12/10/2026
        // (tanda v5): ve SÓLO la hoja «Chat Analyst», que reemplazó a /chat-analyst — la misma regla, en
        // `HOJA_DE_ROL`. La key sigue siendo `graphics`; las de Closing (`closing`) y WhatsApp (`whatsapp`)
        // son las de las capas que cada hoja pide.
        { key: 'graphics', label: 'Dashboard', href: '/dashboard', icon: 'graphics', rolesWs: ['closer', 'setter'], match: (p) => starts('/dashboard')(p) || starts('/marketing')(p) || starts('/comercial')(p) || starts('/graficos')(p) },
        // Sólo lo ve el super admin desde el 12/10/2026 (Martín: «Elimina "Competitors Spy" y que solo se vea en super admin»).
        // Salió de los Analysts: los demás analizan un activo PROPIO (un anuncio,
        // una landing, una llamada); éste vigila lo que hacen los demás.
        { key: 'market-an', adminOnly: true, label: 'Competitor Spy', href: '/competitor-spy', icon: 'spy', comingSoon: true, match: (p) => starts('/competitor-spy')(p) || starts('/market-analyst')(p) },
        { key: 'experimentos', label: 'Experiments', href: '/experimentos', icon: 'experiments', match: (p) => starts('/experimentos')(p) || starts('/analisis')(p) },
      ],
    ],
    // ⚠️ SIN `grupos` DESDE EL 12/10/2026 (tanda v5, punto 22; Martín: «elimina por completo el
    // desplegable de la sidebar principal de "analysts"»).
    // Era el desplegable «Analysts» y se vació de a poco, todo hacia hojas del Dashboard:
    //   · el 11/10, Productivity Analyst (hoja «Productividad»), Ads Analyst (key `script`: hoja «Ads
    //     Analyst»; valorar un guion se mudó a Ads Writer), Landing Analyst (key `landing-an`: hoja
    //     «Landing»; analizar una página, a Web Generator) y Closing Analyst (key `closing`: hoja
    //     «Closing», completa, y el closer ve el Dashboard);
    //   · el 12/10, los tres que quedaban, que eran «pronto»: VSL Analyst (key `vsl-an`), CS Analyst
    //     (`cs-analyst`) y Chat Analyst (`chat-analyst`, la del setter), hojas «VSL Analyst», «CS Analyst»
    //     y «Chat Analyst» (lib/graficos-plantillas-analysts.ts). El setter ve SÓLO la suya (`HOJA_DE_ROL`).
    // Sus rutas REDIRIGEN a `/dashboard?hoja=<id>` (hay links afuera que nadie puede editar). Las keys de los
    // tres de v5 NO se conservan: no estaban escritas en ninguna capa, onboarding ni test (medido, relevo E).
    // Las del 11/10 se quedan en lib/capas.ts y en los gating de la API. Que nadie vuelva a enlazar ninguna
    // ruta lo cuida tests/tabs-retiradas.test.ts.
  },
  {
    // Todo lo que construye la máquina de VENDER, en el orden del embudo: lo que
    // captura · lo que conversa · lo que cierra. Los tres bloques son esas tres
    // etapas, y por eso van separados.
    key: 'create',
    label: 'Sales Machine',
    pregunta: '¿Qué necesito para vender?',
    icon: 'sales',
    // Las tabs «pronto» (comingSoon) de esta familia llevan `adminOnly`: sólo las ve el super admin en su barra.
    // Martín (11/10/2026): «En la sidebar principal en la parte de "Sales Machine" elimina todas las tabs con
    // "pronto", que solo sean visibles en super admin». Un cliente (y el super admin mirando como cliente) no las ve.
    bloques: [
      // La OFERTA va primero: es lo que todo lo de abajo vende. Vino de Analyze el 12/10/2026 (Martín: «Pon Offer en
      // Sales Machine»). Desde el 11/10 une Offer Analyst y Offer Generator en UNA tab: diagnostica la oferta y la
      // ESCRIBE de nuevo (con su PDF). ⚠️ La key 'offer' es la de siempre (contrato con la base: capas y
      // onboarding); el match acepta /offer-analyst porque esa ruta vieja redirige acá y sigue en links que salieron.
      [
        { key: 'offer', label: 'Offer', href: '/offer', icon: 'tag', match: (p) => starts('/offer')(p) || starts('/offer-analyst')(p) },
      ],
      // Capturar: las piezas que traen y convierten al lead.
      [
        // Las keys NO cambiaron (están escritas en la base: capas y estado del
        // onboarding por tab). Lo que cambió es el nombre y la RUTA, para que
        // digan lo mismo. Las rutas viejas redirigen.
        // Pedido de Martín (15/10/2026, feedback de la tanda 6, punto 1): «Quiero que todo se llame
        // ahora "Web Generator", la ruta, en la sidebar, todo...». La key sigue siendo
        // `landing-writer`; /landing-generator y /landing-writer redirigen y siguen marcando la tab
        // (salen de UNA lista, la que cuida tests/web-generator-renombre.test.ts).
        { key: 'landing-writer', label: 'Web Generator', href: RUTA_WEB_GENERATOR, icon: 'web', match: (p) => starts(RUTA_WEB_GENERATOR)(p) || RUTAS_VIEJAS_WEB_GENERATOR.some((r) => starts(r)(p)) },
        { key: 'vsl-writer', adminOnly: true, label: 'VSL Generator', href: '/vsl-generator', icon: 'video', comingSoon: true, match: (p) => starts('/vsl-generator')(p) || starts('/vsl-writer')(p) },
        { key: 'lead-magnet-generator', adminOnly: true, label: 'Lead Magnet Generator', href: '/lead-magnet-generator', icon: 'leadmagnet', comingSoon: true, match: starts('/lead-magnet-generator') },
      ],
      // Conversar: lo que le habla al lead una vez que entró.
      [
        // «Automations» desde el 09/10/2026 (Martín: «Cambia el nombre de la tab "Chatbot" por
        // "Automations", el nombre en la sidebar, la ruta, todo»). La KEY sigue siendo `setting`
        // y el ícono `chatbot`: están escritos en la base (capas, roles, onboarding.tab.setting).
        // Las URLs viejas (/chatbot, /chat-bot, /chat-agent) redirigen y siguen marcando la tab:
        // salen de UNA lista, la misma que cuida tests/ruta-automations.test.ts.
        { key: 'setting', label: 'Automations', href: RUTA_AUTOMATIONS, icon: 'chatbot', rolesWs: ['setter'], match: (p) => starts(RUTA_AUTOMATIONS)(p) || RUTAS_VIEJAS_AUTOMATIONS.some((r) => starts(r)(p)) },
        { key: 'sales-email', adminOnly: true, label: 'Sales Email', href: '/sales-email', icon: 'salesemail', comingSoon: true, match: starts('/sales-email') },
        { key: 'newsletters', adminOnly: true, label: 'Newsletters', href: '/newsletters', icon: 'newsletter', comingSoon: true, match: starts('/newsletters') },
      ],
      // Cerrar: lo que usa la persona que atiende la llamada.
      [
        { key: 'closing-script', adminOnly: true, label: 'Closing Script', href: '/closing-script', icon: 'closingscript', comingSoon: true, rolesWs: ['closer'], match: starts('/closing-script') },
        { key: 'sales-roleplay', adminOnly: true, label: 'Sales Roleplay', href: '/sales-roleplay', icon: 'roleplay', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/sales-roleplay') },
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
    // 12/10/2026, Martín: «Elimina todo lo de "Content Machine", que solo quede Ads Writer y Video Generator. Y que
    // queden sin sub tabs... Y claro, que el resto quede tal cual en SuperAdmin». Lo demás lleva `adminOnly` y, fuera
    // de la barra del super admin, los desplegables se aplanan (`planaParaCliente`): quedan las dos sueltas.
    //
    // 12/10/2026, también: «Que no exista "video generator" y luego "Editor"... que todo sea lo mismo… Que sean
    // 3 tabs funcionales que todo mundo reconoce y MaKo le agrega generación con IA». Video = el lienzo tipo
    // CapCut + crear con IA + Reels; Image = Image Generator + Thumbnails + Carousels; Copywriting = Ideas + Ads
    // Writer + YouTube Writer + Stories. Son TABS UNIFICADAS (`secciones`): cada herramienta sigue con su key, su
    // ruta y su `adminOnly`, así que el pedido anterior se cumple solo — el cliente ve Video (Editor y Crear con
    // IA) y Copywriting (Ads Writer); Image, que hoy es todo `adminOnly`, sólo el super admin.
    pregunta: '¿Qué pieza necesito hacer?',
    icon: 'creativos',
    bloques: [
      [
        {
          key: 'video', label: 'Video', href: '/video-editor', icon: 'videogen',
          match: (p) => starts('/video-editor')(p) || starts('/video-generator')(p) || starts('/reels')(p),
          secciones: [
            // La copia de CapCut. Abierta a todos desde el 12/10/2026; quién entra lo decide
            // app/video-editor/acceso.ts (la misma pregunta que toda tab: rol y capa).
            { key: 'video-editor', label: 'Video Editor', seccion: 'Editor', href: '/video-editor', icon: 'tijera', match: starts('/video-editor') },
            { key: 'video-generator', label: 'Video Generator', seccion: 'Crear con IA', href: '/video-generator', icon: 'videogen', match: starts('/video-generator') },
            { key: 'reels', adminOnly: true, label: 'Reels', href: '/reels', icon: 'videogen', match: starts('/reels') },
          ],
        },
        {
          key: 'image', label: 'Image', href: '/image-editor', icon: 'imagegen',
          match: (p) => starts('/image-editor')(p) || starts('/image-generator')(p) || starts('/thumbnails')(p) || starts('/carousels')(p),
          secciones: [
            // La copia de Canva (14/10/2026, Martín: «implementes end to end un "Canva" dentro de MaKo… Dejalo en
            // "Content Machine" en una tab que sea "Image"»): Doory portado y re-vestido como Canva. Abierta a todos
            // los workspaces el 15/10/2026 («Que Image aparezca en todos los workspace»), como el Video Editor el
            // 12/10: quién entra lo decide app/image-editor/acceso.ts con la pregunta de toda tab (rol y capa).
            // Image Generator y Thumbnails siguen `comingSoon`: se ven, con su «pronto», y abren «Próximamente».
            { key: 'image-editor', label: 'Image Editor', seccion: 'Editor', href: '/image-editor', icon: 'imagegen', match: starts('/image-editor') },
            { key: 'image-generator', label: 'Image Generator', seccion: 'Crear con IA', href: '/image-generator', icon: 'imagegen', comingSoon: true, match: starts('/image-generator') },
            { key: 'thumbnails', label: 'Thumbnails', href: '/thumbnails', icon: 'thumbnail', comingSoon: true, match: starts('/thumbnails') },
            { key: 'carousels', label: 'Carousels', href: '/carousels', icon: 'carousel', match: starts('/carousels') },
          ],
        },
        {
          key: 'copywriting', label: 'Copywriting', href: '/ads-writer', icon: 'escribir',
          match: (p) => starts('/ideas')(p) || starts('/ads-writer')(p) || starts('/content-machine')(p) || starts('/youtube-writer')(p) || starts('/stories')(p),
          secciones: [
            { key: 'ideas', adminOnly: true, label: 'Ideas', href: '/ideas', icon: 'idea', comingSoon: true, match: starts('/ideas') },
            // ⚠️ «Ads Writer» sigue apuntando a /ads-writer: ese módulo se está
            // reescribiendo en otra sesión y su propio código ya declara
            // /content-machine como destino. Cuando aterrice, esto es cambiar el href.
            { key: 'ads-writer', label: 'Ads Writer', href: '/ads-writer', icon: 'escribir', match: (p) => starts('/ads-writer')(p) || starts('/content-machine')(p) },
            { key: 'youtube-writer', adminOnly: true, label: 'YouTube Writer', href: '/youtube-writer', icon: 'escribir', comingSoon: true, match: starts('/youtube-writer') },
            { key: 'stories', adminOnly: true, label: 'Stories', href: '/stories', icon: 'stories', match: starts('/stories') },
          ],
        },
      ],
    ],
  },
  {
    // Al FINAL de la barra desde el 12/10/2026 (Martín: «Pon en la sidebar principal a Customer Success al final de
    // todo, abajo de Content Machine»).
    // Después de la venta: los clientes, su curso y su comunidad. Desde el 12/10/2026 es FAMILIA propia y no un
    // desplegable de Operate (Martín: «Customer Success no debería estar dentro de Operate, sino que debería ser
    // otra tab padre dentro de la sidebar»). La key de la familia no es contrato; las de los ítems sí (capas).
    key: 'customer',
    label: 'Customer Success',
    pregunta: '¿Cómo van mis clientes?',
    icon: 'cs',
    bloques: [
      [
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
    ],
  },];

/**
 * MaKo, abajo del todo y fuera de las familias: es una CAPACIDAD GLOBAL, no un
 * módulo más. El documento lo pide explícito — «Pregúntale a MaKo debe
 * entenderse como capacidad global, no solamente como una tab aislada».
 *
 * Es UNA sola entrada. /mako-doer existe como ruta pero salió de la barra:
 * monta el MISMO MakoChat contra otro endpoint, así que para el usuario eran
 * dos tabs que hacen lo mismo.
 */
/*
 * ⚠️ DESDE EL 16/10/2026 SE LLAMA «SECOND BRAIN» Y LLEVA A /second-brain (etapa 2 de docs/diseno-mako-ai-native.md):
 * el chat con MaKo es la puerta del Second Brain. LA CLAVE SIGUE SIENDO `mako`: de ella cuelgan el chat del teléfono,
 * la bandeja (/mako/pendientes), Inbox y la puerta del chat (`puedeVerKey('mako')`); cambiarla los apagaba a todos.
 * Al admin que ya ve «Second Brain» en Analyze, el Sidebar no le dibuja esta (una entrada por persona).
 */
export const MAKO_NAV: NavItem[] = [
  { key: 'mako', label: 'Second Brain', href: '/second-brain', icon: 'cerebro', rolesWs: ['closer', 'setter'], match: (p) => starts('/second-brain')(p) || starts('/mako')(p) || starts('/mako-doer')(p) },
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
        // Martín vendiendo MaKo (11/10/2026: «Lo voy a utilizar yo como superadmin para vender
        // MaKo»): el link de pago de un plan y lo que se cobró, con el alta de cada cuenta. Sólo
        // super admin, mismo guard que Strategy; la key tampoco lleva el prefijo 'dev-'.
        { key: 'admin-cobros', label: 'Cobros', href: '/admin/cobros', icon: 'tag', match: starts('/admin/cobros') },
        // El Centro de Operaciones (15/10/2026): pedidos firmados para los chats de Claude de la PC
        // de Martín. Sólo él (puedeOperar), y la key tampoco lleva el prefijo 'dev-'.
        { key: 'admin-operaciones', label: 'Centro de Operaciones', href: '/admin/operaciones', icon: 'config', match: starts('/admin/operaciones') },
        // La ticketera: el mazo donde Martín contesta las decisiones que le publican los chats
        // (15/10/2026, reportado por él: «tampoco tengo la ticketera en superadmin en desktop, en
        // la sidebar... Eso esta mal»). En el TELÉFONO ya se podía llegar —`lib/movil-rutas.ts`
        // mapea /tickets/decisiones a /m/tickets/decisiones— y en la computadora no había ninguna
        // puerta: se entraba sólo con la URL escrita a mano. El ítem de «Reportar problema» que
        // vive en el menú de la foto es OTRA cosa (/tickets a secas, y `comingSoon`), así que no
        // servía de puerta. Va al lado del Centro de Operaciones porque son el mismo trabajo: los
        // dos son cómo Martín le contesta a los chats. Sólo super admin, y la key tampoco lleva
        // el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros).
        // ⚠️ Desde el 16/10/2026 la Ticketera vive ADENTRO del Centro (Martín: «elimines la ruta de la ticketera y lo
        // pongas dentro del centro de operaciones»): este ítem es un atajo a esa vista (`TICKETERA`, ?ticketera=), no
        // otra pantalla. Su `match` es el de la ruta vieja: en el Centro se marca el ítem del Centro.
        { key: 'admin-ticketera', label: 'Ticketera', href: '/admin/operaciones?ticketera=tarjetas', icon: 'soporte', match: starts('/tickets/decisiones') },
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
        // El criterio de la tab Offer y lo que se concluyó de cada curso de oferta (11/10/2026,
        // Martín: «una tab con el criterio y todas las conclusiones… así lo puedo revisar»). Va
        // en este bloque porque es CON QUÉ PIENSA MaKo cuando analiza una oferta. La key NO
        // lleva el prefijo 'dev-' (tests/dev-areas.test.ts lo reserva a los registros).
        { key: 'admin-offer-playbook', label: 'Offer Playbook', href: '/admin/offer-playbook', icon: 'tag', match: starts('/admin/offer-playbook') },
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
export const ADMIN_NAV: NavItem[] = ADMIN_FAMILIAS.flatMap(itemsDe);

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
  { key: 'tickets', label: 'Reportar problema', href: '/tickets', icon: 'soporte', comingSoon: true, rolesWs: ['closer', 'setter'], match: starts('/tickets') },
];

/** Todos los ítems de producto, aplanados (para buscar por key o por ruta). */
export const TODOS_LOS_ITEMS: NavItem[] = [...FAMILIAS.flatMap(itemsDe), ...MAKO_NAV];
