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

// ── Los recursos del portal (PDFs, planillas, links) ─────────────────────────
// `CursoPortal` dibuja la sección «Recursos» solo si `curso.recursos.length > 0`, y
// el detalle de una clase muestra los suyos por `recursoSlugs`. Con los dos vacíos,
// 20 PDFs bajados y subidos a Drive no aparecían en ninguna parte.
//
// El `driveId` sale de drive.json (lo resuelve curso-a-drive.mjs). Un recurso SIN id
// no se emite: una tarjeta que abre un visor vacío es peor que no tener la tarjeta.
const TIPO_POR_EXT = { pdf: 'pdf', xlsx: 'pdf', docx: 'pdf', link: 'notion' };
const slugRecurso = (nombre) => nombre.replace(/\.[^.]+$/, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);

// Cómo se cuelga cada recurso de sus clases, y por qué así:
//
//   pdfs/     → el origen (curso-pdfs.mjs) lo asoció a UNA clase: va a esa.
//   recursos/ → la plataforma los asocia a un MÓDULO, nunca a una lección. Así que
//               se cuelgan de todas las clases de su módulo, prefiriendo el
//               SUBMÓDULO cuando lo hay: el recurso de «1. Setting» va a sus 25
//               clases, no a las 38 del módulo raíz «6. SALES».
//
// Bajar de ahí —adivinar UNA clase dentro del módulo— sería inventar el dato, y es
// justamente lo que no se hace.
const construirRecursos = (drive, planClases) => {
  const recursos = [];
  const porClase = new Map();
  const colgar = (n, slug) => porClase.set(n, [...(porClase.get(n) ?? []), slug]);
  const sinNumero = (s) => String(s ?? '').replace(/^\d+\.\s*/, '').trim();

  for (const r of drive.recursos ?? []) {
    const esEnlace = r.tipo === 'link' && r.url;
    const ext = (r.archivo.match(/\.([^.]+)$/)?.[1] ?? 'pdf').toLowerCase();
    // Un enlace se emite como `bank` con un item: es el único tipo del portal que
    // renderiza un link EXTERNO clickeable. `notion` pondría un botón que dice «Ver en
    // Notion» sobre un tablero de Miro, que sería mentira; y `pdf` abre un visor de
    // Drive, que para un link no existe.
    const tipo = esEnlace ? 'bank' : (TIPO_POR_EXT[ext] ?? 'pdf');
    const slug = slugRecurso(r.archivo);
    if (recursos.some((x) => x.slug === slug)) continue; // slug único, sin pisar
    // Un recurso de archivo SIN id de Drive no se emite (tarjeta que abre nada);
    // un enlace no necesita id, así que esa regla no le aplica.
    if (!esEnlace && !r.driveId) continue;

    let deClases = [];
    let desc = 'Material del curso';

    if (r.nivel === 'clase') {
      const n = Number(/^(\d{1,3})\s*-\s*/.exec(r.archivo)?.[1]);
      if (Number.isFinite(n) && planClases.some((c) => c.n === n)) {
        deClases = [n];
        desc = `Material de la clase ${n}`;
      }
    } else if (r.submodulo) {
      deClases = planClases.filter((c) => sinNumero(c.submodulo) === sinNumero(r.submodulo)).map((c) => c.n);
      desc = `Material de «${r.submodulo}»`;
    } else if (r.modulo) {
      deClases = planClases.filter((c) => sinNumero(c.modulo) === sinNumero(r.modulo)).map((c) => c.n);
      desc = `Material de «${r.modulo}»`;
    }

    const label = r.archivo.replace(/\.[^.]+$/, '');
    recursos.push({
      slug, tipo,
      driveId: esEnlace ? null : r.driveId,
      items: esEnlace ? [{ label: `Abrir ${label}`, url: r.url }] : null,
      label,
      cardDesc: esEnlace ? `Enlace · ${desc.replace(/^Material de /, '')}` : desc,
      clases: deClases.length ? deClases : undefined,
    });
    for (const n of deClases) colgar(n, slug);
  }
  return { recursos, porClase };
};
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
    // 2º nivel del hub: la SECCIÓN dentro del módulo. La plataforma la muestra y el
    // portal la tiraba, así que las 24 clases de un módulo salían en una lista plana.
    subgrupo: c.submodulo ? String(c.submodulo).replace(/^\d+\.\s*/, '') : undefined,
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

