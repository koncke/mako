// =============================================================================
// Stickers › Emojis: los emojis Unicode, dibujados como sticker
// =============================================================================
// CapCut trae su catálogo de stickers desde su servidor (y los dibujos son de
// ByteDance: no se copian). Lo que sí es de todos es Unicode: los emojis se dibujan
// con la fuente de emojis del SISTEMA (Segoe UI Emoji en Windows, Apple Color Emoji
// en Mac, Noto en Linux/Android) en un canvas y salen como PNG transparente. No hay
// archivos que alojar ni licencias que pagar.
//
// ⚠️ El id guarda los PUNTOS DE CÓDIGO («emojis:1f602», «emojis:2764-fe0f»), no el
// dibujo: el mismo proyecto abierto en otra máquina dibuja el emoji con la fuente
// de esa máquina. Es lo que pasa con cualquier emoji en un texto.
//
// ⚠️ Falta adrede el tacho de basura (U+1F5D1): el test `borrar-tacho-casa` lo acusa en cualquier
// archivo del repo, y un tacho como sticker no le sirve a nadie.

import { buildStickerId, parseStickerId } from "../sticker-id";
import type {
	StickerBrowseResult,
	StickerItem,
	StickerProvider,
	StickerSearchResult,
} from "../types";

export const EMOJIS_PROVIDER_ID = "emojis";

/** Lado del PNG: el render lo escala «contain» al lienzo, y 512 aguanta un 1080 sin verse borroso. */
const LADO_PNG = 512;
const FUENTE_EMOJI =
	'"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color",sans-serif';

/** Los grupos de Unicode, con sus nombres en español. Separados por espacios. */
export const GRUPOS_EMOJI: { id: string; titulo: string; emojis: string }[] = [
	{
		id: "caras",
		titulo: "Caras y emociones",
		emojis:
			"😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💯 💢 💥 💫 💦 💨 💬 💭 💤",
	},
	{
		id: "personas",
		titulo: "Personas y cuerpo",
		emojis:
			"👋 🤚 🖐️ ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🦷 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🙇 🤦 🤷 👮 🕵️ 💂 👷 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🏃 💃 🕺 👯 🧖 🧗 👫 👭 👬 💏 💑 👪",
	},
	{
		id: "naturaleza",
		titulo: "Animales y naturaleza",
		emojis:
			"🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🦗 🕷️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦨 🦡 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🍄 🐚 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 ⭐ 🌟 ✨ ⚡ ☄️ 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💧 ☔ ☂️ 🌊 🌫️",
	},
	{
		id: "comida",
		titulo: "Comida y bebida",
		emojis:
			"🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🥗 🥘 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂",
	},
	{
		id: "viajes",
		titulo: "Viajes y lugares",
		emojis:
			"🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛴 🚲 🛵 🏍️ 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🚏 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁",
	},
	{
		id: "actividades",
		titulo: "Actividades",
		emojis:
			"⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩 🎉 🎊 🎈 🎁 🎀 🎃 🧨 🎎 🎏 🎐 🎑 🧧",
	},
	{
		id: "objetos",
		titulo: "Objetos",
		emojis:
			"⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🕹️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 ⛓️ 🧲 💣 🛡️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚿 🛁 🧼 🧽 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🧸 🖼️ 🛍️ 🛒 ✉️ 📩 📨 📧 📥 📤 📦 🏷️ 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 📇 🗃️ 🗳️ 🗄️ 📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓",
	},
	{
		id: "simbolos",
		titulo: "Símbolos",
		emojis:
			"☮️ ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⚛️ ☢️ ☣️ 📴 📳 ✴️ 🆚 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 ♨️ 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 🏧 ♿ 🅿️ 🚹 🚺 🚼 🚻 📶 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 🗯️ ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄",
	},
];

/** «Tendencias»: los que más se usan en un anuncio (reacción, llamada a la acción, precio). */
export const TENDENCIAS_EMOJI =
	"😂 ❤️ 🔥 😍 🥰 😭 🙏 👍 👏 🎉 ✨ 💯 😎 🤩 😱 🤯 🥳 💪 👀 💥 ⭐ 🚀 💰 📈 ✅ ❌ ⚠️ 📢 🎁 🛒 💸 👉 👇 🤔 😅 🙌 💡 🏆 🎯 ⏰ 📌 🆕 🆓 🔝 💎 🌟 😉 😘 🤑";

/**
 * Palabras para el buscador (en español, sin tildes). No hay nombres oficiales de
 * los emojis en el navegador (Intl no los trae): estos cubren lo que se busca en
 * un anuncio; el nombre del grupo también encuentra el grupo entero.
 */
