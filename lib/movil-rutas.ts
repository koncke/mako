// =============================================================================
// MaKo Mobile — los destinos de la barra, las secciones de More y el mapa escritorio → móvil
// =============================================================================
// Una cosa, un lugar: QUÉ destinos tiene la app móvil, QUÉ secciones viven en More, QUIÉN ve
// cada una y A DÓNDE cae en el teléfono un link de escritorio viven acá. Lo leen el layout de
// /m (la barra), /m/mas, los guards de cada página, los links de los Web Push y el foco de
// «Today».
//
// SIN `server-only` a propósito: lo importan componentes cliente (la barra) y los tests. Sólo
// depende de módulos puros (nav.ts, capas.ts, ruta-automations.ts y ruta-web-generator.ts).
//
// ⚠️ EL PREFIJO ES `/m/` CON BARRA, NUNCA `startsWith('/m')`: eso atrapa /mako, /marketing,
// /mensajes, /metodo, /mi-curso, /modelos-ia y —el caro— la ruta PÚBLICA /m.js (el cargador
// del Pixel que los clientes pegan en su landing). Toda pregunta «¿es móvil?» pasa por
// `esRutaMovil`.
//
// ⚠️ LA HOME ES /m/hoy, NO /m: Next redirige /m/ → /m (trailingSlash false), así que la URL
// pelada no queda dentro de un scope '/m/'. /m sólo reparte.
//
// v3 (14/10/2026, prototipo docs/prototipos/mako-mobile-tableros.html aprobado por Martín): la barra
// es CRM · Chats · General · Plan · More, con General AL MEDIO y como portada (la ruta interna sigue
// siendo /m/hoy: la URL que se ve es /general). Inbox dejó la barra: es la campana de General. More
// sigue las FAMILIAS de la sidebar (Operate, Analyze, Sales Machine, Content Machine, Customer
// Success) en su orden, y MaKo va al final, fuera de las familias (como en escritorio). Si a un rol le
// falta uno de los cuatro primeros, su lugar lo toma la PRIMERA sección de More que sí vea
// (`barraMovil`).
//
// ⚠️ 17/10/2026, LA SIDEBAR NUEVA (docs/diseno-sidebar.md): las familias son DOS, Operate y Sales Machine (Analyze,
// Content Machine y Customer Success se fueron: Dashboard y Clients a Operate, Video y Copywriting a Sales Machine), y
// Second Brain va ARRIBA de todo, sin título, como en escritorio (con el Ops Center para el super admin, en /m/mas).
// Experiments salió de la barra (su página sigue). «Calendario» es «Calendar», «Clientes» es «Clients».
//
// ⚠️ 17/10/2026 NOCHE, EL PROTOTIPO DE MARTÍN (docs/prototipos/sidebar-nueva-1710.md y coherencia-1710.md): las familias
// son lo diario (sin título) · Sales · Marketing · Create, con los mismos nombres que la sidebar, y la barra es
// CRM · Chats · Dashboard · Plan · More: el lugar del medio se llama Dashboard y abre la misma portada (/m/hoy), que en
// escritorio pasó a ser la hoja fija «Focus» del Dashboard.
//
// 15/10/2026 (Martín: «Implementá TODAS las tabs que construimos, todo»): More suma las siete que el
// prototipo v3 ya dibujaba — Calendario, Second Brain, Experiments, Offer, Copywriting, Curso y
// Comunidad —, cada una en su lugar de la sidebar. Con eso la capa pm (Plan, MaKo, Dashboard y
// Calendario) llena los huecos de CRM y Chats con Calendario y Dashboard, y More le queda en MaKo.
//
// ⚠️ 20/10/2026, EL OPS CENTER ES LA TAB PRINCIPAL (pedido del Ops Center bb885d5f, Martín: «Que en Mobile, el Ops
// Center esté donde está el Dashboard, que sea la tab principal»; docs/ops-center-principal.md): la barra es
// CRM · Chats · Ops Center · Plan · More, y la app abre ahí (`ENTRADA_MOVIL`). El Dashboard (/m/hoy, la portada de antes)
// pasa a ser la primera fila de lo diario en More. Para el super admin sin mirar un cliente el Ops Center es el Centro
// (/m/operaciones); para los demás, su chat con MaKo (/m/second-brain), como en la sidebar de cada uno.
// =============================================================================

import { FAMILIAS, PRONTO, SUPERADMIN_MENU, TODOS_LOS_ITEMS, USER_NAV, type NavItem } from '@/app/_components/nav';
import { tabEnCapa } from './capas';
import { puedeVerItem, resolverTab, type VistaNav } from './nav-visibilidad';
import { capaDeHojaDeRol } from './graficos-roles';
import { RUTA_AUTOMATIONS, RUTAS_VIEJAS_AUTOMATIONS } from './ruta-automations';
import { RUTA_WEB_GENERATOR, RUTAS_VIEJAS_WEB_GENERATOR } from './ruta-web-generator';
import { SECCIONES_COMUNIDAD as SECCIONES_COMUNIDAD_CLIENTS } from './clients-rutas';
import { rutaDeTabVieja } from './ajustes-secciones';
// Las tabs de CREACIÓN (17/10/2026): sus filas ocultas y su ida y vuelta viven en ./movil-creacion.ts.
import { SECCIONES_CREACION, rutaEscritorioCreacion, rutaMovilCreacion, type IdCreacion } from './movil-creacion';
// Lo que existe para vender MaKo a otros (MaKo Partners, Agency Dashboard) no va en NINGÚN teléfono (4/11/2026, lib/tienda.ts).
import { sinLoQueVende } from './tienda';

/**
 * Los cinco destinos FIJOS de la barra. `mako` es el OPS CENTER desde el 20/10/2026, en el lugar del medio que era del
 * Dashboard (`hoy`, que pasó a More): la misma id que su fila de More, así que More no la repite.
 *
 * ⚠️ 04/11/2026, EL DASHBOARD VUELVE A LA BARRA EN EL LUGAR DE PLAN (Martín: «en mobile, en lugar de "Plan" en la bottom
 * bar, pon "Dashboard"»). Lleva la MISMA id que su fila de More (`dashboard`), como el Ops Center, así que More no la
 * repite; abre el Dashboard de cada uno (`destinoDashboard`). Plan pasa a ser la primera fila de lo diario en More.
 */
export type DestinoMovil = 'crm' | 'chats' | 'mako' | 'dashboard' | 'mas';
/** Las secciones que viven en More. */
export type IdSeccionMas =
  | 'plan' | 'calendario' | 'ads' | 'second-brain' | 'dashboard' | 'experimentos' | 'offer' | 'landing' | 'automations'
  | 'video' | 'copywriting' | 'ai-avatar' | 'cs' | 'curso' | 'comunidad' | 'partners' | 'agency' | 'mako'
  // Las pantallas del MENÚ DE LA FOTO (17/10/2026): ocultas como sección (More arma su fila desde nav.ts → USER_NAV).
  | 'tickets' | 'configuraciones'
  // Las del super admin (17/10/2026): las herramientas que la sidebar cuelga de una tab o del menú de su foto.
  | 'conocimientos' | 'agente' | 'cobros' | 'customers'
  // La API de MaKo (17/10/2026): del menú de la foto, sólo el admin del negocio (key `api-mako` de USER_NAV).
  | 'api-mako'
  // Las de CREACIÓN (17/10/2026, Mobile 1): lib/movil-creacion.ts.
  | IdCreacion;
/** Lo que puede ocupar un lugar de la barra: un destino fijo o una sección de More que subió. */
export type IdBarra = DestinoMovil | IdSeccionMas;

export type DefDestino = {
  id: DestinoMovil;
  /** Nombre en inglés, como el escritorio (regla de la casa: los NOMBRES van en inglés). */
  label: string;
  href: string;
  /** Nombre del ícono de `app/_components/icons.tsx` (uno inexistente dibuja un punto). */
  icon: string;
  /**
   * La key de `app/_components/nav.ts` cuya regla de visibilidad hereda (rolesWs + capa).
   * `null` = lo ve cualquiera con sesión: «General» se COMPONE por rol con lo que cada uno puede
   * ver, y «More» se arma con lo que el rol ve.
   */
  navKey: string | null;
  /** Se dibuja con la criatura de MaKo y no con `icon` (sólo el Ops Center; ver `ItemBarra`). `icon` queda de respaldo. */
  criatura?: true;
};

export type DefSeccionMas = {
  id: IdSeccionMas;
  /** El nombre de la FILA de More: el de la sidebar. */
  label: string;
  /**
   * El nombre de la PANTALLA, si no es el de la fila (la cabecera, su «volver» y la pestaña). Sólo
   * Copywriting: en escritorio es una tab unificada y lo que abre es su sección Ads Writer (el título de
   * la pestaña de /ads-writer ya dice «Ads Writer»; el prototipo v3, igual).
   */
  titulo?: string;
  href: string;
  /** Ícono de `app/_components/icons.tsx`. MaKo no lo usa: su fila lleva el logo real. */
  icon: string;
  /** La key de nav.ts que la gatea (la MISMA que pide `requireMovil({ navKey })` en su page). */
  navKey: string;
  /** La familia de la sidebar (app/_components/nav.ts) bajo la que se lista en More; null = arriba, sin título. */
  familia: FamiliaMas | null;
  /**
   * La página existe y un link de escritorio la abre en el teléfono, pero NO es una fila de More ni sube a la barra
   * (17/10/2026: salió de la sidebar de escritorio, nav.ts → SIN_FILA). Sin esto, borrar la fila rompía `rutaMovil`.
   */
  oculta?: true;
  /**
   * Sólo el SUPER ADMIN (17/10/2026): una herramienta de la plataforma (nav.ts → HERRAMIENTAS), cuya key no está en
   * `TODOS_LOS_ITEMS` y que `puedeVerKey` no conoce. Su página se cuida como la de escritorio, con `getSesionAdmin()`,
   * y no con `requireMovil({ navKey })` (que le cerraría la puerta a todos). Va siempre `oculta`.
   */
  superAdmin?: true;
};

