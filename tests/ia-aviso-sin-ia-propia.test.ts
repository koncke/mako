// AU3 · el aviso de IA del lienzo dice la verdad y apunta a Claude (22/10/2026)
// =============================================================================
// Mauricio (ws1) leyó en el chat de su automatización «No tienes ninguna IA gratis conectada.», con el link a Gemini. Era
// falso dos veces: el ws1 no conecta IA gratis (la red de la plataforma va sola) y lo que pasó fue que esa red llegó a su
// tope de hoy (el 429 por día de Gemini). La frase salía de `falloDeIA` con la lista vacía, porque los errores de la red
// (`erroresRed`) no entraban (lo midió el chat «IA del cliente»). Ahora: sin keys propias, se dice qué le pasó a la IA
// gratis de MaKo y la salida es SU Claude (/integraciones?abrir=anthropic), que es lo primero que prueba esta cascada.
// Con keys propias, la red no cambia nada: un 429 de la agencia nunca es de las keys del negocio.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { falloDeIA, sinIAPropia, LINK_CONECTA_CLAUDE, PROVS_CREAR_IA } from '../lib/flujo-ia';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

/** Los errores de la red con la forma de `erroresPlataformaOut` (lib/ai-cheap.ts: «<prov>/<clave>: <detalle>»). */
const GEMINI_DIA = 'gemini/GEMINI_API_KEY: chatCheap(gemini): HTTP 429: You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 250, model: gemini-2.5-flash. quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const GROQ_TPD = 'groq/CHEAP_API_KEY: chatCheap(groq): Rate limit reached for model `openai/gpt-oss-120b` in organization org_x service tier on_demand on tokens per day (TPD): Limit 200000, Used 199870, Requested 4120. Please try again in 28m. Visit https://console.groq.com/docs/rate-limits';
const GEMINI_MINUTO = 'gemini/GEMINI_API_KEY: chatCheap(gemini): HTTP 429';
const GEMINI_SATURADO = 'gemini/GEMINI_API_KEY: chatCheap(gemini): HTTP 503: This model is currently experiencing high demand';

test('el caso del ws1: sin keys propias y la red al tope de hoy → «llegó a su tope de hoy», con el link a Claude', () => {
  for (const red of [[GEMINI_DIA], [GROQ_TPD], [GEMINI_DIA, GROQ_TPD]]) {
    const f = falloDeIA([], false, red);
    assert.deepEqual(f, { error: 'La IA gratis de MaKo llegó a su tope de hoy. Conecta tu Claude para seguir.', link: '/integraciones?abrir=anthropic' });
  }
  assert.equal(LINK_CONECTA_CLAUDE, '/integraciones?abrir=anthropic');
});

test('sin keys propias: cada cosa que le pasó a la red se dice distinto, y siempre con la salida (su Claude)', () => {
  assert.equal(sinIAPropia([GEMINI_MINUTO]).error, 'La IA gratis de MaKo está al tope. Prueba en un rato o conecta tu Claude.');
  assert.equal(sinIAPropia([GEMINI_SATURADO]).error, 'La IA gratis de MaKo está saturada. Prueba en un rato o conecta tu Claude.');
  assert.equal(sinIAPropia(['groq/CHEAP_API_KEY: chatCheap(groq): socket hang up']).error, 'La IA gratis de MaKo no contestó. Prueba de nuevo o conecta tu Claude.');
  // Sin red que probar (ninguna key de la agencia, o el ws del super admin): no tiene IA, y se dice así.
  assert.deepEqual(sinIAPropia([]), { error: 'No tienes una IA conectada: conecta tu Claude.', link: LINK_CONECTA_CLAUDE });
  // La red salteada a propósito: con su propio Claude (D6b), o porque el pedido lleva datos de clientes.
  assert.equal(sinIAPropia(['red gratis salteada: el negocio usa su propia IA (su Claude o su GPT)']).error,
    'Con tu propio Claude, para armar el flujo necesito tu clave de Claude (en Integraciones).');
  assert.match(sinIAPropia(['red gratis salteada: el pedido lleva datos de clientes y el plan gratis entrena con lo que recibe']).error, /^Conecta tu Claude en Integraciones: lleva datos de tus clientes/);
  // Todos llevan el link a Claude, y ninguno vuelve a «IA gratis conectada» ni al link de Gemini.
  for (const red of [[GEMINI_DIA], [GEMINI_MINUTO], [GEMINI_SATURADO], [], ['red gratis salteada: x']]) {
    const f = sinIAPropia(red);
    assert.equal(f.link, LINK_CONECTA_CLAUDE);
    assert.doesNotMatch(f.error, /ninguna IA gratis conectada|gemini/i);
  }
});

