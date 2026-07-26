// =============================================================================
// capas — qué compró cada cliente (la oferta cebolla, hecha datos)
// =============================================================================
// MaKo no se vende entero: se vende por capas. Este catálogo es la ÚNICA fuente
// de verdad de qué incluye cada una — qué tabs ve, qué le pide el onboarding,
// qué integraciones necesita y qué se le siembra al darlo de alta. La columna
// workspaces.capa (mig 0092) solo guarda cuál le tocó a cada cliente.
//
// Agregar una capa nueva = agregar una entrada acá. Si tenés que tocar un `if`
// en otro archivo para que una capa funcione, ese `if` está mal: el dato tiene
// que salir de este catálogo.
//
// DATOS PUROS a propósito (sin 'server-only', sin imports de DB): lo consume
// tanto el Sidebar en el browser como el gating server-side. Quien resuelve la
// capa del request es getCapaActual() en lib/workspace.ts.
// =============================================================================

/**
 * Los pasos posibles del wizard. Cada capa elige cuáles y en qué orden.
 * 'archivero' = "El Archivero": el cliente tira sus documentos sueltos (avatar,
 * oferta, nicho, web/IG…) y MaKo los ordena en el brief. Es la versión DOER de
 * 'negocio' (que pregunta de a un campo): una capa usa uno u otro, no los dos.
 */
export type PasoOnboarding = 'integraciones' | 'tabs' | 'negocio' | 'archivero' | 'fase' | 'retro' | 'plan';

export type CapaId = 'pm' | 'completo' | 'superadmin';

export type CapaDef = {
  id: CapaId;
  /** Nombre comercial: lo ve el super-admin al dar de alta. */
  nombre: string;
  descripcion: string;
  /**
   * Keys de nav.ts (TOP_NAV/grupos/MAKO_ITEM/ADS_MANAGER_ITEM) que la capa ve.
   * null = todas. El Sidebar filtra con esto, pero el enforcement REAL es
   * server-side (requireCapa en lib/tab-access.ts): esconder el link no alcanza.
   */
  navKeys: string[] | null;
  /** Keys de USER_NAV (menú de la foto) visibles. null = todas. */
  userNavKeys: string[] | null;
  /** Pasos del wizard, en orden. Vacío = el cliente entra directo, sin wizard. */
  onboarding: PasoOnboarding[];
  /**
   * Qué grupos del brief del negocio pide el paso 'negocio' (keys del esquema en
   * lib/onboarding.ts). null = todos. Una capa chica solo necesita el grupo base
   * ('negocio'): pedirle a un Project Manager su "avatar" y su "personaje de
   * marca" es hacerle llenar el formulario de un negocio que no tiene.
   */
  briefGrupos: string[] | null;
  /** Integraciones que el cliente DEBE conectar y probar para salir del paso 1. */
  integracionesRequeridas: string[];
  /**
   * CATEGORÍAS de /integraciones que la capa ve (Publicidad, Mensajería,
   * Inteligencia, IA Generativa, Reuniones, Datos). null = todas. Un SuperAdmin no
   * corre ads: mostrarle Publicidad y Mensajería es ruido de otro negocio.
   */
  categoriasIntegraciones: string[] | null;
  /**
   * KEYS puntuales de integración que la capa NO ve, aunque su categoría esté
   * habilitada. Para el super-admin: ve la categoría Datos (por Panda, mide su
   * propio VSL) pero no YouTube; ve Reuniones (por Fathom, sus llamadas) pero no
   * Calendly ni Google Calendar — no agenda R1/R2 de leads de un funnel ajeno.
   */
  integracionesOcultas?: string[];
  /**
   * ¿Se le siembra el board con los proyectos de un negocio VSL (Meta Ads,
   * anuncio ganador, funnel…)? Para quien compró solo el Plan eso es ruido de
   * otro negocio: arranca con el board limpio y crea sus proyectos con MaKo.
   */
  seedBoardVsl: boolean;
};