/**
 * Las familias de la sidebar, con su nombre de escritorio y en su orden (una caja de More cada una). Desde el 17/10/2026
 * noche son las del prototipo (docs/prototipos/sidebar-nueva-1710.md): lo diario SIN título arriba, y Sales · Marketing ·
 * Create. `masCompleto` las cruza con nav.ts por la KEY (antes por la posición: con cuatro familias, la tercera se perdía).
 */
export const FAMILIAS_MAS = [
  // Con título desde el 20/10/2026: en la barra de escritorio lo diario lleva rótulo, se pliega y tiene el Ops Center adentro.
  { id: 'diario', label: 'Today' },
  { id: 'sales', label: 'Sales' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'create', label: 'Create' },
] as const;
export type FamiliaMas = (typeof FAMILIAS_MAS)[number]['id'];

/**
 * El Dashboard del teléfono (la hoja Focus; la URL que se ve es /general). Fue la portada hasta el 20/10/2026 y sigue
 * siendo adonde vuelve una puerta que no deja pasar: la ven todos los roles, así que nunca rebota en bucle.
 */
export const HOME_MOVIL = '/m/hoy';
/** Su nombre en More y en el «volver» de sus pantallas (la campana de Avisos): el que tenía en la barra. */
export const TITULO_HOME_MOVIL = 'Dashboard';
export const RUTA_MAS = '/m/mas';

/** El Ops Center de un cliente y su equipo: su chat con MaKo (la URL que se ve es /second-brain). */
export const RUTA_OPS_CENTER_M = '/m/second-brain';
/** El del super admin sin mirar un cliente: el Centro, con la Ticketera adentro (la URL que se ve es /admin/operaciones). */
export const RUTA_CENTRO_M = '/m/operaciones';
/**
 * Adonde entra el teléfono (el login y el ícono de la app instalada pasan por /inicio): el Ops Center, la tab principal
 * desde el 20/10/2026. Es la URL de ESCRITORIO, porque el teléfono ve las mismas rutas (lib/movil-desvio.ts); para el
 * super admin, /m/second-brain lo pasa al Centro.
 */
export const ENTRADA_MOVIL = '/second-brain';

/** La ruta interna de los chats (la URL que se ve es la de escritorio: /whatsapp). */
export const RUTA_CHATS = '/m/chats';

export const DESTINOS_MOVIL: readonly DefDestino[] = [
  { id: 'crm', label: 'CRM', href: '/m/crm', icon: 'crm', navKey: 'crm' },
  // Chats: todas las conversaciones juntas. Hoy lee las de WhatsApp (la tab de escritorio que
  // gobierna quién las ve es `whatsapp`); cuando la bandeja Chats de escritorio entre a main, pasa
  // a leer de ahí.
  // La key de la bandeja UNIFICADA de escritorio (/chats, 14/10/2026). Ve lo mismo que `whatsapp` en todas las
  // capas (tests/chats-registro.test.ts fija la paridad), así que nadie pierde la pestaña al cambiarla.
  { id: 'chats', label: 'Chats', href: RUTA_CHATS, icon: 'chats', navKey: 'chats' },
  // AL MEDIO y como portada: el OPS CENTER desde el 20/10/2026 (pedido bb885d5f: «Que en Mobile, el Ops Center esté donde
  // está el Dashboard, que sea la tab principal»). Hasta ese día era el Dashboard (/m/hoy), que pasó a More. La key es la
  // de la sidebar (nav.ts → MAKO_NAV): la ven el admin, el closer y el setter. Para el super admin sin mirar un cliente,
  // `barraMovil` le cambia el destino por el Centro.
  { id: 'mako', label: 'Ops Center', href: RUTA_OPS_CENTER_M, icon: 'cerebro', navKey: 'mako', criatura: true },
  // El Dashboard (04/11/2026), donde estaba Plan. `href` es el de quien ve General (el Dashboard UNIDO, /m/hoy); al closer y
  // al setter `barraMovil` les pone SU hoja (/m/dashboard). La regla de quién lo ve es `destinoDashboard`, no sólo la key.
  { id: 'dashboard', label: 'Dashboard', href: HOME_MOVIL, icon: 'graphics', navKey: 'graphics' },
  { id: 'mas', label: 'More', href: RUTA_MAS, icon: 'mas', navKey: null },
];

/** La campana de General: lo que espera una decisión y los avisos (antes era un lugar de la barra). */
export const RUTA_INBOX = '/m/inbox';
/** Su nombre (prototipo v3, `PANTALLAS.avisos`; 15/10/2026): la cabecera, la pestaña y la campana
 *  dicen lo mismo. Antes se llamaba «Inbox»; la carpeta y las claves siguen siendo `inbox`. */
export const TITULO_INBOX = 'Avisos';

/**
 * En el orden de la sidebar de escritorio (familia por familia) y con su nombre y su ícono ahí: es el
 * orden de la lista de More y en el que suben a la barra si falta un destino. Lo que ya está en la
 * barra (General, Plan, CRM, Chats) no se repite, ni lo que entra en Chats (WhatsApp, Email). Que cada
 * fila sea la de la sidebar (nombre, ícono, familia y orden) lo fija tests/movil-mas-secciones.test.ts.
 *
 * ⚠️ UNA FILA NUEVA SALE EN EL MISMO DEPLOY QUE SU PÁGINA: desde acá la fila aparece en More, puede
 * subir a la barra de un rol y su ruta de escritorio se le sirve al teléfono (`rutaMovil`, con
 * MOVIL_ACTIVO prendido). Sin app/m/<carpeta>/page.tsx, todo eso es un 404 (el mismo test lo nombra).
 */
