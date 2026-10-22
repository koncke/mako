// =============================================================================
// IA3 (22/10/2026): el fallo de la clave del NEGOCIO (su Claude, su OpenAI) queda escrito y se ve en «Tus cuentas de IA»
// =============================================================================
// El relevamiento del 22/10: 0 filas en toda la historia con la marca «⚠ clave de Anthropic del negocio», aunque el ws10 y
// el ws11 la tienen. `conClaveDelNegocio` devolvía `{ error }` sin anotarlo y la cascada seguía con Gemini: una clave sin
// crédito se veía igual que «nunca se usó». Lo que fija este test:
//   1. Las reglas (lib/su-clave-reglas.ts): el motivo corto, la fila sin el texto del proveedor y la línea de la tarjeta.
//   2. Las funciones REALES (tests/_su-clave-hijo.ts, contra una base de mentira): una función de texto deja la fila de su
//      Claude y la de su OpenAI; la tarjeta las lee; un fallo repetido no llena la tabla; «Probar mi clave» no cobra y
//      deja su fila; la plataforma no anota nada; una copia de la clave de MaKo no se prueba.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · sin el `anotarFalloDeSuClave` del error de `conClaveDelNegocio` → «la fila de su Claude» en rojo;
//   · sin el `anotarSuOpenAI` de la cascada de texto → «la fila de su OpenAI» en rojo;
//   · sin el corte por la plataforma en `anotarFalloDeSuClave` → «la plataforma no anota» en rojo;
//   · sin la memoria de 5 minutos → «un fallo repetido» en rojo;
//   · el motivo con el texto del proveedor → «nunca la clave» en rojo;
//   · el 429 mirado antes del «sin crédito» → «el sin crédito de OpenAI es un 429» en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { estadoDeSuClave, filaDeFallo, motivoCorto, textoDeSuClave, MARCA_SU_CLAVE, type FilaUsoClave } from '../lib/su-clave-reglas';
import { hace } from '../lib/progreso-reglas';

const RAIZ = join(__dirname, '..');

test('el motivo corto: sin crédito, clave inválida, tope, no contestó (y el «sin crédito» de OpenAI es un 429)', () => {
  assert.equal(motivoCorto('HTTP 400 invalid_request_error Your credit balance is too low to access the Anthropic API.'), 'sin crédito');
  assert.equal(motivoCorto('HTTP 429 · You exceeded your current quota, please check your plan and billing details. insufficient_quota'), 'sin crédito', 'el sin crédito de OpenAI llega como un 429');
  assert.equal(motivoCorto('HTTP 401 authentication_error invalid x-api-key'), 'clave inválida');
  assert.equal(motivoCorto('chatCheap(openai): Incorrect API key provided: sk-proj-****abcd.'), 'clave inválida');
  assert.equal(motivoCorto('HTTP 429 rate_limit_error Number of request tokens has exceeded your per-minute rate limit'), 'tope por minuto');
  assert.equal(motivoCorto('HTTP 529 overloaded_error Overloaded'), 'no contestó');
  assert.equal(motivoCorto('The operation was aborted due to timeout'), 'no contestó');
  assert.equal(motivoCorto('HTTP 403 permission_error'), 'sin permiso');
  assert.equal(motivoCorto('algo raro'), 'otro error');
});

test('la fila: la marca PRIMERO, el modelo marcado, y nunca la clave ni el texto del proveedor', () => {
  const error = 'Incorrect API key provided: sk-proj-**************abcd. You can find your API key at https://platform.openai.com';
  const f = filaDeFallo('openai', 'gpt-4o-mini', motivoCorto(error));
  assert.equal(f.model, 'fallo:gpt-4o-mini');
  assert.ok(f.motivo.startsWith(MARCA_SU_CLAVE.openai), 'la marca va primero (insertUsage corta a 200)');
  assert.doesNotMatch(f.motivo, /sk-|platform\.openai|Incorrect/, 'nunca el texto del proveedor: trae la clave enmascarada');
  assert.equal(filaDeFallo('anthropic', null, 'sin crédito').model, 'fallo:-');
});

