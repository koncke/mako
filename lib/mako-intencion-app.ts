// =============================================================================
// mako-intencion-app — cuándo un mensaje del chat de la APP le pide a MaKo HACER algo (puro)
// =============================================================================
// «Ops Center = lo principal» (Martín, 20/10/2026: «quiero que en Ops Center se pueda hacer todo, editar videos, crear webs,
// etc...»; docs/ops-center-principal.md, 2.3 y pieza 1.2). El chat de la app usaba el clasificador del grupo de WhatsApp,
// que ante la duda ANOTA el pedido como idea y le saca a MaKo la herramienta de escribir: es lo que conviene al dueño que
// vuelca ideas por WhatsApp, y es lo que rompe al que le habla al Ops Center. Medido con el turno real
// (`clasificarIntencion` + `herramientasDelChat`): CRM 41 de 91, Automations y Clients 17 de 48, núcleo 23 de 40.
//
// ⚠️ UN CANAL PROPONE, UNA PERSONA CONFIRMA. En la app, escribir es PROPONER: la herramienta deja una tarjeta y nada se hace
// sin el toque de la persona (`alcance: 'proponer'`, lib/mako-turno-app.ts). Por eso acá un verbo de hacer manda el turno a
// `actuar` sin miedo; en WhatsApp la misma frase puede ser una idea dictada, y ese canal NO usa nada de este archivo.
//
// La señal es el VERBO, y sólo cuando ARRANCA el mensaje (después del saludo y del nombre de MaKo): en el medio de una frase es
// tercera persona («si el closer crea un lead…»). Las formas se prueban sobre el texto SIN tildes (voseo y tuteo se juntan:
// «creá» y «crea» son la misma palabra) y sólo hay una excepción: las que tienen otra lectura. Ver el pie del test.
//
// PURO y sin `server-only`: lo importa lib/mako-intencion.ts y tests/ops-center-clasificador-app.test.ts.
// =============================================================================

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Los verbos de HACER que se le piden a MaKo en la app: [infinitivo, formas de la orden sin tildes]. Voseo y tuteo cuentan
 * igual. Se escriben las formas a mano porque las irregulares (cerrar → cierra, mover → mueve, poner → pon) no se
 * deducen, y porque cada forma de acá es una que alguien tiene que haber revisado contra su otra lectura.
 *
 * Quedan AFUERA, a propósito: los de leer o pensar (buscar, mostrar, decir, ver, analizar, investigar, revisar, comparar,
 * explicar, resumir: son de `consultar` y `pensar`), `hacer` («hace dos días…» es otra palabra), `pasar` («pasa que…»; el
 * pase de etapa es de `esPedidoSobreLead`), `probar` («prueba» solo es un saludo) y `dar` («da igual»).
 */
