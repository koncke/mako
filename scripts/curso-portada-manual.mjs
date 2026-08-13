// Instala portadas que el dueño deja a mano en una carpeta.
//
// Por qué existe: una imagen pegada en el chat no llega al disco, así que no se puede
// guardar sin re-inventarla — y una imagen re-dibujada no es la que él eligió. Esto
// cierra el hueco: él suelta los archivos en C:\cursos\portadas y esto los instala.
//
// Acepta el nombre que sea:
//   · si el archivo se llama como el slug del portal, va directo
//   · si no, se matchea por nombre contra la tabla de alias de abajo
//
// Valida por BYTES: un .png que en realidad es HTML no se instala. Y reemplaza la
// portada anterior del curso aunque tenga otra extensión —incluida la .svg generada—
// para que no queden dos y gane la que no corresponde.
//
//   node <abs>\scripts\curso-portada-manual.mjs                 # simula
//   node <abs>\scripts\curso-portada-manual.mjs --aplicar

import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const APLICAR = process.argv.includes('--aplicar');
const DESDE = arg('desde', 'C:\\cursos\\portadas');
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const MOVER = process.argv.includes('--mover'); // saca el original de la bandeja

// Alias → slug del portal. Para no tener que renombrar los archivos a mano.
const ALIAS = {
  bluehacker: 'bluehacker', 'blue hacker': 'bluehacker', bh: 'bluehacker',
  masteryhaus: 'masteryhaus', 'mastery haus': 'masteryhaus',
  avatarhype: 'avatarhype', 'avatar hype': 'avatarhype',
  'anuncio ganador': 'anuncio-ganador', 'anuncio-ganador': 'anuncio-ganador',
  'reto del anuncio ganador': 'anuncio-ganador', reto: 'anuncio-ganador',
  claude: 'claude-ai-rodrigo-rojo', 'claude-ai-rodrigo-rojo': 'claude-ai-rodrigo-rojo',
  atv: 'aumenta-tu-valor-y-atv-advantage', 'aumenta tu valor': 'aumenta-tu-valor-y-atv-advantage',
  'sell your knowledge': 'sell-your-knowledge', 'sell-your-knowledge': 'sell-your-knowledge',
};

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

const extDeBytes = (b) => b.subarray(0, 3).toString('hex') === 'ffd8ff' ? 'jpg'
  : b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'png'
  : b.subarray(8, 12).toString('latin1') === 'WEBP' ? 'webp'
  : b.subarray(0, 4).toString('latin1') === 'GIF8' ? 'gif'
  : b.subarray(0, 200).toString('latin1').includes('<svg') ? 'svg'
  : null;

if (!existsSync(DESDE)) {
  mkdirSync(DESDE, { recursive: true });
  console.log(`\n  Creé la bandeja: ${DESDE}`);
  console.log(`  Dejá ahí las imágenes y volvé a correr esto.`);
  console.log(`  El nombre puede ser el del curso ("MasteryHaus.png") o su slug.\n`);
  process.exit(0);
}

const destino = join(REPO, 'public', 'cono-portadas');
mkdirSync(destino, { recursive: true });

const archivos = readdirSync(DESDE, { withFileTypes: true }).filter((e) => e.isFile());
if (!archivos.length) {
  console.log(`\n  La bandeja está vacía: ${DESDE}\n  Dejá ahí las imágenes y volvé a correr esto.\n`);
  process.exit(0);
}

console.log(`\n  Bandeja : ${DESDE}  (${archivos.length} archivo/s)`);
console.log(`  Modo    : ${APLICAR ? 'APLICAR' : 'simulación'}\n`);

let ok = 0;
const sinDueno = [];

for (const e of archivos) {
  const ruta = join(DESDE, e.name);
  const buf = readFileSync(ruta);
  const ext = extDeBytes(buf);
  if (!ext) { console.log(`  ✖ ${e.name} — no es una imagen (los bytes no lo son)`); continue; }

  const n = norm(e.name);
  // Slug exacto primero; después alias por nombre, del más largo al más corto para
  // que "anuncio ganador" gane sobre "anuncio" si algún día hay dos.
  let slug = Object.values(ALIAS).includes(n) ? n : null;
  if (!slug) {
    const clave = Object.keys(ALIAS).sort((a, b) => b.length - a.length).find((k) => n.includes(k));
    slug = clave ? ALIAS[clave] : null;
  }
  if (!slug) { sinDueno.push(e.name); console.log(`  ⚠ ${e.name} — no sé de qué curso es`); continue; }

  const salida = join(destino, `${slug}.${ext}`);
  console.log(`  ${APLICAR ? '✓' : '·'} ${e.name}  →  ${slug}.${ext}  (${(buf.length / 1024).toFixed(0)} KB)`);
  if (!APLICAR) { ok++; continue; }

  // Se borra CUALQUIER portada previa de ese curso, incluida la .svg generada: si
  // quedan dos, la que gana depende del orden de lectura del directorio.
  for (const f of readdirSync(destino)) {
    if (f.replace(/\.[^.]+$/, '') === slug && f !== `${slug}.${ext}`) {
      unlinkSync(join(destino, f));
      console.log(`      (reemplaza ${f})`);
    }
  }
  writeFileSync(salida, buf);
  if (MOVER) { try { renameSync(ruta, join(DESDE, `_instalada_${e.name}`)); } catch {} }
  ok++;
}

console.log(`\n  ${ok} portada(s) ${APLICAR ? 'instalada(s)' : 'listas para instalar'}`);
if (sinDueno.length) {
  console.log(`\n  Sin identificar (renombralas al slug del curso):`);
  for (const x of sinDueno) console.log(`    ${x}`);
  console.log(`  Slugs válidos: ${[...new Set(Object.values(ALIAS))].join(', ')}`);
}
if (!APLICAR) console.log(`\n  Para hacerlo de verdad: agregá --aplicar\n`);
else {
  console.log(`\n  Las de cursos del pipeline necesitan un paso más para declararse:`);
  console.log(`    node scripts/curso-a-portal.mjs --plan <plan.json> --categoria "<cat>"`);
  console.log(`  Las de cursos viejos ya salen por el mapa PORTADA de catalogo.ts.\n`);
}
