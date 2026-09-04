// ¿Qué videos de la carpeta de Drive de un curso NO están enganchados a ninguna clase?
// Cruzado por ID DE DRIVE, que es la única clave que sobrevive a un renombre.
//
//   node scripts/curso-faltantes-por-id.mjs
//   node scripts/curso-faltantes-por-id.mjs --slug masteryhaus --listar
//
// ── Los DOS chequeos anteriores mintieron, cada uno a su manera ─────────────────────────
// 1. `curso-drive-vs-portal.mjs` cruza TÍTULOS: los del portal (limpios, numerados) contra
//    nombres de archivo. Dio «Metodología JADS: coinciden 11%, dado por cargado y no lo
//    está» sobre un curso que tiene sus 109 clases. Medía nuestra propia limpieza.
// 2. `curso-faltantes-por-archivo.mjs` cruza NOMBRES DE ARCHIVO, que ya es la misma cadena
//    de los dos lados. Mejor, y también miente: dio «bluehacker: 233 sueltos» porque esos
//    233 archivos fueron RENOMBRADOS en Drive después de subirse. El nombre cambió, el
//    contenido no, y el portal —que reproduce por `videoId`— nunca se enteró.
//
// El id es una clave; el título es un parecido, y el nombre de archivo es un parecido que
// dura hasta que alguien renombra. Acá se comparan los `stable_id` que Drive le dio a cada
// archivo contra los `videoId` que el curso tiene anotados.
//
// ⚠️ SI LA CARPETA NO SE ENCUENTRA EN LA METADATA, NO SE CONCLUYE NADA. Un curso que no se
//    puede leer no es un curso completo ni uno vacío: es uno sobre el que no podemos
//    contestar. Contar sus 400 videos como «faltantes» sería inventar trabajo, y contarlo
//    como completo sería taparlo.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { mapaPorRuta, abrirMetadata } from './curso-drive-ids-por-ruta.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SOLO = arg('slug', '');
const LISTAR = process.argv.includes('--listar');
const RAIZ = 'C:\\cursos';
const ES_VIDEO = /\.(mp4|mkv|webm|mov|m4v)$/i;

// `abrirMetadata` ya copia la base con su `-wal`, que es obligatorio: sin él se lee una
// foto vieja (ver el comentario largo en curso-drive-ids.mjs).
const db = abrirMetadata();
if (!db) { console.error('\n  ✖ no encontré la metadata de Drive\n'); process.exit(2); }

const slugs = readdirSync(RAIZ, { withFileTypes: true })
  .filter((x) => x.isDirectory() && existsSync(join(RAIZ, x.name, 'drive.json')))
  .map((x) => x.name)
  .filter((s) => !SOLO || s === SOLO);

const conSueltos = [], sinDatos = [];
for (const slug of slugs) {
  let drive;
  try { drive = JSON.parse(readFileSync(join(RAIZ, slug, 'drive.json'), 'utf8')); } catch { continue; }
  const nombreCarpeta = drive.carpeta ? basename(drive.carpeta) : '';
  if (!nombreCarpeta) { sinDatos.push({ slug, nota: 'drive.json sin carpeta' }); continue; }

  // ⚠️ Se usa `mapaPorRuta` y NO `descendientesDe`: aquel fusiona TODAS las carpetas que
  //    compartan el nombre, y hay cursos duplicados enteros en Drive (dos «TikTok 100k –
  //    Jordi Segués» vivas). Fusionarlas hace aparecer como «sueltos» los archivos de la
  //    copia, o sea el doble de trabajo inventado. `mapaPorRuta` se abstiene ahí.
  const mapa = mapaPorRuta(nombreCarpeta, db);
  if (!mapa) { sinDatos.push({ slug, nota: `no puedo leer «${nombreCarpeta}» (no está en la metadata, o hay DOS carpetas con ese nombre)` }); continue; }

  const videos = [];
  for (const [ruta, id] of mapa) {
    if (!ES_VIDEO.test(ruta)) continue;
    videos.push({ id, nombre: ruta });
  }
  if (!videos.length) { sinDatos.push({ slug, nota: `la carpeta «${nombreCarpeta}» no tiene videos en la metadata` }); continue; }

  const anotados = new Set((drive.clases ?? []).map((c) => c.videoId).filter(Boolean));
  const sueltos = videos.filter((v) => !anotados.has(v.id));
  if (sueltos.length) conSueltos.push({ slug, carpeta: nombreCarpeta, total: videos.length, anotados: anotados.size, sueltos });
}

conSueltos.sort((a, b) => b.sueltos.length - a.sueltos.length);
console.log(`\n  ${slugs.length} curso(s) revisados · ${conSueltos.length} con videos NO enganchados\n`);
for (const f of conSueltos) {
  console.log(`  ${String(f.sueltos.length).padStart(4)} sueltos   ${f.slug.padEnd(40)} (${f.anotados} anotados · ${f.total} videos en la carpeta)`);
  if (LISTAR) for (const v of f.sueltos.slice(0, 40)) console.log(`         ${String(v.nombre).slice(0, 92)}`);
}
if (sinDatos.length) {
  console.log(`\n  ── NO SE PUEDE CONTESTAR (no es «no falta nada») ──`);
  for (const f of sinDatos) console.log(`     ${f.slug.padEnd(40)} ${f.nota}`);
}
console.log(`\n  total de videos sueltos: ${conSueltos.reduce((a, f) => a + f.sueltos.length, 0)}\n`);
