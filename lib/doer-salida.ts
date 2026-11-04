// =============================================================================
// doer-salida — lo que MaKo NO puede mandar al grupo de un cliente, leído en su respuesta
// =============================================================================
// Dos cosas que el prompt pide y el modelo igual hace (medido el 16/10/2026 en el grupo del
// ws18, Pablo Chavez, con Gemini flash-lite):
//
//   1. PROMETER LO QUE NO HACE. «Déjame ver el plan y las tareas para Pablo en este momento»
//      y «Déjame revisar primero el tablero… y te cargo las tareas»: el turno tenía `ver_plan`
//      y `listar_tareas_plan` en la mesa, el modelo contestó en 28 tokens sin llamar a ninguna,
//      y el doer lo mandó. Una respuesta del doer es el FINAL del turno: no hay un «después» en
//      el que MaKo vuelva con el dato. Una promesa así es una mentira con fecha.
//   2. GROSERÍAS. «la cagada es real», «quedé como un vendehumo», «para no clavarte», «bótame»,
//      «sin que lo caguen». La persona de MaKo (lib/mako-persona.ts) dice «puedes putear suave»,
//      que es la voz de Martín hablándose a sí mismo, y se filtró al grupo de un cliente, que
//      también lee su equipo.
//
// Es la segunda capa de «una regla en un prompt no es una regla» (AGENTS.md): el prompt del
// doer lo pide (lib/mako-doer-in.ts, DOER_WA_VOZ), y esto lo mira al salir. NO reescribe:
// saca la ORACIÓN entera, porque reemplazar palabras a mano rompe la frase.
//
// PURO y sin `server-only`: lo usan el doer, el vigía (lib/vigia-mako-grupos.ts) y los tests.
// =============================================================================

/** Sin tildes y en minúsculas: las regex de abajo se escriben así. */
const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ⚠️ Límites de palabra por Unicode, no `\b`: en JavaScript `\b` es ASCII y en «bótame» no hay
// borde después de la «ó» (AGENTS.md, «La voz de MaKo es rioplatense»). Igual todo se prueba
// sobre el texto SIN tildes, donde `\b` alcanza.
// Sin «creo» («te creo», «ya lo creo») ni «paso» («te paso el link» suele traer el link).
// «aviso», «arreglo», «resuelvo», «soluciono»: «ya le aviso al equipo y te lo arreglo» (17/10/2026, la rotura del test del
// ticket) es una promesa que el turno no cumple, y no la veía nadie.
const VERBOS_ACCION = 'busco|reviso|cargo|anoto|agendo|armo|chequeo|averiguo|preparo|consulto|aviso|arreglo|resuelvo|soluciono|miro';
const PROMESAS: RegExp[] = [
  // «déjame ver / revisar / chequear…», «dejame que lo mire»
  /\bdeja(?:me|nos)\s+(?:que\s+)?(?:ver|revisar|chequear|buscar|mirar|fijarme|consultar|confirmar|cargar|armar|agendar|anotar|preparar|averiguar|lo\s+\w+|la\s+\w+)\b/,
  // «dame un segundo», «dame unos minutos»
  /\bdame\s+(?:un|unos)\s+(?:segundo|segundito|momento|momentito|minuto|minutito)s?\b/,
  // «ya te lo busco», «ahora lo reviso», «enseguida te cargo»
  new RegExp(`\\b(?:ya|ahora|enseguida|al toque|en un (?:momento|minuto|rato|segundo))\\s+(?:(?:te|lo|la|los|las|se|me|le|les)\\s+){0,2}(?:${VERBOS_ACCION})\\b`),
  // «te cargo las tareas», «te lo agendo», «te armo el plan» (presente con valor de futuro)
  new RegExp(`\\bte\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_ACCION.replace('|miro', '')})\\b`),
  // «voy a revisar», «voy a cargarte»
  /\bvoy\s+a\s+(?:revisar|ver|cargar|buscar|mirar|agendar|crear|armar|anotar|chequear|consultar|averiguar|preparar|fijarme)\w*/,
  // «lo miro y te paso», «lo reviso y te aviso»
  /\b(?:lo|la|eso)\s+(?:miro|reviso|busco|chequeo|averiguo|veo)\s+y\s+te\b/,
  // «estoy revisando», «me pongo a buscar»
  /\b(?:estoy|me pongo a)\s+(?:revisando|buscando|mirando|cargando|armando|chequeando|consultando|ver|buscar|revisar|cargar|armar)\b/,
];

/**
 * ANUNCIAR UNA ESPERA (24/10/2026): «dame un rato», «en breves te digo», «te contesto en un rato», «lo analizo y te digo».
 * Desde el pedido de Martín de ese día la espera la dice el CÓDIGO, antes de la respuesta y sólo si el turno lleva tiempo
 * (lib/doer-acuse.ts). En la respuesta del modelo es siempre una promesa sin cumplir: la respuesta ES el final del turno,
 * corrieran o no herramientas. ⚠️ Van AL FINAL de `PROMESAS` (no en el medio): `promesasFirmesDe` elige las suyas por
 * índice. Sin tildes, como todo acá.
 */
const VERBOS_DECIR = 'digo|contesto|respondo|cuento|paso|aviso|escribo|mando|confirmo|comparto|envio';
const ESPERAS: RegExp[] = [
  // «dame un rato», «dame unos minutos» (el «dame un segundo» de arriba, con el rato)
  /\bdame\s+(?:un|unos)\s+(?:segundo|segundito|momento|momentito|minuto|minutito|rato|ratito)s?\b/,
  // «en breves te digo», «en breve, te lo paso»
  new RegExp(`\\ben\\s+breves?\\b(?:[\\s,]+\\S+){0,3}?[\\s,]+(?:te|les?)\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_DECIR})\\b`),
  // «te contesto en un rato», «te lo paso enseguida»
  new RegExp(`\\b(?:te|les?)\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_DECIR})\\s+(?:en\\s+breves?|en\\s+un\\s+(?:rato|ratito|momento|momentito|segundo|minuto|toque)|en\\s+unos\\s+minutos|enseguida|al\\s+toque)\\b`),
  // «lo analizo y en breves te digo», «lo veo y te cuento»
  new RegExp(`\\b(?:lo|la|los|las|eso)\\s+(?:analizo|estudio|pienso|proceso|reviso|miro|veo|chequeo|armo|preparo)\\s+y\\s+(?:en\\s+breves?\\s+|enseguida\\s+|ahora\\s+|despues\\s+|luego\\s+)?(?:te|les?)\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_DECIR})\\b`),
  // «ya te contesto», «ahora te respondo»
  /\b(?:ya|ahora|enseguida)\s+(?:te\s+)?(?:contesto|respondo)\b/,
];
PROMESAS.push(...ESPERAS);
/**
 * Lo que NO puede cerrar la respuesta de un turno que SÍ corrió herramientas (24/10/2026, `esperasAlFinal`): una espera, o
 * la promesa de algo que se está haciendo «ahora» («déjame ver el detalle», «estoy revisando lo demás»). ⚠️ Ni «te cargo
 * las tareas» ni «voy a crear la reunión»: con herramientas corridas pueden ser el paso siguiente honesto, el que deja una
 * pendiente que el «sí» ejecuta (la regla del 17/10/2026, ver `sanearSalida`).
 */
const NO_CIERRA: RegExp[] = [PROMESAS[0], PROMESAS[6], ...ESPERAS];

/**
 * Lo que dice HECHO (20/10/2026, ola 1, pieza 1.5): «Listo, ya lo armé», «te creé la automatización», «quedó programado».
 * Sólo con la primera persona o con «quedó»: «tu landing está publicada» puede ser un dato del contexto, y se deja. Sin
 * tildes. Si es mentira lo decide quien llama (`RespaldoDeHecho`): la frase sola no lo dice.
 */
const VERBOS_HECHO = 'arme|cree|cargue|agende|mande|envie|hice|publique|cambie|movi|borre|guarde|configure|programe|deje|anote|actualice|subi|edite|agregue|elimine|active|pause|prendi|apague|inscribi|asigne';
/** En primera persona: MaKo dice que LO HIZO él. */
const HECHO_POR_MI: RegExp[] = [
  // «ya lo armé», «ya te lo agendé», «ya quedó»
  new RegExp(`\\bya\\s+(?:(?:te|lo|la|los|las|se|le|les)\\s+){0,2}(?:${VERBOS_HECHO})\\b`),
  // «Listo, armé…», «Hecho: te lo cargué»
  new RegExp(`\\b(?:listo|hecho)\\s*[,.:!]?\\s+(?:(?:te|lo|la|los|las|se|le|les)\\s+){0,2}(?:${VERBOS_HECHO})\\b`),
  // «te creé la automatización», «te dejé armado»
  new RegExp(`\\bte\\s+(?:(?:lo|la|los|las)\\s+)?(?:${VERBOS_HECHO})\\b`),
];
/** Un ESTADO: «quedó programada», «quedaron cargadas». Puede ser lo que MaKo leyó. */
const QUEDO_HECHO = /\bqued(?:o|aron)\s+(?:ya\s+)?(?:cread|hech|armad|cargad|programad|guardad|agendad|enviad|mandad|publicad|actualizad|configurad|listo|lista)\w*/;