const VERBOS: ReadonlyArray<readonly [string, ...string[]]> = [
  ['crear', 'crea'], ['agregar', 'agrega'], ['sumar', 'suma'], ['quitar', 'quita'], ['sacar', 'saca'], ['poner', 'pon', 'pone'],
  ['cortar', 'corta'], ['cerrar', 'cierra', 'cerra'], ['abrir', 'abre', 'abri'], ['reabrir', 'reabre', 'reabri'], ['cargar', 'carga'],
  ['programar', 'programa'], ['reprogramar', 'reprograma'],
  ['invitar', 'invita'], ['editar', 'edita'], ['duplicar', 'duplica'], ['archivar', 'archiva'], ['filtrar', 'filtra'],
  ['insertar', 'inserta'], ['unir', 'une', 'uni'], ['generar', 'genera'], ['regenerar', 'regenera'],
  ['restablecer', 'restablece'], ['registrar', 'registra'], ['sincronizar', 'sincroniza'], ['conectar', 'conecta'],
  ['desconectar', 'desconecta'], ['suspender', 'suspende'], ['reportar', 'reporta'], ['levantar', 'levanta'],
  ['publicar', 'publica'], ['despublicar', 'despublica'], ['aprobar', 'aprueba', 'aproba'], ['rechazar', 'rechaza'],
  ['exportar', 'exporta'], ['importar', 'importa'], ['descargar', 'descarga'], ['subir', 'sube', 'subi'], ['bajar', 'baja'],
  ['llevar', 'lleva'], ['meter', 'mete'], ['mover', 'mueve', 'move'], ['posponer', 'pospone', 'pospon'],
  ['bloquear', 'bloquea'], ['desbloquear', 'desbloquea'], ['filmar', 'filma'], ['grabar', 'graba'], ['montar', 'monta'],
  ['mandar', 'manda'], ['enviar', 'envia'], ['reenviar', 'reenvia'], ['pausar', 'pausa'], ['reanudar', 'reanuda'],
  ['activar', 'activa'], ['desactivar', 'desactiva'], ['prender', 'prende'], ['apagar', 'apaga'], ['cambiar', 'cambia'],
  ['eliminar', 'elimina'], ['borrar', 'borra'], ['renombrar', 'renombra'], ['acelerar', 'acelera'], ['marcar', 'marca'],
  ['desmarcar', 'desmarca'], ['asignar', 'asigna'], ['calificar', 'califica'], ['descartar', 'descarta'], ['anotar', 'anota'],
  ['apuntar', 'apunta'], ['guardar', 'guarda'], ['actualizar', 'actualiza'], ['configurar', 'configura'],
  ['ocultar', 'oculta'], ['cancelar', 'cancela'], ['etiquetar', 'etiqueta'], ['copiar', 'copia'], ['clonar', 'clona'],
  ['replicar', 'replica'], ['traducir', 'traduce', 'traduci'], ['subtitular', 'subtitula'], ['recortar', 'recorta'],
  ['dividir', 'divide', 'dividi'], ['mezclar', 'mezcla'], ['reemplazar', 'reemplaza'], ['ajustar', 'ajusta'], ['aplicar', 'aplica'],
  ['diseñar', 'disena'], ['completar', 'completa'], ['vincular', 'vincula'], ['desvincular', 'desvincula'],
  ['conectar', 'conecta'], ['inscribir', 'inscribe', 'inscribi'], ['dar de baja', 'da de baja'], ['anular', 'anula'], ['retirar', 'retira'], ['responder', 'responde'],
  ['contestar', 'contesta'], ['reembolsar', 'reembolsa'], ['cobrar', 'cobra'], ['facturar', 'factura'], ['pagar', 'paga'],
  ['dejar', 'deja'], ['mantener', 'mantiene', 'mantene'], ['reiniciar', 'reinicia'], ['restaurar', 'restaura'], ['deshacer', 'deshace', 'deshaz'],
  ['revertir', 'revierte', 'reverti'], ['transferir', 'transfiere', 'transferi'], ['fijar', 'fija'], ['destacar', 'destaca'],
];

