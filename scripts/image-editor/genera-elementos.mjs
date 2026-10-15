// Genera app/image-editor/mako/elementos-lista.ts: los nombres que el panel Elementos muestra SIN búsqueda
// (los «destacados» de cada pack). Con búsqueda, el editor le pregunta a la API de Iconify en vivo.
// Uso: node genera-elementos.mjs <dir con col-<prefijo>.json y tabler-icons.json> <salida .ts>
// Los col-*.json son `GET https://api.iconify.design/collection?prefix=<p>` (14/10/2026); el de Tabler es
// `@iconify-json/tabler/icons.json` de jsDelivr (el endpoint /collection banea una hora tras ~6 pedidos).
import fs from 'node:fs'
import path from 'node:path'

const [dir, salida] = process.argv.slice(2)
const col = (p) => JSON.parse(fs.readFileSync(path.join(dir, `col-${p}.json`), 'utf8'))
const todosDe = (c) => [...(c.uncategorized ?? []), ...Object.values(c.categories ?? {}).flat()]

// Conceptos comunes (en el orden en que se muestran), con sinónimos: cada set nombra distinto.
const CONCEPTOS = [
  ['heart'], ['star'], ['house', 'home'], ['check', 'circle-check', 'check-circle'], ['x', 'close'], ['plus', 'add'],
  ['arrow-right'], ['arrow-left'], ['arrow-up'], ['arrow-down'], ['chevron-right'], ['circle'], ['square'], ['triangle'],
  ['user', 'person'], ['users', 'group'], ['phone', 'call'], ['mail', 'envelope', 'email'], ['message-circle', 'chat-circle', 'message', 'chat'],
  ['calendar', 'calendar-month', 'calendar-blank'], ['clock', 'schedule'], ['map-pin', 'location-on', 'map-pin-simple'], ['map'], ['globe', 'world', 'public'],
  ['search', 'magnifying-glass'], ['settings', 'gear'], ['bell', 'notifications'], ['lock'], ['key'], ['camera', 'photo-camera'],
  ['image', 'photo'], ['video', 'videocam', 'video-camera'], ['music', 'music-note', 'music-notes'], ['headphones'], ['mic', 'microphone'],
  ['book', 'book-open', 'menu-book'], ['bookmark'], ['briefcase', 'work'], ['shopping-cart', 'cart', 'shopping-cart-simple'], ['shopping-bag'],
  ['gift', 'redeem'], ['tag', 'sell'], ['credit-card'], ['wallet', 'account-balance-wallet'], ['currency-dollar', 'dollar-sign', 'attach-money', 'dollar'],
  ['percent', 'percentage'], ['chart-bar', 'bar-chart', 'chart-column', 'leaderboard'], ['trending-up', 'chart-line-up'], ['rocket', 'rocket-launch'],
  ['lightbulb', 'bulb'], ['trophy', 'emoji-events'], ['award', 'medal', 'military-tech'], ['crown'], ['diamond', 'diamonds'], ['flag'],
  ['flame', 'fire', 'local-fire-department'], ['zap', 'bolt', 'lightning'], ['sun', 'sunny', 'light-mode'], ['moon', 'dark-mode'], ['cloud'],
  ['umbrella'], ['snowflake', 'ac-unit'], ['leaf', 'eco'], ['flower', 'local-florist', 'flower-lotus'], ['tree', 'park', 'tree-evergreen'],
  ['coffee', 'local-cafe'], ['pizza', 'local-pizza'], ['car', 'directions-car'], ['plane', 'airplane', 'flight'], ['bike', 'bicycle', 'pedal-bike'],
  ['ship', 'sailboat', 'directions-boat'], ['building', 'apartment', 'buildings'], ['store', 'storefront'], ['school'], ['handshake'],
  ['thumbs-up', 'thumb-up'], ['smile', 'mood-smile', 'smiley', 'mood'], ['eye', 'visibility'], ['hand', 'hand-wave', 'waving-hand'],
  ['pencil', 'edit'], ['brush', 'paint-brush'], ['palette'], ['scissors', 'content-cut', 'cut'], ['paperclip', 'attach-file'], ['link'],
  ['share', 'share-2', 'share-network'], ['download'], ['upload'], ['trash', 'delete', 'trash-2'], ['info', 'circle-info'],
  ['help', 'question', 'circle-help', 'help-circle'], ['alert-triangle', 'warning', 'triangle-alert'], ['shield'], ['wifi'], ['battery', 'battery-full'],
  ['laptop'], ['smartphone', 'device-mobile', 'phone-iphone', 'device-mobile-camera'], ['monitor', 'desktop'], ['printer', 'print'],
  ['sparkles', 'sparkle', 'auto-awesome'], ['party-popper', 'confetti', 'celebration'], ['cake', 'cake-slice'], ['balloon'], ['music-2'],
  ['quote', 'quotes', 'format-quote'], ['speech', 'chat-bubble', 'speech-bubble'], ['target', 'crosshair', 'track-changes'], ['infinity', 'all-inclusive'],
  ['dumbbell', 'barbell', 'fitness-center'], ['stethoscope'], ['paw', 'pets'], ['cat'], ['dog'], ['fish'], ['bird'], ['mountain', 'landscape'],
  ['waves', 'water'], ['droplet', 'drop', 'water-drop'], ['anchor'], ['compass', 'explore'], ['ticket', 'confirmation-number'], ['film', 'movie'],
  ['gamepad', 'game-controller', 'sports-esports'], ['palette-2'], ['hourglass', 'hourglass-empty'], ['megaphone', 'campaign'], ['newspaper'],
  ['clipboard', 'content-paste'], ['file', 'description'], ['folder'], ['graduation-cap', 'school-outline'], ['microscope', 'biotech'], ['atom'],
]