export const SECCIONES_MAS: readonly DefSeccionMas[] = [
  // Plan (04/11/2026): dejó la barra para el Dashboard y encabeza lo diario, como en la sidebar (Plan · Chats · Dashboard).
  { id: 'plan', label: 'Plan', href: '/m/plan', icon: 'todo', navKey: 'todo', familia: 'diario' },
  // Lo diario (Plan y Chats están en la barra; adentro de Chats se configuran WhatsApp y Email). Las HOJAS del Dashboard
  // (/m/dashboard). ⚠️ UN SOLO «Dashboard» en More (24/10/2026, Martín: «En mobile aparecen 2 dashboards»): quien tiene el
  // Dashboard unido (ve General) lo abre en /m/hoy, con estas hojas en su segmentado, y esta fila no sale; quien no (el closer,
  // el setter) tiene ésta, su hoja, como su Dashboard, igual que en la computadora (`masCompleto`).
  { id: 'dashboard', label: 'Dashboard', href: '/m/dashboard', icon: 'graphics', navKey: 'graphics', familia: 'diario' },
  // Sales (CRM está en la barra).
  { id: 'calendario', label: 'Calendar', href: '/m/calendario', icon: 'calendario', navKey: 'calendario', familia: 'sales' },
  { id: 'automations', label: 'Automations', href: '/m/automations', icon: 'flujo', navKey: 'setting', familia: 'sales' },
  // Clients (vino de Customer Success el 17/10/2026). Las páginas de escritorio de Curso y Comunidad piden la capa de
  // `customer-success` (requireCapa) y las keys `cs-curso`/`cs-comunidad` dan lo mismo en las cuatro capas
  // (tests/curso-admin.test.ts y tests/comunidad-nav.test.ts); el rol, como en la sidebar, sólo admin.
  // «Classroom» desde el 25/10/2026, como la barra. Abre /m/cs (su pantalla pide `customer-success`, la llave de esta fila), con
  // el trío Classroom · Community · Clients arriba: el curso queda a un toque.
  { id: 'cs', label: 'Classroom', href: '/m/cs', icon: 'users', navKey: 'customer-success', familia: 'sales' },
  // MaKo Partners: el admin de cualquier negocio desde el 24/10/2026 (antes, `soloCapas` agencia en nav.ts); la página
  // reparte entre la cartera de la agencia y los referidos del resto (app/m/partners/page.tsx).
  // MaKo Partners: del menú de la foto desde el 20/10/2026 (nav.ts → USER_NAV), así que su fila de More la arma el menú
  // (`masCompleto`) y acá va OCULTA, como Report a problem y Business settings.
  // ⚠️ Desde el 4/11/2026 no va en NINGÚN teléfono, ni ella ni Agency (lib/tienda.ts → `TABS_QUE_VENDEN`): More no las
  //    dibuja y su página vuelve a More. Las filas siguen acá para que un link de escritorio caiga en esa página.
  { id: 'partners', label: 'MaKo Partners', href: '/m/partners', icon: 'comunidad', navKey: 'partners', familia: null, oculta: true },
  // Agency Dashboard (25/10/2026): del menú de la foto, como Partners; su fila la arma el menú. ⚠️ Planes escribió el mismo
  // mapeo en planes-2510: en la integración queda UNA copia.
  { id: 'agency', label: 'Agency Dashboard', href: '/m/agency', icon: 'users', navKey: 'agency', familia: null, oculta: true },
  // Marketing.
  { id: 'offer', label: 'Offer', href: '/m/offer', icon: 'tag', navKey: 'offer', familia: 'marketing' },
  { id: 'landing', label: 'Web Generator', href: '/m/landing', icon: 'web', navKey: 'landing-writer', familia: 'marketing' },
  { id: 'ads', label: 'Ads Manager', href: '/m/ads', icon: 'grid', navKey: 'ads-manager', familia: 'marketing' },
  // Create (las piezas).
  // Video y Copywriting son tabs UNIFICADAS de escritorio: la key que gatea es la de la
  // sección que el teléfono muestra (Video Generator; Ads Writer, la única de Copywriting que ve un
  // cliente). `copywriting` NO sirve de navKey: no está en TODOS_LOS_ITEMS (itemsDe aplana las
  // secciones), así que puedeVerKey diría que no.
  // Image (la copia de Canva) no entró en la tanda del 15/10/2026; entró el 17/10/2026, debajo de Video.
  // Video desde el 29/10/2026: una sola pantalla, el editor (como en escritorio: nav.ts → 'video-editor', sin secciones). El
  // Video Generator (/m/video) quedó como su plantilla «Generar con IA», con fila oculta (lib/movil-creacion.ts).
  { id: 'video', label: 'Video', titulo: 'Video', href: '/m/video-editor', icon: 'videogen', navKey: 'video-editor', familia: 'create' },
  // Image (17/10/2026): la tab unificada abre su Editor, la copia de Canva (app/m/image-editor), como en escritorio
  // (`resolverTab` lleva a la primera sección que no es «pronto»). Sus otras secciones van en la barra de arriba.
  { id: 'image', label: 'Image', titulo: 'Image Editor', href: '/m/image-editor', icon: 'imagegen', navKey: 'image-editor', familia: 'create' },
  // Copywriting ES el Copywriter desde el 29/10/2026 (nav.ts, la fila de Copywriting): la lista de páginas y «Nueva»
  // (app/m/copywriter). El Ads Writer del teléfono (/m/copywriting) queda sin fila.
  { id: 'copywriting', label: 'Copywriting', titulo: 'Copywriting', href: '/m/copywriter', icon: 'escribir', navKey: 'copywriter', familia: 'create' },
  // AI Avatar (29/10/2026): para todos los planes, como Video. Hasta ese día era sólo del super admin y no tenía fila (More se
  // la armaba desde la sidebar). Una pantalla, el estudio de Higgsfield (app/m/ai-avatar).
  { id: 'ai-avatar', label: 'AI Avatar', titulo: 'AI Avatar', href: '/m/ai-avatar', icon: 'perfil', navKey: 'ai-avatar', familia: 'create' },
  // «Second Brain» (16/10/2026), ARRIBA de todo y sin título desde el 17/10/2026, como en escritorio
  // (app/_components/nav.ts → ARRIBA): el chat con MaKo. Hasta ese día había otra fila igual en Analyze.
  // «Ops Center» desde el 18/10/2026, como en escritorio (nav.ts → MAKO_NAV): el nombre de la fila, de la cabecera y del
  // «volver» de sus subpantallas. La pantalla no cambia.
  { id: 'mako', label: 'Ops Center', href: '/m/second-brain', icon: 'cerebro', navKey: 'mako', familia: null },
  // OCULTAS (17/10/2026): sus páginas siguen y un link de escritorio las abre en el teléfono (`rutaMovil` las busca por
  // id), pero no son filas de More ni suben a la barra: en escritorio salieron de la sidebar (nav.ts → SIN_FILA).
  { id: 'second-brain', label: 'Ops Center', href: '/m/second-brain', icon: 'cerebro', navKey: 'second-brain', familia: null, oculta: true },
  { id: 'experimentos', label: 'Experiments', href: '/m/experimentos', icon: 'experiments', navKey: 'experimentos', familia: null, oculta: true },
  // Course y Community: sub-tabs de Clients desde el 17/10/2026 (arriba de las tres pantallas, app/m/cs/SeccionesClientsM.tsx).
  { id: 'curso', label: 'Classroom', href: '/m/curso', icon: 'video', navKey: 'cs-curso', familia: null, oculta: true },
  { id: 'comunidad', label: 'Community', href: '/m/comunidad', icon: 'comunidad', navKey: 'cs-comunidad', familia: null, oculta: true },
  // EL MENÚ DE LA FOTO (17/10/2026, «Mobile 2»): sus filas de More salen de USER_NAV (`masCompleto`), así que acá van
  // OCULTAS: la fila da la cabecera (título y «volver»), el título de la pestaña y la puerta (`requireMovil({ navKey })`),
  // y nunca sube a la barra de un rol.
  { id: 'tickets', label: 'Report a problem', href: '/m/tickets', icon: 'soporte', navKey: 'tickets', familia: null, oculta: true },
  // «Configuración del negocio»: el índice y cada sección debajo (/m/configuraciones/<sección>, `SECCIONES_NEGOCIO_M`).
  { id: 'configuraciones', label: 'Business settings', href: '/m/configuraciones', icon: 'tuerca', navKey: 'configuraciones', familia: null, oculta: true },
  // Las del SUPER ADMIN (nav.ts → HERRAMIENTAS), con el nombre de la sidebar. (MaKo Messages salió el 26/10/2026: /m/mensajes
  // redirige a /m/automations, next.config.ts.)
  { id: 'api-mako', label: 'API', href: '/m/api-mako', icon: 'api', navKey: 'api-mako', familia: null, oculta: true },
  // Knowledge (el portal de cursos del equipo): /m/conocimientos, un curso en /<slug> y una clase en /<slug>/<n>.
  { id: 'conocimientos', label: 'Knowledge', href: '/m/conocimientos', icon: 'contexto', navKey: 'conocimientos', familia: null, oculta: true, superAdmin: true },
  // Billing y Client Agents (menú de la foto del super admin): lo vendido de MaKo y en qué trabajan los clientes.
  { id: 'cobros', label: 'Billing', href: '/m/cobros', icon: 'tag', navKey: 'admin-cobros', familia: null, oculta: true, superAdmin: true },
  { id: 'agente', label: 'Client Agents', href: '/m/agente', icon: 'mako', navKey: 'admin-agente', familia: null, oculta: true, superAdmin: true },
  // Customers (26/10/2026): su fila de More la arma la familia de la sidebar (Sales), como en la computadora.
  { id: 'customers', label: 'Customers', href: '/m/customers', icon: 'cs', navKey: 'admin-customers', familia: null, oculta: true, superAdmin: true },
  // Las pantallas de CREACIÓN (17/10/2026), todas ocultas: lib/movil-creacion.ts dice por qué.
  ...SECCIONES_CREACION,
];

/**
 * Las pantallas del teléfono que son UNA ruta de escritorio sin query ni subrutas (17/10/2026): la misma tabla sirve a
 * `rutaMovil` y a `rutaEscritorio`, así que la ida y la vuelta no pueden divergir.
 */
const UNA_A_UNA: Readonly<Record<string, string>> = {
  '/api-mako': '/m/api-mako',
  '/admin/cobros': '/m/cobros',
  '/admin/agente': '/m/agente',
  // Customers (26/10/2026): los clientes de MaKo del super admin.
  '/customers': '/m/customers',
};

/**
 * Las secciones de «Configuración del negocio» que tienen pantalla en el teléfono, con su ruta de ESCRITORIO (cada
 * sección es su ruta, como en Google: lib/ajustes-secciones.ts). En el teléfono viven debajo del índice
 * (/m/configuraciones/<clave>), así que su «volver» es «Configuración del negocio». General (Horario y Criterio) y Método
 * (las credenciales de la plataforma), del super admin, se abren en la computadora desde el índice.
 */
export const SECCIONES_NEGOCIO_M = {
  equipo: '/equipo',
  integraciones: '/integraciones',
  notificaciones: '/configuraciones/notificaciones',
  fiscal: '/configuraciones/fiscal',
  plan: '/configuraciones/plan',
} as const;
export type SeccionNegocioM = keyof typeof SECCIONES_NEGOCIO_M;
const CLAVES_NEGOCIO_M: readonly SeccionNegocioM[] = ['equipo', 'integraciones', 'notificaciones', 'fiscal', 'plan'];
const esSeccionNegocioM = (k: string): k is SeccionNegocioM => CLAVES_NEGOCIO_M.some((c) => c === k);
export const RUTA_CONFIG_M = '/m/configuraciones';

/** El nombre de la PANTALLA de una sección (la cabecera, su «volver» y la pestaña): `titulo` o, si no, el de la fila. */
export function tituloSeccion(s: Pick<DefSeccionMas, 'label' | 'titulo'>): string {
  return s.titulo ?? s.label;
}

/**
 * Lo que la pantalla de ESCRITORIO de cada sección nueva lee de la query, y que por eso `rutaMovil`
 * conserva al llevar su link al teléfono (nunca el `?ws=`). No es decoración: un Web Push sale por
 * `rutaMovilOHome` y vuelve a escritorio por `conWs` → `rutaEscritorio` (lib/push-payload.ts), así que
 * una clave que se cae acá se cae TAMBIÉN en la computadora (sin `tab`, un push a
 * «/experimentos?tab=analisis» abriría Retro).
 * La página del teléfono puede leerlas (le llegan en el rewrite) o ignorarlas.
 */
export const QUERY_DE_SECCION: Partial<Record<IdSeccionMas, readonly string[]>> = {
  calendario: ['vista', 'fecha'], // app/calendario/page.tsx
  'second-brain': ['area', 'vista'], // app/second-brain/VistaCerebro.tsx (los arma `rutaSeccion`, lib/secciones-negocio.ts)
  experimentos: ['tab', 'desde', 'hasta', 'cierres', 'presupuesto', 'hipotesis'], // app/experimentos/page.tsx
  offer: ['oferta', 'funnel', 'sesion'], // app/offer/page.tsx (el «Analizar oferta →» del CRM; `sesion`: «Seguir en Offer» del Ops Center, 20/10/2026)
  copywriting: ['nuevo'], // app/copywriter/page.tsx (`?nuevo=<tipo>`: sus templates primero). El `?tab=` del Ads Writer va aparte.
  'api-mako': ['tab'], // app/api-mako/page.tsx (docs · tokens · registro)
  curso: ['producto'], // app/customer-success/curso/pantalla.tsx (Classroom)
  comunidad: ['producto', 'post'], // app/customer-success/comunidad/pantalla.tsx (Classroom › Community; `?post=N` abre ESE post)
};

export type RolMovil = 'admin' | 'closer' | 'setter' | null;

/** Un lugar de la barra: un destino fijo o una sección de More que subió a ocupar un hueco. */
/**
 * `criatura`: el lugar se dibuja con la criatura de MaKo (la estrella que flota y parpadea, app/_components/Criatura.tsx) y
 * no con un ícono de trazo. Sólo el Ops Center, como en la sidebar y en More (Martín, 21/10/2026: «Pusiste a Ops Center
 * con el logo del Second Brain. Cuando el logo es la criatura de MaKo. Quiero que se mueva, parpadee, como siempre»).
 */
export type ItemBarra = { id: IdBarra; label: string; href: string; icon: string; criatura?: true };