/** Lo que el texto dice HECHO, tal como aparece. Vacío = no dice nada hecho. `soloPorMi`: sin el «quedó …». */
export function afirmaHechoDe(texto: string, { soloPorMi = false }: { soloPorMi?: boolean } = {}): string[] {
  const t = norm(texto);
  return [...HECHO_POR_MI, ...(soloPorMi ? [] : [QUEDO_HECHO])].flatMap((re) => t.match(re)?.[0] ?? []);
}

/**
 * Los pretéritos de PRIMERA persona de lo que MaKo puede decir que hizo, CON tilde: sin ella, «mande», «agende» o «cree» son
 * también subjuntivo («¿querés que te mande el resumen?»), y la tercera revisión los vio llevar la nota en las ofertas con
 * las que MaKo propone cada acción. «hice» no tiene otro tiempo igual. «dejé» va aparte (`DEJE_HECHO`).
 */
const PRETERITOS = 'mandé|envié|agendé|creé|armé|cargué|publiqué|cambié|moví|borré|guardé|configuré|programé|anoté|actualicé|subí|edité|agregué|eliminé|activé|pausé|prendí|apagué|inscribí|asigné|cancelé|confirmé|respondí|escribí|marqué|reprogramé|avisé|hice|abrí|registré|reporté|levanté|notifiqué';
const PRETERITO = new RegExp(`(?<!\\p{L})(?:${PRETERITOS})(?!\\p{L})`, 'u');
/** «te dejé agendada la reunión» dice hecho; «te dejé la tarjeta» habla de lo que dejó para confirmar. */
const DEJE_HECHO = /(?<!\p{L})dejé(?:\s+\p{L}+){0,2}\s+\p{L}+(?:ad|id)[oa]s?(?!\p{L})/u;
/**
 * LO QUE EL GRUPO CORTA (27/10/2026): los participios de lo que MaKo puede decir que HIZO, los de `PRETERITOS`. Con
 * cualquier participio, «He encontrado 2 reuniones», «He consultado tu CRM» o «Te dejo detallados los 3 leads» (lo que el
 * turno LEYÓ: la respuesta) salían como «Eso no lo llegué a hacer» (la revisión adversarial de 92d23e11d). Precisión antes
 * que cobertura, como el resto de este archivo.
 * «hecho», «abierto» y «escrito» dependen de QUÉ (la de 36e06b35f y su verificación): «He hecho una búsqueda en tu CRM», «He
 * abierto tu agenda y mañana tienes 2» o «He escrito un resumen de la llamada» cuentan una LECTURA; «He hecho el cambio de
 * etapa», «He abierto un ticket para el equipo», «Te abrí la reunión» o «He escrito un mensaje a Juan» dicen una ESCRITURA,
 * y se cortan. Sacarlos de la lista entera (36e06b35f) dejó pasar estas últimas.
 */
const PARTICIPIO_ESCRITO = String.raw`(?:(?:mand|envi|agend|cre|arm|carg|public|cambi|borr|guard|configur|program|anot|actualiz|edit|agreg|elimin|activ|paus|apag|asign|cancel|confirm|marc|reprogram|avis|registr|report|levant|notific)ad|(?:mov|sub|prend|respond)id|inscript|inscrit)[oa]s?`;
/** El artículo o el posesivo, si hay («Abrí Google Calendar» no lleva). */
const ARTICULO = String.raw`(?:(?:una|unas|un|unos|la|las|el|los|tu|tus|su|sus|mi|mis)\s+)?`;
/** Lo que se HACE para leer («una búsqueda», «las cuentas», «los cálculos»): «hecho» o «hice» con esto es una lectura. Nunca
 *  lo que se crea (una campaña, una tarea): eso es escribir. */
// Sin «verificación» (la verificación de 8cb034a18): «He hecho la verificación de tu número» es una escritura.
const LO_QUE_SE_HACE_PARA_LEER = String.raw`${ARTICULO}(?:b[uú]squedas?|cuentas?|revisi(?:ón|on|ones)|an[aá]lisis|consultas?|repasos?|res[uú]men(?:es)?|lecturas?|c[aá]lculos?|chequeos?|comparaci(?:ón|on|ones))(?!\p{L})`;
/** Lo que también se CREA, dicho como creado: «nueva» PEGADO al objeto («la campaña nueva»), y «para el equipo» hasta dos
 *  palabras después sin pasar un «y» («el reporte del error para el equipo»). «La planilla de clientes nuevos» se lee: los
 *  nuevos son los clientes (la verificación de 9cef25dba). */
const LO_CREADO = String.raw`(?!\s+nuev[oa]s?(?!\p{L}))(?!(?:\s+(?!(?:y|e|o|que|pero)(?!\p{L}))[\p{L}\d]+){0,2}\s+para\s+(?:el\s+equipo|soporte|el\s+cliente|tu\s+cliente|ti|todos)(?!\p{L}))`;
/**
 * Lo que se ABRE para leer («la imagen», «el PDF», «tus campañas», «Google Calendar»): «abierto» o «abrí» con esto es leer.
 * La verificación de bb41ede4a: sin «imagen», la respuesta a la foto de Leila («He abierto la imagen y la cuota figura en USD
 * 4235,29») salía como «Eso no lo llegué a hacer». Y la de 8cb034a18: campañas, reportes, chats o planillas también se CREAN.
 * Con el artículo indefinido («He abierto un reporte del error para el equipo», «una campaña nueva en Meta», «una conversación
 * con Juan») o lo creado (`LO_CREADO`), es escribir: sólo «el/la/tu…» o nada lee.
 */
const LO_QUE_SE_ABRE_PARA_LEER = String.raw`(?:(?:la|las|el|los|tu|tus|su|sus|mi|mis)\s+)?(?:agendas?|calendarios?|google\s+calendar|crm|fichas?|informes?|m[eé]tricas?|tableros?|im[aá]gen(?:es)?|imagen|fotos?|capturas?|archivos?|pdfs?|excels?|planillas?|documentos?|chats?|conversaci(?:ón|on|ones)|panel(?:es)?|reportes?|campañas?|campanas?)(?!\p{L})${LO_CREADO}`;
const HECHO = String.raw`hech[oa]s?(?!\p{L})(?!\s+${LO_QUE_SE_HACE_PARA_LEER})`;
/** «hecho» y «abierto», salvo sobre lo que se lee. */
const HECHO_O_ABIERTO = String.raw`(?:${HECHO}|abiert[oa]s?(?!\p{L})(?!\s+${LO_QUE_SE_ABRE_PARA_LEER}))`;
/** Lo que MaKo DEJÓ abierto o que YA QUEDÓ abierto no es lo que leyó: «Te dejé abierta la planilla con los pagos cargados», «Ya
 *  quedó abierta la campaña de Noviembre» (la verificación de 8cb034a18). El «abierto» ahí no tiene excepción. */
const HECHO_O_DEJADO_ABIERTO = String.raw`(?:${HECHO}|abiert[oa]s?(?!\p{L}))`;
/** «te lo dejo anotado», «te dejé agendada la reunión», «te dejé hecho el cambio». */
const DEJE_ESCRITO = new RegExp(String.raw`(?<!\p{L})(?:dejé|dejo)(?:\s+\p{L}+){0,2}\s+(?:${PARTICIPIO_ESCRITO}(?!\p{L})|${HECHO_O_DEJADO_ABIERTO})`, 'u');
/** «He reportado el error al equipo», «le he avisado» (Leila): el pretérito perfecto, en primera persona. «He hecho el cambio»,
 *  «He abierto un ticket», sí; «he hecho una búsqueda», no. */
const HE_HECHO = new RegExp(String.raw`(?<!\p{L})he\s+(?:${PARTICIPIO_ESCRITO}(?!\p{L})|${HECHO_O_ABIERTO})`, 'u');
/** «escrito», sólo con a quién o con lo que se manda: «le he escrito», «he escrito a Juan», «he escrito un mensaje a Juan». */
const ESCRITO_A = /(?<!\p{L})(?:(?:le|les)\s+he\s+escrito|he\s+escrito\s+(?:a|al)\s+\p{L}|he\s+escrito\s+(?:un|el|una)\s+(?:mensaje|correo|mail|email|whatsapp|wpp)(?!\p{L}))/u;
/** Los pretéritos que también cuentan una LECTURA, SOBRE LO QUE SE LEE («Hice una búsqueda en tu CRM», «Abrí tu agenda y
 *  mañana tienes 2»): en el grupo, con una lectura en el turno, no cortan. «Hice el cambio de etapa», «Abrí un ticket» y «Te
 *  abrí la reunión», sí. */
