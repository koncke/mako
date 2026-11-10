// =============================================================================
// «Emojis automáticos» de los subtítulos (Submagic: «Auto emojis»): qué emoji va con cada subtítulo
// =============================================================================
// Pedido de Martín (9/11/2026, «duplicar Submagic para el tema de los subtítulos») y de Leila (30/10). Submagic pone
// emojis animados junto al subtítulo y se pueden agregar o sacar a mano (docs/editor-video/relevo-submagic.md: no
// publica cuántos ni dónde). Acá, como las palabras clave (lib/editor-video/claves.ts): SIN IA, en el navegador y
// gratis, con un diccionario que se prueba (tests/video-editor-subtitulos-submagic.test.ts):
//   · un emoji por subtítulo, SÓLO si dice algo que se puede dibujar («dinero» → 💰, «gratis» → 🎁, «idea» → 💡);
//     un subtítulo de puras palabras sueltas («y entonces lo vi») no lleva ninguno: emojis por emojis tapan el video;
//   · la palabra clave del subtítulo gana (es la que pesa); si no, la primera que esté en el diccionario;
//   · nunca el mismo emoji en dos subtítulos seguidos, y entre uno y otro al menos SEPARACION_S segundos.
// Se dibujan como un sticker de Stickers › Emojis (la fuente de emojis del sistema), encima del subtítulo, en su propia
// pista «Emojis», con la animación de entrada «Rebote» (./emojis-poner.ts). Cada uno lleva la marca de su subtítulo
// (`subtitulo.emojiDe`): apagar los saca a todos y volver a prender los rehace.
//
// Puro: sin canvas, sin motor y sin `wasm` (lo importan los tests y el chat).

import { normalizarClave, palabrasDelTexto } from "@/lib/editor-video/claves";

/** La marca de un sticker que es el emoji de un subtítulo: el id del subtítulo. No es estilo ni se declara. */
export const PARAM_EMOJI_DE = "subtitulo.emojiDe";

/** El nombre de la pista donde van (como «B-roll» y «Planos»). */
export const NOMBRE_PISTA_EMOJIS = "Emojis";

/** Entre un emoji y el siguiente, como mínimo: uno en cada subtítulo de un reel rápido marea. */
export const SEPARACION_S = 2.5;

/**
 * Las raíces y su emoji. Una raíz va por el COMIENZO de la palabra normalizada (sin tildes ni mayúsculas): «diner»
 * agarra «dinero» y «dineros». Con «$» al final es la palabra ENTERA: «auto$» es el auto y no «automatizar», y «año$»
 * —que sin tilde es «ano»— no agarra «anotar». Lo más específico va primero (se busca en orden). Lo que no tiene un
 * dibujo claro no está: un emoji que hay que adivinar no ayuda a leer el video sin sonido.
 */
export const DICCIONARIO_EMOJIS: ReadonlyArray<readonly [string, string]> = [
	// Plata y ventas
	["diner", "💰"], ["plata", "💰"], ["dolar", "💵"], ["peso", "💵"], ["precio", "🏷️"], ["pag", "💳"], ["cobr", "💳"],
	["factur", "💰"], ["ganan", "💰"], ["millon", "💰"], ["ahorr", "🐷"], ["invers", "📈"], ["invert", "📈"],
	["vend", "🤝"], ["venta", "🤝"], ["client", "🤝"], ["negoci", "💼"], ["empres", "🏢"], ["trabaj", "💼"],
	["oferta", "🔥"], ["descuent", "🏷️"], ["gratis", "🎁"], ["regal", "🎁"], ["bonus", "🎁"], ["bono", "🎁"],
	["crec", "📈"], ["escal", "📈"], ["result", "📊"], ["numer", "📊"], ["porcent", "📊"], ["estadist", "📊"],
	["meta", "🎯"], ["objetiv", "🎯"], ["estrateg", "🧠"], ["plan", "🗺️"],
	// Tiempo
	["tiempo", "⏰"], ["hora", "⏰"], ["minut", "⏱️"], ["segund", "⏱️"], ["rapid", "⚡"], ["urgent", "🚨"],
	["hoy$", "📅"], ["mañana", "📅"], ["semana", "📅"], ["mes$", "📅"], ["meses$", "📅"], ["año$", "📅"], ["años$", "📅"], ["fecha", "📅"],
	// Ideas y aprendizaje
	["idea", "💡"], ["secret", "🤫"], ["truco", "🪄"], ["clave", "🔑"], ["aprend", "📚"], ["curso", "📚"],
	["estudi", "📚"], ["libro", "📖"], ["pens", "🤔"], ["pregunt", "❓"], ["respuest", "💬"], ["cerebro", "🧠"],
	["mente", "🧠"], ["consej", "💡"],
	// Bien y mal
	["exito", "🏆"], ["gan", "🏆"], ["logr", "🏆"], ["mejor", "⭐"], ["perfect", "👌"], ["increibl", "🤯"],
	["brutal", "🔥"], ["fuego", "🔥"], ["error", "❌"], ["problem", "⚠️"], ["cuidado", "⚠️"], ["peligr", "⚠️"],
	["mal", "👎"], ["bien", "👍"], ["correct", "✅"], ["listo", "✅"], ["nunca", "🚫"], ["prohib", "🚫"],
	["miedo", "😱"], ["feliz", "😄"], ["risa", "😂"], ["reir", "😂"], ["trist", "😢"], ["amor", "❤️"],
	["encant", "😍"], ["corazon", "❤️"], ["energi", "⚡"], ["fuerz", "💪"], ["salud", "💪"],
	// Cosas y lugares
	["video", "🎬"], ["camara", "📸"], ["foto", "📸"], ["contenid", "🎬"], ["celular", "📱"], ["telefon", "📱"],
	["mensaj", "💬"], ["whatsapp", "💬"], ["chat", "💬"], ["correo", "📧"], ["email", "📧"], ["comput", "💻"],
	["instagram", "📲"], ["redes", "📲"], ["tiktok", "📲"], ["anunci", "📣"], ["publicid", "📣"],
	["casa", "🏠"], ["hogar", "🏠"], ["propiedad", "🏠"], ["inmobil", "🏠"], ["depart", "🏢"], ["mundo", "🌎"],
	["viaj", "✈️"], ["auto$", "🚗"], ["autos$", "🚗"], ["coche", "🚗"], ["comid", "🍽️"], ["cafe", "☕"], ["music", "🎵"],
	["famil", "👨‍👩‍👧"], ["hij", "👶"], ["equipo", "👥"], ["gente", "👥"], ["persona", "👤"],
	["mirá", "👀"], ["mira", "👀"], ["ojo", "👀"], ["escuch", "👂"], ["habl", "🗣️"],
];

