// ¿Qué videos de la carpeta de Drive de un curso NO están enganchados a ninguna clase?
//
//   node scripts/curso-faltantes-por-archivo.mjs                    (los 15 del barrido)
//   node scripts/curso-faltantes-por-archivo.mjs --slug masteryhaus --listar
//
// ── Por qué existe ──────────────────────────────────────────────────────────────────────
// `curso-drive-vs-portal.mjs` compara TÍTULOS: los del portal (limpios, con su numeración)
// contra los nombres de archivo de Drive. Eso sirve para SOSPECHAR y no para concluir, y ya
// mintió feo: dio «Metodología JADS: coinciden 11%, dado por cargado y no lo está» sobre un
// curso que cruzado por id da 109 de 109. Los títulos no coincidían porque en MaKo están
// limpios y en Drive son nombres de archivo — o sea que medía nuestra propia limpieza.
//
// Acá el cruce es por el NOMBRE DE ARCHIVO, que es la misma cadena de los dos lados:
// `drive.json` guarda, por clase, el `archivo` tal cual está en Drive. Un video de la
// carpeta que no aparezca en ese conjunto es material que el portal no publica.
//
// ⚠️ Y SI NO HAY `drive.json`, NO SE CONCLUYE NADA. Un curso sin ese archivo no es un curso
//    sin material: es un curso sobre el que no podemos contestar la pregunta. Decirlo es la
//    respuesta correcta; contar sus 400 videos como «faltantes» sería inventar trabajo.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const SOLO = arg('slug', '');
const LISTAR = process.argv.includes('--listar');
const RAIZ = 'C:\\cursos';

const ES_VIDEO = /\.(mp4|mkv|webm|mov|m4v)$/i;
const recorrer = (base, prof = 0, out = []) => {
  if (prof > 4) return out;
  let e = [];
  try { e = readdirSync(base, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    if (x.isDirectory()) recorrer(join(base, x.name), prof + 1, out);
    else if (ES_VIDEO.test(x.name)) out.push(x.name);
  }
  return out;
};

// Los nombres se comparan NORMALIZADOS: un acento compuesto distinto (NFC vs NFD) hace que
// dos cadenas idénticas en pantalla no sean iguales, y este repo ya perdió 60 GB por eso.
const norm = (s) => String(s).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

const slugs = readdirSync(RAIZ, { withFileTypes: true })
  .filter((x) => x.isDirectory() && existsSync(join(RAIZ, x.name, 'drive.json')))
  .map((x) => x.name)
  .filter((s) => !SOLO || s === SOLO);

const filas = [];
for (const slug of slugs) {
  let drive;
  try { drive = JSON.parse(readFileSync(join(RAIZ, slug, 'drive.json'), 'utf8')); } catch { continue; }
  const carpeta = drive.carpeta;
  if (!carpeta || !existsSync(carpeta)) {
    filas.push({ slug, estado: 'SIN MONTAJE', nota: carpeta ?? '(sin carpeta anotada)' });
    continue;
  }
  const enDisco = recorrer(carpeta);
  if (!enDisco.length) { filas.push({ slug, estado: 'CARPETA VACÍA', nota: carpeta }); continue; }

  const enganchados = new Set((drive.clases ?? []).map((c) => norm(c.archivo)).filter(Boolean));
  const sueltos = enDisco.filter((n) => !enganchados.has(norm(n)));
  filas.push({ slug, estado: 'ok', total: enDisco.length, enganchados: enganchados.size, sueltos });
}

const conSueltos = filas.filter((f) => f.estado === 'ok' && f.sueltos.length).sort((a, b) => b.sueltos.length - a.sueltos.length);
const sinDatos = filas.filter((f) => f.estado !== 'ok');

console.log(`\n  ${filas.length} curso(s) con drive.json · ${conSueltos.length} con videos NO enganchados\n`);
for (const f of conSueltos) {
  console.log(`  ${String(f.sueltos.length).padStart(4)} sueltos   ${f.slug.padEnd(44)} (${f.enganchados} enganchados de ${f.total} en la carpeta)`);
  if (LISTAR) for (const n of f.sueltos.slice(0, 40)) console.log(`         ${n.slice(0, 96)}`);
}
if (sinDatos.length) {
  console.log(`\n  ── NO SE PUEDE CONTESTAR (no es lo mismo que «no falta nada») ──`);
  for (const f of sinDatos) console.log(`  ${f.estado.padEnd(14)} ${f.slug.padEnd(44)} ${f.nota}`);
}
console.log(`\n  total de videos sueltos: ${conSueltos.reduce((a, f) => a + f.sueltos.length, 0)}\n`);