// «Te hice el cálculo» y «Le hice una búsqueda a Juan» son lecturas; «Te abrí la reunión», no (abrirle algo a alguien).
const PRETERITO_DE_LECTURA = new RegExp(String.raw`(?<!\p{L})(?:hice(?=\s+${LO_QUE_SE_HACE_PARA_LEER})|(?<!(?:te|le|les|me)\s)abrí(?=\s+${LO_QUE_SE_ABRE_PARA_LEER}))`, 'gu');
/** «Ya quedó registrado que le escribiste», «ya quedó agendado el recordatorio», «ya quedó abierto el ticket»: con el «ya», MaKo
 *  lo da por hecho; sin él («quedó agendada para el lunes») puede ser lo que leyó, y se deja. */
const YA_QUEDO = new RegExp(String.raw`(?<!\p{L})ya\s+(?:te\s+|le\s+|se\s+|me\s+)?qued(?:ó|o|aron)\s+(?:${PARTICIPIO_ESCRITO}(?!\p{L})|${HECHO_O_DEJADO_ABIERTO})`, 'u');
/** Lo que se HIZO PARA OTRO no es una lectura, aunque sea una consulta o un resumen (la verificación de 8cb034a18): «Le hice una
 *  consulta al equipo de soporte», «Les hice un resumen a todos por mail». «Le hice una búsqueda a Juan» sí lee. */
const A_UN_TERCERO = new RegExp(String.raw`(?<!\p{L})(?:les\s+(?:hice|he\s+hecho)|le\s+(?:hice|he\s+hecho)\s+${ARTICULO}consultas?)(?!\p{L})|(?<!\p{L})(?:hice|hech[oa]s?)(?!\p{L}).*(?<!\p{L})(?:a\s+todos|al\s+equipo|a\s+soporte|por\s+(?:mail|correo|e-?mail))(?!\p{L})`, 'u');
/** «acabo de cargar las 3 tareas»: el pasado reciente, en primera persona. */
const ACABO_DE = /(?<!\p{L})acabo de (?:mandar|enviar|agendar|crear|armar|cargar|publicar|cambiar|mover|borrar|guardar|programar|anotar|actualizar|subir|agregar|eliminar|activar|pausar|cancelar|confirmar|responder|escribir|marcar|reprogramar)(?!\p{L})/u;
/**
 * «Anotado», «queda guardado», «lo recordaré» (27/10/2026, el horario de Leila): MaKo lo dijo dos veces sin escribir nada, y
 * en el chat no hay con qué «recordar». Se mira la oración ENTERA: en «Anotado: X es de 7:30 a 9:30» lo de antes del «:» no
 * presenta nada, ES lo que afirma.
 */
// Sin sujeto (la revisión del 28/10/2026): «La cuota 13 quedó registrada como cobrada» o «Actualizado al día de hoy, tienes 12
// leads» son estados LEÍDOS de los datos, no lo que MaKo dice que hizo. Sólo «Anotado.», «¡Guardado!», «Anotado:»; «(Entendido,)
// queda guardado» al ARRANQUE; y la promesa de recordar (no «lo recuerdo», que puede ser lo que tiene en el hilo).
const HECHO_EN_MEMORIA = /^(?:¡\s*)?(?:anotad|guardad|registrad|corregid|actualizad)[oa]s?(?:\s*[.!:,]|\s+y\s|\s*\p{Extended_Pictographic}|\s*$)|^(?:(?:entendido|listo|perfecto|ok|dale|bien|genial)[,.!]?\s+)?(?:ya\s+)?(?:te\s+|lo\s+|la\s+)?(?:queda|quedan|quedó)\s+(?:anotad|guardad|registrad|corregid|actualizad)[oa]s?(?!\p{L})|(?<!\p{L})(?:lo|la|los|las)\s+(?:recordaré|tendré en cuenta|tengo en cuenta|recuerdo para (?:la próxima|después|mañana))(?!\p{L})/u;
/** La parte de `HECHO_EN_MEMORIA` que puede ser lo que el turno LEYÓ («el pago quedó registrado el 5/10»): el grupo la deja con
 *  una lectura en el turno (`afirmacionesDeHecho`, `enElGrupo.leyo`). */