/** ¿La ruta es de MaKo Mobile? `/m` o `/m/...`, nunca `/m.js` ni `/mako`. */
export function esRutaMovil(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  return p === '/m' || p.startsWith('/m/');
}

/** `p` es `base` o algo debajo de `base` (con barra: «/m/crm» no atrapa «/m/crmx»). */
function dentro(p: string, base: string): boolean {
  return p === base || p.startsWith(base + '/');
}

/** ¿Este rol, en esta capa, ve la tab de escritorio `key`? La MISMA regla del Sidebar. */
export function puedeVerKey(key: string, rol: RolMovil, capa: string | null | undefined): boolean {
  const item = TODOS_LOS_ITEMS.find((i) => i.key === key) ?? USER_NAV.find((i) => i.key === key);
  if (!item) return false;
  // null = sin rol resuelto (sin sesión): no ve nada gateado. El guard de la página ya lo
  // manda a /login; acá no se adivina a favor.
  const porRol = rol === 'admin' ? true : rol ? (item.rolesWs ?? []).includes(rol) : false;
  // `soloCapas` (MaKo Partners): sólo esas capas, como en la barra (lib/nav-visibilidad.ts); el rol ya pidió admin.
  if (item.soloCapas && !item.soloCapas.includes(capa ?? '')) return false;
  return porRol && tabEnCapa(key, capa);
}

/** Los destinos FIJOS que este rol y esta capa ven, en el orden de la barra. */
export function destinosVisibles(rol: RolMovil, capa: string | null | undefined): DefDestino[] {
  return DESTINOS_MOVIL.filter((d) => {
    if (d.id === 'dashboard') return destinoDashboard(rol, capa) != null;
    return d.navKey === null || puedeVerKey(d.navKey, rol, capa);
  });
}

/**
 * Adónde lleva el lugar «Dashboard» de la barra para este rol, o null si no tiene ninguno (y su hueco lo llena More).
 * La MISMA regla con la que More armaba su fila antes del 04/11/2026 (`masCompleto`): quien ve General tiene el
 * Dashboard UNIDO (/m/hoy: Focus y las hojas en el mismo segmentado); quien no (el closer, el setter), SU hoja
 * (/m/dashboard), si su negocio tiene la tab de esa hoja.
 */
export function destinoDashboard(rol: RolMovil, capa: string | null | undefined): string | null {
  if (!rol) return null;
  if (puedeVerKey('general', rol, capa)) return HOME_MOVIL;
  const hojas = SECCIONES_MAS.find((s) => s.id === 'dashboard');
  return hojas && veSeccion(hojas, rol, capa) ? hojas.href : null;
}

/**
 * ¿Este rol ve esta sección de More? La regla del Sidebar (`puedeVerKey`) y UNA excepción que
 * escritorio aplica en la página y no en el nav: el closer y el setter entran al Dashboard sólo para
 * ver SU hoja (Closing y Chat Analyst, `HOJA_DE_ROL`), y si su negocio no tiene la tab de esa hoja
 * los saca (app/dashboard/page.tsx). Sin esto, More le
 * mostraba la fila y /m/dashboard lo devolvía a Today.
 */
function veSeccion(s: DefSeccionMas, rol: RolMovil, capa: string | null | undefined): boolean {
  if (!puedeVerKey(s.navKey, rol, capa)) return false;
  const capaRol = s.id === 'dashboard' ? capaDeHojaDeRol(rol) : null;
  if (capaRol && !tabEnCapa(capaRol, capa)) return false;
  return true;
}

/** Las secciones de More que este rol y esta capa ven, en orden (las `oculta` nunca: no son filas). */
export function seccionesMasVisibles(rol: RolMovil, capa: string | null | undefined): DefSeccionMas[] {
  return SECCIONES_MAS.filter((s) => !s.oculta && veSeccion(s, rol, capa));
}

/**
 * La barra de ESTE rol: cinco lugares, More siempre al final. Si el rol no ve uno de los
 * cuatro primeros (un setter sin Plan, la capa pm sin CRM), ese lugar lo toma la primera
 * sección de More que sí vea y que no esté ya en la barra. Si no queda ninguna, la barra
 * tiene menos de cinco (nunca un destino que la persona no puede abrir).
 *
 * `centro`: el super admin sin mirar un cliente (el mismo `veOpsCenter` de /m/mas). Su Ops Center es el Centro.
 */
export function barraMovil(rol: RolMovil, capa: string | null | undefined, centro = false): ItemBarra[] {
  const visibles = new Set<IdBarra>(destinosVisibles(rol, capa).map((d) => d.id));
  // Lo que ya es un lugar fijo (el Ops Center tiene la misma id que su fila de More) no sube a ocupar OTRO hueco.
  const reserva = seccionesMasVisibles(rol, capa).filter((s) => !visibles.has(s.id));
  const out: ItemBarra[] = [];
  for (const d of DESTINOS_MOVIL) {
    if (d.id === 'mas') continue;
    if (visibles.has(d.id)) {
      const href = d.id === 'mako' && centro ? RUTA_CENTRO_M : d.id === 'dashboard' ? (destinoDashboard(rol, capa) ?? d.href) : d.href;
      out.push({ id: d.id, label: d.label, href, icon: d.icon, ...(d.criatura ? { criatura: true as const } : {}) });
      continue;
    }
    const s = reserva.shift();
    if (s) out.push({ id: s.id, label: s.label, href: s.href, icon: s.icon });
  }
  const mas = DESTINOS_MOVIL.find((d) => d.id === 'mas')!;
  out.push({ id: mas.id, label: mas.label, href: mas.href, icon: mas.icon });
  return out;
}

/** Una caja de More: la familia de la sidebar (con su nombre de escritorio) y sus secciones. */
export type GrupoMas = { familia: FamiliaMas | null; titulo: string | null; secciones: DefSeccionMas[] };

/**
 * Las secciones que /m/mas lista para este rol, SIN las que subieron a la barra (una cosa
 * en un solo lugar, como el «More» de iOS). Agrupadas por FAMILIA de la sidebar, en su orden;
 * Second Brain PRIMERO y sin título (17/10/2026: en escritorio va arriba de todo, fuera de las familias).
 */
export function gruposMas(rol: RolMovil, capa: string | null | undefined): GrupoMas[] {
  const enBarra = new Set<string>(barraMovil(rol, capa).map((b) => b.id));
  const visibles = seccionesMasVisibles(rol, capa).filter((s) => !enBarra.has(s.id));
  const lista = visibles;
  const grupos: GrupoMas[] = [];
  const sueltas = lista.filter((s) => s.familia === null);
  if (sueltas.length) grupos.push({ familia: null, titulo: null, secciones: sueltas });
  for (const f of FAMILIAS_MAS) {
    const xs = lista.filter((s) => s.familia === f.id);
    if (xs.length) grupos.push({ familia: f.id, titulo: f.label, secciones: xs });
  }
  return grupos;
}

// =============================================================================
// TODA TAB DEL NAV TIENE SU LUGAR EN EL TELÉFONO (17/10/2026)
// =============================================================================
// Martín (17/10, desde el Centro de Operaciones): «Implementa completamente MaKo Mobile en todas las tabs, porque hay
// muchas que aun no se pueden acceder». Lo que pasaba: More se armaba SÓLO con `SECCIONES_MAS`, así que una tab de la
// sidebar sin pantalla del teléfono no aparecía en ningún lado (Image, AI Avatar, todo el menú de la foto), y su URL le
// mostraba al teléfono la cubierta «se usa en la computadora» sin que nadie lo hubiera decidido.
//
// Desde acá, cada tab que dibuja el escritorio está en UNO de tres estados, y tests/movil-toda-tab.test.ts recorre
// nav.ts y falla con la que no:
//   · tiene PANTALLA: `rutaMovil(su href)` da una página de app/m que existe;
//   · es SÓLO DE ESCRITORIO, a propósito: `SOLO_ESCRITORIO`, con el motivo que lee la persona;
//   · su pantalla está EN CAMINO: `EN_CAMINO`, con el chat que la escribe. El guardián la cuenta como pendiente, y
//     FALLA si ya tiene pantalla y sigue anotada (el Cerebro la saca al integrar).
// More (`masCompleto`) se DERIVA de lo que dibuja la sidebar, con la regla de la sidebar (lib/nav-visibilidad.ts), y no
// de una lista al lado: una tab nueva aparece sola, con pantalla o como «En la computadora».
// =============================================================================

/**
 * Las tabs (keys de nav.ts) que NO van al teléfono, a propósito. El valor es lo que More le dice a la persona al tocar la
 * fila (una o dos frases, sin voseo), arriba del botón que la abre igual en la versión de computadora.
 */
export const SOLO_ESCRITORIO: Readonly<Record<string, string>> = {
  // /email es la CONFIGURACIÓN del canal desde el 17/10/2026 (los emails se leen en Chats): el dominio son registros DNS y
  // las secuencias, un editor por etapa. Chats del teléfono ya dice «Conectar canales · En la computadora».
  email: 'Conectar el dominio y armar las secuencias se hace en la computadora. Los emails se leen y contestan en Chats.',
};

/**
 * Las tabs cuya pantalla del teléfono está EN CAMINO, con el chat que la escribe. En More se ven como «En la
 * computadora» hasta que llega su pantalla. ⚠️ Una tab sale de acá en el MISMO commit que su pantalla: el guardián
 * falla si la encuentra con pantalla y todavía anotada.
 */
