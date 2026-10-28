// =============================================================================
// doer-falla-frases — los detectores de lo que la persona ESCRIBE en el grupo: que algo no anda, o que pide ver su agenda
// =============================================================================
// Aparte de lib/doer-falla.ts (27/10/2026) porque nombran las formas de vos para RECONOCERLAS («sos el soporte», «abrime la
// agenda»): este archivo va en FUERA_DE_ALCANCE de la guarda de voseo (tests/puente-panel-copy.test.ts) y la nota que va al
// system (`bloqueDeLaFalla`) queda adentro de la guarda. Nada de acá se muestra.
//
// PURO y sin `server-only`: lo re-exporta lib/doer-falla.ts.
// =============================================================================

/**
 * ¿Cuenta que algo de MaKo no anda? «no puede analizar la llamada», «no me deja agendar», «sigue sin funcionar», «tras 4
 * intentos», «dejó de andar», «y tú eres el servicio técnico». ⚠️ Un lead que no contesta no es una falla de MaKo: eso lo
 * decide el modelo con la nota (`bloqueDeLaFalla`), que pide distinguirlo; acá sólo se abre la puerta del ticket. Los bordes
 * son de letra (`\p{L}`), no `\b`: el de JavaScript es ASCII y «se colgó» no tenía borde después de la «ó».
 */
const FALLA = new RegExp([
  String.raw`(?<!\p{L})no\s+(?:me\s+|te\s+|le\s+|lo\s+|la\s+)?(?:funciona|anda|carga|deja|puede|pudo|pude|sale|llega|abre|guarda|analiza|responde|aparece|muestra|conecta|sincroniza)(?!\p{L})`,
  String.raw`(?<!\p{L})no\s+est[aá]\s+(?:funcionando|andando|cargando)(?!\p{L})`,
  String.raw`(?<!\p{L})dej[oó]\s+de\s+(?:funcionar|andar|cargar)(?!\p{L})`,
  String.raw`(?<!\p{L})sigue\s+sin(?!\p{L})`,
  String.raw`(?<!\p{L})(?:tras|despu[eé]s\s+de)\s+\d+\s+intentos(?!\p{L})`,
  String.raw`(?<!\p{L})(?:da|tira|sale|aparece)\s+(?:un\s+)?error(?!\p{L})`,
  String.raw`(?<!\p{L})se\s+(?:rompi[oó]|colg[oó]|trab[oó]|cay[oó])(?!\p{L})`,
  String.raw`(?<!\p{L})(?:est[aá]|qued[oó])\s+roto(?!\p{L})`,
  String.raw`(?<!\p{L})(?:eres|sos)\s+(?:el\s+)?(?:servicio\s+t[eé]cnico|soporte)(?!\p{L})`,
].join('|'), 'iu');

export function reportaFalla(texto: string): boolean {
  return FALLA.test(texto || '');
}

/**
 * ¿Corrige un MONTO? «no me deja editar que son 423, no 4235» (Leila, 26/10/2026, con la foto de la cuota): MaKo dio consejos
 * y un «He reportado el error» que nunca se mandó, y no propuso corregirlo. Con la foto el pedido era «pensar» y el seguimiento
 * «capturar», y en ninguno viajan `editar_venta_lead` ni `editar_cuota` (la revisión del Cerebro, hallazgo 6). Dos cifras
 * enfrentadas con un «no» («423, no 4235», «no es 4235, es 423»), o pedir corregir un monto, una cuota o la mensualidad.
 *
 * ⚠️ DOS CIFRAS NO SON UN MONTO (la revisión adversarial de 82ab77cd8): «movela al viernes a las 15 no 16», «pasala al 20/10
 * no 21/10», un teléfono, «el año es 2026, no 2025» o «son 10 no 12 reuniones» se leían como corrección, y el pedido de agenda
 * perdía `agenda_del_dia` y `listar_tareas_plan` frente a las de cobros. Ahora:
 *   · las dos cifras valen sólo con PLATA en el mensaje (US$, $, monto, cuota, pago, mensualidad…), la foto o el PDF que la
 *     acompaña, o «no me deja editar/cambiar/corregir» (el literal de Leila);
 *   · la cifra es de 2 a 8 dígitos (o con miles: «4.235,29»), no pegada a «:» ni a «/» (una hora, una fecha), y no después de
 *     «las», «la», «el», «al» o «del» (las 15, el 20);
 *   · «precio» no cuenta: el precio de un producto o de una landing es otra herramienta.
 * Y LO DE ANTES (la verificación de 4d1d0a010): el seguimiento de Leila SIN foto («son 423, no 4235», después de la foto de la
 * cuota) no nombra la plata. Si la plata está sólo en lo de antes (`antes`: la foto, la respuesta de MaKo), las cifras tienen que
 * ser de 3 dígitos o más. Y en los dos casos, dos AÑOS no son un monto (`sonAnios`): un monto de 2000 sí lo es.
 */
