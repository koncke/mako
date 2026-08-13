// Portada GENERADA con la marca de la casa, para el curso que no tiene una propia.
//
// Por qué existe: hay cursos cuya tapa no está en ningún lado —ni en el catálogo de la
// plataforma ni en la carpeta de Drive—. La alternativa que se pidió era «buscala en
// Google», y eso no se hace: una imagen cualquiera de un buscador no se puede verificar
// como la tapa REAL del curso, y poner la foto de un tercero como si lo fuera está mal
// además de ser un problema de derechos. Una portada tipográfica con el título dice la
// verdad y se ve como el resto del portal.
//
// Sale SVG a propósito: no hace falta ninguna librería de imagen, pesa 2 KB, y escala
// sin verse borrosa en cualquier tarjeta.
//
//   node <abs>\scripts\curso-portada-generada.mjs --slug masteryhaus --titulo "MasteryHaus" --autor "Sofia Contreras"
//   node <abs>\scripts\curso-portada-generada.mjs --slug avatarhype --titulo "Curso AVATARHYPE" --tono mako

import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const SLUG = arg('slug', '');
const TITULO = arg('titulo', '');
const AUTOR = arg('autor', '');
const TONO = arg('tono', 'lima'); // lima | mako
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');

if (!SLUG || !TITULO) {
  console.error('\n  ✖ Faltan --slug <slug> y --titulo "<título>"\n');
  process.exit(1);
}

// Los colores salen de los tokens del portal (app/conocimientos: --lime, --ink, --card),
// no de valores inventados: la portada tiene que verse parte de la pantalla, no pegada.
const PALETA = {
  lima: { fondo: '#F4F3EE', tinta: '#14161B', acento: '#C8F031' },
  mako: { fondo: '#14161B', tinta: '#F4F3EE', acento: '#F2B01E' },
};
const c = PALETA[TONO] ?? PALETA.lima;

// El título se parte a mano: SVG no hace wrap. Se cortan líneas por ancho de caracteres
// aproximado, respetando palabras — partir a la mitad de una palabra se ve como un bug.
const partir = (texto, max = 22) => {
  const palabras = String(texto).trim().split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if (!actual) { actual = p; continue; }
    if ((actual + ' ' + p).length <= max) actual += ' ' + p;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, 4); // más de 4 líneas no entra: el resto se corta con …
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lineas = partir(TITULO);
const tamano = lineas.length <= 2 ? 78 : lineas.length === 3 ? 62 : 52;
const alto = 630, ancho = 1120;
const bloque = lineas.length * (tamano * 1.12);
const y0 = (alto - bloque) / 2 + tamano * 0.85 - (AUTOR ? 22 : 0);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${esc(TITULO)}">
  <defs>
    <pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M28 0H0V28" fill="none" stroke="${c.tinta}" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${ancho}" height="${alto}" fill="${c.fondo}"/>
  <rect width="${ancho}" height="${alto}" fill="url(#g)"/>
  <rect x="0" y="0" width="14" height="${alto}" fill="${c.acento}"/>
${lineas.map((l, i) => `  <text x="72" y="${(y0 + i * tamano * 1.12).toFixed(0)}" font-family="Georgia,'Times New Roman',serif" font-size="${tamano}" font-weight="700" fill="${c.tinta}" letter-spacing="-1.5">${esc(l)}</text>`).join('\n')}
${AUTOR ? `  <text x="74" y="${(y0 + lineas.length * tamano * 1.12 + 26).toFixed(0)}" font-family="ui-monospace,'SFMono-Regular',Menlo,monospace" font-size="23" fill="${c.tinta}" fill-opacity=".55" letter-spacing="1.5">${esc(AUTOR.toUpperCase())}</text>` : ''}
</svg>
`;

const dir = join(REPO, 'public', 'cono-portadas');
mkdirSync(dir, { recursive: true });
// Una sola portada por curso: si había otra con otra extensión, se reemplaza.
for (const f of readdirSync(dir)) {
  if (f.replace(/\.[^.]+$/, '') === SLUG && f !== `${SLUG}.svg`) unlinkSync(join(dir, f));
}
const salida = join(dir, `${SLUG}.svg`);
writeFileSync(salida, svg, 'utf8');

console.log(`\n  ✓ ${TITULO}${AUTOR ? ` — ${AUTOR}` : ''}  (${lineas.length} línea/s, tono ${TONO})`);
console.log(`  → ${salida}\n`);
