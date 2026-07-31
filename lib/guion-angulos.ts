// =============================================================================
// guion-angulos — la biblioteca de ÁNGULOS DE GUION (el enfoque de cada anuncio)
// =============================================================================
// Un ÁNGULO DE GUION es el ENFOQUE estratégico del anuncio: desde dónde le entra
// al espectador (su dolor, un testimonio, un regalo, una comparación…). NO es el
// FORMATO de video (eso vive en lib/angulos-formatos: cómo se ve el creativo) —
// una celda de la matriz puede tener VARIOS guiones, cada uno con un ángulo
// distinto, y eso es exactamente lo que se testea en Meta.
//
// Cada ángulo trae INSTRUCCIONES para la IA (qué tiene que hacer el guion, qué
// evitar, y patrones de hook probados) y la ESTRUCTURA que mejor le calza — las
// 3 estructuras del doc de referencia de guiones TOFU (Gancho-Historia-CTA,
// Gancho-Valor-CTA, Gancho-Propuesta directa-CTA).
//
// DATOS PUROS (sin 'server-only'): los consume el modal de la Matriz en el
// browser y el generador server-side. El super-admin puede EDITAR/AGREGAR
// ángulos desde /admin — el override vive en app_settings del OWNER_WS
// (lib/guion-angulos-store.ts) y pisa este catálogo por completo.
// =============================================================================

export type EstructuraGuion = 'gancho-historia-cta' | 'gancho-valor-cta' | 'gancho-propuesta-cta';

export type AnguloGuion = {
  id: string;
  nombre: string;
  emoji: string;
  /** Cuándo usarlo (1 frase — se muestra en la card al elegir ángulo). */
  cuando: string;
  /** Instrucciones para la IA: qué hace el guion, qué evitar, patrones de hook. */
  instrucciones: string;
  /** Estructura de guion que mejor le calza por default. */
  estructura: EstructuraGuion;
  /** false = no se ofrece al elegir (el super-admin lo apagó sin borrarlo). */
  activo: boolean;
};

/** Las 3 estructuras del doc de referencia: etiquetas EXACTAS (el parser de la
 *  UI parte el guion por estas líneas en MAYÚSCULA) + guía por bloque. */
export const ESTRUCTURAS_GUION: Record<EstructuraGuion, { nombre: string; etiquetas: string[]; guia: string }> = {
  'gancho-historia-cta': {
    nombre: 'Gancho → Historia → CTA',
    etiquetas: ['GANCHO', 'HISTORIA', 'CTA'],
    guia: `GANCHO (3-5 segundos, 1-2 frases): llama la atención con el dolor/deseo real, CUALIFICA para quién es (nombra al avatar o su situación) y genera curiosidad por lo que sigue.
HISTORIA (el cuerpo): una historia que muestre los problemas por los que pasa el avatar y cómo se descubrió una manera nueva de hacer las cosas que los eliminó. ANTES creíble → el descubrimiento (una sola razón, contada simple) → DESPUÉS concreto. El objetivo es que se identifique y le dé curiosidad ver cómo es esa manera nueva.
CTA (5-10 segundos, 1-2 frases): antes del llamado podés rebatir UNA objeción corta ("no es porque X, es porque…"); después, una sola instrucción clara.`,
  },
  'gancho-valor-cta': {
    nombre: 'Gancho → Valor → CTA',
    etiquetas: ['GANCHO', 'VALOR', 'CTA'],
    guia: `GANCHO (3-5 segundos, 1-2 frases): nombra al avatar/su situación y promete lo que va a APRENDER en este video ("te voy a mostrar los 3 pasos para…").
VALOR (el cuerpo): educa de verdad, como un mini-tutorial: 2-3 pasos o ideas accionables con una explicación BREVE de cada una. Puede abrir diciendo qué debe DEJAR de hacer antes de mostrar qué hacer. El espectador tiene que llevarse algo útil aunque no haga clic.
CTA (5-10 segundos, 1-2 frases): dirigido a quien ya quiere ayuda aplicándolo (no al curioso que solo quiere aprender gratis); una sola instrucción clara.`,
  },
  'gancho-propuesta-cta': {
    nombre: 'Gancho → Propuesta directa → CTA',
    etiquetas: ['GANCHO', 'PROPUESTA', 'CTA'],
    guia: `GANCHO (3-5 segundos, 1-2 frases): pregunta o afirmación que cualifica al avatar y nombra su situación, directo al grano.
PROPUESTA (el cuerpo): presenta la propuesta de forma clara y atractiva, sin vueltas: qué ofreces, a quién y qué logra. Podés conectar primero con lo que YA intentó y no le funcionó (2-3 cosas, rápido) para ganar confianza, y después mostrar la manera más simple. Sin tutorial y sin historia larga: al grano.
CTA (5-10 segundos, 1-2 frases): mostrar directamente la intención y el paso a seguir; una sola instrucción clara.`,
  },
};

