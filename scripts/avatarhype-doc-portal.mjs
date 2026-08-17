// Convierte los documentos capturados de Avatar Hype en lo que consume el portal:
// public/cono-doc/<slug>.json, que la ficha de la clase carga al abrirse.
//
// ── Por qué un archivo aparte y no adentro del curso ─────────────────────────
// Son ~515 KB de HTML entre las 27 lecciones. Metidos en `curso-<slug>.ts` viajan en
// el bundle de TODA la grilla, para leer una sola clase. Es exactamente el motivo por
// el que la transcripción vive en `public/cono-tx/<videoId>.json` y no en la ficha.
//
// ── Qué se le hace al HTML, y por qué cada cosa ──────────────────────────────
//   1. Las imágenes pasan de `/api/doc-media/…` (detrás de la sesión del origen) a
//      `/cono-ugc/…` (nuestro). Sin esto el documento se ve roto para todos menos
//      para quien esté logueado allá — o sea, para todos menos el que lo publica.
//   2. Los `<video>` del documento se dejan MARCADOS y sin `src`: sus mp4 no están en
//      el repo (son cientos de megas). Queda el hueco visible con su rótulo, que es
//      honesto; un `<video>` con src roto muestra un cuadro negro y parece un bug.
//   3. Se sacan `<script>`, los `on*=` y los `href="javascript:"`. El HTML es de una
//      fuente confiable, pero se inyecta con `dangerouslySetInnerHTML`: la confianza
//      no es una razón para saltear el saneo, es la razón por la que alcanza con uno
//      simple.
//   4. Los links externos salen con `target="_blank" rel="noopener noreferrer"`.
//
//   node <abs>\scripts\avatarhype-doc-portal.mjs --plan C:\cursos\creativos-ugc-realistas\plan.json
//
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PLAN = arg('plan', '');
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const dirDocs = join(dirname(PLAN), 'docs');
const dirSalida = join(REPO, 'public', 'cono-doc');
const dirImg = join(REPO, 'public', 'cono-ugc');
mkdirSync(dirSalida, { recursive: true });

const imagenesEnDisco = new Set(existsSync(dirImg) ? readdirSync(dirImg) : []);

// Los clips del documento viven en Drive (son 398 MB: al repo no van). El mapa
// archivo → id lo escribe el paso que los sube.
const mapaClips = (() => {
  const f = join(dirname(PLAN), 'doc-clips.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
})();

const sanear = (html) => String(html)
  // 1. Scripts fuera, con su contenido.
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  // 2. Manejadores inline (onclick, onerror…). El `=` puede venir con comillas o sin.
  .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/href\s*=\s*("|')\s*javascript:[^"']*\1/gi, 'href="#"');

// Los <video> del documento pasan a ser el reproductor de Drive, igual que las clases.
// Se hace ANTES de tocar los `src` sueltos: acá se reemplaza el elemento entero, y
// dejar el `<video>` con un iframe adentro no lo dibujaría ningún navegador.
const reescribirClips = (html, sinId) => String(html)
  .replace(/<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/?>/gi, (tag) => {
    const m = /\/api\/doc-media\/[^"'\s>]*?([\w-]+\.(?:mp4|webm))/i.exec(tag);
    if (!m) return tag;
    const nombre = m[1];
    const id = mapaClips[nombre];
    if (!id) { sinId.add(nombre); return `<div class="ugc-clip-falta" data-falta="${nombre}">Clip no disponible</div>`; }
    return `<iframe class="ugc-clip-drive" src="https://drive.google.com/file/d/${id}/preview" `
      + `allow="autoplay" loading="lazy" title="Clip del documento"></iframe>`;
  });

const reescribirMedia = (html, faltantes) => String(html)
  .replace(/(src|srcset)\s*=\s*"([^"]*)"/gi, (todo, attr, val) => {
    if (!val.includes('/api/doc-media/')) return todo;
    const n = basename(val.split('?')[0]);
    if (imagenesEnDisco.has(n)) return `${attr}="/cono-ugc/${n}"`;
    faltantes.add(n);
    // Sin archivo local NO se deja la URL del origen: se saca el src. Un src que solo
    // carga para el que tiene sesión allá es la peor forma de «funciona».
    return `data-falta="${n}"`;
  });

const externos = (html) => String(html)
  .replace(/<a\s+([^>]*href="https?:\/\/[^"]*"[^>]*)>/gi, (todo, attrs) =>
    /target=/i.test(attrs) ? todo : `<a ${attrs} target="_blank" rel="noopener noreferrer">`);

const fichas = readdirSync(dirDocs).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dirDocs, f), 'utf8')));

const faltantes = new Set();
const clipsSinId = new Set();
let totalKb = 0;
const indice = [];
for (const f of fichas) {
  const paneles = {};
  for (const [nombre, p] of Object.entries(f.paneles ?? {})) {
    paneles[nombre] = externos(reescribirMedia(reescribirClips(sanear(p.html), clipsSinId), faltantes));
  }
  const doc = { slug: f.slug, codigo: f.codigo, titulo: f.titulo, tituloDocumento: f.tituloDocumento, paneles };
  const json = JSON.stringify(doc);
  writeFileSync(join(dirSalida, `${f.slug}.json`), json, 'utf8');
  totalKb += json.length / 1024;
  indice.push({ slug: f.slug, tabs: Object.keys(paneles), kb: Math.round(json.length / 1024) });
}

console.log(`\n  documentos: ${indice.length}  ·  ${Math.round(totalKb)} KB en total`);
console.log(`  → ${dirSalida}\n`);
for (const i of indice.sort((a, b) => b.kb - a.kb).slice(0, 5)) {
  console.log(`   ${String(i.kb).padStart(4)} KB  ${i.slug.padEnd(28)} ${i.tabs.join(' + ')}`);
}
console.log(`\n  clips embebidos desde Drive: ${Object.keys(mapaClips).length}`);
if (faltantes.size) {
  console.log(`\n  ⚠ ${faltantes.size} imagen(es) referenciadas y NO presentes en public/cono-ugc/.`);
  console.log(`    Quedan marcadas con data-falta (hueco visible), nunca apuntando al origen:`);
  for (const n of [...faltantes].slice(0, 6)) console.log(`      · ${n}`);
}
if (clipsSinId.size) {
  console.log(`\n  ⚠ ${clipsSinId.size} clip(s) sin id de Drive: quedan como hueco rotulado.`);
  for (const n of [...clipsSinId].slice(0, 6)) console.log(`      · ${n}`);
}