// Lo que no entra: tonos de piel (el mismo emoji seis veces), y marcas registradas (relevamiento §2.2: «Marcas»).
const PIEL = /-(dark|light|medium|medium-dark|medium-light)(-skin-tone)?$/
const MARCAS = new Set(['android-os', 'bbc', 'cd-logo', 'debian', 'dribbble', 'dvd-logo', 'google', 'icons8-cup', 'ipad', 'iphone', 'kindle', 'linux', 'nook', 'reddit', 'steam', 'stumbleupon', 'vlc', 'wi-fi-logo', 'wikipedia', 'phone-android', 'tablet-android'])

function porConceptos(nombres, max = 140) {
  const set = new Set(nombres)
  const out = []
  for (const sin of CONCEPTOS) {
    const hit = sin.find((n) => set.has(n))
    if (hit && !out.includes(hit)) out.push(hit)
  }
  return out.slice(0, max)
}

// Los emoji que más se usan en piezas de marketing, primero (si el set los tiene).
const EMOJI_PRIMERO = [
  'red-heart', 'fire', 'sparkles', 'thumbs-up', 'clapping-hands', 'party-popper', 'rocket', 'hundred-points',
  'check-mark-button', 'star', 'glowing-star', 'smiling-face-with-heart-eyes', 'face-with-tears-of-joy', 'grinning-face',
  'star-struck', 'partying-face', 'smiling-face-with-sunglasses', 'winking-face', 'thinking-face', 'eyes', 'raising-hands',
  'folded-hands', 'flexed-biceps', 'money-bag', 'gem-stone', 'trophy', 'crown', 'light-bulb', 'bullseye', 'chart-increasing',
  'megaphone', 'wrapped-gift', 'balloon', 'birthday-cake', 'camera', 'sun', 'rainbow', 'four-leaf-clover', 'cherry-blossom',
  'sunflower', 'house', 'high-voltage', 'collision', 'warning', 'cross-mark', 'pushpin', 'calendar', 'alarm-clock',
  'mobile-phone', 'laptop', 'shopping-bags', 'credit-card', 'airplane', 'globe-showing-americas', 'graduation-cap', 'books',
]

/** Ronda por categorías: variedad desde el primer renglón (no 40 caritas seguidas). */
function porRonda(categorias, max) {
  const todos = new Set(categorias.flat())
  const out = EMOJI_PRIMERO.filter((n) => todos.has(n))
  const colas = categorias.map((c) => c.filter((n) => !PIEL.test(n) && !out.includes(n)))
  for (let i = 0; out.length < max; i++) {
    let alguno = false
    for (const c of colas) {
      if (i < c.length) {
        alguno = true
        if (out.length < max) out.push(c[i])
      }
    }
    if (!alguno) break
  }
  return out
}

const ORDEN_EMOJI = ['Smileys & Emotion', 'People & Body', 'Animals & Nature', 'Food & Drink', 'Activities', 'Travel & Places', 'Objects', 'Symbols', 'Flags']

