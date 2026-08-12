// =============================================================================
// plan-proyectos-catalogo — la lista CERRADA de proyectos del tablero del dueño
// =============================================================================
// El problema medido: en dos semanas la IA inventó 24 proyectos nuevos sobre los 40
// curados a mano. Quedaron TRES de Instagram ("Instagram & Gestión de Orgánico",
// "Instagram y Contenido Orgánico", "Integración Instagram & Módulo Orgánico"), DOS de
// "Ads Content Machine", DOS de competencia, y varios con UNA sola tarea ("Desarrollo
// MaKo", "Diseño & UI App", "Ventas & Automatización"). Un tablero de 64 proyectos no
// se lee: no se sabe dónde buscar una tarea ni qué se está construyendo.
//
// LA REGLA que lo cierra, dictada por el dueño: **el proyecto se tiene que entender
// solo, y es GRANDE — del tamaño del nombre de una tab.** Dos familias, nada más:
//
//   · PRODUCTO  → se llama como la tab que se está construyendo (CRM, Dashboard,
//     WhatsApp, Onboarding…). Si la tarea es código de MaKo, va a la tab que toca.
//   · VENDER MAKO → el trabajo de salir a vender, por canal: "Vender MaKo: Ads",
//     "Vender MaKo: Orgánico Instagram", "Vender MaKo: Prospección".
//
// Y unos pocos TRANSVERSALES que no son una tab pero atraviesan toda la app
// (seguridad, diseño, infraestructura, avisos).
//
// Por qué un catálogo y no "que la IA elija bien": el prompt de ruteo ya pedía no
// duplicar y igual duplicó, porque le pasábamos SOLO los nombres y le decíamos que ante
// la duda creara uno nuevo. Con una lista cerrada + qué entra en cada una, "crear un
// proyecto" deja de ser el default y pasa a ser una excepción que hay que justificar.
//
// ⚠️ Esto describe el tablero DEL DUEÑO (plan_proyectos, el roadmap de MaKo). Los
// tableros de los clientes (experimento_tareas) NO usan este catálogo: sus proyectos
// son sus clientes y sus campañas (ver lib/reunion-cliente.ts).
// =============================================================================

export type FamiliaProyecto = 'producto' | 'agente' | 'vender' | 'transversal';

export type ProyectoCatalogo = {
  /** El nombre EXACTO con el que vive en el tablero. */
  nombre: string;
  emoji: string;
  familia: FamiliaProyecto;
  /** Qué entra acá, en una línea. Es lo que lee el modelo para rutear: si no se
   *  entiende de esta línea sola, el nombre está mal elegido. */
  que: string;
};

/**
 * El prefijo de los proyectos que son una FEATURE del producto — o sea, una tab de la
 * app que se está construyendo. Misma idea que `PREFIJO_CLIENTE` en el catálogo del
 * cliente: que se lea de un vistazo qué clase de proyecto es sin tener que conocerlo.
 *
 * Dictado por el dueño: «revisa los nombres de los proyectos y les cambies el nombre a
 * "Feature: NOMBRE" así se entiende bien». Y la otra mitad de la regla, igual de
 * importante: **si no debe llevarlo, no se lo pongas.** Solo la familia `producto`. Un
 * proyecto transversal (Seguridad, Diseño de la app) no es una feature: las cruza
 * todas. Y «Vender MaKo: Ads» no se construye, se hace — su prefijo ya dice qué es.
 *
 * Se aplica SOLO acá, derivado de la familia, y nunca escrito a mano fila por fila: si
 * estuviera copiado 28 veces, la entrada 29 se olvidaría de ponerlo.
 */
export const PREFIJO_FEATURE = 'Feature: ';

/**
 * Los que TRABAJAN SOLOS. Un agente no es una pantalla que abrís: es una IA que
 * decide y ejecuta sin que se lo pidas — el Perro puntúa cuando entran tareas, el
 * Doer actúa cuando le hablás por WhatsApp, el Chat Agent nutre por su cuenta.
 *
 * La frontera la fijó el dueño y es nítida: **si corre solo, es agente; si lo
 * abrís y lo usás, es feature.** Por eso los Analysts y los Generators —que son
 * IA, pero IA que vos disparás— siguen siendo `Feature:`.
 *
 * Separarlos importa por una razón concreta: «Feature: Plan» era el tablero Y el
 * Perro metidos en el mismo proyecto, así que el avance de la pantalla y el del
 * cerebro que la puntúa se sumaban en la misma barra y no se podía saber cuál de
 * los dos estaba trabado.
 */
