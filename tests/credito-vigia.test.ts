// =============================================================================
// El vigía del crédito de Claude: el % de cada cuenta y un aviso por ciclo al 80% y al 100% (11/11/2026)
// =============================================================================
// Desde que el espacio de MaKo y WhatsApp gastan PRIMERO el crédito de las cuentas Max (Martín: «gastemos eso para todo esto en
// lugar de Gemini, porque es mucho más estable»), una cuenta que se acaba sin aviso es WhatsApp contestando con el cartel. Lo que
// fija este test:
//   1. lo puro (`avisosDelCredito`, lib/credito-api.ts): un aviso al 80% por ciclo, otro al 100% (o con «sin crédito»), nunca
//      los dos juntos; con lo gastado sin poder leer, NINGÚN % (se avisa «no pude leer»); las no vinculadas, nada;
//   2. lo de verdad (tests/_credito-vigia-hijo.ts): el vigía guarda el %, reclama el aviso una vez (la segunda corrida no
//      repite), lo manda a la campanita del ws SuperAdmin, y sin poder leer no inventa un %;
//   3. el cableado: corre desde /api/cron/alerta-critica.
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { avisosDelCredito, ordenDeLasCuentas, PREFIJO_AVISO_DEL_CREDITO, type FilaCredito } from '../lib/credito-api';

const AHORA = Date.parse('2026-11-11T15:00:00Z');
const fila = (cuenta: string, gastadoUsd: number | null, extra: Partial<FilaCredito> = {}): FilaCredito => ({
  cuenta, vinculada: true, desde: '2026-11-01T03:00:00.000Z', renueva: null, gastadoUsd, llamadas: 1, delNegocio: [], sinCreditoAt: null, vinculableDesde: null, ...extra,
});
const niveles = (r: ReturnType<typeof avisosDelCredito>) => r.avisos.map((a) => `${a.cuenta}:${a.nivel}`);

test('1. al 80% un aviso por ciclo, al 100% otro; nunca los dos juntos', () => {
  const r = avisosDelCredito([fila('claude1', 100), fila('claude2', 162), fila('claude3', 201)], new Set(), AHORA);
  assert.deepEqual(niveles(r), ['claude2:80', 'claude3:100']);
  assert.match(r.avisos[0].texto, /^claude2: US\$162 de 200 \(81%\), según lo que registró MaKo\./);
  assert.deepEqual(r.uso, { ANTHROPIC_CREDITO_CUENTA1: 50, ANTHROPIC_CREDITO_CUENTA2: 81, ANTHROPIC_CREDITO_CUENTA3: 100.5 });
  // Ya avisado en este ciclo: no se repite. En el ciclo siguiente, sí.
  const ya = new Set(r.avisos.map((a) => a.clave));
  assert.deepEqual(niveles(avisosDelCredito([fila('claude2', 170), fila('claude3', 220)], ya, AHORA)), [], 'el aviso se repitió en el mismo ciclo');
  assert.deepEqual(niveles(avisosDelCredito([fila('claude2', 170, { desde: '2026-12-01T03:00:00.000Z' })], ya, AHORA)), ['claude2:80'], 'el ciclo nuevo no volvió a avisar');
  // Con el 80% ya avisado, el 100% avisa igual.
  assert.deepEqual(niveles(avisosDelCredito([fila('claude2', 205)], ya, AHORA)), ['claude2:100']);
  // «Sin crédito» (lo contestó Anthropic) cuenta como el 100%, aunque lo registrado no llegue.
  const sin = avisosDelCredito([fila('claude4', 120, { sinCreditoAt: '2026-11-11T14:00:00.000Z' })], new Set(), AHORA);
  assert.deepEqual(niveles(sin), ['claude4:100']);
  assert.match(sin.avisos[0].texto, /Anthropic contestó «sin crédito»/);
  assert.ok(r.avisos.every((a) => a.clave.startsWith(PREFIJO_AVISO_DEL_CREDITO)));
});

test('1. sin poder leer lo gastado, ningún %: se avisa «no pude leer» (una vez por día); una cuenta sin vincular, nada', () => {
  const r = avisosDelCredito([fila('claude2', null), fila('claude5', 300, { vinculada: false })], new Set(), AHORA);
  assert.deepEqual(niveles(r), ['claude2:no-pude-leer']);
  assert.deepEqual(r.uso, {}, 'se guardó un % inventado');
  assert.doesNotMatch(r.avisos[0].texto, /%/, 'el aviso de «no pude leer» trae un %');
  assert.deepEqual(niveles(avisosDelCredito([fila('claude2', null)], new Set(r.avisos.map((a) => a.clave)), AHORA + 3_600_000)), [], 'el mismo día se repitió');
  // Con el % de alguna cuenta sin saber, el vigía no guarda (incompleto): lo gastado ilegible, o la clave ilegible.
  assert.equal(r.completo, false, 'con lo gastado ilegible, el % se dio por completo');
  assert.equal(avisosDelCredito([fila('claude1', 100), fila('claude2', 10, { vinculada: null })], new Set(), AHORA).completo, false, 'con la clave ilegible, el % se dio por completo');
  assert.equal(avisosDelCredito([fila('claude1', 100), fila('claude5', 0, { vinculada: false })], new Set(), AHORA).completo, true, 'una cuenta sin vincular dejó el % incompleto');
});

