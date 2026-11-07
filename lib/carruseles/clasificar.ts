// =============================================================================
// carruseles/clasificar — qué TIPO de carrusel es y si parece CONTENIDO, sin IA y sin inventar (4/11/2026)
// =============================================================================
// Pedido del Cerebro, con lo medido en la primera carga de la biblioteca (4/11/2026, ~21:20 UTC):
//   «142 de los 160 quedaron "sin tipo" (87 de temas, 55 de cuentas). El filtro por tipo casi no sirve así: mira por qué el
//   texto no alcanza y clasifícalos mejor, sin inventar» y «El orden por outlier sube publicaciones personales. El primero de
//   @leilahormozi es una foto de su embarazo ("Anytime now…."). Busca una forma medible de bajarlas sin esconder lo que
//   funciona, y deja dicho qué cubre y qué no».
//
// POR QUÉ EL TEXTO NO ALCANZABA (leyendo el clasificador de Spy, `formatoPorTexto`, lib/spy-detalle.ts):
//   · sus frases fuertes son casi todas en español, y las cuentas de la lista (Hormozi y compañía) escriben en inglés;
//   · la lista sólo se reconoce con un número pegado a uno de doce sustantivos («7 errores»): «5 formas», «3 lessons» o
//     «7 simple ways» no entraban;
//   · y lo más importante: en un carrusel el formato está en las LÁMINAS, no en el pie. El pie suele ser un «Guárdalo 📌».
//     Por eso se lee también el texto de la PORTADA que Instagram escribe para las personas ciegas («May be an image of text
//     that says '5 errores…'», el `alt` del actor de Apify), cuando viene.
//
// SIN INVENTAR: una regla nueva es una frase o una forma que DICE el tipo (un número con un sustantivo contable, «cómo» al
// arrancar el gancho, «antes / después»). Lo que no dice nada queda «sin tipo», que es la verdad. Nunca se adivina por el
// largo, el creador o el tema.
//
// ⚠️ EL TECHO DE ESTO, MEDIDO (6/11/2026) — el diagnóstico que traía el pendiente era el equivocado.
// El pendiente decía «el clasificador no reconoce portugués, alemán ni inglés» y pedía bajar el 85 % sin tipo. Se midió el
// idioma de los 1.205 carruseles sin tipo QUE TIENEN TEXTO (de 1.213 sin tipo sobre 1.470; sólo 8 ya no tienen texto):
//     inglés 893 (74 %) · español 164 (14 %) · sin decidir 120 · portugués 21 · alemán 4 · francés 3
// O sea: el portugués y el alemán juntos son 25 piezas, el 2 %. La tanda de pt/de que se agregó antes podía mover 40 y movió
// 40. **Lo que falta no es idioma: son inglés y español, que ya estaban cubiertos.** Y no clasifican porque EL PIE NO DICE EL
// TIPO: mirando el corpus, la mayoría son publicaciones que no tienen tipo que encontrar —avisos inmobiliarios (baños,
// recámaras, m2), recetas y comida (tsp, tbsp, meal prep), ropa, saludos de Halloween, cumpleaños, festejos de equipo,
// encuestas de una línea—. Se comprobó también por otro lado: los sustantivos que siguen a un número en ese corpus son
// unidades («years» 14, «hours» 11, «days» 9, «minutes» 8, «meses» 7, «baños», «recámaras», «tsp»), no marcadores de lista.
//
// ⚠️ Y DE DÓNDE SALEN NO ES DE LOS HASHTAGS. Era la corazonada obvia (y se escribió acá antes de medirla, mal): se midió por
// fuente y los 32 temas son la parte CHICA, con el mismo problema y menos ruido que las cuentas curadas:
//     por CUENTA de la lista: 1.190 piezas · 720 visibles · 984 sin tipo (83 %) · 174 fuera de rubro (15 %)
//     por TEMA (hashtag):       280 piezas · 192 visibles · 229 sin tipo (82 %) ·  32 fuera de rubro (11 %)
// Apagar los 32 temas saca 280 de 1.470 (192 visibles) y no mueve el porcentaje. **Lo que llena la biblioteca de ruido son
// las 196 cuentas de la lista**, que publican de todo además de carruseles.
// POR ESO: ampliar reglas acá da 66 piezas y ahí se termina. **El 85 % sin tipo no se arregla en el clasificador: se arregla
// CURANDO cuenta por cuenta** (`scripts/carruseles-biblioteca.mts`, comandos `ocultar`, `excluir` y `sacar`; el detalle y las
// peores cuentas medidas, en docs/hallazgos-carruseles.md). Un carrusel de verdad que no diga su tipo en el pie sólo lo dice
// en sus LÁMINAS, y leerlas pide crédito de Apify.
//
// «PARECE CONTENIDO» (para el orden, nunca para esconder): una señal MEDIBLE con tres valores.
//   · true: dice algo de contenido — tiene tipo, pide algo al final (guardar, comentar, compartir…), o Instagram dice que la
//     portada tiene texto;
//   · false: Instagram dice que la portada es de personas y no tiene texto, o el pie es corto (menos de 8 palabras) y no tiene
//     ni tipo, ni cierre, ni un número («Anytime now….»);
//   · null: no se puede decir.
// QUÉ CUBRE: la foto personal con un pie corto, y (con el texto de la portada) la portada de personas sin texto.
// QUÉ NO CUBRE: un pie personal LARGO sin el texto de la portada (un cumpleaños contado en tres párrafos sale null y queda
// donde lo pone su outlier), ni un carrusel de contenido con un pie de una palabra y sin portada leída (sale false y baja:
// se sigue viendo, más abajo). Por eso baja, no esconde.
// =============================================================================

