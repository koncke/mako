// Video de clase -> audio chico, listo para transcribir.
//
// Por que existe: lib/transcribe.ts corta en 25 MB (MAX_BYTES, linea 13) y la
// cascada barata de lib/ai-cheap.ts corta antes todavia, a 14 MB inline. Un video
// de clase de 40 min pesa cientos de MB, asi que SIEMPRE devuelve 'muy_grande' ->
// HTTP 413. No es un bug: hay que mandar audio, no video.
//
// A 32 kbps mono 16 kHz una hora de clase pesa ~14 MB y el habla se transcribe
// igual de bien. Si algo se pasa del objetivo, se parte por tiempo.
//
// ffmpeg NO esta en el PATH de esta maquina, pero hay un build GPL completo en
// disco. No hace falta instalar nada.
//
//   node scripts/curso-audio.mjs --de C:\cursos\video --a C:\cursos\audio

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const DE = arg('de', 'C:\\cursos\\video');
const A = arg('a', 'C:\\cursos\\audio');
const KBPS = Number(arg('kbps', 32));
const MB_OBJETIVO = Number(arg('mb', 20)); // margen contra el tope real de 25
const FFMPEG = arg('ffmpeg', join(
  process.env.LOCALAPPDATA ?? '',
  'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe',
));

const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.ts', '.flv', '.mpg', '.mpeg']);
const mb = (b) => (b / 1048576).toFixed(1);

if (!existsSync(FFMPEG)) {
  console.error(`\n  ✖ No encuentro ffmpeg en:\n    ${FFMPEG}`);
  console.error('    Pasalo con --ffmpeg <ruta>. (Get-Command ffmpeg da vacío en esta');
  console.error('    máquina aunque el binario exista: no está en el PATH.)\n');
  process.exit(1);
}
if (!existsSync(DE)) { console.error(`\n  ✖ No existe la carpeta de entrada: ${DE}\n`); process.exit(1); }
mkdirSync(A, { recursive: true });

// Segundos que caben en el objetivo con este bitrate. A 32 kbps -> 4.000 B/s,
// asi que 20 MB son ~87 min: la mayoria de las clases nunca se parte.
const SEG_MAX = Math.floor((MB_OBJETIVO * 1048576) / ((KBPS * 1000) / 8));

const duracion = (f) => {
  const p = spawnSync(FFMPEG, ['-i', f], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(`${p.stderr}`);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100;
};

const correr = (args) => {
  const p = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (p.status !== 0) throw new Error((`${p.stderr}`.trim().split('\n').slice(-4).join('\n')) || 'ffmpeg falló');
};

// ⚠️ Esta carpeta la puede estar ESCRIBIENDO el descargador ahora mismo, y los
// archivos intermedios de yt-dlp parecen videos terminados: para una clase a medio
// bajar quedan «<titulo>.fhls-fastly_skyfire-598.mp4» (solo la pista de video, ya
// completa y de 170 MB) junto a un .part del audio. Tomarlo por bueno produce un
// audio mudo o un ffmpeg que falla con «Invalid argument», y el diagnóstico
// aparenta ser un problema de ffmpeg cuando es una carrera de escritura.
//
// Dos filtros, y el primero es una ALLOWLIST (guarda en positivo):
//   1. Si viene --plan, solo se aceptan los nombres que el plan declara.
//   2. Siempre: se descartan los intermedios «.f<formato>.<ext>» y todo lo que
//      tenga un hermano .part / .ytdl (= sigue bajando).
const PLAN = arg('plan', '');
// ⚠️ La allowlist va por NÚMERO DE CLASE, no por nombre completo. Comparar el nombre
// entero parecía más estricto y era un salteo silencioso: el descargador no siempre
// produce exactamente el `archivo` del plan. Medido — el plan decía
// «212 - 1. No pares de hacer $$$» y en disco quedó «… hacer $$»: un `$` menos, y
// las clases 212 y 215 se descartaron sin una línea de aviso. El número de 3 dígitos
// es la clave real y es la que usa TODO el pipeline aguas abajo.
const nDe = (f) => { const m = /^(\d{1,3})\s*-\s*/.exec(f); return m ? Number(m[1]) : null; };
const esperados = PLAN && existsSync(PLAN)
  // El replace del BOM: PowerShell 5.1 lo mete al editar el plan y JSON.parse muere.
  ? new Set(JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, '')).clases.map((c) => c.n))
  : null;

const todosVideo = readdirSync(DE).filter((f) => VIDEO.has(extname(f).toLowerCase()));
const esIntermedio = (f) => /\.f[^.]*\.(mp4|mkv|webm|m4v)$/i.test(f);
// Clases que YA tienen su archivo final. Un temporal de una de ellas es basura de un
// intento anterior, no una descarga en curso: quedó un «.part-Frag293.part» de la
// clase 193 y su .mp4 completo de 265 MB se salteó para siempre. Un temporal viejo NO
// puede bloquear un archivo terminado.
const terminadas = new Set(todosVideo.filter((f) => !esIntermedio(f)).map(nDe).filter(Boolean));

