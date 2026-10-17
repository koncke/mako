// =============================================================================
// El modelo gratis de OpenRouter: UNO, fijado con la fecha en que se midió
// =============================================================================
// El 16/10/2026 el chat Web Generator midió que `minimax/minimax-m3:free` ya no estaba en `GET /api/v1/models`: el
// respaldo de OpenRouter estaba muerto en toda la cascada (el chat, `MODELO_DOCS` y `MODELO_VISION`, tres copias del
// mismo id). Un id vencido no da error al cargar: se ve igual que uno sano hasta que se lo llama. Ya había pasado dos
// veces (un Llama 3.3 y un nemotron nano).
//
// Lo que se prueba:
//   · sin red (siempre): los tres lugares leen `MODELO_OPENROUTER_GRATIS`, y el id va fijado con la fecha en que se
//     midió. Cambiarlo sin medir falla acá: hay que escribir la fecha nueva.
//   · con red (`VERIFICAR_OPENROUTER=1`): cada id `:free` del código existe hoy en la lista pública de OpenRouter.
//     Sin la variable se saltea DICIENDO por qué: un test de CI no depende de la red de un tercero.
//
// Correr: npx tsx --test tests/openrouter-modelo.test.ts      (con red: VERIFICAR_OPENROUTER=1 npx tsx --test …)
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA (los números, al pie del archivo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, ''); // y los bloques después
const AI = sinComentarios(leer('lib/ai-cheap.ts'));

/** Lo que se MIDIÓ, con su fecha (lib/ai-cheap.ts → el comentario de `MODELO_OPENROUTER_GRATIS`). */
const MEDIDO: Record<string, string> = { 'nvidia/nemotron-3.5-super-vl:free': '2026-10-16' };

test('el modelo gratis de OpenRouter es UNO y va con la fecha en que se midió', () => {
  const id = AI.match(/export const MODELO_OPENROUTER_GRATIS = '([^']+)';/)?.[1];
  const fecha = AI.match(/export const MODELO_OPENROUTER_MEDIDO = '([^']+)';/)?.[1];
  assert.ok(id && fecha, 'no encontré MODELO_OPENROUTER_GRATIS o su fecha');
  assert.match(fecha, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(MEDIDO[id], fecha,
    `cambiaste el modelo de OpenRouter a «${id}» sin dejar la medición: pedí la lista real, probalo con texto e imagen y anotá la fecha acá`);
});

test('el chat, MODELO_DOCS y MODELO_VISION leen la constante: ninguna copia del id', () => {
  assert.match(AI, /chatModel: process\.env\.OPENROUTER_MODEL \|\| MODELO_OPENROUTER_GRATIS/);
  assert.match(AI, /openrouter: MODELO_OPENROUTER_GRATIS,/, 'MODELO_DOCS tiene su propia copia del id');
  assert.match(AI, /openrouter: process\.env\.OPENROUTER_VISION_MODEL \|\| MODELO_OPENROUTER_GRATIS,/, 'MODELO_VISION tiene su propia copia del id');
  const ids = AI.match(/'[^'\s]+:free'/g) ?? [];
  assert.deepEqual(ids, [`'${Object.keys(MEDIDO)[0]}'`], 'hay otro id :free escrito a mano en lib/ai-cheap.ts');
});

test('con red: cada id :free del código existe hoy en OpenRouter', async (t) => {
  if (process.env.VERIFICAR_OPENROUTER !== '1') {
    t.skip('sin VERIFICAR_OPENROUTER=1: no se consulta la red de un tercero en CI (correrlo a mano antes de cambiar un id)');
    return;
  }
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  const ids = new Set<string>();
  for (const f of archivos) for (const m of sinComentarios(leer(f)).matchAll(/'([a-z0-9-]+\/[^'\s]+:free)'/g)) ids.add(m[1]);
  assert.ok(ids.size > 0, 'no encontré ningún id :free (¿cambió la forma?)');
  const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30_000) });
  assert.equal(res.status, 200);
  const lista = new Set(((await res.json()) as { data: Array<{ id: string }> }).data.map((m) => m.id));
  const muertos = [...ids].filter((id) => !lista.has(id));
  assert.deepEqual(muertos, [], `estos modelos gratis ya no existen en OpenRouter: ${muertos.join(', ')}`);
});

// ROTURAS (16/10/2026), base 2 pasan, 1 salteado (sin red) · con VERIFICAR_OPENROUTER=1, 3/0:
//   - cambiar el id sin anotar la medición                       → 0/2
//   - MODELO_DOCS vuelve a su copia (el minimax muerto)           → 1/1
//   - MODELO_VISION vuelve a su copia                            → 1/1
//   - con red: otra feature (lib/offer-ia.ts) con un id muerto    → 2/1