export const PREFIJO_AGENTE = 'Agente: ';

/** El catálogo tal cual se escribe: `nombre` es el NÚCLEO, sin prefijo. */
const CRUDO: ProyectoCatalogo[] = [
  // ── Producto: una tab, un proyecto ─────────────────────────────────────────
  { nombre: 'General', emoji: '🏠', familia: 'producto', que: 'La pantalla de inicio: el semáforo de qué está bien y qué no, y el diagnóstico del negocio que lo sostiene.' },
  // «General» eran dos cosas distintas metidas en una: el semáforo que DIAGNOSTICA (te
  // dice cómo estás) y el foco que MANDA (te dice qué hacer ahora). Se separan porque
  // compiten: mientras el diagnóstico crecía, la acción de la semana quedaba enterrada
  // entre métricas — que es justo el problema que venía a resolver.
  { nombre: 'Foco', emoji: '🧭', familia: 'producto', que: 'Qué hacer AHORA: la acción de la semana, la vista Hoy, el briefing de la mañana, a quién llamar y el latido que te lo reclama.' },
  { nombre: 'CRM', emoji: '👥', familia: 'producto', que: 'La PANTALLA de los leads: la ficha, el pipeline, las etapas, los recordatorios de reunión y el follow-up. El motor que mueve leads solo es «Agente: CRM automático».' },
  { nombre: 'Dashboard', emoji: '📊', familia: 'producto', que: 'La analítica de marketing y comercial: métricas, gráficos, objetivos y salud del número.' },
  { nombre: 'Experiments', emoji: '🧪', familia: 'producto', que: 'Los experimentos: el único lugar donde se concluye qué funcionó y qué no.' },
  // Plan y el Perro eran UN solo proyecto y son dos cosas distintas: la PANTALLA
  // (tablero, kanban, vistas, gráficos) y el CEREBRO que la puntúa. Mezclados, el
  // avance de las dos se sumaba en la misma barra.
  { nombre: 'Plan', emoji: '🗂️', familia: 'producto', que: 'La PANTALLA del tablero de tareas: kanban, vistas, prioridades, proyectos, gráficos, el modal de la tarjeta y la checklist. NO es el cerebro que puntúa (eso es «Agente: Perro Guardián»).' },
  { nombre: 'Ads Manager', emoji: '📣', familia: 'producto', que: 'Las campañas de Meta desde la app: crear, pausar, renombrar, presupuesto, y el agente que optimiza el gasto.' },
  { nombre: 'Fábrica de creativos', emoji: '🏭', familia: 'producto', que: 'Avatares, razones, matriz, lead magnet, personas, ángulos y guiones: la cadena que produce los creativos.' },
  { nombre: 'Ads Writer', emoji: '🖊️', familia: 'producto', que: 'La redacción de anuncios: copys, variantes y textos listos para publicar.' },
  // Las dos del VSL faltaban, y la ausencia tenía el mismo costo que la de «Legal y
  // fiscal»: sin destino propio, el Perro mandaba el trabajo del PRODUCTO a «Vender
  // MaKo: Landing y VSL», que es el marketing propio de MaKo — otra pantalla, otro
  // objetivo. Son tabs (nav.ts: 'vsl-writer' en Tools, 'vsl-an' en Analytics), así que
  // van en la familia producto como sus hermanas de Ads.
  { nombre: 'VSL Generator', emoji: '🖊️', familia: 'producto', que: 'El generador de guiones de VSL largo: estructuras de VSL, bloques del guion y las variantes a probar. NO es el VSL propio de MaKo (eso es «Vender MaKo: Landing y VSL»). (Se llamaba VSL Writer.)' },
  { nombre: 'Lead Magnet Generator', emoji: '🧲', familia: 'producto', que: 'El generador del lead magnet: qué se regala a cambio del contacto y cómo se arma.' },
  { nombre: 'Image Generator', emoji: '🖼️', familia: 'producto', que: 'Generar imágenes para los creativos desde la app.' },
  { nombre: 'Video Generator', emoji: '🎞️', familia: 'producto', que: 'Generar videos para los creativos desde la app.' },
  // Los formatos de la Content Machine van SEPARADOS, uno por tab. Estuvieron juntos en
  // un «Contenido orgánico» y el dueño lo cortó: son seis destinos distintos del sidebar
  // y el trabajo de cada uno no se parece al del otro.
  { nombre: 'Ideas', emoji: '💡', familia: 'producto', que: 'El copiloto que convierte una idea suelta en un guion. Le tirás lo que sea —una frase, un audio, una imagen, un link de referencia— y te va guiando y organizando hasta que hay una pieza. NO es un repositorio ni un tablero de temas: es la conversación que te lleva de la ocurrencia al guion.' },
  { nombre: 'Mindset', emoji: '🧠', familia: 'producto', que: 'La tab de diagnóstico psicológico del dueño: tests (LOT-R y otros), cómo ese perfil afecta a SU negocio en concreto, y las metodologías para trabajarlo. Diagnosticar → relacionar con el negocio → practicar.' },
  { nombre: 'Reels', emoji: '🎬', familia: 'producto', que: 'El formato Reel para el cliente: guion corto, gancho y estructura para Instagram.' },
  { nombre: 'Carousels', emoji: '🎠', familia: 'producto', que: 'El formato carrusel: la secuencia de placas, qué va en cada una y el cierre.' },
  { nombre: 'Stories', emoji: '⭕', familia: 'producto', que: 'El formato historias: la secuencia diaria, encuestas y el paso a la conversación.' },
  { nombre: 'Thumbnails', emoji: '🖼️', familia: 'producto', que: 'Las miniaturas de YouTube: qué imagen y qué texto hacen que se cliquee.' },
  { nombre: 'YouTube Writer', emoji: '▶️', familia: 'producto', que: 'El guion de los videos largos de YouTube para el cliente: estructura, gancho y CTA.' },
  { nombre: 'Sales Email', emoji: '📧', familia: 'producto', que: 'El generador de emails de venta y las newsletters para el cliente.' },
  { nombre: 'Closing Script', emoji: '📜', familia: 'producto', que: 'El guion de la llamada de cierre: estructura, objeciones y respuestas.' },
  { nombre: 'Sales Roleplay', emoji: '🎭', familia: 'producto', que: 'El simulador para entrenar al vendedor: practicar la llamada contra un cliente simulado.' },
  { nombre: 'Closing Analyst', emoji: '📞', familia: 'producto', que: 'El analista de llamadas de venta: transcripciones, objeciones, y el copiloto en vivo.' },
  { nombre: 'Ads Analyst', emoji: '🎬', familia: 'producto', que: 'El analista de guiones y creativos: retención por cuartiles, qué gancho funciona.' },
  { nombre: 'VSL Analyst', emoji: '🎥', familia: 'producto', que: 'El analista del VSL: en qué tramo se cae el espectador, contra qué parte del guion, y qué pasó después con ese lead en el CRM. NO es el VSL propio de MaKo (eso es «Vender MaKo: Landing y VSL»).' },
  { nombre: 'Landing Analyst', emoji: '🌐', familia: 'producto', que: 'El analista de landing pages: qué convierte y qué no en la página, heatmaps y grabaciones de sesión, dónde se cae el visitante. Es una tab del PRODUCTO — no confundir con «Vender MaKo: Landing y VSL», que es la landing propia de MaKo.' },
  { nombre: 'Landing Generator', emoji: '🧱', familia: 'producto', que: 'El generador de landing pages: estructura, secciones y copy de una landing para el cliente.' },
  { nombre: 'Competitor Spy', emoji: '🕵️', familia: 'producto', que: 'El análisis de competencia: qué anuncia la competencia, qué ofertas hay en el mercado. (Se llamaba Market Analyst.)' },
  { nombre: 'Offer Analyst', emoji: '🏷️', familia: 'producto', que: 'El analista de la oferta del cliente: precio, promesa, garantía y qué la hace comprable.' },
  { nombre: 'Chat Analyst', emoji: '💭', familia: 'producto', que: 'El analista de las conversaciones: dónde se caen los chats, qué objeción aparece, qué responde mejor.' },
  // Estaba en el tablero con 5 tareas y NO en el catálogo: un proyecto huérfano al que
  // el ruteo no puede mandar nada, así que su trabajo se iba a desparramar solo.
  { nombre: 'YouTube Analyst', emoji: '📺', familia: 'producto', que: 'El analista del canal de YouTube del cliente: qué video retiene, qué trae suscriptores y qué convierte.' },
  // Se llamaba «CS Analyst» y el tablero nunca lo usó: sus tareas viven desde siempre en
  // «Feature: Customer Success» (P34, 3 tareas), que NO estaba en el catálogo. O sea el
  // mismo agujero que tenían Landing Analyst y YouTube Analyst, pero al revés: acá el
  // huérfano era el proyecto REAL y el catálogo nombraba uno que no existe. El ruteo no
  // podía mandarle nada y el Roadmap del área salía vacío sin fallar.
  // Y de paso se arregla el alcance: Customer Success no es solo anticipar una baja — es
  // toda la entrega después del pago. El analista de riesgo es UNA de sus piezas.
  { nombre: 'Customer Success', emoji: '🩺', familia: 'producto', que: 'Todo lo que pasa DESPUÉS del pago: la cartera de clientes y su estado, el bucle de entrega (video → tarea → llamada → IA → aprobación), la plataforma donde el cliente consume el programa, la graduación y los casos de éxito, y el analista que anticipa una baja. NO es el CRM (eso termina en «ganado»).' },
  { nombre: 'Second Brain', emoji: '🧠', familia: 'producto', que: 'La vista que conecta las señales de todo el negocio y encuentra qué mover: el análisis transversal y sus conclusiones.' },
  { nombre: 'Preguntale a MaKo', emoji: '💡', familia: 'producto', que: 'El chat con MaKo dentro de la app: la conversación, el contexto que ve y los modos del consultor. NO es el chat por WhatsApp (eso es «Agente: MaKo Doer»).' },
  { nombre: 'WhatsApp', emoji: '📥', familia: 'producto', que: 'El canal de WhatsApp en sí: bandejas, oficial y no oficial, envío, anti-ban.' },
  { nombre: 'Email', emoji: '✉️', familia: 'producto', que: 'El canal de email: envíos, plantillas, entregabilidad.' },
  { nombre: 'Instagram', emoji: '📸', familia: 'producto', que: 'La tab de Instagram del producto: conectar la cuenta, leer DMs, publicar desde la app.' },
  { nombre: 'Onboarding', emoji: '🧳', familia: 'producto', que: 'El arranque de un cliente: el wizard, el Archivero, el funnel y el diagnóstico de fase.' },
  { nombre: 'Contexto de MaKo', emoji: '🧩', familia: 'producto', que: 'Lo que MaKo sabe del negocio: RAG, glosario, prompts y el contexto que le entra a cada respuesta.' },
  { nombre: 'Integraciones', emoji: '🔌', familia: 'producto', que: 'Conectar servicios de afuera: Meta, Chatwoot, Fathom, Resend, las credenciales y su salud.' },
  { nombre: 'Configuraciones y equipo', emoji: '🔑', familia: 'producto', que: 'Cuentas, roles, permisos, perfil y las configuraciones del workspace.' },
  { nombre: 'Admin y clientes', emoji: '🏢', familia: 'producto', que: 'El panel del super-admin: alta de clientes, impersonación, ver el estado de cada workspace.' },
  // Las dos que el relevamiento encontró SIN proyecto: son tabs reales y en uso, así que
  // el ruteo no tenía dónde mandarles nada — el mismo agujero que tenía Landing Analyst.
  { nombre: 'Modelos IA', emoji: '🎛️', familia: 'producto', que: 'La tab que decide qué modelo corre cada feature y cuánto se gasta: el registro por tarea, los overrides y el consumo. Es el control de COSTO de la IA, no la infraestructura.' },
  { nombre: 'WhatsApp de MaKo', emoji: '📲', familia: 'producto', que: 'El canal propio de la agencia (/agencia): la línea por QR con la que MaKo habla con el dueño y con los grupos. NO es el WhatsApp del producto que usa el cliente (eso es «Feature: WhatsApp»).' },
  { nombre: 'Conocimientos', emoji: '📚', familia: 'producto', que: 'El portal de formación: cursos, clases y material para el cliente.' },
  { nombre: 'Feedback y errores', emoji: '🗳️', familia: 'producto', que: 'Que el usuario pueda reportar un error y proponer features: botón de reportar, tickets con estado, votación, y el triaje automático.' },
  { nombre: 'Cobros y planes', emoji: '💳', familia: 'producto', que: 'Monetización: planes y límites, versión free, suscripciones, pasarela de pago, créditos y consumo de tokens.' },

  // ── Agentes: la IA que trabaja SOLA, sin que se lo pidas ───────────────────
  // No son pantallas. Un agente puede no tener ninguna tab (el Perro vive adentro
  // del Plan) y aun así ser el proyecto donde cae todo el trabajo de su cerebro:
  // el criterio con el que decide, sus prompts, sus reglas, su ruteo.
  // El alcance de cada uno está acotado A PROPÓSITO, con la frase de lo que NO es. El
  // Perro vive dentro de la pantalla del Plan y por eso se le colgaba encima todo lo que
  // pasaba cerca del tablero: la Retro, el cierre por commits, la lectura de reuniones.
  // Son cuatro agentes distintos, con crons distintos y criterios distintos.
  { nombre: 'Perro Guardián', emoji: '🐕', familia: 'agente', que: 'El cerebro que PRIORIZA: puntúa 1-100, pone deadline, rutea al proyecto, deduplica, arma la checklist y se deja debatir. Se dispara al INGRESO de cada tarea, venga de donde venga. NO cierra tareas («Agente: Cierre automático»), NO lee reuniones («Agente: Lector de reuniones») y NO hace retrospectivas («Agente: Retro»): eso se le atribuye por vivir cerca del tablero y no es suyo.' },
  { nombre: 'Retro', emoji: '🔁', familia: 'agente', que: 'El coach que cada período lee TODO el negocio, diagnostica por área, cruza señales, arma la tesis con la fuga en plata, deja un plan encadenado (experimentos + tareas) y después te pide cuentas. Su pipeline de 8 fases y su gate de rendición son suyos, no del Perro.' },
  { nombre: 'Lector de reuniones', emoji: '🎙️', familia: 'agente', que: 'Lee las reuniones de Fathom solo, saca los compromisos, los reparte por persona y deja el borrador esperando. Termina cuando entrega el borrador: puntuarlo es del Perro.' },
  { nombre: 'Cierre automático', emoji: '✅', familia: 'agente', que: 'Mira el mundo real (los commits, las señales del producto) y propone cerrar lo que ya está hecho, con la evidencia. Otro criterio que el del Perro: aquel prioriza lo que entra, este cierra lo que salió.' },
  { nombre: 'MaKo Doer', emoji: '🤖', familia: 'agente', que: 'MaKo que ACTÚA por WhatsApp con el dueño: escucha audios, entiende el pedido, ejecuta con sus tools y confirma. NO es el chat dentro de la app («Feature: Preguntale a MaKo») ni el canal en sí («Feature: WhatsApp»).' },
  // Se llama como la TAB (nav.ts dice «Chatbot»), no como el módulo. En el tablero ya
  // vivía así con 15 tareas: renombrarlo a «Chat Agent» habría abierto un segundo
  // proyecto con el mismo trabajo adentro.
  { nombre: 'Chatbot', emoji: '💬', familia: 'agente', que: 'El agente que conversa con los LEADS solo: secuencias de nutrición, canales fríos, jugadas de setting, plantillas y las métricas de esa conversación.' },
  { nombre: 'CRM automático', emoji: '⚙️', familia: 'agente', que: 'El motor que mueve los leads de etapa SOLO, por sus reglas (T1..T6), sin que nadie arrastre una tarjeta. NO es la pantalla del CRM (esa es «Feature: CRM»): acá va el criterio con el que decide mover, no la ficha ni la vista.' },
  { nombre: 'Ads Optimizer Bot', emoji: '🎚️', familia: 'agente', que: 'El agente que vigila y mueve la pauta sin que se lo pidas: sube y baja presupuesto, apaga lo que no rinde, avisa. TODAVÍA NO EXISTE — el proyecto es dónde vive el trabajo de construirlo. NO es la pantalla de campañas (eso es «Feature: Ads Manager»).' },

  // ── Transversales: no son una tab, atraviesan toda la app ──────────────────
  { nombre: 'Seguridad y multi-inquilino', emoji: '🛡️', familia: 'transversal', que: 'Que un cliente no vea lo de otro: aislamiento por workspace, auth, cifrado, auditorías.' },
  { nombre: 'Diseño de la app', emoji: '✨', familia: 'transversal', que: 'Cómo se ve y se siente: identidad, modo simple, componentes, mobile, consistencia visual.' },
  { nombre: 'Infraestructura y versionado', emoji: '🧰', familia: 'transversal', que: 'Lo que sostiene la app: deploys, versiones, performance, costos, herramientas de desarrollo.' },
  { nombre: 'Avisos y reportes', emoji: '🔔', familia: 'transversal', que: 'Cómo MaKo avisa: notificaciones, reportes al dueño, señales de que algo pasó.' },
  // Faltaba, y su ausencia se notó: sin un lugar para lo legal, el Perro repartía por
  // palabra suelta — los Términos de Servicio cayeron en «Landing y VSL», la apertura
  // de la LLC en «Cobros y planes» y el marco de responsabilidad en «Seguridad». Nada
  // de eso se construye en esas pantallas: se firma, se registra o se paga.
  { nombre: 'Legal y fiscal', emoji: '⚖️', familia: 'transversal', que: 'Los papeles del negocio: términos y condiciones, privacidad, contratos, licenciamiento y propiedad del código, estructura societaria, impuestos y facturación. NO es la pantalla de cobros (eso es Cobros y planes) ni el aislamiento entre clientes (eso es Seguridad).' },

  // ── Vender MaKo: el trabajo comercial, por canal ───────────────────────────
  { nombre: 'Vender MaKo: Oferta y precios', emoji: '🧅', familia: 'vender', que: 'Qué se vende y a cuánto: planes, capas, pricing, bonus, garantía, posicionamiento.' },
  { nombre: 'Vender MaKo: Landing y VSL', emoji: '🌐', familia: 'vender', que: 'La landing, el VSL y las páginas de detalle: copy, estructura, prueba social, atribución.' },
  { nombre: 'Vender MaKo: Ads', emoji: '🎯', familia: 'vender', que: 'La publicidad paga de MaKo: campañas, creativos y presupuesto para traer leads propios.' },
  { nombre: 'Vender MaKo: Orgánico Instagram', emoji: '📱', familia: 'vender', que: 'La cuenta de Instagram propia: perfil, bio, reels, historias, destacadas, calendario de publicación.' },
  { nombre: 'Vender MaKo: Orgánico YouTube', emoji: '▶️', familia: 'vender', que: 'El canal de YouTube propio: banner, bio, videos largos, el video pilar y los CTA.' },
  { nombre: 'Vender MaKo: Prospección', emoji: '🎣', familia: 'vender', que: 'Salir a buscar clientes de a uno: listas, mensajes en frío, Looms, seguimiento.' },
  { nombre: 'Vender MaKo: Referidos', emoji: '🤝', familia: 'vender', que: 'Que los clientes traigan clientes: programa de referidos, incentivos y su seguimiento.' },
];

