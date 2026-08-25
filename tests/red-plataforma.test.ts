// =============================================================================
// Un cliente con UNA sola key no tiene cascada
// =============================================================================
// 2026-08-25, 02:45 UTC. Un cliente escribió y MaKo le contestó con un error. En
// `anthropic_usage` no hay NI UNA llamada de ese minuto, y 74 segundos después la
// misma consulta funcionó perfecto: Gemini había tenido un bache.
//
// El ws13 tiene cargada `GEMINI_API_KEY` y nada más. La cascada del doer prueba
// [gemini, groq, cerebras, mistral, openai] y las últimas cuatro devuelven null al
// instante por falta de key: **cinco casilleros, un solo intento real.** Y encima
// `chatCheapTools` —el camino del tool-use, o sea el de WhatsApp— pegaba UNA vez y
// tiraba, mientras la otra mitad del módulo (`chatCheapCascade`) ya reintentaba.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('El camino del tool-use reintenta la SATURACIÓN, no la cuota', () => {
  const src = leer('../lib/ai-cheap.ts');
  const i = src.indexOf('export async function chatCheapTools');
  const cuerpo = src.slice(i, src.indexOf('export async function chatCheapToolsCascade'));
  assert.ok(/const saturacion =/.test(cuerpo),
    'chatCheapTools volvió a pegar una sola vez: un 503 de segundos mata el turno');
  // ⚠️ Un 429 es la CUOTA de esa cuenta: reintentar es pedirle otra vez a quien ya
  // dijo que no. Quien llama rota. Si el 429 volviera a entrar acá, cada turno
  // pagaría esperas inútiles antes de rotar.
  assert.ok(!/\b429\b/.test(cuerpo.slice(cuerpo.indexOf('const saturacion ='), cuerpo.indexOf('const saturacion =') + 400)),
    'el 429 volvió a reintentarse: hay que ROTAR, no insistirle a la cuota agotada');
});

test('Nunca se reintenta después de que una tool tocó datos', () => {
  // La regla que el propio módulo ya dice para la cascada: «reintentar después de
  // una acción a medias es duplicarla». Un reintento después de que una tool creó
  // un borrador crea DOS.
  const src = leer('../lib/ai-cheap.ts');
  assert.match(src, /toolsUsados > 0 \|\| intento >= 1/,
    'se perdió la ventana segura del reintento: puede duplicar lo que una tool ya hizo');
});

test('La red de plataforma es solo GRATIS y solo último recurso', () => {
  const src = leer('../lib/ai-cheap.ts');
  const i = src.indexOf('export async function provsGratisDePlataforma');
  const cuerpo = src.slice(i, i + 700);
  assert.ok(i > 0, 'desapareció la red de plataforma: un cliente con una key vuelve a quedar sin cascada');
  // ⚠️ `openai` y `anthropic` NO: ahí una llamada de más es una FACTURA de más, y
  // eso es una decisión de plata que no toma el código.
  assert.ok(!/'openai'|'anthropic'/.test(cuerpo),
    'entró un proveedor que COBRA a la red de plataforma: eso le factura a la agencia sin que nadie lo decida');
  for (const p of ['gemini', 'groq', 'cerebras', 'mistral']) {
    assert.ok(cuerpo.includes(`'${p}'`), `la red perdió ${p}`);
  }

  // Y solo se usa cuando lo del cliente ya falló.
  const doer = leer('../lib/mako-doer-in.ts');
  const j = doer.indexOf('provsGratisDePlataforma()');
  assert.ok(j > 0, 'el doer dejó de usar la red de plataforma');
  assert.ok(doer.slice(j - 200, j).includes('if (!respuesta)'),
    'la red de plataforma dejó de ser el ÚLTIMO recurso: le gastaría cuota a la agencia teniendo el cliente la suya');
});

test('La red tiene presupuesto de tiempo y no arranca por el que ya falló', () => {
  const doer = leer('../lib/mako-doer-in.ts');
  // Del otro lado hay alguien mirando el chat: 11 keys sin tope son un minuto.
  assert.match(doer, /const limite = Date\.now\(\) \+ 25_000/,
    'la red de plataforma perdió su presupuesto de tiempo');
  // Si el cliente corre en Gemini y Gemini está saturado, la Gemini de la agencia
  // lo está igual: es el mismo servicio. Medido — dos keys de Gemini se comieron
  // los 25 s enteros en la verificación de este arreglo.
  assert.match(doer, /distintoPrimero/,
    'la red volvió a arrancar por el proveedor que acaba de fallar');
});

test('El aviso de error no puede apoyarse en una clasificación DUDOSA', () => {
  // «soy mako obvio que puedo responderte» cayó en `capturar (dudosa)` —el default
  // de «sin señal clara»— y `esRutaPlan` da true para `→ capturar`, así que la
  // suposición elegía el texto del error y salía «No pude armar el borrador».
  const doer = leer('../lib/mako-doer-in.ts');
  assert.match(doer, /avisoNoPude\(esCargaDePlan\(texto\) \|\| \(esRutaPlan\(ruta\.motivo\) && !intencion\.dudosa\)\)/,
    'el texto del error volvió a decidirse con la adivinanza del clasificador');
});
