// Pasa al español lo que el editor MUESTRA de las plantillas de Doory sin tocar el dibujo:
// nombres de página, notas del presentador y nombres de capa. El TEXTO del lienzo queda como está
// porque las miniaturas (public/cv/plantillas/*.webp) lo muestran así y no se pueden re-renderizar sin navegador.
// Uso: node traduce-plantillas.mjs <dir de app/image-editor/mako/plantillas>
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]

const PAGINAS = {
  Sale: 'Oferta', Thumbnail: 'Miniatura', Invitation: 'Invitación', Front: 'Frente', Back: 'Dorso', Flyer: 'Volante',
  Cover: 'Portada', 'Why now': 'Por qué ahora', 'Thank you': 'Gracias', Resume: 'Currículum', Poster: 'Póster',
  Story: 'Historia', Quote: 'Frase',
}

const NOTAS = {
  'Say who you are and why this matters in one sentence.': 'Di quién eres y por qué esto importa, en una oración.',
  'Three facts that make this the right moment. Replace the sample figures with your own and name the source.':
    'Tres datos que hacen de este el momento justo. Cambia las cifras de ejemplo por las tuyas y cita la fuente.',
  'Close with how to reach you.': 'Cierra con cómo contactarte.',
}

const CAPAS = {
  Eyebrow: 'Antetítulo', Channel: 'Canal', 'Masthead rule': 'Línea de cabecera', Headline: 'Título', Sticker: 'Sello',
  'Sticker intro': 'Sello: introducción', 'Sticker value': 'Sello: valor', 'Sticker label': 'Sello: texto', Tagline: 'Bajada',
  Button: 'Botón', 'Button label': 'Texto del botón', 'Button arrow': 'Flecha del botón', Details: 'Detalles',
  'Before stand-in': 'Foto de antes (relleno)', Background: 'Fondo', Head: 'Cabeza', Shoulders: 'Hombros',
  'Before photo': 'Foto de antes', 'After stand-in': 'Foto de después (relleno)', 'After photo': 'Foto de después',
  'Before tag': 'Etiqueta de antes', Before: 'Antes', 'After tag': 'Etiqueta de después', After: 'Después',
  'Arrow disc': 'Círculo de la flecha', Arrow: 'Flecha', Kicker: 'Volanta', Number: 'Número', Unit: 'Unidad',
  'Outer frame': 'Marco exterior', 'Inner frame': 'Marco interior', Arch: 'Arco', Greenery: 'Follaje', Stem: 'Tallo',
  Leaves: 'Hojas', 'Berry left': 'Baya izquierda', 'Berry right': 'Baya derecha', 'Berry centre': 'Baya central',
  Families: 'Familias', 'First name': 'Primer nombre', Ampersand: 'Y', 'Second name': 'Segundo nombre',
  'Invitation line': 'Invitación', 'Date rule': 'Línea de la fecha', Date: 'Fecha', Venue: 'Lugar', Address: 'Dirección',
  'RSVP code': 'Código para confirmar', RSVP: 'Confirmación', Accent: 'Acento', Name: 'Nombre', Role: 'Cargo',
  Initial: 'Inicial', Company: 'Empresa', Website: 'Sitio web', 'QR code': 'Código QR', 'Photo stand-in': 'Foto (relleno)',
  Sky: 'Cielo', Sun: 'Sol', 'Far hills': 'Colinas lejanas', 'Near hills': 'Colinas cercanas', Photo: 'Foto',
  'Offer sticker': 'Sello de la oferta', 'Offer value': 'Valor de la oferta', 'Offer terms': 'Condiciones de la oferta',
  'Headline second line': 'Título (segunda línea)', 'Details rule': 'Línea de detalles', 'Logo mark': 'Logo',
  'Company name': 'Nombre de la empresa', Title: 'Título', Subtitle: 'Subtítulo', Presenter: 'Presentador',
  'Cover photo stand-in': 'Foto de portada (relleno)', 'Cover photo': 'Foto de portada', 'Accent dot': 'Punto de acento',
  'Accent arrow': 'Flecha de acento', Source: 'Fuente', 'Portrait stand-in': 'Retrato (relleno)', Portrait: 'Retrato',
  Ring: 'Anillo', 'Job title': 'Puesto', 'Profile heading': 'Título del perfil', 'Profile rule': 'Línea del perfil',
  'Profile text': 'Texto del perfil', 'Experience heading': 'Título de experiencia', 'Experience rule': 'Línea de experiencia',
  'Education heading': 'Título de educación', 'Education rule': 'Línea de educación', Degree: 'Título obtenido',
  'Study dates': 'Fechas de estudio', School: 'Institución', 'Skills heading': 'Título de habilidades',
  'Skills rule': 'Línea de habilidades', Skills: 'Habilidades', Languages: 'Idiomas', 'Halftone sun': 'Sol de semitonos',
  Festival: 'Festival', Edition: 'Edición', 'Top rule': 'Línea superior', Headliner: 'Artista principal', With: 'Con',
  'Support acts': 'Teloneros', 'Bottom rule': 'Línea inferior', Dates: 'Fechas', Tag: 'Etiqueta', 'Tag label': 'Texto de la etiqueta',
  'Title second line': 'Título (segunda línea)', When: 'Cuándo', Where: 'Dónde', 'Quotation mark': 'Comillas', Quote: 'Frase',
  Rule: 'Línea', Author: 'Autor', Handle: 'Usuario',
}
const NUMERADAS = {
  Card: 'Tarjeta', 'Icon disc': 'Círculo del ícono', Icon: 'Ícono', Value: 'Valor', Label: 'Etiqueta', Text: 'Texto',
  Role: 'Cargo', Dates: 'Fechas', Company: 'Empresa', Bullet: 'Viñeta', Achievement: 'Logro',
}

