// Saca el audio de las clases que viven SOLO en Drive, para poder transcribirlas.
//
// Por qué existe: un curso fusionado (ver curso-drive-fusionar.mjs) tiene video para
// todas sus clases pero solo bajó localmente las que faltaban. «Vender Por FB E IG
// ADS» quedó con 242 videos y 32 transcripciones: las otras 210 nunca pasaron por el
// pipeline porque ya estaban en Drive desde antes.
//
// No hace falta volver a bajarlas de la plataforma: Drive for Desktop las tiene
// montadas en G:, así que ffmpeg las lee como cualquier archivo local.
//
// ⚠️ El audio se nombra con la convención del PLAN (`NNN - Título.m4a`) y no con el
// nombre que tiene en Drive. El transcriptor deduce el número de clase del nombre
// del archivo, y los de Drive usan la numeración de su carpeta: hay cuatro «1.
// Presentación» y nueve «Introducción al Módulo», así que todos caerían en la clase
// equivocada. La correspondencia sale de `rel` + `archivo` de drive.json.
//
//   node <abs>\scripts\curso-audio-desde-drive.mjs --plan C:\cursos\<slug>\plan.json
//   …--paralelo 4 (por defecto 3) · --kbps 32

import { readFileSync, existsSync, mkdirSync, statSync, renameSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
const KBPS = Number(arg('kbps', 32));
const PARALELO = Math.max(1, Math.min(6, Number(arg('paralelo', 3))));
const FFMPEG = arg('ffmpeg', join(process.env.LOCALAPPDATA ?? '', 'ffmpeg-full\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe'));

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
if (!existsSync(FFMPEG)) { console.error(`\n  ✖ No encuentro ffmpeg en:\n    ${FFMPEG}\n    Pasalo con --ffmpeg <ruta>.\n`); process.exit(1); }

const base = dirname(PLAN);
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\uFEFF/, ''));
const driveJson = join(base, 'drive.json');
if (!existsSync(driveJson)) { console.error('\n  ✖ Falta drive.json. Corré antes curso-drive-fusionar.mjs.\n'); process.exit(1); }
const drive = JSON.parse(readFileSync(driveJson, 'utf8').replace(/^\uFEFF/, ''));
if (!drive.clases?.some((c) => c.rel !== undefined)) {
  console.error('\n  ✖ drive.json no trae `rel`. Volvé a correr curso-drive-fusionar.mjs.\n');
  process.exit(1);
}

const dirAudio = join(base, 'audio');
const dirTexto = join(base, 'texto');
mkdirSync(dirAudio, { recursive: true });

// Qué clases YA tienen transcripción: se camina un nivel de subcarpetas porque
// curso-organizar.mjs puede haber movido los .md a «<NN Módulo>/».
const conTexto = new Set();
const juntarMd = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) juntarMd(join(dir, e.name));
    else if (e.name.endsWith('.md')) conTexto.add(e.name.replace(/\.md$/, ''));
  }
};
juntarMd(dirTexto);

