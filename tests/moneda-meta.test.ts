// =============================================================================
// El gasto de Meta se pasa a dólares con la moneda de la CUENTA, no asumiendo pesos
// =============================================================================
// EL CASO (08/10/2026). Todo lo que mostraba gasto de Meta en dólares dividía `spend` por
// 17,30 para todos los workspaces: 44 usos en 13 archivos. Medido contra Meta ese día:
// ws1, ws4 y ws11 cobran en MXN; ws13, ws14 y ws15 en USD. Para esos tres, el dashboard,
// el CAC, los experimentos, la salud de la cuenta y MaKo mostraban el gasto 17,3 veces
// más chico («1.336 MXN ≈ 77 USD» sobre 1.336 dólares). Las ESCRITURAS ya convertían con
// la moneda real (`usdACuenta`); la lectura no.
//
// PROBADO ROMPIÉNDOLO (con todo puesto: 6 pasan, 0 fallan). Pasan / fallan:
//   · `aUsdNum` vuelve a dividir siempre por la tasa del peso           -> 4 / 2
//   · `aUsd` inventa un número para una moneda desconocida              -> 5 / 1
//   · una moneda sin tasa (ARS) se convierte con la del peso            -> 5 / 1
//   · un lector vuelve a dividir el gasto por TIPO_DE_CAMBIO_USD_MXN    -> 5 / 1
//   · el sincronizador deja de pedir `account_currency`                 -> 5 / 1
//   · la tool del doer vuelve a rotular el gasto como `gasto_mxn`        -> 5 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { conversorDeGasto } from '../lib/presupuesto-cambio';
import { TIPO_DE_CAMBIO_USD_MXN } from '../lib/config';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. la conversión ─────────────────────────────────────────────────────────

test('⚠️ UNA CUENTA EN USD NO SE DIVIDE POR 17,3: su gasto ya está en dólares', () => {
  const usd = conversorDeGasto('USD');
  assert.equal(usd.aUsd(1336), 1336, 'ws13 cobra en USD: 1.336 es lo que cobró Meta');
  assert.equal(usd.aUsdNum(1336), 1336);
  const mxn = conversorDeGasto('MXN');
  assert.equal(mxn.aUsdNum(1730), 1730 / TIPO_DE_CAMBIO_USD_MXN, 'una cuenta en pesos sigue con la tasa del código');
  assert.equal(mxn.aUsd(1730), 1730 / TIPO_DE_CAMBIO_USD_MXN);
  // La moneda llega como la manda Meta; en minúsculas o con espacios también vale.
  assert.equal(conversorDeGasto(' usd ').moneda, 'USD');
});

test('Una moneda que no se sabe, o sin tasa, NO inventa un número donde la salida puede decir «no sé»', () => {
  assert.equal(conversorDeGasto(null).aUsd(500), null, 'sin moneda conocida, aUsd va vacío');
  assert.equal(conversorDeGasto('ARS').aUsd(500), null, 'ARS no tiene tasa en el código: vacío, no la del peso');
  // `aUsdNum` es para los tableros cuyo tipo no admite vacío: con la moneda CONOCIDA sin
  // tasa devuelve el monto crudo (igual que `usdACuenta`), nunca la tasa del peso.
  assert.equal(conversorDeGasto('ARS').aUsdNum(500), 500);
});

test('Con la moneda DESCONOCIDA, `aUsdNum` convierte como antes y LO AVISA una sola vez', () => {
  const avisos: string[] = [];
  const c = conversorDeGasto(null, (m) => avisos.push(m));
  c.aUsdNum(0);
  assert.equal(avisos.length, 0, 'con gasto 0 no hay nada que convertir: un negocio sin Meta no avisa');
  assert.equal(c.aUsdNum(1730), 1730 / TIPO_DE_CAMBIO_USD_MXN);
  c.aUsdNum(10);
  assert.equal(avisos.length, 1, 'un aviso por conversor, no uno por fila');
});

// ── 2. nadie vuelve a asumir pesos ───────────────────────────────────────────

/** Los únicos que pueden nombrar la tasa del peso para convertir: donde se define y donde
 *  se decide qué hacer con cada moneda. El resto pide su conversor a lib/moneda-meta.ts. */
const PUEDEN = new Set(['lib/config.ts', 'lib/presupuesto-cambio.ts']);

test('⚠️ NINGÚN LECTOR DIVIDE EL GASTO POR TIPO_DE_CAMBIO_USD_MXN NI USA mxnAUsd', () => {
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !PUEDEN.has(f));
  const malos: string[] = [];
  for (const f of archivos) {
    let src: string;
    try { src = sinComentarios(leer(`../${f}`)); } catch { continue; }
    src.split('\n').forEach((l, i) => {
      if (/\/\s*TIPO_DE_CAMBIO_USD_MXN\b|\bmxnAUsd\s*\(|\*\s*TIPO_DE_CAMBIO_USD_MXN\b/.test(l)) malos.push(`${f}:${i + 1}: ${l.trim()}`);
    });
  }
  assert.deepEqual(malos, [], `estos convierten asumiendo que la cuenta cobra en pesos:\n${malos.join('\n')}`);
});

test('el sincronizador guarda la moneda de la cuenta en el mismo pedido de siempre', () => {
  const src = sinComentarios(leer('../lib/meta-ads.ts'));
  const i = src.indexOf('export async function fetchMetaInsights(');
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  assert.match(cuerpo, /'account_currency'/, 'dejó de pedir account_currency: el gasto nuevo no tiene moneda guardada');
  assert.match(cuerpo, /registrarMonedaMeta\(/, 'pide la moneda y no la guarda');
});

test('⚠️ la tool del doer rotula el gasto con la moneda REAL, no con `gasto_mxn`', () => {
  const src = sinComentarios(leer('../lib/mako-doer-acciones.ts'));
  const i = src.indexOf("case 'listar_campanas_meta': {");
  const cuerpo = src.slice(i, src.indexOf("case 'proponer_lead':", i));
  assert.ok(i > 0 && cuerpo.length > 200, 'no encontré el cuerpo de listar_campanas_meta');
  assert.ok(!/\bgasto_mxn\s*:/.test(cuerpo), 'volvió el campo gasto_mxn fijo: una cuenta en USD vuelve a leerse como pesos');
  assert.match(cuerpo, /monedaCuentaMeta\(/, 'la tool no pregunta la moneda de la cuenta');
});