const sinTraducir = new Set()
function capa(nombre, textos) {
  if (CAPAS[nombre]) return CAPAS[nombre]
  const n = /^(.+?) (\d+(?:\.\d+)?)$/.exec(nombre)
  if (n && NUMERADAS[n[1]]) return `${NUMERADAS[n[1]]} ${n[2]}`
  const icono = /^(.+) icon$/.exec(nombre)
  if (icono) return `Ícono: ${icono[1]}`
  // Las capas que se llaman como su propio texto de ejemplo (un teléfono, una dirección) quedan igual.
  if (textos.has(nombre)) return nombre
  sinTraducir.add(nombre)
  return nombre
}

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const ruta = path.join(dir, f)
  const doc = JSON.parse(fs.readFileSync(ruta, 'utf8'))
  const textos = new Set()
  const juntar = (o) => {
    if (Array.isArray(o)) return o.forEach(juntar)
    if (!o || typeof o !== 'object') return
    if (typeof o.text === 'string') textos.add(o.text)
    for (const v of Object.values(o)) if (typeof v === 'object') juntar(v)
  }
  juntar(doc.pages)
  const traducir = (o) => {
    if (Array.isArray(o)) return o.forEach(traducir)
    if (!o || typeof o !== 'object') return
    if (typeof o.name === 'string' && typeof o.type === 'string') o.name = capa(o.name, textos)
    for (const v of Object.values(o)) if (typeof v === 'object') traducir(v)
  }
  for (const p of doc.pages) {
    if (p.name) {
      if (!PAGINAS[p.name]) sinTraducir.add(`página ${p.name}`)
      p.name = PAGINAS[p.name] ?? p.name
    }
    if (p.notes) {
      if (!NOTAS[p.notes]) sinTraducir.add(`nota ${p.notes}`)
      p.notes = NOTAS[p.notes] ?? p.notes
    }
    traducir(p.objects)
  }
  fs.writeFileSync(ruta, JSON.stringify(doc), 'utf8')
}
if (sinTraducir.size) {
  console.error('SIN TRADUCIR:', [...sinTraducir].join(' | '))
  process.exit(1)
}
console.log('OK')
