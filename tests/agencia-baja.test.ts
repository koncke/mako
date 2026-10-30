// =============================================================================
// «Dar de baja» la cuenta de un cliente de una agencia (29/10/2026, lib/agencia-baja.ts)
// =============================================================================
// Lo prometido a Thiago (llamada del 29/10, 10:07): la agencia puede «darlo de baja cuando vos quieras». Se fija: el orden
// (la plata primero; sin cancelar el cobro no se sigue), que sólo la agencia dueña de la fila la da de baja, que la cartera
// revocada corta «Inspeccionar», que la cuenta queda pausada sin borrar nada, y que la reabre SÓLO un plan del cliente.
//
// Probado rompiéndolo (29/10/2026; base 5 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · la cartera se revoca ANTES de cancelar el cobro                                   -> 4 / 1
//   · el corte `sin-agencia` se reabre con el mes que la agencia ya había pagado         -> 4 / 1
//   · `puedeEntrar` deja entrar a una cartera revocada                                  -> 4 / 1
//   · la baja borra la cuenta en vez de pausarla                                        -> 4 / 1
//   · la pantalla le muestra «Dar de baja» al super admin                               -> 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pasoDeAcceso, textoDelCorte, type CorteGuardado } from '../lib/plan-acceso-reglas';
import { puedeEntrar } from '../lib/agencia-cartera';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

// ⚠️ 29/10/2026, segunda pasada de la revisión de plata: la pausa (y su corte) va ANTES de revocar, para que una falla se
// reintente entera (revocada primero, el reintento contestaba «ya estaba» y la cuenta quedaba gratis).
test('el orden: primero dejar de cobrar, después la pausa, después la cartera y el aviso', () => {
  const b = fuente('lib/agencia-baja.ts');
  const cancelar = b.indexOf('cancelarSuscripcionCobro(plataforma, c.id, p.autor)');
  const revocar = b.indexOf(".update({ estado: 'revocado'");
  const pausar = b.indexOf(".update({ estado: 'pausado'");
  const avisar = b.indexOf('avisarDePlataforma(');
  assert.ok(cancelar > 0 && cancelar < pausar && pausar < revocar && revocar < avisar, `orden: ${cancelar} ${pausar} ${revocar} ${avisar}`);
  assert.match(b, /if \(!r\.ok\) return \{ ok: false, error: `No pude cancelar su cobro/, 'si no se pudo dejar de cobrar, no se sigue');
  assert.match(b, /\.eq\('agencia_ws', agenciaWs\)\.eq\('cliente_ws', clienteWs\)\.neq\('estado', 'revocado'\)/, 'sólo la fila de ESA agencia, una vez');
  assert.doesNotMatch(b, /\.delete\(\)/, 'no se borra nada');
});

test('la cartera revocada corta «Inspeccionar»', () => {
  const f = (estado: 'pendiente' | 'aprobado' | 'revocado') => [{ agencia_ws: 5, cliente_ws: 9, estado, decidido_por: null, decidido_at: null, motivo: null, created_at: '' }];
  assert.equal(puedeEntrar(5, 9, f('aprobado') as never), true);
  assert.equal(puedeEntrar(5, 9, f('revocado') as never), false);
});

test('la cuenta pausada por la baja la reabre SÓLO un plan que paga el cliente', () => {
  const corte: CorteGuardado = { cobroId: 0, hasta: '2026-10-29', motivo: 'sin-agencia', desde: '2026-10-29T10:00:00Z', vigente: true };
  assert.deepEqual(pasoDeAcceso({ estado: 'cubierto', cobroId: 3, hasta: '2026-11-20', motivo: 'baja' }, 'pausado', corte), { tipo: 'nada' }, 'el mes que pagó la agencia no la reabre');
  assert.deepEqual(pasoDeAcceso({ estado: 'al-dia', cobroId: 8 }, 'pausado', corte), { tipo: 'reabrir' });
  assert.match(textoDelCorte(corte).titulo, /agencia/);
  assert.match(textoDelCorte(corte).detalle, /datos están guardados/);
});

test('«Dar de baja» está en la computadora, en el teléfono y en la API, y no se le muestra al super admin', () => {
  assert.match(fuente('app/agency/AgencyApp.tsx'), /abierta\.estado !== 'revocado' && puedeAbrir && !superAdmin && \(/);
  assert.match(fuente('app/m/agency/AgencyM.tsx'), /c\.estado !== 'revocado' && puedeAbrir && !superAdmin && \(/);
  assert.match(fuente('lib/api-mako/areas/cs.def.ts'), /id: 'dar_de_baja_cliente_agency'/);
  assert.match(fuente('lib/api-mako/areas/cs.run.ts'), /darDeBajaClienteDeAgencia\(\{ agenciaWs: ctx\.ws, clienteWs/);
});

test('el cliente sin plan propio lo elige y lo paga él (reactivar abre su primer plan, atado a su cuenta)', () => {
  const c = fuente('lib/compra-plan.ts');
  assert.match(c, /if \(!base\) return primerPlanPropio\(ws, p, cobros\);/);
  assert.match(c, /\.update\(\{ alta_ws: ws, plan_mako: plan\.id \}\)/);
});
