// =============================================================================
// Un 429 a mitad de una pregunta no tira el turno: otro modelo, o la espera del minuto
// =============================================================================
// EL CASO (07/10/2026, grupo de Brigitte, ws15, una sola key de Gemini). La segunda
// pregunta hizo 6 pedidos en 13 s y el séptimo volvió 429 — el tope del MINUTO: una hora
// después la misma key contestaba 200. Ese 429 tiraba el turno con seis pasos hechos, el
// modelo de respaldo (con su propio cupo) no se probaba, y el cliente leía «te quedaste
// sin cuota de IA». La red de plataforma tampoco: tres 503 de `flash-latest` y un timeout
// que salía como excepción sin pasar por ningún reintento.
//
// PROBADO ROMPIÉNDOLO, sobre copias, junto con tests/red-plataforma.test.ts (con todo
// puesto: 15 pasan, 0 fallan). Pasan / fallan con cada rotura:
//   · `leerErrorProveedor` vuelve a leer sólo `data.error` (no el array)   -> 13 / 2
//   · la cuota vuelve a tirar sin probar el otro modelo                    -> 13 / 2
//   · la espera usa un número propio en vez del que dice el proveedor      -> 14 / 1
//   · se espera aunque la cuota sea la del DÍA                             -> 14 / 1
//   · `chatCheapTools` sin los modelos de respaldo                         -> 14 / 1
//   · el `fetch` vuelve a quedar afuera del try (el timeout no rota)       -> 14 / 1
//   · `runTool` corre antes de mirar el error del pedido                   -> 14 / 1
//   · la cascada vuelve a re-arrancar el turno después de una tool         -> 13 / 2
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerErrorProveedor, tipoDeFallo, crearRotacion, PAUSA_SATURACION_MS } from '../lib/ia-rotacion-modelo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, firma: string, fin: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const f = src.indexOf(fin, i + firma.length);
  assert.ok(f > i, `no encontré el fin «${fin}»`);
  return src.slice(i, f);
};