const cifra = (minimo: number): string =>
  String.raw`(?<![\d\p{L}:/.,])(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{${minimo},8}(?:[.,]\d{1,2})?)(?![\d\p{L}:/])`;
const NO_ES_HORA_NI_FECHA = String.raw`(?<!(?:las|la|el|al|del)\s+)`;
/** «$423», «US$ 4235»: el signo pegado a la cifra. */
const MONEDA = String.raw`(?:(?:us)?\$\s?)?`;
const dosCifras = (c: string): RegExp => new RegExp([
  String.raw`${NO_ES_HORA_NI_FECHA}${MONEDA}${c}\s*,?\s*(?:y\s+)?no\s+(?:es\s+|son\s+)?(?:de\s+)?${MONEDA}${c}`,
  String.raw`(?<!\p{L})no\s+(?:es|son)\s+(?:de\s+)?${MONEDA}${c}\s*,?\s*(?:es|son|sino)\s+(?:de\s+)?${MONEDA}${c}`,
].join('|'), 'iu');
/** Con la plata en el mensaje. */
const DOS_CIFRAS = dosCifras(cifra(2));
/** Con la plata sólo en lo de antes: más exigente (ni «10 no 12»). */
const DOS_CIFRAS_POR_LO_DE_ANTES = dosCifras(cifra(3));
const HAY_PLATA = /(?:\$|(?<!\p{L})(?:usd|d[oó]lares?|pesos?|ars|mxn|montos?|cuotas?|pagos?|pagad[oa]s?|cobr\p{L}*|mensualidad(?:es)?|importes?|venta)(?!\p{L})|\(envi[oó] (?:una imagen|un pdf)|\(en este mensaje mandé (?:una imagen|un pdf)|no me deja (?:editar|cambiar|corregir|modificar))/iu;
const PIDE_CORREGIR = new RegExp([
  String.raw`(?<!\p{L})(?:correg|corrij|cambi|edit|arregl|modific)\p{L}*\s+(?:\p{L}+\s+){0,3}(?:montos?|cuotas?|mensualidad(?:es)?|importes?)(?!\p{L})`,
  String.raw`(?<!\p{L})(?:montos?|cuotas?|mensualidad(?:es)?|importes?)\s+(?:\p{L}+\s+){0,3}(?:est[aá]n?|qued[oó]|quedaron|vino|vinieron|sali[oó])\s+mal(?!\p{L})`,
].join('|'), 'iu');

/**
 * ¿Las dos cifras son AÑOS? Las dos cerca del año en curso (±5): «la cuota de 2026 no 2025», «vence en 2026 no 2025». Por la
 * palabra no se sabe: «una cuota de 2000» es un monto, y «de 2026» un año (la verificación de 8cb034a18: mirar el «de» volvía
 * año a «la cuota es de 2000 no 1500»).
 */
function sonAnios(coincidencia: string, ahora: Date): boolean {
  const n = (coincidencia.match(/\d+(?:[.,]\d+)*/g) ?? []).map((x) => (/^\d{4}$/.test(x) ? Number(x) : NaN));
  const anio = ahora.getFullYear();
  return n.length >= 2 && n.every((x) => Number.isFinite(x) && Math.abs(x - anio) <= 5);
}
/** Las dos cifras enfrentadas que NO son años, todas las del texto. */
const correcciones = (re: RegExp, t: string, ahora: Date): string[] =>
  [...t.matchAll(new RegExp(re.source, `${re.flags}g`))].map((m) => m[0]).filter((m) => !sonAnios(m, ahora));
/**
 * Con la plata sólo en lo de antes, el mensaje tiene que ser LA CORRECCIÓN: «son 423, no 4235», «pero son 423, no 4235,
 * corregilo», «son 423, no 4235 por favor», «debería ser 423 no 4235», «la de Nadia es 423, no 4235 👍». «son 120 no 150 leads»,
 * «el código postal es 3300 no 3301» u «oficina 302 no 303» hablan de otra cosa. (La verificación de 8cb034a18: sin el verbo de
 * corregir ni «por favor», el seguimiento de Leila con una palabra más volvía a perder la corrección.)
 */
const SOLO_LA_CORRECCION = /^(?:(?:pero|son|es|era|eran|no|que|y|o|ojo|perd[oó]n|che|mako|digo|o sea|osea|bueno|en realidad|realmente|ah|eh|ser[ií]an?|deber[ií]an?(?: ser)?|me|deja|editar|cambiar|corregir|modificar|correg[ií]\p{L}*|corr[ií]g\p{L}*|c[aá]mbi\p{L}*|arr[eé]gl\p{L}*|modif[ií]c\p{L}*|por favor|porfa|plis|gracias|est[aá]n?|mal|(?:la|el) de \p{L}+|el|la|los|las|de|del|monto|cuota|total)\s*[,.!:;]?\s*)*$/iu;

/** `antes`: lo último de la charla (lo que dijo la persona y lo que contestó MaKo), para el seguimiento que no nombra la plata. */
export function corrigeUnMonto(texto: string, antes = '', ahora = new Date()): boolean {
  const t = texto || '';
  if (PIDE_CORREGIR.test(t)) return true;
  if (HAY_PLATA.test(t)) return correcciones(DOS_CIFRAS, t, ahora).length > 0;
  if (!antes || !HAY_PLATA.test(antes)) return false;
  // Mensaje por mensaje: en un lote («ahí está» + «son 423, no 4235») cada uno va en su renglón (`sinPrefijoDeLote`).
  return t.split(/\n+/).some((linea) => {
    const [m] = correcciones(DOS_CIFRAS_POR_LO_DE_ANTES, linea, ahora);
    return !!m && SOLO_LA_CORRECCION.test(linea.replace(m, ' ').replace(/\p{Extended_Pictographic}/gu, ' ').trim());
  });
}

/**
 * ¿Pide VER su agenda? «abrime la agenda de google», «mostrame el calendario de esta semana», «tengo algo a las 15?» (27/10/2026,
 * P6: Código Inmobiliario recibió un link a calendar.google.com, y «Ya te abrí la agenda de Google», teniendo `agenda_del_dia`).
 * Es una LECTURA: si el turno no la trae, viaja igual (como el ticket ante una falla). Un pedido de AGENDAR no es esto: ése
 * lo lleva el clasificador con sus herramientas.
 */
const VER_AGENDA = new RegExp([
  String.raw`(?<!\p{L})(?:mi\s+|la\s+|el\s+)?(?:agenda|calendario)(?!\p{L})`,
  String.raw`(?<!\p{L})(?:tengo|hay)\s+(?:algo|alguna?\s+(?:reuni[oó]n|cita|llamada)|reuniones|citas|llamadas)(?!\p{L})`,
  String.raw`(?<!\p{L})qu[eé]\s+tengo\s+(?:hoy|ma[ñn]ana|el|esta|a\s+las)(?!\p{L})`,
].join('|'), 'iu');
// «agenda» con artículo o posesivo («la agenda», «mi agenda») es el SUSTANTIVO, no el imperativo «agendá».
const AGENDAR = /(?<!\p{L})(?<!(?:la|mi|tu|su|una|esa|esta|de)\s+)(?:re)?agend(?:a|á|ar|ame|ale|ales|alo|ala|ámelo|ámela|emos|é)(?!\p{L})/iu;
export function pideVerAgenda(texto: string): boolean {
  const t = texto || '';
  return VER_AGENDA.test(t) && !AGENDAR.test(t);
}
