// =============================================================================
// EL VIDEO DE BIENVENIDA, CORTADO (19/11/2026)
// =============================================================================
// Martín, probando el onboarding V2 en producción: «el video del principio… debería tener cortes como los pasos». El Cerebro: «corta
// el de 38 s donde termina la bienvenida»: la bienvenida va al principio del chat y lo del WhatsApp es su propio video, en el mensaje
// de ese paso. La bienvenida NO se regenera: se corta el 1080p APROBADO (la voz y las pantallas de cerca, 8eebb1d25) en el cambio de
// escena entre «…debajo de este video.» (última palabra hasta 18,98 s) y «Una de ellas es tu WhatsApp» (desde 19,62 s): 19,54 s,
// donde empieza el beat del paso 5 en trabajo/onboarding-bienvenida/beats.js. La voz se apaga en los últimos 0,25 s.
// El del WhatsApp ya no sale de acá: suelto, «Una de ellas es tu WhatsApp» no se entendía, y pasó a ser su propio guion
// (`onboarding-bienvenida-whatsapp` en guiones.json) con la primera frase nueva y la voz aprobada en el resto: frase-nueva.mjs.
// El unido (con las pantallas) lo escribe montar.mjs en OneDrive como onboarding-bienvenida.unido.mp4, y de ahí se corta; el que
// Martín aprobó antes del corte quedó como onboarding-bienvenida.unido-aprobado-19-11.mp4. La versión web (720p ≤ 1,5 MB) y la
// línea del manifiesto, como las arma motor/hacer.mjs (su paso «web»); el póster no cambia (el gancho, del principio).
//   node pantallas-onboarding/cortar.mjs
// =============================================================================
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const RAIZ = 'C:/dev/tutoriales-video';
const VIDEOS = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/videos';
const MANIFIESTO = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/manifiesto.json';
const PUBLICO = `${RAIZ}/public-tutoriales`;
const MANIFIESTO_PUB = `${PUBLICO}/manifiesto.json`;
const ID = 'onboarding-bienvenida';
const CORTE = 19.54;

const unido = `${VIDEOS}/${ID}.unido.mp4`;
if (!existsSync(unido)) throw new Error(`falta ${unido}: lo escribe pantallas-onboarding/montar.mjs`);
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// 1080p (OneDrive), recodificado para que el corte caiga en el cuadro exacto.
ff(['-i', unido, '-t', String(CORTE), '-af', `afade=t=out:st=${(CORTE - 0.25).toFixed(2)}:d=0.25`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', `${VIDEOS}/${ID}.mp4`]);

// 720p (la app), como hacer.mjs: se sube el CRF hasta que entra en 1,5 MB.
const w = `${PUBLICO}/${ID}.mp4`;
let crf = 23, peso = 0;
for (; crf <= 37; crf += 2) {
  ff(['-i', `${VIDEOS}/${ID}.mp4`, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', w]);
  peso = statSync(w).size; if (peso <= 1.5 * 1024 * 1024) break;
}

// El manifiesto: la línea de la bienvenida, con las 4 primeras frases del unido. La línea del unido (8 frases) se guarda aparte la
// primera vez: volver a correr esto corta de nuevo desde ella.
const GUARDADA = `${RAIZ}/pantallas-onboarding/unido-manifiesto.json`;
const man = JSON.parse(readFileSync(MANIFIESTO_PUB, 'utf8'));
if (!existsSync(GUARDADA)) {
  const v = man.videos.find((x) => x.key === ID);
  if (!v || v.frases.length !== 8) throw new Error('el manifiesto no tiene el unido de 8 frases, y no hay línea guardada');
  writeFileSync(GUARDADA, JSON.stringify(v, null, 1));
}
const base = JSON.parse(readFileSync(GUARDADA, 'utf8'));
const r2 = (n) => Math.round(n * 100) / 100;
const fA = base.frases.slice(0, 4).map((f) => ({ ...f }));
const A = { ...base, duracion_s: r2(dur(`${VIDEOS}/${ID}.mp4`)), peso_kb: Math.round(peso / 1024), guion: fA.map((f) => f.texto).join(' '), frases: fA, hecho: new Date().toISOString() };
man.videos = man.videos.map((v) => (v.key === ID ? A : v));
writeFileSync(MANIFIESTO_PUB, JSON.stringify(man, null, 1));
copyFileSync(MANIFIESTO_PUB, MANIFIESTO);
console.log(`bienvenida: ${A.duracion_s} s · ${A.peso_kb} KB (crf ${crf})`);
