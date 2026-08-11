// Baja el curso ENTERO desde el plan.json que armó curso-plan.mjs.
//
// Decisiones que importan (medidas, no supuestas):
//   · --referer es OBLIGATORIO. Los embeds de Vimeo con privacidad por dominio
//     contestan 403 a una URL pelada. El referer sale del plan.
//   · --cookies-from-browser apunta al SUBDIRECTORIO del perfil
//     (…\perfil\Default). yt-dlp hace dirname() para encontrar 'Local State',
//     así que pasarle …\perfil agarra un Local State ajeno y falla raro.
//     Y funciona porque ese perfil, al no ser el user-data-dir por defecto, NO
//     tiene App-Bound Encryption: escribe cookies v10, que yt-dlp sí descifra.
//   · --ffmpeg-location: ffmpeg NO está en el PATH de esta máquina. Vimeo sirve
//     video y audio por separado, así que sin merge no hay archivo.
//   · --download-archive: reanudable. Volver a correr no re-baja nada.
//
//   node <abs>\scripts\curso-bajar.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-bajar.mjs --plan … --solo 3,7,12
//   node <abs>\scripts\curso-bajar.mjs --plan … --listar

import { readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const tiene = (n) => process.argv.includes(`--${n}`);

const PLAN = arg('plan', '');
const PERFIL = arg('perfil', 'C:\\cursos\\perfil');
const SOLO = arg('solo', '');
const FFDIR = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin'));
const FORMATO = arg('formato', 'bv*+ba/b');
const PAUSA = arg('pausa', '1');

if (!PLAN || !existsSync(PLAN)) {
  console.error('\n  ✖ Falta --plan <ruta a plan.json>. Lo produce curso-plan.mjs.\n');
  process.exit(1);
}

const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
const base = dirname(PLAN);
const dirVideo = join(base, 'video');

// yt-dlp: preferir el ejecutable, caer al módulo de Python (así se instaló acá).
const resolverYtdlp = () => {
  for (const c of [['yt-dlp', []], ['yt-dlp.exe', []]]) {
    const p = spawnSync(c[0], ['--version'], { encoding: 'utf8' });
    if (p.status === 0) return { cmd: c[0], pre: [], version: p.stdout.trim() };
  }
  for (const py of ['python', 'py']) {
    const p = spawnSync(py, ['-m', 'yt_dlp', '--version'], { encoding: 'utf8' });
    if (p.status === 0) return { cmd: py, pre: ['-m', 'yt_dlp'], version: p.stdout.trim() };
  }
  return null;
};

const yt = resolverYtdlp();
if (!yt) {
  console.error('\n  ✖ No encuentro yt-dlp. Instalalo con:');
  console.error('      python -m pip install -U yt-dlp pycryptodomex\n');
  process.exit(1);
}

const ffmpegOk = existsSync(join(FFDIR, 'ffmpeg.exe'));

let clases = plan.clases ?? [];
if (SOLO) {
  const n = new Set(SOLO.split(',').map((x) => Number(x.trim())).filter(Boolean));
  clases = clases.filter((c) => n.has(c.n));
}

console.log(`\n  Curso   : ${plan.curso}`);
console.log(`  Clases  : ${clases.length}${SOLO ? ` (filtradas de ${plan.clases.length})` : ''}`);
console.log(`  yt-dlp  : ${yt.version}${yt.pre.length ? ' (vía python -m yt_dlp)' : ''}`);
console.log(`  ffmpeg  : ${ffmpegOk ? FFDIR : '⚠ NO encontrado — Vimeo no va a poder mergear video+audio'}`);
console.log(`  Referer : ${plan.referer}`);
console.log(`  Destino : ${dirVideo}\n`);

if (tiene('listar')) {
  for (const c of clases) console.log(`  ${String(c.n).padStart(2, '0')}  ${c.duracion}  ${c.titulo}   [${c.plataforma} ${c.videoId}]`);
  console.log('');
  process.exit(0);
}

if (!ffmpegOk) {
  console.error('  ✖ Sin ffmpeg no sigo: bajaría pistas sueltas sin unir.');
  console.error(`    Pasá la carpeta con --ffmpeg <dir que contiene ffmpeg.exe>\n`);
  process.exit(1);
}

mkdirSync(dirVideo, { recursive: true });
const archivo = join(base, 'bajados.txt'); // el registro de reanudación de yt-dlp

const fallos = [];
let ok = 0;

for (const [i, c] of clases.entries()) {
  console.log(`\n  ── ${i + 1}/${clases.length} · ${String(c.n).padStart(2, '0')} ${c.titulo} (${c.duracion}) ──`);

  const args = [
    ...yt.pre,
    c.url,
    '--referer', plan.referer,
    '--user-agent', plan.userAgent,
    '--cookies-from-browser', `chrome:${join(PERFIL, 'Default')}`,
    '--ffmpeg-location', FFDIR,
    '-f', FORMATO,
    '--merge-output-format', 'mp4',
    '-o', join(dirVideo, `${c.archivo}.%(ext)s`),
    '--download-archive', archivo,
    '--no-overwrites',
    '--no-playlist',
    '--retries', '5',
    '--fragment-retries', '10',
    '--sleep-requests', PAUSA,
    '--no-warnings',
    '--progress',
  ];

  const p = spawnSync(yt.cmd, args, { stdio: 'inherit' });
  if (p.status === 0) { ok++; continue; }

  fallos.push({ n: c.n, titulo: c.titulo, url: c.url, code: p.status });
  console.error(`  ✖ falló (código ${p.status}) — sigo con las demás`);
}

const bajados = existsSync(dirVideo) ? readdirSync(dirVideo).filter((f) => /\.(mp4|mkv|webm|m4v)$/i.test(f)) : [];

console.log('\n' + '─'.repeat(70));
console.log(`  ${ok}/${clases.length} clases OK · ${fallos.length} con error`);
console.log(`  Archivos en destino: ${bajados.length}`);
console.log(`  Registro reanudable: ${archivo}`);
console.log('─'.repeat(70));

if (fallos.length) {
  console.log('\n  Fallaron (volver a correr las reintenta; las OK se saltean solas):');
  for (const f of fallos) console.log(`    ${String(f.n).padStart(2, '0')}  ${f.titulo}`);
  console.log(`\n  Reintento puntual:  --solo ${fallos.map((f) => f.n).join(',')}`);
  console.log('  Si dice 403: la sesión del perfil caducó. Volvé a abrir el curso en');
  console.log('  ese Chrome y reintentá — el referer y el UA ya van bien.');
}

console.log(`\n  Siguiente:`);
console.log(`    node <abs>\\scripts\\curso-audio.mjs --de "${dirVideo}" --a "${join(base, 'audio')}"`);
console.log(`    npx tsx <abs>\\scripts\\curso-transcribir.ts --de "${join(base, 'audio')}" --a "${join(base, 'texto')}"\n`);

process.exit(fallos.length ? 1 : 0);