// Los cuerpos REALES, tal como los mandó Gemini (07/10/2026) o como los documenta.
const GEMINI_503 = [{ error: { code: 503, message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.', status: 'UNAVAILABLE' } }];
const GEMINI_429_MINUTO = [{ error: {
  code: 429,
  message: 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. Please retry in 17.4s.',
  status: 'RESOURCE_EXHAUSTED',
  details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_input_token_count', quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier' }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '17s' },
  ],
} }];
const GEMINI_429_DIA = [{ error: {
  code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED',
  details: [
    { violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
    { retryDelay: '41153s' },
  ],
} }];
const GROQ_413 = { error: { message: 'Request too large for model `openai/gpt-oss-20b` in organization `org_x` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 13455, please reduce your message size and try again. Visit https://console.groq.com/docs/rate-limits', type: 'tokens' } };

// ── 1. leer el error que mandó el proveedor ─────────────────────────────────

test('⚠️ GEMINI MANDA EL ERROR EN UN ARRAY: leerlo como objeto lo dejaba en «HTTP 429» pelado', () => {
  const e = leerErrorProveedor(GEMINI_503, 503);
  assert.match(e.mensaje, /high demand/, 'el texto del 503 se volvió a perder');
  const c = leerErrorProveedor(GEMINI_429_MINUTO, 429);
  assert.match(c.mensaje, /exceeded your current quota/);
  assert.match(c.mensaje, /PerMinute/, 'qué cuota fue tiene que quedar en el log');
  // Y el formato de siempre (objeto) se sigue leyendo.
  assert.match(leerErrorProveedor(GROQ_413, 413).mensaje, /Request too large/);
  // Sin cuerpo, el status: nunca un vacío.
  assert.equal(leerErrorProveedor({}, 502).mensaje, 'HTTP 502');
  assert.equal(leerErrorProveedor(null, 500).mensaje, 'HTTP 500');
});

test('La espera sale del PROVEEDOR: el RetryInfo, y si no, la frase del mensaje', () => {
  assert.equal(leerErrorProveedor(GEMINI_429_MINUTO, 429).esperaMs, 17_000, 'el RetryInfo estructurado gana');
  const soloFrase = [{ error: { code: 429, message: 'Quota exceeded. Please retry in 9.2s.' } }];
  assert.equal(leerErrorProveedor(soloFrase, 429).esperaMs, 9_200);
  assert.equal(leerErrorProveedor(GEMINI_503, 503).esperaMs, null, 'sin espera dicha no se inventa una');
  assert.equal(leerErrorProveedor(GEMINI_429_DIA, 429).porDia, true);
  assert.equal(leerErrorProveedor(GEMINI_429_MINUTO, 429).porDia, false);
});

test('Qué clase de fallo es: el 413 de Groq NO es cuota aunque nombre «rate-limits»', () => {
  assert.equal(tipoDeFallo(413, GROQ_413.error.message), 'otro');
  assert.equal(tipoDeFallo(429, 'HTTP 429'), 'cuota');
  assert.equal(tipoDeFallo(400, 'RESOURCE_EXHAUSTED'), 'cuota');
  assert.equal(tipoDeFallo(503, 'HTTP 503'), 'saturacion');
  assert.equal(tipoDeFallo(0, 'The operation was aborted due to timeout'), 'saturacion', 'un timeout es saturación');
  assert.equal(tipoDeFallo(0, 'fetch failed'), 'saturacion');
  assert.equal(tipoDeFallo(404, 'models/x is not found'), 'modelo');
  assert.equal(tipoDeFallo(400, 'This model is unavailable for free'), 'modelo');
  assert.equal(tipoDeFallo(401, 'API key not valid'), 'otro', 'una key mala no se arregla con otro modelo');
});

// ── 2. qué se hace con el fallo ─────────────────────────────────────────────

const F = 'gemini-flash-latest', L = 'gemini-flash-lite-latest';
const minuto = { tipo: 'cuota' as const, esperaMs: 17_000, porDia: false };
const sat = { tipo: 'saturacion' as const, esperaMs: null, porDia: false };

test('⚠️ UN 429 SE CUBRE CON EL OTRO MODELO, que tiene su propio cupo — no tira el turno', () => {
  const r = crearRotacion([F, L]);
  assert.equal(r.modelo, F);
  assert.deepEqual(r.trasFallo(minuto), { accion: 'rotar', modelo: L, esperaMs: 0 });
  assert.equal(r.modelo, L, 'el resto del turno sigue en el modelo que contesta');
  // Sin espera permitida (el default) y sin otro modelo, se tira: el que llama rota de cuenta.
  assert.equal(r.trasFallo(minuto), null);
});

test('⚠️ SIN OTRO MODELO, LA CUOTA DEL MINUTO SE ESPERA — con la espera del proveedor, una vez', () => {
  // El caso de Brigitte de punta a punta: flash 429 del minuto, lite saturado.
  const r = crearRotacion([F, L], { esperaMaxMs: 30_000 });
  assert.equal(r.trasFallo(minuto)?.accion, 'rotar');
  assert.deepEqual(r.trasFallo(sat), { accion: 'reintentar', modelo: L, esperaMs: PAUSA_SATURACION_MS });
  assert.deepEqual(r.trasFallo(sat), { accion: 'esperar', modelo: F, esperaMs: 17_500 },
    'se espera lo que DIJO Google, más medio segundo, y con el modelo de la cuota');
  // Y una sola vez por turno: del otro lado hay alguien mirando el chat.
  assert.equal(r.trasFallo(minuto), null);
});

test('La cuota del DÍA no se espera, ni una que no entra en el tope', () => {
  const dia = crearRotacion([F], { esperaMaxMs: 30_000 });
  assert.equal(dia.trasFallo({ tipo: 'cuota', esperaMs: 41_153_000, porDia: true }), null);
  const larga = crearRotacion([F], { esperaMaxMs: 30_000 });
  assert.equal(larga.trasFallo({ tipo: 'cuota', esperaMs: 45_000, porDia: false }), null);
  const muda = crearRotacion([F], { esperaMaxMs: 30_000 });
  assert.equal(muda.trasFallo({ tipo: 'cuota', esperaMs: null, porDia: false }), null, 'sin espera dicha no se espera a ciegas');
  // La del día no se espera aunque diga una espera corta: lo que vuelve a la medianoche
  // del Pacífico no vuelve en 5 segundos, diga lo que diga el campo.
  const diaCorta = crearRotacion([F], { esperaMaxMs: 30_000 });
  assert.equal(diaCorta.trasFallo({ tipo: 'cuota', esperaMs: 5_000, porDia: true }), null);
});

test('Una saturación rota primero, y sin otro modelo se reintenta UNA vez por paso', () => {
  const r = crearRotacion([F, L]);
  assert.equal(r.trasFallo(sat)?.accion, 'rotar');
  assert.equal(r.trasFallo(sat)?.accion, 'reintentar');
  assert.equal(r.trasFallo(sat), null);
  // Un paso nuevo tiene su propio reintento: un bache en el paso 2 no le quita el suyo al 6.
  r.nuevoPaso();
  assert.equal(r.trasFallo(sat)?.accion, 'reintentar');
});

test('Un error que otro intento no arregla se tira enseguida', () => {
  const r = crearRotacion([F, L], { esperaMaxMs: 30_000 });
  assert.equal(r.trasFallo({ tipo: 'otro', esperaMs: null, porDia: false }), null);
  assert.equal(r.modelo, F, 'no se rotó');
});

// ── 3. chatCheapTools la usa, y reintentar no repite herramientas ───────────

const AICHEAP = leer('../lib/ai-cheap.ts');
const TOOLS = sinComentarios(bloque(AICHEAP, 'export async function chatCheapTools(', '\nasync function cerrarSinTools('));

test('⚠️ chatCheapTools rota de modelo en CADA paso, no sólo antes de la primera tool', () => {
  assert.match(TOOLS, /crearRotacion\(modelosAProbar\(/, 'chatCheapTools dejó de usar la rotación: un 429 vuelve a tirar el turno');
  assert.match(TOOLS, /\.trasFallo\(/);
  assert.match(TOOLS, /leerErrorProveedor\(/, 'el error de Gemini vuelve a leerse como «HTTP 429» pelado');
  assert.ok(!/toolsUsados > 0 \|\|/.test(TOOLS),
    'volvió la ventana «sólo antes de la primera tool»: reintentar un PEDIDO no repite ninguna tool');
  // El `fetch` va adentro del try: un timeout sale como excepción y tiene que rotar igual.
  const iTry = TOOLS.indexOf('try {');
  const iFetch = TOOLS.indexOf('await fetch(');
  assert.ok(iTry >= 0 && iTry < iFetch, 'el fetch quedó afuera del try: un timeout vuelve a tirar sin rotar');
});

test('⚠️ REINTENTAR NO REPITE HERRAMIENTAS: corren sólo después de mirar el error del pedido', () => {
  // La invariante de verdad detrás de la regla vieja («nunca después de una tool»): las tools
  // se ejecutan con una respuesta BUENA, y lo que ya corrieron está en `msgs`. El que re-arranca
  // el turno —y ahí sí duplicaría— es la cascada de proveedores, que corta si algo ejecutó.
  const iThrow = TOOLS.indexOf('throw new Error(`chatCheapTools(');
  const iRun = TOOLS.indexOf('runTool(');
  assert.ok(iThrow > 0 && iRun > iThrow, 'una tool corre antes de que se sepa si el pedido salió bien');
  const cascada = sinComentarios(bloque(AICHEAP, 'export async function chatCheapToolsCascade(', '\n}\n'));
  assert.match(cascada, /if \(ejecutó\) throw e/, 'la cascada volvió a re-arrancar el turno después de que una tool tocó datos');
});
