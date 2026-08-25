// Un solo comando que dice si un curso está BIEN BAJADO, antes de publicarlo.
//
//   node <abs>\scripts\curso-verificar.mjs --plan C:\cursos\<slug>\plan.json
//
// Existe porque estos cinco chequeos se venían haciendo A MANO, uno por curso, con un
// script tirado cada vez — y los que no se hacían son exactamente los que dejaron pasar
// material roto a producción. Cada uno de abajo nació de algo que ya pasó.
//
// Sale con código 1 si algo está mal, así que se puede encadenar antes de `curso-a-portal`.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { esIntermedio, nDeArchivo } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }

const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const base = dirname(PLAN);
const dirV = join(base, 'video');
const dirT = join(base, 'texto');

const seg = (hhmm) => { const [m, s] = String(hhmm ?? '').split(':').map(Number); return (m || 0) * 60 + (s || 0); };
const duracionReal = (f) => {
  try { return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()); }
  catch { return 0; }
};

/**
 * Segundos de VOZ, no de reloj. `silencedetect` reporta cada tramo de silencio; el habla
 * es la duración menos la suma de esos tramos.
 *
 * ⚠️ ESTA ES LA MEDIDA QUE IMPORTA Y NO LA OBVIA. Una clase sana con 45% de silencio da
 * 125 palabras por minuto sobre el reloj; una clase que el modelo RESUMIÓ daba 96. Sobre
 * duración de pared las dos poblaciones se pisan, así que cualquier piso que deje pasar a
 * la primera deja pasar a la segunda. Sobre tiempo de voz la sana sube a ~230 y la
 * comprimida se queda en ~96, y ahí sí se separan.
 */
// ⚠️ `spawnSync` y no `execFileSync`: ffmpeg escribe `silencedetect` en STDERR y sale con
// código 0. Con execFileSync eso significa que el `try` devuelve stdout —vacío— y el
// `catch` que parsea nunca corre: el chequeo daría siempre «sin silencio» y por lo tanto
// nunca marcaría nada. Un verificador que no puede fallar es peor que no tenerlo.
const segundosDeVoz = (f, total) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'silencedetect=n=-35dB:d=0.6', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const txt = String(r.stderr ?? '');
  const silencio = [...txt.matchAll(/silence_duration:\s*([\d.]+)/g)].reduce((s, m) => s + Number(m[1]), 0);
  const voz = total - silencio;
  return voz > 5 ? voz : total;
};

const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
const problemas = [];
const avisos = [];

console.log(`\n  ${plan.curso}  —  ${plan.clases.length} clases en el plan\n`);

// ── 1. Cada clase del plan tiene su video, y dura lo que dice ────────────────
//
// El bajador puede reportar «N/M OK · 1 con error» y aun así estar todo: un 503 de Vimeo
// que el reintento levantó deja el resumen mintiendo. Manda el DISCO, no el resumen.
//
// ⚠️ PERO «NO ESTÁ EN DISCO» NO ES «FALTA». `curso-a-drive --liberar` borra el local una
// vez que Drive confirma, así que un curso ya subido no tiene un solo .mp4 acá — y la
// primera versión de este script marcó las 26 clases de un curso sano como «SIN VIDEO».
// Un verificador que grita sobre un curso correcto se deja de leer a la semana.
//
// Con id de Drive: la clase está, y lo que NO se puede es medirla. Eso se dice aparte, no
// se cuenta como problema ni se calla — es «no encontré nada que revisar» vs «revisé y
// está bien», que son respuestas distintas.
const drivePath = join(base, 'drive.json');
const enDrive = new Map();
if (existsSync(drivePath)) {
  try {
    const d = JSON.parse(readFileSync(drivePath, 'utf8'));
    for (const c of d.clases ?? []) if (c.videoId) enDrive.set(c.n, c.videoId);
  } catch { /* si está roto, se comporta como si no existiera */ }
}

