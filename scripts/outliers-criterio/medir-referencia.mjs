// Mide un reel de referencia como en el proceso de los pistachos: duración, tomas (ffmpeg scene), y una hoja de cuadros con su
// segundo (cada 1 s) para leer el texto en pantalla y la edición.
// Uso: en la carpeta donde está <código>.mp4 → node medir-referencia.mjs <código>
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
const c = process.argv[2];
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${c}.mp4`], { encoding: 'utf8' }).trim());
const wh = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', `${c}.mp4`], { encoding: 'utf8' }).trim();
// ⚠️ `showinfo` escribe en STDERR: con execFileSync (devuelve stdout) daba 0 cortes en las tres referencias (11/11/2026).
const escena = spawnSync('ffmpeg', ['-hide_banner', '-i', `${c}.mp4`, '-vf', "select='gt(scene,0.28)',showinfo", '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64e6 });
const cortes = [...escena.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1]);
// Hoja: un cuadro por segundo, con su segundo escrito.
const dir = `cuadros-${c}`;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
const FUENTE = 'C\\:/Windows/Fonts/arialbd.ttf';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${c}.mp4`, '-vf', `fps=1,scale=240:-2,drawtext=fontfile='${FUENTE}':text='%{eif\\:t\\:d}s':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7`, `${dir}/f%03d.jpg`]);
const n = Math.ceil(dur);
const cols = 8, filas = Math.ceil(n / cols);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', `${dir}/f%03d.jpg`, '-vf', `tile=${cols}x${filas}:padding=4:color=0x111111`, '-frames:v', '1', `hoja-${c}.jpg`]);
const r = { codigo: c, duracion: +dur.toFixed(2), video: wh, tomas: cortes.length + 1, cortes: cortes.map((x) => +x.toFixed(2)), tomaMediaS: +(dur / (cortes.length + 1)).toFixed(2) };
writeFileSync(`medida-${c}.json`, JSON.stringify(r, null, 1));
console.log(JSON.stringify(r));
