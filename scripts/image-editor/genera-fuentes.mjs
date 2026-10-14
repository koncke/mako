// Genera app/image-editor/mako/fuentes.ts desde la API de Fontsource (sin key).
// Uso: node genera-fuentes.mjs <ruta de popular_fonts.json de Doory> <salida .ts>
// Verifica con HEAD que CADA archivo latin exista en jsDelivr (patrón npm) y uno latin-ext por familia.
import fs from 'node:fs'

const [popularPath, salida] = process.argv.slice(2)

// La lista curada de docs/editor-imagen/relevamiento-contenido-licencias.md §4.6 (64),
// + Archivo y Pinyon Script (las usan las plantillas de Doory),
// + Space Grotesk, Josefin Sans, Quicksand y Roboto Mono (estaban en la lista de 28: un diseño ya guardado puede usarlas).
const FAMILIAS = [
  // Sans
  'Inter', 'Montserrat', 'Poppins', 'Open Sans', 'Roboto', 'Lato', 'Raleway', 'Nunito', 'DM Sans', 'Manrope',
  'Plus Jakarta Sans', 'Outfit', 'League Spartan', 'Figtree', 'Work Sans', 'Rubik',
  // Serif
  'Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville', 'Cormorant Garamond', 'EB Garamond',
  'DM Serif Display', 'Fraunces', 'Cinzel', 'Bodoni Moda', 'Instrument Serif', 'Roboto Slab',
  // Display / impacto
  'Bebas Neue', 'Anton', 'Oswald', 'Archivo Black', 'Abril Fatface', 'Alfa Slab One', 'Bungee', 'Righteous',
  'Lobster', 'Fredoka', 'Titan One', 'Unbounded',
  // Script
  'Great Vibes', 'Dancing Script', 'Pacifico', 'Sacramento', 'Parisienne', 'Allura', 'Alex Brush', 'Yellowtail',
  // Manuscrita
  'Caveat', 'Kalam', 'Shadows Into Light', 'Permanent Marker', 'Indie Flower', 'Patrick Hand', 'Amatic SC',
  'Architects Daughter',
  // Mono
  'JetBrains Mono', 'Space Mono', 'IBM Plex Mono', 'Courier Prime', 'DM Mono',
  // Retro
  'Press Start 2P', 'Special Elite', 'Monoton',
  // Plantillas de Doory
  'Archivo', 'Pinyon Script',
  // Las que ya estaban
  'Space Grotesk', 'Josefin Sans', 'Quicksand', 'Roboto Mono',
]

// Combinaciones de §4.7 (título + cuerpo): se validan contra los pesos reales.
const COMBINACIONES = [
  ['elegante', 'Elegante', 'Playfair Display', 700, 'Lato', 400],
  ['editorial', 'Editorial', 'DM Serif Display', 400, 'DM Sans', 400],
  ['impacto', 'Impacto', 'Bebas Neue', 400, 'Montserrat', 500],
  ['moderno', 'Moderno', 'Montserrat', 800, 'Inter', 400],
  ['lujo', 'Lujo', 'Cinzel', 600, 'Cormorant Garamond', 400],
  ['boda', 'Boda', 'Great Vibes', 400, 'Cormorant Garamond', 400],
  ['divertido', 'Divertido', 'Fredoka', 700, 'Nunito', 400],
  ['tecnologico', 'Tecnológico', 'Unbounded', 700, 'Manrope', 400],
  ['cartel-retro', 'Cartel retro', 'Alfa Slab One', 400, 'Work Sans', 400],
  ['cercano', 'Cercano', 'Caveat', 700, 'Outfit', 400],
  ['callejero', 'Callejero', 'Permanent Marker', 400, 'Rubik', 400],
  ['corporativo', 'Corporativo', 'Archivo Black', 400, 'Roboto', 400],
  ['clasico', 'Clásico', 'Libre Baskerville', 700, 'Montserrat', 400],
  ['fresco', 'Fresco', 'Fraunces', 600, 'Figtree', 400],
]

const idDe = (family) => family.toLowerCase().replace(/\s+/g, '-')
const url = (id, subset, w, s) => `https://cdn.jsdelivr.net/npm/@fontsource/${id}/files/${id}-${subset}-${w}-${s}.woff2`

async function json(u) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) })
    if (r.ok) return r.json()
    if (r.status === 404) throw new Error(`404 ${u}`)
    await new Promise((res) => setTimeout(res, 800 * (i + 1)))
  }
  throw new Error(`no contesta ${u}`)
}

// ⚠️ La primera vez que jsDelivr sirve un archivo de npm puede tardar >15 s o contestar mal: la corrida
// del 14/10 con 15 s de tope dio 16 «404» falsos (todos 200 al repetirlos). Se reintenta y se anota el motivo.
async function existe(u) {
  let ultimo = ''
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(45000) })
      if (r.status === 200) return true
      ultimo = `HTTP ${r.status}`
    } catch (e) {
      ultimo = e?.name ?? 'error'
    }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)))
  }
  process.stderr.write(`  ✗ ${ultimo} ${u}\n`)
  return false
}