test('la tarjeta: manda lo más reciente; sin la marca no es su Claude; un rebote no es «anduvo»', () => {
  const ahora = Date.parse('2026-10-22T15:00:00Z');
  const marca = MARCA_SU_CLAVE.anthropic;
  const filas: FilaUsoClave[] = [
    { created_at: '2026-10-22T13:00:00Z', provider: 'anthropic', model: 'fallo:claude-haiku-4-5', motivo: `${marca} · falló: sin crédito` },
    { created_at: '2026-10-22T10:00:00Z', provider: 'anthropic', model: 'claude-haiku-4-5', motivo: `${marca} · Armar el catálogo` },
    // El Claude de MaKo (sin la marca) no es su clave.
    { created_at: '2026-10-22T14:59:00Z', provider: 'anthropic', model: 'claude-sonnet-5', motivo: 'closing' },
  ];
  const e = estadoDeSuClave('anthropic', filas);
  assert.equal(e.anduvo, '2026-10-22T10:00:00Z');
  assert.deepEqual(e.fallo, { at: '2026-10-22T13:00:00Z', motivo: 'sin crédito' });
  assert.deepEqual(textoDeSuClave(e, ahora, hace), { texto: 'Tu clave de Claude falló hace 2 h: sin crédito', tono: 'mal' });
  // Falló y después anduvo: anda.
  const despues = estadoDeSuClave('anthropic', [...filas, { created_at: '2026-10-22T14:55:00Z', provider: 'anthropic', model: 'claude-haiku-4-5', motivo: marca }]);
  assert.deepEqual(textoDeSuClave(despues, ahora, hace), { texto: 'Anduvo hace 5 min', tono: 'bien' });
  // OpenAI: un rebote por cuota y la red de la plataforma no son «anduvo».
  const oai = estadoDeSuClave('openai', [
    { created_at: '2026-10-22T14:00:00Z', provider: 'openai', model: 'rebote429:gpt-4o-mini', motivo: '429 de openai' },
    { created_at: '2026-10-22T14:10:00Z', provider: 'openai', model: 'gpt-4o-mini', motivo: '⚠ red de plataforma · x' },
  ]);
  assert.deepEqual(textoDeSuClave(oai, ahora, hace), { texto: 'Todavía no se usó', tono: 'nada' });
});

test('las funciones reales: cada fallo de su clave deja su fila, y la tarjeta lo lee', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_su-clave-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida.split('@@RESULTADO@@').pop() ?? '{}');
  assert.equal(r.error, undefined, r.error);
  // La fila que la base rechazó no frena la siguiente (insertUsage ahora dice si escribió).
  assert.equal(r.filasConLaBaseCaida, 0);
  assert.equal(r.filasDespues, 1, 'con la base de vuelta, el próximo fallo tiene que quedar escrito, sin esperar 5 min');
  const filas = r.filasTexto as Array<{ ws: number; provider: string; model: string; motivo: string }>;
  const claude = filas.find((f) => f.provider === 'anthropic');
  const openai = filas.find((f) => f.provider === 'openai');
  assert.ok(claude, 'la fila de su Claude: una función de texto con su clave sin crédito tiene que dejarla');
  assert.equal(claude!.ws, 3);
  assert.equal(claude!.motivo, `${MARCA_SU_CLAVE.anthropic} · falló: sin crédito`);
  assert.ok(openai, 'la fila de su OpenAI: el 401 de su GPT tiene que dejarla');
  assert.equal(openai!.motivo, `${MARCA_SU_CLAVE.openai} · falló: clave inválida`);
  assert.equal(openai!.model, 'fallo:gpt-4o-mini');
  // La tarjeta: las dos claves, con su fallo.
  const estado = r.estado as Array<{ proveedor: string; fallo: { motivo: string } | null; es: string }>;
  assert.deepEqual(estado.map((e) => [e.proveedor, e.es, e.fallo?.motivo]), [['anthropic', 'propia', 'sin crédito'], ['openai', 'propia', 'clave inválida']]);
  assert.equal(r.repetido, 0, 'un fallo repetido no llena la tabla (una fila por motivo cada 5 minutos)');
  assert.deepEqual(r.probarClaude, { ok: false, texto: 'Tu clave de Claude no anda: clave inválida.' });
  assert.ok((r.todas as Array<{ model: string }>).some((f) => f.model === 'fallo:count_tokens'), '«Probar mi clave» que falla deja su fila');
  assert.ok((r.red as string[]).includes('api.anthropic.com/v1/messages/count_tokens'), 'Probar usa count_tokens, que no cobra');
  assert.ok((r.red as string[]).includes('api.openai.com/v1/models'), 'Probar su OpenAI usa la lista de modelos, que no cobra');
  assert.equal(r.plataforma, 0, 'la plataforma no anota: su clave es la de MaKo');
  assert.equal(r.redCopia, 0, 'una copia de la clave de MaKo no se prueba');
  assert.match(r.probarCopia.texto, /es la de MaKo, no la tuya/);
  for (const f of r.todas as Array<{ motivo: string; cost: number }>) {
    assert.doesNotMatch(f.motivo, /sk-|Incorrect|credit balance/, 'nunca la clave ni el texto del proveedor en la fila');
    assert.equal(f.cost, 0);
  }
});

// Revisión del lote 1 (22/10/2026): cada prueba descifra la clave y espera al proveedor hasta 15 s; sin tope, un admin (o
// una sesión robada) la podía golpear sin fin.
test('«Probar mi clave» tiene un tope por negocio', () => {
  const ruta = readFileSync(join(__dirname, '..', 'app/api/ia-del-negocio/probar-clave/route.ts'), 'utf8');
  assert.match(ruta, /const frenado = limitePorClave\('probar-clave', persona\.ws, 10, 10 \* 60_000\);\s*if \(frenado\) return frenado;/);
  assert.ok(ruta.indexOf('limitePorClave(') < ruta.indexOf('probarSuClave(persona.ws'), 'el tope va antes de probar');
});
