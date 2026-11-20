// Monta las 5 pantallas del WhatsApp (s1…s5.png, de pantallas-whatsapp.html) sobre un video de 1080p, cada una en el segundo de su
// frase (los tiempos de la voz: trabajo/<id>/alin.json), con un fundido corto. Lee el render sin pantallas (<id>.sin-pantallas.mp4).
//   node pantallas-onboarding/montar.mjs                                → el UNIDO de la bienvenida (.unido.mp4); después cortar.mjs
//   node pantallas-onboarding/montar.mjs onboarding-bienvenida-whatsapp → el del WhatsApp (<id>.mp4); después `hacer.mjs <id> web`
// (19/11: el video se cortó en dos, y el del WhatsApp pasó a ser su propio guion, con su primera frase nueva: frase-nueva.mjs)
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const ID = process.argv[2] || 'onboarding-bienvenida';
const VIDEOS = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/videos';
const VIDEO = ID === 'onboarding-bienvenida' ? `${VIDEOS}/${ID}.unido.mp4` : `${VIDEOS}/${ID}.mp4`;
const ORIGINAL = `${VIDEOS}/${ID}.sin-pantallas.mp4`;
const ALIN = `C:/dev/tutoriales-video/trabajo/${ID}/alin.json`;

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
// La última se queda hasta que la escena del cierre se acomoda: al entrar, la cabeza del personaje pasa por delante del texto durante
// ~0,1 s, y con corte seco se veía (19/11). `QUEDA` cubre eso; la voz ya dijo «así» y nada más.
const QUEDA = 0.10;
const tramos = [[a.t, b.t], [b.t, c.t], [c.t, d.t], [d.t, e.t], [e.t, f.t]].map(([s, x], k, t) => [Math.max(0, s - ANTES), k === t.length - 1 ? x + QUEDA : x - ANTES]);
console.log('tramos:', tramos.map(([s, x], k) => `s${k + 1} ${s.toFixed(2)}–${x.toFixed(2)}`).join(' · '));

if (!existsSync(ORIGINAL)) throw new Error('falta ' + ORIGINAL + ' (el render sin pantallas)');
// CORTE SECO (el Cerebro, 19/11): con el fundido de 0,18 s se veían a la vez el texto de la escena de abajo y la pantalla de cerca.
// Las pantallas son opacas y de cuadro entero: nunca conviven dos textos.
const FUNDE = 0;
const ins = ['-y', '-i', ORIGINAL];
for (let k = 1; k <= 5; k++) ins.push('-loop', '1', '-t', '60', '-i', path.join(AQUI, `s${k}.png`));
let filtro = '', ant = '0:v';
tramos.forEach(([s, x], k) => {
  filtro += FUNDE > 0
    ? `[${k + 1}:v]format=rgba,fade=t=in:st=${s.toFixed(3)}:d=${FUNDE}:alpha=1,fade=t=out:st=${(x - FUNDE).toFixed(3)}:d=${FUNDE}:alpha=1[p${k}];`
    : `[${k + 1}:v]format=rgba[p${k}];`;
  filtro += `[${ant}][p${k}]overlay=0:0:enable='between(t,${s.toFixed(3)},${x.toFixed(3)})'${k < tramos.length - 1 ? `[v${k}];` : '[vout]'}`;
  ant = `v${k}`;
});
const tmp = `${VIDEOS}/${ID}.montando.mp4`;
execFileSync('ffmpeg', [...ins, '-filter_complex', filtro, '-map', '[vout]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
renameSync(tmp, VIDEO);
console.log('listo:', VIDEO, '(el de antes, en', ORIGINAL + ')');
