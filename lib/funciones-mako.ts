// =============================================================================
// funciones-mako — QUÉ HACE cada función de MaKo, para que un chat lo sepa (28/10/2026, Martín y el Cerebro)
// =============================================================================
// Martín (28/10/2026): «Te pido que el Second Brain de SuperAdmin tenga conocimiento de todas las funcionalidades, para
// que yo le pueda escribir y no haga cualquier cosa». Hasta hoy lo que hace cada función estaba en lugares que ningún chat
// lee (AGENTS.md, app/admin/dev/areas.ts, docs/diseno-*.md) o en CAPACIDADES (lib/mako-capacidades.ts), que es un «cómo
// se hace X» por pasos, incompleto y con nombres viejos. El relevamiento: C:/dev/revisiones/2810-second-brain-relevamiento.md.
//
// LA REGLA:
//   · acá va sólo el CONTENIDO (qué hace, qué no, qué reemplaza, cómo le dice la gente, con qué se conecta), indexado por
//     las `key` del nav. El nombre, la ruta, la familia y quién la ve salen de app/_components/nav.ts: no se copian;
//   · lista cerrada: una función que no está en el nav (la barra y el menú de la foto) o que está «pronto» no existe para un
//     chat;
//   · ES LA FUENTE: CAPACIDADES (lib/mako-capacidades.ts, los «cómo se hace» del Perro) toma de acá el nombre de su tab, y
//     `listar_capacidades_mako` devuelve estas funciones además de esos pasos;
//   · el estado es honesto: lo que todavía no hace va en `noHace` («Todavía no: …»), no se promete;
//   · una tab o una capacidad nueva suma o cambia su entrada en el MISMO commit (tests/funciones-mako.test.ts falla si una
//     key del nav no tiene entrada, si una conexión apunta a una función que no existe o si una fuente no está).
//
// PURO y sin `server-only`: lo leen el grafo (lib/cerebro-funciones.ts), los chats y los tests.
// =============================================================================

import { FAMILIAS, itemsDe, TODOS_LOS_ITEMS, USER_NAV, type NavItem } from '@/app/_components/nav';

export type EstadoFuncion = 'lista' | 'parcial';

export type EntradaFuncion = {
  /** Las keys del nav que son ESTA función (sus secciones, sus pantallas viejas). La primera da el nombre y la ruta. */
  keys: readonly [string, ...string[]];
  /** Qué es, en dos o tres frases, como se lo contarías a quien la va a usar o comprar. */
  que: string;
  hace: readonly string[];
  /** Lo que no hace, y lo que todavía no («Todavía no: …»): lo que un chat nunca promete. */
  noHace?: readonly string[];
  /** La app que esta función copia o reemplaza (AGENTS.md: «se nombra por su fuente»). */
  reemplaza?: string;
  /** Cómo le dice la gente: lo que siembra la búsqueda del grafo (lib/cerebro-recuperar.ts) aunque no diga el nombre. */
  alias: readonly string[];
  /** Con qué otra función se conecta y por qué (`a` es una key del nav cubierta por otra entrada). */
  conecta?: readonly { a: string; motivo: string }[];
  estado: EstadoFuncion;
  /** El área de app/admin/dev/areas.ts donde vive su obra. */
  slugDev?: string;
  /** De dónde salió lo de arriba, para corregirlo en su fuente. */
  fuentes: readonly string[];
};

const AREAS = 'app/admin/dev/areas.ts';

