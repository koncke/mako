// =============================================================================
// Cada replay por BOQ lleva ids de cliente NUEVOS, y el proyecto se queda
// =============================================================================
// ⚠️ MEDIDO el 07/09/2026, segundo pedido real de imagen por BOQ (el primero fue
// código 7 por el captcha viejo; con el captcha fresco vino esto):
//
//   ["wrb.fr","ogiZ0b",null,null,null,[13],"generic"] … ["af.httprm",21027,…]
//
// Código 13 (INTERNAL) a los 21 segundos: el backend procesó el pedido y murió
// adentro. El cuerpo repetía los UUID de lote y de request de la generación con la
// que se enseñó. En las dos plantillas reales TODOS los ids de cliente están en
// MAYÚSCULAS y el único en minúsculas es el `projectId` — la misma separación que
// hacía el camino REST con `randomUUID()` por pedido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renovarIdsDeCliente, FORMA_ID_CLIENTE, reponerCaptcha } from '../lib/flow-boq-patch';
import { leerRespuestaBoq } from '../lib/flow-boq-respuesta';

const raiz = resolve(import.meta.dirname, '..');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const worker = vivo(readFileSync(resolve(raiz, 'extension', 'background.js'), 'utf8'));

const PROYECTO = '9973383e-74eb-4503-80f3-d30fb856781a';
// La forma REAL del cuerpo de video, con el token abreviado y ya form-encodeado.
const VIDEO = 'f.req=%5B%5B%5B%22YhhmEf%22%2C%22%5B%5B%5B%5Bnull%2Cnull%2C%5B%5B%5B%5C%22un+cubo%5C%22%5D%5D%5D%5D%2C%5C%22abra_t2v_4s_360p%5C%22%2C1%2Cnull%2C%5Bnull%2Cnull%2Cnull%2Cnull%2C%5C%22AA8FBDD4-CFFD-4967-9EF1-E4B26413AA6E%5C%22%2C%5C%223EC04B2D-75F5-45B3-9E5C-506311AFA83D%5C%22%5D%5D%5D%2C%5Bnull%2C22%2Cnull%2Cnull%2Cnull%2C%5C%22' + PROYECTO + '%5C%22%5D%2C%5B%5C%22C7A55175-550E-4E71-925D-DCA38A6F6A5B%5C%22%2C2%5D%5D%22%5D%5D%5D&at=__MAKO_AT__';

test('los UUID en MAYÚSCULAS se renuevan; el proyecto (minúsculas) no se toca', () => {
  let n = 0;
  const r = renovarIdsDeCliente(VIDEO, () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);
  assert.equal(r.cuantos, 3, 'el cuerpo real de video trae dos ids de request y uno de lote');
  assert.ok(r.cuerpo.includes(PROYECTO), 'tocó el projectId: el pedido iría a otro proyecto');
  for (const viejo of ['AA8FBDD4-CFFD-4967-9EF1-E4B26413AA6E', '3EC04B2D-75F5-45B3-9E5C-506311AFA83D', 'C7A55175-550E-4E71-925D-DCA38A6F6A5B']) {
    assert.ok(!r.cuerpo.includes(viejo), `quedó el id viejo ${viejo}`);
  }
  assert.equal(Object.keys(r.mapa).length, 3);
});

test('el mismo id viejo recibe el mismo nuevo en todo el cuerpo', () => {
  // El cuerpo de imagen trae dos pedidos en el batch: un lote referido dos veces
  // tiene que seguir siendo UN lote.
  const cuerpo = 'x=%5C%22D8231EAE-4056-4D20-9731-BA1F3EEEADCA%5C%22%2C%5C%22D8231EAE-4056-4D20-9731-BA1F3EEEADCA%5C%22';
  let n = 0;
  const r = renovarIdsDeCliente(cuerpo, () => `11111111-1111-4111-8111-${String(++n).padStart(12, '1')}`);
  assert.equal(r.cuantos, 2);
  assert.equal(n, 1, 'generó dos ids para el mismo lote');
  assert.equal(r.cuerpo.split('11111111-1111-4111-8111-111111111111').length - 1, 2);
});

test('sin ids no se inventa nada, y la forma no agarra minúsculas ni cosas parecidas', () => {
  const r = renovarIdsDeCliente('f.req=%5B%5D&at=__MAKO_AT__');
  assert.equal(r.cuantos, 0);
  assert.ok(!new RegExp(FORMA_ID_CLIENTE.source).test(PROYECTO), 'la forma agarra el projectId');
  assert.ok(!new RegExp(FORMA_ID_CLIENTE.source).test('mako7f3a9c 0cAFcWeA5wN-YXhV1rHII7vC'));
});

test('renovar ids y reponer el captcha no se pisan entre sí', () => {
  const token = '0cAFcWe' + 'Q'.repeat(2400);
  const conToken = VIDEO.replace('%5B%5C%22C7A55175', `%5B%5C%22${'0cAFcWe' + 'A'.repeat(2400)}%5C%22%2C1%5D%2C%5B%5C%22C7A55175`);
  const a = reponerCaptcha(conToken, token);
  const b = renovarIdsDeCliente(a.cuerpo, () => 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB');
  assert.equal(a.cuantos, 1);
  assert.equal(b.cuantos, 3);
  assert.ok(b.cuerpo.includes(token));
  assert.ok(b.cuerpo.includes(PROYECTO));
});

test('el lector reporta el código 13 con los ms del backend', () => {
  // La respuesta REAL, tal cual la guardó el espejo.
  const t = `)]}'\n\n111\n[["wrb.fr","ogiZ0b",null,null,null,[13],"generic"],["di",21028],["af.httprm",21027,"-3720435022075259421",5]]\n25\n[["e",4,null,null,147]]`;
  const r = leerRespuestaBoq(t, 'ogiZ0b');
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, 'ERROR_DE_GOOGLE');
  assert.match(!r.ok ? r.detalle : '', /^codigo 13 \(ogiZ0b\) · 21027 ms$/);
});

test('el replay renueva los ids DESPUÉS del captcha y ANTES de mandar', () => {
  const i = worker.indexOf('const rc = reponerCaptcha(r.cuerpo, token);');
  const j = worker.indexOf('const ids = renovarIdsDeCliente(cuerpoFinal);');
  const k = worker.indexOf("tipo: 'BOQ_PEDIDO', url: pl.url, cuerpo: cuerpoFinal,");
  assert.ok(i > 0 && j > i && k > j, 'el orden captcha → ids → envío no se cumple');
  assert.match(worker, /cuerpoFinal = ids\.cuerpo;/);
  assert.match(worker, /codigo 13.*Google empezó a procesarlo y falló a mitad de camino/);
});
