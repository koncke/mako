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

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { esIntermedio } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PLAN = arg('plan', '');
const PARALELO = arg('paralelo', '3');
const TOPE_H = Number(arg('tope-horas', 12));
const PAUSA_S = Number(arg('pausa', 90));
const SIN_PROGRESO_MAX = Number(arg('rondas-secas', 8)); // 8 × 90s = 12 min quieto
const DRIVE = process.argv.includes('--drive');           // copiar a Drive cada ronda

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
// Ver la nota del BOM en curso-bajar.mjs: PowerShell 5.1 lo mete y JSON.parse muere.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const SCRIPTS = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));

const total = plan.clases.length;
const cuenta = (sub, filtro) => {
  const d = join(base, sub);
  if (!existsSync(d)) return 0;
  return readdirSync(d).filter(filtro).length;
};
// ⚠️ QUÉ ES UN INTERMEDIO LO DECIDE `esIntermedio`, NO UN REGEX PROPIO.
// Acá había una copia (`!/\.f[^.]*\.mp4$/`) que no conocía el `.temp.mp4` —el archivo
// donde yt-dlp UNE video y audio cuando la calidad alta viene en pistas separadas—, así
// que el temporal del merge se contaba como clase lista. Medido en «Trilogía de BRIAN
// TRACY»: la clase 11 son 4,6 GB + 955 MB, y mientras ffmpeg los unía el contador dio
// 11/11 → el pipeline anunció «la descarga ya terminó» y se fue, dejando esa clase sin
// audio y sin transcribir, con el merge escribiendo a 253 MB cada 15 s.
// Es la MISMA trampa que la nota de abajo, en la otra punta: allá un contador quieto se
// leyó como «el descargador murió»; acá uno de más se leyó como «ya terminó».
const bajados = () => cuenta('video', (f) => /\.mp4$/i.test(f) && !esIntermedio(f));
// ⚠️ Los BYTES de video/, intermedios incluidos. Es la única señal honesta de que el
// descargador sigue vivo: contar archivos TERMINADOS no sirve porque una sola clase
// grande puede tardar más que toda la ventana de vigilancia. Pasó con «100M money
// Models»: la clase 34 son 2429 fragmentos, el contador no se movió en 16 rondas y el
// pipeline se cortó solo anunciando «probablemente el descargador murió» — con el
// descargador escribiendo a pleno. Un `.part` que engorda es un proceso sano.
const bytesVideo = () => {
  const d = join(base, 'video');
  if (!existsSync(d)) return 0;
  let t = 0;
  for (const f of readdirSync(d)) { try { t += statSync(join(d, f)).size; } catch { /* se lo llevaron entre el listado y el stat */ } }
  return t;
};
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
let secas = 0, ronda = 0, bytesPrevios = 0;
// Hora LOCAL, no UTC. Con toISOString() el log marcaba 3 h menos que todo lo demás
// que se mira (procesos, archivos), y un hueco por la máquina dormida se leyó como
// «la descarga se colgó». Ver docs/hallazgos-conocimiento.md.
const hora = () => new Date(Date.now()).toLocaleTimeString('es-AR', { hour12: false });

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${total} · paralelo ${PARALELO} · tope ${TOPE_H} h\n`);

while (Date.now() < hasta) {
  ronda++;
  const antes = textos();

  const a = correr('curso-audio.mjs', ['--plan', PLAN, '--de', join(base, 'video'), '--a', join(base, 'audio')]);
  const t = audios() > textos()
    ? correr('curso-transcribir-sa.mjs', ['--plan', PLAN, '--paralelo', PARALELO])
    : { code: 0, resumen: ['(nada nuevo para transcribir)'] };
  // --drive: ir copiando a Drive en cada ronda, sin esperar los ids. Aprovecha que
  // subida y descarga usan capacidades distintas en una conexión asimétrica, así
  // que no se pelean. Los ids se resuelven al final, en una sola pasada.
  const g = DRIVE
    ? correr('curso-a-drive.mjs', ['--plan', PLAN, '--solo-copiar'])
    : { code: 0, resumen: [] };

  const ahora = textos();
  console.log(`  [${hora()}] ronda ${ronda}: video ${bajados()}/${total} · audio ${audios()} · texto ${ahora}/${total}`);
  for (const l of [...a.resumen, ...t.resumen, ...g.resumen]) if (l) console.log(`             ${l}`);

  if (ahora >= total) { console.log(`\n  ✓ COMPLETO: ${ahora}/${total} clases transcriptas.\n`); process.exit(0); }

  secas = ahora > antes ? 0 : secas + 1;
  if (secas >= SIN_PROGRESO_MAX && bajados() >= total) {
    console.log(`\n  ⚠ Sin progreso ${secas} rondas y la descarga ya terminó (${bajados()}/${total}).`);
    console.log(`    Quedan ${total - ahora} clase(s) sin transcribir. Mirá los errores de arriba.\n`);
    process.exit(3);
  }
  if (secas >= SIN_PROGRESO_MAX * 2) {
    // Antes de declararlo muerto: ¿engordó video/ desde la ronda anterior? Si sí,
    // está bajando una clase larga y hay que esperarla, no cortar.
    const bytesAhora = bytesVideo();
    if (bytesAhora > bytesPrevios) {
      console.log(`             (descargador VIVO: video/ creció ${((bytesAhora - bytesPrevios) / 1048576).toFixed(0)} MB — sigo esperando)`);
      bytesPrevios = bytesAhora;
      secas = SIN_PROGRESO_MAX; // se le devuelve margen, no se reinicia del todo
    } else {
      console.log(`\n  ⚠ Sin progreso ${secas} rondas, la descarga sigue en ${bajados()}/${total}`);
      console.log(`    y video/ no creció ni un byte. Ahí sí el descargador murió.`);
      console.log(`    Reanudalo con curso-bajar.mjs (el registro es reanudable).\n`);
      process.exit(3);
    }
  }
  bytesPrevios = bytesVideo();

  await new Promise((r) => setTimeout(r, PAUSA_S * 1000));
}

console.log(`\n  ⏱ Tope de ${TOPE_H} h alcanzado. Texto ${textos()}/${total}. Volvé a correr para seguir.\n`);
process.exit(2);
