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

export type CapaId = 'pm' | 'completo' | 'superadmin' | 'agencia';

export type CapaDef = {
  id: CapaId;
  /** Nombre comercial: lo ve el super-admin al dar de alta. */
  nombre: string;
  descripcion: string;
  /**
   * LO MISMO, PERO ESCRITO PARA EL CLIENTE: es lo que le dice el mail cuando le cambian
   * el plan. `descripcion` está escrita para el super-admin —lo dice su propio comentario
   * de arriba— y usa nuestras palabras («capa», «el producto», «integraciones»).
   *
   * ⚠️ EN ESPAÑOL NEUTRO, NO RIOPLATENSE. Es la regla de la casa y está medida: la voz
   * voseante es la de MaKo hablándole a Martín, y el texto que lee un CLIENTE no la usa
   * (ya salió un guion en voseo para un cliente del norte de México). `invitarPorEmail`
   * está escrito así y este mail va por el mismo canal.
   */
  queRecibe: string;
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
    queRecibe: 'Vas a tener el Plan y el Perro Guardián, que ordena tu trabajo por prioridad. No hace falta conectar nada.',
    // Solo el board y MaKo. Sin Meta ni CRM no hay tablero que mostrar, y una
    // tab vacía se lee como producto roto (por eso no se le esconden "por ahora":
    // no las compró).
    // ⚠️ `productivity-analyst` ENTRA ACÁ PORQUE YA LO TENÍA. Eran los gráficos del
    // tablero, o sea que venían incluidos en `todo`; al mudarlos a su propia tab
    // (26/09/2026) sacarlos de esta capa habría sido quitarle una pantalla a quien la
    // usaba, sin que nadie lo pidiera. Un Project Manager es justamente el que mira
    // cuánto se produjo.
    // ⚠️ Y `graphics` desde el 11/10/2026: Productivity Analyst salió de la sidebar y es una plantilla
    // del Dashboard (su ruta redirige ahí); sin la tab, el Project Manager se quedaba sin nada.
    // ⚠️ Y `calendario` desde el 13/10/2026: los deadlines del Plan y el Quarter viven ahí, que es lo que mira un PM.
    navKeys: ['todo', 'mako', 'productivity-analyst', 'graphics', 'calendario'],
    // Sin /integraciones: no tiene nada que conectar y la tab sería una lista de
    // rojos que le hace creer que le falta algo. Sin /contexto (es de agencia).
    userNavKeys: ['perfil', 'configuraciones'],
    // Negocio → diagnóstico de fase (el Norte) → plan. La fase alimenta al Perro
    // Guardián para que priorice con el criterio de la etapa real del negocio.
    // Desde el 16/10/2026 es el modo 'plan' del chat de arranque (lib/onboarding-arranque.ts):
    // sin oferta ni CRM, que esta capa no ve.
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
    queRecibe: 'Vas a tener todo el producto: anuncios, CRM, los analistas, los chats y el Plan.',
    navKeys: null,
    userNavKeys: null,
    // ⚠️ DESDE EL 16/10/2026 EL ONBOARDING ES UNA CONVERSACIÓN: el chat de arranque
    // (app/onboarding/ChatArranque.tsx, reglas en lib/onboarding-arranque.ts). Pedido de Martín:
    // «Quiero que elimines todo lo que hay hoy en onboarding tal como está y que lo reemplaces por
    // el chat de "Offer"». Los pasos son los mismos del catálogo, y cada uno se cierra así:
    //  · negocio       → quién es, cómo se llama el negocio, su objetivo a 90 días, y el BRIEF que
    //                    deja escrito la conversación (lo leen los generadores y el Perro).
    //  · productos     → la oferta armada en el chat, y el producto que sale de ella.
    //  · fase          → el diagnóstico (lo pregunta el chat de Offer) y el CRM principal sembrado
    //                    con el tipo que elige.
    //  · tabs          → el teléfono verificado adentro del chat, o POSTERGADO.
    //  · integraciones → Meta se conecta después, desde su tab: se POSTERGA y queda el recordatorio.
    // `gemini` y `archivero` salieron: un cliente nuevo no trae una API (Ticketera
    // `clientes-usan-su-claude`) y los documentos que manda en el chat ya van al Archivero.
    // El wizard de antes, pantalla por pantalla, quedó en docs/onboarding-pasos-anteriores.md.
    //
    // ⚠️ ESTE ONBOARDING CARGA EL NEGOCIO, NO LA FÁBRICA DE CREATIVOS. Antes tenía cinco
    // pasos más —entregable, avatares, persona, personalidad, angulos— y esos cinco SON
    // la fábrica de creativos (avatar × razón → matriz), o sea la configuración de una
    // tab, no del negocio. Pedirlos acá tenía dos costos y los dos se pagaron:
    //
    //   · Alargaba el arranque a ~20 pantallas antes de que el cliente viera NADA. De
    //     cuatro clientes reales, dos no terminaron el wizard.
    //   · Y los pedía sin contexto: «Tu matriz de anuncios» no significa nada para
    //     alguien que todavía no abrió la tab donde esa matriz se usa.
    //
    // Ahora viven en el onboarding del **Copy Generator** (lib/tab-onboarding-catalogo.ts
    // → 'ads-writer'), que es donde se escribe el guion, y el Video Generator depende de
    // él (`cubre`): primero el guion, después el video. Decisión de Martín, textual:
    // «primero va el guion y luego el video… Son 2 onboarding diferentes. Y si no está
    // hecho el primero, no debería dejarte hacer el segundo».
    //
    // ⚠️ Y `retro` TAMPOCO está: pasó a ser una OPCIÓN de la pantalla final (Listo.tsx),
    // no un paso obligatorio. Como paso era una pared más —con un «Seguir sin Retro →»
    // que ya admitía que no correspondía exigirla—; como opción es lo que alguien elige
    // si quiere ver su rendimiento de los últimos meses.
    //
    // Los pasos que salieron NO se borran de `PASOS_ONBOARDING`: lo que el cliente ya
    // contestó sigue guardado, y si vuelve a entrar no se le vuelve a preguntar.
    onboarding: ['negocio', 'productos', 'fase', 'tabs', 'integraciones'],
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
  /**
   * UNA AGENCIA: un cliente que ademas tiene CLIENTES PROPIOS.
   *
   * ⚠️ NACIO EL 27/09/2026 PORQUE «Agencia» ERA UNA ETIQUETA Y NO UN PLAN. La
   * tarjeta de Codigo Inmobiliario decia «Completo» + un chip verde «Agencia», y
   * el dueno lo corrigio: «un cliente de Agencia NO es super admin y tampoco
   * Completo, es Agencia». Tenia razon en las dos mitades — y la primera es la
   * que importa: `superadmin` es como se identifica la PLATAFORMA, no un plan, y
   * compartir la palabra «agencia» con ella era lo que hacia que pareciera uno.
   *
   * ⚠️ VE LO MISMO QUE `completo`, y eso es a proposito: lo que la distingue no es
   * lo que compro, es lo que puede HACER — tener clientes. Lo lee `esAgencia()`
   * (lib/agencia.ts), que antes miraba una tabla aparte. Si manana una agencia
   * necesita un set de tabs distinto, los dos ejes se vuelven a separar y este
   * comentario es el aviso de que eso ya se penso.
   */
  agencia: {
    id: 'agencia',
    nombre: 'Agencia',
    descripcion: 'Todo el producto, y ademas puede tener clientes propios adentro de MaKo.',
    queRecibe: 'Vas a tener todo el producto y, además, puedes tener a tus propios clientes dentro de MaKo.',
    navKeys: null,
    userNavKeys: null,
    // El mismo chat de arranque que Completo (ver arriba).
    onboarding: ['negocio', 'productos', 'fase', 'tabs', 'integraciones'],
    briefGrupos: null,
    integracionesRequeridas: ['meta'],
    categoriasIntegraciones: null,
    seedBoardVsl: true,
  },
  // El espacio propio del SUPER-ADMIN de la agencia (no es un cliente): usa MaKo
  // para SU trabajo — su plan, su Perro, sus reuniones (Fathom) y sus IA. El canal no
  // oficial de WhatsApp de MaKo no vive acá: es la tab de admin "WhatsApp de MaKo"
  // (/agencia). Las integraciones, desde el 08/10/2026, las ve TODAS (ver abajo).
  superadmin: {
    id: 'superadmin',
    // ⚠️ SE LLAMABA «SuperAdmin (agencia)» Y ESO CONFUNDIA DOS COSAS. «Un SuperAdmin
    // NO es lo mismo que agencia» (27/09/2026): el super admin es la PLATAFORMA, y una
    // agencia es un cliente que ademas tiene clientes propios. Que compartieran nombre
    // es lo que hacia que el tipo apareciera como una opcion mas al crear un cliente.
    nombre: 'SuperAdmin',
    descripcion: 'El espacio propio del super-admin: su plan, sus reuniones, sus IA y todas las integraciones.',
    // No se manda nunca: nadie «pasa a» SuperAdmin (no está en CAPAS_VENDIBLES). Va igual
    // porque el campo es obligatorio y dejarlo opcional invita a olvidarlo en la próxima.
    queRecibe: 'Es el espacio de la plataforma.',
    // ⚠️ `customer-success` ENTRA ACÁ EL 26/09/2026, y no es un permiso de más: MaKo TIENE
    // clientes —Mauricio, Leila, Juanfran— y viven en ESTE workspace, que es el de la
    // agencia. La tab se rehízo ese día para servir a cualquier workspace, así que dejarla
    // afuera de la única capa que administra el producto era la última pieza del bug que
    // hacía que Customer Success fuera «la tab de Mauricio»: sin esto, el super-admin sólo
    // podía verla ENTRANDO al workspace de un cliente, o sea mirando la cartera de otro.
    // ⚠️ `video-editor` ENTRA ACÁ EL 12/10/2026: era `adminOnly` hasta que Martín lo
    // abrió ese mismo día, y esta capa tiene `navKeys` EXPLÍCITAS: sin la key, el super
    // admin no la ve en su propio workspace y `requireCapa` lo rebota (lo mismo le pasa a
    // `video-generator`, que no está en la lista).
    // ⚠️ `calendario` ENTRA ACÁ EL 13/10/2026, con la tab: MaKo también planea sus publicaciones y sus llamadas.
    // ⚠️ `chats` NO ENTRA (14/10/2026, decisión tomada al crear la tab, AGENTS.md «Una tab nueva decide si
    // entra en la capa superadmin»): va donde va `whatsapp`, y `whatsapp` tampoco está. Este workspace no tiene
    // CRM ni bandeja de leads: el WhatsApp propio de MaKo es la tab de admin «WhatsApp de MaKo» (/agencia), y
    // los chats de un cliente se miran entrando a SU workspace. tests/chats-registro.test.ts fija la paridad
    // chats ↔ whatsapp en TODAS las capas: si un día `whatsapp` entra acá, `chats` entra con ella.
    navKeys: ['todo', 'mako', 'mako-doer', 'closing', 'experimentos', 'customer-success', 'productivity-analyst', 'graphics', 'video-editor', 'calendario'],
    userNavKeys: null,
    // Sin wizard: el super-admin no hace onboarding de cliente.
    onboarding: [],
    briefGrupos: ['negocio'],
    integracionesRequeridas: [],
    // ⚠️ TODAS LAS INTEGRACIONES, desde el 08/10/2026. Antes la capa listaba sólo
    // Inteligencia, IA Generativa, Agentes, Reuniones, Contenido y Datos, y escondía
    // YouTube, Calendly y Google Calendar, con el argumento de que el super-admin no
    // corre anuncios ni tiene un funnel de leads. Dejó de ser cierto: MaKo pauta con su
    // propia página, cuenta publicitaria y píxel, y el botón «Conectar con Meta» de la app
    // propia se prueba ACÁ (probarlo adentro de un cliente le pisaría su conexión). Sin
    // «Publicidad» la tarjeta de Meta no aparecía y no había dónde apretarlo. Lo pidió
    // Martín: «En su momento habíamos quitado muchas conexiones, vuélvelas a poner todo».
    categoriasIntegraciones: null,
    seedBoardVsl: false,
  },
};

