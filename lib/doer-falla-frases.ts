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