test('1. para la plataforma, una cuenta que falta en el % es «no sé», nunca 0%: queda fuera (los grupos la usan, al final)', () => {
  const C1 = 'ANTHROPIC_CREDITO_CUENTA1', C2 = 'ANTHROPIC_CREDITO_CUENTA2', C3 = 'ANTHROPIC_CREDITO_CUENTA3';
  assert.deepEqual(ordenDeLasCuentas([C1, C2, C3], { [C1]: 40, [C3]: 95 }, 'plataforma', 0), [C1], 'la plataforma usó una cuenta sin %');
  assert.deepEqual(ordenDeLasCuentas([C1, C2, C3], {}, 'plataforma', 0), [], 'un % vacío abrió la reserva de WhatsApp');
  assert.deepEqual(ordenDeLasCuentas([C1, C2, C3], { [C1]: 40, [C3]: 95 }, 'grupos', 0), [C1, C3, C2]);
  assert.deepEqual(ordenDeLasCuentas([C1, C2, C3], null, 'plataforma', 1), [C2, C3, C1], 'sin dato del vigía, el reparto de siempre');
});

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_credito-vigia-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@VIGIA@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@VIGIA@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('2. el vigía de verdad: guarda el %, avisa una vez por la campanita, y sin poder leer no inventa un %', () => {
  const r = correr();
  assert.equal(r.al81.ok, true, String(r.al81.error));
  assert.deepEqual(r.al81.avisos.map((a: { r: string }) => a.r), ['avisado'], 'el 81% no avisó (o no llegó por ningún lado)');
  assert.equal(r.uso81.ANTHROPIC_CREDITO_CUENTA2, 81, 'el % de la cuenta 2 no quedó guardado para el reparto');
  assert.deepEqual(r.al81OtraVez.avisos, [], 'la corrida siguiente volvió a avisar el 80%');
  assert.deepEqual(r.al101.avisos.map((a: { r: string }) => a.r), ['avisado'], 'el 100% no avisó');
  assert.equal(r.campanitas.length, 2);
  assert.ok(r.campanitas.every((c: string) => c.startsWith('credito-claude:claude2: ')), r.campanitas.join(' | '));
  assert.equal(r.sinLeer.ok, true);
  // Sin poder leer el gasto, no se inventa un % ni se pisa el último: queda el 101% de antes, con SU hora (vence solo).
  assert.deepEqual(r.usoSinLeer, { ANTHROPIC_CREDITO_CUENTA2: 101 }, 'sin poder leer el gasto, se pisó el último % conocido');
  assert.equal(r.usoSinLeerMismaHora, true, 'sin poder leer el gasto, el % viejo quedó con la hora de ahora');
  assert.equal(r.sinLeer.uso, undefined, 'la corrida dice que guardó un %');
  assert.deepEqual(r.sinLeer.avisos.map((a: { clave: string }) => a.clave.split('.').slice(-2, -1)[0]), ['no-pude-leer']);
});

test('3. corre desde la guardia de cada 10 minutos, y el «una vez» es un compare-and-set que se suelta si no salió', () => {
  const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(leer('app/api/cron/alerta-critica/route.ts'), /const credito = await vigilarCreditoClaude\(\);/);
  const v = leer('lib/credito-vigia.ts');
  assert.match(v, /if \(!\(await cambiarSettingSi\(a\.clave, null, v\)\)\) \{ hechos\.push\(\{ clave: a\.clave, r: 'ya-estaba' \}\); continue; \}/);
  assert.match(v, /await borrarSettingSi\(a\.clave, v\)/, 'un aviso que no salió deja el reclamo puesto y no se vuelve a intentar');
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   V1 sin mirar «ya avisado» (avisa en cada corrida)                              → fallan el 1 y el 2
//   V2 con lo gastado ilegible, se toma como 0 (un % inventado)                    → fallan el 1 y el 2
//   V3 el 80% sin el ciclo en la clave del aviso (un aviso para siempre)          → falla el 1
//   V4 el vigía sin guardar el %                                                   → falla el 2
//   V5 el vigía guarda aunque el % esté incompleto (pisa el último con {})         → falla el 2
//   V6 la plataforma cuenta como 0% una cuenta que falta en el %                   → falla el 1
