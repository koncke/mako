// Render a batch, one at a time (each render is a Chromium; the PC has 16 GB and other chats), and leave what to LOOK at:
//   node motor/renders.mjs <id>…
// For each: `hacer.mjs <id> video` (1080p to OneDrive, 720p ≤ 1,5 MB + poster + its line in the manifest), the occlusion verdict
// render2 measures frame by frame, and a contact sheet of the 720p — one frame every 2 s — in trabajo/<id>/hoja-video.jpg.
// Writes trabajo/_renders.log.
import { appendFileSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
const RAIZ = 'C:/dev/tutoriales-video';
const LOG = `${RAIZ}/trabajo/_renders.log`;
appendFileSync(LOG, `# renders ${new Date().toISOString()} · ${process.argv.slice(2).join(' ')}\n`);
for (const id of process.argv.slice(2)) {
  const t0 = Date.now();
  // the covered-letters rule is measured only in render2's frames mode (every 100 ms of every big screen): one pass before the video
  const m = spawnSync('node', [`${RAIZ}/motor/render2.cjs`, `${RAIZ}/trabajo/${id}`, '-', '1000'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const tapa = /TAPA DE MÁS[^\n]*/.exec((m.stdout || '') + (m.stderr || ''));
  const r = spawnSync('node', [`${RAIZ}/motor/hacer.mjs`, id, 'video'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const video = (out.match(/video: ([^\n]*)/) || [])[1] || '';
  const noDice = /la voz NO dice/.test(out);
  let hoja = '';
  const web = `${RAIZ}/public-tutoriales/${id}.mp4`;
  if (r.status === 0 && existsSync(web)) {
    hoja = `${RAIZ}/trabajo/${id}/hoja-video.jpg`;
    // one frame every 2 s for the WHOLE video (19/11: a fixed 4x5 tile is 40 s, and the reto days are 60-95 s: half went unseen)
    const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', web], { encoding: 'utf8' }).trim();
    const filas = Math.max(5, Math.ceil(dur / 2 / 4));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', web, '-vf', `fps=1/2,scale=480:270,tile=4x${filas}:color=white`, '-frames:v', '1', hoja]);
  }
  const linea = `${id}: ${r.status === 0 ? '✅' : '❌ falló'} ${video} · ${tapa ? '⚠️ ' + tapa[0] : 'tapado ok'}${noDice ? ' · ⚠️ la voz no dice el guion' : ''} · ${Math.round((Date.now() - t0) / 1000)} s${r.status !== 0 ? ' · ' + out.trim().split('\n').slice(-2).join(' | ').slice(0, 200) : ''}`;
  appendFileSync(LOG, linea + '\n'); console.log(linea);
}
