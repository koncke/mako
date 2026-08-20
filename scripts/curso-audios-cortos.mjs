// =============================================================================
// curso-audios-cortos — qué transcripciones son media clase
// =============================================================================
// Un audio cortado NO se ve como un error en ninguna parte del pipeline: decodifica,
// pesa bytes razonables, ScreenApp lo transcribe sin quejarse y el texto que sale está
// bien escrito y bien puntuado. Simplemente termina antes que la clase. En el portal se
// lee como una transcripción correcta de un curso que, para el lector, dice otra cosa.
//
// Medido en «Creator Club»: 50 de 62 audios cortados, uno al 2% —1,7 minutos de habla
// para una clase de 69— y los 50 publicados. La causa es una carrera: el audio se
// extrajo mientras yt-dlp seguía escribiendo el .mp4. `curso-audio.mjs` ya no la deja
// pasar (compara contra la duración de la fuente), pero eso no arregla lo que ya está
// en disco de las corridas viejas: esto es lo que dice DÓNDE.
//
// ⚠️ LA ÚNICA EVIDENCIA ES LA DURACIÓN. Ni el tamaño ni que decodifique alcanzan, y el
// texto tampoco: un fragmento se lee igual de bien que el todo. Por eso se mide contra
// el VIDEO, que es la fuente, y no contra sí mismo.
//
//   node scripts/curso-audios-cortos.mjs                → todos los cursos de C:\cursos
//   node scripts/curso-audios-cortos.mjs --solo creator-club
//   node scripts/curso-audios-cortos.mjs --json         → para encadenar
// =============================================================================
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { esIntermedio } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const RAIZ = arg('raiz', 'C:\\cursos');
const SOLO = arg('solo', '');
const JSON_CRUDO = process.argv.includes('--json');
const TOLERANCIA = Number(arg('tolerancia', 0.97));
const FFMPEG = arg('ffmpeg', join(
  process.env.LOCALAPPDATA ?? '',
  'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe',
));
if (!existsSync(FFMPEG)) { console.error(`\n  ✖ No encuentro ffmpeg en ${FFMPEG}\n`); process.exit(1); }

const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.ts', '.flv', '.mpg', '.mpeg']);
const duracion = (f) => {
  const p = spawnSync(FFMPEG, ['-i', f], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(`${p.stderr}`);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100 : null;
};
// El número de clase es la clave real del pipeline; sobre el BASENAME siempre, porque
// con el curso organizado la ruta empieza por la carpeta del módulo.
const nDe = (f) => { const m = /^(\d{1,3})\s*-\s*/.exec(basename(f)); return m ? Number(m[1]) : null; };

const listar = (dir) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? readdirSync(join(dir, e.name)).map((f) => join(e.name, f)) : [e.name]);

const cursos = readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && (!SOLO || e.name === SOLO))
  .map((e) => e.name)
  .filter((d) => existsSync(join(RAIZ, d, 'video')) && existsSync(join(RAIZ, d, 'audio')));

const informe = [];
for (const dir of cursos) {
  const V = join(RAIZ, dir, 'video');
  const A = join(RAIZ, dir, 'audio');

  const vids = new Map();
  for (const f of listar(V)) {
    if (!VIDEO.has(extname(f).toLowerCase()) || esIntermedio(f)) continue;
    const n = nDe(f);
    if (n != null && !vids.has(n)) vids.set(n, join(V, f));
  }
  // Las piezas «.parteNN» son UNA clase: se suman, no se comparan de a una.
  const auds = new Map();
  for (const f of readdirSync(A)) {
    if (extname(f).toLowerCase() !== '.m4a') continue;
    const n = nDe(f);
    if (n == null) continue;
    if (!auds.has(n)) auds.set(n, []);
    auds.get(n).push(join(A, f));
  }

  const cortos = [];
  let mirados = 0;
  for (const [n, src] of [...vids].sort((a, b) => a[0] - b[0])) {
    const piezas = auds.get(n);
    if (!piezas?.length) continue;
    const dv = duracion(src);
    if (!dv) continue;
    mirados++;
    const da = piezas.reduce((s, p) => s + (duracion(p) ?? 0), 0);
    if (da >= dv * TOLERANCIA || dv - da <= 5) continue;
    cortos.push({ n, video: Math.round(dv), audio: Math.round(da), pct: Math.round((da / dv) * 100), titulo: basename(src) });
  }
  informe.push({ curso: dir, mirados, cortos });
  if (!JSON_CRUDO) {
    const peor = cortos.length ? Math.min(...cortos.map((c) => c.pct)) : 100;
    const marca = cortos.length ? '✖' : '✓';
    console.log(`  ${marca} ${dir.padEnd(34)} ${String(cortos.length).padStart(4)} cortos de ${String(mirados).padStart(4)}${cortos.length ? `   (el peor, al ${peor}%)` : ''}`);
    for (const c of cortos.slice(0, 6)) {
      console.log(`        clase ${String(c.n).padStart(3)}: ${Math.round(c.audio / 60)} de ${Math.round(c.video / 60)} min (${c.pct}%)  ${c.titulo.slice(0, 46)}`);
    }
    if (cortos.length > 6) console.log(`        … y ${cortos.length - 6} más`);
  }
}

if (JSON_CRUDO) { console.log(JSON.stringify(informe, null, 1)); process.exit(0); }
const total = informe.reduce((s, x) => s + x.cortos.length, 0);
const conProblema = informe.filter((x) => x.cortos.length);
console.log(`\n  ${total} clase(s) con el audio cortado, en ${conProblema.length} de ${informe.length} curso(s).`);
if (total) console.log('  Se arreglan re-extrayendo el audio (curso-audio.mjs ya rehace los cortos) y volviendo a transcribir.\n');
else console.log('');