const temporales = readdirSync(DE).filter((f) => /\.(part|ytdl)$|\.part-Frag\d+/i.test(f));
const enVuelo = new Set(temporales.map(nDe).filter((n) => n && !terminadas.has(n)));
const basura = temporales.filter((f) => { const n = nDe(f); return n && terminadas.has(n); });

const descartes = [];
const entradas = todosVideo.filter((f) => {
  if (esIntermedio(f)) { descartes.push(`${f} (intermedio de yt-dlp)`); return false; }
  const n = nDe(f);
  if (n == null) { descartes.push(`${f} (sin número de clase al principio)`); return false; }
  if (esperados && !esperados.has(n)) { descartes.push(`${f} (la clase ${n} no está en el plan)`); return false; }
  if (enVuelo.has(n)) { descartes.push(`${f} (la clase ${n} sigue bajando)`); return false; }
  return true;
}).sort();

// Los descartes se DICEN, con el motivo. Un salteo silencioso fue exactamente el bug.
if (descartes.length) {
  console.log(`  (salteo ${descartes.length} archivo/s:)`);
  for (const d of descartes.slice(0, 8)) console.log(`     · ${d}`);
}
if (basura.length) {
  console.log(`  (${basura.length} temporal/es de intentos viejos, ignorados — su clase ya está completa)`);
}
if (!entradas.length) { console.error(`\n  ✖ No hay videos TERMINADOS en ${DE}\n`); process.exit(1); }

console.log(`\n  ${entradas.length} video(s) · ${KBPS} kbps mono 16 kHz · objetivo ${MB_OBJETIVO} MB (parte a los ${Math.floor(SEG_MAX / 60)} min)\n`);

let hechos = 0, saltados = 0, fallados = 0, partidos = 0;

for (const f of entradas) {
  const src = join(DE, f);
  const nombre = basename(f, extname(f));
  const dest = join(A, `${nombre}.m4a`);

  // Reanudable: si ya existe la pieza (entera o la primera parte), no se rehace.
  if (existsSync(dest) || existsSync(join(A, `${nombre}.parte00.m4a`))) {
    console.log(`  = ${nombre}  (ya estaba)`);
    saltados++;
    continue;
  }

  const dur = duracion(src);
  const base = ['-hide_banner', '-loglevel', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', `${KBPS}k`];

  try {
    if (dur && dur > SEG_MAX) {
      correr([...base, '-f', 'segment', '-segment_time', String(SEG_MAX), '-reset_timestamps', '1', join(A, `${nombre}.parte%02d.m4a`)]);
      const piezas = readdirSync(A).filter((x) => x.startsWith(`${nombre}.parte`));
      const total = piezas.reduce((s, x) => s + statSync(join(A, x)).size, 0);
      console.log(`  ✓ ${nombre}  →  ${piezas.length} partes, ${mb(total)} MB  (${Math.round(dur / 60)} min)`);
      partidos++;
    } else {
      correr([...base, dest]);
      const t = statSync(dest).size;
      // Red de seguridad: si igual se paso del tope real, avisar en vez de que
      // la transcripcion devuelva 413 mas tarde y parezca otro problema.
      const alerta = t > 25 * 1048576 ? '  ⚠ SE PASA DE 25 MB' : t > 14 * 1048576 ? '  ⚠ >14 MB: la cascada barata no lo toma inline' : '';
      console.log(`  ✓ ${nombre}  →  ${mb(t)} MB${dur ? `  (${Math.round(dur / 60)} min)` : ''}${alerta}`);
    }
    hechos++;
  } catch (e) {
    // Un fallo NO borra lo anterior ni queda como estado terminal: se reporta y
    // se sigue. Es la lección del cron de anuncios (9 anuncios sin texto para
    // siempre porque un error contó como "ya transcrito").
    for (const x of [dest, ...readdirSync(A).filter((y) => y.startsWith(`${nombre}.parte`)).map((y) => join(A, y))]) {
      if (existsSync(x)) { try { unlinkSync(x); } catch {} }
    }
    console.error(`  ✖ ${nombre}\n     ${e.message.replace(/\n/g, '\n     ')}`);
    fallados++;
  }
}

console.log(`\n  ${hechos} convertido(s)${partidos ? ` (${partidos} partido/s)` : ''} · ${saltados} ya estaban · ${fallados} fallado(s)`);
console.log(`  Salida: ${A}\n`);
if (fallados) console.log('  Los fallados se pueden reintentar: los que salieron bien se saltean solos.\n');
process.exit(fallados && !hechos ? 1 : 0);