test('con keys propias, la red no cambia el mensaje: un 429 de la agencia no es de las keys del negocio', () => {
  // Sus keys fallaron: manda lo de SUS keys.
  assert.equal(falloDeIA(['gemini: chatCheap(gemini): Your project has been denied access. Please contact support.'], false, [GEMINI_DIA]).error,
    'Gemini rechazó tu key. Cámbiala en Integraciones.');
  // Tiene keys y nada contestó: lo de siempre, sin hablar de la IA gratis de MaKo.
  assert.deepEqual(falloDeIA([], true, [GEMINI_DIA]), { error: 'Ninguna IA contestó. Prueba de nuevo.' });
  // «Tu IA llegó a su tope» (sus keys con 429) sigue siendo «al tope, prueba en un rato».
  assert.deepEqual(falloDeIA(['gemini: chatCheap(gemini): HTTP 429'], true, [GEMINI_DIA]), { error: 'Gemini está al tope. Prueba en un rato.' });
});

test('la clave de Claude del negocio se nombra «Claude», y sin saldo no se la manda a cambiar ni a esperar', () => {
  assert.deepEqual(falloDeIA(['anthropic/ANTHROPIC_API_KEY: invalid x-api-key'], false), { error: 'Claude rechazó tu key. Cámbiala en Integraciones.', link: LINK_CONECTA_CLAUDE });
  assert.deepEqual(falloDeIA(['anthropic/ANTHROPIC_API_KEY: Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'], false),
    { error: 'Claude se quedó sin crédito. Cárgale crédito en tu cuenta de Anthropic.' });
  assert.equal(falloDeIA(['anthropic/ANTHROPIC_API_KEY: chatCheap(x): Algo raro'], false).error, 'Claude falló: Algo raro. Prueba de nuevo.');
});

test('el camino real: `generar` le pasa los errores de la red, y «Conecta tu Claude» no promete un GPT que no arma flujos', () => {
  const crear = leer('lib/flujo-ia-crear.ts');
  assert.match(crear, /return falloDeIA\(errores, hayIA, erroresRed\);/, 'el mensaje no se entera de qué le pasó a la red');
  // OpenAI no está en esta cascada (cobra): si entra, el texto tiene que decir «o tu GPT».
  assert.ok(!PROVS_CREAR_IA.includes('openai'), 'OpenAI entró a la cascada de crear: el aviso ahora puede decir «o tu GPT»');
  // Todo corto: es una línea que se dibuja en el chat.
  for (const red of [[GEMINI_DIA], [GEMINI_MINUTO], [GEMINI_SATURADO], [], ['red gratis salteada: el negocio usa su propia IA']]) {
    assert.ok(sinIAPropia(red).error.length <= 95, `«${sinIAPropia(red).error}» es largo para una línea`);
  }
});

// ── Probado rompiéndolo (22/10/2026, romper.mjs) ───────────────────────────────────────────────────────────────────
// Los números son «tests / fallan» de ESTE archivo con cada rotura.
//   R1. `falloDeIA` sin la red (vuelve «No tienes ninguna IA gratis conectada»)   → 5 / 1
//   R2. sin distinguir el tope POR DÍA                                              → 5 / 1
//   R3. `generar` sin pasarle `erroresRed`                                          → 5 / 1
//   R4. la red decide aunque el negocio tenga keys                                  → 5 / 1
//   R5. sin el veredicto «crédito»                                                  → 5 / 1
//   R6. el link vuelve a Gemini                                                     → 5 / 2
