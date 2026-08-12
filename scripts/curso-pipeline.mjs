// Corre la cola audio -> transcripción hasta terminar el curso, mientras la
// descarga sigue en vuelo.
//
// Existe porque «ir transcribiendo a medida que bajan» a mano son N idas y vueltas,
// y las dos etapas ya son idempotentes y reanudables: correrlas en loop es todo lo
// que hace falta. El filtro de curso-audio.mjs es lo que hace esto seguro — no
// toca un video a medio bajar (ver docs/hallazgos-conocimiento.md).
//
// Termina cuando todas las clases del plan tienen su .md, o cuando pasa el tope de
// horas, o cuando se queda sin progreso N rondas seguidas (la descarga murió).
//
//   node <abs>\scripts\curso-pipeline.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-pipeline.mjs --plan … --paralelo 4 --tope-horas 14

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PLAN = arg('plan', '');
const PARALELO = arg('paralelo', '3');
const TOPE_H = Number(arg('tope-horas', 12));
const PAUSA_S = Number(arg('pausa', 90));
const SIN_PROGRESO_MAX = Number(arg('rondas-secas', 8)); // 8 × 90s = 12 min quieto

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
const SCRIPTS = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));

const total = plan.clases.length;
const cuenta = (sub, filtro) => {
  const d = join(base, sub);
  if (!existsSync(d)) return 0;
  return readdirSync(d).filter(filtro).length;
};
const bajados = () => cuenta('video', (f) => /\.mp4$/i.test(f) && !/\.f[^.]*\.mp4$/i.test(f));
const audios = () => cuenta('audio', (f) => /\.m4a$/i.test(f));
const textos = () => cuenta('texto', (f) => f.endsWith('.md') && f !== '_indice.md');

const correr = (script, args) => {
  const p = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8' });
  const out = `${p.stdout ?? ''}${p.stderr ?? ''}`;
  // Solo la última línea útil: el log de una corrida de 12 h tiene que ser legible.
  const resumen = out.split('\n').map((l) => l.trim()).filter((l) => /convertido|transcripta|fallad|✖/.test(l)).slice(-2);
  return { code: p.status, resumen };
};

const hasta = Date.now() + TOPE_H * 3600000;
let secas = 0, ronda = 0;
const hora = () => new Date(Date.now()).toISOString().slice(11, 19);

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${total} · paralelo ${PARALELO} · tope ${TOPE_H} h\n`);

while (Date.now() < hasta) {
  ronda++;
  const antes = textos();

  const a = correr('curso-audio.mjs', ['--plan', PLAN, '--de', join(base, 'video'), '--a', join(base, 'audio')]);
  const t = audios() > textos()
    ? correr('curso-transcribir-sa.mjs', ['--plan', PLAN, '--paralelo', PARALELO])
    : { code: 0, resumen: ['(nada nuevo para transcribir)'] };

  const ahora = textos();
  console.log(`  [${hora()}] ronda ${ronda}: video ${bajados()}/${total} · audio ${audios()} · texto ${ahora}/${total}`);
  for (const l of [...a.resumen, ...t.resumen]) if (l) console.log(`             ${l}`);

  if (ahora >= total) { console.log(`\n  ✓ COMPLETO: ${ahora}/${total} clases transcriptas.\n`); process.exit(0); }

  secas = ahora > antes ? 0 : secas + 1;
  if (secas >= SIN_PROGRESO_MAX && bajados() >= total) {
    console.log(`\n  ⚠ Sin progreso ${secas} rondas y la descarga ya terminó (${bajados()}/${total}).`);
    console.log(`    Quedan ${total - ahora} clase(s) sin transcribir. Mirá los errores de arriba.\n`);
    process.exit(3);
  }
  if (secas >= SIN_PROGRESO_MAX * 2) {
    console.log(`\n  ⚠ Sin progreso ${secas} rondas y la descarga sigue en ${bajados()}/${total}.`);
    console.log(`    Probablemente el descargador murió. Reanudalo con curso-bajar.mjs.\n`);
    process.exit(3);
  }

  await new Promise((r) => setTimeout(r, PAUSA_S * 1000));
}

console.log(`\n  ⏱ Tope de ${TOPE_H} h alcanzado. Texto ${textos()}/${total}. Volvé a correr para seguir.\n`);
process.exit(2);
