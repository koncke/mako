// =============================================================================
// Un modelo saturado no deja a MaKo sin IA: el respaldo llega a probarse (26/10/2026)
// =============================================================================
// El caso (Landings, logs de Vercel, 26/10/2026 05:52 UTC, ws9): la réplica de una página de 20 secciones dejó 17 SIN IA en
// 135 s con un plazo de 240. «gemini · cuenta 3: The operation was aborted due to timeout» y «gemini · cuenta 4: This model
// is currently experiencing high demand». El respaldo sano (`gemini-flash-lite-latest`) existía y nunca se probó: el primer
// intento colgado se comía los 42 s de la tanda, se reintentaba igual, y la tanda siguiente volvía a empezar por el colgado.
// Lo que se fija acá:
//   1. lo puro de lib/ia-saturacion.ts: qué es saturación (un 429 no lo es), cuándo cuenta un timeout, y que vence;
//   2. la cascada REAL (tests/_ia-saturacion-hijo.ts): el intento le deja lugar al respaldo, una saturación no se reintenta,
//      el pedido siguiente empieza por el respaldo, y sin plazo del que llama nada cambia;
//   3. el turno con herramientas (MaKo en WhatsApp) también anota la saturación;
//   4. la réplica del Web Generator da una segunda vuelta a lo que quedó sin IA.
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TIMEOUT_QUE_CUENTA_MS, VENTANA_SATURADO_MS, anotarSaturado, esSaturacion, estaSaturado, fallaDeSaturacion, olvidarSaturados, primeroLosSanos,
} from '../lib/ia-saturacion';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. qué es saturación: «high demand» y 503 sí; la cuota de una cuenta no; un timeout sólo con plazo razonable', () => {
  assert.equal(esSaturacion('HTTP 503 This model is currently experiencing high demand.'), true);
  assert.equal(esSaturacion('The model is overloaded. Please try again later.'), true);
  assert.equal(esSaturacion('HTTP 429 RESOURCE_EXHAUSTED: quota exceeded'), false, 'la cuota es de UNA cuenta: la arregla otra cuenta');
  // El ambiguo: un 429 que además dice «overloaded». Sigue siendo la cuota de una cuenta, no el modelo.
  assert.equal(esSaturacion('HTTP 429: the service is overloaded for this key, retry later'), false, 'un 429 nunca marca al modelo');
  assert.equal(esSaturacion('HTTP 400 invalid argument'), false);
  assert.equal(fallaDeSaturacion('The operation was aborted due to timeout', 42_000), true);
  assert.equal(fallaDeSaturacion('The operation was aborted due to timeout', TIMEOUT_QUE_CUENTA_MS - 1), false, 'un intento con poco plazo no dice nada del modelo');
});

test('1. saturado vence solo, y el saturado va AL FINAL de la lista sin que se saque a nadie', () => {
  olvidarSaturados();
  const t = 1_000_000;
  anotarSaturado('gemini', 'gemini-flash-latest', t);
  assert.equal(estaSaturado('gemini', 'gemini-flash-latest', t + 1), true);
  assert.equal(estaSaturado('openai', 'gemini-flash-latest', t + 1), false, 'es por proveedor y modelo');
  assert.deepEqual(primeroLosSanos('gemini', ['gemini-flash-latest', 'gemini-flash-lite-latest'], 'gemini-flash-latest', t + 1), ['gemini-flash-lite-latest', 'gemini-flash-latest']);
  assert.deepEqual(primeroLosSanos('gemini', [undefined, 'gemini-flash-lite-latest'], 'gemini-flash-latest', t + 1), ['gemini-flash-lite-latest', undefined], '`undefined` es el modelo por default');
  assert.equal(estaSaturado('gemini', 'gemini-flash-latest', t + VENTANA_SATURADO_MS + 1), false, 'pasado el bache, vuelve a ser el primero');
  assert.deepEqual(primeroLosSanos('gemini', ['gemini-flash-latest', 'gemini-flash-lite-latest'], 'x', t + VENTANA_SATURADO_MS + 2), ['gemini-flash-latest', 'gemini-flash-lite-latest']);
});

