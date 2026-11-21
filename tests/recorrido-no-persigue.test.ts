// =============================================================================
// EL RECORRIDO NO PERSIGUE A LA PERSONA (21/11/2026, Martín en producción, por el Cerebro: punto 8)
// =============================================================================
// «me salgo del reto de 7 días para irme a Offer Coach y, salga donde me salga, me marca que vuelva al reto de 7 días, no tiene
// sentido». La marca «Tu reto de 7 días · Haz clic en Reto de 7 días» (MarcaAlReto.tsx) se cuidaba con un `useRef`: una vez por
// MONTAJE, y al pasar a Offer Coach se montaba de nuevo. Ahora: una vez por pestaña, nunca con otro chat elegido, y con «Lo hago después».
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. una vez por pestaña (sessionStorage), nunca con otro chat elegido, y con «Lo hago después»', () => {
  const m = sinComentarios(fuente('app/second-brain/reto/MarcaAlReto.tsx'));
  assert.match(m, /const CLAVE_MARCADA = 'mako\.reto\.marcada\.al-reto';/, 'con el prefijo que limpia el reinicio');
  assert.match(m, /if \(!listo \|\| empezo \|\| marcado\.current \|\| enOtroLado \|\| yaSeMarco\(\) \|\|/);
  assert.match(m, /anotarMarcada\(\);\n[\s\S]{0,200}senalarDondeTocar\([\s\S]{0,260}\{ alOmitir: \(\) => \{\} \}\);/, 'anotada antes, y con su salida');
  const c = sinComentarios(fuente('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(c, /<MarcaAlReto [^>]*enOtroLado=\{conCoach \|\| enOtroChat\} \/>/, 'con un coach, un grupo o un gurú abiertos, no');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026): sin `yaSeMarco()` → 1; sin «Lo hago después» → 1; ChatSecondBrain sin `enOtroLado` → 1.
// ─────────────────────────────────────────────────────────────────────────────
