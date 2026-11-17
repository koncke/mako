// Beats of the tutorial from the forced alignment (same idea as the old VSL's chunk-full.js):
// each beat = a range of words of the script; it starts a hair before its first word and lasts until the next beat.
//   node beats.mjs alin.json beats.js
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
const al = JSON.parse(readFileSync(inp, 'utf8'));
const W = al.words.filter((w) => w.text.trim());
const LEAD = 80;            // the text shows up 80 ms before the word is heard
const TAIL = 380;           // the video ends 380 ms after the last word: no dead tail
const ms = (s) => Math.round(s * 1000);

// d = what the screen shows (exact words of the audio; "Máko" is only the spelling for the voice)
const B = [
  { de: 0, a: 4, icon: 'brain.svg', emph: ['Second', 'Brain'] },
  { de: 5, a: 13, emph: ['negocio'] },
  { de: 14, a: 20, type: 'grafo', nodos: [{ de: 14, a: 15 }, { de: 16, a: 18 }, { de: 19, a: 20 }] },
  { de: 21, a: 26, bg: 'blue' },
  { de: 27, a: 32, icon: 'message-circle.svg', emph: ['hablas'] },
  { de: 33, a: 35, type: 'grafo', crece: true, emph: ['solo'] },
  { de: 36, a: 42, type: 'app' },
];
const texto = (de, a) => W.slice(de, a + 1).map((w) => w.text.replace(/Máko/g, 'MaKo')).join(' ');
const beats = B.map((b, i) => {
  const s = i === 0 ? 0 : ms(W[b.de].start) - LEAD;
  const e = i < B.length - 1 ? ms(W[B[i + 1].de].start) - LEAD : ms(W[b.a].end) + TAIL;
  const x = { s, e, text: texto(b.de, b.a), ...b };
  if (b.nodos) x.nodos = b.nodos.map((n) => ({ s: ms(W[n.de].start) - LEAD, text: texto(n.de, n.a).replace(/[,.]$/, '') }));
  // word timings inside the beat, for the highlight that follows the voice
  x.palabras = W.slice(b.de, b.a + 1).map((w) => ({ t: w.text.replace(/Máko/g, 'MaKo'), s: ms(w.start) }));
  delete x.de; delete x.a;
  return x;
});
writeFileSync(out, 'window.BEATS=' + JSON.stringify(beats) + ';\nwindow.DUR=' + beats[beats.length - 1].e + ';\n');
for (const b of beats) console.log(String(b.s).padStart(6), String(b.e).padStart(6), (b.type || '').padEnd(6), b.text, b.nodos ? '| ' + b.nodos.map((n) => `${n.text}@${n.s}`).join(' · ') : '');