const PALABRAS: Record<string, string> = {
	risa: "😂 🤣 😆 😄 😁 😹",
	feliz: "😀 😃 😄 😊 🙂 😁 🥳",
	sonrisa: "🙂 😊 😀 😃",
	amor: "❤️ 😍 🥰 😘 💕 💖 💘 💝 💞 💗",
	corazon: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💖 💗",
	beso: "😘 😚 😙 💋",
	fuego: "🔥",
	triste: "😢 😭 😞 😔 🙁 😿",
	llorar: "😢 😭 🥺",
	enojo: "😠 😡 🤬 💢",
	enojado: "😠 😡 🤬",
	sorpresa: "😮 😲 😱 🤯 😳",
	miedo: "😨 😰 😱",
	pensar: "🤔 🧐 💭",
	duda: "🤔 ❓ ❔",
	fiesta: "🥳 🎉 🎊 🎈 🍾 🥂",
	celebrar: "🎉 🎊 🥳 🍾 🥂 🏆",
	regalo: "🎁 🎀",
	dinero: "💰 💵 💸 🤑 💳 💲 💎",
	precio: "💲 🏷️ 💰 💸",
	oferta: "🏷️ 🆓 🔥 💥 🛒",
	gratis: "🆓",
	nuevo: "🆕 ✨",
	compras: "🛒 🛍️ 💳",
	ok: "👌 👍 ✅ ✔️ 🆗",
	bien: "👍 👌 ✅ 💯",
	si: "👍 ✅ ✔️",
	no: "👎 ❌ 🚫 ⛔",
	mal: "👎 ❌",
	alerta: "⚠️ 🚨 ❗ 📢",
	importante: "❗ ‼️ ⚠️ 📌",
	flecha: "👉 👈 👆 👇 ➡️ ⬅️ ⬆️ ⬇️",
	mano: "👋 👍 👎 👏 🙌 🙏 👉 👈 👆 👇 ✌️ 🤞 👌",
	aplauso: "👏 🙌",
	gracias: "🙏 🤝",
	fuerza: "💪 🦾",
	estrella: "⭐ 🌟 ✨ 🤩 💫",
	brillo: "✨ 💫 🌟",
	sol: "☀️ 🌞 🌤️",
	lluvia: "🌧️ ☔ ☂️",
	musica: "🎵 🎶 🎧 🎤 🎸 🎹 🥁",
	video: "🎬 🎥 📹 📽️ 🎞️",
	foto: "📷 📸",
	telefono: "📱 📲 ☎️ 📞",
	reloj: "⏰ ⌚ ⏱️ ⏳ ⌛",
	tiempo: "⏰ ⏳ ⌛ ⏱️",
	casa: "🏠 🏡",
	auto: "🚗 🚙 🏎️",
	avion: "✈️ 🛫 🛬",
	cohete: "🚀",
	perro: "🐶 🐕 🐩",
	gato: "🐱 🐈 😺",
	flor: "🌸 🌹 🌺 🌻 🌼 🌷 💐",
	comida: "🍔 🍕 🌮 🍟 🍣 🍝",
	cafe: "☕",
	cerveza: "🍺 🍻",
	pastel: "🎂 🍰 🧁",
	deporte: "⚽ 🏀 🏈 ⚾ 🎾 🏐",
	futbol: "⚽",
	ganar: "🏆 🥇 🎯 💯",
	trofeo: "🏆 🥇 🏅",
	objetivo: "🎯",
	idea: "💡",
	grafica: "📈 📊 📉",
	crecer: "📈 🚀",
	ojo: "👀 👁️",
	mirar: "👀",
	calavera: "💀",
	fantasma: "👻",
	robot: "🤖",
	navidad: "🎄 🎅 🤶 ☃️ ⛄ 🎁",
	halloween: "🎃 👻 💀",
	check: "✅ ✔️ ☑️",
	cruz: "❌ ✖️",
	numero: "0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟",
	circulo: "🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤",
	cuadrado: "🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫",
};

export function separarEmojis(texto: string): string[] {
	return texto.split(/\s+/).filter(Boolean);
}

/** «😂» → «1f602»; «❤️» → «2764-fe0f». */
export function emojiAValor(emoji: string): string {
	return [...emoji].map((c) => (c.codePointAt(0) ?? 0).toString(16)).join("-");
}

export function valorAEmoji(valor: string): string {
	return String.fromCodePoint(
		...valor
			.split("-")
			.map((h) => Number.parseInt(h, 16))
			.filter((n) => Number.isFinite(n) && n > 0),
	);
}

