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
  | 'charlar'    // saludo, gracias, emoji.
  // Las del grupo de WhatsApp (29/10/2026, Martín: «Que sepa cuándo es un ticket, cuándo es una pregunta, o una acción dentro de
  // MaKo»). Las decide el clasificador con IA (lib/mako-intencion-ia.ts), nunca una regla sola: con reglas, TICKET dio 0 de 11 en el
  // banco de casos reales.
  | 'ticket'     // pide arreglar o cambiar algo de MaKo, o reporta que algo no anda: el ticket lo abre el CÓDIGO, sin turno.
  | 'debug'      // SÓLO en el grupo de SuperAdmin y del dueño: mirar con datos qué le pasa a un negocio cliente.
  | 'no_reply';  // no es para MaKo (le habla a otra persona): silencio, sin reacción.

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
  /** Además hay que ABRIR UN TICKET, con este resumen (lib/mako-intencion-ia.ts): el TICKET puro (`intencion: 'ticket'`), o el que
   *  viene con una pregunta («¿cuántos leads entraron? y el botón de pagar no anda»): primero se contesta, después se abre. */
  ticket?: { resumen: string };
  /** Lo decidió el clasificador con IA (`ia`) o sólo las reglas (`reglas`, sin IA o porque falló). Va al registro de la decisión. */
  fuente?: 'ia' | 'reglas';
  /** Palabras que se suman a la relevancia del presupuesto de herramientas. «movela al
   *  viernes» no comparte ninguna raíz con el título de la herramienta de mover, y sin esto
   *  quedaba afuera de los 12.000 caracteres frente al resto del CRM (08/10/2026). */
  relevancia?: string;
  /** Mover a otro día sin decir qué ('sin-decir-que'), o la respuesta «la tarea» ('tarea'). Lo
   *  pone en palabras lib/doer-herramientas.ts. Marcado acá y no vuelto a leer del texto: el
   *  revisor midió «buen día, movela al viernes» con las dos áreas y SIN la pregunta, porque
   *  doer-herramientas re-leía el texto y su preludio no pelaba «buen día» (09/10/2026). */
  mover?: 'sin-decir-que' | 'tarea';
  /** La persona le reclama a MaKo lo que le prometió («Pasamelo» después de «Eso lo miro y te lo paso»): las
   *  herramientas se eligen por el pedido que MaKo prometió, no por el último mensaje (lib/mako-doer-in.ts). */
  reclamaPromesa?: boolean;
  /** Es un SEGUIMIENTO del pedido del hilo («pausala» después de «¿cómo va la campaña?»): las herramientas se eligen también
   *  por ese pedido (`hilo`, lib/doer-herramientas.ts). Lo marca lib/doer-hilo.ts (`conElHilo`), 26/10/2026. */
  sigueElHilo?: boolean;
  /** Es el DEFAULT del clasificador: ninguna regla reconoció el mensaje (sólo fuera de la app). En el grupo no se captura:
   *  lo decide `enElGrupoSinSenal` (lib/doer-hilo.ts), después de seguir el hilo (el diagnóstico del 28/10/2026, G1). */
  sinSenal?: true;
  /** Un seguimiento que el hilo levantó desde «sin señal clara» (lib/doer-hilo.ts, rama 1): NO puede confirmar ni cancelar lo
   *  que ya está pendiente. «esperá, primero movamos esos leads» después de «¿Confirmás?» no es un «sí» (la revisión del
   *  26/10/2026). El «sí» o el «no» de verdad entran por la regla 1, como 'confirmar'. */
  noResuelvePendientes?: boolean;
  /** Sólo en la app (`ctx.canal`): si el texto no nombra ningún área, la operación se busca en TODO el registro, ordenada por
   *  relevancia contra el pedido, en vez de llegar sin ninguna. Es la contracara de «un canal propone»: en la app lo que se
   *  elige es una tarjeta, no una acción hecha (lib/doer-herramientas.ts). */
  buscaEnTodo?: boolean;
  /** Sólo en la app: el veredicto es el DEFAULT de «sin señal clara» (D1 = A: se propone con tarjeta), no una lectura del pedido. Lleva
   *  `dudosa: false` para que las áreas del texto sumen, pero NO le saca a la adivinanza los candados de `dudosa`: sigue sin
   *  `proponer_tareas_plan` (el bug del 25/08: «ahí hice la prueba» no pide un borrador del plan) ni `cancelar_accion`. */
  adivina?: boolean;
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
//
// ANIMAR una landing (15/10/2026, el panel «Animar»: `cambiar_animacion_landing`). Medido con el turno que CORRE antes
// de esta regla: «anima mi landing», «ponle la animación Deslizar a la sección 2» y «quita las animaciones de la landing»
// salían `capturar` dudosa, con 2 herramientas y ninguna de landing. «animar» no era un verbo de editar, la animación no
// era una pieza (y a 4 palabras de «landing» quedaba lejos), y la segunda frase no nombra la landing.
//   · Un verbo de cambiar (también «animar», «prender», «apagar», «activar», «usar») a ≤3 palabras de la ANIMACIÓN (o
//     del efecto), o «animar» a ≤3 palabras de una pieza («anima mi landing», «anímala»); con el corte de otra área.
//   · La landing nombrada, o una SECCIÓN: el efecto por sección sólo existe acá («ponle Deslizar a la sección 2»).
//   · Va ANTES de despublicar: «quita las animaciones de la web» no es sacarla de internet. Por eso no lleva los verbos de
//     publicar ni de compartir: «sube la landing con animaciones» sigue siendo publicar.
//   · «anima» con pronombre no lleva «le/les»: «animales» no es un pedido.
//   · Su propio tipo, `animar`, con la relevancia de un pedido CHICO (ver `RELEVANCIA_LANDING`).
export type PedidoDeLanding = { tipo: 'publicar' | 'despublicar' | 'crear' | 'replicar' | 'analizar' | 'editar' | 'animar' };

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
  // Animar es un pedido CHICO (como publicar): nombra su herramienta («Animaciones y efectos…», cambiar_animacion_landing) y
  // la lista para el id. Medido el 15/10/2026 con el turno que corre: con la de editar, «puedes animar mi landing?» y
  // «ponle el efecto barrido… a la sección de testimonios» empataban en 4 puntos con una docena de operaciones declaradas
  // antes y la de animar quedaba afuera de los 12.000 caracteres.
  animar: 'animacion efectos landings creadas',
};

