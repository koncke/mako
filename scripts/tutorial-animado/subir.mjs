// Upload a batch: public/tutoriales/<key>.mp4 + .jpg + manifiesto.json, the engine and its scripts (scripts/tutorial-animado/),
// and — with --docs — the harvest in docs/. Committed by EXPLICIT path in the own worktree C:/dev/wt-tutoriales-videos and
// pushed to punta/tutoriales-videos (GitHub brings it to main when it is green; it ships with the 11:05 UTC deploy).
//   node motor/subir.mjs "<mensaje>" key1 key2 ... [--docs]
import { readFileSync, copyFileSync, mkdirSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const RAIZ = 'C:/dev/tutoriales-video', WT = 'C:/dev/wt-tutoriales-videos';
const args = process.argv.slice(2);
const docs = args.includes('--docs');
const [mensaje, ...keys] = args.filter((a) => a !== '--docs');
const git = (...a) => execFileSync('git', ['-C', WT, ...a], { encoding: 'utf8' }).trim();
const cuenta = readFileSync(`${process.env.HOME || process.env.USERPROFILE}/.claude/cuenta-activa.txt`, 'utf8').split('\n')[0].trim().split(/\s+/)[0];

// the worktree on its own branch, up to date with main (merge, not rebase: the remote branch never needs a force)
if (git('rev-parse', '--abbrev-ref', 'HEAD') === 'HEAD') git('switch', '-c', 'tutoriales-videos');
git('fetch', '-q', 'origin', 'main');
try { git('fetch', '-q', 'origin', 'punta/tutoriales-videos'); git('merge', '-q', '--no-edit', 'FETCH_HEAD'); } catch (e) { /* first push: the branch does not exist yet */ }
git('merge', '-q', '--no-edit', 'origin/main');

const rutas = [];
const cp = (desde, hacia) => { mkdirSync(hacia.replace(/\/[^/]+$/, ''), { recursive: true }); copyFileSync(desde, `${WT}/${hacia}`); rutas.push(hacia); };
mkdirSync(`${WT}/public/tutoriales`, { recursive: true });
for (const k of keys) { cp(`${RAIZ}/public-tutoriales/${k}.mp4`, `public/tutoriales/${k}.mp4`); cp(`${RAIZ}/public-tutoriales/${k}.jpg`, `public/tutoriales/${k}.jpg`); }
// only the videos in the current format (v4: frases[] with times, marks, espera_clic and cierra_despues) go to the repo
{ const man = JSON.parse(readFileSync(`${RAIZ}/public-tutoriales/manifiesto.json`, 'utf8')); man.videos = man.videos.filter((v) => v.formato === 4);
  writeFileSync(`${WT}/public/tutoriales/manifiesto.json`, JSON.stringify(man, null, 1)); rutas.push('public/tutoriales/manifiesto.json');
  console.log('manifiesto:', man.videos.map((v) => v.key).join(', ')); }
for (const f of ['engine2.js', 'engine3.js', 'voxel-martin.mjs', 'vox-piezas.mjs', 'hacer.mjs', 'capturar2.cjs', 'render2.cjs', 'leer-guiones.mjs', 'sumar-base.mjs', 'pagina.mjs', 'hoja-pantallas.mjs', 'subir.mjs', 'voces.mjs', 'aplicar-v5.mjs', 'numeros.mjs', 'LEEME.md'])
  cp(`${RAIZ}/motor/${f}`, `scripts/tutorial-animado/${f}`);
cp(`${RAIZ}/guiones.json`, 'scripts/tutorial-animado/guiones.json');
for (const f of readdirSync(`${RAIZ}/motor/icons`)) cp(`${RAIZ}/motor/icons/${f}`, `scripts/tutorial-animado/icons/${f}`);
if (docs) {
  for (const f of ['docs/hallazgos-video-pipeline.md', 'docs/hallazgos.md', 'scripts/tutorial-animado/LEEME.md'])
    if (existsSync(`${RAIZ}/docs-listos/${f}`)) cp(`${RAIZ}/docs-listos/${f}`, f);
}
git('add', '--', ...rutas);
const cambios = git('diff', '--cached', '--name-only');
if (!cambios) { console.log('nada que subir'); process.exit(0); }
writeFileSync(`${RAIZ}/msg.txt`, `${mensaje}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Cuenta: ${cuenta}\n`);
git('commit', '-q', '-F', `${RAIZ}/msg.txt`);
console.log('commit', git('log', '-1', '--format=%h %s'), '·', cambios.split('\n').length, 'archivos');
console.log(execFileSync('git', ['-C', WT, 'push', 'origin', 'HEAD:refs/heads/punta/tutoriales-videos'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
console.log('subido a punta/tutoriales-videos:', git('rev-parse', '--short', 'HEAD'));
