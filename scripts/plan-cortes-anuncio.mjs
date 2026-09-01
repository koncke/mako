// Planifica los cortes de un anuncio: se queda solo con los tramos donde HAY VOZ.
//
// LA TRAMPA que costo dos entregas: un umbral FIJO de silencio no sirve. El piso de
// ruido cambia por toma (medido: de -39 dB a -84 dB en el mismo anuncio, porque el
// locutor va en un auto). Con -38 dB fijo, las tomas ruidosas no tienen NI UN silencio
// detectable: sus pausas estan llenas de ruido de motor, no de silencio digital. Se
// corta el silencio digital, se deja intacto el perceptual, y el anuncio sigue igual
// de lento. El umbral tiene que salir del nivel de CADA toma.
//
// uso: node plan-cortes.mjs <dir sts-N.mp3> <ntomas> <durvid> [aire] [minhueco] [minseg] [minsil] [delta]
import { spawnSync } from 'node:child_process';

const DIR = process.argv[2], N = +process.argv[3], DURVID = +process.argv[4];
const AIRE     = +(process.argv[5] ?? 0.05);   // respiracion a cada lado -> hueco final 2*AIRE
const MINHUECO = +(process.argv[6] ?? 0.14);   // por debajo, el corte no paga su jump cut
const MINSEG   = +(process.argv[7] ?? 0.25);   // un tramo mas corto seria un parpadeo
const MINSIL   = +(process.argv[8] ?? 0.10);   // silencio mas corto que esto ni se mira
const DELTA    = +(process.argv[9] ?? 13);     // umbral = RMS de la toma - DELTA
const TOPE_U = -26, PISO_U = -45;              // el umbral adaptativo se acota aca

const log = (s) => process.stderr.write(s + '\n');
const ff = (a) => { const r = spawnSync('ffmpeg', a, { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stdout || '') + (r.stderr || ''); };

const segs = [];
let durOriginal = 0, silCortado = 0;
for (let i = 1; i <= N; i++) {
  const f = `${DIR}/sts-${i}.mp3`;

  // umbral propio de esta toma, derivado de su nivel real
  const st = ff(['-hide_banner', '-i', f, '-af', 'astats', '-f', 'null', '-']);
  const rms = +(st.match(/RMS level dB:\s*(-?[\d.]+)/) || [])[1];
  let U = rms - DELTA;
  U = Math.min(TOPE_U, Math.max(PISO_U, U));

  const txt = ff(['-hide_banner', '-i', f, '-af', `silencedetect=n=${U.toFixed(1)}dB:d=${MINSIL}`, '-f', 'null', '-']);
  const durAud = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
  const TOPE = Math.min(DURVID, durAud);
  durOriginal += DURVID;

  const sil = [];
  const re = /silence_start:\s*(-?[\d.]+)|silence_end:\s*([\d.]+)/g;
  let m, cur = null;
  while ((m = re.exec(txt))) {
    if (m[1] !== undefined) cur = Math.max(0, +m[1]);
    else if (cur !== null) { sil.push([cur, +m[2]]); cur = null; }
  }
  if (cur !== null) sil.push([cur, TOPE]);

  let voz = [], t = 0;
  for (const [a, b] of sil) { if (a > t) voz.push([t, a]); t = Math.max(t, b); }
  if (t < TOPE) voz.push([t, TOPE]);

  voz = voz.map(([a, b]) => [Math.max(0, a - AIRE), Math.min(TOPE, b + AIRE)]);

  const fus = [];
  for (const s of voz) {
    if (fus.length && s[0] <= fus[fus.length - 1][1] + MINHUECO) fus[fus.length - 1][1] = Math.max(fus[fus.length - 1][1], s[1]);
    else fus.push([...s]);
  }
  const buenos = fus.filter(([a, b]) => b - a >= MINSEG);

  const usado = buenos.reduce((s, [a, b]) => s + (b - a), 0);
  silCortado += DURVID - usado;
  log(`toma ${i}: RMS ${rms.toFixed(1)} -> umbral ${U.toFixed(1)}dB | ${buenos.length} tramo(s), ` +
      `${usado.toFixed(2)}s (se van ${(DURVID - usado).toFixed(2)}s)`);
  for (const [a, b] of buenos) segs.push({ toma: i, ini: +a.toFixed(3), fin: +b.toFixed(3) });
}

const total = segs.reduce((s, x) => s + (x.fin - x.ini), 0);
log(`\n${segs.length} tramos | ${durOriginal.toFixed(2)}s -> ${total.toFixed(2)}s ` +
    `(se van ${silCortado.toFixed(2)}s, ${(100 * silCortado / durOriginal).toFixed(0)}%)`);
process.stdout.write(JSON.stringify({ total: +total.toFixed(3), segs }));
