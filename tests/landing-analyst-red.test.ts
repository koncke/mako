// =============================================================================
// El Diagnóstico de una landing con las keys del cliente caídas: red de plataforma y la causa REAL
// =============================================================================
// Pedido de Martín (15/10/2026), con la captura del Diagnóstico de la landing de un cliente (ws1):
// «Intenté analizar la landing y dice "Tu IA está conectada pero no pudo diagnosticar la landing
// ahora mismo. Prueba de nuevo en un momento."... Soluciona ese error.»
//
// Medido en `anthropic_usage` (sólo lectura): las keys del ws1 no contestaban. Gemini sin un 200
// desde el 08/10 (2.143 rebotes 429), Mistral 429 siempre, OpenAI sin crédito, OpenRouter sin una
// fila buena, y Groq salteado con razón (el pedido pesa ~10.500 tokens contando la salida; su plan
// gratis topea en 8.000 por minuto). Claude, vetado. La Gemini de la AGENCIA, con un pedido del
// mismo tamaño (2.405 tokens de entrada): 200 en 72 s y el JSON entero. Dos fallas nuestras:
//   1. `chatClaude` corría la cascada SIN la red de plataforma (nadie se la pasaba).
//   2. Los errores se quedaban adentro de `chatClaude`: salía «Claude vetado» y el Diagnóstico lo
//      traducía con `errorDeCascada([])`, el texto genérico sin una sola pista.
//
// Probado rompiéndolo el 15/10/2026 (con todo puesto: 7 pasan / 0 fallan; restaurado: 7 / 0):
//   · chatClaude no le pasa la red a la cascada                      -> 6 / 1
//   · chatClaude se guarda los errores (sin el push a erroresOut)     -> 6 / 1
//   · analizarCopy traduce con errorDeCascada([])                     -> 6 / 1
//   · analizarCopy no pasa redDePlataforma                            -> 6 / 1
//   · analizarLanding no le pasa red ni plazo a analizarCopy          -> 6 / 1
//   · el Diagnóstico pide redDePlataforma: false                      -> 6 / 1
//   · el camino «de afuera» sin comoAnalizar()                        -> 6 / 1
//   · la red sin el filtro del techo de entrada                       -> 6 / 1
//   · esCascadaSinRespuesta sólo mira el veto                         -> 6 / 1
//   · motivoDeErroresCascada: un 413 solo vuelve a dar null           -> 6 / 1
//   · mensajeIAFallo: el tamaño vuelve a «Prueba de nuevo»            -> 6 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esCascadaSinRespuesta, mensajeIAFallo, motivoDeErroresCascada } from '../lib/ia-mensajes';

const NL = String.fromCharCode(10);
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** El cuerpo de una función exportada, hasta su llave de cierre a la izquierda. */
const cuerpo = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  return src.slice(i, src.indexOf(NL + '}', i) + 2);
};

// Lo que dejaron las keys del ws1 el 15/10 (la forma en que las escribe chatCheapCascade).
const ERRORES_WS1 = [
  'gemini: chatCheap(gemini): HTTP 429',
  'gemini: chatCheap(gemini): HTTP 429',
  'mistral: chatCheap(mistral): HTTP 429',
  'mistral: chatCheap(mistral): HTTP 429',
  'openai: chatCheap(openai): You exceeded your current quota, please check your plan and billing details.',
];
const VETO = 'Claude vetado — «landing-analyst» no está en la lista blanca de lib/veto-claude.ts. Claude está prohibido salvo excepción explícita (pedido del dueño, 13/8/2026).';

test('un fallo de la cascada entera se reconoce por sus errores, diga lo que diga el message', () => {
  assert.equal(esCascadaSinRespuesta(VETO, ERRORES_WS1), true, 'el veto con errores es la cascada sin respuesta');
  assert.equal(esCascadaSinRespuesta('landing-analyst: gemini no contestó antes del plazo (…). Se reintenta en la próxima corrida.', ERRORES_WS1), true,
    'el plazo vencido también: la cascada corrió y no contestó nadie');
  assert.equal(esCascadaSinRespuesta(VETO, []), true, 'el veto sin errores es «no había ninguna key que probar»');
  // Lo que NO es la cascada pasa tal cual: un JSON roto o la base son otra cosa.
  assert.equal(esCascadaSinRespuesta('Respuesta sin JSON', []), false);
  assert.equal(esCascadaSinRespuesta('Unexpected end of JSON input', []), false);
});