/** El prefijo que le toca a cada familia. Los transversales y los de vender no llevan:
 *  «Vender MaKo: Ads» ya dice qué es, y «Seguridad» no se construye como una tab. */
const PREFIJO: Partial<Record<FamiliaProyecto, string>> = {
  producto: PREFIJO_FEATURE,
  agente: PREFIJO_AGENTE,
};

/** El catálogo de verdad: cada familia ya viene con su prefijo puesto. Derivado, nunca
 *  escrito fila por fila — con 50 entradas, la 51 se olvidaría de ponerlo. */
export const CATALOGO_PROYECTOS: ProyectoCatalogo[] = CRUDO.map((p) =>
  ({ ...p, nombre: `${PREFIJO[p.familia] ?? ''}${p.nombre}` }));

export const NOMBRES_CATALOGO: string[] = CATALOGO_PROYECTOS.map((p) => p.nombre);

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * El núcleo del nombre, sin el prefijo. Es lo que hace que «CRM» y «Feature: CRM» sean
 * el MISMO proyecto: las filas viejas del tablero no lo tienen, el modelo a veces lo
 * va a omitir, y sin esto cada una de esas dos formas abriría un proyecto distinto —
 * que es exactamente el desastre de 64 proyectos que este catálogo vino a cerrar.
 *
 * Ignora los DOS prefijos, y eso además hace suave el cambio de familia: el día que
 * «Feature: MaKo Doer» pasó a ser «Agente: MaKo Doer», las tareas que ya vivían en el
 * proyecto viejo siguieron matcheando sin necesidad de migrar nada.
 */
