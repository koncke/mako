// =============================================================================
// Una key de la plataforma copiada en la fila de un negocio NO es del negocio
// =============================================================================
// Medido el 16/10/2026, sólo lectura y comparando huellas (sin imprimir ninguna key): la `GEMINI_API_KEY` de la fila
// del ws1 (Mauricio, un cliente) es la MISMA que una de la plataforma, y su `OPENAI_API_KEY` también; Groq, Mistral y
// OpenRouter sí son suyas. Toda cascada prueba primero las keys «del negocio» (`provsDe`), así que los pedidos del
// ws1 con datos de SUS clientes —el turno con herramientas (`chatCheapToolsCascade`), el análisis del lead, las notas
// de voz— iban a la key gratis de la agencia, que entrena con lo que recibe. El corte por datos de clientes
// (AGENTS.md, 16/10) miraba sólo la red de la plataforma, y por esta puerta no pasaba. El Centro de Operaciones lo
// vio sin medir; el diagnóstico obvio (`credWs` hereda la key del entorno) era el equivocado: la fila existe, y es
// una copia.
//
// Lo que se prueba:
//   · la regla, ejecutándola (lib/ia-keys.ts → `sinCopiasDeLaPlataforma`, pura);
//   · el cableado: `provsDe` la aplica (por ahí pasan todas las cascadas), las huellas se leen estrictas, y la key
//     del negocio se lee con `credDelCliente`, no con `credWs` (que le presta al ws1 la del entorno).
//
// Correr: npx tsx --test tests/ia-keys-propias.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA (los números, al pie del archivo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sinCopiasDeLaPlataforma } from '../lib/ia-keys';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, ''); // y los bloques después
function bloque(src: string, desde: string, hasta: string): string {
  const s = sinComentarios(src);
  const i = s.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = s.indexOf(hasta, i + desde.length);
  return s.slice(i, j < 0 ? undefined : j);
}

// Keys de mentira: nunca una de verdad en un test.
const huella = (k: string) => createHash('sha256').update(k.trim()).digest('hex').slice(0, 16);
const DE_LA_PLATAFORMA = 'AIza-falsa-de-la-plataforma-0001';
const PROPIA = 'gsk-falsa-propia-del-negocio-0002';
const HUELLAS = new Set([huella(DE_LA_PLATAFORMA), huella('AIza-falsa-otra-de-la-plataforma')]);
const WS1 = 1, PLATAFORMA = 9;
const provs = [{ key: DE_LA_PLATAFORMA, clave: 'GEMINI_API_KEY' }, { key: `  ${PROPIA}\n`, clave: 'GROQ_API_KEY' }];

test('la copia de una key de la plataforma no cuenta como propia del negocio', () => {
  const r = sinCopiasDeLaPlataforma(provs, { ws: WS1, wsPlataforma: PLATAFORMA, huellas: HUELLAS, huella });
  assert.deepEqual(r.map((x) => x.clave), ['GROQ_API_KEY'],
    'el ws1 usa como propia la key de Gemini de la plataforma: sus leads van a un plan gratis que entrena');
});

test('la plataforma usa las suyas tal cual, y un negocio con keys propias no pierde ninguna', () => {
  assert.equal(sinCopiasDeLaPlataforma(provs, { ws: PLATAFORMA, wsPlataforma: PLATAFORMA, huellas: HUELLAS, huella }).length, 2,
    'el workspace de la plataforma se quedó sin sus propias keys');
  const otro = [{ key: 'AIza-falsa-de-un-cliente-0003', clave: 'GEMINI_API_KEY' }, { key: PROPIA, clave: 'GROQ_API_KEY' }];
  assert.equal(sinCopiasDeLaPlataforma(otro, { ws: 13, wsPlataforma: PLATAFORMA, huellas: HUELLAS, huella }).length, 2,
    'un cliente con sus propias keys perdió alguna');
});