export const EN_CAMINO: Readonly<Record<string, string>> = {
  // «Mobile 1» y «Mobile 2» (17/10/2026): las tabs de creación (lib/movil-creacion.ts), la API de MaKo y Knowledge ya
  // tienen su pantalla.
  // Herramientas del super admin que colgaron de una tab el 17/10/2026 y todavía no tienen chat (docs/relevo/mako-mobile.md).
  // «agencia» salió el 24/10/2026: ya no es una sección (el número de MaKo es una línea de Chats, docs/diseno-chats.md §8.5).
  'admin-estrategia': 'sin dueño', 'admin-offer-playbook': 'sin dueño',
  // Competitor Spy (31/10/2026): dejó de ser ComingSoon con la Etapa 1 (lista, ficha por bloques y
  // onboarding), y al salir de `comingSoon` perdió el `/m/pronto/market-an` que se derivaba de esa
  // marca. La pantalla del teléfono es la Etapa 1.5 del plan: la ficha pasa a UN bloque por
  // pantalla y los filtros a una hoja que sube desde abajo (docs/diseno-competitors-spy.md §8). Lo
  // que NO va al teléfono, y se dice en vez de desaparecer: replicar el sitio del competidor (es el
  // editor) y el recorrido con la extensión (es Chrome de escritorio).
  'market-an': 'el chat de Competitors Spy',
};

/** Lo que More dice de una tab EN CAMINO (sin motivo propio): corto, y sin prometer una fecha. */
export const MOTIVO_EN_CAMINO = 'Su versión del teléfono está en camino. Por ahora se usa en la computadora.';

/**
 * Las tabs «Coming soon» (nav.ts → `comingSoon`) se DERIVAN, no se anotan: en escritorio abren la pantalla
 * «Coming soon» y en el teléfono, la suya (app/m/pronto/[key]). Una tab que deja de ser «pronto» pierde esta pantalla
 * sola, y el guardián le pide la de verdad.
 */
export const RUTA_PRONTO = '/m/pronto';
export function itemPronto(key: string): NavItem | null {
  return TODOS_LOS_ITEMS.find((i) => i.comingSoon && i.key === key) ?? null;
}

/** Una fila de More. `pantalla` abre la del teléfono; `computadora`, la hoja con el motivo y «Abrir en la computadora». */
export type FilaMas =
  | { tipo: 'pantalla'; key: string; label: string; icon: string; href: string; seccion: IdSeccionMas | null }
  | { tipo: 'computadora'; key: string; label: string; icon: string; href: string; motivo: string }
  /** Un desplegable de la sidebar («Coming soon»): en el teléfono, una hoja con sus filas. */
  | { tipo: 'grupo'; key: string; label: string; icon: string; filas: FilaMas[] };

/** Una caja de More: arriba (sin título), una por familia de la sidebar, el menú de la foto y el del super admin. */
export type GrupoMasCompleto = { id: 'arriba' | FamiliaMas | 'menu' | 'superadmin'; titulo: string | null; filas: FilaMas[] };

/** El motivo de una tab sin pantalla: el de SOLO_ESCRITORIO de su key (o de una de sus secciones), o «en camino». */
function motivoDe(keys: readonly string[]): string {
  for (const k of keys) if (SOLO_ESCRITORIO[k]) return SOLO_ESCRITORIO[k];
  return MOTIVO_EN_CAMINO;
}

/** La fila de More de un ítem que dibuja la sidebar, por su ruta: la pantalla del teléfono o la computadora. */
function filaDeItem(it: NavItem, keys: readonly string[]): FilaMas {
  const destino = rutaMovil(it.href);
  if (destino) return { tipo: 'pantalla', key: it.key, label: it.label, icon: it.icon, href: destino, seccion: seccionDeRuta(destino)?.id ?? null };
  return { tipo: 'computadora', key: it.key, label: it.label, icon: it.icon, href: it.href, motivo: motivoDe(keys) };
}

/**
 * More ENTERO para esta persona (17/10/2026): lo que dibuja la sidebar de escritorio, en su orden, con la regla de la
 * sidebar (`puedeVerItem`/`resolverTab`), menos lo que ya está en la barra.
 *   · arriba: Second Brain (el Ops Center lo pone la página, con su propia pregunta de super admin);
 *   · lo diario, Sales, Marketing y Create: cada tab con pantalla es SU fila de `gruposMas` (la regla del teléfono, que además saca
 *     el Dashboard al closer sin su hoja); la que no tiene, una fila «En la computadora»; un desplegable, una hoja;
 *   · el menú de la foto (sin «Tu cuenta», que es la primera fila de More) y, sólo para el super admin sin mirar un
 *     cliente, el suyo (`SUPERADMIN_MENU`).
 */
export function masCompleto(rol: RolMovil, capa: string | null | undefined, adminShell: boolean): GrupoMasCompleto[] {
  const vista: VistaNav = { adminShell, rolWs: rol ?? '', capa: capa ?? '' };
  const conPantalla = gruposMas(rol, capa);
  const out: GrupoMasCompleto[] = [];
  // Arriba de todo, como la sidebar (nav.ts → `arribaDe`): el super admin NO ve «Second Brain» acá (17/10/2026, Martín: «el
  // second brain vive dentro de ops center»): se abre desde el Ops Center, con su grafo. Los demás, sí: es su chat con MaKo.
  const arriba = conPantalla.find((g) => g.familia === null);
  const sueltas = (arriba?.secciones ?? []).filter((s) => !(adminShell && s.navKey === 'mako'));
  if (sueltas.length) {
    out.push({ id: 'arriba', titulo: null, filas: sueltas.map((s) => ({ tipo: 'pantalla' as const, key: s.navKey, label: s.label, icon: s.icon, href: s.href, seccion: s.id })) });
  }
  const enBarra = new Set(DESTINOS_MOVIL.map((d) => d.navKey).filter((k): k is string => k != null));
  // Lo que ya está en la barra de ESTE rol, por su ruta del teléfono: General no tiene key en DESTINOS_MOVIL (es la
  // portada, `navKey: null`) y sin esto aparecía otra vez en su familia (visto a 390 px el 17/10/2026).
  const deLaBarra = barraMovil(rol, capa, adminShell);
  const barra = new Set(deLaBarra.map((b) => b.href));
  // El Dashboard en la barra (04/11/2026) es EL Dashboard de esta persona, abra /m/hoy o su hoja: More no suma otro.
  const dashboardEnBarra = deLaBarra.some((b) => b.id === 'dashboard');
  FAMILIAS.forEach((f) => {
    const familia = FAMILIAS_MAS.find((x) => x.id === f.key);
    if (!familia) return;
    const deFamilia = conPantalla.find((g) => g.familia === familia.id)?.secciones ?? [];
    const usadas = new Set<IdSeccionMas>();
    const filas: FilaMas[] = [];
    // El Dashboard (la portada de antes, /m/hoy) encabeza lo diario desde que el Ops Center tomó su lugar en la barra
    // (20/10/2026); no es una sección (no tiene key propia).
    // ⚠️ UNO SOLO (24/10/2026, Martín: «En mobile aparecen 2 dashboards», salían «Dashboard» y «Dashboard sheets»). Quien ve
    // General tiene el Dashboard UNIDO en /m/hoy: Focus y las hojas del Dashboard en el mismo segmentado (lib/dashboard-focus.ts),
    // así que la fila de las hojas sobra. Quien no lo ve (el closer, el setter) tiene como Dashboard SU hoja (/m/dashboard), como
    // en la computadora, y la portada no sale (lo de su Today vive en Calendar, el Inbox y el Plan; sigue siendo adonde rebota
    // una puerta). Sin ninguna de las dos, la portada.
    const unido = familia.id === 'diario' && puedeVerKey('general', rol, capa);
    const conHojas = familia.id === 'diario' && deFamilia.some((s) => s.id === 'dashboard');
    if (familia.id === 'diario' && rol && !dashboardEnBarra && !barra.has(HOME_MOVIL) && (unido || !conHojas)) {
      filas.push({ tipo: 'pantalla', key: 'hoy', label: TITULO_HOME_MOVIL, icon: 'graphics', href: HOME_MOVIL, seccion: null });
    }
    if (unido) for (const s of deFamilia) if (s.id === 'dashboard') usadas.add(s.id);
    for (const t of f.bloques.flat()) {
      const visible = resolverTab(t, vista);
      if (!visible) continue;
      const keys = [t.key, ...(t.secciones ?? []).map((s) => s.key)];
      if (keys.some((k) => enBarra.has(k))) continue;
      const destino = rutaMovil(visible.href);
      if (destino && barra.has(destino.split('?')[0])) continue;
      const s = deFamilia.find((x) => keys.includes(x.navKey));
      if (s && unido && s.id === 'dashboard') continue;
      if (s) { usadas.add(s.id); filas.push({ tipo: 'pantalla', key: s.navKey, label: s.label, icon: s.icon, href: s.href, seccion: s.id }); continue; }
      // Tiene sección en el teléfono pero la regla del teléfono no se la muestra (o subió a la barra): nada. ⚠️ Salvo la de
      // super admin (26/10/2026, Customers): ésas nunca salen por `gruposMas` (van ocultas), así que una tab de la
      // familia que es suya se dibuja con su propia fila (`filaDeItem` la lleva a su pantalla por `rutaMovil`).
      if (SECCIONES_MAS.some((x) => keys.includes(x.navKey) && !x.superAdmin)) continue;
      filas.push(filaDeItem(visible, keys));
    }
    for (const g of f.grupos ?? []) {
      const items = g.items.filter((it) => puedeVerItem(it, vista));
      if (items.length) filas.push({ tipo: 'grupo', key: g.key, label: g.label, icon: g.icon, filas: items.map((it) => filaDeItem(it, [it.key])) });
    }
    // Lo que la regla del teléfono muestra y la sidebar no (no debería pasar): se queda, como antes del 17/10/2026.
    for (const s of deFamilia) {
      if (!usadas.has(s.id)) filas.push({ tipo: 'pantalla', key: s.navKey, label: s.label, icon: s.icon, href: s.href, seccion: s.id });
    }
    if (filas.length) out.push({ id: familia.id, titulo: familia.label, filas });
  });
  // El menú de la foto, como lo dibuja el Sidebar (`!soloSeccion`, `adminOnly` sólo para el super admin): «Settings» primero
  // (24/10/2026, la key `perfil`), igual que en la computadora.
  const menu = USER_NAV
    .filter((it) => !it.soloSeccion && (!it.adminOnly || adminShell) && puedeVerItem(it, vista))
    .map((it) => filaDeItem(it, [it.key]));
  if (menu.length) out.push({ id: 'menu', titulo: null, filas: menu });
  // El del super admin, como Platform en el menú de la foto (17/10/2026 noche): sus herramientas y «Coming soon» desplegable
  // con las «pronto», que dejaron de ser filas de la barra (nav.ts → PRONTO).
  if (adminShell) {
    out.push({ id: 'superadmin', titulo: null, filas: [
      ...SUPERADMIN_MENU.map((it) => filaDeItem(it, [it.key])),
      { tipo: 'grupo', key: 'pronto', label: 'Coming soon', icon: 'reloj', filas: PRONTO.map((it) => filaDeItem(it, [it.key])) },
    ] });
  }
  // ⚠️ SIN MaKo Partners NI Agency Dashboard, en cualquier teléfono (4/11/2026): existen para vender MaKo a otros, y el
  //    teléfono no vende (lib/tienda.ts → `TABS_QUE_VENDEN`). Sus páginas vuelven a More si alguien llega por un link.
  return sinLoQueVende(out);
}

