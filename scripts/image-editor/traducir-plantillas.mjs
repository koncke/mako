// =============================================================================
// Las 10 plantillas de Doory con el texto DEL LIENZO en español neutro (tú)
// =============================================================================
// Los títulos, categorías y etiquetas ya estaban en español (app/image-editor/mako/plantillas.ts);
// el texto adentro del diseño seguía en inglés («Good design does not shout…»). Este script lo
// reemplaza texto por texto, por igualdad EXACTA con el original: si Doory cambia una plantilla y
// un texto no aparece, avisa y no inventa. Los nombres de marca, de bandas y los datos de ejemplo
// (teléfonos, URLs de ejemplo) quedan.
//
// Un texto en mayúsculas (`textCase: 'upper'`) guarda el original en `caseSource`: se traduce ese y
// el texto visible es su versión en mayúsculas, como lo haría el motor al tocar el botón «Aa».
//
// Después de correrlo hay que volver a dibujar las miniaturas (public/cv/plantillas/*.webp): ver
// docs/hallazgos-editor-imagen.md, «Verificar el editor sin el dev server».
//
// Uso: node scripts/image-editor/traducir-plantillas.mjs   (idempotente: lo ya traducido no se toca)

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', '..', 'app', 'image-editor', 'mako', 'plantillas');

/** original (exacto, en su forma normal: el `caseSource` si está en mayúsculas) → español. */
const T = {
  'bold-sale-announcement.json': {
    'End of season': 'Fin de temporada',
    'Online & in store': 'En línea y en tienda',
    'SALE': 'OFERTA',
    'Up to': 'Hasta',
    'Off everything': 'De descuento en todo',
    'Fresh finds for every wardrobe, marked down for one weekend only.': 'Novedades para todo tu clóset, con descuento solo este fin de semana.',
    'Shop the sale': 'Compra ahora',
    'Sat 14 – Sun 15 June  ·  yourstore.com': 'Sáb 14 – Dom 15 de junio  ·  tutienda.com',
  },
  'bold-youtube-thumbnail.json': {
    'Before': 'Antes',
    'After': 'Después',
    'I tried it for': 'Lo probé por',
    'Days': 'Días',
  },
  'botanical-celebration-invitation.json': {
    'Together with their families': 'Junto a sus familias',
    'Ava': 'Sofía',
    'Noah': 'Mateo',
    'request the pleasure of your company as they celebrate their wedding': 'tienen el gusto de invitarte a celebrar su boda',
    'Saturday · 14 June 2027 · half past four': 'Sábado · 14 de junio de 2027 · 4:30 p. m.',
    'The Orchard House': 'La Casa del Huerto',
    '12 Orchard Lane, Willowbrook': 'Calle del Huerto 12, Valle Verde',
    'Kindly reply by 1 May': 'Confirma tu asistencia antes del 1 de mayo',
  },
  'clean-business-card.json': {
    'Jordan Ellis': 'Valentina Rojas',
    'Product designer': 'Diseñadora de producto',
    'jordan@yourcompany.example': 'valentina@tuempresa.example',
    'yourcompany.example': 'tuempresa.example',
    'J': 'V',
    'Your Company': 'Tu empresa',
  },
  'grand-opening-flyer.json': {
    'Corner Bloom Café': 'Café La Esquina',
    'Free': 'Gratis',
    'coffee for our first 100 guests': 'café para los primeros 100 invitados',
    'Grand': 'Gran',
    'Opening': 'Apertura',
    'Fresh coffee, warm pastries and a seat by the window. Come and say hello.': 'Café recién hecho, pan dulce calentito y un lugar junto a la ventana. Ven a saludarnos.',
    'Saturday 12 July': 'Sábado 12 de julio',
    '8 AM – 6 PM': '8:00 – 18:00',
    '24 Orchard Lane': 'Calle del Huerto 24',
    'cornerbloom.example  ·  @cornerbloomcafe': 'cafelaesquina.example  ·  @cafelaesquina',
  },
  'modern-pitch-deck.json': {
    'Seed round  ·  2027': 'Ronda semilla  ·  2027',
    'Ideas that move people forward.': 'Ideas que mueven a las personas.',
    'Fieldnote turns scattered team knowledge into one place everyone can find and trust.': 'Fieldnote reúne en un solo lugar lo que sabe tu equipo: fácil de encontrar y confiable.',
    'Jordan Ellis, founder and CEO': 'Valentina Rojas, fundadora y CEO',
    'Why now': 'Por qué ahora',
    'Three shifts make this the moment': 'Tres cambios hacen que este sea el momento',
    'Work is scattered across too many tools': 'El trabajo está repartido en demasiadas herramientas',
    'Teams lose hours every week looking for the latest version of anything.': 'Los equipos pierden horas cada semana buscando la última versión de todo.',
    'People expect software to feel simple': 'La gente espera que el software sea simple',
    'They compare every product with the easiest one they use.': 'Comparan cada producto con el más fácil que usan.',
    'Getting started takes minutes': 'Empezar toma minutos',
    'What once took a consultant can now run before the first meeting ends.': 'Lo que antes pedía un consultor ahora está listo antes de que termine la primera reunión.',
    'Sample figures: replace them with your own and name the source.': 'Cifras de ejemplo: reemplázalas por las tuyas y cita la fuente.',
    'Thank you': 'Gracias',
    'Let’s build what comes next, together.': 'Construyamos juntos lo que sigue.',
    'hello@fieldnote.example': 'hola@fieldnote.example',
  },
  'modern-resume.json': {
    'Jordan Ellis': 'Valentina Rojas',
    'Product designer': 'Diseñadora de producto',
    'jordan@yourmail.example': 'valentina@tucorreo.example',
    'yourportfolio.example': 'tuportafolio.example',
    'Lakeside': 'Ciudad del Lago',
    'Profile': 'Perfil',
    'Designer with seven years of experience turning complex problems into simple, accessible products. I work closely with research and engineering, and I care about clear writing and consistent systems.': 'Diseñadora con siete años de experiencia convirtiendo problemas complejos en productos simples y accesibles. Trabajo de cerca con investigación e ingeniería, y me importan la escritura clara y los sistemas consistentes.',
    'Experience': 'Experiencia',
    'Senior Product Designer': 'Diseñadora de producto sénior',
    '2022 – Present': '2022 – Actualidad',
    'Led the redesign of the core product used by 40,000 customers and lifted task completion by 18%.': 'Lideré el rediseño del producto principal que usan 40 000 clientes y subí 18 % las tareas completadas.',
    'Built a shared design system now used by five product teams.': 'Armé un sistema de diseño compartido que hoy usan cinco equipos de producto.',
    'Mentored three designers and ran the weekly design critique.': 'Fui mentora de tres diseñadores y coordiné la revisión semanal de diseño.',
    'Product Designer': 'Diseñadora de producto',
    'Shipped a mobile onboarding flow that cut drop-off by a third.': 'Lancé un flujo de bienvenida móvil que redujo el abandono en un tercio.',
    'Worked with engineers to release 30+ accessible components.': 'Publiqué con ingeniería más de 30 componentes accesibles.',
    'Junior Designer': 'Diseñadora júnior',
    'Designed websites and brand identities for more than 20 small businesses.': 'Diseñé sitios web e identidades de marca para más de 20 pequeños negocios.',
    'Education': 'Formación',
    'BA Interaction Design': 'Licenciatura en Diseño de Interacción',
    'Lakeshore University': 'Universidad del Lago',
    'Skills': 'Habilidades',
    'Product strategy  ·  User research  ·  Prototyping  ·  Design systems  ·  Facilitation  ·  HTML and CSS  ·  Figma': 'Estrategia de producto  ·  Investigación con usuarios  ·  Prototipos  ·  Sistemas de diseño  ·  Facilitación  ·  HTML y CSS  ·  Figma',
    'English (native)  ·  Spanish (fluent)  ·  French (conversational)': 'Español (nativo)  ·  Inglés (fluido)  ·  Francés (conversacional)',
  },
  'night-bloom-concert-poster.json': {
    'with': 'con',
    'Riverside Park\nGates 4 PM\nTickets from $45': 'Parque Ribera\nPuertas 16:00\nEntradas desde $45',
  },
  'rooftop-event-story.json': {
    'Live on the rooftop': 'En vivo en la terraza',
    'Sunset': 'Sesiones',
    'Sessions': 'al ocaso',
    'Fri 21 June  ·  6 PM till late  ·  Free entry': 'Vie 21 de junio  ·  Desde las 18:00  ·  Entrada libre',
    'The Garden Terrace, 12 Orchard Lane': 'La Terraza del Jardín, Calle del Huerto 12',
    'RSVP today': 'Confirma hoy',
  },
  // (Abajo, en AJUSTES: «al atardecer» desbordaba; quedó «al ocaso».)
  'serif-quote-card.json': {
    'Good design does not shout. It quietly makes the next step feel obvious.': 'El buen diseño no grita. En silencio, hace que el siguiente paso parezca obvio.',
    'Maya Okafor': 'Lucía Fernández',
    'Creative director, Okafor Studio': 'Directora creativa, Estudio Fernández',
    '@okafor.studio': '@estudio.fernandez',
  },
};

