// Planifica los cortes de un anuncio: se queda solo con los tramos donde HAY voz,
// dejando una respiracion fija entre frase y frase. Todo silencio mas largo que eso
// se va, sea cabeza, cola o hueco interno.
//
// El corte cae dentro de una toma, asi que produce jump cuts: en vertical publicitario
// eso es el estilo, no un defecto.
//
// uso: node plan-cortes.mjs <dir con sts-N.mp3> <ntomas> <dur del clip de video> [aire]
// salida: JSON del plan por stdout (+ informe legible por stderr)
import { spawnSync } from 'node:child_process';

const DIR = process.argv[2], N = +process.argv[3], DURVID = +process.argv[4];
const AIRE = +(process.argv[5] || 0.11);   // se conserva a cada lado -> hueco final ~2*AIRE
const UMBRAL = '-38dB', MINSIL = 0.20;
const MINSEG = 0.35;                        // un tramo mas corto que esto seria un parpadeo
const MINHUECO = 0.30;                      // por debajo de esto el corte no paga su jump cut

const log = (s) => process.stderr.write(s + '\n');

const segs = [];
let durOriginal = 0;
for (let i = 1; i <= N; i++) {
  const f = `${DIR}/sts-${i}.mp3`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af',
    `silencedetect=n=${UMBRAL}:d=${MINSIL}`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  const txt = (r.stdout || '') + (r.stderr || '');      // silencedetect va a STDERR
  const durAud = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
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

  // complemento: los tramos CON voz
  let voz = [], t = 0;
  for (const [a, b] of sil) { if (a > t) voz.push([t, a]); t = Math.max(t, b); }
  if (t < TOPE) voz.push([t, TOPE]);

  // respiracion a cada lado, sin salirse del clip
  voz = voz.map(([a, b]) => [Math.max(0, a - AIRE), Math.min(TOPE, b + AIRE)]);

  // Fusionar lo pegado, lo solapado Y lo que quedaria separado por menos de MINHUECO.
  // Un corte que solo ahorra dos decimas no vale su jump cut: mete un parpadeo para
  // ganar nada. Solo se corta cuando el hueco justifica el salto visual.
  const fus = [];
  for (const s of voz) {
    if (fus.length && s[0] <= fus[fus.length - 1][1] + MINHUECO) fus[fus.length - 1][1] = Math.max(fus[fus.length - 1][1], s[1]);
    else fus.push([...s]);
  }
  const buenos = fus.filter(([a, b]) => b - a >= MINSEG);

  const usado = buenos.reduce((s, [a, b]) => s + (b - a), 0);
  log(`toma ${i}: ${buenos.length} tramo(s), ${usado.toFixed(2)}s de ${DURVID}s ` +
      `(se van ${(DURVID - usado).toFixed(2)}s)  ` + buenos.map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}`).join(' | '));
  for (const [a, b] of buenos) segs.push({ toma: i, ini: +a.toFixed(3), fin: +b.toFixed(3) });
}

const total = segs.reduce((s, x) => s + (x.fin - x.ini), 0);
log(`\n${segs.length} tramos | ${durOriginal.toFixed(2)}s -> ${total.toFixed(2)}s ` +
    `(se van ${(durOriginal - total).toFixed(2)}s, ${(100 * (durOriginal - total) / durOriginal).toFixed(0)}%)`);
process.stdout.write(JSON.stringify({ total: +total.toFixed(3), segs }));