/** Los pronombres que se pegan al final de la orden: «creame», «mandale», «ponele», «dejaselo». */
const CLITICOS = '(?:me|te|se|nos|le|les|lo|la|los|las)(?:me|te|se|nos|le|les|lo|la|los|las)?';
/** Lo que va delante de la orden y no cambia nada (el nombre de MaKo, cortesías, un «che»). */
const PRELUDIO = /^(?:[\s,.:;!¡¿?"'-]*(?:mako|maco|macu|che|porfa|por favor|oye|ey|hola|buenas|buen dia|buenos dias|buenas tardes|ok(?:ey|ay)?|dale|bueno|listo|perfecto|y|entonces|ahora|ya|mira|escucha|escucha(?:me)?)\b)*[\s,.:;!¡¿?"'-]*/;

// Las formas que también son un SUSTANTIVO o una tercera persona corriente («marca registrada», «carga lenta la app», «factura
// electrónica», «abre a las 9 el local», «deja de inventar», «cobra caro el closer»): al arranque cuentan sólo con un pronombre pegado
// («marcalo», «cargala») o con un objeto con artículo («marcá el lead», «pausá la campaña»). Medido por la revisión del 20/10/2026.
const AMBIGUAS: ReadonlySet<string> = new Set([
  'marca', 'factura', 'copia', 'carga', 'programa', 'etiqueta', 'pausa', 'baja', 'suma', 'paga', 'cobra', 'abre', 'deja', 'registra',
  'responde', 'contesta', 'cierra', 'corta', 'guarda', 'monta', 'graba', 'filma', 'reporta', 'aplica', 'ajusta', 'completa',
]);
/** Lo que sigue a una forma ambigua para que sea una orden: un artículo, un posesivo, un demostrativo o «todo». */
const OBJETO = '(?:el|la|los|las|un|una|unos|unas|mi|mis|su|sus|tu|tus|ese|esa|esos|esas|este|esta|estos|estas|todo|todos|todas)';
/**
 * Y lo que también lo es sin artículo (21/10/2026, la segunda revisión: «cargá 3 tareas para mañana», «cargá tareas: llamar al
 * contador», «cargá en el plan…», «guardá como tarea…», «programá para el lunes la tarea…» caían en la adivinanza y se quedaban
 * sin `proponer_tareas_plan`): un número y un sustantivo, «en» / «para» con su artículo, «como» y un sustantivo, o el objeto en
 * plural de siempre. NO lo es «abre a las 9», «suma 2 + 2», «deja de inventar», «baja en ventas», «carga lenta».
 */
const CONTINUA = `(?:${OBJETO}\\b|\\d+\\s+[a-z]{4,}|en\\s+${OBJETO}\\b|como\\s+(?:${OBJETO}\\s+)?[a-z]{4,}|para\\s+(?:${OBJETO}\\b|manana|hoy|pasado)|(?:tareas?|notas?|recordatorios?)\\b)`;
const alt = (xs: string[]) => xs.map((x) => x.replace(/ /g, '\\s+')).join('|');

type Verbos = ReadonlyArray<readonly [string, ...string[]]>;
/** Las dos formas de pedir (la orden al arranque y el pedido indirecto) para un conjunto de verbos. */
function reglasDe(vs: Verbos): { orden: RegExp; pedido: RegExp; enElTexto: RegExp } {
  const formas = [...new Set(vs.flatMap(([, ...fs]) => fs))].sort((a, b) => b.length - a.length);
  const seguras = formas.filter((x) => !AMBIGUAS.has(x));
  const ambiguas = formas.filter((x) => AMBIGUAS.has(x));
  const infinitivos = [...new Set(vs.map(([i]) => i))].sort((a, b) => b.length - a.length);
  return {
    // En cualquier lugar del texto, como palabra entera: la orden («sacale las muletillas»), el infinitivo («no puedo borrar la landing»),
    // y las formas ambiguas sólo con pronombre pegado. «borrador», «se me borró» o «la pausa» no cuentan.
    enElTexto: new RegExp(`\\b(?:(?:${alt(seguras)}|${alt(infinitivos)})(?:${CLITICOS})?(?![a-z])${ambiguas.length ? `|(?:${alt(ambiguas)})(?:${CLITICOS}(?![a-z])|(?=\\s+${CONTINUA}))` : ''})`),
    orden: new RegExp(`^(?:(?:${alt(seguras)})(?:${CLITICOS})?(?![a-z])${ambiguas.length ? `|(?:${alt(ambiguas)})(?:${CLITICOS}(?![a-z])|(?=\\s+${CONTINUA}))` : ''})`),
    pedido: new RegExp(
      `^(?:(?:quiero|queremos|queria|quisiera|necesito|necesitamos|necesitaria|me gustaria|nos gustaria)\\s+(?:poder\\s+)?(?:${alt(infinitivos)})(?:${CLITICOS})?(?![a-z])` +
      `|(?:me\\s+|nos\\s+|le\\s+|les\\s+|te\\s+)?(?:podes|puedes|podrias|pueden|podria)\\s+(?:por favor\\s+)?(?:${alt(infinitivos)})(?:${CLITICOS})?(?![a-z])` +
      `|(?:hazme|haceme)\\s+el\\s+favor\\s+de\\s+(?:${alt(infinitivos)})(?![a-z]))`,
    ),
  };
}
/** La orden arranca el mensaje: «creame una landing», «mandale un mail a Juan», «poné una tarea». / El pedido indirecto: «quiero crear una landing», «¿podés cambiar la hora?». */
const { orden: ORDEN, pedido: PEDIDO_INDIRECTO } = reglasDe(VERBOS);
/** Los verbos de QUITAR, cortar o cancelar algo: abren la puerta de las operaciones destructivas (lib/relevancia-app.ts). */
const DE_QUITAR = new Set([
  'quitar', 'sacar', 'archivar', 'desvincular', 'suspender', 'reembolsar', 'desactivar', 'apagar', 'eliminar', 'borrar', 'descartar', 'ocultar',
  'cancelar', 'restablecer', 'reiniciar', 'revertir', 'rechazar', 'despublicar', 'desconectar', 'pausar', 'dar de baja', 'anular', 'retirar',
]);
const { enElTexto: QUITAR_EN_EL_TEXTO } = reglasDe(VERBOS.filter(([inf]) => DE_QUITAR.has(inf)));

/**
 * ¿El mensaje arranca pidiéndole a MaKo que HAGA algo (crear, agregar, cambiar, mandar…)? Sólo se mira el arranque: lo que
 * está en el medio de una frase no le habla a MaKo. Un mensaje en infinitivo pelado («Crear una landing») NO cuenta: es
 * un título dictado, y eso es de `INFINITIVO_TITULO` (capturar) en los dos canales.
 */
export function pideHacerAlApp(texto: string): boolean {
  const t = norm(texto).trim();
  if (!t) return false;
  const arranque = t.replace(PRELUDIO, '');
  return ORDEN.test(arranque) || PEDIDO_INDIRECTO.test(arranque);
}

/** La orden que arranca el pedido («invitá», «quiero crear», «¿podés cambiar»), o '' si no hay. */
export function ordenDelPedido(texto: string): string {
  const arranque = norm(texto).trim().replace(PRELUDIO, '');
  const m = ORDEN.exec(arranque) ?? PEDIDO_INDIRECTO.exec(arranque);
  return m ? m[0].trim() : '';
}

/**
 * ¿El mensaje PIDE quitar, borrar, cancelar o cortar algo («borrá…», «editá el video y sacale las muletillas», «¿podés eliminar…?», «no
 * puedo borrar la landing», «dale de baja a Juan»)? Es la mitad de lo que abre una operación destructiva en la app: la otra es nombrar su
 * cosa (lib/relevancia-app.ts → `nombraLaCosa`). Una queja no la abre: «se me borró todo», «me cobraron dos veces», «el borrador salió mal».
 */
export function pideQuitar(texto: string): boolean {
  const n = norm(texto);
  // DEVOLVER PLATA ES DESHACER UN COBRO (22/10/2026, el rojo de tests/ops-center-bateria.test.ts tras OC1): «devolvele el pago a Carlos»
  // no trae ningún verbo de quitar, y `reembolsar_cobro` (destructiva por su verbo) no pasaba la puerta. Sólo con su OBJETO (el pago,
  // la plata, el cobro, «el reembolso»): «devolvele la llamada a Juan» no abre nada.
  return QUITAR_EN_EL_TEXTO.test(n) || /\bde\s+baja\b/.test(n) || OBJETO_REEMBOLSO.test(n);
}

/** Devolver plata: «reembolsale», «el reembolso», «devolvele la plata», «hacele la devolución» (sobre el texto sin tildes). Lo usan la
 *  puerta de las destructivas (`pideQuitar`) y el objeto «reembolso» del clasificador (lib/mako-intencion.ts). */
export const OBJETO_REEMBOLSO = /\breembols\w*|\bdevolucion(?:es)?\b|\b(?:devolve|devuelve)\w* (?:el|la|su|los|sus) (?:pagos?|cobros?|plata|dinero)\b/;

/**
 * El texto SIN la orden del arranque (y sin el saludo): lo que se pide, para puntuar qué operación es. «borrá la nota» → «la nota».
 * La orden puntúa en cientos de operaciones («borra» está en todo lo que borra) y no dice cuál. Devuelve el texto sin tildes.
 */
export function sinVerboAlArranque(texto: string): string {
  const n = norm(texto).trim();
  const arranque = n.replace(PRELUDIO, '');
  const m = ORDEN.exec(arranque) ?? PEDIDO_INDIRECTO.exec(arranque);
  return m ? arranque.slice(m[0].length).trim() : n;
}

// ── Las familias de pedidos: de qué área es una operación que el pedido no nombra ────────────────────────────────
// «creá una etiqueta», «cortá el video», «mandá un mail a todos»: el verbo y el objeto no dicen el ÁREA («etiqueta» no está en
// las palabras del CRM) y el presupuesto de 12.000 caracteres ordena por palabras en común con el título de la operación
// («automatización» ≠ «secuencia», «mail» ≠ «broadcast»). Cada fila le suma al pedido las áreas y las palabras de la
// operación. Se escribe una fila por familia medida, con el pedido literal en tests/ops-center-clasificador-app.test.ts: una
// fila sin su frase es una adivinanza. Se prueba sobre el texto SIN tildes. `actua`: la fila misma ES un pedido de hacer
// (no hace falta que arranque con un verbo de la lista de arriba).
import type { Area } from './api-mako/tipos';

// `ganaALaAgenda`: el pedido nombra una reunión, pero lo que se pide NO es agendarla («creá una plantilla … para recordar la
// reunión»): la familia gana sobre el detector de agenda. La `relevancia` son palabras del NOMBRE de la operación (verbo y
// sustantivo, como en su id): un verbo suelto («crear», «poner») puntúa en cientos de operaciones y desordena el presupuesto.
type Familia = { id: string; test: RegExp; areas: Area[]; relevancia: string; actua?: boolean; ganaALaAgenda?: boolean; ganaAlLead?: boolean; ganaALaLanding?: boolean };

const FAMILIAS: readonly Familia[] = [
  { id: 'recurrente', test: /\b(?:todos|todas)\s+(?:los|las)\s+(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?|dias|semanas|meses)\b|\bcada\s+(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana|mes|dia)\b|\b(?:semanal|mensual|diaria)mente\b/, areas: ['chatbot'], relevancia: 'crear automatizacion con ia recurrente recordatorio cada semana', actua: true },
  { id: 'email-masivo', test: /\b(?:mails?|emails?|correos?)\b[^.\n]{0,40}\b(?:todos|todas|leads|lista|segmento|clientes|base)\b|\bbroadcast\b|\bnewsletter\b|\bmailing\b/, areas: ['email'], relevancia: 'crear broadcast borrador email correo masivo segmento enviar', actua: true },
  { id: 'contacto-lead', test: /^(?:cambi\w*|edit\w*|actualiz\w*|corrig\w*)\s[^.\n]{0,40}\b(?:telefono|numero|celular|email|correo|mail|nombre|apellido)\b/, areas: ['crm'], relevancia: 'editar contacto lead telefono email nombre apellido', actua: true },
  { id: 'mensaje-a-alguien', test: /^(?:escribile|escribiles|decile|dile|diles|avisale|avisales|contestale|respondele|mandale|enviale)\b/, areas: ['whatsapp', 'chats'], relevancia: 'crear borrador whatsapp empresa mensaje lead escribir enviar', actua: true },
  { id: 'que-le-contesto', test: /\bque le (?:contesto|respondo|digo|escribo|mando)\b|\bque (?:contesto|respondo) (?:a|al)\b/, areas: ['whatsapp'], relevancia: 'recomendar mensajes whatsapp responder lead contestar' },
  { id: 'secuencia-email', test: /\bsecuencias?\b[^.\n]{0,30}\b(?:emails?|mails?|correos?)\b|\b(?:emails?|mails?|correos?)\b[^.\n]{0,30}\bsecuencias?\b/, areas: ['email'], relevancia: 'crear secuencia email', actua: true },
  { id: 'plantilla', test: /\bplantillas?\b/, areas: ['whatsapp'], relevancia: 'guardar borrador plantilla redactar plantilla con mako', ganaALaAgenda: true },
  { id: 'automatizacion', test: /\bautomatizaci\w+|\bautomation\b|\bflujos?\b/, areas: ['chatbot'], relevancia: 'automatizacion' },
  { id: 'archivar-automatizacion', test: /\barchiv\w+\b[^.\n]{0,40}\b(?:automatizaci\w+|secuencia)/, areas: ['chatbot'], relevancia: 'archivar secuencia', actua: true },
  { id: 'probar-automatizacion', test: /\b(?:prueba|probar|proba|probame)\b[^.\n]{0,40}\b(?:automatizaci\w+|secuencia|flujo)\b/, areas: ['chatbot'], relevancia: 'probar secuencia prueba ensayo simular', actua: true },
  { id: 'borradores', test: /\bborradores?\b|\besperando que (?:los |las )?aprueb\w+/, areas: ['whatsapp'], relevancia: 'listar borradores whatsapp empresa pendientes aprobar' },
  { id: 'responder-comentarios', test: /\bautomaticamente\b|\bcomentarios? de (?:instagram|ig)\b/, areas: ['chatbot'], relevancia: 'crear automatizacion con ia', actua: true },
  { id: 'cliente-cs', test: /\bficha de la? client[ae]\b|\bclient[ae]s? en riesgo\b|\bcartera de clientes\b|\bcomo (?:baja|en riesgo|activ[oa]|pausad[oa])\b|\bclientes? (?:sin|que no)\b/, areas: ['cs'], relevancia: 'ver cliente cs ficha estado marcar baja riesgo cartera' },
  { id: 'curso', test: /\b(?:cursos?|modulos?|lecciones|leccion)\b|\bclase\b[^.\n]{0,20}\b(?:modulo|curso)\b|\b(?:agreg\w+|cre\w+|sub\w+)\b[^.\n]{0,15}\bclase\b/, areas: ['curso', 'cs'], relevancia: 'curso modulo clase' },
  { id: 'comunidad', test: /\bcomunidad\b/, areas: ['comunidad'], relevancia: 'comunidad' },
  { id: 'perfil-negocio', test: /\bmi negocio se llama\b|\b(?:mi|el) (?:negocio|perfil|marca)\b[^.\n]{0,30}\b(?:corregi\w*|cambi\w+|se llama)\b/, areas: ['negocio'], relevancia: 'guardar campo perfil negocio nombre corregir', actua: true },
  { id: 'contenido-programado', test: /\b(?:reel|reels|story|stories|post|posts|carrusel|publicacion|contenido)\b[^.\n]{0,40}\b(?:para el|el|este|manana|hoy)\b|\b(?:programa\w*|agend\w*)\b[^.\n]{0,20}\b(?:reel|post|story|carrusel|publicacion)\b/, areas: ['calendario'], relevancia: 'crear evento calendario contenido publicacion reel post programar', actua: true, ganaALaAgenda: true },
  // ── Plan, Calendario y Dashboard (tanda 2) ──
  { id: 'completar-tarea', test: /^complet\w+\s+(?:la|las|esa|esta)\s+tareas?\b/, areas: ['plan'], relevancia: 'cerrar tareas plan cierre', actua: true },
  { id: 'reabrir-tarea', test: /^(?:abr\w+|reabr\w+)\s+de nuevo\s+(?:la|las|esa|esta)\s+tareas?\b/, areas: ['plan'], relevancia: 'actualizar avance tarea reabrir', actua: true },
  { id: 'pasar-tarea', test: /^pasa\s+(?:la|las)\s+tareas?\b/, areas: ['plan'], relevancia: 'mover tarea plan columna', actua: true },
  // ── Video, imagen y creaciones (tanda 3) ──
  { id: 'velocidad-video', test: /\b(?:acelera\w*|ralentiz\w*|enlentec\w*|velocidad)\b/, areas: ['video'], relevancia: 'cambiar velocidad video', actua: true },
  { id: 'creaciones-galeria', test: /\bgaleria de la comunidad\b|\bcreaciones? de la comunidad\b/, areas: ['creaciones'], relevancia: 'publicar creacion', actua: true, ganaALaLanding: true },
  { id: 'estrella', test: /\b(?:una|la|su)\s+estrella\b|\bestrella\b[^.\n]{0,20}\bcreacion/, areas: ['creaciones'], relevancia: 'dar estrella creacion', actua: true },
  { id: 'dashboard-quitar-componente', test: /\b(?:quit\w+|sac\w+|borr\w+|elimin\w+)\b[^.\n]{0,25}\b(?:grafico|componente|elemento|tabla|texto)\b[^.\n]{0,30}\b(?:hoja|dashboard)\b/, areas: ['metricas'], relevancia: 'quitar componente dashboard', actua: true, ganaAlLead: true },
  // ── Pagos y cuenta (tanda 4) ──
  { id: 'dar-de-baja', test: /\bde baja\b/, areas: ['cobros'], relevancia: 'baja del cliente', actua: true },
  // La constancia del cliente que se pasa al chat («este es el doc fiscal», Leila 26/10/2026): con el adjunto era «pensar», sin
  // herramientas que escriban, y MaKo decía que desde el chat no se puede guardar. `guardar_documento_fiscal` la guarda.
  //   Nombrar el DOCUMENTO actúa; «datos fiscales» sólo suma el área (`area-fiscal`): «¿qué datos fiscales tiene Fabi?» es una pregunta.
  //   Las dos relevancias nombran `editar_dato_deal`: con la constancia viaja junto a guardar_documento_fiscal (lo que el PDF no
  //   trae se escribe a mano), y con los datos adjuntos es lo primero que se ofrece (tests/mako-no-puedo-falsos.test.ts, el 4).
  { id: 'documento-fiscal', test: /\bconstancias?\b|\b(?:doc|documento)s? fiscal(?:es)?\b|\bsituacion fiscal\b|\bcedula fiscal\b/, areas: ['cobros', 'crm'], relevancia: 'guardar documento fiscal constancia; editar dato deal fiscal', actua: true },
  { id: 'area-fiscal', test: /\bdatos fiscales\b/, areas: ['cobros', 'crm'], relevancia: 'editar dato deal fiscal' },
  // Un plan DICTADO (ticket #26, 29/10/2026): «7500 dolares en 3 pagos, primer pago 28 de octubre…» no arranca con un verbo ni dice
  // «cuotas», y traía `guardar_plan_pagos` sin `armar_plan_por_tramos`; «300 dólares cada quincena» traía las tareas del Plan.
  { id: 'plan-dictado', test: /\b\d+\s+(?:pagos|cuotas|mensualidades|quincenas)\b|\bcada quincena\b|\b(?:por|en) tramos\b/, areas: ['cobros'], relevancia: 'armar tramos editar cuota venta', actua: true },
  { id: 'rol-equipo', test: /\brol\b[^.\n]{0,30}\b(?:closer|setter|admin|miembro|equipo)\b|\b(?:cambi\w+)\b[^.\n]{0,12}\brol\b/, areas: ['equipo'], relevancia: 'cambiar rol miembro', actua: true, ganaAlLead: true },
  { id: 'renombrar-chat', test: /\brenombr\w+\b[^.\n]{0,15}\bchat\b/, areas: ['mako'], relevancia: 'renombrar chat mako', actua: true, ganaALaAgenda: true },
  // ── Offer, Copywriting, Second Brain y experimentos (tanda 5) ──
  { id: 'catalogo-productos', test: /\bcatalogo de productos\b/, areas: ['negocio'], relevancia: 'sugerir productos catalogo', actua: true },
  { id: 'diagnostico-fase', test: /\bdiagnostico de fase\b/, areas: ['negocio'], relevancia: 'guardar diagnostico fase', actua: true, ganaAlLead: true },
  { id: 'pasar-guion', test: /^pasa\s+(?:el|los)\s+guion(?:es)?\b/, areas: ['contenido'], relevancia: 'mover estado guion anuncio', actua: true },
  { id: 'formatos-creativo', test: /\bformatos? de creativos?\b/, areas: ['contenido'], relevancia: 'elegir formato creativo anuncio', actua: true },
  // ── Lo que MaKo NEGABA teniéndolo (tickets #46, #47 y #48 de Leila, 3/11/2026): la palabra de la persona no era la del nombre
  //    de la operación, la herramienta no viajaba y MaKo contestaba «no lo puedo hacer desde este chat».
  // «hoy el precio está en pesos y quiero pasarlo a dólares»: guardar_oferta y guardar_producto PROPONEN el precio con un link.
  //   El precio de lo que se VENDE (una moneda, la oferta, el producto), nunca el de un experimento, el de una secuencia («cuando
  //   pregunta el precio en la secuencia») ni la moneda del negocio (`cambiar_moneda_negocio`): con «precio» suelto les sacaba lugar.
  { id: 'precio-oferta', test: /^(?=[\s\S]*\bprecios?\b)(?=[\s\S]*\b(?:pesos|dolares|dlls|usd|mxn|ofertas?|productos?|programa|mentoria|curso|servicio)\b)(?![\s\S]*\b(?:experimentos?|secuencias?|moneda)\b)/, areas: ['negocio', 'crm'], relevancia: 'guardar oferta listar ofertas guardar producto listar productos' },
  // «del diagnóstico me mandan un WhatsApp que tiene que disparar una secuencia»: crear_automatizacion_con_ia la CREA, con su
  // disparador por etiqueta. Una secuencia de EMAILS es de `secuencia-email`, no de acá.
  { id: 'crear-secuencia', test: /\bdispar\w*\b[^.\n]{0,40}\bsecuencias?\b|\bsecuencias?\b[^.\n]{0,40}\bdispar\w*|\b(?:cre\w+|arm\w+|nuevas?)\b[^.\n]{0,25}\bsecuencias?\b(?![^.\n]{0,30}\b(?:emails?|mails?|correos?)\b)/, areas: ['chatbot'], relevancia: 'crear automatizacion con ia crear automatizacion desde plantilla', actua: true },
  // «¿dónde actualizo mis datos?»: listar_capacidades_mako trae la pantalla de cada dato (datos-negocio) y las lecturas, su link.
  { id: 'donde-se-edita', test: /\bdonde\b[^.\n?]{0,25}\b(?:actualiz|cambi|edit|modific|corrig|corrij)\w*|\b(?:actualiz|cambi|edit|modific|corrig|corrij)\w*\b[^.\n]{0,20}\b(?:mis|los) datos\b/, areas: ['negocio', 'mako'], relevancia: 'listar capacidades mako ver perfil negocio listar ofertas listar productos' },
  // «Activa la función "Aprende solo" en el Second Brain» (#45): cambiar_aprende_solo lo propone y listar_capacidades_mako dice dónde está.
  { id: 'aprende-solo', test: /\baprender? solo\b/, areas: ['mako'], relevancia: 'cambiar aprende solo listar capacidades mako' },
  // ── Web Generator (tanda 6) ──
  { id: 'seccion-landing', test: /\bseccion(?:es)?\b[^.\n]{0,40}\b(?:arriba|abajo|primero|ultimo|al final|al principio|antes|despues)\b|\b(?:mover|mueve|move\w*|borr\w+|ocult\w+|elimin\w+|sac\w+)\b[^.\n]{0,15}\bseccion/, areas: ['landing'], relevancia: 'acomodar seccion landing', actua: true },
  { id: 'enlace-landing', test: /\b(?:link|enlace)\b[^.\n]{0,15}\b(?:vsl|agenda)\b/, areas: ['landing'], relevancia: 'poner enlace landing', actua: true },
  { id: 'link-privado-landing', test: /\blink privado\b/, areas: ['landing'], relevancia: 'compartir borrador landing', actua: true },
  // ── Palabras de área: suman el área para las lecturas y las acciones que no quitan nada. Lo que QUITA algo no entra por el área sino por
  //    la COSA que el pedido nombra (lib/relevancia-app.ts, `nombraLaCosa`): el 21/10/2026 `area-negocio` abría `reiniciar_personalidad` en «eliminá las muletillas» ──
  { id: 'area-crm', test: /\bcrm\b|\bdiagnostico de\b|\bplan de pagos\b|\bcuotas?\b|\bofertas?\b|\bcalendly\b|\basign\w+\b/, areas: ['crm'], relevancia: '' },
  { id: 'area-whatsapp', test: /\bbloque\w+\b/, areas: ['whatsapp'], relevancia: 'bloquear contacto whatsapp' },
  { id: 'area-etiqueta', test: /\betiquetas?\b/, areas: ['crm'], relevancia: 'etiqueta' },
  { id: 'area-estrategia', test: /\bestrategia\b/, areas: ['chatbot'], relevancia: 'estrategia secuencia' },
  { id: 'area-equipo', test: /\bavisos?\b|\breportes?\b|\bidentidad fiscal\b/, areas: ['equipo'], relevancia: '' },
  { id: 'area-negocio', test: /\bmuletillas?\b|\blead magnets?\b|\bquiz\b|\barchivero\b|\bplan de mako\b|\bmi plan\b/, areas: ['negocio'], relevancia: '' },
  { id: 'area-ads', test: /\bpublicos\b|\bpublico\s+(?:frio|caliente|similar|objetivo)\b|\bretargeting\b|\bformularios? instantaneos?\b|\bguion(?:es)?\b|\bangulos?\b|\bvocabulario\b/, areas: ['ads'], relevancia: '' },
  { id: 'area-partners', test: /\bpartners?\b/, areas: ['cs'], relevancia: 'llevar partners' },
  // Un documento para el Second Brain (ticket #44, 3/11/2026): «te cargo un documento con toda la información que necesitas
  // saber de mi negocio, analizalo e incorporalo al second brain» salía `consultar` («que necesitas» parecía una pregunta), y
  // en `consultar` no viaja la tarjeta que lo guarda. Sin «borrar»: borrar un documento es de `borrar_documento_archivero`.
  { id: 'documento-al-cerebro', test: /\b(?:incorpor|sum|carg|guard|sub|agreg)\w*\b[^.\n]{0,60}\b(?:second brain|segundo cerebro|archivero)\b|\bte (?:cargo|paso|mando|comparto|dejo|subo) (?:un|el|este|mi) (?:documento|archivo|pdf|docx|word)\b/, areas: ['negocio'], relevancia: 'sumar documento second brain', actua: true },
  { id: 'sabes-del-negocio', test: /\bque (?:sabes|sabe|conoces|conoce|hay) (?:de|sobre) mi (?:negocio|empresa|marca)\b/, areas: ['negocio'], relevancia: 'contexto negocio perfil' },
  // ── Video, imagen y AI Avatar (las frases del chat de video: frases-video-imagen-1-2.json) ──
  { id: 'musica-video', test: /\bmusica\b/, areas: ['video'], relevancia: 'cambiar volumen video', actua: true },
  { id: 'plantilla-video', test: /\bplantilla\b[^.\n]{0,40}\bvideo\b|\bvideo\b[^.\n]{0,40}\bplantilla\b/, areas: ['video'], relevancia: 'usar plantilla video', actua: true, ganaALaAgenda: true },
  { id: 'historia-instagram', test: /\bhistorias? de (?:instagram|ig)\b|\bstor(?:y|ies)\b|\bcarrusel\b|\bminiaturas?\b/, areas: ['imagen'], relevancia: 'crear diseno imagen', actua: true },
  { id: 'se-filma', test: /\bse filma\b|\bfilma\w*\b[^.\n]{0,30}\banuncio\b/, areas: ['video'], relevancia: 'ver puente flow listar trabajos flow' },
  { id: 'voz-acento', test: /\bmi voz\b|\bclon\w+\b[^.\n]{0,15}\bvoz\b|\bacento\b/, areas: ['video'], relevancia: 'ver voz cliente contexto video', actua: true },
  { id: 'subtitulos', test: /\bsubtitul\w+/, areas: ['video'], relevancia: 'generar subtitulos video', actua: true },
];

export type FamiliaDelPedido = { ids: string[]; areas: Area[]; relevancia: string; actua: boolean; ganaALaAgenda: boolean; ganaAlLead: boolean; ganaALaLanding: boolean };

/** Las familias que trae un pedido (las áreas y las palabras de su operación se suman), o null si no trae ninguna. */
export function familiasDe(texto: string): FamiliaDelPedido | null {
  const n = norm(texto).trim().replace(PRELUDIO, '');
  const caen = FAMILIAS.filter((f) => f.test.test(n));
  if (!caen.length) return null;
  return {
    ids: caen.map((f) => f.id),
    areas: [...new Set(caen.flatMap((f) => f.areas))],
    relevancia: caen.map((f) => f.relevancia).join(' '),
    actua: caen.some((f) => f.actua),
    ganaALaAgenda: caen.some((f) => f.ganaALaAgenda),
    ganaAlLead: caen.some((f) => f.ganaAlLead),
    ganaALaLanding: caen.some((f) => f.ganaALaLanding),
  };
}

/** Los ids de las familias, para que el test pueda decir cuál falta. */
export const IDS_DE_FAMILIAS: readonly string[] = FAMILIAS.map((f) => f.id);