// ── El catálogo por default ───────────────────────────────────────────────────
// El super-admin lo edita/expande desde /admin (override completo en settings).
export const ANGULOS_GUION_DEFAULT: AnguloGuion[] = [
  {
    id: "dolor", nombre: "Dolor", emoji: "😩", activo: true,
    cuando: "Tráfico frío que siente el problema pero todavía no busca solución — el default para arrancar campañas.",
    estructura: "gancho-historia-cta",
    instrucciones: "Nombra el dolor especifico del [avatar] en los primeros 3 segundos para que se reconozca al instante: cuanto mas estrecho y concreto el dolor, mas calificada la persona que se queda viendo. Despues del gancho, agita el costo de seguir igual (tiempo, dinero, frustracion diaria) con una escena que el avatar viva en carne propia, y recien entonces presenta el servicio como la salida natural antes del CTA. No nombres el producto ni la marca en el gancho, y evita dolores genericos tipo 'no tienes tiempo': usa el sintoma exacto que aparece en el contexto del negocio. Patrones de gancho: 'Si te pasa [dolor], deja de hacer scroll.' / 'Por que sigues con [dolor] aunque ya probaste [solucion tipica]?' / '[Consecuencia cara] no es tu culpa: es culpa de [causa inesperada].'",
  },
  {
    id: "lead-magnet", nombre: "Lead Magnet (regalo)", emoji: "🎁", activo: true,
    cuando: "Tráfico frío donde pedir la compra directa es demasiado: el objetivo es el registro, no la venta.",
    estructura: "gancho-propuesta-cta",
    instrucciones: "Abre calificando al [avatar] o prometiendo el regalo en la primera frase, describe que contiene el [lead magnet] y el resultado especifico que produce (no 'una guia util' sino 'el checklist exacto para [resultado] en [plazo]'), suma una linea de credibilidad de por que el negocio puede regalarlo, y cierra con un CTA de friccion cero usando palabras como 'gratis' y 'ahora'. El guion entero gira alrededor del entregable: no vendas el servicio principal, vende el regalo. Evita vaguedad en la promesa y evita pedir mas de un paso (solo descargar/registrarse). Usa unicamente el lead magnet que exista en el contexto del negocio, sin inventarle contenido. Patrones de gancho: 'Te voy a regalar [lead magnet] que me costo [tiempo/dinero] armar. Gratis.' / 'Hice el trabajo sucio por ti: [lead magnet] listo para usar hoy.' / 'Si [condicion calificadora del avatar], esto es para ti.'",
  },
  {
    id: "educativo", nombre: "Educativo (pasos/tips)", emoji: "🎓", activo: true,
    cuando: "Tráfico frío: gana atención regalando valor útil antes de pedir nada.",
    estructura: "gancho-valor-cta",
    instrucciones: "Promete el resultado en los primeros 2 segundos y entrega 2-3 pasos o tips accionables de verdad: el espectador debe poder aplicar algo hoy aunque nunca compre. El servicio aparece DENTRO de uno de los pasos como herramienta natural, nunca como pitch al final con energia de vendedor; el CTA es suave y contextual ('si quieres que lo hagamos por ti...'). Usa formato numerado porque señala orden y payoff garantizado, y guarda el mejor tip para el final para sostener la retencion. Evita teoria abstracta: cada paso es una accion concreta con verbo. Patrones de gancho: '[N] [trucos/pasos] para [resultado] que ojala hubiera conocido antes.' / 'Asi es exactamente como [lograr resultado], paso a paso.' / 'Te enseño en [N] segundos lo que a mi me tomo [años/mucho dinero] aprender.'",
  },
  {
    id: "contrarian", nombre: "Contrarian (romper mitos)", emoji: "🚫", activo: true,
    cuando: "Mercados saturados donde el avatar ya escuchó todos los consejos típicos y está escéptico.",
    estructura: "gancho-valor-cta",
    instrucciones: "Abre contradiciendo una creencia establecida del mercado del [avatar] y sostenlo: explica con logica y evidencia por que el consejo popular falla, revela que funciona en su lugar, y presenta el servicio como la encarnacion de esa verdad. El claim contrario tiene que ser DEFENDIBLE con lo que hay en el contexto del negocio; la audiencia y Meta castigan la exageracion, asi que ataca practicas e ideas, nunca personas ni competidores con nombre. La estructura es mas argumento que historia: afirmacion, por que todos se equivocan, el mecanismo real, CTA. Evita suavizar el gancho: la disonancia es lo que frena el scroll. Patrones de gancho: 'Deja de hacer [practica comun]: te esta frenando [resultado].' / 'Todo el mundo dice [consejo popular]. Es justo lo que esta matando tu [metrica].' / 'Opinion impopular: no necesitas [cosa que todos compran], necesitas [alternativa simple].'",
  },
  {
    id: "pov-relatable", nombre: "POV / Escena relatable", emoji: "🎬", activo: true,
    cuando: "Formato nativo de feed que parece contenido orgánico: ideal para dolores cotidianos reconocibles.",
    estructura: "gancho-historia-cta",
    instrucciones: "Escribe una mini-escena que el [avatar] viva cada semana: un 'POV' o situacion actuada donde la frustracion con [dolor] escala hasta un pico, y el servicio entra como la resolucion (casi el remate del chiste), con un CTA ligero al final. El guion debe sonar a video casero de celular: dialogo natural, humor o ironia suave, cero lenguaje publicitario; la energia de vendedor mata este angulo por completo. El problema-solucion va contrabandeado dentro de la escena, nunca explicado de frente. Evita escenas genericas: usa detalles especificos del dia a dia del avatar sacados del contexto del negocio. Patrones de gancho: 'POV: otra vez [situacion frustrante del avatar].' / 'Dime por que nadie me dijo esto antes de [situacion].' / 'Yo, un [avatar], fingiendo que [dolor] no me esta comiendo vivo.'",
  },
  {
    id: "historia-fundador", nombre: "Historia del fundador", emoji: "👤", activo: true,
    cuando: "Marcas lideradas por su fundador, cuando su historia de origen conecta con el dolor del avatar.",
    estructura: "gancho-historia-cta",
    instrucciones: "Narra en primera persona del fundador el momento fundacional: el problema que vivio en carne propia, el punto de quiebre, la decision de crear el servicio, y una prueba de que hoy funciona, cerrando con una invitacion (no un pitch). La vulnerabilidad es el motor: incluye el fracaso, el costo o la frustracion real antes del giro, porque la confesion crea conexion y el conflicto abre el loop narrativo. Usa solo hechos biograficos y del negocio presentes en el contexto; si no hay historia de origen documentada, no la inventes: usa otro angulo. Nunca conviertas el final en venta dura; el CTA es 'si estas donde yo estaba, hablemos'. Patrones de gancho: 'Cree [servicio] porque no encontraba [solucion] que no [defecto de las existentes].' / 'Hace [N] años yo era [situacion dolorosa]. Hoy [contraste]. Esta es la historia.' / 'Me dijeron que [idea] era imposible. [N] clientes despues, esto paso.'",
  },
  {
    id: "testimonio", nombre: "Testimonio", emoji: "🗣️", activo: true,
    cuando: "Cuando el bloqueo es la confianza: suena a recomendación de un igual, no a anuncio.",
    estructura: "gancho-historia-cta",
    instrucciones: "Escribe en primera persona con la voz de un cliente, siguiendo el arco esceptico: resultado concreto al inicio, luego 'yo no creia que esto funcionara', la historia de como lo probo y el desenlace, y cierra con CTA. Usa UNICAMENTE hechos, resultados y clientes que esten presentes en el contexto del negocio; si no hay un caso real documentado, escribelo como hipotetico honesto ('Imagina que llevas [tiempo] con [dolor]...') y nunca inventes nombres, cifras ni testimonios. Evita el tono publicitario: tiene que sonar a alguien contando su experiencia a un amigo, con detalles cotidianos y alguna duda o friccion real. Patrones de gancho: 'Yo no creia que [resultado] fuera posible hasta que [momento de quiebre].' / 'Era esceptico con [servicio]... y se pago solo en [plazo].' / 'Llevo [tiempo] trabajando con ellos y esto es lo que nadie te dice.'",
  },
  {
    id: "caso-de-exito", nombre: "Caso de éxito (antes/después)", emoji: "📈", activo: true,
    cuando: "Cuando el negocio tiene resultados medibles y el avatar necesita prueba de que funciona con alguien como él.",
    estructura: "gancho-historia-cta",
    instrucciones: "Cuenta la transformacion de UN cliente con numeros: abre con el contraste antes/despues ('de [antes medible] a [resultado] en [plazo]') y luego narra que estaba mal, que se hizo distinto y como quedo hoy. Usa solo casos, metricas y plazos que existan en el contexto del negocio; si no hay un caso real con numeros, plantea el escenario como proyeccion honesta ('imagina pasar de X a Y') sin presentarlo como hecho. A diferencia del testimonio, aqui narra la marca o el fundador, no el cliente, asi que el foco esta en el sistema que produjo el resultado, no en la emocion. Evita cifras redondas sospechosas y promesas de resultados garantizados. Patrones de gancho: 'Asi fue como [avatar] paso de [antes] a [resultado] en [plazo].' / 'Esto era su [metrica] hace [plazo]... y esto es hoy. La diferencia fue una sola cosa.' / 'Un solo cambio duplico su [metrica] en [plazo].'",
  },
  {
    id: "comparacion", nombre: "Comparación", emoji: "⚖️", activo: true,
    cuando: "Cuando el avatar duda entre alternativas o sigue casado con la forma vieja de resolver el problema.",
    estructura: "gancho-valor-cta",
    instrucciones: "Contrasta la forma vieja de lograr [resultado] (o las alternativas tipicas que el avatar ya probo) contra la forma del negocio: describe cada opcion, di con razones concretas por que se queda corta, y presenta el servicio como el ganador claro con su porque. Compara contra categorias y metodos ('hacerlo tu solo', 'contratar X generico', 'los cursos de siempre'), nunca contra competidores con nombre propio ni con claims absolutos que Meta pueda marcar. El contraste debe ser justo y verificable: reconoce que hace bien la alternativa antes de mostrar donde falla, porque eso da credibilidad. Cierra con CTA que invite a probar la forma nueva. Patrones de gancho: 'Probe [N] formas de [resultado]. Solo una vale la pena.' / 'La forma vieja: [ritual doloroso]. La forma nueva: esto.' / 'Si sigues haciendo [practica comun], estas dejando dinero en la mesa.'",
  },
  {
    id: "mecanismo", nombre: "Mecanismo (la razón real)", emoji: "🔬", activo: true,
    cuando: "Avatares quemados que ya probaron de todo: responde el \"por qué esto sí va a funcionar\".",
    estructura: "gancho-valor-cta",
    instrucciones: "Reencuadra la causa raiz: dile al [avatar] que el problema nunca fue [causa que el asume] sino [causa real], y explica el mecanismo unico (proceso, metodo, sistema) por el que el servicio ataca esa causa cuando todo lo demas fallo. Construye un puente logico entre promesa y resultado: cada afirmacion se sostiene con el como, no con adjetivos, usando solo el metodo y las pruebas que existan en el contexto del negocio. Valida el esfuerzo previo del avatar ('no es que no le echaste ganas') para desarmar la culpa antes de vender. Evita jerga tecnica sin traducir y evita prometer que el mecanismo es magico: es logico. Patrones de gancho: 'Esta es la razon real por la que nada de lo que probaste para [dolor] funciono.' / 'El problema nunca fue [causa asumida]. Es [causa real].' / 'Pensaba que [categoria de solucion] era puro humo... hasta que entendi como funciona de verdad.'",
  },
  {
    id: "demostracion", nombre: "Demostración", emoji: "🖥️", activo: true,
    cuando: "Cuando el producto/servicio se puede MOSTRAR funcionando en pantalla — ver es creer.",
    estructura: "gancho-propuesta-cta",
    instrucciones: "El guion narra una demostracion en vivo: que esta viendo el espectador mientras el producto/servicio hace lo suyo, en lenguaje simple ('mira esto: aca se ve...'). Ancla cada cosa mostrada al dolor que resuelve — nada de tour de features: solo lo que le importa al avatar. Recorda que es SOLO lo hablado: describis con palabras lo que se ve, sin acotaciones de camara. Patrones de gancho: 'Mira como [resultado] en [tiempo corto].' / 'Esto es exactamente lo que pasa cuando [accion con el producto].' / 'Te muestro en vivo como [tarea dolorosa] se hace sola.'",
  },
  {
    id: "propuesta-directa", nombre: "Propuesta directa", emoji: "🎯", activo: true,
    cuando: "Sin vueltas y sin urgencia: qué haces, para quién y qué logra — filtra fuerte y trae al que ya busca ayuda.",
    estructura: "gancho-propuesta-cta",
    instrucciones: "Directo al grano: cualifica al avatar en la primera frase, nombra que ofreces y el resultado que logra, y cierra con el paso siguiente. Podes listar rapido 2-3 cosas que el avatar YA intento sin resultado para ganar confianza ('ya probaste X, Y, Z... y sigues igual'). A diferencia de la oferta con urgencia, aca NO hay limite de tiempo ni cupos: la fuerza esta en la claridad, no en la presion. Cero relleno: cada frase o cualifica, o propone, o llama a la accion. Patrones de gancho: '¿Eres [avatar] y [situacion]? Esto es para ti.' / 'Ayudo a [avatar] a [resultado] sin [dolor].' / '¿Que tienes que hacer para [resultado]? Te lo cuento en 1 minuto.'",
  },
  {
    id: "retargeting", nombre: "Retargeting (objeciones)", emoji: "🔁", activo: true,
    cuando: "Solo tráfico tibio/caliente que ya vio la oferta y no actuó — cada anuncio ataca UNA objeción distinta.",
    estructura: "gancho-propuesta-cta",
    instrucciones: "Habla directo a la persona que ya vio el anuncio o la pagina y no actuo: nombra la objecion exacta que la freno (precio, tiempo, '¿y si no me funciona?', 'ya probe algo parecido'), destruyela con prueba concreta del contexto del negocio (garantia, proceso, resultados reales) y remata con la oferta y un CTA sin ambiguedad. No necesita arco narrativo: es un pitch directo, corto y frontal, con tono de 'se lo que estas pensando'. Evita repetir el pitch original tal cual; este anuncio existe para decir algo NUEVO que la primera vez no se dijo. Menciona solo garantias y pruebas que realmente existan en el negocio. Patrones de gancho: 'Sigues pensando en [servicio]? Esto es lo que te esta frenando.' / 'Se lo que estas pensando: \"[objecion textual]\". Dejame mostrarte por que no es asi.' / 'Viste [servicio], no actuaste. Normal. Pero esto no lo sabias...'",
  },
  {
    id: "oferta-directa", nombre: "Oferta directa (urgencia)", emoji: "🔥", activo: true,
    cuando: "Tráfico caliente, lanzamientos o cupos limitados REALES; usar poco en frío.",
    estructura: "gancho-propuesta-cta",
    instrucciones: "Ve al grano desde el segundo cero: que es la oferta, que resultado da, que incluye y cuando cierra, con numeros concretos en lugar de adjetivos. La urgencia solo funciona si tiene una RAZON creible (cupos reales de agenda, fecha de inicio, capacidad del equipo): explica ese porque, y nunca inventes escasez ni descuentos que no esten en el contexto del negocio. Agrega un destello de prueba social si existe (clientes actuales, resultados) y cierra con un CTA especifico con fecha limite. Sin historia, sin rodeos: claridad brutal. Patrones de gancho: 'No te voy a hacer perder tiempo: si quieres [resultado], esto es lo unico que necesitas ver hoy.' / 'Solo por [plazo]: [oferta] para los primeros [N].' / 'Esto es [servicio], logra [resultado], y hasta [fecha] tiene [incentivo].'",
  },
];

export function anguloGuionPorId(angulos: AnguloGuion[], id: string): AnguloGuion | undefined {
  return angulos.find((a) => a.id === id);
}

/** Normaliza un catálogo crudo (del override editable). Descarta entradas sin lo mínimo. */
export function normalizarAngulosGuion(v: unknown): AnguloGuion[] {
  if (!Array.isArray(v)) return [];
  const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const out: AnguloGuion[] = [];
  for (const raw of v) {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = s(o.id).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const nombre = s(o.nombre);
    const instrucciones = s(o.instrucciones);
    if (!id || !nombre || !instrucciones) continue;
    const estructura = (['gancho-historia-cta', 'gancho-valor-cta', 'gancho-propuesta-cta'] as const).find((e) => e === o.estructura) ?? 'gancho-historia-cta';
    out.push({ id, nombre, emoji: s(o.emoji) || '🎬', cuando: s(o.cuando), instrucciones, estructura, activo: o.activo !== false });
  }
  return out;
}