export const nucleo = (nombre: string): string =>
  norm(nombre).replace(/^(feature|agente)\s*:\s*/, '');

const PORNOMBRE = new Map(CATALOGO_PROYECTOS.map((p) => [nucleo(p.nombre), p]));

/** ¿Este nombre es uno del catálogo? (sin acentos, mayúsculas ni prefijo). */
export const delCatalogo = (nombre: string): ProyectoCatalogo | undefined => PORNOMBRE.get(nucleo(nombre));

/** El nombre CANÓNICO de un proyecto del catálogo: con su prefijo si le toca. Sirve para
 *  normalizar lo que devuelve el modelo antes de que llegue al tablero. */
export const canonNombre = (nombre: string): string => delCatalogo(nombre)?.nombre ?? nombre.trim();

/**
 * CÓMO SE LLAMA UN PROYECTO NUEVO. Fuente única: lo lee el ruteo del Perro, la tool de
 * WhatsApp y la skill de Claude Code. Está acá y no copiado en los tres, porque copiado
 * en tres lados el tercero se queda viejo — ya pasó con el contrato del `detalle`.
 *
 * El prefijo no es decorativo: es lo que hace que el tablero se lea de un vistazo. En un
 * tablero de 34 proyectos mezclados, «Facturación» no dice si es una pantalla que hay
 * que construir o un trámite que hay que hacer; «Feature: Facturación» sí.
 */
