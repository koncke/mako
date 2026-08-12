// =============================================================================
// mako-intencion — QUÉ te están pidiendo. Una sola vez, en un solo lugar.
// =============================================================================
// EL CASO QUE LO TRAJO (2026-08-12). El dueño mandó al grupo:
//
//     Investigar competencia:
//     https://www.instagram.com/sergiozaragozax
//     https://www.viralclip.io/
//
// Quería que quedara ANOTADO para investigarlo después. MaKo le devolvió un
// análisis de dos pantallas… sobre *otras* cosas: el branding de un dashboard
// que él había mandado 33 horas antes y una idea de contenidos de 25 horas
// antes. Ninguna de las dos estaba en el mensaje. Y el análisis era inventado:
// MaKo escribió «lo que vi» sobre links que no puede abrir.
//
// ── POR QUÉ PASÓ, Y POR QUÉ NO ES «EL MODELO SE EQUIVOCÓ» ───────────────────
//
// Los cinco mensajes ANTERIORES tenían exactamente la misma forma («Idea:…»,
// «Investigar:…» + links) y los cinco terminaron bien, en un borrador. Medido
// contra `rutearDoer`, los seis caen en la MISMA ruta: `router:sonnet (default)`.
// O sea: mismo mensaje, misma ruta, y el resultado lo decidía el modelo a mano
// alzada. Salía bien casi siempre — que es otra cosa que salir bien.
//
// La causa raíz es que `mako-router` contesta **CUÁNTO gastar** (qué modelo, qué
// esfuerzo) y nadie contestaba **QUÉ HACER**. La ruta `(plan)` era la única que
// acotaba las tools y forzaba la llamada; todo lo demás caía en `(default)`, con
// las veinte tools sobre la mesa y cero obligación de usar ninguna.
//
// Este módulo contesta la otra pregunta. Es determinístico, cuesta 0, y de él
// derivan las tres cosas que antes decidía el modelo: qué tools ve, si está
// OBLIGADO a llamar una, y qué se valida al salir.
//
// ── LA SEÑAL QUE MÁS RINDE: INFINITIVO vs IMPERATIVO ────────────────────────
//
// Revisando 20 mensajes reales del dueño aparece un patrón que no falla:
//
//   · «Investigar competencia», «Copiar el branding», «VSL:», «Idea:»
//     → INFINITIVO o encabezado. Es el TÍTULO DE UNA TAREA. Te está dictando.
//   · «Investigá esto», «decime qué opinás», «armame el copy»
//     → IMPERATIVO (voseo) dirigido a MaKo. Te está PIDIENDO que lo hagas ahora.
//
// En rioplatense la diferencia es de una letra («investigar» / «investigá») y
// separa dos intenciones opuestas. Ningún modelo la va a respetar por prosa; es
// exactamente el tipo de regla que hay que escribir en código (AGENTS.md: «una
// regla en un prompt no es una regla»).
//
// ── LA REGLA DE ORO CUANDO NO SE SABE ───────────────────────────────────────
//
// Ante la duda se CAPTURA. Anotar de más cuesta un click de borrar; contestar de
// más cuando querías anotar PIERDE EL MATERIAL — el mensaje se lo come una
// respuesta y no queda en ningún lado. Las dos equivocaciones no valen lo mismo,
// así que el default no es simétrico. Y cuando la clasificación queda dudosa,
// MaKo lo dice en una línea y ofrece la otra salida.
// =============================================================================

/**
 * Lo que se puede querer de MaKo. Es un conjunto CERRADO a propósito: cada
 * intención nueva obliga a decidir sus tools, si son obligatorias y cómo se
 * valida la salida. El día que entren «modificar el CRM» o «subir campañas»,
 * entran acá y heredan el contrato — no se agregan como una tool suelta más
 * sobre la mesa, que es como se llegó a este bug.
 */