export const CAPAS: Record<CapaId, CapaDef> = {
  pm: {
    id: 'pm',
    nombre: 'Project Manager',
    descripcion: 'El Plan y el Perro Guardián que prioriza. Sin integraciones: es productivo el primer día.',
    // Solo el board y MaKo. Sin Meta ni CRM no hay tablero que mostrar, y una
    // tab vacía se lee como producto roto (por eso no se le esconden "por ahora":
    // no las compró).
    navKeys: ['todo', 'mako'],
    // Sin /integraciones: no tiene nada que conectar y la tab sería una lista de
    // rojos que le hace creer que le falta algo. Sin /contexto (es de agencia).
    userNavKeys: ['perfil', 'configuraciones'],
    // Negocio → diagnóstico de fase (el Norte) → plan. La fase alimenta al Perro
    // Guardián para que priorice con el criterio de la etapa real del negocio.
    onboarding: ['negocio', 'fase', 'plan'],
    // Solo el grupo base: 3 preguntas. Es lo que el Perro Guardián necesita para
    // priorizar con criterio de SU negocio.
    briefGrupos: ['negocio'],
    integracionesRequeridas: [],
    categoriasIntegraciones: null,
    seedBoardVsl: false,
  },
  completo: {
    id: 'completo',
    nombre: 'Completo',
    descripcion: 'Todo el producto: ads, CRM, analistas, chats, Retro y Plan.',
    navKeys: null,
    userNavKeys: null,
    // El Archivero reemplaza al viejo paso 'negocio': en vez de preguntar de a un
    // campo, el cliente tira TODOS sus documentos (avatar, oferta, nicho, web/IG)
    // y MaKo los ordena en el brief de una. Es la fábrica de creativos empezando
    // por el principio — sin contexto del negocio no hay ángulos que valgan.
    onboarding: ['integraciones', 'tabs', 'archivero', 'fase', 'retro'],
    // TODOS los grupos: El Archivero no pregunta de a uno, extrae de los docs y
    // muestra el brief entero (oferta + avatar + personaje de marca) editable en
    // UNA pantalla ("esto entendí, corregí"). Ese perfil completo es lo que
    // después alimenta la generación de ángulos y creativos.
    briefGrupos: null,
    integracionesRequeridas: ['meta', 'whatsapp'],
    categoriasIntegraciones: null,
    seedBoardVsl: true,
  },
  // El espacio propio del SUPER-ADMIN de la agencia (no es un cliente): usa MaKo
  // para SU trabajo — su plan, su Perro, sus reuniones (Fathom) y sus IA. NO corre
  // ads, no tiene CRM de leads ni mide su propio VSL, así que Publicidad (Meta),
  // Mensajería y Datos son ruido de otro negocio. El canal no oficial de WhatsApp
  // de MaKo no vive acá: es la tab de admin "WhatsApp de MaKo" (/agencia).
  superadmin: {
    id: 'superadmin',
    nombre: 'SuperAdmin (agencia)',
    descripcion: 'El espacio propio del super-admin: su plan, sus reuniones y sus IA. Sin ads, sin CRM, sin VSL.',
    navKeys: ['todo', 'mako', 'mako-doer', 'closing', 'experimentos'],
    userNavKeys: null,
    // Sin wizard: el super-admin no hace onboarding de cliente.
    onboarding: [],
    briefGrupos: ['negocio'],
    integracionesRequeridas: [],
    // Sus IA, la voz, sus reuniones (Fathom) — y Datos: el super-admin SÍ mide su
    // propio VSL. Los mini-VSL de cada funcionalidad viven en Panda y /vsl trackea
    // landing + retención, así que necesita poder conectar Panda desde acá.
    categoriasIntegraciones: ['Inteligencia', 'IA Generativa', 'Agentes', 'Reuniones', 'Datos'],
    // …pero no las tres que son de un funnel de ventas de leads: YouTube (mide un
    // VSL en YT), Calendly y Google Calendar (agenda R1/R2). El super-admin no las usa.
    integracionesOcultas: ['youtube', 'calendly', 'google'],
    seedBoardVsl: false,
  },
};

export const CAPA_DEFAULT: CapaId = 'completo';

export const CAPAS_LISTA: CapaDef[] = Object.values(CAPAS);

/** Fail-closed: una capa desconocida cae al catálogo, nunca a "ve todo". */
export function capaDef(capa: string | null | undefined): CapaDef {
  return CAPAS[(capa ?? '') as CapaId] ?? CAPAS[CAPA_DEFAULT];
}

export function esCapaValida(capa: string): capa is CapaId {
  return capa in CAPAS;
}

/** ¿La capa ve este item del nav? (`navKeys: null` = ve todo.) */
export function navEnCapa(key: string, capa: string | null | undefined): boolean {
  const { navKeys } = capaDef(capa);
  return navKeys == null || navKeys.includes(key);
}

/** ¿La capa ve este item del menú del usuario? */
export function userNavEnCapa(key: string, capa: string | null | undefined): boolean {
  const { userNavKeys } = capaDef(capa);
  return userNavKeys == null || userNavKeys.includes(key);
}

/**
 * ¿La capa ve esta tab? Une los dos menús (sidebar + menú de la foto) porque una
 * página no sabe ni le importa en cuál de los dos vive su link. Es lo que usa el
 * gate server-side (requireCapa).
 */
export function tabEnCapa(key: string, capa: string | null | undefined): boolean {
  return navEnCapa(key, capa) || userNavEnCapa(key, capa);
}
