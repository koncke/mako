'use client';

// =============================================================================
// EmojiPicker — selector de emojis estilo WhatsApp Web
// =============================================================================
//  - Pestañas de categoría arriba (con un emoji como ícono) + grilla scrolleable.
//  - Click en un emoji → onPick(emoji). NO cierra (podés poner varios seguidos).
//  - Búsqueda simple por keyword, sin dependencias.
//  - Botón ✕ chico para cerrar (el padre maneja el click-afuera, sin overlay).
//  - Solo el panel: NO usa position fixed/absolute; el padre lo posiciona.
// =============================================================================

import { useMemo, useState, type CSSProperties } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Set de emojis curado por categoría (unicode hardcodeado, sin librerías)
// ─────────────────────────────────────────────────────────────────────────────

interface Categoria {
  key: string;
  label: string;
  icon: string;
  emojis: string[];
}

const CARITAS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
  '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
  '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶',
  '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
  '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
  '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
  '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩',
  '🤡', '👻', '👽', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
];

const GESTOS = [
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
  '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
  '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾',
  '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️',
  '👅', '👄', '🫶', '🫳', '🫴', '🫱', '🫲', '🖎', '👶', '🧒', '👦', '👧',
  '🧑', '👨', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋',
  '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👲', '🧕',
  '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜',
];

const CORAZONES = [
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕',
  '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '💍', '💎',
  '🫶', '😍', '🥰', '😘', '😻', '💑', '💏', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩', '💐', '🌹',
  '🌷', '🌸', '🌺', '🌻', '🌼', '💮', '🏵️', '🥀', '💒', '💘', '💖', '💗',
];

const ANIMALES = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁',
  '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦',
  '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝',
  '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🦗', '🕷️', '🕸️', '🦂',
  '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠',
  '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘',
  '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏',
  '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜',
  '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀',
];

const COMIDA = [
  '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
  '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️',
  '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖',
  '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭',
  '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕',
  '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘',
  '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂',
  '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼',
  '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃',
  '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥢', '🧂',
];

const ACTIVIDADES = [
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓',
  '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿',
  '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂',
  '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽',
  '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
  '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹',
  '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳',
  '🎮', '🎰', '🧩', '🎴', '🃏', '🀄', '🎨', '🎙️', '🎚️', '🎛️',
];

const VIAJES = [
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
  '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖',
  '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆',
  '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁',
  '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥',
  '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️',
  '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️',
  '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫',
  '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🌁', '🌃', '🏙️',
  '🌄', '🌅', '🌆', '🌇', '🌉', '🌌', '🎇', '🎆', '🌍', '🌎', '🌏', '🌐',
];

const OBJETOS = [
  '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽',
  '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️',
  '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️',
  '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸',
  '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '🧾', '💎', '⚖️', '🪜', '🧰',
  '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪛', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲',
  '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️',
  '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊',
  '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽',
  '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️',
  '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒',
  '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩',
  '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮',
  '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆',
  '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰',
  '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗',
  '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️',
  '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
];

const SIMBOLOS = [
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
  '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
  '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌',
  '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️',
  '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
  '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌',
  '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱',
  '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️',
  '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎',
  '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️',
  '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶',
  '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓',
  '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢',
  '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪',
  '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️',
  '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃',
  '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '👁️‍🗨️',
  '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢',
  '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳',
  '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦',
  '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢',
  '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑',
];