export type Intencion =
  | 'capturar'   // «anotá esto», ideas, links para después. NO se responde: se guarda.
  | 'confirmar'  // «sí, dale» sobre algo que MaKo propuso.
  | 'consultar'  // pedir un dato que MaKo tiene.
  | 'actuar'     // escribir sobre la cuenta (mover un lead, pausar una campaña).
  | 'pensar'     // análisis, opinión, copy. Lo único que se contesta largo.
  | 'charlar';   // saludo, gracias, emoji.

export type VeredictoIntencion = {
  intencion: Intencion;
  /** true si la señal no fue limpia: MaKo lo resuelve y AVISA la otra salida. */
  dudosa: boolean;
  /** La otra lectura posible, para poder ofrecerla en una línea. */
  alternativa?: Intencion;
  /** Qué la disparó. Va al log y al `motivo` del gasto de IA, para auditar. */
  porque: string;
};

// ── Señales ──────────────────────────────────────────────────────────────────

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pedido EXPLÍCITO de anotar. No hay nada que interpretar. */
const PEDIDO_ANOTAR = /\b(anota|apunta|anotame|apuntame)\b|\bal plan\b|\ba la lista\b|\bcarga(lo|las|los)? al plan\b|\brecordame\b|\bno me olvide/i;

/**
 * IMPERATIVO VOSEO dirigido a MaKo. No se usa un patrón genérico de «palabra
 * terminada en á» porque matchearía «está», «acá», «allá», «quizá» y daría
 * vuelta la clasificación de cualquier mensaje que las use.
 */
// Dos formas, y las dos son inequívocas:
//   a) el verbo CON TILDE («investigá», «armá») — el voseo escrito completo;
//   b) el verbo con pronombre pegado («investigalo», «armame», «decime»).
// ⚠️ LA TILDE ES OBLIGATORIA, y no es purismo: «investiga», «propone», «cambia»
// son TERCERA PERSONA y aparecen todo el tiempo adentro de una idea dictada.
// Con la variante sin tilde, «SI ALGUIEN ME PROPONE UNA FUNCIONALIDAD…» se leía
// como una orden a MaKo. Medido contra los mensajes reales del dueño.
//
// El costo conocido: quien escribe sin tildes («investiga esto») no dispara el
// imperativo y su pedido se CAPTURA en vez de ejecutarse. Es el error barato —
// queda anotado y se destraba con una línea— mientras que el inverso pierde el
// material. El sesgo es a propósito.
const IMPERATIVO = new RegExp(
  '\\b(' +
  // a) voseo con tilde
  'investigá|analizá|revisá|buscá|armá|escribí|redactá|compará|evaluá|calculá|resumí|proponé|sugerí|decí|mostrá|pasá|traé|explicá|ayudá|mandá|mirá|andá|fijate' +
  ')(?=[\\s,.;:!?]|$)|' +
  // b) con pronombre pegado — imperativo sí o sí
  '\\b\\w*(?:decime|contame|mostrame|pasame|dame|buscame|armame|escribime|haceme|revisame|analizame|investigame|traeme|explicame|ayudame|mandame|proponeme|sugerime|calculame|resumime|cuentame|muestrame|dimelo)\\b|' +
  '\\b(?:investigalo|analizalo|armalo|revisalo|buscalo|escribilo|resumilo|comparalo|hacelo|mostralo|pasalo|mandalo)\\b',
  'i',
);
// ⚠️ La tilde manda igual acá. Sin ella, «marca», «cambia» y «baja» —que son
// sustantivos o tercera persona— convertían un volcado de ideas en una orden de
// escribir sobre la cuenta. Pasó con «SISTEMA DE PUNTAJE.» y con «Estas son las
// cosas que le generan fricción…».
const ACCION_CUENTA_RE = /\b(apag[áa]lo|pausa[lr]o|apagá|pausá|activá|prendé|renombrá|mové|cambiá|actualizá|subí|bajá|agendá|reagendá|cancelá|marcá|asigná|eliminá|borrá)(?=[\s,.;:!?]|$)/i;

