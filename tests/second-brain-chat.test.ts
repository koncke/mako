// =============================================================================
// El Second Brain como chat: las dos puertas, en el SERVIDOR (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md: /second-brain es el chat con MaKo de todos los que tienen MaKo (closer y
// setter incluidos), y el Mapa (el grafo, las áreas, la skill de Claude con su token) es sólo del admin con la tab en
// su capa. Lo que se fija, sobre la forma del código (un corte por rol se escribe en el servidor: AGENTS.md):
//   · la página entra con la puerta de MaKo y calcula el Mapa SÓLO adentro de `veMapa` (lo que no se ve no viaja);
//   · `veMapa` sale de la MISMA puerta de las rutas del Second Brain (`soloAdminDeTab`), no de una copia;
//   · la ruta del chat pide la persona ADENTRO de cada handler, aguanta lo que dura un turno, no lee el `?ws=` crudo y
//     no llama a Claude por su cuenta (el crédito de Claude de la plataforma es sólo del onboarding).
//
// ⚠️ Probado ROMPIÉNDOLO (16/10/2026), contra la base en verde de 3 pases:
//   · construyendo el cerebro fuera del `if (veMapa…)` → 1 fallo («la página»);
//   · `veMapa` con un `rol === 'admin'` a mano → 1 fallo («la página»);
//   · el POST de la ruta leyendo el cuerpo antes de la persona → 1 fallo («la ruta»).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const leer = (r: string) => readFileSync(r, 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la página: entra con la puerta de MaKo, y el Mapa se calcula sólo para el admin de la tab', () => {
  const src = sinComentarios(leer('app/second-brain/page.tsx'));
  const cuerpo = src.slice(src.indexOf('export default async function'));
  const lineas = cuerpo.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.equal(lineas[1], "await requireRolWs(['closer', 'setter'], { nav: 'mako' });", 'la primera línea es la puerta del chat');
  assert.equal(lineas[2], "const veMapa = await esAdminDeTab('second-brain');", 'el Mapa, con la puerta de las rutas del Second Brain');
  const si = cuerpo.indexOf('if (veMapa && ');
  assert.ok(si > 0, 'el Mapa va adentro de un `if (veMapa && …)`');
  const bloque = cuerpo.slice(si, cuerpo.indexOf('\n  }\n', si));
  for (const f of ['construirCerebro(', 'tokenAgenteVisible(']) {
    assert.equal(cuerpo.split(f).length - 1, 1, `${f} aparece una sola vez`);
    assert.ok(bloque.includes(f), `${f} sólo adentro del if del Mapa`);
  }
  assert.ok(!/rol\s*===\s*'admin'/.test(cuerpo), 'el rol no se mira a mano: lo decide la puerta');
});

test('la ruta del chat: la persona adentro de cada handler, el plazo de un turno, sin ?ws= crudo y sin Claude propio', () => {
  const r = 'app/api/mako/chat/route.ts';
  assert.ok(!existsSync('app/api/second-brain/chat/route.ts'), 'no va en app/api/second-brain (esa carpeta es sólo del admin)');
  const src = sinComentarios(leer(r));
  for (const m of ['GET', 'POST']) {
    const i = src.indexOf(`export async function ${m}(`);
    assert.ok(i > 0, m);
    const dos = src.slice(src.indexOf('{', i) + 1).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2);
    assert.deepEqual(dos, ['const persona = await personaDelRequest();', "if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);"], `${m}: la persona primero`);
  }
  assert.match(src, /^export const maxDuration = 420;/m);
  assert.ok(!/get\('ws'\)/.test(src), 'el workspace sale de la sesión, nunca del ?ws=');
  assert.ok(!/chatClaude|@\/lib\/anthropic/.test(src), 'el turno es el de siempre: sin una llamada propia al modelo');
  assert.equal((src.match(/export async function /g) ?? []).length, 2, 'un handler nuevo entra a este test');
});

test('la pantalla corta después del techo de la ruta, y manda por la ruta del chat', () => {
  const src = leer('app/second-brain/ChatSecondBrain.tsx');
  assert.match(src, /const RUTA = '\/api\/mako\/chat';/);
  assert.match(src, /const TOPE_MS = 425_000;/);
  assert.ok(!src.includes('/api/m/mako'), 'una sola ruta para la pieza de escritorio');
});
