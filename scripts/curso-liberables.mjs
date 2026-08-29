// Lista las carpetas de C:/cursos cuyo curso YA ESTA PUBLICADO y todavía tienen video
// local. Una por línea, de mayor a menor: lo que más pesa se libera primero.
//
//   node scripts/curso-liberables.mjs           # a stdout, para `cursos-liberar.sh`
//   node scripts/curso-liberables.mjs --ver     # con los tamaños, para leerlo
//
// ⚠️ NO BORRA NADA. Solo lista. El borrado lo hace `curso-a-drive.mjs --liberar`, que es
//    el único que comprueba contra el SERVIDOR de Drive antes de tocar un archivo.
//
// ⚠️ EL CRUCE VA POR EL SLUG DE LA FICHA, Y HAY QUE PROBAR CUATRO FORMAS. Ni el nombre de
//    la carpeta ni el `slug` del plan coinciden con el que se publica: la carpeta
//    `curso-us30-2-0` trae `slug: "curso-us30-2-0"` en su plan y se publica como
//    `us30-2-0` — el generador le saca el prefijo. Cruzando por una sola forma, un curso
//    ya publicado se cuenta como pendiente y su video local no se libera NUNCA. Tres
//    cruces distintos fallaron antes de encontrar esto.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'C:/cursos';
const DIR = 'app/conocimientos';
const VER = process.argv.includes('--ver');

const publicados = new Set();
for (const f of readdirSync(DIR)) {
  const m = /^curso-(.+)\.ts$/.exec(f);
  if (!m) continue;
  publicados.add(/slug: '([^']*)'/.exec(readFileSync(join(DIR, f), 'utf8'))?.[1] ?? m[1]);
}
const pelar = (s) => s.replace(/^curso-(de-)?/, '');

// Solo `video/`: el audio es la entrada de la transcripción y lo maneja otro paso.
const pesoVideo = (d) => {
  const p = join(RAIZ, d, 'video');
  if (!existsSync(p)) return 0;
  let t = 0;
  for (const f of readdirSync(p)) {
    try { t += statSync(join(p, f)).size; } catch { /* un archivo que no se puede medir no frena el barrido */ }
  }
  return t;
};

const filas = [];
for (const d of readdirSync(RAIZ)) {
  if (!existsSync(join(RAIZ, d, 'plan.json'))) continue;
  let slug = d;
  try { slug = JSON.parse(readFileSync(join(RAIZ, d, 'plan.json'), 'utf8')).slug || d; } catch { /* usa la carpeta */ }
  if (![slug, d, pelar(slug), pelar(d)].some((c) => publicados.has(c))) continue;
  const b = pesoVideo(d);
  if (b > 0) filas.push([d, b]);
}
filas.sort((a, b) => b[1] - a[1]);

if (VER) {
  const gb = (filas.reduce((a, f) => a + f[1], 0) / 1073741824).toFixed(1);
  console.error(`\n  ${filas.length} carpeta(s) · ${gb} GB de video local ya publicado\n`);
  for (const [d, b] of filas) console.error(`     ${String(Math.round(b / 1048576)).padStart(6)} MB  ${d}`);
} else {
  // ⚠️ LF explícito: el que lee esto es `sh`, y un CRLF le pega el \r al nombre de la
  //    carpeta — `C:/cursos/<curso>\r/plan.json` no existe y el barrido saltea todo
  //    saliendo con éxito. Ya pasó con la lista de la cola.
  process.stdout.write(filas.map((f) => f[0]).join('\n') + (filas.length ? '\n' : ''));
}
