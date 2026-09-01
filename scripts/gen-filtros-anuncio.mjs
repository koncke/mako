// Escribe los dos filter_complex del montaje a partir del plan de cortes.
// uso: node gen-filtros.mjs <plan.json> <dirSalida> <ntomas>
//
// OJO: en un filter_complex no se puede usar dos veces el mismo pad de entrada.
// Una toma con K tramos necesita split=K antes de los trim, si no ffmpeg falla con
// "Filtergraph has an unconnected output" / reuso de label.
import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3], N = +process.argv[4];
const segs = plan.segs;

// --- filtro de VIDEO: split por toma, trim por tramo, concat en orden del plan ---
let fv = '', etiquetas = [];
for (let t = 1; t <= N; t++) {
  const mios = segs.map((s, k) => ({ s, k })).filter(x => x.s.toma === t);
  if (!mios.length) continue;
  const idx = t - 1;
  if (mios.length === 1) {
    fv += `[${idx}:v]trim=${mios[0].s.ini}:${mios[0].s.fin},setpts=PTS-STARTPTS[v${mios[0].k}];\n`;
  } else {
    const outs = mios.map(x => `[t${t}_${x.k}]`).join('');
    fv += `[${idx}:v]split=${mios.length}${outs};\n`;
    for (const x of mios) fv += `[t${t}_${x.k}]trim=${x.s.ini}:${x.s.fin},setpts=PTS-STARTPTS[v${x.k}];\n`;
  }
}
for (let k = 0; k < segs.length; k++) etiquetas.push(`[v${k}]`);
fv += `${etiquetas.join('')}concat=n=${segs.length}:v=1:a=0[vc];\n`;
fv += `[vc]ass=subs.ass:original_size=720x1280[v]`;
fs.writeFileSync(`${OUT}/filtro-video.txt`, fv);

// --- filtro de AUDIO: mismos tramos sobre los mp3 de voz, mismo orden ---
let fa = '';
for (let t = 1; t <= N; t++) {
  const mios = segs.map((s, k) => ({ s, k })).filter(x => x.s.toma === t);
  if (!mios.length) continue;
  const idx = t - 1;
  if (mios.length === 1) {
    fa += `[${idx}:a]atrim=${mios[0].s.ini}:${mios[0].s.fin},asetpts=PTS-STARTPTS[a${mios[0].k}];\n`;
  } else {
    const outs = mios.map(x => `[u${t}_${x.k}]`).join('');
    fa += `[${idx}:a]asplit=${mios.length}${outs};\n`;
    for (const x of mios) fa += `[u${t}_${x.k}]atrim=${x.s.ini}:${x.s.fin},asetpts=PTS-STARTPTS[a${x.k}];\n`;
  }
}
fa += `${segs.map((_, k) => `[a${k}]`).join('')}concat=n=${segs.length}:v=0:a=1[a]`;
fs.writeFileSync(`${OUT}/filtro-audio.txt`, fa);

console.log(`${segs.length} tramos | total ${plan.total}s`);