const QUEDO_EN_MEMORIA = /(?<!\p{L})(?:queda|quedan|quedó)\s+(?:anotad|guardad|registrad|corregid|actualizad)[oa]s?(?!\p{L})/u;
/** Lo que deja una oración sin afirmar: una negación («no te agendé»), o hablar de lo que quedó para confirmar. */
const NIEGA = /(?<!\p{L})(?:no|nunca|tampoco|ni)(?!\p{L})/u;
// «confírmala», «para confirmar», «revísala»: lo que habla de confirmar; «confirmé» y «revisé» dicen hecho, y no entran.
// «arriba»: «como te mandé arriba» habla de lo que está en el mismo mensaje.
const DE_LO_PROPUESTO = /(?<!\p{L})(?:abajo|arriba|tarjeta|borrador|propuesta|conf[ií]rm(?!é)\p{L}*|rev[ií]s(?!é)\p{L}*)(?!\p{L})/u;
/** Una oración que empieza poniendo una CONDICIÓN («si ya te mandé el link…», «en cuanto me pases el CSV, voy a…»). */
const CONDICION = /^[\s¡¿«"“(]*(?:si|cuando|en cuanto|apenas)(?!\p{L})/u;

/**
 * El texto con lo que NO es de MaKo TAPADO (la cuarta revisión, 21/10/2026): lo que va entre comillas («…», “…”, "…") y
 * las líneas que citan («> …»). Lo que dijo un lead, un borrador para mandar, un copy en primera persona: no dicen que
 * MaKo hizo nada. No es una regla de palabras: es no leer el texto de otro. Tapado y no sacado (la quinta revisión): cada
 * letra va a «_» y el texto queda del mismo largo, para cortar las oraciones sin partir una cita y para mirar, en la
 * misma oración, lo que la cita dice.
 */
function taparLoCitado(texto: string): string {
  const tapar = (m: string) => m.replace(/[^\n]/g, '_');
  return texto.split('\n').map((l) => (/^\s*>/.test(l) ? tapar(l) : l)).join('\n')
    .replace(/«[^»]*»/g, tapar).replace(/“[^”]*”/g, tapar).replace(/"[^"\n]*"/g, tapar);
}

/** Una oración: `propia` con lo citado tapado (lo que MaKo dice), `tal` como está, y `desde`, dónde empieza en el texto. */
type Oracion = { propia: string; tal: string; desde: number };

/** Las oraciones del texto (por línea, y en «. », «! », «? », «… »), cortadas sobre el texto tapado. */
function oracionesPropias(texto: string): Oracion[] {
  const tapado = taparLoCitado(texto);
  const out: Oracion[] = [];
  let desde = 0;
  for (const m of [...tapado.matchAll(/\n|(?<=[.!?…])[^\S\n]+/g), null]) {
    const hasta = m ? m.index : tapado.length;
    if (texto.slice(desde, hasta).trim()) out.push({ propia: tapado.slice(desde, hasta), tal: texto.slice(desde, hasta), desde });
    if (m) desde = m.index + m[0].length;
  }
  return out;
}

/**
 * Hasta dónde PRESENTA la oración: lo que va antes del último «:» que presenta lo que sigue en el mismo mensaje («Te armé
 * un resumen de la semana:», «Hice la cuenta: con 14 leads…», «Déjame ver: tienes 3 reuniones»), o 0. Todo «:» presenta
 * (la sexta revisión: «**Hice la cuenta:** con 14 leads», «*Te armé este resumen:*» o «Te armé un resumen:👇» son el
 * formato del Ops Center, que pide negritas; y la séptima: «(conversión: 21 %)», «:)», «`etapa:ganado`») SALVO el que va
 * pegado a un dígito o a «/» (una hora, 10:30, la de las tarjetas; un link, https:) y el que no tiene nada después: ni
 * texto en el mensaje ni bloques debajo («Listo, ya moví a Juan a Ganado:», «Listo, ya te agendé la reunión :)»).
 * `bloquesDebajo`: el mensaje lleva algo dibujado debajo del texto (una tabla, un gráfico, una pregunta, una tarjeta).
 */
function finDeLoQuePresenta(texto: string, o: Oracion, bloquesDebajo: boolean): number {
  let fin = 0;
  for (let i = 0; i < o.propia.length; i++) {
    if (o.propia[i] !== ':') continue;
    const despues = texto.slice(o.desde + i + 1);
    if (/^[\d/]/.test(despues)) continue;
    if (/[\p{L}\d]/u.test(despues) || bloquesDebajo) fin = i + 1;
  }
  return fin;
}

/**
 * Las oraciones donde MaKo dice CLARO que hizo algo él (1.5; la tercera revisión, 21/10/2026): en primera persona, en
 * pasado, sin negación, sin pregunta y sin hablar de lo que dejó para confirmar. ⚠️ PRECISIÓN ANTES QUE COBERTURA: que se
 * escape una mentira está aceptado (la red fuerte es lo que el código dibuja en el hilo: el «Hecho:», la tarjeta), y una
 * nota en una respuesta que no afirma nada, no. No se le suman raíces ni formas para «ver más».
 */
export function afirmacionesDeHecho(texto: string, { bloquesDebajo = false, enElGrupo }: {
  bloquesDebajo?: boolean;
  /** El grupo de WhatsApp (`sanearSalida`): suma «he», «dejo» y «ya quedó» + participio de escritura. `leyo`: el turno corrió
   *  una lectura, y «Juan ya quedó agendado para el lunes» puede ser lo que leyó (el «ya quedó» no cuenta). */
  enElGrupo?: { leyo: boolean };
} = {}): string[] {
  return oracionesPropias(texto).filter((o) => {
    // Lo que exime se mira CON la cita (la quinta revisión): en «Te armé el copy «¿Cansado de perder leads?» para el
    // anuncio.» el copy está a la vista, y sacar la cita se llevaba el «?» que lo decía.
    const tal = o.tal.trim().toLowerCase();
    if (/[¿?]/.test(tal) || NIEGA.test(tal) || DE_LO_PROPUESTO.test(tal) || CONDICION.test(tal)) return false;
    // Lo que va antes de un «:» que presenta está a la vista: se mira lo de después («Listo: pausé la campaña»).
    const dicho = o.propia.slice(finDeLoQuePresenta(texto, o, bloquesDebajo)).toLowerCase();
    // «Anotado», «lo recordaré» (`HECHO_EN_MEMORIA`): en el grupo, «quedó registrado» con una lectura en el turno puede ser lo
    // que leyó («el pago quedó registrado el 5/10»), como el «ya quedó».
    const entera = o.propia.trim().toLowerCase();
    const enMemoria = HECHO_EN_MEMORIA.test(entera) && !(enElGrupo?.leyo && QUEDO_EN_MEMORIA.test(entera));
    const preterito = enElGrupo?.leyo ? dicho.replace(PRETERITO_DE_LECTURA, '') : dicho;
    if (PRETERITO.test(preterito) || ACABO_DE.test(dicho) || enMemoria) return true;
    return enElGrupo
      ? DEJE_ESCRITO.test(dicho) || HE_HECHO.test(dicho) || ESCRITO_A.test(dicho) || A_UN_TERCERO.test(dicho) || (!enElGrupo.leyo && YA_QUEDO.test(dicho))
      : DEJE_HECHO.test(dicho);
  }).map((o) => o.tal.trim());
}

/**
 * La promesa de una acción INMEDIATA que el turno no hizo («déjame ver el plan», «dame un segundo», «voy a revisar»,
 * «estoy buscando»), para el chat de la app. Sin «te aviso», «te paso» ni «te cargo»: son ofertas o condiciones
 * («cualquier cosa te aviso»), y la tercera revisión los vio borrar una verdad respaldada. ⚠️ Sólo si es lo ÚLTIMO del
 * mensaje y no es condicional (la cuarta revisión): «Déjame ver… Juan está en Seguimiento» ya trae la respuesta, y «en
 * cuanto me pases el CSV, voy a cargar…» es una oferta. Lo citado y lo que va después de un «:» que presenta CUMPLEN la
 * promesa (la quinta revisión): «Voy a armarte un borrador para Juan:\n\n«Hola Juan…»» y «Déjame ver: tienes 3
 * reuniones» traen lo prometido.
 */
export function promesasFirmesDe(texto: string, { bloquesDebajo = false }: { bloquesDebajo?: boolean } = {}): string[] {
  const todas = oracionesPropias(texto).filter((o) => /\p{L}/u.test(o.tal));
  const o = todas[todas.length - 1];
  // Lo último es una cita o una línea «> …»: es lo que la promesa presentaba.
  if (!o || !/\p{L}/u.test(o.propia)) return [];
  const tal = o.tal.trim();
  if (/[¿?]/.test(tal) || CONDICION.test(tal.toLowerCase()) || PIDE_DATO.test(norm(tal))) return [];
  const dicho = norm(o.propia.slice(finDeLoQuePresenta(texto, o, bloquesDebajo)));
  return [PROMESAS[0], PROMESAS[1], PROMESAS[4], PROMESAS[6]].some((re) => re.test(dicho)) ? [tal] : [];
}

/**
 * La ESPERA que anuncia la última oración («…Dame un rato y te digo el resto.», «Lo analizo y en breves te digo.», «Déjame
 * ver el detalle y te cuento.»), para el turno del doer que SÍ corrió herramientas (24/10/2026, `NO_CIERRA`): lo de antes
 * trae lo que hizo y se queda; esa última promete un después que no hay. Las excepciones de `promesasFirmesDe`: una
 * pregunta, una condición, un pedido de dato, una cita, y lo que va después de un «:» que presenta («Dame un segundo:
 * tienes 3 reuniones» ya trae la respuesta).
 */
export function esperasAlFinal(texto: string): string[] {
  const todas = oracionesPropias(texto).filter((o) => /\p{L}/u.test(o.tal));
  const o = todas[todas.length - 1];
  if (!o || !/\p{L}/u.test(o.propia)) return [];
  const tal = o.tal.trim();
  if (/[¿?]/.test(tal) || CONDICION.test(tal.toLowerCase()) || PIDE_DATO.test(norm(tal))) return [];
  const dicho = norm(o.propia.slice(finDeLoQuePresenta(texto, o, false)));
  return NO_CIERRA.some((re) => re.test(dicho)) ? [tal] : [];
}

/** El texto sin su última aparición de `tal` (la última oración), sin dejar un hueco. */
function sinLaUltima(texto: string, tal: string): string {
  const i = texto.lastIndexOf(tal);
  return i < 0 ? texto : `${texto.slice(0, i)}${texto.slice(i + tal.length)}`.replace(/\n{3,}/g, '\n\n').trim();
}

/** La oración pide un dato a la persona («dime», «pásame», «confirmame»). Sin tildes. */
const PIDE_DATO = /\b(?:pasame|dime|decime|mandame|enviame|confirmame|indicame|contame|cuentame|avisame)\b/;

/**
 * Las promesas de una acción FUTURA que trae el texto («déjame ver», «te cargo»), tal como
 * aparecen. Vacío = no promete nada.
 *
 * ⚠️ Sólo significa «no lo hizo» si el turno NO corrió ninguna herramienta: con una lectura
 * hecha, «te cargo las tareas» puede ser el ofrecimiento de un paso siguiente. Eso lo decide
 * quien llama (el doer cuenta las corridas; el vigía no las ve y lo marca como sospecha).
 */
export function promesasDe(texto: string): string[] {
  const out: string[] = [];
  const todas = oraciones(texto).flat().map((o) => o.trim()).filter(Boolean);
  // ⚠️ UNA PROPUESTA QUE TERMINA PIDIENDO EL «SÍ» NO ES UNA PROMESA: «Voy a agendar la visita con Demo Lead el martes 13
  // a las 11:00. ¿Confirmas con un «sí»?» (ws9, 10/10/2026) dice lo que VA a hacer cuando la persona diga que sí, y el
  // «sí» que sigue lo hace (lib/mako-intencion.ts, la regla del «sí» a un ofrecimiento). Lo marcó el vigía en su
  // primera pasada: con la regla de abajo sola, toda propuesta honesta era una promesa.
  if (/[?]\s*[*_»"')\]]*\s*$/.test(todas[todas.length - 1] ?? '')) return [];
  for (const o of todas) {
    // Una PREGUNTA no promete: ofrece («¿Te la agendo mañana a las 12?»). Desde el 08/10/2026
    // MaKo ofrece la acción en una consulta (decisión de Martín, «la ofrece»), y sacarla sería
    // sacarle a la persona el «sí» que la hace.
    if (/[¿?]/.test(o)) continue;
    const t = norm(o);
    // Y la que PIDE un dato para hacerlo tampoco: «Dime a qué hora y te lo agendo» (ws13, 13/10) es una condición,
    // no un «ya lo hago». Lo que no se puede es decirlo sin pedir nada.
    if (PIDE_DATO.test(t)) continue;
    for (const re of PROMESAS) {
      const m = re.exec(t);
      if (m && !out.includes(m[0])) out.push(m[0]);
    }
  }
  return out;
}

/**
 * Las groserías y el lunfardo que no van en el grupo de un negocio. Lista CERRADA a propósito:
 * es lo que se vio salir (16/10/2026) más lo inequívoco. Una palabra que también es neutra
 * («clavar la idea», «quemar las naves») no entra suelta: entra la forma que se vio. Por eso no están
 * «forro» (el del celular) ni «coño» (sin tilde es «cono»).
 */
const GROSERIAS = /\b(?:cagad[ao]s?|cagar(?:on|se|la|lo)?|cagaste|cagamos|cague[sn]?|caguen|cagando|carajo|mierdas?|put[ao]s?|putea\w*|boludo?s?|boluda?s?|boludez|pelotud[ao]s?|pelotudez|chot[ao]s?|garcha|vergas?|joder|jodid[ao]s?|culos?|chantas?|vendehumos?|clavarte|clavarme|clavaron|te clavan|botame|cojones|huevadas?|pendej[ao]s?|ching\w+|ojete|orto)\b/g;

/** Las groserías que trae el texto, tal como aparecen (sin tildes). Vacío = limpio. */
export function groseriasDe(texto: string): string[] {
  const t = norm(texto);
  return [...new Set(t.match(GROSERIAS) ?? [])];
}

/** Parte un texto en oraciones sin perder las líneas: [línea][oración]. */
function oraciones(texto: string): string[][] {
  return texto.split('\n').map((l) => l.split(/(?<=[.!?…])\s+/));
}

/**
 * El texto sin las ORACIONES que cumplen `fuera`. Devuelve null si no queda nada que valga la
 * pena mandar (menos de 15 letras): quien llama pone su propia línea.
 */
export function sinOraciones(texto: string, fuera: (oracion: string) => boolean): string | null {
  const lineas = oraciones(texto)
    .map((ors) => ors.filter((o) => !fuera(o)).join(' ').trimEnd());
  // Sin líneas vacías repetidas: sacar una oración que era un párrafo entero deja un hueco.
  const limpio = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return (limpio.match(/\p{L}/gu) ?? []).length >= 15 ? limpio : null;
}

/**
 * Lo que se le suma a una respuesta a la que se le sacó una promesa: la verdad, en una línea. ⚠️ No promete otra cosa
 * («ya lo hago»): pide el pedido de nuevo, que es lo único que hace que el próximo turno lo haga.
 */
export const SIN_HACER = 'Eso no lo llegué a hacer en este mensaje: pídemelo otra vez y lo hago.';
/**
 * La de un turno que SÍ hizo algo y prometía, al final, un después (24/10/2026, `esperasAlFinal`): lo de arriba es lo
 * hecho, y «Eso no lo llegué a hacer» se leería sobre eso. «Lo demás» es lo que prometía la oración que se sacó.
 */
export const SIN_HACER_LO_DEMAS = 'Lo demás no lo llegué a hacer en este mensaje: pídemelo otra vez y lo hago.';
/**
 * ⚠️ «PÍDEMELO OTRA VEZ Y LO HAGO» NUNCA ANTE LO QUE MaKo NO PUEDE HACER (29/10/2026, el ticket #30 de Leandro). Le preguntó
 * «¿lo actualizaste en la documentación API?» y salió «No tengo acceso directo para editar la documentación de la API desde aquí.
 * Eso no lo llegué a hacer en este mensaje: pídemelo otra vez y lo hago»: el saneo sacó un «Ya quedó reportado al equipo de
 * desarrollo…» falso y pegó `SIN_HACER` debajo de un «no puedo». Una promesa falsa: pedírselo otra vez no lo hace posible. Si la
 * respuesta dice que MaKo no puede (`noLoPuedeHacer`), no va `SIN_HACER`: queda lo que dijo, y si no queda nada, esta línea, que
 * no promete.
 */
export const SIN_HACER_SIN_PROMESA = 'Eso no quedó hecho en este mensaje.';

/** La respuesta dice que MaKo NO puede hacer eso (no tiene acceso, no está a su alcance). */
const NO_PUEDE = /\b(?:no\s+tengo\s+(?:acceso|permisos?|forma\s+de)|no\s+(?:puedo|podr[ée])\s+(?:editar|modificar|cambiar|hacer|tocar|acceder|actualizar|entrar|publicar|borrar)|no\s+(?:est[áa]|queda)\s+a\s+mi\s+alcance|fuera\s+de\s+mi\s+alcance|(?:eso|esto)\s+no\s+(?:lo\s+)?puedo|mako\s+no\s+(?:tiene\s+acceso|puede))\b/i;
/**
 * ¿La respuesta dice que MaKo NO puede hacer eso? ⚠️ «Quedó reportado al equipo» NO cuenta: reportarlo es abrir un ticket, y eso
 * MaKo SÍ lo hace; el «He reportado el error al equipo» de Leila (27/10) sigue llevando la verdad de siempre (tests/doer-hecho-grupo,
 * que lo cazó en tests-afectados cuando la primera versión también lo tapaba).
 */
export function noLoPuedeHacer(texto: string): boolean {
  return NO_PUEDE.test(texto || '');
}

/** La línea que va después de sacar una promesa o un «hecho» sin respaldo: `normal`, o ninguna si MaKo no lo puede hacer. */
const laVerdad = (textoEntero: string, normal: string): string | null => (noLoPuedeHacer(textoEntero) ? null : normal);
/**
 * ¿Lo que QUEDA termina preguntándole un dato a la persona? («¿De qué fecha es la campaña?», «¿Cuál de las dos?»). Entonces lo que
 * sigue es SU respuesta, y la promesa que se sacó («Con eso te armo la lista») dependía de ella: «pídemelo otra vez y lo hago»
 * debajo de una pregunta le pide repetir algo que no tiene que repetir (ticket #56, 4/11/2026: Natalia lo leyó así). Sólo una
 * pregunta ABIERTA (qué, cuál, cuándo, cuánto, dónde, quién, cómo): «¿Te sirve?» no pide nada, y ahí la línea sigue.
 */
export function preguntaUnDato(queda: string): boolean {
  const ultima = oraciones(queda).flat().map((o) => o.trim()).filter((o) => /\p{L}/u.test(o)).pop() ?? '';
  if (!/[?]\s*[*_»"')\]]*\s*$/.test(ultima)) return false;
  const pregunta = norm(ultima.slice(ultima.lastIndexOf('¿') + 1));
  return /^(?:(?:y|de|a|en|con|para|por|desde|hasta)\s+)?(?:que|cual|cuales|cuando|cuanto|cuanta|cuantos|cuantas|donde|quien|quienes|como)\b/.test(pregunta);
}
/**
 * La nota que va cuando MaKo dice que HIZO algo y el código no ve nada que lo respalde (1.5; la tercera revisión,
 * 21/10/2026). ⚠️ LA ORACIÓN NO SE BORRA: borrar una verdad («sí, ya te la agendé» después de confirmar la tarjeta) es peor
 * que dejar pasar una mentira, porque le dice al cliente «no hice nada» sobre algo que sí se hizo. Las dos versiones que
 * borraban (por si corrió algo, y por las raíces de las palabras) terminaron borrando verdades: leer texto libre con reglas
 * falla en lo obvio (AGENTS.md). Un falso positivo cuesta esta nota, no una respuesta. ⚠️ No pide repetirlo.
 */
export const NOTA_SIN_RESPALDO = 'No veo esa acción en este chat: revísala antes de darla por hecha.';
/** En el grupo, cuando lo que se daba por hecho quedó PROPUESTO (un ticket, una agenda) y espera el «sí» (27/10/2026). */
export const FALTA_EL_SI = 'Eso todavía no está hecho: contesta «sí» y lo hago.';
/** La de una promesa de algo inmediato que el turno no hizo (el chat de la app; la oración tampoco se borra). */
export const NOTA_SIN_HACER = 'Esto no lo hice en este mensaje: si lo necesitas, pídemelo.';
/** Lo que va cuando la respuesta entera era grosera. */
export const SIN_GROSERIA = 'Perdón, me expresé mal. ¿Seguimos?';

// ── LO QUE MaKo NO DICE EN EL GRUPO (29/10/2026, Leandro, ws10) ──────────────────────────────────────────────────────────
// Tres cosas que MaKo le dijo a un cliente sin saberlas, en una charla de un día:
//   · «entra a la ficha de cada uno en el CRM y borra el registro de la inscripción anterior» (y antes, «darles de baja o
//     reetiquetarlos manualmente»): un procedimiento INVENTADO, y destructivo. La vía real («Volver a probar», en Automations) ni
//     estaba subida. MaKo NUNCA indica borrar datos: si no sabe cómo se hace algo, lo dice y queda el ticket.
//   · «son limitaciones reales actuales del motor… que ya están escaladas al equipo», con dos de las tres hechas en una rama:
//     cómo está el producto y qué tiene el equipo lo dice el equipo (su ticket), no el modelo.
//   · «en este mensaje no puedo escuchar audios ni tengo la transcripción del tuyo»: MaKo escucha notas de voz (Groq).
// El prompt lo pide (lib/nucleo-grupo.ts) y esto lo mira al salir, como lo demás de este archivo: saca la ORACIÓN y dice la verdad
// en una línea. Lo de borrar y lo del producto dejan además su ticket: el doer agrega la marca `[[no-pude: …]]` si el modelo no
// puso ninguna, porque «lo tiene que ver el equipo» sin ticket sería la misma mentira. Sobre el texto SIN tildes (`norm`).

/** Lo que se le INDICA borrar: «borra», «bórralo», «borrá», «borrar», «elimina», «vaciar», «dales de baja», «dar de baja».
 *  Sin «borré»/«borre» (sin tildes son iguales: el pretérito es un HECHO, lo mira `afirmacionesDeHecho`) ni «borrador». */
const VERBO_BORRAR = String.raw`(?:(?:borr(?:a|ar|ando)|elimin(?:a|ar|ando)|vaci(?:a|ar))(?:l[oa]s?|les?|selos?|selas?)?|d(?:a|ar|ando)(?:l[oa]s?|les?)?\s+de\s+baja)`;
const INDICA_BORRAR = new RegExp(String.raw`\b${VERBO_BORRAR}\b`);
/** Lo que dice que NO se borre («no hace falta borrar nada», «sin eliminar la ficha»): es lo contrario. */
const NO_BORRES = new RegExp(String.raw`\b(?:no|nunca|sin|ni)\s+(?:[^\s,.;:]+\s+){0,3}${VERBO_BORRAR}\b`);
/** El consejo de seguridad de borrar del grupo el MENSAJE con una clave no es borrar datos del negocio. */
const MENSAJE_CON_CLAVE = /\bmensaje\b.*\b(?:clave|key|token|contrasena)\b|\b(?:clave|key|token|contrasena)\b.*\bmensaje\b/;
/** Cómo está el producto o qué tiene el equipo, dicho por el modelo: «ya están escaladas al equipo», «lo reporté al equipo»,
 *  «queda el registro técnico», «el equipo ya lo está viendo», «limitaciones reales actuales del motor». */
const AFIRMA_DEL_PRODUCTO = /\b(?:escal(?:ad[oa]s?|e|ando)|(?:report|deriv|pas)(?:e|ad[oa]s?)\s+(?:al|con\s+el)\s+equipo|registro\s+tecnico|el\s+equipo\s+ya\s+(?:l[oa]s?\s+)?(?:tiene|sabe|esta\s+(?:viendo|revisando|trabajando))|limitacion(?:es)?\s+(?:reales?|actuales?|conocidas?|del\s+(?:motor|sistema|panel|producto|plataforma|lienzo)))\b/;
/** Que no escucha audios: «no puedo escuchar audios», «no tengo la transcripción», «no pude escuchar tu nota de voz». */
const NIEGA_AUDIOS = /\bno\s+(?:puedo|pude|logro|alcanzo\s+a|tengo\s+forma\s+de)\s+(?:escuchar|oir|reproducir|abrir)\s+(?:(?:tu|tus|el|los|ese|este|esa|esta|la|las|un|una)\s+)?(?:audios?|notas?\s+de\s+voz|grabacion(?:es)?|mensajes?\s+de\s+voz)\b|\bno\s+(?:tengo|me\s+llego|me\s+llegaron)\s+(?:la|las)\s+transcripcion|\bno\s+escucho\s+(?:audios|notas)\b/;

/** Que le escriba lo que dijo en el audio: «Mándame el texto exacto de lo que dijiste». Sólo sale si el turno YA lo escuchó. */
const PIDE_EL_TEXTO_DEL_AUDIO = /\b(?:mandame|pegame|escribeme|pasame|enviame)\s+(?:el\s+texto|la\s+transcripcion|lo\s+que\s+dijiste)\b/;

/** Una marca del sistema (`[[no-pude: …]]`, `[[ya-pedido: …]]`) no se toca: la saca el doer. */
const esMarca = (o: string): boolean => o.includes('[[');
export const indicaBorrar = (o: string): boolean => { const n = norm(o); return !esMarca(o) && INDICA_BORRAR.test(n) && !NO_BORRES.test(n) && !MENSAJE_CON_CLAVE.test(n); };
export const afirmaDelProducto = (o: string): boolean => !esMarca(o) && AFIRMA_DEL_PRODUCTO.test(norm(o));
export const niegaAudios = (o: string): boolean => !esMarca(o) && NIEGA_AUDIOS.test(norm(o));

export const SIN_BORRAR = 'Borrar datos no es la forma de resolver esto, y cómo se hace no lo sé con certeza: lo tiene que ver el equipo de MaKo.';
export const SIN_SABER_DEL_PRODUCTO = 'Cómo está eso hoy en MaKo no lo sé con certeza: lo confirma el equipo de MaKo.';
export const ESCUCHO_AUDIOS = 'Las notas de voz las escucho: si alguna no te la contesté, reenvíamela y te respondo.';

/** ¿La respuesta trae ya una marca de ticket del modelo (`[[no-pude: …]]`, `[[no-existe: …]]`, `[[ya-pedido: #N]]`)? */
export const conMarcaDeTicket = (t: string): boolean => /\[\[\s*(?:no[\s-]*pude|no[\s-]*existe|ya[\s-]*pedido)\s*:/iu.test(t);

/**
 * Lo que va en la marca que pone el CÓDIGO: lo que escribió la persona, en una línea (sus palabras primero: la clave del ticket
 * sale de las dos primeras, lib/no-pude.ts, `refDeNoPude`), y qué faltó. Sin «]» ni saltos: la marca no los admite.
 */
export function queNoSupo(pedido: string, falta: string): string {
  const suyo = (pedido || '').replace(/[[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${suyo.length > 120 ? `${suyo.slice(0, 119).trimEnd()}…` : suyo} (${falta})`;
}

/** Lo que se sacó de la respuesta, por qué, y si deja ticket (`ticket`: lo de borrar o lo del producto). */
export type LoQueNoDice = { texto: string; borrar: string[]; producto: string[]; audios: string[]; ticket: boolean };

/**
 * La respuesta del modelo en el grupo sin lo que MaKo no dice, con la verdad en una línea por cada cosa. `escuchoUnAudio`: el turno
 * trae una nota de voz ya transcrita; entonces tampoco sale el «mándame el texto de lo que dijiste».
 */
export function sinLoQueMaKoNoDice(texto: string, { escuchoUnAudio = false }: { escuchoUnAudio?: boolean } = {}): LoQueNoDice {
  const todas = oraciones(texto).flat();
  const niega = (o: string): boolean => niegaAudios(o) || (escuchoUnAudio && !esMarca(o) && PIDE_EL_TEXTO_DEL_AUDIO.test(norm(o)));
  const borrar = todas.filter(indicaBorrar);
  const producto = todas.filter((o) => !indicaBorrar(o) && afirmaDelProducto(o));
  const audios = todas.filter((o) => !indicaBorrar(o) && !afirmaDelProducto(o) && niega(o));
  if (!borrar.length && !producto.length && !audios.length) return { texto, borrar, producto, audios, ticket: false };
  // El número de un punto de una lista es su propia «oración» («1.»): sin la oración que numeraba, se va con ella.
  const sinNumeros = (s: string | null): string | null => {
    if (!s) return s;
    const t = s.split('\n').filter((l) => !/^\s*(?:\d+[.)]|[-*•])\s*$/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return (t.match(/\p{L}/gu) ?? []).length >= 15 ? t : null;
  };
  const queda = sinNumeros(sinOraciones(texto, (o) => indicaBorrar(o) || afirmaDelProducto(o) || niega(o)));
  // Lo de borrar ya dice que lo ve el equipo: una sola línea de «no lo sé».
  const verdades = [borrar.length ? SIN_BORRAR : producto.length ? SIN_SABER_DEL_PRODUCTO : '', audios.length ? ESCUCHO_AUDIOS : ''].filter(Boolean);
  return { texto: [queda, ...verdades].filter(Boolean).join('\n\n'), borrar, producto, audios, ticket: borrar.length + producto.length > 0 };
}

// ── LAS MULETILLAS Y EL RELLENO (29/10/2026, Martín: «Es una verdadera desgracia cómo está respondiendo MaKo en WhatsApp») ──────────
// Medido en los grupos reales del 21 al 29/10: «Te voy a ser directo, Martín: …», «Seamos honestos: tienes razón en que…», «Te entiendo
// perfecto y tienes toda la razón en cada punto», «Mira… …», y oraciones que son SÓLO relleno: «te agradezco que lo estés tomando»,
// «Ya tomé nota para barrer…» (sin nada que lo respalde), «MaKo ya tiene tu contexto», «Bien ahí por la velocidad», «Tiene todo el
// sentido…», «Quedo atento». El prompt las prohíbe; esto las saca igual, porque el modelo las vuelve a meter.

/** La muletilla de la PUNTA de una oración, hasta su puntuación: «Te voy a ser directo, Martín:», «Mira…», «Perfecto.», «Entendido,». */
const MULETILLA_AL_PRINCIPIO = new RegExp(String.raw`^[\s¡]*(?:` + [
  String.raw`te\s+(?:voy\s+a\s+ser|soy)\s+(?:directo|directa|sincero|sincera|honesto|honesta|clar[oa])(?:\s*,?\s*\p{L}+)?`,
  String.raw`(?:seamos|siendo|para\s+ser)\s+(?:honest[oa]s?|sincer[oa]s?|direct[oa]s?|clar[oa]s?)`,
  String.raw`mira`,
  String.raw`ojo(?:\s+con\s+esto)?`,
  String.raw`(?:te\s+)?entiendo(?:\s+perfect(?:o|amente))?`,
  String.raw`entendido(?:\s+perfectamente)?(?:\s*,?\s*\p{L}+)?`,
  String.raw`(?:perfecto|excelente|genial|buen[ií]simo|de\s+una|dale)`,
].join('|') + String.raw`)\s*(?:…|\.{3}|[:,.!—-])+\s*`, 'iu');

/** La oración que es SÓLO relleno, aunque arranque con «te entiendo (perfecto) y …». Se va entera. */
const ORACION_DE_RELLENO = new RegExp(String.raw`^[\s¡]*(?:(?:te\s+)?entiendo(?:\s+perfect(?:o|amente))?\s*,?\s*y\s+)?(?:` + [
  String.raw`(?:tienes|ten[eé]s|tiene)\s+(?:toda\s+la\s+)?raz[oó]n`,
  String.raw`te\s+agradezco`,
  String.raw`gracias\s+por\s+(?:avisar|contarme|la\s+paciencia|tu\s+paciencia|tomarte)`,
  String.raw`es\s+una\s+clave\s+(?:gigante|enorme|important[ei]s?)`,
  String.raw`tiene\s+todo\s+el\s+sentido`,
  String.raw`quedo\s+atent[oa]`,
  String.raw`seguimos\s+firmes`,
  String.raw`(?:ya\s+)?tom[eé]\s+nota`,
  String.raw`(?:mako\s+)?ya\s+tiene\s+tu\s+contexto`,
  String.raw`arrancamos\s+con\s+todo`,
  String.raw`bien\s+ah[ií](?!\p{L})`,
  String.raw`buen\s+ritmo`,
].join('|') + ')', 'iu');

export type SinMuletillas = { texto: string | null; muletillas: string[] };

/**
 * La respuesta sin las muletillas de la punta de cada oración ni las oraciones de puro relleno. `texto` es null si no queda nada
 * que valga la pena mandar (menos de 15 letras): para un acuse, eso es lo correcto (va la reacción). Una marca de ticket no se toca.
 */
export function sinMuletillas(texto: string): SinMuletillas {
  const muletillas: string[] = [];
  // Lo que queda arranca con mayúscula, como lo escribiría quien no puso la muletilla («Mira…» suele ser su propia oración).
  const mayuscula = (s: string): string => s.replace(/^(\s*[¡¿«"“(]*)(\p{Ll})/u, (_x, a: string, b: string) => a + b.toUpperCase());
  const lineas = oraciones(texto).map((ors) => {
    const quedan = ors.map((o) => {
      if (esMarca(o)) return o;
      let r = o;
      // Puede haber dos seguidas («Mira, te voy a ser directo: …»).
      for (let i = 0; i < 3; i++) {
        const m = MULETILLA_AL_PRINCIPIO.exec(r);
        if (!m) break;
        muletillas.push(m[0].trim());
        r = r.slice(m[0].length);
      }
      if (ORACION_DE_RELLENO.test(r)) { muletillas.push(r.trim()); return ''; }
      return r === o ? o : mayuscula(r);
    }).filter((o) => o.trim());
    const linea = quedan.join(' ').trimEnd();
    return quedan.length && quedan[0] !== ors[0] ? mayuscula(linea) : linea;
  });
  if (!muletillas.length) return { texto, muletillas };
  const limpio = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: (limpio.match(/\p{L}/gu) ?? []).length >= 15 ? limpio : null, muletillas };
}

// ── NO INVENTAR UN DATO (29/10/2026; la investigación del Cerebro: «una regla sólo en el prompt no es regla») ─────────────────
// El prompt dice «no te apoyes en lo que crees saber»; esto lo chequea: una consulta que afirma un NÚMERO (una cantidad, un monto, una
// fecha, una hora) que no está en nada de lo que el modelo recibió —el system con el catálogo y la memoria, el mensaje, lo que
// devolvieron sus herramientas— no sale. Es el `context_used` del customer-support-agent de Anthropic (MIT), hecho sobre los números:
// los nombres no se pueden chequear así sin ruido. Las marcas de ticket, los links y la numeración de una lista no cuentan.

const NUMERO = /\d+(?:[.,:/-]\d+)*/g;
/** El número como se compara: sólo sus dígitos, sin ceros adelante («12,000» = «12000», «09» = «9»). */
const digitos = (s: string): string => s.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const partes = (s: string): string[] => s.split(/[.,:/-]/).map((p) => p.replace(/^0+(?=\d)/, '')).filter(Boolean);
/** Una hora («13:00», «9:30»): la herramienta la da en UTC y el modelo la pasa a la zona del negocio, así que sus dígitos no
 *  calzan con nada y no se pueden chequear así. Va sin chequear (una hora inventada la ataja el resumen que confirma el dueño). */
const HORA = /^\d{1,2}:\d{2}$/;
/** Una fecha corta («29/10», «29/10/2026»): el modelo reescribe la de la herramienta («2026-10-29»), así que se comparan sus partes. */
const FECHA = /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/;
/** Un teléfono, con sus espacios y guiones: se compara por sus dígitos, y vale si uno contiene al otro (el +54 y el 9 de Argentina). */
const TELEFONO = /\+?\d[\d\s().-]{6,}\d/g;
/** El mismo número largo: uno contiene al otro, o terminan en los mismos 8 dígitos (el 9 que agrega WhatsApp en Argentina). */
const mismoNumeroLargo = (a: string, b: string): boolean => a.includes(b) || b.includes(a) || (a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8));

/** Los números de la respuesta que no aparecen en ninguna de las fuentes. */
export function numerosSinFuente(respuesta: string, fuentes: readonly string[]): string[] {
  const conocidos = new Set<string>();
  const sueltos = new Set<string>();
  const largos: string[] = [];
  for (const f of fuentes) {
    for (const m of (f || '').matchAll(TELEFONO)) { const d = digitos(m[0]); if (d.length >= 7) largos.push(d); }
    for (const m of (f || '').matchAll(NUMERO)) {
      const d = digitos(m[0]);
      conocidos.add(d);
      if (d.length >= 7) largos.push(d);
      for (const p of partes(m[0])) sueltos.add(p);
    }
  }
  const propio = (respuesta || '')
    .replace(/\[\[[^\]]*\]\]/g, ' ')               // las marcas de ticket
    .replace(/https?:\/\/\S+/g, ' ')                // los links
    .replace(/\b(?:ticket|pedido)\s+#\d+/gi, ' ')   // la línea del ticket o del pedido (la escribe el código)
    .replace(/(^|\n)\s*\d+[.)]\s/g, '$1')           // la numeración de una lista
    .replace(TELEFONO, (t) => { const d = digitos(t); return d.length >= 7 && largos.some((k) => mismoNumeroLargo(k, d)) ? ' ' : t; });
  const fuera: string[] = [];
  for (const m of propio.matchAll(NUMERO)) {
    const n = m[0];
    if (HORA.test(n)) continue;
    const d = digitos(n);
    if (!d || conocidos.has(d)) continue;
    // Suelto («el 09 de noviembre»), o una fecha corta: vale si sus partes están en alguna fuente («9/11», «2026-11-09»).
    if ((/^\d+$/.test(n) || FECHA.test(n)) && partes(n).every((p) => sueltos.has(p))) continue;
    if (!fuera.includes(n)) fuera.push(n);
  }
  return fuera;
}

/** Lo que dice MaKo en vez de un dato que no vio. El ticket lo abre el código (la marca). */
export const SIN_EL_DATO = 'Ese dato no lo vi en lo que tengo a mano, así que no te lo doy inventado.';

/** `sinRespaldo`: lo que dice HECHO y el código no respalda (lleva la nota). */
export type Saneo = { texto: string; promesas: string[]; groserias: string[]; sinRespaldo?: string[] };

/** El `model` de la fila `saneo-doer` cuando lo que se sacó dice HECHO algo que el turno no hizo (lo lee el vigía). */
export const SANEO_HECHO = 'saneo:hecho';

/**
 * Lo que respalda, en el chat de la app, una frase que dice HECHO (1.5; las revisiones del 21/10/2026). En ese chat el
 * turno no ejecuta nada: lo que escribe deja una tarjeta o una pantalla, y se hace al confirmar. El respaldo lo pone el
 * CÓDIGO, nunca el texto: lo que se ejecutó, o la tarjeta confirmada, ya se ve en el hilo.
 */
export type RespaldoDeHecho = {
  /** Corrió en el turno algo que ESCRIBE de verdad (un control como `cancelar_accion`, sin error), o el hilo tiene una
   *  tarjeta confirmada («Hecho: …») después del último pedido de la persona. Con eso, no hay nota. */
  respaldado: boolean;
};

/**
 * La respuesta del doer lista para salir, con lo que se le sacó.
 *
 * `corrioHerramientas`: si el turno corrió al menos UNA herramienta. Con una corrida, una
 * promesa puede ser el ofrecimiento honesto del paso siguiente, y se deja —salvo, con `finDeTurno`,
 * una espera en la última oración (`esperasAlFinal`)—; sin ninguna, es seguro que no la cumplió.
 *
 * Sin la promesa, la respuesta dice lo que hizo y nada de lo que no: se le suma `SIN_HACER`,
 * porque una charla que termina en «Jajaja, acepto el reto.» deja a la persona esperando lo que
 * se le prometió en la oración que se sacó.
 *
 * ⚠️ EN EL CHAT DE LA APP (`hecho`) NINGUNA ORACIÓN SE BORRA POR LO QUE DICE (la tercera revisión: el camino de las promesas,
 * desde main, borraba «Sí, ya te la agendé. Cualquier cosa te aviso.» y pedía repetirlo). Lo que se borraba se MARCA, con
 * UNA nota como máximo: primero `NOTA_SIN_RESPALDO` (dice hecho algo que el código no respalda), si no `NOTA_SIN_HACER`
 * (promete algo inmediato sin haber corrido nada). Las groserías sí se sacan: no dicen nada de lo hecho.
 */
/**
 * Markdown al formato de WhatsApp (28/10/2026, el diagnóstico del Cerebro, F1): `**x**` → `*x*` y un título (`## Algo`) → `*Algo*`.
 * WhatsApp no conoce `**` ni `#`: llegaban tal cual («**Eugenia** - **Contacto:**», Código Inmobiliario, 22/10).
 */
export function aFormatoWhatsapp(t: string): string {
  return t
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, (_m, x: string) => `*${x.replace(/\*+/g, '').trim()}*`)
    .replace(/\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*/g, '*$1*');
}

export function sanearSalida(textoEntero: string, { corrioHerramientas, hecho, bloquesDebajo = false, finDeTurno = false, enElGrupo }: {
  corrioHerramientas: boolean;
  /** También lo que dice HECHO sin respaldo («Listo, ya lo armé»): el chat de la app (1.5). */
  hecho?: RespaldoDeHecho;
  /** El mensaje lleva algo dibujado DEBAJO del texto (una tabla, una pregunta, una tarjeta): «Te armé la tabla de tus
   *  ventas:» la presenta (la sexta revisión: la nota quedaba entre el «:» y la tabla). */
  bloquesDebajo?: boolean;
  /** La respuesta CIERRA un turno del modelo en el doer (24/10/2026): con herramientas corridas, lo último no puede
   *  prometer un después (`esperasAlFinal`). ⚠️ El aviso de un ticket cerrado (lib/tickets-cierre.ts) no lo pasa: lo
   *  libre ahí lo escribe Martín, y su «en breve te confirmo» lo cumple él. */
  finDeTurno?: boolean;
  /**
   * EL GRUPO DE WHATSAPP (27/10/2026): lo que dice HECHO sin que el turno lo haya hecho NO sale. «He reportado el error al
   * equipo… solo queda esperar su respuesta» (Leila, con el ticket sólo propuesto), «Te lo dejo anotado» (sin tarea), «Ya te
   * abrí la agenda de Google». En la app se marca con una nota (`hecho`); en el grupo no hay tarjeta que lo corrija después,
   * así que se saca esa oración y se dice la verdad: `FALTA_EL_SI` si quedó propuesto, si no `SIN_HACER`.
   * `respaldado`: el turno escribió algo de verdad (no una propuesta). `propuesto`: dejó una propuesta esperando el «sí».
   * `leyo`: corrió una lectura (`afirmacionesDeHecho`).
   */
  enElGrupo?: { respaldado: boolean; propuesto: boolean; leyo?: boolean };
}): Saneo {
  // Lo que dice hecho sin respaldo, fuera del texto ANTES de todo lo demás (la promesa, la grosería): lo de abajo trabaja
  // sobre lo que queda, y la verdad va al final.
  const delGrupo = { leyo: !!enElGrupo?.leyo };
  const sinRespaldoGrupo = enElGrupo && !enElGrupo.respaldado ? afirmacionesDeHecho(textoEntero, { enElGrupo: delGrupo }) : [];
  if (sinRespaldoGrupo.length) {
    const queda = sinOraciones(textoEntero, (o) => afirmacionesDeHecho(o, { enElGrupo: delGrupo }).length > 0);
    // Lo que MaKo no puede hacer no lleva «pídemelo otra vez y lo hago» (`SIN_HACER_SIN_PROMESA`, el #30).
    const verdad = enElGrupo!.propuesto ? FALTA_EL_SI : laVerdad(textoEntero, SIN_HACER);
    const resto = queda ? sanearSalida(queda, { corrioHerramientas, bloquesDebajo, finDeTurno }) : null;
    const yaLoDice = !!resto && (resto.texto.includes(SIN_HACER) || resto.texto.includes(SIN_HACER_LO_DEMAS));
    return {
      texto: resto ? (yaLoDice || !verdad ? resto.texto : `${resto.texto}\n\n${verdad}`) : verdad ?? SIN_HACER_SIN_PROMESA,
      promesas: resto?.promesas ?? [], groserias: resto?.groserias ?? groseriasDe(textoEntero), sinRespaldo: sinRespaldoGrupo,
    };
  }
  const texto = textoEntero;
  const groserias = groseriasDe(texto);
  if (hecho) {
    // La grosería se saca y lo demás QUEDA, aunque sea corto: «Sí, ya te la agendé.» no puede irse con ella (la cuarta
    // revisión: con menos de 15 letras salía entera como «Perdón, me expresé mal»). Sin nada que quede, esa línea.
    const sinGroserias = oraciones(texto).map((ors) => ors.filter((o) => !groseriasDe(o).length).join(' ').trimEnd())
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
    let salida = groserias.length ? (/\p{L}/u.test(sinGroserias) ? sinGroserias : SIN_GROSERIA) : texto;
    const sinRespaldo = hecho.respaldado ? [] : afirmacionesDeHecho(salida, { bloquesDebajo });
    // Con respaldo, ninguna nota de promesa: «Sí, ya te la agendé. Dame un segundo…» con «Esto no lo hice» pegado se lee
    // como que no se agendó.
    const prometidas = corrioHerramientas || hecho.respaldado ? [] : promesasFirmesDe(salida, { bloquesDebajo });
    // «si lo necesitas, pídemelo» tampoco ante lo que MaKo no puede hacer (el #30 de Leandro, `SIN_HACER_SIN_PROMESA`).
    const nota = sinRespaldo.length ? NOTA_SIN_RESPALDO : prometidas.length && !noLoPuedeHacer(salida) ? NOTA_SIN_HACER : null;
    if (nota) salida = `${salida}\n\n${nota}`;
    return { texto: salida, promesas: prometidas, groserias, ...(sinRespaldo.length ? { sinRespaldo } : {}) };
  }
  // El doer de WhatsApp: una respuesta suya es el FINAL del turno, y la promesa sin herramientas se saca (lo de siempre).
  // Con herramientas corridas, «te cargo las tareas» puede ser el paso siguiente honesto y se deja (17/10/2026); una ESPERA
  // al final («dame un rato y te digo el resto», «déjame ver el detalle y te cuento») no (24/10/2026): se saca ESA oración,
  // lo de antes queda —trae lo que sí se hizo— y se dice que LO DEMÁS no se hizo (`SIN_HACER_LO_DEMAS`): sin esa línea, «Tus
  // campañas: A 3 leads, B 5» deja esperando el «qué cambiar» que prometía la oración sacada. Si no queda nada, `SIN_HACER`.
  const prometidas = corrioHerramientas ? (finDeTurno ? esperasAlFinal(texto) : []) : promesasDe(texto);
  if (!prometidas.length && !groserias.length) return { texto, promesas: prometidas, groserias };
  if (corrioHerramientas) {
    const sinEspera = prometidas.length ? sinLaUltima(texto, prometidas[0]) : texto;
    const queda = sinOraciones(sinEspera, (o) => groseriasDe(o).length > 0);
    if (!prometidas.length) return { texto: queda ?? SIN_GROSERIA, promesas: prometidas, groserias };
    const demas = queda && preguntaUnDato(queda) ? null : laVerdad(texto, SIN_HACER_LO_DEMAS);
    return { texto: queda ? (demas ? `${queda}\n\n${demas}` : queda) : laVerdad(texto, SIN_HACER) ?? SIN_HACER_SIN_PROMESA, promesas: prometidas, groserias };
  }
  const sacada = sinOraciones(texto, (o) => (prometidas.length > 0 && promesasDe(o).length > 0) || groseriasDe(o).length > 0);
  if (prometidas.length) {
    const verdad = sacada && preguntaUnDato(sacada) ? null : laVerdad(texto, SIN_HACER);
    return { texto: sacada ? (verdad ? `${sacada}\n\n${verdad}` : sacada) : verdad ?? SIN_HACER_SIN_PROMESA, promesas: prometidas, groserias };
  }
  return { texto: sacada ?? SIN_GROSERIA, promesas: prometidas, groserias };
}
