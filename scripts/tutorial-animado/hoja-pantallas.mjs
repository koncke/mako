// One sheet with only the SCREEN frames (the drawn tab with what is marked) of several tutorials, labelled: that is what can
// go wrong (a selector on the wrong thing, a zoom that cuts it); text frames always come out the same.
//   node motor/hoja-pantallas.mjs <salida.jpg> id1 id2 ...
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [salida, ...ids] = process.argv.slice(2);
const R = 'C:/dev/tutoriales-video/trabajo';
const items = [];
for (const id of ids) {
  const s = readFileSync(`${R}/${id}/beats.js`, 'utf8');
  const beats = JSON.parse(s.slice(s.indexOf('['), s.lastIndexOf(']') + 1));
  const cuadros = readdirSync(`${R}/${id}`).filter((f) => /^cuadro-\d+\.png$/.test(f)).map((f) => +f.match(/\d+/)[0]);
  for (const b of beats.filter((x) => x.type === 'app')) {
    const t = cuadros.find((c) => c >= b.s && c < b.e);
    if (t != null) items.push({ id, f: `${R}/${id}/cuadro-${t}.png`, txt: b.text.slice(0, 60) });
  }
}
const ins = items.flatMap((x) => ['-i', x.f]);
const cols = 3, w = 640, h = 360;
// no drawtext: this ffmpeg has no fontconfig and crashes (0xC0000005) when asked for text; the order is the order of the ids
const pre = items.map((x, k) => `[${k}]scale=${w}:${h}[a${k}]`).join(';');
console.log(items.map((x, k) => `${k + 1}. ${x.id} · ${x.txt}`).join('\n'));
const lay = items.map((_, k) => `${(k % cols) * w}_${Math.floor(k / cols) * h}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', `${pre};${items.map((_, k) => `[a${k}]`).join('')}xstack=inputs=${items.length}:layout=${lay}:fill=white`, salida]);
console.log(salida, items.length, 'pantallas');