/** El voseo con tilde de estos verbos, en el texto CRUDO: se marca con «§» antes de normalizar (la tilde se pierde). */
const VOSEO_LANDING = /(^|[\s,.;:!¡¿?"'(])(publicá|despublicá|subí|creá|armá|hacé|generá|diseñá|montá|prepará|replicá|copiá|cloná|analizá|revisá|auditá|diagnosticá|evaluá|sacá|quitá|bajá|cambiá|agregá|añadí|poné|ocultá|escondé|mostrá|mové|borrá|eliminá|editá|traducí|duplicá|conectá|verificá|compartí|actualizá|modificá|reemplazá|corregí|arreglá|sumá|meté|animá|activá|desactivá|prendé|apagá|encendé|usá|subrayá|tachá|centrá|resaltá|alineá)(?=[\s,.;:!?"')]|$)/gi;
const PRON_LANDING = '(?:mela|melo|nosla|noslo|la|lo|las|los|me|nos)';
/** El verbo inequívoco: con la tilde marcada o con el pronombre pegado. */
const verboFuerte = (raices: string) => `\\b(?:${raices})(?:§|${PRON_LANDING}\\b)`;
/** La forma suelta: sólo al ARRANQUE, y no seguida de «de» («copia de la landing» es un sustantivo). */
const verboSuelto = (raices: string) => `^(?:${raices})\\b(?![\\s,]+de\\b)`;
const verboModal = (verbos: string) => `\\b(?:puedes|podes|podrias|podras|puede|podria|quiero que|queria que|necesito que|quisiera que|te pido que)\\s+(?:me\\s+|nos\\s+|le\\s+)?(?:${verbos})(?:${PRON_LANDING})?\\b`;
const OBJETO_LANDING = '(?:landings?|landing ?pages?|paginas?|sitios?|webs?|presentacion(?:es)?)\\b';
/** Una PARTE de la landing (no la landing misma): un botón, el formulario, una sección, el dominio… */
const PARTES_LANDING = 'secci(?:on|ones)|titular(?:es)?|titulos?|subtitulos?|botone?s?|formularios?|temas?|dominios?|videos?|vsl|agendas?|calendario|links?|enlaces?|textos?|imagen(?:es)?|fotos?|colores?|fuentes?|tipografias?|precios?|testimonios?|preguntas|faq|bloques?|encabezado|portada|hero|pie|footer|menu|logo|cta|direccion';
const PARTE_DE_LANDING = `(?:${PARTES_LANDING})\\b`;
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
/**
 * «sacá / sácala / quitá … de internet»: despublicar, si nombra la landing en algún lado.
 * ⚠️ SIN UNA PARTE DE LA LANDING EN EL MEDIO (17/10/2026): «quita el botón de la web» salía como despublicar —a un
 *    cliente que pedía sacar un botón, MaKo le proponía bajar su web—. Lo que se saca es el botón: eso es editar.
 */
const SACAR_DE_INTERNET = new RegExp(`\\b(?:saca|quita|baja|sacar|quitar|bajar|saques|quites|bajes)(?:§|${PRON_LANDING})?(?:${SEP_LANDING}(?!${PARTE_DE_LANDING})\\S+?){0,3}?${SEP_LANDING}de${SEP_LANDING}(?:internet|linea|la web)\\b`);
const NOMBRA_LANDING = new RegExp(`\\b${OBJETO_LANDING}`);
const PEDIDO_PUBLICAR = pedidoDe([
  verboFuerte('publica|sube|subi'), verboSuelto('publica|sube'), verboModal('publicar|publiques|publique|subir|subas|suba'),
], OBJETO_LANDING);
const PEDIDO_REPLICAR = pedidoDe([
  verboFuerte('replica|copia|clona'), verboSuelto('replica|copia|clona'), verboModal('replicar|copiar|clonar|repliques|copies|clones'),
], OBJETO_O_LINK);
const VERBOS_ANALIZAR = [
  verboFuerte('analiza|revisa|audita|diagnostica|evalua'), verboSuelto('analiza|revisa|audita|diagnostica|evalua'),
  verboModal('analizar|revisar|auditar|diagnosticar|evaluar|analices|revises|audites|diagnostiques|evalues'),
  // «hazle un diagnóstico a mi landing» (con «le»): la verificación de la tanda 7 lo midió sin herramienta.
  `\\b(?:haz|hazme|haznos|hazle|hazles|haceme|hacele|hace§|haganle|dame|quiero|necesito|quisiera)${SEP_LANDING}(?:un|una|el|la)${SEP_LANDING}(?:diagnostico|analisis|auditoria|revision)\\b`,
];
const PEDIDO_ANALIZAR = pedidoDe(VERBOS_ANALIZAR, OBJETO_O_LINK);
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
const PIEZA_LANDING = '(?:landings?|landing ?pages?|paginas?|sitios?|webs?|presentacion(?:es)?|secci(?:on|ones)|titular(?:es)?|titulos?|subtitulos?|botone?s?|formularios?|temas?|dominios?|videos?|vsl|agendas?|calendario|links?|enlaces?|textos?|imagen(?:es)?|fotos?|colores?|fuentes?|tipografias?|precios?|testimonios?|preguntas|faq|bloques?|encabezado|portada|hero|pie|footer|menu|logo|cta|direccion'
  // El formato de un texto (27/10/2026): «pon en negrita el título de mi landing».
  + '|negritas?|cursivas?|italicas?|subrayad[oa]s?|tachad[oa]s?|alineacion|tamanos?|letras?)\\b';
/** Un objeto de OTRA área: entre el verbo y la pieza, o justo después de ella («el titular del anuncio»). */
const OTRO_QUE_EDITAR = '(?:anuncios?|campanas?|posts?|publicacion(?:es)?|reels?|historias?|stor(?:y|ies)|e-?mails?|correos?|mails?|guion(?:es)?|copys?|automatizacion(?:es)?|flujos?|reunion(?:es)?|llamadas?|tareas?|creativos?|banners?|flyers?|disenos?|leads?|notas?|etiquetas?|etapas?|closer|setter|grupos?|chats?)\\b';
const ART = `(?:${SEP_LANDING}(?:el|la|los|las|mi|mis|tu|tus|su|sus|este|esta|ese|esa))?`;
const NO_DE_OTRO = `(?!${SEP_LANDING}(?:de|del|para|en)${ART}${SEP_LANDING}${OTRO_QUE_EDITAR})`;
/**
 * Los verbos que SON un formato (27/10/2026): «subrayá «Aprende a vender» en mi landing». La frase entre comillas deja
 * la pieza a más de 3 palabras, así que no pasa por PEDIDO_EDITAR: va con la landing nombrada y sin otra área en el medio.
 */
const VERBOS_FORMATO = 'subraya|tacha|centra|resalta|alinea';
/** Lo citado es el texto de la landing: «subrayá «Agenda tu llamada»» no habla de una llamada. */
const sinCitas = (n: string): string => n.replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, ' «» ');
const PEDIDO_FORMATO = new RegExp(`^(?!.*\\b${OTRO_QUE_EDITAR})(?:.*\\b(?:${VERBOS_FORMATO})(?:§|${PRON_EDITAR}\\b)|(?:${VERBOS_FORMATO})\\b)`);
const PEDIDO_EDITAR = new RegExp(`(?:${[
  `\\b(?:${RAICES_EDITAR})(?:§|${PRON_EDITAR}\\b)`, `\\bmostra§`,
  `^(?:${RAICES_EDITAR}|muestra)\\b(?![\\s,]+de\\b)`,
  `\\b(?:puedes|podes|podrias|podras|puede|podria|quiero que|queria que|necesito que|quisiera que|te pido que)\\s+(?:me\\s+|nos\\s+|le\\s+)?(?:${MODAL_EDITAR})(?:${PRON_EDITAR})?\\b`,
].join('|')})(?:${SEP_LANDING}(?!${OTRO_QUE_EDITAR})\\S+?){0,3}?${SEP_LANDING}${PIEZA_LANDING}${NO_DE_OTRO}`);
/** «la página de Facebook» no es una landing; y lo que diga un link no nombra nada. */
const PAGINA_DE_REDES = /\bpaginas? (?:de|del|en) (?:facebook|fb|instagram|ig|tiktok|linkedin|youtube)\b|\bfan ?pages?\b/g;
const nombraLaLanding = (n: string): boolean => NOMBRA_LANDING.test(n.replace(/https?:\/\/\S+/g, ' ').replace(PAGINA_DE_REDES, ' '));

// ── Animar (ver la cabecera del bloque) ──
/** Los verbos de cambiar una animación: sin los de publicar, compartir ni crear (esos ganan con una landing animada). */
const RAICES_ANIMAR = 'cambia|agrega|anade|anadi|pon|pone|quita|saca|elimina|borra|edita|modifica|actualiza|activa|desactiva|prende|apaga|enciende|usa|mete|suma';
const MODAL_ANIMAR = 'animar|cambiar|agregar|anadir|poner|quitar|sacar|eliminar|borrar|editar|modificar|actualizar|activar|desactivar|prender|apagar|encender|usar|meter|sumar'
  + '|animes|cambies|agregues|anadas|pongas|quites|saques|elimines|borres|edites|modifiques|actualices|actives|desactives|prendas|apagues|enciendas|uses|metas|sumes';
/** «anima» con la tilde marcada o con pronombre, pero sin «le/les»: «animales» no es un pedido. */
const VERBO_ANIMA = '\\banima(?:§|(?:mela|melo|nosla|noslo|las|los|la|lo|me|nos)\\b)';
const VERBOS_ANIMAR = [
  `\\b(?:${RAICES_ANIMAR})(?:§|${PRON_EDITAR}\\b)`, VERBO_ANIMA,
  `^(?:${RAICES_ANIMAR}|anima)\\b(?![\\s,]+de\\b)`,
  `\\b(?:puedes|podes|podrias|podras|puede|podria|quiero que|queria que|necesito que|quisiera que|te pido que)\\s+(?:me\\s+|nos\\s+|le\\s+)?(?:${MODAL_ANIMAR})(?:${PRON_EDITAR})?\\b`,
].join('|');
const ANIMACION = '(?:animacion(?:es)?|animad[oa]s?|efectos?)\\b';
/** Un verbo de cambiar a ≤3 palabras de la animación, o «animar» a ≤3 de una pieza de la landing. */
const PEDIDO_ANIMACION = new RegExp(`(?:${VERBOS_ANIMAR})(?:${SEP_LANDING}(?!${OTRO_QUE_EDITAR})\\S+?){0,3}?${SEP_LANDING}${ANIMACION}${NO_DE_OTRO}`);
const PEDIDO_ANIMAR = new RegExp(`(?:${VERBO_ANIMA}|^anima\\b|\\b(?:puedes|podes|podrias|podras|puede|podria|quiero que|queria que|necesito que|quisiera que|te pido que)\\s+(?:me\\s+|nos\\s+|le\\s+)?(?:animar|animes)(?:${PRON_EDITAR})?\\b)(?:${SEP_LANDING}(?!${OTRO_QUE_EDITAR})\\S+?){0,3}?${SEP_LANDING}${PIEZA_LANDING}${NO_DE_OTRO}`);
/**
 * Analizar UNA PARTE de la landing nombrada: «analiza las animaciones de mi landing», «revisa el formulario de la página
 * de gracias» (17/10/2026). Medido con el turno que corre: «analiza las animaciones de mi landing» quedaba a 4 palabras
 * de «landing» (el tope es 3), ninguna regla la tomaba y el mensaje se GUARDABA como captura («sin señal clara»), sin
 * una sola herramienta de landing. Va con la landing nombrada, como editar.
 *   · Una parte (el formulario, los botones, el video): `analizar`.
 *   · Las ANIMACIONES: `animar`. Lo que las lee es ver_configuracion_landing (el estilo y el efecto de cada sección), y
 *     ésa viaja con la relevancia de animar, no con la de analizar (que trae el análisis del COPY, que no las mira).
 */
const despuesDeAnalizar = (obj: string) => new RegExp(`(?:${VERBOS_ANALIZAR.join('|')})(?:${SEP_LANDING}(?!${OTRO_QUE_EDITAR})\\S+?){0,3}?${SEP_LANDING}${obj}${NO_DE_OTRO}`);
const PEDIDO_ANALIZAR_PARTE = despuesDeAnalizar(PARTE_DE_LANDING);
const PEDIDO_ANALIZAR_ANIMACION = despuesDeAnalizar(ANIMACION);
const NOMBRA_SECCION = /\bsecci(?:on|ones)\b/;
/** ¿Pide cambiar (o mirar) las animaciones de una landing? La landing nombrada, o una sección (el efecto por sección es de acá). */
const pideAnimar = (n: string): boolean =>
  (PEDIDO_ANIMACION.test(n) || PEDIDO_ANIMAR.test(n) || PEDIDO_ANALIZAR_ANIMACION.test(n)) && (nombraLaLanding(n) || NOMBRA_SECCION.test(n.replace(PAGINA_DE_REDES, ' ')));

/** ¿Le pide a MaKo algo sobre una landing del Web Generator? Recibe el texto CRUDO de la persona. */
export function esPedidoDeLanding(texto: string): PedidoDeLanding | null {
  const crudo = (texto || '').trim();
  if (!crudo || crudo.length > 1500) return null;
  const n = norm(crudo.replace(VOSEO_LANDING, (_m, antes: string, verbo: string) => `${antes}${norm(verbo)}§`))
    .replace(PRELUDIO_CRM, '').trim();
  if (!n || ARRANCA_PREGUNTANDO.test(n) || ES_DEL_PLAN.test(n)) return null;
  // Antes de despublicar: «quita las animaciones de la web» es animar, no sacarla de internet.
  if (pideAnimar(n)) return { tipo: 'animar' };
  if (PEDIDO_DESPUBLICAR.test(n) || (SACAR_DE_INTERNET.test(n) && NOMBRA_LANDING.test(n))) return { tipo: 'despublicar' };
  if (PEDIDO_PUBLICAR.test(n)) return { tipo: 'publicar' };
  if (PEDIDO_REPLICAR.test(n)) return { tipo: 'replicar' };
  if (PEDIDO_ANALIZAR.test(n) || (PEDIDO_ANALIZAR_PARTE.test(n) && nombraLaLanding(n))) return { tipo: 'analizar' };
  if (PEDIDO_CREAR.test(n) || QUIERO_UNA_LANDING.test(n)) return { tipo: 'crear' };
  if ((PEDIDO_EDITAR.test(n) || PEDIDO_FORMATO.test(sinCitas(n))) && nombraLaLanding(n)) return { tipo: 'editar' };
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
/**
 * El pedido con un modal: «necesito que busques… y que lo agarres y lo pases a la sección descalificados» (ws13, 19/10/2026,
 * mako_doer_conv): sin un imperativo, salía `capturar` dudosa con las tres herramientas del plan, y MaKo contestó «no tengo
 * acceso a listar los leads de tu CRM ni a moverlos». La segunda persona del subjuntivo termina en -s (pases, muevas), la
 * tercera no («necesito que el closer marque al lead» es de otro), y «que me pases el lead» es un «dame», no un «movelo».
 */
const MODAL_CRM = /\b(?:necesito|necesitamos|quiero|queremos|queria|quisiera|me gustaria|te pido|te pedimos|hace falta)\s+que\b[^.\n]{0,160}?\b(?<!\bme\s)(?:(?:lo|la|los|las|le|les|se)\s+)?(?:pases|muevas|pongas|dejes|agregues|anotes|marques|asignes|califiques|descartes|saques|quites|cargues|apuntes|registres|guardes|lleves|cambies|etiquetes)\b/;
/** Algo que sólo vive en el CRM. */
const OBJETO_CRM = /\b(?:leads?|ficha|crm|historial|notas?|comentario|etapas?|columna|embudo|funnel|pipeline|calificad[oa]s?|descalificad[oa]s?|descartad[oa]s?|ganad[oa]s?|perdid[oa]s?|etiquetas?|closer|setter|prospectos?|seguimiento \d|pre ?listing|en revision|nutricion manual|asisti(?:o|eron|da|do)?|productos?)\b/;
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
  const verbo = VERBO_CRM_PEGADO.test(n) || VERBO_CRM_TILDE.test(crudo) || VERBO_CRM_SUELTO.test(arranque) || MODAL_CRM.test(n);
  if (!verbo) return null;
  if (!OBJETO_CRM.test(n) && !MOVER_A.test(n)) return null;
  if (/\b(?:notas?|comentario|historial)\b/.test(n)) return { tipo: 'nota' };
  if (/\betiquetas?\b/.test(n)) return { tipo: 'etiqueta' };
  if (/\b(?:closer|setter)\b/.test(n)) return { tipo: 'asignar' };
  if (/\b(?:marca|marques)/.test(n) && /\bcomo\b/.test(n)) return { tipo: 'calificado' };
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
/** Devolver plata: «reembolsale», «el reembolso», «devolvele la plata», «hacele la devolución». Vive en lib/mako-intencion-app.ts
 *  (`OBJETO_REEMBOLSO`): la puerta de las destructivas de la app también lo mira (`pideQuitar`), y este módulo ya importa de ése. */
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
// «El plan de pagos» de un lead no es el Plan (27/10/2026): «cambiá el plan de pagos de Ana a quincenal» salía de acá sin cobro.
const DEL_PLAN_COBRO = /\b(?:(?:al|el|mi|en el) plan(?! de pagos?)|a la lista|tareas?|recordame|recuerdame|anotame|apuntame|no me olvide)\b/;

// ── UNA CUOTA DEL PLAN (17/10/2026) ──────────────────────────────────────────────────────────────
// El 14/10 el área `cobros` sumó nueve operaciones que escriben la tab Pagos campo por campo (editar_cuota,
// crear_link_cuota, cortar_recordatorio_cuota…) y SÓLO viajaban cuando el mensaje nombraba un link de pago:
// «cambiale el vencimiento a la cuota 3», «mandale el link de la cuota 2» y «cortale el recordatorio de la cuota 2»
// caían sin área (el tercero ni era un cobro para este clasificador) y el modelo se quedaba con las herramientas del
// Plan. LA SEÑAL ES EL OBJETO —una cuota con su número o su ordinal, o la palabra con su vencimiento, su recordatorio o
// su link— más un verbo de pedido. «Cuota» sola NO: es también la cuota de WhatsApp y de IA del negocio.
const NUMERO_DE_CUOTA = '(?:\\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
const OBJETO_CUOTA = new RegExp(
  `\\bcuotas?\\s+(?:n(?:u|ú)mero\\s+|nro\\.?\\s*|#\\s*)?${NUMERO_DE_CUOTA}\\b` +
  '|\\b(?:primera|segunda|tercera|cuarta|quinta|sexta|ultima|siguiente|proxima)s?\\s+cuotas?\\b|\\bcuota inicial\\b|\\bcobro inicial\\b',
);
/** Una cuota sin número, pero atada a algo que sólo una cuota de pago tiene. */
const CUOTA_Y_SU_DATO = /\bcuotas?\b.*\b(?:vencimiento|vence|recordatorios?|links?)\b|\b(?:vencimiento|vence|recordatorios?|links?)\b.*\bcuotas?\b/;
/** La cuota del NEGOCIO (de WhatsApp, de IA, de envíos): no es un pago. */
const CUOTA_DE_USO = /\bcuotas? (?:diaria|mensual|semanal|de (?:ia|whatsapp|mensajes?|tokens?|envios?|email|correos?|uso|almacenamiento))\b/;
/** Verbos de cambiar una cuota, con pronombre pegado: «cambiale», «ponele», «moveme», «cortale». */
const VERBO_CUOTA_PEGADO = /\b(?:cambia|ajusta|mueve|move|corre|pon|pone|sube|baja|corrige|edita|actualiza|reprograma|posterga|adelanta|modifica|quita|saca|corta|manda|envia|pasa|genera|crea|arma)(?:le|les|me|lo|la|selo|sela)\b/;
/** Voseo con tilde (texto CRUDO): «cambiá», «poné», «corregí», «cortá». */
const VERBO_CUOTA_TILDE = /(?:^|[\s,.;:!¡¿?"'(])(?:cambiá|ajustá|mové|corré|poné|subí|bajá|corregí|editá|actualizá|reprogramá|postergá|adelantá|modificá|quitá|sacá|cortá|mandá|enviá|pasá|generá|creá|armá)(?=[\s,.;:!?"')]|$)/i;
/** La forma suelta (tuteo o voseo sin tilde): sólo si es lo PRIMERO del mensaje. */
const VERBO_CUOTA_SUELTO = /^(?:cambia|ajusta|mueve|corre|pon|pone|sube|baja|corrige|edita|actualiza|reprograma|posterga|adelanta|modifica|quita|saca|corta|manda|envia|pasa|genera|crea|arma)\b/;
/** Con un modal: «¿puedes cambiar el vencimiento de la cuota 3?», «necesito mover la cuota 2». */
const MODAL_CUOTA = /\b(?:puedes|podes|podrias|quiero|queria|necesito|hay que|vamos a|tenes que|tienes que)\s+(?:me\s+|le\s+|nos\s+)?(?:cambiar|ajustar|mover|corregir|editar|actualizar|reprogramar|postergar|adelantar|modificar|quitar|sacar|cortar|mandar|enviar|pasar|generar|crear|armar)\b/;
/**
 * La QUEJA de que no se puede cambiar (27/10/2026, los «no puedo» falsos de Leila): «No me deja editar sus cuotas», «No puedo
 * cambiar la fecha de la cuota 2». Es un pedido de cambiarla: sin esto caían en la 9-bis («confirmación») con 0 herramientas.
 */
const QUEJA_CUOTA = /\bno\s+(?:me\s+)?(?:deja(?:n)?|dejo|puedo|pude|logro|consigo)\s+(?:cambiar|ajustar|mover|corregir|editar|actualizar|modificar|poner|cargar|reprogramar)\b/;
/** Las cuotas DE ALGUIEN («sus cuotas», «mis cuotas»): un plan de pago, no la cuota de uso del negocio. */
const CUOTAS_DE_ALGUIEN = /\b(?:sus|mis|tus)\s+cuotas\b/;
/** Lo que es de la VISTA de la ficha (un bloque, una hoja, su lugar), no un dato: «pon las cuotas arriba de todo». */
const DE_LA_VISTA = /\b(?:bloques?|hojas?|vista|estilo|columnas?|seccion(?:es)?|disenos?|arriba|abajo|ficha)\b/;
/**
 * En «Editar», también el ESTILO de lo que se ve (la revisión del 28/10/2026): «el color de los montos», «en negrita», «más grande»,
 * «al costado». Sólo acá: en el resto, «mostró», «la orden de compra» o «la más grande es de 500» son datos (la verificación).
 */
const ESTILO_DE_LA_VISTA = /\b(?:color(?:es)?|negrita|tamano|formato|costado|izquierda|derecha|fuente|resalt\w*|ocult\w*|mostrar)\b|\b(?:pon|pone|hace|hacelo|deja)\w*\s+(?:\S+\s+){0,4}mas (?:grande|chic[oa])\b/;
/** ¿Nombra la VISTA de la ficha y no un dato? Lo usa el modo «Editar» del MaKo Analyst (lib/mako-analyst-lead-reglas.ts). */
export const nombraLaVistaDeLaFicha = (texto: string): boolean => { const n = norm(texto); return DE_LA_VISTA.test(n) || ESTILO_DE_LA_VISTA.test(n); };
/**
 * EL PLAN DE PAGOS DE UN LEAD, sin la palabra «cuota» (27/10/2026, el ticket #13 de Leila): «las fechas y las cantidades de
 * pago están mal: 300 cada quincena», «corregí la mensualidad de Ana». No sumaban el área cobros y el presupuesto sólo dejaba
 * pasar `guardar_plan_pagos` (de 1 a 6 cuotas): MaKo dijo que no existía y el pedido terminó como ticket falso. Con un verbo de
 * cambiar o un «está mal». La mensualidad de MaKo («mi mensualidad», «la de MaKo») no es esto.
 */
// La revisión del 28/10/2026: en México «quincena» es de todos los días («la segunda quincena», «las ventas de la quincena»):
// sólo cuenta como frecuencia de PAGO («cada quincena», «quincenal»), y la mensualidad sólo si es de ALGUIEN («la mensualidad de
// Ana», «su mensualidad»): la de MaKo («me cobraron mal la mensualidad») no es el plan de un lead.
const OBJETO_PLAN_DE_PAGOS = /\bplan(?:es)? de pagos?\b|\b(?:fechas?|montos?|cantidades?|importes?|valores?)(?:\s+y\s+(?:las?\s+|los?\s+)?(?:fechas?|montos?|cantidades?|importes?|valores?))?\s+del?\s+(?:los\s+|sus\s+|las\s+)?(?:pagos?|cobros?|cuotas?)\b|\b(?:cada|por)\s+quincena\b|\bquincenal(?:es|mente)?\b|\bsus?\s+mensualidad(?:es)?\b|\bmensualidad(?:es)?\s+del?\s+(?!mako\b)[a-z]/;
const ESTA_MAL = /\b(?:esta|estan)\s+mal\b|\bno\s+(?:es|son)\s+(?:de\s+)?\d|\bson\s+\d/;
/** Lo que dice que algo está MAL (no sólo un «son N»): con eso, el «¿me ayudas?» del final no lo vuelve una pregunta. */
const ESTA_MAL_FUERTE = /\b(?:esta|estan)\s+mal\b|\bno\s+(?:es|son)\s+(?:de\s+)?\d/;
const PLAN_DE_MAKO = /\bmako\b|\bmi\s+(?:plan|suscripcion|mensualidad)\b|\bme\s+cobraron\b/;
/**
 * Un pedido de MOVER algo de la agenda le gana al plan de pagos («cambiá la llamada del cobro quincenal al martes»). La llamada o
 * la cita como CONTEXTO no («lo vimos en la llamada: son 300 cada quincena»; la verificación del 28/10/2026).
 */
const MUEVE_AGENDA = /\b(?:mov|move|pas|cambi|reprogram|corr|posterg|adelant|agend)\w*\s+(?:\S+\s+){0,2}(?:reunion(?:es)?|citas?|llamadas?|visitas?|eventos?|turnos?)\b/;

// ── UN PAGO QUE LLEGÓ (17/10/2026) ──────────────────────────────────────────────────────────────
// «Juan me pagó 500 mil pesos», «ya me pagó la cuota 2», «registrá un pago de 500 de Ana» salían `capturar`, dudosas
// y con DOS herramientas (medido con tsx contra `herramientasDelTurno` el 17/10/2026): MaKo no tenía
// `registrar_pago_suelto` ni `marcar_pago_cobrado` en el turno, así que ni siquiera podía cargarlo (y si lo cargaba por
// otro lado, sin moneda, los pesos entraban como dólares: el pedido de Mauricio). La señal es el HECHO (alguien pagó,
// transfirió, depositó) más lo que se pagó (una cuota, un pago, un monto), o el pedido de registrarlo. Una pregunta
// («¿ya te pagó Ana?») se contesta, no se ejecuta.
const PAGO_DICHO_CON_PRONOMBRE = /\b(?:me|nos)\s+(?:pago|pagaron|transfirio|transfirieron|deposito|depositaron|abono|abonaron)\b/;
/** Con tilde (texto CRUDO): «Pedro pagó 200», «Ana transfirió 300». Sin tilde «pago» es también el sustantivo. */
const PAGO_DICHO_CON_TILDE = /(?:^|[\s,.;:!¡¿?"'(])(?:pagó|transfirió|depositó|abonó)(?=[\s,.;:!?"')]|$)/i;
/** Lo que se pagó: una cuota, un pago, un anticipo, una seña, un monto. */
const OBJETO_DE_PAGO = /\b(?:cuotas?|pagos?|anticipos?|adelantos?|senas?|abonos?|pesos|dolares|usd|euros?)\b|\d/;
const REGISTRA_TILDE = /(?:^|[\s,.;:!¡¿?"'(])(?:registrá|cargá|marcá|anotá)(?=[\s,.;:!?"')]|$)/i;
const REGISTRA_PEGADO = /\b(?:registra|carga|marca|anota)(?:le|les|me|lo|la|selo|sela)\b/;
const REGISTRA_SUELTO = /^(?:registra|carga|marca|anota)\b/;
const REGISTRA_MODAL = /\b(?:puedes|podes|podrias|quiero|queria|necesito|hay que|vamos a|tenes que|tienes que)\s+(?:me\s+|le\s+|nos\s+)?(?:registrar|cargar|marcar|anotar)\b/;
/** Lo que se registra: un pago, un cobro, un anticipo, o una cuota «como cobrada». */
const OBJETO_A_REGISTRAR = /\b(?:pagos?|cobros?|anticipos?|adelantos?|senas?)\b|\bcuotas?\b.*\b(?:cobrad|pagad)\w*|\b(?:cobrad|pagad)\w*\b/;

export type PedidoDeCobro = { tipo: 'link' | 'anular' | 'reembolso' | 'suscripcion' | 'cuota' | 'pago' | 'plan' };

/** Lo que suma cada tipo a la relevancia del presupuesto: pone primero su herramienta (y, en
 *  un link, `listar_productos`, que da el productoId). */
export const RELEVANCIA_COBROS: Readonly<Record<PedidoDeCobro['tipo'], string>> = {
  link: 'crear link pago cobro listar productos catalogo ofertas precio',
  anular: 'anular link pago cobro listar cobros',
  reembolso: 'reembolsar cobro listar cobros pagado devolver',
  suscripcion: 'cancelar suscripcion cobro listar cobros',
  cuota: 'editar cuota vencimiento monto recordatorio cortar link cuota cobranza lead cobros pagos',
  pago: 'registrar pago suelto marcar pago cobrado cuota cobranza lead moneda del negocio cobros pagos',
  // Corregir el plan de un lead: primero editar_venta_lead y editar_cuota. `guardar_cuotas` también lo marca GANADO (crm.def).
  plan: 'editar venta lead monto suscripcion mensualidad editar cuota vencimiento monto cobranza lead cobros pagos',
};

/** Las áreas de cada tipo. Un link necesita además el CRM: el productoId sale de
 *  `listar_productos` (área crm), y sin ella el modelo no tiene con qué pedirlo. */
export const AREAS_COBROS: Readonly<Record<PedidoDeCobro['tipo'], Area[]>> = {
  link: ['cobros', 'crm'],
  anular: ['cobros'],
  reembolso: ['cobros'],
  suscripcion: ['cobros'],
  // La cuota se identifica con `cobranza_lead` (su pago_id) y el lead con `buscar_leads`: las dos son del CRM.
  cuota: ['cobros', 'crm'],
  // Registrar un pago es del CRM (`registrar_pago_suelto`, `marcar_pago_cobrado`); `cobros` trae `ver_moneda_negocio`.
  pago: ['crm', 'cobros'],
  plan: ['cobros', 'crm'],
};

/**
 * ¿Le pide a MaKo un cobro por Stripe o Mercado Pago (un link de pago, anularlo, un reembolso,
 * cancelar una suscripción)? Puro: lo usan el clasificador, el router y `esCargaDePlan`. Recibe
 * el texto crudo; null si no es un pedido de cobro.
 */
export function esPedidoDeCobro(texto: string, opts: { delLead?: boolean } = {}): PedidoDeCobro | null {
  const crudo = sinPrefijoDeLote(texto || '').trim();
  if (!crudo || crudo.length > 600) return null;
  const n = norm(crudo);
  if (DEL_PLAN_COBRO.test(n)) return null;
  // Un volcado sigue siendo material: «Idea: links de pago automáticos», una lista de cosas.
  if (ENCABEZADO_VOLCADO.test(crudo) || INFINITIVO_TITULO.test(crudo) || esLista(crudo)) return null;
  const arranque = n.replace(PRELUDIO_CRM, '');
  // Una cuota del plan: lo suyo gana sólo si NO es uno de los cobros de arriba (un reembolso de la cuota 2 es un reembolso).
  const verboCuota = VERBO_CUOTA_PEGADO.test(n) || VERBO_CUOTA_TILDE.test(crudo) || VERBO_CUOTA_SUELTO.test(arranque) || MODAL_CUOTA.test(n) || QUEJA_CUOTA.test(n);
  const cuota = (OBJETO_CUOTA.test(n) || CUOTA_Y_SU_DATO.test(n) || (CUOTAS_DE_ALGUIEN.test(n) && !DE_LA_VISTA.test(n))) && !CUOTA_DE_USO.test(n) && verboCuota;
  // Una pregunta sin un verbo de cambiar no es un pedido («¿cuánto es la mensualidad de Ana?», «… son 12, ¿cómo vamos?»).
  const preguntaSinVerbo = (/^[¿]/.test(crudo) || /\?\s*$/.test(crudo)) && !verboCuota && !ESTA_MAL_FUERTE.test(n);
  // `delLead`: la ficha de UN lead («Editar» del MaKo Analyst): ahí «la mensualidad» sola es la de ese lead.
  const plan = (OBJETO_PLAN_DE_PAGOS.test(n) || (!!opts.delLead && /\bmensualidad(?:es)?\b/.test(n))) && (verboCuota || ESTA_MAL.test(n)) && !preguntaSinVerbo && !PLAN_DE_MAKO.test(n) && !DE_LA_VISTA.test(n) && !CUOTA_DE_USO.test(n) && !MUEVE_AGENDA.test(n);
  const verbo = VERBO_COBRO_PEGADO.test(n) || VERBO_COBRO_TILDE.test(crudo) || VERBO_COBRO_SUELTO.test(arranque) || MODAL_COBRO.test(n) || SEGUNDA_COBRO.test(n);
  // Un pago que llegó, dicho o pedido (no una pregunta): «Juan me pagó 500 mil pesos», «registrá un pago de 500».
  const esPregunta = /^[¿]/.test(crudo) || /\?\s*$/.test(crudo);
  // Lo que se pagó se busca SIN el verbo: «pagó» sin tilde es «pago», que sería su propio objeto («me pagó la comida»).
  const sinElVerbo = norm(crudo.replace(/\b(?:pag[oó]|transfiri[oó]|deposit[oó]|abon[oó])\b/gi, ' ')).replace(PAGO_DICHO_CON_PRONOMBRE, ' ');
  const pago = !esPregunta && (
    ((PAGO_DICHO_CON_PRONOMBRE.test(n) || PAGO_DICHO_CON_TILDE.test(crudo)) && OBJETO_DE_PAGO.test(sinElVerbo))
    || ((REGISTRA_TILDE.test(crudo) || REGISTRA_PEGADO.test(n) || REGISTRA_SUELTO.test(arranque) || REGISTRA_MODAL.test(n)) && OBJETO_A_REGISTRAR.test(n))
  );
  if (!verbo) return cuota ? { tipo: 'cuota' } : pago ? { tipo: 'pago' } : plan ? { tipo: 'plan' } : null;
  if (OBJETO_REEMBOLSO.test(n)) return { tipo: 'reembolso' };
  if (OBJETO_SUSCRIPCION.test(n) && VERBO_BAJA.test(n)) return { tipo: 'suscripcion' };
  const link = OBJETO_LINK_PAGO.test(n) || (NOMBRA_PASARELA.test(n) && /\bcobr/.test(n));
  if (link && VERBO_ANULAR.test(n)) return { tipo: 'anular' };
  if (link || OBJETO_SUSCRIPCION.test(n)) return { tipo: 'link' };
  return cuota ? { tipo: 'cuota' } : pago ? { tipo: 'pago' } : plan ? { tipo: 'plan' } : null;
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
/** Cuántas preguntas trae: los «?» fuera de un link y de lo citado entre «…» o “…” (`?abrir=` no pregunta nada). */
const cuantasPreguntas = (s: string): number =>
  (s.replace(/https?:\/\/\S+/g, ' ').replace(/«[^»]*»/g, ' ').replace(/“[^”]*”/g, ' ').match(/\?+/g) ?? []).length;

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
/**
 * La QUEJA de que algo no anda («No me deja…», «No puedo…», «No funciona…», 27/10/2026, los «no puedo» falsos de Leila): no
 * es un «no» a lo que MaKo propuso ni charla. `CONFIRMACION` mira el ARRANQUE a propósito —la regla 1 y `corrigeAgenda`
 * necesitan que tome «no, movela al viernes» (docs/hallazgos-comunicacion.md)— y no se toca: las reglas 1 y 9-bis la miran
 * con esto al lado. Medido: limitar la 9-bis a una confirmación «pelada» mandaba a capturar «no, mejor el martes» y «No,
 * gracias, eso es todo»; esto sólo saca las quejas.
 * Y el RECLAMO de que MaKo no contestó (29/10/2026, Leandro, ws10): «No me respondiste lo de este audio» era `charlar` sin
 * herramientas («confirmación sin nada pendiente») y MaKo le contestó que no podía escuchar audios. Va al default del grupo,
 * que sigue el hilo.
 */
const QUEJA_NO_ANDA = /^[\s¡!¿?]*no\s+(?:me\s+)?(?:(?:deja(?:n)?|dej[oó]|puedo|pude|logro|consigo|funciona|anda|sale|aparece|carga|abre|guarda|toma)\b|(?:respondiste|contestaste|respondi[oó]|contest[oó]|llega|lleg[oó])(?![a-záéíóúñ]))/i;
/**
 * La queja con OBJETO de la app, la única que no contesta una propuesta pendiente (la revisión del 28/10/2026): «no puedo a esa
 * hora», «no puedo» o «No consigo turno» con una reunión propuesta SON un «no» (la regla 1 los toma y viaja cancelar_accion;
 * lib/doer-hilo.ts cuenta con eso). Sólo «no (me) deja/puedo + editar, guardar, cambiar…» o «no funciona/anda/carga + el…».
 */
const QUEJA_DE_LA_APP = /^[\s¡!¿?]*no\s+(?:me\s+)?(?:deja(?:n)?|dej[oó]|puedo|pude|logro|consigo)\s+(?:editar|guardar|cambiar|cargar|crear|subir|borrar|eliminar|mover|agregar|adjuntar|abrir|entrar|enviar|mandar|modificar|corregir|actualizar)\b|^[\s¡!¿?]*no\s+(?:me\s+)?(?:funciona|anda|carga|abre|guarda|aparece|sale)\s+(?:el|la|los|las|mi|su|tu|ese|esa|este|esta)\b|^[\s¡!¿?]*no\s+(?:me\s+deja(?:n)?|funciona|anda|carga|abre|sale)[\s.!¡]*$/i;


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
// ⚠️ «¿CÓMO ESTÁS?» NO SE PELABA, y el pedido que venía detrás se leía como una pregunta (16/10/2026, ws18): «Hola
// MaKo, ¿cómo estás? ¿Me agendás una visita… mañana a las 9:30?» llegó como `consultar` —en una pregunta no viajan las
// herramientas que escriben— y MaKo terminó diciendo que no podía escribir en su Google Calendar. La alternativa era
// `c[oó]mo (and|est|va)` seguida del corte `(?![a-záéíóúñ])`, y después de «est» o «and» SIEMPRE viene una letra: sólo
// «cómo va» se pelaba. Va la forma entera y sólo CERRADA (un «?», una coma, un punto o el final): «cómo están los
// leads» es una pregunta por un dato y no se toca.
const CORTESIA = 'c[oó]mo (?:est[aá]s|and[aá]s|est[aá]n|and[aá]n|te va|les va)(?=\\s*[?,.!]|\\s*$)';
const SALUDOS = `hola|ola|holis|opa|buenas|buen[oa]s|buen d[ií]a|hey|ey|che|qu[eé] tal|${CORTESIA}|c[oó]mo (and|est|va)|todo bien|gracias|mil gracias|genial|joya|b[aá]rbaro|buen[ií]simo|jaja|abrazo|saludos|chau|nos vemos|buen finde|test|prueba|probando|ping`;
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
// ⚠️ Y «¿me agendás una visita…?»: la segunda persona con el pronombre ADELANTE (16/10/2026, ws18). Es como pide quien
// vosea o tutea en una pregunta («me agendás», «me agendas», «le agendarías»), no era ninguna de estas formas y el
// pedido caía en `consultar`. Sólo con el pronombre: «tus agendas» es el sustantivo.
// ⚠️ Y «reprogramame la reunión… reprogramámela para el lunes» (17/10/2026, ws13) caía al default, sin ninguna
// herramienta de agenda, y MaKo contestó «no tengo acceso para mover eventos de tu calendario». Es la gemela de
// «reagendá» (07/10): `\bprograma` no matchea adentro de «reprograma», porque entre «re» y «programa» no hay borde.
// «programa» suelto es el sustantivo («el programa»); «reprograma» suelto no lo es.
// ⚠️ Y el infinitivo con el pronombre pegado, «agendarle a Pablo lo que te pidió en el calendario» (17/10/2026, ws18):
// «agendar» sólo, como orden, exige reunión y día (lo dicta una tarea); con el pronombre pegado ya no es un título.
const VERBO_AGENDAR = /(?<!\b(?:mi|tu|su|la|de|en|mis|tus|sus|una|esta)\s)\bagenda\s+(?:me|le|les|nos|una?|la|el|a)\b|\b(?:re)?agend(?:ame|ale|ales|ala|alo|alas|alos|anos)\b|\b(?:re)?agendar(?:le|les|lo|la|los|las|me|nos|selo|sela)\b|\breagenda\b|\b(?:re)?programa(?:me|mela|melo|la|le|lo|las|los|nos)\b|\breprograma\b|\b(?:me|nos|le|les)\s+(?:la\s+|lo\s+)?(?:re)?agend(?:as|aras|arias)\b/;
const VERBO_SOBRE_REUNION = /\b(?:crea(?:me|la|le)?|arma(?:me|la|le)?|pon(?:e|eme|ela|me|la|le)|mueve(?:la|lo|me)?|move(?:la|lo|me|las|los)|pasa(?:la|lo|me|las|los)?|cambia(?:la|lo|le|me|las|los)?|cancela(?:la|lo|me|las|los)?|borra(?:la|lo|me|las|los)?|elimina(?:la|lo|me|las|los)?|edita(?:la|lo|le)?|modifica(?:la|lo|le)?|suspende(?:la|lo)?|renombra(?:la|lo)?)\b/;
// Las formas con modal: es como pide un cliente que tutea («me puedes agendar…»).
const MODAL_AGENDA = /\b(?:puedes|podes|podrias|podras|puede|podria|quiero|queria|necesito|hay que|vamos a)\s+(?:me\s+|nos\s+|le\s+)?(?:re)?(agendar|crear|armar|poner|mover|pasar|cambiar|cancelar|borrar|eliminar|editar|modificar|programar|suspender|renombrar)(?:me|la|lo|le|nos|las|los)?\b/;
const SUSTANTIVO_AGENDA = /\b(?:reunion(?:es)?|visitas?|citas?|evento|llamadas?|turnos?|juntas?|meetings?|zoom)\b/;
const TIEMPO_AGENDA = /\b(?:hoy|manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|a las|a la una|semana que viene|proxima semana|esta (?:tarde|noche))\b|\b\d{1,2}(?::\d{2})?\s*(?:hs?|hrs?|horas?|am|pm)\b|\b\d{1,2}:\d{2}\b/;
const ARRANCA_PREGUNTANDO = /^(?:que|cuant[oa]s?|cual(?:es)?|quien(?:es)?|cuando|donde|como|por ?que|hay|tengo|tenes|tienes)\b/;
// Lo que se dice antes del pedido y no cambia nada: el nombre, un «che», un «porfa».
const PRELUDIO = /^(?:[\s,.:;!¡¿?-]*(?:mako|che|porfa|por favor|oye|ey|hola|buenas)\b)*[\s,.:;!¡¿?-]*/;
/** Dónde se agenda: «en el calendario», «en mi agenda». Con un verbo de agendar, alcanza para saber que es la agenda. */
const LUGAR_AGENDA = /\b(?:calendario|calendar|agenda)\b/;

// ── GOOGLE CALENDAR, NOMBRADO (ticket #42, Código Inmobiliario, 3/11/2026) ───────────────────────────────────────────────
// «De hecho si tienes acceso al google calendar…, esa respuesta que diste está mal»: la herramienta existe y la agenda del negocio
// está conectada desde el 8/10, pero nombrar el lugar sólo traía el área `integraciones`. Sin `crm` no viajaba
// `proponer_agendar_agenda`, y «agrégalo a mi google calendar» caía en charla: MaKo contestaba que no tenía acceso.
// Sobre el texto sin tildes. «el calendario» a secas es el de MaKo, y un «content calendar» no es una agenda.
const LUGAR_GOOGLE = /\b(?:google\s+calendar(?:io)?|calendario\s+de\s+google|agenda\s+de\s+google|gcal|(?<!content\s)calendar)\b/;
/** Poner algo en la agenda, con el lugar nombrado: «agrégalo a mi google calendar», «sumame esto al calendar». */
const VERBO_A_GOOGLE = /\b(?:agrega|carga|suma|anota|mete|pasa|crea|arma|guarda|registra|sube|pon|pone)(?:me|le|les|nos)?(?:lo|la|los|las)?\b/;
const MODAL_A_GOOGLE = /\b(?:puedes|podes|podrias|podras|puede|podria|quiero|queria|necesito|hay que|vamos a)\s+(?:me\s+|nos\s+|le\s+)?(?:agregar|cargar|sumar|anotar|meter|pasar|crear|armar|guardar|registrar|subir|poner)(?:me|le|les|nos)?(?:lo|la|los|las)?\b/;
/** «tienes acceso al google calendar», «puedes configurarlo en google calendar»: pregunta o reclama lo que MaKo puede. */
const QUE_PUEDE = /\b(?:acceso|puedes|podes|podrias|puede|podria)\b/;
/** ¿El texto nombra Google Calendar? Lo miran los dos turnos para decir el estado real de la conexión (lib/agenda-sin-ia.ts). */
export const nombraGoogleCalendar = (texto: string): boolean => LUGAR_GOOGLE.test(norm(texto));

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

/**
 * El NOMBRE de lo que se crea: «una etiqueta llamada Caliente», «un evento que se llame Cena». No es una llamada que agendar.
 * «llamá a Juan» y «una llamada con Ana mañana» siguen siendo de la agenda (la palabra que sigue es una preposición, un
 * artículo o un día). Sobre el texto sin tildes.
 */
const NOMBRADO = /\b(?:que\s+se\s+)?(?:llam(?:a|e|an|en)|(?<=\b(?:etiqueta|automatizacion|campana|plantilla|secuencia|lista|hoja|producto|proyecto|curso|modulo|evento|columna|carpeta|grupo|segmento|flujo|funnel|embudo|landing|pagina|formulario|audiencia|anuncio|regla|tag|cuenta|vista|tablero|kpi|oferta|diseno|video|tema|avatar|guion|angulo|componente|filtro|contacto|cliente|lead|grafico|tarea|nota|estrategia|integracion|canal|chat|bot|chatbot|workspace|negocio|marca|dashboard|informe|reporte|categoria|etapa|pipeline)(?:e?s)?\s+)llamad[oa]s?|titulad[oa]s?)\s+(?!(?:con|a|para|de|del|el|la|los|las|manana|hoy|que|por|en|al|un|una|y|o|esta|este|lunes|martes|miercoles|jueves|viernes|sabado|domingo|ahora|luego|despues|temprano|tarde)\b)[^\s,.;:]+/g;

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
  // «agendar» sólo quiere decir una cosa: con un día, una hora, una reunión o el calendario alcanza.
  if (agendar && (tiempo || reunion || LUGAR_AGENDA.test(t))) return true;
  if (LUGAR_GOOGLE.test(t) && (VERBO_A_GOOGLE.test(t) || MODAL_A_GOOGLE.test(t))) return true;
  // «cambiá», «pasá», «cancelá» quieren decir muchas: hace falta la reunión, y además un
  // día u hora, o que el mensaje ARRANQUE con el verbo (ahí es una orden, no una idea).
  return sobre && reunion && (tiempo || VERBO_SOBRE_REUNION.test(t.slice(0, 14)) || /^(?:me |nos )?(?:puedes|podes|podrias)/.test(t));
}

// ── PROBAR UNA INTEGRACIÓN ───────────────────────────────────────────────────────
// EL CASO (16/10/2026, ws18). «probá el calendario de google» cayó al default —material para anotar, dudosa— con dos
// herramientas del plan y ninguna para mirar la conexión. MaKo contestó «primero debes activar la integración» con su
// Google Calendar CONECTADO, y la persona: «mentira, ya está conectado». El modelo no tenía con qué leerlo, y lo
// dedujo. «probá» no está entre los imperativos de arriba, y «prueba» es un SALUDO (así se estrena un canal), así que
// esto va antes que el saludo. Es una LECTURA: mirar el estado y el día, nunca escribir nada.
const VERBO_PROBAR = /^(?:proba|prueba|probame|probala|probalo|probar|testea|testear|testeame|chequea|chequear|verifica|verificar|fijate si|mira si|(?:me\s+)?(?:puedes|podes|podrias)\s+(?:probar|testear|chequear|verificar|fijarte si|mirar si))\b/;
const OBJETO_INTEGRACION = /\b(?:calendario|calendar|google|calendly|integracion(?:es)?|conexion|conectad[oa]|whatsapp|gmail|meta|instagram|stripe|mercado ?pago|fathom|zoom)\b/;
/** Lo que suma al presupuesto: el estado de la conexión y el día de la agenda (lo que prueba que anda). */
export const RELEVANCIA_PROBAR_INTEGRACION = 'probar conexion integracion estado conectado google calendar agenda dia hoy';
/** ¿Pide probar una integración? Recibe el texto SIN tildes. */
function esPruebaDeIntegracion(n: string): boolean {
  const t = n.replace(PRELUDIO, '').trim();
  if (!t || t.length > 160 || t.includes('\n')) return false;
  const v = VERBO_PROBAR.exec(t);
  return !!v && OBJETO_INTEGRACION.test(t.slice(v[0].length, v[0].length + 60));
}

/**
 * ¿El último mensaje de MaKo le PIDIÓ algo a la persona? Una pregunta («¿a qué hora?») o un pedido
 * («pásame el nombre y la dirección»). `makoPreguntoAlgo` sólo mira el «?», y el 16/10/2026 (ws18)
 * MaKo pidió los datos de una visita con un «pásame…», sin signo: la respuesta («El nombre es Nancy y
 * la dirección es Alem 1987») llegó como material para anotar y sin la agenda.
 */
export function makoPidioDatos(ultimoDeMako: string | null | undefined): boolean {
  if (makoPreguntoAlgo(ultimoDeMako)) return true;
  const fin = norm((ultimoDeMako ?? '').slice(-280));
  return /\b(?:pasame|dime|decime|mandame|enviame|confirmame|indicame|contame|cuentame|necesito (?:el|la|los|las|que|saber))\b/.test(fin);
}

/**
 * ¿Era un pedido de agenda? Lo decide el MISMO clasificador, con su pelado del saludo («Hola MaKo, ¿cómo estás?
 * ¿Me agendás…?»): el doer lo pregunta sobre los mensajes ANTERIORES de la persona para saber si la respuesta de
 * ahora sigue ese pedido (`siguePedidoDeAgenda`). Sin contexto: lo de antes se mira como llegó.
 */
export function esPedidoDeAgenda(texto: string): boolean {
  const v = clasificarIntencion(texto);
  return v.intencion === 'actuar' && v.relevancia === RELEVANCIA_AGENDA;
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

// ── «YA LO HICE»: CERRAR LA TAREA DEL PLAN (17/10/2026) ──────────────────────────────────────────────────────────
// docs/hallazgos-plan.md («Marcar hecha una tarea cuando algo YA ESTÁ»): que MaKo en WhatsApp ofrezca `cerrar_tareas_plan`
// cuando la persona dice que ya hizo algo. Medido: «ya lo hice», «ya terminé la landing de octubre» y «ya está hecha la
// #412» caían al default —`capturar`, dudosa, sin una herramienta—, o sea material para ANOTAR una tarea nueva: lo
// contrario. Ahora es `actuar` con el Plan, y lo que entra es cerrar (una acción de chat: MaKo la PROPONE con la tarea
// que encontró y la persona dice «sí») y leer las tareas para encontrarla. Una pregunta («¿ya lo hiciste?») no es esto.
const YA_HECHO = /^(?:(?:bueno|listo|dale|ok|perfecto)[\s,.!]+)?ya\s+(?:(?:lo|la|los|las|le|me|nos)\s+)?(?:hice|hicimos|termine|terminamos|complete|completamos|resolvi|resolvimos|arregle|arreglamos|cerre|cerramos|subi|subimos|mande|mandamos|envie|enviamos|cargue|cargamos|grabe|grabamos|publique|publicamos|llame|llamamos|pague|pagamos|entregue|entregamos)\b|^(?:(?:bueno|listo|dale|ok|perfecto)[\s,.!]+)?ya\s+(?:esta|quedo|estan|quedaron)\s+(?:(?:hech|list|terminad|resuelt|complet|cerrad)[oa]s?|la\s+#?\d+|el\s+#?\d+)\b/;
const RELEVANCIA_YA_HECHO = 'cerrar tareas plan hecha completada evidencia listar tareas buscar';
/**
 * Corrige a MaKo sobre una recomendación (26/10/2026, MaKo recomienda, docs/diseno-mako-recomienda.md): «no me recomiendes más lo
 * de la landing», «descarta esa recomendación», «esa sugerencia no aplica». Es una ACCIÓN (`decidir_recomendacion`, que deja su
 * tarjeta), no una idea para anotar: sin esto caía en `capturar` y la corrección terminaba de tarea en el Plan. Sobre el texto
 * normalizado (sin acentos ni mayúsculas).
 */
const CORRIGE_RECOMENDACION = /\bno (?:me |nos )?(?:vuelvas a |sigas )?(?:recomend|recomiend|sugier|suger)\w*|\b(?:descart|olvid|call|ignor|saca|quita)\w* (?:esa|esta|la|lo de la|las|esas|estas) (?:recomendaci|sugerenci)\w*|\b(?:esa|esta|la) (?:recomendaci|sugerenci)\w* no (?:aplica|sirve|va)\b/;
const RELEVANCIA_CORRIGE_RECOMENDACION = 'decidir recomendacion descartar que recomienda';
/**
 * PIDE ARMAR O REDEFINIR EL AVATAR (27/10/2026, MAU-02 de Mauricio: «que redefina o defina mi avatar considerando los clientes
 * que son ganados... no funciona al preguntar»). Caía en «consultar» y sólo viajaban lecturas: `generar_avatares` (que ahora
 * lee los ganados, lib/avatares-ganados.ts) nunca llegaba. Sobre el texto normalizado (sin tildes).
 * Es el avatar del NEGOCIO sólo con una señal de negocio (`AVATAR_DEL_NEGOCIO`): «creame un avatar en la oficina» o «hacé que mi
 * avatar diga…» son el del video (AI Avatar, tests/ops-center-clasificador-app.test.ts) y siguen su camino, como `AVATAR_DE_VIDEO`.
 */
const PIDE_AVATAR = /\b(?:redefin|defin|arm|gener|crea|hac|haz|rehac|actualiz|mejor|ajust|cambi|rearm|regener)\w*\s+(?:\S+\s+){0,3}?(?:avatar(?:es)?|cliente ideal|buyer persona)\b/;
const AVATAR_DEL_NEGOCIO = /\b(?:redefin|defin)\w*|\b(?:cliente ideal|buyer persona|clientes?|ganad[oa]s?|compr\w+|compradores|publico|audiencia|nicho)\b/;
const AVATAR_DE_VIDEO = /\b(?:videos?|clips?|reels?|ai avatar|voz|voces|escenas?|guion(?:es)?|anuncios?|diga|digan|dice|decir|habl\w*)\b/;
const RELEVANCIA_PIDE_AVATAR = 'generar avatares afinar avatares listar avatares negocio';
/**
 * PIDE una recomendación (26/10/2026): «Mako, qué me recomendás hacer esta semana», «dame un consejo», «¿qué debería mejorar?».
 * Es una CONSULTA (`que_recomienda_mako`): sin signo de pregunta, en WhatsApp caía en `capturar` (una idea para el Plan), y en la
 * app, ante la duda, en `actuar` (con la escritura). En una consulta MaKo ofrece; la persona decide.
 */
const PIDE_RECOMENDACION = /\bque (?:me |nos )?(?:recomend|recomiend|suger|sugier|aconsej)\w*|\b(?:dame|danos|pasame|tenes|tienes|hay) (?:alguna?s? |un |unos |tu |tus )?(?:consejos?|recomendaci\w*|sugerenci\w*)|\bque (?:deberia|tendria que|me conviene) (?:mejorar|cambiar|hacer)\b/;
const RELEVANCIA_PIDE_RECOMENDACION = 'que recomienda recomendaciones mako';
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

/** Acuses y saludos cortos que la app no toma por un pedido. Sobre el texto sin tildes ni signos. */
/** Los acuses que, después de una pregunta de MaKo, aceptan lo que ofreció. */
const ACUSE_QUE_ACEPTA = /^(?:ah )?(?:bueno|buenisimo|entendido|vale|me parece bien|esta bien|ok(?:ey)?(?: gracias)?|ahi va|joya|genial|perfecto|barbaro)$/;
const ACUSE_DE_LA_APP = /^(?:ah )?(?:bueno|buenisimo|entendido|entendi|vale|ya esta|ya entendi|me parece bien|esta bien|ok(?:ey)? gracias|ahi va|mmm+(?: no se)?|hmm+|eh|uh|buenas tardes|buenas noches|buenos dias|buen dia|buenas|tardes|noches|dias|ok|okey|listo|joya|genial|perfecto|barbaro)$/;

export function clasificarIntencion(
  texto: string,
  ctx: {
    hayPendientes?: boolean; hayPendienteDeAgenda?: boolean; hayMedia?: boolean; hayContacto?: boolean; hayAgendaAbierta?: boolean; makoPregunto?: boolean; preguntoReunionOTarea?: boolean;
    /** Uno de los últimos pedidos de la persona fue de agenda y MaKo le acaba de pedir datos (`makoPidioDatos`). */
    siguePedidoDeAgenda?: boolean;
    /** El último mensaje de MaKo PROMETIÓ algo (lib/doer-salida.ts, `promesasDe`), y ésta es la intención del pedido
     *  de la persona que prometía cumplir. Sin promesa, undefined. */
    pedidoPrometido?: Intencion;
    /**
     * Por dónde habla la persona. `'app'` (el Ops Center y /m/mako): MaKo sólo PROPONE y la persona confirma con un toque, así
     * que ante la duda se actúa (se arma la tarjeta) en vez de anotar el pedido como idea: decisión D1 = A de
     * docs/ops-center-principal.md, 20/10/2026. Sin `canal` (o `'whatsapp'`) todo es como siempre: el grupo de WhatsApp
     * sigue anotando, que es lo que conviene al dueño que vuelca ideas por ahí.
     */
    canal?: 'app' | 'whatsapp';
  } = {},
): VeredictoIntencion {
  const t = (texto || '').trim();
  const n = norm(t);
  // Se calcula una vez: lo miran la regla del «sí» (para NO quedárselo) y la de agenda. Sobre
  // lo que escribió la persona: el encabezado de un lote alarga el texto y no es de ella.
  const nPersona = norm(sinPrefijoDeLote(t));
  // «una etiqueta llamada Caliente» es un NOMBRE, no una llamada que agendar (medido el 20/10/2026: «crea una etiqueta llamada
  // Caliente» llegaba como pedido de agenda).
  const nAgenda = ctx.canal === 'app' ? nPersona.replace(NOMBRADO, ' ') : nPersona;
  // Sólo en la app (lib/mako-intencion-app.ts): de qué área es lo que se pide cuando el texto no la nombra.
  const fam = ctx.canal === 'app' ? familiasDe(t) : null;
  // «creá una plantilla de WhatsApp para recordar la reunión» nombra una reunión pero no pide agendarla.
  const pedidoAgenda = !fam?.ganaALaAgenda && (esPedidoAgenda(nAgenda) || corrigeAgenda(nAgenda, !!ctx.hayPendienteDeAgenda));
  // (En la app, «quitá el gráfico de leads de la hoja» nombra un lead pero pide otra cosa: la familia gana, `ganaAlLead`.)
  const pedidoLead = fam?.ganaAlLead ? null : esPedidoSobreLead(t);
  const pedidoCobro = esPedidoDeCobro(t);
  // («publicá mi landing en la galería de la comunidad» nombra una landing pero publica una creación: `ganaALaLanding`.)
  const pedidoLanding = fam?.ganaALaLanding ? null : esPedidoDeLanding(sinPrefijoDeLote(t));
  const deLaApp = ctx.canal === 'app' ? { buscaEnTodo: true as const, ...(fam ? { areas: fam.areas, relevancia: fam.relevancia } : {}) } : {};

  // 0) COMPARTIÓ UN CONTACTO. Va antes que todo porque no admite lectura: nadie
  //    comparte una tarjeta de contacto para que quede anotada como una idea.
  //    Es una persona, y una persona va al CRM.
  //
  //    Sin esta rama caía en el default («no hay señal clara → capturar») y el
  //    contacto de un lead terminaba de tarea en el plan — que es peor que el bug
  //    original, porque encima parecería que funcionó.
  if (ctx.hayContacto) {
    return { intencion: 'actuar', dudosa: false, ...deLaApp, porque: 'compartió una tarjeta de contacto: es un lead, no una nota' };
  }

  // 1) Un «sí» pelado con algo esperando. Va PRIMERO: es el turno más corto y el
  //    más fácil de confundir con un saludo.
  //
  //    ⚠️ Salvo que pida o corrija algo de la agenda: «cancelá la reunión de mañana a las 12»
  //    y «no, movela al viernes a las 10» arrancan con una palabra de CONFIRMACION, y con
  //    una pendiente abierta se leían como un «no» — el turno llegaba sin las herramientas
  //    de agenda y corregir una propuesta sólo la cancelaba (08/10/2026).
  if (ctx.hayPendientes && CONFIRMACION.test(t) && t.length <= 60 && !QUEJA_DE_LA_APP.test(t) && !pedidoAgenda && !pedidoLead && !pedidoCobro && !pedidoLanding) {
    return { intencion: 'confirmar', dudosa: false, porque: 'confirmación con pendiente vigente' };
  }

  // 2) Pedido explícito de anotar. No hay ambigüedad posible… salvo que diga DÓNDE, y el
  //    dónde sea un lead: «anotá en el lead Nicolás que…» es una nota del CRM, no del plan
  //    (ver `esPedidoSobreLead`). Pasa de largo y lo toma la regla 3-quater.
  if (PEDIDO_ANOTAR.test(n) && !pedidoLead) {
    return { intencion: 'capturar', dudosa: false, porque: 'pidió anotarlo explícitamente' };
  }

  // 2-bis) PROBAR UNA INTEGRACIÓN («probá el calendario de google», ver `esPruebaDeIntegracion`). Antes del saludo:
  //        «prueba» es un saludo, y pelado dejaba «el calendario de google» sin verbo, al default.
  if (esPruebaDeIntegracion(nPersona)) {
    return { intencion: 'consultar', dudosa: false, porque: 'pide probar una integración: se lee su estado', areas: ['integraciones', 'crm'], relevancia: RELEVANCIA_PROBAR_INTEGRACION };
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
  //    (En la app, «prueba la automatización de bienvenida» no es un saludo: la familia del pedido gana.)
  if ((SALUDO.test(t) || SOLO_EMOJI.test(t)) && cuentaLinks(t) === 0 && !(ctx.canal === 'app' && fam?.actua)) {
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

  // 3-bis-rec) CORRIGE UNA RECOMENDACIÓN DE MaKo (26/10/2026, ver `CORRIGE_RECOMENDACION`): es la corrección en lenguaje natural
  //            («no me recomiendes eso porque…»), y llega con `decidir_recomendacion` para que quede una tarjeta que se confirma.
  if (CORRIGE_RECOMENDACION.test(nPersona)) {
    return { intencion: 'actuar', dudosa: false, ...deLaApp, porque: 'corrige una recomendación de MaKo', areas: ['mako'], relevancia: RELEVANCIA_CORRIGE_RECOMENDACION };
  }
  // 3-bis-av) PIDE ARMAR O REDEFINIR EL AVATAR (MAU-02, ver `PIDE_AVATAR`): un pedido, con `generar_avatares` (que propone y se
  //           confirma en su pantalla).
  // El avatar de un VIDEO (AI Avatar) o el de un guion de anuncios es otro: ésos siguen su camino.
  if (PIDE_AVATAR.test(nPersona) && AVATAR_DEL_NEGOCIO.test(nPersona) && !AVATAR_DE_VIDEO.test(nPersona)) {
    return { intencion: 'actuar', dudosa: false, ...deLaApp, porque: 'pide armar o redefinir el avatar', areas: ['negocio'], relevancia: RELEVANCIA_PIDE_AVATAR };
  }
  // 3-bis-rec2) PIDE UNA RECOMENDACIÓN (ver `PIDE_RECOMENDACION`): una consulta, con las áreas que nombre además («¿qué me
  //             recomiendas para la landing?» trae también las de la landing). Un pedido concreto que viene con ella gana su regla.
  if (PIDE_RECOMENDACION.test(nPersona) && !pedidoAgenda && !pedidoLead && !pedidoLanding) {
    return { intencion: 'consultar', dudosa: false, ...deLaApp, porque: 'pide una recomendación', areas: [...new Set<Area>(['mako', ...areasDelMensaje(t)])], relevancia: RELEVANCIA_PIDE_RECOMENDACION };
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

  // 3-bis-bis) LE DA LOS DATOS QUE MaKo PIDIÓ PARA AGENDAR. «El nombre es Nancy y la dirección es Alem 1987», después
  //            de un «pásame el nombre y la dirección» a un pedido de visita (16/10/2026, ws18). Sin esto caía al default
  //            —material, dudosa, dos herramientas del plan— y MaKo contestó «desde este chat no tengo acceso para
  //            escribir en tu Google Calendar». `sigueOfrecimiento`: las herramientas se eligen también por el pedido
  //            anterior y por lo que pidió MaKo (lib/doer-herramientas.ts), porque «Nancy» no nombra nada.
  //            ⚠️ Una PREGUNTA no es un dato que se da («¿cuántos leads entraron hoy?» después del «pásame…» es otro
  //            pedido, y en una pregunta MaKo ofrece), ni lo es un pedido sobre un lead o una landing.
  if (ctx.siguePedidoDeAgenda && t.length <= 200 && !esLista(t) && cuentaLinks(t) === 0 && !NEGATIVA.test(t) && !PREGUNTA.test(t) && !pedidoLead && !pedidoLanding) {
    return { intencion: 'actuar', dudosa: false, porque: 'le da los datos que MaKo pidió para un pedido de agenda', sigueOfrecimiento: true, areas: ['crm'], relevancia: RELEVANCIA_AGENDA };
  }

  // 3-bis-ya) DICE QUE YA HIZO ALGO (17/10/2026, ver `YA_HECHO`): cerrar la tarea del Plan, no anotar una nueva.
  //          Un pedido concreto que viene detrás («ya quedó lista, publicá la landing») es ESE pedido: gana su regla.
  if (YA_HECHO.test(nPersona) && t.length <= 200 && !PREGUNTA.test(t) && !esLista(t) && !pedidoLanding && !pedidoLead && !pedidoCobro && !pedidoAgenda) {
    return { intencion: 'actuar', dudosa: false, porque: 'dice que ya hizo algo: se ofrece cerrar su tarea del Plan', areas: ['plan'], relevancia: RELEVANCIA_YA_HECHO };
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

  // 3-ter-promesa) LE RECLAMA LO QUE MaKo PROMETIÓ. EL CASO (13/10/2026, ws13): «MaKo pasame todas las reuniones que
  //               tengo hoy» → (la IA no contestó) → «ok» → «Eso lo miro y te lo paso.» → «Pasamelo» → capturar, dudosa,
  //               sin herramientas → «no tengo acceso a la lista de reuniones de hoy». «Pasamelo» no nombra nada: lo que
  //               pide es lo que MaKo dijo que iba a hacer, y llega con la intención de ESE pedido y sus herramientas.
  //               Corto y sin un «no»: «no, dejá» no reclama nada. Va antes del pedido sobre un lead: «pasamelo» es
  //               también un verbo del CRM pegado a un pronombre.
  if (ctx.pedidoPrometido && ctx.pedidoPrometido !== 'charlar' && t.length <= 80 && !esLista(t) && cuentaLinks(t) === 0 && !NEGATIVA.test(t)) {
    return { intencion: ctx.pedidoPrometido, dudosa: false, porque: 'le reclama a MaKo lo que le prometió', sigueOfrecimiento: true, reclamaPromesa: true };
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

  // 3-quinquies) UN VOLCADO QUE PREGUNTA NO ES UN VOLCADO (29/10/2026, Leandro, ws10). «sumo tres cosas al mensaje de recién:
  //   1. … 2. … 3. …» con seis preguntas adentro («¿Se puede, y en qué campo queda?», «¿Lo hace la tarjeta «Acción»?», «¿Hay
  //   algo pensado?»): la lista lo hacía dictado (regla 4), capturar, y MaKo le contestó «Listo, te armé el borrador» con un
  //   link a /plan/revisar. Una pregunta nunca es una carga de tareas: con dos o más, es una consulta. Con una sola, el dictado
  //   sigue («Ideas: webinar, reels, ¿y un podcast?» es un volcado). Lo explícito («anotá esto: …», regla 2) ya ganó arriba.
  if (dictado && cuantasPreguntas(t) >= 2) {
    return { intencion: 'consultar', dudosa: false, porque: 'trae preguntas: una pregunta no es una carga de tareas', ...deLaApp };
  }

  // 4) Dictado SIN imperativo → captura. Es el caso del bug, y es el 90% de lo
  //    que el dueño manda al grupo: un volcado de ideas para revisar después.
  if (dictado && !pedido) {
    return { intencion: 'capturar', dudosa: false, porque: 'título en infinitivo / encabezado de volcado, sin pedido a MaKo' };
  }

  // 5) Dictado Y además un imperativo. Acá SÍ hay dos lecturas y ninguna es
  //    obviamente la buena. Gana capturar —perder el material es el error caro—
  //    pero se marca dudosa para que MaKo ofrezca la otra en una línea.
  if (dictado && pedido) {
    // En la app no hay dos lecturas: MaKo propone y la persona confirma (D1 = A, `canal`).
    if (ctx.canal === 'app') return { intencion: 'actuar', dudosa: false, adivina: true, ...deLaApp, porque: 'canal app: trae material y un verbo en imperativo; propone con tarjeta' };
    return { intencion: 'capturar', dudosa: true, alternativa: 'pensar', porque: 'trae material dictado y también un verbo en imperativo' };
  }

  // 5-bis) UN PEDIDO SOBRE UNA LANDING del Web Generator: publicarla, despublicarla, crearla, replicar una de afuera o
  //        analizarla (ver `esPedidoDeLanding`; tanda 7, 15/10/2026). Va DESPUÉS del dictado —«Publicar la landing del
  //        webinar» es una tarea dictada— y ANTES de los links sueltos (6): «replicá esta página https://…» es un link
  //        con una orden, y la 6 lo guardaba como material. Y antes de la automatización y de la agenda por lo mismo que
  //        ellas: «¿me puedes publicar la landing?» termina en «?». Lleva el área: «replicá https://…» no la nombra.
  if (pedidoLanding) {
    // En la app, además, las palabras de la operación que la familia del pedido sabe («mover una sección», «el link del VSL»):
    // 'landings creadas' sola deja a la operación concreta afuera del presupuesto.
    return { intencion: 'actuar', dudosa: false, porque: `pedido sobre una landing (${pedidoLanding.tipo})`, areas: ['landing'], relevancia: `${RELEVANCIA_LANDING[pedidoLanding.tipo]}${fam?.relevancia ? ` ${fam.relevancia}` : ''}` };
  }

  // 6) Solo links, sin una frase que diga qué hacer con ellos. Mandar un link
  //    pelado es guardarlo: si quisiera que MaKo lo mire, lo diría.
  //    (En la app un verbo de hacer con el link —«cargá la grabación de Fathom de Juan: https://…»— es una orden.)
  if (links > 0 && !pedido && !(ctx.canal === 'app' && (pideHacerAlApp(t) || fam?.actua)) && n.replace(/https?:\/\/\S+/g, '').trim().length < 60) {
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

  // 6-quater) EN LA APP, UN VERBO DE HACER AL ARRANQUE («creame…», «mandale…», «poné…», «quiero crear…», «¿podés cambiar…?»)
  //           es un pedido: MaKo propone con una tarjeta. Va antes de 7 y de 8: «¿podés cambiar la hora?» termina en «?» y
  //           «mandá un mail» está en `IMPERATIVO` (pensar, que no escribe). Ver lib/mako-intencion-app.ts.
  //           ⚠️ Una familia sola (`fam.actua`, sin verbo de hacer) NO es una orden: «ahí hice la prueba con el reel de hoy», «sos una
  //           estrella», «el link de la agenda no anda» caen en una familia y son un comentario o una queja. Va con `adivina`: la
  //           familia pone el área y la búsqueda en todo el registro, y la adivinanza no crea un borrador del plan (el bug del 25/08).
  if (ctx.canal === 'app' && (pideHacerAlApp(t) || fam?.actua)) {
    return { intencion: 'actuar', dudosa: false, ...(pideHacerAlApp(t) ? {} : { adivina: true }), ...deLaApp, porque: pideHacerAlApp(t) ? 'canal app: pide hacer algo; propone con tarjeta' : 'canal app: nombra algo que se hace, sin pedirlo; propone con tarjeta' };
  }

  // 7) Escritura sobre la cuenta.
  if (ACCION_CUENTA_RE.test(t)) {
    return { intencion: 'actuar', dudosa: false, ...deLaApp, porque: 'verbo de acción sobre la cuenta' };
  }

  // 8) Pregunta por un dato. Gana sobre el imperativo («decime cuántos leads
  //    entraron») porque el contrato es el mismo y el tier es más barato: sin
  //    esto, cada «decime…» se iba a Opus.
  if (PREGUNTA.test(t) || (pedido && INTERROGATIVO.test(t)) || (LUGAR_GOOGLE.test(nPersona) && QUE_PUEDE.test(nPersona))) {
    return { intencion: 'consultar', dudosa: false, porque: 'pregunta por un dato', ...deLaApp };
  }
  // 8-bis) Pedido de datos sin forma de pregunta («un reporte de mis resultados de
  //        junio»). Va DESPUÉS del dictado (4-6): «Idea: un reporte de resultados para
  //        clientes» sigue siendo material para guardar. Ver PEDIDO_DATOS.
  //        Y solo en un mensaje CORTO: pedir un reporte es una línea, no un volcado.
  if (t.length <= 280 && PEDIDO_DATOS.test(n)) {
    return { intencion: 'consultar', dudosa: false, porque: 'pide un reporte o sus números', ...deLaApp };
  }

  // 9) Imperativo dirigido a MaKo, o media adjunta → hacerlo ahora.
  if (pedido || ctx.hayMedia) {
    return { intencion: 'pensar', dudosa: false, porque: ctx.hayMedia ? 'adjunto para interpretar' : 'imperativo dirigido a MaKo', ...deLaApp };
  }

  // 9-bis) Un «sí/dale» suelto SIN nada esperando no es material: es ruido de
  //        charla. Capturarlo intentaría parir una tarea de la nada (lo frena
  //        `pareceConfirmacion` río abajo, pero llegar hasta ahí ya es un gasto).
  //        Una QUEJA no (27/10/2026): «No me deja guardar el lead» arranca con «no» y no es charla.
  if (CONFIRMACION.test(t) && t.length <= 60 && !QUEJA_NO_ANDA.test(t)) {
    return { intencion: 'charlar', dudosa: false, porque: 'confirmación sin nada pendiente' };
  }

  // 10) No se pudo clasificar. Se CAPTURA, que es el default que no pierde nada,
  //     y se avisa. El default viejo era «mandale todas las tools y que el modelo
  //     vea»: eso es lo que producía dos resultados distintos para el mismo
  //     mensaje.
  //     EN LA APP no: ahí el default es proponer con una tarjeta (D1 = A). Medido el 20/10/2026 con el turno real, lo que
  //     no se reconocía caía acá y llegaba con sólo `ver_plan` y `listar_pendientes`: CRM 41 de 91, núcleo 23 de 40.
  if (ctx.canal === 'app') {
    // Un acuse o un saludo que el clasificador no conoce («bueno», «entendido», «buenas tardes») no es un pedido: charla, sin herramientas.
    const acuse = n.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    // «me parece bien», «vale», «está bien», «bueno» a «¿querés que pase a Rosana a Agendado?» SON el sí (los acuses no están en CONFIRMACION).
    if (ctx.makoPregunto && ACUSE_QUE_ACEPTA.test(acuse)) return { intencion: 'actuar', dudosa: false, porque: 'canal app: acepta lo que MaKo le acaba de ofrecer', sigueOfrecimiento: true };
    if (ACUSE_DE_LA_APP.test(acuse)) return { intencion: 'charlar', dudosa: false, porque: 'canal app: acuse o saludo' };
    return { intencion: 'actuar', dudosa: false, adivina: true, ...deLaApp, porque: 'canal app: sin señal clara; propone con tarjeta' };
  }
  // EN EL GRUPO, el default se decide DESPUÉS de seguir el hilo (lib/doer-hilo.ts, `enElGrupoSinSenal`): `sinSenal` lo marca.
  return { intencion: 'capturar', dudosa: true, alternativa: 'pensar', porque: 'sin señal clara: se guarda para no perderlo', sinSenal: true };
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
  // El ticket lo abre el código (lib/mako-doer-in.ts), sin turno del modelo: ninguna herramienta.
  ticket:    { tools: [], forzarTool: false, exigeBorrador: false },
  // Sólo lecturas: las de su área y la que mira OTRO negocio (`diagnosticar_negocio`); las suma lib/doer-herramientas.ts.
  debug:     { tools: null, forzarTool: false, exigeBorrador: false },
  no_reply:  { tools: [], forzarTool: false, exigeBorrador: false },
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
import { OBJETO_REEMBOLSO, pideHacerAlApp, familiasDe } from './mako-intencion-app';

export const AREA_KEYWORDS: Readonly<Record<Area, RegExp>> = {
  general: /\b(objetivos?|metas? del (mes|trimestre)|kpis?|sem[aá]foro|c[oó]mo (voy|vamos|va el negocio)|trimestre)/i,
  // `visita`, `cita` y `calendario`: un negocio inmobiliario no agenda «reuniones», agenda
  // VISITAS, y sin esto «pasá la visita de Juan al viernes» no traía ni una tool de agenda
  // (07/10/2026). Y `reagend` aparte porque `\bagend` NO matchea «reagendá»: entre «re» y
  // «agend» no hay borde de palabra.
  // `evento` y «qué tengo hoy / a las 12»: es como se pregunta por el día en la agenda de
  // Google («Y a las 12hs que tengo?», ws13, 08/10/2026), y sin esto no viajaba agenda_del_dia.
  crm: /\b(leads?|contactos?|prospectos?|etapas?|funnel|embudo|agend|reagend|reuni[oó]n|visitas?|citas?|calendario|calendar\b|gcal\b|evento\b|qu[eé] tengo (?:hoy|ma[ñn]ana|el |esta|a las)|a las \d{1,2}\S* qu[eé] tengo|huecos?|horarios?\s+(?:\S+\s+){0,2}libres?|libres?\s+(?:el|la|este|esta|ma[ñn]ana|hoy|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b|disponibilidad|r1|r2|juntas?|calific|pipeline|ficha)/i,
  plan: /\b(tareas?|plan\b|tablero|proyectos?|checklist|deadline|perro guardi)/i,
  ads: /\b(campa[ñn]as?|anuncios?|ads\b|meta ads|presupuesto|adsets?|conjuntos?|creativos?|pauta|cpl|cpm|ctr|guion(es)? de anuncio)/i,
  // La bandeja unificada (14/10/2026): «quién me escribió», los chats sin responder, cerrar o posponer uno, y los DMs
  // de Instagram y Messenger, que no tienen otra área. «conversación» trae también la de WhatsApp: las dos contestan
  // (la de Chats junta los tres canales por contacto). «reabrir» y «posponer» atados a chat/conversación: solos son
  // de una tarea del Plan o de una reunión.
  // ⚠️ SIN las palabras de MANDAR (revisión del 21/10/2026): la 2.1 las había sumado acá y esta rueda es COMPARTIDA con el
  // grupo de WhatsApp y el ruteo de pedidos (lib/mako-pedidos.ts): cambiaba 5.108 turnos de WhatsApp y 98 links del Ops
  // Center. Los envíos van sólo por la app, y en la app las trae el clasificador de la 1.2 (`canal: 'app'`).
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
  // «no-shows», «asistencia», «sin marcar» (27/10/2026, Código Inmobiliario): sin ellas, «¿cuántos no-shows tuve?» no
  // nombraba el área y `listar_leads_embudo_maduro` (los nombres detrás del número) no viajaba nunca.
  metricas: /\b(no[- ]?shows?|asistencias?|sin marcar|m[eé]tricas?|n[uú]meros|inversi[oó]n|gast[oóé]|cac\b|roas|dashboard|ingresos?|facturaci|cu[aá]nto (vend|invert|gast|cobr)|cascada|gr[aá]ficos?|hojas?\b|informes?\b|plantillas? (?:de |del |para )?(?:la |una |mi )?(?:hoja|dashboard|informe|marketing|comercial|closing|landing|productividad|ads analyst)|ai analyst|an[aá]lisis de (?:la|mi|una) hoja)/i,
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
  // 25/10/2026 (docs/conexiones-y-ayuda.md): «¿cómo conecto…?», «mi Claude», «la app de escritorio», Zernio o una clave de
  // IA traen `como_conectar` y `ver_ia_del_negocio`. Antes no reconocía «conectar» y todavía nombraba el inbox oficial que se
  // retiró el 09/10. «instagram» o «facebook» solos no: van en cada pedido de anuncios, y el presupuesto del registro es uno.
  // ⚠️ Después de «conect…» va un lookahead y no `\b`: el `\b` de JavaScript es ASCII, y tras «conecté» no hay borde.
  integraciones: /\b(integraci[oó]n(es)?|conect(ar|o|e|é|ado|ada|ados|adas|arlo|arla|arme|amos)(?![a-záéíóúñ])|conexi[oó]n(es)?|desconect|calendly|resend|google calendar|salud de meta|access token|token de meta|keys? de ia|claves? de (ia|api|openai|claude|gpt)|api key|zernio|chat ?gpt|\bgpt\b|mi claude|mako desktop|app de escritorio)/i,
  equipo: /\b(equipo|usuarios?|roles?\b|setters?|notificaci[oó]n(es)?|reportes? (diario|semanal)|zona horaria)/i,
  cs: /\b(customer success|cartera|programa|alumnos?|clientes? activos?)/i,
  // El área «curso» sale SÓLO por HTTP (lib/api-mako/areas/curso.def.ts): nombrarla no le suma
  // ninguna herramienta al doer. Está para que la tabla cubra todas las áreas.
  curso: /\b(m[oó]dulos? del curso|clases? del curso|armar (el|un) curso|migrar (el|un) curso)/i,
  // El área «comunidad» también sale SÓLO por HTTP (lib/api-mako/areas/comunidad.def.ts): nombrarla no le suma ninguna
  // herramienta al doer. Está para que la tabla cubra todas las áreas, y es ANGOSTA a propósito: «automatizaciones de la
  // comunidad» es de `creaciones` (arriba) y no tiene por qué sumar esta.
  comunidad: /\b(posts? de la comunidad|miembros de la comunidad|ranking de la comunidad|categor[ií]as de la comunidad)/i,
  // Las creaciones publicadas y sus estrellas (13/10/2026). «plantilla» sola NO: es de WhatsApp y del Dashboard.
  creaciones: /\b(creaciones?|estrellas?|galer[ií]a|publicar (?:mi|la|una|esta) automatizaci[oó]n|automatizaci[oó]n(?:es)? de (?:otros|la comunidad)|lo que publicaron)/i,
  // La pasarela de pagos (11/10/2026). Sin «pago» suelto, a propósito: «los pagos de Ana» son sus
  // CUOTAS del CRM (cobranza_lead, área crm), y sumar esta área a cada pregunta de cobranza gastaría
  // presupuesto en herramientas que no son.
  // Los datos fiscales del trato (27/10/2026, la constancia fiscal de Leila): `editar_dato_deal` es de cobros y no llegaba nunca.
  cobros: /\b(cobros?\b|cobrar|links? (de|para) (pago|cobro|pagar)|checkout|stripe|mercado ?pago|reembols|devoluci[oó]n|suscripci[oó]n(es)?|pasarelas? de pago|datos? fiscal(es)?|(constancia|situaci[oó]n|r[eé]gimen|domicilio) (de situaci[oó]n )?fiscal|raz[oó]n social|rfc\b|cuit\b|datos de facturaci[oó]n|deal details?)/i,
  // El Calendario (13/10/2026): lo que se agenda en la tab (publicaciones, bloques de trabajo). «calendario» también
  // trae la agenda del CRM (arriba): las dos áreas contestan cosas distintas del mismo día.
  calendario: /\b(calendario|publicaci[oó]n(es)? (?:de|para) (?:la semana|ma[ñn]ana|hoy|el)|programa(?:r|me|lo)? (?:un |una |el |la )?(?:reel|story|post|publicaci)|agend(?:ar|a|ame|alo) (?:un |una |el |la )?(?:reel|story|post|publicaci[oó]n|bloque)|bloques? de (?:trabajo|foco))/i,
  // «¿qué me recomiendas?», «dame un consejo», «¿qué debería mejorar?» (26/10/2026, MaKo recomienda): traen `que_recomienda_mako`
  // (y la corrección, `decidir_recomendacion`, cuando la regla 3-bis-rec la marca como acción). Las raíces, sin el final: «recomendás»,
  // «recomiendes», «sugerencia», «sugieres».
  mako: /\b(pendientes?|propuestas?|qu[eé] (pod[eé]s|puedes) hacer|capacidades|aprender? solo|recomend|recomiend|suger|sugier|consejos?\b|qu[eé] (?:deber[ií]a|tendr[ií]a que) (?:mejorar|cambiar|hacer))/i,
  // El Centro de Operaciones (15/10/2026): sólo dos LECTURAS y sólo para la plataforma (`soloPlataforma`), así que
  // nombrarlas desde un cliente no le suma nada (lo saca `gatingOk`). Para Martín sí: «¿cómo van mis pedidos del centro?»,
  // «¿pasó el cartero?». Palabras propias y nunca «pedido» suelto, que en un negocio es un pedido de un cliente.
  // Desde el 15/10/2026 el cartero se llama Runner en pantalla (lib/runner.ts): «¿está andando el runner?».
  // MANDAR un pedido no está en el registro (exige la firma del dispositivo): no hay palabra que lo traiga.
  // Y las aprobaciones de las apps de MaKo (4/11/2026, `ver_aprobaciones_pendientes`): «¿qué aprobaciones tenemos pendientes?»,
  // «¿ya aprobó Apple?». Sólo palabras de TIENDAS y de revisión de apps: «aprobación» suelta es también la de un anuncio (área ads).
  operaciones: /\b(centro de operaciones|carteros?\b|runners?\b|cola de (?:pedidos|trabajos)|(?:pedidos?|trabajos?) (?:a|al|para|de|del) (?:los |mis |un |el |la )?(?:chats?|centro)\b|chats? de claude|aprobaciones? (?:pendientes?|de (?:las |la )?(?:tiendas?|apps?))|app ?store\b|play ?store\b|google play\b|play console\b|testflight\b|chrome web ?store\b|app review\b|revisi[oó]n de (?:la )?(?:app|tienda|extensi[oó]n)\b|(?:ya )?aprob[oó] (?:apple|google|meta)\b)/i,
  // Competitors Spy (31/10/2026). ⚠️ ES ANGOSTA A PROPÓSITO, y no por prolijidad: el registro entra
  // al turno hasta un presupuesto de 12.000 caracteres y las lecturas del área ANCLADA se suman
  // arriba de eso. Los turnos más pesados del repo son los de anuncios y campañas
  // («agrega un anuncio al conjunto», medido a 164 caracteres del tope en
  // tests/ops-center-clasificador-app.test.ts): una palabra como «anuncio» o «campaña» acá metería
  // las seis operaciones del spy en esos turnos y rompería ese test. Por eso sólo entran las
  // palabras que NO significan otra cosa en MaKo — «competidor», «competencia», «espiar», «vigilar
  // a» — y ni una del vocabulario de pauta.
  spy: /\b(competidor(es)?|competencia\b|competitor|espi(?:a|ar|ame|alo)\b|vigil(?:a|ar|ame|alo) a\b|qu[eé] (?:est[aá]n? haciendo|public[oó]) (?:mi |la |el |los )?(?:competencia|competidor))/i,
  // El Lead Magnet Generator (5/11/2026). ANGOSTA como la del spy y por lo mismo: sólo lo que en MaKo no significa otra cosa
  // («lead magnet», «imán de leads», «freebie»). «Guía», «checklist» o «regalo» solas son palabras del Copywriter y de los
  // anuncios, y meterían las cinco operaciones del área en esos turnos.
  leadmagnet: /\b(lead ?magnets?|im[aá]n(?:es)? de (?:leads|clientes|contactos)|freebies?)\b/i,
};

/** Las áreas que nombra un mensaje, en el orden de la tabla. Vacío = ninguna. */
export function areasDelMensaje(texto: string): Area[] {
  const t = (texto || '').slice(0, 4000);
  return (Object.keys(AREA_KEYWORDS) as Area[]).filter((a) => AREA_KEYWORDS[a].test(t));
}
