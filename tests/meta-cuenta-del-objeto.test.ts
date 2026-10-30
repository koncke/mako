// =============================================================================
// Un id de Meta que llega de afuera se lee o se escribe SÓLO si es de la cuenta del workspace
// =============================================================================
// EL CASO (13/10/2026, del relevo del Ads Manager). El público de un conjunto, los
// textos de un anuncio, los datos de una campaña y pausar/presupuestar/renombrar/
// borrar se hacían con el id que mandaba el navegador —o el modelo, por la API de
// MaKo— y el token del workspace. Un token que llega a varias cuentas (una agencia,
// un usuario de sistema) leía o pisaba el objeto de OTRA cuenta, y Meta contestaba
// sin error. Ahora cada lectura pide `account_id` en el mismo pedido y cada escritura
// lo pregunta antes; la regla es `esDeLaCuenta` (lib/meta-cuenta-id.ts).
//
// Lo que NO cubre, a propósito: crear (va a `act_<cuenta>/…` y Meta valida que el
// conjunto o la campaña sean de esa cuenta), borrar lo que el mismo pedido acaba de
// crear (`deleteEntity` en un rollback) y las lecturas por ids que salen de NUESTROS
// datos (ganadores, aprobación pendiente).
//
// PROBADO ROMPIÉNDOLO el 13/10/2026 (con todo puesto: 6 pasan, 0 fallan). Pasan / fallan:
//   · `esDeLaCuenta` devuelve siempre true                                   -> 4 / 2
//   · getAdsetTargeting sin el `exigirDeLaCuenta`                            -> 5 / 1
//   · updateAdsetTargeting escribe ANTES de comprobar                        -> 5 / 1
//   · metaErrorEnvelope sin la rama del 404                                  -> 5 / 1
//   · meta-write sin `fueraDeLaCuenta`                                       -> 5 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esDeLaCuenta } from '../lib/meta-cuenta-id';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función de nivel superior: desde su firma hasta la próxima declaración. */
function bloque(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const resto = src.slice(ini + firma.length);
  const fin = resto.search(/\n(export |async function |function |const |\/\*\*)/);
  return firma + (fin < 0 ? resto : resto.slice(0, fin));
}

// ── 1. la regla ──────────────────────────────────────────────────────────────

test('el mismo número con y sin act_ es la misma cuenta; otro número, no', () => {
  assert.equal(esDeLaCuenta('1357728489423123', 'act_1357728489423123'), true);
  assert.equal(esDeLaCuenta('act_1357728489423123', '1357728489423123'), true);
  assert.equal(esDeLaCuenta(1357728489423123, 'act_1357728489423123'), true, 'un número también');
  assert.equal(esDeLaCuenta('1426493815659364', 'act_1357728489423123'), false);
});

test('sin saber de quién es, no se lee ni se escribe', () => {
  for (const v of [undefined, null, '', 'act_', 'abc', {}, []]) assert.equal(esDeLaCuenta(v, 'act_1357728489423123'), false, String(v));
  assert.equal(esDeLaCuenta('1357728489423123', null), false, 'el workspace sin cuenta');
  assert.equal(esDeLaCuenta('1357728489423123', ''), false);
});

// ── 2. los que leen por id piden account_id en el mismo pedido y lo comprueban ─

test('las lecturas por id piden account_id y lo comprueban antes de devolver nada', () => {
  const src = sinComentarios(leer('../lib/meta-ads-create.ts'));
  for (const firma of [
    'export async function getAdsetTargeting(',
    'export async function getAdForEdit(',
    'export async function getAdsetForAdd(',
    'export async function getCampaignBasics(',
  ]) {
    const b = bloque(src, firma);
    // Desde el 26/10/2026 la lectura puede ir por Zernio (`leerObjetoMeta`, el paso directo de Meta con los MISMOS campos, o
    // `anuncioMetaPorZernio`): lo que se cuida es igual, que se pida account_id y se compruebe apenas se lee, antes de devolver.
    assert.match(b, /['`]account_id,/, `${firma} no pide account_id`);
    const lee = Math.max(b.lastIndexOf('await graphGet(url.toString())'), b.lastIndexOf('await leerObjetoMeta('));
    const comprueba = b.indexOf('await exigirDeLaCuenta(data.account_id);');
    assert.ok(lee > 0 && comprueba > lee, `${firma} no lo comprueba después de leer`);
    assert.ok(!/\breturn\b/.test(b.slice(lee, comprueba)), `${firma} devuelve algo antes de comprobar la cuenta`);
  }
});

test('editar el público comprueba la cuenta ANTES de escribir', () => {
  const b = bloque(sinComentarios(leer('../lib/meta-ads-create.ts')), 'export async function updateAdsetTargeting(');
  const chequeo = b.indexOf("await exigirDeLaCuenta(await cuentaDelObjeto(adsetId, 'adset'));");
  const escritura = b.indexOf('await graphPost(adsetId');
  assert.ok(chequeo > 0 && escritura > chequeo, 'el chequeo tiene que ir antes del graphPost');
});

test('un objeto de otra cuenta sale 404, no 403 ni 502', () => {
  const b = bloque(sinComentarios(leer('../lib/meta-ads-create.ts')), 'export function metaErrorEnvelope(');
  const rama404 = b.indexOf('if (err instanceof FueraDeLaCuentaError) return { ok: false, message: err.message, status: 404 };');
  const ramaMeta = b.indexOf('if (err instanceof MetaWriteError)');
  assert.ok(rama404 > 0 && ramaMeta > rama404, 'la rama del 404 va antes que la de MetaWriteError (es su subclase)');
});

// ── 3. pausar, presupuestar, renombrar y borrar ──────────────────────────────

test('meta-write pregunta de quién es el objeto antes de cualquier escritura', () => {
  // Desde el 17/10/2026 `metaWrite` envuelve a `escribirEnMeta` (expira el árbol de Meta del negocio después de escribir,
  // tests/ads-arbol-cache.test.ts): el chequeo vive en el cuerpo de verdad, y metaWrite no escribe por otro camino.
  assert.match(bloque(sinComentarios(leer('../lib/meta-write.ts')), 'export async function metaWrite('), /const r = await escribirEnMeta\(body, ws\);/);
  const b = bloque(sinComentarios(leer('../lib/meta-write.ts')), 'async function escribirEnMeta(');
  const chequeo = b.indexOf('const ajeno = await fueraDeLaCuenta(ver, token, body.id, ws);\n  if (ajeno) return ajeno;');
  const borrar = b.indexOf("if (body.op === 'delete')");
  const params = b.indexOf('const params = new URLSearchParams();');
  assert.ok(chequeo > 0, 'falta el chequeo');
  assert.ok(borrar > chequeo && params > chequeo, 'el chequeo va antes del borrado y antes de armar la escritura');
  const f = bloque(sinComentarios(leer('../lib/meta-write.ts')), 'async function fueraDeLaCuenta(');
  assert.match(f, /esDeLaCuenta\(data\.account_id, cuenta\) \? null : \{[^}]*status: 404 \}/);
});
