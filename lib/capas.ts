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
 *
 * ⚠️ Esta lista es la FUENTE ÚNICA. El tipo, el esqueleto de `OnboardingState.steps`
 * y el union que valida el endpoint salen todos de acá — no se re-escriben a mano.
 * Antes eran cuatro listas paralelas mantenidas por separado y el paso `productos`
 * nació roto por eso: estaba en el tipo y en el orden de la capa, pero no en el
 * estado ni en el body, así que cerrarlo era un TypeError que devolvía 500 y el
 * cliente quedaba varado en esa pantalla para siempre. Ver
 * docs/hallazgos-onboarding.md → «El paso `productos` no existe en el estado».
 */
export const PASOS_ONBOARDING = [
  'integraciones', 'tabs', 'negocio', 'archivero', 'productos', 'entregable',
  'avatares', 'persona', 'personalidad', 'angulos', 'fase', 'gemini', 'retro', 'plan',
] as const;

export type PasoOnboarding = typeof PASOS_ONBOARDING[number];

/** Guard en positivo: solo pasa lo que está en el catálogo. Para validar bodies JSON. */
export function esPasoOnboarding(v: unknown): v is PasoOnboarding {
  return typeof v === 'string' && (PASOS_ONBOARDING as readonly string[]).includes(v);
}

/**
 * Los pasos que se pueden DEJAR PENDIENTES y seguir.
 *
 * EL CRITERIO NO ES «cuál importa menos»: es **cuáles no se pueden terminar acá
 * adentro**. Los dos de esta lista se cierran en un sistema de afuera —la consola de
 * Meta, un mensaje de WhatsApp que tiene que llegar—, así que el cliente que se traba
 * no se traba por no querer completarlos: se traba porque la pelota no la tiene él.
 * Todos los demás son contenido de su negocio, que sabe y puede escribir ahora; ésos
 * siguen siendo obligatorios y por eso la lista es corta.
 *
 * NO ES HIPOTÉTICO. De los cuatro clientes reales, los DOS que no terminaron el wizard
 * murieron en un paso de conexión, ninguno en uno de contenido. Uno estuvo nueve días
 * parado en Meta — y como el wizard es bloqueante, esos nueve días tampoco pudo entrar
 * a usar el resto de MaKo, que no dependía de Meta para nada.
 *
 * ⚠️ `gemini` NO está y no es un olvido: seis pasos posteriores (entregable, avatares,
 * persona, personalidad, ángulos, y la matriz) LO CONSUMEN. Postergarlo no te deja
 * seguir: te deja seguir hasta la próxima pantalla y romper ahí, que es peor que
 * frenar acá con el motivo escrito.
 *
 * ⚠️ LA REGLA GENERAL —«un paso solo es postergable si nada río abajo lo necesita»— NO
 * TIENE VALIDACIÓN AUTOMÁTICA, y hay que decirlo en vez de suponerla. Quién depende de
 * quién no está en ningún dato: vive en el `puedeAvanzar` de `OnboardingWizard.tsx`,
 * como una cadena de ternarios en el cliente. Así que esta lista se sostiene con
 * criterio humano al sumarle uno. Lo que sí queda amarrado es el resto: `POSTERGABLE_TXT`
 * y los verificadores de `lib/onboarding-pendientes.ts` fallan a COMPILAR si un paso
 * nuevo entra sin frase o sin forma de saber si sigue faltando, y `tests/onboarding-
 * postergar.test.ts` clava la lista para que agrandarla sea una decisión y no un
 * descuido.
 */
export const PASOS_POSTERGABLES = ['integraciones', 'tabs'] as const satisfies readonly PasoOnboarding[];

/** ¿Este paso se puede dejar pendiente? Guard en positivo, igual que el de arriba. */
export function esPostergable(v: unknown): v is PasoOnboarding {
  return typeof v === 'string' && (PASOS_POSTERGABLES as readonly string[]).includes(v);
}

/**
 * Qué le falta al cliente si dejó pendiente este paso, en una frase y en su idioma.
 * Vive acá —y no en la pantalla que lo pinta— porque lo consumen el wizard (para
 * ofrecer la salida) y `/general` (para el recordatorio), y una frase escrita dos veces
 * es una frase que se queda vieja en una de las dos.
 */
export const POSTERGABLE_TXT: Record<(typeof PASOS_POSTERGABLES)[number], { que: string; donde: string; ruta: string }> = {
  integraciones: { que: 'Conectar tus cuentas de publicidad', donde: 'Integraciones', ruta: '/integraciones' },
  tabs: { que: 'Verificar tu teléfono para los reportes', donde: 'Perfil', ruta: '/perfil' },
};

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
    // Orden del onboarding (pedido de Martín):
    //  1. fase       → el NORTE del negocio (default, sin IA); de ahí cuelga el resto.
    //  2. gemini     → token de Gemini (IA gratis) que mueve TODO el onboarding con IA.
    //  3. archivero  → tira los docs, MaKo arma el brief.
    //  4. entregable → el elemento tangible de la oferta (FOMO); alimenta el copy.
    //  5. avatares   → los 3 segmentos (el "¿a quién?").
    //  6. persona    → la cara de marca (fotos + descripción) para los creativos.
    //  7. personalidad → el quiz de voz del creador (humaniza guiones y copy).
    //  8. angulos    → la MATRIZ (avatar × razón), la salida de la fábrica.
    //  9. tabs       → contacto de reportes + verificación de WhatsApp.
    // 10. integraciones (solo Meta) → AL FINAL (pedido de Mauricio: conectar Meta es lo
    //     último; antes se ve toda la matriz). 11. retro → valoración/cierre (usa Meta).
    // 'productos' va justo después del Archivero: para entonces MaKo ya leyó el
    // brief y los documentos, así que puede ARMAR el catálogo en vez de preguntarlo.
    // Y va antes del lead magnet y del avatar, que se definen contra la oferta.
    onboarding: ['fase', 'gemini', 'archivero', 'productos', 'entregable', 'avatares', 'persona', 'personalidad', 'angulos', 'tabs', 'integraciones', 'retro'],
    // TODOS los grupos: El Archivero no pregunta de a uno, extrae de los docs y
    // muestra el brief entero (oferta + avatar + personaje de marca) editable en
    // UNA pantalla ("esto entendí, corregí"). Ese perfil completo es lo que
    // después alimenta la generación de ángulos y creativos.
    briefGrupos: null,
    // Solo Meta en el arranque: con las Fases + El Archivero + Meta ya alcanza para
    // una valoración. WhatsApp se conecta después (no bloquea el onboarding).
    integracionesRequeridas: ['meta'],
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
    categoriasIntegraciones: ['Inteligencia', 'IA Generativa', 'Agentes', 'Reuniones', 'Contenido', 'Datos'],
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
