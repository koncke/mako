// =============================================================================
// Sumar en bloque a otro CRM sin sacarlos del suyo (4/11/2026, punto 3 de la campaña de email de Mauricio)
// =============================================================================
// Lo que se le dijo a Mauricio en la llamada: un CRM nuevo «Email Marketing» con sus leads, a todos «menos lo que están en
// ganado». `pasar_en_bloque_otro_funnel` no sirve (los SACA del origen); `agregar_en_bloque_a_crm` es `agregarLoteAProducto`.
//
// Corre el runner REAL (tests/_email-campana-hijo.ts, escenario «lote») contra una base en memoria con dos CRM: el
// principal (la casa de todos) y «Email Marketing».
//
// Probado ROMPIÉNDOLO (4/11/2026), sobre una base de 7 / 0: sin `excluirEstados` en `filtrarParaAgregar` → 4 / 3; sin el
// `soloConEmail` → 4 / 3; sin el chequeo de la entrada que manda sola, en `preparar` y en `ejecutar` → 6 / 1 cada uno; sin
// `hasta` → 6 / 1. Restaurado, 7 / 0.
//
// Correr: node --import tsx --test tests/email-campana-lote.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { filtrarParaAgregar } from '../lib/agregar-en-bloque';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'lote'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el filtro: saltea los estados excluidos y, si se pide, a los que no tienen email; dice cuántos y por qué', () => {
  const filas = [
    { id: 1, estado_lead: 'abierto', email: 'a@x.test' }, { id: 2, estado_lead: 'ganado', email: 'b@x.test' },
    { id: 3, estado_lead: null, email: ' ' }, { id: 1, estado_lead: 'abierto', email: 'a@x.test' }, { id: 4, estado_lead: 'no_responde', email: 'd@x.test' },
  ];
  assert.deepEqual(filtrarParaAgregar(filas, { excluir: new Set(['ganado', 'no_responde']), soloConEmail: true }), { ids: [1], afuera: ['1 ganado', '1 no responde', '1 sin email'] });
  assert.deepEqual(filtrarParaAgregar(filas, { excluir: new Set(), soloConEmail: false }).ids, [1, 2, 3, 4], 'sin filtros, todos y sin repetir');
});

test('lo que no se puede, antes del «sí»: sin a quiénes, un estado que no existe, un CRM de otro negocio', () => {
  assert.deepEqual(R.sinNada.faltan, ['leadIds']);
  assert.match(R.estadoRaro.error, /vendido/);
  assert.match(R.crmAjeno.error, /no es de este negocio/);
});

test('todos menos los ganados y los sin email: el resumen dice a quiénes y quiénes quedan afuera', () => {
  assert.deepEqual(R.prep.payload.ids, [601, 602, 605, 606]);
  assert.match(R.prep.resumen, /Quedan afuera: 1 ganado, 1 sin email/);
  assert.match(R.prep.resumen, /Siguen en su CRM de siempre/);
});

test('los suma en la columna de entrada, saltea a los que ya estaban, y NO los saca de su CRM', () => {
  assert.equal(R.ejec.ok, true);
  assert.equal(R.ejec.datos.agregados, 2);
  assert.equal(R.ejec.datos.yaEstaban, 2, 'el 602 tenía fila y el 606 tiene su casa en ese CRM');
  assert.deepEqual(R.filas, [{ lead: 601, etapa: 'em_entrada' }, { lead: 602, etapa: 'em_abrio' }, { lead: 605, etapa: 'em_entrada' }]);
  assert.equal(R.casasIguales, true, 'ninguna casa ni etapa de la casa cambió');
  assert.deepEqual(R.historial, [601, 605], 'cada sumado deja su historial');
});

test('con una automatización activa en la entrada no suma: les escribiría a todos en la próxima vuelta', () => {
  assert.match(R.conAutomatizacion.error, /automatización activa/);
  assert.equal(R.ejecConAutomatizacion.ok, false, 'tampoco si la prendieron entre el «sí» y el ejecutar');
});

test('sin tiempo, no escribe y devuelve lo que quedó', () => {
  assert.deepEqual(R.sinTiempo.pendientes, [604]);
  assert.equal(R.sinTiempoEscribio, 0);
});

test('nada salió a la red', () => {
  assert.deepEqual(R.otros, []);
});