let conVideo = 0, soloEnDrive = 0;
const dur = new Map();
for (const c of plan.clases) {
  const f = join(dirV, `${c.archivo}.mp4`);
  if (!existsSync(f)) {
    if (enDrive.has(c.n)) { soloEnDrive++; continue; }
    problemas.push(`n=${c.n} SIN VIDEO — ${String(c.titulo).slice(0, 46)}`);
    continue;
  }
  conVideo++;
  const real = duracionReal(f);
  dur.set(c.n, real);
  const esp = seg(c.duracion);
  if (esp > 0 && real > 0 && Math.abs(real - esp) / esp > 0.15) {
    problemas.push(`n=${c.n} DURACIÓN: el plan dice ${c.duracion} y el archivo tiene ${Math.round(real / 60)} min`);
  }
}
console.log(`  ${pad('videos', 26)}${conVideo} en disco${soloEnDrive ? ` · ${soloEnDrive} ya liberados (viven en Drive)` : ''} de ${plan.clases.length}`);
if (soloEnDrive) avisos.push(`${soloEnDrive} clase(s) sin copia local: duración y wpm NO se pudieron medir. Corré esto ANTES de --liberar.`);

// ── 2. Intermedios de yt-dlp sin fusionar ───────────────────────────────────
// Un `.fhls-…mp4` es solo la pista de VIDEO: si se sube a Drive, la clase queda muda.
const sueltos = existsSync(dirV) ? readdirSync(dirV).filter((f) => esIntermedio(f)) : [];
if (sueltos.length) problemas.push(`${sueltos.length} intermedio(s) de yt-dlp sin fusionar en video/ (son pistas sueltas, no clases)`);

// ── 3. Transcripciones: las DOS colas, sobre tiempo de VOZ ──────────────────
const PISO_SEG = 120;   // debajo de 2 min la métrica es ruido: 30 s de habla rápida da 246 wpm
const WPM_MIN = 70;     // truncada
const WPM_MAX = 300;    // inflada / alucinada
let conTx = 0, medidas = 0, cortas = 0, sinArchivo = 0;
for (const c of plan.clases) {
  const t = join(dirT, `${c.archivo}.md`);
  if (!existsSync(t)) { problemas.push(`n=${c.n} SIN TRANSCRIPCIÓN — ${String(c.titulo).slice(0, 44)}`); continue; }
  conTx++;
  const md = readFileSync(t, 'utf8');
  // La cabecera son notas del pipeline (líneas con «> »), no habla.
  const cuerpo = md.split('\n').filter((l) => l.trim() && !l.startsWith('>') && !l.startsWith('#')).join(' ');
  const pal = (cuerpo.match(/\S+/g) ?? []).length;
  if (pal < 40) { problemas.push(`n=${c.n} TRANSCRIPCIÓN VACÍA (${pal} palabras)`); continue; }

  const total = dur.get(c.n) ?? 0;
  // Las dos razones de no medir son DISTINTAS y se cuentan por separado: un clip de 30 s
  // no se mide porque la métrica no sirve ahí, y una clase liberada no se mide porque el
  // archivo no está. Sumarlas en «el resto» hace que un curso sin medir NINGUNA se lea
  // igual que uno medido entero.
  if (!total) { sinArchivo++; continue; }
  if (total < PISO_SEG) { cortas++; continue; }
  const voz = segundosDeVoz(join(dirV, `${c.archivo}.mp4`), total);
  const wpm = pal / (voz / 60);
  medidas++;
  if (wpm < WPM_MIN) problemas.push(`n=${c.n} POSIBLE RESUMEN/TRUNCADO: ${wpm.toFixed(0)} wpm sobre ${Math.round(voz / 60)} min de VOZ (${pal} palabras) — ${String(c.titulo).slice(0, 34)}`);
  else if (wpm > WPM_MAX) problemas.push(`n=${c.n} POSIBLE INVENTO: ${wpm.toFixed(0)} wpm sobre ${Math.round(voz / 60)} min de VOZ — ${String(c.titulo).slice(0, 34)}`);
}
const detalle = [
  `${medidas} medidas por wpm`,
  cortas ? `${cortas} clip(s) de menos de ${PISO_SEG}s` : '',
  sinArchivo ? `${sinArchivo} sin video local que medir` : '',
].filter(Boolean).join(' · ');
console.log(`  ${pad('transcripciones', 26)}${conTx}/${plan.clases.length}   (${detalle})`);

