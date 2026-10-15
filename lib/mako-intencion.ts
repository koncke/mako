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
  /** Es un «sí» a lo que MaKo acaba de ofrecer: las herramientas se eligen por el
   *  ofrecimiento, no por «sí, dale», que no nombra nada (lib/doer-herramientas.ts). */
  sigueOfrecimiento?: boolean;
  /** De qué área habla, cuando la regla que la clasificó lo sabe (un pedido de agenda es
   *  CRM aunque diga «movela al viernes»). Se suma a `areasDelMensaje`. */
  areas?: Area[];
  /** Palabras que se suman a la relevancia del presupuesto de herramientas. «movela al
   *  viernes» no comparte ninguna raíz con el título de la herramienta de mover, y sin esto
   *  quedaba afuera de los 12.000 caracteres frente al resto del CRM (08/10/2026). */
  relevancia?: string;
  /** Mover a otro día sin decir qué ('sin-decir-que'), o la respuesta «la tarea» ('tarea'). Lo
   *  pone en palabras lib/doer-herramientas.ts. Marcado acá y no vuelto a leer del texto: el
   *  revisor midió «buen día, movela al viernes» con las dos áreas y SIN la pregunta, porque
   *  doer-herramientas re-leía el texto y su preludio no pelaba «buen día» (09/10/2026). */
  mover?: 'sin-decir-que' | 'tarea';
};

/** Lo que dice un pedido de agenda para el presupuesto: pone primero las de agenda. */
export const RELEVANCIA_AGENDA = 'agendar reagendar mover cambiar cancelar reunion visita cita agenda evento';

// ── EL PEDIDO DE CREAR UNA AUTOMATIZACIÓN («Pídeselo a MaKo» por WhatsApp) ─────────────────────────
// Décima tanda (11/10/2026), Martín: «por el grupo de WhatsApp con MaKo si escribo o envio un audio pidiendo que cree
// una automatización, lo haga llamando justamente a esta función» (`crear_automatizacion_con_ia`). Medido ese día con el
// turno que CORRE (`clasificarIntencion` → `herramientasDelTurno`): «creame una automatización que…» caía en `capturar`
// (material para anotar, dudosa) y «Crea una automatización para los que no vinieron…» llegaba como `actuar` pero con la
// acción AFUERA del presupuesto de 12.000 caracteres — las del CRM y de closing nombraban más palabras del mensaje. Como
// la agenda: el clasificador lo reconoce, le pone el área y la relevancia que pone primero su herramienta.
//   · Es un IMPERATIVO o un «quiero / necesito una…» con la automatización (o el flujo) a pocas palabras del verbo. El
//     INFINITIVO («Crear automatización de cobranza») NO: así se dicta una tarea del plan, y lo toma antes el dictado.
//   · Una pregunta («¿cómo funciona la automatización…?») tampoco: la frena `ARRANCA_PREGUNTANDO`.
export const RELEVANCIA_AUTOMATIZACION = 'crear automatizacion con ia flujo pedido';
const VERBO_CREAR_AUTOMATIZACION = /\b(?:crea(?:me|nos|la)?|arma(?:me|nos|la)?|hace(?:me|nos|la)?|haz(?:me|nos|la)?|genera(?:me|nos|la)?|configura(?:me|nos|la)?|monta(?:me|nos|la)?|programa(?:me|nos|la)?|(?:puedes|podes|podrias|quiero que|necesito que)\s+(?:me\s+|nos\s+)?(?:crear|armar|hacer|generar|configurar|montar|programar|crees|armes|hagas|generes|configures)|(?:quiero|necesito|quisiera)\s+(?:un|una|otra|otro))\b/;
// ⚠️ REVISIÓN DE LA DÉCIMA TANDA (11/10/2026, corrido contra `clasificarIntencion`): «Quiero una reunión sobre el
// flujo de ventas mañana a las 10» y «Haz el flujo de caja de octubre» salían como pedido de crear una automatización,
// y el primero llegaba SIN las herramientas de la agenda. Dos cortes: «flujo de caja / efectivo / fondos / dinero» es
// plata, no un flujo de mensajes; y entre el verbo y el sustantivo no puede haber OTRO objeto de agenda (una reunión,
// una llamada…): «créame una reunión del flujo» es de la agenda.
const SUSTANTIVO_AUTOMATIZACION = /(?:automatizacion(?:es)?|automations?|flujos?\b(?!\s+de\s+(?:caja|efectivo|fondos|dinero)\b))\b/;
const OTRO_OBJETO = /(?:reunion|reuniones|llamada|llamadas|videollamada|cita|citas|junta|evento|visita)\b/;
const PEDIDO_AUTOMATIZACION = new RegExp(`${VERBO_CREAR_AUTOMATIZACION.source}\\s+(?:(?!${OTRO_OBJETO.source})\\S+\\s+){0,3}?${SUSTANTIVO_AUTOMATIZACION.source}`);

/** ¿Le pide a MaKo que CREE una automatización? (sobre el texto normalizado: sin tildes y en minúsculas). */
export function esPedidoAutomatizacion(n: string): boolean {
  const t = n.replace(PRELUDIO, '').trim();
  if (!t || t.length > 1500 || ARRANCA_PREGUNTANDO.test(t)) return false;
  return PEDIDO_AUTOMATIZACION.test(t);
}

// ── EL PEDIDO DE CREAR UN DISEÑO (el Image Editor, 15/10/2026) ──────────────────
// Medido ese día con `clasificarIntencion`: «creame un flyer de la inauguración» salía `capturar` DUDOSA (sin una sola
// herramienta: se anotaba como tarea) aunque `imagen` ya estaba en AREA_KEYWORDS — es el caso de «sumar el área no
// alcanzaba» (docs/hallazgos-api-mako.md). Mismo molde que la automatización: verbo de crear y el objeto a tres
// palabras como mucho, sin OTRO objeto en el medio («creame una tarea para el flyer» sigue siendo del Plan).
export const RELEVANCIA_DISENO = 'crear diseno imagen flyer banner plantilla editor';
const VERBO_CREAR_DISENO = new RegExp(`${VERBO_CREAR_AUTOMATIZACION.source}|\\bdisena(?:me|nos|lo|la)?\\b`);
const SUSTANTIVO_DISENO = /(?:disenos?|flyers?|volantes?|banners?)\b/;
const OTRO_OBJETO_DISENO = /(?:tareas?|recordatorios?|notas?|reunion(?:es)?|llamadas?|citas?|eventos?|visitas?|automatizacion(?:es)?|flujos?|landing|pagina)\b/;
const PEDIDO_DISENO = new RegExp(`(?:${VERBO_CREAR_DISENO.source})\\s+(?:(?!${OTRO_OBJETO_DISENO.source})\\S+\\s+){0,3}?${SUSTANTIVO_DISENO.source}`);

/** ¿Le pide a MaKo que CREE un diseño del Image Editor? (sobre el texto normalizado: sin tildes y en minúsculas). */
export function esPedidoDiseno(n: string): boolean {
  const t = n.replace(PRELUDIO, '').trim();
  if (!t || t.length > 1500 || ARRANCA_PREGUNTANDO.test(t)) return false;
  return PEDIDO_DISENO.test(t);
}

// ── EL PEDIDO SOBRE UNA LANDING DEL WEB GENERATOR (por WhatsApp) ───────────────────────────────────
// El BLOQUEANTE de la tanda 4 del editor (docs/hallazgos-editor-landing.md, «esPedidoDeLanding»): medido el 14/10/2026
// con el turno que CORRE, «publicá la landing del webinar», «despublicá…», «sacá de internet…» y «creame una landing de
// webinar» salían `capturar` dudosa, con 2 herramientas del plan y ninguna de landing. Tanda 7 (15/10/2026), Martín:
// «tienen que pasarle absolutamente todos los botones. Todas las funciones a la API de MaKo», y el orquestador pidió que
// por WhatsApp lleguen «publicá/publica la landing…», «despublicá…», «creame/créame una landing…», «replicá esta
// página…» y «analizá esta landing…». Medido otra vez el 15/10 (tests/mako-intencion-landing.test.ts): 31 de 31 frases
// de pedido llegaban SIN su herramienta.
//   · La señal es un VERBO de pedido + el OBJETO (una landing, una página, un sitio, una web, una presentación; para
//     replicar y analizar, también el link pegado) a ≤3 palabras, sin OTRO objeto en el medio: «armame un anuncio para
//     la landing» sigue siendo de Ads y «creame una automatización para la landing», de Automations (6-bis).
//   · El verbo cuenta si es inequívoco: con TILDE (voseo, mirado en el texto CRUDO: «publicá»), con PRONOMBRE pegado
//     («publícala», «créame», «hazme») o con un modal («me puedes publicar», «necesito que publiques»). La forma suelta
//     sin tilde («publica la landing») sólo si ARRANCA el mensaje, que es como se da una orden: «mi socio publica la
//     landing el lunes» es tercera persona (el costo que `esPedidoAutomatizacion` acepta con «crea», acá no).
//   · No es pedido: una pregunta de cómo se hace (`ARRANCA_PREGUNTANDO`), lo del plan («crea una tarea para publicar…»,
//     `ES_DEL_PLAN`) ni el infinitivo de una tarea dictada (lo toma antes la regla 4).
// Lo peor que deja equivocarse es una propuesta de más: publicar va en pantalla y el resto pide el «sí».
//
// EDITAR una landing ya creada (corrección de la tanda 7, 15/10/2026; Martín: «Todas las funciones a la API de MaKo»).
// La verificación midió con el turno que CORRE que «cambia el titular de mi landing…», «agrega una sección…», «ponle
// este video a mi landing https://…», «cambia el tema…», «conecta el dominio…» y «oculta la sección…» salían `capturar`
// dudosa (o, con el link, «material para guardar») sin ninguna herramienta de landing: las operaciones del editor
// existían por la app y por HTTP, no por WhatsApp.
//   · Un verbo de pedido (con tilde, con pronombre —también «le»: «ponle», «cámbiale»—, suelto al arranque o con un
//     modal) y a ≤3 palabras una PIEZA de la landing (la landing misma, una sección, el titular, un botón, el
//     formulario, el tema, el dominio, un video, la agenda, un link…), sin un objeto de OTRA área en el medio ni
//     justo después («cambia el titular DEL ANUNCIO» es de Ads).
//   · Y la landing NOMBRADA en el mensaje (una landing, una página, un sitio, una web), sin contar los links ni «la
//     página de Facebook»: «agrega un video al reel» o «cambia el tema del mail» no son de acá.
//   · Va DESPUÉS de los otros cinco: «publicá la landing» es publicar aunque publicar también la cambie.
export type PedidoDeLanding = { tipo: 'publicar' | 'despublicar' | 'crear' | 'replicar' | 'analizar' | 'editar' };