/**
 * INFINITIVO como TÍTULO: la línea arranca con un verbo en -ar/-er/-ir. Es como
 * se dicta una tarea, y es la forma que usa el dueño en todos sus volcados.
 * Anclado al arranque de línea: «para investigar» en el medio de una frase no
 * convierte el mensaje en una tarea.
 */
const INFINITIVO_TITULO = /(^|\n)\s*(investigar|copiar|analizar|revisar|armar|hacer|crear|probar|testear|mejorar|agregar|cambiar|arreglar|estudiar|mirar|ver|buscar|definir|documentar|implementar|integrar|migrar|comprar|contratar|escribir|grabar|editar|publicar|lanzar|medir|validar)\b/i;

/** Encabezado de volcado: «Idea:», «Ideas:», «VSL:», «FUNCIONALIDADES:», «Nota:». */
const ENCABEZADO_VOLCADO = /(^|\n)\s*(idea|ideas|muchas ideas|tengo ideas|nota|notas|pendiente|pendientes|investigar|competencia|funcionalidad(es)?|feature|features|para (el|la) [a-záéíóúñ ]{2,30})\s*:/i;

/** Una lista de ≥2 ítems es casi siempre una tanda de tareas. */
const esLista = (s: string): boolean => (s.match(/(^|\n)\s*(\d+[.)]|[-*•])\s+\S/g) ?? []).length >= 2;

/** ¿Trae links? Un mensaje que es material + links es material para guardar. */
const cuentaLinks = (s: string): number => (s.match(/https?:\/\/\S+/g) ?? []).length;

// ⚠️ EL CORTE ES `(?![a-záéíóúñ])`, NO `\b`. En JavaScript `\b` se calcula con
// `\w`, que NO incluye las vocales acentuadas: después de una «í» no hay
// frontera de palabra, así que `/^(s[ií]|…)\b/` NO matchea «sí, dale». Con `\b`,
// «dale» clasificaba bien y «sí, dale» —la forma más común de decir que sí— caía
// al default. Verificado ejecutando el módulo.
//
// El MISMO error vive en `CONFIRMACION_PELADA` (lib/mako-doer-acciones.ts), que
// es el guard que impide que un «sí» pelado invente tareas de la nada: con «sí»
// acentuado no matchea, así que justo ahí el guard no protege.
const CONFIRMACION = /^[\s¡!¿?]*(s[ií]|dale|ok(ey)?|listo|perfecto|obvio|claro|va|hacelo|cargalo|carg[áa]lo|agregalo|agreg[áa]lo|confirmo|adelante|de una|correcto|exacto|as[ií] es|no|nop|cancela|cancel[áa])(?![a-záéíóúñ])/i;

const SALUDO = /^[\s¡!¿?]*(hola|buenas|buen[oa]s|hey|ey|qu[eé] tal|c[oó]mo (and|est|va)|todo bien|gracias|mil gracias|genial|joya|b[aá]rbaro|buen[ií]simo|jaja|abrazo|saludos|chau|nos vemos|buen finde)(?![a-záéíóúñ])/i;
const SOLO_EMOJI = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}!?.]+$/u;

// Interrogativos: al ARRANQUE («¿cuántos leads…?») o después de un imperativo
// («decime cuántos leads…»). El segundo caso importa por costo: sin él, cada
// «decime…» se clasificaba como 'pensar' y se iba a Opus para leer un número.
/** Pregunta directa: arranca con un interrogativo, o termina en «?». */
const PREGUNTA = /^[\s¡!¿?]*(qu[eé]|cu[aá]nt|cu[aá]l|qui[eé]n|cu[aá]ndo|d[oó]nde|c[oó]mo|por\s?qu[eé]|hay|tengo|ten[eé]s)(?![a-záéíóúñ])|\?\s*$/i;