export const ENTRADAS: readonly EntradaFuncion[] = [
  {
    keys: ['mako', 'second-brain'],
    que: 'El centro de MaKo: un chat con MaKo que conoce tu negocio, todas tus conversaciones con MaKo de cada tab en un solo lugar, y el Second Brain, el mapa de todo lo que MaKo sabe de tu negocio.',
    hace: [
      'Chatear con MaKo: preguntar, pedir cosas y aprobar lo que propone sin salir del hilo',
      'Juntar las conversaciones con MaKo de cada tab',
      'El Second Brain: tu oferta, tus clientes, tu funnel y tu mensaje conectados en un mapa, con lo que cargaste y lo que MaKo dedujo',
      // ⚠️ EL NOMBRE DE PANTALLA VA TEXTUAL, y es el ticket #45 (3/11/2026). Leila Fittipaldi pidió
      // «activa la función "Aprende solo" en el Second Brain» y MaKo le contestó **que no existe**
      // —existe desde el 25/10, es el botón de la cabecera del Mapa (app/second-brain/AprendeSolo.tsx)—.
      // La entrada decía «Aprender solo», en infinitivo, y la búsqueda es por palabras: nunca
      // emparejó con lo que la clienta escribió. La regla: **el catálogo usa el nombre que la
      // persona LEE en la pantalla**, no una forma parecida; si no, MaKo niega lo que sí tiene.
      '«Aprende solo» (el botón de la cabecera del Mapa): aprender solo de tus conversaciones de WhatsApp con leads, si lo prendes, y ver de qué fuentes aprende, cuándo fue la última vez y cuánto entró',
      // El ticket #44 (3/11/2026): una clienta pegó su documento maestro en el chat y MaKo le dijo que no tenía cómo
      // guardarlo. El nombre va TEXTUAL, el de la tarjeta que confirma la persona.
      '«Sumar un documento al Second Brain»: le pegas o adjuntas un documento en el chat (un texto, un .docx), MaKo lo guarda en El Archivero, saca lo que va en tu perfil y te lo muestra antes de que digas que sí',
      // Ticket #48 (3/11/2026): «¿dónde actualizo mis datos?» y MaKo no sabía la pantalla. Los nombres, los de pantalla
      // (lib/secciones-negocio.ts, DATOS_DEL_NEGOCIO; tests/mako-no-puedo-falsos.test.ts los busca en AreasHub y AREAS).
      'Corregir los datos de tu negocio en el mapa: en «La oferta» → «El brief», el precio, qué incluye y el horario de tu oferta principal (tocas el dato y lo corriges); en «La oferta» → «La oferta», tus ofertas; en «Productos», el catálogo con su precio',
      'Hablar primero: la primera vez te pregunta qué te falta (hoy, conectar tu IA), con botones que andan sin la app',
      'Enseñarte la pestaña señalando, con el resto un poco opaco y el chat a la vista (el «?» de arriba)',
      // 5/11/2026 (llamada con Leila del 30/10): el nombre, el de la pantalla («Voz y cara» → «Marca», lib/secciones-negocio.ts).
      'Tu marca, en «Voz y cara» → «Marca»: subes tu manual de marca (PDF o imagen), MaKo saca tus colores, tus fuentes y tu logo y tú lo confirmas; varios kits (una agencia, uno por cliente) y uno por defecto, que usan Image, Video y Web Generator',
      // El coach ÚNICO desde el 4/11/2026 (Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach"»).
      '«Funnel Coach»: un chat que primero trabaja tu oferta y la guarda, y después elige cómo conseguir clientes, calcula el presupuesto de anuncios y guarda el plan. Aconseja inspirado en un referente (Hormozi, de fábrica; lo cambias tocando su cara), y tus conversaciones de oferta cuelgan de él',
    ],
    noHace: ['No es el chat con tus leads: eso es Chats', 'Todavía no: la guía señalando en las otras pestañas ni con tu IA (por ahora, sólo el Ops Center y sin IA)'],
    alias: ['ops center', 'second brain', 'segundo cerebro', 'cerebro', 'mapa', 'grafo', 'chat con mako', 'mis datos', 'datos del negocio', 'el brief', 'funnel coach', 'coach'],
    conecta: [{ a: 'crm', motivo: 'Lo que sabe de tus clientes sale del CRM' }, { a: 'offer', motivo: 'Tu oferta vive en Offer y el mapa la muestra' }],
    estado: 'lista', slugDev: 'second-brain', fuentes: [AREAS, 'docs/diseno-second-brain-grafo.md'],
  },
  {
    keys: ['graphics', 'general', 'experimentos'],
    que: 'El editor de informes del negocio, copiado de Looker Studio: hojas con gráficos de marketing y de ventas, las hojas de análisis de cada área y Focus, tu día. Le pides a MaKo un gráfico o un cambio y lo arma.',
    hace: [
      'Hojas de Marketing y Comercial con 40 tipos de gráfico, estilo editable y control de período',
      'Las hojas de análisis: Ads Analyst, Closing (las llamadas de venta de Fathom con método SPIN), VSL Analyst, Chat Analyst y CS Analyst',
      // 5/11/2026: lo que Martín le prometió a Código Inmobiliario (lib/primer-contacto.ts).
      'El primer contacto: cuánto tarda una persona en escribirle o llamar a cada lead nuevo, sin contar los mensajes automáticos (en la hoja Closing y como gráfico «Primer contacto»)',
      'Focus: el objetivo y la acción del día, los KPIs, el semáforo y el mes',
      '«Editar con MaKo»: pedir un gráfico o probar un experimento y medirlo contra el dato real',
    ],
    reemplaza: 'Looker Studio',
    alias: ['dashboard', 'informes', 'reportes', 'metricas', 'graficos', 'kpis', 'analytics', 'focus', 'experimentos', 'looker'],
    conecta: [{ a: 'crm', motivo: 'Las ventas y los leads salen del CRM' }, { a: 'ads-manager', motivo: 'El gasto y los anuncios salen de Meta' }],
    estado: 'lista', slugDev: 'dashboard', fuentes: [AREAS, 'AGENTS.md'],
  },
  {
    keys: ['todo'],
    que: 'El tablero de tareas del negocio, con el Perro Guardián: puntúa cada tarea, le pone fecha y razón, caza duplicados y te discute cuando quieres cambiar una prioridad.',
    hace: [
      'Tablero de tareas por estado, por proyecto y por persona',
      'El Perro Guardián: puntaje de 1 a 100, fecha y razón para cada tarea',
      'Leer las reuniones de Fathom, sacar los compromisos y repartirlos por persona',
      'El plan de arranque de un cliente nuevo, recortado por su fase y su canal',
    ],
    alias: ['plan', 'tareas', 'tablero', 'to do', 'pendientes', 'perro guardian', 'prioridades'],
    conecta: [{ a: 'calendario', motivo: 'Los deadlines del Plan se ven en Calendar' }],
    estado: 'lista', slugDev: 'plan', fuentes: [AREAS],
  },
  {
    keys: ['chats', 'whatsapp', 'email'],
    que: 'La bandeja unificada, copiada de respond.io: WhatsApp (cada línea), Instagram, Messenger y email en una sola tab, con una conversación por contacto. El contacto es el lead del CRM y junta todos sus canales.',
    hace: [
      'Una conversación por contacto, con todos sus canales; eliges por cuál contestar',
      'Asignar, cambiar la etapa, cerrar, posponer y dejar comentarios internos',
      'El borrador de MaKo: lee la conversación y te propone qué escribir',
      'El no leído por persona, guardado en el servidor',
      'Conectar y administrar tus números de WhatsApp (oficial y de empresa) sin salir de Chats',
      'Email: secuencias por etapa y envíos puntuales con tu dominio',
    ],
    noHace: [
      'Llamadas de voz',
      'Traducir mensajes',
      'Unir contactos por sugerencia: el contacto ya es el lead',
      'Todavía no: bandejas a medida, respuestas rápidas con «/» y variables, @menciones y colaboradores',
    ],
    reemplaza: 'respond.io',
    alias: ['chats', 'bandeja', 'inbox', 'mensajes', 'conversaciones', 'whatsapp', 'instagram', 'messenger', 'email', 'respond.io', 'respond'],
    conecta: [{ a: 'crm', motivo: 'Cada contacto es un lead del CRM' }, { a: 'setting', motivo: 'Las automatizaciones contestan por los mismos canales' }],
    estado: 'parcial', slugDev: 'chats', fuentes: ['docs/diseno-chats.md', AREAS],
  },
  {
    keys: ['crm'],
    que: 'Los leads del negocio: kanban por etapa, tabla y la ficha de cada lead con su historia, sus llamadas y su plan de pagos. El embudo se edita entero desde aquí.',
    hace: [
      'Kanban por etapa y tabla de leads',
      'La ficha del lead con MaKo Analyst: el diagnóstico que cruza su ficha, sus llamadas y su comportamiento',
      'El embudo: etapas, nutrición y cómo entra la gente',
      'Productos y ofertas, con su precio',
      'El plan de cobranza por cuotas, con el contrato y los comprobantes leídos por IA',
      'Acciones en bloque sobre varios leads o una columna entera: mover de etapa, descalificar con motivo, pasar a otro funnel, etiquetar, asignar y eliminar',
      'La papelera: lo que se elimina se recupera tal cual durante 30 días (en el menú de funnels)',
    ],
    alias: ['crm', 'leads', 'clientes', 'pipeline', 'embudo', 'funnel', 'kanban', 'ficha', 'cuotas', 'cobranza', 'en bloque', 'papelera', 'mover todos'],
    conecta: [{ a: 'chats', motivo: 'Las conversaciones del lead están en Chats' }, { a: 'calendario', motivo: 'Sus reuniones están en Calendar' }, { a: 'setting', motivo: 'Las automatizaciones mueven a los leads de etapa' }],
    estado: 'lista', slugDev: 'crm', fuentes: [AREAS],
  },
  {
    keys: ['calendario'],
    que: 'La agenda del negocio en una tab: tus publicaciones, bloques de trabajo y llamadas, con las reuniones del CRM, tu Google Calendar, los deadlines del Plan y los cobros que vencen.',
    hace: [
      'Publicaciones, bloques de trabajo y llamadas propias',
      'Las reuniones del CRM, tu Google Calendar y los deadlines del Plan en el mismo lugar',
      'Los cobros que vencen y el trimestre',
      '«Agendar llamada» con Calendly o Cal.com, y conectar Google sin salir de la tab',
    ],
    alias: ['calendar', 'calendario', 'agenda', 'reuniones', 'citas', 'google calendar', 'calendly'],
    conecta: [{ a: 'crm', motivo: 'Las reuniones de los leads' }, { a: 'todo', motivo: 'Los deadlines de las tareas' }],
    estado: 'lista', slugDev: 'calendario', fuentes: [AREAS],
  },
  {
    keys: ['setting'],
    que: 'Las automatizaciones que conversan por ti: un agente que contesta por WhatsApp, email, Instagram y Messenger, le recuerda la reunión al lead, lo mueve de etapa y te lo pasa cuando hace falta una persona.',
    hace: [
      'Crear una automatización desde la galería de plantillas',
      // Ticket #47 (3/11/2026): MaKo decía que sólo podía activar o pausar. crear_automatizacion_con_ia la arma desde un pedido.
      'Crear una secuencia nueva pidiéndosela a MaKo en palabras, con su disparador (una etapa, una etiqueta que se le agrega al lead o un evento): nace pausada',
      'Ramas, condiciones, horarios, etiquetas y acciones',
      // 5/11/2026: el número nuevo arranca con pocos WhatsApp por día y sube solo; el horario del negocio vale para todas.
      'Cuidar el número: arranca con pocos WhatsApp por día y sube solo, dentro del horario del negocio',
      'Recordarle al lead la reunión agendada',
      'Secuencias de nutrición que MaKo escribe en la voz del negocio',
      'Simular la conversación como si fueras el lead, ver sus métricas y pasar a un humano',
      'Las plantillas de WhatsApp',
      'Arrancar con Instagram o Messenger: un comentario en la publicación, el Reel o el En vivo, la respuesta a una historia o un mensaje directo',
      'Mandar el mensaje directo con botones debajo del texto',
    ],
    // «como lo hace manychat» (Leandro, 28/10/2026): la gente lo pide por la app que conoce.
    alias: ['automations', 'automatizaciones', 'chatbot', 'bot', 'setter', 'flujos', 'secuencias', 'nutricion', 'plantillas', 'manychat', 'comentarios de instagram', 'disparador'],
    conecta: [{ a: 'chats', motivo: 'Contesta por los mismos canales que ves en Chats' }, { a: 'crm', motivo: 'Mueve a los leads de etapa' }],
    estado: 'lista', slugDev: 'chatbot', fuentes: [AREAS, 'docs/diseno-automations-galeria-v2.md'],
  },
  {
    keys: ['customer-success', 'cs-curso', 'cs-comunidad'],
    que: 'Tu escuela y tus clientes, como en Skool: el curso por módulos y lecciones, la comunidad de tus alumnos y el tablero de la entrega de cada cliente.',
    hace: [
      'El curso por módulos y lecciones, con candados',
      'La comunidad de tus alumnos',
      'Invitar a un cliente cuando lo ganas en el CRM',
      'Clients: quién necesita atención hoy y por qué, y el estado de su entrega',
    ],
    noHace: ['Todavía no: anticipar una baja leyendo las llamadas de entrega'],
    reemplaza: 'Skool',
    alias: ['classroom', 'curso', 'clases', 'alumnos', 'comunidad', 'customer success', 'entrega', 'skool'],
    conecta: [{ a: 'crm', motivo: 'Tus clientes son los leads ganados del CRM' }],
    estado: 'parcial', slugDev: 'customer-success', fuentes: [AREAS, 'docs/diseno-curso-skool.md'],
  },
  {
    keys: ['admin-customers'],
    // Admin desde el 6/11/2026 es la copia del dashboard de Polar (polarsource/polar, Apache-2.0): Overview, Customers,
    // Analytics, Sales, Products, Finance y Settings (app/admin/(polar)/, docs/investigacion-admin.md).
    que: 'El panel de la plataforma, copiado del de Polar: lo que entra a MaKo, los negocios que la usan (cada uno con su uso, sus eventos y su equipo), lo que se vendió y se cobró, los planes y los datos del recibo.',
    hace: ['Overview: lo cobrado de los últimos meses, lo que pasó hoy, lo que está por cobrar, los que más pagan, los que están en riesgo y el margen después del gasto de IA, más lo que espera tu decisión (quieren entrar, agencias, bajas)', 'Customers: los negocios con su crecimiento, los que más pagan (Top Customers), los atrasados o que dejaron de entrar (At Risk) y el gasto de IA de cada uno (Cost Drivers)', 'La ficha de un negocio: sus cifras, su línea de tiempo, sus datos y conexiones, su uso por pantalla (Usage) y su equipo (Members: rol, alta, último ingreso, entrar, reenviar el acceso y suspender)', 'Analytics: el MRR y lo cobrado mes a mes (Metrics), todo lo que pasa con su filtro por negocio y por tipo, errores incluidos (Events), y el gasto de IA (Costs)', 'Sales: cada pago con su recibo (descargar, reenviar, cargar un pago), las suscripciones con su historia, los cobros pendientes y los contracargos', 'Products: los planes y los links de «Vender un plan»', 'Finance: lo que entró, para exportar', 'Settings: los datos del recibo y los precios de cobro', 'Dar de alta un negocio con su usuario'],
    alias: ['admin', 'customers', 'negocios', 'workspaces', 'clientes de mako', 'ingresos', 'revenue', 'mrr', 'actividad', 'uso de la app'],
    estado: 'lista', slugDev: 'admin', fuentes: [AREAS],
  },
  {
    keys: ['offer'],
    que: 'Tu oferta, trabajada en un chat: MaKo te pregunta por cada pieza, la diagnostica con una rúbrica y escribe la oferta nueva, descargable en PDF.',
    hace: ['Preguntarte por cada pieza de la oferta', 'Diagnosticarla con una rúbrica', 'Escribir la oferta nueva y descargarla en PDF', 'Proponer probar un cambio como experimento'],
    alias: ['offer', 'oferta', 'propuesta de valor', 'precio', 'garantia', 'bonos'],
    // Ticket #46 (3/11/2026): «precio» lleva acá, y el precio no se corrige en Offer: se corrige en el Second Brain.
    noHace: ['No es donde se corrige el precio, qué incluye o el horario: eso es el Second Brain, en «La oferta» → «El brief»'],
    conecta: [{ a: 'landing-writer', motivo: 'La landing vende la oferta' }, { a: 'crm', motivo: 'Los productos y sus precios' }, { a: 'mako', motivo: 'El precio y lo que incluye se corrigen en el Second Brain, en «La oferta» → «El brief»' }],
    estado: 'parcial', slugDev: 'offer-analyst', fuentes: [AREAS],
  },
  {
    keys: ['market-an'],
    que: 'Lo que hacen tus competidores, en un solo lugar: sumas a cada uno con sus canales y MaKo lee su sitio, su Instagram y su YouTube, con los números que pudo medir. Una lectura que falló se dice, nunca es un cero.',
    hace: ['Sumar competidores con sus canales', 'Leer su sitio, su Instagram y su YouTube', 'Guardar los anuncios que pegues', 'Decir desde cuándo está a la vista cada pieza, desde que MaKo la vio', 'Sugerirte competidores que ya mira MaKo, y sumarlos sin gastar nada', 'Leer su oferta de su web, sola, con el analista de Offer: las 9 notas y su puntaje', 'Transcribir el guion de sus reels al abrir su detalle', 'Decir qué funnel usa (evento presencial, webinar, VSL, aplicación y llamada, reto…) citando lo que lo delata en sus piezas', 'Mostrar sus páginas con su vista previa, también las que cuelgan de su página de enlaces'],
    noHace: ['Todavía no: revisar solo todos los días (lee al agregar y al abrir la ficha)', 'Todavía no: traer los anuncios de Meta sin pegarlos', 'Todavía no: analizar sus ángulos y ganchos contra tu oferta', 'Todavía no: el guion de sus videos de YouTube'],
    alias: ['competitor spy', 'competitors spy', 'competencia', 'competidores', 'espiar a la competencia', 'market analyst'],
    conecta: [{ a: 'ads-writer', motivo: 'Lo que le funciona a la competencia alimenta tus anuncios' }, { a: 'landing-writer', motivo: 'Replicar la landing de un competidor' }],
    estado: 'parcial', slugDev: 'competitor-spy', fuentes: [AREAS, 'docs/diseno-competitors-spy.md'],
  },
  {
    keys: ['landing-writer'],
    que: 'El editor de landings y presentaciones, copiado de Gamma: las creas con IA desde tu funnel y tu negocio, las editas por secciones y bloques, y le pides cambios a MaKo.',
    hace: [
      'Crear con IA en dos pasos: el esquema que editas y las secciones',
      'Editar por secciones y bloques: menú «/», 52 diseños, temas, comentarios e historial',
      'Pedirle cambios a MaKo o discutir la página con él',
      'Diagnosticar una página con comentarios y «Solucionar con IA»',
      // Black November (5/11/2026): sólo con lo que carga el negocio; sin el dato, el bloque no sale en la página.
      'Bloques de venta con tus datos: cuenta regresiva a una fecha, compras recientes y cupos que quedan',
      'Replicar una página de afuera, por partes',
      'Exportar a PDF, PNG, PPTX y HTML',
    ],
    reemplaza: 'Gamma',
    alias: ['web generator', 'landing', 'landings', 'pagina', 'web', 'sitio', 'presentacion', 'gamma'],
    conecta: [{ a: 'offer', motivo: 'La landing vende tu oferta' }, { a: 'crm', motivo: 'Los que dejan sus datos entran como leads' }],
    estado: 'lista', slugDev: 'landing-generator', fuentes: [AREAS, 'AGENTS.md'],
  },
  {
    keys: ['ads-manager'],
    que: 'Tus campañas de Meta dentro de MaKo: el estado en vivo y el rendimiento cruzado con las ventas del CRM, y los cambios a Meta sin salir de la app.',
    hace: [
      'Campañas, conjuntos y anuncios con lo que vendieron en el CRM',
      'Crear una campaña con MaKo: le cuentas qué promocionar y arma la estructura',
      'Subir creativos, prender, pausar, cambiar el presupuesto y renombrar',
      'Lo nuevo se publica en pausa: lo prendes tú',
    ],
    reemplaza: 'Ads Manager de Meta',
    alias: ['ads manager', 'anuncios', 'ads', 'meta', 'facebook', 'campañas', 'pauta', 'media buyer'],
    conecta: [{ a: 'ads-writer', motivo: 'Los guiones de los anuncios' }, { a: 'crm', motivo: 'Las ventas de cada anuncio' }],
    estado: 'lista', slugDev: 'ads-manager', fuentes: [AREAS, 'lib/mako-capacidades.ts'],
  },
  {
    keys: ['video-editor'],
    que: 'Video: la tab de video de MaKo (9/11/2026 se le sumó AI Avatar). Abre con «Encuentra tu siguiente OUTLIER»: videos que funcionan para replicarlos con tu mensaje. «Crear desde cero» trae las plantillas: «Mensaje para…» (MaKo te guía paso a paso), «Tu personaje con IA», los formatos y «Generar con IA». El editor está copiado de CapCut, con MaKo siempre a la izquierda.',
    hace: ['Ver los outliers y replicar uno con «Replicar»', 'La plantilla «Mensaje para…»: MaKo pide en el chat la referencia, tu guion de 6 bloques, tu foto o tu personaje, tu voz y el fondo, con lo demás opacado', 'Calcular cuánto dura y cuántos créditos cuesta cada clip según sus palabras', 'Crear tu personaje con tu foto («Tu personaje con IA», el estudio que era AI Avatar)', 'Arrancar de un formato (Reel, YouTube, cuadrado) o de una plantilla', 'Un modo simple con menos botones en las plantillas guiadas, y «Todas las herramientas»', 'Línea de tiempo con cortes y keyframes', 'Recibir los anuncios del Video Generator para editarlos', 'Pedirle cambios a MaKo', 'Edición automática: un equipo de agentes quita pausas, subtitula, prueba estilos, propone B-roll y deja el volumen listo, a la vista', 'Exportar el video'],
    noHace: ['Todavía no: guardar los proyectos en la nube (quedan en tu navegador)', 'Todavía no: filmar sola los clips, las tomas blancas y el montaje de «Mensaje para…» (los lleva al estudio del personaje y al Video Generator)', 'Todavía no: traer outliers de tu rubro (hoy, los de las plantillas de MaKo)'],
    reemplaza: 'CapCut',
    alias: ['video editor', 'editar video', 'edicion de video', 'capcut', 'edicion automatica', 'editar con agentes'],
    conecta: [{ a: 'video-generator', motivo: 'Recibe los anuncios que genera' }],
    estado: 'parcial', slugDev: 'video-editor', fuentes: [AREAS, 'AGENTS.md'],
  },
  {
    keys: ['video-generator'],
    que: 'El anuncio en video de punta a punta: de los guiones a las tomas y el montaje, generados con Google Flow, y de ahí al editor. Se abre desde Video › «Nuevo video» › «Generar con IA» (no es una tab).',
    hace: ['Tomas y montaje a partir de tus guiones', 'Generar con Google Flow', 'Mandar el anuncio al Video Editor y descargarlo'],
    alias: ['video generator', 'generar video', 'anuncio en video', 'flow', 'google flow'],
    conecta: [{ a: 'ads-writer', motivo: 'Usa los guiones de Ads Writer' }, { a: 'video-editor', motivo: 'Lo terminas en el Video Editor' }],
    estado: 'parcial', slugDev: 'video-generator', fuentes: [AREAS],
  },
  {
    keys: ['image-editor'],
    que: 'Un editor de diseño copiado de Canva: diseños de varias páginas con texto, formas, imágenes, marcos y capas, y descargas en PNG, JPG, PDF o SVG.',
    hace: [
      'Arrancar de un tamaño o de una plantilla: post, historia, carrusel de Instagram de varias páginas, presentación', 'Diseños de varias páginas', 'Texto, formas, imágenes, marcos, QR y capas', 'Recortar, filtros y animaciones', 'Presentar y descargar en PNG, JPG, PDF o SVG', 'Pedirle cambios a MaKo',
      // 4/11/2026: el explorador (app/image-editor/carruseles), con lo que Competitors Spy ya trajo.
      // 6/11/2026: el rediseño copiado de la interfaz de Top Carousels («Encuentra tu siguiente OUTLIER»): lo primero que se ve.
      'Carruseles que funcionan: los de las cuentas que sigues en Competitors Spy, con su outlier (cuántas veces la mediana de su cuenta), buscar por tema o @cuenta, filtrar (fecha, láminas, tipo, cuentas, CTA), ordenar, guardar y guardar búsquedas; las láminas se pasan dentro de la tarjeta',
      'Filtro CTA: los carruseles que piden comentar una palabra («Comenta GUÍA») o mandarla por mensaje, con la palabra en la tarjeta',
      // 6/11/2026: los anuncios de Spy en la misma pantalla (lib/carruseles/anuncios.ts).
      'Anuncios de la competencia: los que trajo Competitors Spy de las cuentas que sigues, ordenados por cuántos días llevan al aire',
      // 4/11/2026: la biblioteca de ejemplos (lib/carruseles/biblioteca.ts), la misma para todos los negocios.
      'Una biblioteca de ejemplos, la misma para todos los negocios: carruseles públicos de Instagram de una lista de cuentas y de temas (hashtags), cada uno con su @creador y el link al original; se ve aunque no sigas a nadie',
      'Carruseles de MaKo por tipo (lista, paso a paso, historia, antes y después, mito vs. realidad, opinión, caso con números, preguntas): la estructura con una guía en cada lámina y el nombre del negocio, y «Ver ejemplo» con un negocio ficticio',
      // 6/11/2026: «Editar» reemplaza a «Hacer el mío» (lib/carruseles/replica.ts): del ejemplo a la edición, en un paso.
      'Editar un ejemplo: tu versión editable de un carrusel o un anuncio, con su mismo diseño, el texto escrito para tu negocio por TU IA y tu foto donde el ejemplo tiene una persona; sin tu IA, cada lámina trae una guía',
      // 5/11/2026: los kits de marca del Second Brain (lib/marca/kits.ts).
      'Tu marca en cada diseño: los carruseles de MaKo salen con tus colores, tus fuentes y tu logo, y el chat los usa (con varios kits, eliges cuál); «Discutir» te contesta sin tocar el diseño',
    ],
    noHace: ['No baja ni muestra bibliotecas de carruseles de otras apps: sólo los de las cuentas que sigues y la biblioteca de ejemplos, leída de Instagram directo', 'Un negocio no edita la biblioteca de ejemplos: la edita la plataforma', 'No copia las palabras de un ejemplo: copia el diseño y la IA escribe las tuyas', 'Los anuncios son sólo los de las cuentas que sigues en Spy: no hay una biblioteca de anuncios de todos', 'Todavía no: pedirle fotos a un banco de imágenes'],
    reemplaza: 'Canva',
    // Carousels se retiró el 29/10/2026: un carrusel es una plantilla de «Nuevo diseño» (app/_crear/PantallaCrear.tsx).
    alias: ['image editor', 'disenar', 'diseño', 'imagen', 'canva', 'carrusel', 'carruseles', 'carousels', 'carruseles que funcionan', 'outlier', 'topcarousels', 'hacer el mío', 'editar ejemplo', 'mi versión', 'cta', 'comenta la palabra', 'anuncios de la competencia', 'espiar anuncios', 'biblioteca de ejemplos', 'ejemplos de carruseles', 'brand kit', 'kit de marca'],
    conecta: [{ a: 'market-an', motivo: 'Los carruseles que funcionan salen de las cuentas que sigues en Competitors Spy' }],
    estado: 'parcial', slugDev: 'image-editor', fuentes: [AREAS, 'AGENTS.md'],
  },
  {
    keys: ['stories'],
    que: 'Un día de stories de Instagram: una idea, el objetivo y el storyboard frame por frame con cómo producirlo.',
    hace: ['El storyboard frame por frame', 'Cómo producir cada frame', 'Copiar la secuencia'],
    noHace: ['No las publica en Instagram'],
    alias: ['stories', 'historias'],
    estado: 'parcial', slugDev: 'stories', fuentes: [AREAS],
  },
  {
    // Copywriting ES el Copywriter desde el 29/10/2026 (docs/diseno-copywriter.md, D11–D14): la tab de la barra.
    keys: ['copywriter'],
    que: 'Copywriting como Notion: cada texto es una página (guiones de anuncios, reels, stories, YouTube y VSL, emails y posts) y MaKo escribe y edita EN la página desde su chat.',
    hace: ['Crear una página desde un template de «Nueva» (anuncio, copy de Meta, Reel, stories, carrusel, email, VSL, YouTube)', 'Escribir por bloques con «/», arrastrar con el asa, listas, desplegables y tablas', 'Pedirle a MaKo que mejore, acorte o agregue una sección en la página', 'Compartir una página para que el cliente la edite'],
    reemplaza: 'Notion',
    // Reels se retiró del Video Editor el 29/10/2026 («no como tab, sino como template»): su guion es el template «Guion de Reel».
    alias: ['copywriter', 'copywriting', 'notion', 'paginas', 'templates', 'copy', 'reel', 'reels', 'guion de reel'],
    conecta: [{ a: 'ads-manager', motivo: 'El copy de anuncio se publica en Ads Manager' }, { a: 'video-generator', motivo: 'El guion se vuelve video' }],
    estado: 'lista', fuentes: ['docs/diseno-copywriter.md', 'lib/copywriter/plantillas.ts'],
  },
  {
    keys: ['ads-writer'],
    que: 'La fábrica de guiones de anuncios (Content Machine): cada anuncio sale de un avatar y una razón de compra, y MaKo elige el ángulo y la estructura.',
    hace: ['Escribir el próximo guion de anuncio', 'Ver qué combinaciones de avatar y razón faltan', 'Seguir cada guion de borrador a publicado', 'Valorar un guion nuevo antes de grabarlo'],
    alias: ['ads writer', 'content machine', 'guiones de anuncio', 'anuncios'],
    conecta: [{ a: 'ads-manager', motivo: 'Los anuncios se publican en Ads Manager' }, { a: 'video-generator', motivo: 'El guion se vuelve video' }],
    estado: 'lista', slugDev: 'ads-writer', fuentes: [AREAS, 'lib/mako-capacidades.ts'],
  },
  {
    // 29/10/2026: el estudio de Higgsfield (una pantalla, sin secciones). La voz propia sobre el video todavía no está.
    // 9/11/2026: dejó de ser una tab: es «Tu personaje con IA», adentro de Video (docs/relevo/nube-tab-video.md §1).
    keys: ['ai-avatar'],
    que: 'Tu personaje con IA, adentro de la tab Video («Tu personaje con IA» en «Nuevo video»), como en Higgsfield: eliges un preset (una escena), pones tu foto y MaKo lo genera; después lo animas diciendo tu guion.',
    hace: ['Crear tu avatar en una escena de 28 presets', 'Ajustar la escena escribiendo lo que quieres', 'Generar el video del avatar diciendo un guion', 'Volver a cada avatar y sus videos'],
    noHace: ['Todavía no: tu voz clonada en el video, copiar el movimiento de otro video, ni diseñar un personaje sin foto'],
    reemplaza: 'Higgsfield y HeyGen',
    alias: ['ai avatar', 'avatar', 'higgsfield', 'heygen', 'influencer', 'preset'],
    conecta: [{ a: 'video-generator', motivo: 'Genera por el mismo puente a Google Flow' }],
    estado: 'parcial', slugDev: 'ai-avatar', fuentes: [AREAS],
  },
  {
    keys: ['lead-magnet-generator'],
    que: 'Tus lead magnets: lo que regalas a cambio del contacto. Eliges una plantilla (guía, checklist, prompts para copiar, planilla, clase grabada o quiz con diagnóstico) y MaKo crea la pieza en Copywriting o en el Web Generator, con su estructura; después le da un link público de solo lectura y la página con formulario donde la piden.',
    hace: ['Crear la pieza de un lead magnet desde una plantilla, en Copywriting o en el Web Generator', 'Un quiz con diagnóstico en una landing: preguntas con puntos, el contacto entra al CRM con su resultado y cada uno ve el suyo', 'MaKo te propone hasta 3 lead magnets desde tu oferta y lo que hace tu competencia en Competitors Spy, con tu IA, y los armas con un clic', 'Darle a una página de Copywriting un link público de solo lectura, y dejar de compartirla', 'Crear la landing que lo pide: el formulario entra al CRM', 'Elegir qué link mandan las automatizaciones'],
    noHace: ['Todavía no: regalar un curso de Classroom a un lead (el portal abre sólo a clientes que compraron)', 'Las automatizaciones mandan el link del primero de tu lista, no el de cada página', 'Proponer sin tu IA: usa tu Claude, tu GPT o tu Gemini'],
    reemplaza: 'ScoreApp, Interact y los Notion de prompts',
    alias: ['lead magnet', 'iman de leads', 'regalo', 'guia gratis', 'checklist', 'descargable', 'freebie', 'clase gratis', 'quiz', 'diagnostico', 'encuesta'],
    conecta: [{ a: 'copywriter', motivo: 'Las guías, los checklists y los prompts son páginas de Copywriting' }, { a: 'landing-writer', motivo: 'La clase grabada y la página que lo pide son landings del Web Generator' }],
    estado: 'parcial', slugDev: 'lead-magnet-generator', fuentes: [AREAS, 'lib/lead-magnets/plantillas.ts'],
  },
  // ── El menú de la foto (Settings) ──
  {
    keys: ['perfil', 'configuraciones', 'integraciones'],
    que: 'La configuración del negocio y la tuya: tu perfil, el equipo, las notificaciones, las identidades fiscales y el método, e Integraciones, donde conectas tus cuentas y el Pixel de MaKo.',
    hace: [
      'Tu perfil: nombre, contacto, zona horaria y foto',
      'Business settings: general, equipo con sus roles, notificaciones, identidades fiscales y método',
      'Integraciones: conectar tus cuentas (tu IA, Fathom, tus redes, tu agenda, el email) y ver cuáles están sanas',
      'El Pixel de MaKo: instalarlo en tu página, grabar las visitas y probarlo en vivo',
      'Cuánto gasta MaKo por proveedor',
    ],
    noHace: ['Tu número de WhatsApp no se conecta aquí: va en Chats'],
    alias: ['settings', 'configuracion', 'ajustes', 'perfil', 'equipo', 'roles', 'notificaciones', 'integraciones', 'integrations', 'conectar', 'conexiones', 'pixel'],
    conecta: [{ a: 'chats', motivo: 'El número de WhatsApp se conecta en Chats' }],
    estado: 'lista', slugDev: 'integraciones', fuentes: [AREAS],
  },
  {
    keys: ['api-mako'],
    que: 'La API de MaKo, con el aspecto de GitHub: todo lo que un agente (tu Claude Code, una integración) puede leer o hacer en MaKo, sus tokens y su registro de uso.',
    hace: ['La documentación de cada operación', 'Tokens detallados y clásicos', 'El registro de lo que hizo cada token'],
    alias: ['api', 'tokens', 'agente', 'claude code', 'integracion'],
    estado: 'parcial', slugDev: 'api-mako', fuentes: [AREAS],
  },
  {
    keys: ['tickets'],
    que: 'Reportar un problema: le cuentas a MaKo qué pasó, queda un ticket para el equipo, y te avisa por donde lo levantaste cuando está resuelto.',
    hace: ['Levantar un ticket desde el chat de MaKo o desde «Report a problem»', 'Seguir tus tickets y contestar lo que pregunte el equipo', 'El aviso cuando el arreglo ya está funcionando'],
    alias: ['soporte', 'ticket', 'tickets', 'reportar problema', 'ayuda', 'error', 'bug'],
    estado: 'parcial', slugDev: 'reportar-problema', fuentes: [AREAS, 'docs/diseno-ticketera-usuarios.md'],
  },
  {
    keys: ['partners', 'agency'],
    que: 'MaKo Partners y Agency Dashboard: los referidos que traes a MaKo y, si te sumas como agencia con el plan Pro, las cuentas de MaKo de tus clientes.',
    hace: ['Ver tus referidos', 'Sumarte como agencia (con el plan Pro activo)', 'Las cuentas de MaKo de tus clientes', 'La mensualidad de la agencia por Binance (cuando MaKo la prende): el PDF del mes y de la entrada de cada cliente por el grupo de MaKo, el comprobante que mandas ahí y su recibo, y la pausa de quien no paga'],
    // 4/11/2026: el teléfono no vende, y éstas existen para vender MaKo a otros (lib/tienda.ts → TABS_QUE_VENDEN).
    noHace: ['No están en el teléfono: se usan en la computadora'],
    alias: ['partners', 'referidos', 'agency', 'agencia'],
    estado: 'parcial', fuentes: ['app/_components/nav.ts'],
  },
];