export const REGLA_NOMBRE_PROYECTO = `El nombre se entiende SOLO, en 1 a 4 palabras, como el nombre de una tab. Nunca un verbo ("Implementar…"), nunca el nombre de una tarea, nunca jerga ni apodos.

EL PREFIJO ES OBLIGATORIO y sale de UNA pregunta: ¿esto se CONSTRUYE, se EJECUTA SOLO, se VENDE, o CRUZA todo?
· «${PREFIJO_FEATURE}NOMBRE» → una PANTALLA o módulo del producto que el usuario abre y usa. «${PREFIJO_FEATURE}Facturación», igual que «${PREFIJO_FEATURE}CRM» o «${PREFIJO_FEATURE}Ads Manager». Los analistas y los generadores van acá aunque usen IA: los disparás vos.
· «${PREFIJO_AGENTE}NOMBRE» → una IA que TRABAJA SOLA, sin que se lo pidas, y cuyo trabajo es su CRITERIO (cómo decide, sus prompts, sus reglas). «${PREFIJO_AGENTE}Perro Guardián», «${PREFIJO_AGENTE}Chat Agent». La prueba: si corre solo, es agente; si lo abrís y lo usás, es feature.
· SIN prefijo → un área del negocio ("Legal y fiscal", "Soporte"), algo transversal ("Seguridad y multi-inquilino") o el trabajo de vender ("Vender MaKo: Ads").

⚠️ Ponerle «${PREFIJO_FEATURE.trim()}» a algo que no se programa es peor que no ponérselo: dice que hay que construirlo cuando hay que firmarlo o pagarlo.
⚠️ Y la confusión que más se repite: **la pantalla y el agente que vive adentro NO son el mismo proyecto.** El tablero es «${PREFIJO_FEATURE}Plan»; el cerebro que puntúa es «${PREFIJO_AGENTE}Perro Guardián». Mejorar la vista Kanban va a la primera; cambiar cómo decide una prioridad va al segundo.`;