/** Las raíces normalizadas (sin tildes), en orden; `entera` = la palabra tiene que ser ésa. */
const RAICES = DICCIONARIO_EMOJIS.map(([r, e]) => {
	const entera = r.endsWith("$");
	return { raiz: normalizarClave(entera ? r.slice(0, -1) : r), entera, emoji: e };
});

/**
 * Palabras que empiezan como una raíz y NO son eso: «mesa» no es un mes, «planta» no es un plan, «ganas» no es ganar.
 * Con una raíz corta el diccionario agarra de más; acá se cortan las que se dicen seguido en un video.
 */
const NO_SON = new Set(["planta", "plantas", "plano", "planos", "planeta", "ganas", "gana", "pagina", "paginas", "maleta", "malla", "metal"]);

/** El emoji de UNA palabra, o null. Las palabras de menos de 3 letras no cuentan («a», «y», «ya»). */
export function emojiDePalabra(palabra: string): string | null {
	const n = normalizarClave(palabra);
	if (n.length < 3 || NO_SON.has(n)) return null;
	for (const { raiz, entera, emoji } of RAICES) {
		if (entera ? n === raiz : n.startsWith(raiz)) return emoji;
	}
	return null;
}

/** El emoji de un subtítulo: el de su palabra clave si tiene uno; si no, el de su primera palabra con emoji. */
export function emojiDeSubtitulo(texto: string, claves: readonly string[] = []): string | null {
	for (const c of claves) {
		const e = emojiDePalabra(c);
		if (e) return e;
	}
	for (const p of palabrasDelTexto(texto)) {
		const e = emojiDePalabra(p);
		if (e) return e;
	}
	return null;
}

export type SubtituloParaEmoji = { texto: string; inicio: number; fin: number; claves?: readonly string[] };

/**
 * Qué subtítulos llevan emoji y cuál (los índices en el orden dado, que va por tiempo). Ninguno repetido en dos
 * seguidos, y separados por `separacionS` como mínimo (se mide de inicio a inicio).
 */
export function elegirEmojis(subtitulos: readonly SubtituloParaEmoji[], separacionS = SEPARACION_S): Array<{ indice: number; emoji: string }> {
	const salida: Array<{ indice: number; emoji: string }> = [];
	let ultimo: { emoji: string; inicio: number; indice: number } | null = null;
	subtitulos.forEach((s, i) => {
		const emoji = emojiDeSubtitulo(s.texto, s.claves ?? []);
		if (!emoji) return;
		if (ultimo && s.inicio - ultimo.inicio < separacionS) return;
		if (ultimo && ultimo.emoji === emoji && ultimo.indice === i - 1) return;
		salida.push({ indice: i, emoji });
		ultimo = { emoji, inicio: s.inicio, indice: i };
	});
	return salida;
}

/** Cuánto mide el emoji respecto del lado corto del lienzo (el subtítulo es ~5,5 %: el emoji, el doble). */
export const TAMANO_EMOJI = 0.11;

/**
 * Dónde va el emoji: centrado sobre el subtítulo, apenas arriba de su primer renglón. `y` del subtítulo es su centro
 * (px desde el centro del lienzo, como `transform.positionY`); `renglones` y `pxLetra`, su alto.
 */
export function posicionDelEmoji({ x, y, renglones, pxLetra, lienzo }: { x: number; y: number; renglones: number; pxLetra: number; lienzo: { width: number; height: number } }): { x: number; y: number; escala: number } {
	const lado = Math.min(lienzo.width, lienzo.height);
	const pxEmoji = TAMANO_EMOJI * lado;
	const arriba = y - (Math.max(1, renglones) * pxLetra * 1.2) / 2;
	return { x, y: Math.round((arriba - pxLetra * 0.25 - pxEmoji / 2) * 10) / 10, escala: TAMANO_EMOJI };
}