/** La familia de la barra («Today», «Sales»…); lo de arriba (Ops Center) es «MaKo» y el menú de la foto, «Settings». */
export const FAMILIA_ARRIBA = 'MaKo';
export const FAMILIA_SETTINGS = 'Settings';

export type FuncionMako = Omit<EntradaFuncion, 'keys'> & {
  /** La key principal (la primera): el id de su nodo es `fn:<key>`. */
  key: string;
  keys: readonly string[];
  nombre: string;
  ruta: string;
  familia: string;
  /** Sólo la ve el super admin (todas sus keys son `adminOnly` en el nav). */
  soloSuperAdmin: boolean;
  /** No va en la plataforma (`noEnPlataforma` en el nav: MaKo Partners y Agency son de los negocios). */
  noEnPlataforma: boolean;
};

/** Los ítems que son funciones: la barra (con lo que dejó de ser fila) y el menú de la foto. */
const ITEMS: readonly NavItem[] = [...TODOS_LOS_ITEMS, ...USER_NAV];
const itemPorKey = (key: string): NavItem | undefined => ITEMS.find((i) => i.key === key);

/** La tab que AGRUPA estas keys como sus secciones (AI Avatar: «Create video», «Avatars»…), si son todas las suyas: el
 *  nombre de la función es el de la tab, no el de su primera sección (la verificación de 0c80dd3ce). Video Editor y Video
 *  Generator son secciones de una tab con otras: ésas se llaman como su sección. */