// Etiquetas de búsqueda (keyword → emoji). Curado para términos comunes en ES/EN.
const KEYWORDS: Record<string, string[]> = {
  '😀': ['sonrisa', 'feliz', 'smile', 'happy'],
  '😂': ['risa', 'lol', 'laugh', 'lagrimas'],
  '🤣': ['risa', 'rofl', 'laugh'],
  '🥰': ['amor', 'love', 'enamorado', 'corazones'],
  '😍': ['amor', 'love', 'enamorado', 'ojos corazon'],
  '😘': ['beso', 'kiss', 'amor'],
  '😎': ['cool', 'lentes', 'genial', 'sunglasses'],
  '😭': ['llorar', 'cry', 'triste', 'sad'],
  '😢': ['triste', 'cry', 'sad', 'llorar'],
  '😡': ['enojado', 'angry', 'furioso', 'enojo'],
  '🤔': ['pensar', 'think', 'duda'],
  '😴': ['dormir', 'sleep', 'sueño'],
  '🥳': ['fiesta', 'party', 'celebrar', 'cumpleaños'],
  '👍': ['ok', 'like', 'bien', 'pulgar', 'thumbs up', 'dale'],
  '👎': ['mal', 'dislike', 'no', 'pulgar abajo'],
  '👏': ['aplausos', 'clap', 'bravo'],
  '🙏': ['gracias', 'pray', 'porfavor', 'rezar', 'thanks'],
  '🙌': ['celebrar', 'manos', 'yay', 'hooray'],
  '💪': ['fuerza', 'musculo', 'strong', 'gym'],
  '❤️': ['corazon', 'amor', 'love', 'heart', 'rojo'],
  '💔': ['corazon roto', 'broken heart', 'desamor'],
  '🔥': ['fuego', 'fire', 'genial', 'caliente'],
  '✅': ['check', 'listo', 'ok', 'done', 'hecho'],
  '❌': ['cruz', 'no', 'cancelar', 'error', 'mal'],
  '🎉': ['fiesta', 'party', 'celebrar', 'confeti'],
  '🎂': ['cumpleaños', 'torta', 'cake', 'birthday'],
  '☕': ['cafe', 'coffee', 'mate'],
  '🍕': ['pizza', 'comida'],
  '🚗': ['auto', 'car', 'coche', 'carro'],
  '✈️': ['avion', 'plane', 'viaje', 'vuelo'],
  '💰': ['dinero', 'money', 'plata', 'cash'],
  '💳': ['tarjeta', 'card', 'pago', 'pagar'],
  '📞': ['telefono', 'phone', 'llamar', 'call'],
  '📱': ['celular', 'phone', 'movil', 'smartphone'],
  '💬': ['chat', 'mensaje', 'bocadillo', 'message'],
  '📅': ['calendario', 'fecha', 'agenda', 'calendar'],
  '⏰': ['reloj', 'alarma', 'clock', 'hora', 'tiempo'],
  '⭐': ['estrella', 'star', 'favorito'],
  '🎁': ['regalo', 'gift', 'present'],
  '👋': ['hola', 'hi', 'saludo', 'adios', 'wave', 'chau'],
  '🤝': ['acuerdo', 'trato', 'handshake', 'deal'],
  '💯': ['cien', '100', 'perfecto', 'top'],
  '🤑': ['dinero', 'money', 'rico'],
  '😅': ['nervioso', 'sudor', 'risa nerviosa'],
  '🙈': ['mono', 'verguenza', 'ups'],
};

const CATEGORIAS: Categoria[] = [
  { key: 'caritas', label: 'Caritas', icon: '😀', emojis: CARITAS },
  { key: 'gestos', label: 'Gestos', icon: '👍', emojis: GESTOS },
  { key: 'corazones', label: 'Corazones', icon: '❤️', emojis: CORAZONES },
  { key: 'animales', label: 'Animales', icon: '🐶', emojis: ANIMALES },
  { key: 'comida', label: 'Comida', icon: '🍔', emojis: COMIDA },
  { key: 'actividades', label: 'Actividades', icon: '⚽', emojis: ACTIVIDADES },
  { key: 'viajes', label: 'Viajes', icon: '✈️', emojis: VIAJES },
  { key: 'objetos', label: 'Objetos', icon: '💡', emojis: OBJETOS },
  { key: 'simbolos', label: 'Símbolos', icon: '🔣', emojis: SIMBOLOS },
];

// Pool global para buscar (dedupe manteniendo orden).
const TODOS = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of CATEGORIAS) {
    for (const e of c.emojis) {
      if (!seen.has(e)) { seen.add(e); out.push(e); }
    }
  }
  return out;
})();

const RECIENTES_DEFAULT = ['😀', '😂', '🥰', '😍', '👍', '🙏', '🔥', '❤️', '🎉', '👏', '😅', '🤔', '✅', '💪', '🥳', '😎'];
const RECIENTES_KEY = 'mako-emoji-recientes';

// Normaliza para buscar sin importar acentos/mayúsculas ("café" == "cafe").
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');
function norm(s: string): string {
  return s.normalize('NFD').replace(DIACRITICOS, '').toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  width: '340px', height: '320px', display: 'flex', flexDirection: 'column',
  background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '14px',
  boxShadow: '0 12px 34px rgba(18,21,27,.18)', overflow: 'hidden',
  fontFamily: "'Geist', sans-serif",
};

const headRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 10px 8px',
  borderBottom: '1px solid var(--border)',
};

const searchInput: CSSProperties = {
  flex: 1, minWidth: 0, padding: '8px 11px', borderRadius: '9px',
  border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)',
  fontFamily: "'Geist', sans-serif", fontSize: '13px', outline: 'none',
};

const closeBtn: CSSProperties = {
  width: '28px', height: '28px', flex: 'none', borderRadius: '8px', cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
};

const tabsRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px',
  borderBottom: '1px solid var(--border)', overflowX: 'auto',
};

const gridWrap: CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px',
};

const grid: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px',
};

