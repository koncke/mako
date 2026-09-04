// Suma a un curso YA PUBLICADO las clases que están en su carpeta de Drive y no en el plan.
//
//   node scripts/curso-enriquecer-desde-drive.mjs --slug masteryhaus            (en seco)
//   node scripts/curso-enriquecer-desde-drive.mjs --slug masteryhaus --aplicar
//   node scripts/curso-enriquecer-desde-drive.mjs --slug X --excluir "clips del documento"
//
// ── Por qué no alcanza con el pipeline normal ───────────────────────────────────────────
// `curso-plan-desde-drive.mjs` arma un plan DESDE CERO y sirve para un curso nuevo. Acá el
// curso ya está publicado, con sus transcripciones y su ficha, y lo que hay que hacer es
// AGREGAR: regenerar el plan entero reordenaría clases que la gente ya tiene linkeadas y
// tiraría el enganche de todo lo transcripto.
//
// ⚠️ QUÉ FALTA SE DECIDE POR ID DE DRIVE, nunca por título ni por nombre de archivo. Los
//    tres se probaron y los tres mienten distinto (ver curso-faltantes-por-id.mjs): el
//    título mide nuestra propia limpieza, el nombre de archivo muere con el primer
//    renombre, y el id es lo único que sobrevive. `mapaPorRuta` además se ABSTIENE cuando
//    hay dos carpetas con el mismo nombre — hay cursos duplicados enteros en Drive, y
//    fusionarlos inventaría cientos de faltantes que no existen.
//
// ⚠️ Y NO TODO LO SUELTO ES UNA CLASE. Medido el 03/09/2026 sobre los 402 videos sueltos:
//    en AvatarHype los 51 eran `clips del documento/<hash>.mp4` —fragmentos, no lecciones—
//    y en «Hackeando el Algoritmo» los 52 son una COPIA ENTERA del curso (versión 1.0)
//    metida adentro de nuestra carpeta. Ingerir eso no enriquece: duplica. Por eso el
//    script se corre EN SECO primero y `--excluir` acepta las carpetas que no van.
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { mapaPorRuta } from './curso-drive-ids-por-ruta.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SLUG = arg('slug', '');
const APLICAR = process.argv.includes('--aplicar');
const EXCLUIR = (arg('excluir', '') || '').split('|').map((s) => s.trim()).filter(Boolean);
const RAIZ = 'C:\\cursos';
const ES_VIDEO = /\.(mp4|mkv|webm|mov|m4v)$/i;

if (!SLUG) { console.error('\n  ✖ Falta --slug\n'); process.exit(1); }

const base = join(RAIZ, SLUG);
const pDrive = join(base, 'drive.json');
const pPlan = join(base, 'plan.json');
if (!existsSync(pDrive) || !existsSync(pPlan)) { console.error(`\n  ✖ ${SLUG}: falta drive.json o plan.json\n`); process.exit(1); }

const drive = JSON.parse(readFileSync(pDrive, 'utf8'));
const plan = JSON.parse(readFileSync(pPlan, 'utf8'));
if (!drive.carpeta) { console.error(`\n  ✖ ${SLUG}: drive.json sin carpeta\n`); process.exit(1); }

const mapa = mapaPorRuta(basename(drive.carpeta));
if (!mapa) {
  console.error(`\n  ✖ ${SLUG}: no puedo leer «${basename(drive.carpeta)}».`);
  console.error(`     O no está en la metadata de Drive, o hay DOS carpetas con ese nombre.`);
  console.error(`     No se concluye nada: eso NO es «no falta nada».\n`);
  process.exit(2);
}

const anotados = new Set((drive.clases ?? []).map((c) => c.videoId).filter(Boolean));
let sueltos = [...mapa.entries()]
  .filter(([ruta]) => ES_VIDEO.test(ruta))
  .filter(([, id]) => !anotados.has(id))
  .map(([ruta, id]) => ({ ruta, id }));

const excluidos = sueltos.filter((s) => EXCLUIR.some((e) => s.ruta.includes(e)));
sueltos = sueltos.filter((s) => !EXCLUIR.some((e) => s.ruta.includes(e)));

if (!sueltos.length) {
  console.log(`\n  ${SLUG}: nada que sumar${excluidos.length ? ` (${excluidos.length} excluido(s))` : ''}\n`);
  process.exit(0);
}

/** Como ordena una persona: por el número que abre el nombre, no alfabéticamente. Sin esto
 *  «10 - …» va antes que «2 - …» y el módulo queda con el temario barajado. */