async function enTandas(items, n, fn) {
  const out = []
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))))
  return out
}

const popular = JSON.parse(fs.readFileSync(popularPath, 'utf8'))
const rango = new Map(popular.map((p) => [p.family, p.popularity]))

const filas = []
const fallas = []
const rangos = []
const idxRango = (s) => {
  if (!s) return -1
  let i = rangos.indexOf(s)
  if (i < 0) {
    rangos.push(s)
    i = rangos.length - 1
  }
  return i
}

for (const family of FAMILIAS) {
  const id = idDe(family)
  const meta = await json(`https://api.fontsource.org/v1/fonts/${id}`)
  if (meta.family !== family) fallas.push(`${family}: Fontsource la llama «${meta.family}»`)
  if (!/^(OFL-1\.1|Apache-2\.0|UFL-1\.0)$/.test(meta.license)) fallas.push(`${family}: licencia ${meta.license}`)
  const variantes = []
  for (const w of Object.keys(meta.variants).map(Number).sort((a, b) => a - b)) {
    for (const s of ['normal', 'italic']) {
      if (meta.variants[w]?.[s]?.latin) variantes.push([w, s])
    }
  }
  const ext = meta.subsets.includes('latin-ext') && variantes.every(([w, s]) => meta.variants[w][s]['latin-ext'])
  // Verificación: TODOS los latin, y un latin-ext por familia.
  const pruebas = variantes.map(([w, s]) => url(id, 'latin', w, s))
  if (ext) pruebas.push(url(id, 'latin-ext', variantes[0][0], variantes[0][1]))
  const ok = await enTandas(pruebas, 8, existe)
  const malos = pruebas.filter((_, i) => !ok[i])
  // Un latin que no carga es una falla (la familia no se ve). Un latin-ext que no carga se saca y listo:
  // el español entra entero en latin. El 14/10 jsDelivr dio 503 FIJO al latin-ext de Parisienne, Shadows Into
  // Light, Indie Flower y Patrick Hand por la ruta `npm/` (el archivo está en el paquete; la ruta
  // `fontsource/fonts/…@latest` lo sirve).
  const malosLatin = malos.filter((m) => !m.includes('-latin-ext-'))
  if (malosLatin.length) fallas.push(`${family}: ${malosLatin.length} archivos no cargan → ${malosLatin.slice(0, 3).join(' ')}`)
  if (malos.length > malosLatin.length) process.stderr.write(`  ${family}: sin latin-ext (no carga por jsDelivr npm)\n`)
  const buenas = variantes.filter(([w, s]) => !malos.includes(url(id, 'latin', w, s)))
  filas.push({
    family,
    id,
    category: meta.category,
    variantes: buenas.map(([w, s]) => `${w}${s === 'italic' ? 'i' : ''}`).join(' '),
    ext: ext && !malos.some((m) => m.includes('-latin-ext-')),
    rLatin: idxRango(meta.unicodeRange?.latin),
    rExt: ext ? idxRango(meta.unicodeRange?.['latin-ext']) : -1,
    pop: rango.get(family) ?? 9999,
    license: meta.license,
  })
  process.stderr.write(`${family}: ${buenas.length} variantes${ext ? ' +ext' : ''}\n`)
}

// Combinaciones: el peso tiene que existir en la familia.
for (const [, nombre, t, tw, c, cw] of COMBINACIONES) {
  for (const [fam, w] of [[t, tw], [c, cw]]) {
    const f = filas.find((x) => x.family === fam)
    if (!f) fallas.push(`combinación ${nombre}: falta ${fam}`)
    else if (!f.variantes.split(' ').includes(String(w))) fallas.push(`combinación ${nombre}: ${fam} no tiene ${w}`)
  }
}

if (fallas.length) {
  console.error('FALLAS:\n' + fallas.join('\n'))
  process.exit(1)
}

// Orden = popularidad (la de Doory, backend/data/popular_fonts.json); las sin rango, en el orden curado.
const ordenadas = filas.map((f, i) => ({ ...f, i })).sort((a, b) => a.pop - b.pop || a.i - b.i)
const CATS = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace']
for (const f of ordenadas) if (!CATS.includes(f.category)) throw new Error(`categoría ${f.category}`)