export const CAPA_DEFAULT: CapaId = 'completo';

export const CAPAS_LISTA: CapaDef[] = Object.values(CAPAS);

/**
 * Las capas que se le pueden PONER a un cliente desde una pantalla.
 *
 * ⚠️ NO ES COSMETICA, ES UN AGUJERO CERRADO. `CAPAS_LISTA` es el catalogo entero y
 * el panel de clientes lo ofrecia tal cual —en el alta y en «Pasar a …» de cada
 * tarjeta—, asi que se podia pasar CUALQUIER cliente a la capa `superadmin`. Y esa
 * capa no es un plan: es COMO SE IDENTIFICA LA PLATAFORMA. `wsSuperAdmin()`
 * (lib/workspace.ts) devuelve el workspace de MENOR id con esa capa y lo cachea a
 * nivel de modulo, asi que un click ahi muda la identidad de MaKo al workspace de un
 * cliente — con eso se leen las credenciales de plataforma y sale el remitente de
 * los mails de acceso. Es la misma familia que «OWNER_WS no es la plataforma».
 *
 * En POSITIVO: se enumera lo que SI se vende. Una capa nueva no entra sola a la
 * pantalla; entra cuando alguien la agrega aca, que es una decision.
 */
export const CAPAS_VENDIBLES: CapaDef[] = CAPAS_LISTA.filter((c) => c.id !== 'superadmin');

/**
 * ⚠️ ESTO ES FAIL-**OPEN**, Y EL COMENTARIO QUE HABIA ACA DECIA LO CONTRARIO.
 * Decia «Fail-closed: una capa desconocida cae al catalogo, nunca a "ve todo"», y
 * el codigo cae a `CAPA_DEFAULT`, que es 'completo' — la capa con `navKeys: null`,
 * o sea literalmente «ve todo». Un valor desconocido en `workspaces.capa` le abre
 * a ese cliente TODAS las tabs del producto, sin error y sin log.
 *
 * La unica red es el CHECK `workspaces_capa_valida` de la base (mig 0092/0096), y
 * por eso ampliarlo es parte de agregar una capa, no un tramite.
 */
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