/**
 * Las FAMILIAS del sidebar (`FAMILIAS` en app/_components/nav.ts). NO son proyectos:
 * son la CAJA que agrupa a diez de ellos. «Feature: Content Machine» nació así el
 * 11/8/2026 y es un proyecto que se solapa con Ideas, Reels, Carousels, Stories,
 * Thumbnails y YouTube Writer a la vez — o sea, un lugar donde nadie va a buscar nada.
 *
 * Están escritas acá y no importadas de nav.ts a propósito: `lib/` no importa de
 * `app/`. El test `plan-proyectos-catalogo.test.ts` verifica que la lista siga siendo
 * exactamente la de nav.ts, así que el día que se agregue una quinta familia, falla.
 */
export const FAMILIAS_SIDEBAR = ['Operate', 'Analyze', 'Sales Machine', 'Content Machine'] as const;

/** Un verbo de hacer al principio = es el título de una TAREA, no el nombre de una tab. */
const VERBO_DE_TAREA =
  /^(implementar|crear|armar|hacer|definir|revisar|migrar|configurar|montar|desarrollar|evaluar|investigar|redactar|dise[ñn]ar|analizar|mejorar|agregar|sumar|integrar|conectar|probar|testear|documentar|optimizar|refactorizar|actualizar|corregir|arreglar|validar|lanzar|publicar|replicar|recopilar|auditar)\b/;