type Pedido = { modelo: string; plazo: number | null };
type Vuelta = { respuesta?: string; pedidos: Pedido[]; saturadoDespues?: boolean; quedabanMs?: number };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ia-saturacion-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<'A' | 'B' | 'C' | 'D' | 'E', Vuelta> & { error?: string };
const LATEST = 'gemini-flash-latest', LITE = 'gemini-flash-lite-latest';

test('2. el caso del ws9: flash-latest colgado, el intento le DEJA LUGAR al respaldo y contesta flash-lite', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.A.respuesta, `respuesta de ${LITE}`);
  assert.deepEqual(R.A.pedidos.map((p) => p.modelo), [LATEST, LITE], 'un solo intento al colgado, después el respaldo');
  const primero = R.A.pedidos[0].plazo ?? Infinity;
  assert.ok(primero <= 42_000 - 15_000 + 500, `el primer intento pidió ${primero} ms: no le dejó los 15 s al respaldo`);
});

test('2. el pedido siguiente empieza por el respaldo (el saturado va al final), y un 503 no se reintenta', () => {
  assert.equal(R.B.pedidos[0]?.modelo, LITE, `empezó por ${R.B.pedidos[0]?.modelo}`);
  assert.equal(R.B.respuesta, `respuesta de ${LITE}`);
  assert.deepEqual(R.C.pedidos.map((p) => p.modelo), [LATEST, LITE], 'el 503 «high demand» no se reintenta en el mismo modelo');
  assert.equal(R.C.saturadoDespues, true);
});

test('2. sin plazo del que llama no hay nada que reservar: el intento pide su timeout de siempre', () => {
  assert.equal(R.D.pedidos[0]?.plazo, 88_800);
  assert.equal(R.D.respuesta, `respuesta de ${LITE}`);
});

test('3. el turno con herramientas (MaKo en WhatsApp) también anota la saturación', () => {
  assert.equal(R.E.saturadoDespues, true);
  assert.deepEqual(R.E.pedidos.map((p) => p.modelo), [LATEST, LITE], 'rota al respaldo en el mismo turno');
});

test('4. la réplica del Web Generator da UNA segunda vuelta a las secciones que quedaron sin IA', () => {
  const src = fuente('lib/editor-landing/replicar.ts');
  assert.match(src, /await correr\(tandas, '1ª vuelta'\);/);
  assert.match(src, /const faltan = tandas\.map\(\(t\) => t\.filter\(\(i\) => !porIndice\.has\(i\)\)\)\.filter\(\(t\) => t\.length > 0\);/);
  assert.match(src, /if \(faltan\.length\) await correr\(faltan, '2ª vuelta'\);/);
  // Las dos vueltas respetan el mismo plazo total (una tanda entera tiene que entrar).
  assert.match(src, /if \(Date\.now\(\) - t0 \+ TANDA_MS > PLAZO_BLOQUES_MS\) continue;/);
});

// ── Probado rompiéndolo (26/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano en lib/ai-cheap.ts (o en lib/ia-saturacion.ts / replicar.ts), corrido y restaurado de memoria:
//   1. `plazoDeIntento` sin la reserva (siempre lo que queda)          → rojo «2. el caso del ws9…» (pidió 42 000 ms).
//   2. `modelosAProbar` sin `primeroLosSanos`                         → rojo «2. el pedido siguiente…».
//   3. sin el `break` de la saturación en la cascada                  → rojo «2. el caso del ws9…» y «… un 503 no se reintenta».
//   4. `chatCheap` sin anotar el 503                                  → rojo «2. el pedido siguiente…» (saturadoDespues).
//   5. el turno con herramientas sin anotar                           → rojo «3. el turno con herramientas…».
//   6. `esSaturacion` contando el 429                                 → rojo «1. qué es saturación…».
//   7. la réplica sin la segunda vuelta                               → rojo «4. la réplica…».
//   8. `fallaDeSaturacion` contando cualquier timeout                 → rojo «1. qué es saturación…».
// El 6 dio VERDE la primera vez: el mensaje de cuota del test no traía ninguna palabra de saturación, así que la guarda no se
// ejercitaba. Se sumó el ambiguo (un 429 que dice «overloaded») y dio rojo.
