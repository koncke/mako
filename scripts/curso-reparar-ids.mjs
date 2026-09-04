// Reasigna el id de Drive de cada clase POR SU RUTA, arreglando las que quedaron con el id
// de otra lección homónima.
//
//   node scripts/curso-reparar-ids.mjs                      (en seco, todos)
//   node scripts/curso-reparar-ids.mjs --slug metolodogia-jads
//   node scripts/curso-reparar-ids.mjs --aplicar
//
// El diagnóstico y el porqué están en curso-drive-ids-por-ruta.mjs. Acá va lo operativo:
// qué se toca y qué queda pendiente después de tocarlo.
//
// ⚠️ ESTO INVALIDA TRANSCRIPCIONES. El texto vive en `public/cono-tx/<videoId>.json`, así
//    que dos clases con el mismo id compartían archivo y la segunda pisó a la primera. Al
//    darle a cada clase su id verdadero, las que cambian quedan SIN texto y hay que volver
//    a extraer el audio y transcribir. El script lo dice al final, con los slugs.
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { mapaPorRuta, rutaNorm, abrirMetadata } from './curso-drive-ids-por-ruta.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SOLO = arg('slug', '');
const APLICAR = process.argv.includes('--aplicar');
const RAIZ = 'C:\\cursos';

const db = abrirMetadata();
if (!db) { console.error('\n  ✖ no encontré la metadata de Drive\n'); process.exit(2); }

const slugs = readdirSync(RAIZ, { withFileTypes: true })
  .filter((x) => x.isDirectory() && existsSync(join(RAIZ, x.name, 'drive.json')))
  .map((x) => x.name)
  .filter((s) => !SOLO || s === SOLO);

let cursosTocados = 0, clasesTocadas = 0;
const aRetranscribir = [];

for (const slug of slugs) {
  const pDrive = join(RAIZ, slug, 'drive.json');
  let drive;
  try { drive = JSON.parse(readFileSync(pDrive, 'utf8')); } catch { continue; }
  if (!drive.carpeta) continue;

  const mapa = mapaPorRuta(basename(drive.carpeta), db);
  // ⚠️ «No pude leer la carpeta» NO es «la carpeta está bien». Si no está en la metadata se
  //    SALTEA avisando: reasignar contra un mapa vacío borraría todos los ids del curso.
  if (!mapa || !mapa.size) { continue; }

  const cambios = [];
  const sinRuta = [];
  for (const c of drive.clases ?? []) {
    if (!c.archivo) continue;
    const ruta = rutaNorm(`${c.rel ?? ''}/${c.archivo}`);
    const real = mapa.get(ruta);
    if (!real) { sinRuta.push(ruta); continue; }
    if (real !== c.videoId) cambios.push({ c, viejo: c.videoId, nuevo: real, ruta });
  }

  if (!cambios.length && !sinRuta.length) continue;

  console.log(`\n  ${slug}`);
  if (cambios.length) console.log(`     ${cambios.length} clase(s) con el id CORREGIDO`);
  for (const x of cambios.slice(0, 4)) {
    console.log(`        ${x.ruta.slice(0, 88)}`);
    console.log(`          ${x.viejo} → ${x.nuevo}`);
  }
  if (sinRuta.length) {
    console.log(`     ⚠ ${sinRuta.length} clase(s) cuya ruta no está en la metadata (NO se tocan)`);
    for (const r of sinRuta.slice(0, 3)) console.log(`        ${r.slice(0, 88)}`);
  }
  if (!cambios.length) continue;

  cursosTocados++; clasesTocadas += cambios.length;
  aRetranscribir.push({ slug, n: cambios.length });
  if (!APLICAR) continue;

  for (const x of cambios) x.c.videoId = x.nuevo;
  writeFileSync(pDrive, JSON.stringify(drive, null, 2), 'utf8');

  // El plan es lo que lee el pipeline, y en un curso nacido de Drive su `videoId` ES el de
  // Drive. Se cruza por el MISMO par (rel, archivo), no por posición: dos listas que se
  // suponen paralelas dejan de serlo en cuanto alguien reordena una.
  const pPlan = join(RAIZ, slug, 'plan.json');
  if (!existsSync(pPlan)) continue;
  const plan = JSON.parse(readFileSync(pPlan, 'utf8'));
  if (plan.origen !== 'drive') continue;   // en los de plataforma el videoId es el de Vimeo
  const porN = new Map((drive.clases ?? []).map((c) => [c.n, c.videoId]));
  let nPlan = 0;
  for (const c of plan.clases ?? []) {
    const id = porN.get(c.n);
    if (id && id !== c.videoId) { c.videoId = id; c.url = `https://drive.google.com/file/d/${id}/preview`; nPlan++; }
  }
  if (nPlan) { writeFileSync(pPlan, JSON.stringify(plan, null, 2), 'utf8'); console.log(`     plan.json: ${nPlan} clase(s)`); }
}

console.log(`\n  ${cursosTocados} curso(s) · ${clasesTocadas} clase(s) con el id corregido`);
if (aRetranscribir.length) {
  console.log(`\n  ⚠️ Estas clases quedan SIN TEXTO (su transcripción estaba guardada bajo el id ajeno).`);
  console.log(`     Hay que volver a extraer el audio y transcribir:`);
  for (const r of aRetranscribir) {
    console.log(`       node scripts/curso-audio-desde-drive.mjs --plan C:/cursos/${r.slug}/plan.json`);
    console.log(`       node scripts/curso-pipeline.mjs --plan C:/cursos/${r.slug}/plan.json --tope-horas 6      (${r.n} clases)`);
  }
}
console.log(APLICAR ? '\n  ESCRITO\n' : '\n  (en seco — sumá --aplicar)\n');
