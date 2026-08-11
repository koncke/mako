// =============================================================================
// El histórico apunta a bloques que existen, y no se le muestra al cliente
// =============================================================================
// `lib/cs-historico.ts` nombra clientes REALES de Mauricio. Dos cosas tienen que
// quedar fijas y las dos se rompen en silencio:
//
//  1. Si un `claseId` no existe en el programa, ese caso no lo ve nadie: queda
//     colgado de un bloque fantasma y el aporte se pierde sin un solo error.
//  2. Es material de UN cliente. Mostrárselo a otro es filtrar información que
//     ninguno de los dos autorizó, y la pantalla del cliente no puede importarlo
//     ni por accidente.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HISTORICO, casosDe, casosDeCliente, bloquesConHistorico } from '../lib/cs-historico';
import { claseDe } from '../lib/programa-catalogo';

test('todo caso apunta a un bloque que existe de verdad', () => {
  for (const c of HISTORICO) {
    assert.ok(claseDe(c.claseId), `${c.cliente}: el bloque «${c.claseId}» no está en el programa`);
  }
});

test('todo caso dice de dónde sale: sin fuente no se puede auditar', () => {
  for (const c of HISTORICO) {
    assert.ok(c.fuente.trim().length > 8, `${c.cliente}/${c.claseId}: sin fuente`);
    assert.ok(c.que.trim().length > 15, `${c.cliente}/${c.claseId}: el «qué pasó» está vacío`);
    assert.ok(c.leccion.trim().length > 15, `${c.cliente}/${c.claseId}: sin lección, es una anécdota`);
  }
});

test('los dos atoros que él mide como los peores tienen material', () => {
  // Definir la evidencia (m7c1) y poner el umbral (m8c1) son, por su propio
  // documento, el bloqueo número uno y el segundo. Si el histórico no dice nada
  // ahí, no está aportando donde importa.
  assert.ok(casosDe('m7c1').length > 0, 'la evidencia se quedó sin casos');
  assert.ok(casosDe('m8c1').length > 0, 'los umbrales se quedaron sin casos');
});

test('casosDe devuelve vacío para un bloque sin material, sin romper', () => {
  assert.deepEqual(casosDe('m3c2'), []);
  assert.deepEqual(casosDe('no-existe'), []);
});

test('casosDeCliente busca sin distinguir mayúsculas', () => {
  assert.ok(casosDeCliente('texx').length > 0);
  assert.ok(casosDeCliente('TEXX Supertiendas').length > 0);
  assert.deepEqual(casosDeCliente('empresa que no existe'), []);
});

test('bloquesConHistorico no repite y viene ordenado', () => {
  const b = bloquesConHistorico();
  assert.equal(new Set(b).size, b.length);
  assert.deepEqual(b, [...b].sort());
});

test('la pantalla del CLIENTE no importa el histórico: es material de otro cliente', () => {
  // El guard de verdad, no un comentario. Cada entrada nombra a un cliente real
  // de Mauricio; que aparezca en la pantalla a la que entra otro cliente por un
  // link público sería filtrar información entre dos empresas que no se
  // conocen. La segunda capa de la regla que está escrita arriba del módulo.
  const pantalla = readFileSync('app/compartido/[token]/TareaCliente.tsx', 'utf8');
  assert.ok(!pantalla.includes('cs-historico'), 'TareaCliente.tsx importa el histórico: es material de OTRO cliente');

  const vista = readFileSync('lib/cs-tarea-vista.ts', 'utf8');
  assert.ok(!vista.includes('cs-historico'), 'cs-tarea-vista.ts arma lo que ve el cliente: no puede traer el histórico');
});