/** La sección de More dueña de esta ruta (`/m/ads/123` → Ads Manager), o null. */
export function seccionDeRuta(pathname: string | null | undefined): DefSeccionMas | null {
  const p = pathname ?? '';
  if (!esRutaMovil(p)) return null;
  return SECCIONES_MAS.find((s) => dentro(p, s.href)) ?? null;
}

/**
 * Qué lugar de la barra está activo para esta ruta (null fuera de /m o en una ruta suelta
 * como /m/configurar). Con la barra del rol (`barraMovil`), una sección que subió a la barra
 * se marca a sí misma; si no, cualquier ruta de una sección de More (y la cuenta, que es la
 * primera fila de More) marca More.
 */
export function destinoActivo(
  pathname: string | null | undefined,
  barra: ReadonlyArray<{ id: IdBarra; href: string }> = DESTINOS_MOVIL,
): IdBarra | null {
  const p = (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '');
  if (!esRutaMovil(p)) return null;
  for (const d of barra) if (dentro(p, d.href)) return d.id;
  // El Ops Center del medio (20/10/2026) es dueño de todo lo suyo: el chat (y /m/mako, que redirige ahí), el grafo
  // (/m/second-brain/mapa) y, para el super admin, también el Centro, aunque su lugar abra el otro.
  if (barra.some((d) => d.id === 'mako') && (dentro(p, RUTA_OPS_CENTER_M) || dentro(p, '/m/mako') || dentro(p, RUTA_CENTRO_M))) return 'mako';
  // El Dashboard en la barra (04/11/2026) es dueño de lo suyo, abra la portada o la hoja de un rol: /m/hoy, las hojas
  // (/m/dashboard) y su campana (Avisos).
  if (barra.some((d) => d.id === 'dashboard') && (dentro(p, HOME_MOVIL) || dentro(p, '/m/dashboard') || dentro(p, RUTA_INBOX))) return 'dashboard';
  // Sin él en la barra, el Dashboard y su campana son filas de More (como del 20/10/2026 al 04/11/2026).
  if (dentro(p, HOME_MOVIL) || dentro(p, RUTA_INBOX)) return 'mas';
  if (seccionDeRuta(p) || dentro(p, '/m/cuenta')) return 'mas';
  return null;
}

/** El id de un plan de video (`crypto.randomUUID()`, app/video-generator/actions.ts). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Las rutas de escritorio que hoy sólo REDIRIGEN (/analisis → la pestaña Análisis de Experiments,
 * /offer-analyst → /offer) se reconocen con una regex, como los `starts()` de nav.ts: un string con esa
 * ruta es lo que tests/analisis-mudada.test.ts persigue como link vivo a una ruta vieja. Esto no enlaza:
 * reconoce un link viejo que llega (un marcador, un aviso ya mandado) y lo lleva a su sección.
 */
const RUTA_VIEJA_ANALISIS = /^\/analisis$/;
const RUTA_VIEJA_OFFER = /^\/offer-analyst(?:\/|$)/;

/**
 * La ruta de una sección de More con lo que su pantalla de escritorio lee de la query
 * (`QUERY_DE_SECCION`) y, encima, lo que la ruta de escritorio fija (`/analisis` es la pestaña
 * Análisis). Nada más viaja: ni el `?ws=` ni una clave que nadie lee.
 */
function aSeccion(id: IdSeccionMas, q: URLSearchParams, fija: Record<string, string> = {}): string {
  const href = SECCIONES_MAS.find((s) => s.id === id)!.href;
  const out = new URLSearchParams();
  for (const k of QUERY_DE_SECCION[id] ?? []) {
    const v = q.get(k);
    if (v != null && v !== '') out.set(k, v);
  }
  // Lo fijo va AL FINAL y pisa lo que vino, como `destinoConQuery` de escritorio (app/analisis/page.tsx).
  for (const [k, v] of Object.entries(fija)) { out.delete(k); out.set(k, v); }
  const resto = out.toString();
  return resto ? `${href}?${resto}` : href;
}

/**
 * El equivalente MÓVIL de un link de escritorio, o null si esa pantalla no va al teléfono.
 * Recibe el path con o sin query. Devuelve el path, y una query SÓLO donde la pantalla del
 * teléfono la lee (`/m/dashboard?hoja=comercial`, o la de un link que ya es de /m, como
 * `/m/inbox?vista=avisos`) o donde la de ESCRITORIO la lee y el link vuelve allá
 * (`QUERY_DE_SECCION`). El `?ws=` NUNCA viaja: lo pone quien navega (`conWs`,
 * `rutaConWs` o `linkApp`), y uno viejo pegado en el link ganaría (conWs no pisa el que ya
 * está). Una URL absoluta se recorta a su path.
 */