/** Lo que pone primero las herramientas de cada pedido en el presupuesto (y la lista para encontrar el id). */
export const RELEVANCIA_LANDING: Readonly<Record<PedidoDeLanding['tipo'], string>> = {
  publicar: 'publicar landing creada listar',
  despublicar: 'despublicar landing creada listar',
  crear: 'crear landing diseno disenos listar presentacion plantilla',
  replicar: 'replicar landing pagina afuera copia',
  analizar: 'analizar diagnosticar landing diagnostico',
  // Editar es CORTA a propósito: la herramienta la eligen las palabras del mensaje («tema», «dominio», «sección»). Medido
  // el 15/10/2026 con el turno que corre: una lista larga («cambiar texto sección bloque enlace tema dominio…») sumaba
  // puntos parejos a las 40 del editor, las grandes llenaban los 12.000 caracteres y 4 de los 6 pedidos de la prueba
  // llegaban sin su herramienta; con «landings creadas», los 6 con la suya y con `listar_landings_creadas` (el id).
  editar: 'landings creadas',
};

/** El voseo con tilde de estos verbos, en el texto CRUDO: se marca con «§» antes de normalizar (la tilde se pierde). */
const VOSEO_LANDING = /(^|[\s,.;:!¡¿?"'(])(publicá|despublicá|subí|creá|armá|hacé|generá|diseñá|montá|prepará|replicá|copiá|cloná|analizá|revisá|auditá|diagnosticá|evaluá|sacá|quitá|bajá|cambiá|agregá|añadí|poné|ocultá|escondé|mostrá|mové|borrá|eliminá|editá|traducí|duplicá|conectá|verificá|compartí|actualizá|modificá|reemplazá|corregí|arreglá|sumá|meté)(?=[\s,.;:!?"')]|$)/gi;
const PRON_LANDING = '(?:mela|melo|nosla|noslo|la|lo|las|los|me|nos)';
/** El verbo inequívoco: con la tilde marcada o con el pronombre pegado. */
const verboFuerte = (raices: string) => `\\b(?:${raices})(?:§|${PRON_LANDING}\\b)`;
/** La forma suelta: sólo al ARRANQUE, y no seguida de «de» («copia de la landing» es un sustantivo). */
const verboSuelto = (raices: string) => `^(?:${raices})\\b(?![\\s,]+de\\b)`;
const verboModal = (verbos: string) => `\\b(?:puedes|podes|podrias|podras|puede|podria|quiero que|queria que|necesito que|quisiera que|te pido que)\\s+(?:me\\s+|nos\\s+|le\\s+)?(?:${verbos})(?:${PRON_LANDING})?\\b`;
const OBJETO_LANDING = '(?:landings?|landing ?pages?|paginas?|sitios?|webs?|presentacion(?:es)?)\\b';
const OBJETO_O_LINK = `(?:${OBJETO_LANDING}|https?:\\/\\/)`;
/** Otro objeto entre el verbo y la landing: el pedido es de esa otra cosa. */
const OTRO_QUE_LANDING = '(?:anuncios?|campanas?|posts?|reels?|historias?|stor(?:y|ies)|e-?mails?|correos?|mails?|videos?|guion(?:es)?|copys?|automatizacion(?:es)?|flujos?|reunion(?:es)?|llamadas?|tareas?|imagen(?:es)?|creativos?|banners?|logos?|leads?|links?|enlaces?|urls?)\\b';
const SEP_LANDING = '[\\s,.:;!¡¿?"\'()-]+';
/** El objeto a ≤3 palabras del verbo, sin otro objeto en el medio. */
const hastaObjeto = (obj: string) => `(?:${SEP_LANDING}(?!${OTRO_QUE_LANDING})\\S+?){0,3}?${SEP_LANDING}${obj}`;
const pedidoDe = (alternativas: string[], obj: string) => new RegExp(`(?:${alternativas.join('|')})${hastaObjeto(obj)}`);

const PEDIDO_DESPUBLICAR = pedidoDe([
  verboFuerte('despublica'), verboSuelto('despublica'), verboModal('despublicar|despubliques|despublique'),
  `\\b(?:da|dale|dar)${SEP_LANDING}de${SEP_LANDING}baja`,
], OBJETO_LANDING);
/** «sacá / sácala / quitá … de internet»: despublicar, si nombra la landing en algún lado. */
const SACAR_DE_INTERNET = new RegExp(`\\b(?:saca|quita|baja|sacar|quitar|bajar|saques|quites|bajes)(?:§|${PRON_LANDING})?(?:${SEP_LANDING}\\S+?){0,3}?${SEP_LANDING}de${SEP_LANDING}(?:internet|linea|la web)\\b`);
const NOMBRA_LANDING = new RegExp(`\\b${OBJETO_LANDING}`);
const PEDIDO_PUBLICAR = pedidoDe([
  verboFuerte('publica|sube|subi'), verboSuelto('publica|sube'), verboModal('publicar|publiques|publique|subir|subas|suba'),
], OBJETO_LANDING);
const PEDIDO_REPLICAR = pedidoDe([
  verboFuerte('replica|copia|clona'), verboSuelto('replica|copia|clona'), verboModal('replicar|copiar|clonar|repliques|copies|clones'),
], OBJETO_O_LINK);
const PEDIDO_ANALIZAR = pedidoDe([
  verboFuerte('analiza|revisa|audita|diagnostica|evalua'), verboSuelto('analiza|revisa|audita|diagnostica|evalua'),
  verboModal('analizar|revisar|auditar|diagnosticar|evaluar|analices|revises|audites|diagnostiques|evalues'),
  // «hazle un diagnóstico a mi landing» (con «le»): la verificación de la tanda 7 lo midió sin herramienta.
  `\\b(?:haz|hazme|haznos|hazle|hazles|haceme|hacele|hace§|haganle|dame|quiero|necesito|quisiera)${SEP_LANDING}(?:un|una|el|la)${SEP_LANDING}(?:diagnostico|analisis|auditoria|revision)\\b`,
], OBJETO_O_LINK);
const PEDIDO_CREAR = pedidoDe([
  verboFuerte('crea|arma|hace|genera|disena|monta|prepara|haz'), `\\bhaz\\b`,
  verboSuelto('crea|arma|genera|disena|monta|prepara'),
  verboModal('crear|armar|hacer|generar|disenar|montar|preparar|crees|armes|hagas|generes|disenes|montes|prepares'),
], OBJETO_LANDING);
/** «quiero / necesito una landing…»: el objeto pegado (con «una mano con la landing» no es crear nada). */
const QUIERO_UNA_LANDING = new RegExp(`\\b(?:quiero|necesito|quisiera|queria)${SEP_LANDING}(?:un|una|otra|otro)${SEP_LANDING}(?:nueva${SEP_LANDING}|nuevo${SEP_LANDING})?${OBJETO_LANDING}`);

// ── Editar (ver la cabecera del bloque) ──
/** Con «le»/«les»: «ponle», «cámbiale», «agrégale». */
const PRON_EDITAR = '(?:mela|melo|nosla|noslo|selo|sela|les|le|las|los|la|lo|me|nos)';
const RAICES_EDITAR = 'cambia|agrega|anade|anadi|pon|pone|quita|saca|oculta|esconde|escondi|mueve|move|borra|elimina|edita|traduce|traduci|duplica|conecta|verifica|comparte|comparti|sube|subi|actualiza|modifica|reemplaza|corrige|corregi|arregla|suma|mete|crea|arma';
const MODAL_EDITAR = 'cambiar|agregar|anadir|poner|quitar|sacar|ocultar|esconder|mostrar|mover|borrar|eliminar|editar|traducir|duplicar|conectar|verificar|compartir|subir|actualizar|modificar|reemplazar|corregir|arreglar|sumar|meter|crear|armar'
  + '|cambies|agregues|anadas|pongas|quites|saques|ocultes|escondas|muestres|muevas|borres|elimines|edites|traduzcas|dupliques|conectes|verifiques|compartas|subas|actualices|modifiques|reemplaces|corrijas|arregles|sumes|metas|crees|armes';
/** Una pieza de la landing (o la landing misma). */
const PIEZA_LANDING = '(?:landings?|landing ?pages?|paginas?|sitios?|webs?|presentacion(?:es)?|secci(?:on|ones)|titular(?:es)?|titulos?|subtitulos?|botone?s?|formularios?|temas?|dominios?|videos?|vsl|agendas?|calendario|links?|enlaces?|textos?|imagen(?:es)?|fotos?|colores?|fuentes?|tipografias?|precios?|testimonios?|preguntas|faq|bloques?|encabezado|portada|hero|pie|footer|menu|logo|cta|direccion)\\b';
/** Un objeto de OTRA área: entre el verbo y la pieza, o justo después de ella («el titular del anuncio»). */
const OTRO_QUE_EDITAR = '(?:anuncios?|campanas?|posts?|publicacion(?:es)?|reels?|historias?|stor(?:y|ies)|e-?mails?|correos?|mails?|guion(?:es)?|copys?|automatizacion(?:es)?|flujos?|reunion(?:es)?|llamadas?|tareas?|creativos?|banners?|flyers?|disenos?|leads?|notas?|etiquetas?|etapas?|closer|setter|grupos?|chats?)\\b';
const ART = `(?:${SEP_LANDING}(?:el|la|los|las|mi|mis|tu|tus|su|sus|este|esta|ese|esa))?`;
const NO_DE_OTRO = `(?!${SEP_LANDING}(?:de|del|para|en)${ART}${SEP_LANDING}${OTRO_QUE_EDITAR})`;
const PEDIDO_EDITAR = new RegExp(`(?:${[
  `\\b(?:${RAICES_EDITAR})(?:§|${PRON_EDITAR}\\b)`, `\\bmostra§`,
  `^(?:${RAICES_EDITAR}|muestra)\\b(?![\\s,]+de\\b)`,
  `\\b(?:puedes|podes|podrias|podras|puede|podria|quiero que|queria que|necesito que|quisiera que|te pido que)\\s+(?:me\\s+|nos\\s+|le\\s+)?(?:${MODAL_EDITAR})(?:${PRON_EDITAR})?\\b`,
].join('|')})(?:${SEP_LANDING}(?!${OTRO_QUE_EDITAR})\\S+?){0,3}?${SEP_LANDING}${PIEZA_LANDING}${NO_DE_OTRO}`);
/** «la página de Facebook» no es una landing; y lo que diga un link no nombra nada. */
const PAGINA_DE_REDES = /\bpaginas? (?:de|del|en) (?:facebook|fb|instagram|ig|tiktok|linkedin|youtube)\b|\bfan ?pages?\b/g;
const nombraLaLanding = (n: string): boolean => NOMBRA_LANDING.test(n.replace(/https?:\/\/\S+/g, ' ').replace(PAGINA_DE_REDES, ' '));

/** ¿Le pide a MaKo algo sobre una landing del Web Generator? Recibe el texto CRUDO de la persona. */
export function esPedidoDeLanding(texto: string): PedidoDeLanding | null {
  const crudo = (texto || '').trim();
  if (!crudo || crudo.length > 1500) return null;
  const n = norm(crudo.replace(VOSEO_LANDING, (_m, antes: string, verbo: string) => `${antes}${norm(verbo)}§`))
    .replace(PRELUDIO_CRM, '').trim();
  if (!n || ARRANCA_PREGUNTANDO.test(n) || ES_DEL_PLAN.test(n)) return null;
  if (PEDIDO_DESPUBLICAR.test(n) || (SACAR_DE_INTERNET.test(n) && NOMBRA_LANDING.test(n))) return { tipo: 'despublicar' };
  if (PEDIDO_PUBLICAR.test(n)) return { tipo: 'publicar' };
  if (PEDIDO_REPLICAR.test(n)) return { tipo: 'replicar' };
  if (PEDIDO_ANALIZAR.test(n)) return { tipo: 'analizar' };
  if (PEDIDO_CREAR.test(n) || QUIERO_UNA_LANDING.test(n)) return { tipo: 'crear' };
  if (PEDIDO_EDITAR.test(n) && nombraLaLanding(n)) return { tipo: 'editar' };
  return null;
}

// ── EL PEDIDO SOBRE UN LEAD DEL CRM ─────────────────────────────────────────────
// EL CASO (08/10/2026, ws15). Joan, por audio, en el grupo de MaKo de una inmobiliaria: «Macu,
// anotá en el lead que llegó Nicolás lo que dijo Bright… Anotá en el lead Nicolás como una nota
// que ya tiene su propiedad con Remax y no quiere dar exclusiva. Solo agregá esa nota al lead
// Nicolás». La herramienta existe (`agregar_nota_lead`, y su descripción dice textual «úsala
// cuando el dueño diga "anota en X que…"»), pero el turno llegó con las tres del PLAN: «anotá»
// era «cargalo al plan» en TRES puertas a la vez —`PEDIDO_ANOTAR` acá, el `PLAN` del router
// (lib/mako-router.ts) y `esCargaDePlan` (lib/mako-doer-in.ts)—, y cuando Gemini dio 503 el
// mensaje se guardó crudo como borrador del plan. Martín: «le pidió que cargue una NOTA a ese
// lead y creó una tarea». Una hora antes, «okay, movelo a "calificado" dentro del CRM» había
// caído al default (`capturar`): «movelo» sin tilde no estaba en ninguna lista.
//
// ⚠️ NO ERA UN CASO SUELTO. Medido ese día con el turno real (clasificador + la selección de
// lib/doer-herramientas.ts): de 19 pedidos comunes del CRM —nota, mover de etapa, marcar
// calificado, asignar closer, poner una etiqueta— 17 llegaban SIN su herramienta. Sólo pasaban
// los que traen la tilde exacta («mové a Rosana…») que pide `ACCION_CUENTA_RE`. El registro
// tenía las operaciones; el clasificador no las dejaba llegar.
//
// La señal es el OBJETO, no el verbo: un verbo de pedido + algo que sólo vive en el CRM (un
// lead, su ficha, una nota, una etapa, «calificado», una etiqueta, el closer). La tercera
// persona («si el closer marca al lead…») se descarta como en el resto del archivo: la forma
// sin tilde y sin pronombre cuenta sólo si ARRANCA el mensaje, que es como se da una orden.
// Lo peor que deja equivocarse es una propuesta de más, que no se escribe sin el «sí».
//
// Todo se prueba contra el texto SIN tildes, salvo el voseo con tilde, que se mira en el crudo.

/** Lo que va delante de la orden y no cambia nada. «Macu» es como transcribe el audio «MaKo». */
const PRELUDIO_CRM = /^(?:[\s,.:;!¡¿?"'-]*(?:mako|maco|macu|che|porfa|por favor|oye|ey|hola|buenas|ok(?:ey|ay)?|dale|bueno|listo|perfecto|y)\b)*[\s,.:;!¡¿?"'-]*/;
/** Verbos de pedido con pronombre pegado: imperativo sí o sí (no hay tercera persona así). */
const VERBO_CRM_PEGADO = /\b(?:anota(?:le|lo|la)|apunta(?:le|lo|la)|agrega(?:le|lo|la|les)|suma(?:le|lo|la)|deja(?:le|lo|la)|pone(?:le|lo|la|les|los|las)|ponle|ponlo|ponla|carga(?:le|lo|la)|escribi(?:le)|guarda(?:le|lo|la)|registra(?:le|lo|la)|move(?:lo|la|los|las)|mueve(?:lo|la|los|las)|pasa(?:lo|la|los|las)|lleva(?:lo|la|los|las)|marca(?:lo|la|le|los|las)|asigna(?:le|lo|la)|etiqueta(?:lo|la)|califica(?:lo|la)|descarta(?:lo|la)|cambia(?:le|lo|la)|saca(?:le|lo|la)|quita(?:le|lo|la))\b/;
/** Voseo con tilde (en el texto CRUDO): «anotá», «mové», «marcá». */
const VERBO_CRM_TILDE = /(?:^|[\s,.;:!¡¿?"'(])(?:anotá|apuntá|agregá|sumá|dejá|poné|cargá|escribí|guardá|registrá|mové|pasá|llevá|marcá|asigná|calificá|descartá|cambiá|sacá|quitá)(?=[\s,.;:!?"')]|$)/i;
/** La forma suelta (tuteo o voseo sin tilde): sólo cuenta si es lo PRIMERO del mensaje. */
const VERBO_CRM_SUELTO = /^(?:anota|apunta|agrega|suma|deja|pone|pon|carga|escribe|guarda|registra|mueve|move|pasa|lleva|marca|asigna|califica|descarta|cambia|saca|quita)\b/;
/** Algo que sólo vive en el CRM. */
const OBJETO_CRM = /\b(?:leads?|ficha|crm|historial|notas?|comentario|etapas?|columna|embudo|funnel|pipeline|calificad[oa]s?|descartad[oa]s?|ganad[oa]s?|perdid[oa]s?|etiquetas?|closer|setter|prospectos?|seguimiento \d|pre ?listing|en revision|nutricion manual|asisti(?:o|eron|da|do)?|productos?)\b/;
/** Mover a un lugar: «movelo a calificado», «pasalo a pre listing», «ponelo en descartado». */
const MOVER_A = /\b(?:move|mueve|pasa|lleva|pone)(?:lo|la|los|las)\s+(?:a|al|en|como|hacia)\s+(?!limpio\b)\S/;
/** Dar de alta: «me agregás a lead a German», «cargalo como lead», «creá un lead con…».
 *  (`agregas`, segunda persona: es como pide quien no usa el imperativo, ws11, 07/10/2026). */
const ALTA_LEAD = /\b(?:agrega|agregas|agregame|agregalo|agregala|carga|cargas|cargame|cargalo|cargala|crea|crealo|creala|suma|sumalo|sumala|mete|metelo|metela|registra|registralo)\b[^.\n]{0,25}?\b(?:a|como|un|una|nuevo|nueva)\s+(?:un\s+|nuevo\s+|nueva\s+)?lead\b/;
/** Los verbos de ANOTAR: con un lead de objeto, lo que piden es una nota aunque no la nombren
 *  («anotá en el lead de Rosana que no atendió»). */
const VERBO_NOTA = /\b(?:anota|apunta|escribi|escribe|registra|deja|suma)(?:le|lo|la)?\b/;
/** Lo que es del PLAN aunque nombre un lead: «anotá en el plan que llame al lead». */
const ES_DEL_PLAN = /\b(?:(?:al|el|mi|en el) plan|a la lista|tareas?|pendientes?|recordame|recuerdame|anotame|apuntame|no me olvide)\b|\bnotas? de voz\b/;

export type PedidoSobreLead = { tipo: 'nota' | 'etapa' | 'calificado' | 'etiqueta' | 'asignar' | 'alta' };

/** Lo que suma cada tipo a la relevancia del presupuesto: pone primero su herramienta. */
export const RELEVANCIA_CRM: Readonly<Record<PedidoSobreLead['tipo'], string>> = {
  nota: 'agregar nota lead historial notas',
  etapa: 'cambio etapa mover lead producto',
  calificado: 'marcar calificado asistencia lead',
  etiqueta: 'etiqueta lead poner sacar',
  asignar: 'asignar closer setter lead',
  alta: 'proponer lead nuevo alta crear cargar',
};

/**
 * ¿Le pide a MaKo hacer algo sobre un lead del CRM? Puro: lo usan el clasificador, el router
 * (lib/mako-router.ts) y `esCargaDePlan` (lib/mako-doer-in.ts), para que las tres puertas
 * digan lo mismo. Recibe el texto crudo; null si no es un pedido sobre un lead.
 */
export function esPedidoSobreLead(texto: string): PedidoSobreLead | null {
  const crudo = sinPrefijoDeLote(texto || '').trim();
  if (!crudo || crudo.length > 600) return null;
  const n = norm(crudo);
  if (ES_DEL_PLAN.test(n)) return null;
  // Un volcado sigue siendo material: «Idea: que el lead se mueva solo…», una lista de cosas.
  if (ENCABEZADO_VOLCADO.test(crudo) || INFINITIVO_TITULO.test(crudo) || esLista(crudo)) return null;
  const arranque = n.replace(PRELUDIO_CRM, '');
  // El alta va antes: «me agregás a lead…» no trae un imperativo, y es inequívoca.
  if (ALTA_LEAD.test(n) && !/\b(?:notas?|comentario|historial)\b/.test(n)) return { tipo: 'alta' };
  const verbo = VERBO_CRM_PEGADO.test(n) || VERBO_CRM_TILDE.test(crudo) || VERBO_CRM_SUELTO.test(arranque);
  if (!verbo) return null;
  if (!OBJETO_CRM.test(n) && !MOVER_A.test(n)) return null;
  if (/\b(?:notas?|comentario|historial)\b/.test(n)) return { tipo: 'nota' };
  if (/\betiquetas?\b/.test(n)) return { tipo: 'etiqueta' };
  if (/\b(?:closer|setter)\b/.test(n)) return { tipo: 'asignar' };
  if (/\bmarca/.test(n) && /\bcomo\b/.test(n)) return { tipo: 'calificado' };
  if (VERBO_NOTA.test(arranque) && !MOVER_A.test(n)) return { tipo: 'nota' };
  return { tipo: 'etapa' };
}

// ── EL PEDIDO DE UN COBRO (Stripe y Mercado Pago) ───────────────────────────────
// La pasarela de pagos (11/10/2026, docs/diseno-pasarela-pagos.md) sumó el área `cobros` al
// registro. Medido ese día con tsx sobre este clasificador, ANTES de esta regla: «mandale un link
// de pago a Ana», «reembolsale el pago a Carlos» y «creá un checkout de Mercado Pago para Laura»
// salían `capturar`, dudosas y sin ningún área; «generá el link de pago… para Juan» igual; y
// «cancelá la suscripción de Pedro» salía `actuar` (por la tilde de «cancelá») pero sin áreas.
// Ninguna llegaba con su herramienta.
//
// Es la lección del pedido sobre un lead: LA SEÑAL ES EL OBJETO (un link de pago, un checkout,
// un reembolso, una suscripción) más un verbo de pedido, con la misma regla para la tercera
// persona (la forma suelta sólo si ARRANCA el mensaje). Lo comparten las tres puertas: este
// clasificador, el router (lib/mako-router.ts) y `esCargaDePlan` (lib/mako-doer-in.ts).

/** El objeto «link de pago»: un link, un checkout, cobrar por una pasarela. */
const OBJETO_LINK_PAGO = /\blinks? (?:de|para) (?:pago|cobro|pagar)\b|\bcheckout\b|\blinks? de (?:stripe|mercado ?pago)\b/;
const NOMBRA_PASARELA = /\b(?:stripe|mercado ?pago)\b/;
/** Devolver plata: «reembolsale», «el reembolso», «devolvele la plata», «hacele la devolución». */
const OBJETO_REEMBOLSO = /\breembols\w*|\bdevolucion(?:es)?\b|\b(?:devolve|devuelve)\w* (?:el|la|su|los|sus) (?:pagos?|cobros?|plata|dinero)\b/;
const OBJETO_SUSCRIPCION = /\bsuscripci(?:on|ones)\b/;
/** Dar de baja: «cancelá», «dale de baja», «cortale», «anulá». */
const VERBO_BAJA = /\b(?:cancel\w*|de baja|cort\w*|anul\w*|deten\w*|fren\w*)\b/;
const VERBO_ANULAR = /\banul\w*/;
/** Verbo con pronombre pegado: imperativo sí o sí. */
const VERBO_COBRO_PEGADO = /\b(?:manda|envia|pasa|carga|genera|crea|arma|hace|reembolsa|devolve|devuelve|cancela|anula|corta|cobra)(?:le|les|me|selo|sela|selos|melo|mela|lo|la)\b|\bhazle\b|\bdale de baja\b/;
/** Voseo con tilde (en el texto CRUDO): «mandá», «generá», «creá», «cancelá». */
const VERBO_COBRO_TILDE = /(?:^|[\s,.;:!¡¿?"'(])(?:mandá|enviá|pasá|cargá|generá|creá|armá|hacé|reembolsá|devolvé|cancelá|anulá|cortá|cobrá)(?=[\s,.;:!?"')]|$)/i;
/** La forma suelta (tuteo o voseo sin tilde): sólo si es lo PRIMERO del mensaje. */
const VERBO_COBRO_SUELTO = /^(?:manda|envia|pasa|carga|genera|crea|arma|haz|hace|reembolsa|devuelve|devolve|cancela|anula|corta|cobra|da de baja)\b/;
/** Con un modal: «necesito mandarle un link de pago», «¿me puedes generar el checkout?». */
const MODAL_COBRO = /\b(?:puedes|podes|podrias|quiero|queria|necesito|hay que|vamos a|tenes que|tienes que)\s+(?:me\s+|le\s+|nos\s+)?(?:mandar|enviar|pasar|generar|crear|armar|hacer|reembolsar|devolver|cancelar|anular|cortar|cobrar|dar de baja)(?:le|les|me|selo|sela|lo|la)?\b/;
/** La segunda persona de quien no usa el imperativo: «¿le mandas el link de pago a Ana?». */
const SEGUNDA_COBRO = /\b(?:le|les|me)\s+(?:mandas|envias|pasas|generas|creas|armas|haces|reembolsas|devolves|devuelves|cancelas|anulas)\b/;
/** Lo que es del PLAN aunque nombre un cobro. Sin «pendiente», a diferencia de `ES_DEL_PLAN`:
 *  «anulá el link de pago pendiente de Ana» es un cobro, no una tarea. */
const DEL_PLAN_COBRO = /\b(?:(?:al|el|mi|en el) plan|a la lista|tareas?|recordame|recuerdame|anotame|apuntame|no me olvide)\b/;

export type PedidoDeCobro = { tipo: 'link' | 'anular' | 'reembolso' | 'suscripcion' };

/** Lo que suma cada tipo a la relevancia del presupuesto: pone primero su herramienta (y, en
 *  un link, `listar_productos`, que da el productoId). */
export const RELEVANCIA_COBROS: Readonly<Record<PedidoDeCobro['tipo'], string>> = {
  link: 'crear link pago cobro listar productos catalogo ofertas precio',
  anular: 'anular link pago cobro listar cobros',
  reembolso: 'reembolsar cobro listar cobros pagado devolver',
  suscripcion: 'cancelar suscripcion cobro listar cobros',
};

/** Las áreas de cada tipo. Un link necesita además el CRM: el productoId sale de
 *  `listar_productos` (área crm), y sin ella el modelo no tiene con qué pedirlo. */
export const AREAS_COBROS: Readonly<Record<PedidoDeCobro['tipo'], Area[]>> = {
  link: ['cobros', 'crm'],
  anular: ['cobros'],
  reembolso: ['cobros'],
  suscripcion: ['cobros'],
};

/**
 * ¿Le pide a MaKo un cobro por Stripe o Mercado Pago (un link de pago, anularlo, un reembolso,
 * cancelar una suscripción)? Puro: lo usan el clasificador, el router y `esCargaDePlan`. Recibe
 * el texto crudo; null si no es un pedido de cobro.
 */
export function esPedidoDeCobro(texto: string): PedidoDeCobro | null {
  const crudo = sinPrefijoDeLote(texto || '').trim();
  if (!crudo || crudo.length > 600) return null;
  const n = norm(crudo);
  if (DEL_PLAN_COBRO.test(n)) return null;
  // Un volcado sigue siendo material: «Idea: links de pago automáticos», una lista de cosas.
  if (ENCABEZADO_VOLCADO.test(crudo) || INFINITIVO_TITULO.test(crudo) || esLista(crudo)) return null;
  const arranque = n.replace(PRELUDIO_CRM, '');
  const verbo = VERBO_COBRO_PEGADO.test(n) || VERBO_COBRO_TILDE.test(crudo) || VERBO_COBRO_SUELTO.test(arranque) || MODAL_COBRO.test(n) || SEGUNDA_COBRO.test(n);
  if (!verbo) return null;
  if (OBJETO_REEMBOLSO.test(n)) return { tipo: 'reembolso' };
  if (OBJETO_SUSCRIPCION.test(n) && VERBO_BAJA.test(n)) return { tipo: 'suscripcion' };
  const link = OBJETO_LINK_PAGO.test(n) || (NOMBRA_PASARELA.test(n) && /\bcobr/.test(n));
  if (link && VERBO_ANULAR.test(n)) return { tipo: 'anular' };
  if (link || OBJETO_SUSCRIPCION.test(n)) return { tipo: 'link' };
  return null;
}

// ── Señales ──────────────────────────────────────────────────────────────────

const norm =(s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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
const IMPERATIVO_VOSEO = new RegExp(
  '\\b(' +
  // a) voseo con tilde
  'investigá|analizá|revisá|buscá|armá|escribí|redactá|compará|evaluá|calculá|resumí|proponé|sugerí|decí|mostrá|pasá|traé|explicá|ayudá|mandá|mirá|andá|hacé|fijate' +
  ')(?=[\\s,.;:!?]|$)',
  'i',
);
// ⚠️ ESTO SE PRUEBA CONTRA EL TEXTO SIN TILDES, y el voseo de arriba contra el crudo.
// EL CASO 08-T13 (llamada del 8/9/2026). Mauricio: «A Maco yo le dije, Maco, haz un
// reporte tal, tal, y ni siquiera me responde». Mauricio es mexicano y escribe en TUTEO:
// «haz», «hazme», «muéstrame», «mándame». El imperativo de acá solo conocía el voseo, así
// que «haz un reporte de mis resultados…» caía al default —capturar, dudosa— y MaKo
// tenía en la mesa SOLO las tres tools del plan: ni un número posible. Y «muéstrame» no
// matcheaba «muestrame» por la tilde: `\w` no incluye la «é».
// Entran solo formas que NO son tercera persona: «haz» (la tercera es «hace»), «pon»
// («pone»), y todo lo que lleva el pronombre pegado. «Revisa», «genera» o «prepara» sin
// pronombre siguen afuera, por la misma razón que el voseo exige la tilde.
const IMPERATIVO_TUTEO = new RegExp(
  // b) con pronombre pegado — imperativo sí o sí (voseo o tuteo)
  '\\b\\w*(?:decime|contame|mostrame|pasame|dame|buscame|armame|escribime|haceme|hazme|revisame|analizame|investigame|traeme|explicame|ayudame|mandame|enviame|proponeme|sugerime|calculame|resumime|cuentame|muestrame|dimelo|dime|ponme|generame|preparame)\\b|' +
  '\\b(?:investigalo|analizalo|armalo|revisalo|buscalo|escribilo|resumilo|comparalo|hacelo|hazlo|mostralo|pasalo|mandalo|envialo|ponlo|generalo|preparalo)\\b|' +
  // c) tuteo irregular de una sílaba: su tercera persona es otra palabra
  '\\b(?:haz|pon)\\b',
  'i',
);
/** ¿Hay un imperativo dirigido a MaKo? Recibe el texto crudo y normaliza adentro. */
const IMPERATIVO = { test: (s: string): boolean => IMPERATIVO_VOSEO.test(s) || IMPERATIVO_TUTEO.test(norm(s)) };

/**
 * Un PEDIDO DE DATOS sin forma de pregunta: «un reporte de mis resultados de junio»,
 * «quiero ver mis números del mes». Es una consulta —pide lo que MaKo tiene— y tiene que
 * llegar con las tools de métricas en la mesa. Sin esto caía al default (capturar) y se
 * guardaba como una idea (08-T13). Se prueba contra el texto sin tildes.
 */
// ⚠️ `[^.\n]`, NO `.`: sin cruzar oraciones. Con `.` un volcado de 3060 caracteres del dueño
// («…reportes. Por ejemplo, ayer estuvimos viendo con Mauricio y este mes…») se leía como
// un pedido de datos. Medido sobre los 143 mensajes reales de mako_doer_conv.
const PEDIDO_DATOS = /\b(reportes?|informes?|resumen(es)?|balances?)\b[^.\n]{0,60}\b(resultados?|numeros|metricas|ventas|leads?|cierres?|agendas?|inversion|marketing|campanas?|anuncios?|trimestre|(ultim[oa]s?|este|pasad[oa]) (mes(es)?|semanas?|ano)|mes pasado|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b|\b(mis|nuestros|los) (resultados|numeros|metricas)\b/;
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


// ⚠️ La lista se AMPLÍA, no se reescribe. Le faltaban las aperturas rioplatenses
// («opa», «che», «ola») y las palabras con las que alguien PRUEBA un canal nuevo
// («test», «prueba», «probando», «ping»).
//
// EL CASO (2026-08-24): un cliente estrenó su grupo escribiendo «OPA». No matcheó
// acá, así que cayó al default de más abajo —`capturar`, con la tool OBLIGATORIA—
// y MaKo le contestó «No pude armar el borrador con eso». Se le estaba pidiendo
// parir una tarea de un saludo de tres letras. La regla existía y le faltaba una
// palabra: por eso se suma acá y no se escribe una regla nueva al lado.
/** El vocabulario del saludo, UNA vez: lo usan el detector y el pelador.
 *  Dos listas se separan, y acá ya pasó: el SALUDO del router incluye `mako` y
 *  el de acá no, que es por lo que «hola mako, cómo venimos» cayó en charlar. */
const SALUDOS = 'hola|ola|holis|opa|buenas|buen[oa]s|buen d[ií]a|hey|ey|che|qu[eé] tal|c[oó]mo (and|est|va)|todo bien|gracias|mil gracias|genial|joya|b[aá]rbaro|buen[ií]simo|jaja|abrazo|saludos|chau|nos vemos|buen finde|test|prueba|probando|ping';
const SALUDO = new RegExp(`^[\s¡!¿?]*(${SALUDOS})(?![a-záéíóúñ])`, 'i');
const SOLO_EMOJI = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}!?.]+$/u;

// Interrogativos: al ARRANQUE («¿cuántos leads…?») o después de un imperativo
// («decime cuántos leads…»). El segundo caso importa por costo: sin él, cada
// «decime…» se clasificaba como 'pensar' y se iba a Opus para leer un número.
/** Pregunta directa: arranca con un interrogativo, o termina en «?». */
/**
 * ⚠️ `cu[aá]nt` ERA CÓDIGO MUERTO: el lookahead lo hacía imposible.
 *
 * `(?![a-záéíóúñ])` exige que después no venga una letra, y en español después de
 * «cuánt» SIEMPRE viene una: cuántos, cuántas, cuánto. O sea que esa alternativa no
 * matcheó nunca, y «cuantas agendas tengo» sin signo de pregunta no era una pregunta
 * para el clasificador — se iba a `capturar`, o sea a anotarse como una TAREA.
 *
 * Y es la forma que más usa el cliente que se quejó: «cuantas agendas tengo?»,
 * «Cuantad agendas vamos?», «cuantas llamadas tenemos agendaas esta semana?». En
 * WhatsApp el signo de apertura no lo escribe nadie. `INTERROGATIVO`, veinte líneas
 * más abajo, lo tiene bien desde siempre (`cu[aá]nt[oa]s?`): eran dos escrituras de
 * la misma regla y sólo una se arregló.
 */
const PREGUNTA = /^[\s¡!¿?]*(qu[eé]|cu[aá]nt[oa]s?|cu[aá]l|qui[eé]n|cu[aá]ndo|d[oó]nde|c[oó]mo|por\s?qu[eé]|hay|tengo|ten[eé]s)(?![a-záéíóúñ])|\?\s*$/i;

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

// ── EL PEDIDO DE AGENDA ──────────────────────────────────────────────────────
// EL CASO (08/10/2026, ws13). «Mako, agenda me una reunión mañana 12hs de 1hs que se llame
// PRUEBA» se clasificó `capturar` (dudosa): «agenda» sin tilde y el pronombre separado no
// son ninguno de los imperativos de arriba, y no es una pregunta. El turno llegó con dos
// herramientas del plan y MaKo contestó «por aquí no puedo agendarte». Medido con el código
// de ese día: 3 de las 5 frases de escritura del test de agenda tampoco llegaban con la
// herramienta («agendame…» y «pasá la visita…» caían en `pensar`, «moveme la cita…» en
// `capturar`), y el test daba verde porque armaba el turno sin pasar por acá.
//
// Es una regla APARTE de los imperativos porque la tilde que ellos exigen protege de la
// TERCERA persona dentro de un volcado de ideas («si el cliente cambia la reunión…»), y acá
// la protección es otra: un verbo de agenda + una reunión + un día o una hora, en un mensaje
// corto. Las tres juntas son un pedido; una idea dictada casi nunca trae día y hora. Y lo
// peor que deja equivocarse es una propuesta de más, que no se escribe sin el «sí».
//
// Todo se prueba contra el texto SIN tildes.
//
// «agenda» suelta es también el sustantivo («mi agenda de mañana»): cuenta como verbo sólo
// si no la precede un artículo o posesivo y la sigue un pronombre o un objeto.
const VERBO_AGENDAR = /(?<!\b(?:mi|tu|su|la|de|en|mis|tus|sus|una|esta)\s)\bagenda\s+(?:me|le|les|nos|una?|la|el|a)\b|\b(?:re)?agend(?:ame|ale|ales|ala|alo|alas|alos|anos)\b|\breagenda\b|\bprograma(?:me|la|le)\b/;
const VERBO_SOBRE_REUNION = /\b(?:crea(?:me|la|le)?|arma(?:me|la|le)?|pon(?:e|eme|ela|me|la|le)|mueve(?:la|lo|me)?|move(?:la|lo|me|las|los)|pasa(?:la|lo|me|las|los)?|cambia(?:la|lo|le|me|las|los)?|cancela(?:la|lo|me|las|los)?|borra(?:la|lo|me|las|los)?|elimina(?:la|lo|me|las|los)?|edita(?:la|lo|le)?|modifica(?:la|lo|le)?|suspende(?:la|lo)?|renombra(?:la|lo)?)\b/;
// Las formas con modal: es como pide un cliente que tutea («me puedes agendar…»).
const MODAL_AGENDA = /\b(?:puedes|podes|podrias|podras|puede|podria|quiero|queria|necesito|hay que|vamos a)\s+(?:me\s+|nos\s+|le\s+)?(?:re)?(agendar|crear|armar|poner|mover|pasar|cambiar|cancelar|borrar|eliminar|editar|modificar|programar|suspender|renombrar)(?:me|la|lo|le|nos|las|los)?\b/;
const SUSTANTIVO_AGENDA = /\b(?:reunion(?:es)?|visitas?|citas?|evento|llamadas?|turnos?|juntas?|meetings?|zoom)\b/;
const TIEMPO_AGENDA = /\b(?:hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|a las|a la una|semana que viene|proxima semana|esta (?:tarde|noche))\b|\b\d{1,2}(?::\d{2})?\s*(?:hs?|hrs?|horas?|am|pm)\b|\b\d{1,2}:\d{2}\b/;
const ARRANCA_PREGUNTANDO = /^(?:que|cuant[oa]s?|cual(?:es)?|quien(?:es)?|cuando|donde|como|por ?que|hay|tengo|tenes|tienes)\b/;
// Lo que se dice antes del pedido y no cambia nada: el nombre, un «che», un «porfa».
const PRELUDIO = /^(?:[\s,.:;!¡¿?-]*(?:mako|che|porfa|por favor|oye|ey|hola|buenas)\b)*[\s,.:;!¡¿?-]*/;

/**
 * Lo que escribió la persona en un LOTE, sin el encabezado que le pone el doer
 * (`unirMensajes`, lib/mako-doer-buffer.ts: «[Te mandó 2 mensajes seguidos… carga TODAS las
 * tareas juntas…]» y los «(1) », «(2) »). Ese encabezado es nuestro: nombra «tareas»,
 * «juntas» y «conjunto», así que por sí solo sumaba las áreas plan, CRM y ads a cada lote y
 * gastaba el presupuesto de herramientas (medido el 08/10: con «(1) Mako (2) agendá una
 * reunión…», proponer_mover_reunion quedaba afuera). Un mensaje suelto pasa intacto.
 */
export function sinPrefijoDeLote(texto: string): string {
  const t = texto || '';
  if (!/^\[Te mandó \d+ mensajes seguidos\./.test(t)) return t;
  return t.replace(/^\[[^\]]*\]\s*/, '').replace(/(^|\n)\(\d+\) /g, '$1');
}

/** Otra tarea dictada en la misma línea: un infinitivo que arranca después de una coma, un
 *  punto o un punto y coma («…, llamar a…»). Sin tildes, como el resto. */
const OTRO_INFINITIVO = /[,;.]\s*(?:y\s+|tambien\s+|despues\s+|luego\s+)?[a-z]{2,}(?:ar|er|ir)\b/;

/** ¿Pide crear, mover, cambiar o cancelar una reunión? Recibe el texto sin tildes. */
function esPedidoAgenda(n: string): boolean {
  const t = n.replace(PRELUDIO, '').trim();
  if (!t || t.length > 260 || ARRANCA_PREGUNTANDO.test(t)) return false;
  const modal = MODAL_AGENDA.exec(t);
  const agendar = VERBO_AGENDAR.test(t) || /agendar$/.test(modal?.[1] ?? '');
  const sobre = VERBO_SOBRE_REUNION.test(t) || !!modal;
  const tiempo = TIEMPO_AGENDA.test(t);
  const reunion = SUSTANTIVO_AGENDA.test(t);
  // «Agendar reunión con Ana mañana a las 15», SOLO. El infinitivo es también como se dicta
  // una tarea, así que cuenta como orden con las dos —reunión y día u hora— y en UNA línea.
  // Dentro de un mensaje de varias líneas es material para el plan, como hasta hoy (decisión
  // del 09/10/2026: cargar tareas no pregunta nada); una lista ya la toma antes el dictado.
  // Medido ese día: suelto también caía al default (material, dudosa), no sólo en la lista.
  // ⚠️ Y una línea no es un pedido: un AUDIO dictado llega en UNA línea con comas («Agendar
  // reunión con Ana mañana a las 15, llamar a la inmobiliaria y subir las fotos»), y eso es
  // la misma lista sin saltos. Con otro infinitivo después de una coma o un punto, no es una
  // orden (medido por el revisor el 09/10: sin esto, esa tanda llegaba como agenda).
  if (/^(?:re)?agendar\b/.test(t) && !t.includes('\n') && reunion && tiempo && !OTRO_INFINITIVO.test(t)) return true;
  // «agendar» sólo quiere decir una cosa: con un día, una hora o una reunión alcanza.
  if (agendar && (tiempo || reunion)) return true;
  // «cambiá», «pasá», «cancelá» quieren decir muchas: hace falta la reunión, y además un
  // día u hora, o que el mensaje ARRANQUE con el verbo (ahí es una orden, no una idea).
  return sobre && reunion && (tiempo || VERBO_SOBRE_REUNION.test(t.slice(0, 14)) || /^(?:me |nos )?(?:puedes|podes|podrias)/.test(t));
}

/**
 * ¿Es la corrección de una propuesta de agenda? «no, movela al viernes a las 10», «no, mejor
 * a las 13», «sí, pero a las 11». Con una pendiente abierta la regla del «sí» se los quedaba
 * como confirmación (medido el 08/10): el turno llegaba con confirmar/cancelar y nada más, y
 * corregir la hora sólo cancelaba la propuesta.
 */
function corrigeAgenda(n: string, hayPendienteDeAgenda: boolean): boolean {
  if (!CONFIRMACION.test(n)) return false;
  const resto = n.replace(CONFIRMACION, '').replace(/^[\s,.:;!¡¿?-]+/, '');
  if (!resto || !TIEMPO_AGENDA.test(resto)) return false;
  return hayPendienteDeAgenda || VERBO_AGENDAR.test(resto) || VERBO_SOBRE_REUNION.test(resto);
}

// ── MOVER SIN DECIR QUÉ ─────────────────────────────────────────────────────────
// EL CASO (abierto el 08/10/2026 en docs/hallazgos-api-mako.md). «movela al viernes», sin
// pendiente ni agenda abierta, no nombra la reunión, y «movela» también se usa para una
// tarea del plan. Medido el 09/10 con el turno real: «movela al viernes» se leía como mover
// a un lead DE ETAPA (`MOVER_A` toma «al viernes» por una columna), sin `agenda_del_dia` y
// sin nada del plan; «cambiala para el jueves», «reprogramala para mañana» y «movela para
// mañana» caían al default (material, dudosa), sin ninguna herramienta que mueva nada.
//
// Decisión (Martín, 09/10/2026, «terminalo todo»): un pedido corto de mover a un día u hora
// sin objeto lleva a la vez la agenda y el plan, y si el modelo no puede saber cuál es,
// pregunta UNA vez «¿La reunión o la tarea?» — preguntar acá no es cargar tareas. La
// pregunta la pone lib/doer-herramientas.ts; acá sólo se reconoce el pedido y su respuesta.
// Se prueba contra el texto SIN tildes; con un objeto nombrado (la reunión, la tarea, un
// lead) no es esto: lo toman las reglas de agenda, del plan o del CRM.
const VERBO_MOVER = /^(?:move|mueve|pasa|cambia|corre|reprograma|posterga|adelanta|atrasa|patea)(?:(?:la|lo|las|los)\b|\s+(?:eso|esto|esa|ese|esta)\b)/;
/** Lo que va entre el verbo y el día: «al», «para el», «del jueves al». */
const HACIA = /^(?:\s*(?:para|pa|hasta|al?|el|del?|en)\b)*\s*/;
/** El destino ES un día o una hora, PEGADO al verbo. ⚠️ No alcanza con que el mensaje traiga un
 *  día: «pasalo a agendado para el lunes» mueve un lead a una ETAPA, y con TIEMPO_AGENDA en
 *  cualquier lado esta regla se lo quedaba y MaKo preguntaba «¿La reunión o la tarea?» por un
 *  lead (medido por el revisor el 09/10/2026: «movelo a contactado mañana», «pasala a no show
 *  hoy» y «movelo a seguimiento el lunes» también). Las etapas son de cada negocio: no hay
 *  lista de nombres que las cubra, así que se mira QUÉ viene después del verbo. */
const DESTINO_TIEMPO = /^(?:hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|(?:la )?(?:semana que viene|proxima semana)|esta (?:tarde|noche)|las? \d|la una|\d{1,2}(?::\d{2})?\s*(?:hs?|hrs?|horas?|am|pm)?\b)/;
const OBJETO_PLAN = /\b(?:tareas?|proyectos?|plan|deadline|quarter|pendientes?)\b/;
/** Lo que suma al presupuesto «la tarea»: buscarla y cambiarle la fecha. */
const RELEVANCIA_TAREA_FECHA = 'cambiar fecha deadline quarter tarea plan buscar';
/** Lo que suma un «movela al viernes»: reagendar, leer el día («qué tengo», el título de
 *  `agenda_del_dia`) y la tarea. Entran 15 de las ~100 de CRM y plan: medido el 09/10, con
 *  «buscar» y sin «tengo» la lectura del día quedaba afuera con «al viernes». */
const RELEVANCIA_MOVER = `${RELEVANCIA_AGENDA} que tengo fecha deadline tarea plan`;

/** ¿Pide mover algo a un día u hora sin decir qué? Recibe el texto CRUDO. Lo usa sólo el
 *  clasificador: lib/doer-herramientas.ts lee el veredicto (`mover`), no el texto otra vez. */
function esMoverSinObjeto(texto: string): boolean {
  const t = norm(sinPrefijoDeLote(texto || '')).replace(PRELUDIO_CRM, '').trim();
  if (!t || t.length > 80 || t.includes('\n')) return false;
  const verbo = VERBO_MOVER.exec(t);
  if (!verbo || !DESTINO_TIEMPO.test(t.slice(verbo[0].length).replace(HACIA, ''))) return false;
  return !SUSTANTIVO_AGENDA.test(t) && !OBJETO_PLAN.test(t) && !OBJETO_CRM.test(t);
}

/** La respuesta a «¿La reunión o la tarea?»: corta, y arranca nombrando una de las dos. Sólo se
 *  mira si MaKo hizo ESA pregunta (`preguntoReunionOTarea`, lib/doer-herramientas.ts). */
const RESPUESTA_REUNION = /^(?:(?:la|el|a la|al)\s+)?(?:reunion|cita|visita|evento|llamada|zoom|agenda)\b/;
const RESPUESTA_TAREA = /^(?:(?:la|el|a la|al)\s+)?(?:tarea|plan|proyecto)\b/;


// ── El clasificador ──────────────────────────────────────────────────────────

/**
 * Qué quiere el dueño en ESTE turno. Puro y sincrónico: no mira el historial a
 * propósito — el turno anterior es contexto de la charla, nunca material del
 * pedido, que es justo la confusión que produjo el bug.
 *
 * `hayPendientes` es lo único externo que entra, porque un «sí» pelado solo
 * significa algo si hay una propuesta esperando.
 */
/**
 * Saca el saludo del arranque —y el «mako» que suele venir pegado— y devuelve lo que
 * queda. Cadena vacía si no quedaba nada más que el saludo.
 */
function sinSaludoInicial(t: string): string {
  let r = t.trim();
  for (let i = 0; i < 4; i++) {
    const antes = r;
    r = r.replace(new RegExp(`^[\s¡!¿?]*(${SALUDOS})(?![a-záéíóúñ])`, 'i'), '');
    r = r.replace(/^[\s,.:;!¡¿?-]*mako(?![a-záéíóúñ])/i, '');
    r = r.replace(/^[\s,.:;!¡¿?-]+/, '');
    if (r === antes) break;
  }
  return r.trim();
}

/**
 * ¿El último mensaje de MaKo le PREGUNTÓ algo a la persona? Es la señal de que un «sí»
 * corto contesta un ofrecimiento. Desde el 08/10/2026 MaKo OFRECE la acción cuando
 * contesta una pregunta (decisión de Martín, «la ofrece») en vez de dejarla armada, así
 * que el «sí» que sigue es el pedido de hacerla. Mira el final: una pregunta al principio
 * de un mensaje largo no es un ofrecimiento.
 */
export function makoPreguntoAlgo(ultimoDeMako: string | null | undefined): boolean {
  const t = (ultimoDeMako ?? '').trim();
  if (!t) return false;
  return /\?/.test(t.slice(-280));
}

const NEGATIVA = /^[\s¡!¿?]*(no|nop|cancela|cancel[áa]|mejor no|dejalo|déjalo)(?![a-záéíóúñ])/i;

export function clasificarIntencion(
  texto: string,
  ctx: { hayPendientes?: boolean; hayPendienteDeAgenda?: boolean; hayMedia?: boolean; hayContacto?: boolean; hayAgendaAbierta?: boolean; makoPregunto?: boolean; preguntoReunionOTarea?: boolean } = {},
): VeredictoIntencion {
  const t = (texto || '').trim();
  const n = norm(t);
  // Se calcula una vez: lo miran la regla del «sí» (para NO quedárselo) y la de agenda. Sobre
  // lo que escribió la persona: el encabezado de un lote alarga el texto y no es de ella.
  const nPersona = norm(sinPrefijoDeLote(t));
  const pedidoAgenda = esPedidoAgenda(nPersona) || corrigeAgenda(nPersona, !!ctx.hayPendienteDeAgenda);
  const pedidoLead = esPedidoSobreLead(t);
  const pedidoCobro = esPedidoDeCobro(t);
  const pedidoLanding = esPedidoDeLanding(sinPrefijoDeLote(t));

  // 0) COMPARTIÓ UN CONTACTO. Va antes que todo porque no admite lectura: nadie
  //    comparte una tarjeta de contacto para que quede anotada como una idea.
  //    Es una persona, y una persona va al CRM.
  //
  //    Sin esta rama caía en el default («no hay señal clara → capturar») y el
  //    contacto de un lead terminaba de tarea en el plan — que es peor que el bug
  //    original, porque encima parecería que funcionó.
  if (ctx.hayContacto) {
    return { intencion: 'actuar', dudosa: false, porque: 'compartió una tarjeta de contacto: es un lead, no una nota' };
  }

  // 1) Un «sí» pelado con algo esperando. Va PRIMERO: es el turno más corto y el
  //    más fácil de confundir con un saludo.
  //
  //    ⚠️ Salvo que pida o corrija algo de la agenda: «cancelá la reunión de mañana a las 12»
  //    y «no, movela al viernes a las 10» arrancan con una palabra de CONFIRMACION, y con
  //    una pendiente abierta se leían como un «no» — el turno llegaba sin las herramientas
  //    de agenda y corregir una propuesta sólo la cancelaba (08/10/2026).
  if (ctx.hayPendientes && CONFIRMACION.test(t) && t.length <= 60 && !pedidoAgenda && !pedidoLead && !pedidoCobro && !pedidoLanding) {
    return { intencion: 'confirmar', dudosa: false, porque: 'confirmación con pendiente vigente' };
  }

  // 2) Pedido explícito de anotar. No hay ambigüedad posible… salvo que diga DÓNDE, y el
  //    dónde sea un lead: «anotá en el lead Nicolás que…» es una nota del CRM, no del plan
  //    (ver `esPedidoSobreLead`). Pasa de largo y lo toma la regla 3-quater.
  if (PEDIDO_ANOTAR.test(n) && !pedidoLead) {
    return { intencion: 'capturar', dudosa: false, porque: 'pidió anotarlo explícitamente' };
  }

  // 3) Saludo o emoji suelto, corto y sin nada más.
  //
  // ⚠️ «SIN NADA MÁS» LO DECÍA EL COMENTARIO Y NO LO MIRABA EL CÓDIGO: la condición
  // era un tope de 80 caracteres, que es un proxy del largo y no de «no pidió nada».
  //
  // EL CASO (01/10/2026, ws13). «hola mako, como venimos de reuniones los ultimos 15
  // dias» son 55 caracteres y arranca con «hola», así que entraba acá: `charlar`, cuyo
  // contrato es `tools: []`. O sea que la pregunta MÁS importante que hace ese cliente
  // —es una inmobiliaria de generación de leads, las agendas SON el producto— llegaba
  // al modelo sin una sola herramienta para mirar el CRM. Y de paso chocaba con el
  // router, que SÍ la había leído como un pedido de datos, y el turno entero reventó.
  //
  // Medido: el 22/09 «mako, como venimos de agendas…» NO cayó acá y se contestó bien.
  // La única diferencia era la palabra «hola» adelante.
  //
  // Se pela el saludo y se clasifica EL RESTO. `charlar` sólo si no quedó nada.
  if ((SALUDO.test(t) || SOLO_EMOJI.test(t)) && cuentaLinks(t) === 0) {
    const resto = SOLO_EMOJI.test(t) ? '' : sinSaludoInicial(t);
    if (!resto) return { intencion: 'charlar', dudosa: false, porque: 'saludo/charla' };
    // Sólo si de verdad se acortó, o esto no termina nunca.
    if (resto.length < t.length) {
      const v = clasificarIntencion(resto, ctx);
      return { ...v, porque: `${v.porque} (saludo adelante)` };
    }
  }

  // 3-bis-cobro) UN PEDIDO DE COBRO: un link de pago, anularlo, un reembolso, cancelar una
  //              suscripción (ver `esPedidoDeCobro`, que ya descarta los volcados y lo del plan).
  //              Va antes que lo que sigue: «sí, mandale el link de pago a Ana» después de una
  //              pregunta de MaKo y «cancelá la suscripción de Pedro» con una pendiente abierta son
  //              el pedido, no un «sí» ni un «no» (la regla 1 también lo deja pasar). Lleva sus
  //              áreas y su relevancia: ninguna de esas frases nombra al CRM ni a `listar_productos`.
  if (pedidoCobro) {
    return { intencion: 'actuar', dudosa: false, porque: `pedido de cobro (${pedidoCobro.tipo})`, areas: AREAS_COBROS[pedidoCobro.tipo], relevancia: RELEVANCIA_COBROS[pedidoCobro.tipo] };
  }

  // 3-bis) SIGUE UN PEDIDO DE AGENDA. El código le acaba de mostrar a la persona
  //        opciones de su agenda (los huecos de un día, las reuniones de un lead) y
  //        su respuesta es corta: «la de las 16», «a las 11», «el jueves». Sin esto
  //        caía en el default —material para anotar— y el turno llegaba sin las
  //        herramientas de agenda, con el modelo sin la lista (la agenda no pasa por
  //        él, lib/agenda-sin-ia.ts). Lo largo, una lista o un link siguen su camino:
  //        eso no es elegir una opción.
  if (ctx.hayAgendaAbierta && t.length <= 160 && !esLista(t) && cuentaLinks(t) === 0) {
    return { intencion: 'actuar', dudosa: false, porque: 'sigue un pedido de agenda: el sistema le acaba de mostrar opciones' };
  }

  // 3-ter) DICE QUE SÍ A LO QUE MaKo LE OFRECIÓ. Desde el 08/10/2026 MaKo, cuando contesta
  //        una pregunta, OFRECE la acción («¿Querés que pase a Rosana a Agendado?») en vez
  //        de dejarla armada, porque en consultar/pensar ya no viajan las herramientas de
  //        escritura (decisión de Martín, «la ofrece»). El «sí» que sigue es el pedido de
  //        hacerla, y tiene que llegar CON esas herramientas: `actuar`. Medido sobre HEAD
  //        antes de esto: «sí, hacelo» caía en `pensar` y «sí, movelo a agendado» en
  //        `charlar` (sin ninguna herramienta). Un «no» a lo ofrecido sigue siendo charla.
  //
  //        ⚠️ Y `sigueOfrecimiento`: «sí, dale» no nombra ningún área, así que las herramientas
  //        se eligen por el OFRECIMIENTO (lib/doer-herramientas.ts). Con sólo `actuar`, el «sí»
  //        a «¿te la agendo mañana a las 12?» llegaba sin ninguna herramienta de Google.
  if (ctx.makoPregunto && CONFIRMACION.test(t) && !NEGATIVA.test(t) && t.length <= 160 && !esLista(t)) {
    return { intencion: 'actuar', dudosa: false, porque: 'dice que sí a lo que MaKo le acaba de ofrecer', sigueOfrecimiento: true };
  }

  // 3-ter-bis) CONTESTA «¿La reunión o la tarea?» (ver `esMoverSinObjeto`). «la reunión» no trae
  //            verbo ni día: sin esto caía al default —material, dudosa— y el pedido que se
  //            acababa de aclarar llegaba sin ninguna herramienta para moverlo. Con
  //            `sigueOfrecimiento` las herramientas se eligen también por el pedido anterior.
  //            ⚠️ Sólo si MaKo hizo ESA pregunta, no cualquiera: con `makoPregunto` (que es
  //            verdad después de CUALQUIER «¿…?» de MaKo) «la agenda de mañana?» y «el plan de
  //            esta semana cómo va?» dejaban de ser consultas y llegaban como acciones, con las
  //            herramientas que escriben, contra la decisión del 08/10 de que en una pregunta
  //            MaKo OFRECE (medido por el revisor el 09/10/2026).
  if (ctx.preguntoReunionOTarea && t.length <= 60 && !t.includes('\n')) {
    const r = n.replace(PRELUDIO_CRM, '').replace(/^(?:no|nop)\b[\s,.:;!-]*/, '').trim();
    if (RESPUESTA_REUNION.test(r)) return { intencion: 'actuar', dudosa: false, porque: 'contesta que es la reunión', sigueOfrecimiento: true, areas: ['crm'], relevancia: RELEVANCIA_AGENDA };
    if (RESPUESTA_TAREA.test(r)) return { intencion: 'actuar', dudosa: false, porque: 'contesta que es la tarea', sigueOfrecimiento: true, areas: ['plan'], relevancia: RELEVANCIA_TAREA_FECHA, mover: 'tarea' };
  }

  // 3-ter-ter) MOVER A UN DÍA U HORA SIN DECIR QUÉ («movela al viernes»). Va antes del pedido
  //            sobre un lead, que lo tomaba como mover a un lead de etapa. Con una propuesta de
  //            agenda abierta es la reunión y no hay nada que preguntar; si no, viajan la
  //            agenda y el plan, y lib/doer-herramientas.ts pone la pregunta.
  if (esMoverSinObjeto(t)) {
    if (ctx.hayPendienteDeAgenda) return { intencion: 'actuar', dudosa: false, porque: 'mover sin decir qué, con una propuesta de agenda abierta: es la reunión', areas: ['crm'], relevancia: RELEVANCIA_AGENDA };
    return { intencion: 'actuar', dudosa: false, porque: 'mover a un día u hora sin decir qué: la reunión o la tarea', areas: ['crm', 'plan'], relevancia: RELEVANCIA_MOVER, mover: 'sin-decir-que' };
  }

  // 3-quater) UN PEDIDO SOBRE UN LEAD: una nota, una etapa, «calificado», una etiqueta, el
  //           closer (ver `esPedidoSobreLead`, que ya descarta los volcados y lo del plan).
  //           Va antes de la pregunta y del imperativo por lo mismo que el de agenda: «pasá a
  //           Nicolás a calificado» es un imperativo, y en `pensar` las herramientas que
  //           escriben no viajan. Lleva el área y su relevancia: «movelo a pre listing» no
  //           nombra el CRM, y sin la relevancia la acción queda afuera del presupuesto.
  if (pedidoLead) {
    return { intencion: 'actuar', dudosa: false, porque: `pedido sobre un lead del CRM (${pedidoLead.tipo})`, areas: ['crm'], relevancia: RELEVANCIA_CRM[pedidoLead.tipo] };
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

  // 5-bis) UN PEDIDO SOBRE UNA LANDING del Web Generator: publicarla, despublicarla, crearla, replicar una de afuera o
  //        analizarla (ver `esPedidoDeLanding`; tanda 7, 15/10/2026). Va DESPUÉS del dictado —«Publicar la landing del
  //        webinar» es una tarea dictada— y ANTES de los links sueltos (6): «replicá esta página https://…» es un link
  //        con una orden, y la 6 lo guardaba como material. Y antes de la automatización y de la agenda por lo mismo que
  //        ellas: «¿me puedes publicar la landing?» termina en «?». Lleva el área: «replicá https://…» no la nombra.
  if (pedidoLanding) {
    return { intencion: 'actuar', dudosa: false, porque: `pedido sobre una landing (${pedidoLanding.tipo})`, areas: ['landing'], relevancia: RELEVANCIA_LANDING[pedidoLanding.tipo] };
  }

  // 6) Solo links, sin una frase que diga qué hacer con ellos. Mandar un link
  //    pelado es guardarlo: si quisiera que MaKo lo mire, lo diría.
  if (links > 0 && !pedido && n.replace(/https?:\/\/\S+/g, '').trim().length < 60) {
    return { intencion: 'capturar', dudosa: false, porque: 'links sin instrucción: material para guardar' };
  }

  // 6-bis) Un pedido de CREAR una automatización («Pídeselo a MaKo» por WhatsApp, décima tanda; ver
  //        `esPedidoAutomatizacion`). Mismo lugar que la agenda y por lo mismo: «¿me podés armar un flujo…?» termina en
  //        «?» y «creame una automatización» caía en el default. Lleva el área y la relevancia de su herramienta.
  //        ⚠️ VA ANTES DE LA AGENDA (medido el 11/10/2026 con el turno que corre): «créame una automatización que le
  //        escriba a los que no vinieron a la REUNIÓN» es un verbo de crear + «reunión», y la agenda se lo llevaba —
  //        llegaba con las herramientas de Google Calendar y sin la de crear—. El pedido de automatización exige el
  //        sustantivo a tres palabras del verbo, así que «créame una reunión» sigue siendo de la agenda.
  if (esPedidoAutomatizacion(nPersona)) {
    return { intencion: 'actuar', dudosa: false, porque: 'pedido de crear una automatización', areas: ['chatbot'], relevancia: RELEVANCIA_AUTOMATIZACION };
  }

  // 6-bis-bis) Un pedido de CREAR un diseño del Image Editor (ver `esPedidoDiseno`): «creame un flyer…» caía en el
  //            default dudoso, sin herramientas. Lleva su área y su relevancia, como la automatización.
  if (esPedidoDiseno(nPersona)) {
    return { intencion: 'actuar', dudosa: false, porque: 'pedido de crear un diseño', areas: ['imagen'], relevancia: RELEVANCIA_DISENO };
  }

  // 6-ter) Un pedido de agenda: crear, mover, cambiar o cancelar una reunión (ver
  //        `esPedidoAgenda`). Va DESPUÉS del dictado —una lista o un «Idea:» siguen siendo
  //        material— y ANTES de la pregunta y del imperativo: «¿me podés agendar…?» termina
  //        en «?» y «agendame…» es un imperativo, y los dos se iban sin poder escribir.
  //        Lleva el área: «movela al viernes» no nombra el CRM.
  if (pedidoAgenda) {
    return { intencion: 'actuar', dudosa: false, porque: 'pedido de agenda: crear, mover, cambiar o cancelar una reunión', areas: ['crm'], relevancia: RELEVANCIA_AGENDA };
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
  // 8-bis) Pedido de datos sin forma de pregunta («un reporte de mis resultados de
  //        junio»). Va DESPUÉS del dictado (4-6): «Idea: un reporte de resultados para
  //        clientes» sigue siendo material para guardar. Ver PEDIDO_DATOS.
  //        Y solo en un mensaje CORTO: pedir un reporte es una línea, no un volcado.
  if (t.length <= 280 && PEDIDO_DATOS.test(n)) {
    return { intencion: 'consultar', dudosa: false, porque: 'pide un reporte o sus números' };
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
    return '\n\n_Lo dejé anotado. Si querías que lo investigue ahora, dime «investígalo» y lo hago._';
  }
  return '';
}

// ── De qué ÁREA de MaKo habla un mensaje ────────────────────────────────────────
// El doer ve siempre sus herramientas de siempre; las del registro de la API
// (lib/api-mako) se SUMAN solo para las áreas que el mensaje nombra. Mandarlas
// todas son ~150 esquemas por turno: se pasa del techo de entrada de Groq (7 k
// tokens) y cada turno de Claude paga miles de tokens de ruido.
//
// ⚠️ Es una tabla EN POSITIVO y sin fallback: un mensaje que no nombra ningún área
// lleva exactamente las herramientas de hoy, nunca «todas las acciones». Una
// adivinanza no puede sumar capacidades de escritura (es la misma regla que
// `toolsParaIntencion` aplica a la duda).

import type { Area } from './api-mako/tipos';

export const AREA_KEYWORDS: Readonly<Record<Area, RegExp>> = {
  general: /\b(objetivos?|metas? del (mes|trimestre)|kpis?|sem[aá]foro|c[oó]mo (voy|vamos|va el negocio)|trimestre)/i,
  // `visita`, `cita` y `calendario`: un negocio inmobiliario no agenda «reuniones», agenda
  // VISITAS, y sin esto «pasá la visita de Juan al viernes» no traía ni una tool de agenda
  // (07/10/2026). Y `reagend` aparte porque `\bagend` NO matchea «reagendá»: entre «re» y
  // «agend» no hay borde de palabra.
  // `evento` y «qué tengo hoy / a las 12»: es como se pregunta por el día en la agenda de
  // Google («Y a las 12hs que tengo?», ws13, 08/10/2026), y sin esto no viajaba agenda_del_dia.
  crm: /\b(leads?|contactos?|prospectos?|etapas?|funnel|embudo|agend|reagend|reuni[oó]n|visitas?|citas?|calendario|evento\b|qu[eé] tengo (?:hoy|ma[ñn]ana|el |esta|a las)|a las \d{1,2}\S* qu[eé] tengo|huecos?|horarios?\s+(?:\S+\s+){0,2}libres?|libres?\s+(?:el|la|este|esta|ma[ñn]ana|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b|disponibilidad|r1|r2|juntas?|calific|pipeline|ficha)/i,
  plan: /\b(tareas?|plan\b|tablero|proyectos?|checklist|deadline|perro guardi)/i,
  ads: /\b(campa[ñn]as?|anuncios?|ads\b|meta ads|presupuesto|adsets?|conjuntos?|creativos?|pauta|cpl|cpm|ctr|guion(es)? de anuncio)/i,
  // La bandeja unificada (14/10/2026): «quién me escribió», los chats sin responder, cerrar o posponer uno, y los DMs
  // de Instagram y Messenger, que no tienen otra área. «conversación» trae también la de WhatsApp: las dos contestan
  // (la de Chats junta los tres canales por contacto). «reabrir» y «posponer» atados a chat/conversación: solos son
  // de una tarea del Plan o de una reunión.
  chats: /\b(chats?\b|bandeja|conversaci[oó]n(es)?|sin responder|(?:qui[eé]n|qui[eé]nes) (?:me |nos )?(?:escribi[oó]|escribieron)|dms?\b|mensajes? directos?|messenger|(?:cerr|reabr|pospon)\w* (?:el |la |su |ese |esa |este |esta )?(?:chat|conversaci))/i,
  whatsapp: /\b(whatsapp|plantillas?|borrador(es)?|conversaci[oó]n|chat con|mensaje a)/i,
  email: /\b(e-?mails?|correos?|mails?|broadcasts?|newsletter|remitente|dominio de env)/i,
  // `automatización`, `automations` y `flujo` (décima tanda, 11/10/2026): desde el renombre de la tab a Automations,
  // «créame una automatización que…» no traía NINGUNA herramienta del área, y «Pídeselo a MaKo» por WhatsApp
  // (`crear_automatizacion_con_ia`) no llegaba al turno.
  chatbot: /\b(secuencias?|nutrici[oó]n|chatbot|bot\b|seguimiento autom|handoff|automatizaci[oó]n(es)?|automations?|flujos?\b)/i,
  // El EDITOR del Dashboard por la API (11/10/2026): «agrega un gráfico», «mi hoja de Marketing», «el informe de
  // Ana», «el AI Analyst». «plantilla» sola NO: es la palabra de las plantillas de WhatsApp (área whatsapp), y con
  // ella cada mensaje sobre una plantilla de Meta traía ~20 operaciones del Dashboard; va atada a una hoja.
  metricas: /\b(m[eé]tricas?|n[uú]meros|inversi[oó]n|gast[oóé]|cac\b|roas|dashboard|ingresos?|facturaci|cu[aá]nto (vend|invert|gast|cobr)|cascada|gr[aá]ficos?|hojas?\b|informes?\b|plantillas? (?:de |del |para )?(?:la |una |mi )?(?:hoja|dashboard|informe|marketing|comercial|closing|landing|productividad|ads analyst)|ai analyst|an[aá]lisis de (?:la|mi|una) hoja)/i,
  experimentos: /\b(experimentos?|hip[oó]tesis|retro\b|retrospectiva|conclusi[oó]n)/i,
  landing: /\b(landing|p[aá]gina|p[ií]xel|pixel|tracking|vsl)/i,
  closing: /\b(llamadas?|closing|closers?|transcri|fathom|objeci[oó]n)/i,
  // `offer`: la tab se llama así («mostrame la conclusión de Offer» caía en experimentos, 14/10/2026).
  negocio: /\b(avatar(es)?|razon(es)? de compra|ofertas?|offer\b|productos?|precios?|persona de marca|voz de marca|onboarding|conocimiento|metodolog[ií]a|fase del negocio|tutorial)/i,
  contenido: /\b(guion(es)?|reels?|carrusel(es)?|carousels?|stor(y|ies)|historias|contenido|copy|ideas? de contenido|youtube|miniatura)/i,
  video: /\b(videos?|clips?|flow\b|escenas?|montaje)/i,
  // El Image Editor (15/10/2026): «armame un diseño», «el flyer de la promo», «cambiá el texto del banner». «plantilla»
  // sola NO (es de WhatsApp y del Dashboard) y «miniatura» tampoco (es de YouTube, área contenido).
  imagen: /\b(dise[ñn]os?|image editor|editor de im[aá]gen(es)?|canva\b|flyers?|volantes?|banners?)/i,
  integraciones: /\b(integraci[oó]n(es)?|conectad[oa]|calendly|chatwoot|resend|google calendar|salud de meta|keys? de ia)/i,
  equipo: /\b(equipo|usuarios?|roles?\b|setters?|notificaci[oó]n(es)?|reportes? (diario|semanal)|zona horaria)/i,
  cs: /\b(customer success|cartera|programa|alumnos?|clientes? activos?)/i,
  // El área «curso» sale SÓLO por HTTP (lib/api-mako/areas/curso.def.ts): nombrarla no le suma
  // ninguna herramienta al doer. Está para que la tabla cubra todas las áreas.
  curso: /\b(m[oó]dulos? del curso|clases? del curso|armar (el|un) curso|migrar (el|un) curso)/i,
  // Las creaciones publicadas y sus estrellas (13/10/2026). «plantilla» sola NO: es de WhatsApp y del Dashboard.
  creaciones: /\b(creaciones?|estrellas?|galer[ií]a|publicar (?:mi|la|una|esta) automatizaci[oó]n|automatizaci[oó]n(?:es)? de (?:otros|la comunidad)|lo que publicaron)/i,
  // La pasarela de pagos (11/10/2026). Sin «pago» suelto, a propósito: «los pagos de Ana» son sus
  // CUOTAS del CRM (cobranza_lead, área crm), y sumar esta área a cada pregunta de cobranza gastaría
  // presupuesto en herramientas que no son.
  cobros: /\b(cobros?\b|cobrar|links? (de|para) (pago|cobro|pagar)|checkout|stripe|mercado ?pago|reembols|devoluci[oó]n|suscripci[oó]n(es)?|pasarelas? de pago)/i,
  // El Calendario (13/10/2026): lo que se agenda en la tab (publicaciones, bloques de trabajo). «calendario» también
  // trae la agenda del CRM (arriba): las dos áreas contestan cosas distintas del mismo día.
  calendario: /\b(calendario|publicaci[oó]n(es)? (?:de|para) (?:la semana|ma[ñn]ana|hoy|el)|programa(?:r|me|lo)? (?:un |una |el |la )?(?:reel|story|post|publicaci)|agend(?:ar|a|ame|alo) (?:un |una |el |la )?(?:reel|story|post|publicaci[oó]n|bloque)|bloques? de (?:trabajo|foco))/i,
  mako: /\b(pendientes?|propuestas?|qu[eé] (pod[eé]s|puedes) hacer|capacidades)/i,
  // El Centro de Operaciones (15/10/2026): sólo dos LECTURAS y sólo para la plataforma (`soloPlataforma`), así que
  // nombrarlas desde un cliente no le suma nada (lo saca `gatingOk`). Para Martín sí: «¿cómo van mis pedidos del centro?»,
  // «¿pasó el cartero?». Palabras propias y nunca «pedido» suelto, que en un negocio es un pedido de un cliente.
  // MANDAR un pedido no está en el registro (exige la firma del dispositivo): no hay palabra que lo traiga.
  operaciones: /\b(centro de operaciones|carteros?\b|cola de (?:pedidos|trabajos)|(?:pedidos?|trabajos?) (?:a|al|para|de|del) (?:los |mis |un |el |la )?(?:chats?|centro)\b|chats? de claude)/i,
};

/** Las áreas que nombra un mensaje, en el orden de la tabla. Vacío = ninguna. */
export function areasDelMensaje(texto: string): Area[] {
  const t = (texto || '').slice(0, 4000);
  return (Object.keys(AREA_KEYWORDS) as Area[]).filter((a) => AREA_KEYWORDS[a].test(t));
}
