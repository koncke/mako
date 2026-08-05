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

export type FamiliaProyecto = 'producto' | 'vender' | 'transversal';

export type ProyectoCatalogo = {
  /** El nombre EXACTO con el que vive en el tablero. */
  nombre: string;
  emoji: string;
  familia: FamiliaProyecto;
  /** Qué entra acá, en una línea. Es lo que lee el modelo para rutear: si no se
   *  entiende de esta línea sola, el nombre está mal elegido. */
  que: string;
};

export const CATALOGO_PROYECTOS: ProyectoCatalogo[] = [
  // ── Producto: una tab, un proyecto ─────────────────────────────────────────
  { nombre: 'General', emoji: '🏠', familia: 'producto', que: 'La pantalla de inicio: el semáforo de qué está bien y qué no, y el diagnóstico del negocio que lo sostiene.' },
  // «General» eran dos cosas distintas metidas en una: el semáforo que DIAGNOSTICA (te
  // dice cómo estás) y el foco que MANDA (te dice qué hacer ahora). Se separan porque
  // compiten: mientras el diagnóstico crecía, la acción de la semana quedaba enterrada
  // entre métricas — que es justo el problema que venía a resolver.
  { nombre: 'Foco', emoji: '🧭', familia: 'producto', que: 'Qué hacer AHORA: la acción de la semana, la vista Hoy, el briefing de la mañana, a quién llamar y el latido que te lo reclama.' },
  { nombre: 'CRM', emoji: '👥', familia: 'producto', que: 'Los leads: la ficha, las etapas, el avance automático, los recordatorios de reunión y el follow-up.' },
  { nombre: 'Dashboard', emoji: '📊', familia: 'producto', que: 'La analítica de marketing y comercial: métricas, gráficos, objetivos y salud del número.' },
  { nombre: 'Experiments', emoji: '🧪', familia: 'producto', que: 'Los experimentos: el único lugar donde se concluye qué funcionó y qué no.' },
  { nombre: 'Plan', emoji: '🐕', familia: 'producto', que: 'El tablero de tareas y el Perro Guardián: priorizar, agrupar, deduplicar, rendir cuentas.' },
  { nombre: 'Ads Manager', emoji: '📣', familia: 'producto', que: 'Las campañas de Meta desde la app: crear, pausar, renombrar, presupuesto, y el agente que optimiza el gasto.' },
  { nombre: 'Fábrica de creativos', emoji: '🏭', familia: 'producto', que: 'Avatares, razones, matriz, lead magnet, personas, ángulos y guiones: la cadena que produce los creativos.' },
  { nombre: 'Ads Writer', emoji: '🖊️', familia: 'producto', que: 'La redacción de anuncios: copys, variantes y textos listos para publicar.' },
  { nombre: 'Closing Analyst', emoji: '📞', familia: 'producto', que: 'El analista de llamadas de venta: transcripciones, objeciones, y el copiloto en vivo.' },
  { nombre: 'Ads Analyst', emoji: '🎬', familia: 'producto', que: 'El analista de guiones y creativos: retención por cuartiles, qué gancho funciona.' },
  { nombre: 'Market Analyst', emoji: '🕵️', familia: 'producto', que: 'El análisis de competencia: qué anuncia la competencia, qué ofertas hay en el mercado.' },
  { nombre: 'CS Analyst', emoji: '🩺', familia: 'producto', que: 'Retención y customer success: anticipar la baja de un cliente.' },
  { nombre: 'MaKo Doer', emoji: '🧠', familia: 'producto', que: 'MaKo que ACTÚA (no que opina): sus tools, el chat por WhatsApp con el dueño, las confirmaciones.' },
  { nombre: 'Chat Agent', emoji: '💬', familia: 'producto', que: 'El proceso de setting: secuencias de nutrición, canales fríos, plantillas y las métricas de la conversación.' },
  { nombre: 'WhatsApp', emoji: '📥', familia: 'producto', que: 'El canal de WhatsApp en sí: bandejas, oficial y no oficial, envío, anti-ban.' },
  { nombre: 'Email', emoji: '✉️', familia: 'producto', que: 'El canal de email: envíos, plantillas, entregabilidad.' },
  { nombre: 'Instagram', emoji: '📸', familia: 'producto', que: 'La tab de Instagram del producto: conectar la cuenta, leer DMs, publicar desde la app.' },
  { nombre: 'Onboarding', emoji: '🧳', familia: 'producto', que: 'El arranque de un cliente: el wizard, el Archivero, el funnel y el diagnóstico de fase.' },
  { nombre: 'Contexto de MaKo', emoji: '🧩', familia: 'producto', que: 'Lo que MaKo sabe del negocio: RAG, glosario, prompts y el contexto que le entra a cada respuesta.' },
  { nombre: 'Integraciones', emoji: '🔌', familia: 'producto', que: 'Conectar servicios de afuera: Meta, Chatwoot, Fathom, Resend, las credenciales y su salud.' },
  { nombre: 'Configuraciones y equipo', emoji: '🔑', familia: 'producto', que: 'Cuentas, roles, permisos, perfil y las configuraciones del workspace.' },
  { nombre: 'Admin y clientes', emoji: '🏢', familia: 'producto', que: 'El panel del super-admin: alta de clientes, impersonación, ver el estado de cada workspace.' },
  { nombre: 'Conocimientos', emoji: '📚', familia: 'producto', que: 'El portal de formación: cursos, clases y material para el cliente.' },
  { nombre: 'Feedback y errores', emoji: '🗳️', familia: 'producto', que: 'Que el usuario pueda reportar un error y proponer features: botón de reportar, tickets con estado, votación, y el triaje automático.' },
  { nombre: 'Cobros y planes', emoji: '💳', familia: 'producto', que: 'Monetización: planes y límites, versión free, suscripciones, pasarela de pago, créditos y consumo de tokens.' },

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

export const NOMBRES_CATALOGO: string[] = CATALOGO_PROYECTOS.map((p) => p.nombre);

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const PORNOMBRE = new Map(CATALOGO_PROYECTOS.map((p) => [norm(p.nombre), p]));

/** ¿Este nombre es uno del catálogo? (sin acentos ni mayúsculas). */
export const delCatalogo = (nombre: string): ProyectoCatalogo | undefined => PORNOMBRE.get(norm(nombre));

/**
 * El catálogo como se lo pasamos a un modelo: nombre + qué entra. Va SIEMPRE con las
 * dos cosas — pasarle solo los nombres es lo que hacía que rutear fuera adivinar.
 */
export function catalogoParaPrompt(): string {
  const bloque = (f: FamiliaProyecto, titulo: string) =>
    `${titulo}\n${CATALOGO_PROYECTOS.filter((p) => p.familia === f).map((p) => `· ${p.nombre} — ${p.que}`).join('\n')}`;
  return [
    bloque('producto', 'CONSTRUIR EL PRODUCTO (cada uno es una tab de la app):'),
    bloque('transversal', 'TRANSVERSALES (no son una tab, cruzan toda la app):'),
    bloque('vender', 'VENDER MAKO (el trabajo comercial, por canal):'),
  ].join('\n\n');
}