const emojiBtn: CSSProperties = {
  width: '100%', aspectRatio: '1 / 1', border: 'none', background: 'transparent',
  borderRadius: '8px', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function EmojiPicker({ onPick, onClose, embebido = false }: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  /**
   * ⚠️ ESTO ES UN PANEL COMPLETO, Y ADENTRO DE OTRO SE VE COMO UN DESPLEGABLE
   * ADENTRO DE UN DESPLEGABLE. Reportado así, textual, el 27/09/2026 sobre el
   * selector de identidad: caja con borde y sombra propios adentro de una caja con
   * borde y sombra, **dos barras de scroll verticales** (sus 320 px fijos adentro
   * de un cuerpo de 300) y un ✕ que cierra una cosa que el de afuera ya cierra.
   *
   * Con `embebido`, el panel deja de ser una caja y pasa a ser contenido: sin
   * borde, sin radio, sin sombra, sin alto fijo —estira— y sin el ✕, porque el
   * que cierra es el de arriba. Es la misma prop y la misma decisión que AGENTS.md
   * documenta para montar una PANTALLA adentro de un modal: va UNA prop y no
   * cinco, porque son la misma decisión.
   *
   * Es OPT-IN: los cuatro call sites de WhatsApp, donde esto SÍ es el panel, no se
   * enteran.
   */
  embebido?: boolean;
}) {
  const [cat, setCat] = useState<string>('recientes');
  const [query, setQuery] = useState('');
  const [recientes, setRecientes] = useState<string[]>(() => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RECIENTES_KEY) : null;
      const arr = raw ? (JSON.parse(raw) as string[]) : null;
      return Array.isArray(arr) && arr.length ? arr : RECIENTES_DEFAULT;
    } catch {
      return RECIENTES_DEFAULT;
    }
  });

  const q = norm(query.trim());

  // Elegir un emoji: lo manda al chat y lo recuerda en "Recientes" (localStorage).
  const pick = (e: string) => {
    onPick(e);
    setRecientes((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)].slice(0, 24);
      try { localStorage.setItem(RECIENTES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  // Resultados: con búsqueda filtra todo el pool (sin acentos); si no, la categoría.
  const visibles = useMemo(() => {
    if (q) {
      return TODOS.filter((e) => {
        const kws = KEYWORDS[e];
        return kws ? kws.some((k) => norm(k).includes(q)) : false;
      });
    }
    if (cat === 'recientes') return recientes;
    return CATEGORIAS.find((c) => c.key === cat)?.emojis ?? [];
  }, [q, cat, recientes]);

  const tabs = useMemo(
    () => [{ key: 'recientes', label: 'Recientes', icon: '🕘' }, ...CATEGORIAS.map((c) => ({ key: c.key, label: c.label, icon: c.icon }))],
    [],
  );

  return (
    <div
      style={embebido
        // Estira en los dos ejes y no dibuja caja: la caja es la de afuera.
        // `height: '100%'` funciona acá porque el padre le da un alto EXPLÍCITO
        // (no un `flex: 1`, que para el motor es un alto indefinido y en Safari
        // resuelve a cero — AGENTS.md lo tiene medido como pantalla en blanco).
        ? { ...panelStyle, width: '100%', height: '100%', border: 0, borderRadius: 0, boxShadow: 'none' }
        : panelStyle}
      // Sin `role="dialog"` embebido: el diálogo es el de afuera, y dos diálogos
      // anidados le dicen al lector de pantalla que se abrió algo que no se abrió.
      role={embebido ? 'group' : 'dialog'}
      aria-label="Selector de emojis">
      <style>{'.mako-emoji-btn:hover{background:var(--surface-2)}'}</style>
      {/* Búsqueda + cerrar */}
      <div style={headRow}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar emoji…"
          aria-label="Buscar emoji"
          style={searchInput}
        />
        {/* El ✕ no va embebido: cerrar es del panel de arriba, y dos botones de
            cerrar a 30 px uno del otro hacen dudar de cuál cierra qué. */}
        {!embebido && (
          <button onClick={onClose} title="Cerrar" aria-label="Cerrar selector de emojis" style={closeBtn}>✕</button>
        )}
      </div>

      {/* Pestañas de categoría (ocultas mientras se busca) */}
      {!q && (
        <div style={tabsRow}>
          {tabs.map((t) => {
            const active = t.key === cat;
            return (
              <button
                key={t.key}
                onClick={() => setCat(t.key)}
                title={t.label}
                aria-label={t.label}
                aria-pressed={active}
                style={{
                  flex: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                  border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
                  background: active ? 'var(--surface-2)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '17px', padding: 0,
                  borderBottom: active ? '2px solid var(--primary)' : '1px solid transparent',
                }}
              >
                {t.icon}
              </button>
            );
          })}
        </div>
      )}

      {/* Grilla */}
      <div style={gridWrap}>
        {visibles.length === 0 ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--faint)', fontSize: '13px' }}>
            Sin resultados.
          </div>
        ) : (
          <div style={grid}>
            {visibles.map((e, i) => (
              <button
                key={`${e}-${i}`}
                onClick={() => pick(e)}
                className="mako-emoji-btn"
                aria-label={`Emoji ${e}`}
                style={emojiBtn}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