test('si no se sabe cuáles son de la plataforma, no se arriesga ninguna (fail-closed)', () => {
  assert.deepEqual(sinCopiasDeLaPlataforma(provs, { ws: WS1, wsPlataforma: PLATAFORMA, huellas: null, huella }), [],
    'con la base caída, las keys del negocio se usan sin saber si son de la plataforma');
  assert.deepEqual(sinCopiasDeLaPlataforma(provs, { ws: WS1, wsPlataforma: null, huellas: HUELLAS, huella }), [],
    'sin saber cuál es la plataforma, las keys del negocio se usan sin verificar');
  // Sin workspace en el contexto (un cron), `clavesCargadas` cae al ws1: también se filtra.
  assert.deepEqual(sinCopiasDeLaPlataforma(provs, { ws: null, wsPlataforma: PLATAFORMA, huellas: HUELLAS, huella }).map((x) => x.clave),
    ['GROQ_API_KEY'], 'sin workspace en el contexto se usan las keys del ws1 sin filtrar');
});

test('provsDe lo aplica: por ahí pasan todas las cascadas (texto, herramientas, documentos, audio, el doer)', () => {
  const src = leer('lib/ai-cheap.ts');
  const provs = bloque(src, 'export async function provsDe(', '\n}\n');
  const filtro = 'const propias = await soloLasPropias(nombre, out);';
  assert.ok(provs.includes(filtro), 'provsDe devuelve las keys «del negocio» sin sacar las copias de la plataforma');
  assert.doesNotMatch(provs.slice(provs.indexOf(filtro) + filtro.length), /\bout\b/, 'provsDe sigue devolviendo la lista sin filtrar');
  // La cascada con herramientas (y las demás) toman las keys por provsDe, no por provDe a mano.
  const tools = bloque(src, 'export async function chatCheapToolsCascade(', '\n}\n');
  assert.match(tools, /await provsDe\(prov\)/);
  assert.doesNotMatch(tools, /provDe\(/);

  const propias = bloque(src, 'async function soloLasPropias(', '\n}\n');
  assert.match(propias, /sinCopiasDeLaPlataforma\(provs, \{ ws, wsPlataforma: wsSA, huellas, huella: huellaDeKey \}\)/);
  const huellas = bloque(src, 'async function huellasDeLaPlataforma(', '\n}\n');
  assert.match(huellas, /await credWsEstricta\(cl, wsSA\)/, 'las keys de la plataforma se leen tolerante: con la base caída no se reconoce ninguna copia');
  assert.match(huellas, /process\.env\[cl\]/, 'las keys del entorno (la otra copia de la plataforma) no cuentan');
  assert.match(huellas, /return null;/, 'si no se pudo leer, se inventa un conjunto vacío y pasan todas');
  // La caché es de la plataforma y guarda HUELLAS: nunca una key en memoria compartida entre inquilinos.
  assert.match(sinComentarios(src), /new Map<ProvName, \{ hasta: number; huellas: Set<string> \}>\(\)/);
});

test('la key del negocio se lee con credDelCliente: credWs le presta al ws1 la del entorno', () => {
  const provDe = bloque(leer('lib/ai-cheap.ts'), 'async function provDe(', '\n}\n');
  assert.match(provDe, /await credDelCliente\(cl, wsKey\)/);
  assert.doesNotMatch(provDe, /credWs\(/, 'provDe volvió a credWs: el ws1 hereda la key de IA de la plataforma');
});

// ROTURAS (16/10/2026), base 5/0:
//   - la regla no filtra las copias                              → 3/2
//   - sin huellas pasan todas (fail-open)                        → 4/1
//   - la plataforma también filtra las suyas                     → 4/1
//   - provsDe no aplica el filtro                                → 4/1
//   - provDe vuelve a credWs                                     → 4/1
//   - las huellas de la plataforma se leen tolerante             → 4/1
//   - las keys del entorno no cuentan como de la plataforma      → 4/1
//   - la cascada con herramientas toma las keys a mano           → 4/1