const NUM = /(?:^|\/)\s*(\d{1,3})\b/;
const porNumero = (a, b) => {
  const na = NUM.exec(a.ruta)?.[1], nb = NUM.exec(b.ruta)?.[1];
  if (na && nb && Number(na) !== Number(nb)) return Number(na) - Number(nb);
  return a.ruta.localeCompare(b.ruta, 'es', { numeric: true, sensitivity: 'base' });
};

// Se agrupan por CARPETA (que es el módulo) y se ordena adentro. Las nuevas se APENDEAN:
// insertarlas entre las existentes correría la numeración de un curso que ya está publicado
// y linkeado, y el portal agrupa por `modulo` igual.
const porModulo = {};
for (const s of sueltos.sort(porNumero)) {
  const partes = s.ruta.split('/');
  const archivo = partes.pop();
  const modulo = partes.length ? partes[partes.length - 1] : '';
  (porModulo[modulo] ??= []).push({ ...s, archivo, rel: partes.join('/') });
}

const limpio = (s) => String(s)
  .replace(/\.[^.]+$/, '')
  .replace(/^(hotmart club|kajabi|teachable|thinkific)\s*[-–—:]\s*/i, '')
  .replace(/\s*[-–—]?\s*\d{3,4}x\d{3,4}(?:\s+\d{2,5}\s?K)?(?:[ _]?\(\d+\)|_\d+|\s*[-–—]\s*copia)?\s*$/gi, '')
  .replace(/\s*[-–—]?\s*\((?:\d{3,4}p|hd|full ?hd)\)\s*$/gi, '')
  .replace(/\s*[-–—]\s*$/, '')
  .replace(/\s+/g, ' ').trim();

console.log(`\n  ${SLUG}`);
console.log(`     ${drive.clases.length} clases publicadas · ${sueltos.length} para sumar${excluidos.length ? ` · ${excluidos.length} excluido(s)` : ''}\n`);
for (const [mod, cs] of Object.entries(porModulo)) {
  console.log(`     ${mod || '(raíz)'}  — ${cs.length}`);
  for (const c of cs.slice(0, 3)) console.log(`         ${limpio(c.archivo).slice(0, 84)}`);
  if (cs.length > 3) console.log(`         … y ${cs.length - 3} más`);
}
if (excluidos.length) {
  console.log(`\n     EXCLUIDOS (${excluidos.length}):`);
  for (const e of excluidos.slice(0, 3)) console.log(`         ${e.ruta.slice(0, 84)}`);
}

if (!APLICAR) { console.log(`\n  (en seco — sumá --aplicar)\n`); process.exit(0); }

let n = Math.max(0, ...drive.clases.map((c) => Number(c.n) || 0));
const nuevasDrive = [], nuevasPlan = [];
for (const cs of Object.values(porModulo)) {
  for (const c of cs) {
    n++;
    const titulo = limpio(c.archivo);
    nuevasDrive.push({ n, titulo, videoId: c.id, rel: c.rel, archivo: c.archivo });
    nuevasPlan.push({
      n, titulo, duracion: '',
      modulo: c.rel ? c.rel.split('/').pop() : '',
      plataforma: 'drive', videoId: c.id,
      url: `https://drive.google.com/file/d/${c.id}/preview`,
      archivo: `${String(n).padStart(3, '0')} - ${titulo}`.slice(0, 110),
      sinFuente: false,
    });
  }
}

drive.clases.push(...nuevasDrive);
plan.clases.push(...nuevasPlan);
writeFileSync(pDrive, JSON.stringify(drive, null, 2), 'utf8');
writeFileSync(pPlan, JSON.stringify(plan, null, 2), 'utf8');

/** El registro del bajador: sin esto `curso-bajar.mjs` intenta bajar de una URL de Drive
 *  que no es descargable y falla clase por clase. Marcar acá es correcto porque el video
 *  ES el de Drive — la regla general de «sólo se marca lo que tiene id» se cumple. */
appendFileSync(join(base, 'bajados.txt'), nuevasPlan.map((c) => `drive ${c.videoId}`).join('\n') + '\n', 'utf8');

console.log(`\n  ✓ ${nuevasPlan.length} clase(s) sumadas (n ${nuevasPlan[0].n}–${n})`);
console.log(`\n  Siguiente:`);
console.log(`    node scripts/curso-audio-desde-drive.mjs --plan ${pPlan}`);
console.log(`    node scripts/curso-pipeline.mjs --plan ${pPlan} --tope-horas 6`);
console.log(`    node scripts/curso-a-portal.mjs --plan ${pPlan}\n`);