/**
 * ¿Este nombre puede ser un proyecto NUEVO del tablero?
 *
 * La versión ejecutable de `REGLA_NOMBRE_PROYECTO`. Existe porque la regla escrita ya
 * estaba en tres prompts y aun así el 11 y 12 de agosto nacieron cinco proyectos que la
 * violaban — AGENTS.md → «una regla en un prompt no es una regla».
 *
 * Se mide sobre el NÚCLEO (sin prefijo): «Feature: Investigar competencia» tiene que
 * caer por el verbo igual que «Investigar competencia», o el prefijo se vuelve la forma
 * de esquivar el control.
 *
 * ⚠️ Esto dice si el nombre TIENE FORMA de proyecto. NO dice si hace falta uno — eso lo
 * decide el Perro (¿lo cubre alguno de la lista? ¿arrastra varias tareas?) y se aplica
 * en `asignarTareasAProyectos`. Las dos preguntas son distintas y las dos tienen que
 * dar que sí antes de crear nada.
 */
export function puedeSerProyectoNuevo(nombre: string): { ok: true } | { ok: false; motivo: string } {
  const n = (nombre ?? '').trim();
  if (n.length < 4) return { ok: false, motivo: 'el nombre tiene menos de 4 caracteres' };
  if (delCatalogo(n)) return { ok: false, motivo: 'ya está en el catálogo: no es nuevo' };
  const nuc = nucleo(n);
  if (FAMILIAS_SIDEBAR.some((f) => nucleo(f) === nuc)) {
    return { ok: false, motivo: `«${n}» es una FAMILIA del sidebar (la caja que agrupa proyectos), no un proyecto` };
  }
  const palabras = nuc.split(/\s+/).filter(Boolean);
  if (palabras.length > 4) {
    return { ok: false, motivo: `${palabras.length} palabras: un proyecto se nombra en 1 a 4, como una tab` };
  }
  if (VERBO_DE_TAREA.test(nuc)) {
    return { ok: false, motivo: 'arranca con un verbo de hacer: eso es el título de una TAREA, no de un proyecto' };
  }
  return { ok: true };
}