/** El emoji de un id de sticker «emojis:…», o null si el id es de otro proveedor. */
export function emojiDeSticker(stickerId: string): string | null {
	try {
		const { providerId, providerValue } = parseStickerId({ stickerId });
		return providerId === EMOJIS_PROVIDER_ID ? valorAEmoji(providerValue) : null;
	} catch {
		return null;
	}
}

function svgDeEmoji(emoji: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO_PNG}" height="${LADO_PNG}" viewBox="0 0 ${LADO_PNG} ${LADO_PNG}"><text x="50%" y="50%" font-size="${Math.round(LADO_PNG * 0.8)}" font-family='${FUENTE_EMOJI}' text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const cachePng = new Map<string, string>();

/**
 * El emoji como PNG transparente, centrado por su caja REAL (la de la fuente
 * deja aire distinto arriba y abajo según el sistema). Sin canvas (servidor),
 * un SVG con el texto, que el navegador dibuja igual.
 */
export function pngDeEmoji(emoji: string): string {
	const enCache = cachePng.get(emoji);
	if (enCache) return enCache;
	if (typeof document === "undefined") return svgDeEmoji(emoji);

	const canvas = document.createElement("canvas");
	canvas.width = LADO_PNG;
	canvas.height = LADO_PNG;
	const ctx = canvas.getContext("2d");
	if (!ctx) return svgDeEmoji(emoji);

	let tamano = Math.round(LADO_PNG * 0.8);
	ctx.textAlign = "center";
	ctx.textBaseline = "alphabetic";
	ctx.font = `${tamano}px ${FUENTE_EMOJI}`;
	let m = ctx.measureText(emoji);
	const ancho = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
	const alto = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
	const limite = LADO_PNG * 0.94;
	if (ancho > limite || alto > limite) {
		tamano = Math.floor(tamano * Math.min(limite / ancho, limite / alto));
		ctx.font = `${tamano}px ${FUENTE_EMOJI}`;
		m = ctx.measureText(emoji);
	}
	const x = LADO_PNG / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
	const y = LADO_PNG / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
	ctx.fillText(emoji, x, y);

	const url = canvas.toDataURL("image/png");
	cachePng.set(emoji, url);
	return url;
}

export function aStickerEmoji(emoji: string): StickerItem {
	return {
		id: buildStickerId({ providerId: EMOJIS_PROVIDER_ID, providerValue: emojiAValor(emoji) }),
		provider: EMOJIS_PROVIDER_ID,
		name: emoji,
		// La grilla dibuja el glifo directo; esta URL es para quien necesite una imagen.
		previewUrl: svgDeEmoji(emoji),
		metadata: { emoji },
	};
}

function normalizar(texto: string): string {
	return texto
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

// Con `new RegExp`: el `tsconfig` apunta a ES2017 y `\p{…}` es de ES2018 (el
// navegador lo entiende; el compilador lo rechazaría escrito como literal).
const PICTOGRAFICO = new RegExp("\\p{Extended_Pictographic}", "u");

/** Los emojis que encuentra una búsqueda (por palabra o por nombre de grupo), sin repetir. */
export function buscarEmojis(consulta: string): string[] {
	const q = normalizar(consulta);
	if (!q) return [];
	const encontrados = new Set<string>();
	for (const [palabra, emojis] of Object.entries(PALABRAS)) {
		if (palabra.startsWith(q) || (q.length >= 3 && palabra.includes(q))) {
			for (const e of separarEmojis(emojis)) encontrados.add(e);
		}
	}
	for (const grupo of GRUPOS_EMOJI) {
		if (normalizar(grupo.titulo).includes(q)) {
			for (const e of separarEmojis(grupo.emojis)) encontrados.add(e);
		}
	}
	// Pegar un emoji en el buscador también lo encuentra.
	for (const e of separarEmojis(consulta)) {
		if (PICTOGRAFICO.test(e)) encontrados.add(e);
	}
	return [...encontrados];
}

export const emojisProvider: StickerProvider = {
	id: EMOJIS_PROVIDER_ID,
	async search({ query, options }): Promise<StickerSearchResult> {
		const todos = buscarEmojis(query);
		const limite = options?.limit ?? todos.length;
		return {
			items: todos.slice(0, limite).map(aStickerEmoji),
			total: todos.length,
			hasMore: todos.length > limite,
		};
	},
	async browse(): Promise<StickerBrowseResult> {
		return {
			sections: GRUPOS_EMOJI.map((grupo) => ({
				id: grupo.id,
				title: grupo.titulo,
				items: separarEmojis(grupo.emojis).map(aStickerEmoji),
				layout: "grid" as const,
			})),
		};
	},
	resolveUrl({ stickerId }): string {
		const { providerValue } = parseStickerId({ stickerId });
		return pngDeEmoji(valorAEmoji(providerValue));
	},
};
