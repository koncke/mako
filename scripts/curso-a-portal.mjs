// Cablea un curso bajado al portal /conocimientos. Cierra el circuito:
//   plan.json (títulos, módulos, duración)
// + drive.json (el videoId real de cada clase)
// + texto/<clase>.md (tu bloque «Apuntes» + la transcripción)
//   → public/cono-tx/<videoId>.json  (lo que baja TranscriptLazy)
//   → app/conocimientos/curso-<slug>.ts  (el Curso que consume el portal)
//
// Dos decisiones que importan:
//   · El archivo del curso va APARTE, nunca dentro de app/conocimientos/curso.ts:
//     ese es AUTO-GENERADO y todo lo escrito a mano ahí se pierde al regenerar.
//     Es el mismo motivo por el que existen curso-vsl.ts y curso-producto-app.ts.
//   · El `resumen` de cada clase sale de TU bloque «## Apuntes» del .md, no de la
//     transcripción. Si está vacío, el campo va vacío y el portal no dibuja el
//     bloque. Escribís apuntes, volvés a correr esto, y aparecen. La transcripción
//     cruda queda detrás del <details>, que es donde corresponde.
//
// Reanudable y parcial: solo marca hasTx en las clases que YA tienen su .md, así
// se puede correr con la transcripción a medias y volver a correr después.
//
//   node <abs>\scripts\curso-a-portal.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-a-portal.mjs --plan … --categoria "IA aplicada"

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PLAN = arg('plan', '');
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const CATEGORIA = arg('categoria', '');
const EYEBROW = arg('eyebrow', 'Curso externo');

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
// Ver la nota del BOM en curso-bajar.mjs: PowerShell 5.1 lo mete y JSON.parse muere.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));

const driveJson = join(base, 'drive.json');
if (!existsSync(driveJson)) {
  console.error('\n  ✖ Falta drive.json. Corré antes curso-a-drive.mjs: sin el videoId real');
  console.error('    de Drive el portal pinta un iframe muerto.\n');
  process.exit(1);
}
const drive = JSON.parse(readFileSync(driveJson, 'utf8').replace(/^﻿/, ''));
const idPorN = new Map(drive.clases.map((c) => [c.n, c.videoId]));

const dirTexto = join(base, 'texto');
const dirTx = join(REPO, 'public', 'cono-tx');
mkdirSync(dirTx, { recursive: true });