function tabQueAgrupa(keys: readonly string[]): NavItem | undefined {
  for (const f of FAMILIAS) {
    for (const it of [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)]) {
      if (it.secciones?.length && it.secciones.every((s) => keys.includes(s.key))) return it;
    }
  }
  return undefined;
}

function familiaDe(keys: readonly string[]): string {
  for (const f of FAMILIAS) if (itemsDe(f).some((i) => keys.includes(i.key))) return f.label;
  return USER_NAV.some((i) => keys.includes(i.key)) ? FAMILIA_SETTINGS : FAMILIA_ARRIBA;
}

let cache: FuncionMako[] | null = null;
/** Las funciones con lo que sale del nav (nombre, ruta, familia, quién la ve). Una vez por proceso. */
export function funcionesMako(): FuncionMako[] {
  if (cache) return cache;
  cache = ENTRADAS.map((e) => {
    const items = e.keys.map(itemPorKey).filter((i): i is NavItem => !!i);
    const principal = tabQueAgrupa(e.keys) ?? items[0];
    const { keys, ...resto } = e;
    return {
      ...resto, key: keys[0], keys,
      nombre: principal?.label ?? keys[0], ruta: principal?.href ?? '',
      familia: familiaDe(keys), soloSuperAdmin: items.length > 0 && items.every((i) => i.adminOnly),
      noEnPlataforma: items.length > 0 && items.every((i) => i.noEnPlataforma),
    };
  });
  return cache;
}

/** La función de una key del nav (cualquiera de las suyas), o undefined. */
export const funcionDeKey = (key: string): FuncionMako | undefined => funcionesMako().find((f) => f.keys.includes(key));

/** La función que abre una ruta (sin la query): la del primer ítem del nav cuyo `match` la acepta, como la barra. */
export function funcionDeRuta(ruta: string): FuncionMako | undefined {
  const item = ITEMS.find((i) => i.match(ruta.split(/[?#]/)[0]));
  return item ? funcionDeKey(item.key) : undefined;
}