test('con las keys del cliente rebotando, el texto dice la causa y QUÉ contestó cada una', () => {
  const t = mensajeIAFallo({ hayIA: true, motivo: motivoDeErroresCascada(ERRORES_WS1), errores: ERRORES_WS1, tema: 'diagnosticar la landing' });
  assert.ok(!t.startsWith('Tu IA está conectada pero no pudo'), `volvió el genérico sin pistas: ${t}`);
  assert.match(t, /sin cuota/);
  assert.match(t, /gemini: HTTP 429/, 'el detalle tiene que nombrar al proveedor y lo que contestó');
});

test('un 413 por tamaño no es «tu IA no pudo» ni manda a reintentar', () => {
  const groq413 = 'groq: chatCheap(groq): Request too large for model `openai/gpt-oss-120b` in organization org_x service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 10539, please reduce your message size and try again. Visit https://console.groq.com/docs/rate-limits for more information.';
  const m = motivoDeErroresCascada([groq413]);
  assert.ok(m && /más largo/.test(m), `un 413 solo tiene que decir que no entra: ${m}`);
  const t = mensajeIAFallo({ hayIA: true, motivo: m, errores: [groq413], tema: 'diagnosticar la landing' });
  assert.ok(!/Prueba de nuevo|Reintenta/.test(t), `reintentar no arregla un tope de tamaño: ${t}`);
  // Mezclado con un 429 de verdad, el 413 se SACA y decide el otro (no se tira la lista).
  assert.match(motivoDeErroresCascada([groq413, 'gemini: chatCheap(gemini): HTTP 429']) ?? '', /sin cuota/);
});

test('chatClaude le pasa la red de plataforma a la cascada y le devuelve los errores al caller', () => {
  const src = cuerpo(leer('../lib/anthropic.ts'), 'export async function chatClaude(');
  const llamada = src.slice(src.indexOf('await chatCheapCascade({'), src.indexOf('});', src.indexOf('await chatCheapCascade({')));
  assert.match(llamada, /redDePlataforma: opts\.redDePlataforma/, 'la cascada de chatClaude volvió a correr sin la red');
  assert.match(llamada, /erroresPlataformaOut: opts\.erroresPlataformaOut/, 'los errores de la red se perdieron (o se mezclan con los del cliente)');
  assert.match(src, /opts\.erroresOut\?\.push\(\.\.\.errores\)/, 'los errores de las keys del negocio se vuelven a quedar adentro de chatClaude');
});

test('el análisis pide los errores, y si la cascada no contestó el texto lo elige errorDeCascada', () => {
  const src = cuerpo(leer('../lib/landing-analyst.ts'), 'export async function analizarCopy(');
  assert.match(src, /erroresOut: errores/, 'analizarCopy dejó de pedir los errores de la cascada');
  assert.match(src, /redDePlataforma: opts\.redDePlataforma/, 'analizarCopy dejó de pasar la red');
  assert.match(src, /esCascadaSinRespuesta\(msg, errores\)[\s\S]*errorDeCascada\(errores, /,
    'el fallo de la cascada volvió a llegar como el message crudo («Claude vetado»)');
  const lan = cuerpo(leer('../lib/landing-analyst.ts'), 'export async function analizarLanding(');
  assert.match(lan, /analizarCopy\(pagina, comp, \{ redDePlataforma: opts\.redDePlataforma, hastaMs: opts\.hastaMs \}\)/,
    'analizarLanding dejó de pasarle la red y el plazo al análisis');
});

test('el Diagnóstico pide la red y un plazo en los DOS caminos (nuestra y de afuera)', () => {
  const src = leer('../lib/editor-landing/diagnostico-server.ts');
  assert.match(src, /const comoAnalizar = \(\) => \(\{ redDePlataforma: true, hastaMs: Date\.now\(\) \+ PLAZO_ANALISIS_MS \}\)/);
  assert.match(cuerpo(src, 'async function analizarNuestra('), /analizarCopy\(pagina, comp, plazo\)/,
    'una landing NUESTRA se volvió a analizar sin la red');
  assert.match(cuerpo(src, 'async function analizarDeAfuera('), /\.\.\.comoAnalizar\(\)/,
    'una landing de AFUERA se volvió a analizar sin la red');
});

test('la red de plataforma también respeta el techo de entrada (no gasta dos 413 de Groq)', () => {
  const src = cuerpo(leer('../lib/ai-cheap.ts'), 'export async function chatCheapCascade(');
  const red = src.slice(src.indexOf('if (opts.redDePlataforma)'));
  assert.match(red, /\(await provsGratisDePlataforma\(\)\.catch\(\(\) => \[\]\)\)\s*\.filter\(\(r\) => pesa <= \(TECHO_ENTRADA\[r\.provider\]/,
    'la red volvió a probar a quien no le entra el pedido');
});