// ── Partir la transcripción en párrafos legibles ─────────────────────────────
// Whisper devuelve un bloque corrido. Sin cortar, el <details> es un muro.
// Se agrupa por oraciones (no por largo fijo, que parte al medio de una idea).
const enParrafos = (texto, porParrafo = 4) => {
  const oraciones = texto
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+(?=[¿¡"“'(A-ZÁÉÍÓÚÑ0-9])/g)
    .filter((s) => s.trim());
  const out = [];
  for (let i = 0; i < oraciones.length; i += porParrafo) {
    out.push(oraciones.slice(i, i + porParrafo).join(' ').trim());
  }
  return out.filter(Boolean);
};

// El .md que escribe curso-transcribir.ts: cabecera, «## Apuntes», «## Transcripción».
const leerMd = (ruta) => {
  const txt = readFileSync(ruta, 'utf8');
  const iA = txt.indexOf('## Apuntes');
  const iT = txt.indexOf('## Transcripción');
  const apuntes = iA > -1 && iT > iA ? txt.slice(iA + '## Apuntes'.length, iT).trim() : '';
  const cuerpo = iT > -1 ? txt.slice(iT + '## Transcripción'.length) : txt;
  // Las partes de un audio troceado están separadas por --- ; se concatenan.
  const transcripcion = cuerpo.split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean).join(' ');
  return { apuntes, transcripcion };
};

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const slugDe = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

// ── Recorrer las clases ──────────────────────────────────────────────────────
// texto/ puede estar plano u organizado en «<NN Módulo>/» (ver curso-organizar.mjs),
// así que se camina un nivel de subcarpetas.
const mdPorN = new Map();
const listarUnNivel = (dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory()
    ? readdirSync(join(dir, e.name)).map((f) => join(e.name, f))
    : [e.name]);
for (const rel of listarUnNivel(dirTexto)) {
  const f = basename(rel);
  if (!f.endsWith('.md') || f === '_indice.md') continue;
  const m = /^(\d{1,3})\s*-\s*/.exec(f);
  if (m) mdPorN.set(Number(m[1]), join(dirTexto, rel));
}

const modulos = [...new Set(plan.clases.map((c) => c.modulo).filter(Boolean))];
const clases = [];
let conTx = 0, sinTx = 0, conApuntes = 0;

for (const c of plan.clases) {
  const videoId = idPorN.get(c.n) ?? null;
  const md = mdPorN.get(c.n);
  let hasTx = false;
  let apuntes = '';

  if (md && videoId) {
    const { apuntes: a, transcripcion } = leerMd(md);
    apuntes = a;
    const paras = enParrafos(transcripcion);
    if (paras.length) {
      writeFileSync(join(dirTx, `${videoId}.json`), JSON.stringify(paras), 'utf8');
      hasTx = true;
      conTx++;
    }
    if (a) conApuntes++;
  } else {
    sinTx++;
  }

  // vn = número dentro del módulo, para el badge del hub.
  const delModulo = plan.clases.filter((x) => x.modulo === c.modulo);
  const vn = delModulo.findIndex((x) => x.n === c.n) + 1;

  clases.push({
    n: c.n,
    vn: vn || undefined,
    grupo: c.modulo ? c.modulo.replace(/^\d+\.\s*/, '') : undefined,
    modulo: c.modulo ? modulos.indexOf(c.modulo) + 1 : undefined,
    titulo: c.titulo,
    // Dato factual, no una descripción inventada: duración y módulo.
    cardDesc: `${c.duracion}${c.modulo ? ` · ${c.modulo.replace(/^\d+\.\s*/, '')}` : ''}`,
    videoId,
    resumen: apuntes,
    hasTx,
  });
}

// ── Emitir el módulo del curso ───────────────────────────────────────────────
// El slug del plan suele venir con «curso-de-» adelante; sin quitarlo el archivo
// queda 'curso-curso-de-…' y la constante CURSO_CURSO_DE_…
const slug = (plan.slug ?? slugDe(plan.curso)).replace(/^curso-(de-)?/, '');
const constante = `CURSO_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
const salida = join(REPO, 'app', 'conocimientos', `curso-${slug}.ts`);

const cuerpo = `// =============================================================================
// ${plan.curso} — portal /conocimientos
// =============================================================================
// GENERADO por scripts/curso-a-portal.mjs desde C:\\cursos\\${slug}\\.
// Regenerable: volver a correr el script sobreescribe este archivo.
//
// Va en archivo propio (y NO dentro de curso.ts) porque aquél es auto-generado
// desde las transcripciones de AVATARHYPE: lo que se escriba ahí se pierde.
//
// El \`resumen\` de cada clase son TUS apuntes, tomados del bloque «## Apuntes» de
// C:\\cursos\\${slug}\\texto\\<clase>.md. Escribí ahí y volvé a correr el script.
// La transcripción cruda no viaja en el bundle: vive en public/cono-tx/<videoId>.json.

import type { Curso } from './curso';

export const ${constante}: Curso = {
  slug: '${slug}',
  categoria: '${esc(CATEGORIA || 'Cursos externos')}',
  cardDesc: '${esc(`${plan.clases.length} clases en ${modulos.length} módulos.`)}',
  eyebrow: '${esc(EYEBROW)}',
  titulo: '${esc(plan.curso)}',
  subtitulo: '${esc(`${plan.clases.length} clases, ${modulos.length} módulos. Video, transcripción y tus apuntes en un solo lugar.`)}',
  volumen: '${plan.clases.length} clases',
  recursos: [],
  clases: [
${clases.map((c) => `    {
      n: ${c.n},${c.vn ? `\n      vn: ${c.vn},` : ''}${c.grupo ? `\n      grupo: '${esc(c.grupo)}',` : ''}${c.modulo ? `\n      modulo: ${c.modulo},` : ''}
      titulo: '${esc(c.titulo)}',
      cardDesc: '${esc(c.cardDesc)}',
      videoId: ${c.videoId ? `'${c.videoId}'` : 'null'},
      resumen: ${c.resumen ? `\`${esc(c.resumen)}\`` : `''`},
      transcripcion: [],${c.hasTx ? '\n      hasTx: true,' : ''}
      recursoSlugs: [],
      herramientas: [],
    },`).join('\n')}
  ],
};
`;

writeFileSync(salida, cuerpo, 'utf8');

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${clases.length} · ${conTx} con transcripción · ${conApuntes} con apuntes tuyos`);
if (sinTx) console.log(`  ⚠ ${sinTx} sin transcripción todavía (volvé a correr esto cuando terminen)`);
console.log(`\n  → ${salida}`);
console.log(`  → ${dirTx}\\<videoId>.json  (${conTx} archivo/s)`);
// ⚠️ El curso se suma en app/conocimientos/catalogo.ts y en NINGÚN otro lado.
// Antes la lista estaba escrita dos veces (el portal del admin y el link
// compartido armaban la suya), y un curso que faltaba en la del compartido se
// podía compartir desde la UI con el link dando 404, sin ningún síntoma del lado
// del admin. Ver docs/hallazgos-conocimiento.md → «el link compartido daba 404».
console.log(`\n  Falta UN paso a mano en app/conocimientos/catalogo.ts:`);
console.log(`    import { ${constante} } from './curso-${slug}';`);
console.log(`    …y sumarlo al array CURSOS_TODOS.`);
console.log(`\n  Es el ÚNICO lugar: esa lista la consumen el portal del admin y el link`);
console.log(`  compartido. Sumarlo en Conocimientos.tsx en vez de acá deja el link en 404.\n`);