/**
 * Lo que el español no deja igual: un texto más largo que el original desborda su caja. Se mide con la
 * fuente real (canvas `measureText` con la fuente de jsDelivr, como el editor) y se ajusta acá, sobre el
 * texto YA traducido. Medido el 14/10/2026: «OFERTA» en Anton a 500 px = 1321 px contra 990 de caja; a
 * 360 px = 951 (el aire que tenía «SALE», 878 de 990) y se centra en la franja que ocupaba (top 132,
 * alto 565). «al atardecer» en Playfair itálica a 190 px = 969 contra 920: pasó a «al ocaso» (639).
 */
const AJUSTES = {
  'bold-sale-announcement.json': { OFERTA: { fontSize: 360, top: 211 } },
};

const mayus = (s) => s.toLocaleUpperCase('es');
let cambios = 0;
const faltan = [];
for (const [archivo, mapa] of Object.entries(T)) {
  const ruta = join(DIR, archivo);
  const doc = JSON.parse(readFileSync(ruta, 'utf8'));
  const usados = new Set();
  const visitar = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(visitar); return; }
    if (typeof o.text === 'string') {
      const arriba = o.textCase === 'upper' && typeof o.caseSource === 'string';
      const fuente = arriba ? o.caseSource : o.text;
      const es = mapa[fuente];
      if (es !== undefined) {
        usados.add(fuente);
        if (arriba) { o.caseSource = es; o.text = mayus(es); } else { o.text = es; if (typeof o.caseSource === 'string') o.caseSource = es; }
        cambios++;
      }
      const ajuste = AJUSTES[archivo]?.[o.text];
      if (ajuste) Object.assign(o, ajuste);
    }
    for (const v of Object.values(o)) visitar(v);
  };
  visitar(doc);
  for (const k of Object.keys(mapa)) if (!usados.has(k)) faltan.push(`${archivo}: «${k}»`);
  // En una línea, como vienen (un JSON con sangría multiplica el diff por mil).
  writeFileSync(ruta, `${JSON.stringify(doc)}\n`);
}
console.log(`${cambios} texto(s) traducidos.`);
if (faltan.length) console.log(`No aparecieron (¿ya traducidos o cambió la plantilla?):\n  ${faltan.join('\n  ')}`);