// ── 4. Un curso NO puede quedar en dos idiomas ──────────────────────────────
//
// El prompt de Gemini pedía traducir al español, hardcodeado, y el primer curso en inglés
// salió con 3 clases traducidas y 22 en inglés. Está arreglado, pero la mezcla no la
// delataba nada: cada archivo por separado se ve perfecto.
const idiomaDe = (txt) => {
  const es = (txt.match(/\b(que|para|pero|porque|entonces|esto|como)\b/gi) ?? []).length;
  const en = (txt.match(/\b(the|and|you|that|with|this|your)\b/gi) ?? []).length;
  return en > es * 1.5 ? 'en' : es > en * 1.5 ? 'es' : '?';
};
const idiomas = new Map();
for (const c of plan.clases) {
  const t = join(dirT, `${c.archivo}.md`);
  if (!existsSync(t)) continue;
  const i = idiomaDe(readFileSync(t, 'utf8'));
  idiomas.set(i, [...(idiomas.get(i) ?? []), c.n]);
}
const dominante = [...idiomas].sort((a, b) => b[1].length - a[1].length)[0];
for (const [i, ns] of idiomas) {
  if (i === dominante?.[0] || i === '?') continue;
  problemas.push(`IDIOMA MEZCLADO: ${ns.length} clase(s) en «${i}» y ${dominante[1].length} en «${dominante[0]}» → n=${ns.slice(0, 8).join(', ')}`);
}
if (dominante) console.log(`  ${pad('idioma', 26)}${dominante[0]} (${dominante[1].length} clases)`);

// ── 5. Recursos: el archivo pesa lo que la plataforma declara ───────────────
// Una descarga cortada deja un archivo que existe, abre, y le falta la mitad.
const idxApi = join(base, 'recursos-api.json');
const dirR = ['pdfs', 'recursos'].map((s) => join(base, s)).find(existsSync);
if (existsSync(idxApi) && dirR) {
  const api = JSON.parse(readFileSync(idxApi, 'utf8'));
  const tam = new Set(api.map((r) => r.file_size).filter(Boolean));
  const enDisco = readdirSync(dirR).filter((f) => !f.startsWith('.'));
  const huerfanos = enDisco.filter((f) => !tam.has(statSync(join(dirR, f)).size));
  console.log(`  ${pad('recursos', 26)}${enDisco.length}/${api.length}   (${enDisco.length - huerfanos.length} con el peso exacto que declara la API)`);
  if (enDisco.length < api.length) problemas.push(`RECURSOS: la API declara ${api.length} y en disco hay ${enDisco.length}`);
  if (huerfanos.length) avisos.push(`${huerfanos.length} recurso(s) con un peso que la API no declara (¿descarga cortada?): ${huerfanos.slice(0, 4).join(', ')}`);
}

// ── Veredicto ───────────────────────────────────────────────────────────────
console.log();
if (avisos.length) { console.log('  ── avisos ──'); for (const a of avisos) console.log(`  ·  ${a}`); console.log(); }
if (!problemas.length) {
  console.log('  ✓ TODO BIEN. El curso se puede publicar.\n');
  process.exit(0);
}
console.log(`  ✖ ${problemas.length} PROBLEMA(S) — NO publiques todavía:\n`);
for (const p of problemas.slice(0, 40)) console.log(`     ${p}`);
if (problemas.length > 40) console.log(`     … y ${problemas.length - 40} más`);
console.log();
process.exit(1);
