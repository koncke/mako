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
  ['conectar', 'conecta'], ['inscribir', 'inscribe', 'inscribi'], ['dar de baja', 'da de baja'], ['responder', 'responde'],
  ['contestar', 'contesta'], ['reembolsar', 'reembolsa'], ['cobrar', 'cobra'], ['facturar', 'factura'], ['pagar', 'paga'],
  ['dejar', 'deja'], ['mantener', 'mantiene', 'mantene'], ['reiniciar', 'reinicia'], ['restaurar', 'restaura'], ['deshacer', 'deshace', 'deshaz'],
  ['revertir', 'revierte', 'reverti'], ['transferir', 'transfiere', 'transferi'], ['fijar', 'fija'], ['destacar', 'destaca'],
];

/** Los pronombres que se pegan al final de la orden: «creame», «mandale», «ponele», «dejaselo». */
const CLITICOS = '(?:me|te|se|nos|le|les|lo|la|los|las)(?:me|te|se|nos|le|les|lo|la|los|las)?';
/** Lo que va delante de la orden y no cambia nada (el nombre de MaKo, cortesías, un «che»). */
const PRELUDIO = /^(?:[\s,.:;!¡¿?"'-]*(?:mako|maco|macu|che|porfa|por favor|oye|ey|hola|buenas|buen dia|buenos dias|buenas tardes|ok(?:ey|ay)?|dale|bueno|listo|perfecto|y|entonces|ahora|ya|mira|escucha|escucha(?:me)?)\b)*[\s,.:;!¡¿?"'-]*/;

const FORMAS = [...new Set(VERBOS.flatMap(([, ...f]) => f))].sort((a, b) => b.length - a.length);
const INFINITIVOS = [...new Set(VERBOS.map(([i]) => i))].sort((a, b) => b.length - a.length);
const alt = (xs: string[]) => xs.map((x) => x.replace(/ /g, '\\s+')).join('|');

/** La orden arranca el mensaje: «creame una landing», «mandale un mail a Juan», «poné una tarea». */
const ORDEN = new RegExp(`^(?:${alt(FORMAS)})(?:${CLITICOS})?(?![a-z])`);
/** El pedido indirecto: «quiero crear una landing», «necesito agregar un lead», «¿podés cambiar la hora?». */
const PEDIDO_INDIRECTO = new RegExp(
  `^(?:(?:quiero|queremos|queria|quisiera|necesito|necesitamos|necesitaria|me gustaria|nos gustaria)\\s+(?:poder\\s+)?(?:${alt(INFINITIVOS)})(?:${CLITICOS})?(?![a-z])` +
  `|(?:me\\s+|nos\\s+)?(?:podes|puedes|podrias|pueden|podria)\\s+(?:por favor\\s+)?(?:${alt(INFINITIVOS)})(?:${CLITICOS})?(?![a-z])` +
  `|(?:hazme|haceme)\\s+el\\s+favor\\s+de\\s+(?:${alt(INFINITIVOS)})(?![a-z]))`,
);

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
  { id: 'curso', test: /\b(?:cursos?|modulos?|lecciones|leccion)\b|\bclase\b[^.\n]{0,20}\b(?:modulo|curso)\b|\b(?:agreg\w+|cre\w+|sub\w+)\b[^.\n]{0,15}\bclase\b/, areas: ['curso'], relevancia: 'curso modulo clase' },
  { id: 'comunidad', test: /\bcomunidad\b/, areas: ['comunidad'], relevancia: 'comunidad' },
  { id: 'perfil-negocio', test: /\bmi negocio se llama\b|\b(?:mi|el) (?:negocio|perfil|marca)\b[^.\n]{0,30}\b(?:corregi\w*|cambi\w+|se llama)\b/, areas: ['negocio'], relevancia: 'guardar campo perfil negocio nombre corregir', actua: true },
  { id: 'contenido-programado', test: /\b(?:reel|reels|story|stories|post|posts|carrusel|publicacion|contenido)\b[^.\n]{0,40}\b(?:para el|el|este|manana|hoy)\b|\b(?:programa\w*|agend\w*)\b[^.\n]{0,20}\b(?:reel|post|story|carrusel|publicacion)\b/, areas: ['calendario'], relevancia: 'crear evento calendario contenido publicacion reel post programar', actua: true, ganaALaAgenda: true },
  // ── Plan, Calendario y Dashboard (tanda 2) ──
  { id: 'pasar-tarea', test: /^pasa\s+(?:la|las)\s+tareas?\b/, areas: ['plan'], relevancia: 'mover tarea plan columna', actua: true },
  // ── Video, imagen y creaciones (tanda 3) ──
  { id: 'velocidad-video', test: /\b(?:acelera\w*|ralentiz\w*|enlentec\w*|velocidad)\b/, areas: ['video'], relevancia: 'cambiar velocidad video', actua: true },
  { id: 'creaciones-galeria', test: /\bgaleria de la comunidad\b|\bcreaciones? de la comunidad\b/, areas: ['creaciones'], relevancia: 'publicar creacion', actua: true, ganaALaLanding: true },
  { id: 'estrella', test: /\b(?:una|la|su)\s+estrella\b|\bestrella\b[^.\n]{0,20}\bcreacion/, areas: ['creaciones'], relevancia: 'dar estrella creacion', actua: true },
  { id: 'dashboard-quitar-componente', test: /\b(?:quit\w+|sac\w+|borr\w+|elimin\w+)\b[^.\n]{0,25}\b(?:grafico|componente|elemento|tabla|texto)\b[^.\n]{0,30}\b(?:hoja|dashboard)\b/, areas: ['metricas'], relevancia: 'quitar componente dashboard', actua: true, ganaAlLead: true },
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