export function rutaMovil(href: string | null | undefined): string | null {
  if (!href) return null;
  let path = href;
  try {
    if (/^https?:\/\//i.test(href)) path = new URL(href).pathname + new URL(href).search;
  } catch { return null; }
  // El `#` se va ANTES de partir la query: `/crm/12#notas` no matcheaba la ficha y
  // el push caía en la home (AGENTS.md: un id que se saca de un link va sin `?` ni `#`).
  const [soloPath, query = ''] = path.split('#')[0].split('?');
  const p = soloPath.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(query);

  if (esRutaMovil(p)) {
    q.delete('ws');
    const resto = q.toString();
    return resto ? `${p}?${resto}` : p;
  }
  if (p === '/general' || p === '/focus' || p === '/inicio') return HOME_MOVIL;
  if (p === '/mako/pendientes' || p.startsWith('/mako/revisar') || p.startsWith('/crm/revisar') || p.startsWith('/plan/revisar')) return '/m/inbox';
  if (p === '/mako' || p === '/mako-doer') return '/m/second-brain';
  // La Ticketera del super admin vive ADENTRO del Centro desde el 16/10/2026 (`?ticketera=`): sus rutas de antes
  // (y /admin/runway, la más vieja) van directo a la Ticketera del Centro en el teléfono, con la vista que eran.
  if (p === '/tickets/decisiones' || p === '/admin/runway') return '/m/operaciones?ticketera=tarjetas';
  if (p === '/tickets/decisiones/lista') return '/m/operaciones?ticketera=lista';
  // El Centro de Operaciones del super admin (15/10/2026). Desde esa noche no tiene pestañas (el avance va en cada
  // chat): un `?tab=` viejo no viaja, y abre los chats. Lo que sí viaja es la Ticketera (`?ticketera=`).
  if (p === '/admin/operaciones') {
    const t = q.get('ticketera');
    return t === 'tickets' || t === 'tarjetas' || t === 'lista' ? `/m/operaciones?ticketera=${t}` : '/m/operaciones';
  }
  // Las pantallas que SÓLO existen en el teléfono, con la URL que muestran (`SOLO_TELEFONO`).
  const chat = p.match(/^\/crm\/(\d+)\/chat$/);
  if (chat) return `/m/crm/${chat[1]}/chat`;
  if (p === '/mas') return RUTA_MAS;
  if (p === '/configurar') return '/m/configurar';
  if (p === '/perfil/instalar') return '/m/cuenta/instalar';
  // «Tu cuenta» (15/10/2026): la Seguridad tiene su pantalla en el teléfono (la misma, con su `?ver=`);
  // las Notificaciones de la persona son, en el teléfono, los avisos de /m/cuenta.
  if (p === '/perfil/seguridad') return '/m/cuenta/seguridad';
  if (p === '/perfil/notificaciones') return '/m/cuenta';
  // «Tus cuentas de IA» (21/10/2026): el estado de sus computadoras y «Desconectar»; conectar una, en la computadora.
  if (p === '/perfil/ia') return '/m/cuenta/ia';
  const lead = p.match(/^\/crm\/(\d+)(?:\/resumen)?$/);
  if (lead) return `/m/crm/${lead[1]}`;
  if (p === '/crm') return '/m/crm';
  // La bandeja unificada de escritorio (/chats) y la de WhatsApp (/whatsapp, que convive hasta que Martín
  // valide que Chats la reemplaza) son, en el teléfono, la misma pestaña Chats.
  // Los links profundos de UNA conversación (lib/chats-links.ts) abren SU pantalla, la de todos sus canales
  // (17/10/2026; hasta ese día `?lead=` abría el WhatsApp del lead y `?c=` la lista, que no tenía Instagram):
  //   · `?c=<clave>` (un aviso de Instagram, la propia pestaña) y `?lead=412` (MaKo por WhatsApp) → /m/chats/<clave>;
  //   · `?linea=&chat=<jid>` (un mensaje de WhatsApp) no nombra la clave: va a la lista CON esa query, que lo
  //     busca (app/m/chats/page.tsx). Sin la query, un push que vuelve a la computadora perdería el chat.
  if (p === '/chats' || p === '/whatsapp') {
    const c = q.get('c')?.trim();
    if (c) return `${RUTA_CHATS}/${encodeURIComponent(c)}`;
    const leadChat = Number(q.get('lead'));
    if (Number.isSafeInteger(leadChat) && leadChat > 0) return `${RUTA_CHATS}/${encodeURIComponent(`lead:${leadChat}`)}`;
    const jid = q.get('chat')?.trim();
    if (jid) {
      const out = new URLSearchParams();
      const linea = q.get('linea')?.trim();
      if (linea) out.set('linea', linea);
      out.set('chat', jid);
      return `${RUTA_CHATS}?${out.toString()}`;
    }
    return RUTA_CHATS;
  }
  if (p === '/plan' || p === '/plan/agencia' || p === '/todo') return '/m/plan';
  // «Reportar problema» (17/10/2026): la lista, y UN ticket por su `?t=` (el link del aviso), como en la computadora.
  // Sólo /tickets: /tickets/decisiones es la Ticketera del Centro (arriba) y /tickets/bandeja, la del super admin.
  if (p === '/tickets') {
    const t = Number(q.get('t'));
    return Number.isSafeInteger(t) && t > 0 ? `/m/tickets/${t}` : '/m/tickets';
  }
  if (p === '/perfil') return '/m/cuenta';
  // «Configuración del negocio» (17/10/2026): el índice, y cada sección por su ruta de escritorio. El `?tab=` VIEJO de
  // /configuraciones (los 49 avisos dicen `?tab=notif` para apagar un reporte) va a donde lo manda la computadora
  // (`rutaDeTabVieja`): `notif` a las Notificaciones DEL NEGOCIO. Hasta el 17/10 iba a «Tu cuenta», que en escritorio
  // dejó de ser ese lugar el 15/10. Horario y Criterio son General, que en el teléfono es el índice.
  if (p === '/configuraciones') {
    const vieja = rutaDeTabVieja(q.get('tab'));
    const sec = vieja ? CLAVES_NEGOCIO_M.find((k) => SECCIONES_NEGOCIO_M[k] === vieja) : undefined;
    return sec ? `${RUTA_CONFIG_M}/${sec}` : RUTA_CONFIG_M;
  }
  if (p === '/marketing/salud') return `${RUTA_CONFIG_M}/integraciones`;
  // Knowledge (17/10/2026): la computadora guarda dónde estás en el `#hash` (app/conocimientos/posicion.ts), que no llega
  // al server; lo que sí llega son los links de antes, `?curso=<slug>&clase=<n>`, que la computadora traduce sola. Con eso
  // el teléfono abre el curso o la clase, y vuelve por la misma forma.
  if (p === '/conocimientos') {
    const curso = q.get('curso')?.trim();
    if (!curso) return '/m/conocimientos';
    const clase = Number(q.get('clase'));
    return `/m/conocimientos/${encodeURIComponent(curso)}${Number.isSafeInteger(clase) && clase > 0 ? `/${clase}` : ''}`;
  }
  // La API lee `?tab=` (docs · tokens · registro) en los dos lados: viaja (`QUERY_DE_SECCION`).
  if (p === '/api-mako') return aSeccion('api-mako', q);
  if (UNA_A_UNA[p]) return UNA_A_UNA[p];
  for (const k of CLAVES_NEGOCIO_M) {
    if (p !== SECCIONES_NEGOCIO_M[k]) continue;
    // Integraciones lee `?abrir=<key>` (o `?servicio=`) para abrir ESA integración (lib/integracion-en-tab.ts): viaja.
    const out = new URLSearchParams();
    if (k === 'integraciones') for (const c of ['abrir', 'servicio']) { const v = q.get(c); if (v) out.set(c, v); }
    const resto = out.toString();
    return `${RUTA_CONFIG_M}/${k}${resto ? `?${resto}` : ''}`;
  }
  // Las secciones de More (v2). Cada una cae en su sección. Donde el id es EL MISMO en los dos
  // lados (el plan de un video, una landing de landing_docs), va a la pantalla de ESA cosa; un
  // anuncio de Meta no tiene pantalla propia en el teléfono y cae en la lista de Ads Manager.
  if (p === '/comercial') return '/m/dashboard?hoja=comercial';
  if (p === '/dashboard' || p === '/marketing' || dentro(p, '/graficos')) {
    // `?hoja=` de escritorio: «comercial» es la segunda pestaña del segmentado; otra hoja propia
    // abre /m/dashboard/<id> (si no existe o no entra en el teléfono, esa página vuelve sola).
    const hoja = q.get('hoja')?.trim();
    // La hoja fija «Focus» del Dashboard unido (17/10/2026, lib/dashboard-focus.ts) es lo que era /general: la portada.
    if (hoja === 'focus') return HOME_MOVIL;
    if (!hoja || hoja === 'marketing') return '/m/dashboard';
    if (hoja === 'comercial') return '/m/dashboard?hoja=comercial';
    return `/m/dashboard/${encodeURIComponent(hoja)}`;
  }
  if (dentro(p, '/ads-manager')) return '/m/ads';
  // Las siete del 15/10/2026, cada una con lo que su pantalla de escritorio lee de la query. Ninguna
  // tiene subpantallas en el teléfono (todavía): una subruta de escritorio cae en la sección.
  if (dentro(p, '/calendario')) return aSeccion('calendario', q);
  // El Mapa de escritorio (`?panel=mapa`) es su propia ruta en el teléfono (16/10/2026): /m/second-brain es el chat.
  if (dentro(p, '/second-brain')) {
    if (q.get('panel') !== 'mapa') return aSeccion('second-brain', q);
    const conQuery = aSeccion('second-brain', q);
    return `/m/second-brain/mapa${conQuery.slice('/m/second-brain'.length)}`;
  }
  // Experiments, y /analisis, que en escritorio redirige a su cuarta pestaña con la query entera y `tab`
  // al final (app/analisis/page.tsx). /analisis/trimestre NO: es el informe congelado que se mandó por
  // WhatsApp (lib/informe-congelado.ts), no tiene pantalla en el teléfono, y mandarlo a Experiments era
  // esconderle el informe a quien abrió el link; se queda en la de escritorio (con su «abrirla igual»).
  if (dentro(p, '/experimentos')) return aSeccion('experimentos', q);
  if (RUTA_VIEJA_ANALISIS.test(p)) return aSeccion('experimentos', q, { tab: 'analisis' });
  // Offer, y /offer-analyst, que redirige ahí (app/offer-analyst/page.tsx).
  if (dentro(p, '/offer') || RUTA_VIEJA_OFFER.test(p)) return aSeccion('offer', q);
  // Copywriting: lo que un cliente ve de esa tab unificada es Ads Writer (y /content-machine, el destino que
  // su código ya declara). Ideas, YouTube Writer y Stories son del super admin y se quedan en la computadora.
  // Desde el 29/10/2026 la fila Copywriting abre el Copywriter (/m/copywriter); el Ads Writer dejó la barra pero sigue con su
  // pantalla del teléfono por link (la matriz, «Analizar guion» con su `?tab=`, los links de MaKo), como en escritorio.
  if (dentro(p, '/ads-writer') || dentro(p, '/content-machine')) {
    const tab = q.get('tab');
    return tab ? `/m/copywriting?tab=${encodeURIComponent(tab)}` : '/m/copywriting';
  }
  // La tab Classroom (era Clients, docs/diseno-clients.md; /classroom desde el 25/10/2026): Clients y las cinco sub-tabs de
  // la comunidad, ANTES que Classroom, que es la raíz (el curso). El teléfono sigue con sus tres pantallas. Lo de /clients
  // ya llega como /classroom (next.config.ts redirige antes del proxy).
  // Los MIEMBROS son una vista de Clients desde el 29/10/2026 (`?vista=miembros`; /classroom/members redirige ahí): en el
  // teléfono viven adentro de la comunidad, como antes.
  if (dentro(p, '/classroom/clients')) return q.get('vista') === 'miembros' ? aSeccion('comunidad', q) : '/m/cs';
  if (dentro(p, '/classroom/members')) return aSeccion('comunidad', q);
  if (SECCIONES_COMUNIDAD_CLIENTS.some((s) => dentro(p, `/classroom/${s}`))) return aSeccion('comunidad', q);
  if (dentro(p, '/classroom')) return aSeccion('curso', q);
  // Las rutas VIEJAS de Customer Success (links ya mandados): en escritorio redirigen a /classroom
  // (app/customer-success/a-clients.ts); el teléfono las lleva directo a su pantalla. Curso y Comunidad, ANTES que
  // Clientes. El Avance se fue del Curso a Clientes: `/customer-success/curso?vista=avance` va a Clientes.
  if (dentro(p, '/customer-success/curso')) return q.get('vista') === 'avance' ? '/m/cs' : aSeccion('curso', q);
  if (dentro(p, '/customer-success/comunidad')) return aSeccion('comunidad', q);
  if (dentro(p, '/customer-success')) return '/m/cs';
  // MaKo Partners: el programa de referidos (la landing, el alta y el panel), como /partners en la computadora.
  if (dentro(p, '/partners')) return '/m/partners';
  // El panel de AGENCIA (25/10/2026): salió de MaKo Partners a /agency, y en el teléfono es /m/agency (app/m/agency).
  if (dentro(p, '/agency')) return '/m/agency';
  if (dentro(p, RUTA_AUTOMATIONS) || dentro(p, '/setting') || RUTAS_VIEJAS_AUTOMATIONS.some((r) => dentro(p, r))) return '/m/automations';
  if (dentro(p, '/video-generator')) {
    const plan = q.get('plan') ?? '';
    return UUID.test(plan) ? `/m/video/${plan}` : '/m/video';
  }
  // Web Generator (ex Landing Generator, 15/10/2026): la ruta nueva y las viejas, que en escritorio
  // redirigen (lib/ruta-web-generator.ts). Una landing por su id, en la nueva o en la vieja.
  const landing = p.match(/^\/(?:web-generator|landing-generator)\/(\d+)$/);
  if (landing) return `/m/landing/${landing[1]}`;
  if (dentro(p, RUTA_WEB_GENERATOR) || RUTAS_VIEJAS_WEB_GENERATOR.some((r) => dentro(p, r))) return '/m/landing';
  // Las tabs de CREACIÓN (17/10/2026): Video Editor, Image Editor, AI Avatar, Reels, Stories y Carousels.
  const creacion = rutaMovilCreacion(p, q);
  if (creacion) return creacion;
  // Las «Coming soon» (17/10/2026), AL FINAL: una tab que tenga su pantalla de verdad la nombra más arriba y gana.
  const pronto = TODOS_LOS_ITEMS.find((i) => i.comingSoon && i.match(p));
  if (pronto) return `${RUTA_PRONTO}/${pronto.key}`;
  return null;
}

/** Para un link que SALE (un Web Push): el equivalente móvil o, si no hay, la home. */
export function rutaMovilOHome(href: string | null | undefined): string {
  return rutaMovil(href) ?? HOME_MOVIL;
}

// =============================================================================
// LAS MISMAS RUTAS (12/10/2026): /m es la carpeta INTERNA, nunca una URL
// =============================================================================
// Martín, mirando /m/hoy en su celular: «lo que esta mal es que funcione por rutas, eso no debe
// ser así... Las rutas deben ser las mismas, solo debe detectar si estoy en mobile». O sea: el
// teléfono abre /crm, /general, /plan… con la MISMA URL que la computadora, y el proxy le sirve la
// página de /m (`NextResponse.rewrite`, proxy.ts → `pedidoMovil` de lib/movil-desvio.ts).
//
// Adentro de /m todo sigue hablando de rutas /m (la cabecera, la barra, el nivel de una pantalla):
// es la representación interna. Hay DOS fronteras, una por sentido, y cada una es UNA función:
//   · al LEER la URL del navegador → `rutaInterna` (lo que /m sabe dibujar);
//   · al NAVEGAR → `rutaEscritorio`, que la aplica `conWs` (lib/ws-tab.ts), por donde pasan las
//     cinco formas de navegar (Link, router, redirect, window.location, linkApp). Un href '/m/…'
//     escrito en una pantalla sale como la ruta de escritorio sin que nadie se acuerde.
// tests/movil-rutas.test.ts fija la ida y vuelta de cada página de app/m.
// =============================================================================

/**
 * Las pantallas que existen SÓLO en el teléfono, con la URL que muestran y a dónde lleva esa URL
 * si la abre una computadora (o un teléfono con «Versión completa»): el proxy la redirige ahí.
 */
export const SOLO_TELEFONO: ReadonlyArray<{ url: RegExp; computadora: (m: RegExpMatchArray) => string }> = [
  { url: /^\/mas$/, computadora: () => '/general' },
  { url: /^\/configurar$/, computadora: () => '/onboarding' },
  // (/perfil/instalar era de esta lista hasta el 15/10/2026: con «Tu cuenta», la computadora tiene su
  // propia sección «Instalar la app», con el QR para abrirla en el celular.)
  { url: /^\/crm\/(\d+)\/chat$/, computadora: (m) => `/crm/${m[1]}` },
];

/** Si `pathname` es una pantalla SÓLO del teléfono, a dónde va en la computadora; si no, null. */
export function respaldoEscritorio(pathname: string | null | undefined): string | null {
  const p = (pathname ?? '').replace(/\/+$/, '') || '/';
  for (const s of SOLO_TELEFONO) {
    const m = p.match(s.url);
    if (m) return s.computadora(m);
  }
  return null;
}

/**
 * La URL que se MUESTRA para una ruta interna de /m: la de escritorio, con la query y el `#`
 * intactos (el `?ws=` incluido). Lo que no es /m vuelve tal cual. Una ruta /m que no está en la
 * tabla también (va a dar 404 como antes, y el test de ida y vuelta la nombra).
 */
export function rutaEscritorio(href: string): string {
  // Barato a propósito: lo llama `conWs` en CADA navegación. Una URL que no arranca con «/m» no es
  // de /m (y la pregunta de verdad es `esRutaMovil`, más abajo: «/mako» también arranca así).
  if (!href || href.charCodeAt(0) !== 47 || href.charCodeAt(1) !== 109) return href;
  const [sinHash, hash] = href.split('#');
  const [crudo, query = ''] = sinHash.split('?');
  const p = crudo.replace(/\/+$/, '') || '/';
  if (!esRutaMovil(p)) return href;
  const q = new URLSearchParams(query);
  let destino: string | null = null;
  let m: RegExpMatchArray | null;
  // /m pelado es la entrada de la app: el Ops Center desde el 20/10/2026 (`ENTRADA_MOVIL`); el Dashboard sigue en /general.
  if (p === '/m') destino = ENTRADA_MOVIL;
  else if (p === HOME_MOVIL) destino = '/general';
  else if ((m = p.match(/^\/m\/crm\/(\d+)\/chat$/))) destino = `/crm/${m[1]}/chat`;
  else if ((m = p.match(/^\/m\/crm\/([^/]+)$/))) destino = `/crm/${m[1]}`;
  else if (p === '/m/crm') destino = '/crm';
  else if (p === RUTA_CHATS) destino = '/chats';
  else if ((m = p.match(/^\/m\/chats\/([^/]+)$/))) {
    // Una conversación (17/10/2026): en escritorio es la pestaña con `?c=<clave>` (lib/chats-links.ts).
    destino = '/chats';
    let clave = m[1];
    try { clave = decodeURIComponent(clave); } catch { /* un % suelto: va tal cual */ }
    q.set('c', clave);
  }
  else if (p === '/m/inbox') destino = '/mako/pendientes';
  else if (p === '/m/plan') destino = '/plan';
  else if (p === RUTA_MAS) destino = '/mas';
  else if (p === '/m/mako') destino = '/second-brain';
  else if (p === '/m/decisiones') { destino = '/admin/operaciones'; q.set('ticketera', 'lista'); }
  else if (p === '/m/tickets/decisiones') { destino = '/admin/operaciones'; q.set('ticketera', 'tarjetas'); }
  else if (p === '/m/operaciones') destino = '/admin/operaciones';
  else if (p === '/m/tickets') destino = '/tickets';
  else if (p === RUTA_CONFIG_M) destino = '/configuraciones';
  else if (p === '/m/conocimientos') destino = '/conocimientos';
  else if ((m = p.match(/^\/m\/conocimientos\/([^/]+)(?:\/(\d+))?$/))) {
    destino = '/conocimientos';
    let curso = m[1];
    try { curso = decodeURIComponent(curso); } catch { /* un % suelto: va tal cual */ }
    q.set('curso', curso);
    if (m[2]) q.set('clase', m[2]);
  }
  else if (Object.values(UNA_A_UNA).includes(p)) destino = Object.keys(UNA_A_UNA).find((k) => UNA_A_UNA[k] === p) ?? null;
  else if ((m = p.match(/^\/m\/configuraciones\/([^/]+)$/)) && esSeccionNegocioM(m[1])) destino = SECCIONES_NEGOCIO_M[m[1]];
  else if ((m = p.match(/^\/m\/tickets\/(\d+)$/))) { destino = '/tickets'; q.set('t', m[1]); }
  else if (p === '/m/cuenta/instalar') destino = '/perfil/instalar';
  else if (p === '/m/cuenta/seguridad') destino = '/perfil/seguridad';
  else if (p === '/m/cuenta/ia') destino = '/perfil/ia';
  else if (p === '/m/cuenta') destino = '/perfil';
  else if (p === '/m/configurar') destino = '/configurar';
  else if ((m = p.match(/^\/m\/dashboard\/([^/]+)$/))) {
    destino = '/dashboard';
    let hoja = m[1];
    try { hoja = decodeURIComponent(hoja); } catch { /* un % suelto: va tal cual */ }
    q.set('hoja', hoja);
  } else if (p === '/m/dashboard') destino = '/dashboard';
  else if (p === '/m/ads') destino = '/ads-manager';
  // Las siete del 15/10/2026 (la query viaja tal cual: es la que `QUERY_DE_SECCION` trajo).
  else if (p === '/m/calendario') destino = '/calendario';
  else if (p === '/m/second-brain/mapa') { destino = '/second-brain'; q.set('panel', 'mapa'); }
  else if (p === '/m/second-brain') destino = '/second-brain';
  else if (p === '/m/experimentos') destino = '/experimentos';
  else if (p === '/m/offer') destino = '/offer';
  else if (p === '/m/copywriting') destino = '/ads-writer';
  else if (p === '/m/curso') destino = '/classroom';
  else if (p === '/m/comunidad') destino = '/classroom/community';
  else if (p === '/m/cs') destino = '/classroom/clients';
  else if (p === '/m/partners') destino = '/partners';
  else if (p === '/m/agency') destino = '/agency';
  else if (p === '/m/automations') destino = RUTA_AUTOMATIONS;
  else if ((m = p.match(/^\/m\/video\/([^/]+)$/))) { destino = '/video-generator'; q.set('plan', m[1]); }
  else if (p === '/m/video') destino = '/video-generator';
  else if ((m = p.match(/^\/m\/landing\/([^/]+)$/))) destino = `${RUTA_WEB_GENERATOR}/${m[1]}`;
  else if (p === '/m/landing') destino = RUTA_WEB_GENERATOR;
  else if ((m = p.match(/^\/m\/pronto\/([^/]+)$/))) destino = itemPronto(m[1])?.href ?? null;
  // Las tabs de CREACIÓN (17/10/2026): la carpeta de /m se llama como la ruta de escritorio (lib/movil-creacion.ts).
  if (!destino) destino = rutaEscritorioCreacion(p);
  if (!destino) return href;
  const resto = q.toString();
  return `${destino}${resto ? `?${resto}` : ''}${hash ? `#${hash}` : ''}`;
}

/**
 * La ruta INTERNA de /m que corresponde a la URL del navegador (sin query), o null si esa URL no
 * es una pantalla del teléfono. Con LAS MISMAS RUTAS el navegador muestra /crm/12 y el shell de /m
 * necesita saber que está en /m/crm/12 (la cabecera, la barra, el nivel de la animación). Acepta
 * también una URL que ya es /m (un link viejo antes del redirect del proxy).
 */
export function rutaInterna(pathname: string | null | undefined, search = ''): string | null {
  const p = (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (esRutaMovil(p)) return p;
  const s = search.replace(/^\?/, '');
  const r = rutaMovil(s ? `${p}?${s}` : p);
  return r ? r.split('?')[0] : null;
}