const porN = new Map(drive.clases.map((c) => [c.n, c]));
const pendientes = [];
for (const c of plan.clases) {
  if (conTexto.has(c.archivo)) continue;
  const salida = join(dirAudio, `${c.archivo}.m4a`);
  if (existsSync(salida)) continue;              // ya se extrajo en otra corrida
  const d = porN.get(c.n);
  if (!d) continue;
  const src = join(drive.carpeta, d.rel ?? '', d.archivo);
  if (!existsSync(src)) { console.log(`  ✖ n=${c.n} no está en Drive: ${d.archivo}`); continue; }
  pendientes.push({ c, src, salida });
}

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${plan.clases.length} · con texto: ${plan.clases.filter((c) => conTexto.has(c.archivo)).length} · a extraer: ${pendientes.length}\n`);
if (!pendientes.length) { console.log('  Nada que hacer.\n'); process.exit(0); }

// ⚠️ Escritura atómica: se convierte a un `.parcial` y recién se renombra si el
// resultado DECODIFICA. Un ffmpeg interrumpido deja un .m4a que existe y está roto
// («moov atom not found»), y el paso siguiente lo da por bueno porque el archivo
// está. Ya pasó: «existe» no es «está bien».
/**
 * ⚠️ `Promise.all` SOBRE `spawnSync` NO PARALELIZA NADA.
 *
 * `spawnSync` bloquea el unico hilo de node hasta que el proceso termina, asi que
 * envolverlo en promesas las encola: se ejecutan una despues de otra y el `--paralelo 3`
 * queda decorativo. No falla ni avisa — simplemente tarda tres veces mas.
 *
 * Medido el 02/09/2026 sobre «Growing Content Specialist»: 20 clases de ~1 hora en 3
 * horas, o sea 9 min cada una, con UN solo ffmpeg vivo y la CPU al 37% de 12 nucleos.
 * Con 600 clases por delante eso eran dias.
 *
 * Va con `spawn` asincronico, que es lo que de verdad deja correr N a la vez. Y aca el
 * paralelo importa el doble: cada lectura viene de G:, que es un filesystem de red — la
 * mayor parte del tiempo de una extraccion es ESPERAR bytes, no procesarlos.
 */
const correr = (args, maxBuffer = 1 << 26) => new Promise((res) => {
  const p = spawn(FFMPEG, args, { windowsHide: true });
  let err = '';
  // El stderr se lee SIEMPRE: si nadie lo consume y llena el buffer del pipe, el proceso
  // se cuelga esperando poder escribir. Con `spawnSync` eso lo resolvia node; con `spawn`
  // es responsabilidad de quien lo llama.
  p.stderr.on('data', (d) => { if (err.length < maxBuffer) err += d; });
  p.on('error', (e) => res({ status: -1, stderr: String(e.message) }));
  p.on('close', (status) => res({ status, stderr: err }));
});

const extraer = async ({ c, src, salida }) => {
  const parcial = `${salida}.parcial`;
  const r = await correr([
    '-v', 'error', '-y', '-i', src,
    // ⚠️ `-map 0:a:0` en vez de `-vn`: los dos sacan el video, pero `-vn` lo descarta en la
    //    SALIDA y ffmpeg igual arma el grafo con el stream de video adentro. Mapear solo el
    //    audio le dice que ni lo mire. Medido sobre una clase de 466 MB: 8 s contra 4 s.
    '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', `${KBPS}k`,
    '-f', 'mp4', parcial,
  ]);
  if (r.status !== 0 || !existsSync(parcial)) {
    try { unlinkSync(parcial); } catch { /* no estaba */ }
    return { c, err: (r.stderr || '').trim().split('\n').slice(-2).join(' ') || `ffmpeg salió ${r.status}` };
  }
  const chk = await correr(['-v', 'error', '-i', parcial, '-f', 'null', '-'], 1 << 24);
  if (chk.status !== 0) {
    try { unlinkSync(parcial); } catch { /* nada */ }
    return { c, err: 'el audio no decodifica' };
  }
  renameSync(parcial, salida);
  return { c, mb: statSync(salida).size / 1048576 };
};

let ok = 0;
const fallos = [];
// ffmpeg ya usa varios hilos por archivo; el paralelo acá es para no dejar la CPU
// esperando la lectura de G:, que es un filesystem de red y tiene latencia.
for (let i = 0; i < pendientes.length; i += PARALELO) {
  const lote = pendientes.slice(i, i + PARALELO);
  const res = await Promise.all(lote.map((p) => extraer(p)));
  for (const r of res) {
    if (r.err) { fallos.push(r); console.log(`  ✖ ${r.c.archivo} — ${r.err}`); }
    else { ok++; console.log(`  ✓ ${r.c.archivo}  (${r.mb.toFixed(1)} MB)`); }
  }
  if ((i + PARALELO) % 30 < PARALELO) console.log(`     … ${ok}/${pendientes.length}`);
}

console.log(`\n  ${ok}/${pendientes.length} audio(s)${fallos.length ? ` · ✖ ${fallos.length} fallaron` : ''}`);
console.log(`  → ${dirAudio}\n`);
console.log('  Siguiente: node scripts/curso-transcribir-sa.mjs --plan "' + PLAN + '"\n');
process.exit(fallos.length && !ok ? 1 : 0);