// Contra las clases del PLAN, no contra las ya construidas: el plan es el que tiene
// `modulo` y `submodulo` como texto, que es la clave del vínculo con los recursos.
const { recursos: recursosPortal, porClase: slugsPorClase } = construirRecursos(drive, plan.clases);

// La portada se declara SOLO si el archivo existe: un `portada` apuntando a un 404
// pinta una tarjeta con la imagen rota, que es peor que una tarjeta sin imagen.
const dirPortadas = join(REPO, 'public', 'cono-portadas');
const portada = existsSync(dirPortadas)
  ? (readdirSync(dirPortadas).find((f) => f.replace(/\.[^.]+$/, '') === slug)
      ? `/cono-portadas/${readdirSync(dirPortadas).find((f) => f.replace(/\.[^.]+$/, '') === slug)}`
      : null)
  : null;

// ⚠️ GUARDA: si hay material en disco y NO termina en la ficha, se corta acá.
//
// Esto ya pasó dos veces y las dos fueron silenciosas: el curso de Claude salió con
// `recursos: []` teniendo 20 PDFs subidos, y el de ATV con los 71 sin id porque
// `recursos/` no se copiaba a Drive. En los dos casos el generador dijo «listo», el
// portal no mostró la sección (la dibuja solo si `recursos.length > 0`) y el dueño lo
// encontró antes que nosotros.
//
// El chequeo se hace contra el DISCO, que es la fuente, no contra lo que se emitió.
const localRecursos = ['pdfs', 'recursos']
  .flatMap((sub) => existsSync(join(base, sub))
    ? readdirSync(join(base, sub), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
    : []);

if (localRecursos.length && recursosPortal.length < localRecursos.length) {
  const faltan = localRecursos.length - recursosPortal.length;
  console.error(`\n  ✖ NO emito la ficha: hay ${localRecursos.length} recurso(s) en disco y solo ${recursosPortal.length} con id de Drive.`);
  console.error(`    Faltan ${faltan}. Sin id no se pueden mostrar, y emitir la ficha así la deja`);
  console.error(`    sin la sección «Recursos» sin que nada avise — que es exactamente el bug`);
  console.error(`    que esta guarda existe para no repetir.\n`);
  console.error(`    Qué hacer:`);
  console.error(`      1. node scripts/curso-a-drive.mjs --plan "${PLAN}" --solo-copiar`);
  console.error(`      2. esperar a que Drive termine de subir`);
  console.error(`      3. node scripts/curso-a-drive.mjs --plan "${PLAN}" --solo-ids`);
  console.error(`      4. volver a correr esto\n`);
  process.exit(4);
}

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
  volumen: '${plan.clases.length} clases',${portada ? `\n  portada: '${portada}',` : ''}
  recursos: [
${recursosPortal.map((r) => `    {
      slug: '${r.slug}',
      label: '${esc(r.label)}',
      cardDesc: '${esc(r.cardDesc)}',
      tipo: '${r.tipo}',${r.driveId ? `\n      driveId: '${r.driveId}',` : ''}${r.items ? `\n      items: [${r.items.map((i) => `{ label: '${esc(i.label)}', url: '${esc(i.url)}' }`).join(', ')}],` : ''}${r.clases ? `\n      clases: [${r.clases.join(', ')}],` : ''}
    },`).join('\n')}
  ],
  clases: [
${clases.map((c) => `    {
      n: ${c.n},${c.vn ? `\n      vn: ${c.vn},` : ''}${c.grupo ? `\n      grupo: '${esc(c.grupo)}',` : ''}${c.subgrupo ? `\n      subgrupo: '${esc(c.subgrupo)}',` : ''}${c.modulo ? `\n      modulo: ${c.modulo},` : ''}
      titulo: '${esc(c.titulo)}',
      cardDesc: '${esc(c.cardDesc)}',
      videoId: ${c.videoId ? `'${c.videoId}'` : 'null'},
      resumen: ${c.resumen ? `\`${esc(c.resumen)}\`` : `''`},
      transcripcion: [],${c.hasTx ? '\n      hasTx: true,' : ''}
      recursoSlugs: [${(slugsPorClase.get(c.n) ?? []).map((s) => `'${s}'`).join(', ')}],
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
