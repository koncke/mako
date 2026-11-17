// Genera la SEGUNDA capa de efectos: un golpe por ícono, whoosh en el video de
// stock y en el carrusel, tick en el conector ojo→dinero.
// Los tiempos salen de chunks-full.js + el offset del locutor (5.6s).
const fs = require('fs');
const CH = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace('window.FULL_CH=', '').replace(/;\s*$/, ''));
const OUT = process.argv[3];
const OFF = 5600;                       // el locutor arranca a los 5.6s del video

// ── eventos ──
const ev = [];
CH.filter(c => c.icon).forEach(c => ev.push({ src: 'pop', at: c.s + OFF, vol: 1.5 }));
const vid = CH.filter(c => c.video);
if (vid.length) ev.push({ src: 'whoosh', at: vid[0].s + OFF - 120, vol: 1.5 });
const flow = CH.filter(c => c.flow);
if (flow.length > 1) ev.push({ src: 'pop', at: flow[0].s + OFF, vol: 1.1 });      // aparece el ojo
if (flow.length > 1) ev.push({ src: 'shimmer', at: flow[1].s + OFF, vol: 1.2 });  // se traza el conector
const car = CH.filter(c => c.type === 'carousel');
if (car.length) {
  ev.push({ src: 'whoosh', at: car[0].s + OFF - 140, vol: 1.9 });                 // arranca la tira
  ev.push({ src: 'whoosh', at: car[car.length - 1].e + OFF - 260, vol: 1.1 });    // sale la tira
}
ev.sort((a, b) => a.at - b.at);

// ── filtergraph: un asplit por fuente, un adelay por evento ──
const SRC = ['pop', 'whoosh', 'shimmer'];
const usos = Object.fromEntries(SRC.map(s => [s, ev.filter(e => e.src === s).length]));
const parts = [];
SRC.forEach((s, i) => {
  const n = usos[s];
  if (!n) return;
  parts.push(`[${i}:a]asplit=${n}` + Array.from({ length: n }, (_, k) => `[${s}${k}]`).join(''));
});
const cnt = Object.fromEntries(SRC.map(s => [s, 0]));
const labels = [];
ev.forEach((e, i) => {
  const k = cnt[e.src]++;
  const lb = `e${i}`;
  parts.push(`[${e.src}${k}]volume=${e.vol},adelay=${Math.max(0, Math.round(e.at))}:all=1[${lb}]`);
  labels.push(`[${lb}]`);
});
parts.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,alimiter=limit=0.95[out]`);

fs.writeFileSync(OUT, parts.join(';\n') + '\n');
console.log('eventos:', ev.length, '| último a', (ev[ev.length - 1].at / 1000).toFixed(2), 's');
ev.forEach(e => console.log('  ', String(e.at).padStart(6), e.src.padEnd(8), 'vol', e.vol));
console.log('\nInputs en orden:', SRC.filter(s => usos[s]).join(', '));