const lucide = todosDe(col('lucide'))
const ph = todosDe(col('ph')).filter((n) => !/-(thin|light|bold|fill|duotone)$/.test(n))
const material = todosDe(col('material-symbols')).filter((n) => !/-(rounded|sharp|outline|outline-rounded|outline-sharp)$/.test(n))
const tablerSet = JSON.parse(fs.readFileSync(path.join(dir, 'tabler-icons.json'), 'utf8'))
const tabler = Object.keys(tablerSet.icons).filter((n) => !n.endsWith('-filled'))
const fluent = col('fluent-emoji-flat')
const noto = col('noto')
// Flat Color Icons en orden alfabético arranca con bases de datos («accept-database», «add-column»…):
// primero los que sirven para una pieza de marketing.
const COLOR_PRIMERO = [
  'idea', 'like', 'rating', 'approval', 'money-transfer', 'currency-exchange', 'sales-performance', 'bullish', 'line-chart',
  'pie-chart', 'bar-chart', 'statistics', 'calendar', 'clock', 'alarm-clock', 'home', 'globe', 'shop', 'paid', 'donate',
  'businessman', 'businesswoman', 'collaboration', 'conference-call', 'customer-support', 'graduation-cap', 'diploma-1',
  'reading', 'music', 'camera', 'gallery', 'landscape', 'picture', 'video-call', 'smartphone-tablet', 'phone', 'sms',
  'comments', 'feedback', 'faq', 'questions', 'vip', 'checkmark', 'ok', 'cancel', 'high-priority', 'lock', 'unlock', 'key',
  'puzzle', 'podium-with-speaker', 'voice-presentation', 'planner', 'todo-list', 'survey', 'signature', 'shipped',
  'package', 'in-transit', 'factory', 'engineering', 'services', 'settings', 'search', 'link', 'share', 'upload', 'download',
]
const flatTodos = todosDe(col('flat-color-icons')).filter((n) => !MARCAS.has(n))
const flat = [...COLOR_PRIMERO.filter((n) => flatTodos.includes(n)), ...flatTodos.filter((n) => !COLOR_PRIMERO.includes(n))]

const DESTACADOS = {
  'fluent-emoji-flat': porRonda(ORDEN_EMOJI.map((c) => fluent.categories[c] ?? []), 240),
  noto: porRonda(ORDEN_EMOJI.map((c) => noto.categories[c] ?? []), 240),
  'flat-color-icons': flat,
  lucide: porConceptos(lucide),
  tabler: porConceptos(tabler),
  ph: porConceptos(ph),
  'material-symbols': porConceptos(material),
}

const L = []
L.push('// =============================================================================')
L.push('// Los elementos que el panel muestra SIN búsqueda, por pack (los «destacados»)')
L.push('// =============================================================================')
L.push('// ⚠️ ARCHIVO GENERADO: no se edita a mano. Sale de los listados de Iconify del 14/10/2026')
L.push('// (`/collection?prefix=<p>`; Tabler, de `@iconify-json/tabler` en jsDelivr): emoji en ronda por')
L.push('// categoría y sin tonos de piel; íconos por una lista de conceptos comunes (casa, corazón, flecha…).')
L.push('// Se guardan acá porque `/collection` BANEA UNA HORA tras ~6 pedidos seguidos (429 «error code: 1015»,')
L.push('// Retry-After 3595, sin CORS): el navegador no lo puede pedir en vivo. Con búsqueda se usa `/search`.')
L.push('')
L.push('export const DESTACADOS: Readonly<Record<string, readonly string[]>> = {')
for (const [p, nombres] of Object.entries(DESTACADOS)) {
  L.push(`  '${p}': [`)
  let linea = '   '
  for (const n of nombres) {
    const t = ` '${n}',`
    if (linea.length + t.length > 118) {
      L.push(linea)
      linea = '   '
    }
    linea += t
  }
  if (linea.trim()) L.push(linea)
  L.push('  ],')
}
L.push('};')
L.push('')
L.push('/** Marcas registradas que trae Flat Color Icons: no entran ni buscando (relevamiento §2.2). */')
L.push(`export const MARCAS_FUERA: ReadonlySet<string> = new Set([${[...MARCAS].map((m) => `'${m}'`).join(', ')}]);`)
L.push('')
fs.writeFileSync(salida, L.join('\n'), 'utf8')
console.log(Object.entries(DESTACADOS).map(([p, n]) => `${p}: ${n.length}`).join(' · '))