import { formatoPorTexto, type Formato } from '../spy-detalle';
import { textoComparable } from '../spy-funnel-tipo';
import type { Cierre } from './texto';

/**
 * El texto de la portada que escribió Instagram, sacado de su texto alternativo: lo que va entre comillas después de
 * «that says» (o «que dice»). Sin esa frase, null: el resto («Photo by X on …») no es del creador.
 */
export function textoDePortada(alt: string | null | undefined): string | null {
  const t = String(alt ?? '');
  const m = /(?:text that says|que dice)\s*['"‘“«]([\s\S]+?)['"’”»]\s*(?:\.|$)/i.exec(t);
  const dentro = m?.[1]?.replace(/\s+/g, ' ').trim();
  return dentro ? dentro.slice(0, 500) : null;
}

/**
 * Lo que Instagram dice de la portada en su texto alternativo: si tiene texto, si es de personas sin texto, o nada.
 * «May be an image of text» / «…and text…» → texto; «May be an image of 1 person…» sin «text» → personas.
 */
export function portadaDice(alt: string | null | undefined): 'texto' | 'personas' | null {
  const t = String(alt ?? '').toLowerCase();
  if (!/may be an image of|puede ser una imagen de/.test(t)) return null;
  if (/\btext\b|\btexto\b/.test(t)) return 'texto';
  if (/\b(?:person|people|persona|personas|child|children|baby|niño|niña|bebé)\b/.test(t)) return 'personas';
  return null;
}

// Una lista dice cuántas cosas trae: un número (2 a 30) y, a lo sumo una palabra después, un sustantivo contable.
const SUSTANTIVOS_DE_LISTA = [
  'errores', 'tips', 'consejos', 'claves', 'pasos', 'razones', 'cosas', 'habitos', 'herramientas', 'senales', 'formas', 'maneras',
  'ideas', 'lecciones', 'reglas', 'libros', 'preguntas', 'frases', 'apps', 'estrategias', 'secretos', 'trucos', 'hacks', 'ejemplos',
  'plantillas', 'prompts', 'ganchos', 'hooks', 'mitos', 'verdades', 'aprendizajes', 'principios', 'tipos', 'metodos', 'recursos',
  'ways', 'things', 'lessons', 'rules', 'books', 'steps', 'mistakes', 'habits', 'reasons', 'signs', 'tools', 'questions', 'strategies',
  'secrets', 'tricks', 'examples', 'templates', 'frameworks', 'principles', 'myths', 'truths', 'types', 'methods', 'resources', 'lies',
  'skills', 'takeaways', 'facts', 'quotes', 'prompts', 'ideas', 'hacks', 'tips', 'benefits', 'reasons',
  // Portugués (6/11/2026: 1.253 de 1.470 sin tipo, la mayoría en portugués, alemán e inglés).
  'erros', 'dicas', 'passos', 'motivos', 'razoes', 'coisas', 'habitos', 'ferramentas', 'sinais', 'segredos', 'ideias', 'livros',
  'frases', 'exemplos', 'licoes', 'regras', 'maneiras', 'estrategias', 'truques', 'verdades', 'modelos', 'formas', 'tipos',
  'aprendizados', 'perguntas', 'beneficios', 'lembretes', 'conselhos',
  // Alemán (textoComparable saca las tildes y diéresis: «Gründe» es «grunde»).
  'tipps', 'fehler', 'schritte', 'grunde', 'dinge', 'wege', 'regeln', 'lektionen', 'ideen', 'tools', 'gewohnheiten', 'strategien',
  'geheimnisse', 'beispiele', 'bucher', 'fragen', 'mythen', 'vorlagen', 'moglichkeiten', 'zeichen', 'prinzipien', 'methoden',
  // Francés (6/11/2026: son 3 piezas, pero la regla ya existía para pt y de y el costo de sumarlo es una línea).
  'astuces', 'conseils', 'etapes', 'erreurs', 'raisons', 'facons', 'choses', 'outils', 'idees', 'lecons', 'regles', 'exemples',
  // Medidos en el corpus del 6/11: «recipes» es el único sustantivo de lista con peso que faltaba (9 piezas: «all 9 recipes»),
  // y «slides» se nombra cuando el carrusel se cuenta a sí mismo («montou os 9 slides»).
  'recipes', 'recetas', 'receitas', 'slides',
];
// Hasta DOS palabras entre el número y el sustantivo: con UNA, «5 simple seo tips» y «6 social media facts» se escapaban
// (medido el 6/11/2026; con tres no entra ninguna más, así que el límite queda en dos).
const LISTA_AMPLIA = new RegExp(`(?<![\\p{L}\\p{N}])(?:[2-9]|[12]\\d|30)\\s+(?:\\p{L}+\\s+){0,2}(?:${SUSTANTIVOS_DE_LISTA.join('|')})(?![\\p{L}\\p{N}])`, 'u');

/**
 * Una lista que se nombra SIN número: «here are the…», «these are the…» (23 piezas el 6/11) y el nombre del formato puesto
 * por el creador, «checklist» o «cheat sheet» (9 piezas). Se exige el artículo: «get on the list» es una lista de espera, no
 * un carrusel de lista, y por eso «the list» suelto no cuenta.
 */
const LISTA_FRASES = /(?<![\p{L}\p{N}])(?:here are (?:the|my|some)|these are (?:the|my)|checklist|cheat sheet)(?![\p{L}\p{N}])/u;

// Frases que dicen el tipo y el catálogo de Spy no tiene en inglés (sus equivalentes en español sí están allá).
const FRASES_EN: ReadonlyArray<readonly [Formato, RegExp]> = [
  ['tutorial', /(?<![\p{L}\p{N}])(?:here'?s how to|a guide to|the guide to|step\s*1)(?![\p{L}\p{N}])/u],
  ['storytime', /(?<![\p{L}\p{N}])(?:story time|let me tell you about|the day i)(?![\p{L}\p{N}])/u],
  ['opinion', /(?<![\p{L}\p{N}])(?:nobody tells you|no one tells you|controversial opinion)(?![\p{L}\p{N}])/u],
  ['caso-de-exito', /(?<![\p{L}\p{N}])(?:how we helped|how i helped)(?![\p{L}\p{N}])/u],
  ['preguntas', /(?<![\p{L}\p{N}])(?:you asked|faq)(?![\p{L}\p{N}])/u],
  ['antes-despues', /(?<![\p{L}\p{N}])(?:antes\s*[/|→-]+\s*despues|before\s*[/|→-]+\s*after|before vs\.? after)(?![\p{L}\p{N}])/u],
];

// Lo mismo para portugués y alemán, y más formas en inglés (sobre el texto sin tildes ni mayúsculas). Cada una es una frase o una
// forma que DICE el tipo; nada se adivina por el largo, el creador o el tema.
const FRASES_MULTI: ReadonlyArray<readonly [Formato, RegExp]> = [
  ['tutorial', /(?<![\p{L}\p{N}])(?:passo a passo|paso a paso|step[ -]by[ -]step|schritt fur schritt|anleitung|tutorial|como fazer|so geht)(?![\p{L}\p{N}])/u],
  ['antes-despues', /(?<![\p{L}\p{N}])(?:antes e depois|antes y despues|before and after|vor und nach(?:her)?|vorher nachher)(?![\p{L}\p{N}])/u],
  ['opinion', /(?<![\p{L}\p{N}])(?:unpopular opinion|hot take|opiniao impopular|opiniao polemica|opinion impopular|unpopulare meinung|meine meinung)(?![\p{L}\p{N}])/u],
  ['mito', /(?<![\p{L}\p{N}])(?:myth vs\.? (?:reality|truth|fact)|myth or (?:fact|truth)|mitos? (?:e|y|vs\.?|versus) (?:verdades?|realidad|realidade)|mito ou verdade|mito o realidad|mythos oder wahrheit|mythen)(?![\p{L}\p{N}])/u],
  ['preguntas', /(?<![\p{L}\p{N}])(?:perguntas frequentes|perguntas e respostas|q ?& ?a|haufige fragen|fragen und antworten|preguntas y respuestas|you asked me)(?![\p{L}\p{N}])/u],
  ['caso-de-exito', /(?<![\p{L}\p{N}])(?:case de sucesso|caso de sucesso|caso de exito|case study|erfolgsgeschichte|fallstudie)(?![\p{L}\p{N}])/u],
  ['storytime', /(?<![\p{L}\p{N}])(?:minha historia|vou te contar|true story|my story|storytime|i remember when|meine geschichte|wahre geschichte|ich erzahle)(?![\p{L}\p{N}])/u],
  ['promo', /(?<![\p{L}\p{N}])(?:\d{1,3} ?% (?:off|de desconto|de descuento|rabatt)|oferta especial|frete gratis|shop now|compre agora|comprar ahora|jetzt kaufen|jetzt bestellen|cotiza|cotize)(?![\p{L}\p{N}])/u],
];

/**
 * Los tipos del catálogo que el clasificador de carruseles NO intentaba (6/11/2026): sus frases fuertes son casi todas en
 * español (lib/spy-catalogo-datos.ts) y el 74 % de lo que queda sin tipo está en inglés. Cada una es una frase que DICE el
 * tipo; las que se midieron y NO entraron están abajo, con el porqué, para que nadie las vuelva a intentar.
 *
 * ⛔ MEDIDAS Y RECHAZADAS, con lo que daban:
 *   · «i tried» / «we tried» como reseña → 4 piezas, las 4 falsas («i tried to ask myself», «i tried to reach out»);
 *   · «which one are you» / «rate this» como tendencia → 22, casi todas recetas preguntando cuál vas a cocinar;
 *   · «a reminder that» / «your reminder» como frase → 8, pero es un giro adentro del texto, no un carrusel de frase
 *     (el catálogo deja `frase` SIN frases fuertes a propósito);
 *   · «work in progress» como detrás de escena → 1, falsa;
 *   · «most people think» como opinión → 1, y es el arranque de cualquier cosa.
 * Y el orden importa: `promo` va AL FINAL, porque un carrusel de contenido que cierra con «link in bio» es contenido.
 */
const FRASES_MAS: ReadonlyArray<readonly [Formato, RegExp]> = [
  ['tutorial', /(?<![\p{L}\p{N}])(?:here'?s (?:how|what|why)|here is how|this is how (?:i|we|you)|comment faire|pas a pas|voici comment|tutoriel)(?![\p{L}\p{N}])/u],
  ['caso-de-exito', /(?<![\p{L}\p{N}])how (?:we|i) (?:made|built|grew|turned|took|scaled)(?![\p{L}\p{N}])/u],
  ['entrevista', /(?<![\p{L}\p{N}])(?:new episode|latest episode|full episode|this episode of|on (?:the|our|my) podcast|in conversation with|sat down with|(?:my|our) guest|interview with|novo episodio|neue folge)(?![\p{L}\p{N}])/u],
  ['recap-evento', /(?<![\p{L}\p{N}])(?:event recap|recap of (?:the|our)|that'?s a wrap|thank you to everyone who|meet the finalists)(?![\p{L}\p{N}])/u],
  // Promo, al final: la tienda y el turno que se venden de frente.
  // ⛔ «link in bio», «dm us to», «free audit», «want us to», «contact us» se midieron y SE SACARON: daban 43 piezas pero
  // mal tipadas. Son el CTA de un carrusel de CONTENIDO, no el tipo del carrusel: con ellas, una tanda de acciones que subieron
  // («the stocks that jumped», una lista) y un recap de evento («15 founders joined our program… link in bio to register»)
  // salían «Promoción directa». **Un tipo equivocado es peor que «sin tipo»**: el cliente filtra por tipo justamente para no
  // mirar todo. Lo de «Comenta X palabra» ya tiene su propio campo y su propia regla en ./cta.ts; no se mezcla con el tipo.
  ['promo', /(?<![\p{L}\p{N}])(?:shop now|in stores now|new (?:collection|drop|arrival)|free shipping|use code|discount code|book (?:your|a) (?:call|session|appointment|table)|appointments? available|open for bookings|sizes available|work with (?:us|me)|hire (?:us|me))(?![\p{L}\p{N}])/u],
];

const MARCA = String.raw`(?:️?⃣|[.)])`;
const ENUMERADO = new RegExp(String.raw`(?<![\d.,$%])1${MARCA}\s*\S[\s\S]{2,400}?(?<![\d.,$%])2${MARCA}\s*\S[\s\S]{2,400}?(?<![\d.,$%])3${MARCA}`, 'u');

/** El gancho: la primera línea con letras (en un carrusel, lo que dice arriba del pie). */
function primeraLinea(texto: string): string {
  return texto.split(/\n+/).map((l) => l.trim()).find((l) => /\p{L}/u.test(l)) ?? '';
}

/** Lo que dice el tipo en UN texto (la portada o el pie). '' = no dice nada. */
function tipoEn(texto: string | null): Formato | '' {
  if (!texto?.trim()) return '';
  const deSpy = formatoPorTexto(texto);
  if (deSpy) return deSpy;
  const n = textoComparable(texto);
  if (LISTA_AMPLIA.test(n) || LISTA_FRASES.test(n)) return 'lista';
  for (const [f, re] of FRASES_EN) if (re.test(n)) return f;
  for (const [f, re] of FRASES_MULTI) if (re.test(n)) return f;
  for (const [f, re] of FRASES_MAS) if (re.test(n)) return f;
  // Tres puntos numerados seguidos (1. 2. 3. / 1) 2) 3) / 1️⃣ 2️⃣ 3️⃣): una lista aunque el título no traiga el número.
  if (ENUMERADO.test(texto)) return 'lista';
  // «Cómo vender…», «How I…» no; «Cómo» con tilde, al ARRANCAR el gancho, es un tutorial («como emprendedora…» no lo es:
  // por eso se mira el texto original, con su tilde, y sólo la primera línea).
  const gancho = primeraLinea(texto);
  if (/^(?:¿\s*)?c[óÓ]mo\s+\p{L}/iu.test(gancho) && !/\?\s*$/.test(gancho)) return 'tutorial';
  if (/^(?:gu[íi]a\s+(?:para|de|r[áa]pida)|aprende\s+a\s)/iu.test(gancho)) return 'tutorial';
  // Portugués («Como vender mais» / «Aprenda a…» / «Guia para…»), alemán («So gewinnst du…», «Wie du…») e inglés («How to…»):
  // al ARRANCAR el gancho y sin cerrar en pregunta. «Como» + un infinitivo (-ar/-er/-ir) no es «como emprendedora».
  if (!/\?\s*$/.test(gancho)) {
    if (/^(?:\p{Extended_Pictographic}\s*)*(?:como\s+\p{L}+[aeiíoô]r\b|aprenda\s+a\s|guia\s+(?:para|de|rapido)|so\s+\p{L}+\s+(?:du|sie|man)\b|wie\s+(?:du|sie|man)\s|how\s+to\s)/iu.test(gancho)) return 'tutorial';
  }
  return '';
}

/**
 * El tipo de un carrusel: primero lo que dice su PORTADA (el texto que escribió Instagram), después su pie. Con el mismo
 * vocabulario de Spy (`Formato`), así el filtro por tipo es uno solo.
 */
export function tipoDeCarrusel(o: { texto: string | null; portada?: string | null }): Formato | '' {
  return tipoEn(o.portada ?? null) || tipoEn(o.texto);
}

const PALABRAS_MINIMAS = 8;

/** ¿Parece contenido? true / false / null (no se puede decir). El porqué, arriba de todo. */
export function pareceContenido(o: { texto: string | null; formato: string | null; cierre: Cierre | string | null; portada?: 'texto' | 'personas' | null }): boolean | null {
  if (o.portada === 'texto') return true;
  if (o.formato || o.cierre) return true;
  if (o.portada === 'personas') return false;
  const t = (o.texto ?? '').trim();
  if (!t) return null;
  const palabras = t.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  if (palabras < PALABRAS_MINIMAS && !/\p{N}/u.test(t)) return false;
  return null;
}

/** El texto alternativo de un ítem del actor de Apify: el de la publicación o, si no, el de su primera lámina. */
export function altDelItem(item: unknown): string | null {
  const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
  if (!o) return null;
  if (typeof o.alt === 'string' && o.alt.trim()) return o.alt;
  const hijos = Array.isArray(o.childPosts) ? o.childPosts : [];
  const primera = hijos[0] && typeof hijos[0] === 'object' ? (hijos[0] as Record<string, unknown>) : null;
  return typeof primera?.alt === 'string' && primera.alt.trim() ? primera.alt : null;
}