/**
 * Un interrogativo EN CUALQUIER LADO.
 *
 * ⚠️ SOLO vale acompañado de un imperativo («decime cuántos leads entraron»).
 * Suelto es inservible: «que» aparece en casi toda oración larga en español, y
 * buscándolo así tres volcados de ideas del dueño —«las cosas QUE yo
 * considero…», «SI ALGUIEN ME PROPONE…», «SISTEMA DE PUNTAJE. Que cada tarea
 * tenga…»— se clasificaban como consultas y perdían la captura. Medido.
 */
const INTERROGATIVO = /\b(cu[aá]nt[oa]s?|qu[eé]|cu[aá]l(es)?|qui[eé]n(es)?|cu[aá]ndo|d[oó]nde)(?![a-záéíóúñ])/i;


// ── El clasificador ──────────────────────────────────────────────────────────

/**
 * Qué quiere el dueño en ESTE turno. Puro y sincrónico: no mira el historial a
 * propósito — el turno anterior es contexto de la charla, nunca material del
 * pedido, que es justo la confusión que produjo el bug.
 *
 * `hayPendientes` es lo único externo que entra, porque un «sí» pelado solo
 * significa algo si hay una propuesta esperando.
 */
export function clasificarIntencion(
  texto: string,
  ctx: { hayPendientes?: boolean; hayMedia?: boolean } = {},
): VeredictoIntencion {
  const t = (texto || '').trim();
  const n = norm(t);

  // 1) Un «sí» pelado con algo esperando. Va PRIMERO: es el turno más corto y el
  //    más fácil de confundir con un saludo.
  if (ctx.hayPendientes && CONFIRMACION.test(t) && t.length <= 60) {
    return { intencion: 'confirmar', dudosa: false, porque: 'confirmación con pendiente vigente' };
  }

  // 2) Pedido explícito de anotar. No hay ambigüedad posible.
  if (PEDIDO_ANOTAR.test(n)) {
    return { intencion: 'capturar', dudosa: false, porque: 'pidió anotarlo explícitamente' };
  }

  // 3) Saludo o emoji suelto, corto y sin nada más.
  if ((SALUDO.test(t) || SOLO_EMOJI.test(t)) && t.length <= 80 && cuentaLinks(t) === 0) {
    return { intencion: 'charlar', dudosa: false, porque: 'saludo/charla' };
  }

  // ── El cruce que importa: material dictado vs pedido a MaKo ────────────────
  const dictado = INFINITIVO_TITULO.test(t) || ENCABEZADO_VOLCADO.test(t) || esLista(t);
  const pedido = IMPERATIVO.test(t);
  const links = cuentaLinks(t);

  // 4) Dictado SIN imperativo → captura. Es el caso del bug, y es el 90% de lo
  //    que el dueño manda al grupo: un volcado de ideas para revisar después.
  if (dictado && !pedido) {
    return { intencion: 'capturar', dudosa: false, porque: 'título en infinitivo / encabezado de volcado, sin pedido a MaKo' };
  }

  // 5) Dictado Y además un imperativo. Acá SÍ hay dos lecturas y ninguna es
  //    obviamente la buena. Gana capturar —perder el material es el error caro—
  //    pero se marca dudosa para que MaKo ofrezca la otra en una línea.
  if (dictado && pedido) {
    return { intencion: 'capturar', dudosa: true, alternativa: 'pensar', porque: 'trae material dictado y también un verbo en imperativo' };
  }

  // 6) Solo links, sin una frase que diga qué hacer con ellos. Mandar un link
  //    pelado es guardarlo: si quisiera que MaKo lo mire, lo diría.
  if (links > 0 && !pedido && n.replace(/https?:\/\/\S+/g, '').trim().length < 60) {
    return { intencion: 'capturar', dudosa: false, porque: 'links sin instrucción: material para guardar' };
  }

  // 7) Escritura sobre la cuenta.
  if (ACCION_CUENTA_RE.test(t)) {
    return { intencion: 'actuar', dudosa: false, porque: 'verbo de acción sobre la cuenta' };
  }

  // 8) Pregunta por un dato. Gana sobre el imperativo («decime cuántos leads
  //    entraron») porque el contrato es el mismo y el tier es más barato: sin
  //    esto, cada «decime…» se iba a Opus.
  if (PREGUNTA.test(t) || (pedido && INTERROGATIVO.test(t))) {
    return { intencion: 'consultar', dudosa: false, porque: 'pregunta por un dato' };
  }

  // 9) Imperativo dirigido a MaKo, o media adjunta → hacerlo ahora.
  if (pedido || ctx.hayMedia) {
    return { intencion: 'pensar', dudosa: false, porque: ctx.hayMedia ? 'adjunto para interpretar' : 'imperativo dirigido a MaKo' };
  }

  // 9-bis) Un «sí/dale» suelto SIN nada esperando no es material: es ruido de
  //        charla. Capturarlo intentaría parir una tarea de la nada (lo frena
  //        `pareceConfirmacion` río abajo, pero llegar hasta ahí ya es un gasto).
  if (CONFIRMACION.test(t) && t.length <= 60) {
    return { intencion: 'charlar', dudosa: false, porque: 'confirmación sin nada pendiente' };
  }

  // 10) No se pudo clasificar. Se CAPTURA, que es el default que no pierde nada,
  //     y se avisa. El default viejo era «mandale todas las tools y que el modelo
  //     vea»: eso es lo que producía dos resultados distintos para el mismo
  //     mensaje.
  return { intencion: 'capturar', dudosa: true, alternativa: 'pensar', porque: 'sin señal clara: se guarda para no perderlo' };
}

