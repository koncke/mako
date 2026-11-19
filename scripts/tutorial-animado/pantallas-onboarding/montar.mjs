// Monta las 5 pantallas del WhatsApp (s1…s5.png, de pantallas-whatsapp.html) sobre el video de bienvenida de 1080p, cada una en el
// segundo de su frase (los tiempos de la voz: trabajo/onboarding-bienvenida/alin.json), con un fundido corto. Deja el original al
// lado (.sin-pantallas.mp4) y escribe el montado en su lugar; después `node motor/hacer.mjs onboarding-bienvenida web` rehace el 720p.
//   node pantallas-onboarding/montar.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const VIDEO = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/videos/onboarding-bienvenida.mp4';
const ORIGINAL = VIDEO.replace(/\.mp4$/, '.sin-pantallas.mp4');
const ALIN = 'C:/dev/tutoriales-video/trabajo/onboarding-bienvenida/alin.json';

// Las palabras de la voz, en orden, y dónde arranca cada frase que va en pantalla.
const W = JSON.parse(readFileSync(ALIN, 'utf8')).words.filter((w) => w.type !== 'spacing' && String(w.text).trim());
const limpia = (t) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function inicio(frase, desde = 0) {
  const ps = frase.split(' ').map(limpia);
  for (let i = desde; i + ps.length <= W.length; i++) if (ps.every((p, k) => limpia(W[i + k].text) === p)) return { t: W[i].start, i };
  throw new Error('no encuentro «' + frase + '» en la voz');
}
const a = inicio('Para confirmarlo, toca Abrir WhatsApp');
const b = inicio('y manda el mensaje', a.i);
const c = inicio('Máko te contesta con un código', b.i);
const d = inicio('y lo pegas en el chat', c.i);
const e = inicio('Y guarda el contacto', d.i);
const f = inicio('así esos avances', e.i);
const ANTES = 0.08;   // la pantalla entra un pelo antes que la palabra (como el texto del motor: LEAD = 80 ms)
const tramos = [[a.t, b.t], [b.t, c.t], [c.t, d.t], [d.t, e.t], [e.t, f.t]].map(([s, x]) => [Math.max(0, s - ANTES), x - ANTES]);
console.log('tramos:', tramos.map(([s, x], k) => `s${k + 1} ${s.toFixed(2)}–${x.toFixed(2)}`).join(' · '));

if (!existsSync(ORIGINAL)) copyFileSync(VIDEO, ORIGINAL);
const FUNDE = 0.18;
const ins = ['-y', '-i', ORIGINAL];
for (let k = 1; k <= 5; k++) ins.push('-loop', '1', '-t', '60', '-i', path.join(AQUI, `s${k}.png`));
let filtro = '', ant = '0:v';
tramos.forEach(([s, x], k) => {
  filtro += `[${k + 1}:v]format=rgba,fade=t=in:st=${s.toFixed(3)}:d=${FUNDE}:alpha=1,fade=t=out:st=${(x - FUNDE).toFixed(3)}:d=${FUNDE}:alpha=1[p${k}];`;
  filtro += `[${ant}][p${k}]overlay=0:0:enable='between(t,${s.toFixed(3)},${x.toFixed(3)})'${k < tramos.length - 1 ? `[v${k}];` : '[vout]'}`;
  ant = `v${k}`;
});
const tmp = VIDEO.replace(/\.mp4$/, '.montando.mp4');
execFileSync('ffmpeg', [...ins, '-filter_complex', filtro, '-map', '[vout]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
renameSync(tmp, VIDEO);
console.log('listo:', VIDEO, '(el de antes, en', ORIGINAL + ')');
