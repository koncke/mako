// =============================================================================
// al-tuteo — lo que MaKo escribe en WhatsApp va en TÚ, aunque el modelo vosee (11/11/2026, Joan, Código Inmobiliario)
// =============================================================================
// La respuesta a Joan salió «Preguntás si puedo ver las campañas… ¿Querés que revise si Marcela conectó sus anuncios?». El prompt
// pide tú, y el modelo igual vosea a veces (sobre todo cuando le escriben en vos). Esto corrige las formas que de verdad aparecen,
// palabra por palabra, en la SALIDA (lib/mako-doer-in.ts, `partes`: lo que sale al grupo y lo que queda en la memoria). Lo que va
// entre «…» no se toca: son palabras de la persona o de un dato.
//
// Contiene el voseo que corrige: vive fuera del guard de voseo (tests/puente-panel-copy.test.ts, `FUERA_DE_ALCANCE`). Puro, con test
// (tests/links-con-ws.test.ts 6).
//
// ⚠️ SÓLO LAS FORMAS QUE NO PUEDEN SER OTRA COSA (11/11/2026, corrida 1039 en rojo). La primera versión pasaba «abrí» → «abre» y
// convirtió la respuesta FIJA del código «Abrí el ticket #43: …» (yo abrí, pretérito, español neutro correcto) en «Abre el ticket»,
// una orden a la persona. Los imperativos de vos en -í (abrí, elegí, escribí, pedí, recibí…) son IGUALES a la primera persona del
// pasado: acá no entran. Tampoco «acá» («Acá estoy» no es voseo) ni «sos» en mayúsculas («SOS»). Antes de sumar una palabra: ¿puede
// ser, escrita así, otra cosa que voseo? Si puede, no va.
// =============================================================================

const TU: Record<string, string> = {
  // Presente (la -s acentuada sólo existe en vos).
  querés: 'quieres', podés: 'puedes', tenés: 'tienes', sabés: 'sabes', preguntás: 'preguntas', necesitás: 'necesitas', mandás: 'mandas',
  pasás: 'pasas', decís: 'dices', hacés: 'haces', venís: 'vienes', preferís: 'prefieres', pensás: 'piensas', sos: 'eres',
  // 11/11/2026, a Joan: «No me queda claro qué cuenta habilitás». Sólo verbos: «además», «Tomás», «francés» también terminan en tilde.
  habilitás: 'habilitas', buscás: 'buscas', usás: 'usas', hablás: 'hablas', llamás: 'llamas', cargás: 'cargas', ponés: 'pones',
  agregás: 'agregas', armás: 'armas', conectás: 'conectas', cambiás: 'cambias', enviás: 'envías', escribís: 'escribes', recibís: 'recibes',
  pedís: 'pides', seguís: 'sigues', abrís: 'abres', elegís: 'eliges',
  // Imperativos en -á / -é (el pretérito de yo es «miré», «puse»: no chocan).
  mirá: 'mira', esperá: 'espera', probá: 'prueba', entrá: 'entra', tocá: 'toca', poné: 'pon', revisá: 'revisa', confirmá: 'confirma',
  avisá: 'avisa', contá: 'cuenta', fijá: 'fija',
  // Imperativos con pronombre pegado (sin tilde sólo existen en vos).
  fijate: 'fíjate', decime: 'dime', contame: 'cuéntame', pasame: 'pásame', mandame: 'mándame', avisame: 'avísame', escribime: 'escríbeme',
  hacelo: 'hazlo', decile: 'dile', pasale: 'pásale', mandale: 'mándale', avisale: 'avísale',
};
const PALABRA = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(TU).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

const conMayuscula = (original: string, tu: string): string => (original[0] && original[0] !== original[0].toLowerCase() ? tu[0].toUpperCase() + tu.slice(1) : tu);
/** «SOS», «MIRÁ»: en mayúsculas es una sigla o un grito, no se toca. */
const todaMayuscula = (m: string): boolean => m.length > 1 && m === m.toUpperCase() && m !== m.toLowerCase();

/** El texto de MaKo en tú: cada forma de voseo inequívoca, a la de tú; lo que va entre «…» queda como está. */
export function alTuteo(texto: string): string {
  if (!texto) return texto;
  return texto.split(/(«[^»]*»)/).map((tramo) => (tramo.startsWith('«') ? tramo : tramo.replace(PALABRA, (m) => (todaMayuscula(m) ? m : conMayuscula(m, TU[m.toLowerCase()] ?? m))))).join('');
}