// ── El contrato de cada intención ────────────────────────────────────────────

export type ContratoIntencion = {
  /** Las ÚNICAS tools que puede usar. `null` = todas (solo para 'pensar'). */
  tools: string[] | null;
  /** ¿Está obligado a llamar una tool en el primer paso? */
  forzarTool: boolean;
  /** ¿Se valida que la salida haya producido lo que corresponde? */
  exigeBorrador: boolean;
};

/**
 * Qué puede hacer MaKo en cada intención. ES LA TABLA QUE HAY QUE TOCAR cuando
 * entren capacidades nuevas (CRM, campañas): una capacidad nueva es una fila
 * acá, no veinte tools más sobre la mesa esperando que el modelo elija bien.
 *
 * `forzarTool` es la diferencia entre «el prompt le pide» y «el código le
 * exige». Sin eso, `capturar` funcionaba el 80% de las veces.
 */
export const CONTRATO: Record<Intencion, ContratoIntencion> = {
  capturar:  { tools: ['ver_plan', 'proponer_tareas_plan', 'listar_pendientes'], forzarTool: true, exigeBorrador: true },
  confirmar: { tools: ['listar_pendientes', 'confirmar_accion', 'cancelar_accion'], forzarTool: true, exigeBorrador: false },
  consultar: { tools: null, forzarTool: false, exigeBorrador: false },
  actuar:    { tools: null, forzarTool: false, exigeBorrador: false },
  pensar:    { tools: null, forzarTool: false, exigeBorrador: false },
  charlar:   { tools: [], forzarTool: false, exigeBorrador: false },
};

/**
 * La línea que MaKo agrega cuando la clasificación fue dudosa. Corta, al final,
 * y con la salida concreta: el dueño está en el celular y ya recibió lo que
 * pidió — esto es una escotilla, no una pregunta que lo frene.
 */
export function avisoDeDuda(v: VeredictoIntencion): string {
  if (!v.dudosa) return '';
  if (v.intencion === 'capturar' && v.alternativa === 'pensar') {
    return '\n\n_Lo dejé anotado. Si querías que lo investigue ahora, decime «investigalo» y lo hago._';
  }
  return '';
}
