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
  // 13/11/2026, Copywriting: los guiones que MaKo escribe (lib/copywriter/ia.ts). Lo que de verdad salió en las réplicas y las
  // plantillas («respondés tarde… vos contestas», «Comentá FUNNEL», «Creés que WhatsApp…»). Las mismas reglas: sólo verbos, y
  // ninguna -í de imperativo («compartí», «escribí» son también pretérito); «creé» tampoco (yo creé), «creés» sí.
  respondés: 'respondes', contestás: 'contestas', dejás: 'dejas', creés: 'crees', probás: 'pruebas', entendés: 'entiendes', empezás: 'empiezas',
  vendés: 'vendes', cobrás: 'cobras', perdés: 'pierdes', ganás: 'ganas', llegás: 'llegas', cerrás: 'cierras', invertís: 'inviertes',
  tirás: 'tiras', negociás: 'negocias', controlás: 'controlas', trabajás: 'trabajas', sentís: 'sientes', vivís: 'vives', conseguís: 'consigues',
  convertís: 'conviertes', pagás: 'pagas', llevás: 'llevas', mirás: 'miras', esperás: 'esperas', publicás: 'publicas', grabás: 'grabas',
  subís: 'subes', atendés: 'atiendes', escuchás: 'escuchas', aprendés: 'aprendes', lográs: 'logras', facturás: 'facturas', volvés: 'vuelves',
  decidís: 'decides', contás: 'cuentas', mostrás: 'muestras', explicás: 'explicas', ofrecés: 'ofreces', terminás: 'terminas',
  arrancás: 'arrancas', agendás: 'agendas', escalás: 'escalas', medís: 'mides', salís: 'sales',
  // («agendá», «dejá», «mandá» ya los trae la tanda del grupo de la app, arriba: una clave repetida es un error de tipos.)
  empezá: 'empieza', preguntá: 'pregunta', guardá: 'guarda', comentá: 'comenta', cerrá: 'cierra',
  sumá: 'suma', pensá: 'piensa', llamá: 'llama', hablá: 'habla', usá: 'usa', contestá: 'contesta', tomá: 'toma',
  arrancá: 'arranca', aprovechá: 'aprovecha', reservá: 'reserva', descargá: 'descarga',
  respondé: 'responde', hacé: 'haz', tené: 'ten', vendé: 'vende', aprendé: 'aprende', mové: 'mueve', atendé: 'atiende',
  probalo: 'pruébalo', guardalo: 'guárdalo', escribilo: 'escríbelo', mandalo: 'mándalo', dejalo: 'déjalo', miralo: 'míralo',
  usalo: 'úsalo', contalo: 'cuéntalo', pedilo: 'pídelo', agendalo: 'agéndalo', comentalo: 'coméntalo', compartilo: 'compártelo',
  preguntame: 'pregúntame', seguime: 'sígueme', llamame: 'llámame',
  // El pronombre (sólo existe en vos; «VOS» en mayúsculas es una sigla y no se toca).
  vos: 'tú',
};
const PALABRA = new RegExp(`(?<![\\p{L}\\p{N}])(${Object.keys(TU).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
/** «con vos» → «contigo»; «para vos», «a vos»… → «para ti», «a ti» (antes que el «vos» suelto, que es el sujeto: «tú»). */
const CON_PREPOSICION = new RegExp('(?<![\\p{L}\\p{N}])(con|para|a|de|por|sin|en|entre|hacia|según) vos(?![\\p{L}\\p{N}])', 'giu');

const conMayuscula = (original: string, tu: string): string => (original[0] && original[0] !== original[0].toLowerCase() ? tu[0].toUpperCase() + tu.slice(1) : tu);
/** «SOS», «MIRÁ»: en mayúsculas es una sigla o un grito, no se toca. */
const todaMayuscula = (m: string): boolean => m.length > 1 && m === m.toUpperCase() && m !== m.toLowerCase();

const enTramo = (tramo: string): string => tramo
  .replace(CON_PREPOSICION, (m, prep: string) => (todaMayuscula(m) ? m : prep.toLowerCase() === 'con' ? conMayuscula(prep, 'contigo') : `${prep} ti`))
  .replace(PALABRA, (m) => (todaMayuscula(m) ? m : conMayuscula(m, TU[m.toLowerCase()] ?? m)));

/**
 * El texto de MaKo en tú: cada forma de voseo inequívoca, a la de tú; lo que va entre «…» queda como está (son palabras de la
 * persona). `citas: true` también lo pasa adentro de «…»: en un guion de Copywriting lo citado lo escribió MaKo (lo que se dice
 * en cámara, el texto en pantalla), no la persona.
 */
export function alTuteo(texto: string, opciones: { citas?: boolean } = {}): string {
  if (!texto) return texto;
  if (opciones.citas) return enTramo(texto);
  return texto.split(/(«[^»]*»)/).map((tramo) => (tramo.startsWith('«') ? tramo : enTramo(tramo))).join('');
}