/**
 * El catálogo como se lo pasamos a un modelo: nombre + qué entra. Va SIEMPRE con las
 * dos cosas — pasarle solo los nombres es lo que hacía que rutear fuera adivinar.
 */
export function catalogoParaPrompt(): string {
  const bloque = (f: FamiliaProyecto, titulo: string) =>
    `${titulo}\n${CATALOGO_PROYECTOS.filter((p) => p.familia === f).map((p) => `· ${p.nombre} — ${p.que}`).join('\n')}`;
  return [
    bloque('producto', `CONSTRUIR EL PRODUCTO (cada uno es una PANTALLA de la app que el usuario abre, y por eso lleva el prefijo «${PREFIJO_FEATURE.trim()}»):`),
    bloque('agente', `LOS AGENTES (la IA que trabaja SOLA — su criterio, sus prompts, sus reglas. Prefijo «${PREFIJO_AGENTE.trim()}»):`),
    bloque('transversal', 'TRANSVERSALES (no son una tab, cruzan toda la app — SIN prefijo):'),
    bloque('vender', 'VENDER MAKO (el trabajo comercial, por canal — SIN prefijo):'),
    // La regla escrita, además de los ejemplos: el modelo tiene que poder nombrar
    // una feature que TODAVÍA no existe, y ahí no hay ningún ejemplo que copiar.
    REGLA_NOMBRE_PROYECTO,
  ].join('\n\n');
}
