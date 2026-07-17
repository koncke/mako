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

/** Los pasos posibles del wizard. Cada capa elige cuáles y en qué orden. */
export type PasoOnboarding = 'integraciones' | 'tabs' | 'negocio' | 'retro' | 'plan';

export type CapaId = 'pm' | 'completo';

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
    // Un solo paso: quién es y en qué está trabajando. Alimenta al Perro Guardián
    // para que priorice con criterio de SU negocio, no genérico.
    onboarding: ['negocio', 'plan'],
    // Solo el grupo base: 3 preguntas. Es lo que el Perro Guardián necesita para
    // priorizar con criterio de SU negocio.
    briefGrupos: ['negocio'],
    integracionesRequeridas: [],
    seedBoardVsl: false,
  },
  completo: {
    id: 'completo',
    nombre: 'Completo',
    descripcion: 'Todo el producto: ads, CRM, analistas, chats, Retro y Plan.',
    navKeys: null,
    userNavKeys: null,
    onboarding: ['integraciones', 'tabs', 'negocio', 'retro'],
    // Solo el grupo base, igual que 'pm'. NO el esquema entero: son 18 campos
    // (oferta + avatar + personaje de marca) y el wizard pregunta de a UNA por
    // pantalla — 18 pantallas para entrar a un producto es exactamente lo que
    // estamos tratando de matar. El perfil completo se llena después, sin
    // bloquear, en Configuraciones → Onboarding, que ya tiene el formulario
    // largo bien resuelto (y hasta lo extrae de un documento con IA).
    briefGrupos: ['negocio'],
    integracionesRequeridas: ['meta', 'whatsapp'],
    seedBoardVsl: true,
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