const q = (s) => JSON.stringify(s).replace(/'/g, "\\'").replace(/^"|"$/g, "'")
const licencias = [...new Set(filas.map((f) => f.license))].join(', ')
const L = []
L.push('// =============================================================================')
L.push('// Las fuentes del editor (Google Fonts por la copia de jsDelivr de `@fontsource/*`)')
L.push('// =============================================================================')
L.push('// ⚠️ ARCHIVO GENERADO: no se edita a mano. Lo arma un script que lee la API de')
L.push('// Fontsource sin key (`https://api.fontsource.org/v1/fonts/<id>`) y verifica con')
L.push('// HEAD que CADA archivo latin exista en jsDelivr (14/10/2026). Un peso que no existe')
L.push('// da 404 y el texto cae a la fuente del sistema EN SILENCIO: por eso no se escribe a mano.')
L.push('// ⚠️ Un archivo «frío» de jsDelivr tardó 12,6 s en contestar (medido) y el motor corta a los 8 s')
L.push('// (`LOAD_TIMEOUT_MS` de engine/fonts.ts): la primera vez puede caer a la del sistema. Alojarlas es lo')
L.push('// que recomienda el relevamiento (§4.3).')
L.push('//')
L.push('// La lista es la curada de docs/editor-imagen/relevamiento-contenido-licencias.md §4.6')
L.push('// (64 familias), + Archivo y Pinyon Script (las usan las plantillas de Doory), + Space')
L.push('// Grotesk, Josefin Sans, Quicksand y Roboto Mono (estaban antes: un diseño guardado puede usarlas).')
L.push(`// Licencias (de Fontsource): ${licencias}. Orden = popularidad (la de Doory).`)
L.push('//')
L.push('// Formato compacto para no inflar el bundle: [familia, id, categoría, variantes, latin-ext,')
L.push('// rango latin, rango latin-ext]. Sólo se sirven latin y latin-ext (el español entra en latin). «400i» = 400 itálica. Los rangos son índices en RANGOS.')
L.push('')
L.push("import type { FontCategory, FontFamily } from '../_doory/types/api';")
L.push('')
L.push("const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';")
L.push('')
L.push('type Fila = [family: string, id: string, category: FontCategory, variantes: string, ext: 0 | 1, rLatin: number, rExt: number];')
L.push('')
L.push('/** Los `unicode-range` de Fontsource, sin repetir. */')
L.push('const RANGOS: string[] = [')
for (const r of rangos) L.push(`  ${q(r)},`)
L.push('];')
L.push('')
L.push('const FILAS: Fila[] = [')
for (const f of ordenadas) L.push(`  [${q(f.family)}, ${q(f.id)}, ${q(f.category)}, ${q(f.variantes)}, ${f.ext ? 1 : 0}, ${f.rLatin}, ${f.rExt}],`)
L.push('];')
L.push('')
L.push('const archivo = (id: string, subset: string, peso: number, estilo: string): string => `${CDN}/${id}/files/${id}-${subset}-${peso}-${estilo}.woff2`;')
L.push('')
L.push('/** El catálogo, armado una vez (`popularity` 1 = la más usada). */')
L.push('export const FUENTES: FontFamily[] = FILAS.map(([family, id, category, variantes, ext, rLatin, rExt], i) => {')
L.push('  const unicode_ranges: Record<string, string> = {};')
L.push("  if (rLatin >= 0) unicode_ranges.latin = RANGOS[rLatin];")
L.push("  if (rExt >= 0) unicode_ranges['latin-ext'] = RANGOS[rExt];")
L.push('  return {')
L.push('    id: `fs-${id}`,')
L.push('    family,')
L.push('    category,')
L.push("    scripts: ext ? ['latin', 'latin-ext'] : ['latin'],")
L.push('    is_variable: false,')
L.push('    is_user_font: false,')
L.push("    variants: variantes.split(' ').map((v) => {")
L.push('      const peso = Number.parseInt(v, 10);')
L.push("      const estilo = v.endsWith('i') ? ('italic' as const) : ('normal' as const);")
L.push("      return { weight: peso, style: estilo, url: archivo(id, 'latin', peso, estilo), ...(ext ? { subsets: [{ subset: 'latin-ext', url: archivo(id, 'latin-ext', peso, estilo) }] } : {}) };")
L.push('    }),')
L.push('    popularity: i + 1,')
L.push('    unicode_ranges,')
L.push('  };')
L.push('});')
L.push('')
L.push('/** Una combinación de fuentes (título + cuerpo) de §4.7; todas las familias y pesos están en FUENTES. */')
L.push('export interface CombinacionFuentes {')
L.push('  id: string;')
L.push('  nombre: string;')
L.push('  titulo: { family: string; category: FontCategory; weight: number };')
L.push('  cuerpo: { family: string; category: FontCategory; weight: number };')
L.push('}')
L.push('')
L.push('export const COMBINACIONES_FUENTES: readonly CombinacionFuentes[] = [')
for (const [id, nombre, t, tw, c, cw] of COMBINACIONES) {
  const ct = filas.find((x) => x.family === t).category
  const cc = filas.find((x) => x.family === c).category
  L.push(`  { id: ${q(id)}, nombre: ${q(nombre)}, titulo: { family: ${q(t)}, category: ${q(ct)}, weight: ${tw} }, cuerpo: { family: ${q(c)}, category: ${q(cc)}, weight: ${cw} } },`)
}
L.push('];')
L.push('')

fs.writeFileSync(salida, L.join('\n'), 'utf8')
console.log(`OK: ${filas.length} familias, ${filas.reduce((a, f) => a + f.variantes.split(' ').length, 0)} variantes, ${rangos.length} rangos → ${salida}`)
