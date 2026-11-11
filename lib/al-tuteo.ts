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
// =============================================================================

const TU: Record<string, string> = {
  // Presente.
  querés: 'quieres', podés: 'puedes', tenés: 'tienes', sabés: 'sabes', preguntás: 'preguntas', necesitás: 'necesitas', mandás: 'mandas',
  pasás: 'pasas', decís: 'dices', hacés: 'haces', venís: 'vienes', preferís: 'prefieres', pensás: 'piensas', querrías: 'querrías', sos: 'eres',
  // Imperativos.
  mirá: 'mira', fijate: 'fíjate', esperá: 'espera', probá: 'prueba', entrá: 'entra', tocá: 'toca', elegí: 'elige', poné: 'pon', abrí: 'abre',
  revisá: 'revisa', confirmá: 'confirma', escribí: 'escribe', avisá: 'avisa', contá: 'cuenta', decime: 'dime', contame: 'cuéntame',
  pasame: 'pásame', mandame: 'mándame', avisame: 'avísame', escribime: 'escríbeme', hacelo: 'hazlo', decile: 'dile', pasale: 'pásale',
  mandale: 'mándale', avisale: 'avísale', fijá: 'fija', acá: 'aquí',
};
const PALABRA = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(TU).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

const conMayuscula = (original: string, tu: string): string => (original[0] && original[0] !== original[0].toLowerCase() ? tu[0].toUpperCase() + tu.slice(1) : tu);

/** El texto de MaKo en tú: cada forma de voseo conocida, a la de tú; lo que va entre «…» queda como está. */
export function alTuteo(texto: string): string {
  if (!texto) return texto;
  return texto.split(/(«[^»]*»)/).map((tramo) => (tramo.startsWith('«') ? tramo : tramo.replace(PALABRA, (m) => conMayuscula(m, TU[m.toLowerCase()] ?? m)))).join('');
}
