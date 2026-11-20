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
//   4. el texto se entiende (19/11/2026): qué pasó, si cuadra con lo que gastó MaKo, con qué sigue (otra cuenta, o Gemini y los
//      grupos sin IA), cuándo vuelve y qué hacer; sin «%» ni «según lo que registró MaKo».
//
// Probado rompiéndolo (11/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { avisosDelCredito, ordenDeLasCuentas, PREFIJO_AVISO_DEL_CREDITO, resumenCredito, type FilaCredito } from '../lib/credito-api';

const AHORA = Date.parse('2026-11-11T15:00:00Z');
const fila = (cuenta: string, gastadoUsd: number | null, extra: Partial<FilaCredito> = {}): FilaCredito => ({
  cuenta, vinculada: true, desde: '2026-11-01T03:00:00.000Z', renueva: null, gastadoUsd, llamadas: 1, delNegocio: [], sinCreditoAt: null, vinculableDesde: null, ...extra,
});
const niveles = (r: ReturnType<typeof avisosDelCredito>) => r.avisos.map((a) => `${a.cuenta}:${a.nivel}`);

test('1. al 80% un aviso por ciclo, al 100% otro; nunca los dos juntos', () => {
  const r = avisosDelCredito([fila('claude1', 100), fila('claude2', 162), fila('claude3', 201)], new Set(), AHORA);
  assert.deepEqual(niveles(r), ['claude2:80', 'claude3:100']);
  assert.match(r.avisos[0].texto, /^El crédito de Claude de la cuenta claude2 se está acabando: MaKo ya gastó US\$162 de los US\$200 de este mes\./);
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
  assert.match(sin.avisos[0].texto, /Anthropic dice que no le queda saldo/);
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
  assert.ok(r.campanitas.every((c: string) => c.startsWith('credito-claude:') && c.includes('cuenta claude2')), r.campanitas.join(' | '));
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

test('4. el aviso se entiende (19/11/2026, «no entiendo lo que me quiere decir»): qué pasó, si cuadra, con qué sigue, cuándo vuelve y qué hacer', () => {
  // Lo de esa noche, con los datos de producción: sólo la 1 y la 2 vinculadas, las dos con «sin crédito» y ~US$5,7 anotados en
  // noviembre; la 3, la 4 y la 5 nunca se vincularon. El aviso viejo decía «MaKo sigue con las otras cuentas»: no quedaba ninguna.
  const ahora = Date.parse('2026-11-19T21:11:06Z');
  const filas = [
    fila('claude1', 5.71, { sinCreditoAt: '2026-11-19T21:10:41.240Z', clientes: [1, 13, 15, 20, 23, 24] }),
    fila('claude2', 5.75, { sinCreditoAt: '2026-11-19T21:10:44.699Z', clientes: [10, 13, 15, 23, 24] }),
    fila('claude3', null, { vinculada: false }), fila('claude4', null, { vinculada: false }), fila('claude5', null, { vinculada: false }),
  ];
  const nombres = { 1: 'Mauricio Bustos', 10: 'Leandro Tejado', 13: 'Codigo Inmobiliario', 15: 'Brigitte Eberlin', 20: 'Sergio Arriata', 23: 'Marcela Fernandez' };
  const r = avisosDelCredito(filas, new Set(), ahora, undefined, nombres);
  assert.deepEqual(niveles(r), ['claude1:100', 'claude2:100']);
  const t = r.avisos[0].texto;
  assert.match(t, /^Se terminó el crédito de Claude de la cuenta claude1: Anthropic dice que no le queda saldo\.\n/);
  assert.match(t, /No lo gastó MaKo: este mes usó US\$6 de los US\$200\. El resto se usó fuera de MaKo o venció antes\./);
  assert.match(t, /· No queda NINGUNA cuenta con crédito de Claude: lo interno de MaKo sigue con Gemini\./, 'dijo que seguía con otra cuenta sin que quedara ninguna');
  // Quiénes se quedan sin Claude: los clientes de las DOS cuentas (el reparto los rota), con su nombre; el que no se pudo leer, con su número.
  assert.match(t, /· Se quedan sin Claude: Mauricio Bustos, Leandro Tejado, Codigo Inmobiliario, Brigitte Eberlin, Sergio Arriata, Marcela Fernandez y el negocio 24\. En WhatsApp, a los que no tienen IA propia MaKo no les puede contestar\./);
  assert.doesNotMatch(t, /sigue con claude2|las otras cuentas/, 'contó como «con crédito» una cuenta que Anthropic dio sin saldo');
  assert.match(t, /Vuelve con el próximo cobro del plan de esa cuenta \(MaKo no sabe qué día es\)\./);
  assert.match(t, /Qué hacer: vincula el crédito de claude3, claude4 y claude5 en Ops Center › Uso/);
  assert.match(t, /platform\.claude\.com → Billing de esa cuenta/, 'no cuadra y no dice dónde mirar en qué se fue');
  for (const a of r.avisos) assert.doesNotMatch(a.texto, /%|según lo que registró|Se saltea/, a.texto);

  // Con otra cuenta que todavía paga: sigue con ésa, y no hay nada que hacer. Con el día de cobro, la fecha en que vuelve.
  const otra = avisosDelCredito([fila('claude1', 5.71, { sinCreditoAt: '2026-11-19T21:10:41.240Z', renueva: '2026-12-05T03:00:00.000Z' }), fila('claude3', 40)], new Set(), ahora);
  assert.deepEqual(niveles(otra), ['claude1:100']);
  assert.match(otra.avisos[0].texto, /· MaKo sigue con claude3\./);
  assert.match(otra.avisos[0].texto, /· Vuelve el 05\/12, con el cobro del plan\./);
  assert.match(otra.avisos[0].texto, /· Qué hacer: nada por ahora\./);

  // Los clientes salen de lo registrado: los que usaron ESA cuenta en el ciclo, sin la plataforma ni una llamada sin crédito.
  const gastos = [
    { workspace_id: 9, created_at: '2026-11-10T12:00:00Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · x', cuenta: 1, cost_usd: 0.01, provider: 'anthropic', model: 'claude-haiku-4-5' },
    { workspace_id: 13, created_at: '2026-11-10T12:00:00Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · grupo', cuenta: 1, cost_usd: 0.01, provider: 'anthropic', model: 'claude-haiku-4-5' },
    { workspace_id: 23, created_at: '2026-11-10T12:00:00Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 2) · grupo', cuenta: 2, cost_usd: 0.01, provider: 'anthropic', model: 'claude-haiku-4-5' },
    { workspace_id: 24, created_at: '2026-11-19T21:10:00Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · sin crédito hasta el próximo ciclo', cuenta: 1, cost_usd: 0, provider: 'anthropic', model: 'claude-haiku-4-5' },
  ];
  const res = resumenCredito({ vinculadas: { claude1: true, claude2: true }, gastos, wsConClave: new Map(), ahora, wsPlataforma: 9, cuentas: [{ cuenta: 'claude1', clave: 'ANTHROPIC_CREDITO_CUENTA1' }, { cuenta: 'claude2', clave: 'ANTHROPIC_CREDITO_CUENTA2' }] });
  assert.deepEqual(res.map((f) => f.clientes), [[13], [23]], 'la plataforma o una llamada sin crédito contó como un cliente que usó el crédito');
  assert.equal(res[0].sinCreditoAt, '2026-11-19T21:10:00.000Z');

  // El crédito vuelve solo (20/11/2026, las dos cuentas a la noche): una llamada COBRADA después del corte borra el «sin crédito».
  // Una falla en 0 (sobrecarga) no prueba nada: sigue sin crédito.
  const vuelta = (extra: typeof gastos) => resumenCredito({ vinculadas: { claude1: true }, gastos: [...gastos, ...extra], wsConClave: new Map(), ahora: Date.parse('2026-11-20T13:00:00Z'), wsPlataforma: 9, cuentas: [{ cuenta: 'claude1', clave: 'ANTHROPIC_CREDITO_CUENTA1' }] })[0];
  assert.equal(vuelta([{ workspace_id: 19, created_at: '2026-11-20T09:11:53Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · grupo', cuenta: 1, cost_usd: 0.0025, provider: 'anthropic', model: 'claude-haiku-4-5' }]).sinCreditoAt, null, 'volvió a cobrar y seguía diciendo «sin crédito»');
  assert.equal(vuelta([{ workspace_id: 19, created_at: '2026-11-20T09:11:53Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · grupo', cuenta: 1, cost_usd: 0, provider: 'anthropic', model: 'fallo:claude-haiku-4-5' }]).sinCreditoAt, '2026-11-19T21:10:00.000Z', 'una falla en 0 borró el «sin crédito»');
  assert.equal(vuelta([{ workspace_id: 13, created_at: '2026-11-19T20:00:00Z', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · grupo', cuenta: 1, cost_usd: 0.01, provider: 'anthropic', model: 'claude-haiku-4-5' }]).sinCreditoAt, '2026-11-19T21:10:00.000Z', 'una llamada de ANTES del corte borró el «sin crédito»');

  // Cuando lo gastó MaKo, cuadra: no se manda a mirar en qué se fue.
  const nuestra = avisosDelCredito([fila('claude2', 199, { sinCreditoAt: '2026-11-19T21:10:44.699Z' })], new Set(), ahora);
  assert.match(nuestra.avisos[0].texto, /· Cuadra con lo que gastó MaKo: US\$199 de los US\$200 de este mes\./);
  assert.doesNotMatch(nuestra.avisos[0].texto, /en qué se fue/);
});

// ── Probado rompiéndolo (11/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   V1 sin mirar «ya avisado» (avisa en cada corrida)                              → fallan el 1 y el 2
//   V2 con lo gastado ilegible, se toma como 0 (un % inventado)                    → fallan el 1 y el 2
//   V3 el 80% sin el ciclo en la clave del aviso (un aviso para siempre)          → falla el 1
//   V4 el vigía sin guardar el %                                                   → falla el 2
//   V5 el vigía guarda aunque el % esté incompleto (pisa el último con {})         → falla el 2
//   V6 la plataforma cuenta como 0% una cuenta que falta en el %                   → falla el 1
//   V7 (19/11/2026) una cuenta con «sin crédito» cuenta como que todavía paga        → falla el 4 («dijo que seguía con otra cuenta»)
//   V8 (20/11/2026) el «sin crédito» queda aunque después se cobre una llamada       → falla el 4 («volvió a cobrar…»)
